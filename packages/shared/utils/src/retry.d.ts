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
export declare class RetryError extends Error {
    readonly attempts: number;
    readonly totalDurationMs: number;
    readonly lastError: unknown;
    constructor(message: string, attempts: number, totalDurationMs: number, lastError: unknown);
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
export declare function retry<T>(operation: () => Promise<T>, options?: RetryOptions): Promise<T>;
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
export declare function retryWithMetadata<T>(operation: () => Promise<T>, options?: RetryOptions): Promise<{
    result: T;
    metadata: RetryMetadata;
}>;
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
export declare function createRetryable<TArgs extends any[], TResult>(fn: (...args: TArgs) => Promise<TResult>, options?: RetryOptions): (...args: TArgs) => Promise<TResult>;
/**
 * Default retry options for common scenarios
 */
export declare const RetryPresets: {
    /**
     * Quick retry for fast operations (3 attempts, 1s initial delay)
     */
    quick: RetryOptions;
    /**
     * Standard retry for most operations (3 attempts, 2s initial delay)
     */
    standard: RetryOptions;
    /**
     * Aggressive retry for critical operations (5 attempts, 1s initial delay)
     */
    aggressive: RetryOptions;
    /**
     * Patient retry for slow operations (3 attempts, 5s initial delay)
     */
    patient: RetryOptions;
    /**
     * Network retry with jitter (5 attempts, optimized for network calls)
     */
    network: RetryOptions;
};
//# sourceMappingURL=retry.d.ts.map