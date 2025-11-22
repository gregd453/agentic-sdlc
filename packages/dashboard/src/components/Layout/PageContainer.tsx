import { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export interface Breadcrumb {
  label: string
  href?: string
}

interface PageContainerProps {
  title: string
  description?: string
  subtitle?: string  // Alias for description (backward compatibility)
  actions?: ReactNode
  headerAction?: ReactNode  // Backward compatibility
  headerActionSecondary?: ReactNode  // Backward compatibility
  breadcrumbs?: Breadcrumb[]
  children: ReactNode
  error?: string | null  // Backward compatibility
  isLoading?: boolean  // Backward compatibility
  onErrorDismiss?: () => void  // Backward compatibility
}

export function PageContainer({
  title,
  description,
  subtitle,
  actions,
  headerAction,
  headerActionSecondary,
  breadcrumbs,
  children,
  error,
  isLoading,
  onErrorDismiss,
}: PageContainerProps) {
  const finalDescription = description || subtitle
  const finalActions = actions || (
    <>
      {headerAction}
      {headerActionSecondary}
    </>
  )
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-4">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center space-x-1 text-sm text-muted-foreground">
            {breadcrumbs.map((crumb, index) => (
              <div key={index} className="flex items-center">
                {index > 0 && <ChevronRight className="mx-1 h-4 w-4" />}
                {crumb.href ? (
                  <Link
                    to={crumb.href}
                    className="hover:text-foreground transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-foreground font-medium">
                    {crumb.label}
                  </span>
                )}
              </div>
            ))}
          </nav>
        )}

        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            {finalDescription && (
              <p className="text-muted-foreground">{finalDescription}</p>
            )}
          </div>
          {finalActions && <div className="flex items-center gap-2">{finalActions}</div>}
        </div>

        {error && onErrorDismiss && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <div className="flex items-start justify-between">
              <p className="text-sm text-destructive">{error}</p>
              <button
                onClick={onErrorDismiss}
                className="text-destructive hover:text-destructive/80"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        )}
      </div>

      <div>{children}</div>
    </div>
  )
}
