import { useParams } from 'react-router-dom'
import { useFetchPlatform } from '../hooks/useFetchPlatform'
import { useWorkflowDefinitions } from '../hooks/useWorkflowDefinitions'
import WorkflowDefinitionManager from '../components/WorkflowDefinitions/WorkflowDefinitionManager'

/**
 * WorkflowDefinitionsPage
 * Platform-specific workflow definition management
 * Allows users to create, edit, and manage workflow definition templates
 */
export default function WorkflowDefinitionsPage() {
  const { platformId } = useParams<{ platformId: string }>()
  const { platform, loading: platformLoading, error: platformError } = useFetchPlatform(platformId)
  const {
    definitions,
    loading: definitionsLoading,
    error: definitionsError,
    create,
    update,
    delete: deleteDefinition,
    toggleEnabled,
    refetch
  } = useWorkflowDefinitions({
    platformId,
    autoFetch: true,
    includeDisabled: false
  })

  if (!platformId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          ⚠
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Platform not found
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Please select a platform to manage workflow definitions
          </p>
        </div>
      </div>
    )
  }

  if (platformLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (platformError || !platform) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start">
            ⚠
            <div>
              <h3 className="text-sm font-semibold text-red-900 dark:text-red-300">
                Error loading platform
              </h3>
              <p className="text-sm text-red-700 dark:text-red-200 mt-1">
                {platformError || 'Platform not found'}
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <a
              href="/platforms"
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1"
            >
              ←
              Platforms
            </a>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Workflow Definitions
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage workflow templates for <span className="font-semibold">{platform.name}</span>
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {definitionsError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start">
            ⚠
            <div>
              <h3 className="text-sm font-semibold text-red-900 dark:text-red-300">
                Error loading definitions
              </h3>
              <p className="text-sm text-red-700 dark:text-red-200 mt-1">
                {definitionsError}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Manager Component */}
      <WorkflowDefinitionManager
        platformId={platformId}
        definitions={definitions}
        loading={definitionsLoading}
        onRefresh={refetch}
        onCreate={create}
        onUpdate={update}
        onDelete={deleteDefinition}
        onToggleEnabled={toggleEnabled}
      />
    </div>
  )
}
