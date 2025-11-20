import React, { useEffect, useState } from 'react'
import { fetchPlatforms, fetchPlatformAnalytics, createPlatform, updatePlatform, deletePlatform } from '../api/client'
import { formatDate, formatDuration } from '../utils/format'
import { getPlatformLayerColor, formatLayerName } from '../utils/platformColors'
import { logger } from '../utils/logger'
import type { PlatformAnalytics } from '../types'
import { PageTemplate } from '../components/Layout/PageTemplate'
import PlatformFormModal from '../components/Platforms/PlatformFormModal'
import DeleteConfirmationModal from '../components/Common/DeleteConfirmationModal'

interface Platform {
  id: string
  name: string
  layer: 'APPLICATION' | 'DATA' | 'INFRASTRUCTURE' | 'ENTERPRISE' | string
  description?: string | null
  config?: Record<string, any>
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
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [editingPlatform, setEditingPlatform] = useState<Platform | null>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [platformToDelete, setPlatformToDelete] = useState<Platform | null>(null)
  const [isSaving, setSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)

  useEffect(() => {
    loadPlatforms()
  }, [])

  useEffect(() => {
    loadAnalytics()
  }, [selectedPeriod, platforms.length])

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
    if (platforms.length === 0) return

    try {
      const updatedPlatforms = await Promise.all(
        platforms.map(async (platform) => {
          try {
            const analytics = await fetchPlatformAnalytics(platform.id, selectedPeriod)
            return { ...platform, analytics }
          } catch (err) {
            logger.warn(
              `Failed to load analytics for platform`,
              `PlatformsPage.loadAnalytics`,
              err
            )
            return platform
          }
        })
      )
      setPlatforms(updatedPlatforms)
    } catch (err) {
      logger.error(
        'Failed to load platform analytics',
        'PlatformsPage.loadAnalytics',
        err
      )
    }
  }

  const handleOpenCreateModal = () => {
    setEditingPlatform(null)
    setModalError(null)
    setIsFormModalOpen(true)
  }

  const handleOpenEditModal = (platform: Platform) => {
    setEditingPlatform(platform)
    setModalError(null)
    setIsFormModalOpen(true)
  }

  const handleSavePlatform = async (data: any) => {
    setSaving(true)
    setModalError(null)

    try {
      if (editingPlatform) {
        await updatePlatform(editingPlatform.id, data)
        logger.info(`Platform updated successfully (${editingPlatform.id})`)
      } else {
        await createPlatform(data)
        logger.info(`Platform created successfully (${data.name})`)
      }
      await loadPlatforms()
      setIsFormModalOpen(false)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save platform'
      setModalError(errorMessage)
      const errMsg = err instanceof Error ? err.message : 'Unknown error'
      logger.error(errMsg)
    } finally {
      setSaving(false)
    }
  }

  const handleOpenDeleteModal = (platform: Platform) => {
    setPlatformToDelete(platform)
    setIsDeleteModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!platformToDelete) return

    setIsDeleting(true)

    try {
      await deletePlatform(platformToDelete.id)
      logger.info(`Platform deleted successfully (${platformToDelete.id})`)
      await loadPlatforms()
      setIsDeleteModalOpen(false)
      setPlatformToDelete(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete platform'
      setError(errorMessage)
      const errMsg = err instanceof Error ? err.message : 'Unknown error'
      logger.error(errMsg)
      setIsDeleteModalOpen(false)
      setPlatformToDelete(null)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <PageTemplate
      title="Platforms"
      subtitle={`Manage and monitor multi-platform workflows (${platforms.length} platforms)`}
      error={error}
      isLoading={isLoading}
      onErrorDismiss={() => setError(null)}
      headerAction={
        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
        >
          + New Platform
        </button>
      }
      headerActionSecondary={
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
      }
    >
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
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPlatformLayerColor(platform.layer)}`}>
                    {formatLayerName(platform.layer)}
                  </span>
                  <button
                    onClick={() => handleOpenEditModal(platform)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    title="Edit platform"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleOpenDeleteModal(platform)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    title="Delete platform"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

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

                  {platform.analytics.avg_completion_time_ms !== null && (
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        Avg Completion: {formatDuration(platform.analytics.avg_completion_time_ms)}
                      </div>
                    </div>
                  )}
                </div>
              )}

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

      <PlatformFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false)
          setEditingPlatform(null)
          setModalError(null)
        }}
        onSave={handleSavePlatform}
        platform={editingPlatform}
        isLoading={isSaving}
        error={modalError}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false)
          setPlatformToDelete(null)
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Platform"
        message="Are you sure you want to delete this platform? This action cannot be undone."
        itemName={platformToDelete?.name}
        isLoading={isDeleting}
        isDangerous={true}
      />
    </PageTemplate>
  )
}
