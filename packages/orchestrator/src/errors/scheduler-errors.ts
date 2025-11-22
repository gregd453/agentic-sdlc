/**
 * Scheduler Error Types
 *
 * Structured error classes for scheduler services with error codes and context
 * Session #91: Created for better error handling and debugging
 */

/**
 * Base error class for all scheduler-related errors
 */
export class SchedulerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = 'SchedulerError';
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context
    };
  }
}

/**
 * Job not found error
 */
export class JobNotFoundError extends SchedulerError {
  constructor(jobId: string) {
    super(
      `Job not found: ${jobId}`,
      'JOB_NOT_FOUND',
      { job_id: jobId }
    );
    this.name = 'JobNotFoundError';
  }
}

/**
 * Invalid job state for requested operation
 */
export class InvalidJobStateError extends SchedulerError {
  constructor(
    operation: string,
    currentStatus: string,
    expectedStatuses: string[]
  ) {
    super(
      `Cannot ${operation} job with status: ${currentStatus}. Expected one of: ${expectedStatuses.join(', ')}`,
      'INVALID_JOB_STATE',
      {
        operation,
        current_status: currentStatus,
        expected_statuses: expectedStatuses
      }
    );
    this.name = 'InvalidJobStateError';
  }
}

/**
 * Invalid cron expression error
 */
export class CronExpressionError extends SchedulerError {
  constructor(schedule: string, reason: string) {
    super(
      `Invalid cron expression '${schedule}': ${reason}`,
      'INVALID_CRON',
      { schedule, reason }
    );
    this.name = 'CronExpressionError';
  }
}

/**
 * Job execution timeout error
 */
export class ExecutionTimeoutError extends SchedulerError {
  constructor(jobId: string, executionId: string, timeoutMs: number) {
    super(
      `Job execution timed out after ${timeoutMs}ms`,
      'EXECUTION_TIMEOUT',
      {
        job_id: jobId,
        execution_id: executionId,
        timeout_ms: timeoutMs
      }
    );
    this.name = 'ExecutionTimeoutError';
  }
}

/**
 * Concurrency limit exceeded error
 */
export class ConcurrencyLimitError extends SchedulerError {
  constructor(jobId: string, currentCount: number, limit: number) {
    super(
      `Job concurrency limit reached: ${currentCount}/${limit}`,
      'CONCURRENCY_LIMIT',
      {
        job_id: jobId,
        current_count: currentCount,
        limit
      }
    );
    this.name = 'ConcurrencyLimitError';
  }
}

/**
 * Job handler not found error
 */
export class HandlerNotFoundError extends SchedulerError {
  constructor(handlerName: string, availableHandlers?: string[]) {
    super(
      `Job handler not found: ${handlerName}`,
      'HANDLER_NOT_FOUND',
      {
        handler_name: handlerName,
        available_handlers: availableHandlers
      }
    );
    this.name = 'HandlerNotFoundError';
  }
}

/**
 * Job handler execution error
 */
export class HandlerExecutionError extends SchedulerError {
  constructor(
    handlerName: string,
    jobId: string,
    originalError: Error
  ) {
    super(
      `Handler '${handlerName}' execution failed: ${originalError.message}`,
      'HANDLER_EXECUTION_ERROR',
      {
        handler_name: handlerName,
        job_id: jobId,
        original_error: originalError.message,
        original_stack: originalError.stack
      }
    );
    this.name = 'HandlerExecutionError';
  }
}

/**
 * Event handler not found error
 */
export class EventHandlerNotFoundError extends SchedulerError {
  constructor(handlerId: string) {
    super(
      `Event handler not found: ${handlerId}`,
      'EVENT_HANDLER_NOT_FOUND',
      { handler_id: handlerId }
    );
    this.name = 'EventHandlerNotFoundError';
  }
}

/**
 * Invalid job configuration error
 */
export class InvalidJobConfigError extends SchedulerError {
  constructor(reason: string, config?: Record<string, any>) {
    super(
      `Invalid job configuration: ${reason}`,
      'INVALID_JOB_CONFIG',
      { reason, config }
    );
    this.name = 'InvalidJobConfigError';
  }
}

/**
 * Job execution already running error
 */
export class ExecutionAlreadyRunningError extends SchedulerError {
  constructor(jobId: string, executionId: string) {
    super(
      `Job ${jobId} already has an execution running: ${executionId}`,
      'EXECUTION_ALREADY_RUNNING',
      { job_id: jobId, execution_id: executionId }
    );
    this.name = 'ExecutionAlreadyRunningError';
  }
}

/**
 * Maximum retries exceeded error
 */
export class MaxRetriesExceededError extends SchedulerError {
  constructor(
    jobId: string,
    executionId: string,
    maxRetries: number,
    lastError: string
  ) {
    super(
      `Maximum retries (${maxRetries}) exceeded for job ${jobId}`,
      'MAX_RETRIES_EXCEEDED',
      {
        job_id: jobId,
        execution_id: executionId,
        max_retries: maxRetries,
        last_error: lastError
      }
    );
    this.name = 'MaxRetriesExceededError';
  }
}

/**
 * Type guard to check if an error is a SchedulerError
 */
export function isSchedulerError(error: unknown): error is SchedulerError {
  return error instanceof SchedulerError;
}

/**
 * Helper to extract error code from any error
 */
export function getErrorCode(error: unknown): string {
  if (isSchedulerError(error)) {
    return error.code;
  }
  return 'UNKNOWN_ERROR';
}

/**
 * Helper to extract error context from any error
 */
export function getErrorContext(error: unknown): Record<string, any> | undefined {
  if (isSchedulerError(error)) {
    return error.context;
  }
  return undefined;
}
