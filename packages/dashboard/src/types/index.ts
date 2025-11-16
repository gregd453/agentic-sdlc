// Workflow Types
export type WorkflowStatus = 'initiated' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused'
export type WorkflowType = 'app' | 'feature' | 'bugfix'
export type Priority = 'low' | 'medium' | 'high' | 'critical'

export interface Workflow {
  id: string
  name: string
  description: string | null
  type: WorkflowType
  status: WorkflowStatus
  current_stage: string
  priority: Priority
  progress: number
  trace_id: string | null
  current_span_id: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
  created_by: string
  stage_outputs: Record<string, any> | null
}

// Task Types
export type TaskStatus = 'pending' | 'assigned' | 'running' | 'completed' | 'failed' | 'cancelled'
export type AgentType = 'scaffold' | 'validation' | 'e2e' | 'integration' | 'deployment'

export interface AgentTask {
  task_id: string
  workflow_id: string
  agent_type: AgentType
  status: TaskStatus
  priority: Priority
  payload: Record<string, any>
  result: Record<string, any> | null
  assigned_at: string
  started_at: string | null
  completed_at: string | null
  retry_count: number
  max_retries: number
  trace_id: string | null
  span_id: string | null
  parent_span_id: string | null
}

// Trace Types
export interface TraceSpan {
  span_id: string
  parent_span_id: string | null
  trace_id: string
  entity_type: 'Workflow' | 'Task'
  entity_id: string
  status: string
  created_at: string
  completed_at: string | null
  duration_ms: number | null
  metadata?: Record<string, any>
}

export interface TraceMetadata {
  total_duration_ms: number | null
  span_count: number
  error_count: number
  workflow_count: number
  task_count: number
  start_time: string | null
  end_time: string | null
}

export interface TraceDetails {
  trace_id: string
  metadata: TraceMetadata
  hierarchy: {
    trace_id: string
    workflows: Workflow[]
    tasks: AgentTask[]
    spans: TraceSpan[]
  }
  tree: TraceTreeNode[]
}

export interface TraceTreeNode {
  span: TraceSpan
  children: TraceTreeNode[]
}

// Stats Types
export interface OverviewStats {
  total_workflows: number
  running_workflows: number
  completed_workflows: number
  failed_workflows: number
  cancelled_workflows: number
  paused_workflows: number
}

export interface DashboardOverview {
  overview: OverviewStats
  recent_workflows_count: number
  avg_completion_time_ms: number | null
}

export interface AgentStats {
  agent_type: string
  total_tasks: number
  completed_tasks: number
  failed_tasks: number
  cancelled_tasks: number
  avg_duration_ms: number
  avg_retries: number
  success_rate: number
}

export interface TimeSeriesDataPoint {
  timestamp: string
  count: number
}

// Event Types
export interface WorkflowEvent {
  id: string
  workflow_id: string
  event_type: string
  payload: Record<string, any>
  timestamp: string
  trace_id: string | null
}

// Timeline Types
export interface WorkflowTimeline {
  events: WorkflowEvent[]
  tasks: AgentTask[]
  stages: WorkflowStage[]
}

export interface WorkflowStage {
  id: string
  workflow_id: string
  name: string
  status: string
  started_at: string | null
  completed_at: string | null
}

// Platform Types
export type PlatformLayer = 'APPLICATION' | 'DATA' | 'INFRASTRUCTURE' | 'ENTERPRISE'

export interface Platform {
  id: string
  name: string
  layer: PlatformLayer
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
