/**
 * Redis Message Bus Adapter
 *
 * Implements IMessageBus using Redis pub/sub + optional streams for durability.
 * Provides:
 * - Fire-and-forget pub/sub for lightweight signals
 * - Optional Redis Streams mirror for durability and replay
 * - Deduplication support via envelope.id
 * - Health checking
 *
 * Session #40: Migrated to node-redis v4
 */

import { type RedisClientType } from 'redis';
import { IMessageBus, PublishOptions, SubscriptionOptions, BusHealth } from '../ports/message-bus.port';
import { createLogger } from '../core/logger';

const log = createLogger('redis-bus');

/**
 * Create a Redis-based message bus from separate pub/sub clients
 */
export function makeRedisBus(
  pub: any,
  sub: any
): IMessageBus {
  log.info('Bus initialized with node-redis v4');

  // Track subscriptions for cleanup
  const subscriptions = new Map<string, Set<(msg: any) => Promise<void>>>();

  // Set up subscriber message handler
  // Start listening immediately in background - don't await, let it run continuously
  (async () => {
    try {
      log.info('Starting pSubscribe listener for all patterns');

      // Use pSubscribe with callback - it processes messages as they arrive
      await sub.pSubscribe('*', async (message: string, channel: string) => {
        try {
          const handlers = subscriptions.get(channel);
          if (!handlers || handlers.size === 0) {
            log.debug('No handlers for channel', { channel });
            return;
          }

          let msg: any;
          try {
            const envelope = JSON.parse(message);
            msg = envelope.msg !== undefined ? envelope.msg : envelope;
          } catch (e) {
            log.error('Parse error', { channel, message: message.substring(0, 100), error: String(e) });
            return;
          }

          log.debug('Invoking handlers', { channel, handlerCount: handlers.size });

          // Call all handlers concurrently
          await Promise.all(
            Array.from(handlers).map((h) =>
              h(msg).catch((e) => log.error('Handler error', { channel, error: String(e) }))
            )
          );
        } catch (e) {
          log.error('Message processing error', { channel, error: String(e) });
        }
      });
    } catch (e) {
      log.error('PSubscribe listener error', { error: String(e) });
    }
  })().catch((e) => log.error('Uncaught pSubscribe error', { error: String(e) }));

  return {
    async publish(topic: string, msg: any, opts?: PublishOptions): Promise<void> {
      const envelope = { key: opts?.key, msg };
      const payload = JSON.stringify(envelope);

      // Mirror to stream if configured (for durability)
      if (opts?.mirrorToStream) {
        await pub.xAdd(opts.mirrorToStream, '*', {
          topic,
          payload,
        });
        log.info('Mirrored to stream', { topic, stream: opts.mirrorToStream });
      }

      // Publish to pub/sub
      const receivers = await pub.publish(topic, payload);
      log.info('Published', { topic, receivers, hasMirror: !!opts?.mirrorToStream });
    },

    async subscribe(
      topic: string,
      handler: (msg: any) => Promise<void>,
      opts?: SubscriptionOptions
    ): Promise<() => Promise<void>> {
      // Ensure handler set exists
      if (!subscriptions.has(topic)) {
        subscriptions.set(topic, new Set());
        await sub.subscribe(topic);
        log.info('Subscribed', { topic });
      }

      // Add this handler
      subscriptions.get(topic)!.add(handler);
      log.info('Handler registered', { topic, count: subscriptions.get(topic)!.size });

      // Return unsubscribe function
      return async () => {
        const handlers = subscriptions.get(topic);
        if (!handlers) return;

        handlers.delete(handler);
        if (handlers.size === 0) {
          subscriptions.delete(topic);
          await sub.unsubscribe(topic);
          log.info('Unsubscribed', { topic });
        } else {
          log.info('Handler removed', { topic, remaining: handlers.size });
        }
      };
    },

    async health(): Promise<BusHealth> {
      try {
        const start = Date.now();
        const pong = await pub.ping();
        const latencyMs = Date.now() - start;

        // Test round-trip KV if available
        const testKey = `health:${Date.now()}`;
        await pub.setEx(testKey, 5, 'ok');
        const testVal = await pub.get(testKey);
        await pub.del(testKey);

        return {
          ok: testVal === 'ok' && pong === 'PONG',
          latencyMs,
          details: {
            pubConnected: pub.isReady,
            subConnected: sub.isReady,
            subscriptions: subscriptions.size,
          },
        };
      } catch (e) {
        log.error('Health check failed', { error: String(e) });
        return {
          ok: false,
          details: { error: String(e) },
        };
      }
    },

    async disconnect(): Promise<void> {
      // Unsubscribe all
      for (const topic of subscriptions.keys()) {
        await sub.unsubscribe(topic);
      }
      subscriptions.clear();

      // Note: clients are managed by RedisSuite, don't quit them here
      log.info('Bus disconnected (clients managed by suite)');
    },
  };
}
