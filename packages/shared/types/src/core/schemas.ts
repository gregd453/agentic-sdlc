import { z } from 'zod';
import {
  toWorkflowId,
  toAgentId,
  toTaskId
} from './brands';

/**
 * Core schemas for the Agentic SDLC system
 * Version 1.0.0
 */

export const VERSION = '1.0.0' as const;

// ===== Enums =====
export const WorkflowTypeEnum = z.enum([WORKFLOW_TYPES.APP, 'service', WORKFLOW_TYPES.FEATURE, 'capability']);
export const WorkflowStateEnum = z.enum([
  WORKFLOW_STATUS.INITIATED,
  'scaffolding',
  'validating',
  'testing',
  'integrating',
  'deploying',
  WORKFLOW_STATUS.COMPLETED,
  WORKFLOW_STATUS.FAILED,
  WORKFLOW_STATUS.CANCELLED
]);

export const AgentTypeEnum = z.enum([
  AGENT_TYPES.SCAFFOLD,
  AGENT_TYPES.VALIDATION,
  'e2e',
  AGENT_TYPES.INTEGRATION,
  AGENT_TYPES.DEPLOYMENT,
  'base'
]);

export const TaskStatusEnum = z.enum([
  TASK_STATUS.PENDING,
  'queued',
  WORKFLOW_STATUS.RUNNING,
  WORKFLOW_STATUS.SUCCESS,
  WORKFLOW_STATUS.FAILED,
  'timeout',
  WORKFLOW_STATUS.CANCELLED,
  'retrying'
]);

// ===== Core Workflow Schema =====
export const WorkflowSchema = z.object({
  workflow_id: z.string().transform(toWorkflowId),
  type: WorkflowTypeEnum,
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  current_stage: WorkflowStateEnum,
  previous_stage: WorkflowStateEnum.optional(),
  progress: z.number().min(0).max(100).default(0),
  version: z.literal(VERSION),
  metadata: z.record(z.unknown()).optional(),
  config: z.object({
    auto_approve: z.boolean().default(false),
    max_duration_ms: z.number().default(3600000), // 1 hour
    quality_gates: z.record(z.number()).optional(),
  }).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  started_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional(),
  created_by: z.string().optional(),
  error: z.string().optional(),
});

// ===== Base Agent Task Schema =====
export const AgentTaskSchema = z.object({
  task_id: z.string().transform(toTaskId),
  workflow_id: z.string().transform(toWorkflowId),
  agent_type: AgentTypeEnum,
  action: z.string(),
  status: TaskStatusEnum.default(TASK_STATUS.PENDING),
  priority: z.number().min(0).max(100).default(50),
  payload: z.record(z.unknown()),
  version: z.literal(VERSION),
  timeout_ms: z.number().min(1000).default(120000), // 2 minutes
  retry_count: z.number().min(0).default(0),
  max_retries: z.number().min(0).max(10).default(3),
  parent_task_id: z.string().transform(toTaskId).optional(),
  depends_on: z.array(z.string().transform(toTaskId)).optional(),
  created_at: z.string().datetime(),
  scheduled_at: z.string().datetime().optional(),
  started_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional(),
});

// ===== Base Agent Result Schema =====
export const AgentResultSchema = z.object({
  task_id: z.string().transform(toTaskId),
  workflow_id: z.string().transform(toWorkflowId),
  agent_id: z.string().transform(toAgentId),
  agent_type: AgentTypeEnum,
  success: z.boolean(),
  status: TaskStatusEnum,
  action: z.string(),
  result: z.record(z.unknown()),
  artifacts: z.array(z.object({
    name: z.string(),
    path: z.string(),
    type: z.string(),
    size_bytes: z.number().optional(),
  })).optional(),
  metrics: z.object({
    duration_ms: z.number(),
    tokens_used: z.number().optional(),
    api_calls: z.number().optional(),
    memory_used_bytes: z.number().optional(),
  }),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
    stack: z.string().optional(),
    retryable: z.boolean().default(false),
  }).optional(),
  warnings: z.array(z.string()).optional(),
  timestamp: z.string().datetime(),
  version: z.literal(VERSION),
});

// ===== Pipeline Stage Schema =====
export const PipelineStageSchema = z.object({
  stage_id: z.string(),
  name: z.string(),
  agent_type: AgentTypeEnum,
  action: z.string(),
  status: z.enum([TASK_STATUS.PENDING, WORKFLOW_STATUS.RUNNING, WORKFLOW_STATUS.SUCCESS, WORKFLOW_STATUS.FAILED, 'skipped', 'blocked']),
  depends_on: z.array(z.string()).optional(),
  parallel_with: z.array(z.string()).optional(),
  timeout_ms: z.number().default(120000),
  retry_policy: z.object({
    max_retries: z.number().default(3),
    backoff_ms: z.number().default(1000),
    exponential: z.boolean().default(true),
  }).optional(),
  quality_gates: z.array(z.object({
    metric: z.string(),
    operator: z.enum(['gt', 'gte', 'lt', 'lte', 'eq', 'neq']),
    value: z.number(),
    blocking: z.boolean().default(true),
  })).optional(),
});

// ===== Event Schema =====
export const EventSchema = z.object({
  event_id: z.string().uuid(),
  workflow_id: z.string().transform(toWorkflowId),
  task_id: z.string().transform(toTaskId).optional(),
  agent_id: z.string().transform(toAgentId).optional(),
  type: z.enum(['workflow', 'task', 'agent', 'system']),
  action: z.string(),
  payload: z.record(z.unknown()).optional(),
  timestamp: z.string().datetime(),
  version: z.literal(VERSION),
});

// ===== Type Exports =====
export type Workflow = z.infer<typeof WorkflowSchema>;
export type WorkflowType = z.infer<typeof WorkflowTypeEnum>;
export type WorkflowState = z.infer<typeof WorkflowStateEnum>;
export type AgentTask = z.infer<typeof AgentTaskSchema>;
export type AgentResult = z.infer<typeof AgentResultSchema>;
export type AgentType = z.infer<typeof AgentTypeEnum>;
export type TaskStatus = z.infer<typeof TaskStatusEnum>;
export type PipelineStage = z.infer<typeof PipelineStageSchema>;
export type Event = z.infer<typeof EventSchema>;

// ===== Type Guards =====
export const isWorkflow = (data: unknown): data is Workflow => {
  return WorkflowSchema.safeParse(data).success;
};

export const isAgentTask = (data: unknown): data is AgentTask => {
  return AgentTaskSchema.safeParse(data).success;
};

export const isAgentResult = (data: unknown): data is AgentResult => {
  return AgentResultSchema.safeParse(data).success;
};

// ===== Utility Functions =====
export const createWorkflow = (
  type: WorkflowType,
  name: string,
  description?: string
): Workflow => {
  const now = new Date().toISOString();
  return {
    workflow_id: toWorkflowId(`wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`),
    type,
    name,
    description,
    current_stage: WORKFLOW_STATUS.INITIATED,
    progress: 0,
    version: VERSION,
    created_at: now,
    updated_at: now,
  };
};

export const createTask = (
  workflow: Workflow,
  agent_type: AgentType,
  action: string,
  payload: Record<string, unknown>
): AgentTask => {
  const now = new Date().toISOString();
  return {
    task_id: toTaskId(`task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`),
    workflow_id: workflow.workflow_id,
    agent_type,
    action,
    status: TASK_STATUS.PENDING,
    priority: 50,
    payload,
    version: VERSION,
    timeout_ms: 120000,
    retry_count: 0,
    max_retries: 3,
    created_at: now,
  };
};