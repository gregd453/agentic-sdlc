/**
 * useAgentMetadata - Hook for fetching agent metadata
 * Session #85: Dashboard Agent Extensibility
 *
 * Provides:
 * - Fetching agent metadata by type
 * - Caching with localStorage
 * - Loading and error states
 * - Platform-scoped queries
 */

import { useState, useEffect, useCallback } from 'react'
import { fetchAgent, AgentMetadata } from '../api/client'

interface UseAgentMetadataResult {
  agent: AgentMetadata | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

// Simple in-memory cache for agent metadata
const metadataCache = new Map<string, AgentMetadata>()
const cacheTTL = 5 * 60 * 1000 // 5 minutes
const cacheTimestamps = new Map<string, number>()

function getCacheKey(agentType: string, platformId?: string): string {
  return platformId ? `${agentType}:${platformId}` : agentType
}

function isCacheValid(key: string): boolean {
  const timestamp = cacheTimestamps.get(key)
  if (!timestamp) return false
  return Date.now() - timestamp < cacheTTL
}

/**
 * Hook to fetch agent metadata with caching
 */
export function useAgentMetadata(
  agentType: string | null,
  platformId?: string
): UseAgentMetadataResult {
  const [agent, setAgent] = useState<AgentMetadata | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAndCache = useCallback(async () => {
    if (!agentType) {
      setAgent(null)
      setLoading(false)
      setError(null)
      return
    }

    const cacheKey = getCacheKey(agentType, platformId)

    // Check cache first
    if (metadataCache.has(cacheKey) && isCacheValid(cacheKey)) {
      setAgent(metadataCache.get(cacheKey) || null)
      setLoading(false)
      setError(null)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const metadata = await fetchAgent(agentType, platformId)
      setAgent(metadata)
      metadataCache.set(cacheKey, metadata)
      cacheTimestamps.set(cacheKey, Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch agent metadata')
      setAgent(null)
    } finally {
      setLoading(false)
    }
  }, [agentType, platformId])

  useEffect(() => {
    fetchAndCache()
  }, [fetchAndCache])

  return {
    agent,
    loading,
    error,
    refetch: fetchAndCache
  }
}

/**
 * Clear the metadata cache (useful for testing or when agents are updated)
 */
export function clearAgentMetadataCache(): void {
  metadataCache.clear()
  cacheTimestamps.clear()
}
