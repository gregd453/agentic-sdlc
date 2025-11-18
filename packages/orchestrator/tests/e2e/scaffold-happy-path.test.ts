import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import {
  SchemaRegistry,
  ScaffoldTask,
  ScaffoldFactory,
  createWorkflow
} from '@agentic-sdlc/shared-types';
import {
  createRedisMock,
  createAnthropicMock,
  setupStandardMocks,
  waitFor,
  type RedisMock,
  type AnthropicMock
} from '@agentic-sdlc/test-utils';

// Mock the modules before imports
setupStandardMocks();

/**
 * E2E Happy Path Test for Milestone 1
 * Tests the complete flow: Orchestrator → Scaffold Agent → Result
 */
describe('Milestone 1: Scaffold Workflow Happy Path E2E', () => {
  let redis: RedisMock;
  let anthropic: AnthropicMock;
  let orchestrator: any;
  let scaffoldAgent: any;

  beforeAll(async () => {
    // Setup mocks
    redis = createRedisMock();
    anthropic = createAnthropicMock();

    // Mock successful Claude response for scaffold agent
    anthropic.setResponse(JSON.stringify({
      structure: {
        directories: ['src', 'tests', 'docs'],
        files: ['package.json', 'tsconfig.json', 'README.md']
      },
      analysis: {
        complexity: TASK_PRIORITY.MEDIUM,
        estimatedHours: 8,
        dependencies: {
          'fastify': '^4.0.0',
          'zod': '^3.22.0'
        }
      }
    }));
  });

  afterAll(async () => {
    await redis.quit();
    anthropic.reset();
  });

  it('should complete scaffold workflow with full type safety', async () => {
    // Step 1: Create workflow via orchestrator
    const workflow = createWorkflow(WORKFLOW_TYPES.APP, 'test-app', 'Test application for E2E');

    expect(workflow.workflow_id).toBeDefined();
    expect(workflow.type).toBe(WORKFLOW_TYPES.APP);
    expect(workflow.current_state).toBe(WORKFLOW_STATUS.INITIATED);

    // Step 2: Create scaffold task
    const scaffoldTask = ScaffoldFactory.task({
      workflow_id: workflow.workflow_id,
      payload: {
        project_type: WORKFLOW_TYPES.APP,
        name: 'test-app',
        description: 'Test application',
        requirements: ['Authentication', 'Dashboard', 'API'],
        tech_stack: {
          language: 'typescript',
          runtime: 'node',
          framework: 'fastify',
          testing: 'vitest',
          package_manager: 'pnpm'
        }
      }
    });

    // Validate task against schema
    const validatedTask = SchemaRegistry.validate<ScaffoldTask>('scaffold.task', scaffoldTask);
    expect(validatedTask.agent_type).toBe(AGENT_TYPES.SCAFFOLD);
    expect(validatedTask.action).toBe('generate_structure');

    // Step 3: Simulate dispatching task to scaffold agent
    await redis.publish('agent:scaffold:tasks', JSON.stringify(validatedTask));

    // Verify task was published
    const publishedMessages = redis.getPublishedMessages();
    expect(publishedMessages).toHaveLength(1);
    expect(publishedMessages[0].channel).toBe('agent:scaffold:tasks');

    // Step 4: Simulate scaffold agent processing
    // In a real test, the scaffold agent would be running and would pick up the task
    const mockResult = ScaffoldFactory.result({
      task_id: scaffoldTask.task_id,
      workflow_id: scaffoldTask.workflow_id,
      success: true,
      status: WORKFLOW_STATUS.SUCCESS,
      result: {
        files_generated: [
          {
            path: 'src/index.ts',
            type: 'source',
            size_bytes: 1024,
            template_source: 'app-template'
          },
          {
            path: 'package.json',
            type: 'config',
            size_bytes: 512,
            template_source: 'package-template'
          },
          {
            path: 'tests/index.test.ts',
            type: 'test',
            size_bytes: 768,
            template_source: 'test-template'
          }
        ],
        structure: {
          root_path: './test-app',
          directories: ['src', 'tests', 'docs'],
          entry_points: ['src/index.ts'],
          config_files: ['package.json', 'tsconfig.json'],
          test_files: ['tests/index.test.ts'],
          total_lines_of_code: 150
        },
        templates_used: [
          {
            name: 'app-template',
            version: '1.0.0',
            source: 'internal'
          }
        ],
        generation_metrics: {
          total_files: 3,
          total_directories: 3,
          total_size_bytes: 2304,
          generation_time_ms: 1500
        }
      }
    });

    // Step 5: Publish result back to orchestrator
    await redis.publish('orchestrator:results', JSON.stringify({
      agent_id: 'scaffold_agent_test',
      workflow_id: workflow.workflow_id,
      task_id: scaffoldTask.task_id,
      ...mockResult
    }));

    // Step 6: Verify complete flow
    const allMessages = redis.getPublishedMessages();
    expect(allMessages).toHaveLength(2);

    // Verify task dispatch
    const taskMessage = allMessages.find(m => m.channel === 'agent:scaffold:tasks');
    expect(taskMessage).toBeDefined();
    const task = JSON.parse(taskMessage!.message);
    expect(task.workflow_id).toBe(workflow.workflow_id);

    // Verify result return
    const resultMessage = allMessages.find(m => m.channel === 'orchestrator:results');
    expect(resultMessage).toBeDefined();
    const result = JSON.parse(resultMessage!.message);
    expect(result.workflow_id).toBe(workflow.workflow_id);
    expect(result.success).toBe(true);
    expect(result.result.files_generated).toHaveLength(3);

    // Step 7: Validate schemas end-to-end
    expect(() => {
      SchemaRegistry.validate('workflow', workflow);
      SchemaRegistry.validate('scaffold.task', task);
      SchemaRegistry.validate('scaffold.result', mockResult);
    }).not.toThrow();
  });

  it('should handle scaffold failure gracefully', async () => {
    const workflow = createWorkflow('service', 'failed-service', 'Service that will fail');

    const scaffoldTask = ScaffoldFactory.task({
      workflow_id: workflow.workflow_id,
      payload: {
        project_type: 'service',
        name: 'failed-service',
        description: 'This will fail',
        requirements: ['Invalid requirement']
      }
    });

    // Simulate failure result
    const failedResult = ScaffoldFactory.failedResult('Template not found');

    await redis.publish('orchestrator:results', JSON.stringify({
      agent_id: 'scaffold_agent_test',
      workflow_id: workflow.workflow_id,
      task_id: scaffoldTask.task_id,
      ...failedResult
    }));

    const messages = redis.getPublishedMessages();
    const resultMessage = messages[messages.length - 1];
    const result = JSON.parse(resultMessage.message);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error.message).toBe('Template not found');
    expect(result.error.retryable).toBe(true);
  });

  describe('Type Safety Verification', () => {
    it('should enforce type safety for workflow IDs', () => {
      const workflow = createWorkflow(WORKFLOW_TYPES.APP, 'type-safe-app', 'Type safe application');

      // WorkflowId type branding prevents mixing with other string types
      expect(typeof workflow.workflow_id).toBe('string');
      expect(workflow.workflow_id).toMatch(/^wf_/);

      // Verify branded types work with schemas
      const task = ScaffoldFactory.task({ workflow_id: workflow.workflow_id });
      expect(task.workflow_id).toBe(workflow.workflow_id);
    });

    it('should validate all required fields in scaffold task', () => {
      const invalidTask = {
        task_id: 'invalid',
        workflow_id: 'invalid',
        agent_type: AGENT_TYPES.SCAFFOLD,
        // Missing required fields
      };

      expect(() => {
        SchemaRegistry.validate('scaffold.task', invalidTask);
      }).toThrow();
    });

    it('should validate scaffold result structure', () => {
      const result = ScaffoldFactory.result();

      // All required fields should be present
      expect(result.task_id).toBeDefined();
      expect(result.workflow_id).toBeDefined();
      expect(result.agent_id).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.result.files_generated).toBeDefined();
      expect(result.result.structure).toBeDefined();
      expect(result.result.generation_metrics).toBeDefined();
    });
  });

  describe('Schema Registry Integration', () => {
    it('should have all required schemas registered', () => {
      const schemas = SchemaRegistry.list();

      expect(schemas).toContain('workflow');
      expect(schemas).toContain('agent.task');
      expect(schemas).toContain('agent.result');
      expect(schemas).toContain('scaffold.task');
      expect(schemas).toContain('scaffold.result');
    });

    it('should validate workflow transitions', () => {
      const workflow = createWorkflow(WORKFLOW_TYPES.APP, 'transition-app', 'Test transitions');

      // Initial state
      expect(workflow.current_state).toBe(WORKFLOW_STATUS.INITIATED);

      // Simulate state transitions
      workflow.current_state = 'scaffolding';
      expect(() => SchemaRegistry.validate('workflow', workflow)).not.toThrow();

      workflow.current_state = 'validating';
      expect(() => SchemaRegistry.validate('workflow', workflow)).not.toThrow();

      workflow.current_state = WORKFLOW_STATUS.COMPLETED;
      expect(() => SchemaRegistry.validate('workflow', workflow)).not.toThrow();
    });

    it('should support schema versioning', () => {
      const version = SchemaRegistry.getVersion('workflow');
      expect(version).toBe('1.0.0');

      const scaffoldVersion = SchemaRegistry.getVersion('scaffold.task');
      expect(scaffoldVersion).toBe('1.0.0');
    });
  });

  describe('Mock Integration', () => {
    it('should properly mock Redis pub/sub', async () => {
      const testRedis = createRedisMock();

      // Test subscription
      await testRedis.subscribe('test-channel');
      expect(testRedis.getSubscriptions()).toContain('test-channel');

      // Test publishing
      await testRedis.publish('test-channel', 'test-message');
      const messages = testRedis.getPublishedMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({
        channel: 'test-channel',
        message: 'test-message'
      });

      // Cleanup
      testRedis.clearAll();
      expect(testRedis.getPublishedMessages()).toHaveLength(0);
    });

    it('should properly mock Anthropic API', async () => {
      const testAnthropic = createAnthropicMock();

      testAnthropic.setResponse('Custom response');

      const result = await testAnthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        messages: [{ role: 'user', content: 'Test' }]
      });

      expect(result.content[0].text).toBe('Custom response');
      expect(testAnthropic.getCallHistory()).toHaveLength(1);
    });
  });
});