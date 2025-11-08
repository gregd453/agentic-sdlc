import { describe, it, expect, beforeEach, vi } from 'vitest';
import { E2EAgent } from '../e2e-agent';
import { TaskAssignment } from '@agentic-sdlc/base-agent';

// Mock dependencies
vi.mock('../generators/test-generator');
vi.mock('../generators/page-object-generator');
vi.mock('../runners/playwright-runner');
vi.mock('../utils/artifact-storage');

describe('E2EAgent', () => {
  let agent: E2EAgent;

  beforeEach(() => {
    agent = new E2EAgent();
  });

  it('should create agent with correct configuration', () => {
    expect(agent).toBeDefined();
    expect(agent['capabilities'].type).toBe('e2e');
    expect(agent['capabilities'].version).toBe('1.0.0');
    expect(agent['capabilities'].capabilities).toContain('test-generation');
    expect(agent['capabilities'].capabilities).toContain('playwright-integration');
  });

  it('should validate task context schema', async () => {
    const validTask: TaskAssignment = {
      task_id: 'task-123',
      workflow_id: 'workflow-123',
      type: 'e2e',
      name: 'Generate E2E tests',
      description: 'Generate tests for login flow',
      requirements: 'Test user login',
      priority: 'high',
      context: {
        project_path: '/test/project',
        base_url: 'http://localhost:3000',
        test_output_path: '/test/output',
        browsers: ['chromium'],
        parallel: true,
        headless: true
      }
    };

    expect(() => agent['parseTaskContext'](validTask)).not.toThrow();
  });

  it('should reject invalid task context', () => {
    const invalidTask: TaskAssignment = {
      task_id: 'task-123',
      workflow_id: 'workflow-123',
      type: 'e2e',
      name: 'Generate E2E tests',
      description: 'Test',
      requirements: 'Test',
      priority: 'high',
      context: {
        // Missing required project_path
      }
    };

    expect(() => agent['parseTaskContext'](invalidTask)).toThrow();
  });

  it('should handle task with minimal context', () => {
    const task: TaskAssignment = {
      task_id: 'task-123',
      workflow_id: 'workflow-123',
      type: 'e2e',
      name: 'Generate E2E tests',
      description: 'Test',
      requirements: 'Test',
      priority: 'high',
      context: {
        project_path: '/test/project'
      }
    };

    const context = agent['parseTaskContext'](task);
    expect(context.project_path).toBe('/test/project');
    expect(context.browsers).toEqual(['chromium']); // default value
    expect(context.parallel).toBe(true); // default value
    expect(context.headless).toBe(true); // default value
  });

  it('should support all browser types', () => {
    const task: TaskAssignment = {
      task_id: 'task-123',
      workflow_id: 'workflow-123',
      type: 'e2e',
      name: 'Test',
      description: 'Test',
      requirements: 'Test',
      priority: 'high',
      context: {
        project_path: '/test',
        browsers: ['chromium', 'firefox', 'webkit']
      }
    };

    const context = agent['parseTaskContext'](task);
    expect(context.browsers).toEqual(['chromium', 'firefox', 'webkit']);
  });

  it('should support artifact storage options', () => {
    const task: TaskAssignment = {
      task_id: 'task-123',
      workflow_id: 'workflow-123',
      type: 'e2e',
      name: 'Test',
      description: 'Test',
      requirements: 'Test',
      priority: 'high',
      context: {
        project_path: '/test',
        artifact_storage: 's3',
        s3_bucket: 'my-bucket'
      }
    };

    const context = agent['parseTaskContext'](task);
    expect(context.artifact_storage).toBe('s3');
    expect(context.s3_bucket).toBe('my-bucket');
  });

  it('should support screenshot and video options', () => {
    const task: TaskAssignment = {
      task_id: 'task-123',
      workflow_id: 'workflow-123',
      type: 'e2e',
      name: 'Test',
      description: 'Test',
      requirements: 'Test',
      priority: 'high',
      context: {
        project_path: '/test',
        screenshot_on_failure: false,
        video_on_failure: true
      }
    };

    const context = agent['parseTaskContext'](task);
    expect(context.screenshot_on_failure).toBe(false);
    expect(context.video_on_failure).toBe(true);
  });

  it('should support custom timeout', () => {
    const task: TaskAssignment = {
      task_id: 'task-123',
      workflow_id: 'workflow-123',
      type: 'e2e',
      name: 'Test',
      description: 'Test',
      requirements: 'Test',
      priority: 'high',
      context: {
        project_path: '/test',
        test_timeout_ms: 60000
      }
    };

    const context = agent['parseTaskContext'](task);
    expect(context.test_timeout_ms).toBe(60000);
  });
});
