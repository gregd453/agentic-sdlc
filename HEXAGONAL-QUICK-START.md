# Hexagonal Architecture - Quick Start

## Files Created in Session #38

### Core Primitives
```
packages/orchestrator/src/hexagonal/core/
├── event-envelope.ts      # Universal message format
├── idempotency.ts         # Exactly-once execution
├── retry.ts               # Exponential backoff
└── logger.ts              # Structured logging
```

### Port Interfaces
```
packages/orchestrator/src/hexagonal/ports/
├── message-bus.port.ts    # Pub/sub abstraction
└── kv-store.port.ts       # Key-value abstraction
```

### Adapters
```
packages/orchestrator/src/hexagonal/adapters/
└── redis-bus.adapter.ts   # Redis implementation
```

---

## Quick Reference

### Create a Message
```typescript
import { createEnvelope } from './hexagonal/core/event-envelope';

const msg = createEnvelope(
  'phase.plan.in',                      // message type
  { taskId: '123', items: [...] },      // payload
  'correlation-id-xyz'                  // trace ID
);

// msg = {
//   id: 'uuid-xxx',
//   type: 'phase.plan.in',
//   ts: '2025-11-11T...',
//   corrId: 'correlation-id-xyz',
//   payload: { taskId: '123', items: [...] },
//   attempts: 0
// }
```

### Publish a Message
```typescript
import { makeRedisBus } from './hexagonal/adapters/redis-bus.adapter';

const bus = await makeRedisBus({
  redisUrl: 'redis://localhost:6380'
});

// Fire-and-forget
await bus.publish('phase.plan.in', msg);

// With durability
await bus.publish('phase.plan.in', msg, {
  mirrorToStream: 'events:plan'
});
```

### Subscribe with Handler
```typescript
await bus.subscribe('phase.plan.in', async (payload) => {
  console.log('Received:', payload);
});

// Returns unsubscribe function
const unsubscribe = await bus.subscribe('topic', handler);
await unsubscribe(); // Stop listening
```

### Execute Exactly Once
```typescript
import { once } from './hexagonal/core/idempotency';
import { IKVStore } from './hexagonal/ports/kv-store.port';

const result = await once(
  kv,                          // KVStore instance
  `task:${id}:execute`,        // Unique key
  async () => doExpensiveWork(), // Function to run once
  3600                         // TTL in seconds
);

if (result) {
  console.log('Executed:', result);
} else {
  console.log('Already executed');
}
```

### Retry with Backoff
```typescript
import { retry } from './hexagonal/core/retry';

const result = await retry(
  () => unreliableAPI.call(),
  {
    maxAttempts: 5,
    baseDelayMs: 100,
    maxDelayMs: 30000,
    jitterFactor: 0.1,
    onRetry: (attempt, error, nextDelayMs) => {
      console.log(`Attempt ${attempt} failed, retrying in ${nextDelayMs}ms`);
    }
  }
);
```

### Structured Logging
```typescript
import { createLogger } from './hexagonal/core/logger';

const log = createLogger('my-service');

log.info('Task started', { taskId: '123', corrId: 'trace-xyz' });
log.warn('Slow operation', { duration: 5000 });
log.error('Task failed', { error: 'Network timeout' });
```

---

## Architecture Decision Tree

### When to use Pub/Sub (MessageBus)
✅ Sending notifications/signals
✅ Broadcasting to multiple subscribers
✅ Fire-and-forget semantics acceptable
✅ Can afford message loss

### When to use Streams (with bus durability)
✅ Critical messages
✅ Need replay capability
✅ Durability required
✅ Ordered delivery

### When to use KVStore
✅ Idempotency tracking
✅ Caching
✅ State management
✅ Counters/metrics

### When to use Idempotency
✅ Expensive operations
✅ Operations with side effects
✅ Handling retries
✅ Distributed systems

### When to use Retry
✅ Transient failures expected (timeouts, temporary unavailability)
✅ Want to handle retries with backoff
✅ Need exponential growth + jitter
✅ Want to log retry attempts

---

## Common Patterns

### Safe Task Processing
```typescript
// Subscribe to tasks
await bus.subscribe('tasks:in', async (task) => {
  // Only run if task.id not seen before
  const result = await once(kv, `task:${task.id}`, async () => {
    // Retry if transient failure
    return await retry(() => processTask(task));
  });

  if (result) {
    // Publish result
    await bus.publish('tasks:out', {
      ...task,
      result,
      status: 'completed'
    });
  }
});
```

### Health Monitoring
```typescript
const health = await bus.health();
if (health.ok) {
  console.log(`Bus healthy (latency: ${health.latencyMs}ms)`);
} else {
  console.error('Bus unhealthy!', health.details);
}
```

### Graceful Shutdown
```typescript
async function shutdown() {
  console.log('Shutting down...');
  await bus.disconnect();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

---

## Testing

### Unit Test (Mocked Port)
```typescript
import { IMessageBus } from './hexagonal/ports/message-bus.port';

const mockBus: IMessageBus = {
  publish: jest.fn(),
  subscribe: jest.fn(),
  health: async () => ({ ok: true }),
  disconnect: jest.fn()
};

// Now test your logic with mock
const result = await processWithBus(mockBus);
expect(mockBus.publish).toHaveBeenCalledWith(
  'result-topic',
  expect.objectContaining({ status: 'success' })
);
```

### Integration Test (Real Redis)
```typescript
const bus = await makeRedisBus({ redisUrl: 'redis://localhost:6380' });
const kv = await makeRedisKV({ redisUrl: 'redis://localhost:6380' });

const msg = createEnvelope('test', { data: 'test' });
await bus.publish('test:in', msg);

// Verify it comes back
await bus.subscribe('test:in', async (received) => {
  expect(received).toEqual(msg.payload);
});
```

---

## Configuration

```bash
# Redis connection
export REDIS_URL=redis://localhost:6380

# Streams (if using durable bus)
export STREAM_BLOCK_MS=5000    # How long to wait for messages
export STREAM_BATCH=50         # Max messages per read
export MAX_RETRIES=5           # Retry limit

# Logging
export DEBUG=agentic-sdlc:*    # Enable debug logs
```

---

## Key Takeaways

1. **Envelope:** Every message is wrapped in standardized format
2. **Ports:** Depend on interfaces, not implementations
3. **Adapters:** Technology-specific implementations (Redis, NATS, etc.)
4. **Idempotency:** Makes retries safe
5. **Retry:** Handles transient failures gracefully
6. **Logging:** Structured with correlation IDs

---

## Next: Complete the Stack

See `HEXAGONAL-ARCHITECTURE-IMPLEMENTATION.md` for:
- Full architecture guide
- Design decisions explained
- More code examples
- Testing strategies
- Production readiness checklist
