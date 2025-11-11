/**
 * Redis Key-Value Store Adapter
 *
 * Implements IKVStore using Redis for:
 * - Atomic operations (GET, SET, DEL, INCR)
 * - Compare-and-swap (CAS) with Lua scripts
 * - Idempotency tracking
 * - Distributed locking state
 * - JSON serialization/deserialization
 *
 * Session #40: node-redis v4 integration
 */

import { type RedisClientType } from 'redis';
import { IKVStore } from '../ports/kv-store.port';
import { createLogger } from '../core/logger';

const log = createLogger('redis-kv');

/**
 * Lua script for atomic compare-and-swap
 * Returns 1 if swap succeeded, 0 if value didn't match
 */
const CAS_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  redis.call('SET', KEYS[1], ARGV[2])
  if ARGV[3] ~= '' then
    redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))
  end
  return 1
else
  return 0
end
`;

/**
 * Create a Redis-based key-value store from a base client
 */
export function makeRedisKV(base: any, namespace?: string): IKVStore {
  const ns = (key: string) => (namespace ? `${namespace}:${key}` : key);

  log.info('KV store initialized', { namespace });

  return {
    async get<T = any>(key: string): Promise<T | null> {
      try {
        const nsKey = ns(key);
        const raw = await base.get(nsKey);

        if (!raw) return null;

        try {
          return JSON.parse(raw) as T;
        } catch {
          // Fallback: treat as string if JSON parse fails
          return (raw as unknown) as T;
        }
      } catch (e) {
        log.error('Get error', { key, error: String(e) });
        throw e;
      }
    },

    async set<T = any>(key: string, value: T, ttlSec?: number): Promise<void> {
      try {
        const nsKey = ns(key);
        const serialized = JSON.stringify(value);

        if (ttlSec) {
          await base.setEx(nsKey, ttlSec, serialized);
        } else {
          await base.set(nsKey, serialized);
        }

        log.info('Set', { key, ttl: ttlSec, hasValue: !!value });
      } catch (e) {
        log.error('Set error', { key, error: String(e) });
        throw e;
      }
    },

    async del(key: string): Promise<void> {
      try {
        const nsKey = ns(key);
        await base.del(nsKey);
        log.info('Deleted', { key });
      } catch (e) {
        log.error('Del error', { key, error: String(e) });
        throw e;
      }
    },

    async incr(key: string): Promise<number> {
      try {
        const nsKey = ns(key);
        const result = await base.incr(nsKey);
        log.info('Incremented', { key, newValue: result });
        return result;
      } catch (e) {
        log.error('Incr error', { key, error: String(e) });
        throw e;
      }
    },

    async cas<T = any>(key: string, expected: T, newValue: T): Promise<boolean> {
      try {
        const nsKey = ns(key);
        const expectedSerialized = JSON.stringify(expected);
        const newValueSerialized = JSON.stringify(newValue);

        // Execute Lua script for atomic CAS
        const result = await (base as any).eval(CAS_SCRIPT, {
          keys: [nsKey],
          arguments: [expectedSerialized, newValueSerialized, ''],
        });

        const success = result === 1;
        log.info('CAS', { key, success });

        return success;
      } catch (e) {
        log.error('CAS error', { key, error: String(e) });
        throw e;
      }
    },

    async health(): Promise<boolean> {
      try {
        const pong = await base.ping();
        return pong === 'PONG';
      } catch (e) {
        log.error('Health check failed', { error: String(e) });
        return false;
      }
    },

    async disconnect(): Promise<void> {
      // Note: client is managed by RedisSuite, don't quit here
      log.info('KV disconnected (client managed by suite)');
    },
  };
}

/**
 * Helper: Create namespaced KV store for multi-tenancy
 */
export function makeTenantKV(base: any, tenantId: string): IKVStore {
  return makeRedisKV(base, tenantId);
}
