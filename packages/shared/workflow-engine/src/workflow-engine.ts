import {
  WorkflowDefinition,
  WorkflowContext,
  StageResult,
  StageOutcome,
  WorkflowResult,
  validateWorkflowDefinition,
  WorkflowSchemaError
} from './workflow-schema';

/**
 * Workflow Engine
 * Manages workflow definitions and provides stage routing logic
 */
export class WorkflowEngine {
  private readonly logger: any;

  /**
   * Constructor with optional logger injection
   * If no logger provided, uses console as fallback
   */
  constructor(private definition: WorkflowDefinition, injectedLogger?: any) {
    this.logger = injectedLogger || console;
    this.validate();
  }

  /**
   * Validate workflow definition
   */
  private validate(): void {
    try {
      validateWorkflowDefinition(this.definition);
    } catch (error) {
      throw new WorkflowEngineError(
        `Invalid workflow definition: ${error instanceof Error ? error.message : String(error)}`,
        this.definition.name
      );
    }

    // Verify start stage exists
    if (!this.definition.stages[this.definition.start_stage]) {
      throw new WorkflowEngineError(
        `Start stage '${this.definition.start_stage}' not found in workflow stages`,
        this.definition.name
      );
    }

    // Verify all referenced stages exist
    for (const stageName in this.definition.stages) {
      const stage = this.definition.stages[stageName];
      if (stage.on_success && !this.definition.stages[stage.on_success]) {
        throw new WorkflowEngineError(
          `Stage '${stageName}' references non-existent success target '${stage.on_success}'`,
          this.definition.name
        );
      }
      if (stage.on_failure && !this.definition.stages[stage.on_failure]) {
        throw new WorkflowEngineError(
          `Stage '${stageName}' references non-existent failure target '${stage.on_failure}'`,
          this.definition.name
        );
      }
    }
  }

  /**
   * Get the workflow definition
   */
  getDefinition(): WorkflowDefinition {
    return { ...this.definition };
  }

  /**
   * Get starting stage name
   */
  getStartStage(): string {
    return this.definition.start_stage;
  }

  /**
   * Get all stage names
   */
  getStages(): string[] {
    return Object.keys(this.definition.stages);
  }

  /**
   * Get specific stage configuration
   */
  getStageConfig(stageName: string) {
    const stage = this.definition.stages[stageName];
    if (!stage) {
      throw new WorkflowEngineError(
        `Stage '${stageName}' not found in workflow`,
        this.definition.name
      );
    }
    return stage;
  }

  /**
   * Determine next stage based on outcome and routing rules
   */
  getNextStage(currentStageName: string, outcome: StageOutcome): string | null {
    const stage = this.getStageConfig(currentStageName);

    switch (outcome) {
      case 'success':
        return stage.on_success || null;
      case 'failure':
        return stage.on_failure || null;
      case 'timeout':
        // Timeout follows failure routing
        return stage.on_failure || null;
      case 'unknown':
        // Unknown outcome follows failure routing
        return stage.on_failure || null;
      default:
        this.logger.warn(`Unknown outcome type: ${outcome}`);
        return null;
    }
  }

  /**
   * Get all parallel-eligible stages for a given context
   */
  getParallelEligibleStages(context: WorkflowContext): string[] {
    const parallelStages: string[] = [];
    const completedStages = new Set(Object.keys(context.stage_results));

    for (const stageName in this.definition.stages) {
      const stage = this.definition.stages[stageName];

      // Only consider stages marked as parallel
      if (!stage.parallel) continue;

      // Skip already completed stages
      if (completedStages.has(stageName)) continue;

      // Check if dependencies are satisfied (simplified: just check current stage)
      // In a real system, would track dependency graph
      if (stageName === context.current_stage) {
        parallelStages.push(stageName);
      }
    }

    return parallelStages.slice(0, this.definition.max_parallel_stages);
  }

  /**
   * Check if a stage should be skipped based on conditions
   */
  shouldSkipStage(stageName: string, context: WorkflowContext): boolean {
    const stage = this.getStageConfig(stageName);

    if (!stage.skip_condition) {
      return false;
    }

    // Simple expression evaluation (would be extended for complex conditions)
    try {
      // Check for stage_result.{stage}.success pattern
      if (stage.skip_condition.includes('stage_result')) {
        // Placeholder for complex condition evaluation
        return false;
      }
      return false;
    } catch (error) {
      this.logger.error(`Error evaluating skip condition for stage '${stageName}':`, error);
      return false;
    }
  }

  /**
   * Get the configured retry strategy
   */
  getRetryStrategy(): 'exponential' | 'linear' | 'immediate' {
    return this.definition.retry_strategy;
  }

  /**
   * Get on_failure behavior
   */
  getOnFailureBehavior(): 'stop' | 'continue' | 'skip' {
    return this.definition.on_failure;
  }

  /**
   * Calculate retry backoff in milliseconds
   */
  calculateRetryBackoff(attemptNumber: number, strategy: 'exponential' | 'linear' | 'immediate'): number {
    const baseDelay = 1000; // 1 second base delay

    switch (strategy) {
      case 'exponential':
        // 1s, 2s, 4s, 8s, etc. (capped at 60s)
        return Math.min(baseDelay * Math.pow(2, attemptNumber - 1), 60000);
      case 'linear':
        // 1s, 2s, 3s, 4s, etc. (capped at 60s)
        return Math.min(baseDelay * attemptNumber, 60000);
      case 'immediate':
        return 0;
      default:
        return 0;
    }
  }

  /**
   * Validate workflow can be executed within constraints
   */
  validateConstraints(context: WorkflowContext): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check global timeout not exceeded
    const startedAt = (context.metadata?.started_at as number) || Date.now();
    const elapsed = Date.now() - startedAt;
    if (elapsed > this.definition.global_timeout_ms) {
      errors.push(`Global timeout exceeded: ${elapsed}ms > ${this.definition.global_timeout_ms}ms`);
    }

    // Check current stage exists
    if (!this.definition.stages[context.current_stage]) {
      errors.push(`Current stage '${context.current_stage}' not found in workflow definition`);
    }

    // Check start stage has been reached
    const hasStarted = Object.keys(context.stage_results).length > 0 || context.current_stage === this.definition.start_stage;
    if (!hasStarted) {
      errors.push(`Workflow has not been started (current stage: ${context.current_stage})`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * SESSION #88 PHASE 3: Calculate workflow progress based on completed stages
   *
   * Uses stage weights if defined, otherwise distributes progress evenly.
   *
   * @param completedStages - Array of stage names that have been completed
   * @returns Progress percentage (0-100)
   *
   * @example
   * // With weights: [30, 50, 20] for 3 stages
   * calculateProgress(['stage1']) // returns 30
   * calculateProgress(['stage1', 'stage2']) // returns 80
   * calculateProgress(['stage1', 'stage2', 'stage3']) // returns 100
   *
   * // Without weights: 3 stages
   * calculateProgress(['stage1']) // returns 33
   * calculateProgress(['stage1', 'stage2']) // returns 67
   * calculateProgress(['stage1', 'stage2', 'stage3']) // returns 100
   */
  calculateProgress(completedStages: string[]): number {
    const allStages = this.getStages();
    const totalStages = allStages.length;

    if (totalStages === 0) {
      return 0;
    }

    if (completedStages.length === 0) {
      return 0;
    }

    // Calculate total weight of all stages
    let totalWeight = 0;
    let completedWeight = 0;
    const stageWeights = new Map<string, number>();

    for (const stageName of allStages) {
      const stage = this.definition.stages[stageName];
      const weight = stage.weight || (100 / totalStages); // Even distribution if no weight
      stageWeights.set(stageName, weight);
      totalWeight += weight;
    }

    // Calculate weight of completed stages
    for (const completedStage of completedStages) {
      const weight = stageWeights.get(completedStage);
      if (weight !== undefined) {
        completedWeight += weight;
      }
    }

    // Calculate percentage (ensure it's between 0-100)
    const progress = Math.round((completedWeight / totalWeight) * 100);
    return Math.max(0, Math.min(100, progress));
  }

  /**
   * SESSION #88 PHASE 3: Validate workflow can be executed with available agents
   *
   * Pre-validates that all agent types referenced in the workflow definition
   * exist in the agent registry before workflow execution begins.
   *
   * @param agentRegistry - Object with validateAgentExists method (from AgentRegistryService)
   * @param platformId - Optional platform ID for platform-scoped validation
   * @returns Validation result with agent availability details
   *
   * @example
   * const result = await engine.validateExecution(agentRegistry, 'platform-123');
   * if (!result.valid) {
   *   console.error('Missing agents:', result.missing_agents);
   *   console.error('Suggestions:', result.suggestions);
   * }
   */
  async validateExecution(
    agentRegistry: { validateAgentExists: (agentType: string, platformId?: string) => void },
    platformId?: string
  ): Promise<{
    valid: boolean;
    missing_agents: string[];
    suggestions: string[];
    errors: string[];
  }> {
    const missingAgents: string[] = [];
    const suggestions: string[] = [];
    const errors: string[] = [];

    // Collect all unique agent types from stages
    const agentTypes = new Set<string>();
    for (const stageName in this.definition.stages) {
      const stage = this.definition.stages[stageName];
      agentTypes.add(stage.agent_type);
    }

    // Validate each agent type exists
    for (const agentType of agentTypes) {
      try {
        agentRegistry.validateAgentExists(agentType, platformId);
        // Agent exists - no error
      } catch (error) {
        missingAgents.push(agentType);

        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`Agent '${agentType}' not available: ${errorMessage}`);

        // Extract suggestion from error message if available
        // AgentRegistryService provides "Did you mean?" suggestions
        if (errorMessage.includes('Did you mean')) {
          const suggestionMatch = errorMessage.match(/Did you mean: (.+)\?/);
          if (suggestionMatch) {
            suggestions.push(`For '${agentType}': ${suggestionMatch[1]}`);
          }
        }
      }
    }

    return {
      valid: missingAgents.length === 0,
      missing_agents: missingAgents,
      suggestions,
      errors
    };
  }

  /**
   * Create initial workflow context
   */
  createInitialContext(workflowId: string, inputData?: Record<string, unknown>): WorkflowContext {
    return {
      workflow_id: workflowId,
      definition: this.getDefinition(),
      current_stage: this.definition.start_stage,
      stage_results: {},
      input_data: inputData || {},
      metadata: {
        started_at: Date.now()
      }
    };
  }

  /**
   * Add stage result to context
   */
  recordStageResult(context: WorkflowContext, result: StageResult): void {
    context.stage_results[result.stage_name] = {
      outcome: result.outcome,
      output: result.output,
      error: result.error,
      attempts: result.attempts,
      duration_ms: result.duration_ms,
      timestamp: result.timestamp
    };

    this.logger.log(
      `✅ [WorkflowEngine] Stage '${result.stage_name}' completed: ${result.outcome} (${result.duration_ms}ms)`
    );
  }

  /**
   * Build workflow result from final context
   */
  buildWorkflowResult(context: WorkflowContext, finalOutcome: 'success' | 'failure' | 'timeout'): WorkflowResult {
    const stageResults = Object.entries(context.stage_results).map(([stageName, result]) => ({
      stage_name: stageName,
      outcome: result.outcome,
      output: result.output,
      error: result.error,
      attempts: result.attempts,
      duration_ms: result.duration_ms,
      timestamp: result.timestamp
    }));

    const completedAt = Date.now();
    const startedAt = ((context.metadata?.started_at as number) || completedAt);

    return {
      workflow_id: context.workflow_id,
      status: finalOutcome === 'success' ? 'success' : finalOutcome === 'timeout' ? 'timeout' : 'failure',
      final_stage: context.current_stage,
      stage_results: stageResults,
      output_data: this.extractWorkflowOutput(context),
      total_duration_ms: completedAt - startedAt,
      started_at: startedAt,
      completed_at: completedAt
    };
  }

  /**
   * Extract final workflow output based on data flow configuration
   */
  private extractWorkflowOutput(context: WorkflowContext): Record<string, unknown> {
    const dataFlow = this.definition.data_flow;
    if (!dataFlow?.output_mapping) {
      return {};
    }

    const output: Record<string, unknown> = {};
    for (const [key, sourceKey] of Object.entries(dataFlow.output_mapping)) {
      const stageResults = context.stage_results;
      if (sourceKey.includes('.')) {
        const [stageName, fieldName] = sourceKey.split('.');
        const stageResult = stageResults[stageName];
        if (stageResult?.output && typeof stageResult.output === 'object') {
          output[key] = (stageResult.output as Record<string, unknown>)[fieldName];
        }
      }
    }

    return output;
  }
}

/**
 * Error thrown during workflow execution
 */
export class WorkflowEngineError extends Error {
  constructor(message: string, public readonly workflowName?: string) {
    super(message);
    this.name = 'WorkflowEngineError';
  }
}

/**
 * Workflow execution engine factory
 */
export function createWorkflowEngine(definition: WorkflowDefinition): WorkflowEngine {
  return new WorkflowEngine(definition);
}
