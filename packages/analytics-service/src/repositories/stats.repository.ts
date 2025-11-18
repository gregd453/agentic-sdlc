import { PrismaClient } from '@prisma/client'
import { logger } from '../utils/logger'

export interface OverviewStats {
  total_workflows: number
  running_workflows: number
  completed_workflows: number
  failed_workflows: number
  cancelled_workflows: number
  paused_workflows: number
}

export interface AgentStats {
  agent_type: string
  total_tasks: number
  completed_tasks: number
  failed_tasks: number
  cancelled_tasks: number
  avg_duration_ms: number
  avg_retries: number
  success_rate: number
}

export interface TimeSeriesDataPoint {
  timestamp: Date
  count: number
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
      })

      const stats: OverviewStats = {
        total_workflows: 0,
        running_workflows: 0,
        completed_workflows: 0,
        failed_workflows: 0,
        cancelled_workflows: 0,
        paused_workflows: 0
      }

      result.forEach((row: any) => {
        const count = row._count.id
        stats.total_workflows += count

        switch (row.status) {
          case 'running':
            stats.running_workflows = count
            break
          case 'completed':
            stats.completed_workflows = count
            break
          case 'failed':
            stats.failed_workflows = count
            break
          case 'cancelled':
            stats.cancelled_workflows = count
            break
          case 'paused':
            stats.paused_workflows = count
            break
        }
      })

      logger.debug('Overview stats retrieved', { stats })
      return stats
    } catch (error) {
      logger.error('Failed to get overview stats', { error })
      throw error
    }
  }

  /**
   * Get agent performance statistics
   */
  async getAgentStats(): Promise<AgentStats[]> {
    try {
      const result = await this.prisma.agentTask.groupBy({
        by: ['agent_type'],
        _count: {
          id: true
        },
        _avg: {
          retry_count: true
        }
      })

      const agentStats: AgentStats[] = []

      for (const row of result) {
        const agentType = row.agent_type

        // Get status breakdown for this agent type
        const statusBreakdown = await this.prisma.agentTask.groupBy({
          by: ['status'],
          where: {
            agent_type: agentType
          },
          _count: {
            id: true
          }
        })

        // Calculate duration stats
        const durationStats = await this.prisma.$queryRaw<Array<{ avg_duration: number | null }>>`
          SELECT
            AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000)::float as avg_duration
          FROM "AgentTask"
          WHERE agent_type = ${agentType}
            AND started_at IS NOT NULL
            AND completed_at IS NOT NULL
        `

        const completedTasks = statusBreakdown.find((s: any) => s.status === 'completed')?._count.id || 0
        const failedTasks = statusBreakdown.find((s: any) => s.status === 'failed')?._count.id || 0
        const cancelledTasks = statusBreakdown.find((s: any) => s.status === 'cancelled')?._count.id || 0
        const totalTasks = row._count.id

        agentStats.push({
          agent_type: agentType,
          total_tasks: totalTasks,
          completed_tasks: completedTasks,
          failed_tasks: failedTasks,
          cancelled_tasks: cancelledTasks,
          avg_duration_ms: durationStats[0]?.avg_duration || 0,
          avg_retries: row._avg.retry_count || 0,
          success_rate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
        })
      }

      logger.debug('Agent stats retrieved', { count: agentStats.length })
      return agentStats
    } catch (error) {
      logger.error('Failed to get agent stats', { error })
      throw error
    }
  }

  /**
   * Get time series data for workflows created over time
   * @param period - Time period: '1h', '24h', '7d', '30d'
   */
  async getTimeSeriesData(period: string): Promise<TimeSeriesDataPoint[]> {
    try {
      let interval: string
      let timeFilter: Date

      const now = new Date()

      switch (period) {
        case '1h':
          interval = '5 minutes'
          timeFilter = new Date(now.getTime() - 60 * 60 * 1000)
          break
        case '24h':
          interval = '1 hour'
          timeFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          break
        case '7d':
          interval = '6 hours'
          timeFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case '30d':
          interval = '1 day'
          timeFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        default:
          interval = '1 hour'
          timeFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      }

      const result = await this.prisma.$queryRaw<Array<{ timestamp: Date; count: bigint }>>`
        SELECT
          DATE_TRUNC(${interval}, created_at) as timestamp,
          COUNT(*)::bigint as count
        FROM "Workflow"
        WHERE created_at >= ${timeFilter}
        GROUP BY DATE_TRUNC(${interval}, created_at)
        ORDER BY timestamp ASC
      `

      const data = result.map((row: any) => ({
        timestamp: row.timestamp,
        count: Number(row.count)
      }))

      logger.debug('Time series data retrieved', { period, count: data.length })
      return data
    } catch (error) {
      logger.error('Failed to get time series data', { error, period })
      throw error
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
      })

      const statsByType: Record<string, { total: number; completed: number; failed: number }> = {}

      result.forEach((row: any) => {
        const type = row.type
        if (!statsByType[type]) {
          statsByType[type] = { total: 0, completed: 0, failed: 0 }
        }

        const count = row._count.id
        statsByType[type].total += count

        if (row.status === 'completed') {
          statsByType[type].completed += count
        } else if (row.status === 'failed') {
          statsByType[type].failed += count
        }
      })

      logger.debug('Workflow stats by type retrieved', { types: Object.keys(statsByType) })
      return statsByType
    } catch (error) {
      logger.error('Failed to get workflow stats by type', { error })
      throw error
    }
  }
}
