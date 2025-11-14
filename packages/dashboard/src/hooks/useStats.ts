import { useQuery } from '@tanstack/react-query'
import { fetchDashboardOverview, fetchAgentStats, fetchTimeSeries } from '../api/client'

export function useStats(refetchInterval: number = 10000) {
  return useQuery({
    queryKey: ['stats', 'overview'],
    queryFn: fetchDashboardOverview,
    refetchInterval,
  })
}

export function useAgentStats(refetchInterval: number = 10000) {
  return useQuery({
    queryKey: ['stats', 'agents'],
    queryFn: fetchAgentStats,
    refetchInterval,
  })
}

export function useTimeSeries(period: string = '24h', refetchInterval: number = 30000) {
  return useQuery({
    queryKey: ['stats', 'timeseries', period],
    queryFn: () => fetchTimeSeries(period),
    refetchInterval,
  })
}
