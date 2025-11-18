import { describe, it, expect } from 'vitest';

/**
 * Simple Happy Path Test for Milestone 1
 * Validates that shared types work correctly with schema registry
 */
describe('Milestone 1: Simple Happy Path Validation', () => {
  it('should import and use shared types successfully', async () => {
    // Dynamic import to avoid CommonJS issues
    const sharedTypes = await import('@agentic-sdlc/shared-types');
    const {
      SchemaRegistry,
      createWorkflow,
      createTask,
      VERSION
    } = sharedTypes;

    // Test 1: Create a workflow
    const workflow = createWorkflow(WORKFLOW_TYPES.APP, 'test-app', 'Test application');

    expect(workflow.workflow_id).toBeDefined();
    expect(workflow.type).toBe(WORKFLOW_TYPES.APP);
    expect(workflow.name).toBe('test-app');
    expect(workflow.current_stage).toBe(WORKFLOW_STATUS.INITIATED);
    expect(workflow.progress).toBe(0);
    expect(workflow.version).toBe(VERSION);

    // Test 2: Create a scaffold task
    const task = createTask(workflow, AGENT_TYPES.SCAFFOLD, 'generate_structure', {
      project_type: WORKFLOW_TYPES.APP,
      name: 'test-app',
      requirements: ['Authentication', 'Dashboard']
    });

    expect(task.task_id).toBeDefined();
    expect(task.workflow_id).toBe(workflow.workflow_id);
    expect(task.agent_type).toBe(AGENT_TYPES.SCAFFOLD);
    expect(task.action).toBe('generate_structure');
    expect(task.status).toBe(TASK_STATUS.PENDING);

    // Test 3: Validate with Schema Registry
    const validatedWorkflow = SchemaRegistry.validate('workflow', workflow);
    expect(validatedWorkflow).toBeDefined();
    expect(validatedWorkflow.workflow_id).toBe(workflow.workflow_id);

    const validatedTask = SchemaRegistry.validate('agent.task', task);
    expect(validatedTask).toBeDefined();
    expect(validatedTask.task_id).toBe(task.task_id);

    // Test 4: Verify all schemas are registered
    const schemas = SchemaRegistry.list();
    expect(schemas).toContain('workflow');
    expect(schemas).toContain('agent.task');
    expect(schemas).toContain('agent.result');
    expect(schemas).toContain('scaffold.task');
    expect(schemas).toContain('scaffold.result');

    // Test 5: Verify versioning
    const workflowVersion = SchemaRegistry.getVersion('workflow');
    expect(workflowVersion).toBe('1.0.0');
  });

  it('should validate scaffold-specific schemas', async () => {
    const sharedTypes = await import('@agentic-sdlc/shared-types');
    const { SchemaRegistry } = sharedTypes;

    const scaffoldTask = {
      task_id: `task_${Date.now()}`,
      workflow_id: `wf_${Date.now()}`,
      agent_type: AGENT_TYPES.SCAFFOLD,
      action: 'generate_structure',
      status: TASK_STATUS.PENDING,
      priority: 50,
      payload: {
        project_type: WORKFLOW_TYPES.APP,
        name: 'test-app',
        description: 'Test application',
        tech_stack: {
          language: 'typescript',
          runtime: 'node',
          testing: 'vitest',
          package_manager: 'pnpm'
        },
        requirements: ['Feature 1', 'Feature 2']
      },
      version: '1.0.0',
      timeout_ms: 120000,
      retry_count: 0,
      max_retries: 3,
      created_at: new Date().toISOString()
    };

    // Should validate without errors
    expect(() => {
      SchemaRegistry.validate('scaffold.task', scaffoldTask);
    }).not.toThrow();

    // Invalid task should throw
    const invalidTask = { ...scaffoldTask, agent_type: 'invalid' };
    expect(() => {
      SchemaRegistry.validate('scaffold.task', invalidTask);
    }).toThrow();
  });

  it('should support type branding for IDs', async () => {
    const sharedTypes = await import('@agentic-sdlc/shared-types');
    const {
      toWorkflowId,
      toAgentId,
      toTaskId,
      isWorkflowId,
      isAgentId,
      isTaskId
    } = sharedTypes;

    // Create branded IDs
    const workflowId = toWorkflowId('wf_123');
    const agentId = toAgentId('agent_456');
    const taskId = toTaskId('task_789');

    // Type guards should work
    expect(isWorkflowId(workflowId)).toBe(true);
    expect(isAgentId(agentId)).toBe(true);
    expect(isTaskId(taskId)).toBe(true);

    // Different ID types shouldn't match
    expect(isWorkflowId(agentId)).toBe(false);
    expect(isTaskId(workflowId)).toBe(false);
  });

  it('should handle workflow state transitions', async () => {
    const sharedTypes = await import('@agentic-sdlc/shared-types');
    const { createWorkflow, SchemaRegistry } = sharedTypes;

    const workflow = createWorkflow('service', 'test-service', 'Test service');

    // Valid state transitions
    const validStates = [
      WORKFLOW_STATUS.INITIATED,
      'scaffolding',
      'validating',
      'testing',
      'integrating',
      'deploying',
      WORKFLOW_STATUS.COMPLETED,
      WORKFLOW_STATUS.FAILED,
      WORKFLOW_STATUS.CANCELLED
    ];

    for (const state of validStates) {
      workflow.current_state = state as any;
      expect(() => {
        SchemaRegistry.validate('workflow', workflow);
      }).not.toThrow();
    }

    // Invalid state should throw
    workflow.current_state = 'invalid_state' as any;
    expect(() => {
      SchemaRegistry.validate('workflow', workflow);
    }).toThrow();
  });
});