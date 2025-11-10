/**
 * Robust Redis Subscription Utility
 *
 * Provides reliable Redis pub/sub subscription with:
 * - Promise-based subscribe API (compatible with IORedis v5.3.2+)
 * - Built-in reconnection with health checks
 * - Comprehensive debug logging
 * - Graceful error handling
 */

import Redis from 'ioredis';
import pino from 'pino';

/**
 * Redis subscription configuration
 */
export interface RedisSubscriptionConfig {
  /** Channel(s) to subscribe to */
  channels: string | string[];
  /** Handler called when message arrives */
  onMessage: (channel: string, message: string) => void | Promise<void>;
  /** Optional error handler */
  onError?: (error: Error) => void;
  /** Optional connection handler */
  onConnect?: () => void;
  /** Health check interval in ms (default: 30000) */
  healthCheckIntervalMs?: number;
  /** Message timeout before reconnect in ms (default: 60000) */
  messageTimeoutMs?: number;
  /** Reconnect delay in ms (default: 2000) */
  reconnectDelayMs?: number;
  /** Logger instance */
  logger?: pino.Logger;
}

/**
 * RobustRedisSubscriber handles reliable Redis pub/sub subscriptions
 * with automatic reconnection and health checking
 */
export class RobustRedisSubscriber {
  private lastMessageTime: number = Date.now();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private logger: pino.Logger;
  private setupListenersDone = false;

  constructor(logger?: pino.Logger) {
    this.logger = logger || pino({
      name: 'RobustRedisSubscriber',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'UTC:yyyy-mm-dd HH:MM:ss'
        }
      }
    });
  }

  /**
   * Subscribe to Redis channels with automatic reconnection
   */
  async subscribe(
    subscriber: Redis,
    config: RedisSubscriptionConfig
  ): Promise<void> {
    // Set up event listeners once (prevents duplicate listener warnings)
    if (!this.setupListenersDone) {
      this.setupEventListeners(subscriber, config);
      this.setupListenersDone = true;
    }

    const channels = Array.isArray(config.channels)
      ? config.channels
      : [config.channels];

    this.logger.info('📡 INITIATING REDIS SUBSCRIPTION', {
      channels,
      timestamp: new Date().toISOString()
    });

    return new Promise((resolve, reject) => {
      subscriber.subscribe(...channels).then(
        () => {
          this.logger.info('✅ SUCCESSFULLY SUBSCRIBED TO CHANNELS', {
            channels,
            count: channels.length,
            timestamp: new Date().toISOString()
          });

          // Start health check to detect silent failures
          this.startHealthCheck(subscriber, config);
          resolve();
        },
        (err: any) => {
          this.logger.error('❌ SUBSCRIPTION FAILED', {
            channels,
            errorMessage: err?.message || String(err),
            errorCode: err?.code,
            errno: err?.errno,
            syscall: err?.syscall,
            address: err?.address,
            port: err?.port,
            fullError: String(err),
            timestamp: new Date().toISOString()
          });
          reject(err);
        }
      );
    });
  }

  /**
   * Set up event listeners (called once in constructor)
   * Prevents duplicate listener warnings on reconnection
   */
  private setupEventListeners(
    subscriber: Redis,
    config: RedisSubscriptionConfig
  ): void {
    subscriber.on('connect', () => {
      this.logger.info('🔗 REDIS SUBSCRIBER CONNECTED', {
        timestamp: new Date().toISOString()
      });
      this.lastMessageTime = Date.now();
      config.onConnect?.();
    });

    subscriber.on('error', (err: any) => {
      this.logger.error('❌ REDIS SUBSCRIBER ERROR', {
        errorMessage: err?.message || String(err),
        errorCode: err?.code,
        fullError: String(err),
        timestamp: new Date().toISOString()
      });
      config.onError?.(err);
    });

    subscriber.on('subscribe', (channel: any, count: any) => {
      this.logger.info('📡 REDIS SUBSCRIPTION CONFIRMED', {
        channel,
        subscriptionCount: count,
        timestamp: new Date().toISOString()
      });
    });

    subscriber.on('message', async (channel: any, message: any) => {
      this.lastMessageTime = Date.now();
      this.logger.info('📨 RAW MESSAGE RECEIVED FROM REDIS', {
        channel,
        messageLength: message.length,
        messagePreview: message.substring(0, 100),
        timestamp: new Date().toISOString()
      });

      try {
        await config.onMessage(channel, message);
      } catch (error) {
        this.logger.error('❌ ERROR HANDLING REDIS MESSAGE', {
          channel,
          error: (error as Error).message,
          timestamp: new Date().toISOString()
        });
        config.onError?.(error as Error);
      }
    });
  }

  /**
   * Health check to detect silent subscription failures
   * Reconnects if no messages arrive within timeout period
   */
  private startHealthCheck(
    subscriber: Redis,
    config: RedisSubscriptionConfig
  ): void {
    const checkInterval = config.healthCheckIntervalMs || 30000;
    const timeout = config.messageTimeoutMs || 60000;
    const reconnectDelay = config.reconnectDelayMs || 2000;

    // Clear any existing health check
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.lastMessageTime = Date.now();

    this.healthCheckInterval = setInterval(() => {
      const timeSinceLastMessage = Date.now() - this.lastMessageTime;

      if (timeSinceLastMessage > timeout) {
        this.logger.warn(
          '⚠️ NO MESSAGES RECEIVED - RESETTING SUBSCRIBER CONNECTION',
          {
            timeSinceLastMessage,
            timeoutMs: timeout,
            timestamp: new Date().toISOString()
          }
        );

        // Clear the health check interval
        if (this.healthCheckInterval) {
          clearInterval(this.healthCheckInterval);
          this.healthCheckInterval = null;
        }

        // Force disconnect and reconnect
        subscriber.disconnect();
        setTimeout(() => {
          this.logger.info('🔄 ATTEMPTING TO RECONNECT REDIS SUBSCRIBER', {
            timestamp: new Date().toISOString()
          });
          this.subscribe(subscriber, config).catch(err =>
            this.logger.error('❌ RECONNECTION FAILED', {
              error: err?.message || String(err),
              timestamp: new Date().toISOString()
            })
          );
        }, reconnectDelay);
      }
    }, checkInterval);
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}

/**
 * Factory function for creating subscribers with defaults
 */
export function createRobustRedisSubscriber(logger?: pino.Logger): RobustRedisSubscriber {
  return new RobustRedisSubscriber(logger);
}
