/**
 * Structured Logging Utility
 *
 * Provides consistent JSON-formatted logging with scope/context
 * for distributed tracing across Redis modules.
 */

export type Log = (msg: string, meta?: Record<string, any>) => void;

/**
 * Create a scoped logger
 * @param scope - Module/service name for context
 * @returns Log function
 */
export const makeLogger = (scope: string): Log =>
  (msg, meta = {}) => {
    const entry = {
      ts: new Date().toISOString(),
      scope,
      msg,
      ...meta,
    };
    console.log(JSON.stringify(entry));
  };

/**
 * Create a logger with custom output (for testing)
 */
export const makeLoggerWith = (scope: string, output: (msg: string) => void): Log =>
  (msg, meta = {}) => {
    const entry = {
      ts: new Date().toISOString(),
      scope,
      msg,
      ...meta,
    };
    output(JSON.stringify(entry));
  };
