import React, { useEffect, useState } from 'react'
import { fetchPlatforms, fetchPlatformAnalytics } from '../api/client'
import type { PlatformAnalytics } from '../types'
import LoadingSpinner from '../components/Common/LoadingSpinner'
import ErrorDisplay from '../components/Common/ErrorDisplay'
import PageTransition from '../components/Animations/PageTransition'

interface Platform {
  id: string
  name: string
  layer: string
  description?: string
  enabled: boolean
  created_at?: string
  updated_at?: string
}

interface PlatformWithAnalytics extends Platform {
  analytics?: PlatformAnalytics
}

export const PlatformsPage: React.FC = () => {
  const [platforms, setPlatforms] = useState<PlatformWithAnalytics[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState('24h')

  useEffect(() => {
    loadPlatforms()
  }, [])

  useEffect(() => {
    loadAnalytics()
  }, [selectedPeriod])

  const loadPlatforms = async () => {
    try {
      setIsLoading(true)
      const data = await fetchPlatforms()
      setPlatforms(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load platforms')
    } finally {
      setIsLoading(false)
    }
  }

  const loadAnalytics = async () => {
    try {
      const updatedPlatforms = await Promise.all(
        platforms.map(async (platform) => {
          try {
            const analytics = await fetchPlatformAnalytics(platform.id, selectedPeriod)
            return { ...platform, analytics }
          } catch {
            return platform
          }
        })
      )
      setPlatforms(updatedPlatforms)
    } catch (err) {
      console.error('Failed to load platform analytics:', err)
    }
  }

  const getLayerColor = (layer: string): string => {
    switch (layer) {
      case 'APPLICATION':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'DATA':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      case 'INFRASTRUCTURE':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
      case 'ENTERPRISE':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
    }
  }

  if (isLoading) {
    return <LoadingSpinner />
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Platforms</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Manage and monitor multi-platform workflows ({platforms.length} platforms)
            </p>
          </div>

          {/* Period Selector */}
          <div className="flex gap-2">
            {['1h', '24h', '7d', '30d'].map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  selectedPeriod === period
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {period === '1h' ? '1H' : period === '24h' ? '24H' : period === '7d' ? '7D' : '30D'}
              </button>
            ))}
          </div>
        </div>

        {error && <ErrorDisplay error={error} retry={loadPlatforms} />}

        {/* Platforms Grid */}
        {platforms.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-gray-500 dark:text-gray-400">No platforms configured</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {platforms.map((platform) => (
              <div
                key={platform.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
              >
                {/* Platform Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                        {platform.name}
                      </h2>
                      {!platform.enabled && (
                        <span className="px-2 py-1 text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded">
                          Disabled
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {platform.description || 'No description'}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getLayerColor(platform.layer)}`}>
                    {platform.layer.charAt(0) + platform.layer.slice(1).toLowerCase()}
                  </span>
                </div>

                {/* Analytics */}
                {platform.analytics && (
                  <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {platform.analytics.total_workflows}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Total Workflows</div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                        <div className="text-2xl font-bold text-green-600">
                          {Math.round(platform.analytics.success_rate)}%
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Success Rate</div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {platform.analytics.completed_workflows} /{' '}
                          <span className="text-red-600">{platform.analytics.failed_workflows}</span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Completed / Failed</div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                        <div className="text-sm font-medium text-blue-600">
                          {platform.analytics.running_workflows}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Running</div>
                      </div>
                    </div>

                    {/* Avg Completion Time */}
                    {platform.analytics.avg_completion_time_ms !== null && (
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          Avg Completion: {formatDuration(platform.analytics.avg_completion_time_ms)}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Timestamps */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                  <div>
                    {platform.created_at && <span>Created: {formatDate(platform.created_at)}</span>}
                  </div>
                  <div>
                    {platform.updated_at && <span>Updated: {formatDate(platform.updated_at)}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  )
}

// Helper functions
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`
  }
  if (ms < 3600000) {
    return `${(ms / 60000).toFixed(1)}m`
  }
  return `${(ms / 3600000).toFixed(1)}h`
}
