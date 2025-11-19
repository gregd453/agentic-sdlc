import { useState, useEffect } from 'react'
import { WorkflowDefinition } from '../../api/client'
import { fetchWorkflowDefinitions } from '../../api/client'

interface DefinitionTemplateSelectorProps {
  platformId?: string
  onSelect: (definition: WorkflowDefinition) => void
  onClose: () => void
}

/**
 * DefinitionTemplateSelector
 * Modal/panel for selecting a workflow definition to load
 * Allows users to quickly bootstrap pipelines from saved definitions
 */
export default function DefinitionTemplateSelector({
  platformId,
  onSelect,
  onClose
}: DefinitionTemplateSelectorProps) {
  const [definitions, setDefinitions] = useState<WorkflowDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const loadDefinitions = async () => {
      if (!platformId) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const defs = await fetchWorkflowDefinitions(platformId, false)
        setDefinitions(defs)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load definitions'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    loadDefinitions()
  }, [platformId])

  const filteredDefinitions = definitions.filter(def =>
    def.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (def.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  )

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Load from Definition
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Select a workflow definition to bootstrap your pipeline
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-600 dark:text-gray-400 font-bold text-lg"
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <input
            type="text"
            placeholder="Search definitions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          )}

          {error && (
            <div className="p-6">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && filteredDefinitions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="text-5xl text-gray-400 mb-4">⬇</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {definitions.length === 0 ? 'No definitions yet' : 'No matching definitions'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm max-w-xs">
                {definitions.length === 0
                  ? 'Create workflow definitions for your platform to get started'
                  : 'Try adjusting your search criteria'}
              </p>
            </div>
          )}

          {!loading && !error && filteredDefinitions.length > 0 && (
            <div className="p-6 space-y-4">
              {filteredDefinitions.map((definition) => (
                <button
                  key={definition.id}
                  onClick={() => onSelect(definition)}
                  className="w-full text-left p-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-blue-400 dark:hover:border-blue-500 transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {definition.name}
                      </h4>
                      {definition.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {definition.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-2 py-1 rounded">
                          v{definition.version}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {(definition.definition?.stages?.length ?? 0)} stages
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(definition.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <span className="text-gray-400 group-hover:text-blue-500 transition-colors flex-shrink-0 ml-4">⬇</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {filteredDefinitions.length} of {definitions.length} definitions
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
