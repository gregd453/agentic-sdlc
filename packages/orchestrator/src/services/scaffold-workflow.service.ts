import {
  Workflow,
  ScaffoldTask,
  SchemaRegistry,
  createWorkflow,
  toTaskId,
  VERSION
} from '@agentic-sdlc/shared-types';
import { AgentDispatcherService } from './agent-dispatcher.service';
import { WorkflowRepository } from '../repositories/workflow.repository';
import { logger } from '../utils/logger';
import { randomUUID } from 'crypto';

/**
 * Scaffold Workflow Service
 * Handles scaffold-specific workflow operations using shared types
 */
export class ScaffoldWorkflowService {
  constructor(
    private repository: WorkflowRepository,
    private agentDispatcher: AgentDispatcherService
  ) {
    // Register schemas if not already registered
    this.ensureSchemasRegistered();
  }

  private ensureSchemasRegistered(): void {
    // Schemas are auto-registered in shared-types, but we can verify
    if (!SchemaRegistry.has('workflow')) {
      logger.warn('Schemas not registered, this should not happen');
    }
  }

  /**
   * Create and start a scaffold workflow
   */
  async createScaffoldWorkflow(request: {
    name: string;
    description: string;
    project_type: 'app' | 'service' | 'feature' | 'capability';
    requirements: string[];
    tech_stack?: any;
    options?: any;
  }): Promise<Workflow> {
    const startTime = Date.now();

    logger.info('Creating scaffold workflow', {
      name: request.name,
      project_type: request.project_type
    });

    try {
      // Create workflow
      const workflow = createWorkflow(
        request.project_type,
        request.name,
        request.description
      );

      // Save to database
      await this.repository.create({
        type: workflow.type as 'app' | 'feature' | 'bugfix',
        name: workflow.name,
        description: workflow.description || '',
        requirements: JSON.stringify(request.requirements),
        priority: 'medium',
        created_by: 'system'
      });

      // Create scaffold task
      const scaffoldTask = this.createScaffoldTask(
        workflow,
        request.requirements,
        request.tech_stack,
        request.options
      );

      // Dispatch to scaffold agent
      await this.dispatchScaffoldTask(scaffoldTask);

      logger.info('Scaffold workflow created and task dispatched', {
        workflow_id: workflow.workflow_id,
        task_id: scaffoldTask.task_id,
        duration_ms: Date.now() - startTime
      });

      return workflow;

    } catch (error) {
      logger.error('Failed to create scaffold workflow', {
        error: error instanceof Error ? error.message : 'Unknown error',
        name: request.name
      });
      throw error;
    }
  }

  /**
   * Create a scaffold task for the workflow
   */
  private createScaffoldTask(
    workflow: Workflow,
    requirements: string[],
    tech_stack?: any,
    options?: any
  ): ScaffoldTask {
    const now = new Date().toISOString();

    const task: ScaffoldTask = {
      task_id: toTaskId(`task_${Date.now()}_${randomUUID().substring(0, 8)}`),
      workflow_id: workflow.workflow_id,
      agent_type: 'scaffold',
      action: 'generate_structure',
      status: 'pending',
      priority: 50,
      payload: {
        project_type: workflow.type as 'app' | 'service' | 'feature' | 'capability',
        name: workflow.name,
        description: workflow.description || '',
        tech_stack: tech_stack || {
          language: 'typescript',
          runtime: 'node',
          testing: 'vitest',
          package_manager: 'pnpm'
        },
        requirements: requirements,
        template: {
          type: workflow.type === 'app' ? 'app-ui' :
                workflow.type === 'service' ? 'service-bff' :
                workflow.type === 'feature' ? 'feature' : 'capability',
          include_examples: true,
          include_tests: true,
          include_docs: true
        },
        options: options
      },
      version: VERSION,
      timeout_ms: 120000,
      retry_count: 0,
      max_retries: 3,
      created_at: now
    };

    // Validate the task
    const validatedTask = SchemaRegistry.validate<ScaffoldTask>('scaffold.task', task);
    return validatedTask;
  }

  /**
   * Dispatch scaffold task to agent
   */
  private async dispatchScaffoldTask(task: ScaffoldTask): Promise<void> {
    // Convert to agent dispatcher format
    const taskAssignment = {
      message_id: randomUUID(),
      task_id: task.task_id,
      workflow_id: task.workflow_id,
      agent_type: 'scaffold' as const,
      priority: 'medium' as const,
      payload: {
        action: task.action,
        target: task.payload.name,
        parameters: task.payload as any,
        context: {
          timestamp: new Date().toISOString()
        }
      },
      constraints: {
        timeout_ms: task.timeout_ms,
        max_retries: task.max_retries,
        required_confidence: 80
      },
      metadata: {
        created_at: task.created_at,
        created_by: 'system',
        trace_id: `trace-${task.task_id}-${Date.now()}`
      }
    };

    await this.agentDispatcher.dispatchTask(taskAssignment as any);

    logger.info('Scaffold task dispatched to agent', {
      task_id: task.task_id,
      workflow_id: task.workflow_id,
      agent_type: 'scaffold'
    });
  }

  /**
   * Handle scaffold task result
   */
  async handleScaffoldResult(result: any): Promise<void> {
    logger.info('Handling scaffold result', {
      workflow_id: result.workflow_id,
      success: result.success
    });

    try {
      // Update workflow state
      await this.repository.updateState(result.workflow_id, {
        current_stage: result.success ? 'validating' : 'failed',
        progress: result.success ? 25 : 0,
        completed_at: result.success ? null : new Date(),
        metadata: {
          scaffold_result: result
        }
      });

      // If successful, trigger next stage (validation)
      if (result.success && result.next_stage === 'validation') {
        logger.info('Scaffold successful, triggering validation', {
          workflow_id: result.workflow_id
        });
        // TODO: Dispatch validation task
      }

    } catch (error) {
      logger.error('Failed to handle scaffold result', {
        error: error instanceof Error ? error.message : 'Unknown error',
        workflow_id: result.workflow_id
      });
    }
  }
}