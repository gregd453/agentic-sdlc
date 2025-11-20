/**
 * Platform API - Handles platform CRUD and analytics
 * Part of modularized API client
 */

import type { TimeSeriesDataPoint } from '../types'
import { getAPIBase, fetchJSON } from './client'

// Types
export interface Platform {
  id: string
  name: string
  layer: string
  description?: string
  enabled: boolean
  created_at?: string
  updated_at?: string
}

export interface PlatformAnalytics {
  platform_id: string
  platform_name: string
  total_workflows: number
  completed_workflows: number
  failed_workflows: number
  running_workflows: number
  avg_completion_time_ms: number | null
  success_rate: number
  timeseries: TimeSeriesDataPoint[]
}

// Read Operations
export async function fetchPlatforms(): Promise<Platform[]> {
  return fetchJSON<Platform[]>(`${getAPIBase()}/platforms`)
}

export async function fetchPlatform(id: string): Promise<Platform> {
  return fetchJSON<Platform>(`${getAPIBase()}/platforms/${id}`)
}

export async function fetchPlatformAnalytics(
  id: string,
  period: string = '24h'
): Promise<PlatformAnalytics> {
  return fetchJSON<PlatformAnalytics>(`${getAPIBase()}/platforms/${id}/analytics?period=${period}`)
}

export async function fetchPlatformAgents(platformId: string): Promise<any[]> {
  return fetchJSON<any[]>(`${getAPIBase()}/platforms/${platformId}/agents`)
}

// Create Operation
export async function createPlatform(data: {
  name: string
  layer: 'APPLICATION' | 'DATA' | 'INFRASTRUCTURE' | 'ENTERPRISE'
  description?: string
  config?: Record<string, any>
  enabled?: boolean
}): Promise<Platform> {
  const response = await fetch(`${getAPIBase()}/platforms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create platform')
  }

  return response.json()
}

// Update Operation
export async function updatePlatform(
  id: string,
  data: {
    name?: string
    layer?: 'APPLICATION' | 'DATA' | 'INFRASTRUCTURE' | 'ENTERPRISE'
    description?: string | null
    config?: Record<string, any>
    enabled?: boolean
  }
): Promise<Platform> {
  const response = await fetch(`${getAPIBase()}/platforms/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update platform')
  }

  return response.json()
}

// Delete Operation
export async function deletePlatform(id: string): Promise<void> {
  const response = await fetch(`${getAPIBase()}/platforms/${id}`, {
    method: 'DELETE'
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete platform')
  }
}
