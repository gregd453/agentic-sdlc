/**
 * Circuit Breaker Pattern Implementation
 *
 * Protects services from cascading failures by stopping requests to failing services.
 * States: CLOSED (normal) -> OPEN (failing) -> HALF_OPEN (testing recovery) -> CLOSED
 *
 * Features:
 * - Configurable failure thresholds
 * - Automatic state transitions
 * - Success/failure rate tracking
 * - Half-open state for recovery testing
 * - Event callbacks for monitoring
 */
/**
 * Circuit breaker states
 */
export declare enum CircuitState {
    /**
     * Normal operation, requests are allowed
     */
    CLOSED = "CLOSED",
    /**
     * Circuit is open, requests are blocked
     */
    OPEN = "OPEN",
    /**
     * Testing if service has recovered, limited requests allowed
     */
    HALF_OPEN = "HALF_OPEN"
}
/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerOptions {
    /**
     * Number of failures before opening circuit
     * @default 5
     */
    failureThreshold?: number;
    /**
     * Minimum number of requests before calculating failure rate
     * @default 10
     */
    minimumRequests?: number;
    /**
     * Failure rate percentage (0-100) to open circuit
     * @default 50 (50%)
     */
    failureRateThreshold?: number;
    /**
     * Time window in milliseconds for failure rate calculation
     * @default 60000 (1 minute)
     */
    windowMs?: number;
    /**
     * Duration in milliseconds to keep circuit open before half-open
     * @default 60000 (1 minute)
     */
    openDurationMs?: number;
    /**
     * Number of successful requests in half-open to close circuit
     * @default 2
     */
    halfOpenSuccessThreshold?: number;
    /**
     * Timeout for each request in milliseconds
     * @default undefined (no timeout)
     */
    timeoutMs?: number;
    /**
     * Custom error filter to determine if error should trip circuit
     * @default undefined (all errors trip circuit)
     */
    shouldTripCircuit?: (error: unknown) => boolean;
    /**
     * Callback when circuit opens
     */
    onOpen?: () => void | Promise<void>;
    /**
     * Callback when circuit closes
     */
    onClose?: () => void | Promise<void>;
    /**
     * Callback when circuit enters half-open state
     */
    onHalfOpen?: () => void | Promise<void>;
    /**
     * Callback on each request attempt
     */
    onRequest?: (state: CircuitState) => void | Promise<void>;
    /**
     * Callback on success
     */
    onSuccess?: () => void | Promise<void>;
    /**
     * Callback on failure
     */
    onFailure?: (error: unknown) => void | Promise<void>;
}
/**
 * Circuit breaker statistics
 */
export interface CircuitStats {
    state: CircuitState;
    totalRequests: number;
    successCount: number;
    failureCount: number;
    rejectedCount: number;
    failureRate: number;
    lastFailureTime?: number;
    lastSuccessTime?: number;
    stateChangedAt: number;
}
/**
 * Circuit breaker error
 */
export declare class CircuitBreakerError extends Error {
    readonly state: CircuitState;
    readonly stats: CircuitStats;
    constructor(message: string, state: CircuitState, stats: CircuitStats);
}
/**
 * Circuit Breaker implementation
 */
export declare class CircuitBreaker {
    private options;
    private state;
    private failureCount;
    private successCount;
    private halfOpenSuccessCount;
    private rejectedCount;
    private totalRequests;
    private results;
    private stateChangedAt;
    private lastFailureTime?;
    private lastSuccessTime?;
    private nextAttemptTime?;
    constructor(options?: CircuitBreakerOptions);
    /**
     * Execute operation with circuit breaker protection
     */
    execute<T>(operation: () => Promise<T>): Promise<T>;
    /**
     * Execute operation with timeout
     */
    private executeWithTimeout;
    /**
     * Check if circuit allows requests
     */
    private canRequest;
    /**
     * Handle successful request
     */
    private onSuccess;
    /**
     * Handle failed request
     */
    private onFailure;
    /**
     * Determine if circuit should open
     */
    private shouldOpenCircuit;
    /**
     * Record request result
     */
    private recordResult;
    /**
     * Get recent results within time window
     */
    private getRecentResults;
    /**
     * Clean up results outside time window
     */
    private cleanupOldResults;
    /**
     * Transition to a new state
     */
    private transitionTo;
    /**
     * Get current circuit statistics
     */
    getStats(): CircuitStats;
    /**
     * Get current state
     */
    getState(): CircuitState;
    /**
     * Manually reset circuit to closed state
     */
    reset(): void;
    /**
     * Manually open circuit
     */
    open(): void;
    /**
     * Manually close circuit
     */
    close(): void;
}
/**
 * Create a circuit breaker wrapper for a function
 *
 * @example
 * ```typescript
 * const protectedFetch = createCircuitBreaker(
 *   (url: string) => fetch(url).then(r => r.json()),
 *   { failureThreshold: 5, openDurationMs: 30000 }
 * );
 *
 * const data = await protectedFetch('https://api.example.com/data');
 * ```
 */
export declare function createCircuitBreaker<TArgs extends any[], TResult>(fn: (...args: TArgs) => Promise<TResult>, options?: CircuitBreakerOptions): {
    execute: (...args: TArgs) => Promise<TResult>;
    breaker: CircuitBreaker;
};
//# sourceMappingURL=circuit-breaker.d.ts.map