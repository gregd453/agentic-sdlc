import { WorkflowDefinition } from '../../api/client'

interface WorkflowDefinitionListProps {
  definitions: WorkflowDefinition[]
  loading: boolean
  onEdit: (definition: WorkflowDefinition) => void
  onDelete: (id: string) => void
  onToggleEnabled: (id: string, enabled: boolean) => void
}

/**
 * WorkflowDefinitionList
 * Displays workflow definitions in a table format
 */
export default function WorkflowDefinitionList({
  definitions,
  loading,
  onEdit,
  onDelete,
  onToggleEnabled
}: WorkflowDefinitionListProps) {
  if (loading && definitions.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (definitions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
          🕐
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          No definitions yet
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Create your first workflow definition to get started
        </p>
      </div>
    )
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
              Name
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
              Version
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
              Description
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
              Status
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
              Created
            </th>
            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {definitions.map(definition => {
            const createdDate = new Date(definition.created_at).toLocaleDateString()

            return (
              <tr
                key={definition.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <td className="px-6 py-4">
                  <div className="font-semibold text-gray-900 dark:text-white">
                    {definition.name}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                    v{definition.version}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                  {definition.description || '-'}
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => onToggleEnabled(definition.id, !definition.enabled)}
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-medium transition-colors"
                    title={definition.enabled ? 'Click to disable' : 'Click to enable'}
                  >
                    {definition.enabled ? (
                      <>
                        👁
                        <span className="text-green-700 dark:text-green-300">Enabled</span>
                      </>
                    ) : (
                      <>
                        🚫
                        <span className="text-gray-600 dark:text-gray-400">Disabled</span>
                      </>
                    )}
                  </button>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                  {createdDate}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onEdit(definition)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-blue-600 dark:text-blue-400 transition-colors"
                      title="Edit definition"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => onDelete(definition.id)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-red-600 dark:text-red-400 transition-colors"
                      title="Delete definition"
                    >
                      🗑
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
