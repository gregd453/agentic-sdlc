import { useState } from 'react'
import LoadingSpinner from '../Common/LoadingSpinner'
import BehaviorMetadataEditor from './BehaviorMetadataEditor'

interface CreateMockWorkflowModalProps {
  isOpen: boolean
  onClose: () => void
  onWorkflowCreated?: (workflowId: string) => void
}

type BehaviorPresetKey = 'success' | 'fast_success' | 'slow_success' | 'validation_error' | 'deployment_failed' | 'unrecoverable_error' | 'timeout' | 'tests_partial_pass' | 'high_resource_usage' | 'crash'

// Behavior presets for mock testing (Session #81)
const BEHAVIOR_METADATA_PRESETS: Record<BehaviorPresetKey, any> = {
  success: {
    mode: 'success',
    label: 'Normal successful completion'
  },
  fast_success: {
    mode: 'success',
    timing: { execution_delay_ms: 10 },
    label: 'Quick successful completion (10ms)'
  },
  slow_success: {
    mode: 'success',
    timing: { execution_delay_ms: 5000 },
    label: 'Slow successful completion (5s)'
  },
  validation_error: {
    mode: 'failure',
    error: {
      code: 'VALIDATION_ERROR',
      message: 'TypeScript compilation errors detected',
      retryable: true,
      recovery_suggestion: 'Fix type errors and retry'
    },
    label: 'Validation stage fails with type errors'
  },
  deployment_failed: {
    mode: 'failure',
    error: {
      code: 'DEPLOYMENT_FAILED',
      message: 'Deployment to production failed',
      retryable: true,
      recovery_suggestion: 'Check infrastructure and retry'
    },
    label: 'Deployment stage fails'
  },
  unrecoverable_error: {
    mode: 'failure',
    error: {
      code: 'FATAL_ERROR',
      message: 'Unrecoverable system error',
      retryable: false,
      recovery_suggestion: 'Manual intervention required'
    },
    label: 'Fatal unrecoverable error'
  },
  timeout: {
    mode: 'timeout',
    timing: { timeout_at_ms: 5000 },
    error: {
      code: 'TIMEOUT',
      message: 'Stage execution exceeded timeout',
      retryable: true
    },
    label: 'Stage times out after 5 seconds'
  },
  tests_partial_pass: {
    mode: 'partial',
    partial: {
      total_items: 10,
      successful_items: 8,
      failed_items: 2,
      failure_rate: 0.2,
      first_failure_at: 3
    },
    output: {
      tests_run: 10,
      tests_passed: 8,
      tests_failed: 2
    },
    label: 'Tests: 8/10 passed'
  },
  high_resource_usage: {
    mode: 'success',
    metrics: {
      duration_ms: 30000,
      memory_mb: 500,
      cpu_percent: 85
    },
    label: 'Success but with high resource usage'
  },
  crash: {
    mode: 'crash',
    error: {
      code: 'AGENT_CRASH',
      message: 'Agent process crashed unexpectedly',
      retryable: true
    },
    label: 'Agent crashes during execution'
  }
}

const BEHAVIOR_PRESETS: Array<{
  key: BehaviorPresetKey
  name: string
  description: string
  icon: string
}> = [
  {
    key: 'success',
    name: 'Success',
    description: 'Workflow succeeds normally',
    icon: '✓'
  },
  {
    key: 'fast_success',
    name: 'Fast Success',
    description: 'Succeeds quickly (10ms)',
    icon: '⚡'
  },
  {
    key: 'slow_success',
    name: 'Slow Success',
    description: 'Succeeds slowly (5s)',
    icon: '🐢'
  },
  {
    key: 'validation_error',
    name: 'Validation Error',
    description: 'Fails at validation stage',
    icon: '✗'
  },
  {
    key: 'deployment_failed',
    name: 'Deployment Failed',
    description: 'Fails at deployment stage',
    icon: '💥'
  },
  {
    key: 'unrecoverable_error',
    name: 'Fatal Error',
    description: 'Unrecoverable error',
    icon: '⚠️'
  },
  {
    key: 'timeout',
    name: 'Timeout',
    description: 'Execution times out (5s)',
    icon: '⏱️'
  },
  {
    key: 'tests_partial_pass',
    name: 'Partial Success',
    description: '8/10 tests pass',
    icon: '📊'
  },
  {
    key: 'high_resource_usage',
    name: 'High Resource Usage',
    description: 'Success with high resources',
    icon: '📈'
  },
  {
    key: 'crash',
    name: 'Crash',
    description: 'Agent crashes',
    icon: '💀'
  }
]

export default function CreateMockWorkflowModal({
  isOpen,
  onClose,
  onWorkflowCreated
}: CreateMockWorkflowModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'feature' as 'app' | 'feature' | 'bugfix',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    behaviorPreset: 'success' as BehaviorPresetKey
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [advancedMode, setAdvancedMode] = useState(false)
  const [behaviorMetadata, setBehaviorMetadata] = useState<any>(BEHAVIOR_METADATA_PRESETS['success'])

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleBehaviorChange = (presetKey: BehaviorPresetKey) => {
    setFormData(prev => ({
      ...prev,
      behaviorPreset: presetKey
    }))
    // Update behavior metadata to the new preset
    setBehaviorMetadata(BEHAVIOR_METADATA_PRESETS[presetKey])
  }

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      setError('Workflow name is required')
      return false
    }
    if (!formData.behaviorPreset) {
      setError('Behavior preset is required')
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)

      const response = await fetch('http://localhost:3051/api/v1/workflows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          type: formData.type,
          priority: formData.priority,
          // Include behavior metadata for mock agent (may be customized in advanced mode)
          behavior_metadata: behaviorMetadata
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to create workflow: ${response.statusText}`)
      }

      const result = await response.json()
      const workflowId = result.id || result.workflow_id

      // Reset form and close
      setFormData({
        name: '',
        description: '',
        type: 'feature',
        priority: 'medium',
        behaviorPreset: 'success'
      })
      setBehaviorMetadata(BEHAVIOR_METADATA_PRESETS['success'])
      setAdvancedMode(false)

      onWorkflowCreated?.(workflowId)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workflow')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-screen overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Create Mock Workflow</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="px-6 py-4 bg-red-50 border-b border-red-200">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6">
          {/* Basic Information */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Workflow Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Workflow Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g., Test Happy Path"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  disabled={isSubmitting}
                />
              </div>

              {/* Workflow Type */}
              <div>
                <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-2">
                  Type *
                </label>
                <select
                  id="type"
                  name="type"
                  value={formData.type}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  disabled={isSubmitting}
                >
                  <option value="app">App</option>
                  <option value="feature">Feature</option>
                  <option value="bugfix">Bugfix</option>
                </select>
              </div>

              {/* Priority */}
              <div>
                <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-2">
                  Priority *
                </label>
                <select
                  id="priority"
                  name="priority"
                  value={formData.priority}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  disabled={isSubmitting}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Optional description for this test workflow"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          {/* Behavior Preset Selection */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Behavior Preset *</h3>
            <p className="text-sm text-gray-600 mb-4">
              Select how the workflow should behave during execution
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {BEHAVIOR_PRESETS.map(preset => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => handleBehaviorChange(preset.key)}
                  disabled={isSubmitting}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    formData.behaviorPreset === preset.key
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="text-2xl mb-2">{preset.icon}</div>
                  <div className="font-medium text-gray-900">{preset.name}</div>
                  <div className="text-sm text-gray-600">{preset.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Advanced Mode Toggle */}
          <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={advancedMode}
                onChange={(e) => setAdvancedMode(e.target.checked)}
                className="rounded border-gray-300 w-4 h-4"
                disabled={isSubmitting}
              />
              <span className="ml-2 text-sm font-medium text-gray-900">
                Advanced Configuration
              </span>
              <span className="ml-2 text-xs text-gray-600">
                Customize behavior metadata for detailed control
              </span>
            </label>
          </div>

          {/* Advanced Behavior Editor */}
          {advancedMode && (
            <BehaviorMetadataEditor
              selectedPreset={formData.behaviorPreset}
              behaviorMetadata={behaviorMetadata}
              onMetadataChange={setBehaviorMetadata}
              onReset={() => {
                setBehaviorMetadata(BEHAVIOR_METADATA_PRESETS[formData.behaviorPreset])
              }}
            />
          )}

          {/* Preview of Selected Behavior */}
          <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-2">Selected Behavior:</h4>
            <p className="text-sm text-gray-700">
              {BEHAVIOR_METADATA_PRESETS[formData.behaviorPreset].label ||
                `Behavior: ${formData.behaviorPreset}`}
            </p>
            {advancedMode && (
              <div className="mt-3 pt-3 border-t border-gray-300">
                <p className="text-xs text-gray-600 mb-2">Custom Configuration:</p>
                <div className="bg-white p-2 rounded border border-gray-300 font-mono text-xs text-gray-700 max-h-32 overflow-y-auto">
                  {JSON.stringify(behaviorMetadata, null, 2)}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <LoadingSpinner size="sm" />
                  Creating...
                </>
              ) : (
                'Create Workflow'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
