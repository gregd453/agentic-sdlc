import Redis from 'ioredis';
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
    this.redisPublisher = new Redis(redisUrl);
    this.redisSubscriber = new Redis(redisUrl);
    this.setupResultListener();
  }

  /**
   * Subscribe to agent results channel
   */
  private setupResultListener(): void {
    this.redisSubscriber.subscribe('orchestrator:results', (err) => {
      if (err) {
        logger.error('Failed to subscribe to orchestrator:results', { error: err });
        return;
      }
      logger.info('Subscribed to orchestrator:results channel');
    });

    this.redisSubscriber.on('message', (channel, message) => {
      if (channel === 'orchestrator:results') {
        this.handleAgentResult(message);
      }
    });
  }

  /**
   * Handle result from agent
   */
  private async handleAgentResult(message: string): Promise<void> {
    try {
      const result = JSON.parse(message);

      logger.info('Received agent result', {
        agent_id: result.agent_id,
        workflow_id: result.workflow_id,
        status: result.payload?.status
      });

      // Call registered result handler if exists
      const handler = this.resultHandlers.get(result.workflow_id);
      if (handler) {
        await handler(result);

        // Auto-cleanup handler after result is processed
        // (workflow is complete or failed)
        const status = result.payload?.status;
        if (status === 'success' || status === 'failure') {
          logger.info('Auto-removing result handler for completed workflow', {
            workflow_id: result.workflow_id
          });
          this.offResult(result.workflow_id);
        }
      }

    } catch (error) {
      logger.error('Failed to process agent result', { error, message });
    }
  }

  /**
   * Dispatch task to agent via Redis channel
   */
  async dispatchTask(task: TaskAssignment, workflowData?: any): Promise<void> {
    try {
      const agentChannel = `agent:${task.agent_type}:tasks`;

      // Convert TaskAssignment to AgentMessage format
      const agentMessage = {
        id: task.message_id,
        type: 'task',
        agent_id: '', // Will be filled by agent
        workflow_id: task.workflow_id,
        stage: task.payload.action,
        payload: {
          task_id: task.task_id,
          workflow_id: task.workflow_id,
          type: 'scaffold',
          name: workflowData?.name || 'Unknown',
          description: workflowData?.description || '',
          requirements: workflowData?.requirements || '',
          priority: task.priority,
          context: {
            ...task.payload.parameters,
            ...workflowData
          }
        },
        timestamp: task.metadata.created_at,
        trace_id: task.metadata.trace_id
      };

      // Publish to agent channel
      await this.redisPublisher.publish(agentChannel, JSON.stringify(agentMessage));

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
