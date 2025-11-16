import React, { useEffect, useState } from 'react'
import { fetchPlatforms } from '../../api/client'

interface Platform {
  id: string
  name: string
  layer: string
  description?: string
  enabled: boolean
  created_at?: string
  updated_at?: string
}

interface PlatformSelectorProps {
  onSelectPlatform?: (platformId: string | null) => void
  selectedPlatformId?: string | null
  label?: string
  showAll?: boolean
}

export const PlatformSelector: React.FC<PlatformSelectorProps> = ({
  onSelectPlatform,
  selectedPlatformId,
  label = 'Platform',
  showAll = true
}) => {
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadPlatforms()
  }, [])

  const loadPlatforms = async () => {
    try {
      setIsLoading(true)
      const data = await fetchPlatforms()
      setPlatforms(data.filter(p => p.enabled))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load platforms')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
        <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse" />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="platform-selector" className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      <select
        id="platform-selector"
        value={selectedPlatformId || ''}
        onChange={(e) => onSelectPlatform?.(e.target.value || null)}
        className="h-10 px-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:focus:ring-blue-400 transition-colors"
      >
        {showAll && (
          <option value="">All Platforms</option>
        )}
        {platforms.map((platform) => (
          <option key={platform.id} value={platform.id}>
            {platform.name} ({platform.layer.charAt(0) + platform.layer.slice(1).toLowerCase()})
          </option>
        ))}
      </select>
      {error && (
        <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
      )}
    </div>
  )
}
