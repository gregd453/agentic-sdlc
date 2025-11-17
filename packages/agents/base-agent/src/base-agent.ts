import { randomUUID } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import pino from 'pino';
import Redis from 'ioredis';
import { retry, RetryPresets, CircuitBreaker } from '@agentic-sdlc/shared-utils';
import { REDIS_CHANNELS } from '@agentic-sdlc/shared-types';
import { AgentResultSchema, VERSION } from '@agentic-sdlc/shared-types';
// Phase 3: Import IMessageBus from orchestrator and trace utilities
import type { IMessageBus } from '@agentic-sdlc/orchestrator';
import { extractTraceContext, type TraceContext } from '@agentic-sdlc/shared-utils';
// Phase 2.1: Import dependency injection services
import {
  LoggerConfigService,
  getLoggerConfigService,
  createConfigurableLogger,
  type ConfigurableLoggerOptions
} from '@agentic-sdlc/logger-config';
import {
  ConfigurationManager,
  getConfigurationManager
} from '@agentic-sdlc/config-manager';
import {
  ServiceLocator,
  getServiceLocator
} from '@agentic-sdlc/service-locator';
import {
  AgentLifecycle,
  AgentCapabilities,
  AgentEnvelope,
  TaskResult,
  AgentMessage,
  HealthStatus,
  AgentEnvelopeSchema,
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
  protected readonly platformId?: string; // Phase 4: Optional platform scoping

  // Phase 2.1: Dependency injection services
  protected readonly loggerConfigService: LoggerConfigService;
  protected readonly configurationManager: ConfigurationManager;
  protected readonly serviceLocator: ServiceLocator;

  private startTime: number;
  private tasksProcessed: number = 0;
  private errorsCount: number = 0;
  private lastTaskAt?: string;

  // Phase 3: Current trace context for active task
  protected currentTraceContext?: TraceContext;

  constructor(
    capabilities: AgentCapabilities,
    messageBus: IMessageBus,  // Phase 3: Inject message bus via DI
    // Phase 2.1: DI parameters with defaults to singleton services
    loggerConfigService?: LoggerConfigService,
    configurationManager?: ConfigurationManager,
    serviceLocator?: ServiceLocator,
    platformId?: string // Phase 4: Optional platform context
  ) {
    this.agentId = `${capabilities.type}-${randomUUID().slice(0, 8)}`;
    this.capabilities = capabilities;
    this.messageBus = messageBus;
    this.platformId = platformId; // Phase 4: Store platform context

    // Phase 3: Validate messageBus
    if (!messageBus) {
      throw new AgentError('messageBus is required for Phase 3 message bus integration', 'CONFIG_ERROR');
    }

    // Phase 2.1: Initialize DI services with defaults to singletons
    this.loggerConfigService = loggerConfigService || getLoggerConfigService();
    this.configurationManager = configurationManager || getConfigurationManager();
    this.serviceLocator = serviceLocator || getServiceLocator();

    // Phase 2.1: Create configurable logger using LoggerConfigService
    // Get module-level configuration for this agent type
    const agentLogLevel = this.loggerConfigService.getModuleLevel(capabilities.type);

    // Create logger with trace context support
    const loggerOptions: ConfigurableLoggerOptions = {
      name: this.agentId,
      level: agentLogLevel,
      moduleLevel: capabilities.type,
      prettyPrint: true
    };

    this.logger = createConfigurableLogger(loggerOptions);

    // Initialize Anthropic client
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new AgentError('ANTHROPIC_API_KEY not configured', 'CONFIG_ERROR');
    }

    this.anthropic = new Anthropic({
      apiKey
    });

    // Initialize Redis clients (separate for pub/sub pattern)
    // Validate REDIS_HOST and REDIS_PORT are set (required, no defaults)
    const redisHost = process.env.REDIS_HOST;
    const redisPortEnv = process.env.REDIS_PORT;

    if (!redisHost) {
      throw new AgentError(
        'REDIS_HOST environment variable is not set. Required for Redis connection. ' +
        'Set REDIS_HOST in your environment or .env file (e.g., REDIS_HOST=localhost)',
        'CONFIG_ERROR'
      );
    }

    if (!redisPortEnv) {
      throw new AgentError(
        'REDIS_PORT environment variable is not set. Required for Redis connection. ' +
        'Set REDIS_PORT in your environment or .env file (e.g., REDIS_PORT=6380)',
        'CONFIG_ERROR'
      );
    }

    const redisPort = parseInt(redisPortEnv, 10);
    if (isNaN(redisPort) || redisPort < 1 || redisPort > 65535) {
      throw new AgentError(
        `REDIS_PORT must be a valid port number (1-65535), got: ${redisPortEnv}`,
        'CONFIG_ERROR'
      );
    }

    const redisConfig = {
      host: redisHost,
      port: redisPort,
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
    this.logger.info('[PHASE-4] Initializing agent with message bus', {
      type: this.capabilities.type,
      version: this.capabilities.version,
      capabilities: this.capabilities.capabilities,
      messageBus_available: !!this.messageBus,
      platformId: this.platformId || 'global' // Phase 4: Include platform context
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
          // 🔍 Step 1: Log raw message receipt
          this.logger.debug('🔍 [MSG-UNWRAP] Raw message received from message bus', {
            message_type: typeof message,
            is_string: typeof message === 'string',
            is_object: typeof message === 'object',
            is_null: message === null,
            channel: taskChannel,
            agent_type: this.capabilities.type
          });

          // Message may be string or object depending on adapter
          const envelope = typeof message === 'string'
            ? JSON.parse(message)
            : message;

          // 🔍 Step 2: Log parsed envelope structure
          this.logger.debug('🔍 [MSG-UNWRAP] Envelope parsed', {
            workflow_id: envelope.workflow_id,
            task_id: envelope.task_id,
            agent_type: envelope.agent_type,
            has_trace: !!envelope.trace,
            has_metadata: !!envelope.metadata,
            has_workflow_context: !!envelope.workflow_context,
            has_payload: !!envelope.payload,
            envelope_keys: Object.keys(envelope).join(',')
          });

          this.logger.info('[PHASE-4] Agent received task from message bus', {
            workflow_id: envelope.workflow_id,
            task_id: envelope.task_id,
            agent_type: envelope.agent_type,
            channel: taskChannel,
            trace_id: envelope.trace?.trace_id,
            span_id: envelope.trace?.span_id,
            platformId: this.platformId || 'global' // Phase 4: Include platform context
          });

          // 🔍 AGENT TRACE: Task received
          this.logger.info('🔍 [AGENT-TRACE] Task received', {
            workflow_id: envelope.workflow_id,
            task_id: envelope.task_id,
            stage: envelope.workflow_context?.current_stage,
            trace_id: envelope.trace?.trace_id
          });

          // 🔍 Step 3: Log AgentMessage wrapping
          this.logger.debug('🔍 [MSG-UNWRAP] Wrapping envelope in AgentMessage format', {
            envelope_stored_in: 'payload.context',
            inner_payload_keys: Object.keys(envelope.payload || {}).join(','),
            workflow_stage: envelope.workflow_context?.current_stage
          });

          // Convert envelope to AgentMessage format expected by receiveTask
          const agentMessage: AgentMessage = {
            id: envelope.task_id,
            workflow_id: envelope.workflow_id,
            agent_id: this.agentId,
            type: 'task',
            stage: envelope.workflow_context?.current_stage || 'unknown',
            timestamp: envelope.created_at || new Date().toISOString(),
            trace_id: envelope.trace_id,
            payload: {
              ...envelope.payload,
              task_id: envelope.task_id,
              context: envelope // Store the full envelope in context for backward compatibility
            }
          };

          // 🔍 Step 4: Log final message structure before receiveTask
          this.logger.debug('🔍 [MSG-UNWRAP] AgentMessage ready for receiveTask', {
            message_id: agentMessage.id,
            workflow_id: agentMessage.workflow_id,
            payload_has_context: !!agentMessage.payload.context,
            payload_keys: Object.keys(agentMessage.payload).join(',')
          });

          await this.receiveTask(agentMessage);
        } catch (error) {
          this.logger.error('[PHASE-3] Failed to process task from message bus', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            message_type: typeof message,
            message_sample: typeof message === 'object'
              ? JSON.stringify(message).substring(0, 500)
              : String(message).substring(0, 500),
            agent_type: this.capabilities.type,
            channel: taskChannel
          });
          this.errorsCount++;
        }
      },
      {
        consumerGroup,
        fromBeginning: false // Only new messages
      }
    );

    console.log('[DEBUG-AGENT-INIT] Subscription completed, handler registered', {
      taskChannel,
      consumerGroup,
      agent_type: this.capabilities.type,
      platformId: this.platformId || 'global'
    });

    this.logger.info('[PHASE-4] Agent subscribed to message bus for tasks', {
      taskChannel,
      consumerGroup,
      platformId: this.platformId || 'global'
    });

    // Register agent with orchestrator (use publisher connection)
    await this.registerWithOrchestrator();

    this.logger.info('[PHASE-4] Agent initialized successfully with message bus', {
      platformId: this.platformId || 'global'
    });
  }

  async receiveTask(message: AgentMessage): Promise<void> {
    const traceId = message.trace_id;

    // Phase 3: Extract and store trace context from envelope
    const envelope = (message.payload as any).context as any;
    this.currentTraceContext = extractTraceContext(envelope);

    this.logger.info('🔍 [AGENT-TRACE] Task received', {
      task_type: message.type,
      workflow_id: message.workflow_id,
      message_id: message.id,
      stage: message.stage,
      trace_id: this.currentTraceContext?.trace_id || traceId,
      span_id: this.currentTraceContext?.span_id,
      parent_span_id: this.currentTraceContext?.parent_span_id
    });

    try {
      // Validate task - the full envelope is stored in message.payload.context (set by subscription handler)
      const task = this.validateTask((message.payload as any).context);

      // Extract workflow stage from envelope format
      // The envelope is now stored in message.payload.context (set by the subscription handler)
      const workflowStage = envelope?.workflow_context?.current_stage as string | undefined;

      this.logger.info('[SESSION #37 DEBUG] Stage extraction', {
        has_envelope: !!envelope,
        has_workflow_context: !!envelope?.workflow_context,
        workflow_stage: workflowStage,
        payload_keys: Object.keys(message.payload || {}).join(','),
        envelope_keys: envelope ? Object.keys(envelope).join(',') : 'none',
        trace_context: this.currentTraceContext
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

      // Only report error result if we haven't already reported a successful result
      // This prevents duplicate reportResult calls that cause CAS failures
      try {
        const errorResult: TaskResult = {
          message_id: randomUUID(),
          task_id: message.payload.task_id as string || randomUUID(),
          workflow_id: message.workflow_id,
          agent_id: this.agentId,
          status: 'failure',
          result: {
            data: {},
            metrics: {
              duration_ms: 0
            }
          },
          errors: [{
            code: 'TASK_EXECUTION_ERROR',
            message: error instanceof Error ? error.message : String(error),
            recoverable: true
          }],
          metadata: {
            completed_at: new Date().toISOString(),
            trace_id: this.currentTraceContext?.trace_id || randomUUID()
          }
        };

        await this.reportResult(errorResult, workflowStage);
      } catch (reportError) {
        this.logger.error('Failed to report error result', {
          originalError: error instanceof Error ? error.message : String(error),
          reportError: reportError instanceof Error ? reportError.message : String(reportError),
          workflow_id: message.workflow_id
        });
      }

      this.logger.error('Task execution failed', {
        error,
        workflow_id: message.workflow_id,
        trace_id: traceId
      });
    }
  }

  validateTask(task: unknown): AgentEnvelope {
    try {
      const envelope = AgentEnvelopeSchema.parse(task);
      this.logger.info('✅ [VALIDATION] Task validated against AgentEnvelopeSchema v2.0.0', {
        message_id: envelope.message_id,
        task_id: envelope.task_id,
        workflow_id: envelope.workflow_id,
        agent_type: envelope.agent_type,
        envelope_version: envelope.metadata.envelope_version,
        trace_id: envelope.trace.trace_id,
        span_id: envelope.trace.span_id,
        parent_span_id: envelope.trace.parent_span_id
      });
      return envelope;
    } catch (error) {
      // Extract detailed Zod validation errors if available
      const zodErrors = (error as any)?.errors || [];
      const firstError = zodErrors[0] || {};

      // Structured error context
      const taskKeys = typeof task === 'object' && task !== null ? Object.keys(task as any) : [];
      const taskSample = typeof task === 'object' ? JSON.stringify(task).substring(0, 1000) : String(task);
      const taskType = typeof task;
      const isNull = task === null;
      const isUndefined = task === undefined;

      // Extract trace context if present for error correlation
      const possibleTrace = (task as any)?.trace;
      const possibleWorkflowId = (task as any)?.workflow_id;
      const possibleTaskId = (task as any)?.task_id;

      this.logger.error('❌ [VALIDATION] Task validation failed - NOT AgentEnvelope v2.0.0', {
        agent_type: this.capabilities.type,
        validation_error: error instanceof Error ? error.message : String(error),
        zod_error_count: zodErrors.length,
        first_zod_error: {
          path: firstError.path?.join('.') || 'unknown',
          code: firstError.code || 'unknown',
          expected: firstError.expected || 'unknown',
          received: firstError.received || 'unknown',
          message: firstError.message || 'unknown'
        },
        task_metadata: {
          type: taskType,
          is_null: isNull,
          is_undefined: isUndefined,
          keys_found: taskKeys.join(',') || 'none',
          key_count: taskKeys.length
        },
        // Include trace context if available for error correlation
        trace_context: possibleTrace ? {
          trace_id: possibleTrace.trace_id,
          span_id: possibleTrace.span_id,
          parent_span_id: possibleTrace.parent_span_id
        } : 'not_found',
        workflow_id: possibleWorkflowId || 'not_found',
        task_id: possibleTaskId || 'not_found',
        task_sample: taskSample
      });

      // Log all Zod errors for debugging
      if (zodErrors.length > 0) {
        this.logger.debug('🔍 [VALIDATION] All Zod validation errors', {
          error_count: zodErrors.length,
          errors: zodErrors.map((e: any) => ({
            path: e.path?.join('.'),
            code: e.code,
            expected: e.expected,
            received: e.received,
            message: e.message
          }))
        });
      }

      throw new ValidationError(
        'Invalid task assignment - must conform to AgentEnvelope v2.0.0',
        error instanceof Error ? [error.message] : ['Unknown validation error']
      );
    }
  }

  abstract execute(task: AgentEnvelope): Promise<TaskResult>;

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

    // SESSION #64: Build result using canonical AgentResultSchema
    // Required fields: task_id, workflow_id, agent_id, agent_type, success, status, action, result, metrics, timestamp, version
    // Optional fields: artifacts, error (singular), warnings
    const agentResult = {
      task_id: validatedResult.task_id,
      workflow_id: validatedResult.workflow_id,
      agent_id: this.agentId,
      agent_type: this.capabilities.type, // REQUIRED: Agent type enum value
      success: success, // REQUIRED: Boolean computed from status
      status: agentStatus, // REQUIRED: Use mapped status ('failed' not 'failure')
      action: `execute_${this.capabilities.type}`, // REQUIRED: Action description
      result: validatedResult.result, // REQUIRED: Task output data
      metrics: validatedResult.result?.metrics || { // REQUIRED: Execution metrics
        duration_ms: 0
      },
      // Optional: Convert errors array to singular error object
      error: validatedResult.errors && validatedResult.errors.length > 0 ? {
        code: validatedResult.errors[0].code,
        message: validatedResult.errors[0].message,
        retryable: validatedResult.errors[0].recoverable || false
      } : undefined,
      timestamp: new Date().toISOString(),
      version: VERSION
    };

    // 🔍 DEBUG POINT 1: Log agentResult structure BEFORE validation
    console.log('[DEBUG-RESULT] Built agentResult object (BEFORE validation)', {
      keys: Object.keys(agentResult).join(','),
      task_id: agentResult.task_id,
      workflow_id: agentResult.workflow_id,
      agent_id: agentResult.agent_id,
      agent_type: agentResult.agent_type,
      success: agentResult.success,
      status: agentResult.status,
      action: agentResult.action,
      has_result: !!agentResult.result,
      result_keys: agentResult.result ? Object.keys(agentResult.result).join(',') : 'none',
      has_metrics: !!agentResult.metrics,
      has_error: !!agentResult.error,
      timestamp: agentResult.timestamp,
      version: agentResult.version,
      full_object_sample: JSON.stringify(agentResult).substring(0, 500)
    });

    // Validate against AgentResultSchema before publishing
    // This is the critical validation boundary - ensures all emitted results are schema-compliant

    // 🔍 DEBUG POINT 2: Log what AgentResultSchema EXPECTS
    console.log('[DEBUG-RESULT] AgentResultSchema REQUIRED fields:', {
      required_fields: 'task_id, workflow_id, agent_id, agent_type, success, status, action, result, metrics, timestamp, version',
      optional_fields: 'artifacts, error, warnings',
      what_we_have: Object.keys(agentResult).join(','),
      missing_required: ['agent_type', 'success', 'action', 'metrics'].filter(f => !(f in agentResult)).join(',') || 'none'
    });

    try {
      AgentResultSchema.parse(agentResult);
      console.log('[DEBUG-RESULT] ✅ Validation PASSED');
      this.logger.debug('✅ [RESULT-VALIDATION] Result validated against AgentResultSchema', {
        task_id: validatedResult.task_id,
        workflow_id: validatedResult.workflow_id,
        agent_id: this.agentId,
        status: validatedResult.status,
        has_errors: validatedResult.errors && validatedResult.errors.length > 0,
        trace_id: this.currentTraceContext?.trace_id
      });
    } catch (validationError) {
      console.log('[DEBUG-RESULT] ❌ Validation FAILED - Zod error details:', {
        error_message: (validationError as any).message,
        error_count: (validationError as any)?.errors?.length || 0,
        all_errors: (validationError as any)?.errors || []
      });
      // Extract detailed Zod validation errors
      const zodErrors = (validationError as any)?.errors || [];
      const firstError = zodErrors[0] || {};

      this.logger.error('❌ [RESULT-VALIDATION] AgentResultSchema validation failed - SCHEMA COMPLIANCE BREACH', {
        task_id: validatedResult.task_id,
        workflow_id: validatedResult.workflow_id,
        agent_id: this.agentId,
        agent_type: this.capabilities.type,
        validation_error: (validationError as any).message,
        zod_error_count: zodErrors.length,
        first_zod_error: {
          path: firstError.path?.join('.') || 'unknown',
          code: firstError.code || 'unknown',
          expected: firstError.expected || 'unknown',
          received: firstError.received || 'unknown',
          message: firstError.message || 'unknown'
        },
        result_structure: {
          has_task_id: !!agentResult.task_id,
          has_workflow_id: !!agentResult.workflow_id,
          has_agent_id: !!agentResult.agent_id,
          has_agent_type: !!agentResult.agent_type,
          has_success: agentResult.success !== undefined,
          has_status: !!agentResult.status,
          has_action: !!agentResult.action,
          has_result: !!agentResult.result,
          has_metrics: !!agentResult.metrics,
          has_error: !!agentResult.error,
          result_keys: Object.keys(agentResult).join(',')
        },
        trace_context: {
          trace_id: this.currentTraceContext?.trace_id || 'unknown',
          span_id: this.currentTraceContext?.span_id || 'unknown',
          parent_span_id: this.currentTraceContext?.parent_span_id || 'unknown'
        },
        attempted_result_sample: JSON.stringify(agentResult).substring(0, 1000)
      });

      // Log all Zod errors for debugging
      if (zodErrors.length > 0) {
        this.logger.debug('🔍 [RESULT-VALIDATION] All Zod validation errors', {
          error_count: zodErrors.length,
          errors: zodErrors.map((e: any) => ({
            path: e.path?.join('.'),
            code: e.code,
            expected: e.expected,
            received: e.received,
            message: e.message
          }))
        });
      }

      throw new Error(`Agent result does not comply with AgentResultSchema: ${(validationError as any).message}`);
    }

    // Phase 3: Publish result via IMessageBus (symmetric architecture)
    const resultChannel = REDIS_CHANNELS.ORCHESTRATOR_RESULTS;

    this.logger.info('🔍 [AGENT-TRACE] Publishing result via IMessageBus', {
      channel: resultChannel,
      workflow_id: validatedResult.workflow_id,
      task_id: validatedResult.task_id,
      agent_id: this.agentId,
      stage: stage,
      trace_id: this.currentTraceContext?.trace_id,
      span_id: this.currentTraceContext?.span_id
    });

    try {
      // Publish via message bus - adapter handles pub/sub, stream mirroring, and DLQ
      // Wrap the AgentResult with stage metadata for orchestrator routing
      const resultWithMetadata = {
        ...agentResult,
        stage  // Add stage field for orchestrator to determine which stage completed
      };

      await this.messageBus.publish(
        resultChannel,
        resultWithMetadata,  // AgentResult + stage metadata
        {
          key: validatedResult.workflow_id,
          mirrorToStream: `stream:${resultChannel}`
        }
      );

      this.logger.info('[PHASE-3] Result published successfully via IMessageBus', {
        task_id: validatedResult.task_id,
        workflow_id: validatedResult.workflow_id,
        status: agentStatus,
        success: success,
        workflow_stage: stage,
        agent_id: this.agentId,
        version: VERSION
      });

      // 🔍 AGENT TRACE: Publishing result
      this.logger.info('🔍 [AGENT-TRACE] Publishing result', {
        workflow_id: validatedResult.workflow_id,
        stage: stage,
        status: agentStatus,
        channel: resultChannel
      });
    } catch (error) {
      this.logger.error('[PHASE-3] Failed to publish result via IMessageBus', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        workflow_id: validatedResult.workflow_id,
        task_id: validatedResult.task_id,
        agent_id: this.agentId
      });

      // Don't re-throw - allow agent to continue processing other tasks
      // The workflow will timeout if result is not received
      return;
    }
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
          model: 'claude-haiku-4-5-20251001',
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