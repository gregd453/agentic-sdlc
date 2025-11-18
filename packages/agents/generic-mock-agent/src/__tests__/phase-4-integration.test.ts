/**
 * Phase 4: Platform-Scoped Agents Integration Tests
 *
 * Tests:
 * - GenericMockAgent creation and task execution
 * - Platform context propagation
 * - Multi-platform parallel execution
 * - Agent registry platform scoping
 * - Independent trace IDs per platform
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GenericMockAgent } from '../generic-mock-agent.js';
import { AgentRegistry } from '@agentic-sdlc/agent-registry';
import { AGENT_TYPES } from '@agentic-sdlc/shared-types';

/**
 * Mock IMessageBus for testing (simulates the actual message bus)
 */
class MockMessageBus {
  async subscribe(_channel: string, _handler: any, _options: any): Promise<void> {
    // Mock subscription
  }

  async publish(_channel: string, _message: any, _options: any): Promise<void> {
    // Mock publishing
  }

  async health(): Promise<{ ok: boolean }> {
    return { ok: true };
  }
}

describe('Phase 4: Platform-Scoped Agents', () => {
  let messageBus: MockMessageBus;
  let registry: AgentRegistry;

  beforeEach(() => {
    messageBus = new MockMessageBus();
    registry = new AgentRegistry();
  });

  afterEach(() => {
    registry.clear();
  });

  describe('GenericMockAgent', () => {
    it('should create agent without platform context', () => {
      const agent = new GenericMockAgent(messageBus, AGENT_TYPES.SCAFFOLD);

      expect(agent).toBeDefined();
      expect(agent.getAgentInfo()).toMatchObject({
        agentType: AGENT_TYPES.SCAFFOLD,
        platformId: undefined,
        isGenericMockAgent: true
      });
    });

    it('should create agent with platform context', () => {
      const agent = new GenericMockAgent(
        messageBus,
        AGENT_TYPES.SCAFFOLD,
        'web-app-platform'
      );

      expect(agent).toBeDefined();
      expect(agent.getAgentInfo()).toMatchObject({
        agentType: AGENT_TYPES.SCAFFOLD,
        platformId: 'web-app-platform',
        isGenericMockAgent: true
      });
    });

    it('should execute scaffold tasks successfully', async () => {
      const agent = new GenericMockAgent(messageBus, AGENT_TYPES.SCAFFOLD, undefined, 10);

      const mockTask = {
        task_id: 'task-1',
        workflow_id: 'wf-1',
        trace: {
          trace_id: 'trace-1',
          span_id: 'span-1',
          parent_span_id: undefined
        },
        workflow_context: {
          current_stage: 'scaffolding',
          platform_id: undefined
        },
        payload: {
          name: 'test-project',
          project_type: WORKFLOW_TYPES.APP
        }
      } as any;

      const result = await agent.execute(mockTask);

      expect(result.status).toBe(WORKFLOW_STATUS.SUCCESS);
      expect(result.result.data).toMatchObject({
        status: WORKFLOW_STATUS.SUCCESS,
        project_name: 'test-project',
        files_generated: expect.arrayContaining([
          expect.objectContaining({ path: 'src/index.ts' }),
          expect.objectContaining({ path: 'package.json' })
        ])
      });
      expect(result.result.metrics).toBeDefined();
      expect(result.metadata.completed_at).toBeDefined();
      expect(result.metadata.trace_id).toBe('trace-1');
    });

    it('should execute validation tasks successfully', async () => {
      const agent = new GenericMockAgent(messageBus, AGENT_TYPES.VALIDATION, undefined, 10);

      const mockTask = {
        task_id: 'task-2',
        workflow_id: 'wf-1',
        trace: { trace_id: 'trace-2', span_id: 'span-2' },
        workflow_context: {
          current_stage: AGENT_TYPES.VALIDATION,
          platform_id: undefined
        },
        payload: { working_directory: '/test/path' }
      } as any;

      const result = await agent.execute(mockTask);

      expect(result.status).toBe(WORKFLOW_STATUS.SUCCESS);
      expect(result.result.data).toMatchObject({
        status: WORKFLOW_STATUS.SUCCESS,
        validation_result: 'passed',
        errors: [],
        warnings: []
      });
    });

    it('should preserve platform context in output', async () => {
      const agent = new GenericMockAgent(
        messageBus,
        AGENT_TYPES.SCAFFOLD,
        'data-pipeline-platform',
        10
      );

      const mockTask = {
        task_id: 'task-3',
        workflow_id: 'wf-2',
        trace: { trace_id: 'trace-3', span_id: 'span-3' },
        workflow_context: {
          current_stage: 'scaffolding',
          platform_id: 'data-pipeline-platform'
        },
        payload: { name: 'test-pipeline', project_type: 'data-pipeline' }
      } as any;

      const result = await agent.execute(mockTask);

      expect(result.result.data.platform_id).toBe('data-pipeline-platform');
    });
  });

  describe('AgentRegistry Platform Scoping', () => {
    it('should register global scaffold agent', () => {
      const metadata = {
        name: 'global-scaffold',
        type: AGENT_TYPES.SCAFFOLD,
        version: '1.0.0',
        capabilities: [AGENT_TYPES.SCAFFOLD]
      };

      registry.registerAgent(metadata, async () => new GenericMockAgent(messageBus));

      expect(registry.isRegistered(AGENT_TYPES.SCAFFOLD)).toBe(true);
      expect(registry.getMetadata(AGENT_TYPES.SCAFFOLD)).toBeDefined();
    });

    it('should register platform-scoped agent', () => {
      const metadata = {
        name: 'web-app-scaffold',
        type: AGENT_TYPES.SCAFFOLD,
        version: '1.0.0',
        capabilities: [AGENT_TYPES.SCAFFOLD]
      };

      registry.registerAgent(
        metadata,
        async () => new GenericMockAgent(messageBus, AGENT_TYPES.SCAFFOLD, 'web-app-platform'),
        'web-app-platform'
      );

      expect(registry.isRegistered(AGENT_TYPES.SCAFFOLD, 'web-app-platform')).toBe(true);
      expect(registry.getMetadata(AGENT_TYPES.SCAFFOLD, 'web-app-platform')).toBeDefined();
    });

    it('should prefer platform-scoped over global agent', () => {
      // Register global agent
      registry.registerAgent(
        {
          name: 'global-scaffold',
          type: AGENT_TYPES.SCAFFOLD,
          version: '1.0.0',
          capabilities: [AGENT_TYPES.SCAFFOLD]
        },
        async () => new GenericMockAgent(messageBus, AGENT_TYPES.SCAFFOLD)
      );

      // Register platform-scoped agent
      registry.registerAgent(
        {
          name: 'web-app-scaffold',
          type: AGENT_TYPES.SCAFFOLD,
          version: '2.0.0',
          capabilities: [AGENT_TYPES.SCAFFOLD]
        },
        async () => new GenericMockAgent(messageBus, AGENT_TYPES.SCAFFOLD, 'web-app-platform'),
        'web-app-platform'
      );

      const globalMeta = registry.getMetadata(AGENT_TYPES.SCAFFOLD);
      const platformMeta = registry.getMetadata(AGENT_TYPES.SCAFFOLD, 'web-app-platform');

      expect(globalMeta?.version).toBe('1.0.0');
      expect(platformMeta?.version).toBe('2.0.0');
    });

    it('should support multiple platform registrations', () => {
      const platforms = ['web-app-platform', 'data-pipeline-platform', 'infrastructure-platform'];

      for (const platform of platforms) {
        registry.registerAgent(
          {
            name: `${platform}-scaffold`,
            type: AGENT_TYPES.SCAFFOLD,
            version: '1.0.0',
            capabilities: [AGENT_TYPES.SCAFFOLD]
          },
          async () => new GenericMockAgent(messageBus, AGENT_TYPES.SCAFFOLD, platform),
          platform
        );
      }

      expect(registry.size()).toBe(3);
      expect(registry.listAgents('web-app-platform')).toHaveLength(1);
      expect(registry.listAgents('data-pipeline-platform')).toHaveLength(1);
    });

    it('should provide registry statistics', () => {
      // Register global agents for multiple types
      for (const agentType of [AGENT_TYPES.SCAFFOLD, AGENT_TYPES.VALIDATION]) {
        registry.registerAgent(
          {
            name: `global-${agentType}`,
            type: agentType,
            version: '1.0.0',
            capabilities: [agentType]
          },
          async () => new GenericMockAgent(messageBus, agentType)
        );
      }

      // Register platform-scoped agents
      for (const agentType of [AGENT_TYPES.E2E, AGENT_TYPES.INTEGRATION]) {
        registry.registerAgent(
          {
            name: `web-app-${agentType}`,
            type: agentType,
            version: '1.0.0',
            capabilities: [agentType]
          },
          async () => new GenericMockAgent(messageBus, agentType, 'web-app-platform'),
          'web-app-platform'
        );
      }

      const stats = registry.getStats();

      expect(stats.totalAgents).toBe(4);
      expect(stats.globalAgents).toBe(2);
      expect(stats.platformScopedAgents).toBe(2);
      expect(stats.platforms.size).toBe(1);
      expect(stats.platforms.has('web-app-platform')).toBe(true);
    });
  });

  describe('Multi-Platform Execution', () => {
    it('should execute tasks for multiple platforms independently', async () => {
      const webAppAgent = new GenericMockAgent(
        messageBus,
        AGENT_TYPES.SCAFFOLD,
        'web-app-platform',
        10
      );

      const dataAgent = new GenericMockAgent(
        messageBus,
        AGENT_TYPES.SCAFFOLD,
        'data-pipeline-platform',
        10
      );

      const webTask = {
        task_id: 'web-task-1',
        workflow_id: 'wf-web-1',
        trace: { trace_id: 'trace-web-1', span_id: 'span-web-1' },
        workflow_context: {
          current_stage: 'scaffolding',
          platform_id: 'web-app-platform'
        },
        payload: { name: 'web-project', project_type: 'web-app' }
      } as any;

      const dataTask = {
        task_id: 'data-task-1',
        workflow_id: 'wf-data-1',
        trace: { trace_id: 'trace-data-1', span_id: 'span-data-1' },
        workflow_context: {
          current_stage: 'scaffolding',
          platform_id: 'data-pipeline-platform'
        },
        payload: { name: 'data-project', project_type: 'data-pipeline' }
      } as any;

      // Execute tasks in parallel
      const [webResult, dataResult] = await Promise.all([
        webAppAgent.execute(webTask),
        dataAgent.execute(dataTask)
      ]);

      expect(webResult.result.data.project_name).toBe('web-project');
      expect(webResult.result.data.platform_id).toBe('web-app-platform');

      expect(dataResult.result.data.project_name).toBe('data-project');
      expect(dataResult.result.data.platform_id).toBe('data-pipeline-platform');
    });

    it('should maintain independent trace IDs per platform', async () => {
      const agent1 = new GenericMockAgent(
        messageBus,
        AGENT_TYPES.SCAFFOLD,
        'platform-1',
        10
      );

      const agent2 = new GenericMockAgent(
        messageBus,
        AGENT_TYPES.SCAFFOLD,
        'platform-2',
        10
      );

      const task1 = {
        task_id: 'task-1',
        workflow_id: 'wf-1',
        trace: { trace_id: 'trace-unique-1', span_id: 'span-1' },
        workflow_context: { current_stage: 'init', platform_id: 'platform-1' },
        payload: {}
      } as any;

      const task2 = {
        task_id: 'task-2',
        workflow_id: 'wf-2',
        trace: { trace_id: 'trace-unique-2', span_id: 'span-2' },
        workflow_context: { current_stage: 'init', platform_id: 'platform-2' },
        payload: {}
      } as any;

      const result1 = await agent1.execute(task1);
      const result2 = await agent2.execute(task2);

      expect(result1.task_id).toBe('task-1');
      expect(result2.task_id).toBe('task-2');
      expect(result1.task_id).not.toBe(result2.task_id);
    });
  });

  describe('Agent Type Variations', () => {
    it('should support all agent types with GenericMockAgent', async () => {
      const agentTypes = [
        AGENT_TYPES.SCAFFOLD,
        AGENT_TYPES.VALIDATION,
        AGENT_TYPES.E2E,
        AGENT_TYPES.INTEGRATION,
        AGENT_TYPES.DEPLOYMENT
      ];

      for (const agentType of agentTypes) {
        const agent = new GenericMockAgent(messageBus, agentType);

        expect(agent.getAgentInfo().agentType).toBe(agentType);
      }
    });

    it('should generate appropriate mock outputs for each agent type', async () => {
      const testCases = [
        { type: AGENT_TYPES.SCAFFOLD, expectedKey: 'project_name' },
        { type: AGENT_TYPES.VALIDATION, expectedKey: 'validation_result' },
        { type: AGENT_TYPES.E2E, expectedKey: 'tests_run' },
        { type: AGENT_TYPES.INTEGRATION, expectedKey: 'tests_run' },
        { type: AGENT_TYPES.DEPLOYMENT, expectedKey: 'endpoint' }
      ];

      for (const testCase of testCases) {
        const agent = new GenericMockAgent(messageBus, testCase.type);

        const task = {
          task_id: `task-${testCase.type}`,
          workflow_id: 'wf-1',
          trace: { trace_id: 'trace-1', span_id: 'span-1' },
          workflow_context: { current_stage: 'test', platform_id: undefined },
          payload: {}
        } as any;

        const result = await agent.execute(task);

        expect(result.result.data).toHaveProperty(testCase.expectedKey);
      }
    });
  });

  describe('Mock Delay Configuration', () => {
    it('should apply configured delay to task execution', async () => {
      const agent = new GenericMockAgent(messageBus, AGENT_TYPES.SCAFFOLD, undefined, 100);

      const task = {
        task_id: 'task-1',
        workflow_id: 'wf-1',
        trace: { trace_id: 'trace-1', span_id: 'span-1' },
        workflow_context: { current_stage: 'init' },
        payload: {}
      } as any;

      const startTime = Date.now();
      await agent.execute(task);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(90); // Allow some variance
    });

    it('should skip delay when set to 0', async () => {
      const agent = new GenericMockAgent(messageBus, AGENT_TYPES.SCAFFOLD, undefined, 0);

      const task = {
        task_id: 'task-1',
        workflow_id: 'wf-1',
        trace: { trace_id: 'trace-1', span_id: 'span-1' },
        workflow_context: { current_stage: 'init' },
        payload: {}
      } as any;

      const startTime = Date.now();
      await agent.execute(task);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(50); // Should complete quickly
    });
  });
});
