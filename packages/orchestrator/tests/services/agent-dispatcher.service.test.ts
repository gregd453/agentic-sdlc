import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentDispatcherService } from '../../src/services/agent-dispatcher.service';
import { TaskAssignment } from '../../src/types';

/**
 * Agent Dispatcher Service Tests
 *
 * Tests the bidirectional Redis-based agent communication system:
 * Session #42: Updated to test node-redis v4 implementation
 * 1. Task dispatching to agent-specific Redis channels
 * 2. Result handling from orchestrator:results channel
 * 3. Handler registration and auto-cleanup
 * 4. Agent registry management
 * 5. Error handling and edge cases
 */

// Mock redis module (node-redis v4)
vi.mock('redis', () => {
  const subscriptions = new Map<string, (message: string) => void>();
  const publishedMessages: Array<{ channel: string; message: string }> = [];
  const agentRegistry = new Map<string, string>();

  class RedisClientMock {
    isReady: boolean = false;
    simulateMessage = RedisClientMock.simulateMessage;
    clearAll = RedisClientMock.clearAll;
    getPublishedMessages = RedisClientMock.getPublishedMessages;
    setAgentRegistry = RedisClientMock.setAgentRegistry;

    on(event: string, handler: Function): this {
      // Handle error listeners
      return this;
    }

    async connect(): Promise<void> {
      this.isReady = true;
    }

    async quit(): Promise<void> {
      this.isReady = false;
    }

    async subscribe(channel: string, handler?: (message: string) => void): Promise<void> {
      if (handler) {
        subscriptions.set(channel, handler);
      }
    }

    async publish(channel: string, message: string): Promise<number> {
      publishedMessages.push({ channel, message });
      return 1;
    }

    async hgetall(key: string): Promise<Record<string, string>> {
      if (key === 'agents:registry') {
        return Object.fromEntries(agentRegistry);
      }
      return {};
    }

    // Test helpers
    static simulateMessage(channel: string, message: string): void {
      const handler = subscriptions.get(channel);
      if (handler) {
        handler(message);
      }
    }

    static clearAll(): void {
      subscriptions.clear();
      publishedMessages.length = 0;
      agentRegistry.clear();
    }

    static getPublishedMessages(): Array<{ channel: string; message: string }> {
      return [...publishedMessages];
    }

    static setAgentRegistry(agents: Record<string, any>): void {
      agentRegistry.clear();
      Object.entries(agents).forEach(([id, data]) => {
        agentRegistry.set(id, JSON.stringify(data));
      });
    }
  }

  return {
    createClient: () => new RedisClientMock()
  };
});

describe('AgentDispatcherService', () => {
  let service: AgentDispatcherService;
  let redisMock: any;

  const REDIS_URL = 'redis://localhost:6379';

  beforeEach(async () => {
    // Create service (which creates Redis instances)
    service = new AgentDispatcherService(REDIS_URL);

    // Get the mock instance to use for test helpers
    redisMock = (service as any).redisPublisher;

    // Wait for initialization (client connections are async in node-redis v4)
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  afterEach(async () => {
    try {
      if (redisMock) {
        redisMock.clearAll();
      }
      await service.disconnect();
    } catch (e) {
      // Ignore errors during cleanup
    }
  });

  describe('Initialization & Setup', () => {
    it('should create Redis publisher and subscriber instances', () => {
      expect((service as any).redisPublisher).toBeDefined();
      expect((service as any).redisSubscriber).toBeDefined();
    });

    it('should initialize result handlers map', () => {
      const handlers = (service as any).resultHandlers;
      expect(handlers).toBeInstanceOf(Map);
      expect(handlers.size).toBe(0);
    });

    it('should initialize handler timeouts map', () => {
      const timeouts = (service as any).handlerTimeouts;
      expect(timeouts).toBeInstanceOf(Map);
      expect(timeouts.size).toBe(0);
    });
  });

  describe('Handler Management', () => {
    it('should register result handler for workflow', () => {
      const workflowId = 'workflow-123';
      const handler = vi.fn();

      service.onResult(workflowId, handler);

      const handlers = (service as any).resultHandlers;
      expect(handlers.has(workflowId)).toBe(true);
      expect(handlers.get(workflowId)).toBe(handler);
    });

    it('should unregister result handler', () => {
      const workflowId = 'workflow-456';
      const handler = vi.fn();

      service.onResult(workflowId, handler);
      service.offResult(workflowId);

      const handlers = (service as any).resultHandlers;
      expect(handlers.has(workflowId)).toBe(false);
    });

    it('should handle multiple concurrent handlers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      service.onResult('workflow-1', handler1);
      service.onResult('workflow-2', handler2);
      service.onResult('workflow-3', handler3);

      const handlers = (service as any).resultHandlers;
      expect(handlers.size).toBe(3);

      service.offResult('workflow-2');
      expect(handlers.size).toBe(2);
    });
  });

  describe('Result Handling', () => {
    it('should process valid agent result', async () => {
      const workflowId = 'workflow-123';
      const resultHandler = vi.fn();

      service.onResult(workflowId, resultHandler);

      const agentResult = {
        agent_id: 'agent-1',
        workflow_id: workflowId,
        payload: {
          status: 'success',
          data: { result: 'test' }
        }
      };

      // Simulate receiving result
      redisMock.simulateMessage('orchestrator:results', JSON.stringify(agentResult));

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(resultHandler).toHaveBeenCalledWith(agentResult);
    });

    it('should auto-remove handler after success status', async () => {
      const workflowId = 'workflow-123';
      const resultHandler = vi.fn();

      service.onResult(workflowId, resultHandler);

      const successResult = {
        agent_id: 'agent-1',
        workflow_id: workflowId,
        payload: { status: 'success' }
      };

      redisMock.simulateMessage('orchestrator:results', JSON.stringify(successResult));
      await new Promise(resolve => setTimeout(resolve, 10));

      const handlers = (service as any).resultHandlers;
      expect(handlers.has(workflowId)).toBe(false);
    });

    it('should auto-remove handler after failure status', async () => {
      const workflowId = 'workflow-123';
      const resultHandler = vi.fn();

      service.onResult(workflowId, resultHandler);

      const failureResult = {
        agent_id: 'agent-1',
        workflow_id: workflowId,
        payload: { status: 'failure' }
      };

      redisMock.simulateMessage('orchestrator:results', JSON.stringify(failureResult));
      await new Promise(resolve => setTimeout(resolve, 10));

      const handlers = (service as any).resultHandlers;
      expect(handlers.has(workflowId)).toBe(false);
    });

    it('should not remove handler for in-progress status', async () => {
      const workflowId = 'workflow-123';
      const resultHandler = vi.fn();

      service.onResult(workflowId, resultHandler);

      const progressResult = {
        agent_id: 'agent-1',
        workflow_id: workflowId,
        payload: { status: 'in_progress' }
      };

      redisMock.simulateMessage('orchestrator:results', JSON.stringify(progressResult));
      await new Promise(resolve => setTimeout(resolve, 10));

      const handlers = (service as any).resultHandlers;
      expect(handlers.has(workflowId)).toBe(true);
    });

    it('should handle multiple results for same workflow', async () => {
      const workflowId = 'workflow-123';
      const resultHandler = vi.fn();

      service.onResult(workflowId, resultHandler);

      const results = [
        { agent_id: 'agent-1', workflow_id: workflowId, payload: { status: 'started' } },
        { agent_id: 'agent-1', workflow_id: workflowId, payload: { status: 'in_progress' } },
        { agent_id: 'agent-1', workflow_id: workflowId, payload: { status: 'success' } }
      ];

      for (const result of results) {
        redisMock.simulateMessage('orchestrator:results', JSON.stringify(result));
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      expect(resultHandler).toHaveBeenCalledTimes(3);
    });

    it('should handle invalid JSON gracefully', async () => {
      // Should not throw error
      redisMock.simulateMessage('orchestrator:results', 'invalid json {{{');
      await new Promise(resolve => setTimeout(resolve, 10));

      // Test passes if no error is thrown
      expect(true).toBe(true);
    });

    it('should ignore results for unregistered workflows', async () => {
      const resultHandler = vi.fn();
      service.onResult('workflow-123', resultHandler);

      const result = {
        agent_id: 'agent-1',
        workflow_id: 'workflow-456', // Different workflow
        payload: { status: 'success' }
      };

      redisMock.simulateMessage('orchestrator:results', JSON.stringify(result));
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(resultHandler).not.toHaveBeenCalled();
    });
  });

  describe('Handler Registration', () => {
    it('should register result handler', () => {
      const workflowId = 'workflow-123';
      const handler = vi.fn();

      service.onResult(workflowId, handler);

      const handlers = (service as any).resultHandlers;
      expect(handlers.has(workflowId)).toBe(true);
      expect(handlers.get(workflowId)).toBe(handler);
    });

    it('should create timeout for registered handler', () => {
      const workflowId = 'workflow-123';
      const handler = vi.fn();

      service.onResult(workflowId, handler);

      const timeouts = (service as any).handlerTimeouts;
      expect(timeouts.has(workflowId)).toBe(true);
    });

    it('should replace existing handler for same workflow', () => {
      const workflowId = 'workflow-123';
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      service.onResult(workflowId, handler1);
      service.onResult(workflowId, handler2);

      const handlers = (service as any).resultHandlers;
      expect(handlers.get(workflowId)).toBe(handler2);
    });

    it('should clear existing timeout when replacing handler', () => {
      const workflowId = 'workflow-123';
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      service.onResult(workflowId, handler1);
      const firstTimeout = (service as any).handlerTimeouts.get(workflowId);

      service.onResult(workflowId, handler2);
      const secondTimeout = (service as any).handlerTimeouts.get(workflowId);

      expect(firstTimeout).not.toBe(secondTimeout);
    });

    it('should unregister result handler', () => {
      const workflowId = 'workflow-123';
      const handler = vi.fn();

      service.onResult(workflowId, handler);
      service.offResult(workflowId);

      const handlers = (service as any).resultHandlers;
      expect(handlers.has(workflowId)).toBe(false);
    });

    it('should clear timeout when unregistering handler', () => {
      const workflowId = 'workflow-123';
      const handler = vi.fn();

      service.onResult(workflowId, handler);
      service.offResult(workflowId);

      const timeouts = (service as any).handlerTimeouts;
      expect(timeouts.has(workflowId)).toBe(false);
    });

    it('should handle unregistering non-existent handler gracefully', () => {
      // Should not throw error
      service.offResult('non-existent-workflow');

      expect(true).toBe(true);
    });
  });

  describe('Auto-cleanup', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should auto-cleanup handler after timeout', () => {
      const workflowId = 'workflow-123';
      const handler = vi.fn();

      service.onResult(workflowId, handler);

      const handlers = (service as any).resultHandlers;
      expect(handlers.has(workflowId)).toBe(true);

      // Fast-forward 1 hour (HANDLER_TIMEOUT_MS)
      vi.advanceTimersByTime(3600000);

      expect(handlers.has(workflowId)).toBe(false);
    });

    it('should not cleanup handler before timeout', () => {
      const workflowId = 'workflow-123';
      const handler = vi.fn();

      service.onResult(workflowId, handler);

      const handlers = (service as any).resultHandlers;

      // Fast-forward 30 minutes (half the timeout)
      vi.advanceTimersByTime(1800000);

      expect(handlers.has(workflowId)).toBe(true);
    });

    it('should reset timeout when handler is re-registered', () => {
      const workflowId = 'workflow-123';
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      service.onResult(workflowId, handler1);

      // Fast-forward 45 minutes
      vi.advanceTimersByTime(2700000);

      // Re-register with new handler (resets timeout)
      service.onResult(workflowId, handler2);

      // Fast-forward another 45 minutes (total 90 minutes from first registration)
      vi.advanceTimersByTime(2700000);

      // Handler should still exist because timeout was reset
      const handlers = (service as any).resultHandlers;
      expect(handlers.has(workflowId)).toBe(true);
    });
  });

  describe('Agent Registry', () => {
    it('should retrieve registered agents from Redis', async () => {
      // Set up mock agent registry
      redisMock.setAgentRegistry({
        'agent-1': {
          type: 'scaffold',
          status: 'active',
          last_heartbeat: '2025-11-08T10:00:00Z'
        },
        'agent-2': {
          type: 'validation',
          status: 'active',
          last_heartbeat: '2025-11-08T10:01:00Z'
        }
      });

      const agents = await service.getRegisteredAgents();

      expect(agents).toHaveLength(2);
      expect(agents[0]).toMatchObject({
        agent_id: 'agent-1',
        type: 'scaffold',
        status: 'active'
      });
      expect(agents[1]).toMatchObject({
        agent_id: 'agent-2',
        type: 'validation',
        status: 'active'
      });
    });

    it('should return empty array when no agents registered', async () => {
      redisMock.setAgentRegistry({});

      const agents = await service.getRegisteredAgents();

      expect(agents).toHaveLength(0);
    });

    it('should handle registry read errors gracefully', async () => {
      // Mock hgetall to throw error
      vi.spyOn(redisMock, 'hgetall').mockRejectedValueOnce(new Error('Redis error'));

      const agents = await service.getRegisteredAgents();

      expect(agents).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should handle result processing errors gracefully', async () => {
      const workflowId = 'workflow-123';
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });

      service.onResult(workflowId, errorHandler);

      const result = {
        agent_id: 'agent-1',
        workflow_id: workflowId,
        payload: { status: 'success' }
      };

      // Should not throw even if handler throws
      redisMock.simulateMessage('orchestrator:results', JSON.stringify(result));
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should disconnect Redis clients', async () => {
      const publisher = (service as any).redisPublisher;
      const subscriber = (service as any).redisSubscriber;

      const publisherQuitSpy = vi.spyOn(publisher, 'quit');
      const subscriberQuitSpy = vi.spyOn(subscriber, 'quit');

      await service.disconnect();

      expect(publisherQuitSpy).toHaveBeenCalled();
      expect(subscriberQuitSpy).toHaveBeenCalled();
    });

    it('should clear all handler timeouts on disconnect', async () => {
      service.onResult('workflow-1', vi.fn());
      service.onResult('workflow-2', vi.fn());
      service.onResult('workflow-3', vi.fn());

      const timeouts = (service as any).handlerTimeouts;
      expect(timeouts.size).toBe(3);

      await service.disconnect();

      expect(timeouts.size).toBe(0);
    });

    it('should clear all result handlers on disconnect', async () => {
      service.onResult('workflow-1', vi.fn());
      service.onResult('workflow-2', vi.fn());

      const handlers = (service as any).resultHandlers;
      expect(handlers.size).toBe(2);

      await service.disconnect();

      expect(handlers.size).toBe(0);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle complete workflow lifecycle', async () => {
      const workflowId = 'workflow-123';
      const results: any[] = [];

      service.onResult(workflowId, (result) => {
        results.push(result);
      });

      // Dispatch task
      const task: TaskAssignment = {
        message_id: 'msg-123',
        task_id: 'task-123',
        workflow_id: workflowId,
        agent_type: 'scaffold',
        priority: 'high',
        payload: {
          action: 'generate_structure',
          parameters: { project_type: 'app' }
        },
        constraints: {
          timeout_ms: 300000,
          max_retries: 3,
          required_confidence: 80
        },
        metadata: {
          created_at: new Date().toISOString(),
          created_by: 'user',
          trace_id: 'trace-123'
        }
      };

      await service.dispatchTask(task);

      // Simulate agent lifecycle
      const lifecycle = [
        { agent_id: 'agent-1', workflow_id: workflowId, payload: { status: 'started' } },
        { agent_id: 'agent-1', workflow_id: workflowId, payload: { status: 'in_progress', progress: 50 } },
        { agent_id: 'agent-1', workflow_id: workflowId, payload: { status: 'success', result: { files: 10 } } }
      ];

      for (const result of lifecycle) {
        redisMock.simulateMessage('orchestrator:results', JSON.stringify(result));
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      expect(results).toHaveLength(3);
      expect(results[0].payload.status).toBe('started');
      expect(results[1].payload.status).toBe('in_progress');
      expect(results[2].payload.status).toBe('success');

      // Handler should be auto-removed after success
      const handlers = (service as any).resultHandlers;
      expect(handlers.has(workflowId)).toBe(false);
    });

    it('should handle multiple concurrent workflows', async () => {
      const workflows = ['workflow-1', 'workflow-2', 'workflow-3'];
      const results: Record<string, any[]> = {
        'workflow-1': [],
        'workflow-2': [],
        'workflow-3': []
      };

      // Register handlers for all workflows
      workflows.forEach(workflowId => {
        service.onResult(workflowId, (result) => {
          results[workflowId].push(result);
        });
      });

      // Dispatch tasks for all workflows
      for (const workflowId of workflows) {
        const task: TaskAssignment = {
          message_id: `msg-${workflowId}`,
          task_id: `task-${workflowId}`,
          workflow_id: workflowId,
          agent_type: 'scaffold',
          priority: 'medium',
          payload: {
            action: 'generate_structure',
            parameters: {}
          },
          constraints: {
            timeout_ms: 300000,
            max_retries: 3,
            required_confidence: 80
          },
          metadata: {
            created_at: new Date().toISOString(),
            created_by: 'user',
            trace_id: `trace-${workflowId}`
          }
        };

        await service.dispatchTask(task);
      }

      // Simulate results coming in interleaved
      const allResults = [
        { agent_id: 'agent-1', workflow_id: 'workflow-1', payload: { status: 'started' } },
        { agent_id: 'agent-2', workflow_id: 'workflow-2', payload: { status: 'started' } },
        { agent_id: 'agent-1', workflow_id: 'workflow-1', payload: { status: 'success' } },
        { agent_id: 'agent-3', workflow_id: 'workflow-3', payload: { status: 'started' } },
        { agent_id: 'agent-2', workflow_id: 'workflow-2', payload: { status: 'success' } },
        { agent_id: 'agent-3', workflow_id: 'workflow-3', payload: { status: 'success' } }
      ];

      for (const result of allResults) {
        redisMock.simulateMessage('orchestrator:results', JSON.stringify(result));
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Verify each workflow received correct results
      expect(results['workflow-1']).toHaveLength(2);
      expect(results['workflow-2']).toHaveLength(2);
      expect(results['workflow-3']).toHaveLength(2);

      // All handlers should be removed after success
      const handlers = (service as any).resultHandlers;
      expect(handlers.size).toBe(0);
    });
  });
});
