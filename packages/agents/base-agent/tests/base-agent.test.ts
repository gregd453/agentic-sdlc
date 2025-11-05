import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BaseAgent } from '../src/base-agent';
import { TaskAssignment, TaskResult } from '../src/types';
import Redis from 'ioredis';
import Anthropic from '@anthropic-ai/sdk';

// Mock Redis
vi.mock('ioredis');

// Mock Anthropic
vi.mock('@anthropic-ai/sdk');

// Create a concrete implementation for testing
class TestAgent extends BaseAgent {
  constructor() {
    super({
      type: 'example',
      version: '1.0.0',
      capabilities: ['test']
    });
  }

  async execute(task: TaskAssignment): Promise<TaskResult> {
    return {
      task_id: task.task_id,
      workflow_id: task.workflow_id,
      status: 'success',
      output: {
        test: true,
        name: task.name
      },
      metrics: {
        duration_ms: 100
      }
    };
  }
}

describe('BaseAgent', () => {
  let agent: TestAgent;
  let mockRedis: any;
  let mockAnthropicClient: any;

  beforeEach(() => {
    // Set environment variables
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
    process.env.REDIS_HOST = 'localhost';
    process.env.REDIS_PORT = '6379';

    // Setup Redis mock
    mockRedis = {
      ping: vi.fn().mockResolvedValue('PONG'),
      subscribe: vi.fn().mockResolvedValue(undefined),
      publish: vi.fn().mockResolvedValue(1),
      hset: vi.fn().mockResolvedValue(1),
      hdel: vi.fn().mockResolvedValue(1),
      unsubscribe: vi.fn().mockResolvedValue(undefined),
      quit: vi.fn().mockResolvedValue('OK'),
      on: vi.fn()
    };

    (Redis as any).mockImplementation(() => mockRedis);

    // Setup Anthropic mock
    mockAnthropicClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                summary: 'Test analysis',
                components: ['component1', 'component2']
              })
            }
          ]
        })
      }
    };

    (Anthropic as any).mockImplementation(() => mockAnthropicClient);

    // Create agent instance
    agent = new TestAgent();
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.ANTHROPIC_API_KEY;
  });

  describe('initialization', () => {
    it('should initialize successfully with valid config', async () => {
      await agent.initialize();

      expect(mockRedis.ping).toHaveBeenCalled();
      expect(mockRedis.subscribe).toHaveBeenCalledWith('agent:example:tasks');
      expect(mockRedis.hset).toHaveBeenCalled();
    });

    it('should throw error if ANTHROPIC_API_KEY is not set', () => {
      delete process.env.ANTHROPIC_API_KEY;

      expect(() => new TestAgent()).toThrow('ANTHROPIC_API_KEY not configured');
    });
  });

  describe('task validation', () => {
    it('should validate valid task assignment', () => {
      const task: TaskAssignment = {
        task_id: '123e4567-e89b-12d3-a456-426614174000',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        type: 'test',
        name: 'Test Task',
        description: 'A test task',
        requirements: 'Test requirements',
        priority: 'medium'
      };

      const validated = agent.validateTask(task);
      expect(validated).toEqual(task);
    });

    it('should throw ValidationError for invalid task', () => {
      const invalidTask = {
        task_id: 'not-a-uuid',
        type: 'test'
        // Missing required fields
      };

      expect(() => agent.validateTask(invalidTask)).toThrow('Invalid task assignment');
    });
  });

  describe('task execution', () => {
    it('should execute task successfully', async () => {
      const task: TaskAssignment = {
        task_id: '123e4567-e89b-12d3-a456-426614174000',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        type: 'test',
        name: 'Test Task',
        description: 'A test task',
        requirements: 'Test requirements',
        priority: 'medium'
      };

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.task_id).toBe(task.task_id);
      expect(result.workflow_id).toBe(task.workflow_id);
      expect(result.output).toHaveProperty('test', true);
    });
  });

  describe('result reporting', () => {
    it('should report result to orchestrator', async () => {
      const result: TaskResult = {
        task_id: '123e4567-e89b-12d3-a456-426614174000',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        status: 'success',
        output: { test: true }
      };

      await agent.reportResult(result);

      expect(mockRedis.publish).toHaveBeenCalledWith(
        'orchestrator:results',
        expect.stringContaining('"status":"success"')
      );
    });
  });

  describe('health check', () => {
    it('should return healthy status', async () => {
      const health = await agent.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.uptime_ms).toBeGreaterThan(0);
      expect(health.tasks_processed).toBe(0);
      expect(health.errors_count).toBe(0);
    });
  });

  describe('retry logic', () => {
    it('should retry failed operations', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('First attempt'))
        .mockRejectedValueOnce(new Error('Second attempt'))
        .mockResolvedValueOnce('Success');

      const result = await (agent as any).executeWithRetry(operation, 3);

      expect(result).toBe('Success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should throw after max retries', async () => {
      const operation = vi.fn()
        .mockRejectedValue(new Error('Always fails'));

      await expect(
        (agent as any).executeWithRetry(operation, 2)
      ).rejects.toThrow('Operation failed after 2 attempts');

      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('Claude integration', () => {
    it('should call Claude API successfully', async () => {
      const response = await (agent as any).callClaude(
        'Test prompt',
        'Test system prompt'
      );

      expect(mockAnthropicClient.messages.create).toHaveBeenCalledWith({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        temperature: 0.3,
        system: 'Test system prompt',
        messages: [
          {
            role: 'user',
            content: 'Test prompt'
          }
        ]
      });

      expect(response).toContain('Test analysis');
    });

    it('should handle Claude API errors', async () => {
      mockAnthropicClient.messages.create.mockRejectedValueOnce(
        new Anthropic.APIError(400, { error: { message: 'Bad request' } }, 'Bad request', {})
      );

      await expect(
        (agent as any).callClaude('Test prompt')
      ).rejects.toThrow('Claude API error');
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources properly', async () => {
      await agent.cleanup();

      expect(mockRedis.unsubscribe).toHaveBeenCalled();
      expect(mockRedis.quit).toHaveBeenCalled();
      expect(mockRedis.hdel).toHaveBeenCalled();
    });
  });
});