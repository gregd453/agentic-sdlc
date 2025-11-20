import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useWorkflows } from '../hooks/useWorkflows'
import LoadingSpinner from '../components/Common/LoadingSpinner'
import ErrorDisplay from '../components/Common/ErrorDisplay'
import StatusBadge from '../components/Common/StatusBadge'
import ProgressBar from '../components/Common/ProgressBar'
import CreateMockWorkflowModal from '../components/Workflows/CreateMockWorkflowModal'
import { formatRelativeTime, truncateId, calculateProgressFromStage } from '../utils/format'

export default function WorkflowsPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  const filters = {
    ...(statusFilter && { status: statusFilter }),
    ...(typeFilter && { type: typeFilter }),
  }

  const { data: workflows, isLoading, error, refetch } = useWorkflows(
    Object.keys(filters).length > 0 ? filters : undefined
  )

  const handleWorkflowCreated = (workflowId: string) => {
    // Refetch workflows and navigate to the new workflow
    refetch()
    navigate(`/workflows/${workflowId}`)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Workflows</h2>
        <div className="flex gap-3">
          <a
            href="/workflows/pipeline"
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-medium"
          >
            🏗️ Pipeline Builder (Phase 3)
          </a>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
          >
            + Create Mock Workflow
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-4">
        <div>
          <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="block w-48 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          >
            <option key="status-all" value="">All</option>
            <option key="status-running" value="running">Running</option>
            <option key="status-completed" value="completed">Completed</option>
            <option key="status-failed" value="failed">Failed</option>
            <option key="status-paused" value="paused">Paused</option>
            <option key="status-cancelled" value="cancelled">Cancelled</option>
          </select>
        </div>

        <div>
          <label htmlFor="type-filter" className="block text-sm font-medium text-gray-700 mb-1">
            Type
          </label>
          <select
            id="type-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="block w-48 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          >
            <option key="type-all" value="">All</option>
            <option key="type-app" value="app">App</option>
            <option key="type-feature" value="feature">Feature</option>
            <option key="type-bugfix" value="bugfix">Bugfix</option>
          </select>
        </div>
      </div>

      {/* Workflows Table */}
      {isLoading ? (
        <LoadingSpinner size="lg" className="py-12" />
      ) : error ? (
        <ErrorDisplay error={error as Error} retry={refetch} />
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stage
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Progress
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trace ID
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
              {workflows && workflows.length > 0 ? (
                workflows.map((workflow) => (
                  <tr key={workflow.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {workflow.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="capitalize">{workflow.type}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <StatusBadge status={workflow.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {workflow.current_stage}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <ProgressBar
                        value={workflow.progress > 0 ? workflow.progress : calculateProgressFromStage(workflow.current_stage, workflow.type)}
                        showLabel
                        className="w-24"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {workflow.trace_id ? (
                        <Link
                          to={`/traces/${workflow.trace_id}`}
                          className="text-primary-600 hover:text-primary-900 font-mono"
                        >
                          {truncateId(workflow.trace_id)}
                        </Link>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
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
                  <td colSpan={8} className="px-6 py-4 text-center text-sm text-gray-500">
                    No workflows found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Mock Workflow Modal */}
      <CreateMockWorkflowModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onWorkflowCreated={handleWorkflowCreated}
      />
    </div>
  )
}
