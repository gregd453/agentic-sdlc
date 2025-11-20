/**
 * LoadingState - Reusable loading state component
 * Shows loading spinner with optional message
 */

export interface LoadingStateProps {
  /** Loading message displayed below spinner */
  message?: string
  /** Optional size: sm, md, lg */
  size?: 'sm' | 'md' | 'lg'
  /** Optional CSS class for container */
  className?: string
}

const sizeClasses = {
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-12 h-12'
}

/**
 * LoadingState Component
 *
 * Usage:
 * ```tsx
 * <LoadingState
 *   message="Loading workflows..."
 *   size="md"
 * />
 * ```
 */
export function LoadingState({
  message,
  size = 'md',
  className = ''
}: LoadingStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
      <div className={`${sizeClasses[size]} text-blue-600 dark:text-blue-400 mb-4`}>
        <svg
          className="animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>

      {message && (
        <p className="text-gray-600 dark:text-gray-400 font-medium">{message}</p>
      )}
    </div>
  )
}
