/**
 * EmptyState - Reusable empty state component
 * Used when no data is available to display
 */

import { ReactNode } from 'react'

export interface EmptyStateProps {
  /** Title text displayed */
  title: string
  /** Description text displayed */
  description?: string
  /** Icon or illustration element */
  icon?: ReactNode
  /** Action button element */
  action?: ReactNode
  /** Optional CSS class for container */
  className?: string
}

/**
 * EmptyState Component
 *
 * Usage:
 * ```tsx
 * <EmptyState
 *   title="No workflows found"
 *   description="Create your first workflow to get started"
 *   icon={<WorkflowIcon className="w-16 h-16" />}
 *   action={
 *     <button onClick={() => navigate('/create')}>
 *       Create Workflow
 *     </button>
 *   }
 * />
 * ```
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  className = ''
}: EmptyStateProps) {
  return (
    <div
      className={`text-center py-12 px-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}
    >
      {icon && <div className="flex justify-center mb-4">{icon}</div>}

      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>

      {description && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{description}</p>
      )}

      {action && <div className="flex justify-center">{action}</div>}
    </div>
  )
}
