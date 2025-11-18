/**
 * AgentEnvelope - Canonical Task Assignment Format
 * Session #65: Unified schema based on buildAgentEnvelope() production format
 *
 * This is THE ONLY valid schema for tasks sent from orchestrator to agents.
 * Version 2.0.0 - Breaking change from 1.0.0 (Session #64 cleanup)
 */

import { z } from 'zod';

// === Priority Levels ===
export const PriorityEnum = z.enum([TASK_PRIORITY.LOW, TASK_PRIORITY.MEDIUM, TASK_PRIORITY.HIGH, TASK_PRIORITY.CRITICAL]);
export type Priority = z.infer<typeof PriorityEnum>;

// === Task Status ===
export const TaskStatusEnum = z.enum([TASK_STATUS.PENDING, 'queued', WORKFLOW_STATUS.RUNNING]);
export type TaskStatus = z.infer<typeof TaskStatusEnum>;

// === Agent Types ===
export const AgentTypeEnum = z.enum([
  AGENT_TYPES.SCAFFOLD,
  AGENT_TYPES.VALIDATION,
  AGENT_TYPES.E2E_TEST,
  AGENT_TYPES.INTEGRATION,
  AGENT_TYPES.DEPLOYMENT
]);
export type AgentType = z.infer<typeof AgentTypeEnum>;

// === Execution Constraints ===
export const ExecutionConstraintsSchema = z.object({
  timeout_ms: z.number().int().min(1000).default(300000),  // Min 1s, default 5min
  max_retries: z.number().int().min(0).max(10).default(3),
  required_confidence: z.number().min(0).max(100).default(80)
});
export type ExecutionConstraints = z.infer<typeof ExecutionConstraintsSchema>;

// === Envelope Metadata ===
export const EnvelopeMetadataSchema = z.object({
  created_at: z.string().datetime(),
  created_by: z.string(),
  envelope_version: z.literal('2.0.0')  // Version 2.0.0
});
export type EnvelopeMetadata = z.infer<typeof EnvelopeMetadataSchema>;

// === Trace Context (Session #60) ===
export const TraceContextSchema = z.object({
  trace_id: z.string(),                 // UUID v4 or custom trace ID
  span_id: z.string(),                  // 16-char hex
  parent_span_id: z.string().optional() // 16-char hex (optional for root span)
});
export type TraceContext = z.infer<typeof TraceContextSchema>;

// === Workflow Context (Stage Output Passing) ===
export const WorkflowContextSchema = z.object({
  workflow_type: z.string(),            // WORKFLOW_TYPES.APP | 'service' | WORKFLOW_TYPES.FEATURE | 'capability'
  workflow_name: z.string(),
  current_stage: z.string(),            // 'initialization' | AGENT_TYPES.VALIDATION | etc.
  stage_outputs: z.record(z.unknown())  // Previous stage outputs
});
export type WorkflowContext = z.infer<typeof WorkflowContextSchema>;

// === CANONICAL SCHEMA ===
export const AgentEnvelopeSchema = z.object({
  // Identification & Idempotency
  message_id: z.string().uuid(),
  task_id: z.string().uuid(),
  workflow_id: z.string().uuid(),

  // Routing
  agent_type: AgentTypeEnum,

  // Execution Control
  priority: PriorityEnum,
  status: TaskStatusEnum,
  constraints: ExecutionConstraintsSchema,
  retry_count: z.number().int().min(0).default(0),

  // Payload (agent-specific data)
  payload: z.record(z.unknown()),

  // Metadata
  metadata: EnvelopeMetadataSchema,

  // Distributed Tracing
  trace: TraceContextSchema,

  // Workflow Context
  workflow_context: WorkflowContextSchema
});

export type AgentEnvelope = z.infer<typeof AgentEnvelopeSchema>;

// === Type Guards ===
export const isAgentEnvelope = (data: unknown): data is AgentEnvelope => {
  return AgentEnvelopeSchema.safeParse(data).success;
};

// === Validation Helper ===
export const validateAgentEnvelope = (data: unknown): AgentEnvelope => {
  return AgentEnvelopeSchema.parse(data);
};
