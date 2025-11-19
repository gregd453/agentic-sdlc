import { useState, useEffect } from 'react'
import { WorkflowDefinition, CreateWorkflowDefinitionRequest, UpdateWorkflowDefinitionRequest } from '../../api/client'

interface WorkflowDefinitionEditorProps {
  definition?: WorkflowDefinition | null
  loading: boolean
  onSave: (data: CreateWorkflowDefinitionRequest | UpdateWorkflowDefinitionRequest) => Promise<void>
  onCancel: () => void
}

/**
 * WorkflowDefinitionEditor
 * Form component for creating and editing workflow definitions
 * Supports multi-stage pipeline definition with JSON editor
 */
export default function WorkflowDefinitionEditor({
  definition,
  loading,
  onSave,
  onCancel
}: WorkflowDefinitionEditorProps) {
  const isEditing = !!definition

  // Form state
  const [formData, setFormData] = useState({
    name: definition?.name || '',
    version: definition?.version || '1.0.0',
    description: definition?.description || '',
    definition: definition?.definition || { stages: [] }
  })

  const [jsonView, setJsonView] = useState(false)
  const [jsonText, setJsonText] = useState(JSON.stringify(formData.definition, null, 2))
  const [error, setError] = useState<string | null>(null)

  // Sync JSON text when definition changes
  useEffect(() => {
    setJsonText(JSON.stringify(formData.definition, null, 2))
  }, [formData.definition])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    setError(null)
  }

  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setJsonText(value)
    setError(null)

    try {
      const parsed = JSON.parse(value)
      setFormData(prev => ({
        ...prev,
        definition: parsed
      }))
    } catch (err) {
      // Will validate on save
    }
  }

  const handleAddStage = () => {
    const newStage = {
      name: `Stage ${(formData.definition.stages?.length || 0) + 1}`,
      agent_type: 'scaffold'
    }

    setFormData(prev => ({
      ...prev,
      definition: {
        ...prev.definition,
        stages: [...(prev.definition.stages || []), newStage]
      }
    }))
  }

  const handleRemoveStage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      definition: {
        ...prev.definition,
        stages: (prev.definition.stages || []).filter((_: any, i: number) => i !== index)
      }
    }))
  }

  const handleUpdateStage = (index: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      definition: {
        ...prev.definition,
        stages: (prev.definition.stages || []).map((stage: any, i: number) =>
          i === index ? { ...stage, [field]: value } : stage
        )
      }
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    try {
      // Validate form
      if (!formData.name.trim()) {
        setError('Definition name is required')
        return
      }

      if (!formData.definition || typeof formData.definition !== 'object') {
        setError('Invalid workflow definition format')
        return
      }

      // Attempt JSON parse if in JSON view
      if (jsonView) {
        try {
          JSON.parse(jsonText)
          setFormData(prev => ({
            ...prev,
            definition: JSON.parse(jsonText)
          }))
        } catch (err) {
          setError('Invalid JSON format in workflow definition')
          return
        }
      }

      await onSave({
        name: formData.name.trim(),
        version: formData.version || '1.0.0',
        description: formData.description.trim(),
        definition: formData.definition
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save definition'
      setError(message)
    }
  }

  const stages = formData.definition?.stages || []

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            ←
          </button>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isEditing ? 'Edit Workflow Definition' : 'Create New Workflow Definition'}
          </h2>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Basic Information
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Definition Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="e.g., Microservice Deployment Pipeline"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Version
              </label>
              <input
                type="text"
                name="version"
                value={formData.version}
                onChange={handleInputChange}
                placeholder="e.g., 1.0.0"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Brief description of this workflow definition and its purpose"
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Workflow Definition */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Workflow Stages
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setJsonView(!jsonView)}
                className="px-3 py-1 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {jsonView ? 'Visual Editor' : 'JSON Editor'}
              </button>
            </div>
          </div>

          {/* Visual Editor */}
          {!jsonView && (
            <div className="space-y-4">
              {stages.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  No stages defined. Add your first stage to get started.
                </p>
              ) : (
                <div className="space-y-3">
                  {stages.map((stage: any, index: number) => (
                    <div
                      key={index}
                      className="flex items-end gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
                    >
                      <div className="flex-1 grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Stage Name
                          </label>
                          <input
                            type="text"
                            value={stage.name || ''}
                            onChange={(e) => handleUpdateStage(index, 'name', e.target.value)}
                            placeholder="e.g., Code Review"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Agent Type
                          </label>
                          <input
                            type="text"
                            value={stage.agent_type || ''}
                            onChange={(e) => handleUpdateStage(index, 'agent_type', e.target.value)}
                            placeholder="e.g., validation"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveStage(index)}
                        className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-600 dark:text-red-400 transition-colors"
                      >
                        🗑
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={handleAddStage}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                +
                Add Stage
              </button>
            </div>
          )}

          {/* JSON Editor */}
          {jsonView && (
            <textarea
              value={jsonText}
              onChange={handleJsonChange}
              className="w-full h-96 px-4 py-2 font-mono text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          )}
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:bg-gray-100 dark:disabled:bg-gray-800 transition-colors font-medium"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
          >
            {loading ? 'Saving...' : isEditing ? 'Update Definition' : 'Create Definition'}
          </button>
        </div>
      </form>
    </div>
  )
}
