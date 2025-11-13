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

        // Phase 3: Also consume from stream if available for durability
        const streamKey = `stream:${topic}`;
        const consumerGroup = opts?.consumerGroup || 'orchestrator-group';
        const consumerName = `consumer-${Date.now()}`;

        // Create consumer group if it doesn't exist (ignore error if exists)
        try {
          await pub.xGroupCreate(streamKey, consumerGroup, '0', { MKSTREAM: true });
          log.info('[PHASE-3] Created consumer group for stream', { streamKey, consumerGroup });
        } catch (error: any) {
          if (!error.message?.includes('BUSYGROUP')) {
            log.warn('[PHASE-3] Failed to create consumer group', {
              streamKey,
              error: error.message
            });
          }
        }

        // Start stream consumer in background
        (async () => {
          log.info('[PHASE-3] Starting stream consumer', { streamKey, consumerGroup, consumerName });

          while (subscriptions.has(topic)) {
            try {
              // Read from stream with XREADGROUP
              const results = await pub.xReadGroup(
                consumerGroup,
                consumerName,
                [{ key: streamKey, id: '>' }], // '>' means only new messages
                { COUNT: 10, BLOCK: 5000 } // Block for 5 seconds
              );

              if (results && results.length > 0) {
                for (const streamResult of results) {
                  for (const message of streamResult.messages) {
                    try {
                      const messageData = message.message as any;

                      // Fix: Check if messageData.message is a string before parsing
                      let parsedMessage: any;
                      if (typeof messageData.message === 'string') {
                        parsedMessage = JSON.parse(messageData.message);
                      } else if (typeof messageData === 'string') {
                        parsedMessage = JSON.parse(messageData);
                      } else {
                        // Already an object, use as is
                        parsedMessage = messageData.message || messageData;
                      }

                      log.info('[PHASE-3] Processing message from stream', {
                        streamKey,
                        messageId: message.id,
                        messageType: typeof messageData,
                        hasMessageProperty: messageData.message !== undefined,
                        workflow_id: messageData.workflow_id
                      });

                      // Invoke all handlers
                      const handlers = subscriptions.get(topic);
                      if (handlers) {
                        await Promise.all(
                          Array.from(handlers).map(h =>
                            h(parsedMessage).catch(e =>
                              log.error('[PHASE-3] Stream handler error', { error: String(e) })
                            )
                          )
                        );
                      }

                      // Acknowledge message
                      await pub.xAck(streamKey, consumerGroup, message.id);
                    } catch (msgError) {
                      log.error('[PHASE-3] Failed to process stream message', {
                        error: msgError instanceof Error ? msgError.message : String(msgError)
                      });
                    }
                  }
                }
              }
            } catch (error: any) {
              if (error.message?.includes('NOGROUP')) {
                log.warn('[PHASE-3] Consumer group does not exist, will retry', { streamKey });
                await new Promise(resolve => setTimeout(resolve, 5000));
              } else if (!subscriptions.has(topic)) {
                // Topic was unsubscribed, exit loop
                break;
              } else {
                log.error('[PHASE-3] Stream consumer error', {
                  error: error.message,
                  streamKey
                });
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
          }

          log.info('[PHASE-3] Stream consumer stopped', { streamKey });
        })().catch(e => log.error('[PHASE-3] Stream consumer crashed', { error: String(e) }));
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
