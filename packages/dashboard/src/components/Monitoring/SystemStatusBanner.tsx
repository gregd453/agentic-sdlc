/**
 * SystemStatusBanner Component
 * Displays overall system health status with key indicators
 */

import { RealtimeMetrics } from '../../api/monitoring'

// Simple SVG icons
const HeartIcon = () => (
  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
    <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"/>
  </svg>
)

const ZapIcon = () => (
  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17a2 2 0 002 2h2.828l8.38-8.379-2.83-2.828z" clipRule="evenodd"/>
  </svg>
)

const ActivityIcon = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
  </svg>
)

interface SystemStatusBannerProps {
  metrics: RealtimeMetrics | null
  connectionStatus: 'connecting' | 'connected' | 'reconnecting' | 'polling' | 'disconnected' | 'error'
}

export default function SystemStatusBanner({ metrics, connectionStatus }: SystemStatusBannerProps) {
  if (!metrics) {
    return (
      <div className="bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">System Status</h3>
            <p className="text-gray-200 text-sm">Loading metrics...</p>
          </div>
          <div className="w-8 h-8 opacity-50 animate-pulse"><ActivityIcon /></div>
        </div>
      </div>
    )
  }

  // Safely extract overview data with null checks
  const overview = metrics?.overview?.overview || {
    total_workflows: 0,
    running_workflows: 0,
    completed_workflows: 0,
    failed_workflows: 0
  }
  const totalWorkflows = overview.total_workflows || 0
  const successRate = totalWorkflows > 0
    ? ((overview.completed_workflows / totalWorkflows) * 100).toFixed(1)
    : 0

  // Determine health status based on metrics
  const errorRate = metrics?.error_rate_percent || 0
  let healthStatus = 'healthy'
  let healthColor = 'from-green-500 to-green-600'
  let healthPercentage = 95

  if (errorRate > 10) {
    healthStatus = 'critical'
    healthColor = 'from-red-500 to-red-600'
    healthPercentage = Math.max(0, 100 - errorRate * 2)
  } else if (errorRate > 5) {
    healthStatus = 'warning'
    healthColor = 'from-yellow-500 to-yellow-600'
    healthPercentage = Math.max(0, 100 - errorRate)
  } else {
    healthPercentage = Math.max(85, 100 - errorRate)
  }

  return (
    <div className="space-y-4 mb-6">
      {/* Main Status Banner */}
      <div className={`bg-gradient-to-r ${healthColor} text-white rounded-lg p-6`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <HeartIcon />
              <h3 className="text-lg font-semibold capitalize">System Status: {healthStatus}</h3>
            </div>
            <p className="text-white/80 text-sm">
              {overview.running_workflows} active workflows • {successRate}% success rate
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{healthPercentage.toFixed(0)}%</div>
            <p className="text-white/80 text-xs">System Health</p>
          </div>
        </div>

        {/* Health Bar */}
        <div className="mt-4 bg-white/20 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full bg-white transition-all duration-300`}
            style={{ width: `${healthPercentage}%` }}
          />
        </div>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Active Workflows */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Active Workflows</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {overview.running_workflows}
              </p>
            </div>
            <div className="text-blue-500 opacity-20"><ZapIcon /></div>
          </div>
        </div>

        {/* Error Rate */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Error Rate</p>
              <p className={`text-2xl font-bold mt-1 ${
                errorRate > 5 ? 'text-red-500' : errorRate > 2 ? 'text-yellow-500' : 'text-green-500'
              }`}>
                {errorRate.toFixed(1)}%
              </p>
            </div>
            <div className="text-red-500 opacity-20"><ActivityIcon /></div>
          </div>
        </div>

        {/* Connection Status */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Connection</p>
              <p className={`text-sm font-semibold mt-2 capitalize inline-block px-2 py-1 rounded ${
                connectionStatus === 'connected' || connectionStatus === 'polling'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : connectionStatus === 'error' || connectionStatus === 'disconnected'
                  ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
              }`}>
                {connectionStatus === 'connected' ? '🟢 Live' : connectionStatus === 'polling' ? '🟡 Polling' : `🔄 ${connectionStatus}`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
