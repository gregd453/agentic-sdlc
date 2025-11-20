/**
 * DeleteConfirmationModal - Reusable modal for confirming deletions
 * Prevents accidental deletions with a confirmation dialog
 */

interface DeleteConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void> | void
  title?: string
  message?: string
  itemName?: string
  isLoading?: boolean
  isDangerous?: boolean
}

export default function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Delete',
  message = 'Are you sure you want to delete this item?',
  itemName,
  isLoading = false,
  isDangerous = false
}: DeleteConfirmationModalProps) {
  if (!isOpen) return null

  const handleConfirm = async () => {
    try {
      await onConfirm()
      onClose()
    } catch (error) {
      // Error handling is done at the parent level
      console.error('Delete confirmation error:', error)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full mx-4">
        {/* Header */}
        <div className={`px-6 py-4 border-b ${isDangerous ? 'border-red-200 dark:border-red-700' : 'border-gray-200 dark:border-gray-700'}`}>
          <h2 className={`text-lg font-semibold ${isDangerous ? 'text-red-900 dark:text-red-200' : 'text-gray-900 dark:text-white'}`}>
            {title}
          </h2>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          <p className="text-gray-700 dark:text-gray-300 mb-2">
            {message}
          </p>
          {itemName && (
            <div className="mt-3 p-3 bg-gray-100 dark:bg-gray-700 rounded text-gray-900 dark:text-gray-100 font-semibold break-all">
              {itemName}
            </div>
          )}
          {isDangerous && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded text-red-700 dark:text-red-200 text-sm">
              ⚠️ This action cannot be undone.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 ${
              isDangerous
                ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-400'
                : 'bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400'
            }`}
          >
            {isLoading ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Deleting...
              </>
            ) : (
              <>Delete</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
