import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useAgentStats, useTimeSeries } from '../hooks/useStats'
import LoadingSpinner from '../components/Common/LoadingSpinner'
import ErrorDisplay from '../components/Common/ErrorDisplay'
import ChartContainer from '../components/Common/ChartContainer'
import ProgressBar from '../components/Common/ProgressBar'
import { formatDuration } from '../utils/numberFormatters'
import { getAgentHealthStatus, AGENT_HEALTH_COLORS } from '../utils/agentHealth'

interface AgentMetrics {
  name: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  tasks_completed: number
  tasks_failed: number
  avg_duration_ms: number
  success_rate: number
  uptime_percentage: number
}

export default function AgentsPage() {
  const { data: agentStats, isLoading: statsLoading, error: statsError } = useAgentStats()
  const { data: timeSeriesData, isLoading: timeSeriesLoading } = useTimeSeries('24h')

  if (statsLoading) {
    return <LoadingSpinner size="lg" className="py-12" />
  }

  if (statsError) {
    return <ErrorDisplay error={statsError as Error} />
  }

  // Transform agent stats
  const agents: AgentMetrics[] = (agentStats || []).map((agent: any) => ({
    name: agent.agent_type || 'Unknown',
    status: getAgentHealthStatus(agent.avg_duration_ms),
    tasks_completed: agent.tasks_completed || 0,
    tasks_failed: agent.tasks_failed || 0,
    avg_duration_ms: agent.avg_duration_ms || 0,
    success_rate: agent.tasks_completed ? ((agent.tasks_completed / (agent.tasks_completed + (agent.tasks_failed || 0))) * 100) : 0,
    uptime_percentage: agent.uptime_percentage || 95
  }))

  // Prepare bar chart data - comparison of agents
  const agentComparisonData = agents.map(agent => ({
    name: agent.name,
    'Completed': agent.tasks_completed,
    'Failed': agent.tasks_failed,
  }))

  // Prepare latency time series
  const latencyData = timeSeriesData ? timeSeriesData.map((point: any) => {
    const timestamp = new Date(point.timestamp)
    return {
      time: timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      count: point.count || 0
    }
  }) : []

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Agent Performance</h2>
          <p className="text-gray-600 mt-1">Real-time monitoring of all active agents</p>
        </div>
      </div>

      {/* Agent Health Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {agents.map((agent) => (
          <div key={agent.name} className="bg-white rounded-lg shadow p-4 border-l-4" style={{ borderColor: AGENT_HEALTH_COLORS[agent.status] }}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 capitalize">{agent.name}</h3>
                <p className="text-xs text-gray-500 mt-1">
                  <span className={`inline-block w-2 h-2 rounded-full mr-1`} style={{ backgroundColor: AGENT_HEALTH_COLORS[agent.status] }}></span>
                  {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
                </p>
              </div>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">Success Rate</span>
                <span className="font-semibold text-gray-900">{agent.success_rate.toFixed(1)}%</span>
              </div>
              <ProgressBar value={agent.success_rate} showLabel={false} className="w-full h-1" />
              <div className="flex justify-between pt-1">
                <span className="text-gray-600">Avg Latency</span>
                <span className="font-semibold text-gray-900">{formatDuration(agent.avg_duration_ms)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tasks</span>
                <span className="font-semibold text-gray-900">{agent.tasks_completed}/{agent.tasks_completed + agent.tasks_failed}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Agent Task Comparison */}
        <ChartContainer
          title="Agent Task Completion"
          subtitle="Tasks completed vs failed by agent"
          height={300}
          isLoading={statsLoading}
        >
          {agentComparisonData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={agentComparisonData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Completed" fill="#10b981" />
                <Bar dataKey="Failed" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">No agent data available</div>
          )}
        </ChartContainer>

        {/* Throughput Over Time */}
        <ChartContainer
          title="System Throughput (24h)"
          subtitle="Workflow processing rate over time"
          height={300}
          isLoading={timeSeriesLoading}
        >
          {latencyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={latencyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">No throughput data available</div>
          )}
        </ChartContainer>
      </div>

      {/* Detailed Agent Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Agent Details</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Agent Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Completed
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Failed
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Success Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Latency
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Uptime
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {agents.length > 0 ? (
                agents.map((agent) => (
                  <tr key={agent.name} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 capitalize">
                      {agent.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: `${AGENT_HEALTH_COLORS[agent.status]}20`, color: AGENT_HEALTH_COLORS[agent.status] }}>
                        <span className="w-1.5 h-1.5 rounded-full mr-1" style={{ backgroundColor: AGENT_HEALTH_COLORS[agent.status] }}></span>
                        {agent.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {agent.tasks_completed}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={agent.tasks_failed > 0 ? 'text-red-600 font-semibold' : ''}>
                        {agent.tasks_failed}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="w-24">
                        <ProgressBar value={agent.success_rate} showLabel className="text-xs" />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      {formatDuration(agent.avg_duration_ms)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {agent.uptime_percentage.toFixed(1)}%
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                    No agent data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
