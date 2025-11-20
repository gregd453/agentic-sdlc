/**
 * Agents API - Handles agent discovery and validation
 * Part of modularized API client
 */

import { getAPIBase, fetchJSON } from './client'


// Types
export interface AgentMetadata {
  type: string
  name: string
  version: string
  description?: string
  capabilities: string[]
  timeout_ms: number
  max_retries: number
  configSchema?: Record<string, any>
  scope: 'global' | 'platform'
  platformId?: string
}

// Agent Discovery
export async function fetchAgents(platformId?: string): Promise<AgentMetadata[]> {
  const params = new URLSearchParams()
  if (platformId) params.append('platform', platformId)

  const url = `${getAPIBase()}/agents${params.toString() ? `?${params}` : ''}`
  return fetchJSON<AgentMetadata[]>(url)
}

export async function fetchAgent(agentType: string, platformId?: string): Promise<AgentMetadata> {
  const params = new URLSearchParams()
  if (platformId) params.append('platform', platformId)

  const url = `${getAPIBase()}/agents/${agentType}${params.toString() ? `?${params}` : ''}`
  return fetchJSON<AgentMetadata>(url)
}

// Agent Validation
export async function validateAgent(agentType: string, platformId?: string): Promise<{
  valid: boolean
  agent?: AgentMetadata
  error?: string
  suggestions?: string[]
}> {
  const response = await fetch(`${getAPIBase()}/agents/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agent_type: agentType,
      platform_id: platformId
    })
  })

  if (!response.ok && response.status !== 400) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  return response.json()
}

// Agent Analytics - Latency Percentiles
export interface AgentLatencyPercentiles {
  agent_type: string
  p50_ms: number
  p95_ms: number
  p99_ms: number
  avg_ms: number
}

export async function fetchAgentLatencyPercentiles(): Promise<AgentLatencyPercentiles[]> {
  try {
    return fetchJSON<AgentLatencyPercentiles[]>(`${getAPIBase()}/stats/agent-latency-percentiles`)
  } catch {
    // Fallback: get agent stats which include avg_duration_ms
    const { fetchAgentStats } = await import('./stats')
    const stats = await fetchAgentStats()

    return stats.map(s => ({
      agent_type: s.agent_type,
      p50_ms: s.avg_duration_ms || 0,
      p95_ms: (s.avg_duration_ms || 0) * 1.5,
      p99_ms: (s.avg_duration_ms || 0) * 2,
      avg_ms: s.avg_duration_ms || 0,
    }))
  }
}

// Agent Analytics - Latency Time Series
export interface AgentLatencyTimePoint {
  timestamp: string
  scaffold_ms: number
  validation_ms: number
  e2e_ms: number
  integration_ms: number
  deployment_ms: number
  [key: string]: any
}

export async function fetchAgentLatencyTimeSeries(period: string = '24h'): Promise<AgentLatencyTimePoint[]> {
  try {
    return fetchJSON<AgentLatencyTimePoint[]>(`${getAPIBase()}/stats/agent-latency-timeseries?period=${period}`)
  } catch {
    // Fallback: return empty array - feature requires backend support
    return []
  }
}
