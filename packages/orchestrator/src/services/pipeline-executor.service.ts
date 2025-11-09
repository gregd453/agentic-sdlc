import { randomUUID } from 'crypto';
import {
  PipelineDefinition,
  PipelineExecution,
  PipelineStage,
  StageExecutionResult,
  PipelineStatus,
  PipelineDefinitionSchema
} from '../types/pipeline.types';
import { EventBus } from '../events/event-bus';
import { AgentDispatcherService } from './agent-dispatcher.service';
import { QualityGateService } from './quality-gate.service';
import { logger, generateTraceId } from '../utils/logger';
import { metrics } from '../utils/metrics';

/**
 * Pipeline execution error
 */
export class PipelineExecutionError extends Error {
  constructor(
    message: string,
    public readonly stage_id?: string,
    public readonly recoverable: boolean = false
  ) {
    super(message);
    this.name = 'PipelineExecutionError';
  }
}

/**
 * Pipeline executor service
 * Orchestrates stage execution with DAG-based dependency resolution
 */
export class PipelineExecutorService {
  private activeExecutions: Map<string, PipelineExecution> = new Map();
  private executionPromises: Map<string, Promise<PipelineExecution>> = new Map();

  constructor(
    private eventBus: EventBus,
    private agentDispatcher: AgentDispatcherService,
    private qualityGateService: QualityGateService
  ) {}

  /**
   * Start pipeline execution
   */
  async startPipeline(
    definition: PipelineDefinition,
    trigger: 'manual' | 'webhook' | 'schedule' | 'event',
    triggeredBy: string,
    options?: {
      commitSha?: string;
      branch?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<PipelineExecution> {
    const traceId = generateTraceId();
    const startTime = Date.now();

    // Validate pipeline definition
    const validatedDefinition = PipelineDefinitionSchema.parse(definition);

    // Create execution record
    const execution: PipelineExecution = {
      id: randomUUID(),
      pipeline_id: validatedDefinition.id,
      workflow_id: validatedDefinition.workflow_id,
      status: 'queued',
      started_at: new Date().toISOString(),
      stage_results: [],
      artifacts: [],
      trigger,
      triggered_by: triggeredBy,
      commit_sha: options?.commitSha,
      branch: options?.branch,
      metadata: options?.metadata
    };

    logger.info('Starting pipeline execution', {
      execution_id: execution.id,
      pipeline_id: execution.pipeline_id,
      workflow_id: execution.workflow_id,
      trace_id: traceId
    });

    // Publish execution started event
    await this.publishUpdate(execution, 'execution_started');

    // Store active execution
    this.activeExecutions.set(execution.id, execution);

    // Start execution asynchronously
    const executionPromise = this.executePipeline(validatedDefinition, execution, traceId)
      .then((result) => {
        metrics.recordDuration('pipeline.execution.duration', Date.now() - startTime, {
          status: result.status,
          pipeline_id: result.pipeline_id
        });
        return result;
      })
      .catch(async (error) => {
        logger.error('Pipeline execution failed', {
          execution_id: execution.id,
          error: error.message,
          trace_id: traceId
        });

        const failedExecution = {
          ...execution,
          status: 'failed' as PipelineStatus,
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime
        };

        await this.publishUpdate(failedExecution, 'execution_failed', {
          error: error.message
        });

        this.activeExecutions.delete(execution.id);
        return failedExecution;
      });

    this.executionPromises.set(execution.id, executionPromise);

    return execution;
  }

  /**
   * Execute pipeline stages
   */
  private async executePipeline(
    definition: PipelineDefinition,
    execution: PipelineExecution,
    traceId: string
  ): Promise<PipelineExecution> {
    const startTime = Date.now();

    try {
      // Update status to running
      execution.status = 'running';
      this.activeExecutions.set(execution.id, execution);

      // Build dependency graph
      const _graph = this.buildDependencyGraph(definition.stages);

      // Execute stages based on execution mode
      if (definition.execution_mode === 'parallel') {
        await this.executeStagesParallel(definition, execution, _graph, traceId);
      } else {
        await this.executeStagesSequential(definition, execution, _graph, traceId);
      }

      // Mark execution as complete
      execution.status = 'success';
      execution.completed_at = new Date().toISOString();
      execution.duration_ms = Date.now() - startTime;

      logger.info('Pipeline execution completed successfully', {
        execution_id: execution.id,
        duration_ms: execution.duration_ms,
        trace_id: traceId
      });

      await this.publishUpdate(execution, 'execution_completed');

      return execution;
    } catch (error) {
      throw new PipelineExecutionError(
        `Pipeline execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        error instanceof PipelineExecutionError ? error.recoverable : false
      );
    } finally {
      this.activeExecutions.delete(execution.id);
      this.executionPromises.delete(execution.id);
    }
  }

  /**
   * Execute stages sequentially
   */
  private async executeStagesSequential(
    definition: PipelineDefinition,
    execution: PipelineExecution,
    _graph: Map<string, Set<string>>,
    traceId: string
  ): Promise<void> {
    const executedStages = new Set<string>();

    for (const stage of definition.stages) {
      // Check if dependencies are satisfied
      const canExecute = this.canExecuteStage(stage, executedStages);

      if (!canExecute) {
        logger.warn('Stage dependencies not satisfied, skipping', {
          stage_id: stage.id,
          execution_id: execution.id,
          trace_id: traceId
        });

        const skippedResult: StageExecutionResult = {
          stage_id: stage.id,
          status: 'skipped',
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          duration_ms: 0,
          artifacts: [],
          quality_gate_results: []
        };

        execution.stage_results.push(skippedResult);
        continue;
      }

      // Execute stage
      const result = await this.executeStage(stage, execution, traceId);
      execution.stage_results.push(result);

      // Check if stage failed and should stop execution
      if (result.status === 'failed' && !stage.continue_on_failure) {
        throw new PipelineExecutionError(
          `Stage ${stage.id} failed`,
          stage.id,
          result.error?.recoverable ?? false
        );
      }

      if (result.status === 'success') {
        executedStages.add(stage.id);
      }
    }
  }

  /**
   * Execute stages in parallel (respecting dependencies)
   */
  private async executeStagesParallel(
    definition: PipelineDefinition,
    execution: PipelineExecution,
    _graph: Map<string, Set<string>>,
    traceId: string
  ): Promise<void> {
    const executedStages = new Set<string>();
    const inProgress = new Map<string, Promise<StageExecutionResult>>();
    const stageMap = new Map(definition.stages.map(s => [s.id, s]));

    // Get stages with no dependencies to start
    const readyStages = definition.stages.filter(s =>
      s.dependencies.length === 0 ||
      this.canExecuteStage(s, executedStages)
    );

    // Queue initial stages
    for (const stage of readyStages) {
      const promise = this.executeStage(stage, execution, traceId);
      inProgress.set(stage.id, promise);
    }

    // Process stages as they complete
    while (inProgress.size > 0) {
      const completed = await Promise.race(
        Array.from(inProgress.entries()).map(async ([stageId, promise]) => {
          const result = await promise;
          return { stageId, result };
        })
      );

      const { stageId, result } = completed;

      // Remove from in-progress
      inProgress.delete(stageId);

      // Add result to execution
      execution.stage_results.push(result);

      // Check if failed
      const stage = stageMap.get(stageId)!;
      if (result.status === 'failed' && !stage.continue_on_failure) {
        // Cancel all in-progress stages
        await this.cancelInProgressStages(inProgress);

        throw new PipelineExecutionError(
          `Stage ${stageId} failed`,
          stageId,
          result.error?.recoverable ?? false
        );
      }

      if (result.status === 'success') {
        executedStages.add(stageId);
      }

      // Find newly ready stages
      const newlyReady = definition.stages.filter(s =>
        !executedStages.has(s.id) &&
        !inProgress.has(s.id) &&
        this.canExecuteStage(s, executedStages)
      );

      // Queue newly ready stages
      for (const newStage of newlyReady) {
        const promise = this.executeStage(newStage, execution, traceId);
        inProgress.set(newStage.id, promise);
      }
    }
  }

  /**
   * Execute a single stage
   */
  private async executeStage(
    stage: PipelineStage,
    execution: PipelineExecution,
    traceId: string
  ): Promise<StageExecutionResult> {
    const startTime = Date.now();

    logger.info('Starting stage execution', {
      stage_id: stage.id,
      stage_name: stage.name,
      execution_id: execution.id,
      trace_id: traceId
    });

    const result: StageExecutionResult = {
      stage_id: stage.id,
      status: 'running',
      started_at: new Date().toISOString(),
      artifacts: [],
      quality_gate_results: []
    };

    // Update current stage
    execution.current_stage = stage.id;
    await this.publishUpdate(execution, 'stage_started', { stage_id: stage.id });

    try {
      // Dispatch task to agent
      const taskId = randomUUID();
      // TODO: Fix AgentDispatcherService.dispatchTask to return agent result
      // Currently returns void, but pipeline expects a result object
      const agentResult = await this.agentDispatcher.dispatchTask({
        message_id: randomUUID(),
        task_id: taskId,
        workflow_id: execution.workflow_id,
        agent_type: stage.agent_type,
        priority: 'high',
        payload: {
          action: stage.action,
          parameters: stage.parameters,
          context: {
            execution_id: execution.id,
            pipeline_id: execution.pipeline_id,
            stage_id: stage.id
          }
        },
        constraints: {
          timeout_ms: stage.timeout_ms,
          max_retries: stage.retry_policy?.max_attempts ?? 3,
          required_confidence: 80
        },
        metadata: {
          created_at: new Date().toISOString(),
          created_by: 'pipeline-executor',
          trace_id: traceId
        }
      }) as any;

      result.task_id = taskId;
      result.agent_id = agentResult?.agent_id;

      // Check agent execution status
      if (agentResult?.status !== 'success') {
        result.status = 'failed';
        result.error = {
          code: 'AGENT_EXECUTION_FAILED',
          message: agentResult?.errors?.[0]?.message ?? 'Agent execution failed',
          recoverable: agentResult?.errors?.[0]?.recoverable ?? false
        };
      } else {
        // Collect artifacts
        result.artifacts = agentResult?.result?.artifacts ?? [];
        result.metrics = agentResult?.result?.metrics?.resource_usage;

        // Evaluate quality gates
        const gateResults = await this.evaluateQualityGates(
          stage,
          agentResult?.result?.data ?? {},
          traceId
        );
        result.quality_gate_results = gateResults;

        // Check if any blocking gate failed
        const blockingGateFailed = gateResults.some(g => !g.passed && g.blocking);

        if (blockingGateFailed) {
          result.status = 'failed';
          result.error = {
            code: 'QUALITY_GATE_FAILED',
            message: 'One or more blocking quality gates failed',
            details: { failed_gates: gateResults.filter(g => !g.passed && g.blocking) },
            recoverable: false
          };
        } else {
          result.status = 'success';
        }
      }

      result.completed_at = new Date().toISOString();
      result.duration_ms = Date.now() - startTime;

      logger.info('Stage execution completed', {
        stage_id: stage.id,
        status: result.status,
        duration_ms: result.duration_ms,
        trace_id: traceId
      });

      await this.publishUpdate(
        execution,
        result.status === 'success' ? 'stage_completed' : 'stage_failed',
        { stage_id: stage.id, result }
      );

      metrics.recordDuration('pipeline.stage.duration', result.duration_ms, {
        stage_id: stage.id,
        status: result.status
      });

      return result;

    } catch (error) {
      result.status = 'failed';
      result.completed_at = new Date().toISOString();
      result.duration_ms = Date.now() - startTime;
      result.error = {
        code: 'STAGE_EXECUTION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        recoverable: error instanceof PipelineExecutionError ? error.recoverable : false
      };

      logger.error('Stage execution failed', {
        stage_id: stage.id,
        error: result.error.message,
        trace_id: traceId
      });

      await this.publishUpdate(execution, 'stage_failed', {
        stage_id: stage.id,
        error: result.error
      });

      return result;
    }
  }

  /**
   * Evaluate quality gates for a stage
   */
  private async evaluateQualityGates(
    stage: PipelineStage,
    stageData: Record<string, unknown>,
    traceId: string
  ): Promise<Array<{
    gate_name: string;
    passed: boolean;
    actual_value: number | string;
    threshold: number | string;
    blocking: boolean;
    message?: string;
  }>> {
    const results = [];

    for (const gate of stage.quality_gates) {
      const passed = await this.qualityGateService.evaluate(gate, stageData);

      results.push({
        gate_name: gate.name,
        passed,
        actual_value: stageData[gate.metric] as number | string,
        threshold: gate.threshold,
        blocking: gate.blocking,
        message: passed ? undefined : `${gate.metric} ${gate.operator} ${gate.threshold} failed`
      });

      logger.debug('Quality gate evaluated', {
        gate_name: gate.name,
        passed,
        metric: gate.metric,
        trace_id: traceId
      });
    }

    return results;
  }

  /**
   * Build dependency graph from stages
   */
  private buildDependencyGraph(stages: PipelineStage[]): Map<string, Set<string>> {
    const graph = new Map<string, Set<string>>();

    for (const stage of stages) {
      if (!graph.has(stage.id)) {
        graph.set(stage.id, new Set());
      }

      for (const dep of stage.dependencies) {
        const deps = graph.get(stage.id)!;
        deps.add(dep.stage_id);
      }
    }

    return graph;
  }

  /**
   * Check if a stage can be executed
   */
  private canExecuteStage(stage: PipelineStage, executedStages: Set<string>): boolean {
    if (stage.dependencies.length === 0) {
      return true;
    }

    return stage.dependencies.every(dep => {
      if (!dep.required) {
        return true;
      }

      return executedStages.has(dep.stage_id);
    });
  }

  /**
   * Cancel in-progress stages
   */
  private async cancelInProgressStages(
    inProgress: Map<string, Promise<StageExecutionResult>>
  ): Promise<void> {
    logger.warn('Cancelling in-progress stages', {
      count: inProgress.size
    });

    // Note: In a real implementation, we would need to send cancel signals to agents
    // For now, we just wait for them to complete naturally
    await Promise.allSettled(Array.from(inProgress.values()));
  }

  /**
   * Get pipeline execution status
   */
  async getExecution(executionId: string): Promise<PipelineExecution | null> {
    return this.activeExecutions.get(executionId) ?? null;
  }

  /**
   * Pause pipeline execution
   */
  async pauseExecution(executionId: string): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    execution.status = 'paused';
    logger.info('Pipeline execution paused', { execution_id: executionId });
  }

  /**
   * Resume pipeline execution
   */
  async resumeExecution(executionId: string): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    execution.status = 'running';
    logger.info('Pipeline execution resumed', { execution_id: executionId });
  }

  /**
   * Cancel pipeline execution
   */
  async cancelExecution(executionId: string): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    execution.status = 'cancelled';
    execution.completed_at = new Date().toISOString();

    await this.publishUpdate(execution, 'execution_failed', {
      reason: 'cancelled'
    });

    this.activeExecutions.delete(executionId);

    logger.info('Pipeline execution cancelled', { execution_id: executionId });
  }

  /**
   * Publish real-time update via event bus
   */
  private async publishUpdate(
    execution: PipelineExecution,
    type: 'execution_started' | 'stage_started' | 'stage_completed' | 'stage_failed' | 'execution_completed' | 'execution_failed',
    data?: Record<string, unknown>
  ): Promise<void> {
    await this.eventBus.publish({
      id: randomUUID(),
      type: 'pipeline:updates',
      workflow_id: execution.workflow_id,
      payload: {
        event_type: type,
        execution_id: execution.id,
        pipeline_id: execution.pipeline_id,
        stage_id: execution.current_stage,
        status: execution.status,
        ...data
      },
      timestamp: new Date().toISOString(),
      trace_id: generateTraceId()
    });
  }

  /**
   * Get all active pipeline executions
   */
  async getActivePipelines(): Promise<PipelineExecution[]> {
    const activePipelines = Array.from(this.activeExecutions.values()).filter(
      execution => execution.status === 'running' || execution.status === 'queued'
    );

    return activePipelines;
  }

  /**
   * Save pipeline state for graceful shutdown
   */
  async savePipelineState(pipelineId: string): Promise<void> {
    const execution = this.activeExecutions.get(pipelineId);
    if (!execution) {
      logger.warn('Pipeline not found for state save', { pipeline_id: pipelineId });
      return;
    }

    // Publish pipeline state event for persistence
    await this.publishUpdate(execution, 'execution_failed', {
      reason: 'shutdown',
      state: {
        current_stage: execution.current_stage,
        stage_results: execution.stage_results,
        artifacts: execution.artifacts,
        metadata: {
          ...execution.metadata,
          shutdown_at: new Date().toISOString(),
          can_resume: true
        }
      }
    });

    logger.info('Pipeline state saved for shutdown', {
      pipeline_id: pipelineId,
      current_stage: execution.current_stage
    });
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    logger.info('Cleaning up PipelineExecutorService');

    // Wait for all active executions to complete
    await Promise.allSettled(Array.from(this.executionPromises.values()));

    this.activeExecutions.clear();
    this.executionPromises.clear();
  }
}
