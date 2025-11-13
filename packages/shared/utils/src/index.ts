/**
 * @agentic-sdlc/shared-utils
 * Utility functions for resilience and error handling
 */

// Retry utilities
export {
  retry,
  retryWithMetadata,
  createRetryable,
  RetryPresets,
  RetryError,
  type RetryOptions,
  type RetryMetadata
} from './retry';

// Circuit breaker
export {
  CircuitBreaker,
  createCircuitBreaker,
  CircuitState,
  CircuitBreakerError,
  type CircuitBreakerOptions,
  type CircuitStats
} from './circuit-breaker';

// Redis subscription
export {
  RobustRedisSubscriber,
  createRobustRedisSubscriber,
  type RedisSubscriptionConfig
} from './redis-subscription';

// Error handling utilities
export {
  ErrorHandler,
  toErrorMessage,
  safeErrorLog,
  type ErrorInfo,
  type Logger
} from './error-handler';
