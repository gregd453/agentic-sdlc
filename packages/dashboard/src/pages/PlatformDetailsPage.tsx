import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchPlatform, fetchPlatformAnalytics, fetchPlatformAgents, AgentMetadata } from '../api/client'
import { formatDate, formatDuration } from '../utils/formatters'
import { getPlatformLayerColor, formatLayerName } from '../utils/platformColors'
import { logger } from '../utils/logger'
import LoadingSpinner from '../components/Common/LoadingSpinner'
import ErrorDisplay from '../components/Common/ErrorDisplay'
import PageTransition from '../components/Animations/PageTransition'
import { AgentMatrixTable } from '../components/Platforms/AgentMatrixTable'

interface Platform {
  id: string
  name: string
  layer: string
  description?: string
  enabled: boolean
  created_at?: string
  updated_at?: string
}

export const PlatformDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [platform, setPlatform] = useState<Platform | null>(null)
  const [agents, setAgents] = useState<AgentMetadata[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [agentsLoading, setAgentsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [agentsError, setAgentsError] = useState<string | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState('24h')
  const [analytics, setAnalytics] = useState<any>(null)

  useEffect(() => {
    if (id) {
      loadPlatformDetails()
      loadAgents()
    }
  }, [id])

  useEffect(() => {
    if (id) {
      loadAnalytics()
    }
  }, [selectedPeriod, id])

  const loadPlatformDetails = async () => {
    if (!id) return
    try {
      setIsLoading(true)
      const data = await fetchPlatform(id)
      setPlatform(data)
      setError(null)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load platform'
      setError(errorMsg)
      logger.error('Failed to load platform details', 'PlatformDetailsPage.loadPlatformDetails', err)
    } finally {
      setIsLoading(false)
    }
  }

  const loadAgents = async () => {
    if (!id) return
    try {
      setAgentsLoading(true)
      const data = await fetchPlatformAgents(id)
      setAgents(data)
      setAgentsError(null)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load agents'
      setAgentsError(errorMsg)
      logger.error('Failed to load platform agents', 'PlatformDetailsPage.loadAgents', err)
    } finally {
      setAgentsLoading(false)
    }
  }

  const loadAnalytics = async () => {
    if (!id) return
    try {
      const data = await fetchPlatformAnalytics(id, selectedPeriod)
      setAnalytics(data)
    } catch (err) {
      logger.warn('Failed to load platform analytics', 'PlatformDetailsPage.loadAnalytics', err)
    }
  }

  if (isLoading) {
    return <LoadingSpinner />
  }

  if (error || !platform) {
    return (
      <PageTransition>
        <div className="space-y-6">
          <button
            onClick={() => navigate('/platforms')}
            className="px-4 py-2 text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-2"
          >
            ← Back to Platforms
          </button>
          <ErrorDisplay error={error || 'Platform not found'} retry={loadPlatformDetails} />
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header with back button */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <button
              onClick={() => navigate('/platforms')}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-3 flex items-center gap-1"
            >
              ← Back to Platforms
            </button>
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{platform.name}</h1>
                {platform.description && (
                  <p className="text-gray-600 dark:text-gray-400 mt-2">{platform.description}</p>
                )}
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium h-fit ${getPlatformLayerColor(platform.layer)}`}>
                {formatLayerName(platform.layer)}
              </span>
              {!platform.enabled && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-300 h-fit">
                  Disabled
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <a
              href={`/platforms/${platform.id}/definitions`}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors text-sm"
            >
              Manage Definitions
            </a>
          </div>
        </div>

        {/* Analytics Section */}
        {analytics && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Analytics</h2>
              <div className="flex gap-2">
                {['1h', '24h', '7d', '30d'].map((period) => (
                  <button
                    key={period}
                    onClick={() => setSelectedPeriod(period)}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
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

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow border border-gray-200 dark:border-slate-700 p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Workflows</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.total_workflows}</p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow border border-gray-200 dark:border-slate-700 p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Completed</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{analytics.completed_workflows}</p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow border border-gray-200 dark:border-slate-700 p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Failed</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{analytics.failed_workflows}</p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow border border-gray-200 dark:border-slate-700 p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Success Rate</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {Math.round(analytics.success_rate)}%
                </p>
              </div>
              {analytics.avg_completion_time_ms !== null && (
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow border border-gray-200 dark:border-slate-700 p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Avg Duration</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {formatDuration(analytics.avg_completion_time_ms)}
                  </p>
                </div>
              )}
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow border border-gray-200 dark:border-slate-700 p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Running</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{analytics.running_workflows}</p>
              </div>
            </div>
          </div>
        )}

        {/* Agents Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Available Agents ({agents.length})
            </h2>
          </div>
          <AgentMatrixTable
            agents={agents}
            loading={agentsLoading}
            error={agentsError}
          />
        </div>

        {/* Platform Details */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow border border-gray-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Platform Details</h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Status</p>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                platform.enabled
                  ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
              }`}>
                {platform.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Layer</p>
              <p className="text-sm text-gray-900 dark:text-white font-medium">{platform.layer}</p>
            </div>
            {platform.created_at && (
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Created</p>
                <p className="text-sm text-gray-900 dark:text-white">{formatDate(platform.created_at)}</p>
              </div>
            )}
            {platform.updated_at && (
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Updated</p>
                <p className="text-sm text-gray-900 dark:text-white">{formatDate(platform.updated_at)}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  )
}
