import { z } from 'zod';

// Agent message types for communication
export const AgentMessageSchema = z.object({
  id: z.string(),
  type: z.enum(['task', 'result', 'error', 'heartbeat']),
  agent_id: z.string(),
  workflow_id: z.string(),
  stage: z.string(),
  payload: z.record(z.unknown()),
  timestamp: z.string(),
  trace_id: z.string(),
  parent_message_id: z.string().optional()
});

export type AgentMessage = z.infer<typeof AgentMessageSchema>;

// Task assignment schema
export const TaskAssignmentSchema = z.object({
  task_id: z.string().uuid(),
  workflow_id: z.string().uuid(),
  type: z.string(),
  name: z.string(),
  description: z.string(),
  requirements: z.string(),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  context: z.record(z.unknown()).optional(),
  deadline: z.string().optional()
});

export type TaskAssignment = z.infer<typeof TaskAssignmentSchema>;

// Task result schema
export const TaskResultSchema = z.object({
  task_id: z.string().uuid(),
  workflow_id: z.string().uuid(),
  status: z.enum(['success', 'failure', 'partial']),
  output: z.record(z.unknown()),
  errors: z.array(z.string()).optional(),
  metrics: z.object({
    duration_ms: z.number(),
    tokens_used: z.number().optional(),
    api_calls: z.number().optional()
  }).optional(),
  next_stage: z.string().optional()
});

export type TaskResult = z.infer<typeof TaskResultSchema>;

// Agent capabilities
export interface AgentCapabilities {
  type: string;
  version: string;
  capabilities: string[];
  max_tokens?: number;
  timeout_ms?: number;
}

// Agent health status
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime_ms: number;
  tasks_processed: number;
  last_task_at?: string;
  errors_count: number;
}

// Result type for error handling
export type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };

// Agent lifecycle interface
export interface AgentLifecycle {
  initialize(): Promise<void>;
  receiveTask(message: AgentMessage): Promise<void>;
  validateTask(task: unknown): TaskAssignment;
  execute(task: TaskAssignment): Promise<TaskResult>;
  reportResult(result: TaskResult): Promise<void>;
  cleanup(): Promise<void>;
  healthCheck(): Promise<HealthStatus>;
}

// Agent error types
export class AgentError extends Error {
  constructor(message: string, public readonly code?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AgentError';
  }
}

export class ValidationError extends AgentError {
  constructor(message: string, public readonly validationErrors: any[]) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class TaskExecutionError extends AgentError {
  constructor(message: string, public readonly task_id: string) {
    super(message, 'TASK_EXECUTION_ERROR');
    this.name = 'TaskExecutionError';
  }
}