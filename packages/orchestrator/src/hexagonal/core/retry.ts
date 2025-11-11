/**
 * Retry with Exponential Backoff
 *
 * Provides safe, bounded retry logic for transient failures.
 * Uses exponential backoff to avoid thundering herd.
 *
 * Session #25: Replaces ad-hoc retry logic with standardized pattern.
 */

export interface RetryOptions {
  /** Maximum number of attempts */
  maxAttempts?: number;

  /** Base delay in milliseconds */
  baseDelayMs?: number;

  /** Maximum delay in milliseconds (caps exponential growth) */
  maxDelayMs?: number;

  /** Jitter factor (0.0 to 1.0) to randomize delays */
  jitterFactor?: number;

  /** Function to call on retry (for logging) */
  onRetry?: (attempt: number, error: Error, nextDelayMs: number) => void;
}

/**
 * Retry a function with exponential backoff
 *
 * @param fn - Function to retry
 * @param opts - Retry options
 * @returns Result from successful fn execution
 * @throws Last error if all attempts exhausted
 */
export async function retry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 5;
  const baseDelayMs = opts.baseDelayMs ?? 100;
  const maxDelayMs = opts.maxDelayMs ?? 30000;
  const jitterFactor = opts.jitterFactor ?? 0.1;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts) {
        // Last attempt failed
        break;
      }

      // Calculate delay with exponential backoff
      const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
      const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
      const jitter = cappedDelay * jitterFactor * Math.random();
      const nextDelayMs = cappedDelay + jitter;

      if (opts.onRetry) {
        opts.onRetry(attempt, lastError, nextDelayMs);
      }

      // Wait before next attempt
      await new Promise((resolve) => setTimeout(resolve, nextDelayMs));
    }
  }

  throw lastError;
}

/**
 * Retry with custom backoff strategy
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  backoffFn: (attempt: number) => number,
  maxAttempts = 5
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts) break;

      const delayMs = backoffFn(attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}
