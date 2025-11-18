import { AGENT_TYPES } from '@agentic-sdlc/shared-types';
import { WORKFLOW_STATUS, TASK_STATUS } from '@agentic-sdlc/shared-types';
/**
 * WorkflowDefinitionAdapter Service - Bridges state machine with definition-driven logic
 *
 * Responsibilities:
 * - Adapt PlatformAwareWorkflowEngine decisions for state machine
 * - Provide definition-based next stage routing
 * - Calculate progress with platform-specific weights
 * - Handle fallback definitions gracefully
 */

import { PlatformAwareWorkflowEngine } from './platform-aware-workflow-engine.service'
import { getNextStage as getLegacyNextStage } from '../utils/stages'
import { logger } from '../utils/logger'

export interface WorkflowContext {
  workflow_id: string
  workflow_type: string
  current_stage: string
  platform_id?: string
  progress: number
}

export interface StageTransition {
  next_stage: string | null
  agent_type: string
  progress: number
  timeout_ms: number
  is_fallback: boolean
}

export class WorkflowDefinitionAdapter {
  constructor(private workflowEngine: PlatformAwareWorkflowEngine) {
    logger.info('[WorkflowDefinitionAdapter] Service initialized')
  }

  /**
   * Get next stage with definition support and fallback to legacy
   */
  async getNextStageWithFallback(context: WorkflowContext): Promise<StageTransition> {
    logger.info('[WorkflowDefinitionAdapter] Getting next stage', {
      workflow_id: context.workflow_id,
      current_stage: context.current_stage,
      workflow_type: context.workflow_type,
      platform_id: context.platform_id
    })

    try {
      // Try to use definition-driven routing first
      const decision = await this.workflowEngine.getNextStage(
        context.platform_id,
        context.workflow_type,
        context.current_stage
      )

      // Calculate progress
      const progress = await this.workflowEngine.calculateProgress(
        context.platform_id,
        context.workflow_type,
        context.current_stage
      )

      return {
        next_stage: decision.next_stage,
        agent_type: decision.agent_type,
        progress: progress.progress_percentage,
        timeout_ms: decision.timeout_ms,
        is_fallback: false
      }
    } catch (error) {
      logger.warn('[WorkflowDefinitionAdapter] Definition-driven routing failed, using legacy fallback', {
        workflow_id: context.workflow_id,
        error: error instanceof Error ? error.message : String(error)
      })

      // Fallback to legacy stage sequencing
      return await this.getNextStageLegacy(context)
    }
  }

  /**
   * Legacy fallback - use hard-coded stage sequences
   */
  private async getNextStageLegacy(context: WorkflowContext): Promise<StageTransition> {
    logger.info('[WorkflowDefinitionAdapter] Using legacy stage progression', {
      workflow_id: context.workflow_id,
      current_stage: context.current_stage,
      workflow_type: context.workflow_type
    })

    try {
      // Use legacy stage lookup
      const nextStageName = getLegacyNextStage(context.current_stage as any, context.workflow_type)

      // Map stage to agent (legacy mapping)
      const agentType = this.mapStageToAgentLegacy(nextStageName || '')

      // Calculate progress (linear: stage_index / total_stages * 100)
      const stages = await this.getStagesLegacy(context.workflow_type)
      const currentIndex = stages.indexOf(context.current_stage)
      const nextIndex = currentIndex + 1
      const progress = Math.round((nextIndex / stages.length) * 100)

      return {
        next_stage: nextStageName,
        agent_type: agentType,
        progress,
        timeout_ms: 300000,
        is_fallback: true
      }
    } catch (error) {
      logger.error('[WorkflowDefinitionAdapter] Legacy fallback also failed', {
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  /**
   * Get current progress with definition support and fallback
   */
  async getProgressWithFallback(context: WorkflowContext): Promise<number> {
    try {
      // Try definition-driven calculation
      const calculation = await this.workflowEngine.calculateProgress(
        context.platform_id,
        context.workflow_type,
        context.current_stage
      )

      return calculation.progress_percentage
    } catch (error) {
      logger.warn('[WorkflowDefinitionAdapter] Definition-based progress calculation failed', {
        error: error instanceof Error ? error.message : String(error)
      })

      // Fallback to linear progress calculation
      const stages = await this.getStagesLegacy(context.workflow_type)
      const currentIndex = stages.indexOf(context.current_stage)
      const progress = Math.round(((currentIndex + 1) / stages.length) * 100)

      return progress
    }
  }

  /**
   * Validate workflow has valid definition or legacy fallback
   */
  async validateWorkflowDefinition(
    workflowType: string,
    platformId?: string
  ): Promise<{ valid: boolean; message: string }> {
    try {
      // Try to load definition
      const definition = await this.workflowEngine.getWorkflowDefinition(platformId, workflowType)

      if (definition) {
        return {
          valid: true,
          message: `Using definition-driven routing for ${workflowType}`
        }
      }

      // Check legacy fallback
      const legacyStages = await this.getStagesLegacy(workflowType)
      if (legacyStages.length > 0) {
        return {
          valid: true,
          message: `Using legacy stage routing for ${workflowType}`
        }
      }

      return {
        valid: false,
        message: `No definition or legacy stages found for ${workflowType}`
      }
    } catch (error) {
      return {
        valid: false,
        message: `Validation error: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }

  /**
   * Get stages using legacy utility
   */
  private async getStagesLegacy(workflowType: string): Promise<string[]> {
    // Use legacy stage lookup from utils/stages.ts
    // This returns the stage sequence for the workflow type
    try {
      const { getStagesForType } = await import('../utils/stages')
      const stages = getStagesForType(workflowType)
      return stages as string[]
    } catch (error) {
      logger.error('[WorkflowDefinitionAdapter] Failed to get legacy stages', {
        workflow_type: workflowType,
        error: error instanceof Error ? error.message : String(error)
      })
      return []
    }
  }

  /**
   * Map stage name to agent type (legacy mapping)
   */
  private mapStageToAgentLegacy(stage: string): string {
    const mapping: Record<string, string> = {
      initialization: AGENT_TYPES.SCAFFOLD,
      scaffolding: AGENT_TYPES.SCAFFOLD,
      dependency_installation: AGENT_TYPES.SCAFFOLD,
      validation: AGENT_TYPES.VALIDATION,
      e2e_testing: AGENT_TYPES.E2E_TEST,
      integration: AGENT_TYPES.INTEGRATION,
      deployment: AGENT_TYPES.DEPLOYMENT,
      monitoring: 'monitoring'
    }

    return mapping[stage] || AGENT_TYPES.SCAFFOLD
  }

  /**
   * Get definition statistics
   */
  getStats() {
    return {
      engine_stats: this.workflowEngine.getStats()
    }
  }

  /**
   * Clear caches
   */
  clearCache(platformId?: string, workflowType?: string): void {
    if (platformId && workflowType) {
      this.workflowEngine.clearCacheEntry(platformId, workflowType)
    } else {
      this.workflowEngine.clearCache()
    }
  }
}
