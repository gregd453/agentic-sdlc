/**
 * Retry Utility with Exponential Backoff
 *
 * Provides configurable retry logic for operations that may fail transiently.
 * Supports:
 * - Exponential backoff with jitter
 * - Custom retry conditions
 * - Timeout per attempt
 * - Detailed retry metadata
 */

/**
 * Retry options configuration
 */
export interface RetryOptions {
  /**
   * Maximum number of retry attempts
   * @default 3
   */
  maxAttempts?: number;

  /**
   * Initial delay in milliseconds before first retry
   * @default 1000 (1 second)
   */
  initialDelayMs?: number;

  /**
   * Maximum delay in milliseconds between retries
   * @default 30000 (30 seconds)
   */
  maxDelayMs?: number;

  /**
   * Backoff multiplier for exponential backoff
   * @default 2
   */
  backoffMultiplier?: number;

  /**
   * Whether to add jitter to prevent thundering herd
   * @default true
   */
  enableJitter?: boolean;

  /**
   * Jitter factor (0-1, where 1 = up to 100% jitter)
   * @default 0.1 (10%)
   */
  jitterFactor?: number;

  /**
   * Timeout for each attempt in milliseconds
   * @default undefined (no timeout)
   */
  timeoutMs?: number;

  /**
   * Custom function to determine if error should be retried
   * @default undefined (retry all errors)
   */
  shouldRetry?: (error: unknown, attempt: number) => boolean | Promise<boolean>;

  /**
   * Callback invoked before each retry
   * @default undefined
   */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void | Promise<void>;

  /**
   * Callback invoked when all retries are exhausted
   * @default undefined
   */
  onMaxRetriesReached?: (error: unknown, attempts: number) => void | Promise<void>;
}

/**
 * Retry result metadata
 */
export interface RetryMetadata {
  /**
   * Number of attempts made (including initial)
   */
  attempts: number;

  /**
   * Total time spent retrying in milliseconds
   */
  totalDurationMs: number;

  /**
   * Whether operation succeeded
   */
  success: boolean;

  /**
   * Final error if operation failed
   */
  error?: unknown;
}

/**
 * Retry error with metadata
 */
export class RetryError extends Error {
  public readonly attempts: number;
  public readonly totalDurationMs: number;
  public readonly lastError: unknown;

  constructor(message: string, attempts: number, totalDurationMs: number, lastError: unknown) {
    super(message);
    this.name = 'RetryError';
    this.attempts = attempts;
    this.totalDurationMs = totalDurationMs;
    this.lastError = lastError;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RetryError);
    }
  }
}

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  backoffMultiplier: number,
  enableJitter: boolean,
  jitterFactor: number
): number {
  // Calculate exponential backoff: initialDelay * (multiplier ^ attempt)
  const exponentialDelay = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1);

  // Cap at max delay
  let delay = Math.min(exponentialDelay, maxDelayMs);

  // Add jitter if enabled
  if (enableJitter) {
    const jitterRange = delay * jitterFactor;
    const jitter = Math.random() * jitterRange;
    delay = delay - jitterRange / 2 + jitter;
  }

  return Math.max(0, Math.floor(delay));
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute operation with timeout
 */
async function executeWithTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    operation(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

/**
 * Retry an async operation with exponential backoff
 *
 * @example
 * ```typescript
 * const result = await retry(
 *   async () => {
 *     const response = await fetch('https://api.example.com/data');
 *     return response.json();
 *   },
 *   {
 *     maxAttempts: 5,
 *     initialDelayMs: 1000,
 *     maxDelayMs: 30000,
 *     shouldRetry: (error) => error instanceof NetworkError,
 *     onRetry: (error, attempt, delay) => {
 *       console.log(`Retry attempt ${attempt} after ${delay}ms:`, error);
 *     }
 *   }
 * );
 * ```
 */
export async function retry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffMultiplier = 2,
    enableJitter = true,
    jitterFactor = 0.1,
    timeoutMs,
    shouldRetry,
    onRetry,
    onMaxRetriesReached
  } = options;

  const startTime = Date.now();
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Execute operation with optional timeout
      const result = timeoutMs
        ? await executeWithTimeout(operation, timeoutMs)
        : await operation();

      // Success!
      return result;
    } catch (error) {
      lastError = error;

      // Check if this is the last attempt
      const isLastAttempt = attempt >= maxAttempts;

      if (isLastAttempt) {
        // No more retries, invoke callback if provided
        if (onMaxRetriesReached) {
          await onMaxRetriesReached(error, attempt);
        }

        // Throw RetryError with metadata
        const totalDurationMs = Date.now() - startTime;
        throw new RetryError(
          `Operation failed after ${attempt} attempts (${totalDurationMs}ms)`,
          attempt,
          totalDurationMs,
          error
        );
      }

      // Check if error should be retried
      if (shouldRetry) {
        const shouldRetryResult = await shouldRetry(error, attempt);
        if (!shouldRetryResult) {
          // Don't retry this error
          throw error;
        }
      }

      // Calculate delay for next attempt
      const delayMs = calculateDelay(
        attempt,
        initialDelayMs,
        maxDelayMs,
        backoffMultiplier,
        enableJitter,
        jitterFactor
      );

      // Invoke retry callback if provided
      if (onRetry) {
        await onRetry(error, attempt, delayMs);
      }

      // Wait before next attempt
      await sleep(delayMs);
    }
  }

  // This should never be reached due to throw in loop, but TypeScript requires it
  throw new RetryError(
    'Operation failed after all retry attempts',
    maxAttempts,
    Date.now() - startTime,
    lastError
  );
}

/**
 * Retry an async operation and return result with metadata
 *
 * @example
 * ```typescript
 * const { result, metadata } = await retryWithMetadata(
 *   async () => fetchData(),
 *   { maxAttempts: 3 }
 * );
 * console.log(`Succeeded after ${metadata.attempts} attempts`);
 * ```
 */
export async function retryWithMetadata<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<{ result: T; metadata: RetryMetadata }> {
  const startTime = Date.now();
  let attempts = 0;
  let lastError: unknown;

  try {
    const result = await retry(
      async () => {
        attempts++;
        return operation();
      },
      options
    );

    return {
      result,
      metadata: {
        attempts,
        totalDurationMs: Date.now() - startTime,
        success: true
      }
    };
  } catch (error) {
    lastError = error;

    if (error instanceof RetryError) {
      attempts = error.attempts;
    }

    return {
      result: undefined as any, // Will throw below
      metadata: {
        attempts,
        totalDurationMs: Date.now() - startTime,
        success: false,
        error: lastError
      }
    } as never; // Never returns, always throws
  } finally {
    if (lastError) {
      throw lastError;
    }
  }
}

/**
 * Create a retry wrapper function with pre-configured options
 *
 * @example
 * ```typescript
 * const retryableFetch = createRetryable(
 *   (url: string) => fetch(url).then(r => r.json()),
 *   { maxAttempts: 5, initialDelayMs: 2000 }
 * );
 *
 * const data = await retryableFetch('https://api.example.com/data');
 * ```
 */
export function createRetryable<TArgs extends any[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: RetryOptions = {}
): (...args: TArgs) => Promise<TResult> {
  return (...args: TArgs) => retry(() => fn(...args), options);
}

/**
 * Default retry options for common scenarios
 */
export const RetryPresets = {
  /**
   * Quick retry for fast operations (3 attempts, 1s initial delay)
   */
  quick: {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 5000,
    backoffMultiplier: 2
  } as RetryOptions,

  /**
   * Standard retry for most operations (3 attempts, 2s initial delay)
   */
  standard: {
    maxAttempts: 3,
    initialDelayMs: 2000,
    maxDelayMs: 30000,
    backoffMultiplier: 2
  } as RetryOptions,

  /**
   * Aggressive retry for critical operations (5 attempts, 1s initial delay)
   */
  aggressive: {
    maxAttempts: 5,
    initialDelayMs: 1000,
    maxDelayMs: 60000,
    backoffMultiplier: 2.5
  } as RetryOptions,

  /**
   * Patient retry for slow operations (3 attempts, 5s initial delay)
   */
  patient: {
    maxAttempts: 3,
    initialDelayMs: 5000,
    maxDelayMs: 120000,
    backoffMultiplier: 3
  } as RetryOptions,

  /**
   * Network retry with jitter (5 attempts, optimized for network calls)
   */
  network: {
    maxAttempts: 5,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    enableJitter: true,
    jitterFactor: 0.2
  } as RetryOptions
};
