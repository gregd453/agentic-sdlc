/**
 * Log Level Management
 * Defines and manages log levels for distributed tracing
 */

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Log level numeric values for comparison
 */
export const LogLevelValue: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60
};

/**
 * Check if a log level should be output
 * @param currentLevel The minimum level to output (e.g., 'info' means info, warn, error, fatal)
 * @param messageLevel The level of the current message (e.g., 'debug')
 * @returns true if message should be logged
 */
export function shouldLog(currentLevel: LogLevel, messageLevel: LogLevel): boolean {
  return LogLevelValue[messageLevel] >= LogLevelValue[currentLevel];
}

/**
 * Map Pino logger levels to our LogLevel type
 */
export const PinoLevelMap: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60
};

/**
 * Validate if a string is a valid log level
 */
export function isValidLogLevel(level: string): level is LogLevel {
  return level in LogLevelValue;
}

/**
 * Get next log level (lower level = more logging)
 */
export function getNextLevel(current: LogLevel, direction: 'up' | 'down'): LogLevel {
  const levels: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
  const currentIndex = levels.indexOf(current);

  if (direction === 'down' && currentIndex > 0) {
    return levels[currentIndex - 1];
  }
  if (direction === 'up' && currentIndex < levels.length - 1) {
    return levels[currentIndex + 1];
  }

  return current;
}
