import { z } from 'zod';

// ============================================================================
// PIPELINE CONFIGURATION SCHEMAS
// ============================================================================

/**
 * Stage execution mode
 * - sequential: Execute stages one after another
 * - parallel: Execute stages concurrently
 */
export const StageExecutionModeSchema = z.enum(['sequential', 'parallel']);

/**
 * Stage status
 */
export const StageStatusSchema = z.enum([
  'pending',
  'running',
  'success',
  'failed',
  'skipped',
  'blocked'
]);

/**
 * Pipeline status
 * IMPORTANT: Must match Prisma schema WorkflowStatus enum
 * Session #78: Changed 'success' to 'completed' for consistency
 */
export const PipelineStatusSchema = z.enum([
  'created',
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
  'paused'
]);

/**
 * Quality gate configuration
 */
export const QualityGateSchema = z.object({
  name: z.string(),
  metric: z.string(),
  operator: z.enum(['==', '!=', '<', '<=', '>', '>=']),
  threshold: z.union([z.number(), z.string()]),
  blocking: z.boolean().default(true),
  description: z.string().optional()
});

/**
 * Stage artifact
 */
export const StageArtifactSchema = z.object({
  name: z.string(),
  type: z.enum(['file', 'directory', 'report', 'image', 'bundle']),
  path: z.string(),
  size_bytes: z.number().optional(),
  checksum: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

/**
 * Stage dependency
 */
export const StageDependencySchema = z.object({
  stage_id: z.string(),
  required: z.boolean().default(true),
  condition: z.enum(['success', 'completed', 'always']).default('completed')  // Session #78: Changed default from 'success' to 'completed'
});

/**
 * Pipeline stage definition
 */
export const PipelineStageSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
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
  action: z.string(),
  parameters: z.record(z.unknown()).default({}),
  dependencies: z.array(StageDependencySchema).default([]),
  quality_gates: z.array(QualityGateSchema).default([]),
  timeout_ms: z.number().default(600000), // 10 minutes default
  retry_policy: z.object({
    max_attempts: z.number().default(3),
    backoff_ms: z.number().default(1000),
    backoff_multiplier: z.number().default(2)
  }).optional(),
  continue_on_failure: z.boolean().default(false),
  artifacts: z.array(StageArtifactSchema).default([]),
  environment: z.record(z.string()).optional()
});

/**
 * Pipeline definition (DAG structure)
 */
export const PipelineDefinitionSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  version: z.string().default('1.0.0'),
  workflow_id: z.string().uuid(),
  stages: z.array(PipelineStageSchema),
  execution_mode: StageExecutionModeSchema.default('sequential'),
  environment: z.record(z.string()).optional(),
  global_timeout_ms: z.number().optional(),
  notifications: z.object({
    on_success: z.array(z.string()).optional(),
    on_failure: z.array(z.string()).optional(),
    on_stage_failure: z.array(z.string()).optional()
  }).optional(),
  metadata: z.record(z.unknown()).optional()
});

/**
 * Stage execution result
 */
export const StageExecutionResultSchema = z.object({
  stage_id: z.string(),
  status: StageStatusSchema,
  started_at: z.string().datetime(),
  completed_at: z.string().datetime().optional(),
  duration_ms: z.number().optional(),
  agent_id: z.string().optional(),
  task_id: z.string().optional(),
  artifacts: z.array(StageArtifactSchema).default([]),
  quality_gate_results: z.array(z.object({
    gate_name: z.string(),
    passed: z.boolean(),
    actual_value: z.union([z.number(), z.string()]),
    threshold: z.union([z.number(), z.string()]),
    blocking: z.boolean(),
    message: z.string().optional()
  })).default([]),
  logs: z.array(z.string()).optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
    recoverable: z.boolean()
  }).optional(),
  metrics: z.record(z.number()).optional()
});

/**
 * Pipeline execution state
 */
export const PipelineExecutionSchema = z.object({
  id: z.string().uuid(),
  pipeline_id: z.string().uuid(),
  workflow_id: z.string().uuid(),
  status: PipelineStatusSchema,
  current_stage: z.string().optional(),
  started_at: z.string().datetime(),
  completed_at: z.string().datetime().optional(),
  duration_ms: z.number().optional(),
  stage_results: z.array(StageExecutionResultSchema).default([]),
  artifacts: z.array(StageArtifactSchema).default([]),
  trigger: z.enum(['manual', 'webhook', 'schedule', 'event']),
  triggered_by: z.string(),
  commit_sha: z.string().optional(),
  branch: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

/**
 * Pipeline webhook payload (GitHub Actions / GitLab CI)
 */
export const PipelineWebhookSchema = z.object({
  source: z.enum(['github', 'gitlab', 'manual']),
  event: z.string(),
  repository: z.string(),
  branch: z.string(),
  commit_sha: z.string(),
  commit_message: z.string().optional(),
  author: z.string(),
  timestamp: z.string().datetime(),
  payload: z.record(z.unknown())
});

/**
 * Pipeline control request
 */
export const PipelineControlSchema = z.object({
  action: z.enum(['start', 'pause', 'resume', 'cancel', 'retry']),
  execution_id: z.string().uuid(),
  stage_id: z.string().optional(),
  reason: z.string().optional()
});

/**
 * Real-time pipeline update (WebSocket)
 */
export const PipelineUpdateSchema = z.object({
  type: z.enum(['execution_started', 'stage_started', 'stage_completed', 'stage_failed', 'execution_completed', 'execution_failed']),
  execution_id: z.string().uuid(),
  pipeline_id: z.string().uuid(),
  workflow_id: z.string().uuid(),
  stage_id: z.string().optional(),
  status: z.union([PipelineStatusSchema, StageStatusSchema]),
  timestamp: z.string().datetime(),
  data: z.record(z.unknown()).optional()
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type StageExecutionMode = z.infer<typeof StageExecutionModeSchema>;
export type StageStatus = z.infer<typeof StageStatusSchema>;
export type PipelineStatus = z.infer<typeof PipelineStatusSchema>;
export type QualityGate = z.infer<typeof QualityGateSchema>;
export type StageArtifact = z.infer<typeof StageArtifactSchema>;
export type StageDependency = z.infer<typeof StageDependencySchema>;
export type PipelineStage = z.infer<typeof PipelineStageSchema>;
export type PipelineDefinition = z.infer<typeof PipelineDefinitionSchema>;
export type StageExecutionResult = z.infer<typeof StageExecutionResultSchema>;
export type PipelineExecution = z.infer<typeof PipelineExecutionSchema>;
export type PipelineWebhook = z.infer<typeof PipelineWebhookSchema>;
export type PipelineControl = z.infer<typeof PipelineControlSchema>;
export type PipelineUpdate = z.infer<typeof PipelineUpdateSchema>;
