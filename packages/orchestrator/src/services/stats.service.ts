import { StatsRepository, OverviewStats, AgentStats, TimeSeriesDataPoint } from '../repositories/stats.repository';
import { logger } from '../utils/logger';

export interface DashboardOverview {
  overview: OverviewStats;
  recent_workflows_count: number;
  avg_completion_time_ms: number | null;
}

export class StatsService {
  constructor(private repository: StatsRepository) {}

  /**
   * Get dashboard overview statistics
   */
  async getOverview(): Promise<DashboardOverview> {
    try {
      logger.debug('Getting dashboard overview');

      const overview = await this.repository.getOverviewStats();

      // Calculate average completion time (simplified for now)
      const avgCompletionTime = null; // TODO: Implement if needed

      const recentWorkflowsCount = overview.running_workflows + overview.paused_workflows;

      return {
        overview,
        recent_workflows_count: recentWorkflowsCount,
        avg_completion_time_ms: avgCompletionTime
      };
    } catch (error) {
      logger.error('Failed to get dashboard overview', { error });
      throw error;
    }
  }

  /**
   * Get agent performance statistics with derived metrics
   */
  async getAgentPerformance(): Promise<AgentStats[]> {
    try {
      logger.debug('Getting agent performance stats');

      const stats = await this.repository.getAgentStats();

      // Stats already include success_rate calculation
      // Sort by total tasks descending
      stats.sort((a, b) => b.total_tasks - a.total_tasks);

      return stats;
    } catch (error) {
      logger.error('Failed to get agent performance', { error });
      throw error;
    }
  }

  /**
   * Get time series data with period validation
   */
  async getTimeSeries(period: string = '24h'): Promise<TimeSeriesDataPoint[]> {
    try {
      // Validate period
      const validPeriods = ['1h', '24h', '7d', '30d'];
      if (!validPeriods.includes(period)) {
        logger.warn('Invalid time series period requested', { period, valid: validPeriods });
        throw new Error(`Invalid period: ${period}. Must be one of: ${validPeriods.join(', ')}`);
      }

      logger.debug('Getting time series data', { period });

      const data = await this.repository.getTimeSeriesData(period);

      return data;
    } catch (error) {
      logger.error('Failed to get time series data', { error, period });
      throw error;
    }
  }

  /**
   * Get workflow statistics grouped by type
   */
  async getWorkflowStats(): Promise<Record<string, { total: number; completed: number; failed: number; success_rate: number }>> {
    try {
      logger.debug('Getting workflow stats');

      const statsByType = await this.repository.getWorkflowStatsByType();

      // Add success rate calculation
      const enrichedStats: Record<string, { total: number; completed: number; failed: number; success_rate: number }> = {};

      Object.entries(statsByType).forEach(([type, stats]) => {
        enrichedStats[type] = {
          ...stats,
          success_rate: stats.total > 0 ? (stats.completed / stats.total) * 100 : 0
        };
      });

      return enrichedStats;
    } catch (error) {
      logger.error('Failed to get workflow stats', { error });
      throw error;
    }
  }

  /**
   * Get agent statistics for a specific agent type
   */
  async getAgentStatsByType(agentType: string): Promise<AgentStats | null> {
    try {
      logger.debug('Getting agent stats by type', { agent_type: agentType });

      const allStats = await this.repository.getAgentStats();
      const agentStats = allStats.find(s => s.agent_type === agentType);

      if (!agentStats) {
        logger.warn('No stats found for agent type', { agent_type: agentType });
        return null;
      }

      return agentStats;
    } catch (error) {
      logger.error('Failed to get agent stats by type', { error, agent_type: agentType });
      throw error;
    }
  }
}
