/**
 * Hexagonal Architecture - Public API
 *
 * Complete exports for ports, adapters, and orchestration framework
 */

// Core primitives
export type { Envelope } from './core/event-envelope';
export {
  createEnvelope,
  retryEnvelope,
  isEnvelope,
} from './core/event-envelope';

export {
  once,
  deduplicateEvent,
} from './core/idempotency';

export {
  retry,
  type RetryOptions,
} from './core/retry';

export {
  createLogger,
  withCorrelation,
  type Logger,
  type LogEntry,
} from './core/logger';

// Ports (interfaces)
export type {
  IMessageBus,
  PublishOptions,
  SubscriptionOptions,
  BusHealth,
} from './ports/message-bus.port';

export type {
  IKVStore,
} from './ports/kv-store.port';

// Adapters
export {
  makeRedisSuite,
  makeRedisClient,
  type RedisSuite,
} from './adapters/redis-suite';

export {
  makeRedisBus,
} from './adapters/redis-bus.adapter';

export {
  makeRedisKV,
  makeTenantKV,
} from './adapters/redis-kv.adapter';

// Orchestration
export { BaseOrchestrator } from './orchestration/base-orchestrator';
export type {
  OrchestratorOptions,
  OrchestratorInput,
  OrchestratorOutput,
} from './orchestration/base-orchestrator';

export { PlanCoordinator } from './orchestration/plan-coordinator';
export type {
  PlanInput,
  PlanOutput,
} from './orchestration/plan-coordinator';

// Bootstrap
export { OrchestratorContainer, createContainer, bootstrapOrchestrator } from './bootstrap';
export type { BootstrapConfig } from './bootstrap';
