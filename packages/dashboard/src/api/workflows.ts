/**
 * Workflow API - Handles workflow-related API calls
 * Part of modularized API client
 */

import type { Workflow, AgentTask, WorkflowTimeline } from '../types'
import { getAPIBase, fetchJSON, transformWorkflow } from './client'


// Workflow Fetching
export async function fetchWorkflows(filters?: {
  status?: string
  type?: string
  priority?: string
}): Promise<Workflow[]> {
  const params = new URLSearchParams()
  if (filters?.status) params.append('status', filters.status)
  if (filters?.type) params.append('type', filters.type)
  if (filters?.priority) params.append('priority', filters.priority)

  const url = `${getAPIBase()}/workflows${params.toString() ? `?${params}` : ''}`
  const workflows = await fetchJSON<any[]>(url)
  return workflows.map(transformWorkflow)
}

export async function fetchWorkflow(id: string): Promise<Workflow> {
  const workflow = await fetchJSON<any>(`${getAPIBase()}/workflows/${id}`)
  return transformWorkflow(workflow)
}

export async function fetchWorkflowTasks(id: string): Promise<AgentTask[]> {
  return fetchJSON<AgentTask[]>(`${getAPIBase()}/workflows/${id}/tasks`)
}

export async function fetchWorkflowEvents(id: string) {
  return fetchJSON(`${getAPIBase()}/workflows/${id}/events`)
}

export async function fetchWorkflowTimeline(id: string): Promise<WorkflowTimeline> {
  return fetchJSON<WorkflowTimeline>(`${getAPIBase()}/workflows/${id}/timeline`)
}

// Workflow Creation
export async function createWorkflow(data: {
  name: string
  description?: string
  type?: string
  priority?: string
  stages?: any[]
  behavior_metadata?: any
}): Promise<Workflow> {
  const response = await fetch(`${getAPIBase()}/workflows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const workflow = await response.json()
  return transformWorkflow(workflow)
}

// Workflow Analytics
/**
 * Fetch workflows that are slow (exceed threshold duration)
 * @param thresholdMs Duration threshold in milliseconds (default: 300000 = 5 minutes)
 */
export async function fetchSlowWorkflows(thresholdMs: number = 300000): Promise<Workflow[]> {
  try {
    // Try new endpoint if available
    const workflows = await fetchJSON<any[]>(`${getAPIBase()}/workflows/slow?threshold=${thresholdMs}`)
    return workflows.map(transformWorkflow)
  } catch {
    // Fallback: fetch all workflows and filter client-side
    const all = await fetchWorkflows()
    const now = new Date().getTime()
    return all.filter(w => {
      const duration = w.completed_at
        ? new Date(w.completed_at).getTime() - new Date(w.created_at).getTime()
        : now - new Date(w.created_at).getTime()
      return duration > thresholdMs
    })
  }
}

/**
 * Fetch workflow throughput data (creation/completion rates over time)
 */
export interface ThroughputDataPoint {
  timestamp: string
  workflows_created: number
  workflows_completed: number
}

export async function fetchWorkflowThroughputData(
  period: string = '24h'
): Promise<ThroughputDataPoint[]> {
  const { fetchTimeSeries } = await import('./stats')
  const timeSeries = await fetchTimeSeries(period)

  return timeSeries.map(point => ({
    timestamp: point.timestamp,
    workflows_created: point.count || 0,
    workflows_completed: point.count || 0,
  }))
}
