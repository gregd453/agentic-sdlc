/**
 * Agent Behavior Metadata Schema
 *
 * Enables metadata-driven test scenarios:
 * - Failure injection at specific stages
 * - Timeout simulation
 * - Custom output data
 * - Error control
 *
 * Applied via task.payload.behavior_metadata
 * Allows complex test scenarios without modifying agent code
 */

import { z } from 'zod'

/**
 * Execution mode for the agent behavior
 */
export const AgentBehaviorModeEnum = z.enum([
  WORKFLOW_STATUS.SUCCESS,      // Normal successful completion
  'failure',      // Agent reports failure
  'timeout',      // Simulate timeout (execution takes longer than allowed)
  'partial',      // Partial success (e.g., 2/5 tests pass)
  'crash'         // Unexpected crash/error
])

export type AgentBehaviorMode = z.infer<typeof AgentBehaviorModeEnum>

/**
 * Error configuration when mode is 'failure' or 'crash'
 */
export const AgentErrorMetadataSchema = z.object({
  code: z.string().describe('Error code (e.g., VALIDATION_ERROR, TIMEOUT, DEPLOYMENT_FAILED)'),
  message: z.string().describe('Human-readable error message'),
  details: z.record(z.unknown()).optional().describe('Additional error context'),
  retryable: z.boolean().default(true).describe('Can workflow retry this stage?'),
  recovery_suggestion: z.string().optional().describe('Suggested recovery action')
})

export type AgentErrorMetadata = z.infer<typeof AgentErrorMetadataSchema>

/**
 * Partial execution results (for 'partial' mode)
 * Example: 2 of 5 tests passed, 3 failed
 */
export const PartialResultMetadataSchema = z.object({
  total_items: z.number().int().min(1).describe('Total items processed'),
  successful_items: z.number().int().min(0).describe('Items that succeeded'),
  failed_items: z.number().int().min(0).describe('Items that failed'),
  failure_rate: z.number().min(0).max(1).optional().describe('Failure rate (0-1)'),
  first_failure_at: z.number().int().optional().describe('Index of first failure')
})

export type PartialResultMetadata = z.infer<typeof PartialResultMetadataSchema>

/**
 * Custom output data to override generated output
 * Agent-type specific
 */
export const CustomOutputMetadataSchema = z.object({
  // SCAFFOLD agent output
  project_name: z.string().optional(),
  output_path: z.string().optional(),
  files_generated: z.number().optional(),
  bytes_written: z.number().optional(),

  // VALIDATION agent output
  validation_result: z.enum(['passed', WORKFLOW_STATUS.FAILED, 'warning']).optional(),
  errors: z.array(z.record(z.unknown())).optional(),
  warnings: z.array(z.string()).optional(),
  files_checked: z.number().optional(),

  // E2E agent output
  tests_run: z.number().optional(),
  tests_passed: z.number().optional(),
  tests_failed: z.number().optional(),
  coverage: z.number().optional(),

  // INTEGRATION agent output
  duration_ms: z.number().optional(),

  // DEPLOYMENT agent output
  deployment_status: z.enum([WORKFLOW_STATUS.SUCCESS, WORKFLOW_STATUS.FAILED, 'rollback']).optional(),
  endpoint: z.string().optional(),
  deployment_time_ms: z.number().optional(),

  // Generic
  custom_data: z.record(z.unknown()).optional()
})

export type CustomOutputMetadata = z.infer<typeof CustomOutputMetadataSchema>

/**
 * Timing control metadata
 */
export const TimingMetadataSchema = z.object({
  execution_delay_ms: z.number().int().min(0).default(10000).describe('Add delay to execution in milliseconds (default: 10000ms/10s)'),
  timeout_at_ms: z.number().int().min(0).optional().describe('Trigger timeout after N ms of execution'),
  variance_ms: z.number().int().min(0).optional().describe('Random variance in delay (0-variance_ms)')
})

export type TimingMetadata = z.infer<typeof TimingMetadataSchema>

/**
 * Metrics override - customize metrics returned
 */
export const MetricsMetadataSchema = z.object({
  duration_ms: z.number().int().optional(),
  memory_mb: z.number().optional(),
  cpu_percent: z.number().optional(),
  custom_metrics: z.record(z.number()).optional()
})

export type MetricsMetadata = z.infer<typeof MetricsMetadataSchema>

/**
 * Complete agent behavior metadata
 * Controls how mock agent executes for a specific stage/task
 */
export const AgentBehaviorMetadataSchema = z.object({
  // Execution mode
  mode: AgentBehaviorModeEnum.default(WORKFLOW_STATUS.SUCCESS).describe('How agent should execute'),

  // Error details (required if mode is 'failure' or 'crash')
  error: AgentErrorMetadataSchema.optional().describe('Error details when mode is failure/crash'),

  // Partial execution (required if mode is 'partial')
  partial: PartialResultMetadataSchema.optional().describe('Partial execution details'),

  // Custom output data
  output: CustomOutputMetadataSchema.optional().describe('Override generated output'),

  // Timing control
  timing: TimingMetadataSchema.optional().describe('Execution timing'),

  // Metrics override
  metrics: MetricsMetadataSchema.optional().describe('Override execution metrics'),

  // Stage-specific labels for debugging
  label: z.string().optional().describe('Human-readable label for this behavior'),

  // Metadata for complex scenarios
  metadata: z.record(z.unknown()).optional().describe('Arbitrary metadata for custom behavior')
})

export type AgentBehaviorMetadata = z.infer<typeof AgentBehaviorMetadataSchema>

/**
 * Validation helpers
 */
export function validateAgentBehaviorMetadata(data: unknown): AgentBehaviorMetadata {
  return AgentBehaviorMetadataSchema.parse(data)
}

/**
 * Sample behavior configurations for testing
 */
export const BEHAVIOR_SAMPLES = {
  // Success scenarios
  success: {
    mode: WORKFLOW_STATUS.SUCCESS as const,
    label: 'Normal successful completion'
  } as AgentBehaviorMetadata,

  fast_success: {
    mode: WORKFLOW_STATUS.SUCCESS as const,
    timing: { execution_delay_ms: 10 },
    label: 'Quick successful completion (10ms)'
  } as AgentBehaviorMetadata,

  slow_success: {
    mode: WORKFLOW_STATUS.SUCCESS as const,
    timing: { execution_delay_ms: 5000 },
    label: 'Slow successful completion (5s)'
  } as AgentBehaviorMetadata,

  // Failure scenarios
  validation_error: {
    mode: 'failure' as const,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'TypeScript compilation errors detected',
      retryable: true,
      recovery_suggestion: 'Fix type errors and retry'
    },
    label: 'Validation stage fails with type errors'
  } as AgentBehaviorMetadata,

  deployment_failed: {
    mode: 'failure' as const,
    error: {
      code: 'DEPLOYMENT_FAILED',
      message: 'Deployment to production failed',
      retryable: true,
      recovery_suggestion: 'Check infrastructure and retry'
    },
    label: 'Deployment stage fails'
  } as AgentBehaviorMetadata,

  unrecoverable_error: {
    mode: 'failure' as const,
    error: {
      code: 'FATAL_ERROR',
      message: 'Unrecoverable system error',
      retryable: false,
      recovery_suggestion: 'Manual intervention required'
    },
    label: 'Fatal unrecoverable error'
  } as AgentBehaviorMetadata,

  // Timeout scenarios
  timeout: {
    mode: 'timeout' as const,
    timing: { timeout_at_ms: 5000 },
    error: {
      code: 'TIMEOUT',
      message: 'Stage execution exceeded timeout',
      retryable: true
    },
    label: 'Stage times out after 5 seconds'
  } as AgentBehaviorMetadata,

  // Partial success scenarios
  tests_partial_pass: {
    mode: 'partial' as const,
    partial: {
      total_items: 10,
      successful_items: 8,
      failed_items: 2,
      failure_rate: 0.2,
      first_failure_at: 3
    },
    output: {
      tests_run: 10,
      tests_passed: 8,
      tests_failed: 2
    },
    label: 'Tests: 8/10 passed'
  } as AgentBehaviorMetadata,

  // Custom metrics
  high_resource_usage: {
    mode: WORKFLOW_STATUS.SUCCESS as const,
    metrics: {
      duration_ms: 30000,
      memory_mb: 500,
      cpu_percent: 85
    },
    label: 'Success but with high resource usage'
  } as AgentBehaviorMetadata,

  // Crash scenario
  crash: {
    mode: 'crash' as const,
    error: {
      code: 'AGENT_CRASH',
      message: 'Agent process crashed unexpectedly',
      retryable: true
    },
    label: 'Agent crashes during execution'
  } as AgentBehaviorMetadata,

  // Delay scenarios
  default_delay: {
    mode: WORKFLOW_STATUS.SUCCESS as const,
    timing: { execution_delay_ms: 10000 },
    label: 'Success with default 10-second delay'
  } as AgentBehaviorMetadata,

  no_delay: {
    mode: WORKFLOW_STATUS.SUCCESS as const,
    timing: { execution_delay_ms: 0 },
    label: 'Instant success with no delay'
  } as AgentBehaviorMetadata,

  custom_delay_3s: {
    mode: WORKFLOW_STATUS.SUCCESS as const,
    timing: { execution_delay_ms: 3000 },
    label: 'Success with custom 3-second delay'
  } as AgentBehaviorMetadata,

  custom_delay_5s: {
    mode: WORKFLOW_STATUS.SUCCESS as const,
    timing: { execution_delay_ms: 5000 },
    label: 'Success with custom 5-second delay'
  } as AgentBehaviorMetadata,

  custom_delay_30s: {
    mode: WORKFLOW_STATUS.SUCCESS as const,
    timing: { execution_delay_ms: 30000 },
    label: 'Success with custom 30-second delay'
  } as AgentBehaviorMetadata,

  delay_with_variance: {
    mode: WORKFLOW_STATUS.SUCCESS as const,
    timing: { execution_delay_ms: 10000, variance_ms: 2000 },
    label: 'Success with 10-second delay ± 2 seconds variance'
  } as AgentBehaviorMetadata
}
