import { z } from 'zod';

// SESSION #65: Import canonical schemas from shared-types
// AgentEnvelope v2.0.0 is THE ONLY valid schema for task assignments
import {
  AgentEnvelopeSchema,
  AgentEnvelope,
  validateAgentEnvelope,
  TaskResultSchema,
  TaskResult
} from '@agentic-sdlc/shared-types';

// Re-export for use in agents
export { AgentEnvelopeSchema, AgentEnvelope, validateAgentEnvelope, TaskResultSchema, TaskResult };

// Agent message types for communication
export const AgentMessageSchema = z.object({
  id: z.string(),
  type: z.enum(['task', 'result', LOG_LEVEL.ERROR, 'heartbeat']),
  agent_id: z.string(),
  workflow_id: z.string(),
  stage: z.string(),
  payload: z.record(z.unknown()),
  timestamp: z.string(),
  trace_id: z.string(),
  parent_message_id: z.string().optional()
});

export type AgentMessage = z.infer<typeof AgentMessageSchema>;

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
// SESSION #65: Updated to use AgentEnvelope v2.0.0
export interface AgentLifecycle {
  initialize(): Promise<void>;
  receiveTask(message: AgentMessage): Promise<void>;
  validateTask(task: unknown): AgentEnvelope;
  execute(task: AgentEnvelope): Promise<TaskResult>;
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