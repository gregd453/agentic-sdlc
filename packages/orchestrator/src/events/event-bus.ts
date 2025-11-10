import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { WorkflowEvent } from '../types';

export const EventSchema = z.object({
  id: z.string(),
  type: z.string(),
  workflow_id: z.string().optional(),
  payload: z.record(z.unknown()),
  timestamp: z.string().datetime(),
  trace_id: z.string()
});

export type Event = z.infer<typeof EventSchema>;

export class EventBus {
  private emitter = new EventEmitter();
  private redis: Redis;
  private subscriber: Redis;
  private subscriptions = new Map<string, Set<(event: Event) => Promise<void>>>();
  private running = true; // Cancellation flag for consumer loops

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
    this.subscriber = new Redis(redisUrl);
    this.setupSubscriber();
  }

  private setupSubscriber(): void {
    this.subscriber.on('message', async (channel, message) => {
      try {
        const event = JSON.parse(message);
        const handlers = this.subscriptions.get(channel);
        if (handlers) {
          for (const handler of handlers) {
            await handler(event);
          }
        }
      } catch (error) {
        logger.error('Error processing Redis message', { error, channel, message });
      }
    });
  }

  async publish(event: Event | WorkflowEvent): Promise<void> {
    try {
      // Validate event
      const validated = EventSchema.parse({
        ...event,
        timestamp: event.timestamp instanceof Date
          ? event.timestamp.toISOString()
          : event.timestamp
      });

      // Store in Redis stream for persistence
      await this.redis.xadd(
        `events:${validated.type}`,
        '*',
        'data', JSON.stringify(validated)
      );

      // FIX: Publish ONLY to Redis pub/sub (removed local emitter.emit)
      // This prevents double-invocation where handlers were called via both local emitter AND Redis
      await this.redis.publish(`event:${validated.type}`, JSON.stringify(validated));

      logger.info('[EB:PUBLISHED] Event published to Redis', {
        type: validated.type,
        id: validated.id,
        workflow_id: validated.workflow_id,
        channel: `event:${validated.type}`
      });
    } catch (error) {
      logger.error('[EB:PUBLISH_ERROR] Failed to publish event', { error, event });
      throw error;
    }
  }

  async subscribe(
    eventType: string,
    handler: (event: Event) => Promise<void>
  ): Promise<void> {
    // FIX: Use ONLY Redis pub/sub, NOT local emitter
    // This prevents double-invocation of handlers when events are published
    // (was calling handler via both local emitter AND Redis subscriptions)

    const channel = `event:${eventType}`;

    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
      await this.subscriber.subscribe(channel);
      logger.info('[EB:REDIS_SUBSCRIBED] Subscribed to Redis channel', { channel });
    }

    this.subscriptions.get(channel)!.add(handler);

    logger.info('[EB:HANDLER_REGISTERED] Handler registered for event', {
      eventType,
      channel,
      handlerCount: this.subscriptions.get(channel)!.size
    });
  }

  async unsubscribe(
    eventType: string,
    handler: (event: Event) => Promise<void>
  ): Promise<void> {
    // Remove local subscription (cast to any to avoid type issues)
    this.emitter.off(eventType, handler as any);

    // Remove Redis subscription
    const channel = `event:${eventType}`;
    const handlers = this.subscriptions.get(channel);

    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.subscriptions.delete(channel);
        await this.subscriber.unsubscribe(channel);
      }
    }

    logger.info('Unsubscribed from event', { eventType });
  }

  async consumeStream(
    stream: string,
    consumer: string,
    handler: (event: Event) => Promise<void>
  ): Promise<void> {
    // Create consumer group if not exists
    try {
      await this.redis.xgroup('CREATE', stream, consumer, '0');
    } catch (error: any) {
      if (!error.message.includes('BUSYGROUP')) {
        throw error;
      }
    }

    // Start consuming in background
    this.startConsumer(stream, consumer, handler);
  }

  private async startConsumer(
    stream: string,
    consumer: string,
    handler: (event: Event) => Promise<void>
  ): Promise<void> {
    while (this.running) {
      try {
        const messages = await this.redis.xreadgroup(
          'GROUP', consumer, consumer,
          'COUNT', 10,
          'BLOCK', 1000,
          'STREAMS', stream, '>'
        );

        if (messages) {
          // Cast to correct type for Redis stream messages
          for (const [, entries] of messages as any) {
            for (const [id, fields] of entries) {
              try {
                const event = JSON.parse(fields[1]);
                await handler(event);
                await this.redis.xack(stream, consumer, id);
              } catch (error) {
                logger.error('Error processing stream message', { error, id });
              }
            }
          }
        }
      } catch (error) {
        // Exit loop if we're shutting down
        if (!this.running) break;

        logger.error('Stream consumption error', { error, stream, consumer });
        await this.sleep(5000);
      }
    }
    logger.info('Stream consumer stopped', { stream, consumer });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Ping Redis to verify connectivity
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis ping failed', { error });
      return false;
    }
  }

  async disconnect(): Promise<void> {
    // Stop all consumer loops
    this.running = false;

    // Remove all event listeners
    this.emitter.removeAllListeners();
    if (typeof this.subscriber.removeAllListeners === 'function') {
      this.subscriber.removeAllListeners();
    }

    // Disconnect Redis clients
    await this.redis.quit();
    await this.subscriber.quit();

    logger.info('Event bus disconnected');
  }
}