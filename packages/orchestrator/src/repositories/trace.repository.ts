import { PrismaClient, Workflow, AgentTask } from '@prisma/client';
import { logger } from '../utils/logger';

export interface TraceSpan {
  span_id: string;
  parent_span_id: string | null;
  trace_id: string;
  entity_type: 'Workflow' | 'Task';
  entity_id: string;
  status: string;
  created_at: Date;
  completed_at: Date | null;
  duration_ms: number | null;
  metadata?: Record<string, any>;
}

export interface TraceHierarchy {
  trace_id: string;
  workflows: Workflow[];
  tasks: AgentTask[];
  spans: TraceSpan[];
}

export class TraceRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Find all workflows with a given trace_id
   */
  async findWorkflowsByTraceId(traceId: string): Promise<Workflow[]> {
    try {
      const workflows = await this.prisma.workflow.findMany({
        where: {
          trace_id: traceId
        },
        include: {
          stages: true
        },
        orderBy: {
          created_at: 'asc'
        }
      });

      logger.debug('Workflows found by trace_id', {
        trace_id: traceId,
        count: workflows.length
      });

      return workflows;
    } catch (error) {
      logger.error('Failed to find workflows by trace_id', { trace_id: traceId, error });
      throw error;
    }
  }

  /**
   * Find all tasks with a given trace_id
   */
  async findTasksByTraceId(traceId: string): Promise<AgentTask[]> {
    try {
      const tasks = await this.prisma.agentTask.findMany({
        where: {
          trace_id: traceId
        },
        orderBy: {
          assigned_at: 'asc'
        }
      });

      logger.debug('Tasks found by trace_id', {
        trace_id: traceId,
        count: tasks.length
      });

      return tasks;
    } catch (error) {
      logger.error('Failed to find tasks by trace_id', { trace_id: traceId, error });
      throw error;
    }
  }

  /**
   * Get complete trace hierarchy including workflows and tasks
   */
  async getSpanHierarchy(traceId: string): Promise<TraceHierarchy> {
    try {
      const [workflows, tasks] = await Promise.all([
        this.findWorkflowsByTraceId(traceId),
        this.findTasksByTraceId(traceId)
      ]);

      const spans = this.buildSpanList(workflows, tasks);

      logger.debug('Trace hierarchy built', {
        trace_id: traceId,
        workflow_count: workflows.length,
        task_count: tasks.length,
        span_count: spans.length
      });

      return {
        trace_id: traceId,
        workflows,
        tasks,
        spans
      };
    } catch (error) {
      logger.error('Failed to get span hierarchy', { trace_id: traceId, error });
      throw error;
    }
  }

  /**
   * Build a flat list of spans from workflows and tasks
   */
  private buildSpanList(workflows: Workflow[], tasks: AgentTask[]): TraceSpan[] {
    const spans: TraceSpan[] = [];

    // Add workflow spans
    workflows.forEach(workflow => {
      if (workflow.trace_id && workflow.current_span_id) {
        const duration = workflow.completed_at
          ? workflow.completed_at.getTime() - workflow.created_at.getTime()
          : null;

        spans.push({
          span_id: workflow.current_span_id,
          parent_span_id: null, // Workflows are root spans
          trace_id: workflow.trace_id,
          entity_type: 'Workflow',
          entity_id: workflow.id,
          status: workflow.status,
          created_at: workflow.created_at,
          completed_at: workflow.completed_at,
          duration_ms: duration,
          metadata: {
            name: workflow.name,
            type: workflow.type,
            current_stage: workflow.current_stage,
            progress: workflow.progress
          }
        });
      }
    });

    // Add task spans
    tasks.forEach(task => {
      if (task.trace_id && task.span_id) {
        const duration = task.started_at && task.completed_at
          ? task.completed_at.getTime() - task.started_at.getTime()
          : null;

        spans.push({
          span_id: task.span_id,
          parent_span_id: task.parent_span_id,
          trace_id: task.trace_id,
          entity_type: 'Task',
          entity_id: task.task_id,
          status: task.status,
          created_at: task.assigned_at,
          completed_at: task.completed_at,
          duration_ms: duration,
          metadata: {
            agent_type: task.agent_type,
            retry_count: task.retry_count,
            workflow_id: task.workflow_id
          }
        });
      }
    });

    // Sort by created_at
    spans.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());

    return spans;
  }

  /**
   * Get trace metadata (summary information)
   */
  async getTraceMetadata(traceId: string): Promise<{
    trace_id: string;
    total_duration_ms: number | null;
    span_count: number;
    error_count: number;
    workflow_count: number;
    task_count: number;
    start_time: Date | null;
    end_time: Date | null;
  }> {
    try {
      const hierarchy = await this.getSpanHierarchy(traceId);

      const errorCount = hierarchy.spans.filter(s =>
        s.status === 'failed' || s.status === 'cancelled'
      ).length;

      const startTime = hierarchy.spans.length > 0
        ? hierarchy.spans[0].created_at
        : null;

      const endTime = hierarchy.spans.length > 0
        ? hierarchy.spans
            .filter(s => s.completed_at !== null)
            .sort((a, b) => (b.completed_at?.getTime() || 0) - (a.completed_at?.getTime() || 0))[0]?.completed_at || null
        : null;

      const totalDuration = startTime && endTime
        ? endTime.getTime() - startTime.getTime()
        : null;

      return {
        trace_id: traceId,
        total_duration_ms: totalDuration,
        span_count: hierarchy.spans.length,
        error_count: errorCount,
        workflow_count: hierarchy.workflows.length,
        task_count: hierarchy.tasks.length,
        start_time: startTime,
        end_time: endTime
      };
    } catch (error) {
      logger.error('Failed to get trace metadata', { trace_id: traceId, error });
      throw error;
    }
  }

  /**
   * Check if a trace exists
   */
  async traceExists(traceId: string): Promise<boolean> {
    try {
      const count = await this.prisma.workflow.count({
        where: {
          trace_id: traceId
        }
      });

      return count > 0;
    } catch (error) {
      logger.error('Failed to check if trace exists', { trace_id: traceId, error });
      throw error;
    }
  }
}
