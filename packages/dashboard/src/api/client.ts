/**
 * API Client - Main client with shared utilities
 * Re-exports from modularized API modules
 */

import type { Workflow, AgentTask } from '../types'

// Shared Utilities
export function getAPIBase(): string {
  // If environment variable is set, use it (for Docker or custom setups)
  const apiUrl = (import.meta.env as Record<string, any>).VITE_API_URL
  if (apiUrl) {
    return apiUrl
  }

  // In development, use the actual orchestrator API directly
  // The dashboard (Vite) is served from localhost:3053, orchestrator API is at localhost:3051
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3051/api/v1'
  }

  // Default to relative path for production
  // In production, this will be relative to the domain or proxied by reverse proxy
  return '/api/v1'
}

export async function fetchJSON<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return response.json()
}

// Transform Workflow Response
export function transformWorkflow(w: any): Workflow {
  return {
    ...w,
    id: w.workflow_id || w.id,
    progress: w.progress_percentage ?? w.progress ?? 0,
    name: w.name || 'Unnamed Workflow',
    description: w.description || null,
    priority: w.priority || 'medium',
    created_by: w.created_by || 'system',
  }
}

// ============================================
// RE-EXPORTS FROM MODULARIZED MODULES
// ============================================

// Workflows
export {
  fetchWorkflows,
  fetchWorkflow,
  fetchWorkflowTasks,
  fetchWorkflowEvents,
  fetchWorkflowTimeline,
  createWorkflow,
  fetchSlowWorkflows,
  fetchWorkflowThroughputData,
  type ThroughputDataPoint,
} from './workflows'

// Platforms
export {
  fetchPlatforms,
  fetchPlatform,
  fetchPlatformAnalytics,
  fetchPlatformAgents,
  createPlatform,
  updatePlatform,
  deletePlatform,
  type Platform,
  type PlatformAnalytics,
} from './platforms'

// Traces
export {
  fetchTraces,
  fetchTrace,
  fetchTraceSpans,
  fetchTraceWorkflows,
  fetchTraceTasks,
} from './traces'

// Agents
export {
  fetchAgents,
  fetchAgent,
  validateAgent,
  fetchAgentLatencyPercentiles,
  fetchAgentLatencyTimeSeries,
  type AgentMetadata,
  type AgentLatencyPercentiles,
  type AgentLatencyTimePoint,
} from './agents'

// Definitions
export {
  createWorkflowDefinition,
  fetchWorkflowDefinition,
  fetchWorkflowDefinitions,
  updateWorkflowDefinition,
  deleteWorkflowDefinition,
  setWorkflowDefinitionEnabled,
  type WorkflowDefinition,
  type CreateWorkflowDefinitionRequest,
  type UpdateWorkflowDefinitionRequest,
} from './definitions'

// Stats
export {
  fetchDashboardOverview,
  fetchAgentStats,
  fetchTimeSeries,
  fetchWorkflowStats,
  fetchSLOMetrics,
  type SLOMetrics,
} from './stats'

// Task API (kept in main client for now as it's a small utility)
export async function fetchTasks(filters?: {
  workflow_id?: string
  agent_type?: string
  status?: string
  limit?: number
  offset?: number
}): Promise<AgentTask[]> {
  const params = new URLSearchParams()
  if (filters?.workflow_id) params.append('workflow_id', filters.workflow_id)
  if (filters?.agent_type) params.append('agent_type', filters.agent_type)
  if (filters?.status) params.append('status', filters.status)
  if (filters?.limit) params.append('limit', filters.limit.toString())
  if (filters?.offset) params.append('offset', filters.offset.toString())

  const url = `${getAPIBase()}/tasks${params.toString() ? `?${params}` : ''}`
  return fetchJSON<AgentTask[]>(url)
}

export async function fetchTask(taskId: string): Promise<AgentTask> {
  return fetchJSON<AgentTask>(`${getAPIBase()}/tasks/${taskId}`)
}
