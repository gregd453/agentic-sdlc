import { BaseAgent } from '@agentic-sdlc/base-agent';
import { AgentEnvelope, TaskResult } from '@agentic-sdlc/base-agent';
import { AGENT_TYPES } from '@agentic-sdlc/shared-types';
import { BehaviorExecutor } from './behavior-executor.js';

/**
 * Generic Mock Agent - Flexible agent for testing and multi-platform scenarios
 *
 * Phase 4: Can be registered multiple times with different:
 * - Agent types (scaffold, validation, e2e_test, integration, deployment)
 * - Platform IDs (web-app-platform, data-pipeline-platform, etc.)
 *
 * Features:
 * - Metadata-driven behavior for test scenarios (success, failure, timeout, partial, crash)
 * - Generates realistic mock outputs
 * - Supports arbitrary platform/stage combinations
 * - Configurable delay for testing timing
 * - Failure injection via behavior_metadata in task payload
 */
export class GenericMockAgent extends BaseAgent {
  private readonly mockDelay: number; // Configurable delay in ms for testing timing
  private readonly agentType: string; // Override agent type for flexibility
  private readonly enableDebug: boolean; // Enable detailed logging
  private readonly behaviorExecutor: BehaviorExecutor; // Executes behaviors based on metadata

  constructor(
    messageBus: any,
    agentType: string = AGENT_TYPES.SCAFFOLD,
    platformId?: string,
    mockDelay: number = 100,
    enableDebug: boolean = process.env.MOCK_AGENT_DEBUG === 'true'
  ) {
    super(
      {
        type: agentType,
        version: '1.0.0',
        capabilities: [
          'mock-task-completion',
          'test-stage-progression',
          'platform-aware-execution',
          'metadata-driven-behavior',
          'failure-injection'
        ]
      },
      messageBus,
      undefined, // Use default logger config service
      undefined, // Use default configuration manager
      undefined, // Use default service locator
      platformId // Phase 4: Platform context
    );

    this.agentType = agentType;
    this.mockDelay = mockDelay;
    this.enableDebug = enableDebug;
    this.behaviorExecutor = new BehaviorExecutor({ enableDebug, logger: this.logger });

    if (this.enableDebug) {
      this.logger.info('[GenericMockAgent] Initialized', {
        agentType,
        platformId: platformId || 'global',
        mockDelay,
        capabilities: [
          'mock-task-completion',
          'test-stage-progression',
          'platform-aware-execution',
          'metadata-driven-behavior',
          'failure-injection'
        ]
      });
    }
  }

  /**
   * Execute mock task with metadata-driven behavior
   *
   * Supports behavior metadata in task.payload.behavior_metadata:
   * - mode: 'success' | 'failure' | 'timeout' | 'partial' | 'crash'
   * - error: { code, message, retryable }
   * - partial: { total_items, successful_items, failed_items }
   * - output: { custom output overrides }
   * - timing: { execution_delay_ms, variance_ms }
   * - metrics: { custom metrics overrides }
   *
   * Example:
   * ```
   * task.payload.behavior_metadata = {
   *   mode: 'failure',
   *   error: {
   *     code: 'VALIDATION_ERROR',
   *     message: 'TypeScript errors',
   *     retryable: true
   *   }
   * }
   * ```
   */
  async execute(task: AgentEnvelope): Promise<TaskResult> {
    const startTime = Date.now();
    const traceId = task.trace.trace_id;
    const currentStage = task.workflow_context?.current_stage || 'unknown';
    // Access platform_id via string indexing since it's not in the base type
    const platformId = (task.workflow_context as any)?.platform_id || 'global';

    if (this.enableDebug) {
      this.logger.info('[GenericMockAgent] Executing mock task', {
        task_id: task.task_id,
        workflow_id: task.workflow_id,
        trace_id: traceId,
        stage: currentStage,
        platformId,
        agentType: this.agentType,
        has_behavior_metadata: !!(task.payload as any)?.behavior_metadata
      });
    }

    try {
      // Generate baseline mock output
      const baselineOutput = this.generateMockOutput(this.agentType, currentStage, task);
      const baselineMetrics = {
        duration_ms: 0,
        resource_usage: {
          memory_mb: 50,
          cpu_percent: 10
        }
      };

      // Apply configurable default delay if no behavior metadata
      let delayMs = this.mockDelay;
      const behaviorMetadata = (task.payload as any)?.behavior_metadata;
      if (behaviorMetadata?.timing?.execution_delay_ms !== undefined) {
        delayMs = behaviorMetadata.timing.execution_delay_ms;
      }

      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      // Use BehaviorExecutor to handle behavior-driven execution
      const result = await this.behaviorExecutor.execute(
        task,
        this.agentType,
        this.agentId,
        baselineOutput,
        baselineMetrics
      );

      if (this.enableDebug) {
        this.logger.info('[GenericMockAgent] Task execution completed', {
          task_id: task.task_id,
          status: result.status,
          execution_time_ms: Date.now() - startTime,
          platformId,
          stage: currentStage
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error('[GenericMockAgent] Task execution failed', {
        task_id: task.task_id,
        workflow_id: task.workflow_id,
        stage: currentStage,
        platformId,
        error: errorMessage
      });

      throw error;
    }
  }

  /**
   * Generate mock output based on agent type and stage
   * Each agent type produces realistic mock data for its domain
   */
  private generateMockOutput(agentType: string, stage: string, task: AgentEnvelope): Record<string, any> {
    const projectName = (task.payload as any)?.name || 'mock-project';
    const platformId = (task.workflow_context as any)?.platform_id || 'global';

    switch (agentType) {
      case AGENT_TYPES.SCAFFOLD:
        return {
          status: 'success',
          project_name: projectName,
          output_path: `/mock/output/${projectName}`,
          files_generated: [
            { path: 'src/index.ts', lines: 50 },
            { path: 'package.json', lines: 30 },
            { path: 'README.md', lines: 20 }
          ],
          structure_type: (task.payload as any)?.project_type || 'app',
          platform_id: platformId,
          message: `Mock scaffold agent successfully generated structure for ${projectName}`
        };

      case AGENT_TYPES.VALIDATION:
        return {
          status: 'success',
          validation_result: 'passed',
          errors: [],
          warnings: [],
          files_checked: 3,
          platform_id: platformId,
          message: `Mock validation agent verified ${(task.payload as any)?.working_directory || 'project directory'}`
        };

      case AGENT_TYPES.E2E:
        return {
          status: 'success',
          tests_run: 25,
          tests_passed: 25,
          tests_failed: 0,
          coverage: 92,
          platform_id: platformId,
          message: `Mock e2e agent completed 25/25 tests successfully`
        };

      case AGENT_TYPES.INTEGRATION:
        return {
          status: 'success',
          tests_run: 15,
          tests_passed: 15,
          tests_failed: 0,
          duration_ms: 5000,
          platform_id: platformId,
          message: `Mock integration agent completed 15/15 tests successfully`
        };

      case AGENT_TYPES.DEPLOYMENT:
        return {
          status: 'success',
          deployment_status: 'deployed',
          endpoint: `https://mock-${projectName}.example.com`,
          deployment_time_ms: 30000,
          platform_id: platformId,
          message: `Mock deployment agent deployed ${projectName} successfully`
        };

      default:
        return {
          status: 'success',
          agent_type: agentType,
          stage,
          platform_id: platformId,
          message: `Mock agent completed task for agent type: ${agentType}`
        };
    }
  }

  /**
   * Get agent info for debugging and monitoring
   */
  getAgentInfo(): Record<string, any> {
    return {
      agentType: this.agentType,
      platformId: this.platformId,
      agentId: this.agentId,
      capabilities: [
        'mock-task-completion',
        'test-stage-progression',
        'platform-aware-execution',
        'metadata-driven-behavior',
        'failure-injection'
      ],
      mockDelay: this.mockDelay,
      isGenericMockAgent: true,
      availableBehaviors: this.getAvailableBehaviors()
    };
  }

  /**
   * Get available behavior presets for testing
   * Useful for test discovery and documentation
   */
  getAvailableBehaviors(): string[] {
    return this.behaviorExecutor.getAvailablePresets();
  }

  /**
   * Get a specific behavior preset by name
   * Useful for tests to reference predefined behaviors
   */
  getBehaviorPreset(name: string): any {
    return this.behaviorExecutor.getPreset(name);
  }
}
