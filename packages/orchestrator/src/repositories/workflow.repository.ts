import { PrismaClient, Workflow, WorkflowStage, AgentTask } from '@prisma/client';
import { CreateWorkflowRequest } from '../types';
import { NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';

export class WorkflowRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateWorkflowRequest & { created_by: string }): Promise<Workflow> {
    return await this.prisma.$transaction(async (tx) => {
      // Create workflow
      const workflow = await tx.workflow.create({
        data: {
          type: data.type,
          name: data.name,
          description: data.description,
          requirements: data.requirements,
          priority: data.priority || 'medium',
          status: 'initiated',
          current_stage: 'initialization',
          created_by: data.created_by
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
          status: 'pending'
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
    }>
  ): Promise<Workflow> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundError(`Workflow ${id} not found`);
    }

    const updated = await this.prisma.workflow.update({
      where: { id },
      data
    });

    logger.info('Workflow updated', {
      workflow_id: id,
      updates: data
    });

    return updated;
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
      data: task
    });
  }

  async updateTask(
    taskId: string,
    updates: Partial<AgentTask>
  ): Promise<AgentTask> {
    return await this.prisma.agentTask.update({
      where: { task_id: taskId },
      data: updates
    });
  }

  async getPendingTasks(agentType?: string): Promise<AgentTask[]> {
    const where: any = { status: 'pending' };
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
        'validation',
        'e2e_testing',
        'integration',
        'deployment',
        'monitoring'
      ],
      feature: [
        'initialization',
        'implementation',
        'validation',
        'testing',
        'integration',
        'deployment'
      ],
      bugfix: [
        'initialization',
        'debugging',
        'fixing',
        'validation',
        'testing',
        'deployment'
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
}