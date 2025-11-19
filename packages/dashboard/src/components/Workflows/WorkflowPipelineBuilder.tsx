/**
 * WorkflowPipelineBuilder - Phase 3: Multi-Stage Workflow Builder
 * Manages the visual workflow pipeline editor with stage management
 * Session #82: Multi-stage workflow creation and configuration
 * Session #86: Integration with workflow definitions
 */

import { useState } from 'react'
import { WORKFLOW_TEMPLATES, WorkflowStage, WorkflowTemplate, createBlankTemplate } from './workflowTemplates'
import TemplateSelector from './TemplateSelector'
import StageList from './StageList'
import PipelinePreview from './PipelinePreview'
import StageEditorModal from './StageEditorModal'
import { ValidationErrorCard } from './ValidationErrorCard'
import { useWorkflowValidation } from '../../hooks/useWorkflowValidation'
import DefinitionTemplateSelector from '../WorkflowDefinitions/DefinitionTemplateSelector'
import { WorkflowDefinition } from '../../api/client'

interface WorkflowPipelineBuilderProps {
  onWorkflowCreated?: (stages: WorkflowStage[]) => void
}

export default function WorkflowPipelineBuilder({ onWorkflowCreated }: WorkflowPipelineBuilderProps) {
  const [currentTemplate, setCurrentTemplate] = useState<WorkflowTemplate>(createBlankTemplate())
  const [stages, setStages] = useState<WorkflowStage[]>([])
  const [editingStageId, setEditingStageId] = useState<string | null>(null)
  const [draggedStageId, setDraggedStageId] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [showDefinitionSelector, setShowDefinitionSelector] = useState(false)

  // Validation hook
  const { validation, isValidating } = useWorkflowValidation(stages)

  // Load template and set stages
  const handleTemplateSelected = (templateId: string) => {
    const template = WORKFLOW_TEMPLATES.find(t => t.id === templateId)
    if (template) {
      setCurrentTemplate(template)
      setStages(template.stages.map(s => ({ ...s }))) // Deep copy
      setEditingStageId(null)
    }
  }

  // Create blank workflow
  const handleStartBlank = () => {
    setCurrentTemplate(createBlankTemplate())
    setStages([])
    setEditingStageId(null)
  }

  // Load definition and convert to stages
  const handleDefinitionSelected = (definition: WorkflowDefinition) => {
    const definitionStages = (definition.definition?.stages || []).map((defStage: any, index: number) => ({
      id: `stage-${Date.now()}-${index}-${Math.random()}`,
      order: index + 1,
      name: defStage.name || `Stage ${index + 1}`,
      agentType: defStage.agent_type,
      behaviorMetadata: { mode: 'success' },
      constraints: { timeout_ms: 30000, max_retries: 0 },
      description: defStage.description
    } as WorkflowStage))

    setCurrentTemplate({
      ...createBlankTemplate(),
      name: definition.name,
      stages: definitionStages
    })
    setStages(definitionStages)
    setEditingStageId(null)
    setShowDefinitionSelector(false)
  }

  // Add new stage
  const handleAddStage = () => {
    const newStage: WorkflowStage = {
      id: `stage-${Date.now()}-${Math.random()}`,
      order: stages.length + 1,
      name: `Stage ${stages.length + 1}`,
      behaviorMetadata: { mode: 'success' },
      constraints: { timeout_ms: 30000, max_retries: 0 }
    }
    setStages([...stages, newStage])
  }

  // Remove stage
  const handleRemoveStage = (stageId: string) => {
    const newStages = stages
      .filter(s => s.id !== stageId)
      .map((s, idx) => ({ ...s, order: idx + 1 }))
    setStages(newStages)
  }

  // Edit stage
  const handleEditStage = (stageId: string) => {
    setEditingStageId(stageId)
  }

  // Update stage
  const handleUpdateStage = (updatedStage: WorkflowStage) => {
    setStages(stages.map(s => (s.id === updatedStage.id ? updatedStage : s)))
    setEditingStageId(null)
  }

  // Reorder stages (drag-drop)
  const handleReorderStages = (fromIndex: number, toIndex: number) => {
    const newStages = [...stages]
    const [removed] = newStages.splice(fromIndex, 1)
    newStages.splice(toIndex, 0, removed)
    // Update order numbers
    newStages.forEach((s, idx) => {
      s.order = idx + 1
    })
    setStages(newStages)
    setDraggedStageId(null)
  }

  // Duplicate stage
  const handleDuplicateStage = (stageId: string) => {
    const stageToDuplicate = stages.find(s => s.id === stageId)
    if (stageToDuplicate) {
      const newStage: WorkflowStage = {
        ...JSON.parse(JSON.stringify(stageToDuplicate)), // Deep copy
        id: `stage-${Date.now()}-${Math.random()}`,
        order: stages.length + 1,
        name: `${stageToDuplicate.name} (Copy)`
      }
      setStages([...stages, newStage])
    }
  }

  // Get currently editing stage
  const editingStage = stages.find(s => s.id === editingStageId)

  // Calculate estimated total duration
  const estimatedDurationMs = stages.reduce((total, stage) => {
    const delay = stage.behaviorMetadata?.timing?.execution_delay_ms || 0
    const duration = stage.behaviorMetadata?.metrics?.duration_ms || 0
    const timeout = stage.behaviorMetadata?.timing?.timeout_at_ms || 0
    return total + Math.max(delay, duration, timeout)
  }, 0)

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: string, stageId: string) => {
    setStages(stages.map(s =>
      s.id === stageId ? { ...s, agentType: suggestion } : s
    ))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-2xl font-bold text-gray-900">Multi-Stage Workflow Builder</h3>
        <p className="text-gray-600 mt-1">Design complex workflows with multiple stages and custom behaviors</p>
      </div>

      {/* Template Selector */}
      <div className="space-y-4">
        <TemplateSelector
          templates={WORKFLOW_TEMPLATES}
          selectedTemplate={currentTemplate.id}
          onTemplateSelected={handleTemplateSelected}
          onStartBlank={handleStartBlank}
        />

        {/* Load from Definition Button */}
        <button
          onClick={() => setShowDefinitionSelector(true)}
          className="w-full px-4 py-3 border-2 border-dashed border-indigo-400 dark:border-indigo-600 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors flex items-center justify-center gap-2 text-indigo-700 dark:text-indigo-400 font-medium"
        >
          ⬇ Load from Saved Definition
        </button>
      </div>

      {/* Definition Selector Modal */}
      {showDefinitionSelector && (
        <DefinitionTemplateSelector
          onSelect={handleDefinitionSelected}
          onClose={() => setShowDefinitionSelector(false)}
        />
      )}

      {/* Validation Errors */}
      {validation.errors.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <h4 className="font-semibold text-red-900 dark:text-red-100 mb-3">
                Workflow Validation Errors ({validation.errors.length})
              </h4>
              <div className="space-y-2">
                {validation.errors.map((error) => (
                  <ValidationErrorCard
                    key={error.stageId}
                    error={error}
                    onSuggestionClick={handleSuggestionClick}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Stage List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-lg font-semibold text-gray-900">Workflow Stages</h4>
            <button
              onClick={handleAddStage}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              + Add Stage
            </button>
          </div>

          {stages.length === 0 ? (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50">
              <p className="text-gray-600 mb-3">No stages yet</p>
              <button
                onClick={handleAddStage}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                Add Your First Stage
              </button>
            </div>
          ) : (
            <StageList
              stages={stages}
              draggedStageId={draggedStageId}
              onEditStage={handleEditStage}
              onRemoveStage={handleRemoveStage}
              onDuplicateStage={handleDuplicateStage}
              onDragStart={(stageId) => setDraggedStageId(stageId)}
              onDragEnd={() => setDraggedStageId(null)}
              onReorder={handleReorderStages}
            />
          )}
        </div>

        {/* Right: Preview & Actions */}
        <div className="space-y-4">
          {/* Metrics Card */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-600 uppercase tracking-wide">Total Stages</p>
                <p className="text-3xl font-bold text-blue-600">{stages.length}</p>
              </div>
              <div className="border-t border-blue-200 pt-3">
                <p className="text-xs text-gray-600 uppercase tracking-wide">Estimated Duration</p>
                <p className="text-lg font-semibold text-gray-900">
                  {(estimatedDurationMs / 1000).toFixed(1)}s
                </p>
              </div>
              <div className="border-t border-blue-200 pt-3">
                <p className="text-xs text-gray-600 uppercase tracking-wide">Current Template</p>
                <p className="text-sm font-medium text-gray-900">{currentTemplate.name}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              {showPreview ? '✓ Close Preview' : '👁️ Preview Pipeline'}
            </button>
            <button
              disabled={stages.length === 0 || !validation.isValid || isValidating}
              className={`w-full px-4 py-2 rounded-lg text-white transition-colors text-sm font-medium ${
                stages.length === 0 || !validation.isValid || isValidating
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
              onClick={() => onWorkflowCreated?.(stages)}
              title={
                !validation.isValid
                  ? 'Fix validation errors before creating workflow'
                  : isValidating
                  ? 'Validating workflow...'
                  : ''
              }
            >
              {isValidating ? '⏳ Validating...' : !validation.isValid ? '✗ Fix Errors' : '✓ Create Workflow'}
            </button>
          </div>

          {/* Info */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
            <p className="font-medium mb-1">💡 Tip</p>
            <p>Drag stages to reorder, click to configure behavior, or select a template to get started</p>
          </div>
        </div>
      </div>

      {/* Pipeline Preview */}
      {showPreview && stages.length > 0 && (
        <div className="border border-gray-200 rounded-lg p-6 bg-white">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Pipeline Preview</h4>
          <PipelinePreview stages={stages} estimatedDurationMs={estimatedDurationMs} />
        </div>
      )}

      {/* Stage Editor Modal */}
      {editingStage && (
        <StageEditorModal
          stage={editingStage}
          onUpdate={handleUpdateStage}
          onClose={() => setEditingStageId(null)}
        />
      )}
    </div>
  )
}
