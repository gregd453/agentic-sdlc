/**
 * Advanced Features Service - Error recovery, retry logic, and interactive mode
 * Provides utilities for resilient CLI operations
 */

import { logger } from '../utils/logger.js'

export interface RetryOptions {
  maxAttempts?: number
  backoffMs?: number
  maxBackoffMs?: number
  backoffMultiplier?: number
  jitterFactor?: number
}

export interface RetryResult<T> {
  success: boolean
  data?: T
  error?: Error
  attempts: number
  totalDuration: number
  lastError?: string
}

export interface RecoveryStrategy {
  name: string
  shouldHandle: (error: Error) => boolean
  recover: () => Promise<void>
}

export interface InteractivePrompt {
  type: 'confirm' | 'text' | 'select'
  message: string
  default?: string | boolean
  choices?: string[]
}

export class AdvancedFeaturesService {
  private retryDefaults: RetryOptions = {
    maxAttempts: 3,
    backoffMs: 1000,
    maxBackoffMs: 30000,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
  }

  private recoveryStrategies: Map<string, RecoveryStrategy> = new Map()

  constructor() {
    this.initializeRecoveryStrategies()
    logger.debug('AdvancedFeaturesService initialized')
  }

  /**
   * Initialize built-in recovery strategies
   */
  private initializeRecoveryStrategies(): void {
    // Network timeout recovery
    this.registerRecoveryStrategy({
      name: 'network-timeout',
      shouldHandle: (error) => {
        const msg = error.message.toLowerCase()
        return msg.includes('timeout') || msg.includes('etimedout') || msg.includes('econnreset')
      },
      recover: async () => {
        logger.info('Recovering from network timeout - retrying...')
        // Wait a bit before retry
        await this.sleep(2000)
      },
    })

    // Connection refused recovery
    this.registerRecoveryStrategy({
      name: 'connection-refused',
      shouldHandle: (error) => {
        const msg = error.message.toLowerCase()
        return msg.includes('econnrefused') || msg.includes('connection refused')
      },
      recover: async () => {
        logger.info('Connection refused - waiting for service to be ready...')
        // Wait longer for service to start
        await this.sleep(5000)
      },
    })

    // Rate limit recovery
    this.registerRecoveryStrategy({
      name: 'rate-limit',
      shouldHandle: (error) => {
        const msg = error.message.toLowerCase()
        return msg.includes('429') || msg.includes('rate limit')
      },
      recover: async () => {
        logger.info('Rate limited - backing off...')
        // Exponential backoff for rate limits
        await this.sleep(10000)
      },
    })

    // Database connection recovery
    this.registerRecoveryStrategy({
      name: 'database-connection',
      shouldHandle: (error) => {
        const msg = error.message.toLowerCase()
        return (
          msg.includes('database') ||
          msg.includes('connection pool') ||
          msg.includes('database error')
        )
      },
      recover: async () => {
        logger.info('Database connection issue - checking connectivity...')
        // In a real implementation, would verify DB is accessible
        await this.sleep(3000)
      },
    })
  }

  /**
   * Register a custom recovery strategy
   */
  registerRecoveryStrategy(strategy: RecoveryStrategy): void {
    this.recoveryStrategies.set(strategy.name, strategy)
    logger.debug(`Registered recovery strategy: ${strategy.name}`)
  }

  /**
   * Execute function with automatic retry on failure
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<RetryResult<T>> {
    const mergedOptions: RetryOptions = { ...this.retryDefaults, ...options }
    const startTime = Date.now()
    let lastError: Error | undefined

    for (let attempt = 1; attempt <= (mergedOptions.maxAttempts || 3); attempt++) {
      try {
        logger.debug(`Attempt ${attempt}/${mergedOptions.maxAttempts} for operation`)

        const data = await operation()

        logger.info(`Operation succeeded on attempt ${attempt}`)

        return {
          success: true,
          data,
          attempts: attempt,
          totalDuration: Date.now() - startTime,
        }
      } catch (error) {
        lastError = error as Error
        logger.warn(`Attempt ${attempt} failed: ${lastError.message}`)

        // Check if there's a recovery strategy for this error
        const strategy = this.findRecoveryStrategy(lastError)
        if (strategy) {
          logger.info(`Found recovery strategy: ${strategy.name}`)
          try {
            await strategy.recover()
          } catch (recoveryError) {
            logger.warn(`Recovery failed: ${(recoveryError as Error).message}`)
          }
        }

        // Don't retry if it's the last attempt
        if (attempt >= (mergedOptions.maxAttempts || 3)) {
          break
        }

        // Calculate backoff time with jitter
        const backoff = this.calculateBackoff(
          attempt,
          mergedOptions.backoffMs || 1000,
          mergedOptions.maxBackoffMs || 30000,
          mergedOptions.backoffMultiplier || 2,
          mergedOptions.jitterFactor || 0.1
        )

        logger.debug(`Waiting ${backoff}ms before retry...`)
        await this.sleep(backoff)
      }
    }

    // All retries failed
    return {
      success: false,
      error: lastError,
      attempts: mergedOptions.maxAttempts || 3,
      totalDuration: Date.now() - startTime,
      lastError: lastError?.message,
    }
  }

  /**
   * Execute function with timeout
   */
  async withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      operation(),
      this.createTimeoutPromise<T>(timeoutMs),
    ])
  }

  /**
   * Execute function with circuit breaker pattern
   */
  async withCircuitBreaker<T>(
    operation: () => Promise<T>,
    name: string,
    config: {
      failureThreshold?: number
      successThreshold?: number
      timeout?: number
    } = {}
  ): Promise<T> {
    const failureThreshold = config.failureThreshold || 5
    const successThreshold = config.successThreshold || 2
    const timeout = config.timeout || 60000

    // In a real implementation, this would track state across calls
    // For now, just log the circuit breaker action
    logger.debug(`Circuit breaker '${name}' executing operation`, {
      failureThreshold,
      successThreshold,
      timeout,
    })

    return this.withTimeout(operation, timeout)
  }

  /**
   * Execute function with fallback
   */
  async withFallback<T>(
    operation: () => Promise<T>,
    fallback: () => T | Promise<T>
  ): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      logger.warn(`Operation failed, using fallback: ${(error as Error).message}`)
      return fallback()
    }
  }

  /**
   * Batch execute operations with concurrency control
   */
  async batchExecute<T>(
    operations: Array<() => Promise<T>>,
    concurrency: number = 4,
    options: RetryOptions = {}
  ): Promise<T[]> {
    const results: T[] = []
    const executing: Promise<T>[] = []

    for (const operation of operations) {
      const promise = this.withRetry(operation, options).then((result) => {
        if (result.success && result.data) {
          results.push(result.data)
        } else {
          throw result.error
        }
        return result.data as T
      })

      executing.push(promise)

      // Limit concurrent operations
      if (executing.length >= concurrency) {
        await Promise.race(executing)
        executing.splice(
          executing.findIndex((p) => p === executing[0]),
          1
        )
      }
    }

    // Wait for all remaining operations
    await Promise.all(executing)

    return results
  }

  /**
   * Prompt user for confirmation (interactive mode)
   */
  async promptConfirm(message: string, defaultValue: boolean = true): Promise<boolean> {
    // In a real implementation, would use inquirer or similar
    // For now, log the prompt and return default
    logger.info(`PROMPT: ${message} (default: ${defaultValue ? 'Y' : 'N'})`)
    return defaultValue
  }

  /**
   * Prompt user for text input (interactive mode)
   */
  async promptText(message: string, defaultValue?: string): Promise<string> {
    // In a real implementation, would use inquirer or similar
    logger.info(`PROMPT: ${message}${defaultValue ? ` (default: ${defaultValue})` : ''}`)
    return defaultValue || ''
  }

  /**
   * Prompt user to select from choices (interactive mode)
   */
  async promptSelect(message: string, choices: string[], defaultIndex: number = 0): Promise<string> {
    // In a real implementation, would use inquirer or similar
    logger.info(`PROMPT: ${message}`)
    logger.info(`  Choices: ${choices.join(', ')}`)
    return choices[defaultIndex] || choices[0]
  }

  /**
   * Ask for approval before destructive operation
   */
  async askForApproval(
    operation: string,
    details: Record<string, unknown> = {}
  ): Promise<boolean> {
    logger.warn(`APPROVAL REQUIRED: ${operation}`)

    // Log details
    if (Object.keys(details).length > 0) {
      logger.info(`Details: ${JSON.stringify(details, null, 2)}`)
    }

    // In production, would prompt user
    // For now, return false to prevent destructive operations
    return false
  }

  /**
   * Suggest next steps based on operation result
   */
  suggestNextSteps(context: {
    operation: string
    success: boolean
    error?: string
    data?: unknown
  }): string[] {
    const suggestions: string[] = []

    if (!context.success) {
      if (context.error?.includes('timeout')) {
        suggestions.push('Check network connectivity')
        suggestions.push('Verify service is running (agentic-sdlc health)')
        suggestions.push('Increase timeout with --timeout flag')
      }

      if (context.error?.includes('connection')) {
        suggestions.push('Ensure services are started (agentic-sdlc start)')
        suggestions.push('Check if ports are available')
        suggestions.push('Review service logs (agentic-sdlc logs)')
      }

      if (context.error?.includes('authentication')) {
        suggestions.push('Check API credentials')
        suggestions.push('Review environment configuration (agentic-sdlc config:show)')
      }
    }

    if (suggestions.length === 0) {
      suggestions.push('Review command documentation with --help')
      suggestions.push('Check CLI logs (agentic-sdlc logs --service cli)')
    }

    return suggestions
  }

  /**
   * Find recovery strategy for error
   */
  private findRecoveryStrategy(error: Error): RecoveryStrategy | undefined {
    for (const strategy of this.recoveryStrategies.values()) {
      if (strategy.shouldHandle(error)) {
        return strategy
      }
    }
    return undefined
  }

  /**
   * Calculate backoff with exponential increase and jitter
   */
  private calculateBackoff(
    attempt: number,
    baseMs: number,
    maxMs: number,
    multiplier: number,
    jitterFactor: number
  ): number {
    // Exponential backoff: base * (multiplier ^ (attempt - 1))
    const exponentialBackoff = baseMs * Math.pow(multiplier, attempt - 1)

    // Cap at max backoff
    const cappedBackoff = Math.min(exponentialBackoff, maxMs)

    // Add jitter: ±jitterFactor * backoff
    const jitter = cappedBackoff * (Math.random() * 2 * jitterFactor - jitterFactor)

    return Math.max(Math.round(cappedBackoff + jitter), baseMs)
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Create a timeout promise that rejects after specified time
   */
  private createTimeoutPromise<T>(ms: number): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${ms}ms`))
      }, ms)
    })
  }

  /**
   * Get statistics about retry attempts
   */
  getRetryStatistics(): {
    strategies: string[]
    defaultMaxAttempts: number
    defaultBackoffMs: number
  } {
    return {
      strategies: Array.from(this.recoveryStrategies.keys()),
      defaultMaxAttempts: this.retryDefaults.maxAttempts || 3,
      defaultBackoffMs: this.retryDefaults.backoffMs || 1000,
    }
  }
}
