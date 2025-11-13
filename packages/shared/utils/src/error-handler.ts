/**
 * ErrorHandler Utility
 *
 * Centralized error handling with proper stack trace preservation,
 * consistent formatting, and type safety.
 */

export interface ErrorInfo {
  message: string;
  stack?: string;
  cause?: unknown;
  code?: string;
  timestamp?: string;
  context?: Record<string, any>;
}

export interface Logger {
  error: (message: string, metadata?: any) => void;
  warn: (message: string, metadata?: any) => void;
  info: (message: string, metadata?: any) => void;
}

export class ErrorHandler {
  /**
   * Convert any error type to a structured ErrorInfo object
   * Preserves stack traces and error causes
   */
  static toErrorInfo(error: unknown, context?: Record<string, any>): ErrorInfo {
    const timestamp = new Date().toISOString();

    if (error instanceof Error) {
      return {
        message: error.message,
        stack: error.stack,
        cause: error.cause,
        code: (error as any).code,
        timestamp,
        context
      };
    }

    if (typeof error === 'string') {
      return {
        message: error,
        timestamp,
        context
      };
    }

    if (error && typeof error === 'object') {
      const obj = error as any;
      return {
        message: obj.message || obj.toString?.() || JSON.stringify(error),
        stack: obj.stack,
        cause: obj.cause,
        code: obj.code,
        timestamp,
        context: { ...context, originalError: error }
      };
    }

    return {
      message: String(error),
      timestamp,
      context
    };
  }

  /**
   * Log an error with full context and stack trace preservation
   */
  static logError(
    logger: Logger,
    context: string,
    error: unknown,
    metadata?: Record<string, any>
  ): void {
    const errorInfo = this.toErrorInfo(error, metadata);

    logger.error(`[${context}] ${errorInfo.message}`, {
      ...errorInfo,
      ...metadata,
      errorContext: context
    });
  }

  /**
   * Create a formatted error message with context
   */
  static formatError(error: unknown, context?: string): string {
    const errorInfo = this.toErrorInfo(error);
    const prefix = context ? `[${context}] ` : '';

    if (errorInfo.stack) {
      return `${prefix}${errorInfo.message}\n${errorInfo.stack}`;
    }

    return `${prefix}${errorInfo.message}`;
  }

  /**
   * Extract the root cause from an error chain
   */
  static getRootCause(error: unknown): unknown {
    const errorInfo = this.toErrorInfo(error);

    if (errorInfo.cause) {
      return this.getRootCause(errorInfo.cause);
    }

    return error;
  }

  /**
   * Check if an error matches a specific type or code
   */
  static isErrorType(error: unknown, code?: string, messagePattern?: RegExp): boolean {
    const errorInfo = this.toErrorInfo(error);

    if (code && errorInfo.code === code) {
      return true;
    }

    if (messagePattern && messagePattern.test(errorInfo.message)) {
      return true;
    }

    return false;
  }

  /**
   * Wrap an error with additional context
   */
  static wrapError(
    error: unknown,
    message: string,
    context?: Record<string, any>
  ): Error {
    const errorInfo = this.toErrorInfo(error, context);
    const wrappedError = new Error(message);
    wrappedError.cause = error;
    (wrappedError as any).originalError = errorInfo;
    (wrappedError as any).context = context;

    return wrappedError;
  }

  /**
   * Create a custom error with proper typing
   */
  static createError(
    message: string,
    code?: string,
    context?: Record<string, any>
  ): Error {
    const error = new Error(message);
    if (code) {
      (error as any).code = code;
    }
    if (context) {
      (error as any).context = context;
    }
    return error;
  }

  /**
   * Safe error serialization for logging or transmission
   */
  static serialize(error: unknown): string {
    const errorInfo = this.toErrorInfo(error);

    try {
      return JSON.stringify(errorInfo, null, 2);
    } catch {
      // Fallback for circular references
      return JSON.stringify({
        message: errorInfo.message,
        code: errorInfo.code,
        timestamp: errorInfo.timestamp
      });
    }
  }

  /**
   * Deserialize an error from JSON
   */
  static deserialize(json: string): ErrorInfo {
    try {
      return JSON.parse(json) as ErrorInfo;
    } catch {
      return {
        message: 'Failed to deserialize error',
        context: { originalJson: json }
      };
    }
  }

  /**
   * Wrap async operation with error handling
   * Pattern A: Basic + Re-throw
   */
  static async wrapAsync<T>(
    operation: () => Promise<T>,
    context: string,
    logger?: Logger,
    metadata?: Record<string, any>
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (logger) {
        this.logError(logger, context, error, metadata);
      }
      throw error; // Re-throw to maintain error propagation
    }
  }

  /**
   * Execute operation with fallback value on error
   * Pattern B: With fallback
   */
  static async withFallback<T>(
    operation: () => Promise<T>,
    fallback: T,
    context: string,
    logger?: Logger
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (logger) {
        this.logError(logger, context, error, {
          fallback_used: true,
          fallback_value: fallback
        });
      }
      return fallback;
    }
  }

  /**
   * Execute operation with retry logic
   * Pattern C: Retry with exponential backoff
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    options: {
      retries?: number;
      delay?: number;
      backoffFactor?: number;
      context: string;
      logger?: Logger;
      shouldRetry?: (error: unknown) => boolean;
    }
  ): Promise<T> {
    const {
      retries = 3,
      delay = 1000,
      backoffFactor = 2,
      context,
      logger,
      shouldRetry = () => true
    } = options;

    let lastError: unknown;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt === retries || !shouldRetry(error)) {
          if (logger) {
            this.logError(logger, context, error, {
              attempt,
              max_retries: retries,
              final_failure: true
            });
          }
          throw error;
        }

        const waitTime = delay * Math.pow(backoffFactor, attempt - 1);

        if (logger) {
          logger.warn(`[${context}] Retry attempt ${attempt}/${retries}`, {
            error: this.toErrorInfo(error),
            wait_time_ms: waitTime,
            next_attempt: attempt + 1
          });
        }

        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    throw lastError;
  }

  /**
   * Check if error is retryable based on error type or code
   */
  static isRetryable(error: unknown): boolean {
    if (error instanceof Error) {
      const code = (error as any).code;

      // Network and timeout errors are typically retryable
      if (code && typeof code === 'string') {
        const retryableCodes = [
          'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND',
          'ECONNRESET', 'EPIPE', 'EHOSTUNREACH'
        ];
        if (retryableCodes.includes(code)) {
          return true;
        }
      }

      // Check error message for common retryable patterns
      const message = error.message.toLowerCase();
      const retryablePatterns = [
        'timeout', 'timed out',
        'connection refused',
        'connection reset',
        'socket hang up',
        'network error'
      ];

      return retryablePatterns.some(pattern => message.includes(pattern));
    }

    return false;
  }

  /**
   * Extract all errors from a cause chain
   */
  static getCauseChain(error: unknown): ErrorInfo[] {
    const chain: ErrorInfo[] = [];
    let current = error;
    const seen = new Set<unknown>();

    while (current && !seen.has(current)) {
      seen.add(current);
      chain.push(this.toErrorInfo(current));

      if (current instanceof Error && current.cause) {
        current = current.cause;
      } else {
        break;
      }
    }

    return chain;
  }
}

/**
 * Convenience function for quick error conversion
 */
export function toErrorMessage(error: unknown): string {
  return ErrorHandler.toErrorInfo(error).message;
}

/**
 * Convenience function for safe error logging
 */
export function safeErrorLog(error: unknown): Record<string, any> {
  return ErrorHandler.toErrorInfo(error);
}

/**
 * Export convenience methods
 */
export const wrapAsync = ErrorHandler.wrapAsync.bind(ErrorHandler);
export const withFallback = ErrorHandler.withFallback.bind(ErrorHandler);
export const withRetry = ErrorHandler.withRetry.bind(ErrorHandler);
export const isRetryable = ErrorHandler.isRetryable.bind(ErrorHandler);
export const getCauseChain = ErrorHandler.getCauseChain.bind(ErrorHandler);