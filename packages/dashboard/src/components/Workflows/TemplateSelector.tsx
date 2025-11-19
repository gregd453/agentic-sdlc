/**
 * TemplateSelector - Template Selection Component
 * Phase 3: Multi-Stage Workflow Builder
 */

import { WorkflowTemplate } from './workflowTemplates'

interface TemplateSelectorProps {
  templates: WorkflowTemplate[]
  selectedTemplate: string
  onTemplateSelected: (templateId: string) => void
  onStartBlank: () => void
}

export default function TemplateSelector({
  templates,
  selectedTemplate,
  onTemplateSelected,
  onStartBlank
}: TemplateSelectorProps) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-lg font-semibold text-gray-900 mb-3">Start with a Template</h4>
        <p className="text-sm text-gray-600 mb-4">Choose a pre-built workflow or start with a blank canvas</p>
      </div>

      {/* Blank Option */}
      <button
        onClick={onStartBlank}
        className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
          selectedTemplate === 'template-blank'
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-200 hover:border-gray-300 bg-white'
        }`}
      >
        <div className="text-2xl mb-2">✏️</div>
        <div className="font-medium text-gray-900">Start Blank</div>
        <div className="text-sm text-gray-600">Create a workflow from scratch</div>
      </button>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {templates.map(template => (
          <button
            key={template.id}
            onClick={() => onTemplateSelected(template.id)}
            className={`p-4 rounded-lg border-2 transition-all text-left ${
              selectedTemplate === template.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <div className="text-2xl mb-2">{template.categoryIcon}</div>
            <div className="font-medium text-gray-900 text-sm">{template.name}</div>
            <div className="text-xs text-gray-600 mt-1">{template.stages.length} stages</div>
            {template.estimatedDurationMs && (
              <div className="text-xs text-gray-500 mt-1">
                ~{(template.estimatedDurationMs / 1000).toFixed(1)}s
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Description of selected template */}
      {selectedTemplate !== 'template-blank' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            {templates.find(t => t.id === selectedTemplate)?.description}
          </p>
        </div>
      )}
    </div>
  )
}
