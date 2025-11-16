import { Link } from 'react-router-dom'
import { PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useStats, useTimeSeries } from '../hooks/useStats'
import { useWorkflows } from '../hooks/useWorkflows'
import LoadingSpinner from '../components/Common/LoadingSpinner'
import ErrorDisplay from '../components/Common/ErrorDisplay'
import StatusBadge from '../components/Common/StatusBadge'
import ChartContainer from '../components/Common/ChartContainer'
import { formatRelativeTime } from '../utils/formatters'
import { statusColors } from '../utils/chartColorMap'

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading, error: statsError } = useStats()
  const { data: runningWorkflows, isLoading: workflowsLoading } = useWorkflows({ status: 'running' })
  const { data: timeSeriesData, isLoading: timeSeriesLoading } = useTimeSeries('24h')

  if (statsLoading) {
    return <LoadingSpinner size="lg" className="py-12" />
  }

  if (statsError) {
    return <ErrorDisplay error={statsError as Error} />
  }

  const overview = stats?.overview

  // Prepare status distribution data for pie chart
  const statusDistributionData = overview ? [
    { name: 'Completed', value: overview.completed_workflows },
    { name: 'Running', value: overview.running_workflows },
    { name: 'Failed', value: overview.failed_workflows },
    { name: 'Paused', value: overview.paused_workflows || 0 },
  ].filter(item => item.value > 0) : []

  // Prepare throughput data for area chart
  const throughputData = timeSeriesData ? timeSeriesData.map((point: any) => ({
    timestamp: new Date(point.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    count: point.count || 0
  })) : []

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard Overview</h2>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <MetricCard
          title="Total Workflows"
          value={overview?.total_workflows || 0}
          color="blue"
        />
        <MetricCard
          title="Running"
          value={overview?.running_workflows || 0}
          color="blue"
        />
        <MetricCard
          title="Completed"
          value={overview?.completed_workflows || 0}
          color="green"
        />
        <MetricCard
          title="Failed"
          value={overview?.failed_workflows || 0}
          color="red"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Status Distribution Chart */}
        <ChartContainer
          title="Workflow Status Distribution"
          subtitle="Current distribution of workflow statuses"
          height={300}
          isLoading={statsLoading}
        >
          {statusDistributionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusDistributionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusDistributionData.map((entry: any) => (
                    <Cell key={`cell-${entry.name}`} fill={statusColors[entry.name.toLowerCase() as keyof typeof statusColors] || '#gray'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">No workflow data available</div>
          )}
        </ChartContainer>

        {/* Workflow Throughput Chart */}
        <ChartContainer
          title="Workflow Throughput (24h)"
          subtitle="Workflow creation rate over the last 24 hours"
          height={300}
          isLoading={timeSeriesLoading}
        >
          {throughputData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={throughputData}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCount)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">No time series data available</div>
          )}
        </ChartContainer>
      </div>

      {/* Active Workflows Table */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Active Workflows
          </h3>
        </div>
        <div className="overflow-x-auto">
          {workflowsLoading ? (
            <LoadingSpinner className="py-8" />
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {runningWorkflows && runningWorkflows.length > 0 ? (
                  runningWorkflows.slice(0, 10).map((workflow) => (
                    <tr key={workflow.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {workflow.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <StatusBadge status={workflow.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {workflow.current_stage}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatRelativeTime(workflow.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Link
                          to={`/workflows/${workflow.id}`}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                      No active workflows
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

interface MetricCardProps {
  title: string
  value: number
  color: 'blue' | 'green' | 'red' | 'yellow'
}

function MetricCard({ title, value, color }: MetricCardProps) {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
  }

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className={`rounded-md p-3 ${colorClasses[color]}`}>
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
              <dd className="text-3xl font-semibold text-gray-900">{value}</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
