/**
 * PipelinePreview - Visual Pipeline Visualization
 * Phase 3: Multi-Stage Workflow Builder
 */

import { WorkflowStage } from './workflowTemplates'

interface PipelinePreviewProps {
  stages: WorkflowStage[]
  estimatedDurationMs: number
}

export default function PipelinePreview({ stages, estimatedDurationMs }: PipelinePreviewProps) {
  // Get behavior mode color
  const getModeColor = (mode: string) => {
    const colors: Record<string, string> = {
      success: 'bg-green-100 border-green-300 text-green-900',
      failure: 'bg-red-100 border-red-300 text-red-900',
      timeout: 'bg-yellow-100 border-yellow-300 text-yellow-900',
      partial: 'bg-blue-100 border-blue-300 text-blue-900',
      crash: 'bg-purple-100 border-purple-300 text-purple-900'
    }
    return colors[mode] || 'bg-gray-100 border-gray-300 text-gray-900'
  }

  // Get behavior mode icon
  const getModeIcon = (mode: string) => {
    const icons: Record<string, string> = {
      success: '✓',
      failure: '✗',
      timeout: '⏱️',
      partial: '📊',
      crash: '💥'
    }
    return icons[mode] || '•'
  }

  const successStages = stages.filter(s => s.behaviorMetadata?.mode === 'success').length
  const failureStages = stages.filter(s => s.behaviorMetadata?.mode === 'failure').length
  const timeoutStages = stages.filter(s => s.behaviorMetadata?.mode === 'timeout').length
  const partialStages = stages.filter(s => s.behaviorMetadata?.mode === 'partial').length
  const crashStages = stages.filter(s => s.behaviorMetadata?.mode === 'crash').length

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{successStages}</div>
          <div className="text-xs text-green-800 font-medium">Success</div>
        </div>
        {failureStages > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-red-600">{failureStages}</div>
            <div className="text-xs text-red-800 font-medium">Failure</div>
          </div>
        )}
        {timeoutStages > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-yellow-600">{timeoutStages}</div>
            <div className="text-xs text-yellow-800 font-medium">Timeout</div>
          </div>
        )}
        {partialStages > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{partialStages}</div>
            <div className="text-xs text-blue-800 font-medium">Partial</div>
          </div>
        )}
        {crashStages > 0 && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-purple-600">{crashStages}</div>
            <div className="text-xs text-purple-800 font-medium">Crash</div>
          </div>
        )}
      </div>

      {/* Pipeline Flow */}
      <div className="space-y-3">
        <h4 className="font-semibold text-gray-900">Execution Flow</h4>
        <div className="space-y-2">
          {stages.map((stage, index) => {
            const mode = stage.behaviorMetadata?.mode || 'success'
            const isLast = index === stages.length - 1

            return (
              <div key={stage.id} className="space-y-2">
                {/* Stage Box */}
                <div className={`border-2 rounded-lg p-4 ${getModeColor(mode)}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <span className="text-2xl">{getModeIcon(mode)}</span>
                      <div>
                        <div className="font-semibold">{stage.name}</div>
                        {stage.description && (
                          <p className="text-sm opacity-75 mt-1">{stage.description}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-sm font-medium opacity-75">#{index + 1}</span>
                  </div>
                </div>

                {/* Arrow to next stage */}
                {!isLast && (
                  <div className="flex justify-center py-2">
                    <span className="text-2xl text-gray-400">↓</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Timing Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-gray-700 font-medium">Estimated Total Duration:</span>
            <span className="text-lg font-bold text-blue-600">
              {(estimatedDurationMs / 1000).toFixed(1)}s
            </span>
          </div>
          <div className="text-xs text-gray-600">
            Based on execution delays and timeout values configured for each stage
          </div>
        </div>
      </div>

      {/* Stage Details Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 border border-gray-200">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-900">#</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-900">Stage</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-900">Behavior</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-900">Timeout</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-900">Retries</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((stage, index) => {
              const mode = stage.behaviorMetadata?.mode || 'success'
              return (
                <tr key={stage.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{index + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span>{getModeIcon(mode)}</span>
                      <span className="font-medium">{stage.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getModeColor(mode)}`}>
                      {mode}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {stage.constraints?.timeout_ms
                      ? `${(stage.constraints.timeout_ms / 1000).toFixed(1)}s`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {stage.constraints?.max_retries || 0}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
