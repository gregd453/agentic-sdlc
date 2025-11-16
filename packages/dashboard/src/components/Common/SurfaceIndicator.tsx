import React from 'react'

export type SurfaceType = 'REST' | 'WEBHOOK' | 'CLI' | 'DASHBOARD' | 'MOBILE_API' | null | undefined

interface SurfaceIndicatorProps {
  surface?: SurfaceType
  size?: 'small' | 'medium' | 'large'
  showLabel?: boolean
}

export const SurfaceIndicator: React.FC<SurfaceIndicatorProps> = ({
  surface,
  size = 'medium',
  showLabel = true
}) => {
  if (!surface) {
    return null
  }

  const getSurfaceIcon = (surface: SurfaceType): string => {
    switch (surface) {
      case 'REST':
        return '🌐'
      case 'WEBHOOK':
        return '🪝'
      case 'CLI':
        return '⌨️'
      case 'DASHBOARD':
        return '📊'
      case 'MOBILE_API':
        return '📱'
      default:
        return '🔌'
    }
  }

  const getSurfaceColor = (surface: SurfaceType): string => {
    switch (surface) {
      case 'REST':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'WEBHOOK':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      case 'CLI':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'DASHBOARD':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
      case 'MOBILE_API':
        return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
    }
  }

  const getSizeClasses = (): string => {
    switch (size) {
      case 'small':
        return 'px-2 py-1 text-xs'
      case 'large':
        return 'px-4 py-2 text-base'
      default:
        return 'px-3 py-1.5 text-sm'
    }
  }

  const displayLabel = surface.replace('_', ' ')

  return (
    <div className={`inline-flex items-center gap-1 rounded-full font-medium ${getSizeClasses()} ${getSurfaceColor(surface)}`}>
      <span>{getSurfaceIcon(surface)}</span>
      {showLabel && <span>{displayLabel}</span>}
    </div>
  )
}
