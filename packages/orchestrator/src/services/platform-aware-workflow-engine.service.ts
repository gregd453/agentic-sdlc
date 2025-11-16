/**
 * PlatformAwareWorkflowEngine Service - Definition-driven workflow orchestration
 *
 * Responsibilities:
 * - Load workflow definitions based on platform and workflow type
 * - Determine next stage based on definition
 * - Calculate progress based on definition weights
 * - Support adaptive routing based on conditions
 * - Provide fallback definitions if needed
 */

import { PrismaClient } from '@prisma/client'
import {
  WorkflowDefinitionFull,
  WorkflowStageDefinition,
  buildStageWeightMap,
  calculateTotalProgressWeight
} from '../types/workflow-definition-schema'
import { logger } from '../utils/logger'

export interface StageRoutingDecision {
  next_stage: string | null // null = workflow complete
  stage_index: number
  total_stages: number
  progress_weight: number
  expected_progress: number
  agent_type: string
  timeout_ms: number
  should_skip: boolean
}

export interface ProgressCalculation {
  current_stage: string
  stage_index: number
  total_stages: number
  progress_percentage: number
  cumulative_weight: number
  total_weight: number
}

export class PlatformAwareWorkflowEngine {
  private definitionCache: Map<string, WorkflowDefinitionFull> = new Map()
  private stageLookupCache: Map<string, Map<string, any>> = new Map()

  constructor(private prisma: PrismaClient) {
    logger.info('[PlatformAwareWorkflowEngine] Service initialized')
  }

  /**
   * Get workflow definition for a platform and workflow type
   */
  async getWorkflowDefinition(
    platformId: string | undefined,
    workflowType: string
  ): Promise<WorkflowDefinitionFull | null> {
    const cacheKey = `${platformId || 'legacy'}:${workflowType}`

    // Check cache
    if (this.definitionCache.has(cacheKey)) {
      return this.definitionCache.get(cacheKey) || null
    }

    try {
      // Query database for workflow definition
      const definition = await this.prisma.workflowDefinition.findFirst({
        where: {
          platform_id: platformId || undefined,
          name: workflowType,
          enabled: true
        }
      })

      if (!definition) {
        logger.warn('[PlatformAwareWorkflowEngine] Definition not found', {
          platform_id: platformId,
          workflow_type: workflowType
        })
        return null
      }

      // Cast to WorkflowDefinitionFull (definition column contains the full definition)
      const fullDefinition = definition.definition as unknown as WorkflowDefinitionFull

      // Cache it
      this.definitionCache.set(cacheKey, fullDefinition)

      return fullDefinition
    } catch (error) {
      logger.error('[PlatformAwareWorkflowEngine] Failed to get definition', {
        platform_id: platformId,
        workflow_type: workflowType,
        error: error instanceof Error ? error.message : String(error)
      })
      return null
    }
  }

  /**
   * Get next stage based on current stage and definition
   */
  async getNextStage(
    platformId: string | undefined,
    workflowType: string,
    currentStage: string
  ): Promise<StageRoutingDecision> {
    // Get workflow definition
    const definition = await this.getWorkflowDefinition(platformId, workflowType)

    if (!definition) {
      logger.error('[PlatformAwareWorkflowEngine] Definition not found for routing', {
        platform_id: platformId,
        workflow_type: workflowType
      })
      throw new Error(`No workflow definition found for ${workflowType}`)
    }

    // Find current stage index
    const currentStageIndex = definition.stages.findIndex(s => s.name === currentStage)

    if (currentStageIndex === -1) {
      logger.error('[PlatformAwareWorkflowEngine] Current stage not found in definition', {
        current_stage: currentStage,
        workflow_type: workflowType
      })
      throw new Error(`Stage ${currentStage} not found in definition`)
    }

    // Find next stage
    const nextStageIndex = currentStageIndex + 1
    const nextStageDefinition = definition.stages[nextStageIndex] || null

    // Build stage weight map for progress calculation
    const stageWeightMap = buildStageWeightMap(definition.stages)
    const totalWeight = calculateTotalProgressWeight(definition.stages)

    // Get expected progress for next stage
    let expectedProgress = 0
    if (nextStageDefinition && stageWeightMap.has(nextStageDefinition.name)) {
      const nextStageInfo = stageWeightMap.get(nextStageDefinition.name)
      expectedProgress = nextStageInfo?.percentage ?? 0
    } else if (nextStageIndex >= definition.stages.length) {
      expectedProgress = 100 // Workflow complete
    }

    return {
      next_stage: nextStageDefinition?.name || null,
      stage_index: nextStageIndex,
      total_stages: definition.stages.length,
      progress_weight: nextStageDefinition?.progress_weight || 0,
      expected_progress: expectedProgress,
      agent_type: nextStageDefinition?.agent_type || '',
      timeout_ms: nextStageDefinition?.timeout_ms || 300000,
      should_skip: nextStageDefinition?.required === false
    }
  }

  /**
   * Calculate progress for a workflow
   */
  async calculateProgress(
    platformId: string | undefined,
    workflowType: string,
    currentStage: string
  ): Promise<ProgressCalculation> {
    // Get workflow definition
    const definition = await this.getWorkflowDefinition(platformId, workflowType)

    if (!definition) {
      logger.error('[PlatformAwareWorkflowEngine] Definition not found for progress calculation', {
        platform_id: platformId,
        workflow_type: workflowType
      })
      throw new Error(`No workflow definition found for ${workflowType}`)
    }

    // Build stage weight map
    const stageWeightMap = buildStageWeightMap(definition.stages)
    const totalWeight = calculateTotalProgressWeight(definition.stages)

    // Find current stage
    const currentStageIndex = definition.stages.findIndex(s => s.name === currentStage)

    if (currentStageIndex === -1) {
      logger.warn('[PlatformAwareWorkflowEngine] Current stage not in definition', {
        current_stage: currentStage
      })
      return {
        current_stage: currentStage,
        stage_index: -1,
        total_stages: definition.stages.length,
        progress_percentage: 0,
        cumulative_weight: 0,
        total_weight: totalWeight
      }
    }

    // Get progress for current stage
    const stageInfo = stageWeightMap.get(currentStage)
    const progressPercentage = stageInfo?.percentage ?? 0

    return {
      current_stage: currentStage,
      stage_index: currentStageIndex,
      total_stages: definition.stages.length,
      progress_percentage: Math.round(progressPercentage),
      cumulative_weight: stageInfo?.cumulative_weight || 0,
      total_weight: totalWeight
    }
  }

  /**
   * Get all stages for a workflow definition
   */
  async getWorkflowStages(
    platformId: string | undefined,
    workflowType: string
  ): Promise<WorkflowStageDefinition[]> {
    const definition = await this.getWorkflowDefinition(platformId, workflowType)

    if (!definition) {
      logger.error('[PlatformAwareWorkflowEngine] Definition not found for stage retrieval', {
        platform_id: platformId,
        workflow_type: workflowType
      })
      return []
    }

    return definition.stages
  }

  /**
   * Get stage at specific index
   */
  async getStageAtIndex(
    platformId: string | undefined,
    workflowType: string,
    index: number
  ): Promise<WorkflowStageDefinition | null> {
    const stages = await this.getWorkflowStages(platformId, workflowType)

    if (index < 0 || index >= stages.length) {
      return null
    }

    return stages[index]
  }

  /**
   * Validate workflow definition against current database
   */
  async validateDefinition(definition: WorkflowDefinitionFull): Promise<{
    valid: boolean
    errors: string[]
  }> {
    const errors: string[] = []

    // Check stages
    if (!definition.stages || definition.stages.length === 0) {
      errors.push('Definition must have at least one stage')
    }

    // Check stage names are unique
    const stageNames = definition.stages.map(s => s.name)
    const uniqueNames = new Set(stageNames)
    if (uniqueNames.size !== stageNames.length) {
      errors.push('Stage names must be unique')
    }

    // Check progress weights sum to meaningful value
    const totalWeight = calculateTotalProgressWeight(definition.stages)
    if (totalWeight <= 0) {
      errors.push('Total progress weight must be greater than 0')
    }

    // Check workflow types
    if (!definition.workflow_types || definition.workflow_types.length === 0) {
      errors.push('Definition must specify at least one workflow type')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Clear definition cache (for testing or updates)
   */
  clearCache(): void {
    this.definitionCache.clear()
    this.stageLookupCache.clear()
    logger.info('[PlatformAwareWorkflowEngine] Cache cleared')
  }

  /**
   * Clear specific definition cache entry
   */
  clearCacheEntry(platformId: string | undefined, workflowType: string): void {
    const cacheKey = `${platformId || 'legacy'}:${workflowType}`
    this.definitionCache.delete(cacheKey)
    this.stageLookupCache.delete(cacheKey)
  }

  /**
   * Get engine statistics
   */
  getStats(): {
    cached_definitions: number
    cached_lookups: number
  } {
    return {
      cached_definitions: this.definitionCache.size,
      cached_lookups: this.stageLookupCache.size
    }
  }
}
