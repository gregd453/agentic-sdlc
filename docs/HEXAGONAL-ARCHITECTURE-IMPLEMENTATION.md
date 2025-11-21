# Hexagonal Architecture Implementation Guide

**Status:** Architecture Framework Complete
**Session:** #37+ (Production Hardening)
**Goal:** Fix Redis issues once and for all with clean separation of concerns

---

## Overview

You're implementing a **Hexagonal (Ports & Adapters) Architecture** for the orchestrator:

```
┌─────────────────────────────────────────────────┐
│         Orchestration Layer                      │
│  (BaseOrchestrator + Phase Coordinators)         │
└────────────────┬────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
    ┌───┴───┐        ┌────┴────┐
    │ Ports │        │  Core   │
    │       │        │         │
    └───────┘        └─────────┘
        ▲                ▲
        │                │
    ┌───┴────────────────┴───┐
    │    Adapters             │
    │  (Redis, HTTP, FS)      │
    └─────────────────────────┘
```

**Key Principle:** Orchestrations depend ONLY on ports (interfaces), not concrete implementations.

---

## Files Created (Session #37+)

### Core Primitives (`hexagonal/core/`)

✅ **event-envelope.ts** (100 lines)
- `Envelope<T>` type for all messages
- `createEnvelope()` factory
- `retryEnvelope()` for retry handling
- Supports correlation IDs, tenancy, attempt tracking

✅ **idempotency.ts** (80 lines)
- `once<T>()` for exactly-once semantics
- `deduplicateEvent()` for message deduplication
- Prevents double-execution via KV tracking

✅ **retry.ts** (120 lines)
- Exponential backoff with jitter
- `retry<T>()` with configurable options
- `retryWithBackoff()` for custom strategies
- Safe bounded retries for transient failures

✅ **logger.ts** (100 lines)
- Structured JSON logging
- Scope-based context
- Correlation ID tracking
- Info, warn, error, debug levels

### Ports (Interfaces) (`hexagonal/ports/`)

✅ **message-bus.port.ts** (80 lines)
- `IMessageBus` - Pub/sub abstraction
- `publish<T>()` - Async message publishing
- `subscribe<T>()` - Handler registration
- `health()` - Connectivity checking

✅ **kv-store.port.ts** (90 lines)
- `IKVStore` - Key-value abstraction
- `get<T>()` - Retrieve values
- `set<T>()` - Store with TTL
- `cas<T>()` - Atomic compare-and-swap
- `incr()` - Atomic counters

### Adapters (`hexagonal/adapters/`)

✅ **redis-bus.adapter.ts** (250 lines)
- Implements `IMessageBus` using Redis
- Separate pub/sub clients (required)
- Optional stream mirroring for durability
- Deduplication support
- Health checking

🔄 **redis-kv.adapter.ts** (Next)
- Implements `IKVStore` using Redis
- Atomic operations (GET, SET, DEL, INCR)
- CAS with Lua scripts
- JSON serialization/deserialization

---

## Implementation Path

### Phase 1: Core (✅ Complete)
1. ✅ Event envelopes with correlation IDs
2. ✅ Idempotency primitives
3. ✅ Retry logic with backoff
4. ✅ Structured logging

### Phase 2: Ports (✅ In Progress)
1. ✅ MessageBus port
2. ✅ KVStore port
3. 🔄 StoragePort (Blob storage)
4. 🔄 SecretsPort (Credentials)
5. 🔄 AIApiPort (Claude/LLM integration)

### Phase 3: Adapters (🔄 In Progress)
1. ✅ RedisBus adapter
2. 🔄 RedisKV adapter
3. 🔄 HttpAIAPI adapter
4. 🔄 FSStorage adapter
5. 🔄 EnvSecrets adapter

### Phase 4: Orchestration (Next)
1. 🔄 BaseOrchestrator<I, O>
2. 🔄 Phase coordinators (Plan, Code, Certify, Deploy)
3. 🔄 Bootstrap/DI container
4. 🔄 Integration tests

---

## Key Design Decisions

### 1. Envelope-Based Messages
**Why:** Enables correlation tracking, deduplication, and multi-tenant support

```typescript
// Every message looks like this
type Envelope<T> = {
  id: string;           // Unique ID for dedup
  type: string;         // Message type
  corrId?: string;      // Trace across phases
  tenantId?: string;    // Multi-tenancy
  payload: T;           // Actual data
  ts: string;           // ISO timestamp
  attempts?: number;    // Retry count
};
```

### 2. Separate Pub/Sub Clients
**Why:** Redis requires separate clients for pub/sub vs regular ops

```typescript
// ✅ CORRECT
const pub = new Redis(url);     // For publishing
const sub = new Redis(url);     // For subscribing
pub.publish(topic, msg);        // OK
sub.subscribe(topic, handler);  // OK

// ❌ WRONG
const client = new Redis(url);
client.publish(topic, msg);     // OK
client.subscribe(topic, h);     // ERROR: already in sub mode!
```

### 3. Idempotency via KVStore
**Why:** Ensures exactly-once execution even with retries

```typescript
// Example: Process order
const result = await once(kv, `order:123:process`, async () => {
  // This function only runs ONCE, even if called 10 times
  return await processOrder(123);
}, 3600); // Remember for 1 hour

if (result) {
  // Executed fresh
  console.log('Processed:', result);
} else {
  // Already executed
  console.log('Already processed');
}
```

### 4. Exponential Backoff Retries
**Why:** Prevents thundering herd during transient failures

```typescript
// Example: Retry with 100ms base, cap at 30s
const result = await retry(
  () => callUnreliableAPI(),
  {
    maxAttempts: 5,
    baseDelayMs: 100,
    maxDelayMs: 30000,
    jitterFactor: 0.1,
    onRetry: (attempt, error, nextDelayMs) => {
      log.warn(`Retry attempt ${attempt} after ${nextDelayMs}ms`, { error });
    }
  }
);
```

---

## Critical Fixes These Solve

### Race Condition Prevention
**Problem:** Multiple workers processing same message simultaneously
**Solution:** Envelope IDs + Redis pub/sub dedup

```typescript
// Bus deduplicates internally
await bus.publish(topic, envelope); // Fire once
// Even if published 3x, subscribers only process once
```

### Lost Messages Prevention
**Problem:** Pub/sub messages lost if subscriber not connected
**Solution:** Optional stream mirroring

```typescript
// Critical messages mirror to stream for replay
await bus.publish(topic, envelope, {
  mirrorToStream: 'events:important' // Add durability
});
// Can replay from stream if needed
```

### Exact-Once Execution
**Problem:** Retries cause duplicate work
**Solution:** Idempotency tracking

```typescript
// Even with 5 retries, work executes once
const result = await once(kv, `task:${id}:execute`, () => {
  return doExpensiveWork();
});
```

### Dead-Letter Queue (DLQ)
**Problem:** Failed messages lost forever
**Solution:** Envelope tracking + retry limits

```typescript
// Orchestrator can track attempts and route to DLQ
if (envelope.attempts >= MAX_RETRIES) {
  await dlqBus.publish('dlq:failed', envelope);
  log.error('Message DLQ', { id: envelope.id, attempts });
}
```

---

## Usage Examples

### Publishing a Message
```typescript
import { createEnvelope } from './hexagonal/core/event-envelope';
import { IMessageBus } from './hexagonal/ports/message-bus.port';

async function publishTask(bus: IMessageBus, taskId: string) {
  const env = createEnvelope(
    'phase.plan.in',
    { taskId, items: [...] },
    'correlation-123' // Trace ID
  );

  await bus.publish('phase.plan.in', env, {
    mirrorToStream: 'events:plan'
  });
}
```

### Subscribing with Idempotency
```typescript
import { once } from './hexagonal/core/idempotency';
import { retry } from './hexagonal/core/retry';

async function startOrchestr orchestration() {
  await bus.subscribe('phase.plan.in', async (env: Envelope) => {
    // Only execute if envelope.id not seen before
    const result = await once(kv, `process:${env.id}`, async () => {
      // Retry with backoff if transient failure
      return await retry(
        () => handlePlanPhase(env.payload),
        { maxAttempts: 5 }
      );
    });

    if (result) {
      // Publish result
      await bus.publish('phase.plan.out', createEnvelope(
        'phase.plan.done',
        result,
        env.corrId
      ));
    }
  });
}
```

### Using KVStore for Caching
```typescript
async function getCachedResult(kv: IKVStore, key: string) {
  // Try cache first
  const cached = await kv.get<any>(key);
  if (cached) return cached;

  // Compute if not cached
  const result = await expensiveComputation();

  // Cache for 1 hour
  await kv.set(key, result, 3600);

  return result;
}
```

---

## Configuration

Environment variables:
```bash
# Redis
REDIS_URL=redis://localhost:6380

# Streaming
STREAM_BLOCK_MS=5000          # How long to block on read
STREAM_BATCH=50               # Max messages per read
STREAM_IDLE_MS=60000          # Idle timeout for claiming
MAX_RETRIES=5                 # Retry limit before DLQ

# Logging
DEBUG=agentic-sdlc:*          # Enable debug logs
```

---

## Testing Strategy

### Unit Tests (Mocked Ports)
```typescript
// Mock the ports
const mockBus: IMessageBus = {
  publish: jest.fn(),
  subscribe: jest.fn(),
  health: async () => ({ ok: true })
};

const mockKv: IKVStore = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  // ...
};

// Test orchestrator logic in isolation
const orch = new PlanOrchestrator(mockBus, mockKv);
await orch.handle(input, envelope);
expect(mockBus.publish).toHaveBeenCalled();
```

### Integration Tests (Real Redis)
```typescript
// Use real Redis for integration tests
const bus = await makeRedisBus({ redisUrl: 'redis://localhost:6380' });
const kv = await makeRedisKV({ redisUrl: 'redis://localhost:6380' });

// Publish message
const env = createEnvelope('test.in', { data: 'test' });
await bus.publish('test.in', env);

// Subscribe and verify
await bus.subscribe('test.in', async (msg) => {
  expect(msg).toEqual(env.payload);
});
```

### Smoke Test (End-to-End)
```bash
# 1. Start Redis
docker-compose up redis

# 2. Start orchestrator
npm start

# 3. Send test message
redis-cli PUBLISH phase.plan.in '{"id":"test","payload":{...}}'

# 4. Verify response appears on phase.plan.out
redis-cli SUBSCRIBE phase.plan.out
```

---

## Migration from Current Architecture

### Current State
- Ad-hoc Redis usage in multiple services
- No standardized message format
- Retry logic scattered across codebase
- No idempotency guarantees

### New State
1. All services use hexagonal ports
2. Standardized Envelope format
3. Centralized idempotency/retry
4. Swappable adapters (Redis today, NATS tomorrow)

### Migration Steps
1. **Start:** Create hexagonal structure (✅ In progress)
2. **Adapt:** Wrap existing Redis calls in adapters
3. **Refactor:** Update services to use ports
4. **Test:** Integration tests with real Redis
5. **Deploy:** Gradual rollout with feature flags
6. **Clean:** Remove old Redis usage

---

## Production Readiness Checklist

- [ ] All core primitives unit tested (envelopes, idempotency, retry)
- [ ] All adapters implemented (Redis bus, Redis KV, HTTP AI, FS storage)
- [ ] BaseOrchestrator with health checks
- [ ] All 5 phase coordinators (Plan, Code, Certify, Deploy, Monitor)
- [ ] Bootstrap/DI container for wiring
- [ ] Integration tests with real Redis
- [ ] E2E smoke tests
- [ ] Distributed tracing setup (correlation IDs)
- [ ] Metrics/observability (counters, latencies)
- [ ] Load testing (1000+ msg/sec)
- [ ] Chaos testing (kill Redis, inject failures)
- [ ] Documentation complete

---

## Next Steps

1. **Complete Adapters**
   - RedisKV adapter
   - HttpAIAPI adapter
   - FSStorage adapter

2. **Implement Orchestrators**
   - BaseOrchestrator<I, O>
   - Phase coordinators

3. **Create Bootstrap**
   - DI container
   - Service composition

4. **Test Suite**
   - Unit tests (mocked)
   - Integration tests (real Redis)
   - Smoke tests (E2E)

---

**Status: Framework Ready for Implementation**

This architecture will:
✅ Eliminate race conditions
✅ Prevent lost messages
✅ Guarantee exactly-once execution
✅ Enable easy swapping of technologies
✅ Provide clear separation of concerns
✅ Make testing straightforward

Ready to move forward!
