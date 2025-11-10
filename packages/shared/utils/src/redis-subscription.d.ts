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
export declare class RobustRedisSubscriber {
    private lastMessageTime;
    private healthCheckInterval;
    private logger;
    private setupListenersDone;
    constructor(logger?: pino.Logger);
    /**
     * Subscribe to Redis channels with automatic reconnection
     */
    subscribe(subscriber: Redis, config: RedisSubscriptionConfig): Promise<void>;
    /**
     * Set up event listeners (called once in constructor)
     * Prevents duplicate listener warnings on reconnection
     */
    private setupEventListeners;
    /**
     * Health check to detect silent subscription failures
     * Reconnects if no messages arrive within timeout period
     */
    private startHealthCheck;
    /**
     * Clean up resources
     */
    cleanup(): void;
}
/**
 * Factory function for creating subscribers with defaults
 */
export declare function createRobustRedisSubscriber(logger?: pino.Logger): RobustRedisSubscriber;
//# sourceMappingURL=redis-subscription.d.ts.map