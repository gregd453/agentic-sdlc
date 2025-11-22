/**
 * Job Executor Service
 *
 * Handles job execution with:
 * - Timeout management
 * - Retry logic with exponential backoff
 * - Execution tracking (start, complete, fail)
 * - Error handling and logging
 *
 * Session #89: Phase 2 - Job Execution Engine
 */

import { PrismaClient, ExecutionStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';
import { IMessageBus } from '../hexagonal/ports/message-bus.port';
import { JobHandlerRegistry, JobExecutionContext } from './job-handler-registry.service';

// ==========================================
// EXECUTION TYPES
// ==========================================

export interface JobExecutionRequest {
  job_id: string;
  scheduled_at: Date;
  trace_id?: string;
  parent_span_id?: string;
  worker_id?: string;
}

export interface ExecutionResult {
  execution_id: string;
  status: ExecutionStatus;
  result?: any;
  error?: string;
  duration_ms: number;
}

export interface RetryConfig {
  max_retries: number;
  retry_delay_ms: number;
  backoff_multiplier?: number; // Default: 2 (exponential)
  max_retry_delay_ms?: number; // Cap for exponential backoff
}

// ==========================================
// JOB EXECUTOR SERVICE
// ==========================================

export class JobExecutorService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly messageBus: IMessageBus,
    private readonly handlerRegistry: JobHandlerRegistry
  ) {}

  // ==========================================
  // PUBLIC API
  // ==========================================

  /**
   * Execute a job with timeout and retry support
   */
  async executeJob(request: JobExecutionRequest): Promise<ExecutionResult> {
    const startTime = Date.now();
    const executionId = randomUUID();

    logger.info(
      {
        job_id: request.job_id,
        execution_id: executionId,
        trace_id: request.trace_id,
        worker_id: request.worker_id
      },
      'Starting job execution'
    );

    // 1. Load job details
    const job = await this.prisma.scheduledJob.findUnique({
      where: { id: request.job_id }
    });

    if (!job) {
      throw new Error(`Job not found: ${request.job_id}`);
    }

    // 2. Create execution record
    const execution = await this.createExecution({
      executionId,
      job,
      request
    });

    try {
      // 3. Resolve handler
      const handler = await this.handlerRegistry.resolveHandler(
        job.handler_name,
        job.handler_type
      );

      // 4. Execute with timeout
      const context: JobExecutionContext = {
        job_id: job.id,
        execution_id: executionId,
        trace_id: request.trace_id,
        span_id: randomUUID(),
        timeout_ms: job.timeout_ms,
        platform_id: job.platform_id || undefined
      };

      const result = await this.executeWithTimeout(
        handler,
        job.payload,
        context,
        job.timeout_ms
      );

      // 5. Mark as successful
      const duration = Date.now() - startTime;
      await this.markExecutionSuccess(executionId, result, duration);

      // 6. Update job statistics
      await this.updateJobStats(job.id, true, duration);

      // 7. Publish success event
      await this.publishExecutionEvent('job.execution.success', {
        job_id: job.id,
        execution_id: executionId,
        result,
        duration_ms: duration,
        trace_id: request.trace_id
      });

      logger.info(
        {
          job_id: job.id,
          execution_id: executionId,
          duration_ms: duration,
          trace_id: request.trace_id
        },
        'Job execution completed successfully'
      );

      return {
        execution_id: executionId,
        status: 'success',
        result,
        duration_ms: duration
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      logger.error(
        {
          job_id: job.id,
          execution_id: executionId,
          error: error.message,
          stack: error.stack,
          duration_ms: duration
        },
        'Job execution failed'
      );

      // Determine if we should retry
      const shouldRetry = await this.shouldRetryExecution(execution.id, job);

      if (shouldRetry) {
        // Schedule retry
        const retryDelay = this.calculateRetryDelay(
          execution.retry_count + 1,
          {
            max_retries: job.max_retries,
            retry_delay_ms: job.retry_delay_ms,
            backoff_multiplier: 2,
            max_retry_delay_ms: 3600000 // 1 hour max
          }
        );

        await this.scheduleRetry(executionId, retryDelay, error);

        logger.info(
          {
            job_id: job.id,
            execution_id: executionId,
            retry_count: execution.retry_count + 1,
            retry_delay_ms: retryDelay
          },
          'Scheduling job retry'
        );

        return {
          execution_id: executionId,
          status: 'failed',
          error: error.message,
          duration_ms: duration
        };
      } else {
        // Mark as permanently failed
        await this.markExecutionFailed(executionId, error, duration);
        await this.updateJobStats(job.id, false, duration);

        // Publish failure event
        await this.publishExecutionEvent('job.execution.failed', {
          job_id: job.id,
          execution_id: executionId,
          error: error.message,
          duration_ms: duration,
          trace_id: request.trace_id
        });

        return {
          execution_id: executionId,
          status: 'failed',
          error: error.message,
          duration_ms: duration
        };
      }
    }
  }

  /**
   * Retry a failed execution
   */
  async retryExecution(executionId: string): Promise<ExecutionResult> {
    const execution = await this.prisma.jobExecution.findUnique({
      where: { id: executionId },
      include: { job: true }
    });

    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    if (execution.status !== 'failed') {
      throw new Error(`Execution is not in failed state: ${execution.status}`);
    }

    logger.info(
      {
        execution_id: executionId,
        job_id: execution.job_id,
        retry_count: execution.retry_count
      },
      'Manually retrying failed execution'
    );

    // Execute with incremented retry count
    return this.executeJob({
      job_id: execution.job_id,
      scheduled_at: new Date(),
      trace_id: execution.trace_id || undefined,
      parent_span_id: execution.span_id || undefined
    });
  }

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  /**
   * Execute handler with timeout
   */
  private async executeWithTimeout<T>(
    handler: (payload: any, context: JobExecutionContext) => Promise<T>,
    payload: any,
    context: JobExecutionContext,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      handler(payload, context),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Job execution timeout after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }

  /**
   * Create execution record in database
   */
  private async createExecution(options: {
    executionId: string;
    job: any;
    request: JobExecutionRequest;
  }) {
    return this.prisma.jobExecution.create({
      data: {
        id: options.executionId,
        job_id: options.job.id,
        status: 'running',
        scheduled_at: options.request.scheduled_at,
        started_at: new Date(),
        retry_count: 0,
        max_retries: options.job.max_retries,
        worker_id: options.request.worker_id,
        trace_id: options.request.trace_id,
        span_id: randomUUID(),
        parent_span_id: options.request.parent_span_id
      }
    });
  }

  /**
   * Mark execution as successful
   */
  private async markExecutionSuccess(
    executionId: string,
    result: any,
    durationMs: number
  ): Promise<void> {
    await this.prisma.jobExecution.update({
      where: { id: executionId },
      data: {
        status: 'success',
        completed_at: new Date(),
        duration_ms: durationMs,
        result: result || {}
      }
    });
  }

  /**
   * Mark execution as failed
   */
  private async markExecutionFailed(
    executionId: string,
    error: Error,
    durationMs: number
  ): Promise<void> {
    await this.prisma.jobExecution.update({
      where: { id: executionId },
      data: {
        status: 'failed',
        completed_at: new Date(),
        duration_ms: durationMs,
        error: error.message,
        error_stack: error.stack
      }
    });
  }

  /**
   * Determine if execution should be retried
   */
  private async shouldRetryExecution(executionId: string, job: any): Promise<boolean> {
    const execution = await this.prisma.jobExecution.findUnique({
      where: { id: executionId }
    });

    if (!execution) return false;

    return execution.retry_count < job.max_retries;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number, config: RetryConfig): number {
    const multiplier = config.backoff_multiplier || 2;
    const delay = config.retry_delay_ms * Math.pow(multiplier, retryCount - 1);

    // Cap at max retry delay if specified
    if (config.max_retry_delay_ms) {
      return Math.min(delay, config.max_retry_delay_ms);
    }

    return delay;
  }

  /**
   * Schedule execution retry
   */
  private async scheduleRetry(
    executionId: string,
    retryDelayMs: number,
    error: Error
  ): Promise<void> {
    const nextRetryAt = new Date(Date.now() + retryDelayMs);

    await this.prisma.jobExecution.update({
      where: { id: executionId },
      data: {
        status: 'failed',
        retry_count: { increment: 1 },
        next_retry_at: nextRetryAt,
        error: error.message,
        error_stack: error.stack
      }
    });

    // Publish retry scheduled event
    await this.publishExecutionEvent('job.execution.retry_scheduled', {
      execution_id: executionId,
      retry_at: nextRetryAt,
      retry_delay_ms: retryDelayMs
    });
  }

  /**
   * Update job statistics
   */
  private async updateJobStats(
    jobId: string,
    success: boolean,
    durationMs: number
  ): Promise<void> {
    const job = await this.prisma.scheduledJob.findUnique({
      where: { id: jobId }
    });

    if (!job) return;

    const totalExecutions = job.executions_count + 1;
    const currentAvg = job.avg_duration_ms || 0;
    const newAvg = Math.round(
      (currentAvg * job.executions_count + durationMs) / totalExecutions
    );

    await this.prisma.scheduledJob.update({
      where: { id: jobId },
      data: {
        executions_count: { increment: 1 },
        success_count: success ? { increment: 1 } : undefined,
        failure_count: !success ? { increment: 1 } : undefined,
        avg_duration_ms: newAvg,
        last_run: new Date()
      }
    });
  }

  /**
   * Publish execution event to message bus
   */
  private async publishExecutionEvent(eventName: string, data: any): Promise<void> {
    try {
      await this.messageBus.publish(`scheduler:${eventName}`, data);
    } catch (error: any) {
      logger.error(
        { event: eventName, error: error.message },
        'Failed to publish execution event'
      );
      // Don't throw - event publishing failure shouldn't fail the execution
    }
  }

  /**
   * Add execution log entry
   */
  async addExecutionLog(
    executionId: string,
    level: string,
    message: string,
    context?: any
  ): Promise<void> {
    try {
      await this.prisma.jobExecutionLog.create({
        data: {
          id: randomUUID(),
          execution_id: executionId,
          level,
          message,
          context: context || {}
        }
      });
    } catch (error: any) {
      logger.error(
        { execution_id: executionId, error: error.message },
        'Failed to add execution log'
      );
    }
  }

  /**
   * Get execution logs
   */
  async getExecutionLogs(executionId: string): Promise<any[]> {
    return this.prisma.jobExecutionLog.findMany({
      where: { execution_id: executionId },
      orderBy: { timestamp: 'asc' }
    });
  }
}
