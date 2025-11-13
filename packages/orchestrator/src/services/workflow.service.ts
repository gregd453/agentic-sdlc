import { randomUUID, createHash } from 'crypto';
import Redis from 'ioredis';
import { getAgentTypeForStage, WORKFLOW_STAGES } from '@agentic-sdlc/shared-types';
import { CreateWorkflowRequest, TaskAssignment, WorkflowResponse } from '../types';
import { WorkflowRepository } from '../repositories/workflow.repository';
import { EventBus } from '../events/event-bus';
import { WorkflowStateMachineService } from '../state-machine/workflow-state-machine';
// Phase 3: AgentDispatcherService removed - tasks now dispatched via messageBus
import { DecisionGateService } from './decision-gate.service';
import { logger, generateTraceId } from '../utils/logger';
import { metrics } from '../utils/metrics';
import { NotFoundError } from '../utils/errors';
import { IMessageBus } from '../hexagonal/ports/message-bus.port';

export class WorkflowService {
  private decisionGateService: DecisionGateService;
  private eventHandlers: Map<string, (event: any) => Promise<void>> = new Map();
  private processedTasks: Set<string> = new Set(); // Track completed tasks for idempotency
  private redisClient: Redis;
  private messageBus?: IMessageBus; // Phase 1: Message bus from container

  constructor(
    private repository: WorkflowRepository,
    private eventBus: EventBus,
    private stateMachineService: WorkflowStateMachineService,
    redisUrl: string = process.env.REDIS_URL || 'redis://127.0.0.1:6379',
    messageBus?: IMessageBus // Phase 3: messageBus now required for task dispatch
  ) {
    this.messageBus = messageBus;
    logger.info('[WF:CONSTRUCTOR:START] WorkflowService instance created', {
      timestamp: new Date().toISOString(),
      messageBusAvailable: !!messageBus,
      stack: new Error().stack?.split('\n').slice(0, 5).join(' | ')
    });

    if (messageBus) {
      logger.info('[PHASE-3] WorkflowService received messageBus from container');
    } else {
      logger.warn('[PHASE-3] WorkflowService initialized WITHOUT messageBus - task dispatch will fail');
    }

    this.decisionGateService = new DecisionGateService();

    // Initialize Redis client for Phase 1 hardening
    this.redisClient = new Redis(redisUrl);

    this.setupEventHandlers();

    // Phase 2: Set up message bus subscription for agent results (async, non-blocking)
    if (messageBus) {
      this.setupMessageBusSubscription().catch(err => {
        logger.error('[PHASE-2] Failed to initialize message bus subscription', { error: err });
      });
    }
  }

  private setupEventHandlers(): void {
    logger.info('[WF:SETUP_HANDLERS] Registering event handlers', {
      timestamp: new Date().toISOString()
    });

    // Subscribe to task completion events
    const taskCompletedHandler = async (event: any) => {
      logger.info('[WF:TASK_COMPLETED:RECV] Task completed event received', {
        workflow_id: event.payload?.workflow_id,
        task_id: event.payload?.task_id,
        stage: event.payload?.stage,
        timestamp: new Date().toISOString()
      });
      // Handle task completion and trigger next stage
      await this.handleTaskCompletion(event);
    };
    this.eventHandlers.set('TASK_COMPLETED', taskCompletedHandler);
    logger.info('[WF:SUBSCRIBING] Subscribing to TASK_COMPLETED', {
      timestamp: new Date().toISOString()
    });
    this.eventBus.subscribe('TASK_COMPLETED', taskCompletedHandler);

    // Subscribe to task failure events
    const taskFailedHandler = async (event: any) => {
      logger.error('Task failed event received', { event });
      // Handle task failure
      await this.handleTaskFailure(event);
    };
    this.eventHandlers.set('TASK_FAILED', taskFailedHandler);
    this.eventBus.subscribe('TASK_FAILED', taskFailedHandler);
  }

  /**
   * Phase 2: Set up message bus subscription for agent results
   * Replaces per-workflow callback registration with single persistent subscription
   */
  private async setupMessageBusSubscription(): Promise<void> {
    if (!this.messageBus) {
      logger.warn('[PHASE-2] setupMessageBusSubscription called but messageBus not available');
      return;
    }

    logger.info('[PHASE-2] Setting up message bus subscription for agent results');

    try {
      const { REDIS_CHANNELS } = await import('@agentic-sdlc/shared-types');
      const topic = REDIS_CHANNELS.ORCHESTRATOR_RESULTS;

      // Subscribe to agent results topic with centralized handler
      await this.messageBus.subscribe(topic, async (message: any) => {
        logger.info('[PHASE-2] Received agent result from message bus', {
          message_id: message.id,
          workflow_id: message.workflow_id,
          agent_id: message.agent_id,
          type: message.type
        });

        // Handle the agent result using existing handler
        await this.handleAgentResult(message);
      });

      logger.info('[PHASE-2] Message bus subscription established successfully', {
        topic
      });
    } catch (error) {
      logger.error('[PHASE-2] Failed to set up message bus subscription', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Cleanup event subscriptions and resources
   */
  async cleanup(): Promise<void> {
    logger.info('Cleaning up WorkflowService');

    // Unsubscribe from all events
    for (const [eventType, handler] of this.eventHandlers.entries()) {
      await this.eventBus.unsubscribe(eventType, handler);
    }
    this.eventHandlers.clear();

    // Phase 3: Agent dispatcher removed - no longer needed

    // Disconnect Redis and Redlock clients
    if (this.redisClient) {
      await this.redisClient.quit();
    }

    logger.info('WorkflowService cleanup completed');
  }

  /**
   * Generate collision-proof eventId using sha1 hash (Phase 1 hardening)
   * Hash includes: taskId + current_stage + attempt + createdAt + workerInstanceId
   */
  private generateCollisionProofEventId(taskId: string, currentStage: string, createdAt?: string): string {
    const timestamp = createdAt || new Date().toISOString();
    const workerId = process.env.WORKER_ID || 'default-worker';
    const input = `${taskId}:${currentStage}:${timestamp}:${workerId}`;
    const hash = createHash('sha1').update(input).digest('hex');
    return `evt-${hash.substring(0, 12)}`;
  }

  /**
   * Check Redis-backed event deduplication (Phase 1 hardening)
   * Returns true if event was already seen, false if new
   */
  private async isEventAlreadySeen(taskId: string, eventId: string): Promise<boolean> {
    try {
      const key = `seen:${taskId}`;
      const isMember = await this.redisClient.sismember(key, eventId);
      return isMember === 1;
    } catch (error) {
      logger.error('[SESSION #25 HARDENING] Redis dedup check failed, assuming new event', {
        task_id: taskId,
        error: (error as any)?.message
      });
      return false;
    }
  }

  /**
   * Track event in Redis-backed deduplication set (Phase 1 hardening)
   */
  private async trackEventId(taskId: string, eventId: string): Promise<void> {
    try {
      const key = `seen:${taskId}`;
      // Add to set and set TTL to 48 hours
      await this.redisClient.sadd(key, eventId);
      await this.redisClient.expire(key, 48 * 60 * 60);
      logger.info('[SESSION #25 HARDENING] Event ID tracked for deduplication', {
        task_id: taskId,
        event_id: eventId
      });
    } catch (error) {
      logger.error('[SESSION #25 HARDENING] Failed to track event ID in Redis', {
        task_id: taskId,
        error: (error as any)?.message
      });
    }
  }

  /**
   * Acquire distributed lock using Redis SET NX with TTL (Phase 1 hardening)
   */
  private async acquireDistributedLock(lockKey: string, ttlMs: number = 5000): Promise<string | null> {
    try {
      const lockId = `${process.env.WORKER_ID || 'default'}-${Date.now()}-${Math.random()}`;
      const acquired = await this.redisClient.set(
        lockKey,
        lockId,
        'PX',
        ttlMs,
        'NX'
      );
      if (acquired) {
        logger.info('[SESSION #25 P1.3] Distributed lock acquired', {
          lock_key: lockKey,
          lock_id: lockId
        });
        return lockId;
      }
      return null;
    } catch (error) {
      logger.error('[SESSION #25 P1.3] Failed to acquire distributed lock', {
        lock_key: lockKey,
        error: (error as any)?.message
      });
      return null;
    }
  }

  /**
   * Release distributed lock (Phase 1 hardening)
   */
  private async releaseDistributedLock(lockKey: string, lockId: string): Promise<void> {
    try {
      // Use Lua script to safely delete only if lockId matches
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      await (this.redisClient as any).eval(script, 1, lockKey, lockId);
      logger.info('[SESSION #25 P1.3] Distributed lock released', {
        lock_key: lockKey
      });
    } catch (error) {
      logger.error('[SESSION #25 P1.3] Failed to release distributed lock', {
        lock_key: lockKey,
        error: (error as any)?.message
      });
    }
  }

  async createWorkflow(request: CreateWorkflowRequest): Promise<WorkflowResponse> {
    const startTime = Date.now();
    const traceId = generateTraceId();

    logger.info('Creating workflow - Full request details', {
      type: request.type,
      name: request.name,
      trace_id: traceId,
      request_keys: Object.keys(request),
      full_request: JSON.stringify(request)
    });

    try {
      // Create workflow in database
      const workflow = await this.repository.create({
        ...request,
        created_by: 'system' // In production, get from auth context
      });

      // Create state machine for workflow
      const stateMachine = this.stateMachineService.createStateMachine(
        workflow.id,
        workflow.type
      );

      // Start the workflow
      stateMachine.send({ type: 'START' });

      // Publish workflow created event
      await this.eventBus.publish({
        id: `event-${Date.now()}`,
        type: 'WORKFLOW_CREATED',
        workflow_id: workflow.id,
        payload: {
          workflow_id: workflow.id,
          type: workflow.type,
          name: workflow.name
        },
        timestamp: new Date().toISOString(),
        trace_id: traceId
      });

      // Create initial task for the first stage
      await this.createTaskForStage(workflow.id, 'initialization', {
        name: workflow.name,
        description: workflow.description,
        requirements: workflow.requirements,
        type: workflow.type
      });

      // Record metrics
      metrics.recordDuration('workflow.creation', Date.now() - startTime, {
        type: workflow.type
      });
      metrics.increment('workflows.created', { type: workflow.type });

      return {
        workflow_id: workflow.id,
        status: workflow.status,
        current_stage: workflow.current_stage,
        progress_percentage: workflow.progress,
        estimated_duration_ms: this.estimateDuration(workflow.type),
        created_at: workflow.created_at.toISOString(),
        updated_at: workflow.updated_at.toISOString()
      };
    } catch (error) {
      logger.error('Failed to create workflow', {
        error,
        request,
        trace_id: traceId
      });
      metrics.increment('workflows.creation.failed', { type: request.type });
      throw error;
    }
  }

  async getWorkflow(workflowId: string): Promise<WorkflowResponse | null> {
    const workflow = await this.repository.findById(workflowId);

    if (!workflow) {
      return null;
    }

    return {
      workflow_id: workflow.id,
      status: workflow.status,
      current_stage: workflow.current_stage,
      progress_percentage: workflow.progress,
      created_at: workflow.created_at.toISOString(),
      updated_at: workflow.updated_at.toISOString()
    };
  }

  async listWorkflows(filters?: {
    status?: string;
    type?: string;
    priority?: string;
  }): Promise<WorkflowResponse[]> {
    const workflows = await this.repository.findAll(filters);

    return workflows.map(workflow => ({
      workflow_id: workflow.id,
      status: workflow.status,
      current_stage: workflow.current_stage,
      progress_percentage: workflow.progress,
      created_at: workflow.created_at.toISOString(),
      updated_at: workflow.updated_at.toISOString()
    }));
  }

  async cancelWorkflow(workflowId: string): Promise<void> {
    const workflow = await this.repository.findById(workflowId);
    if (!workflow) {
      throw new NotFoundError(`Workflow ${workflowId} not found`);
    }

    const stateMachine = this.stateMachineService.getStateMachine(workflowId);
    if (stateMachine) {
      stateMachine.send({ type: 'CANCEL' });
    }

    await this.repository.update(workflowId, {
      status: 'cancelled'
    });

    logger.info('Workflow cancelled', { workflow_id: workflowId });
    metrics.increment('workflows.cancelled');
  }

  async retryWorkflow(workflowId: string, fromStage?: string): Promise<void> {
    const workflow = await this.repository.findById(workflowId);
    if (!workflow) {
      throw new NotFoundError(`Workflow ${workflowId} not found`);
    }

    const stateMachine = this.stateMachineService.getStateMachine(workflowId);
    if (stateMachine) {
      stateMachine.send({ type: 'RETRY' });
    }

    const stage = fromStage || workflow.current_stage;
    await this.createTaskForStage(workflowId, stage);

    logger.info('Workflow retry initiated', {
      workflow_id: workflowId,
      from_stage: stage
    });
    metrics.increment('workflows.retried');
  }

  private async createTaskForStage(workflowId: string, stage: string, workflowData?: any): Promise<void> {
    const taskId = randomUUID();
    const agentType = this.getAgentTypeForStage(stage);

    // SESSION #30: Read workflow context for stage-specific payloads
    const workflow = await this.repository.findById(workflowId);
    if (!workflow) {
      logger.error('Workflow not found for task creation', { workflowId, stage });
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const stageOutputs = typeof workflow.stage_outputs === 'object' && workflow.stage_outputs !== null
      ? workflow.stage_outputs as Record<string, any>
      : {};

    // SESSION #36: Build agent envelope (replaces TaskAssignment)
    const envelope = this.buildAgentEnvelope(
      taskId,
      workflowId,
      stage,
      agentType,
      stageOutputs,
      workflowData,
      workflow
    );

    // Create task in database
    await this.repository.createTask({
      task_id: taskId,
      workflow_id: workflowId,
      agent_type: agentType as any,
      status: 'pending',
      priority: 'medium',
      payload: envelope as any, // Store envelope in database
      retry_count: 0,
      max_retries: 3,
      timeout_ms: 300000
    } as any);

    logger.info('[SESSION #36] Agent envelope created', {
      task_id: taskId,
      workflow_id: workflowId,
      stage,
      agent_type: agentType,
      envelope_version: envelope.envelope_version,
      has_workflow_context: !!envelope.workflow_context
    });

    // Publish task assignment event
    await this.eventBus.publish({
      id: `event-${Date.now()}`,
      type: 'TASK_ASSIGNED',
      workflow_id: workflowId,
      payload: envelope,
      timestamp: new Date().toISOString(),
      trace_id: envelope.trace_id
    });

    // Phase 3: Dispatch envelope to agent via message bus
    if (this.messageBus) {
      const taskChannel = `agent:${agentType}:tasks`;

      try {
        await this.messageBus.publish(
          taskChannel,
          envelope,
          {
            key: workflowId,
            mirrorToStream: `stream:${taskChannel}` // Durability via stream
          }
        );

        logger.info('[PHASE-3] Task dispatched via message bus', {
          task_id: taskId,
          workflow_id: workflowId,
          stage,
          agent_type: agentType,
          channel: taskChannel,
          stream_mirrored: true
        });
      } catch (error) {
        logger.error('[TASK_DISPATCH] Failed to publish task to message bus', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          task_id: taskId,
          workflow_id: workflowId,
          stage,
          agent_type: agentType,
          channel: taskChannel
        });

        // Mark workflow as failed using state machine
        const stateMachine = this.stateMachineService.getStateMachine(workflowId);
        if (stateMachine) {
          stateMachine.send({
            type: 'STAGE_FAILED',
            stage,
            error: `Task dispatch failed: ${error instanceof Error ? error.message : String(error)}`
          });
        }

        // Re-throw to ensure proper error propagation
        throw new Error(`Task dispatch failed for workflow ${workflowId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      logger.error('[PHASE-3] messageBus not available for task dispatch', {
        workflow_id: workflowId,
        stage
      });
      throw new Error('Message bus not initialized - cannot dispatch task');
    }
  }

  private async handleAgentResult(result: any): Promise<void> {
    // Extract AgentResultSchema-compliant payload
    const agentResult = result.payload;

    // ✓ CRITICAL: Validate against AgentResultSchema to ensure compliance
    try {
      const { AgentResultSchema } = require('@agentic-sdlc/shared-types/src/core/schemas');
      AgentResultSchema.parse(agentResult);
    } catch (validationError) {
      logger.error('AgentResultSchema validation failed in orchestrator - SCHEMA COMPLIANCE BREACH', {
        workflow_id: result.workflow_id,
        agent_id: result.agent_id,
        validation_error: (validationError as any).message,
        result_keys: Object.keys(agentResult || {}).join(',')
      });
      throw new Error(`Invalid agent result - does not comply with AgentResultSchema: ${(validationError as any).message}`);
    }

    logger.info('Handling AgentResultSchema-compliant result', {
      workflow_id: agentResult.workflow_id,
      task_id: agentResult.task_id,
      agent_id: agentResult.agent_id,
      success: agentResult.success,
      status: agentResult.status,
      stage_from_message: result.stage
    });

    // Determine the stage from result.stage (the workflow stage, not the action)
    const completedStage = result.stage;

    if (agentResult.success) {
      logger.info('Task completed successfully - transitioning workflow', {
        workflow_id: agentResult.workflow_id,
        task_id: agentResult.task_id,
        completed_stage: completedStage,
        agent_id: agentResult.agent_id
      });

      // SESSION #30: Store stage output before transitioning
      // ✓ Extract from result.result field (AgentResultSchema compliance)
      const stageOutput = {
        agent_id: agentResult.agent_id,
        agent_type: agentResult.agent_type,
        status: agentResult.status,
        ...(agentResult.result && { output: agentResult.result.output || agentResult.result }),
        ...(agentResult.metrics && { metrics: agentResult.metrics }),
        ...(agentResult.artifacts && { artifacts: agentResult.artifacts }),
        timestamp: agentResult.timestamp
      };

      await this.storeStageOutput(agentResult.workflow_id, completedStage, stageOutput);

      await this.handleTaskCompletion({
        payload: {
          task_id: agentResult.task_id,
          workflow_id: agentResult.workflow_id,
          stage: completedStage
        }
      });
    } else {
      // SESSION #32: Store stage output even on failure for audit trail
      const failureOutput = {
        agent_id: agentResult.agent_id,
        agent_type: agentResult.agent_type,
        status: agentResult.status,
        success: false,
        ...(agentResult.result && { output: agentResult.result }),
        ...(agentResult.error && { error: agentResult.error }),
        ...(agentResult.metrics && { metrics: agentResult.metrics }),
        timestamp: agentResult.timestamp
      };

      await this.storeStageOutput(agentResult.workflow_id, completedStage, failureOutput);

      await this.handleTaskFailure({
        payload: {
          task_id: agentResult.task_id,
          workflow_id: agentResult.workflow_id,
          stage: completedStage,
          error: agentResult.error?.message || 'Agent task failed'
        }
      });
    }
  }

  private async handleTaskCompletion(event: any): Promise<void> {
    const { task_id, workflow_id } = event.payload;
    const completedStage = event.payload?.stage;
    const eventTimestamp = new Date().toISOString();
    const workerId = process.env.WORKER_ID || 'default-worker';

    // ============================================================================
    // PHASE 2 INVESTIGATION: Truth table logging - comprehensive event diagnostics
    // ============================================================================
    logger.info('[WF:HANDLE_COMPLETION:ENTRY] handleTaskCompletion invoked', {
      task_id,
      workflow_id,
      stage: completedStage,
      timestamp: eventTimestamp,
      worker_id: workerId
    });

    // ============================================================================
    // PHASE 1 HARDENING: Generate collision-proof eventId with sha1
    // ============================================================================
    const eventId = this.generateCollisionProofEventId(task_id, completedStage);
    logger.info('[SESSION #25 P1.2] Collision-proof eventId generated', {
      task_id,
      event_id: eventId,
      stage: completedStage
    });

    // ============================================================================
    // PHASE 1 HARDENING: Redis-backed event deduplication check
    // ============================================================================
    const alreadySeen = await this.isEventAlreadySeen(task_id, eventId);
    if (alreadySeen) {
      logger.warn('[SESSION #25 P1.1] Event already processed (Redis dedup caught duplicate)', {
        task_id,
        event_id: eventId,
        workflow_id
      });
      return;
    }

    // ============================================================================
    // PHASE 1 HARDENING: Acquire distributed lock for per-task serial execution
    // ============================================================================
    const lockKey = `lock:task:${task_id}`;
    const lockId = await this.acquireDistributedLock(lockKey, 5000);
    if (!lockId) {
      logger.warn('[SESSION #25 P1.3] Failed to acquire distributed lock, another worker may be processing', {
        task_id,
        lock_key: lockKey
      });
      return;
    }

    try {
      // ============================================================================
      // PHASE 2 INVESTIGATION: Context load verification with stale detection
      // ============================================================================
      const workflow = await this.repository.findById(workflow_id);
      if (!workflow) {
        logger.error('[SESSION #25 P2.4] Workflow not found during completion handling', {
          workflow_id,
          task_id
        });
        return;
      }

      // ============================================================================
      // PHASE 2 INVESTIGATION: Truth table logging - detailed state snapshot
      // ============================================================================
      logger.info('[SESSION #25 P2.1] Truth table entry - event and context state', {
        timestamp: eventTimestamp,
        task_id,
        workflow_id,
        worker_id: workerId,
        // Event source values
        event_type: 'STAGE_COMPLETE',
        event_payload_stage: completedStage,
        // Database current state
        database_current_stage: workflow.current_stage,
        database_status: workflow.status,
        database_progress: workflow.progress,
        database_type: workflow.type,
        // Mismatch check
        stage_match: workflow.current_stage === completedStage ? 'YES' : 'NO',
        // Critical for debugging
        severity: workflow.current_stage === completedStage ? 'INFO' : 'CRITICAL'
      });

      // ============================================================================
      // PHASE 1 HARDENING: Defensive transition gate - stage mismatch detection
      // ============================================================================
      if (workflow.current_stage !== completedStage) {
        logger.warn('[SESSION #25 P1.5] Stage mismatch detected - defensive gate triggered', {
          task_id,
          workflow_id,
          database_current_stage: workflow.current_stage,
          event_completed_stage: completedStage,
          severity: 'CRITICAL'
        });
        return;
      }

      // Idempotency check: Prevent duplicate processing of the same task (in-memory backup)
      if (this.processedTasks.has(task_id)) {
        logger.warn('[WF:DUPLICATE_DETECTED] Task already processed, skipping duplicate', {
          task_id,
          workflow_id
        });
        return;
      }

      // Mark task as processed
      this.processedTasks.add(task_id);
      logger.info('[WF:TASK_MARKED_PROCESSED] Task marked as processed', {
        task_id,
        workflow_id
      });

      // Update task status
      await this.repository.updateTask(task_id, {
        status: 'completed',
        completed_at: new Date()
      });

      // Update workflow state machine
      const stateMachine = this.stateMachineService.getStateMachine(workflow_id);
      if (stateMachine) {
        stateMachine.send({
          type: 'STAGE_COMPLETE',
          stage: completedStage,
          eventId: eventId
        });

        // Wait for state machine to process the transition and update database
        // The transitionToNextStage action (in onDone handler) is async and updates the database
        // We need to wait for the database to reflect the new current_stage
        const updatedWorkflow = await this.waitForStageTransition(workflow_id, completedStage);

        if (updatedWorkflow) {
          logger.info('Workflow state after stage completion', {
            workflow_id,
            status: updatedWorkflow.status,
            current_stage: updatedWorkflow.current_stage,
            progress: updatedWorkflow.progress
          });

          // Create task for the next stage if workflow is not in a terminal state
          if (updatedWorkflow.status !== 'completed' && updatedWorkflow.status !== 'failed' && updatedWorkflow.status !== 'cancelled') {
            logger.info('Creating task for next stage', {
              workflow_id,
              workflow_type: updatedWorkflow.type,
              next_stage: updatedWorkflow.current_stage,
              workflow_status: updatedWorkflow.status,
              previous_stage_in_event: completedStage
            });

            await this.createTaskForStage(workflow_id, updatedWorkflow.current_stage, {
              name: updatedWorkflow.name,
              description: updatedWorkflow.description,
              requirements: updatedWorkflow.requirements,
              type: updatedWorkflow.type
            });
          } else {
            logger.info('Workflow reached terminal state, no new task created', {
              workflow_id,
              status: updatedWorkflow.status
            });
          }
        }
      }

      // ============================================================================
      // PHASE 1 HARDENING: Track event in Redis-backed deduplication
      // ============================================================================
      await this.trackEventId(task_id, eventId);

    } finally {
      // Release distributed lock
      await this.releaseDistributedLock(lockKey, lockId);
    }
  }

  /**
   * Wait for the workflow's current_stage to change from the completed stage
   * This ensures the state machine's async actions have completed and the database is updated
   */
  private async waitForStageTransition(workflow_id: string, previousStage: string): Promise<any> {
    const maxAttempts = 50; // 5 seconds with 100ms polling
    let attempts = 0;

    while (attempts < maxAttempts) {
      const workflow = await this.repository.findById(workflow_id);

      if (!workflow) {
        logger.error('Workflow not found while waiting for stage transition', {
          workflow_id
        });
        return null;
      }

      // If the stage has changed, the state machine transition is complete
      if (workflow.current_stage !== previousStage) {
        logger.info('Stage transition detected in database', {
          workflow_id,
          from_stage: previousStage,
          to_stage: workflow.current_stage,
          attempts
        });
        return workflow;
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    logger.warn('Timeout waiting for stage transition in database', {
      workflow_id,
      previous_stage: previousStage,
      attempts: maxAttempts
    });

    // Return the workflow anyway - it might be in terminal state
    return await this.repository.findById(workflow_id);
  }

  private async handleTaskFailure(event: any): Promise<void> {
    const { task_id, workflow_id, error } = event.payload;

    // Update task status
    await this.repository.updateTask(task_id, {
      status: 'failed'
    });

    // Check retry count
    const task = await this.repository.getPendingTasks();
    const failedTask = task.find(t => t.task_id === task_id);

    if (failedTask && failedTask.retry_count < failedTask.max_retries) {
      // Retry the task
      await this.repository.updateTask(task_id, {
        status: 'pending',
        retry_count: failedTask.retry_count + 1
      });

      logger.info('Retrying failed task', {
        task_id,
        retry_count: failedTask.retry_count + 1
      });
    } else {
      // Mark workflow as failed
      const stateMachine = this.stateMachineService.getStateMachine(workflow_id);
      if (stateMachine) {
        stateMachine.send({
          type: 'STAGE_FAILED',
          stage: event.payload.stage,
          error
        });
      }
    }
  }

  /**
   * SESSION #30: Store stage output for context passing to next stages
   */
  private async storeStageOutput(workflowId: string, stage: string, output: any): Promise<void> {
    try {
      // Get current workflow
      const workflow = await this.repository.findById(workflowId);
      if (!workflow) {
        logger.error('Workflow not found for storing stage output', { workflowId, stage });
        return;
      }

      // Parse existing stage_outputs or initialize
      const stageOutputs = typeof workflow.stage_outputs === 'object' && workflow.stage_outputs !== null
        ? workflow.stage_outputs as Record<string, any>
        : {};

      // Extract relevant fields based on stage
      const stageOutput = this.extractStageOutput(stage, output, workflowId);

      // Store under stage name
      stageOutputs[stage] = {
        ...stageOutput,
        completed_at: new Date().toISOString()
      };

      // Update workflow with new stage outputs
      await this.repository.update(workflowId, {
        stage_outputs: stageOutputs as any
      });

      logger.info('[SESSION #30] Stage output stored', {
        workflow_id: workflowId,
        stage,
        output_keys: Object.keys(stageOutput)
      });
    } catch (error) {
      logger.error('Failed to store stage output', {
        workflow_id: workflowId,
        stage,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * SESSION #30: Build stage-specific payload with context from previous stages
   */
  /**
   * SESSION #36: Build agent envelope for a stage
   * Replaces TaskAssignment with typed envelope format
   */
  private buildAgentEnvelope(
    taskId: string,
    workflowId: string,
    stage: string,
    agentType: string,
    stageOutputs: Record<string, any>,
    workflowData: any,
    workflow: any
  ): any {
    const now = new Date().toISOString();
    // SESSION #47: Use task_id as trace_id instead of custom trace format
    // The envelope schema expects trace_id to be a valid UUID or undefined
    const { randomUUID } = require('crypto');
    const traceId = randomUUID();

    // Common envelope metadata
    const envelopeBase = {
      task_id: taskId,
      workflow_id: workflowId,
      priority: 'medium' as const,
      status: 'pending' as const,
      retry_count: 0,
      max_retries: 3,
      timeout_ms: 300000,
      created_at: now,
      trace_id: traceId,
      envelope_version: '1.0.0' as const,
      workflow_context: {
        workflow_type: workflow.type,
        workflow_name: workflow.name,
        current_stage: stage,
        stage_outputs: stageOutputs
      }
    };

    // Build agent-specific envelope based on type
    switch (agentType) {
      case 'scaffold': {
        return {
          ...envelopeBase,
          agent_type: 'scaffold' as const,
          payload: {
            project_type: workflow.type,
            name: workflow.name,
            description: workflow.description || '',
            requirements: (workflowData.requirements || '').split('. ').filter((r: string) => r.length > 0),
            tech_stack: {
              language: 'typescript',
              runtime: 'node',
              testing: 'vitest',
              package_manager: 'pnpm',
              bundler: workflowData.tech_stack === 'react' ? 'vite' : undefined,
              ui_library: workflowData.tech_stack === 'react' ? 'react' : undefined,
            },
          }
        };
      }

      case 'validation': {
        const scaffoldOutput = stageOutputs.scaffolding || stageOutputs.initialization || {};
        const projectRoot = process.env.OUTPUT_DIR || '/Users/Greg/Projects/apps/zyp/agent-sdlc/ai.output';
        const projectPath = scaffoldOutput.output_path ||
                           `${projectRoot}/${workflow.id}/${scaffoldOutput.project_name || workflow.name}`;

        // Extract file paths from scaffolding output
        const filePaths: string[] = [];
        if (scaffoldOutput.files_generated && Array.isArray(scaffoldOutput.files_generated)) {
          scaffoldOutput.files_generated.forEach((file: any) => {
            if (file.path) {
              filePaths.push(`${projectPath}/${file.path}`);
            }
          });
        }

        // If no files found, use wildcards
        if (filePaths.length === 0) {
          filePaths.push(`${projectPath}/**/*.ts`);
          filePaths.push(`${projectPath}/**/*.tsx`);
        }

        logger.info('[SESSION #36] Building validation envelope', {
          workflow_id: workflowId,
          file_count: filePaths.length,
          working_directory: projectPath
        });

        return {
          ...envelopeBase,
          agent_type: 'validation' as const,
          payload: {
            file_paths: filePaths,
            working_directory: projectPath,
            validation_types: ['typescript', 'eslint'] as const,
            thresholds: {
              coverage: 80,
              complexity: 10,
              errors: 0,
              warnings: 10,
              duplications: 5,
            },
          }
        };
      }

      case 'e2e': {
        const scaffoldOutput = stageOutputs.scaffolding || stageOutputs.initialization || {};
        const projectRoot = process.env.OUTPUT_DIR || '/Users/Greg/Projects/apps/zyp/agent-sdlc/ai.output';
        const projectPath = scaffoldOutput.output_path ||
                           `${projectRoot}/${workflow.id}/${scaffoldOutput.project_name || workflow.name}`;

        return {
          ...envelopeBase,
          agent_type: 'e2e' as const,
          payload: {
            working_directory: projectPath,
            entry_points: scaffoldOutput.entry_points || [],
            browser: 'chromium' as const,
            headless: true,
            screenshot_on_failure: true,
            video: false,
          }
        };
      }

      case 'integration': {
        const scaffoldOutput = stageOutputs.scaffolding || stageOutputs.initialization || {};
        const projectRoot = process.env.OUTPUT_DIR || '/Users/Greg/Projects/apps/zyp/agent-sdlc/ai.output';
        const projectPath = scaffoldOutput.output_path ||
                           `${projectRoot}/${workflow.id}/${scaffoldOutput.project_name || workflow.name}`;

        return {
          ...envelopeBase,
          agent_type: 'integration' as const,
          payload: {
            working_directory: projectPath,
            api_endpoints: [],
            test_database: true,
            test_external_services: false,
          }
        };
      }

      case 'deployment': {
        const scaffoldOutput = stageOutputs.scaffolding || stageOutputs.initialization || {};
        const projectRoot = process.env.OUTPUT_DIR || '/Users/Greg/Projects/apps/zyp/agent-sdlc/ai.output';
        const projectPath = scaffoldOutput.output_path ||
                           `${projectRoot}/${workflow.id}/${scaffoldOutput.project_name || workflow.name}`;

        return {
          ...envelopeBase,
          agent_type: 'deployment' as const,
          payload: {
            working_directory: projectPath,
            deployment_target: 'docker' as const,
            environment: 'development' as const,
          }
        };
      }

      default:
        throw new Error(`Unknown agent type: ${agentType}`);
    }
  }

  private buildStagePayload(
    stage: string,
    stageOutputs: Record<string, any>,
    workflowData: any,
    workflow: any
  ): Record<string, any> {
    const basePayload = {
      workflow_type: workflow.type,
      workflow_name: workflow.name,
      workflow_description: workflow.description
    };

    switch (stage) {
      case 'initialization':
      case 'scaffolding':
        // Scaffolding gets workflow data
        return {
          ...basePayload,
          ...workflowData
        };

      case 'validation': {
        // Validation needs paths from scaffolding
        const scaffoldOutput = stageOutputs.scaffolding || stageOutputs.initialization || {};
        const projectRoot = process.env.OUTPUT_DIR || '/Users/Greg/Projects/apps/zyp/agent-sdlc/ai.output';
        const projectPath = scaffoldOutput.output_path ||
                           `${projectRoot}/${workflow.id}/${scaffoldOutput.project_name || workflow.name}`;

        // SESSION #32 FIX: Extract file_paths from scaffolding output
        const filePaths: string[] = [];
        if (scaffoldOutput.files_generated && Array.isArray(scaffoldOutput.files_generated)) {
          scaffoldOutput.files_generated.forEach((file: any) => {
            if (file.path) {
              // Build full path: working_directory + file.path
              filePaths.push(`${projectPath}/${file.path}`);
            }
          });
        }

        // If no files found, use a wildcard to validate everything
        if (filePaths.length === 0) {
          filePaths.push(`${projectPath}/**/*.ts`);
          filePaths.push(`${projectPath}/**/*.tsx`);
        }

        logger.info('[SESSION #32] Building validation payload with file_paths', {
          workflow_id: workflow.id,
          file_count: filePaths.length,
          working_directory: projectPath
        });

        return {
          ...basePayload,
          working_directory: projectPath,
          file_paths: filePaths,
          validation_types: ['typescript', 'eslint'],
          thresholds: {
            coverage: 80
          },
          previous_outputs: scaffoldOutput
        };
      }

      case 'e2e_testing': {
        // E2E needs code paths and validation results
        const scaffoldOutput = stageOutputs.scaffolding || stageOutputs.initialization || {};
        const validationOutput = stageOutputs.validation || {};
        const projectRoot = process.env.OUTPUT_DIR || '/Users/Greg/Projects/apps/zyp/agent-sdlc/ai.output';
        const projectPath = scaffoldOutput.output_path ||
                           `${projectRoot}/${workflow.id}/${scaffoldOutput.project_name || workflow.name}`;

        return {
          ...basePayload,
          working_directory: projectPath,
          entry_points: scaffoldOutput.entry_points || [],
          validation_passed: validationOutput.overall_status === 'pass',
          previous_outputs: {
            scaffold: scaffoldOutput,
            validation: validationOutput
          }
        };
      }

      case 'integration': {
        // Integration needs all previous context
        const scaffoldOutput = stageOutputs.scaffolding || stageOutputs.initialization || {};
        const e2eOutput = stageOutputs.e2e_testing || {};
        const projectRoot = process.env.OUTPUT_DIR || '/Users/Greg/Projects/apps/zyp/agent-sdlc/ai.output';
        const projectPath = scaffoldOutput.output_path ||
                           `${projectRoot}/${workflow.id}/${scaffoldOutput.project_name || workflow.name}`;

        return {
          ...basePayload,
          working_directory: projectPath,
          test_results: e2eOutput.test_results,
          previous_outputs: stageOutputs
        };
      }

      case 'deployment': {
        // Deployment needs everything
        const scaffoldOutput = stageOutputs.scaffolding || stageOutputs.initialization || {};
        const projectRoot = process.env.OUTPUT_DIR || '/Users/Greg/Projects/apps/zyp/agent-sdlc/ai.output';
        const projectPath = scaffoldOutput.output_path ||
                           `${projectRoot}/${workflow.id}/${scaffoldOutput.project_name || workflow.name}`;

        return {
          ...basePayload,
          working_directory: projectPath,
          deployment_target: 'docker',
          previous_outputs: stageOutputs
        };
      }

      default:
        return basePayload;
    }
  }

  /**
   * SESSION #30: Extract relevant fields from stage output
   */
  private extractStageOutput(stage: string, output: any, workflowId: string): Record<string, any> {
    if (!output) return {};

    switch (stage) {
      case 'initialization':
      case 'scaffolding': {
        // Extract actual project path from the scaffold result
        const projectRoot = process.env.OUTPUT_DIR || '/Users/Greg/Projects/apps/zyp/agent-sdlc/ai.output';
        const projectName = output.structure?.root_path?.split('/').pop() || output.project_name;
        const actualPath = `${projectRoot}/${workflowId}/${projectName}`;

        return {
          output_path: actualPath,
          files_generated: output.files_generated || [],
          structure: output.structure,
          project_name: projectName,
          entry_points: output.structure?.entry_points || []
        };
      }

      case 'validation':
        return {
          overall_status: output.overall_status,
          passed_checks: output.summary?.passed_checks,
          failed_checks: output.summary?.failed_checks,
          quality_gates: output.quality_gates
        };

      case 'e2e_testing':
        return {
          tests_generated: output.tests_generated || [],
          test_results: output.test_results,
          screenshots: output.screenshots,
          videos: output.videos
        };

      case 'integration':
        return {
          integration_results: output.integration_results,
          api_tests: output.api_tests
        };

      case 'deployment':
        return {
          deployment_url: output.deployment_url,
          container_id: output.container_id,
          deployment_status: output.deployment_status
        };

      default:
        // Return everything for unknown stages
        return output;
    }
  }

  // SESSION #37: Use constants for stage-to-agent mapping
  private getAgentTypeForStage(stage: string): string {
    return getAgentTypeForStage(stage);
  }

  private estimateDuration(workflowType: string): number {
    const estimates: Record<string, number> = {
      app: 1800000,    // 30 minutes
      feature: 900000,  // 15 minutes
      bugfix: 600000    // 10 minutes
    };

    return estimates[workflowType] || 1800000;
  }

  /**
   * Evaluate if decision is required for a workflow stage
   * Integrates with Phase 10 Decision Engine
   */
  async evaluateDecisionGate(
    workflowId: string,
    stage: string,
    action: string,
    confidence: number
  ): Promise<void> {
    const workflow = await this.repository.findById(workflowId);
    if (!workflow) {
      throw new NotFoundError(`Workflow ${workflowId} not found`);
    }

    // Check if this stage requires a decision gate
    if (!this.decisionGateService.shouldEvaluateDecision(stage, workflow.type)) {
      logger.info('Stage does not require decision gate', { workflow_id: workflowId, stage });
      return;
    }

    const category = this.decisionGateService.getDecisionCategory(stage, workflow.type);
    const evaluation = await this.decisionGateService.evaluateDecision({
      workflow_id: workflowId,
      item_id: workflow.id,
      category,
      action,
      confidence,
      trace_id: generateTraceId(),
    });

    if (evaluation.requires_human_approval) {
      // Pause workflow and wait for operator decision
      const stateMachine = this.stateMachineService.getStateMachine(workflowId);
      if (stateMachine) {
        stateMachine.send({
          type: 'DECISION_REQUIRED',
          decision_id: evaluation.decision.decision_id,
        });
      }

      // Publish decision required event
      await this.eventBus.publish({
        id: `event-${Date.now()}`,
        type: 'DECISION_REQUIRED',
        workflow_id: workflowId,
        payload: {
          decision_id: evaluation.decision.decision_id,
          category,
          action,
          confidence,
          escalation_route: evaluation.escalation_route,
        },
        timestamp: new Date().toISOString(),
        trace_id: generateTraceId(),
      });

      logger.info('Decision required - workflow paused', {
        workflow_id: workflowId,
        decision_id: evaluation.decision.decision_id,
        stage,
        category,
      });

      metrics.increment('workflows.decisions.required', { category });
    } else {
      logger.info('Decision auto-approved', {
        workflow_id: workflowId,
        decision_id: evaluation.decision.decision_id,
        stage,
        confidence,
      });

      metrics.increment('workflows.decisions.auto_approved', { category });
    }
  }

  /**
   * Handle operator decision approval
   */
  async approveDecision(workflowId: string, decisionId: string): Promise<void> {
    const workflow = await this.repository.findById(workflowId);
    if (!workflow) {
      throw new NotFoundError(`Workflow ${workflowId} not found`);
    }

    const stateMachine = this.stateMachineService.getStateMachine(workflowId);
    if (stateMachine) {
      stateMachine.send({
        type: 'DECISION_APPROVED',
        decision_id: decisionId,
      });
    }

    await this.eventBus.publish({
      id: `event-${Date.now()}`,
      type: 'DECISION_APPROVED',
      workflow_id: workflowId,
      payload: { decision_id: decisionId },
      timestamp: new Date().toISOString(),
      trace_id: generateTraceId(),
    });

    logger.info('Decision approved - workflow resumed', {
      workflow_id: workflowId,
      decision_id: decisionId,
    });

    metrics.increment('workflows.decisions.approved');
  }

  /**
   * Handle operator decision rejection
   */
  async rejectDecision(
    workflowId: string,
    decisionId: string,
    reason?: string
  ): Promise<void> {
    const workflow = await this.repository.findById(workflowId);
    if (!workflow) {
      throw new NotFoundError(`Workflow ${workflowId} not found`);
    }

    const stateMachine = this.stateMachineService.getStateMachine(workflowId);
    if (stateMachine) {
      stateMachine.send({
        type: 'DECISION_REJECTED',
        decision_id: decisionId,
        reason,
      });
    }

    await this.eventBus.publish({
      id: `event-${Date.now()}`,
      type: 'DECISION_REJECTED',
      workflow_id: workflowId,
      payload: { decision_id: decisionId, reason },
      timestamp: new Date().toISOString(),
      trace_id: generateTraceId(),
    });

    logger.warn('Decision rejected - workflow failed', {
      workflow_id: workflowId,
      decision_id: decisionId,
      reason,
    });

    metrics.increment('workflows.decisions.rejected');
  }

  /**
   * Evaluate if clarification is required for workflow requirements
   */
  async evaluateClarificationGate(
    workflowId: string,
    requirements: string,
    acceptanceCriteria: string[],
    confidence: number
  ): Promise<void> {
    const workflow = await this.repository.findById(workflowId);
    if (!workflow) {
      throw new NotFoundError(`Workflow ${workflowId} not found`);
    }

    const evaluation = await this.decisionGateService.evaluateClarification(
      workflowId,
      requirements,
      acceptanceCriteria,
      confidence
    );

    if (evaluation.needs_clarification) {
      const clarificationId = `CLR-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;

      // Pause workflow and wait for clarification
      const stateMachine = this.stateMachineService.getStateMachine(workflowId);
      if (stateMachine) {
        stateMachine.send({
          type: 'CLARIFICATION_REQUIRED',
          clarification_id: clarificationId,
        });
      }

      // Publish clarification required event
      await this.eventBus.publish({
        id: `event-${Date.now()}`,
        type: 'CLARIFICATION_REQUIRED',
        workflow_id: workflowId,
        payload: {
          clarification_id: clarificationId,
          ambiguities: evaluation.ambiguities,
          missing_criteria: evaluation.missing_criteria,
          conflicting_constraints: evaluation.conflicting_constraints,
        },
        timestamp: new Date().toISOString(),
        trace_id: generateTraceId(),
      });

      logger.info('Clarification required - workflow paused', {
        workflow_id: workflowId,
        clarification_id: clarificationId,
        ambiguities_count: evaluation.ambiguities.length,
        missing_criteria_count: evaluation.missing_criteria.length,
      });

      metrics.increment('workflows.clarifications.required');
    } else {
      logger.info('Requirements clear - no clarification needed', {
        workflow_id: workflowId,
        confidence,
      });
    }
  }

  /**
   * Handle clarification completion
   */
  async completeClarification(workflowId: string, clarificationId: string): Promise<void> {
    const workflow = await this.repository.findById(workflowId);
    if (!workflow) {
      throw new NotFoundError(`Workflow ${workflowId} not found`);
    }

    const stateMachine = this.stateMachineService.getStateMachine(workflowId);
    if (stateMachine) {
      stateMachine.send({
        type: 'CLARIFICATION_COMPLETE',
        clarification_id: clarificationId,
      });
    }

    await this.eventBus.publish({
      id: `event-${Date.now()}`,
      type: 'CLARIFICATION_COMPLETE',
      workflow_id: workflowId,
      payload: { clarification_id: clarificationId },
      timestamp: new Date().toISOString(),
      trace_id: generateTraceId(),
    });

    logger.info('Clarification complete - workflow resumed', {
      workflow_id: workflowId,
      clarification_id: clarificationId,
    });

    metrics.increment('workflows.clarifications.completed');
  }
}