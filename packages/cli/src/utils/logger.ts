/**
 * Structured logging utility
 */

import chalk from 'chalk'

export type LogLevel = LOG_LEVEL.DEBUG | LOG_LEVEL.INFO | LOG_LEVEL.WARN | LOG_LEVEL.ERROR

export interface LogEntry {
  timestamp: Date
  level: LogLevel
  message: string
  context?: Record<string, unknown>
  error?: Error
}

export class Logger {
  private verbose: boolean = false
  private logs: LogEntry[] = []

  constructor(verbose: boolean = false) {
    this.verbose = verbose
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: Record<string, unknown>) {
    if (!this.verbose) return

    this.log(LOG_LEVEL.DEBUG, message, context)
    console.log(chalk.gray(`[DEBUG] ${message}`))
  }

  /**
   * Log info message
   */
  info(message: string, context?: Record<string, unknown>) {
    this.log(LOG_LEVEL.INFO, message, context)
    console.log(chalk.blue(`[INFO] ${message}`))
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: Record<string, unknown>) {
    this.log(LOG_LEVEL.WARN, message, context)
    console.log(chalk.yellow(`[WARN] ${message}`))
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error | string, context?: Record<string, unknown>) {
    const err = typeof error === 'string' ? new Error(error) : error
    this.log(LOG_LEVEL.ERROR, message, { ...context, error: err?.message })
    console.log(chalk.red(`[ERROR] ${message}`))
    if (err) {
      console.log(chalk.red(err.message))
    }
  }

  /**
   * Log workflow trace
   */
  trace(traceId: string, message: string, data?: unknown) {
    if (!this.verbose) return

    const prefix = chalk.cyan(`🔍 [TRACE:${traceId}]`)
    console.log(`${prefix} ${message}`)

    if (data && this.verbose) {
      console.log(chalk.gray(JSON.stringify(data, null, 2)))
    }
  }

  /**
   * Get all logs
   */
  getLogs(level?: LogLevel): LogEntry[] {
    if (!level) return this.logs
    return this.logs.filter(l => l.level === level)
  }

  /**
   * Clear logs
   */
  clear() {
    this.logs = []
  }

  /**
   * Internal log storage
   */
  private log(level: LogLevel, message: string, context?: Record<string, unknown>) {
    this.logs.push({
      timestamp: new Date(),
      level,
      message,
      context,
    })
  }

  /**
   * Export logs as JSON
   */
  exportJSON(): string {
    return JSON.stringify(this.logs, null, 2)
  }
}

// Export singleton instance
export const logger = new Logger(process.env.VERBOSE === 'true')
