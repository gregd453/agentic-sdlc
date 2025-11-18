import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

export interface OverviewStats {
  total_workflows: number;
  initiated_workflows: number;
  running_workflows: number;
  completed_workflows: number;
  failed_workflows: number;
  cancelled_workflows: number;
  paused_workflows: number;
}

export interface AgentStats {
  agent_type: string;
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  cancelled_tasks: number;
  avg_duration_ms: number;
  avg_retries: number;
  success_rate: number;
}

export interface TimeSeriesDataPoint {
  timestamp: Date;
  count: number;
}

export class StatsRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get overview statistics for all workflows
   */
  async getOverviewStats(): Promise<OverviewStats> {
    try {
      const result = await this.prisma.workflow.groupBy({
        by: ['status'],
        _count: {
          id: true
        }
      });

      const stats: OverviewStats = {
        total_workflows: 0,
        initiated_workflows: 0,
        running_workflows: 0,
        completed_workflows: 0,
        failed_workflows: 0,
        cancelled_workflows: 0,
        paused_workflows: 0
      };

      result.forEach(row => {
        const count = row._count.id;
        stats.total_workflows += count;

        switch (row.status) {
          case WORKFLOW_STATUS.INITIATED:
            stats.initiated_workflows = count;
            break;
          case WORKFLOW_STATUS.RUNNING:
            stats.running_workflows = count;
            break;
          case WORKFLOW_STATUS.COMPLETED:
            stats.completed_workflows = count;
            break;
          case WORKFLOW_STATUS.FAILED:
            stats.failed_workflows = count;
            break;
          case WORKFLOW_STATUS.CANCELLED:
            stats.cancelled_workflows = count;
            break;
          case 'paused':
            stats.paused_workflows = count;
            break;
        }
      });

      logger.debug('Overview stats retrieved', { stats });
      return stats;
    } catch (error) {
      logger.error('Failed to get overview stats', { error });
      throw error;
    }
  }

  /**
   * Get agent performance statistics
   */
  async getAgentStats(): Promise<AgentStats[]> {
    try {
      // Use a single raw query to get all agent stats in one go
      const result = await this.prisma.$queryRaw<Array<{
        agent_type: string;
        total_tasks: bigint;
        completed_tasks: bigint;
        failed_tasks: bigint;
        cancelled_tasks: bigint;
        avg_duration_ms: number | null;
        avg_retries: number | null;
      }>>`
        SELECT
          agent_type,
          COUNT(*) as total_tasks,
          COALESCE(SUM(CASE WHEN status = WORKFLOW_STATUS.COMPLETED THEN 1 ELSE 0 END), 0) as completed_tasks,
          COALESCE(SUM(CASE WHEN status = WORKFLOW_STATUS.FAILED THEN 1 ELSE 0 END), 0) as failed_tasks,
          COALESCE(SUM(CASE WHEN status = WORKFLOW_STATUS.CANCELLED THEN 1 ELSE 0 END), 0) as cancelled_tasks,
          AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000)::float as avg_duration_ms,
          AVG(retry_count)::float as avg_retries
        FROM "AgentTask"
        WHERE agent_type IS NOT NULL
        GROUP BY agent_type
        ORDER BY total_tasks DESC
      `;

      const agentStats: AgentStats[] = result.map(row => {
        const totalTasks = Number(row.total_tasks);
        const completedTasks = Number(row.completed_tasks);

        return {
          agent_type: row.agent_type,
          total_tasks: totalTasks,
          completed_tasks: completedTasks,
          failed_tasks: Number(row.failed_tasks),
          cancelled_tasks: Number(row.cancelled_tasks),
          avg_duration_ms: row.avg_duration_ms || 0,
          avg_retries: row.avg_retries || 0,
          success_rate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
        };
      });

      logger.debug('Agent stats retrieved', { count: agentStats.length });
      return agentStats;
    } catch (error) {
      logger.error('Failed to get agent stats', { error });
      throw error;
    }
  }

  /**
   * Get time series data for workflows created over time
   * @param period - Time period: '1h', '24h', '7d', '30d'
   */
  async getTimeSeriesData(period: string): Promise<TimeSeriesDataPoint[]> {
    try {
      let timeFilter: Date;
      const now = new Date();

      switch (period) {
        case '1h':
          timeFilter = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case '24h':
          timeFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          timeFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          timeFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          timeFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      // Get all workflows in the period and group by date in JavaScript
      let workflows: Array<{ created_at: Date }> = [];
      try {
        workflows = await this.prisma.workflow.findMany({
          where: {
            created_at: {
              gte: timeFilter
            }
          },
          select: {
            created_at: true
          },
          orderBy: {
            created_at: 'asc'
          }
        });
      } catch (dbError) {
        logger.warn('Failed to fetch workflows from database, returning empty data', { dbError, period });
        return [];
      }

      // Group workflows by date/hour
      const grouped = new Map<string, number>();

      workflows.forEach(workflow => {
        const date = new Date(workflow.created_at);
        // Round down to hour
        date.setMinutes(0, 0, 0);
        const key = date.toISOString();

        grouped.set(key, (grouped.get(key) || 0) + 1);
      });

      // Convert to array and sort
      const data = Array.from(grouped, ([timestamp, count]) => ({
        timestamp: new Date(timestamp),
        count
      })).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      logger.debug('Time series data retrieved', { period, count: data.length });
      return data;
    } catch (error) {
      logger.error('Failed to get time series data', { error, period });
      throw error;
    }
  }

  /**
   * Get workflow statistics grouped by type
   */
  async getWorkflowStatsByType(): Promise<Record<string, { total: number; completed: number; failed: number }>> {
    try {
      const result = await this.prisma.workflow.groupBy({
        by: ['type', 'status'],
        _count: {
          id: true
        }
      });

      const statsByType: Record<string, { total: number; completed: number; failed: number }> = {};

      result.forEach(row => {
        const type = row.type;
        if (!statsByType[type]) {
          statsByType[type] = { total: 0, completed: 0, failed: 0 };
        }

        const count = row._count.id;
        statsByType[type].total += count;

        if (row.status === WORKFLOW_STATUS.COMPLETED) {
          statsByType[type].completed += count;
        } else if (row.status === WORKFLOW_STATUS.FAILED) {
          statsByType[type].failed += count;
        }
      });

      logger.debug('Workflow stats by type retrieved', { types: Object.keys(statsByType) });
      return statsByType;
    } catch (error) {
      logger.error('Failed to get workflow stats by type', { error });
      throw error;
    }
  }
}
