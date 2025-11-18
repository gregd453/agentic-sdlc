/**
 * Base Error Classes for Agentic SDLC
 *
 * Provides structured error handling with:
 * - Error codes and categories
 * - Retry hints and recovery strategies
 * - Structured metadata for logging
 * - Correlation IDs for tracing
 */

/**
 * Error categories for classification
 */
export enum ErrorCategory {
  VALIDATION = AGENT_TYPES.VALIDATION,           // Input validation errors
  AUTHENTICATION = 'authentication',   // Auth/authz errors
  NOT_FOUND = 'not_found',            // Resource not found
  CONFLICT = 'conflict',              // State conflicts
  RATE_LIMIT = 'rate_limit',          // Rate limiting
  TIMEOUT = 'timeout',                // Operation timeout
  NETWORK = 'network',                // Network/connectivity
  DATABASE = 'database',              // Database errors
  EXTERNAL_SERVICE = 'external_service', // External API errors
  INTERNAL = 'internal',              // Internal system errors
  UNKNOWN = 'unknown'                 // Unknown errors
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = TASK_PRIORITY.LOW,         // Informational, no action needed
  MEDIUM = TASK_PRIORITY.MEDIUM,   // Warning, may need attention
  HIGH = TASK_PRIORITY.HIGH,       // Error, needs attention
  CRITICAL = TASK_PRIORITY.CRITICAL // Critical, immediate action required
}

/**
 * Recovery strategies
 */
export enum RecoveryStrategy {
  RETRY = 'retry',           // Retry the operation
  FALLBACK = 'fallback',     // Use fallback value/operation
  ESCALATE = 'escalate',     // Escalate to human
  ABORT = 'abort',           // Abort the operation
  IGNORE = 'ignore',         // Ignore and continue
  CIRCUIT_BREAK = 'circuit_break' // Open circuit breaker
}

/**
 * Structured error metadata
 */
export interface ErrorMetadata {
  timestamp: string;
  traceId?: string;
  correlationId?: string;
  userId?: string;
  workflowId?: string;
  agentType?: string;
  component?: string;
  operation?: string;
  context?: Record<string, unknown>;
  stackTrace?: string;
}

/**
 * Base error class with rich metadata
 */
export class BaseError extends Error {
  public readonly code: string;
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly retryable: boolean;
  public readonly recoveryStrategy: RecoveryStrategy;
  public readonly metadata: ErrorMetadata;
  public readonly cause?: Error;

  constructor(
    message: string,
    options: {
      code: string;
      category?: ErrorCategory;
      severity?: ErrorSeverity;
      retryable?: boolean;
      recoveryStrategy?: RecoveryStrategy;
      metadata?: Partial<ErrorMetadata>;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = this.constructor.name;

    this.code = options.code;
    this.category = options.category || ErrorCategory.UNKNOWN;
    this.severity = options.severity || ErrorSeverity.MEDIUM;
    this.retryable = options.retryable !== undefined ? options.retryable : false;
    this.recoveryStrategy = options.recoveryStrategy || RecoveryStrategy.ABORT;
    this.cause = options.cause;

    this.metadata = {
      timestamp: new Date().toISOString(),
      ...options.metadata
    };

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
    this.metadata.stackTrace = this.stack;
  }

  /**
   * Convert error to JSON for logging
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      category: this.category,
      severity: this.severity,
      retryable: this.retryable,
      recoveryStrategy: this.recoveryStrategy,
      metadata: this.metadata,
      cause: this.cause ? {
        name: this.cause.name,
        message: this.cause.message
      } : undefined
    };
  }

  /**
   * Get formatted error message for logging
   */
  toLogFormat(): string {
    return `[${this.code}] ${this.category.toUpperCase()}: ${this.message}`;
  }

  /**
   * Check if error should be retried
   */
  shouldRetry(): boolean {
    return this.retryable && this.recoveryStrategy === RecoveryStrategy.RETRY;
  }
}

/**
 * Validation error for input validation failures
 */
export class ValidationError extends BaseError {
  constructor(
    message: string,
    options: {
      field?: string;
      value?: unknown;
      constraint?: string;
      metadata?: Partial<ErrorMetadata>;
      cause?: Error;
    } = {}
  ) {
    super(message, {
      code: 'VALIDATION_ERROR',
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.LOW,
      retryable: false,
      recoveryStrategy: RecoveryStrategy.ABORT,
      metadata: {
        ...options.metadata,
        context: {
          field: options.field,
          value: options.value,
          constraint: options.constraint,
          ...options.metadata?.context
        }
      },
      cause: options.cause
    });
  }
}

/**
 * Not found error for missing resources
 */
export class NotFoundError extends BaseError {
  constructor(
    resourceType: string,
    resourceId: string,
    options: {
      metadata?: Partial<ErrorMetadata>;
      cause?: Error;
    } = {}
  ) {
    super(`${resourceType} not found: ${resourceId}`, {
      code: 'NOT_FOUND',
      category: ErrorCategory.NOT_FOUND,
      severity: ErrorSeverity.LOW,
      retryable: false,
      recoveryStrategy: RecoveryStrategy.ABORT,
      metadata: {
        ...options.metadata,
        context: {
          resourceType,
          resourceId,
          ...options.metadata?.context
        }
      },
      cause: options.cause
    });
  }
}

/**
 * Timeout error for operations that exceed time limit
 */
export class TimeoutError extends BaseError {
  constructor(
    operation: string,
    timeoutMs: number,
    options: {
      metadata?: Partial<ErrorMetadata>;
      cause?: Error;
    } = {}
  ) {
    super(`Operation timed out: ${operation} (${timeoutMs}ms)`, {
      code: 'TIMEOUT',
      category: ErrorCategory.TIMEOUT,
      severity: ErrorSeverity.HIGH,
      retryable: true,
      recoveryStrategy: RecoveryStrategy.RETRY,
      metadata: {
        ...options.metadata,
        context: {
          operation,
          timeoutMs,
          ...options.metadata?.context
        }
      },
      cause: options.cause
    });
  }
}

/**
 * Network error for connectivity issues
 */
export class NetworkError extends BaseError {
  constructor(
    message: string,
    options: {
      host?: string;
      port?: number;
      protocol?: string;
      metadata?: Partial<ErrorMetadata>;
      cause?: Error;
    } = {}
  ) {
    super(message, {
      code: 'NETWORK_ERROR',
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.HIGH,
      retryable: true,
      recoveryStrategy: RecoveryStrategy.RETRY,
      metadata: {
        ...options.metadata,
        context: {
          host: options.host,
          port: options.port,
          protocol: options.protocol,
          ...options.metadata?.context
        }
      },
      cause: options.cause
    });
  }
}

/**
 * Database error for database operations
 */
export class DatabaseError extends BaseError {
  constructor(
    message: string,
    options: {
      query?: string;
      table?: string;
      operation?: string;
      metadata?: Partial<ErrorMetadata>;
      cause?: Error;
    } = {}
  ) {
    super(message, {
      code: 'DATABASE_ERROR',
      category: ErrorCategory.DATABASE,
      severity: ErrorSeverity.HIGH,
      retryable: true,
      recoveryStrategy: RecoveryStrategy.RETRY,
      metadata: {
        ...options.metadata,
        context: {
          query: options.query,
          table: options.table,
          operation: options.operation,
          ...options.metadata?.context
        }
      },
      cause: options.cause
    });
  }
}

/**
 * Rate limit error when quota is exceeded
 */
export class RateLimitError extends BaseError {
  constructor(
    resource: string,
    limit: number,
    windowMs: number,
    options: {
      retryAfterMs?: number;
      metadata?: Partial<ErrorMetadata>;
      cause?: Error;
    } = {}
  ) {
    super(`Rate limit exceeded for ${resource}: ${limit} requests per ${windowMs}ms`, {
      code: 'RATE_LIMIT_EXCEEDED',
      category: ErrorCategory.RATE_LIMIT,
      severity: ErrorSeverity.MEDIUM,
      retryable: true,
      recoveryStrategy: RecoveryStrategy.RETRY,
      metadata: {
        ...options.metadata,
        context: {
          resource,
          limit,
          windowMs,
          retryAfterMs: options.retryAfterMs,
          ...options.metadata?.context
        }
      },
      cause: options.cause
    });
  }
}
