/**
 * Integration Tests - Hexagonal Architecture
 *
 * Tests the complete framework with real Redis:
 * - Message bus pub/sub
 * - KV store operations
 * - Idempotency guarantees
 * - Retry with backoff
 * - End-to-end orchestrator flow
 *
 * Session #39: Production-ready integration test suite
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { makeRedisSuite, type RedisSuite } from '../adapters/redis-suite';
import { makeRedisBus } from '../adapters/redis-bus.adapter';
import { makeRedisKV } from '../adapters/redis-kv.adapter';
import { createEnvelope, retryEnvelope } from '../core/event-envelope';
import { once, deduplicateEvent } from '../core/idempotency';
import { retry } from '../core/retry';
import { createLogger } from '../core/logger';

const log = createLogger('integration-test');
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6380';
const TEST_NAMESPACE = 'hexagonal-test';

describe('Hexagonal Architecture Integration Tests', () => {
  let suite: RedisSuite;
  let bus: Awaited<ReturnType<typeof makeRedisBus>>;
  let kv: Awaited<ReturnType<typeof makeRedisKV>>;

  beforeAll(async () => {
    log.info('Setting up integration tests', { redisUrl: REDIS_URL });

    // Create Redis suite with separate clients
    suite = await makeRedisSuite(REDIS_URL);

    // Initialize adapters from suite clients
    bus = makeRedisBus(suite.pub, suite.sub);
    kv = makeRedisKV(suite.base, TEST_NAMESPACE);

    // Verify both are healthy
    const busHealth = await bus.health();
    const kvHealth = await kv.health();

    if (!busHealth.ok || !kvHealth) {
      throw new Error('Redis not available for testing. Start Redis first.');
    }

    log.info('Integration test setup complete');
  });

  afterAll(async () => {
    log.info('Tearing down integration tests');
    // Disconnect adapters
    await bus.disconnect();
    await kv.disconnect();
    // Disconnect Redis suite
    if (suite) {
      await suite.disconnect();
    }
  });

  beforeEach(async () => {
    // Clean up test keys before each test
    const testKeys = ['test:envelope', 'test:dedup', 'test:once', 'test:retry'];
    for (const key of testKeys) {
      await kv.del(key);
    }
  });

  describe('Message Bus (Pub/Sub)', () => {
    it('should publish and receive a message', async () => {
      const messages: any[] = [];

      // Subscribe
      const unsub = await bus.subscribe('test:topic', async (msg) => {
        messages.push(msg);
      });

      // Publish
      const envelope = createEnvelope('test:topic', { data: 'hello' }, 'trace-1');
      await bus.publish('test:topic', envelope);

      // Wait for message
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe(envelope.id);
      expect(messages[0].payload.data).toBe('hello');

      await unsub();
    });

    it('should handle multiple subscribers', async () => {
      const messages1: any[] = [];
      const messages2: any[] = [];

      // Subscribe twice
      const unsub1 = await bus.subscribe('test:multi', async (msg) => {
        messages1.push(msg);
      });

      const unsub2 = await bus.subscribe('test:multi', async (msg) => {
        messages2.push(msg);
      });

      // Publish
      const envelope = createEnvelope('test:multi', { data: 'shared' }, 'trace-2');
      await bus.publish('test:multi', envelope);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(messages1).toHaveLength(1);
      expect(messages2).toHaveLength(1);
      expect(messages1[0].id).toBe(messages2[0].id);

      await unsub1();
      await unsub2();
    });

    it('should handle JSON serialization', async () => {
      const messages: any[] = [];

      await bus.subscribe('test:json', async (msg) => {
        messages.push(msg);
      });

      const complexPayload = {
        nested: { array: [1, 2, 3], object: { key: 'value' } },
        timestamp: Date.now(),
        null: null,
        boolean: true,
      };

      const envelope = createEnvelope('test:json', complexPayload);
      await bus.publish('test:json', envelope);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(messages[0].nested).toEqual(complexPayload.nested);
      expect(messages[0].timestamp).toBe(complexPayload.timestamp);
    });

    it('should check health', async () => {
      const health = await bus.health();

      expect(health.ok).toBe(true);
      expect(health.latencyMs).toBeGreaterThan(0);
      expect(health.details).toBeDefined();
    });
  });

  describe('KV Store', () => {
    it('should set and get values', async () => {
      await kv.set('test:set-get', { data: 'test' });
      const value = await kv.get('test:set-get');

      expect(value).toEqual({ data: 'test' });
    });

    it('should respect TTL', async () => {
      await kv.set('test:ttl', 'short-lived', 1);

      // Should exist immediately
      let value = await kv.get('test:ttl');
      expect(value).toBe('short-lived');

      // Wait for expiry
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should be gone
      value = await kv.get('test:ttl');
      expect(value).toBeNull();
    });

    it('should delete values', async () => {
      await kv.set('test:delete', 'value');
      await kv.del('test:delete');

      const value = await kv.get('test:delete');
      expect(value).toBeNull();
    });

    it('should increment counters', async () => {
      const val1 = await kv.incr('test:counter');
      expect(val1).toBe(1);

      const val2 = await kv.incr('test:counter');
      expect(val2).toBe(2);

      const val3 = await kv.incr('test:counter');
      expect(val3).toBe(3);
    });

    it('should support CAS (compare-and-swap)', async () => {
      await kv.set('test:cas', { version: 1 });

      // CAS with correct value
      let success = await kv.cas('test:cas', { version: 1 }, { version: 2 });
      expect(success).toBe(true);

      let value = await kv.get('test:cas');
      expect(value).toEqual({ version: 2 });

      // CAS with wrong value
      success = await kv.cas('test:cas', { version: 1 }, { version: 3 });
      expect(success).toBe(false);

      value = await kv.get('test:cas');
      expect(value).toEqual({ version: 2 }); // Unchanged
    });

    it('should check health', async () => {
      const health = await kv.health();
      expect(health).toBe(true);
    });
  });

  describe('Idempotency', () => {
    it('should execute function only once', async () => {
      let executionCount = 0;

      const result1 = await once(kv, 'test:once', async () => {
        executionCount++;
        return 'result';
      });

      const result2 = await once(kv, 'test:once', async () => {
        executionCount++;
        return 'result';
      });

      const result3 = await once(kv, 'test:once', async () => {
        executionCount++;
        return 'result';
      });

      // Function should have executed once
      expect(executionCount).toBe(1);
      expect(result1).toBe('result');
      expect(result2).toBeNull();
      expect(result3).toBeNull();
    });

    it('should respect TTL for idempotency', async () => {
      let executionCount = 0;
      const key = 'test:once-ttl';

      const result1 = await once(
        kv,
        key,
        async () => {
          executionCount++;
          return 'first';
        },
        1 // 1 second TTL
      );

      expect(result1).toBe('first');
      expect(executionCount).toBe(1);

      // Wait for expiry
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const result2 = await once(
        kv,
        key,
        async () => {
          executionCount++;
          return 'second';
        },
        1
      );

      expect(result2).toBe('second');
      expect(executionCount).toBe(2);
    });

    it('should deduplicate events', async () => {
      const eventId = 'event-123';

      // First call
      const isNew1 = await deduplicateEvent(kv, eventId, 10);
      expect(isNew1).toBe(true);

      // Second call (duplicate)
      const isNew2 = await deduplicateEvent(kv, eventId, 10);
      expect(isNew2).toBe(false);

      // Third call (still duplicate)
      const isNew3 = await deduplicateEvent(kv, eventId, 10);
      expect(isNew3).toBe(false);
    });

    it('should detect event duplicates after expiry', async () => {
      const eventId = 'event-temp';

      const isNew1 = await deduplicateEvent(kv, eventId, 1);
      expect(isNew1).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 1100));

      const isNew2 = await deduplicateEvent(kv, eventId, 1);
      expect(isNew2).toBe(true); // Should be treated as new again
    });
  });

  describe('Retry Logic', () => {
    it('should succeed on first try', async () => {
      let attempts = 0;

      const result = await retry(
        async () => {
          attempts++;
          return 'success';
        },
        { maxAttempts: 3 }
      );

      expect(result).toBe('success');
      expect(attempts).toBe(1);
    });

    it('should retry on transient failure', async () => {
      let attempts = 0;

      const result = await retry(
        async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Transient failure');
          }
          return 'success';
        },
        { maxAttempts: 5, baseDelayMs: 10 }
      );

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should throw after max attempts', async () => {
      let attempts = 0;

      await expect(
        retry(
          async () => {
            attempts++;
            throw new Error('Persistent failure');
          },
          { maxAttempts: 3, baseDelayMs: 10 }
        )
      ).rejects.toThrow('Persistent failure');

      expect(attempts).toBe(3);
    });

    it('should apply exponential backoff', async () => {
      const times: number[] = [];

      await expect(
        retry(
          async () => {
            times.push(Date.now());
            throw new Error('fail');
          },
          {
            maxAttempts: 4,
            baseDelayMs: 20,
            maxDelayMs: 200,
            jitterFactor: 0,
          }
        )
      ).rejects.toThrow();

      // Check rough timing (allowing for execution overhead)
      expect(times.length).toBe(4);
      const diff1 = times[1] - times[0];
      const diff2 = times[2] - times[1];
      const diff3 = times[3] - times[2];

      // Each delay should roughly double
      expect(diff2).toBeGreaterThan(diff1);
      expect(diff3).toBeGreaterThan(diff2);
    });

    it('should cap max delay', async () => {
      const times: number[] = [];

      await expect(
        retry(
          async () => {
            times.push(Date.now());
            throw new Error('fail');
          },
          {
            maxAttempts: 4,
            baseDelayMs: 100,
            maxDelayMs: 150,
            jitterFactor: 0,
          }
        )
      ).rejects.toThrow();

      // Last delay should be capped at maxDelayMs
      const lastDelay = times[3] - times[2];
      expect(lastDelay).toBeLessThanOrEqual(200); // 150 + some overhead
    });
  });

  describe('Envelope Format', () => {
    it('should create envelope with defaults', () => {
      const env = createEnvelope('test:topic', { data: 'test' });

      expect(env.id).toBeDefined();
      expect(env.type).toBe('test:topic');
      expect(env.ts).toBeDefined();
      expect(env.payload).toEqual({ data: 'test' });
      expect(env.corrId).toBeUndefined();
      expect(env.attempts).toBeUndefined();
    });

    it('should create envelope with correlation ID', () => {
      const env = createEnvelope('test:topic', { data: 'test' }, 'trace-123');

      expect(env.corrId).toBe('trace-123');
    });

    it('should create envelope with tenant ID', () => {
      const env = createEnvelope(
        'test:topic',
        { data: 'test' },
        'trace-123',
        'tenant-456'
      );

      expect(env.tenantId).toBe('tenant-456');
    });

    it('should retry envelope with incremented attempts', () => {
      const env1 = createEnvelope('test:topic', { data: 'test' });
      const env2 = retryEnvelope(env1, 'Connection timeout');

      expect(env2.id).toBe(env1.id);
      expect(env2.type).toBe(env1.type);
      expect(env2.attempts).toBe(1);
      expect(env2.lastError).toBe('Connection timeout');
    });

    it('should increment attempts on subsequent retries', () => {
      const env1 = createEnvelope('test:topic', { data: 'test' });
      const env2 = retryEnvelope(env1, 'Error 1');
      const env3 = retryEnvelope(env2, 'Error 2');
      const env4 = retryEnvelope(env3, 'Error 3');

      expect(env1.attempts).toBeUndefined();
      expect(env2.attempts).toBe(1);
      expect(env3.attempts).toBe(2);
      expect(env4.attempts).toBe(3);
    });
  });

  describe('End-to-End Message Flow', () => {
    it('should complete full message cycle', async () => {
      const results: any[] = [];
      let processedMessage: any = null;

      // Subscribe to input topic
      const unsub = await bus.subscribe('test:e2e-in', async (envelope) => {
        // Simulate processing
        const result = {
          ...envelope,
          processed: true,
          processedAt: new Date().toISOString(),
        };
        processedMessage = result;
        results.push(result);
      });

      // Create and publish message
      const inputEnvelope = createEnvelope(
        'test:e2e-in',
        { taskId: '123', action: 'process' },
        'e2e-trace'
      );

      await bus.publish('test:e2e-in', inputEnvelope);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify
      expect(processedMessage).toBeDefined();
      expect(processedMessage.id).toBe(inputEnvelope.id);
      expect(processedMessage.processed).toBe(true);
      expect(processedMessage.corrId).toBe('e2e-trace');

      // Clean up
      await unsub();
    });

    it('should handle message with idempotency and retry', async () => {
      let messageCount = 0;

      const unsub = await bus.subscribe('test:idempotent', async (envelope) => {
        // Simulate processing with idempotency
        const executed = await once(
          kv,
          `processed:${envelope.id}`,
          async () => {
            messageCount++;
            return true;
          }
        );

        if (executed) {
          log.info('Message processed', { id: envelope.id });
        } else {
          log.info('Message already processed (idempotent)', { id: envelope.id });
        }
      });

      // Publish same message 3 times
      const envelope = createEnvelope('test:idempotent', { data: 'test' });

      for (let i = 0; i < 3; i++) {
        await bus.publish('test:idempotent', envelope);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // Should only process once
      expect(messageCount).toBe(1);

      await unsub();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON gracefully', async () => {
      const messages: any[] = [];
      const errors: any[] = [];

      const unsub = await bus.subscribe('test:json-error', async (msg) => {
        try {
          messages.push(msg);
        } catch (e) {
          errors.push(e);
        }
      });

      // This should work with envelope format
      const envelope = createEnvelope('test:json-error', {
        malformed: undefined,
      });
      await bus.publish('test:json-error', envelope);

      await new Promise((resolve) => setTimeout(resolve, 100));

      await unsub();
    });

    it('should continue processing after handler error', async () => {
      const successMessages: any[] = [];
      let handlerErrorCount = 0;

      const unsub = await bus.subscribe('test:handler-error', async (msg) => {
        if (msg.failMe) {
          handlerErrorCount++;
          throw new Error('Handler error');
        }
        successMessages.push(msg);
      });

      // Publish failing message
      const failEnvelope = createEnvelope('test:handler-error', {
        failMe: true,
      });
      await bus.publish('test:handler-error', failEnvelope);

      // Publish success message
      const successEnvelope = createEnvelope('test:handler-error', {
        failMe: false,
      });
      await bus.publish('test:handler-error', successEnvelope);

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(handlerErrorCount).toBeGreaterThan(0);
      expect(successMessages.length).toBe(1);

      await unsub();
    });
  });
});
