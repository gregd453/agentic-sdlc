import React, { useEffect, useState } from 'react'
import { fetchAgent, AgentMetadata } from '../../api/client'
import type { AgentTask } from '../../types'

interface TaskDetailsModalProps {
  task: AgentTask
  onClose: () => void
}

export const TaskDetailsModal: React.FC<TaskDetailsModalProps> = ({ task, onClose }) => {
  const [agentMetadata, setAgentMetadata] = useState<AgentMetadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadAgentMetadata = async () => {
      try {
        setLoading(true)
        const metadata = await fetchAgent(task.agent_type)
        setAgentMetadata(metadata)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load agent metadata')
      } finally {
        setLoading(false)
      }
    }

    loadAgentMetadata()
  }, [task.agent_type])

  const getDurationMs = (): number | null => {
    if (task.completed_at && task.started_at) {
      return new Date(task.completed_at).getTime() - new Date(task.started_at).getTime()
    }
    return null
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-6 py-4 flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Task Details</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Agent: <code className="bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded">{task.agent_type}</code>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Task Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Task Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Task ID</p>
                <p className="text-sm font-mono text-gray-900 dark:text-white break-all">{task.task_id}</p>
              </div>
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Workflow ID</p>
                <p className="text-sm font-mono text-gray-900 dark:text-white break-all">{task.workflow_id}</p>
              </div>
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Status</p>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  task.status === 'completed'
                    ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                    : task.status === 'failed'
                    ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                    : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                }`}>
                  {task.status}
                </span>
              </div>
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Priority</p>
                <p className="text-sm text-gray-900 dark:text-white font-medium">{task.priority}</p>
              </div>
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Duration</p>
                <p className="text-sm text-gray-900 dark:text-white">
                  {getDurationMs() !== null ? `${getDurationMs()}ms` : 'N/A'}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Retries</p>
                <p className="text-sm text-gray-900 dark:text-white">
                  {task.retry_count}/{task.max_retries}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Started</p>
                <p className="text-sm text-gray-900 dark:text-white">
                  {task.started_at ? new Date(task.started_at).toLocaleString() : 'N/A'}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Completed</p>
                <p className="text-sm text-gray-900 dark:text-white">
                  {task.completed_at ? new Date(task.completed_at).toLocaleString() : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Agent Metadata */}
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
            </div>
          ) : agentMetadata ? (
            <div className="space-y-4 border-t border-gray-200 dark:border-slate-700 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Agent Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Name</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{agentMetadata.name}</p>
                </div>
                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Version</p>
                  <p className="text-sm text-gray-900 dark:text-white">{agentMetadata.version}</p>
                </div>
                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Scope</p>
                  <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                    agentMetadata.scope === 'platform'
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                      : 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
                  }`}>
                    {agentMetadata.scope === 'platform' ? 'Platform' : 'Global'}
                  </span>
                </div>
                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Timeout</p>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {(agentMetadata.timeout_ms / 1000).toFixed(1)}s
                  </p>
                </div>
              </div>

              {agentMetadata.description && (
                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Description</p>
                  <p className="text-sm text-gray-900 dark:text-white">{agentMetadata.description}</p>
                </div>
              )}

              {agentMetadata.capabilities && agentMetadata.capabilities.length > 0 && (
                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Capabilities</p>
                  <div className="flex flex-wrap gap-2">
                    {agentMetadata.capabilities.map((cap, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                      >
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* Task Payload */}
          {task.payload && Object.keys(task.payload).length > 0 && (
            <div className="border-t border-gray-200 dark:border-slate-700 pt-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Task Payload</h3>
              <div className="bg-gray-50 dark:bg-slate-900/50 rounded-lg p-4 overflow-x-auto">
                <pre className="text-xs text-gray-900 dark:text-gray-100 font-mono">
                  {JSON.stringify(task.payload, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Task Result */}
          {task.result && Object.keys(task.result).length > 0 && (
            <div className="border-t border-gray-200 dark:border-slate-700 pt-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Task Result</h3>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 overflow-x-auto border border-green-200 dark:border-green-800">
                <pre className="text-xs text-gray-900 dark:text-gray-100 font-mono">
                  {JSON.stringify(task.result, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 dark:bg-slate-700/50 border-t border-gray-200 dark:border-slate-700 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
