import { randomUUID } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import pino from 'pino';
import Redis from 'ioredis';
import { retry, RetryPresets, CircuitBreaker } from '@agentic-sdlc/shared-utils';
import { REDIS_CHANNELS } from '@agentic-sdlc/shared-types';
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
  protected readonly agentId: string;
  protected readonly capabilities: AgentCapabilities;
  protected readonly claudeCircuitBreaker: CircuitBreaker;

  private startTime: number;
  private tasksProcessed: number = 0;
  private errorsCount: number = 0;
  private lastTaskAt?: string;

  constructor(capabilities: AgentCapabilities) {
    this.agentId = `${capabilities.type}-${randomUUID().slice(0, 8)}`;
    this.capabilities = capabilities;

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
    this.logger.info('Initializing agent', {
      type: this.capabilities.type,
      version: this.capabilities.version,
      capabilities: this.capabilities.capabilities
    });

    // Test Redis connections
    await this.redisPublisher.ping();

    // Set up message handler BEFORE subscribing
    this.redisSubscriber.on('message', async (_channel, message) => {
      try {
        const agentMessage: AgentMessage = JSON.parse(message);
        await this.receiveTask(agentMessage);
      } catch (error) {
        this.logger.error('Failed to process message', { error, message });
        this.errorsCount++;
      }
    });

    // Subscribe to task channel (this puts connection in subscriber mode)
    // SESSION #37: Use constants for Redis channels
    const taskChannel = REDIS_CHANNELS.AGENT_TASKS(this.capabilities.type);
    await this.redisSubscriber.subscribe(taskChannel);

    this.logger.info('Subscribed to task channel', { taskChannel });

    // Register agent with orchestrator (use publisher connection)
    await this.registerWithOrchestrator();

    this.logger.info('Agent initialized successfully');
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
    // Validate result
    const validatedResult = TaskResultSchema.parse(result);

    // Use workflow stage if provided, otherwise fall back to agent type
    // SESSION #27 FIX: Send workflow stage (e.g., "initialization") not agent type (e.g., "scaffold")
    const stage = workflowStage || this.capabilities.type;

    // Publish result to Redis using publisher client
    // SESSION #37: Use constants for Redis channels
    const resultChannel = REDIS_CHANNELS.ORCHESTRATOR_RESULTS;
    await this.redisPublisher.publish(
      resultChannel,
      JSON.stringify({
        id: randomUUID(),
        type: 'result',
        agent_id: this.agentId,
        workflow_id: validatedResult.workflow_id,
        stage: stage,
        payload: validatedResult,
        timestamp: new Date().toISOString(),
        trace_id: randomUUID()
      } as AgentMessage)
    );

    this.logger.info('Result reported', {
      task_id: validatedResult.task_id,
      status: validatedResult.status,
      workflow_stage: stage
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