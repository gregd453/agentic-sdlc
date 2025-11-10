"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreaker = exports.CircuitBreakerError = exports.CircuitState = void 0;
exports.createCircuitBreaker = createCircuitBreaker;
/**
 * Circuit breaker states
 */
var CircuitState;
(function (CircuitState) {
    /**
     * Normal operation, requests are allowed
     */
    CircuitState["CLOSED"] = "CLOSED";
    /**
     * Circuit is open, requests are blocked
     */
    CircuitState["OPEN"] = "OPEN";
    /**
     * Testing if service has recovered, limited requests allowed
     */
    CircuitState["HALF_OPEN"] = "HALF_OPEN";
})(CircuitState || (exports.CircuitState = CircuitState = {}));
/**
 * Circuit breaker error
 */
class CircuitBreakerError extends Error {
    state;
    stats;
    constructor(message, state, stats) {
        super(message);
        this.name = 'CircuitBreakerError';
        this.state = state;
        this.stats = stats;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, CircuitBreakerError);
        }
    }
}
exports.CircuitBreakerError = CircuitBreakerError;
/**
 * Circuit Breaker implementation
 */
class CircuitBreaker {
    options;
    state = CircuitState.CLOSED;
    failureCount = 0;
    successCount = 0;
    halfOpenSuccessCount = 0;
    rejectedCount = 0;
    totalRequests = 0;
    results = [];
    stateChangedAt = Date.now();
    lastFailureTime;
    lastSuccessTime;
    nextAttemptTime;
    constructor(options = {}) {
        this.options = options;
        // Set defaults
        this.options = {
            failureThreshold: 5,
            minimumRequests: 10,
            failureRateThreshold: 50,
            windowMs: 60000,
            openDurationMs: 60000,
            halfOpenSuccessThreshold: 2,
            ...options
        };
    }
    /**
     * Execute operation with circuit breaker protection
     */
    async execute(operation) {
        // Check if circuit allows request
        if (!this.canRequest()) {
            this.rejectedCount++;
            throw new CircuitBreakerError(`Circuit breaker is ${this.state}. Request rejected.`, this.state, this.getStats());
        }
        this.totalRequests++;
        // Invoke request callback
        if (this.options.onRequest) {
            await this.options.onRequest(this.state);
        }
        const startTime = Date.now();
        try {
            // Execute operation with optional timeout
            const result = this.options.timeoutMs
                ? await this.executeWithTimeout(operation, this.options.timeoutMs)
                : await operation();
            // Record success
            await this.onSuccess();
            return result;
        }
        catch (error) {
            // Record failure
            await this.onFailure(error);
            throw error;
        }
    }
    /**
     * Execute operation with timeout
     */
    async executeWithTimeout(operation, timeoutMs) {
        return Promise.race([
            operation(),
            new Promise((_, reject) => setTimeout(() => reject(new Error(`Circuit breaker timeout after ${timeoutMs}ms`)), timeoutMs))
        ]);
    }
    /**
     * Check if circuit allows requests
     */
    canRequest() {
        const now = Date.now();
        switch (this.state) {
            case CircuitState.CLOSED:
                return true;
            case CircuitState.OPEN:
                // Check if it's time to transition to half-open
                if (this.nextAttemptTime && now >= this.nextAttemptTime) {
                    this.transitionTo(CircuitState.HALF_OPEN);
                    return true;
                }
                return false;
            case CircuitState.HALF_OPEN:
                // Allow limited requests in half-open state
                return true;
            default:
                return false;
        }
    }
    /**
     * Handle successful request
     */
    async onSuccess() {
        this.successCount++;
        this.lastSuccessTime = Date.now();
        this.recordResult(true);
        // Invoke success callback
        if (this.options.onSuccess) {
            await this.options.onSuccess();
        }
        // Check state transitions
        if (this.state === CircuitState.HALF_OPEN) {
            this.halfOpenSuccessCount++;
            // Transition to closed if enough successes in half-open
            if (this.halfOpenSuccessCount >= (this.options.halfOpenSuccessThreshold || 2)) {
                this.transitionTo(CircuitState.CLOSED);
            }
        }
    }
    /**
     * Handle failed request
     */
    async onFailure(error) {
        // Check if this error should trip the circuit
        if (this.options.shouldTripCircuit && !this.options.shouldTripCircuit(error)) {
            // Don't count this error towards circuit breaking
            return;
        }
        this.failureCount++;
        this.lastFailureTime = Date.now();
        this.recordResult(false);
        // Invoke failure callback
        if (this.options.onFailure) {
            await this.options.onFailure(error);
        }
        // Check state transitions
        if (this.state === CircuitState.HALF_OPEN) {
            // Any failure in half-open transitions back to open
            this.transitionTo(CircuitState.OPEN);
        }
        else if (this.state === CircuitState.CLOSED) {
            // Check if we should open the circuit
            if (this.shouldOpenCircuit()) {
                this.transitionTo(CircuitState.OPEN);
            }
        }
    }
    /**
     * Determine if circuit should open
     */
    shouldOpenCircuit() {
        const recentResults = this.getRecentResults();
        // Check failure count threshold
        const recentFailures = recentResults.filter(r => !r.success).length;
        if (recentFailures >= (this.options.failureThreshold || 5)) {
            return true;
        }
        // Check failure rate threshold
        if (recentResults.length >= (this.options.minimumRequests || 10)) {
            const failureRate = (recentFailures / recentResults.length) * 100;
            if (failureRate >= (this.options.failureRateThreshold || 50)) {
                return true;
            }
        }
        return false;
    }
    /**
     * Record request result
     */
    recordResult(success) {
        this.results.push({
            success,
            timestamp: Date.now()
        });
        // Clean up old results outside the time window
        this.cleanupOldResults();
    }
    /**
     * Get recent results within time window
     */
    getRecentResults() {
        const now = Date.now();
        const windowMs = this.options.windowMs || 60000;
        return this.results.filter(r => now - r.timestamp <= windowMs);
    }
    /**
     * Clean up results outside time window
     */
    cleanupOldResults() {
        const now = Date.now();
        const windowMs = this.options.windowMs || 60000;
        this.results = this.results.filter(r => now - r.timestamp <= windowMs);
    }
    /**
     * Transition to a new state
     */
    transitionTo(newState) {
        const oldState = this.state;
        this.state = newState;
        this.stateChangedAt = Date.now();
        // Reset counters based on new state
        if (newState === CircuitState.CLOSED) {
            this.failureCount = 0;
            this.halfOpenSuccessCount = 0;
            this.nextAttemptTime = undefined;
            // Invoke close callback
            if (this.options.onClose) {
                this.options.onClose();
            }
        }
        else if (newState === CircuitState.OPEN) {
            this.halfOpenSuccessCount = 0;
            this.nextAttemptTime = Date.now() + (this.options.openDurationMs || 60000);
            // Invoke open callback
            if (this.options.onOpen) {
                this.options.onOpen();
            }
        }
        else if (newState === CircuitState.HALF_OPEN) {
            this.halfOpenSuccessCount = 0;
            // Invoke half-open callback
            if (this.options.onHalfOpen) {
                this.options.onHalfOpen();
            }
        }
    }
    /**
     * Get current circuit statistics
     */
    getStats() {
        const recentResults = this.getRecentResults();
        const recentFailures = recentResults.filter(r => !r.success).length;
        const failureRate = recentResults.length > 0
            ? (recentFailures / recentResults.length) * 100
            : 0;
        return {
            state: this.state,
            totalRequests: this.totalRequests,
            successCount: this.successCount,
            failureCount: this.failureCount,
            rejectedCount: this.rejectedCount,
            failureRate,
            lastFailureTime: this.lastFailureTime,
            lastSuccessTime: this.lastSuccessTime,
            stateChangedAt: this.stateChangedAt
        };
    }
    /**
     * Get current state
     */
    getState() {
        return this.state;
    }
    /**
     * Manually reset circuit to closed state
     */
    reset() {
        this.transitionTo(CircuitState.CLOSED);
        this.failureCount = 0;
        this.successCount = 0;
        this.halfOpenSuccessCount = 0;
        this.rejectedCount = 0;
        this.totalRequests = 0;
        this.results = [];
        this.lastFailureTime = undefined;
        this.lastSuccessTime = undefined;
    }
    /**
     * Manually open circuit
     */
    open() {
        this.transitionTo(CircuitState.OPEN);
    }
    /**
     * Manually close circuit
     */
    close() {
        this.transitionTo(CircuitState.CLOSED);
    }
}
exports.CircuitBreaker = CircuitBreaker;
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
function createCircuitBreaker(fn, options = {}) {
    const breaker = new CircuitBreaker(options);
    return {
        execute: (...args) => breaker.execute(() => fn(...args)),
        breaker
    };
}
//# sourceMappingURL=circuit-breaker.js.map