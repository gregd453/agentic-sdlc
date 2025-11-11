/**
 * Key-Value Store Port (Interface)
 *
 * Abstraction for atomic KV operations.
 * Used for idempotency, caching, and state tracking.
 *
 * Implementations: Redis, Memcached, DynamoDB, etc.
 */

/**
 * KV Store Port
 *
 * Implementations must provide:
 * - Atomic reads/writes
 * - TTL support for automatic expiry
 * - Comparison-and-swap (CAS) for conflict-free updates
 */
export interface IKVStore {
  /**
   * Get a value by key
   *
   * @param key - Key to retrieve
   * @returns Value or null if not found
   */
  get<T = any>(key: string): Promise<T | null>;

  /**
   * Set a value with optional TTL
   *
   * @param key - Key to set
   * @param value - Value to store
   * @param ttlSec - Optional time-to-live in seconds
   */
  set<T = any>(key: string, value: T, ttlSec?: number): Promise<void>;

  /**
   * Delete a key
   *
   * @param key - Key to delete
   */
  del(key: string): Promise<void>;

  /**
   * Increment a numeric value (for counters)
   *
   * @param key - Key to increment
   * @returns New value after increment
   */
  incr(key: string): Promise<number>;

  /**
   * Atomic compare-and-swap (optimistic locking)
   *
   * @param key - Key to update
   * @param expected - Expected current value
   * @param newValue - New value to set
   * @returns true if swap succeeded, false if value didn't match
   */
  cas<T = any>(key: string, expected: T, newValue: T): Promise<boolean>;

  /**
   * Health check
   *
   * @returns true if store is accessible
   */
  health(): Promise<boolean>;

  /**
   * Graceful shutdown
   */
  disconnect(): Promise<void>;
}
