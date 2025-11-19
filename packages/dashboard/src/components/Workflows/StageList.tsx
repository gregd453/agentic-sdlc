/**
 * StageList - Draggable Stage List Component
 * Phase 3: Multi-Stage Workflow Builder
 */

import { useState } from 'react'
import { WorkflowStage } from './workflowTemplates'
import StageCard from './StageCard'

interface StageListProps {
  stages: WorkflowStage[]
  draggedStageId?: string | null
  onEditStage: (stageId: string) => void
  onRemoveStage: (stageId: string) => void
  onDuplicateStage: (stageId: string) => void
  onDragStart: (stageId: string) => void
  onDragEnd: () => void
  onReorder: (fromIndex: number, toIndex: number) => void
}

export default function StageList({
  stages,
  draggedStageId,
  onEditStage,
  onRemoveStage,
  onDuplicateStage,
  onDragStart,
  onDragEnd,
  onReorder
}: StageListProps) {
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDragOverIndex(index)
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault()
    setDragOverIndex(null)

    // Find the index of the dragged stage
    const draggedIndex = stages.findIndex(s => s.id === draggedStageId)
    if (draggedIndex !== -1) {
      onReorder(draggedIndex, toIndex)
    }
  }

  return (
    <div className="space-y-3">
      {stages.map((stage, index) => (
        <div
          key={stage.id}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, index)}
          className={`transition-all ${
            dragOverIndex === index ? 'border-t-2 border-blue-500 pt-2' : ''
          }`}
        >
          <StageCard
            stage={stage}
            isDragging={draggedStageId === stage.id}
            onEdit={onEditStage}
            onRemove={onRemoveStage}
            onDuplicate={onDuplicateStage}
            onDragStart={() => onDragStart(stage.id)}
            onDragEnd={onDragEnd}
          />
        </div>
      ))}

      {/* Drop Zone at End */}
      <div
        onDragOver={(e) => handleDragOver(e, stages.length)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, stages.length)}
        className={`border-2 border-dashed rounded-lg p-4 text-center transition-all ${
          dragOverIndex === stages.length
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-gray-50'
        }`}
      >
        <p className="text-sm text-gray-500">Drop stage here to move to end</p>
      </div>
    </div>
  )
}
