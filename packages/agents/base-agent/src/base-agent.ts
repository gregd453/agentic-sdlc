import { randomUUID } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import pino from 'pino';
import Redis from 'ioredis';
import { retry, RetryPresets, CircuitBreaker } from '@agentic-sdlc/shared-utils';
import { REDIS_CHANNELS } from '@agentic-sdlc/shared-types';
import { AgentResultSchema, VERSION } from '@agentic-sdlc/shared-types/src/core/schemas';
// Phase 3: Import IMessageBus from orchestrator
import type { IMessageBus } from '@agentic-sdlc/orchestrator';
import {
  AgentLifecycle,
  AgentCapabilities,
  TaskAssignment,
  TaskResult,
  AgentMessage,
  HealthStatus,
  TaskAssignmentSchema,
  TaskResultSchema,
  AgentError,
  ValidationError
} from './types';

export abstract class BaseAgent implements AgentLifecycle {
  protected readonly logger: pino.Logger;
  protected readonly anthropic: Anthropic;
  protected readonly redisSubscriber: Redis;  // For subscribing to task channel
  protected readonly redisPublisher: Redis;    // For publishing results and registration
  protected readonly messageBus: IMessageBus; // Phase 3: Message bus for task subscription
  protected readonly agentId: string;
  protected readonly capabilities: AgentCapabilities;
  protected readonly claudeCircuitBreaker: CircuitBreaker;

  private startTime: number;
  private tasksProcessed: number = 0;
  private errorsCount: number = 0;
  private lastTaskAt?: string;

  constructor(
    capabilities: AgentCapabilities,
    messageBus: IMessageBus  // Phase 3: Inject message bus via DI
  ) {
    this.agentId = `${capabilities.type}-${randomUUID().slice(0, 8)}`;
    this.capabilities = capabilities;
    this.messageBus = messageBus;

    // Phase 3: Validate messageBus
    if (!messageBus) {
      throw new AgentError('messageBus is required for Phase 3 message bus integration', 'CONFIG_ERROR');
    }

    // Initialize logger
    this.logger = pino({
      name: this.agentId,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'UTC:yyyy-mm-dd HH:MM:ss'
        }
      }
    });

    // Initialize Anthropic client
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new AgentError('ANTHROPIC_API_KEY not configured', 'CONFIG_ERROR');
    }

    this.anthropic = new Anthropic({
      apiKey
    });

    // Initialize Redis clients (separate for pub/sub pattern)
    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6380'),
      retryStrategy: (times: number) => Math.min(times * 100, 3000)
    };

    this.redisSubscriber = new Redis(redisConfig);
    this.redisPublisher = new Redis(redisConfig);

    // Initialize circuit breaker for Claude API calls
    this.claudeCircuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      minimumRequests: 10,
      failureRateThreshold: 50,
      openDurationMs: 60000, // 1 minute
      halfOpenSuccessThreshold: 2,
      timeoutMs: 30000, // 30 second timeout for Claude calls
      onOpen: () => {
        this.logger.warn('Claude API circuit breaker opened - too many failures');
      },
      onClose: () => {
        this.logger.info('Claude API circuit breaker closed - service recovered');
      },
      onHalfOpen: () => {
        this.logger.info('Claude API circuit breaker half-open - testing recovery');
      }
    });

    this.startTime = Date.now();
  }

  async initialize(): Promise<void> {
    this.logger.info('[PHASE-3] Initializing agent with message bus', {
      type: this.capabilities.type,
      version: this.capabilities.version,
      capabilities: this.capabilities.capabilities,
      messageBus_available: !!this.messageBus
    });

    // Test Redis connections (still needed for result publishing)
    await this.redisPublisher.ping();

    // Phase 3: Subscribe to tasks via message bus with stream consumer groups
    const taskChannel = REDIS_CHANNELS.AGENT_TASKS(this.capabilities.type);
    const consumerGroup = `agent-${this.capabilities.type}-group`;

    this.logger.info('[PHASE-3] Subscribing to message bus for tasks', {
      taskChannel,
      consumerGroup
    });

    await this.messageBus.subscribe(
      taskChannel,
      async (message: any) => {
        try {
          // Message may be string or object depending on adapter
          const agentMessage: AgentMessage = typeof message === 'string'
            ? JSON.parse(message)
            : message;

          this.logger.info('[PHASE-3] Agent received task from message bus', {
            workflow_id: agentMessage.workflow_id,
            task_id: agentMessage.payload?.task_id,
            channel: taskChannel
          });

          await this.receiveTask(agentMessage);
        } catch (error) {
          this.logger.error('[PHASE-3] Failed to process task from message bus', {
            error: error instanceof Error ? error.message : String(error),
            message
          });
          this.errorsCount++;
        }
      },
      {
        consumerGroup,
        fromBeginning: false // Only new messages
      }
    );

    this.logger.info('[PHASE-3] Agent subscribed to message bus for tasks', {
      taskChannel,
      consumerGroup
    });

    // Register agent with orchestrator (use publisher connection)
    await this.registerWithOrchestrator();

    this.logger.info('[PHASE-3] Agent initialized successfully with message bus');
  }

  async receiveTask(message: AgentMessage): Promise<void> {
    const traceId = message.trace_id;

    this.logger.info('Task received', {
      task_type: message.type,
      workflow_id: message.workflow_id,
      trace_id: traceId
    });

    try {
      // Validate task
      const task = this.validateTask(message.payload);

      // SESSION #37: Extract workflow stage from envelope format
      // Session #36 envelope is nested in message.payload.context
      // Agent dispatcher wraps envelope: { payload: { context: envelope } }
      const envelope = (message.payload as any).context as any;
      const workflowStage = envelope?.workflow_context?.current_stage as string | undefined;

      this.logger.info('[SESSION #37 DEBUG] Stage extraction', {
        has_envelope: !!envelope,
        has_workflow_context: !!envelope?.workflow_context,
        workflow_stage: workflowStage,
        payload_keys: Object.keys(message.payload || {}).join(','),
        envelope_keys: envelope ? Object.keys(envelope).join(',') : 'none'
      });

      // Execute task with retry (using new retry utility)
      const result = await retry(
        () => this.execute(task),
        {
          ...RetryPresets.standard,
          onRetry: (error, attempt, delayMs) => {
            this.logger.warn('Task execution failed, retrying', {
              attempt,
              delayMs,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      );

      // Report result with workflow stage
      await this.reportResult(result, workflowStage);

      this.tasksProcessed++;
      this.lastTaskAt = new Date().toISOString();

    } catch (error) {
      this.errorsCount++;

      // SESSION #37: Extract workflow stage from envelope format for error reporting
      const envelope = (message.payload as any).context as any;
      const workflowStage = envelope?.workflow_context?.current_stage as string | undefined;

      const errorResult: TaskResult = {
        task_id: message.payload.task_id as string || randomUUID(),
        workflow_id: message.workflow_id,
        status: 'failure',
        output: {},
        errors: [error instanceof Error ? error.message : String(error)]
      };

      await this.reportResult(errorResult, workflowStage);

      this.logger.error('Task execution failed', {
        error,
        workflow_id: message.workflow_id,
        trace_id: traceId
      });
    }
  }

  validateTask(task: unknown): TaskAssignment {
    try {
      return TaskAssignmentSchema.parse(task);
    } catch (error) {
      throw new ValidationError(
        'Invalid task assignment',
        error instanceof Error ? [error.message] : ['Unknown validation error']
      );
    }
  }

  abstract execute(task: TaskAssignment): Promise<TaskResult>;

  async reportResult(result: TaskResult, workflowStage?: string): Promise<void> {
    // Validate result against local schema first
    const validatedResult = TaskResultSchema.parse(result);

    // Use workflow stage if provided, otherwise fall back to agent type
    // SESSION #27 FIX: Send workflow stage (e.g., "initialization") not agent type (e.g., "scaffold")
    const stage = workflowStage || this.capabilities.type;

    // Convert status enum from TaskResult to AgentResultSchema
    // TaskResult: 'success'|'failure'|'partial'
    // AgentResultSchema: 'success'|'failed'|'timeout'|'cancelled'|...
    let agentStatus: 'success' | 'failed' | 'timeout' | 'cancelled' | 'running' | 'pending' | 'queued' | 'retrying';
    let success: boolean;

    if (validatedResult.status === 'success') {
      agentStatus = 'success';
      success = true;
    } else if (validatedResult.status === 'failure') {
      agentStatus = 'failed';
      success = false;
    } else { // 'partial'
      agentStatus = 'success'; // Treat partial as success for workflow progression
      success = true;
    }

    // Build AgentResultSchema-compliant envelope
    // CRITICAL: Wrap the actual payload in 'result' field, not top-level
    const agentResult = {
      task_id: validatedResult.task_id,
      workflow_id: validatedResult.workflow_id,
      agent_id: this.agentId,
      agent_type: this.capabilities.type as any, // e.g., 'scaffold', 'validation', etc.
      success: success,
      status: agentStatus,
      action: stage, // The action taken (stage name)
      // ✓ CRITICAL: Wrap payload in 'result' field for schema compliance
      result: {
        output: validatedResult.output,
        status: validatedResult.status, // Include original status in result
        ...(validatedResult.errors && { errors: validatedResult.errors }),
        ...(validatedResult.next_stage && { next_stage: validatedResult.next_stage })
      },
      metrics: {
        duration_ms: validatedResult.metrics?.duration_ms || 0,
        tokens_used: validatedResult.metrics?.tokens_used,
        api_calls: validatedResult.metrics?.api_calls
      },
      ...(validatedResult.errors && { error: {
        code: 'TASK_EXECUTION_ERROR',
        message: validatedResult.errors.join('; '),
        retryable: true
      }}),
      timestamp: new Date().toISOString(),
      version: VERSION
    };

    // Validate against AgentResultSchema before publishing
    // This is the critical validation boundary - ensures all emitted results are schema-compliant
    try {
      AgentResultSchema.parse(agentResult);
    } catch (validationError) {
      this.logger.error('AgentResultSchema validation failed - SCHEMA COMPLIANCE BREACH', {
        task_id: validatedResult.task_id,
        agent_id: this.agentId,
        validation_error: (validationError as any).message,
        attempted_result: JSON.stringify(agentResult).substring(0, 500)
      });
      throw new Error(`Agent result does not comply with AgentResultSchema: ${(validationError as any).message}`);
    }

    // Publish result to Redis using publisher client
    // SESSION #37: Use constants for Redis channels
    const resultChannel = REDIS_CHANNELS.ORCHESTRATOR_RESULTS;
    const message = {
      id: randomUUID(),
      type: 'result',
      agent_id: this.agentId,
      workflow_id: validatedResult.workflow_id,
      stage: stage,
      payload: agentResult, // ✓ Now contains AgentResult, not TaskResult
      timestamp: new Date().toISOString(),
      trace_id: randomUUID()
    } as AgentMessage;

    const messageJson = JSON.stringify(message);

    // Phase 3: Dual publishing for durability
    // 1. Publish to pub/sub channel (immediate delivery to subscribers)
    try {
      await this.redisPublisher.publish(resultChannel, messageJson);
      this.logger.info('[RESULT_DISPATCH] Successfully published result', {
        channel: resultChannel,
        workflow_id: validatedResult.workflow_id,
        task_id: validatedResult.task_id,
        agent_id: this.agentId
      });
    } catch (error) {
      this.logger.error('[RESULT_DISPATCH] Failed to publish result to channel', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        channel: resultChannel,
        workflow_id: validatedResult.workflow_id,
        task_id: validatedResult.task_id,
        agent_id: this.agentId
      });

      // Attempt to send to dead letter queue
      try {
        const dlqChannel = `dlq:${resultChannel}`;
        await this.redisPublisher.publish(dlqChannel, JSON.stringify({
          original_message: message,
          error: error instanceof Error ? error.message : String(error),
          failed_at: new Date().toISOString(),
          channel: resultChannel
        }));
        this.logger.warn('[RESULT_DISPATCH] Result sent to dead letter queue', {
          dlq: dlqChannel,
          workflow_id: validatedResult.workflow_id,
          task_id: validatedResult.task_id
        });
      } catch (dlqError) {
        this.logger.error('[RESULT_DISPATCH] Failed to send to dead letter queue', {
          error: dlqError instanceof Error ? dlqError.message : String(dlqError),
          workflow_id: validatedResult.workflow_id,
          task_id: validatedResult.task_id
        });
      }

      // Don't re-throw here - allow agent to continue processing other tasks
      // The workflow will timeout if result is not received
      return;
    }

    // 2. Mirror to Redis stream (durable, persistent, recoverable)
    const streamKey = `stream:${resultChannel}`;
    try {
      await this.redisPublisher.xadd(
        streamKey,
        '*', // auto-generate ID
        'message', messageJson,
        'workflow_id', validatedResult.workflow_id,
        'task_id', validatedResult.task_id,
        'agent_id', this.agentId,
        'timestamp', new Date().toISOString()
      );
      this.logger.info('[PHASE-3] Result mirrored to stream for durability', {
        stream: streamKey,
        workflow_id: validatedResult.workflow_id,
        task_id: validatedResult.task_id
      });
    } catch (streamError) {
      // Don't fail the task if stream mirroring fails
      this.logger.error('[PHASE-3] Failed to mirror result to stream', {
        error: streamError instanceof Error ? streamError.message : String(streamError),
        workflow_id: validatedResult.workflow_id,
        task_id: validatedResult.task_id
      });
    }

    this.logger.info('AgentResultSchema-compliant result reported', {
      task_id: validatedResult.task_id,
      status: agentStatus,
      success: success,
      workflow_stage: stage,
      agent_id: this.agentId,
      version: VERSION
    });
  }

  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up agent');

    // Deregister from orchestrator FIRST (while Redis is still connected)
    await this.deregisterFromOrchestrator();

    // Unsubscribe from channels
    await this.redisSubscriber.unsubscribe();

    // Remove all listeners to prevent leaks
    if (typeof this.redisSubscriber.removeAllListeners === 'function') {
      this.redisSubscriber.removeAllListeners();
    }
    if (typeof this.redisPublisher.removeAllListeners === 'function') {
      this.redisPublisher.removeAllListeners();
    }

    // Disconnect from Redis
    await this.redisSubscriber.quit();
    await this.redisPublisher.quit();

    this.logger.info('Agent cleanup completed');
  }

  async healthCheck(): Promise<HealthStatus> {
    const uptime = Date.now() - this.startTime;

    return {
      status: this.errorsCount > 10 ? 'unhealthy' :
              this.errorsCount > 5 ? 'degraded' : 'healthy',
      uptime_ms: uptime,
      tasks_processed: this.tasksProcessed,
      last_task_at: this.lastTaskAt,
      errors_count: this.errorsCount
    };
  }

  // Helper: Execute with retry logic (uses new retry utility)
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    return retry(operation, {
      maxAttempts: maxRetries,
      ...RetryPresets.standard,
      onRetry: (error, attempt, delayMs) => {
        this.logger.warn('Operation failed, retrying', {
          agent_id: this.agentId,
          attempt,
          maxRetries,
          delayMs,
          error: error instanceof Error ? error.message : String(error)
        });
      },
      onMaxRetriesReached: (error, attempts) => {
        this.logger.error('Operation failed after all retries', {
          agent_id: this.agentId,
          attempts,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
  }

  // Helper: Call Claude API (with circuit breaker protection)
  protected async callClaude(
    prompt: string,
    systemPrompt?: string,
    maxTokens: number = 4096
  ): Promise<string> {
    return this.claudeCircuitBreaker.execute(async () => {
      try {
        const response = await this.anthropic.messages.create({
          model: 'claude-3-haiku-20240307',
          max_tokens: maxTokens,
          temperature: 0.3,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        });

        // Extract text from response
        const textContent = response.content.find(c => c.type === 'text');
        if (!textContent || textContent.type !== 'text') {
          throw new AgentError('No text content in Claude response', 'API_ERROR');
        }

        return textContent.text;
      } catch (error) {
        if (error instanceof Anthropic.APIError) {
          throw new AgentError(
            `Claude API error: ${error.message}`,
            'ANTHROPIC_API_ERROR',
            { cause: error }
          );
        }
        throw error;
      }
    });
  }

  // Helper: Generate trace ID
  protected generateTraceId(): string {
    return `trace_${randomUUID()}`;
  }

  // Register agent with orchestrator
  private async registerWithOrchestrator(): Promise<void> {
    const registrationData = {
      agent_id: this.agentId,
      type: this.capabilities.type,
      version: this.capabilities.version,
      capabilities: this.capabilities.capabilities,
      registered_at: new Date().toISOString()
    };

    await this.redisPublisher.hset(
      'agents:registry',
      this.agentId,
      JSON.stringify(registrationData)
    );

    this.logger.info('Registered with orchestrator', { agent_id: this.agentId });
  }

  // Deregister agent from orchestrator
  private async deregisterFromOrchestrator(): Promise<void> {
    await this.redisPublisher.hdel('agents:registry', this.agentId);
    this.logger.info('Deregistered from orchestrator', { agent_id: this.agentId });
  }
}