/**
 * Workflow Definition Schema - Schema for platform-specific workflow definitions
 *
 * This schema defines how workflows are structured per platform:
 * - Stages in execution order
 * - Agent assignments for each stage
 * - Progress calculation per stage
 * - Conditional routing
 * - Fallback handling
 */

import { z } from 'zod'

/**
 * Stage definition within a workflow definition
 */
export const WorkflowStageDefinitionSchema = z.object({
  name: z.string().describe('Stage name (e.g., scaffolding, validation)'),
  display_name: z.string().optional().describe('Human-readable name'),
  description: z.string().optional().describe('Stage description'),
  agent_type: z.string().describe('Agent type to assign (e.g., scaffold, validation)'),
  required: z.boolean().default(true).describe('Is this stage required?'),
  progress_weight: z.number().min(0).max(100).describe('Progress contribution (0-100)'),
  retry_policy: z
    .object({
      max_retries: z.number().default(3),
      backoff_ms: z.number().default(1000),
      backoff_multiplier: z.number().default(2)
    })
    .optional()
    .describe('Retry configuration'),
  timeout_ms: z.number().default(300000).describe('Stage timeout in ms'),
  conditions: z
    .array(
      z.object({
        when: z.string().describe('Condition (e.g., workflow_type=app)'),
        then_skip: z.boolean().optional().describe('Skip stage if condition matches'),
        then_assign_agent: z.string().optional().describe('Use different agent if condition matches')
      })
    )
    .optional()
    .describe('Conditional stage behavior'),
  metadata: z.record(z.unknown()).optional().describe('Custom stage metadata')
})

export type WorkflowStageDefinition = z.infer<typeof WorkflowStageDefinitionSchema>

/**
 * Workflow definition for a platform
 */
export const WorkflowDefinitionFullSchema = z.object({
  name: z.string().describe('Workflow definition name (e.g., app, feature, bugfix)'),
  version: z.string().default('1.0.0').describe('Definition version'),
  platform_id: z.string().optional().describe('Platform UUID (optional, can be set at seeding time)'),
  description: z.string().optional().describe('Definition description'),
  workflow_types: z
    .array(z.enum(['app', 'feature', 'bugfix', 'service', 'pipeline', 'terraform', 'docker']))
    .describe('Workflow types this definition applies to'),
  platforms: z
    .array(z.string())
    .default(['legacy'])
    .describe('Platform names this definition applies to'),
  enabled: z.boolean().default(true).describe('Is definition enabled?'),
  stages: z.array(WorkflowStageDefinitionSchema).describe('Ordered stages in workflow'),
  progress_calculation: z
    .enum(['weighted', 'linear', 'exponential', 'custom'])
    .default('weighted')
    .describe('How to calculate progress'),
  fallback_definition: z.string().optional().describe('Fallback definition name if this fails'),
  metadata: z.record(z.unknown()).optional().describe('Custom metadata')
})

export type WorkflowDefinitionFull = z.infer<typeof WorkflowDefinitionFullSchema>

/**
 * Minimal definition for updating a platform's workflow definition
 */
export const WorkflowDefinitionUpdateSchema = WorkflowDefinitionFullSchema.partial().extend({
  name: z.string().describe('Definition name (required for updates)')
})

export type WorkflowDefinitionUpdate = z.infer<typeof WorkflowDefinitionUpdateSchema>

/**
 * Definition for querying/filtering
 */
export const WorkflowDefinitionQuerySchema = z.object({
  platform_id: z.string().optional(),
  workflow_type: z.string().optional(),
  enabled: z.boolean().optional()
})

export type WorkflowDefinitionQuery = z.infer<typeof WorkflowDefinitionQuerySchema>

/**
 * Stage execution context (passed to agent)
 */
export const StageExecutionContextSchema = z.object({
  stage_name: z.string(),
  stage_index: z.number(),
  total_stages: z.number(),
  agent_type: z.string(),
  workflow_id: z.string(),
  workflow_type: z.string(),
  platform_id: z.string().optional(),
  expected_progress: z.number().describe('Expected progress after this stage completes'),
  timeout_ms: z.number(),
  payload: z.record(z.unknown()).optional()
})

export type StageExecutionContext = z.infer<typeof StageExecutionContextSchema>

/**
 * Progress tracking record
 */
export const ProgressTrackingSchema = z.object({
  workflow_id: z.string(),
  current_stage: z.string(),
  stage_index: z.number(),
  total_stages: z.number(),
  expected_progress: z.number().min(0).max(100),
  actual_progress: z.number().min(0).max(100),
  progress_weights: z.record(z.number()).describe('Stage name to progress weight mapping'),
  last_updated: z.date()
})

export type ProgressTracking = z.infer<typeof ProgressTrackingSchema>

/**
 * Helper function to validate workflow definition
 */
export function validateWorkflowDefinition(data: unknown): WorkflowDefinitionFull {
  return WorkflowDefinitionFullSchema.parse(data)
}

/**
 * Helper function to validate partial update
 */
export function validateWorkflowDefinitionUpdate(data: unknown): WorkflowDefinitionUpdate {
  return WorkflowDefinitionUpdateSchema.parse(data)
}

/**
 * Helper function to calculate total progress weight
 */
export function calculateTotalProgressWeight(stages: WorkflowStageDefinition[]): number {
  return stages.reduce((total, stage) => total + stage.progress_weight, 0)
}

/**
 * Helper function to get stage progress weight
 */
export function getStageProgressWeight(
  stage: WorkflowStageDefinition,
  totalWeight: number
): number {
  if (totalWeight === 0) return 0
  return (stage.progress_weight / totalWeight) * 100
}

/**
 * Helper function to build stage index lookup for progress calculation
 */
export function buildStageWeightMap(
  stages: WorkflowStageDefinition[]
): Map<string, { index: number; weight: number; cumulative_weight: number; percentage: number }> {
  const totalWeight = calculateTotalProgressWeight(stages)
  const map = new Map<string, { index: number; weight: number; cumulative_weight: number; percentage: number }>()
  let cumulativeWeight = 0

  stages.forEach((stage, index) => {
    cumulativeWeight += stage.progress_weight
    map.set(stage.name, {
      index,
      weight: stage.progress_weight,
      cumulative_weight: cumulativeWeight,
      percentage: totalWeight > 0 ? (cumulativeWeight / totalWeight) * 100 : 0
    })
  })

  return map
}

/**
 * Sample workflow definitions for reference
 */
export const SAMPLE_DEFINITIONS = {
  app: {
    name: 'app',
    version: '1.0.0',
    description: 'Full application development workflow',
    workflow_types: ['app'],
    platforms: ['legacy', 'web-apps'],
    enabled: true,
    stages: [
      {
        name: 'initialization',
        display_name: 'Initialize Project',
        agent_type: 'scaffold',
        required: true,
        progress_weight: 5,
        timeout_ms: 60000
      },
      {
        name: 'scaffolding',
        display_name: 'Scaffold Application',
        agent_type: 'scaffold',
        required: true,
        progress_weight: 15,
        timeout_ms: 300000
      },
      {
        name: 'dependency_installation',
        display_name: 'Install Dependencies',
        agent_type: 'scaffold',
        required: true,
        progress_weight: 10,
        timeout_ms: 300000
      },
      {
        name: 'validation',
        display_name: 'Validate Code',
        agent_type: 'validation',
        required: true,
        progress_weight: 15,
        timeout_ms: 300000
      },
      {
        name: 'e2e_testing',
        display_name: 'E2E Testing',
        agent_type: 'e2e_test',
        required: true,
        progress_weight: 20,
        timeout_ms: 600000
      },
      {
        name: 'integration',
        display_name: 'Integration Testing',
        agent_type: 'integration',
        required: true,
        progress_weight: 15,
        timeout_ms: 600000
      },
      {
        name: 'deployment',
        display_name: 'Deploy Application',
        agent_type: 'deployment',
        required: true,
        progress_weight: 15,
        timeout_ms: 300000
      },
      {
        name: 'monitoring',
        display_name: 'Setup Monitoring',
        agent_type: 'monitoring',
        required: false,
        progress_weight: 5,
        timeout_ms: 120000
      }
    ],
    progress_calculation: 'weighted'
  },
  feature: {
    name: 'feature',
    version: '1.0.0',
    description: 'Feature development workflow',
    workflow_types: ['feature'],
    platforms: ['legacy', 'web-apps'],
    enabled: true,
    stages: [
      {
        name: 'initialization',
        agent_type: 'scaffold',
        required: true,
        progress_weight: 10,
        timeout_ms: 60000
      },
      {
        name: 'scaffolding',
        agent_type: 'scaffold',
        required: true,
        progress_weight: 20,
        timeout_ms: 300000
      },
      {
        name: 'dependency_installation',
        agent_type: 'scaffold',
        required: true,
        progress_weight: 10,
        timeout_ms: 300000
      },
      {
        name: 'validation',
        agent_type: 'validation',
        required: true,
        progress_weight: 20,
        timeout_ms: 300000
      },
      {
        name: 'e2e_testing',
        agent_type: 'e2e_test',
        required: true,
        progress_weight: 40,
        timeout_ms: 600000
      }
    ],
    progress_calculation: 'weighted'
  },
  bugfix: {
    name: 'bugfix',
    version: '1.0.0',
    description: 'Bug fix workflow',
    workflow_types: ['bugfix'],
    platforms: ['legacy'],
    enabled: true,
    stages: [
      {
        name: 'initialization',
        agent_type: 'scaffold',
        required: true,
        progress_weight: 15,
        timeout_ms: 60000
      },
      {
        name: 'validation',
        agent_type: 'validation',
        required: true,
        progress_weight: 35,
        timeout_ms: 300000
      },
      {
        name: 'e2e_testing',
        agent_type: 'e2e_test',
        required: true,
        progress_weight: 50,
        timeout_ms: 600000
      }
    ],
    progress_calculation: 'weighted'
  }
}
