/**
 * Traces API - Handles trace fetching and span data
 * Part of modularized API client
 */

import type { TraceDetails, TraceSpan, AgentTask, Workflow } from '../types'
import { getAPIBase, fetchJSON } from './client'


// Trace List Fetching
export async function fetchTraces(options?: {
  limit?: number
  offset?: number
  status?: string
}): Promise<{ traces: TraceDetails[]; total: number }> {
  const params = new URLSearchParams()
  if (options?.limit) params.append('limit', options.limit.toString())
  if (options?.offset) params.append('offset', options.offset.toString())
  if (options?.status) params.append('status', options.status)

  const url = `${getAPIBase()}/traces${params.toString() ? `?${params}` : ''}`
  return fetchJSON<{ traces: TraceDetails[]; total: number }>(url)
}

// Single Trace Fetching
export async function fetchTrace(traceId: string): Promise<TraceDetails> {
  return fetchJSON<TraceDetails>(`${getAPIBase()}/traces/${traceId}`)
}

// Trace Details - Spans
export async function fetchTraceSpans(traceId: string): Promise<TraceSpan[]> {
  return fetchJSON<TraceSpan[]>(`${getAPIBase()}/traces/${traceId}/spans`)
}

// Trace Details - Workflows
export async function fetchTraceWorkflows(traceId: string): Promise<Workflow[]> {
  return fetchJSON<Workflow[]>(`${getAPIBase()}/traces/${traceId}/workflows`)
}

// Trace Details - Tasks
export async function fetchTraceTasks(traceId: string): Promise<AgentTask[]> {
  return fetchJSON<AgentTask[]>(`${getAPIBase()}/traces/${traceId}/tasks`)
}
