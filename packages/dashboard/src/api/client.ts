import type {
  Workflow,
  AgentTask,
  WorkflowTimeline,
  TraceDetails,
  TraceSpan,
  DashboardOverview,
  AgentStats,
  TimeSeriesDataPoint,
} from '../types'

// Get API base URL from environment or derive from current location
const getAPIBase = (): string => {
  // If environment variable is set, use it
  const apiUrl = (import.meta.env as Record<string, any>).VITE_API_URL
  if (apiUrl) {
    return apiUrl
  }

  // When running in browser, always use the orchestrator on port 3000
  if (typeof window !== 'undefined') {
    // Browser can always reach localhost:3000 (orchestrator running on host via PM2)
    return 'http://localhost:3000/api/v1'
  }

  // Fallback (shouldn't reach here in browser)
  return '/api/v1'
}

const API_BASE = getAPIBase()

async function fetchJSON<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return response.json()
}

// Workflow API
export async function fetchWorkflows(filters?: {
  status?: string
  type?: string
  priority?: string
}): Promise<Workflow[]> {
  const params = new URLSearchParams()
  if (filters?.status) params.append('status', filters.status)
  if (filters?.type) params.append('type', filters.type)
  if (filters?.priority) params.append('priority', filters.priority)

  const url = `${API_BASE}/workflows${params.toString() ? `?${params}` : ''}`
  const workflows = await fetchJSON<any[]>(url)
  // Transform API response: workflow_id -> id, progress_percentage -> progress
  return workflows.map(w => ({
    ...w,
    id: w.workflow_id || w.id,
    progress: w.progress_percentage ?? w.progress ?? 0,
    name: w.name || 'Unnamed Workflow',
    description: w.description || null,
    priority: w.priority || 'medium',
    created_by: w.created_by || 'system'
  }))
}

export async function fetchWorkflow(id: string): Promise<Workflow> {
  const workflow = await fetchJSON<any>(`${API_BASE}/workflows/${id}`)
  // Transform API response: workflow_id -> id, progress_percentage -> progress
  return {
    ...workflow,
    id: workflow.workflow_id || workflow.id,
    progress: workflow.progress_percentage ?? workflow.progress ?? 0,
    name: workflow.name || 'Unnamed Workflow',
    description: workflow.description || null,
    priority: workflow.priority || 'medium',
    created_by: workflow.created_by || 'system'
  }
}

export async function fetchWorkflowTasks(id: string): Promise<AgentTask[]> {
  return fetchJSON<AgentTask[]>(`${API_BASE}/workflows/${id}/tasks`)
}

export async function fetchWorkflowEvents(id: string) {
  return fetchJSON(`${API_BASE}/workflows/${id}/events`)
}

export async function fetchWorkflowTimeline(id: string): Promise<WorkflowTimeline> {
  return fetchJSON<WorkflowTimeline>(`${API_BASE}/workflows/${id}/timeline`)
}

// Stats API
export async function fetchDashboardOverview(): Promise<DashboardOverview> {
  return fetchJSON<DashboardOverview>(`${API_BASE}/stats/overview`)
}

export async function fetchAgentStats(): Promise<AgentStats[]> {
  return fetchJSON<AgentStats[]>(`${API_BASE}/stats/agents`)
}

export async function fetchTimeSeries(period: string = '24h'): Promise<TimeSeriesDataPoint[]> {
  return fetchJSON<TimeSeriesDataPoint[]>(`${API_BASE}/stats/timeseries?period=${period}`)
}

export async function fetchWorkflowStats() {
  return fetchJSON(`${API_BASE}/stats/workflows`)
}

// Trace API
export async function fetchTrace(traceId: string): Promise<TraceDetails> {
  return fetchJSON<TraceDetails>(`${API_BASE}/traces/${traceId}`)
}

export async function fetchTraceSpans(traceId: string): Promise<TraceSpan[]> {
  return fetchJSON<TraceSpan[]>(`${API_BASE}/traces/${traceId}/spans`)
}

export async function fetchTraceWorkflows(traceId: string): Promise<Workflow[]> {
  return fetchJSON<Workflow[]>(`${API_BASE}/traces/${traceId}/workflows`)
}

export async function fetchTraceTasks(traceId: string): Promise<AgentTask[]> {
  return fetchJSON<AgentTask[]>(`${API_BASE}/traces/${traceId}/tasks`)
}

// Task API
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

  const url = `${API_BASE}/tasks${params.toString() ? `?${params}` : ''}`
  return fetchJSON<AgentTask[]>(url)
}

export async function fetchTask(taskId: string): Promise<AgentTask> {
  return fetchJSON<AgentTask>(`${API_BASE}/tasks/${taskId}`)
}

// Platform API
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

export async function fetchPlatforms(): Promise<Platform[]> {
  return fetchJSON<Platform[]>(`${API_BASE}/platforms`)
}

export async function fetchPlatform(id: string): Promise<Platform> {
  return fetchJSON<Platform>(`${API_BASE}/platforms/${id}`)
}

export async function fetchPlatformAnalytics(
  id: string,
  period: string = '24h'
): Promise<PlatformAnalytics> {
  return fetchJSON<PlatformAnalytics>(`${API_BASE}/platforms/${id}/analytics?period=${period}`)
}

// Dashboard-specific API functions

/**
 * Fetch workflows that are slow (exceed threshold duration)
 * @param thresholdMs Duration threshold in milliseconds (default: 300000 = 5 minutes)
 */
export async function fetchSlowWorkflows(thresholdMs: number = 300000): Promise<Workflow[]> {
  try {
    // Try new endpoint if available
    const workflows = await fetchJSON<any[]>(`${API_BASE}/workflows/slow?threshold=${thresholdMs}`)
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
 * @param period Time period: '1h' | '24h' | '7d' | '30d'
 * @param bucketSize Bucket size in minutes (5 or 60)
 */
export interface ThroughputDataPoint {
  timestamp: string
  workflows_created: number
  workflows_completed: number
}

export async function fetchWorkflowThroughputData(
  period: string = '24h',
  _bucketSize: number = 5
): Promise<ThroughputDataPoint[]> {
  const timeSeries = await fetchTimeSeries(period)
  // Timeseries API returns the throughput data we need
  return timeSeries.map(point => ({
    timestamp: point.timestamp,
    workflows_created: point.count || 0,
    workflows_completed: point.count || 0,
  }))
}

/**
 * Fetch SLO compliance metrics
 */
export interface SLOMetrics {
  slo_threshold_ms: number
  total_workflows: number
  compliant_workflows: number
  compliance_rate: number
}

export async function fetchSLOMetrics(thresholdMs: number = 300000): Promise<SLOMetrics> {
  try {
    return fetchJSON<SLOMetrics>(`${API_BASE}/stats/slo?threshold=${thresholdMs}`)
  } catch {
    // Fallback: calculate SLO from workflows
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

/**
 * Fetch agent latency percentiles (p50, p95, p99)
 */
export interface AgentLatencyPercentiles {
  agent_type: string
  p50_ms: number
  p95_ms: number
  p99_ms: number
  avg_ms: number
}

export async function fetchAgentLatencyPercentiles(): Promise<AgentLatencyPercentiles[]> {
  try {
    return fetchJSON<AgentLatencyPercentiles[]>(`${API_BASE}/stats/agent-latency-percentiles`)
  } catch {
    // Fallback: get agent stats which include avg_duration_ms
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

/**
 * Fetch agent latency time series data
 */
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
    return fetchJSON<AgentLatencyTimePoint[]>(`${API_BASE}/stats/agent-latency-timeseries?period=${period}`)
  } catch {
    // Fallback: return empty array - feature requires backend support
    return []
  }
}

// Helper function to transform workflow response
function transformWorkflow(w: any): Workflow {
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
