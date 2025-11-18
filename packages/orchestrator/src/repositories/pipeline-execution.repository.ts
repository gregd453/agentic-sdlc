import { PrismaClient, PipelineExecution, WorkflowStatus } from '@prisma/client';
import { NotFoundError, ConcurrencyConflictError } from '../utils/errors';
import { logger, getRequestContext } from '../utils/logger';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 100;

export interface CreatePipelineExecutionInput {
  pipeline_id: string;
  workflow_id: string;
  current_stage: number;
}

export interface UpdatePipelineExecutionInput {
  status?: WorkflowStatus;
  current_stage?: number;
  paused_at?: Date | null;
  resumed_at?: Date | null;
  completed_at?: Date | null;
  failed_at?: Date | null;
  error_message?: string | null;
}

/**
 * Session #79: Pipeline Execution Repository
 * Manages database persistence for pipeline execution state with optimistic locking (CAS pattern)
 */
export class PipelineExecutionRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Session #79: CAS (Compare-And-Swap) Pattern with Retry
   * Implements optimistic locking to prevent lost updates in concurrent scenarios
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = MAX_RETRIES,
    baseDelayMs: number = RETRY_DELAY_MS
  ): Promise<T> {
    const requestCtx = getRequestContext();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        // Check if this is a CAS conflict (P2025 = record not found due to version mismatch)
        const isCASConflict = error.code === 'P2025';

        if (!isCASConflict) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          logger.error('[SESSION #79 CAS] Max retries exceeded for CAS conflict', {
            attempts: attempt + 1,
            error_code: error.code,
            trace_id: requestCtx?.traceId
          });
          throw new ConcurrencyConflictError(
            'Failed to update after maximum retries due to concurrent modifications',
            'unknown-execution',
            0
          );
        }

        // Exponential backoff
        const delayMs = baseDelayMs * Math.pow(2, attempt);
        logger.info('[SESSION #79 CAS] Retrying after CAS conflict', {
          attempt: attempt + 1,
          max_retries: maxRetries,
          delay_ms: delayMs,
          trace_id: requestCtx?.traceId
        });

        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    throw lastError!;
  }

  /**
   * Create a new pipeline execution
   */
  async create(input: CreatePipelineExecutionInput): Promise<PipelineExecution> {
    const requestCtx = getRequestContext();

    logger.info('[SESSION #79] Creating pipeline execution', {
      pipeline_id: input.pipeline_id,
      workflow_id: input.workflow_id,
      current_stage: input.current_stage,
      trace_id: requestCtx?.traceId
    });

    try {
      const execution = await this.prisma.pipelineExecution.create({
        data: {
          pipeline_id: input.pipeline_id,
          workflow_id: input.workflow_id,
          current_stage: input.current_stage,
          status: WORKFLOW_STATUS.INITIATED,
          started_at: new Date()
        }
      });

      logger.info('[SESSION #79] Pipeline execution created successfully', {
        execution_id: execution.id,
        workflow_id: execution.workflow_id,
        trace_id: requestCtx?.traceId
      });

      return execution;
    } catch (error: any) {
      logger.error('[SESSION #79] Failed to create pipeline execution', {
        workflow_id: input.workflow_id,
        error: error.message,
        trace_id: requestCtx?.traceId
      });
      throw error;
    }
  }

  /**
   * Get pipeline execution by ID
   */
  async getById(id: string): Promise<PipelineExecution | null> {
    const requestCtx = getRequestContext();

    try {
      const execution = await this.prisma.pipelineExecution.findUnique({
        where: { id }
      });

      if (!execution) {
        logger.warn('[SESSION #79] Pipeline execution not found', {
          execution_id: id,
          trace_id: requestCtx?.traceId
        });
        return null;
      }

      return execution;
    } catch (error: any) {
      logger.error('[SESSION #79] Error fetching pipeline execution', {
        execution_id: id,
        error: error.message,
        trace_id: requestCtx?.traceId
      });
      throw error;
    }
  }

  /**
   * Get all executions for a workflow
   */
  async getByWorkflowId(workflow_id: string): Promise<PipelineExecution[]> {
    const requestCtx = getRequestContext();

    try {
      const executions = await this.prisma.pipelineExecution.findMany({
        where: { workflow_id },
        orderBy: { created_at: 'desc' }
      });

      logger.info('[SESSION #79] Retrieved pipeline executions for workflow', {
        workflow_id,
        count: executions.length,
        trace_id: requestCtx?.traceId
      });

      return executions;
    } catch (error: any) {
      logger.error('[SESSION #79] Error fetching executions for workflow', {
        workflow_id,
        error: error.message,
        trace_id: requestCtx?.traceId
      });
      throw error;
    }
  }

  /**
   * Find all executions with a specific status
   */
  async findByStatus(status: WorkflowStatus): Promise<PipelineExecution[]> {
    const requestCtx = getRequestContext();

    try {
      const executions = await this.prisma.pipelineExecution.findMany({
        where: { status },
        orderBy: { created_at: 'desc' }
      });

      logger.info('[SESSION #79] Retrieved pipeline executions by status', {
        status,
        count: executions.length,
        trace_id: requestCtx?.traceId
      });

      return executions;
    } catch (error: any) {
      logger.error('[SESSION #79] Error fetching executions by status', {
        status,
        error: error.message,
        trace_id: requestCtx?.traceId
      });
      throw error;
    }
  }

  /**
   * Session #79: Update with CAS (Compare-And-Swap) Pattern
   * Only updates if version matches, ensuring no lost updates
   */
  async updateWithCAS(
    id: string,
    updates: UpdatePipelineExecutionInput,
    expectedVersion: number
  ): Promise<PipelineExecution> {
    const requestCtx = getRequestContext();

    return this.withRetry(async () => {
      logger.debug('[SESSION #79 CAS] Attempting CAS update', {
        execution_id: id,
        expected_version: expectedVersion,
        trace_id: requestCtx?.traceId
      });

      const result = await this.prisma.pipelineExecution.update({
        where: {
          id,
          // CAS condition: only update if version matches
          version: expectedVersion
        },
        data: {
          ...updates,
          version: expectedVersion + 1, // Increment version
          updated_at: new Date()
        }
      });

      logger.info('[SESSION #79 CAS] CAS update successful', {
        execution_id: id,
        new_version: expectedVersion + 1,
        trace_id: requestCtx?.traceId
      });

      return result;
    });
  }

  /**
   * Update execution status (simple wrapper around updateWithCAS)
   */
  async updateStatus(
    id: string,
    status: WorkflowStatus
  ): Promise<PipelineExecution> {
    const requestCtx = getRequestContext();

    logger.info('[SESSION #79] Updating execution status', {
      execution_id: id,
      new_status: status,
      trace_id: requestCtx?.traceId
    });

    try {
      const current = await this.getById(id);
      if (!current) {
        throw new NotFoundError(`PipelineExecution with id ${id} not found`);
      }

      // Add appropriate timestamp based on status
      const updates: UpdatePipelineExecutionInput = { status };

      if (status === 'paused' && !current.paused_at) {
        updates.paused_at = new Date();
      } else if (status === WORKFLOW_STATUS.RUNNING && current.paused_at && !current.resumed_at) {
        updates.resumed_at = new Date();
      } else if (status === WORKFLOW_STATUS.COMPLETED && !current.completed_at) {
        updates.completed_at = new Date();
      } else if (status === WORKFLOW_STATUS.FAILED && !current.failed_at) {
        updates.failed_at = new Date();
      }

      const updated = await this.updateWithCAS(id, updates, current.version);

      logger.info('[SESSION #79] Execution status updated successfully', {
        execution_id: id,
        new_status: status,
        trace_id: requestCtx?.traceId
      });

      return updated;
    } catch (error: any) {
      logger.error('[SESSION #79] Failed to update execution status', {
        execution_id: id,
        new_status: status,
        error: error.message,
        trace_id: requestCtx?.traceId
      });
      throw error;
    }
  }

  /**
   * Update execution with error information
   */
  async recordError(
    id: string,
    error_message: string
  ): Promise<PipelineExecution> {
    const requestCtx = getRequestContext();

    logger.error('[SESSION #79] Recording error for execution', {
      execution_id: id,
      error_message,
      trace_id: requestCtx?.traceId
    });

    try {
      const current = await this.getById(id);
      if (!current) {
        throw new NotFoundError(`PipelineExecution with id ${id} not found`);
      }

      const updated = await this.updateWithCAS(
        id,
        {
          status: WORKFLOW_STATUS.FAILED,
          error_message,
          failed_at: new Date()
        },
        current.version
      );

      logger.info('[SESSION #79] Error recorded for execution', {
        execution_id: id,
        trace_id: requestCtx?.traceId
      });

      return updated;
    } catch (error: any) {
      logger.error('[SESSION #79] Failed to record error for execution', {
        execution_id: id,
        error: error.message,
        trace_id: requestCtx?.traceId
      });
      throw error;
    }
  }

  /**
   * Delete execution (cleanup)
   */
  async delete(id: string): Promise<void> {
    const requestCtx = getRequestContext();

    logger.info('[SESSION #79] Deleting pipeline execution', {
      execution_id: id,
      trace_id: requestCtx?.traceId
    });

    try {
      await this.prisma.pipelineExecution.delete({
        where: { id }
      });

      logger.info('[SESSION #79] Pipeline execution deleted', {
        execution_id: id,
        trace_id: requestCtx?.traceId
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundError(`PipelineExecution with id ${id} not found`);
      }
      logger.error('[SESSION #79] Failed to delete execution', {
        execution_id: id,
        error: error.message,
        trace_id: requestCtx?.traceId
      });
      throw error;
    }
  }
}
