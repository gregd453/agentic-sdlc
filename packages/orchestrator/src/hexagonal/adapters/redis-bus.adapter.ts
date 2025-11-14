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

      // SESSION #63: Quick Fix - Disable pub/sub to eliminate duplicate delivery
      // Pub/sub + streams causes 2x message processing → CAS conflicts
      // TODO: Strategic refactor to ExecutionBus/NotificationBus split (see STRATEGIC-BUS-REFACTOR.md)
      // const receivers = await pub.publish(topic, payload);
      // log.info('Published', { topic, receivers, hasMirror: !!opts?.mirrorToStream });
      log.info('[SESSION #63] Published to stream only (pub/sub disabled)', { topic, stream: opts?.mirrorToStream });
    },

    async subscribe(
      topic: string,
      handler: (msg: any) => Promise<void>,
      opts?: SubscriptionOptions
    ): Promise<() => Promise<void>> {
      // Ensure handler set exists
      if (!subscriptions.has(topic)) {
        subscriptions.set(topic, new Set());
        // Note: pSubscribe('*') at initialization already catches all channels
        // No need to call sub.subscribe() again - just register the handler
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
              console.log('[DEBUG-STREAM] About to call XREADGROUP', { streamKey, consumerGroup, consumerName });

              // Read from stream with XREADGROUP
              // Always use '>' to read new undelivered messages for this consumer group
              // The group's last-delivered-id is managed by XGROUP CREATE/SETID
              const results = await pub.xReadGroup(
                consumerGroup,
                consumerName,
                [{ key: streamKey, id: '>' }], // '>' means new messages after last-delivered-id
                { COUNT: 10, BLOCK: 5000 } // Block for 5 seconds
              );

              console.log('[DEBUG-STREAM] XREADGROUP returned', {
                hasResults: !!results,
                resultsLength: results?.length || 0,
                resultsType: typeof results
              });

              if (results && results.length > 0) {
                console.log('[DEBUG-STREAM] Processing results', { count: results.length });
                for (const streamResult of results) {
                  for (const message of streamResult.messages) {
                    try {
                      const messageData = message.message as any;

                      // 🔍 Step 1: Log raw stream message
                      log.debug('[STREAM-CONSUME] Raw message from Redis stream', {
                        streamKey,
                        messageId: message.id,
                        messageType: typeof messageData,
                        hasPayload: !!messageData.payload,
                        hasMsg: !!messageData.msg,
                        hasMessage: !!messageData.message,
                        topLevelKeys: Object.keys(messageData || {}).join(',')
                      });

                      // SESSION #65 FIX: Parse stream message envelope structure
                      // Stream messages have {topic, payload} where payload may be string or pre-parsed object
                      let parsedMessage: any;
                      let unwrapPath: string = 'unknown';

                      if (messageData.payload) {
                        // Handle both string and pre-parsed payload
                        const payloadData = typeof messageData.payload === 'string'
                          ? JSON.parse(messageData.payload)
                          : messageData.payload;

                        // Unwrap {key, msg} envelope structure to get actual AgentEnvelope
                        parsedMessage = payloadData.msg || payloadData;
                        unwrapPath = payloadData.msg ? 'messageData.payload.msg' : 'messageData.payload';

                        log.debug('[STREAM-CONSUME] Unwrapped via payload path', {
                          unwrapPath,
                          payloadWasString: typeof messageData.payload === 'string',
                          hasMsg: !!payloadData.msg,
                          payloadKeys: Object.keys(payloadData).join(',')
                        });
                      } else if (messageData.msg) {
                        // Direct msg property (already unwrapped by caller)
                        parsedMessage = messageData.msg;
                        unwrapPath = 'messageData.msg';
                      } else if (typeof messageData.message === 'string') {
                        parsedMessage = JSON.parse(messageData.message);
                        unwrapPath = 'messageData.message (parsed)';
                      } else if (typeof messageData === 'string') {
                        parsedMessage = JSON.parse(messageData);
                        unwrapPath = 'messageData (parsed)';
                      } else {
                        // Fallback: assume messageData is already the unwrapped message
                        parsedMessage = messageData;
                        unwrapPath = 'messageData (direct)';
                      }

                      // 🔍 Step 2: Log unwrapped message structure
                      const workflowId = parsedMessage.workflow_id || messageData.workflow_id;
                      const taskId = parsedMessage.task_id || messageData.task_id;
                      const traceId = parsedMessage.trace?.trace_id || parsedMessage.trace_id;

                      log.info('[PHASE-3] Processing message from stream', {
                        streamKey,
                        messageId: message.id,
                        unwrapPath,
                        workflow_id: workflowId,
                        task_id: taskId,
                        trace_id: traceId,
                        messageKeys: Object.keys(parsedMessage).join(',')
                      });

                      // 🔍 Step 3: Log handler invocation
                      const handlers = subscriptions.get(topic);
                      console.log('[DEBUG-STREAM] Checking handlers', {
                        topic,
                        hasHandlers: !!handlers,
                        handlerCount: handlers?.size || 0,
                        subscriptionsKeys: Array.from(subscriptions.keys()).join(',')
                      });

                      if (handlers) {
                        log.debug('[STREAM-CONSUME] Invoking handlers', {
                          handlerCount: handlers.size,
                          topic,
                          workflow_id: workflowId,
                          task_id: taskId
                        });

                        console.log('[DEBUG-STREAM] About to invoke handlers', { count: handlers.size });

                        // Invoke all handlers - let errors propagate to keep message pending
                        await Promise.all(
                          Array.from(handlers).map(h => h(parsedMessage))
                        );

                        console.log('[DEBUG-STREAM] Handlers completed successfully');

                        // CRITICAL: Only ACK after ALL handlers succeed
                        // If any handler fails, message stays pending for retry
                        await pub.xAck(streamKey, consumerGroup, message.id);
                        console.log('[DEBUG-STREAM] Message ACKed', { messageId: message.id });
                        log.debug('[STREAM-CONSUME] Message acknowledged', {
                          messageId: message.id,
                          streamKey
                        });
                      } else {
                        console.log('[DEBUG-STREAM] No handlers found!');
                        log.warn('[STREAM-CONSUME] No handlers found for topic', {
                          topic,
                          availableTopics: Array.from(subscriptions.keys()).join(',')
                        });
                        // Still ACK if no handlers to prevent infinite pending
                        await pub.xAck(streamKey, consumerGroup, message.id);
                      }
                    } catch (msgError) {
                      log.error('[PHASE-3] Failed to process stream message', {
                        error: msgError instanceof Error ? msgError.message : String(msgError),
                        stack: msgError instanceof Error ? msgError.stack : undefined,
                        messageId: message.id,
                        streamKey
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
