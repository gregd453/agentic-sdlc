import { createMachine, interpret, fromPromise, assign } from 'xstate';
import { logger, getRequestContext } from '../utils/logger';
import { WorkflowRepository } from '../repositories/workflow.repository';
import { EventBus } from '../events/event-bus';
import { IMessageBus } from '../hexagonal/ports/message-bus.port';
import { WorkflowStateManager, WorkflowStateSnapshot } from '../hexagonal/persistence/workflow-state-manager';
import { getStagesForType } from '../utils/stages';
import { WorkflowDefinitionAdapter } from '../services/workflow-definition-adapter.service';

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
  platform_id?: string; // SESSION #88: Phase 3 - Platform ID for definition-driven routing
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
  eventBus: EventBus,
  workflowDefinitionAdapter?: WorkflowDefinitionAdapter  // SESSION #88: Phase 3 - Definition-driven routing
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
            actions: ['logTransition', 'updateWorkflowStage']
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
            actions: ['logError', 'updateWorkflowStage']
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
            actions: ['logTransition', 'updateWorkflowStage']
          },
          CANCEL: {
            target: 'cancelled',
            actions: ['logTransition', 'updateWorkflowStage']
          }
        }
      },
      awaiting_decision: {
        on: {
          DECISION_APPROVED: {
            target: 'running',
            actions: ['clearDecisionId', 'logDecisionApproved', 'updateWorkflowStage']
          },
          DECISION_REJECTED: {
            target: 'failed',
            actions: ['clearDecisionId', 'logDecisionRejected', 'updateWorkflowStage']
          },
          CANCEL: {
            target: 'cancelled',
            actions: ['logTransition', 'updateWorkflowStage']
          }
        }
      },
      awaiting_clarification: {
        on: {
          CLARIFICATION_COMPLETE: {
            target: 'running',
            actions: ['clearClarificationId', 'logClarificationComplete', 'updateWorkflowStage']
          },
          CANCEL: {
            target: 'cancelled',
            actions: ['logTransition', 'updateWorkflowStage']
          }
        }
      },
      evaluating: {
        entry: 'logEvaluatingEntry', // Just log, don't recompute
        invoke: {
          id: 'advanceStage',
          src: fromPromise(async ({ input }: { input: any }) => {
            logger.info('[SESSION #88] Invoked service executing (definition-driven routing)', {
              workflow_id: input.workflow_id,
              next_stage_preliminary: input.nextStage,
              adapter_available: !!workflowDefinitionAdapter
            });

            // SESSION #88: Use WorkflowDefinitionAdapter for definition-driven routing if available
            if (workflowDefinitionAdapter && input.platform_id) {
              try {
                const transition = await workflowDefinitionAdapter.getNextStageWithFallback({
                  workflow_id: input.workflow_id,
                  workflow_type: input.workflow_type,
                  current_stage: input.current_stage,
                  platform_id: input.platform_id,
                  progress: input.progress
                });

                logger.info('[SESSION #88] Definition-driven next stage computed', {
                  workflow_id: input.workflow_id,
                  from_stage: input.current_stage,
                  to_stage: transition.next_stage,
                  is_fallback: transition.is_fallback,
                  agent_type: transition.agent_type,
                  preliminary_stage: input.nextStage
                });

                return transition.next_stage;
              } catch (error) {
                logger.error('[SESSION #88] Definition-driven routing failed, using preliminary stage', {
                  workflow_id: input.workflow_id,
                  error: error instanceof Error ? error.message : String(error),
                  fallback_stage: input.nextStage
                });
                // Fall through to return preliminary stage
              }
            } else {
              logger.info('[SESSION #88] Using preliminary stage (no adapter or platform_id)', {
                workflow_id: input.workflow_id,
                next_stage: input.nextStage
              });
            }

            // Return preliminary stage (computed by legacy logic or if adapter failed)
            return input.nextStage;
          }),
          input: ({ context }: { context: WorkflowContext }) => ({
            workflow_id: context.workflow_id,
            workflow_type: context.type,
            current_stage: context.current_stage,
            platform_id: context.platform_id,
            progress: context.progress,
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
            actions: ['logTransition', 'updateWorkflowStage']
          },
          CANCEL: {
            target: 'cancelled',
            actions: ['logTransition', 'updateWorkflowStage']
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
            actions: ['logTransition', 'updateWorkflowStage']
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
      updateWorkflowStage: async ({ context }) => {
        // Session #78: Phase 5 - Renamed to clarify this updates STAGE, not STATUS
        // Status updates are handled by specific actions (markComplete, notifyError, etc.)
        // Session #82: Also persist progress to database for dashboard updates
        const requestCtx = getRequestContext();
        const traceId = requestCtx?.traceId || `trace-${context.workflow_id}`;

        try {
          await repository.update(context.workflow_id, {
            current_stage: context.current_stage,
            progress: context.progress || 0  // Session #82: Persist progress to DB
          });
          logger.info('[SESSION #26] Workflow stage updated successfully', {
            workflow_id: context.workflow_id,
            current_stage: context.current_stage,
            progress: context.progress,
            trace_id: traceId
          });
        } catch (error: any) {
          if (error.message?.includes('CAS failed')) {
            logger.warn('[SESSION #26 CAS] Workflow update rejected due to concurrent modification', {
              workflow_id: context.workflow_id,
              current_stage: context.current_stage,
              error: error.message,
              trace_id: traceId
            });
            // Log but don't throw - let polling detect the actual DB state
          } else {
            throw error;
          }
        }
      },
      updateProgress: async ({ context, event }) => {
        if (event.type === 'STAGE_COMPLETE') {
          context.progress = Math.min(100, context.progress + 15);
          // Persist progress to database immediately so dashboard shows real-time updates
          try {
            await repository.update(context.workflow_id, {
              progress: context.progress
            });
            logger.debug('Progress persisted', {
              workflow_id: context.workflow_id,
              progress: context.progress
            });
          } catch (error) {
            logger.error('Failed to persist progress', {
              workflow_id: context.workflow_id,
              progress: context.progress,
              error
            });
            // Don't throw - allow workflow to continue even if progress persistence fails
          }
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
          // SESSION #88 PHASE 3: This action remains SYNCHRONOUS for XState compatibility
          // The async adapter logic is now in the 'evaluating' state's invoked service
          // Here we just use legacy logic as a fallback

          const stages = getStagesForType(context.type as any) as string[];
          const currentIndex = (stages as string[]).indexOf(context.current_stage);

          logger.debug('[SESSION #88] Computing next stage (sync)', {
            workflow_id: context.workflow_id,
            workflow_type: context.type,
            current_stage: context.current_stage,
            current_index: currentIndex,
            total_stages: stages.length,
            adapter_available: !!workflowDefinitionAdapter
          });

          // Check if current stage not found
          if (currentIndex === -1) {
            logger.error('CRITICAL: Current stage not found in stages array', {
              workflow_id: context.workflow_id,
              current_stage: context.current_stage,
              available_stages: stages
            });
            return undefined;
          }

          // If at last stage, workflow is complete
          if (currentIndex === stages.length - 1) {
            logger.info('Workflow at final stage - marking complete', {
              workflow_id: context.workflow_id,
              current_stage: context.current_stage
            });
            return undefined;
          }

          // Compute the next stage using legacy logic
          // The adapter will be used in the evaluating state's invoked service
          const nextStage = stages[currentIndex + 1];
          logger.info('[SESSION #88] Stage transition computed', {
            workflow_id: context.workflow_id,
            from_stage: context.current_stage,
            from_index: currentIndex,
            to_stage: nextStage,
            to_index: currentIndex + 1,
            note: 'Adapter will refine this in evaluating state'
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
        // Session #78: Phase 5 - Enhanced logging and error handling for workflow completion
        const requestCtx = getRequestContext();
        const traceId = requestCtx?.traceId || `trace-${context.workflow_id}`;

        context.progress = 100;

        try {
          logger.info('Marking workflow as complete', {
            workflow_id: context.workflow_id,
            current_stage: context.current_stage,
            trace_id: traceId
          });

          await repository.update(context.workflow_id, {
            status: 'completed',
            progress: 100,
            completed_at: new Date()
          });

          logger.info('Workflow marked complete successfully', {
            workflow_id: context.workflow_id,
            status: 'completed',
            trace_id: traceId
          });
        } catch (error) {
          logger.error('Failed to mark workflow complete', {
            workflow_id: context.workflow_id,
            error,
            trace_id: traceId
          });
          throw error;
        }
      },
      notifyCompletion: async ({ context }) => {
        // Session #78: Phase 3 - Propagate trace_id from RequestContext instead of hardcoding
        const requestCtx = getRequestContext();
        const traceId = requestCtx?.traceId || `trace-${context.workflow_id}`;

        try {
          await eventBus.publish({
            id: `event-${Date.now()}`,
            type: 'WORKFLOW_COMPLETED',
            workflow_id: context.workflow_id,
            payload: { workflow_id: context.workflow_id },
            timestamp: new Date().toISOString(),
            trace_id: traceId  // ✅ Use propagated trace_id
          });

          logger.info('Workflow completed and published', {
            workflow_id: context.workflow_id,
            progress: context.progress,
            trace_id: traceId
          });
        } catch (eventError) {
          logger.error('Failed to publish workflow completion event', {
            workflow_id: context.workflow_id,
            eventError,
            trace_id: traceId
          });
          // Don't rethrow - workflow is already marked complete in DB
        }
      },
      notifyError: async ({ context }) => {
        // Session #78: Phase 2 & 3 - Persist error status to DB BEFORE publishing event, propagate trace_id
        const requestCtx = getRequestContext();
        const traceId = requestCtx?.traceId || `trace-${context.workflow_id}`;

        try {
          await repository.update(context.workflow_id, {
            status: 'failed'
          });

          logger.info('Workflow status persisted to failed', {
            workflow_id: context.workflow_id,
            error: context.error?.message,
            trace_id: traceId
          });
        } catch (dbError) {
          logger.error('Failed to persist error status to database', {
            workflow_id: context.workflow_id,
            dbError,
            error: context.error?.message,
            trace_id: traceId
          });
          // Continue to publish event even if DB fails (eventual consistency)
        }

        // Publish event after DB persistence
        await eventBus.publish({
          id: `event-${Date.now()}`,
          type: 'WORKFLOW_ERROR',
          workflow_id: context.workflow_id,
          payload: { workflow_id: context.workflow_id, error: context.error?.message },
          timestamp: new Date().toISOString(),
          trace_id: traceId  // ✅ Use propagated trace_id
        });

        logger.error('Workflow error state reached and published', {
          workflow_id: context.workflow_id,
          error: context.error,
          trace_id: traceId
        });
      },
      notifyCancellation: async ({ context }) => {
        // Session #78: Phase 2 & 3 - Persist cancellation status to DB BEFORE publishing event, propagate trace_id
        const requestCtx = getRequestContext();
        const traceId = requestCtx?.traceId || `trace-${context.workflow_id}`;

        try {
          await repository.update(context.workflow_id, {
            status: 'cancelled'
          });

          logger.info('Workflow status persisted to cancelled', {
            workflow_id: context.workflow_id,
            trace_id: traceId
          });
        } catch (dbError) {
          logger.error('Failed to persist cancellation status to database', {
            workflow_id: context.workflow_id,
            dbError,
            trace_id: traceId
          });
          // Continue to publish event even if DB fails (eventual consistency)
        }

        // Publish event after DB persistence
        await eventBus.publish({
          id: `event-${Date.now()}`,
          type: 'WORKFLOW_CANCELLED',
          workflow_id: context.workflow_id,
          payload: { workflow_id: context.workflow_id },
          timestamp: new Date().toISOString(),
          trace_id: traceId  // ✅ Use propagated trace_id
        });

        logger.info('Workflow cancelled and published', {
          workflow_id: context.workflow_id,
          trace_id: traceId
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

// Note: getStagesForType is now imported from ../utils/stages
// This ensures consistency with the single source of truth for stage sequences

export class WorkflowStateMachineService {
  private machines = new Map<string, any>();
  private messageBus?: IMessageBus; // Phase 4: Message bus for autonomous event handling
  private stateManager?: WorkflowStateManager; // Phase 6: State persistence and recovery
  private taskCreator?: (workflowId: string, stage: string, workflowData?: any) => Promise<void>; // SESSION #66: Task creation callback
  private workflowDefinitionAdapter?: WorkflowDefinitionAdapter; // SESSION #88: Phase 3 - Definition-driven routing

  constructor(
    private repository: WorkflowRepository,
    private eventBus: EventBus,
    messageBus?: IMessageBus, // Phase 4: Optional message bus
    stateManager?: WorkflowStateManager, // Phase 6: Optional state manager
    workflowDefinitionAdapter?: WorkflowDefinitionAdapter // SESSION #88: Phase 3 - Definition adapter
  ) {
    this.messageBus = messageBus;
    this.stateManager = stateManager;
    this.workflowDefinitionAdapter = workflowDefinitionAdapter;

    // Phase 4: Set up autonomous event subscription
    if (messageBus) {
      console.log('[DEBUG-STATE-MACHINE-CONSTRUCTOR] About to call setupAutonomousEventHandling');
      this.setupAutonomousEventHandling().catch((err) => {
        console.error('[DEBUG-STATE-MACHINE-CONSTRUCTOR-ERROR] setupAutonomousEventHandling failed!', err);
        logger.error('[PHASE-4] Failed to set up autonomous event handling', { error: err });
      });
    } else {
      console.log('[DEBUG-STATE-MACHINE-CONSTRUCTOR] No messageBus provided to constructor!');
    }

    // Phase 6: Log state manager availability
    if (stateManager) {
      logger.info('[PHASE-6] WorkflowStateMachineService initialized with state persistence');
    }

    // SESSION #88: Log workflow definition adapter availability
    if (workflowDefinitionAdapter) {
      logger.info('[SESSION #88] WorkflowStateMachineService initialized with definition-driven routing');
    } else {
      logger.warn('[SESSION #88] WorkflowStateMachineService initialized WITHOUT adapter - using legacy hard-coded stages');
    }
  }

  // SESSION #66: Set task creation callback (called after WorkflowService is constructed)
  public setTaskCreator(taskCreator: (workflowId: string, stage: string, workflowData?: any) => Promise<void>): void {
    this.taskCreator = taskCreator;
    logger.info('[SESSION #66] Task creator callback registered with state machine');
  }

  /**
   * SESSION #66 STRATEGIC: Wait for workflow stage transition to complete
   * Replaces setTimeout-based race condition with deterministic polling
   */
  private async waitForStageTransition(
    workflowId: string,
    previousStage: string,
    maxWaitMs: number = 5000
  ): Promise<any> {
    const maxAttempts = Math.floor(maxWaitMs / 100);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const workflow = await this.repository.findById(workflowId);

      if (!workflow) {
        logger.error('[SESSION #66] Workflow not found during stage transition wait', {
          workflowId,
          previousStage,
          attempt
        });
        return null;
      }

      if (workflow.current_stage !== previousStage) {
        logger.info('[SESSION #66] Stage transition detected', {
          workflowId,
          from: previousStage,
          to: workflow.current_stage,
          attempts: attempt + 1,
          elapsed_ms: (attempt + 1) * 100
        });
        return workflow;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    logger.warn('[SESSION #66] Timeout waiting for stage transition', {
      workflowId,
      previousStage,
      maxWaitMs
    });

    return null;  // Consistent with not-found case
  }

  createStateMachine(workflowId: string, type: string, platformId?: string): any {
    const context: WorkflowContext = {
      workflow_id: workflowId,
      type,
      current_stage: 'initialization',
      progress: 0,
      metadata: {},
      platform_id: platformId // SESSION #88: Phase 3 - Include platform_id for definition-driven routing
    };

    const machine = createWorkflowStateMachine(
      context,
      this.repository,
      this.eventBus,
      this.workflowDefinitionAdapter // SESSION #88: Phase 3 - Pass adapter for definition-driven routing
    );
    const service = interpret(machine).start();

    // Phase 6: Subscribe to state changes for persistence
    if (this.stateManager) {
      service.subscribe((state: any) => {
        this.saveStateSnapshot(state.context).catch(err => {
          logger.error('[PHASE-6] Failed to save state snapshot', {
            workflow_id: workflowId,
            error: err
          });
        });
      });
    }

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

      // Phase 6: Clean up state on removal
      if (this.stateManager) {
        this.stateManager.cleanupWorkflow(workflowId).catch(err => {
          logger.error('[PHASE-6] Failed to cleanup workflow state', {
            workflow_id: workflowId,
            error: err
          });
        });
      }
    }
  }

  /**
   * Phase 6: Save workflow state snapshot to KV store
   */
  private async saveStateSnapshot(context: WorkflowContext): Promise<void> {
    if (!this.stateManager) return;

    const snapshot: WorkflowStateSnapshot = {
      workflow_id: context.workflow_id,
      current_stage: context.current_stage,
      status: context.error ? 'failed' : 'running',
      progress: context.progress,
      metadata: context.metadata,
      last_updated: new Date().toISOString(),
      version: '1.0.0',
      state_machine_context: {
        type: context.type,
        nextStage: context.nextStage,
        pending_decision: context.pending_decision,
        pending_clarification: context.pending_clarification
      }
    };

    await this.stateManager.saveSnapshot(snapshot);
  }

  /**
   * Phase 6: Recover workflow from persisted state
   */
  async recoverWorkflow(workflowId: string): Promise<boolean> {
    if (!this.stateManager) {
      logger.warn('[PHASE-6] Cannot recover workflow - state manager not available', {
        workflow_id: workflowId
      });
      return false;
    }

    logger.info('[PHASE-6] Attempting to recover workflow', { workflow_id: workflowId });

    const snapshot = await this.stateManager.recoverWorkflow(workflowId);

    if (!snapshot) {
      logger.warn('[PHASE-6] No state snapshot found for recovery', { workflow_id: workflowId });
      return false;
    }

    // Recreate state machine with recovered context
    const context: WorkflowContext = {
      workflow_id: snapshot.workflow_id,
      type: snapshot.state_machine_context?.type || 'app',
      current_stage: snapshot.current_stage,
      progress: snapshot.progress,
      metadata: snapshot.metadata,
      nextStage: snapshot.state_machine_context?.nextStage,
      pending_decision: snapshot.state_machine_context?.pending_decision,
      pending_clarification: snapshot.state_machine_context?.pending_clarification,
      platform_id: snapshot.state_machine_context?.platform_id // SESSION #88: Phase 3 - Recover platform_id
    };

    const machine = createWorkflowStateMachine(
      context,
      this.repository,
      this.eventBus,
      this.workflowDefinitionAdapter // SESSION #88: Phase 3 - Pass adapter when recovering
    );
    const service = interpret(machine).start();

    // Subscribe to state changes
    if (this.stateManager) {
      service.subscribe((state: any) => {
        this.saveStateSnapshot(state.context).catch(err => {
          logger.error('[PHASE-6] Failed to save state snapshot', {
            workflow_id: workflowId,
            error: err
          });
        });
      });
    }

    this.machines.set(workflowId, service);

    logger.info('[PHASE-6] Workflow recovered successfully', {
      workflow_id: workflowId,
      current_stage: snapshot.current_stage,
      progress: snapshot.progress
    });

    return true;
  }

  /**
   * Phase 4: Set up autonomous event handling
   * State machine subscribes to events and reacts autonomously
   */
  private async setupAutonomousEventHandling(): Promise<void> {
    if (!this.messageBus) {
      console.log('[DEBUG-STATE-MACHINE-INIT] setupAutonomousEventHandling - no messageBus!');
      logger.warn('[PHASE-4] setupAutonomousEventHandling called but messageBus not available');
      return;
    }

    console.log('[DEBUG-STATE-MACHINE-INIT] Setting up state machine result handler subscription');
    logger.info('[PHASE-4] Setting up autonomous state machine event handling');

    try {
      const { REDIS_CHANNELS } = await import('@agentic-sdlc/shared-types');
      console.log('[DEBUG-STATE-MACHINE-INIT] About to subscribe to:', REDIS_CHANNELS.ORCHESTRATOR_RESULTS);

      // Subscribe to agent results for autonomous STAGE_COMPLETE events
      await this.messageBus.subscribe(REDIS_CHANNELS.ORCHESTRATOR_RESULTS, async (message: any) => {
        try {
          console.log('[DEBUG-STATE-MACHINE-1] Raw message received from orchestrator:results', {
            message_type: typeof message,
            message_keys: Object.keys(message || {}).join(','),
            has_workflow_id: !!message?.workflow_id,
            has_stage: !!message?.stage,
            has_success: !!message?.success
          });

          // The message IS the AgentResultSchema-compliant object (no payload wrapper)
          // redis-bus adapter already unwrapped the envelope and extracted the message
          const agentResult = message;

          console.log('[DEBUG-STATE-MACHINE-2] AgentResult structure', {
            workflow_id: agentResult.workflow_id,
            task_id: agentResult.task_id,
            agent_id: agentResult.agent_id,
            success: agentResult.success,
            status: agentResult.status,
            stage: agentResult.stage,
            has_result: !!agentResult.result,
            all_keys: Object.keys(agentResult).join(',')
          });

          logger.info('[PHASE-4] State machine received agent result', {
            workflow_id: agentResult.workflow_id,
            agent_id: agentResult.agent_id,
            task_id: agentResult.task_id
          });

          const workflowId = agentResult.workflow_id;

          if (!workflowId) {
            console.log('[DEBUG-STATE-MACHINE-ERROR] No workflow_id in result!', {
              agent_id: agentResult.agent_id,
              has_workflow_id: !!agentResult.workflow_id,
              workflow_id_value: agentResult.workflow_id
            });
            logger.warn('[PHASE-4] No workflow_id in agent result', {
              agent_id: agentResult.agent_id,
              has_workflow_id: !!agentResult.workflow_id
            });
            return;
          }

          console.log('[DEBUG-STATE-MACHINE-3] Looking up state machine', {
            workflow_id: workflowId,
            machines_count: this.machines.size,
            machine_exists: this.machines.has(workflowId)
          });

          const stateMachine = this.getStateMachine(workflowId);

          if (!stateMachine) {
            console.log('[DEBUG-STATE-MACHINE-ERROR] No state machine found!', {
              workflow_id: workflowId,
              available_machines: Array.from(this.machines.keys()).join(','),
              message_id: message.id
            });
            logger.warn('[PHASE-4] No state machine found for workflow', {
              workflow_id: workflowId,
              message_id: message.id
            });
            return;
          }

          console.log('[DEBUG-STATE-MACHINE-4] State machine found, checking success', {
            workflow_id: workflowId,
            success: agentResult.success,
            status: agentResult.status
          });

          // Determine event based on agent result
          if (agentResult.success) {
            console.log('[DEBUG-STATE-MACHINE-5] Result is successful, preparing STAGE_COMPLETE', {
              workflow_id: workflowId,
              stage_from_message: message.stage,
              task_id: agentResult.task_id
            });
            logger.info('[PHASE-4] Sending STAGE_COMPLETE to state machine', {
              workflow_id: workflowId,
              stage: message.stage,
              task_id: agentResult.task_id
            });

            stateMachine.send({
              type: 'STAGE_COMPLETE',
              stage: message.stage,
              eventId: message.id
            });

            // SESSION #66 STRATEGIC: Create task for next stage after transition
            // Replaced setTimeout with deterministic waitForStageTransition
            if (this.taskCreator) {
              console.log('[DEBUG-TASK-CREATE-1] taskCreator exists, attempting to create next task', {
                workflow_id: workflowId,
                completed_stage: message.stage
              });
              try {
                // Wait for state machine to process transition and update database
                // Uses polling with timeout instead of hope-based 200ms setTimeout
                console.log('[DEBUG-TASK-CREATE-2] Calling waitForStageTransition', {
                  workflow_id: workflowId,
                  completed_stage: message.stage
                });
                const workflow = await this.waitForStageTransition(workflowId, message.stage);
                console.log('[DEBUG-TASK-CREATE-3] waitForStageTransition returned', {
                  workflow_id: workflowId,
                  workflow_found: !!workflow,
                  current_stage: workflow?.current_stage,
                  status: workflow?.status
                });

                if (!workflow) {
                  logger.error('[SESSION #66] Workflow state not available after stage transition (not found or timeout)', {
                    workflow_id: workflowId,
                    completed_stage: message.stage
                  });
                  return;
                }

                const isTerminal = ['completed', 'failed', 'cancelled'].includes(workflow.status);
                if (!isTerminal) {
                  logger.info('[SESSION #66] Creating task for next stage after STAGE_COMPLETE', {
                    workflow_id: workflowId,
                    next_stage: workflow.current_stage,
                    completed_stage: message.stage,
                    transition_verified: true
                  });

                  await this.taskCreator(workflowId, workflow.current_stage, {
                    name: workflow.name,
                    description: workflow.description,
                    requirements: workflow.requirements,
                    type: workflow.type
                  });

                  logger.info('[SESSION #66] Task created successfully for next stage', {
                    workflow_id: workflowId,
                    stage: workflow.current_stage
                  });
                } else {
                  logger.info('[SESSION #66] Workflow in terminal state, no task created', {
                    workflow_id: workflowId,
                    status: workflow.status
                  });
                }
              } catch (taskError) {
                logger.error('[SESSION #66] Failed to create task for next stage', {
                  workflow_id: workflowId,
                  error: taskError instanceof Error ? taskError.message : String(taskError)
                });
              }
            } else {
              logger.warn('[SESSION #66] taskCreator not available, cannot create next task', {
                workflow_id: workflowId
              });
            }
          } else {
            logger.info('[PHASE-4] Sending STAGE_FAILED to state machine', {
              workflow_id: workflowId,
              stage: message.stage,
              task_id: agentResult.task_id
            });

            stateMachine.send({
              type: 'STAGE_FAILED',
              stage: message.stage,
              error: new Error(agentResult.error?.message || 'Stage failed')
            });
          }

          logger.info('[PHASE-4] State machine event sent autonomously', {
            workflow_id: workflowId,
            event_type: agentResult.success ? 'STAGE_COMPLETE' : 'STAGE_FAILED'
          });
        } catch (error) {
          logger.error('[PHASE-4] Error in autonomous event handler', {
            error: error instanceof Error ? error.message : String(error),
            message_id: message.id
          });
        }
      });

      logger.info('[PHASE-4] Autonomous state machine event handling initialized');
    } catch (error) {
      logger.error('[PHASE-4] Failed to set up autonomous event handling', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}