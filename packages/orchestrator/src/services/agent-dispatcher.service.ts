import { createClient, type RedisClientType } from 'redis';
import { REDIS_CHANNELS } from '@agentic-sdlc/shared-types';
import { TaskAssignment } from '../types';
import { logger } from '../utils/logger';

/**
 * Agent Dispatcher Service
 * Handles bidirectional communication with agents via Redis
 * Session #42: Migrated from ioredis to node-redis v4
 */
export class AgentDispatcherService {
  private redisPublisher: any; // RedisClientType
  private redisSubscriber: any; // RedisClientType
  private resultHandlers: Map<string, (result: any) => void> = new Map();
  private handlerTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private readonly HANDLER_TIMEOUT_MS = 3600000; // 1 hour

  constructor(redisUrl: string) {
    logger.info('🚀 INITIALIZING AGENT DISPATCHER SERVICE (node-redis v4)', {
      redisUrl,
      timestamp: new Date().toISOString()
    });

    // Create clients (not connected yet)
    this.redisPublisher = createClient({ url: redisUrl });
    this.redisSubscriber = createClient({ url: redisUrl });

    logger.info('✅ REDIS CLIENTS CREATED', {
      publisherState: 'ready',
      subscriberState: 'ready',
      timestamp: new Date().toISOString()
    });

    // Setup event listeners and connect
    this.initializeClients();
  }

  /**
   * Initialize clients and setup listeners for node-redis v4
   */
  private async initializeClients(): Promise<void> {
    try {
      // Setup error handlers BEFORE connecting
      this.redisPublisher.on('error', (err: any) => {
        logger.error('❌ REDIS PUBLISHER ERROR', {
          errorMessage: err?.message || String(err),
          errorCode: err?.code,
          timestamp: new Date().toISOString()
        });
      });

      this.redisSubscriber.on('error', (err: any) => {
        logger.error('❌ REDIS SUBSCRIBER ERROR', {
          errorMessage: err?.message || String(err),
          errorCode: err?.code,
          timestamp: new Date().toISOString()
        });
      });

      // Connect publisher
      await this.redisPublisher.connect();
      logger.info('🔗 REDIS PUBLISHER CONNECTED', {
        timestamp: new Date().toISOString()
      });

      // Connect subscriber
      await this.redisSubscriber.connect();
      logger.info('🔗 REDIS SUBSCRIBER CONNECTED', {
        timestamp: new Date().toISOString()
      });

      // Setup result listener (after connection)
      await this.setupResultListener();

      logger.info('✅ RESULT LISTENER SET UP', {
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('❌ FAILED TO INITIALIZE CLIENTS', {
        error,
        timestamp: new Date().toISOString()
      });
      // Retry after delay
      setTimeout(() => this.initializeClients(), 5000);
    }
  }

  /**
   * Subscribe to agent results channel
   * Uses pSubscribe for pattern matching
   */
  private async setupResultListener(): Promise<void> {
    try {
      // SESSION #37: Use constants for Redis channels
      const channel = REDIS_CHANNELS.ORCHESTRATOR_RESULTS;

      logger.info('🔌 SETTING UP REDIS SUBSCRIPTION', {
        channel,
        subscriberState: 'connected'
      });

      // Subscribe and setup message handler
      // node-redis v4 callback signature: (message, channel)
      await this.redisSubscriber.subscribe(channel, (message: string) => {
        logger.info('📨 RAW MESSAGE RECEIVED FROM REDIS', {
          channel,
          messageLength: message.length,
          messagePreview: message.substring(0, 100),
          timestamp: new Date().toISOString()
        });

        logger.info('✅ MESSAGE IS FOR ORCHESTRATOR:RESULTS CHANNEL - PROCESSING', {
          channel,
          timestamp: new Date().toISOString()
        });
        this.handleAgentResult(message);
      });

      logger.info('✅ SUCCESSFULLY SUBSCRIBED TO CHANNEL', {
        channel,
        subscriberReady: true
      });
    } catch (error: any) {
      logger.error('❌ SUBSCRIPTION FAILED', {
        errorMessage: error?.message || String(error),
        errorCode: error?.code,
        timestamp: new Date().toISOString()
      });
      // Retry after delay
      setTimeout(() => this.setupResultListener(), 5000);
    }
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

      // Session #44 FIX: Agents use ioredis with subscribe/on('message') pattern
      // We need to use publish() with node-redis v4 which sends to all subscribers
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

      if (publishResult === 0) {
        logger.warn('⚠️  NO AGENTS RECEIVED TASK - Check if agents are subscribed', {
          channel: agentChannel,
          task_id: task.task_id,
          agent_type: task.agent_type
        });
      }

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
        ...JSON.parse(data as string)
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
    try {
      // Clear all handler timeouts
      for (const timeout of this.handlerTimeouts.values()) {
        clearTimeout(timeout);
      }
      this.handlerTimeouts.clear();
      this.resultHandlers.clear();

      // Disconnect Redis clients (node-redis v4 uses quit() for graceful shutdown)
      if (this.redisPublisher?.isReady) {
        await this.redisPublisher.quit();
      }
      if (this.redisSubscriber?.isReady) {
        await this.redisSubscriber.quit();
      }

      logger.info('Agent dispatcher disconnected');
    } catch (error) {
      logger.error('Error during disconnect', { error });
    }
  }
}
