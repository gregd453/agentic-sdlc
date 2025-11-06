import { z } from 'zod';

// Core Message Contracts
export const TaskAssignmentSchema = z.object({
  message_id: z.string().uuid(),
  task_id: z.string().uuid(),
  workflow_id: z.string().uuid(),
  agent_type: z.enum([
    'scaffold',
    'validation',
    'e2e_test',
    'integration',
    'deployment',
    'monitoring',
    'debug',
    'recovery'
  ]),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  payload: z.object({
    action: z.string(),
    target: z.string().optional(),
    parameters: z.record(z.unknown()),
    context: z.record(z.unknown()).optional()
  }),
  constraints: z.object({
    timeout_ms: z.number().default(300000),
    max_retries: z.number().default(3),
    required_confidence: z.number().min(0).max(100).default(80)
  }),
  metadata: z.object({
    created_at: z.string().datetime(),
    created_by: z.string(),
    trace_id: z.string(),
    parent_task_id: z.string().optional()
  })
});

export const TaskResultSchema = z.object({
  message_id: z.string().uuid(),
  task_id: z.string().uuid(),
  workflow_id: z.string().uuid(),
  agent_id: z.string(),
  status: z.enum(['success', 'failure', 'partial', 'blocked']),
  result: z.object({
    data: z.record(z.unknown()),
    artifacts: z.array(z.object({
      type: z.string(),
      path: z.string(),
      size_bytes: z.number()
    })).optional(),
    metrics: z.object({
      duration_ms: z.number(),
      resource_usage: z.record(z.number()).optional(),
      operations_count: z.number().optional()
    })
  }),
  errors: z.array(z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
    recoverable: z.boolean()
  })).optional(),
  next_actions: z.array(z.object({
    action: z.string(),
    agent_type: z.string(),
    priority: z.string()
  })).optional(),
  metadata: z.object({
    completed_at: z.string().datetime(),
    trace_id: z.string(),
    confidence_score: z.number().min(0).max(100).optional()
  })
});

// Workflow Schemas
export const CreateWorkflowSchema = z.object({
  type: z.enum(['app', 'feature', 'bugfix']),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  requirements: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'critical'])
});

export const WorkflowResponseSchema = z.object({
  workflow_id: z.string().uuid(),
  status: z.string(),
  current_stage: z.string(),
  progress_percentage: z.number(),
  estimated_duration_ms: z.number().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

// Type exports
export type TaskAssignment = z.infer<typeof TaskAssignmentSchema>;
export type TaskResult = z.infer<typeof TaskResultSchema>;
export type CreateWorkflowRequest = z.infer<typeof CreateWorkflowSchema>;
export type WorkflowResponse = z.infer<typeof WorkflowResponseSchema>;

// Event types
export interface WorkflowEvent {
  id: string;
  type: 'WORKFLOW_CREATED' | 'WORKFLOW_STARTED' | 'STAGE_COMPLETED' | 'WORKFLOW_COMPLETED' | 'WORKFLOW_FAILED';
  workflow_id: string;
  payload: Record<string, unknown>;
  timestamp: Date;
  trace_id: string;
}