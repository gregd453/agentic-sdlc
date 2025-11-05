import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ScaffoldAgent } from '../src/scaffold-agent';
import { TaskAssignment } from '@agentic-sdlc/base-agent';
import fs from 'fs-extra';
import path from 'path';

describe('ScaffoldAgent', () => {
  let agent: ScaffoldAgent;
  const testOutputDir = path.join(__dirname, 'scaffold-output');

  beforeEach(() => {
    // Mock environment variables
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.REDIS_HOST = 'localhost';
    process.env.REDIS_PORT = '6380';

    agent = new ScaffoldAgent();
  });

  afterEach(async () => {
    // Clean up test output
    if (await fs.pathExists(testOutputDir)) {
      await fs.remove(testOutputDir);
    }

    // Clean up agent
    if (agent) {
      try {
        await agent.cleanup();
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }
  });

  describe('Agent initialization', () => {
    it('should initialize with correct capabilities', () => {
      expect(agent).toBeDefined();
      // Agent capabilities are set in constructor
    });

    it('should have scaffold agent type', () => {
      // The agent type is 'scaffold' as defined in constructor
      expect(agent).toBeInstanceOf(ScaffoldAgent);
    });
  });

  describe('Task execution', () => {
    it('should execute scaffold task successfully', async () => {
      // Mock Claude API call
      const mockClaudeResponse = JSON.stringify({
        project_name: 'test-service',
        project_type: 'service',
        summary: 'A test microservice',
        components: [
          {
            name: 'TestController',
            type: 'controller',
            description: 'Handles test requests',
            dependencies: []
          }
        ],
        contracts: [
          {
            name: 'TestRequest',
            fields: [
              { name: 'id', type: 'string', required: true }
            ]
          }
        ],
        technical_decisions: {},
        considerations: []
      });

      // Mock the callClaude method
      vi.spyOn(agent as any, 'callClaude').mockResolvedValue(mockClaudeResponse);

      const task: TaskAssignment = {
        task_id: '123e4567-e89b-12d3-a456-426614174000',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        type: 'scaffold',
        name: 'test-service',
        description: 'A test microservice for testing',
        requirements: 'Create a simple REST API service',
        priority: 'high',
        context: {
          project_type: 'service',
          output_path: testOutputDir,
          generate_tests: true,
          generate_docs: true
        }
      };

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.task_id).toBe(task.task_id);
      expect(result.workflow_id).toBe(task.workflow_id);
      expect((result.output as any).files_generated).toBeGreaterThan(0);
      expect((result.output as any).summary).toContain('Successfully scaffolded');
    });

    it('should handle invalid task gracefully', async () => {
      const invalidTask: any = {
        task_id: 'invalid',
        workflow_id: 'invalid',
        type: 'scaffold',
        name: '',
        description: '',
        requirements: '',
        priority: 'high'
      };

      const result = await agent.execute(invalidTask);

      expect(result.status).toBe('failure');
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should handle Claude API errors', async () => {
      // Mock Claude API to throw error
      vi.spyOn(agent as any, 'callClaude').mockRejectedValue(
        new Error('API Error')
      );

      const task: TaskAssignment = {
        task_id: '123e4567-e89b-12d3-a456-426614174000',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        type: 'scaffold',
        name: 'test-service',
        description: 'Test',
        requirements: 'Test requirements',
        priority: 'high',
        context: {
          project_type: 'service',
          output_path: testOutputDir
        }
      };

      const result = await agent.execute(task);

      expect(result.status).toBe('failure');
      expect(result.errors).toBeDefined();
    });

    it('should handle malformed Claude response', async () => {
      // Mock Claude API with invalid JSON
      vi.spyOn(agent as any, 'callClaude').mockResolvedValue('Invalid JSON{');

      const task: TaskAssignment = {
        task_id: '123e4567-e89b-12d3-a456-426614174000',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        type: 'scaffold',
        name: 'test-service',
        description: 'Test',
        requirements: 'Test requirements',
        priority: 'high',
        context: {
          project_type: 'service',
          output_path: testOutputDir
        }
      };

      const result = await agent.execute(task);

      expect(result.status).toBe('failure');
      expect(result.errors).toBeDefined();
    });
  });

  describe('Project type support', () => {
    it('should generate correct structure for service type', async () => {
      const mockResponse = JSON.stringify({
        project_name: 'test-service',
        project_type: 'service',
        summary: 'Test service',
        components: [
          { name: 'UserService', type: 'service', description: 'User service' }
        ],
        contracts: [],
        technical_decisions: {},
        considerations: []
      });

      vi.spyOn(agent as any, 'callClaude').mockResolvedValue(mockResponse);

      const task: TaskAssignment = {
        task_id: '123e4567-e89b-12d3-a456-426614174000',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        type: 'scaffold',
        name: 'test-service',
        description: 'Test service',
        requirements: 'Create service',
        priority: 'high',
        context: {
          project_type: 'service',
          output_path: testOutputDir
        }
      };

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
    });

    it('should generate correct structure for app type', async () => {
      const mockResponse = JSON.stringify({
        project_name: 'test-app',
        project_type: 'app',
        summary: 'Test app',
        components: [
          { name: 'HomePage', type: 'component', description: 'Home page' }
        ],
        contracts: [],
        technical_decisions: {},
        considerations: []
      });

      vi.spyOn(agent as any, 'callClaude').mockResolvedValue(mockResponse);

      const task: TaskAssignment = {
        task_id: '123e4567-e89b-12d3-a456-426614174000',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        type: 'scaffold',
        name: 'test-app',
        description: 'Test app',
        requirements: 'Create app',
        priority: 'high',
        context: {
          project_type: 'app',
          output_path: testOutputDir
        }
      };

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
    });

    it('should generate correct structure for feature type', async () => {
      const mockResponse = JSON.stringify({
        project_name: 'test-feature',
        project_type: 'feature',
        summary: 'Test feature',
        components: [
          { name: 'FeatureComponent', type: 'component', description: 'Feature' }
        ],
        contracts: [],
        technical_decisions: {},
        considerations: []
      });

      vi.spyOn(agent as any, 'callClaude').mockResolvedValue(mockResponse);

      const task: TaskAssignment = {
        task_id: '123e4567-e89b-12d3-a456-426614174000',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        type: 'scaffold',
        name: 'test-feature',
        description: 'Test feature',
        requirements: 'Create feature',
        priority: 'high',
        context: {
          project_type: 'feature',
          output_path: testOutputDir
        }
      };

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
    });

    it('should generate correct structure for capability type', async () => {
      const mockResponse = JSON.stringify({
        project_name: 'test-capability',
        project_type: 'capability',
        summary: 'Test capability',
        components: [
          { name: 'CapabilityLib', type: 'lib', description: 'Capability library' }
        ],
        contracts: [],
        technical_decisions: {},
        considerations: []
      });

      vi.spyOn(agent as any, 'callClaude').mockResolvedValue(mockResponse);

      const task: TaskAssignment = {
        task_id: '123e4567-e89b-12d3-a456-426614174000',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        type: 'scaffold',
        name: 'test-capability',
        description: 'Test capability',
        requirements: 'Create capability',
        priority: 'high',
        context: {
          project_type: 'capability',
          output_path: testOutputDir
        }
      };

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
    });
  });

  describe('Contract generation', () => {
    it('should generate Zod schemas from contracts', async () => {
      const mockResponse = JSON.stringify({
        project_name: 'test-service',
        project_type: 'service',
        summary: 'Test',
        components: [],
        contracts: [
          {
            name: 'User',
            fields: [
              { name: 'id', type: 'string', required: true },
              { name: 'email', type: 'string', required: true },
              { name: 'age', type: 'number', required: false }
            ]
          }
        ],
        technical_decisions: {},
        considerations: []
      });

      vi.spyOn(agent as any, 'callClaude').mockResolvedValue(mockResponse);

      const task: TaskAssignment = {
        task_id: '123e4567-e89b-12d3-a456-426614174000',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        type: 'scaffold',
        name: 'test-service',
        description: 'Test',
        requirements: 'Test',
        priority: 'high',
        context: {
          project_type: 'service',
          output_path: testOutputDir
        }
      };

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect((result.output as any).structure.files.some(
        (f: any) => f.path.includes('types')
      )).toBe(true);
    });
  });

  describe('Test generation', () => {
    it('should generate test files when generate_tests is true', async () => {
      const mockResponse = JSON.stringify({
        project_name: 'test-service',
        project_type: 'service',
        summary: 'Test',
        components: [
          { name: 'TestService', type: 'service', description: 'Test' }
        ],
        contracts: [],
        technical_decisions: {},
        considerations: []
      });

      vi.spyOn(agent as any, 'callClaude').mockResolvedValue(mockResponse);

      const task: TaskAssignment = {
        task_id: '123e4567-e89b-12d3-a456-426614174000',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        type: 'scaffold',
        name: 'test-service',
        description: 'Test',
        requirements: 'Test',
        priority: 'high',
        context: {
          project_type: 'service',
          output_path: testOutputDir,
          generate_tests: true
        }
      };

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect((result.output as any).structure.files.some(
        (f: any) => f.type === 'test'
      )).toBe(true);
    });

    it('should skip test files when generate_tests is false', async () => {
      const mockResponse = JSON.stringify({
        project_name: 'test-service',
        project_type: 'service',
        summary: 'Test',
        components: [
          { name: 'TestService', type: 'service', description: 'Test' }
        ],
        contracts: [],
        technical_decisions: {},
        considerations: []
      });

      vi.spyOn(agent as any, 'callClaude').mockResolvedValue(mockResponse);

      const task: TaskAssignment = {
        task_id: '123e4567-e89b-12d3-a456-426614174000',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        type: 'scaffold',
        name: 'test-service',
        description: 'Test',
        requirements: 'Test',
        priority: 'high',
        context: {
          project_type: 'service',
          output_path: testOutputDir,
          generate_tests: false
        }
      };

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect((result.output as any).structure.files.every(
        (f: any) => f.type !== 'test'
      )).toBe(true);
    });
  });

  describe('Metrics collection', () => {
    it('should collect execution metrics', async () => {
      const mockResponse = JSON.stringify({
        project_name: 'test-service',
        project_type: 'service',
        summary: 'Test',
        components: [],
        contracts: [],
        technical_decisions: {},
        considerations: []
      });

      vi.spyOn(agent as any, 'callClaude').mockResolvedValue(mockResponse);

      const task: TaskAssignment = {
        task_id: '123e4567-e89b-12d3-a456-426614174000',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        type: 'scaffold',
        name: 'test-service',
        description: 'Test',
        requirements: 'Test',
        priority: 'high',
        context: {
          project_type: 'service',
          output_path: testOutputDir
        }
      };

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.metrics).toBeDefined();
      expect(result.metrics!.duration_ms).toBeGreaterThan(0);
      expect(result.metrics!.files_created).toBeGreaterThanOrEqual(0);
      expect(result.metrics!.directories_created).toBeGreaterThanOrEqual(0);
    });
  });
});
