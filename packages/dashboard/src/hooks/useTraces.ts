import { useQuery } from '@tanstack/react-query'
import { fetchTraces, fetchTrace } from '../api/client'

export function useTraces(options?: {
  limit?: number
  offset?: number
  status?: string
}, refetchInterval: number = 15000) {
  return useQuery({
    queryKey: ['traces', options],
    queryFn: () => fetchTraces(options),
    refetchInterval,
  })
}

export function useTrace(traceId: string | undefined, refetchInterval: number = 5000) {
  return useQuery({
    queryKey: ['trace', traceId],
    queryFn: () => {
      if (!traceId) throw new Error('Trace ID is required')
      return fetchTrace(traceId)
    },
    enabled: !!traceId,
    refetchInterval: traceId ? refetchInterval : false,
  })
}
