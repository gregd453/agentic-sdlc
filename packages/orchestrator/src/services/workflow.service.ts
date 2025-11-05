import { randomUUID } from 'crypto';
import { CreateWorkflowRequest, TaskAssignment, WorkflowResponse } from '../types';
import { WorkflowRepository } from '../repositories/workflow.repository';
import { EventBus } from '../events/event-bus';
import { WorkflowStateMachineService } from '../state-machine/workflow-state-machine';
import { logger, generateTraceId } from '../utils/logger';
import { metrics } from '../utils/metrics';
import { NotFoundError } from '../utils/errors';

export class WorkflowService {
  constructor(
    private repository: WorkflowRepository,
    private eventBus: EventBus,
    private stateMachineService: WorkflowStateMachineService
  ) {
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Subscribe to task completion events
    this.eventBus.subscribe('TASK_COMPLETED', async (event) => {
      logger.info('Task completed event received', { event });
      // Handle task completion and trigger next stage
      await this.handleTaskCompletion(event);
    });

    // Subscribe to task failure events
    this.eventBus.subscribe('TASK_FAILED', async (event) => {
      logger.error('Task failed event received', { event });
      // Handle task failure
      await this.handleTaskFailure(event);
    });
  }

  async createWorkflow(request: CreateWorkflowRequest): Promise<WorkflowResponse> {
    const startTime = Date.now();
    const traceId = generateTraceId();

    logger.info('Creating workflow', {
      type: request.type,
      name: request.name,
      trace_id: traceId
    });

    try {
      // Create workflow in database
      const workflow = await this.repository.create({
        ...request,
        created_by: 'system' // In production, get from auth context
      });

      // Create state machine for workflow
      const stateMachine = this.stateMachineService.createStateMachine(
        workflow.id,
        workflow.type
      );

      // Start the workflow
      stateMachine.send('START');

      // Publish workflow created event
      await this.eventBus.publish({
        id: `event-${Date.now()}`,
        type: 'WORKFLOW_CREATED',
        workflow_id: workflow.id,
        payload: {
          workflow_id: workflow.id,
          type: workflow.type,
          name: workflow.name
        },
        timestamp: new Date().toISOString(),
        trace_id: traceId
      });

      // Create initial task for the first stage
      await this.createTaskForStage(workflow.id, 'initialization');

      // Record metrics
      metrics.recordDuration('workflow.creation', Date.now() - startTime, {
        type: workflow.type
      });
      metrics.increment('workflows.created', { type: workflow.type });

      return {
        workflow_id: workflow.id,
        status: workflow.status,
        current_stage: workflow.current_stage,
        progress_percentage: workflow.progress,
        estimated_duration_ms: this.estimateDuration(workflow.type),
        created_at: workflow.created_at.toISOString(),
        updated_at: workflow.updated_at.toISOString()
      };
    } catch (error) {
      logger.error('Failed to create workflow', {
        error,
        request,
        trace_id: traceId
      });
      metrics.increment('workflows.creation.failed', { type: request.type });
      throw error;
    }
  }

  async getWorkflow(workflowId: string): Promise<WorkflowResponse | null> {
    const workflow = await this.repository.findById(workflowId);

    if (!workflow) {
      return null;
    }

    return {
      workflow_id: workflow.id,
      status: workflow.status,
      current_stage: workflow.current_stage,
      progress_percentage: workflow.progress,
      created_at: workflow.created_at.toISOString(),
      updated_at: workflow.updated_at.toISOString()
    };
  }

  async listWorkflows(filters?: {
    status?: string;
    type?: string;
    priority?: string;
  }): Promise<WorkflowResponse[]> {
    const workflows = await this.repository.findAll(filters);

    return workflows.map(workflow => ({
      workflow_id: workflow.id,
      status: workflow.status,
      current_stage: workflow.current_stage,
      progress_percentage: workflow.progress,
      created_at: workflow.created_at.toISOString(),
      updated_at: workflow.updated_at.toISOString()
    }));
  }

  async cancelWorkflow(workflowId: string): Promise<void> {
    const workflow = await this.repository.findById(workflowId);
    if (!workflow) {
      throw new NotFoundError(`Workflow ${workflowId} not found`);
    }

    const stateMachine = this.stateMachineService.getStateMachine(workflowId);
    if (stateMachine) {
      stateMachine.send('CANCEL');
    }

    await this.repository.update(workflowId, {
      status: 'cancelled'
    });

    logger.info('Workflow cancelled', { workflow_id: workflowId });
    metrics.increment('workflows.cancelled');
  }

  async retryWorkflow(workflowId: string, fromStage?: string): Promise<void> {
    const workflow = await this.repository.findById(workflowId);
    if (!workflow) {
      throw new NotFoundError(`Workflow ${workflowId} not found`);
    }

    const stateMachine = this.stateMachineService.getStateMachine(workflowId);
    if (stateMachine) {
      stateMachine.send('RETRY');
    }

    const stage = fromStage || workflow.current_stage;
    await this.createTaskForStage(workflowId, stage);

    logger.info('Workflow retry initiated', {
      workflow_id: workflowId,
      from_stage: stage
    });
    metrics.increment('workflows.retried');
  }

  private async createTaskForStage(workflowId: string, stage: string): Promise<void> {
    const taskId = randomUUID();
    const agentType = this.getAgentTypeForStage(stage);

    // Create task in database
    await this.repository.createTask({
      task_id: taskId,
      workflow_id: workflowId,
      agent_type: agentType as any,
      status: 'pending',
      priority: 'normal',
      payload: {
        stage,
        workflow_id: workflowId
      },
      retry_count: 0,
      max_retries: 3,
      timeout_ms: 300000
    });

    // Create task assignment message
    const taskAssignment: TaskAssignment = {
      message_id: randomUUID(),
      task_id: taskId,
      workflow_id: workflowId,
      agent_type: agentType as any,
      priority: 'normal',
      payload: {
        action: `execute_${stage}`,
        parameters: {
          workflow_id: workflowId,
          stage
        }
      },
      constraints: {
        timeout_ms: 300000,
        max_retries: 3,
        required_confidence: 80
      },
      metadata: {
        created_at: new Date().toISOString(),
        created_by: 'orchestrator',
        trace_id: generateTraceId()
      }
    };

    // Publish task assignment event
    await this.eventBus.publish({
      id: `event-${Date.now()}`,
      type: 'TASK_ASSIGNED',
      workflow_id: workflowId,
      payload: taskAssignment,
      timestamp: new Date().toISOString(),
      trace_id: taskAssignment.metadata.trace_id
    });

    logger.info('Task created for stage', {
      task_id: taskId,
      workflow_id: workflowId,
      stage,
      agent_type: agentType
    });
  }

  private async handleTaskCompletion(event: any): Promise<void> {
    const { task_id, workflow_id } = event.payload;

    // Update task status
    await this.repository.updateTask(task_id, {
      status: 'completed',
      completed_at: new Date()
    });

    // Update workflow state machine
    const stateMachine = this.stateMachineService.getStateMachine(workflow_id);
    if (stateMachine) {
      stateMachine.send({
        type: 'STAGE_COMPLETE',
        stage: event.payload.stage
      });
    }
  }

  private async handleTaskFailure(event: any): Promise<void> {
    const { task_id, workflow_id, error } = event.payload;

    // Update task status
    await this.repository.updateTask(task_id, {
      status: 'failed'
    });

    // Check retry count
    const task = await this.repository.getPendingTasks();
    const failedTask = task.find(t => t.task_id === task_id);

    if (failedTask && failedTask.retry_count < failedTask.max_retries) {
      // Retry the task
      await this.repository.updateTask(task_id, {
        status: 'pending',
        retry_count: failedTask.retry_count + 1
      });

      logger.info('Retrying failed task', {
        task_id,
        retry_count: failedTask.retry_count + 1
      });
    } else {
      // Mark workflow as failed
      const stateMachine = this.stateMachineService.getStateMachine(workflow_id);
      if (stateMachine) {
        stateMachine.send({
          type: 'STAGE_FAILED',
          stage: event.payload.stage,
          error
        });
      }
    }
  }

  private getAgentTypeForStage(stage: string): string {
    const stageToAgentMap: Record<string, string> = {
      initialization: 'scaffold',
      scaffolding: 'scaffold',
      implementation: 'scaffold',
      validation: 'validation',
      testing: 'e2e_test',
      e2e_testing: 'e2e_test',
      integration: 'integration',
      deployment: 'deployment',
      monitoring: 'monitoring',
      debugging: 'debug',
      fixing: 'debug'
    };

    return stageToAgentMap[stage] || 'scaffold';
  }

  private estimateDuration(workflowType: string): number {
    const estimates: Record<string, number> = {
      app: 1800000,    // 30 minutes
      feature: 900000,  // 15 minutes
      bugfix: 600000    // 10 minutes
    };

    return estimates[workflowType] || 1800000;
  }
}