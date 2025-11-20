/**
 * ProgressIndicator - Visual progress indicator component
 * Shows linear progress with percentage display
 */

export interface ProgressIndicatorProps {
  /** Current progress value (0-100) */
  value: number
  /** Label displayed above the indicator */
  label?: string
  /** Whether to show percentage text */
  showLabel?: boolean
  /** Color variant: primary (blue), success (green), warning (yellow), danger (red) */
  variant?: 'primary' | 'success' | 'warning' | 'danger'
  /** Optional size: sm, md, lg */
  size?: 'sm' | 'md' | 'lg'
  /** Optional CSS class for container */
  className?: string
}

const variantClasses = {
  primary: 'bg-blue-500',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  danger: 'bg-red-500'
}

const sizeClasses = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3'
}

/**
 * ProgressIndicator Component
 *
 * Usage:
 * ```tsx
 * <ProgressIndicator
 *   value={65}
 *   label="Workflow Progress"
 *   variant="success"
 *   showLabel
 * />
 * ```
 */
export function ProgressIndicator({
  value,
  label,
  showLabel = true,
  variant = 'primary',
  size = 'md',
  className = ''
}: ProgressIndicatorProps) {
  const clampedValue = Math.min(Math.max(value, 0), 100)

  return (
    <div className={className}>
      {label && (
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-medium text-gray-900 dark:text-white">{label}</label>
          {showLabel && (
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {Math.round(clampedValue)}%
            </span>
          )}
        </div>
      )}

      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`${variantClasses[variant]} ${sizeClasses[size]} rounded-full transition-all duration-300`}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  )
}
