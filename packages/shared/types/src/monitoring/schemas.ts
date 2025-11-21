/**
 * Monitoring System Schemas
 * Session #88: Real-time metrics, alerts, and control
 *
 * Zod schemas for monitoring dashboard data validation
 */

import { z } from 'zod';

// ===== Severity Levels =====
export const SeverityEnum = z.enum(['critical', 'warning', 'info']);
export type Severity = z.infer<typeof SeverityEnum>;

// ===== Alert Status =====
export const AlertStatusEnum = z.enum(['triggered', 'acknowledged', 'resolved']);
export type AlertStatus = z.infer<typeof AlertStatusEnum>;

// ===== Metric Overview =====
export const MetricsOverviewSchema = z.object({
  total_workflows: z.number().int().min(0),
  running_workflows: z.number().int().min(0),
  completed_workflows: z.number().int().min(0),
  failed_workflows: z.number().int().min(0),
  paused_workflows: z.number().int().min(0),
  avg_completion_time_ms: z.number().nonnegative(),
  error_rate_percent: z.number().min(0).max(100),
  success_rate_percent: z.number().min(0).max(100),
  system_health_percent: z.number().min(0).max(100)
});
export type MetricsOverview = z.infer<typeof MetricsOverviewSchema>;

// ===== Agent Performance Stats =====
export const AgentStatsSchema = z.object({
  agent_type: z.string(),
  total_tasks: z.number().int().min(0),
  completed_tasks: z.number().int().min(0),
  failed_tasks: z.number().int().min(0),
  avg_duration_ms: z.number().nonnegative(),
  success_rate_percent: z.number().min(0).max(100),
  last_heartbeat: z.string().datetime().optional()
});
export type AgentStats = z.infer<typeof AgentStatsSchema>;

// ===== Time Series Data Point =====
export const TimeSeriesPointSchema = z.object({
  timestamp: z.string().datetime(),
  count: z.number().int().min(0),
  error_count: z.number().int().min(0).optional(),
  avg_duration_ms: z.number().nonnegative().optional()
});
export type TimeSeriesPoint = z.infer<typeof TimeSeriesPointSchema>;

// ===== Workflow Stats =====
export const WorkflowStatsSchema = z.object({
  workflow_type: z.string(),
  total: z.number().int().min(0),
  completed: z.number().int().min(0),
  failed: z.number().int().min(0),
  success_rate_percent: z.number().min(0).max(100)
});
export type WorkflowStats = z.infer<typeof WorkflowStatsSchema>;

// ===== Real-time Metrics (sent via WebSocket) =====
export const RealtimeMetricsSchema = z.object({
  overview: MetricsOverviewSchema,
  agents: z.array(AgentStatsSchema),
  workflows_by_type: z.array(WorkflowStatsSchema),
  throughput_per_minute: z.number().nonnegative(),
  latency_p50_ms: z.number().nonnegative(),
  latency_p95_ms: z.number().nonnegative(),
  latency_p99_ms: z.number().nonnegative(),
  last_update: z.string().datetime(),
  next_update_in_ms: z.number().int().min(1000)
});
export type RealtimeMetrics = z.infer<typeof RealtimeMetricsSchema>;

// ===== Alert Rule Condition =====
export const AlertConditionSchema = z.object({
  metric: z.string().describe('Metric name: latency_p95, error_rate, agent_offline, etc'),
  operator: z.enum(['>', '<', '>=', '<=', '==', '!=']),
  value: z.number().or(z.string()),
  duration_ms: z.number().int().min(0).optional().describe('Duration threshold must be exceeded (e.g., 5 minutes)')
});
export type AlertCondition = z.infer<typeof AlertConditionSchema>;

// ===== Alert Rule =====
export const AlertRuleSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  enabled: z.boolean().default(true),
  severity: SeverityEnum,
  condition: AlertConditionSchema,
  channels: z.array(z.enum(['dashboard', 'email', 'slack', 'webhook'])).default(['dashboard']),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});
export type AlertRule = z.infer<typeof AlertRuleSchema>;

// ===== Alert Instance =====
export const AlertSchema = z.object({
  id: z.string().uuid(),
  rule_id: z.string().uuid(),
  severity: SeverityEnum,
  message: z.string(),
  data: z.record(z.unknown()).describe('The metric values that triggered the alert'),
  status: AlertStatusEnum,
  created_at: z.string().datetime(),
  acknowledged_at: z.string().datetime().optional(),
  resolved_at: z.string().datetime().optional()
});
export type Alert = z.infer<typeof AlertSchema>;

// ===== Metrics Update (WebSocket message) =====
export const MetricsUpdateSchema = z.object({
  type: z.literal('metrics:update'),
  data: RealtimeMetricsSchema,
  timestamp: z.string().datetime()
});
export type MetricsUpdate = z.infer<typeof MetricsUpdateSchema>;

// ===== Alert Update (WebSocket message) =====
export const AlertUpdateSchema = z.object({
  type: z.literal('alert:triggered'),
  data: AlertSchema,
  timestamp: z.string().datetime()
});
export type AlertUpdate = z.infer<typeof AlertUpdateSchema>;

// ===== Workflow Control Request =====
export const WorkflowControlRequestSchema = z.object({
  action: z.enum(['pause', 'resume', 'cancel', 'retry']),
  reason: z.string().optional()
});
export type WorkflowControlRequest = z.infer<typeof WorkflowControlRequestSchema>;

// ===== Workflow Control Response =====
export const WorkflowControlResponseSchema = z.object({
  success: z.boolean(),
  status: z.enum(['paused', 'resumed', 'cancelled', 'retrying', 'error']),
  message: z.string()
});
export type WorkflowControlResponse = z.infer<typeof WorkflowControlResponseSchema>;
