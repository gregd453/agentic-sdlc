/**
 * AgentHealthMatrix Component
 * Displays health status of each agent in a grid layout
 */

import { RealtimeMetrics } from '../../api/monitoring'

// Simple inline SVG icons
const CheckCircleIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
  </svg>
)

const AlertTriangleIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
  </svg>
)

const XCircleIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
  </svg>
)

interface AgentHealthMatrixProps {
  metrics: RealtimeMetrics | null
}

export default function AgentHealthMatrix({ metrics }: AgentHealthMatrixProps) {
  if (!metrics || Object.keys(metrics.agent_health).length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Agent Health</h3>
        <div className="flex items-center justify-center h-32 text-gray-500">
          No agent data available
        </div>
      </div>
    )
  }

  const agents = Object.entries(metrics.agent_health)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Agent Health</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map(([agentType, health]) => {
          const statusIcon =
            health.status === 'healthy' ? (
              <CheckCircleIcon className="w-5 h-5 text-green-500" />
            ) : health.status === 'degraded' ? (
              <AlertTriangleIcon className="w-5 h-5 text-yellow-500" />
            ) : (
              <XCircleIcon className="w-5 h-5 text-red-500" />
            )

          const successColor =
            health.success_rate >= 95
              ? 'text-green-600'
              : health.success_rate >= 90
              ? 'text-yellow-600'
              : 'text-red-600'

          return (
            <div
              key={agentType}
              className="p-4 rounded-lg border-2 transition-colors"
              style={{
                borderColor: health.status === 'healthy' ? '#10b981' : health.status === 'degraded' ? '#f59e0b' : '#ef4444',
                backgroundColor: health.status === 'healthy' ? '#f0fdf4' : health.status === 'degraded' ? '#fffbeb' : '#fef2f2'
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2 flex-1">
                  {statusIcon}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {agentType}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {health.status.charAt(0).toUpperCase() + health.status.slice(1)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Completed:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {health.tasks_completed}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Failed:</span>
                  <span className={`font-semibold ${health.tasks_failed > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {health.tasks_failed}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Success Rate:</span>
                  <span className={`font-semibold ${successColor}`}>
                    {health.success_rate.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-600">
                  <span className="text-gray-600 dark:text-gray-400">Avg Latency:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {health.avg_latency_ms.toFixed(0)}ms
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary */}
      {agents.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400">
          <p>Total agents: <span className="font-semibold text-gray-900 dark:text-white">{agents.length}</span></p>
        </div>
      )}
    </div>
  )
}
