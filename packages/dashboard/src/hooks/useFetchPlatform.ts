import { useState, useEffect } from 'react'
import { fetchPlatform, Platform } from '../api/client'

/**
 * useFetchPlatform
 * Hook to fetch a single platform by ID
 */
export function useFetchPlatform(id?: string) {
  const [platform, setPlatform] = useState<Platform | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setPlatform(null)
      return
    }

    const fetch = async () => {
      setLoading(true)
      setError(null)

      try {
        const data = await fetchPlatform(id)
        setPlatform(data)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch platform'
        setError(message)
        setPlatform(null)
      } finally {
        setLoading(false)
      }
    }

    fetch()
  }, [id])

  return {
    platform,
    loading,
    error
  }
}
