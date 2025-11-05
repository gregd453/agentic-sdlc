import { createMachine, interpret, State } from 'xstate';
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
}

export type WorkflowEvent =
  | { type: 'START' }
  | { type: 'STAGE_COMPLETE'; stage: string }
  | { type: 'STAGE_FAILED'; stage: string; error: Error }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'CANCEL' }
  | { type: 'RETRY' };

export const createWorkflowStateMachine = (
  context: WorkflowContext,
  repository: WorkflowRepository,
  eventBus: EventBus
) => {
  return createMachine<WorkflowContext, WorkflowEvent>({
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
        on: {
          STAGE_COMPLETE: {
            target: 'evaluating',
            actions: ['updateProgress', 'logStageComplete']
          },
          STAGE_FAILED: {
            target: 'failed',
            actions: ['logError', 'updateWorkflowStatus']
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
      evaluating: {
        always: [
          {
            target: 'completed',
            cond: 'isWorkflowComplete',
            actions: ['markComplete']
          },
          {
            target: 'running',
            actions: ['moveToNextStage']
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
      logTransition: (context, event) => {
        logger.info('Workflow state transition', {
          workflow_id: context.workflow_id,
          event: event.type,
          current_stage: context.current_stage
        });
      },
      updateWorkflowStatus: async (context, event, { state }) => {
        await repository.update(context.workflow_id, {
          status: state.value as string,
          current_stage: context.current_stage
        });
      },
      updateProgress: (context, event) => {
        if (event.type === 'STAGE_COMPLETE') {
          context.progress = Math.min(100, context.progress + 15);
        }
      },
      logStageComplete: (context, event) => {
        if (event.type === 'STAGE_COMPLETE') {
          logger.info('Stage completed', {
            workflow_id: context.workflow_id,
            stage: event.stage
          });
        }
      },
      logError: (context, event) => {
        if (event.type === 'STAGE_FAILED') {
          context.error = event.error;
          logger.error('Stage failed', {
            workflow_id: context.workflow_id,
            stage: event.stage,
            error: event.error
          });
        }
      },
      resetError: (context) => {
        delete context.error;
      },
      logRetry: (context) => {
        logger.info('Retrying workflow', {
          workflow_id: context.workflow_id
        });
      },
      moveToNextStage: async (context) => {
        const stages = getStagesForType(context.type);
        const currentIndex = stages.indexOf(context.current_stage);
        if (currentIndex < stages.length - 1) {
          context.current_stage = stages[currentIndex + 1];
          await repository.update(context.workflow_id, {
            current_stage: context.current_stage
          });
        }
      },
      markComplete: async (context) => {
        context.progress = 100;
        await repository.update(context.workflow_id, {
          status: 'completed',
          progress: 100,
          completed_at: new Date()
        });
      },
      notifyCompletion: async (context) => {
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
      notifyCancellation: async (context) => {
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
      }
    },
    guards: {
      isWorkflowComplete: (context) => {
        const stages = getStagesForType(context.type);
        const currentIndex = stages.indexOf(context.current_stage);
        return currentIndex === stages.length - 1;
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