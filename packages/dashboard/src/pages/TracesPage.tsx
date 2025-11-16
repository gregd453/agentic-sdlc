import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import LoadingSpinner from '../components/Common/LoadingSpinner'
import ErrorDisplay from '../components/Common/ErrorDisplay'
import StatusBadge from '../components/Common/StatusBadge'
import { formatRelativeTime, truncateId } from '../utils/formatters'

interface TraceItem {
  trace_id: string
  status: string
  started_at: string
  completed_at?: string
  duration_ms: number
  span_count: number
  workflow_id?: string
}

export default function TracesPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [pageSize, setPageSize] = useState(20)

  // Fetch traces - note: using a placeholder fetch since traces endpoint may not be fully implemented
  const { data: traces, isLoading, error } = useQuery({
    queryKey: ['traces', statusFilter, pageSize],
    queryFn: async () => {
      try {
        const params = new URLSearchParams()
        if (statusFilter) params.append('status', statusFilter)
        params.append('limit', pageSize.toString())
        const url = `http://localhost:3000/api/v1/traces?${params}`
        const response = await fetch(url)
        if (!response.ok) return []
        return response.json()
      } catch {
        return []
      }
    },
    refetchInterval: 15000,
  })

  // Filter traces based on search query
  const filteredTraces = useMemo(() => {
    if (!traces) return []
    return traces.filter((trace: TraceItem) =>
      trace.trace_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trace.workflow_id?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [traces, searchQuery])

  const statuses = ['initiated', 'running', 'completed', 'failed']

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Distributed Traces</h2>
          <p className="text-gray-600 mt-1">View and analyze request traces across all services</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white shadow rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search Input */}
          <div className="md:col-span-2">
            <label htmlFor="trace-search" className="block text-sm font-medium text-gray-700 mb-1">
              Search Traces
            </label>
            <input
              id="trace-search"
              type="text"
              placeholder="Search by trace ID or workflow ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label htmlFor="trace-status" className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              id="trace-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border"
            >
              <option value="">All Statuses</option>
              {statuses.map(status => (
                <option key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Page Size Control */}
        <div className="mt-4 flex items-center">
          <label htmlFor="page-size" className="text-sm font-medium text-gray-700 mr-2">
            Show
          </label>
          <select
            id="page-size"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-1 border"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className="text-sm text-gray-600 ml-2">traces</span>
        </div>
      </div>

      {/* Traces List */}
      {isLoading ? (
        <LoadingSpinner size="lg" className="py-12" />
      ) : error ? (
        <ErrorDisplay error={error as Error} />
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Traces {filteredTraces.length > 0 && `(${filteredTraces.length})`}
            </h3>
          </div>

          {filteredTraces.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Trace ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Workflow ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Spans
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Started
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTraces.map((trace: TraceItem) => (
                    <tr key={trace.trace_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        <code className="text-xs">{truncateId(trace.trace_id)}</code>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {trace.workflow_id ? (
                          <Link
                            to={`/workflows/${trace.workflow_id}`}
                            className="text-primary-600 hover:text-primary-900"
                          >
                            {truncateId(trace.workflow_id)}
                          </Link>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <StatusBadge status={trace.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {trace.span_count} spans
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        {trace.duration_ms}ms
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatRelativeTime(trace.started_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Link
                          to={`/traces/${trace.trace_id}`}
                          className="text-primary-600 hover:text-primary-900 font-medium"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-12 text-center">
              <p className="text-gray-500">
                {searchQuery || statusFilter
                  ? 'No traces match your search criteria'
                  : 'No traces available'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>About Traces:</strong> Traces show the complete execution path of a workflow across all services.
          Each trace contains multiple spans representing individual service calls. Click on a trace to see detailed span
          timing and dependencies.
        </p>
      </div>
    </div>
  )
}
