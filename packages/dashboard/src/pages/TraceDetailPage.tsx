import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTrace } from '../hooks/useTraces'
import LoadingSpinner from '../components/Common/LoadingSpinner'
import ErrorDisplay from '../components/Common/ErrorDisplay'
import StatusBadge from '../components/Common/StatusBadge'
import { formatRelativeTime, truncateId } from '../utils/formatters'
import { TaskDetailsModal } from '../components/Traces/TaskDetailsModal'
import type { AgentTask } from '../types'

export default function TraceDetailPage() {
  const { traceId } = useParams<{ traceId: string }>()
  const { data: traceDetail, isLoading, error } = useTrace(traceId)
  const [selectedTask, setSelectedTask] = useState<AgentTask | null>(null)

  if (!traceId) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No trace ID provided</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center mb-6">
        <Link to="/traces" className="text-primary-600 hover:text-primary-900 mr-4">
          ← Back to Traces
        </Link>
        <h2 className="text-2xl font-bold text-gray-900">Trace Details</h2>
      </div>

      {isLoading ? (
        <LoadingSpinner size="lg" className="py-12" />
      ) : error ? (
        <ErrorDisplay error={error as Error} />
      ) : traceDetail ? (
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Trace ID</p>
                <p className="text-sm font-mono text-gray-900 break-all">{traceDetail.trace_id}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Status</p>
                <p className="text-sm text-gray-900">
                  {traceDetail.metadata?.end_time ? 'Completed' : 'In Progress'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Started</p>
                <p className="text-sm text-gray-900">
                  {traceDetail.metadata?.start_time
                    ? formatRelativeTime(traceDetail.metadata.start_time)
                    : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Duration</p>
                <p className="text-sm text-gray-900">
                  {traceDetail.metadata?.total_duration_ms
                    ? `${traceDetail.metadata.total_duration_ms}ms`
                    : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Metrics */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Metrics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="border rounded p-4">
                <p className="text-sm font-medium text-gray-500 mb-1">Workflows</p>
                <p className="text-2xl font-bold text-gray-900">{traceDetail.metadata?.workflow_count ?? 0}</p>
              </div>
              <div className="border rounded p-4">
                <p className="text-sm font-medium text-gray-500 mb-1">Tasks</p>
                <p className="text-2xl font-bold text-gray-900">{traceDetail.metadata?.task_count ?? 0}</p>
              </div>
              <div className="border rounded p-4">
                <p className="text-sm font-medium text-gray-500 mb-1">Spans</p>
                <p className="text-2xl font-bold text-gray-900">{traceDetail.metadata?.span_count ?? 0}</p>
              </div>
              <div className="border rounded p-4">
                <p className="text-sm font-medium text-gray-500 mb-1">Errors</p>
                <p className="text-2xl font-bold text-red-600">{traceDetail.metadata?.error_count ?? 0}</p>
              </div>
            </div>
          </div>

          {/* Workflows */}
          {traceDetail.hierarchy?.workflows && traceDetail.hierarchy.workflows.length > 0 && (
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Workflows ({traceDetail.hierarchy.workflows.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {traceDetail.hierarchy.workflows.map(workflow => (
                      <tr key={workflow.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm text-gray-900">{workflow.name}</td>
                        <td className="px-4 py-2 text-sm text-gray-500">{workflow.type}</td>
                        <td className="px-4 py-2 text-sm">
                          <StatusBadge status={workflow.status} />
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500">{workflow.priority}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tasks */}
          {traceDetail.hierarchy?.tasks && traceDetail.hierarchy.tasks.length > 0 && (
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Tasks ({traceDetail.hierarchy.tasks.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Task ID</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Agent Type</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {traceDetail.hierarchy.tasks.map(task => (
                      <tr key={task.task_id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm font-mono text-gray-900">{truncateId(task.task_id)}</td>
                        <td className="px-4 py-2 text-sm">
                          <code className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                            {task.agent_type}
                          </code>
                        </td>
                        <td className="px-4 py-2 text-sm">
                          <StatusBadge status={task.status} />
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          {task.completed_at && task.started_at
                            ? `${new Date(task.completed_at).getTime() - new Date(task.started_at).getTime()}ms`
                            : 'N/A'}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          <button
                            onClick={() => setSelectedTask(task)}
                            className="text-blue-600 hover:text-blue-900 font-medium"
                          >
                            Details →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Spans */}
          {traceDetail.hierarchy?.spans && traceDetail.hierarchy.spans.length > 0 && (
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Spans ({traceDetail.hierarchy.spans.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Span ID</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Entity</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {traceDetail.hierarchy.spans.slice(0, 20).map(span => (
                      <tr key={span.span_id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm font-mono text-gray-900">{truncateId(span.span_id)}</td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          {span.entity_type}: {truncateId(span.entity_id)}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500">{span.status}</td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          {span.duration_ms ? `${span.duration_ms}ms` : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {traceDetail.hierarchy.spans.length > 20 && (
                  <p className="mt-2 text-sm text-gray-500">
                    Showing 20 of {traceDetail.hierarchy.spans.length} spans
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500">Trace not found</p>
        </div>
      )}

      {/* Task Details Modal */}
      {selectedTask && (
        <TaskDetailsModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  )
}
