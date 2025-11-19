/**
 * StageCard - Individual Workflow Stage Card
 * Phase 3: Multi-Stage Workflow Builder
 */

import { WorkflowStage } from './workflowTemplates'

interface StageCardProps {
  stage: WorkflowStage
  isDragging?: boolean
  onEdit: (stageId: string) => void
  onRemove: (stageId: string) => void
  onDuplicate: (stageId: string) => void
  onDragStart?: () => void
  onDragEnd?: () => void
}

export default function StageCard({
  stage,
  isDragging = false,
  onEdit,
  onRemove,
  onDuplicate,
  onDragStart,
  onDragEnd
}: StageCardProps) {
  // Get behavior mode icon
  const getBehaviorIcon = () => {
    const mode = stage.behaviorMetadata?.mode || 'success'
    const icons: Record<string, string> = {
      success: '✓',
      failure: '✗',
      timeout: '⏱️',
      partial: '📊',
      crash: '💥'
    }
    return icons[mode] || '•'
  }

  // Get behavior mode label
  const getBehaviorLabel = () => {
    const mode = stage.behaviorMetadata?.mode || 'success'
    return mode.charAt(0).toUpperCase() + mode.slice(1)
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`p-4 rounded-lg border-2 transition-all ${
        isDragging
          ? 'border-blue-500 bg-blue-50 opacity-50'
          : 'border-gray-200 hover:border-gray-300 bg-white hover:shadow-md cursor-move'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{getBehaviorIcon()}</span>
            <div className="font-semibold text-gray-900">{stage.name}</div>
          </div>
          {stage.description && (
            <p className="text-xs text-gray-600">{stage.description}</p>
          )}
        </div>
        <span className="text-xs font-medium bg-gray-100 text-gray-700 px-2 py-1 rounded">
          #{stage.order}
        </span>
      </div>

      {/* Behavior Info */}
      <div className="space-y-2 mb-3 pb-3 border-t border-gray-200 pt-3">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">Behavior:</span>
          <span className="font-medium text-gray-900">{getBehaviorLabel()}</span>
        </div>
        {stage.constraints?.timeout_ms && (
          <div className="flex justify-between items-center text-sm text-gray-600">
            <span>Timeout:</span>
            <span>{(stage.constraints.timeout_ms / 1000).toFixed(1)}s</span>
          </div>
        )}
        {stage.constraints?.max_retries !== undefined && stage.constraints.max_retries > 0 && (
          <div className="flex justify-between items-center text-sm text-gray-600">
            <span>Retries:</span>
            <span>{stage.constraints.max_retries}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onEdit(stage.id)}
          className="flex-1 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
        >
          ⚙️ Configure
        </button>
        <button
          onClick={() => onDuplicate(stage.id)}
          className="px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded transition-colors border border-gray-300"
          title="Duplicate stage"
        >
          📋
        </button>
        <button
          onClick={() => onRemove(stage.id)}
          className="px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded transition-colors border border-red-300"
          title="Delete stage"
        >
          🗑️
        </button>
      </div>
    </div>
  )
}
