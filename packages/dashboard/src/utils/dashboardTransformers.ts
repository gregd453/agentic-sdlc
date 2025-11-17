/**
 * Dashboard data transformation utilities
 * Converts raw API data into chart-ready formats
 */

/**
 * Transform overview stats into status distribution data for pie chart
 * @param overview Dashboard overview stats
 * @returns Array of status distribution data points
 */
export function transformStatusDistribution(overview: {
  completed_workflows: number
  running_workflows: number
  failed_workflows: number
  paused_workflows?: number
}) {
  return [
    { name: 'Completed', value: overview.completed_workflows },
    { name: 'Running', value: overview.running_workflows },
    { name: 'Failed', value: overview.failed_workflows },
    { name: 'Paused', value: overview.paused_workflows || 0 },
  ].filter(item => item.value > 0)
}

/**
 * Transform time series data into throughput chart format
 * @param timeSeriesData Raw time series data points
 * @returns Formatted throughput data for area chart
 */
export function transformThroughputData(timeSeriesData: Array<{
  timestamp: string
  count?: number
}>) {
  return timeSeriesData.map((point) => ({
    timestamp: new Date(point.timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    }),
    count: point.count || 0
  }))
}

/**
 * Transform agent comparison data for bar chart
 * @param agents Array of agent stats
 * @returns Formatted data for bar chart
 */
export function transformAgentComparison(agents: Array<{
  name: string
  tasks_completed: number
  tasks_failed: number
}>) {
  return agents.map(agent => ({
    name: agent.name,
    'Completed': agent.tasks_completed,
    'Failed': agent.tasks_failed,
  }))
}

/**
 * Transform latency time series for line chart
 * @param timeSeriesData Raw time series data
 * @returns Formatted latency data
 */
export function transformLatencyTimeSeries(timeSeriesData: Array<{
  timestamp: string
  count?: number
}>) {
  return timeSeriesData.map((point) => {
    const timestamp = new Date(point.timestamp)
    return {
      time: timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      count: point.count || 0
    }
  })
}
