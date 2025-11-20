/**
 * SaveWorkflowDefinitionModal - Save workflow as reusable definition
 * Allows users to save their workflow to the database for future use
 */

import { useState, useEffect } from 'react'
import { WorkflowStage } from './workflowTemplates'
import { createWorkflowDefinition, fetchPlatforms } from '../../api/client'

interface SaveWorkflowDefinitionModalProps {
  stages: WorkflowStage[]
  onClose: () => void
  onSuccess?: (definitionId: string) => void
}

export default function SaveWorkflowDefinitionModal({
  stages,
  onClose,
  onSuccess
}: SaveWorkflowDefinitionModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [version, setVersion] = useState('1.0.0')
  const [platformId, setPlatformId] = useState('')
  const [platforms, setPlatforms] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Load available platforms on mount
  useEffect(() => {
    const loadPlatforms = async () => {
      try {
        const data = await fetchPlatforms()
        setPlatforms(data)
        if (data.length > 0) {
          setPlatformId(data[0].id)
        }
      } catch (err) {
        setError('Failed to load platforms')
      }
    }
    loadPlatforms()
  }, [])

  const handleSave = async () => {
    setError(null)
    setSuccess(false)

    if (!name.trim()) {
      setError('Workflow name is required')
      return
    }

    if (!platformId) {
      setError('Platform selection is required')
      return
    }

    if (stages.length === 0) {
      setError('Workflow must have at least one stage')
      return
    }

    setLoading(true)

    try {
      // Convert stages to workflow definition format
      const definition = {
        stages: stages.map(stage => ({
          name: stage.name,
          order: stage.order,
          agent_type: stage.agentType,
          description: stage.description,
          behavior_metadata: stage.behaviorMetadata,
          constraints: stage.constraints
        }))
      }

      const result = await createWorkflowDefinition(platformId, {
        name: name.trim(),
        description: description.trim() || undefined,
        version: version.trim(),
        definition
      })

      setSuccess(true)
      setTimeout(() => {
        onSuccess?.(result.id)
        onClose()
      }, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save workflow definition')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Save Workflow as Definition
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Save this workflow to reuse it across your platform
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Workflow Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Feature Review Pipeline"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          {/* Platform */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Platform *
            </label>
            <select
              value={platformId}
              onChange={(e) => setPlatformId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading || platforms.length === 0}
            >
              <option value="">Select a platform...</option>
              {platforms.map(platform => (
                <option key={platform.id} value={platform.id}>
                  {platform.name}
                </option>
              ))}
            </select>
            {platforms.length === 0 && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                No platforms available. Create one first.
              </p>
            )}
          </div>

          {/* Version */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Version
            </label>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="e.g., 1.0.0"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this workflow does..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          {/* Stages Summary */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-sm text-blue-900 dark:text-blue-200">
              <strong>{stages.length}</strong> stage{stages.length !== 1 ? 's' : ''} will be saved
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-900 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
              <p className="text-sm text-green-900 dark:text-green-200">✓ Workflow saved successfully!</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !name.trim() || !platformId}
            className={`flex-1 px-4 py-2 rounded-lg text-white transition-colors ${
              loading || !name.trim() || !platformId
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? '💾 Saving...' : '💾 Save Definition'}
          </button>
        </div>
      </div>
    </div>
  )
}
