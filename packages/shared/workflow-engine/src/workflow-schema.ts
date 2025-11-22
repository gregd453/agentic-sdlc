import { z } from 'zod';

/**
 * Workflow Schema Definitions
 * Zod-validated schemas for workflow definitions with stage composition,
 * conditional routing, and execution configuration
 */

/**
 * Stage outcome definition for conditional routing
 */
export const StageOutcomeSchema = z.enum(['success', 'failure', 'timeout', 'unknown']);
export type StageOutcome = z.infer<typeof StageOutcomeSchema>;

/**
 * Stage configuration with input/output and routing
 */
export const StageConfigSchema = z.object({
  name: z.string().min(1).describe('Unique stage name'),
  agent_type: z.string().min(1).describe('Agent type to execute'),
  config: z.record(z.unknown()).optional().describe('Stage-specific agent configuration'),
  timeout_ms: z.number().positive().default(300000).describe('Stage execution timeout in milliseconds'),
  max_retries: z.number().nonnegative().default(3).describe('Maximum retry attempts'),
  on_success: z.string().optional().describe('Next stage on success'),
  on_failure: z.string().optional().describe('Next stage on failure'),
  parallel: z.boolean().default(false).describe('Execute in parallel with other stages'),
  skip_condition: z.string().optional().describe('Expression to skip this stage'),
  weight: z.number().positive().optional().describe('Progress weight for this stage (SESSION #88)'),
  metadata: z.record(z.unknown()).optional().describe('Custom stage metadata')
});
export type StageConfig = z.infer<typeof StageConfigSchema>;

/**
 * Input/output definition for workflow data flow
 */
export const DataFlowSchema = z.object({
  input_mapping: z.record(z.string()).optional().describe('Map previous outputs to stage inputs'),
  output_mapping: z.record(z.string()).optional().describe('Map stage outputs to workflow outputs'),
  pass_through: z.boolean().default(false).describe('Pass entire input to output')
});
export type DataFlow = z.infer<typeof DataFlowSchema>;

/**
 * Complete workflow definition
 */
export const WorkflowDefinitionSchema = z.object({
  name: z.string().min(1).describe('Workflow name'),
  version: z.string().default('1.0.0').describe('Workflow version'),
  description: z.string().optional().describe('Workflow description'),
  start_stage: z.string().min(1).describe('Initial stage name'),
  stages: z.record(StageConfigSchema).describe('Map of stage name to stage configuration'),
  global_timeout_ms: z.number().positive().default(3600000).describe('Global workflow timeout (default 1 hour)'),
  max_parallel_stages: z.number().positive().default(4).describe('Maximum concurrent stages'),
  retry_strategy: z.enum(['exponential', 'linear', 'immediate']).default('exponential').describe('Retry backoff strategy'),
  on_failure: z.enum(['stop', 'continue', 'skip']).default('stop').describe('Behavior on stage failure'),
  metadata: z.record(z.unknown()).optional().describe('Custom workflow metadata'),
  data_flow: DataFlowSchema.optional().describe('Workflow-level data flow configuration')
});
export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;

/**
 * Workflow execution context
 */
export const WorkflowContextSchema = z.object({
  workflow_id: z.string().describe('Unique workflow execution ID'),
  definition: WorkflowDefinitionSchema.describe('Workflow definition'),
  current_stage: z.string().describe('Currently executing stage'),
  stage_results: z.record(
    z.object({
      outcome: StageOutcomeSchema,
      output: z.unknown().optional(),
      error: z.string().optional(),
      attempts: z.number().nonnegative(),
      duration_ms: z.number().nonnegative(),
      timestamp: z.number()
    })
  ).default({}).describe('Results from completed stages'),
  input_data: z.record(z.unknown()).optional().describe('Workflow input data'),
  metadata: z.record(z.unknown()).optional().describe('Execution metadata')
});
export type WorkflowContext = z.infer<typeof WorkflowContextSchema>;

/**
 * Stage execution result
 */
export const StageResultSchema = z.object({
  stage_name: z.string().describe('Stage that was executed'),
  outcome: StageOutcomeSchema.describe('Execution outcome'),
  output: z.unknown().optional().describe('Stage output data'),
  error: z.string().optional().describe('Error message if failed'),
  attempts: z.number().nonnegative().describe('Number of execution attempts'),
  duration_ms: z.number().nonnegative().describe('Total execution time'),
  timestamp: z.number().describe('Execution timestamp (ms since epoch)')
});
export type StageResult = z.infer<typeof StageResultSchema>;

/**
 * Workflow execution result
 */
export const WorkflowResultSchema = z.object({
  workflow_id: z.string().describe('Workflow execution ID'),
  status: z.enum(['running', 'success', 'failure', 'timeout', 'cancelled']).describe('Workflow status'),
  final_stage: z.string().optional().describe('Final executed stage'),
  stage_results: z.array(StageResultSchema).describe('All stage execution results'),
  output_data: z.record(z.unknown()).optional().describe('Final workflow output'),
  error: z.string().optional().describe('Top-level error message if failed'),
  total_duration_ms: z.number().nonnegative().describe('Total execution time'),
  started_at: z.number().describe('Start timestamp'),
  completed_at: z.number().optional().describe('Completion timestamp')
});
export type WorkflowResult = z.infer<typeof WorkflowResultSchema>;

/**
 * Workflow validation helper
 */
export function validateWorkflowDefinition(definition: unknown): WorkflowDefinition {
  return WorkflowDefinitionSchema.parse(definition);
}

/**
 * Stage configuration validation
 */
export function validateStageConfig(stage: unknown): StageConfig {
  return StageConfigSchema.parse(stage);
}

/**
 * Default workflow configuration
 */
export const DEFAULT_WORKFLOW_CONFIG: Pick<WorkflowDefinition, 'global_timeout_ms' | 'max_parallel_stages' | 'retry_strategy' | 'on_failure'> = {
  global_timeout_ms: 3600000, // 1 hour
  max_parallel_stages: 4,
  retry_strategy: 'exponential',
  on_failure: 'stop'
};

/**
 * Workflow schema error class
 */
export class WorkflowSchemaError extends Error {
  constructor(message: string, public readonly details?: Record<string, unknown>) {
    super(message);
    this.name = 'WorkflowSchemaError';
  }
}
