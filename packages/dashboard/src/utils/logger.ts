/**
 * Simple logging utility for the dashboard
 * Provides structured logging with severity levels
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface LogEntry {
  level: LogLevel
  message: string
  context?: string
  error?: Error | unknown
  timestamp: string
}

class Logger {
  private isDevelopment = import.meta.env.DEV

  private format(entry: LogEntry): string {
    const timestamp = entry.timestamp
    const context = entry.context ? ` [${entry.context}]` : ''
    return `[${timestamp}] ${entry.level}${context}: ${entry.message}`
  }

  private log(level: LogLevel, message: string, context?: string, error?: Error | unknown): void {
    const entry: LogEntry = {
      level,
      message,
      context,
      error,
      timestamp: new Date().toISOString(),
    }

    const formatted = this.format(entry)

    // Log to console based on level
    switch (level) {
      case LogLevel.DEBUG:
        if (this.isDevelopment) console.debug(formatted, error || '')
        break
      case LogLevel.INFO:
        console.log(formatted)
        break
      case LogLevel.WARN:
        console.warn(formatted, error || '')
        break
      case LogLevel.ERROR:
        console.error(formatted, error || '')
        break
    }
  }

  debug(message: string, context?: string): void {
    this.log(LogLevel.DEBUG, message, context)
  }

  info(message: string, context?: string): void {
    this.log(LogLevel.INFO, message, context)
  }

  warn(message: string, context?: string, error?: Error | unknown): void {
    this.log(LogLevel.WARN, message, context, error)
  }

  error(message: string, context?: string, error?: Error | unknown): void {
    this.log(LogLevel.ERROR, message, context, error)
  }
}

export const logger = new Logger()
