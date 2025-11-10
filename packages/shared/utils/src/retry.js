"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetryPresets = exports.RetryError = void 0;
exports.retry = retry;
exports.retryWithMetadata = retryWithMetadata;
exports.createRetryable = createRetryable;
/**
 * Retry error with metadata
 */
class RetryError extends Error {
    attempts;
    totalDurationMs;
    lastError;
    constructor(message, attempts, totalDurationMs, lastError) {
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
exports.RetryError = RetryError;
/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(attempt, initialDelayMs, maxDelayMs, backoffMultiplier, enableJitter, jitterFactor) {
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
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Execute operation with timeout
 */
async function executeWithTimeout(operation, timeoutMs) {
    return Promise.race([
        operation(),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs))
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
async function retry(operation, options = {}) {
    const { maxAttempts = 3, initialDelayMs = 1000, maxDelayMs = 30000, backoffMultiplier = 2, enableJitter = true, jitterFactor = 0.1, timeoutMs, shouldRetry, onRetry, onMaxRetriesReached } = options;
    const startTime = Date.now();
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            // Execute operation with optional timeout
            const result = timeoutMs
                ? await executeWithTimeout(operation, timeoutMs)
                : await operation();
            // Success!
            return result;
        }
        catch (error) {
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
                throw new RetryError(`Operation failed after ${attempt} attempts (${totalDurationMs}ms)`, attempt, totalDurationMs, error);
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
            const delayMs = calculateDelay(attempt, initialDelayMs, maxDelayMs, backoffMultiplier, enableJitter, jitterFactor);
            // Invoke retry callback if provided
            if (onRetry) {
                await onRetry(error, attempt, delayMs);
            }
            // Wait before next attempt
            await sleep(delayMs);
        }
    }
    // This should never be reached due to throw in loop, but TypeScript requires it
    throw new RetryError('Operation failed after all retry attempts', maxAttempts, Date.now() - startTime, lastError);
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
async function retryWithMetadata(operation, options = {}) {
    const startTime = Date.now();
    let attempts = 0;
    let lastError;
    try {
        const result = await retry(async () => {
            attempts++;
            return operation();
        }, options);
        return {
            result,
            metadata: {
                attempts,
                totalDurationMs: Date.now() - startTime,
                success: true
            }
        };
    }
    catch (error) {
        lastError = error;
        if (error instanceof RetryError) {
            attempts = error.attempts;
        }
        return {
            result: undefined, // Will throw below
            metadata: {
                attempts,
                totalDurationMs: Date.now() - startTime,
                success: false,
                error: lastError
            }
        }; // Never returns, always throws
    }
    finally {
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
function createRetryable(fn, options = {}) {
    return (...args) => retry(() => fn(...args), options);
}
/**
 * Default retry options for common scenarios
 */
exports.RetryPresets = {
    /**
     * Quick retry for fast operations (3 attempts, 1s initial delay)
     */
    quick: {
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 5000,
        backoffMultiplier: 2
    },
    /**
     * Standard retry for most operations (3 attempts, 2s initial delay)
     */
    standard: {
        maxAttempts: 3,
        initialDelayMs: 2000,
        maxDelayMs: 30000,
        backoffMultiplier: 2
    },
    /**
     * Aggressive retry for critical operations (5 attempts, 1s initial delay)
     */
    aggressive: {
        maxAttempts: 5,
        initialDelayMs: 1000,
        maxDelayMs: 60000,
        backoffMultiplier: 2.5
    },
    /**
     * Patient retry for slow operations (3 attempts, 5s initial delay)
     */
    patient: {
        maxAttempts: 3,
        initialDelayMs: 5000,
        maxDelayMs: 120000,
        backoffMultiplier: 3
    },
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
    }
};
//# sourceMappingURL=retry.js.map