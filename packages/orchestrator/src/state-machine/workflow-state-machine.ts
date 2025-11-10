import { createMachine, interpret } from 'xstate';
import { logger } from '../utils/logger';
import { WorkflowRepository } from '../repositories/workflow.repository';
import { EventBus } from '../events/event-bus';

export interface WorkflowContext {
  workflow_id: string;
  type: string;
  current_stage: string;
  progress: number;
  error?: Error;
  metadata: Record<string, any>;
  decision_id?: string;
  clarification_id?: string;
  pending_decision?: boolean;
  pending_clarification?: boolean;
  _stageTransitionInProgress?: boolean; // Internal flag to prevent double invocation of moveToNextStage
}

export type WorkflowEvent =
  | { type: 'START' }
  | { type: 'STAGE_COMPLETE'; stage: string }
  | { type: 'STAGE_FAILED'; stage: string; error: Error }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'CANCEL' }
  | { type: 'RETRY' }
  | { type: 'DECISION_REQUIRED'; decision_id: string }
  | { type: 'DECISION_APPROVED'; decision_id: string }
  | { type: 'DECISION_REJECTED'; decision_id: string; reason?: string }
  | { type: 'CLARIFICATION_REQUIRED'; clarification_id: string }
  | { type: 'CLARIFICATION_COMPLETE'; clarification_id: string };

export const createWorkflowStateMachine = (
  context: WorkflowContext,
  repository: WorkflowRepository,
  eventBus: EventBus
) => {
  // TODO: Update xstate type arguments for newer version compatibility
  return createMachine({
    id: 'workflow',
    initial: 'initiated',
    context,
    states: {
      initiated: {
        on: {
          START: {
            target: 'running',
            actions: ['logTransition', 'updateWorkflowStatus']
          }
        }
      },
      running: {
        entry: ['clearTransitionInProgress'], // Clear the flag when entering running state
        on: {
          STAGE_COMPLETE: {
            target: 'evaluating',
            actions: ['updateProgress', 'logStageComplete']
          },
          STAGE_FAILED: {
            target: 'failed',
            actions: ['logError', 'updateWorkflowStatus']
          },
          DECISION_REQUIRED: {
            target: 'awaiting_decision',
            actions: ['recordDecisionId', 'logDecisionRequired']
          },
          CLARIFICATION_REQUIRED: {
            target: 'awaiting_clarification',
            actions: ['recordClarificationId', 'logClarificationRequired']
          },
          PAUSE: {
            target: 'paused',
            actions: ['logTransition', 'updateWorkflowStatus']
          },
          CANCEL: {
            target: 'cancelled',
            actions: ['logTransition', 'updateWorkflowStatus']
          }
        }
      },
      awaiting_decision: {
        on: {
          DECISION_APPROVED: {
            target: 'running',
            actions: ['clearDecisionId', 'logDecisionApproved', 'updateWorkflowStatus']
          },
          DECISION_REJECTED: {
            target: 'failed',
            actions: ['clearDecisionId', 'logDecisionRejected', 'updateWorkflowStatus']
          },
          CANCEL: {
            target: 'cancelled',
            actions: ['logTransition', 'updateWorkflowStatus']
          }
        }
      },
      awaiting_clarification: {
        on: {
          CLARIFICATION_COMPLETE: {
            target: 'running',
            actions: ['clearClarificationId', 'logClarificationComplete', 'updateWorkflowStatus']
          },
          CANCEL: {
            target: 'cancelled',
            actions: ['logTransition', 'updateWorkflowStatus']
          }
        }
      },
      evaluating: {
        always: [
          {
            target: 'completed',
            guard: 'isWorkflowComplete',
            actions: ['markComplete']
          },
          {
            target: 'running',
            guard: 'isNotTransitioningAlready', // Prevent double invocation
            actions: ['setTransitionInProgress', 'moveToNextStage']
          }
        ]
      },
      paused: {
        on: {
          RESUME: {
            target: 'running',
            actions: ['logTransition', 'updateWorkflowStatus']
          },
          CANCEL: {
            target: 'cancelled',
            actions: ['logTransition', 'updateWorkflowStatus']
          }
        }
      },
      failed: {
        on: {
          RETRY: {
            target: 'running',
            actions: ['resetError', 'logRetry']
          },
          CANCEL: {
            target: 'cancelled',
            actions: ['logTransition', 'updateWorkflowStatus']
          }
        }
      },
      completed: {
        type: 'final',
        entry: ['notifyCompletion']
      },
      cancelled: {
        type: 'final',
        entry: ['notifyCancellation']
      }
    }
  }, {
    actions: {
      logTransition: ({ context, event }) => {
        logger.info('Workflow state transition', {
          workflow_id: context.workflow_id,
          event: event.type,
          current_stage: context.current_stage
        });
      },
      updateWorkflowStatus: async ({ context }) => {
        // Status updates are handled by specific actions (markComplete, etc.)
        await repository.update(context.workflow_id, {
          current_stage: context.current_stage
        });
      },
      updateProgress: ({ context, event }) => {
        if (event.type === 'STAGE_COMPLETE') {
          context.progress = Math.min(100, context.progress + 15);
        }
      },
      logStageComplete: ({ context, event }) => {
        if (event.type === 'STAGE_COMPLETE') {
          logger.info('Stage completed', {
            workflow_id: context.workflow_id,
            stage: event.stage
          });
        }
      },
      logError: ({ context, event }) => {
        if (event.type === 'STAGE_FAILED') {
          context.error = event.error;
          logger.error('Stage failed', {
            workflow_id: context.workflow_id,
            stage: event.stage,
            error: event.error
          });
        }
      },
      resetError: ({ context }) => {
        delete context.error;
      },
      logRetry: ({ context }) => {
        logger.info('Retrying workflow', {
          workflow_id: context.workflow_id
        });
      },
      setTransitionInProgress: ({ context }) => {
        logger.debug('Setting transition flag to prevent double invocation', {
          workflow_id: context.workflow_id
        });
        context._stageTransitionInProgress = true;
      },
      clearTransitionInProgress: ({ context }) => {
        logger.debug('Clearing transition flag', {
          workflow_id: context.workflow_id,
          was_in_progress: context._stageTransitionInProgress
        });
        context._stageTransitionInProgress = false;
      },
      moveToNextStage: async ({ context }) => {
        const stages = getStagesForType(context.type);
        const currentIndex = stages.indexOf(context.current_stage);

        logger.info('moveToNextStage action called', {
          workflow_id: context.workflow_id,
          workflow_type: context.type,
          current_stage: context.current_stage,
          currentIndex: currentIndex,
          all_stages: JSON.stringify(stages),
          stages_length: stages.length
        });

        if (currentIndex < stages.length - 1) {
          const nextStage = stages[currentIndex + 1];
          logger.info('Transitioning to next stage', {
            workflow_id: context.workflow_id,
            from_stage: context.current_stage,
            to_stage: nextStage,
            at_index: currentIndex,
            next_index: currentIndex + 1
          });

          context.current_stage = nextStage;
          await repository.update(context.workflow_id, {
            current_stage: nextStage
          });

          logger.info('Database updated with new stage', {
            workflow_id: context.workflow_id,
            new_stage: nextStage
          });
        } else {
          logger.info('Already at last stage, not moving', {
            workflow_id: context.workflow_id,
            current_stage: context.current_stage,
            currentIndex: currentIndex,
            stages_length: stages.length
          });
        }
      },
      markComplete: async ({ context }) => {
        context.progress = 100;
        await repository.update(context.workflow_id, {
          status: 'completed',
          progress: 100,
          completed_at: new Date()
        });
      },
      notifyCompletion: async ({ context }) => {
        await eventBus.publish({
          id: `event-${Date.now()}`,
          type: 'WORKFLOW_COMPLETED',
          workflow_id: context.workflow_id,
          payload: { workflow_id: context.workflow_id },
          timestamp: new Date().toISOString(),
          trace_id: `trace-${context.workflow_id}`
        });
        logger.info('Workflow completed', {
          workflow_id: context.workflow_id
        });
      },
      notifyCancellation: async ({ context }) => {
        await eventBus.publish({
          id: `event-${Date.now()}`,
          type: 'WORKFLOW_CANCELLED',
          workflow_id: context.workflow_id,
          payload: { workflow_id: context.workflow_id },
          timestamp: new Date().toISOString(),
          trace_id: `trace-${context.workflow_id}`
        });
        logger.info('Workflow cancelled', {
          workflow_id: context.workflow_id
        });
      },
      recordDecisionId: ({ context, event }) => {
        if (event.type === 'DECISION_REQUIRED') {
          context.decision_id = event.decision_id;
          context.pending_decision = true;
          context.metadata.decision_stage = context.current_stage;
        }
      },
      clearDecisionId: ({ context }) => {
        delete context.decision_id;
        context.pending_decision = false;
      },
      logDecisionRequired: ({ context, event }) => {
        if (event.type === 'DECISION_REQUIRED') {
          logger.info('Decision required - workflow paused', {
            workflow_id: context.workflow_id,
            decision_id: event.decision_id,
            stage: context.current_stage
          });
        }
      },
      logDecisionApproved: ({ context, event }) => {
        if (event.type === 'DECISION_APPROVED') {
          logger.info('Decision approved - workflow resumed', {
            workflow_id: context.workflow_id,
            decision_id: event.decision_id
          });
        }
      },
      logDecisionRejected: ({ context, event }) => {
        if (event.type === 'DECISION_REJECTED') {
          logger.warn('Decision rejected - workflow failed', {
            workflow_id: context.workflow_id,
            decision_id: event.decision_id,
            reason: event.reason
          });
        }
      },
      recordClarificationId: ({ context, event }) => {
        if (event.type === 'CLARIFICATION_REQUIRED') {
          context.clarification_id = event.clarification_id;
          context.pending_clarification = true;
          context.metadata.clarification_stage = context.current_stage;
        }
      },
      clearClarificationId: ({ context }) => {
        delete context.clarification_id;
        context.pending_clarification = false;
      },
      logClarificationRequired: ({ context, event }) => {
        if (event.type === 'CLARIFICATION_REQUIRED') {
          logger.info('Clarification required - workflow paused', {
            workflow_id: context.workflow_id,
            clarification_id: event.clarification_id,
            stage: context.current_stage
          });
        }
      },
      logClarificationComplete: ({ context, event }) => {
        if (event.type === 'CLARIFICATION_COMPLETE') {
          logger.info('Clarification complete - workflow resumed', {
            workflow_id: context.workflow_id,
            clarification_id: event.clarification_id
          });
        }
      }
    },
    guards: {
      isWorkflowComplete: ({ context }) => {
        const stages = getStagesForType(context.type);
        const currentIndex = stages.indexOf(context.current_stage);
        return currentIndex === stages.length - 1;
      },
      isNotTransitioningAlready: ({ context }) => {
        // Prevent the always transition if we're already in the middle of transitioning
        const isNotTransitioning = !context._stageTransitionInProgress;
        logger.debug('isNotTransitioningAlready guard check', {
          workflow_id: context.workflow_id,
          _stageTransitionInProgress: context._stageTransitionInProgress,
          result: isNotTransitioning
        });
        return isNotTransitioning;
      }
    }
  });
};

function getStagesForType(type: string): string[] {
  const stageMap: Record<string, string[]> = {
    app: [
      'initialization',
      'scaffolding',
      'validation',
      'e2e_testing',
      'integration',
      'deployment',
      'monitoring'
    ],
    feature: [
      'initialization',
      'implementation',
      'validation',
      'testing',
      'integration',
      'deployment'
    ],
    bugfix: [
      'initialization',
      'debugging',
      'fixing',
      'validation',
      'testing',
      'deployment'
    ]
  };

  return stageMap[type] || stageMap.app;
}

export class WorkflowStateMachineService {
  private machines = new Map<string, any>();

  constructor(
    private repository: WorkflowRepository,
    private eventBus: EventBus
  ) {}

  createStateMachine(workflowId: string, type: string): any {
    const context: WorkflowContext = {
      workflow_id: workflowId,
      type,
      current_stage: 'initialization',
      progress: 0,
      metadata: {}
    };

    const machine = createWorkflowStateMachine(context, this.repository, this.eventBus);
    const service = interpret(machine).start();

    this.machines.set(workflowId, service);
    return service;
  }

  getStateMachine(workflowId: string): any {
    return this.machines.get(workflowId);
  }

  removeStateMachine(workflowId: string): void {
    const service = this.machines.get(workflowId);
    if (service) {
      service.stop();
      this.machines.delete(workflowId);
    }
  }
}