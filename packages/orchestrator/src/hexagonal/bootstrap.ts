/**
 * Bootstrap & Dependency Injection
 *
 * Composes all hexagonal components:
 * - Creates ports (message bus, KV store)
 * - Wires up adapters (Redis implementations)
 * - Initializes orchestrators (phase coordinators)
 * - Handles graceful shutdown
 *
 * Session #40: node-redis v4 integration
 */

import { IMessageBus } from './ports/message-bus.port';
import { IKVStore } from './ports/kv-store.port';
import { makeRedisBus } from './adapters/redis-bus.adapter';
import { makeRedisKV } from './adapters/redis-kv.adapter';
import { makeRedisSuite, type RedisSuite } from './adapters/redis-suite';
import { PlanCoordinator } from './orchestration/plan-coordinator';
import { BaseOrchestrator, OrchestratorOptions } from './orchestration/base-orchestrator';
import { createLogger } from './core/logger';

const log = createLogger('bootstrap');

export interface BootstrapConfig {
  redisUrl: string;
  redisNamespace?: string;
  redisDefaultTtl?: number;

  coordinators: {
    plan?: boolean;
    code?: boolean;
    certify?: boolean;
    deploy?: boolean;
    monitor?: boolean;
  };
}

/**
 * Container for all orchestrator dependencies
 */
export class OrchestratorContainer {
  private redis: RedisSuite | null = null;
  private bus: IMessageBus | null = null;
  private kv: IKVStore | null = null;
  private orchestrators: BaseOrchestrator[] = [];
  private config: BootstrapConfig;

  constructor(config: BootstrapConfig) {
    this.config = config;
  }

  /**
   * Initialize all ports and adapters
   */
  async initialize(): Promise<void> {
    log.info('Initializing container', {
      redisUrl: this.config.redisUrl.replace(/:[^:]*@/, ':***@'),
      redisNamespace: this.config.redisNamespace,
    });

    try {
      // Create Redis suite (base + pub + sub clients)
      this.redis = await makeRedisSuite(this.config.redisUrl);

      // Create message bus from pub/sub clients
      this.bus = makeRedisBus(this.redis.pub, this.redis.sub);

      // Create KV store from base client
      this.kv = makeRedisKV(this.redis.base, this.config.redisNamespace);

      // Log health status but don't block on it (Redis may still be initializing)
      const busHealth = await this.bus.health();
      const kvHealth = await this.kv.health();

      if (!busHealth.ok) {
        log.warn('Bus health check failed', { busHealth });
      }
      if (!kvHealth) {
        log.warn('KV health check failed');
      }

      log.info('Container initialized successfully', {
        busHealth,
        kvHealth,
      });
    } catch (error) {
      log.error('Container initialization failed', {
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Create and register orchestrators
   */
  async startOrchestrators(): Promise<void> {
    if (!this.bus || !this.kv) {
      throw new Error('Container not initialized. Call initialize() first');
    }

    log.info('Starting orchestrators', this.config.coordinators);

    const opts: OrchestratorOptions = {
      bus: this.bus,
      kv: this.kv,
      inputTopic: '',
      outputTopic: '',
      dlqTopic: 'dlq:failed',
      maxRetries: 5,
    };

    // Plan coordinator
    if (this.config.coordinators.plan) {
      const plan = new PlanCoordinator({
        ...opts,
        inputTopic: 'phase.plan.in',
        outputTopic: 'phase.plan.out',
      });
      await plan.start();
      this.orchestrators.push(plan);
      log.info('Plan coordinator started');
    }

    // Future coordinators
    // if (this.config.coordinators.code) {
    //   const code = new CodeCoordinator({ ... });
    //   await code.start();
    //   this.orchestrators.push(code);
    // }

    log.info('All orchestrators started', {
      count: this.orchestrators.length,
    });
  }

  /**
   * Gracefully shutdown everything
   */
  async shutdown(): Promise<void> {
    log.info('Shutting down container');

    // Stop orchestrators
    for (const orch of this.orchestrators) {
      try {
        await orch.stop();
      } catch (e) {
        log.warn('Error stopping orchestrator', { error: String(e) });
      }
    }

    // Disconnect ports
    if (this.bus) {
      try {
        await this.bus.disconnect();
      } catch (e) {
        log.warn('Error disconnecting bus', { error: String(e) });
      }
    }

    if (this.kv) {
      try {
        await this.kv.disconnect();
      } catch (e) {
        log.warn('Error disconnecting KV', { error: String(e) });
      }
    }

    // Disconnect Redis clients
    if (this.redis) {
      try {
        await this.redis.disconnect();
      } catch (e) {
        log.warn('Error disconnecting Redis suite', { error: String(e) });
      }
    }

    log.info('Container shutdown complete');
  }

  /**
   * Health check for monitoring
   */
  async health(): Promise<{ ok: boolean; bus: any; kv: boolean }> {
    if (!this.bus || !this.kv) {
      return { ok: false, bus: { ok: false }, kv: false };
    }

    const [busHealth, kvHealth] = await Promise.all([this.bus.health(), this.kv.health()]);

    return {
      ok: busHealth.ok && kvHealth,
      bus: busHealth,
      kv: kvHealth,
    };
  }

  /**
   * Get bus for direct access (advanced use)
   */
  getBus(): IMessageBus {
    if (!this.bus) throw new Error('Container not initialized');
    return this.bus;
  }

  /**
   * Get KV for direct access (advanced use)
   */
  getKV(): IKVStore {
    if (!this.kv) throw new Error('Container not initialized');
    return this.kv;
  }
}

/**
 * Factory function: create and initialize container
 */
export async function createContainer(config: BootstrapConfig): Promise<OrchestratorContainer> {
  const container = new OrchestratorContainer(config);
  await container.initialize();
  return container;
}

/**
 * Typical usage pattern
 */
export async function bootstrapOrchestrator(): Promise<OrchestratorContainer> {
  const config: BootstrapConfig = {
    redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6380',
    redisNamespace: process.env.REDIS_NAMESPACE ?? 'agentic-sdlc',
    redisDefaultTtl: parseInt(process.env.KV_TTL_SEC ?? '3600', 10),

    coordinators: {
      plan: (process.env.ENABLE_PLAN ?? 'true') === 'true',
      code: (process.env.ENABLE_CODE ?? 'false') === 'true',
      certify: (process.env.ENABLE_CERTIFY ?? 'false') === 'true',
      deploy: (process.env.ENABLE_DEPLOY ?? 'false') === 'true',
      monitor: (process.env.ENABLE_MONITOR ?? 'false') === 'true',
    },
  };

  const container = await createContainer(config);
  await container.startOrchestrators();

  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    log.info('SIGTERM received');
    await container.shutdown();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    log.info('SIGINT received');
    await container.shutdown();
    process.exit(0);
  });

  return container;
}
