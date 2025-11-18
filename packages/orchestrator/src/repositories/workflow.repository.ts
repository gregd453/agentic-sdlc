import { TASK_PRIORITY } from '@agentic-sdlc/shared-types';
import { WORKFLOW_TYPES } from '@agentic-sdlc/shared-types';
import { WORKFLOW_STATUS, TASK_STATUS } from '@agentic-sdlc/shared-types';
import { PrismaClient, Workflow, WorkflowStage, AgentTask } from '@prisma/client';
import { CreateWorkflowRequest } from '../types';
import { NotFoundError, ConcurrencyConflictError } from '../utils/errors';
import { logger } from '../utils/logger';

export class WorkflowRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * SESSION #64: Retry wrapper for handling optimistic locking conflicts
   * Retries operations with exponential backoff when ConcurrencyConflictError occurs
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelayMs: number = 50
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        // Only retry on concurrency conflicts
        if (!(error instanceof ConcurrencyConflictError)) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          logger.error('[SESSION #64 RETRY] Max retries exceeded for concurrency conflict', {
            workflow_id: error.workflowId,
            attempts: attempt + 1,
            error_code: error.code
          });
          throw error;
        }

        // Exponential backoff: 50ms, 100ms, 200ms
        const delayMs = baseDelayMs * Math.pow(2, attempt);
        logger.info('[SESSION #64 RETRY] Retrying after concurrency conflict', {
          workflow_id: error.workflowId,
          attempt: attempt + 1,
          max_retries: maxRetries,
          delay_ms: delayMs
        });

        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    throw lastError!;
  }

  async create(data: CreateWorkflowRequest & { created_by: string; trace_id?: string; current_span_id?: string; platform_id?: string; surface_id?: string; input_data?: Record<string, any> }): Promise<Workflow> {
    return await this.prisma.$transaction(async (tx) => {
      // Create workflow
      const workflow = await tx.workflow.create({
        data: {
          type: data.type,
          name: data.name,
          description: data.description,
          requirements: data.requirements,
          priority: data.priority || TASK_PRIORITY.MEDIUM,
          status: WORKFLOW_STATUS.INITIATED,
          current_stage: 'initialization',
          created_by: data.created_by,
          trace_id: data.trace_id, // Phase 3: Store trace_id
          current_span_id: data.current_span_id, // Phase 3: Store current_span_id
          // Phase 1: Store platform-aware fields
          platform_id: data.platform_id || undefined,
          surface_id: data.surface_id || undefined,
          input_data: data.input_data || undefined
        }
      });

      // Create initial workflow event
      await tx.workflowEvent.create({
        data: {
          workflow_id: workflow.id,
          event_type: 'WORKFLOW_CREATED',
          payload: data,
          trace_id: `trace-${workflow.id}-${Date.now()}`
        }
      });

      // Create initial stages based on workflow type
      const stages = this.getStagesForWorkflowType(data.type);
      await tx.workflowStage.createMany({
        data: stages.map(stage => ({
          workflow_id: workflow.id,
          name: stage,
          status: TASK_STATUS.PENDING
        }))
      });

      logger.info('Workflow created', {
        workflow_id: workflow.id,
        type: workflow.type,
        name: workflow.name
      });

      return workflow;
    });
  }

  async findById(id: string): Promise<Workflow | null> {
    return await this.prisma.workflow.findUnique({
      where: { id },
      include: {
        stages: {
          orderBy: { name: 'asc' }
        },
        events: {
          orderBy: { timestamp: 'desc' },
          take: 10
        },
        tasks: {
          orderBy: { assigned_at: 'desc' },
          take: 10
        }
      }
    });
  }

  async findAll(
    filters?: {
      status?: string;
      type?: string;
      priority?: string;
    }
  ): Promise<Workflow[]> {
    const where: any = {};

    if (filters?.status) where.status = filters.status;
    if (filters?.type) where.type = filters.type;
    if (filters?.priority) where.priority = filters.priority;

    return await this.prisma.workflow.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        stages: true
      }
    });
  }

  async update(
    id: string,
    data: Partial<{
      status: string;
      current_stage: string;
      progress: number;
      completed_at: Date | null;
      stage_outputs: any;
    }>
  ): Promise<Workflow> {
    // SESSION #64: Wrap update in retry logic to handle concurrent updates
    return this.withRetry(async () => {
      // Re-fetch on each retry to get latest version
      const existing = await this.findById(id);
      if (!existing) {
        throw new NotFoundError(`Workflow ${id} not found`);
      }

      // SESSION #26: Compare-And-Swap (CAS) for atomic stage updates
      // Only update if version matches (prevents stale writes from concurrent updates)
      const currentVersion = existing.version;

      try {
        const updated = await this.prisma.workflow.update({
          where: {
            id,
            version: currentVersion  // CAS condition: only update if version unchanged
          },
          data: {
            ...data,
            version: { increment: 1 }  // Increment version on successful update
          } as any
        });

        logger.info('[SESSION #64 CAS] Workflow updated successfully (CAS check passed)', {
          workflow_id: id,
          updates: data,
          version: currentVersion,
          new_version: currentVersion + 1
        });

        return updated;
      } catch (error: any) {
        // If update failed, it means version mismatch (another process updated it)
        if (error.code === 'P2025') {
          logger.warn('[SESSION #64 CAS] Optimistic lock failure - concurrent update detected', {
            workflow_id: id,
            expected_version: currentVersion,
            attempted_updates: data,
            error_code: 'CONCURRENCY_CONFLICT'
          });
          throw new ConcurrencyConflictError(
            `Workflow ${id} was modified by another process (version ${currentVersion} no longer current)`,
            id,
            currentVersion,
            { attempted_updates: data }
          );
        }
        throw error;
      }
    });
  }

  async updateState(
    id: string,
    data: Partial<{
      current_stage: string;
      progress: number;
      completed_at: Date | null;
      metadata: Record<string, any>;
    }>
  ): Promise<Workflow> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundError(`Workflow ${id} not found`);
    }

    // SESSION #26: Compare-And-Swap (CAS) for atomic stage updates
    const currentVersion = existing.version;

    try {
      const updated = await this.prisma.workflow.update({
        where: {
          id,
          version: currentVersion  // CAS condition
        },
        data: {
          ...data,
          version: { increment: 1 }  // Increment version on success
        } as any
      });

      logger.info('[SESSION #26 CAS] Workflow state updated successfully (CAS check passed)', {
        workflow_id: id,
        updates: data,
        version: currentVersion,
        new_version: currentVersion + 1
      });

      return updated;
    } catch (error: any) {
      if (error.code === 'P2025') {
        logger.warn('[SESSION #26 CAS] State update rejected - version mismatch (concurrent update detected)', {
          workflow_id: id,
          expected_version: currentVersion,
          attempted_updates: data
        });
        throw new Error(`CAS failed for workflow ${id}: concurrent update detected`);
      }
      throw error;
    }
  }

  async updateStage(
    workflowId: string,
    stageName: string,
    updates: Partial<WorkflowStage>
  ): Promise<WorkflowStage> {
    const stage = await this.prisma.workflowStage.findFirst({
      where: {
        workflow_id: workflowId,
        name: stageName
      }
    });

    if (!stage) {
      throw new NotFoundError(`Stage ${stageName} not found for workflow ${workflowId}`);
    }

    return await this.prisma.workflowStage.update({
      where: { id: stage.id },
      data: updates
    });
  }

  async createTask(task: Omit<AgentTask, 'id'>): Promise<AgentTask> {
    return await this.prisma.agentTask.create({
      data: task as any
    });
  }

  async updateTask(
    taskId: string,
    updates: Partial<AgentTask>
  ): Promise<AgentTask> {
    return await this.prisma.agentTask.update({
      where: { task_id: taskId },
      data: updates as any
    });
  }

  async getPendingTasks(agentType?: string): Promise<AgentTask[]> {
    const where: any = { status: TASK_STATUS.PENDING };
    if (agentType) where.agent_type = agentType;

    return await this.prisma.agentTask.findMany({
      where,
      orderBy: [
        { priority: 'desc' },
        { assigned_at: 'asc' }
      ]
    });
  }

  private getStagesForWorkflowType(type: string): string[] {
    const stageMap: Record<string, string[]> = {
      app: [
        'initialization',
        'scaffolding',
        AGENT_TYPES.VALIDATION,
        'e2e_testing',
        AGENT_TYPES.INTEGRATION,
        AGENT_TYPES.DEPLOYMENT,
        'monitoring'
      ],
      feature: [
        'initialization',
        'implementation',
        AGENT_TYPES.VALIDATION,
        'testing',
        AGENT_TYPES.INTEGRATION,
        AGENT_TYPES.DEPLOYMENT
      ],
      bugfix: [
        'initialization',
        'debugging',
        'fixing',
        AGENT_TYPES.VALIDATION,
        'testing',
        AGENT_TYPES.DEPLOYMENT
      ]
    };

    return stageMap[type] || stageMap.app;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.workflow.delete({
      where: { id }
    });

    logger.info('Workflow deleted', { workflow_id: id });
  }

  // Dashboard API methods
  async getWorkflowTasks(workflowId: string): Promise<AgentTask[]> {
    return await this.prisma.agentTask.findMany({
      where: { workflow_id: workflowId },
      orderBy: { assigned_at: 'desc' }
    });
  }

  async getWorkflowEvents(workflowId: string) {
    return await this.prisma.workflowEvent.findMany({
      where: { workflow_id: workflowId },
      orderBy: { timestamp: 'desc' }
    });
  }

  async getWorkflowTimeline(workflowId: string) {
    const [events, tasks, stages] = await Promise.all([
      this.prisma.workflowEvent.findMany({
        where: { workflow_id: workflowId },
        orderBy: { timestamp: 'asc' }
      }),
      this.prisma.agentTask.findMany({
        where: { workflow_id: workflowId },
        orderBy: { assigned_at: 'asc' }
      }),
      this.prisma.workflowStage.findMany({
        where: { workflow_id: workflowId },
        orderBy: { name: 'asc' }
      })
    ]);

    return { events, tasks, stages };
  }

  async getTaskById(taskId: string) {
    return await this.prisma.agentTask.findUnique({
      where: { task_id: taskId },
      include: {
        workflow: {
          select: {
            id: true,
            name: true,
            type: true,
            status: true,
            current_stage: true
          }
        }
      }
    });
  }

  async listTasks(filters: {
    workflow_id?: string;
    agent_type?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const { workflow_id, agent_type, status, limit = 50, offset = 0 } = filters;

    const where: any = {};
    if (workflow_id) where.workflow_id = workflow_id;
    if (agent_type) where.agent_type = agent_type;
    if (status) where.status = status;

    return await this.prisma.agentTask.findMany({
      where,
      orderBy: { assigned_at: 'desc' },
      take: Math.min(limit, 100),
      skip: offset
    });
  }
}