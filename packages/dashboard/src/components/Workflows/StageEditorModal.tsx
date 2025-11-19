/**
 * StageEditorModal - Edit Individual Stage Configuration
 * Phase 3: Multi-Stage Workflow Builder
 */

import { useState } from 'react'
import { WorkflowStage } from './workflowTemplates'
import BehaviorMetadataEditor from './BehaviorMetadataEditor'

interface StageEditorModalProps {
  stage: WorkflowStage
  onUpdate: (stage: WorkflowStage) => void
  onClose: () => void
}

export default function StageEditorModal({ stage, onUpdate, onClose }: StageEditorModalProps) {
  const [name, setName] = useState(stage.name)
  const [description, setDescription] = useState(stage.description || '')
  const [agentType, setAgentType] = useState(stage.agentType || '')
  const [timeoutMs, setTimeoutMs] = useState(stage.constraints?.timeout_ms || 30000)
  const [maxRetries, setMaxRetries] = useState(stage.constraints?.max_retries || 0)
  const [behaviorMetadata, setBehaviorMetadata] = useState(stage.behaviorMetadata)

  const handleSave = () => {
    const updatedStage: WorkflowStage = {
      ...stage,
      name,
      description: description || undefined,
      agentType: agentType || undefined,
      behaviorMetadata,
      constraints: {
        timeout_ms: timeoutMs,
        max_retries: maxRetries
      }
    }
    onUpdate(updatedStage)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Edit Stage: {stage.name}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleSave() }} className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Stage Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Scaffold, Validate, Test"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="What does this stage do?"
                rows={2}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Agent Type (Optional)</label>
              <select
                value={agentType}
                onChange={(e) => setAgentType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Auto-assign</option>
                <option value="scaffold-agent">Scaffold Agent</option>
                <option value="validation-agent">Validation Agent</option>
                <option value="e2e-agent">E2E Agent</option>
                <option value="integration-agent">Integration Agent</option>
                <option value="deployment-agent">Deployment Agent</option>
              </select>
            </div>
          </div>

          {/* Behavior Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Behavior Configuration</h3>
            <BehaviorMetadataEditor
              behaviorMetadata={behaviorMetadata}
              onMetadataChange={setBehaviorMetadata}
              onReset={() => setBehaviorMetadata({ mode: 'success' })}
            />
          </div>

          {/* Constraints */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Stage Constraints</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Timeout (ms)</label>
                <input
                  type="number"
                  min="1000"
                  step="1000"
                  value={timeoutMs}
                  onChange={(e) => setTimeoutMs(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Timeout for this stage</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Max Retries</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={maxRetries}
                  onChange={(e) => setMaxRetries(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Retry attempts for this stage</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              ✓ Save Stage
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
