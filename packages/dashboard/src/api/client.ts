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

const API_BASE = '/api/v1'

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
