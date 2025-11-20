/**
 * BaseModal - Reusable modal component for consistent UI
 * Eliminates duplicated modal structure across application
 * Handles: overlay, header, body, footer, error/success states, dark mode
 */

import React, { ReactNode } from 'react'

export interface BaseModalProps {
  /** Whether modal is open */
  isOpen: boolean
  /** Called when user closes modal (click close button, cancel, etc) */
  onClose: () => void
  /** Modal title */
  title: string
  /** Optional subtitle/description */
  subtitle?: string
  /** Error message to display */
  error?: string | null
  /** Success message to display */
  successMessage?: string
  /** Whether to show success state */
  success?: boolean
  /** Whether loading (disables buttons, shows spinner) */
  isLoading?: boolean
  /** Modal content (children) */
  children: ReactNode
  /** Custom footer content (replaces default buttons) */
  footer?: ReactNode
  /** Label for primary action button (if not using custom footer) */
  submitLabel?: string
  /** Called when submit button clicked */
  onSubmit?: () => void | Promise<void>
  /** Whether submit button is dangerous (red styling) */
  isDangerous?: boolean
  /** Modal size */
  size?: 'small' | 'medium' | 'large'
}

/**
 * BaseModal - Consistent modal wrapper for all dashboard dialogs
 *
 * Usage:
 * ```tsx
 * <BaseModal
 *   isOpen={isOpen}
 *   onClose={handleClose}
 *   title="Create Item"
 *   submitLabel="Create"
 *   onSubmit={handleSubmit}
 * >
 *   <form>
 *     <input type="text" />
 *   </form>
 * </BaseModal>
 * ```
 */
export function BaseModal({
  isOpen,
  onClose,
  title,
  subtitle,
  error,
  successMessage,
  success,
  isLoading = false,
  children,
  footer,
  submitLabel = 'Submit',
  onSubmit,
  isDangerous = false,
  size = 'medium'
}: BaseModalProps) {
  if (!isOpen) return null

  const maxWidthClass = {
    small: 'max-w-sm',
    medium: 'max-w-md',
    large: 'max-w-2xl'
  }[size]

  const handleSubmit = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (onSubmit && !isLoading) {
      await onSubmit()
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl ${maxWidthClass} w-full mx-4`}>
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {title}
              </h3>
              {subtitle && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {subtitle}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              disabled={isLoading}
              className="ml-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
              aria-label="Close modal"
            >
              <span className="text-2xl leading-none">×</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-900 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && successMessage && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-900 dark:text-green-200">✓ {successMessage}</p>
            </div>
          )}

          {/* Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 bg-black/5 dark:bg-black/20 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin inline-block w-6 h-6 border-3 border-gray-300 dark:border-gray-600 border-t-blue-500 rounded-full"></div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Loading...</p>
              </div>
            </div>
          )}

          {/* Content */}
          <div className={isLoading ? 'opacity-50 pointer-events-none' : ''}>
            {children}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4">
          {footer ? (
            footer
          ) : (
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              {onSubmit && (
                <button
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className={`flex-1 px-4 py-2 rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isDangerous
                      ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-400'
                      : 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <span className="inline-block animate-spin mr-2">⏳</span>
                      {submitLabel}...
                    </>
                  ) : (
                    submitLabel
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
