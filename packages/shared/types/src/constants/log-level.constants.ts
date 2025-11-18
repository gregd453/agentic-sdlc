/**
 * Log Level Constants
 * Session #80: Consolidated from 178 hardcoded occurrences
 */

export const LOG_LEVEL = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  WARNING: 'warning',
  ERROR: 'error',
  FATAL: 'fatal'
} as const;

export type LogLevelType = typeof LOG_LEVEL[keyof typeof LOG_LEVEL];
