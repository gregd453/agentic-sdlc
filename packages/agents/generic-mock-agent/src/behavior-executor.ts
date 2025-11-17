/**
 * Behavior Executor - Executes agent behaviors based on metadata
 *
 * Responsible for:
 * - Parsing behavior metadata from task
 * - Simulating execution modes (success, failure, timeout, partial, crash)
 * - Applying timing delays and variances
 * - Overriding output and metrics
 * - Generating appropriate TaskResult
 */

import { randomUUID } from 'crypto';
import { AgentEnvelope, TaskResult } from '@agentic-sdlc/base-agent';
import type { AgentBehaviorMetadata } from '@agentic-sdlc/shared-types';
import { BEHAVIOR_SAMPLES } from '@agentic-sdlc/shared-types';

export interface BehaviorExecutorOptions {
  enableDebug?: boolean
  logger?: any
}

/**
 * Executes agent behavior based on metadata
 * Separates behavior logic from mock agent
 */
export class BehaviorExecutor {
  private readonly enableDebug: boolean
  private readonly logger: any

  constructor(options: BehaviorExecutorOptions = {}) {
    this.enableDebug = options.enableDebug || false
    this.logger = options.logger || console
  }

  /**
   * Extract behavior metadata from task
   * Returns default success behavior if not specified
   */
  extractBehavior(task: AgentEnvelope): AgentBehaviorMetadata {
    // Check task payload for behavior_metadata
    const payload = task.payload as any
    const behaviorData = payload?.behavior_metadata

    if (!behaviorData) {
      return BEHAVIOR_SAMPLES.success
    }

    if (typeof behaviorData === 'string') {
      // Support preset names like 'validation_error'
      return (BEHAVIOR_SAMPLES as any)[behaviorData] || BEHAVIOR_SAMPLES.success
    }

    return behaviorData as AgentBehaviorMetadata
  }

  /**
   * Execute behavior and generate TaskResult
   * Main entry point for behavior execution
   */
  async execute(
    task: AgentEnvelope,
    _agentType: string,  // Unused, kept for future enhancement
    agentId: string,
    baselineOutput: Record<string, any>,
    baselineMetrics: Record<string, any>
  ): Promise<TaskResult> {
    const startTime = Date.now()
    const behavior = this.extractBehavior(task)

    if (this.enableDebug) {
      this.logger.info('[BehaviorExecutor] Executing behavior', {
        task_id: task.task_id,
        mode: behavior.mode,
        label: behavior.label
      })
    }

    // Apply timing behavior (delay, timeout, variance)
    await this.applyTiming(behavior, task)

    // Execute based on mode
    const executionTimeMs = Date.now() - startTime

    switch (behavior.mode) {
      case 'success':
        return this.generateSuccessResult(
          task,
          _agentType,
          agentId,
          executionTimeMs,
          behavior,
          baselineOutput,
          baselineMetrics
        )

      case 'failure':
        return this.generateFailureResult(
          task,
          _agentType,
          agentId,
          executionTimeMs,
          behavior
        )

      case 'timeout':
        return this.generateTimeoutResult(
          task,
          _agentType,
          agentId,
          executionTimeMs,
          behavior
        )

      case 'partial':
        return this.generatePartialResult(
          task,
          _agentType,
          agentId,
          executionTimeMs,
          behavior,
          baselineOutput,
          baselineMetrics
        )

      case 'crash':
        return this.generateCrashResult(
          task,
          _agentType,
          agentId,
          executionTimeMs,
          behavior
        )

      default:
        // Fallback to success
        return this.generateSuccessResult(
          task,
          _agentType,
          agentId,
          executionTimeMs,
          BEHAVIOR_SAMPLES.success,
          baselineOutput,
          baselineMetrics
        )
    }
  }

  /**
   * Apply timing behavior: delay and timeout simulation
   */
  private async applyTiming(behavior: AgentBehaviorMetadata, task: AgentEnvelope): Promise<void> {
    const timing = behavior.timing

    if (!timing) {
      return
    }

    // Apply execution delay
    if (timing.execution_delay_ms !== undefined) {
      const delay = this.getVarianceAdjustedDelay(timing.execution_delay_ms, timing.variance_ms)

      if (this.enableDebug) {
        this.logger.info('[BehaviorExecutor] Applying delay', {
          task_id: task.task_id,
          delay_ms: delay
        })
      }

      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  /**
   * Apply variance to delay
   */
  private getVarianceAdjustedDelay(baseDelay: number, variance?: number): number {
    if (!variance || variance <= 0) {
      return baseDelay
    }

    const randomVariance = Math.random() * variance
    return baseDelay + randomVariance
  }

  /**
   * Generate successful result
   */
  private generateSuccessResult(
    task: AgentEnvelope,
    _agentType: string,  // Unused, kept for consistency
    agentId: string,
    executionTimeMs: number,
    behavior: AgentBehaviorMetadata,
    baselineOutput: Record<string, any>,
    baselineMetrics: Record<string, any>
  ): TaskResult {
    // Merge baseline output with behavior overrides
    const output = {
      ...baselineOutput,
      ...(behavior.output || {})
    }

    // Merge baseline metrics with behavior overrides
    const metrics = {
      ...baselineMetrics,
      duration_ms: executionTimeMs,
      ...(behavior.metrics || {})
    }

    const result: TaskResult = {
      message_id: randomUUID(),
      task_id: task.task_id as any,
      workflow_id: task.workflow_id as any,
      agent_id: agentId,
      status: 'success',
      result: {
        data: output,
        metrics
      },
      metadata: {
        completed_at: new Date().toISOString(),
        trace_id: task.trace.trace_id,
        confidence_score: 95,
        ...(behavior.label && { behavior_label: behavior.label })
      }
    }

    if (this.enableDebug) {
      this.logger.info('[BehaviorExecutor] Generated success result', {
        task_id: task.task_id,
        execution_time_ms: executionTimeMs,
        output_keys: Object.keys(output),
        metrics_keys: Object.keys(metrics)
      })
    }

    return result
  }

  /**
   * Generate failure result
   */
  private generateFailureResult(
    task: AgentEnvelope,
    _agentType: string,  // Unused, kept for consistency
    agentId: string,
    executionTimeMs: number,
    behavior: AgentBehaviorMetadata
  ): TaskResult {
    const error = behavior.error || {
      code: 'AGENT_FAILURE',
      message: 'Agent failed to complete task',
      retryable: true
    }

    const result: TaskResult = {
      message_id: randomUUID(),
      task_id: task.task_id as any,
      workflow_id: task.workflow_id as any,
      agent_id: agentId,
      status: 'failure',
      result: {
        data: null as any,
        metrics: {
          duration_ms: executionTimeMs
        }
      },
      errors: [
        {
          code: error.code,
          message: error.message,
          details: error.details,
          recoverable: error.retryable
        }
      ],
      metadata: {
        completed_at: new Date().toISOString(),
        trace_id: task.trace.trace_id,
        confidence_score: 0
      }
    }

    if (this.enableDebug) {
      this.logger.info('[BehaviorExecutor] Generated failure result', {
        task_id: task.task_id,
        error_code: error.code,
        retryable: error.retryable
      })
    }

    return result
  }

  /**
   * Generate timeout result
   */
  private generateTimeoutResult(
    task: AgentEnvelope,
    _agentType: string,  // Unused, kept for consistency
    agentId: string,
    executionTimeMs: number,
    behavior: AgentBehaviorMetadata
  ): TaskResult {
    const error = behavior.error || {
      code: 'TIMEOUT',
      message: 'Agent execution exceeded timeout',
      retryable: true
    }

    return this.generateFailureResult(task, _agentType, agentId, executionTimeMs, {
      ...behavior,
      error
    })
  }

  /**
   * Generate partial success result (e.g., 8/10 tests passed)
   */
  private generatePartialResult(
    task: AgentEnvelope,
    _agentType: string,  // Unused, kept for consistency
    agentId: string,
    executionTimeMs: number,
    behavior: AgentBehaviorMetadata,
    baselineOutput: Record<string, any>,
    baselineMetrics: Record<string, any>
  ): TaskResult {
    const partial = behavior.partial || {
      total_items: 10,
      successful_items: 8,
      failed_items: 2
    }

    // Merge baseline output with behavior overrides
    const output = {
      ...baselineOutput,
      ...(behavior.output || {}),
      // Ensure partial counts are reflected
      total_items: partial.total_items,
      successful_items: partial.successful_items,
      failed_items: partial.failed_items
    }

    const metrics = {
      ...baselineMetrics,
      duration_ms: executionTimeMs,
      failure_rate: partial.failure_rate || partial.failed_items / partial.total_items,
      ...(behavior.metrics || {})
    }

    // Partial success is still a failure (didn't complete fully)
    const result: TaskResult = {
      message_id: randomUUID(),
      task_id: task.task_id as any,
      workflow_id: task.workflow_id as any,
      agent_id: agentId,
      status: 'failure',
      result: {
        data: output,
        metrics
      },
      errors: [
        {
          code: 'PARTIAL_SUCCESS',
          message: `${partial.successful_items}/${partial.total_items} items completed successfully`,
          details: {
            total_items: partial.total_items,
            successful_items: partial.successful_items,
            failed_items: partial.failed_items
          },
          recoverable: true
        }
      ],
      metadata: {
        completed_at: new Date().toISOString(),
        trace_id: task.trace.trace_id,
        confidence_score: (partial.successful_items / partial.total_items) * 100,
        ...(behavior.label && { behavior_label: behavior.label })
      }
    }

    if (this.enableDebug) {
      this.logger.info('[BehaviorExecutor] Generated partial result', {
        task_id: task.task_id,
        successful: partial.successful_items,
        failed: partial.failed_items,
        total: partial.total_items
      })
    }

    return result
  }

  /**
   * Generate crash result
   */
  private generateCrashResult(
    task: AgentEnvelope,
    _agentType: string,  // Unused, kept for consistency
    agentId: string,
    executionTimeMs: number,
    behavior: AgentBehaviorMetadata
  ): TaskResult {
    const error = behavior.error || {
      code: 'AGENT_CRASH',
      message: 'Agent process crashed unexpectedly',
      retryable: true
    }

    return this.generateFailureResult(task, _agentType, agentId, executionTimeMs, {
      ...behavior,
      error
    })
  }

  /**
   * Get available behavior presets
   */
  getAvailablePresets(): string[] {
    return Object.keys(BEHAVIOR_SAMPLES)
  }

  /**
   * Get preset by name
   */
  getPreset(name: string): AgentBehaviorMetadata | undefined {
    return (BEHAVIOR_SAMPLES as any)[name]
  }
}
