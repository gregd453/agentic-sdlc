/**
 * Adaptive Progress Calculator Service - Calculates workflow progress based on platform definitions
 *
 * Responsibilities:
 * - Calculate progress using platform-specific weights
 * - Support multiple progress calculation strategies
 * - Handle stage dependencies
 * - Provide progress estimation and ETA
 */

import { PlatformAwareWorkflowEngine } from './platform-aware-workflow-engine.service'
import { logger } from '../utils/logger'

export interface ProgressMetrics {
  current_progress: number // 0-100
  current_stage: string
  stage_index: number
  total_stages: number
  remaining_stages: number
  estimated_completion_percentage: number
  calculation_method: 'weighted' | 'linear' | 'exponential' | 'legacy'
  is_estimated: boolean
}

export interface ProgressEstimate {
  estimated_completion_ms: number
  confidence_percentage: number
  based_on_stages: number
}

export class AdaptiveProgressCalculator {
  private startTimes: Map<string, number> = new Map()
  private stageCompletionTimes: Map<string, number[]> = new Map()

  constructor(private workflowEngine: PlatformAwareWorkflowEngine) {
    logger.info('[AdaptiveProgressCalculator] Service initialized')
  }

  /**
   * Calculate workflow progress
   */
  async calculateProgress(
    workflowId: string,
    platformId: string | undefined,
    workflowType: string,
    currentStage: string
  ): Promise<ProgressMetrics> {
    logger.info('[AdaptiveProgressCalculator] Calculating progress', {
      workflow_id: workflowId,
      current_stage: currentStage,
      workflow_type: workflowType,
      platform_id: platformId
    })

    try {
      // Get progress from definition-driven engine
      const progress = await this.workflowEngine.calculateProgress(
        platformId,
        workflowType,
        currentStage
      )

      // Get definition to know calculation method
      const definition = await this.workflowEngine.getWorkflowDefinition(platformId, workflowType)
      const calculationMethod = definition?.progress_calculation || 'weighted'

      // Apply calculation method adjustments
      const adjustedProgress = this.applyCalculationMethod(
        calculationMethod as any,
        progress.progress_percentage,
        progress.stage_index,
        progress.total_stages
      )

      return {
        current_progress: adjustedProgress,
        current_stage: currentStage,
        stage_index: progress.stage_index,
        total_stages: progress.total_stages,
        remaining_stages: progress.total_stages - progress.stage_index - 1,
        estimated_completion_percentage: Math.min(adjustedProgress + 10, 95), // Leave room for final cleanup
        calculation_method: calculationMethod as any,
        is_estimated: false
      }
    } catch (error) {
      logger.warn('[AdaptiveProgressCalculator] Definition-based calculation failed, using linear fallback', {
        workflow_id: workflowId,
        error: error instanceof Error ? error.message : String(error)
      })

      // Fallback to linear progress
      return this.calculateProgressLinear(workflowId, workflowType, currentStage)
    }
  }

  /**
   * Linear progress calculation (fallback)
   */
  private async calculateProgressLinear(
    workflowId: string,
    workflowType: string,
    currentStage: string
  ): Promise<ProgressMetrics> {
    try {
      const stages = await this.workflowEngine.getWorkflowStages(undefined, workflowType)
      const stageIndex = stages.findIndex(s => s.name === currentStage)

      if (stageIndex === -1) {
        return this.defaultProgress(workflowType, currentStage)
      }

      const progress = Math.round(((stageIndex + 1) / stages.length) * 100)

      return {
        current_progress: progress,
        current_stage: currentStage,
        stage_index: stageIndex,
        total_stages: stages.length,
        remaining_stages: stages.length - stageIndex - 1,
        estimated_completion_percentage: Math.min(progress + 10, 95),
        calculation_method: 'linear',
        is_estimated: false
      }
    } catch (error) {
      logger.error('[AdaptiveProgressCalculator] Linear calculation failed', {
        error: error instanceof Error ? error.message : String(error)
      })
      return this.defaultProgress(workflowType, currentStage)
    }
  }

  /**
   * Apply calculation method to progress percentage
   */
  private applyCalculationMethod(
    method: 'weighted' | 'linear' | 'exponential' | 'custom',
    baseProgress: number,
    stageIndex: number,
    totalStages: number
  ): number {
    switch (method) {
      case 'weighted':
        // Weighted is already applied by definition engine
        return Math.min(Math.max(baseProgress, 0), 100)

      case 'linear':
        // Linear calculation
        return Math.round(((stageIndex + 1) / totalStages) * 100)

      case 'exponential':
        // Exponential: early stages slow, later stages faster
        // Formula: (stageIndex / totalStages) ^ 0.8 * 100
        const exponentialProgress = Math.pow(
          (stageIndex + 1) / totalStages,
          0.8
        ) * 100
        return Math.min(Math.max(Math.round(exponentialProgress), 0), 100)

      case 'custom':
        // Custom calculation: return as-is
        return Math.min(Math.max(baseProgress, 0), 100)

      default:
        return Math.min(Math.max(baseProgress, 0), 100)
    }
  }

  /**
   * Estimate time to completion
   */
  async estimateCompletion(
    workflowId: string,
    currentProgress: number,
    elapsedMs: number,
    totalStages: number
  ): Promise<ProgressEstimate> {
    try {
      if (currentProgress === 0 || elapsedMs === 0) {
        return {
          estimated_completion_ms: 0,
          confidence_percentage: 0,
          based_on_stages: 0
        }
      }

      // Simple linear estimation: if we've completed X% in Y ms, 100% takes Y/X*100 ms
      const estimatedTotalMs = Math.round((elapsedMs / currentProgress) * 100)
      const estimatedRemainingMs = Math.max(estimatedTotalMs - elapsedMs, 0)

      // Confidence decreases as stages increase (more unknowns)
      const confidence = Math.max(100 - totalStages * 5, 20)

      return {
        estimated_completion_ms: estimatedRemainingMs,
        confidence_percentage: confidence,
        based_on_stages: totalStages
      }
    } catch (error) {
      logger.error('[AdaptiveProgressCalculator] Estimation failed', {
        error: error instanceof Error ? error.message : String(error)
      })
      return {
        estimated_completion_ms: 0,
        confidence_percentage: 0,
        based_on_stages: 0
      }
    }
  }

  /**
   * Record stage completion time
   */
  recordStageCompletion(workflowId: string, stageName: string, durationMs: number): void {
    if (!this.stageCompletionTimes.has(stageName)) {
      this.stageCompletionTimes.set(stageName, [])
    }

    const times = this.stageCompletionTimes.get(stageName)!
    times.push(durationMs)

    // Keep only last 10 completions to avoid stale data
    if (times.length > 10) {
      times.shift()
    }

    logger.info('[AdaptiveProgressCalculator] Stage completion recorded', {
      workflow_id: workflowId,
      stage_name: stageName,
      duration_ms: durationMs,
      history_count: times.length
    })
  }

  /**
   * Get average stage duration
   */
  getAverageStageDuration(stageName: string): number {
    const times = this.stageCompletionTimes.get(stageName)

    if (!times || times.length === 0) {
      return 0
    }

    const total = times.reduce((sum, time) => sum + time, 0)
    return Math.round(total / times.length)
  }

  /**
   * Get default/fallback progress
   */
  private defaultProgress(workflowType: string, currentStage: string): ProgressMetrics {
    // Conservative default: 50% at any unknown stage
    return {
      current_progress: 50,
      current_stage: currentStage,
      stage_index: 0,
      total_stages: 1,
      remaining_stages: 0,
      estimated_completion_percentage: 60,
      calculation_method: 'legacy',
      is_estimated: true
    }
  }

  /**
   * Reset calculator for new workflow
   */
  resetWorkflow(workflowId: string): void {
    this.startTimes.delete(workflowId)
    logger.info('[AdaptiveProgressCalculator] Workflow reset', {
      workflow_id: workflowId
    })
  }

  /**
   * Clear all history
   */
  clearHistory(): void {
    this.stageCompletionTimes.clear()
    this.startTimes.clear()
    logger.info('[AdaptiveProgressCalculator] History cleared')
  }

  /**
   * Get calculator statistics
   */
  getStats(): {
    tracked_stages: number
    historical_completions: number
  } {
    const totalCompletions = Array.from(this.stageCompletionTimes.values()).reduce(
      (sum, times) => sum + times.length,
      0
    )

    return {
      tracked_stages: this.stageCompletionTimes.size,
      historical_completions: totalCompletions
    }
  }
}
