import { useState } from 'react'
import { WorkflowDefinition, CreateWorkflowDefinitionRequest, UpdateWorkflowDefinitionRequest } from '../../api/client'
import WorkflowDefinitionEditor from './WorkflowDefinitionEditor'
import WorkflowDefinitionList from './WorkflowDefinitionList'

interface WorkflowDefinitionManagerProps {
  platformId: string
  definitions: WorkflowDefinition[]
  loading: boolean
  onRefresh: () => void
  onCreate: (platformId: string, data: CreateWorkflowDefinitionRequest) => Promise<WorkflowDefinition>
  onUpdate: (id: string, data: UpdateWorkflowDefinitionRequest) => Promise<WorkflowDefinition>
  onDelete: (id: string) => Promise<void>
  onToggleEnabled: (id: string, enabled: boolean) => Promise<WorkflowDefinition>
}

type ViewMode = 'list' | 'create' | 'edit'

/**
 * WorkflowDefinitionManager
 * Main component for managing workflow definitions
 * Handles list view, creation, and editing of definitions
 */
export default function WorkflowDefinitionManager({
  platformId,
  definitions,
  loading,
  onRefresh,
  onCreate,
  onUpdate,
  onDelete,
  onToggleEnabled
}: WorkflowDefinitionManagerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedDefinition, setSelectedDefinition] = useState<WorkflowDefinition | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreateNew = () => {
    setSelectedDefinition(null)
    setViewMode('create')
    setError(null)
  }

  const handleEditDefinition = (definition: WorkflowDefinition) => {
    setSelectedDefinition(definition)
    setViewMode('edit')
    setError(null)
  }

  const handleDeleteDefinition = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this workflow definition?')) {
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      await onDelete(id)
      onRefresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete definition'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    setIsLoading(true)
    setError(null)
    try {
      await onToggleEnabled(id, enabled)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update definition status'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveDefinition = async (data: CreateWorkflowDefinitionRequest | UpdateWorkflowDefinitionRequest) => {
    setIsLoading(true)
    setError(null)

    try {
      if (viewMode === 'create') {
        await onCreate(platformId, data as CreateWorkflowDefinitionRequest)
      } else if (selectedDefinition) {
        await onUpdate(selectedDefinition.id, data as UpdateWorkflowDefinitionRequest)
      }

      setViewMode('list')
      setSelectedDefinition(null)
      onRefresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save definition'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    setViewMode('list')
    setSelectedDefinition(null)
    setError(null)
  }

  return (
    <div className="space-y-6">
      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-red-900 dark:text-red-300">
                Error
              </h3>
              <p className="text-sm text-red-700 dark:text-red-200 mt-1">
                {error}
              </p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* View Mode: List */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Definition Templates
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {definitions.length} {definitions.length === 1 ? 'definition' : 'definitions'} available
              </p>
            </div>
            <button
              onClick={handleCreateNew}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
            >
              + Create Definition
            </button>
          </div>

          <WorkflowDefinitionList
            definitions={definitions}
            loading={loading || isLoading}
            onEdit={handleEditDefinition}
            onDelete={handleDeleteDefinition}
            onToggleEnabled={handleToggleEnabled}
          />
        </div>
      )}

      {/* View Mode: Create / Edit */}
      {(viewMode === 'create' || viewMode === 'edit') && (
        <WorkflowDefinitionEditor
          definition={selectedDefinition}
          loading={isLoading}
          onSave={handleSaveDefinition}
          onCancel={handleCancel}
        />
      )}
    </div>
  )
}
