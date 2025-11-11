/**
 * Structured Logging Utility
 *
 * JSON-based logging with correlation IDs for distributed tracing.
 * All logs include timestamp, scope, and context.
 */

export interface LogEntry {
  ts: string;
  scope: string;
  msg: string;
  corrId?: string;
  [key: string]: any;
}

export interface Logger {
  info: (msg: string, meta?: Record<string, any>) => void;
  warn: (msg: string, meta?: Record<string, any>) => void;
  error: (msg: string, meta?: Record<string, any>) => void;
  debug: (msg: string, meta?: Record<string, any>) => void;
}

/**
 * Create a scoped logger
 * @param scope - Module name for context
 * @returns Logger instance
 */
export function createLogger(scope: string): Logger {
  const log = (level: string, msg: string, meta: Record<string, any> = {}) => {
    const entry: LogEntry = {
      ts: new Date().toISOString(),
      scope,
      msg,
      level,
      ...meta,
    };
    console.log(JSON.stringify(entry));
  };

  return {
    info: (msg, meta) => log('INFO', msg, meta),
    warn: (msg, meta) => log('WARN', msg, meta),
    error: (msg, meta) => log('ERROR', msg, meta),
    debug: (msg, meta) => {
      if (process.env.DEBUG) {
        log('DEBUG', msg, meta);
      }
    },
  };
}

/**
 * Context-aware logging helper for tracking operations
 */
export function withCorrelation(corrId: string) {
  return {
    info: (scope: string, msg: string, meta?: Record<string, any>) => {
      const logger = createLogger(scope);
      logger.info(msg, { corrId, ...meta });
    },
    error: (scope: string, msg: string, meta?: Record<string, any>) => {
      const logger = createLogger(scope);
      logger.error(msg, { corrId, ...meta });
    },
  };
}
