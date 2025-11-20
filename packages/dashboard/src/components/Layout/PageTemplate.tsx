/**
 * PageTemplate - Reusable page layout component
 * Consolidates repeated page header, error handling, and loading patterns
 * Used in all 12 dashboard pages for consistent layout
 */

import { ReactNode } from 'react'
import { Alert } from '../Common/Alert'
import PageTransition from '../Animations/PageTransition'
import { SPACING } from '../../constants/theme'

export interface PageTemplateProps {
  /** Page title */
  title: string
  /** Optional subtitle/description */
  subtitle?: string
  /** Error message to display */
  error?: string | null
  /** Whether page is loading */
  isLoading?: boolean
  /** Page content */
  children: ReactNode
  /** Header action button/element (right side) */
  headerAction?: ReactNode
  /** Secondary header action button/element */
  headerActionSecondary?: ReactNode
  /** Called when error is dismissed */
  onErrorDismiss?: () => void
}

/**
 * PageTemplate - Consistent page layout with header, error handling, and loading states
 *
 * Usage:
 * ```tsx
 * export function MyPage() {
 *   const { state, actions } = useCRUD(...)
 *
 *   return (
 *     <PageTemplate
 *       title="My Items"
 *       subtitle="Manage all your items here"
 *       error={state.error}
 *       isLoading={state.isLoading}
 *       headerAction={
 *         <button onClick={() => setIsCreateOpen(true)}>
 *           + New Item
 *         </button>
 *       }
 *       onErrorDismiss={() => actions.clearError()}
 *     >
 *       {state.items.map(item => (
 *         <ItemCard key={item.id} item={item} />
 *       ))}
 *     </PageTemplate>
 *   )
 * }
 * ```
 */
export function PageTemplate({
  title,
  subtitle,
  error,
  isLoading = false,
  children,
  headerAction,
  headerActionSecondary,
  onErrorDismiss
}: PageTemplateProps) {
  return (
    <PageTransition>
      <div className={SPACING.lg}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                {subtitle}
              </p>
            )}
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {headerActionSecondary && (
              <div>{headerActionSecondary}</div>
            )}
            {headerAction && (
              <div>{headerAction}</div>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert
            type="error"
            message={error}
            onDismiss={onErrorDismiss}
          />
        )}

        {/* Content or Loading State */}
        {isLoading ? (
          <div className="space-y-4">
            {/* Loading Skeleton */}
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg"
                />
              ))}
            </div>
          </div>
        ) : (
          children
        )}
      </div>
    </PageTransition>
  )
}
