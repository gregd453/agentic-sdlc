import { useParams, Link } from 'react-router-dom'
import { useWorkflow, useWorkflowTimeline } from '../hooks/useWorkflows'
import LoadingSpinner from '../components/Common/LoadingSpinner'
import ErrorDisplay from '../components/Common/ErrorDisplay'
import StatusBadge from '../components/Common/StatusBadge'
import ProgressBar from '../components/Common/ProgressBar'
import { formatDate, formatRelativeTime, truncateId } from '../utils/formatters'

export default function WorkflowPage() {
  const { id } = useParams<{ id: string }>()
  const { data: workflow, isLoading: workflowLoading, error: workflowError } = useWorkflow(id)
  const { data: timeline, isLoading: timelineLoading } = useWorkflowTimeline(id)

  if (workflowLoading) {
    return <LoadingSpinner size="lg" className="py-12" />
  }

  if (workflowError || !workflow) {
    return <ErrorDisplay error={workflowError as Error || 'Workflow not found'} />
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">{workflow.name}</h2>
          <StatusBadge status={workflow.status} />
        </div>
        <p className="mt-2 text-sm text-gray-500">{workflow.description}</p>
      </div>

      {/* Progress */}
      <div className="mb-8">
        <ProgressBar value={workflow.progress} className="w-full" />
      </div>

      {/* Metadata Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        <MetadataCard label="ID" value={truncateId(workflow.id, 12)} />
        <MetadataCard label="Type" value={<span className="capitalize">{workflow.type}</span>} />
        <MetadataCard label="Priority" value={<span className="capitalize">{workflow.priority}</span>} />
        <MetadataCard label="Current Stage" value={workflow.current_stage} />
        <MetadataCard
          label="Trace ID"
          value={
            workflow.trace_id ? (
              <Link to={`/traces/${workflow.trace_id}`} className="text-primary-600 hover:text-primary-900 font-mono">
                {truncateId(workflow.trace_id)}
              </Link>
            ) : (
              'N/A'
            )
          }
        />
        <MetadataCard label="Created" value={formatDate(workflow.created_at)} />
        <MetadataCard label="Updated" value={formatRelativeTime(workflow.updated_at)} />
        <MetadataCard
          label="Completed"
          value={workflow.completed_at ? formatDate(workflow.completed_at) : 'N/A'}
        />
        <MetadataCard label="Created By" value={workflow.created_by} />
      </div>

      {/* Tasks Table */}
      <div className="bg-white shadow rounded-lg mb-8">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Tasks</h3>
        </div>
        <div className="overflow-x-auto">
          {timelineLoading ? (
            <LoadingSpinner className="py-8" />
          ) : timeline?.tasks && timeline.tasks.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Task ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Agent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Retries
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {timeline.tasks.map((task) => (
                  <tr key={task.task_id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      {truncateId(task.task_id)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {task.agent_type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <StatusBadge status={task.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatRelativeTime(task.assigned_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {task.retry_count} / {task.max_retries}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-6 py-4 text-center text-sm text-gray-500">No tasks yet</div>
          )}
        </div>
      </div>

      {/* Events Log */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Events</h3>
        </div>
        <div className="p-6">
          {timelineLoading ? (
            <LoadingSpinner />
          ) : timeline?.events && timeline.events.length > 0 ? (
            <div className="space-y-4">
              {timeline.events.map((event) => (
                <div key={event.id} className="border-l-2 border-gray-200 pl-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{event.event_type}</p>
                      <p className="text-xs text-gray-500 mt-1">{formatDate(event.timestamp)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-sm text-gray-500">No events yet</div>
          )}
        </div>
      </div>
    </div>
  )
}

interface MetadataCardProps {
  label: string
  value: React.ReactNode
}

function MetadataCard({ label, value }: MetadataCardProps) {
  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <dt className="text-sm font-medium text-gray-500 truncate">{label}</dt>
        <dd className="mt-1 text-sm text-gray-900">{value}</dd>
      </div>
    </div>
  )
}
