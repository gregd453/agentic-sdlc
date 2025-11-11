/**
 * Message Bus Port (Interface)
 *
 * Abstraction for pub/sub messaging.
 * Implementations: Redis, RabbitMQ, AWS SNS, etc.
 *
 * This port separates orchestration from messaging technology.
 */

/**
 * Message publish options
 */
export interface PublishOptions {
  /** Optional routing key for certain bus types */
  key?: string;

  /** Optional message persistence hint */
  durable?: boolean;

  /** Optional time-to-live in seconds */
  ttlSec?: number;

  /** Optional: mirror published message to a Redis stream for durability */
  mirrorToStream?: string;

  /** Optional: consumer group if using streams */
  consumerGroup?: string;
}

/**
 * Subscription options
 */
export interface SubscriptionOptions {
  /** Whether to retain historical messages */
  fromBeginning?: boolean;

  /** Consumer group for load balancing */
  consumerGroup?: string;
}

/**
 * Health check result
 */
export interface BusHealth {
  ok: boolean;
  latencyMs?: number;
  details?: Record<string, any>;
}

/**
 * Message Bus Port
 *
 * Implementations must provide reliable pub/sub semantics:
 * - Fire-and-forget (Pub/Sub) or durable (Streams)
 * - Deduplication support via envelope.id
 * - Health checking capability
 */
export interface IMessageBus {
  /**
   * Publish a message to a topic
   *
   * @param topic - Topic name (e.g., "phase.plan.in")
   * @param msg - Message to publish
   * @param opts - Publish options
   */
  publish<T = any>(topic: string, msg: T, opts?: PublishOptions): Promise<void>;

  /**
   * Subscribe to a topic with a handler
   *
   * @param topic - Topic name
   * @param handler - Async function to call for each message
   * @param opts - Subscription options
   * @returns Unsubscribe function
   */
  subscribe<T = any>(
    topic: string,
    handler: (msg: T) => Promise<void>,
    opts?: SubscriptionOptions
  ): Promise<() => Promise<void>>;

  /**
   * Health check
   *
   * @returns Health status
   */
  health(): Promise<BusHealth>;

  /**
   * Graceful shutdown
   */
  disconnect(): Promise<void>;
}
