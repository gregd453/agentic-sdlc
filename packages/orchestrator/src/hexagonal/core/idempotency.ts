/**
 * Idempotency Utilities
 *
 * Ensures operations are executed exactly once, even if called multiple times.
 * Critical for distributed systems where network retries are expected.
 *
 * Session #38: Works with any KV store implementation
 */

import type { IKVStore } from '../ports/kv-store.port';

/**
 * Idempotent execution: runs function only if key hasn't been seen
 *
 * @param store - KV store for tracking seen keys
 * @param key - Unique key for this operation (e.g., "task:123:execute")
 * @param fn - Function to execute if key is new
 * @param ttlSec - How long to remember this key (default: 3600s)
 * @returns Result from fn, or null if already executed
 */
export async function once<T>(
  store: IKVStore,
  key: string,
  fn: () => Promise<T>,
  ttlSec = 3600
): Promise<T | null> {
  // Check if already executed
  const existing = await store.get<boolean>(key);
  if (existing) {
    return null;
  }

  // Execute and mark as done
  const result = await fn();
  await store.set(key, true, ttlSec);
  return result;
}

/**
 * Track event deduplication by envelope ID
 * Used to prevent processing duplicate messages
 *
 * @param store - KV store for tracking seen events
 * @param eventId - Unique event identifier
 * @param ttlSec - How long to remember this event (default: 24 hours)
 * @returns true if event is new, false if already processed
 */
export async function deduplicateEvent(
  store: IKVStore,
  eventId: string,
  ttlSec = 86400 // 24 hours
): Promise<boolean> {
  const key = `seen:${eventId}`;
  const alreadySeen = await store.get<boolean>(key);
  if (alreadySeen) {
    return false; // Already processed
  }
  await store.set(key, true, ttlSec);
  return true; // New event
}
