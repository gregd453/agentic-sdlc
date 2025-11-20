/**
 * Alert - Reusable alert component for consistent error/success messaging
 * Replaces 15+ duplicated error/success message implementations
 * Supports: error, success, warning, info variants
 */

export type AlertType = 'error' | 'success' | 'warning' | 'info'

export interface AlertProps {
  /** Alert type (error, success, warning, info) */
  type: AlertType
  /** Message text */
  message: string
  /** Optional title */
  title?: string
  /** Called when dismiss button is clicked */
  onDismiss?: () => void
}

/**
 * Alert - Consistent alert component with dark mode support
 *
 * Usage:
 * ```tsx
 * <Alert type="error" message="Something went wrong" onDismiss={() => setError(null)} />
 * <Alert type="success" message="Saved successfully!" />
 * <Alert type="warning" title="Warning" message="Are you sure?" />
 * <Alert type="info" message="This is informational" />
 * ```
 */
export function Alert({
  type,
  message,
  title,
  onDismiss
}: AlertProps) {
  const colorMap: Record<AlertType, { bg: string; border: string; text: string; icon: string }> = {
    error: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800',
      text: 'text-red-900 dark:text-red-200',
      icon: '❌'
    },
    success: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-200 dark:border-green-800',
      text: 'text-green-900 dark:text-green-200',
      icon: '✓'
    },
    warning: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      border: 'border-yellow-200 dark:border-yellow-800',
      text: 'text-yellow-900 dark:text-yellow-200',
      icon: '⚠️'
    },
    info: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-800',
      text: 'text-blue-900 dark:text-blue-200',
      icon: 'ℹ️'
    }
  }

  const colors = colorMap[type]

  return (
    <div className={`p-4 rounded-lg border ${colors.bg} ${colors.border}`}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <span className="text-lg flex-shrink-0 mt-0.5">{colors.icon}</span>

        {/* Content */}
        <div className="flex-1">
          {title && (
            <h4 className={`font-semibold ${colors.text} mb-1`}>
              {title}
            </h4>
          )}
          <p className={`text-sm ${colors.text}`}>
            {message}
          </p>
        </div>

        {/* Dismiss button */}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className={`flex-shrink-0 mt-0.5 ${colors.text} hover:opacity-70 transition-opacity`}
            aria-label="Dismiss alert"
          >
            <span className="text-lg">×</span>
          </button>
        )}
      </div>
    </div>
  )
}
