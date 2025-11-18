/**
 * Redis Client Suite Factory
 *
 * Creates separate redis clients for different purposes:
 * - base: general operations (KV store, streams)
 * - pub: publishing messages
 * - sub: subscribing to channels
 *
 * This is critical for Redis: subscribers in SUBSCRIBE mode can't issue other commands.
 * We must maintain separate connections for different purposes.
 *
 * Session #40: node-redis v4 integration
 */

import { createClient, type RedisClientType } from 'redis';
import { createLogger } from '../core/logger';

const log = createLogger('redis-suite');

// Use 'any' for RedisClientType to avoid strict generics issues with node-redis v4
export interface RedisSuite {
  base: any;
  pub: any;
  sub: any;
  disconnect: () => Promise<void>;
}

/**
 * Create a single Redis client with proper connection handling
 */
export async function makeRedisClient(
  url: string,
  name: string
): Promise<any> {
  const client = createClient({ url });

  // Error handler
  client.on(LOG_LEVEL.ERROR, (err) => {
    log.error(`${name} error`, { error: String(err) });
  });

  // Connect and verify
  await client.connect();
  log.info(`${name} connected`, { status: client.isReady ? 'ready' : TASK_STATUS.PENDING });

  // Health check
  const pong = await client.ping();
  if (pong !== 'PONG') {
    throw new Error(`${name} health check failed: expected PONG, got ${pong}`);
  }

  log.info(`${name} health check passed`, { pong });
  return client;
}

/**
 * Create complete Redis suite with separate clients
 */
export async function makeRedisSuite(url: string): Promise<RedisSuite> {
  log.info('Creating Redis suite', { url: url.replace(/:[^:]*@/, ':***@') });

  // Create three separate clients
  const [base, pub, sub] = await Promise.all([
    makeRedisClient(url, 'base-client'),
    makeRedisClient(url, 'pub-client'),
    makeRedisClient(url, 'sub-client'),
  ]);

  log.info('Redis suite created successfully');

  return {
    base,
    pub,
    sub,
    async disconnect() {
      log.info('Disconnecting Redis suite');
      await Promise.all([
        base.quit().catch((e: any) => log.error('base quit error', { error: String(e) })),
        pub.quit().catch((e: any) => log.error('pub quit error', { error: String(e) })),
        sub.quit().catch((e: any) => log.error('sub quit error', { error: String(e) })),
      ]);
      log.info('Redis suite disconnected');
    },
  };
}
