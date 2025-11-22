/**
 * Timeout utility functions for orchestrator initialization
 * Based on patterns from CLI advanced features and agent implementations
 */

import { logger } from './logger';

/**
 * Execute an async function with a timeout
 * @param operation - The async operation to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param operationName - Name for logging purposes
 * @returns Promise that resolves with operation result or rejects on timeout
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    // Clean up timer if operation completes first
    if (timer.unref) timer.unref();
  });

  try {
    const result = await Promise.race([
      operation(),
      timeoutPromise
    ]);

    logger.debug(`${operationName} completed successfully within timeout`);
    return result;
  } catch (error: any) {
    if (error.message.includes('timed out')) {
      logger.error({ timeout: timeoutMs }, `${operationName} timeout exceeded`);
    }
    throw error;
  }
}

/**
 * Execute an async function with retry logic
 * @param operation - The async operation to execute
 * @param maxRetries - Maximum number of retry attempts
 * @param retryDelayMs - Delay between retries
 * @param operationName - Name for logging purposes
 * @returns Promise that resolves with operation result or rejects after all retries
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  retryDelayMs: number = 1000,
  operationName: string
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.debug(`${operationName} - Attempt ${attempt}/${maxRetries}`);
      const result = await operation();

      if (attempt > 1) {
        logger.info(`${operationName} succeeded on attempt ${attempt}`);
      }

      return result;
    } catch (error: any) {
      lastError = error;
      logger.warn(
        {
          attempt,
          maxRetries,
          error: error.message
        },
        `${operationName} failed, ${attempt < maxRetries ? 'retrying...' : 'no more retries'}`
      );

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  throw lastError!;
}

/**
 * Execute an async function with both timeout and retry
 * @param operation - The async operation to execute
 * @param config - Configuration for timeout and retry
 * @returns Promise that resolves with operation result or rejects after timeout/retries
 */
export async function withTimeoutAndRetry<T>(
  operation: () => Promise<T>,
  config: {
    timeoutMs: number;
    maxRetries?: number;
    retryDelayMs?: number;
    operationName: string;
  }
): Promise<T> {
  const { timeoutMs, maxRetries = 1, retryDelayMs = 1000, operationName } = config;

  if (maxRetries > 1) {
    return withRetry(
      () => withTimeout(operation, timeoutMs, operationName),
      maxRetries,
      retryDelayMs,
      operationName
    );
  } else {
    return withTimeout(operation, timeoutMs, operationName);
  }
}

/**
 * Try to execute an operation with a timeout, but continue on failure
 * @param operation - The async operation to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param operationName - Name for logging purposes
 * @param fallbackValue - Value to return on failure
 * @returns Promise that always resolves (with result or fallback)
 */
export async function tryWithTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  operationName: string,
  fallbackValue: T
): Promise<T> {
  try {
    return await withTimeout(operation, timeoutMs, operationName);
  } catch (error: any) {
    logger.warn(
      { error: error.message },
      `${operationName} failed or timed out, using fallback`
    );
    return fallbackValue;
  }
}