import Redis from 'ioredis';
import { REDIS_CHANNELS } from '@agentic-sdlc/shared-types';
import { TaskAssignment } from '../types';
import { logger } from '../utils/logger';

/**
 * Agent Dispatcher Service
 * Handles bidirectional communication with agents via Redis
 */
export class AgentDispatcherService {
  private redisPublisher: Redis;
  private redisSubscriber: Redis;
  private resultHandlers: Map<string, (result: any) => void> = new Map();
  private handlerTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private readonly HANDLER_TIMEOUT_MS = 3600000; // 1 hour

  constructor(redisUrl: string) {
    logger.info('🚀 INITIALIZING AGENT DISPATCHER SERVICE', {
      redisUrl,
      timestamp: new Date().toISOString()
    });

    this.redisPublisher = new Redis(redisUrl);
    this.redisSubscriber = new Redis(redisUrl);

    logger.info('✅ REDIS CLIENTS CREATED', {
      publisherState: 'connecting',
      subscriberState: 'connecting',
      timestamp: new Date().toISOString()
    });

    // Setup event listeners once (don't repeat on reconnect)
    this.setupEventListeners();

    // Initial subscription attempt
    this.setupResultListener();

    logger.info('✅ RESULT LISTENER SET UP', {
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Setup event listeners for Redis subscriber (called once during init)
   */
  private setupEventListeners(): void {
    // Log connection status
    this.redisSubscriber.on('connect', () => {
      logger.info('🔗 REDIS SUBSCRIBER CONNECTED', {
        timestamp: new Date().toISOString()
      });
    });

    // Log any subscription/connection errors
    this.redisSubscriber.on('error', (err) => {
      logger.error('❌ REDIS SUBSCRIBER ERROR', {
        errorMessage: (err as any)?.message || String(err),
        errorCode: (err as any)?.code,
        fullError: String(err),
        timestamp: new Date().toISOString()
      });
    });

    // Log subscription confirmation
    this.redisSubscriber.on('subscribe', (channel, count) => {
      logger.info('📡 REDIS SUBSCRIPTION CONFIRMED', {
        channel,
        subscriptionCount: count,
        timestamp: new Date().toISOString()
      });
    });

    // Main message handler
    this.redisSubscriber.on('message', (channel, message) => {
      logger.info('📨 RAW MESSAGE RECEIVED FROM REDIS', {
        channel,
        messageLength: message.length,
        messagePreview: message.substring(0, 100),
        timestamp: new Date().toISOString()
      });

      // SESSION #37: Use constants for Redis channels
      if (channel === REDIS_CHANNELS.ORCHESTRATOR_RESULTS) {
        logger.info('✅ MESSAGE IS FOR ORCHESTRATOR:RESULTS CHANNEL - PROCESSING', {
          channel,
          timestamp: new Date().toISOString()
        });
        this.handleAgentResult(message);
      } else {
        logger.warn('⚠️ MESSAGE RECEIVED ON UNEXPECTED CHANNEL', {
          expectedChannel: REDIS_CHANNELS.ORCHESTRATOR_RESULTS,
          actualChannel: channel
        });
      }
    });
  }

  /**
   * Subscribe to agent results channel with reconnection logic
   */
  private setupResultListener(): void {
    // SESSION #37: Use constants for Redis channels
    const channel = REDIS_CHANNELS.ORCHESTRATOR_RESULTS;

    logger.info('🔌 SETTING UP REDIS SUBSCRIPTION', {
      channel,
      subscriberState: 'connecting'
    });

    // Attempt subscription (use promise-based API)
    this.redisSubscriber.subscribe(channel).then(
      () => {
        logger.info('✅ SUCCESSFULLY SUBSCRIBED TO CHANNEL', {
          channel,
          subscriberReady: true
        });
      },
      (err: any) => {
        logger.error('❌ SUBSCRIPTION FAILED', {
          channel,
          errorMessage: err?.message || String(err),
          errorCode: err?.code,
          errno: err?.errno,
          syscall: err?.syscall,
          address: err?.address,
          port: err?.port,
          fullError: String(err),
          timestamp: new Date().toISOString()
        });
        // Retry after delay
        setTimeout(() => this.setupResultListener(), 5000);
      }
    );
  }

  /**
   * Handle result from agent
   */
  private async handleAgentResult(message: string): Promise<void> {
    logger.info('🔍 PARSING AGENT RESULT MESSAGE', {
      messageLength: message.length,
      messageType: typeof message,
      timestamp: new Date().toISOString()
    });

    try {
      let result: any;
      try {
        result = JSON.parse(message);
        logger.info('✅ SUCCESSFULLY PARSED JSON MESSAGE', {
          keys: Object.keys(result),
          hasWorkflowId: !!result.workflow_id,
          hasPayload: !!result.payload,
          timestamp: new Date().toISOString()
        });
      } catch (parseErr) {
        logger.error('❌ FAILED TO PARSE JSON', {
          parseError: (parseErr as Error).message,
          message: message.substring(0, 200),
          timestamp: new Date().toISOString()
        });
        throw parseErr;
      }

      logger.info('🔔 RECEIVED AGENT RESULT MESSAGE', {
        agent_id: result.agent_id,
        workflow_id: result.workflow_id,
        status: result.payload?.status,
        registered_handlers: Array.from(this.resultHandlers.keys()),
        timestamp: new Date().toISOString()
      });

      // Call registered result handler if exists
      const handler = this.resultHandlers.get(result.workflow_id);
      if (handler) {
        logger.info('✅ HANDLER FOUND - Executing callback', {
          workflow_id: result.workflow_id,
          taskStatus: result.payload?.status
        });
        await handler(result);
        // NOTE: Handler cleanup is now responsibility of workflow service
        // (only remove when workflow reaches terminal state, not per-stage)
      } else {
        logger.warn('❌ NO HANDLER FOUND FOR WORKFLOW', {
          workflow_id: result.workflow_id,
          available_handlers: Array.from(this.resultHandlers.keys())
        });
      }

    } catch (error) {
      logger.error('Failed to process agent result', { error, message });
    }
  }

  /**
   * Dispatch task to agent via Redis channel
   */
  async dispatchTask(task: any, workflowData?: any): Promise<void> {
    try {
      // SESSION #36: Handle both envelope and TaskAssignment formats
      const agentType = task.agent_type;
      // SESSION #37: Use constants for Redis channels
      const agentChannel = REDIS_CHANNELS.AGENT_TASKS(agentType);

      // SESSION #36: For envelopes, send as AgentMessage with envelope in context
      const agentMessage = {
        id: task.trace_id || task.message_id || `msg-${Date.now()}`,
        type: 'task',
        agent_id: '', // Will be filled by agent
        workflow_id: task.workflow_id,
        stage: task.workflow_context?.current_stage || 'unknown',
        payload: {
          task_id: task.task_id,
          workflow_id: task.workflow_id,
          type: agentType,
          name: workflowData?.name || task.workflow_context?.workflow_name || 'Unknown',
          description: workflowData?.description || '',
          requirements: workflowData?.requirements || '',
          priority: task.priority || 'medium',
          context: task // SESSION #36: Pass entire envelope as context
        },
        timestamp: task.created_at || new Date().toISOString(),
        trace_id: task.trace_id || `trace-${Date.now()}`
      };

      // Publish to agent channel
      logger.info('📤 PUBLISHING TASK TO AGENT CHANNEL', {
        channel: agentChannel,
        workflow_id: task.workflow_id,
        task_id: task.task_id,
        messageSize: JSON.stringify(agentMessage).length,
        timestamp: new Date().toISOString()
      });

      const publishResult = await this.redisPublisher.publish(agentChannel, JSON.stringify(agentMessage));

      logger.info('✅ TASK PUBLISHED TO REDIS', {
        channel: agentChannel,
        subscribersReceived: publishResult,
        task_id: task.task_id,
        workflow_id: task.workflow_id,
        agent_type: task.agent_type,
        timestamp: new Date().toISOString()
      });

      logger.info('Task dispatched to agent', {
        task_id: task.task_id,
        workflow_id: task.workflow_id,
        agent_type: task.agent_type,
        channel: agentChannel
      });

    } catch (error) {
      logger.error('Failed to dispatch task to agent', {
        error,
        task_id: task.task_id,
        agent_type: task.agent_type
      });
      throw error;
    }
  }

  /**
   * Register handler for workflow results
   * Handlers are automatically cleaned up after 1 hour
   */
  onResult(workflowId: string, handler: (result: any) => void): void {
    logger.info('📝 REGISTERING RESULT HANDLER', {
      workflow_id: workflowId,
      total_handlers_after: (this.resultHandlers.size + 1)
    });
    this.resultHandlers.set(workflowId, handler);

    // Clear any existing timeout
    const existingTimeout = this.handlerTimeouts.get(workflowId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set auto-cleanup timeout
    const timeout = setTimeout(() => {
      logger.warn('Auto-removing expired result handler', { workflow_id: workflowId });
      this.offResult(workflowId);
    }, this.HANDLER_TIMEOUT_MS);

    this.handlerTimeouts.set(workflowId, timeout);
  }

  /**
   * Unregister result handler
   */
  offResult(workflowId: string): void {
    this.resultHandlers.delete(workflowId);

    // Clear the timeout
    const timeout = this.handlerTimeouts.get(workflowId);
    if (timeout) {
      clearTimeout(timeout);
      this.handlerTimeouts.delete(workflowId);
    }
  }

  /**
   * Get list of registered agents from Redis
   */
  async getRegisteredAgents(): Promise<any[]> {
    try {
      const agents = await this.redisPublisher.hgetall('agents:registry');
      return Object.entries(agents).map(([id, data]) => ({
        agent_id: id,
        ...JSON.parse(data)
      }));
    } catch (error) {
      logger.error('Failed to get registered agents', { error });
      return [];
    }
  }

  /**
   * Cleanup
   */
  async disconnect(): Promise<void> {
    // Clear all handler timeouts
    for (const timeout of this.handlerTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.handlerTimeouts.clear();
    this.resultHandlers.clear();

    // Disconnect Redis clients
    await this.redisPublisher.quit();
    await this.redisSubscriber.quit();

    logger.info('Agent dispatcher disconnected');
  }
}
