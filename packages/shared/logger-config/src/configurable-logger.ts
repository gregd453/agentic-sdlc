import pino from 'pino';
import { LogLevel, LogLevelValue } from './log-level';

/**
 * Configurable Logger Factory
 * Creates pino logger instances with filtering based on LoggerConfigService
 */

export interface ConfigurableLoggerOptions {
  name: string;
  level: LogLevel;
  moduleLevel?: string; // For per-module configuration
  prettyPrint?: boolean;
  traceContext?: {
    trace_id?: string;
    span_id?: string;
    parent_span_id?: string;
  };
}

/**
 * Create a pino logger with configured level filtering
 */
export function createConfigurableLogger(options: ConfigurableLoggerOptions): pino.Logger {
  const pinoLevelString = mapLogLevelToString(options.level);

  return pino(
    {
      name: options.name,
      level: pinoLevelString,
      // Base logger configuration
      serializers: {
        err: pino.stdSerializers.err,
        req: pino.stdSerializers.req,
        res: pino.stdSerializers.res
      }
    },
    pino.transport(
      {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'UTC:yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,hostname'
        }
      }
    )
  );
}

/**
 * Map LogLevel to pino level string
 */
function mapLogLevelToString(level: LogLevel): string {
  return level;
}

/**
 * Map LogLevel to pino level number
 */
function mapLogLevelToPino(level: LogLevel): number {
  return LogLevelValue[level];
}

/**
 * Create a logger with trace context middleware
 */
export function createLoggerWithTraceContext(
  options: ConfigurableLoggerOptions,
  traceContext?: { trace_id?: string; span_id?: string; parent_span_id?: string }
): pino.Logger {
  const logger = createConfigurableLogger(options);

  if (!traceContext) {
    return logger;
  }

  // Wrap logger to inject trace context into all messages
  return logger.child(
    {
      trace_id: traceContext.trace_id,
      span_id: traceContext.span_id,
      parent_span_id: traceContext.parent_span_id
    },
    { redact: [] }
  );
}

/**
 * Create a logger that respects module-level filtering
 */
export function createModuleLevelLogger(
  options: ConfigurableLoggerOptions,
  getModuleLevel: (moduleName: string) => LogLevel
): pino.Logger {
  const moduleName = options.moduleLevel || options.name;
  const moduleLevel = getModuleLevel(moduleName);
  const moduleLevelString = mapLogLevelToString(moduleLevel);

  // Create logger with module-specific level
  return pino(
    {
      name: options.name,
      level: moduleLevelString,
      serializers: {
        err: pino.stdSerializers.err,
        req: pino.stdSerializers.req,
        res: pino.stdSerializers.res
      }
    },
    pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'UTC:yyyy-mm-dd HH:MM:ss',
        ignore: 'pid,hostname'
      }
    })
  );
}

/**
 * Pino level map for reference
 */
export const PinoLevelMap = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60
};
