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