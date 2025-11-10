import { createMachine, interpret, fromPromise, assign } from 'xstate';
import { logger } from '../utils/logger';
import { WorkflowRepository } from '../repositories/workflow.repository';
import { EventBus } from '../events/event-bus';

export interface WorkflowContext {
  workflow_id: string;
  type: string;
  current_stage: string;
  nextStage?: string; // Computed next stage for the invoked service
  progress: number;
  error?: Error;
  metadata: Record<string, any>;
  decision_id?: string;
  clarification_id?: string;
  pending_decision?: boolean;
  pending_clarification?: boolean;
  _advanceInFlight?: boolean; // Single-flight guard for transitionToNextStage
  _seenEventIds?: Set<string>; // Deduplication: track processed event IDs to prevent triple-fire
}

export type WorkflowEvent =
  | { type: 'START' }
  | { type: 'STAGE_COMPLETE'; stage: string; eventId?: string }
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
          STAGE_COMPLETE: [
            {
              // Guard: only process if this event ID hasn't been seen before (deduplication)
              guard: ({ context, event }: { context: WorkflowContext; event: any }) => {
                if (event.type !== 'STAGE_COMPLETE') return false;
                if (!context._seenEventIds) {
                  context._seenEventIds = new Set();
                }
                const eventId = event.eventId;
                if (!eventId) return true; // No eventId, allow processing
                return !context._seenEventIds.has(eventId);
              },
              target: 'evaluating',
              actions: ['updateProgress', 'logStageComplete', 'computeNextStageOnEvent', 'trackEventId']
            },
            {
              // Fallback: if event was already seen, log and stay in running state
              actions: ['logDuplicateEvent']
            }
          ],
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
        entry: 'logEvaluatingEntry', // Just log, don't recompute
        invoke: {
          id: 'advanceStage',
          src: fromPromise(async ({ input }: { input: any }) => {
            logger.info('SESSION #23 FIX: Invoked service executing', {
              workflow_id: input.workflow_id,
              next_stage_input: input.nextStage
            });
            // Simulate async work (stage transition already computed)
            await new Promise(resolve => setTimeout(resolve, 10));
            logger.info('SESSION #23 FIX: Invoked service completed', {
              workflow_id: input.workflow_id,
              next_stage: input.nextStage
            });
            return input.nextStage;
          }),
          input: ({ context }: { context: WorkflowContext }) => ({
            workflow_id: context.workflow_id,
            nextStage: context.nextStage
          }),
          onDone: [
            {
              guard: ({ context }: { context: WorkflowContext }) => context.nextStage === undefined,
              target: 'completed',
              actions: ['markComplete']
            },
            {
              target: 'running',
              actions: ['transitionToNextStageAbsolute']
            }
          ],
          onError: {
            target: 'error',
            actions: ['logStageTransitionError']
          }
        }
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
      error: {
        type: 'final',
        entry: ['notifyError']
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
      computeNextStageOnEvent: assign({
        nextStage: ({ context }) => {
          // CRITICAL FIX: Compute the next stage ONCE on the event, BEFORE entering evaluating
          // This prevents re-evaluation in the evaluating entry action
          const stages = getStagesForType(context.type);
          const currentIndex = stages.indexOf(context.current_stage);

          logger.info('SESSION #23 FIX: Computing nextStage on STAGE_COMPLETE event (pre-computed)', {
            workflow_id: context.workflow_id,
            current_stage: context.current_stage,
            current_index: currentIndex,
            total_stages: stages.length
          });

          // Check if current stage not found
          if (currentIndex === -1) {
            logger.error('CRITICAL: Current stage not found in stages array!', {
              workflow_id: context.workflow_id,
              current_stage: context.current_stage,
              available_stages: JSON.stringify(stages)
            });
            return undefined;
          }

          // If at last stage, workflow is complete
          if (currentIndex === stages.length - 1) {
            logger.info('SESSION #23 FIX: At last stage - workflow will complete', {
              workflow_id: context.workflow_id,
              current_stage: context.current_stage
            });
            return undefined;
          }

          // Compute the ABSOLUTE next stage
          const nextStage = stages[currentIndex + 1];
          logger.info('SESSION #23 FIX: Next stage COMPUTED on event (ABSOLUTE value)', {
            workflow_id: context.workflow_id,
            from_stage: context.current_stage,
            from_index: currentIndex,
            to_stage: nextStage,
            to_index: currentIndex + 1
          });
          return nextStage;
        }
      }),
      logEvaluatingEntry: ({ context }) => {
        logger.info('SESSION #23 FIX: Evaluating state entered (nextStage pre-computed)', {
          workflow_id: context.workflow_id,
          current_stage: context.current_stage,
          next_stage: context.nextStage
        });
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
      transitionToNextStageAbsolute: async ({ context }) => {
        // FIX: Single-flight guard to prevent multiple invocations in one microstep
        if (context._advanceInFlight) {
          logger.error('SESSION #23 FIX: DOUBLE INVOCATION DETECTED! Ignoring second call.', {
            workflow_id: context.workflow_id,
            current_stage: context.current_stage,
            next_stage: context.nextStage
          });
          throw new Error('transitionToNextStageAbsolute called while already in flight');
        }

        context._advanceInFlight = true;

        try {
          const oldStage = context.current_stage;

          logger.info('SESSION #23 FIX: Transitioning to next stage (ABSOLUTE assignment)', {
            workflow_id: context.workflow_id,
            from_stage: oldStage,
            to_stage: context.nextStage,
            in_flight_guard: true
          });

          if (!context.nextStage) {
            logger.warn('SESSION #23 FIX: nextStage is undefined!', {
              workflow_id: context.workflow_id,
              current_stage: oldStage
            });
            return;
          }

          // ABSOLUTE assignment: use the pre-computed value
          // Do NOT recompute from context.current_stage
          context.current_stage = context.nextStage;
          context.nextStage = undefined; // Reset for next cycle

          logger.info('SESSION #23 FIX: Context updated in memory (ABSOLUTE)', {
            workflow_id: context.workflow_id,
            old_stage: oldStage,
            new_stage: context.current_stage
          });

          // Persist to database
          await repository.update(context.workflow_id, {
            current_stage: context.current_stage
          });

          logger.info('SESSION #23 FIX: Database persisted', {
            workflow_id: context.workflow_id,
            new_stage: context.current_stage
          });
        } finally {
          context._advanceInFlight = false;
        }
      },
      logStageTransitionError: ({ context, event }: any) => {
        logger.error('Stage transition service failed', {
          workflow_id: context.workflow_id,
          current_stage: context.current_stage,
          nextStage: context.nextStage,
          error: event.data
        });
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
      notifyError: async ({ context }) => {
        await eventBus.publish({
          id: `event-${Date.now()}`,
          type: 'WORKFLOW_ERROR',
          workflow_id: context.workflow_id,
          payload: { workflow_id: context.workflow_id, error: context.error?.message },
          timestamp: new Date().toISOString(),
          trace_id: `trace-${context.workflow_id}`
        });
        logger.error('Workflow error state reached', {
          workflow_id: context.workflow_id,
          error: context.error
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
      },
      trackEventId: ({ context, event }) => {
        if (event.type === 'STAGE_COMPLETE' && event.eventId) {
          if (!context._seenEventIds) {
            context._seenEventIds = new Set();
          }
          context._seenEventIds.add(event.eventId);
          logger.info('SESSION #24 FIX: Event ID tracked for deduplication', {
            workflow_id: context.workflow_id,
            eventId: event.eventId,
            stage: event.stage,
            seenCount: context._seenEventIds.size
          });
        }
      },
      logDuplicateEvent: ({ context, event }) => {
        if (event.type === 'STAGE_COMPLETE') {
          logger.warn('SESSION #24 FIX: DUPLICATE STAGE_COMPLETE EVENT FILTERED', {
            workflow_id: context.workflow_id,
            eventId: event.eventId,
            stage: event.stage,
            current_stage: context.current_stage,
            message: 'Event was already processed - skipping to prevent triple-fire'
          });
        }
      }
    },
    guards: {}
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