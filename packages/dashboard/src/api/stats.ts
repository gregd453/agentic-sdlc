/**
 * Stats API - Handles dashboard statistics and metrics
 * Part of modularized API client
 */

import type { DashboardOverview, AgentStats, TimeSeriesDataPoint } from '../types'
import { getAPIBase, fetchJSON } from './client'


// Dashboard Overview
export async function fetchDashboardOverview(): Promise<DashboardOverview> {
  return fetchJSON<DashboardOverview>(`${getAPIBase()}/stats/overview`)
}

// Agent Statistics
export async function fetchAgentStats(): Promise<AgentStats[]> {
  return fetchJSON<AgentStats[]>(`${getAPIBase()}/stats/agents`)
}

// Time Series Data
export async function fetchTimeSeries(period: string = '24h'): Promise<TimeSeriesDataPoint[]> {
  return fetchJSON<TimeSeriesDataPoint[]>(`${getAPIBase()}/stats/timeseries?period=${period}`)
}

// Workflow Statistics
export async function fetchWorkflowStats() {
  return fetchJSON(`${getAPIBase()}/stats/workflows`)
}

// SLO Metrics
export interface SLOMetrics {
  slo_threshold_ms: number
  total_workflows: number
  compliant_workflows: number
  compliance_rate: number
}

export async function fetchSLOMetrics(thresholdMs: number = 300000): Promise<SLOMetrics> {
  try {
    return fetchJSON<SLOMetrics>(`${getAPIBase()}/stats/slo?threshold=${thresholdMs}`)
  } catch {
    // Fallback: calculate SLO from workflows
    const { fetchWorkflows } = await import('./workflows')
    const all = await fetchWorkflows()
    const completed = all.filter(w => w.status === 'completed')

    const compliant = completed.filter(w => {
      const duration = w.completed_at
        ? new Date(w.completed_at).getTime() - new Date(w.created_at).getTime()
        : thresholdMs
      return duration <= thresholdMs
    })

    return {
      slo_threshold_ms: thresholdMs,
      total_workflows: all.length,
      compliant_workflows: compliant.length,
      compliance_rate: all.length > 0 ? (compliant.length / all.length) * 100 : 0,
    }
  }
}
