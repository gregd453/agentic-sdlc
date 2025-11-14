/**
 * Task Result Schema for Orchestrator-Agent Communication
 * Session #65: Keep only TaskResultSchema (TaskAssignment replaced by AgentEnvelope)
 *
 * Agents return TaskResult to orchestrator when tasks complete.
 */

import { z } from 'zod';

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

// Type export
export type TaskResult = z.infer<typeof TaskResultSchema>;
