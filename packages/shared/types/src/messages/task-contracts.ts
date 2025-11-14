/**
 * Canonical Message Contracts for Orchestrator-Agent Communication
 * Session #64: Established as single source of truth
 *
 * These schemas define the standard message format used across the system:
 * - Orchestrator sends TaskAssignment to agents
 * - Agents return TaskResult to orchestrator
 */

import { z } from 'zod';

/**
 * TaskAssignmentSchema - Canonical schema for task assignments
 *
 * This is the ONLY valid schema for tasks sent from orchestrator to agents.
 * All agents MUST validate incoming tasks against this schema.
 *
 * Structure:
 * - message_id: Unique message identifier (idempotency key)
 * - task_id: Task identifier
 * - workflow_id: Parent workflow identifier
 * - agent_type: Target agent type
 * - payload: Flexible agent-specific data
 * - constraints: Execution constraints (timeout, retries, confidence)
 * - metadata: Tracing and audit information
 */
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
  action: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  payload: z.record(z.unknown()), // Flexible payload for agent-specific data
  constraints: z.object({
    timeout_ms: z.number().default(300000),
    max_retries: z.number().default(3),
    required_confidence: z.number().min(0).max(100).default(80)
  }),
  metadata: z.object({
    created_at: z.string().datetime(),
    created_by: z.string(),
    trace_id: z.string(), // Distributed tracing support (Session #60)
    parent_task_id: z.string().optional()
  })
});

/**
 * TaskResultSchema - Canonical schema for agent results
 *
 * Agents MUST return results in this format when tasks complete.
 */
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
    trace_id: z.string(), // Distributed tracing support (Session #60)
    confidence_score: z.number().min(0).max(100).optional()
  })
});

// Type exports
export type TaskAssignment = z.infer<typeof TaskAssignmentSchema>;
export type TaskResult = z.infer<typeof TaskResultSchema>;

// Alternative name for backward compatibility during migration
// TODO Session #64: Remove after all references updated
export const ExecutionEnvelopeSchema = TaskAssignmentSchema;
export type ExecutionEnvelope = TaskAssignment;
