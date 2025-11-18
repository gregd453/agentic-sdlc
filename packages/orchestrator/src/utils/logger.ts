import pino from 'pino';
import { randomUUID } from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';
import { generateTraceId as generateTraceIdUtil } from '@agentic-sdlc/shared-utils';

const isDevelopment = process.env.NODE_ENV === 'development';
const logLevel = process.env.LOG_LEVEL || LOG_LEVEL.INFO;

/**
 * Request Context for distributed tracing
 */
export interface RequestContext {
  requestId: string;
  traceId: string;
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  startTime: number;
}

/**
 * Async Local Storage for request context propagation
 */
export const requestContext = new AsyncLocalStorage<RequestContext>();

/**
 * Base logger configuration with structured logging
 */
export const logger = pino({
  name: 'orchestrator',
  level: logLevel,
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname'
        }
      }
    : undefined,
  formatters: {
    level(label, _number) {
      return { level: label };
    }
  },
  timestamp: () => `,"timestamp":"${new Date(Date.now()).toISOString()}"`,
  // Add request context to all logs automatically
  mixin() {
    const context = requestContext.getStore();
    if (context) {
      return {
        request_id: context.requestId,
        trace_id: context.traceId,
        span_id: (context as any).spanId, // Phase 4: Include span_id in logs
        correlation_id: context.correlationId,
        user_id: context.userId,
        session_id: context.sessionId
      };
    }
    return {};
  }
});

/**
 * Create a child logger with additional context
 */
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

/**
 * Generate a unique trace ID (UUID v4 format)
 * Re-exported from @agentic-sdlc/shared-utils for backward compatibility
 */
export const generateTraceId = generateTraceIdUtil;

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return randomUUID();
}

/**
 * Generate a unique correlation ID
 */
export function generateCorrelationId(): string {
  return `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create request context for distributed tracing
 */
export function createRequestContext(overrides?: Partial<RequestContext>): RequestContext {
  return {
    requestId: generateRequestId(),
    traceId: generateTraceId(),
    correlationId: generateCorrelationId(),
    startTime: Date.now(),
    ...overrides
  };
}

/**
 * Run function with request context
 */
export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return requestContext.run(context, fn);
}

/**
 * Get current request context
 */
export function getRequestContext(): RequestContext | undefined {
  return requestContext.getStore();
}

/**
 * Structured log entry interface
 */
export interface LogEntry {
  message: string;
  level: 'trace' | LOG_LEVEL.DEBUG | LOG_LEVEL.INFO | LOG_LEVEL.WARN | LOG_LEVEL.ERROR | 'fatal';
  context?: Record<string, unknown>;
  error?: Error;
  duration?: number;
  tags?: string[];
}

/**
 * Enhanced logging utility with structured logging
 */
export class StructuredLogger {
  private logger: pino.Logger;

  constructor(private component: string) {
    this.logger = createLogger({ component });
  }

  /**
   * Log with structured data
   */
  log(entry: LogEntry): void {
    const logData: any = {
      ...entry.context,
      component: this.component
    };

    if (entry.duration !== undefined) {
      logData.duration_ms = entry.duration;
    }

    if (entry.tags) {
      logData.tags = entry.tags;
    }

    if (entry.error) {
      logData.error = {
        message: entry.error.message,
        stack: entry.error.stack,
        name: entry.error.name
      };
    }

    this.logger[entry.level](logData, entry.message);
  }

  /**
   * Log operation with automatic duration tracking
   */
  async logOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: Record<string, unknown>
  ): Promise<T> {
    const startTime = Date.now();

    try {
      this.logger.info({ operation, ...context }, `Starting ${operation}`);
      const result = await fn();
      const duration = Date.now() - startTime;
      this.logger.info({ operation, duration_ms: duration, ...context }, `Completed ${operation}`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        {
          operation,
          duration_ms: duration,
          error: error instanceof Error ? {
            message: error.message,
            stack: error.stack,
            name: error.name
          } : String(error),
          ...context
        },
        `Failed ${operation}`
      );
      throw error;
    }
  }

  /**
   * Convenience methods
   */
  trace(message: string, context?: Record<string, unknown>): void {
    this.log({ message, level: 'trace', context });
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log({ message, level: LOG_LEVEL.DEBUG, context });
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log({ message, level: LOG_LEVEL.INFO, context });
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log({ message, level: LOG_LEVEL.WARN, context });
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log({ message, level: LOG_LEVEL.ERROR, error, context });
  }

  fatal(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log({ message, level: 'fatal', error, context });
  }
}