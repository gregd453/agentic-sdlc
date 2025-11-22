/**
 * Scheduler Logger Utility
 *
 * Structured logging for scheduler services with consistent context
 * Session #91: Created for standardized logging across all scheduler components
 */

import { createLogger } from '../hexagonal/core/logger';

export interface SchedulerLogContext {
  service?: string;
  job_id?: string;
  execution_id?: string;
  handler_id?: string;
  event_name?: string;
  trace_id?: string;
  worker_id?: string;
  duration_ms?: number;
  attempt?: number;
  max_retries?: number;
  error?: string;
  [key: string]: any;
}

/**
 * Structured logger for scheduler services
 */
export class SchedulerLogger {
  private readonly logger: ReturnType<typeof createLogger>;

  constructor(private readonly serviceName: string) {
    this.logger = createLogger(serviceName);
  }

  /**
   * Build log context with service name and timestamp
   */
  private buildContext(context: SchedulerLogContext): Record<string, any> {
    return {
      service: this.serviceName,
      ...context,
      timestamp: new Date().toISOString()
    };
  }

  // ===== Job Lifecycle Logging =====

  /**
   * Log job creation
   */
  jobCreated(jobId: string, jobType: string, schedule?: string): void {
    this.logger.info(`Job created: ${jobType}${schedule ? ` (${schedule})` : ''}`, this.buildContext({
      job_id: jobId,
      job_type: jobType,
      schedule
    }));
  }

  /**
   * Log job dispatch
   */
  jobDispatched(jobId: string, executionId: string, traceId?: string): void {
    this.logger.info('Job dispatched for execution', this.buildContext({
      job_id: jobId,
      execution_id: executionId,
      trace_id: traceId
    }));
  }

  /**
   * Log job execution start
   */
  jobExecutionStarted(jobId: string, executionId: string, handlerName: string): void {
    this.logger.info(`Job execution started: ${handlerName}`, this.buildContext({
      job_id: jobId,
      execution_id: executionId,
      handler_name: handlerName
    }));
  }

  /**
   * Log job execution completion
   */
  jobCompleted(jobId: string, executionId: string, durationMs: number): void {
    this.logger.info(`Job execution completed in ${durationMs}ms`, this.buildContext({
      job_id: jobId,
      execution_id: executionId,
      duration_ms: durationMs
    }));
  }

  /**
   * Log job execution failure
   */
  jobFailed(jobId: string, executionId: string, error: Error | string): void {
    const errorMessage = error instanceof Error ? error.message : error;
    this.logger.error(`Job execution failed: ${errorMessage}`, this.buildContext({
      job_id: jobId,
      execution_id: executionId,
      error: errorMessage
    }));
  }

  /**
   * Log job retry scheduled
   */
  jobRetryScheduled(
    jobId: string,
    executionId: string,
    attempt: number,
    maxRetries: number,
    retryDelayMs: number
  ): void {
    this.logger.warn(`Job retry scheduled (attempt ${attempt}/${maxRetries}) after ${retryDelayMs}ms`, this.buildContext({
      job_id: jobId,
      execution_id: executionId,
      attempt,
      max_retries: maxRetries,
      retry_delay_ms: retryDelayMs
    }));
  }

  /**
   * Log job timeout
   */
  jobTimeout(jobId: string, executionId: string, timeoutMs: number): void {
    this.logger.error(`Job execution timed out after ${timeoutMs}ms`, this.buildContext({
      job_id: jobId,
      execution_id: executionId,
      timeout_ms: timeoutMs
    }));
  }

  /**
   * Log job cancellation
   */
  jobCancelled(jobId: string, executionId: string, reason?: string): void {
    this.logger.warn(`Job execution cancelled${reason ? `: ${reason}` : ''}`, this.buildContext({
      job_id: jobId,
      execution_id: executionId,
      reason
    }));
  }

  // ===== Event Handler Logging =====

  /**
   * Log event handler triggered
   */
  eventHandlerTriggered(handlerId: string, eventName: string): void {
    this.logger.info(`Event handler triggered: ${eventName}`, this.buildContext({
      handler_id: handlerId,
      event_name: eventName
    }));
  }

  /**
   * Log event handler execution result
   */
  eventHandlerCompleted(handlerId: string, eventName: string, success: boolean): void {
    const level = success ? 'info' : 'error';
    this.logger[level](`Event handler ${success ? 'completed' : 'failed'}: ${eventName}`, this.buildContext({
      handler_id: handlerId,
      event_name: eventName,
      success
    }));
  }

  // ===== System Logging =====

  /**
   * Log service initialization
   */
  serviceInitialized(additionalContext?: Record<string, any>): void {
    this.logger.info(`${this.serviceName} initialized`, this.buildContext(additionalContext || {}));
  }

  /**
   * Log service shutdown
   */
  serviceShutdown(additionalContext?: Record<string, any>): void {
    this.logger.info(`${this.serviceName} shutting down`, this.buildContext(additionalContext || {}));
  }

  /**
   * Log dispatcher cycle start
   */
  dispatcherCycleStarted(jobCount: number): void {
    this.logger.debug(`Dispatcher cycle started (${jobCount} jobs due)`, this.buildContext({
      pending_job_count: jobCount
    }));
  }

  /**
   * Log dispatcher cycle completion
   */
  dispatcherCycleCompleted(dispatched: number, failed: number, durationMs: number): void {
    this.logger.debug(`Dispatcher cycle completed: ${dispatched} dispatched, ${failed} failed in ${durationMs}ms`, this.buildContext({
      dispatched_count: dispatched,
      failed_count: failed,
      duration_ms: durationMs
    }));
  }

  // ===== Error Logging =====

  /**
   * Log database error
   */
  databaseError(operation: string, error: Error, context?: SchedulerLogContext): void {
    this.logger.error(`Database error during ${operation}: ${error.message}`, this.buildContext({
      operation,
      error: error.message,
      error_stack: error.stack,
      ...context
    }));
  }

  /**
   * Log handler not found
   */
  handlerNotFound(handlerName: string, availableHandlers?: string[]): void {
    this.logger.error(`Handler not found: ${handlerName}`, this.buildContext({
      handler_name: handlerName,
      available_handlers: availableHandlers
    }));
  }

  /**
   * Log concurrency limit reached
   */
  concurrencyLimitReached(jobId: string, currentCount: number, limit: number): void {
    this.logger.warn(`Concurrency limit reached: ${currentCount}/${limit}`, this.buildContext({
      job_id: jobId,
      current_count: currentCount,
      limit
    }));
  }

  // ===== Debug Logging =====

  /**
   * Log cron calculation
   */
  cronCalculated(schedule: string, nextRun: Date): void {
    this.logger.debug(`Next run calculated: ${nextRun.toISOString()}`, this.buildContext({
      schedule,
      next_run: nextRun.toISOString()
    }));
  }

  /**
   * Log job stats update
   */
  statsUpdated(jobId: string, stats: Record<string, any>): void {
    this.logger.debug('Job statistics updated', this.buildContext({
      job_id: jobId,
      ...stats
    }));
  }

  /**
   * Generic debug log
   */
  debug(message: string, context?: SchedulerLogContext): void {
    this.logger.debug(message, this.buildContext(context || {}));
  }

  /**
   * Generic info log
   */
  info(message: string, context?: SchedulerLogContext): void {
    this.logger.info(message, this.buildContext(context || {}));
  }

  /**
   * Generic warn log
   */
  warn(message: string, context?: SchedulerLogContext): void {
    this.logger.warn(message, this.buildContext(context || {}));
  }

  /**
   * Generic error log
   */
  error(message: string, context?: SchedulerLogContext): void {
    this.logger.error(message, this.buildContext(context || {}));
  }
}
