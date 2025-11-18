import { z } from 'zod';

// SESSION #65: Import AgentEnvelope from shared-types (canonical task format)
export type { AgentEnvelope } from '@agentic-sdlc/shared-types';
export { AgentEnvelopeSchema } from '@agentic-sdlc/shared-types';

// Keep TaskResult (unchanged, working correctly)
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
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  trace_id: z.string().uuid().optional(), // Phase 3: Accept trace_id from HTTP request
  // Phase 1: Platform awareness (optional for backward compatibility)
  platform_id: z.string().uuid().optional(),
  surface_id: z.string().uuid().optional(),
  input_data: z.record(z.unknown()).optional()
});

export const WorkflowResponseSchema = z.object({
  workflow_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable().optional(),
  type: z.enum(['app', 'feature', 'bugfix']),
  status: z.string(),
  current_stage: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  progress_percentage: z.number(),
  trace_id: z.string().uuid().nullable().optional(),
  estimated_duration_ms: z.number().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  completed_at: z.string().datetime().nullable().optional()
});

// Type exports
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
