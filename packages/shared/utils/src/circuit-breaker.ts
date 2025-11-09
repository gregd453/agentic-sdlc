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
export enum CircuitState {
  /**
   * Normal operation, requests are allowed
   */
  CLOSED = 'CLOSED',

  /**
   * Circuit is open, requests are blocked
   */
  OPEN = 'OPEN',

  /**
   * Testing if service has recovered, limited requests allowed
   */
  HALF_OPEN = 'HALF_OPEN'
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
 * Request result tracking
 */
interface RequestResult {
  success: boolean;
  timestamp: number;
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
export class CircuitBreakerError extends Error {
  public readonly state: CircuitState;
  public readonly stats: CircuitStats;

  constructor(message: string, state: CircuitState, stats: CircuitStats) {
    super(message);
    this.name = 'CircuitBreakerError';
    this.state = state;
    this.stats = stats;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CircuitBreakerError);
    }
  }
}

/**
 * Circuit Breaker implementation
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private halfOpenSuccessCount = 0;
  private rejectedCount = 0;
  private totalRequests = 0;
  private results: RequestResult[] = [];
  private stateChangedAt = Date.now();
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private nextAttemptTime?: number;

  constructor(private options: CircuitBreakerOptions = {}) {
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
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check if circuit allows request
    if (!this.canRequest()) {
      this.rejectedCount++;
      throw new CircuitBreakerError(
        `Circuit breaker is ${this.state}. Request rejected.`,
        this.state,
        this.getStats()
      );
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
    } catch (error) {
      // Record failure
      await this.onFailure(error);

      throw error;
    }
  }

  /**
   * Execute operation with timeout
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Circuit breaker timeout after ${timeoutMs}ms`)),
          timeoutMs
        )
      )
    ]);
  }

  /**
   * Check if circuit allows requests
   */
  private canRequest(): boolean {
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
  private async onSuccess(): Promise<void> {
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
      if (
        this.halfOpenSuccessCount >= (this.options.halfOpenSuccessThreshold || 2)
      ) {
        this.transitionTo(CircuitState.CLOSED);
      }
    }
  }

  /**
   * Handle failed request
   */
  private async onFailure(error: unknown): Promise<void> {
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
    } else if (this.state === CircuitState.CLOSED) {
      // Check if we should open the circuit
      if (this.shouldOpenCircuit()) {
        this.transitionTo(CircuitState.OPEN);
      }
    }
  }

  /**
   * Determine if circuit should open
   */
  private shouldOpenCircuit(): boolean {
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
  private recordResult(success: boolean): void {
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
  private getRecentResults(): RequestResult[] {
    const now = Date.now();
    const windowMs = this.options.windowMs || 60000;

    return this.results.filter(r => now - r.timestamp <= windowMs);
  }

  /**
   * Clean up results outside time window
   */
  private cleanupOldResults(): void {
    const now = Date.now();
    const windowMs = this.options.windowMs || 60000;

    this.results = this.results.filter(r => now - r.timestamp <= windowMs);
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
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
    } else if (newState === CircuitState.OPEN) {
      this.halfOpenSuccessCount = 0;
      this.nextAttemptTime = Date.now() + (this.options.openDurationMs || 60000);

      // Invoke open callback
      if (this.options.onOpen) {
        this.options.onOpen();
      }
    } else if (newState === CircuitState.HALF_OPEN) {
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
  getStats(): CircuitStats {
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
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Manually reset circuit to closed state
   */
  reset(): void {
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
  open(): void {
    this.transitionTo(CircuitState.OPEN);
  }

  /**
   * Manually close circuit
   */
  close(): void {
    this.transitionTo(CircuitState.CLOSED);
  }
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
export function createCircuitBreaker<TArgs extends any[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: CircuitBreakerOptions = {}
): {
  execute: (...args: TArgs) => Promise<TResult>;
  breaker: CircuitBreaker;
} {
  const breaker = new CircuitBreaker(options);

  return {
    execute: (...args: TArgs) => breaker.execute(() => fn(...args)),
    breaker
  };
}
