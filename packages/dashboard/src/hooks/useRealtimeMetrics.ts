/**
 * useRealtimeMetrics Hook
 * Subscribes to real-time metrics via WebSocket with fallback to HTTP polling
 * Manages connection state and automatic cleanup
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { subscribeToMetrics, fetchRealtimeMetrics, RealtimeMetrics } from '../api/client'

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'polling' | 'disconnected' | 'error'

export interface UseRealtimeMetricsResult {
  metrics: RealtimeMetrics | null
  status: ConnectionStatus
  error: Error | null
  isLoading: boolean
}

/**
 * Hook for subscribing to real-time metrics
 *
 * Usage:
 * ```tsx
 * const { metrics, status, error, isLoading } = useRealtimeMetrics()
 *
 * if (isLoading) return <Spinner />
 * if (error) return <ErrorBanner error={error} />
 * if (status !== 'connected' && status !== 'polling') return <ConnectionStatus status={status} />
 *
 * return <Dashboard metrics={metrics} />
 * ```
 *
 * @param pollingInterval Fallback polling interval in ms (default 5000)
 * @param onError Optional callback for error handling
 * @returns Object with metrics, connection status, error, and loading state
 */
export function useRealtimeMetrics(
  pollingInterval: number = 5000,
  onError?: (error: Error) => void
): UseRealtimeMetricsResult {
  const [metrics, setMetrics] = useState<RealtimeMetrics | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [error, setError] = useState<Error | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const connectionAttemptsRef = useRef(0)
  const isFirstLoad = useRef(true)

  const handleError = useCallback(
    (err: Error) => {
      setError(err)
      if (onError) {
        onError(err)
      }
      console.error('[useRealtimeMetrics] Error:', err)
    },
    [onError]
  )

  useEffect(() => {
    let isComponentMounted = true
    let connectionTimeout: ReturnType<typeof setTimeout> | null = null

    const subscribe = () => {
      try {
        connectionAttemptsRef.current++

        // Set status based on attempt number
        if (connectionAttemptsRef.current === 1) {
          setStatus('connecting')
        } else {
          setStatus('reconnecting')
        }

        unsubscribeRef.current = subscribeToMetrics(
          (newMetrics: RealtimeMetrics) => {
            if (isComponentMounted) {
              setMetrics(newMetrics)

              // Update status based on timestamp freshness
              const metricAge = Date.now() - new Date(newMetrics.timestamp).getTime()
              if (metricAge < 10000) { // Less than 10 seconds old
                if (status !== 'connected' && status !== 'polling') {
                  setStatus('connected')
                }
              }

              setError(null)
              isFirstLoad.current = false
            }
          },
          pollingInterval
        )

        // Set a timeout to detect if metrics aren't updating
        connectionTimeout = setTimeout(() => {
          if (isComponentMounted && !metrics) {
            setStatus('polling')
          }
        }, 3000)
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        if (isComponentMounted) {
          handleError(error)
          setStatus('error')
        }
      }
    }

    subscribe()

    return () => {
      isComponentMounted = false

      if (connectionTimeout) {
        clearTimeout(connectionTimeout)
      }

      if (unsubscribeRef.current) {
        try {
          unsubscribeRef.current()
        } catch (err) {
          console.error('[useRealtimeMetrics] Error during cleanup:', err)
        }
        unsubscribeRef.current = null
      }
    }
  }, [pollingInterval, handleError, status, metrics])

  return {
    metrics,
    status,
    error,
    isLoading: metrics === null && status === 'connecting'
  }
}

/**
 * Alternative hook for polling-based metrics (simpler, no WebSocket)
 * Use this if you want simpler behavior without WebSocket complexity
 */
export function useRealtimeMetricsPolling(
  refetchInterval: number = 5000
) {
  const [metrics, setMetrics] = useState<RealtimeMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let isComponentMounted = true
    let pollingInterval: ReturnType<typeof setInterval> | null = null

    const fetchMetrics = async () => {
      try {
        const data = await fetchRealtimeMetrics()
        if (isComponentMounted) {
          setMetrics(data)
          setError(null)
          setIsLoading(false)
        }
      } catch (err) {
        if (isComponentMounted) {
          const error = err instanceof Error ? err : new Error(String(err))
          setError(error)
          setIsLoading(false)
        }
      }
    }

    // Initial fetch
    fetchMetrics()

    // Set up polling
    pollingInterval = setInterval(fetchMetrics, refetchInterval)

    return () => {
      isComponentMounted = false
      if (pollingInterval) {
        clearInterval(pollingInterval)
      }
    }
  }, [refetchInterval])

  return {
    metrics,
    isLoading,
    error,
    status: error ? 'error' : isLoading ? 'connecting' : 'polling' as ConnectionStatus
  }
}
