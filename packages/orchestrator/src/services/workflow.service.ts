import { randomUUID } from 'crypto';
import { CreateWorkflowRequest, TaskAssignment, WorkflowResponse } from '../types';
import { WorkflowRepository } from '../repositories/workflow.repository';
import { EventBus } from '../events/event-bus';
import { WorkflowStateMachineService } from '../state-machine/workflow-state-machine';
import { AgentDispatcherService } from './agent-dispatcher.service';
import { DecisionGateService } from './decision-gate.service';
import { logger, generateTraceId } from '../utils/logger';
import { metrics } from '../utils/metrics';
import { NotFoundError } from '../utils/errors';

export class WorkflowService {
  private decisionGateService: DecisionGateService;
  private eventHandlers: Map<string, (event: any) => Promise<void>> = new Map();
  private processedTasks: Set<string> = new Set(); // Track completed tasks for idempotency

  constructor(
    private repository: WorkflowRepository,
    private eventBus: EventBus,
    private stateMachineService: WorkflowStateMachineService,
    private agentDispatcher?: AgentDispatcherService
  ) {
    this.decisionGateService = new DecisionGateService();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Subscribe to task completion events
    const taskCompletedHandler = async (event: any) => {
      logger.info('Task completed event received', { event });
      // Handle task completion and trigger next stage
      await this.handleTaskCompletion(event);
    };
    this.eventHandlers.set('TASK_COMPLETED', taskCompletedHandler);
    this.eventBus.subscribe('TASK_COMPLETED', taskCompletedHandler);

    // Subscribe to task failure events
    const taskFailedHandler = async (event: any) => {
      logger.error('Task failed event received', { event });
      // Handle task failure
      await this.handleTaskFailure(event);
    };
    this.eventHandlers.set('TASK_FAILED', taskFailedHandler);
    this.eventBus.subscribe('TASK_FAILED', taskFailedHandler);
  }

  /**
   * Cleanup event subscriptions and resources
   */
  async cleanup(): Promise<void> {
    logger.info('Cleaning up WorkflowService');

    // Unsubscribe from all events
    for (const [eventType, handler] of this.eventHandlers.entries()) {
      await this.eventBus.unsubscribe(eventType, handler);
    }
    this.eventHandlers.clear();

    // Disconnect agent dispatcher if present
    if (this.agentDispatcher) {
      await this.agentDispatcher.disconnect();
    }

    logger.info('WorkflowService cleanup completed');
  }

  async createWorkflow(request: CreateWorkflowRequest): Promise<WorkflowResponse> {
    const startTime = Date.now();
    const traceId = generateTraceId();

    logger.info('Creating workflow - Full request details', {
      type: request.type,
      name: request.name,
      trace_id: traceId,
      request_keys: Object.keys(request),
      full_request: JSON.stringify(request)
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
      stateMachine.send({ type: 'START' });

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
      await this.createTaskForStage(workflow.id, 'initialization', {
        name: workflow.name,
        description: workflow.description,
        requirements: workflow.requirements,
        type: workflow.type
      });

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
      stateMachine.send({ type: 'CANCEL' });
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
      stateMachine.send({ type: 'RETRY' });
    }

    const stage = fromStage || workflow.current_stage;
    await this.createTaskForStage(workflowId, stage);

    logger.info('Workflow retry initiated', {
      workflow_id: workflowId,
      from_stage: stage
    });
    metrics.increment('workflows.retried');
  }

  private async createTaskForStage(workflowId: string, stage: string, workflowData?: any): Promise<void> {
    const taskId = randomUUID();
    const agentType = this.getAgentTypeForStage(stage);

    // Create task in database
    await this.repository.createTask({
      task_id: taskId,
      workflow_id: workflowId,
      agent_type: agentType as any,
      status: 'pending',
      priority: 'medium',
      payload: {
        stage,
        workflow_id: workflowId
      } as any,
      retry_count: 0,
      max_retries: 3,
      timeout_ms: 300000
    } as any);

    // Create task assignment message
    const taskAssignment: TaskAssignment = {
      message_id: randomUUID(),
      task_id: taskId,
      workflow_id: workflowId,
      agent_type: agentType as any,
      priority: 'medium',
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

    // Dispatch task directly to agent via Redis
    if (this.agentDispatcher) {
      // Register handler for agent result FIRST (before dispatching task)
      this.agentDispatcher.onResult(workflowId, async (result) => {
        await this.handleAgentResult(result);
      });

      // THEN dispatch the task
      await this.agentDispatcher.dispatchTask(taskAssignment, workflowData);
    }

    logger.info('Task created and dispatched to agent', {
      task_id: taskId,
      workflow_id: workflowId,
      stage,
      agent_type: agentType
    });
  }

  private async handleAgentResult(result: any): Promise<void> {
    const payload = result.payload;

    logger.info('Handling agent result', {
      workflow_id: result.workflow_id,
      task_id: payload.task_id,
      status: payload.status,
      stage_from_result: result.stage,
      payload_stage: payload.stage
    });

    if (payload.status === 'success') {
      // Use payload.stage if available, fallback to result.stage
      const completedStage = payload.stage || result.stage;
      logger.info('Task completed - determining stage', {
        workflow_id: result.workflow_id,
        task_id: payload.task_id,
        final_stage_value: completedStage
      });

      await this.handleTaskCompletion({
        payload: {
          task_id: payload.task_id,
          workflow_id: result.workflow_id,
          stage: completedStage
        }
      });
    } else {
      await this.handleTaskFailure({
        payload: {
          task_id: payload.task_id,
          workflow_id: result.workflow_id,
          stage: result.stage,
          error: payload.errors?.join(', ')
        }
      });
    }
  }

  private async handleTaskCompletion(event: any): Promise<void> {
    const { task_id, workflow_id } = event.payload;

    // Idempotency check: Prevent duplicate processing of the same task
    if (this.processedTasks.has(task_id)) {
      logger.warn('Task already processed, skipping duplicate', {
        task_id,
        workflow_id
      });
      return;
    }

    // Mark task as processed
    this.processedTasks.add(task_id);

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

      // Wait for state machine to process the transition and update database
      // The transitionToNextStage action (in onDone handler) is async and updates the database
      // We need to wait for the database to reflect the new current_stage
      const completedStage = event.payload.stage;
      const workflow = await this.waitForStageTransition(workflow_id, completedStage);

      if (workflow) {
        logger.info('Workflow state after stage completion', {
          workflow_id,
          status: workflow.status,
          current_stage: workflow.current_stage,
          progress: workflow.progress
        });

        // Create task for the next stage if workflow is not in a terminal state
        if (workflow.status !== 'completed' && workflow.status !== 'failed' && workflow.status !== 'cancelled') {
          logger.info('Creating task for next stage', {
            workflow_id,
            workflow_type: workflow.type,
            next_stage: workflow.current_stage,
            workflow_status: workflow.status,
            previous_stage_in_event: completedStage
          });

          await this.createTaskForStage(workflow_id, workflow.current_stage, {
            name: workflow.name,
            description: workflow.description,
            requirements: workflow.requirements,
            type: workflow.type
          });
        } else {
          logger.info('Workflow reached terminal state, no new task created', {
            workflow_id,
            status: workflow.status
          });
        }
      }
    }
  }

  /**
   * Wait for the workflow's current_stage to change from the completed stage
   * This ensures the state machine's async actions have completed and the database is updated
   */
  private async waitForStageTransition(workflow_id: string, previousStage: string): Promise<any> {
    const maxAttempts = 50; // 5 seconds with 100ms polling
    let attempts = 0;

    while (attempts < maxAttempts) {
      const workflow = await this.repository.findById(workflow_id);

      if (!workflow) {
        logger.error('Workflow not found while waiting for stage transition', {
          workflow_id
        });
        return null;
      }

      // If the stage has changed, the state machine transition is complete
      if (workflow.current_stage !== previousStage) {
        logger.info('Stage transition detected in database', {
          workflow_id,
          from_stage: previousStage,
          to_stage: workflow.current_stage,
          attempts
        });
        return workflow;
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    logger.warn('Timeout waiting for stage transition in database', {
      workflow_id,
      previous_stage: previousStage,
      attempts: maxAttempts
    });

    // Return the workflow anyway - it might be in terminal state
    return await this.repository.findById(workflow_id);
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

  /**
   * Evaluate if decision is required for a workflow stage
   * Integrates with Phase 10 Decision Engine
   */
  async evaluateDecisionGate(
    workflowId: string,
    stage: string,
    action: string,
    confidence: number
  ): Promise<void> {
    const workflow = await this.repository.findById(workflowId);
    if (!workflow) {
      throw new NotFoundError(`Workflow ${workflowId} not found`);
    }

    // Check if this stage requires a decision gate
    if (!this.decisionGateService.shouldEvaluateDecision(stage, workflow.type)) {
      logger.info('Stage does not require decision gate', { workflow_id: workflowId, stage });
      return;
    }

    const category = this.decisionGateService.getDecisionCategory(stage, workflow.type);
    const evaluation = await this.decisionGateService.evaluateDecision({
      workflow_id: workflowId,
      item_id: workflow.id,
      category,
      action,
      confidence,
      trace_id: generateTraceId(),
    });

    if (evaluation.requires_human_approval) {
      // Pause workflow and wait for operator decision
      const stateMachine = this.stateMachineService.getStateMachine(workflowId);
      if (stateMachine) {
        stateMachine.send({
          type: 'DECISION_REQUIRED',
          decision_id: evaluation.decision.decision_id,
        });
      }

      // Publish decision required event
      await this.eventBus.publish({
        id: `event-${Date.now()}`,
        type: 'DECISION_REQUIRED',
        workflow_id: workflowId,
        payload: {
          decision_id: evaluation.decision.decision_id,
          category,
          action,
          confidence,
          escalation_route: evaluation.escalation_route,
        },
        timestamp: new Date().toISOString(),
        trace_id: generateTraceId(),
      });

      logger.info('Decision required - workflow paused', {
        workflow_id: workflowId,
        decision_id: evaluation.decision.decision_id,
        stage,
        category,
      });

      metrics.increment('workflows.decisions.required', { category });
    } else {
      logger.info('Decision auto-approved', {
        workflow_id: workflowId,
        decision_id: evaluation.decision.decision_id,
        stage,
        confidence,
      });

      metrics.increment('workflows.decisions.auto_approved', { category });
    }
  }

  /**
   * Handle operator decision approval
   */
  async approveDecision(workflowId: string, decisionId: string): Promise<void> {
    const workflow = await this.repository.findById(workflowId);
    if (!workflow) {
      throw new NotFoundError(`Workflow ${workflowId} not found`);
    }

    const stateMachine = this.stateMachineService.getStateMachine(workflowId);
    if (stateMachine) {
      stateMachine.send({
        type: 'DECISION_APPROVED',
        decision_id: decisionId,
      });
    }

    await this.eventBus.publish({
      id: `event-${Date.now()}`,
      type: 'DECISION_APPROVED',
      workflow_id: workflowId,
      payload: { decision_id: decisionId },
      timestamp: new Date().toISOString(),
      trace_id: generateTraceId(),
    });

    logger.info('Decision approved - workflow resumed', {
      workflow_id: workflowId,
      decision_id: decisionId,
    });

    metrics.increment('workflows.decisions.approved');
  }

  /**
   * Handle operator decision rejection
   */
  async rejectDecision(
    workflowId: string,
    decisionId: string,
    reason?: string
  ): Promise<void> {
    const workflow = await this.repository.findById(workflowId);
    if (!workflow) {
      throw new NotFoundError(`Workflow ${workflowId} not found`);
    }

    const stateMachine = this.stateMachineService.getStateMachine(workflowId);
    if (stateMachine) {
      stateMachine.send({
        type: 'DECISION_REJECTED',
        decision_id: decisionId,
        reason,
      });
    }

    await this.eventBus.publish({
      id: `event-${Date.now()}`,
      type: 'DECISION_REJECTED',
      workflow_id: workflowId,
      payload: { decision_id: decisionId, reason },
      timestamp: new Date().toISOString(),
      trace_id: generateTraceId(),
    });

    logger.warn('Decision rejected - workflow failed', {
      workflow_id: workflowId,
      decision_id: decisionId,
      reason,
    });

    metrics.increment('workflows.decisions.rejected');
  }

  /**
   * Evaluate if clarification is required for workflow requirements
   */
  async evaluateClarificationGate(
    workflowId: string,
    requirements: string,
    acceptanceCriteria: string[],
    confidence: number
  ): Promise<void> {
    const workflow = await this.repository.findById(workflowId);
    if (!workflow) {
      throw new NotFoundError(`Workflow ${workflowId} not found`);
    }

    const evaluation = await this.decisionGateService.evaluateClarification(
      workflowId,
      requirements,
      acceptanceCriteria,
      confidence
    );

    if (evaluation.needs_clarification) {
      const clarificationId = `CLR-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;

      // Pause workflow and wait for clarification
      const stateMachine = this.stateMachineService.getStateMachine(workflowId);
      if (stateMachine) {
        stateMachine.send({
          type: 'CLARIFICATION_REQUIRED',
          clarification_id: clarificationId,
        });
      }

      // Publish clarification required event
      await this.eventBus.publish({
        id: `event-${Date.now()}`,
        type: 'CLARIFICATION_REQUIRED',
        workflow_id: workflowId,
        payload: {
          clarification_id: clarificationId,
          ambiguities: evaluation.ambiguities,
          missing_criteria: evaluation.missing_criteria,
          conflicting_constraints: evaluation.conflicting_constraints,
        },
        timestamp: new Date().toISOString(),
        trace_id: generateTraceId(),
      });

      logger.info('Clarification required - workflow paused', {
        workflow_id: workflowId,
        clarification_id: clarificationId,
        ambiguities_count: evaluation.ambiguities.length,
        missing_criteria_count: evaluation.missing_criteria.length,
      });

      metrics.increment('workflows.clarifications.required');
    } else {
      logger.info('Requirements clear - no clarification needed', {
        workflow_id: workflowId,
        confidence,
      });
    }
  }

  /**
   * Handle clarification completion
   */
  async completeClarification(workflowId: string, clarificationId: string): Promise<void> {
    const workflow = await this.repository.findById(workflowId);
    if (!workflow) {
      throw new NotFoundError(`Workflow ${workflowId} not found`);
    }

    const stateMachine = this.stateMachineService.getStateMachine(workflowId);
    if (stateMachine) {
      stateMachine.send({
        type: 'CLARIFICATION_COMPLETE',
        clarification_id: clarificationId,
      });
    }

    await this.eventBus.publish({
      id: `event-${Date.now()}`,
      type: 'CLARIFICATION_COMPLETE',
      workflow_id: workflowId,
      payload: { clarification_id: clarificationId },
      timestamp: new Date().toISOString(),
      trace_id: generateTraceId(),
    });

    logger.info('Clarification complete - workflow resumed', {
      workflow_id: workflowId,
      clarification_id: clarificationId,
    });

    metrics.increment('workflows.clarifications.completed');
  }
}