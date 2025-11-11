# Redis Envelope Contract - Design & Implementation

**Status:** ✅ Complete
**Session:** #39 Follow-up
**Purpose:** Type-safe, validated message passing across all Redis operations

---

## Overview

The **Envelope Contract** provides a production-grade messaging contract that:

1. ✅ **Validates** all envelopes with Zod schemas
2. ✅ **Type-safe** handler registration via discriminated unions
3. ✅ **Auto-generates** IDs and timestamps
4. ✅ **Tracks** attempts and errors in metadata
5. ✅ **Enables** deterministic idempotency
6. ✅ **Supports** correlation tracing across phases
7. ✅ **Enforces** event type registry
8. ✅ **Provides** serialization helpers

---

## Architecture

### Layers

```
┌──────────────────────────────────┐
│  Application Layer               │
│  (Phase Coordinators)            │
└────────────────┬─────────────────┘
                 │
┌────────────────▼─────────────────┐
│  Envelope Contract Layer         │
│  ├─ Validation (Zod)            │
│  ├─ Type Guards                 │
│  ├─ Event Registry              │
│  └─ Handler Dispatch            │
└────────────────┬─────────────────┘
                 │
┌────────────────▼─────────────────┐
│  Redis Adapters                  │
│  ├─ Pub/Sub Bus                 │
│  ├─ Streams (Durable)           │
│  └─ KV Store (Idempotency)      │
└──────────────────────────────────┘
```

### Files

| File | Purpose |
|------|---------|
| `core/event-envelope.ts` | Basic envelope type definition |
| `core/envelope-schema.ts` | **NEW** - Zod schemas, type guards, validation |
| `adapters/redis-bus.adapter.ts` | Pub/Sub using envelopes |
| `adapters/redis-streams.adapter.ts` | Durable streams using envelopes |
| `adapters/redis-kv.adapter.ts` | Idempotency tracking |

---

## Core Concepts

### 1. Envelope Structure

Every message is wrapped:

```typescript
type Envelope<T> = {
  id: string;                    // UUID - for deduplication
  type: string;                  // EventType - for routing
  ts: string;                    // ISO 8601 timestamp
  corrId?: string;               // Correlation ID - trace workflows
  tenantId?: string;             // Multi-tenancy
  source?: string;               // Origin (orchestrator, agent name)
  payload: T;                    // Actual message data
  meta?: {
    attempts?: number;           // Retry count
    lastError?: string;          // Previous error
    version?: number;            // Schema version
    custom?: Record<...>;        // Custom metadata
  };
};
```

### 2. Event Type Registry

Discriminated union of all valid event types:

```typescript
enum EventType {
  // Request → Processing → Result or Error
  PLAN_REQUEST = 'phase.plan.request',
  PLAN_RESULT = 'phase.plan.result',
  PLAN_ERROR = 'phase.plan.error',

  CODE_REQUEST = 'phase.code.request',
  CODE_RESULT = 'phase.code.result',
  CODE_ERROR = 'phase.code.error',

  // ... more phases ...

  // System events
  HEALTH_CHECK = 'system.health_check',
  DEAD_LETTER = 'system.dead_letter',
}
```

### 3. Type-Safe Payloads

Map event types to payload types:

```typescript
interface EventPayloadMap {
  [EventType.PLAN_REQUEST]: {
    projectId: string;
    requirements: string;
  };

  [EventType.PLAN_RESULT]: {
    projectId: string;
    plan: Record<string, unknown>;
  };

  [EventType.PLAN_ERROR]: {
    projectId: string;
    error: string;
  };

  // ... more event types ...
}
```

---

## Usage Patterns

### Creating Envelopes

```typescript
import { createEnvelope, EventType } from './hexagonal/core/envelope-schema';

// Create request
const planRequest = createEnvelope(
  EventType.PLAN_REQUEST,
  {
    projectId: '123',
    requirements: 'Build a calculator...',
  },
  'wf-abc123',  // correlationId
  'tenant-456'  // tenantId
);

// Result: type-safe, validated, auto-ID'd
// {
//   id: 'uuid-xxx',
//   type: 'phase.plan.request',
//   ts: '2025-11-11T...',
//   corrId: 'wf-abc123',
//   tenantId: 'tenant-456',
//   payload: { projectId: '123', requirements: '...' },
//   meta: { attempts: 0, version: 1 }
// }
```

### Validating Envelopes

```typescript
import {
  validateEnvelope,
  parseEnvelope,
  tryParseEnvelope,
  isEnvelope,
} from './hexagonal/core/envelope-schema';

// Throw on invalid
try {
  validateEnvelope(unknownValue);
} catch (e) {
  console.error('Invalid envelope:', e.message);
}

// Parse from JSON
const env = parseEnvelope(jsonString);

// Safe parse with fallback
const env = tryParseEnvelope(jsonString) ?? defaultEnvelope;

// Type guard
if (isEnvelope(value)) {
  // Now TypeScript knows it's an Envelope
}
```

### Type-Safe Handler Registration

```typescript
import { EnvelopeHandlerRegistry, EventType } from './hexagonal/core/envelope-schema';

const registry = new EnvelopeHandlerRegistry();

// Register handler for PLAN_REQUEST
registry.register(EventType.PLAN_REQUEST, async (env) => {
  // TypeScript knows env.payload is { projectId, requirements }
  const { projectId, requirements } = env.payload;
  console.log(`Planning ${projectId}: ${requirements}`);
});

// Register handler for PLAN_RESULT
registry.register(EventType.PLAN_RESULT, async (env) => {
  // TypeScript knows env.payload is { projectId, plan }
  const { projectId, plan } = env.payload;
  console.log(`Plan for ${projectId}:`, plan);
});

// Dispatch envelope to handlers
const envelope = createEnvelope(EventType.PLAN_REQUEST, {...});
await registry.dispatch(envelope);
```

### Type Guards for Routing

```typescript
import {
  isEnvelopeOfType,
  isRequestEnvelope,
  isResultEnvelope,
  isErrorEnvelope,
  hasExhaustedRetries,
} from './hexagonal/core/envelope-schema';

// Check specific type
if (isEnvelopeOfType(env, EventType.PLAN_REQUEST)) {
  // Handle plan request
}

// Check envelope category
if (isRequestEnvelope(env)) {
  // Route to request handlers
} else if (isResultEnvelope(env)) {
  // Route to result handlers
} else if (isErrorEnvelope(env)) {
  // Route to error handlers
}

// Check retry exhaustion
if (hasExhaustedRetries(env, 5)) {
  // Send to dead-letter queue
}
```

### Retry Handling

```typescript
import { retryEnvelope } from './hexagonal/core/envelope-schema';

// Original request fails
try {
  await processRequest(env);
} catch (error) {
  // Create retry envelope with incremented attempt
  const retryEnv = retryEnvelope(env, error.message);
  // retryEnv.meta.attempts = 1
  // retryEnv.meta.lastError = error.message
  // retryEnv.meta.version = 2

  // Republish to retry topic
  await bus.publish('phase.plan.request:retry', retryEnv);
}
```

---

## Redis Integration

### Pub/Sub with Envelopes

```typescript
import { serializeEnvelope, deserializeEnvelope } from './hexagonal/core/envelope-schema';

// Publish
const envelope = createEnvelope(EventType.PLAN_REQUEST, {...});
await redis.publish('phase.plan.request', serializeEnvelope(envelope));

// Subscribe
redis.subscribe('phase.plan.request', (msg) => {
  const envelope = deserializeEnvelope(msg);
  // Type-safe processing
  if (isEnvelopeOfType(envelope, EventType.PLAN_REQUEST)) {
    handlePlanRequest(envelope);
  }
});
```

### Streams with Envelopes

```typescript
// Add to stream
const envelope = createEnvelope(EventType.PLAN_REQUEST, {...});
await redis.xadd('phase.plan', '*', {
  payload: serializeEnvelope(envelope),
});

// Read from stream
const messages = await redis.xread({ streams: { 'phase.plan': '0' } });
for (const msg of messages) {
  const envelope = deserializeEnvelope(msg.payload);
  await handleEnvelope(envelope);
}
```

### Idempotency via Envelope ID

```typescript
// Track envelope.id in KV store
const key = `seen:${envelope.id}`;
const alreadyProcessed = await redis.get(key);

if (alreadyProcessed) {
  console.log('Skipping duplicate:', envelope.id);
  return;
}

// Process
await processEnvelope(envelope);

// Mark as processed
await redis.set(key, '1', 'EX', 3600); // 1 hour TTL
```

---

## Error Handling

### Dead-Letter Queue

```typescript
import { createDeadLetterEnvelope, hasExhaustedRetries } from './hexagonal/core/envelope-schema';

if (hasExhaustedRetries(envelope, 5)) {
  // Create DLQ envelope
  const dlqEnv = createDeadLetterEnvelope(
    envelope.id,
    'Max retries exhausted',
    envelope.corrId
  );

  // Send to DLQ stream
  await redis.xadd('dlq', '*', {
    payload: serializeEnvelope(dlqEnv),
  });

  console.log(`Sent to DLQ: ${envelope.id}`);
}
```

---

## Logging & Tracing

### Structured Logging with Envelopes

```typescript
import { envelopeSnapshot } from './hexagonal/core/envelope-schema';

logger.info('Processing envelope', {
  ...envelopeSnapshot(envelope),
  duration: endTime - startTime,
  result: 'success',
});

// Output:
// {
//   "ts": "2025-11-11T17:01:22Z",
//   "scope": "plan-coordinator",
//   "msg": "Processing envelope",
//   "id": "uuid-xxx",
//   "type": "phase.plan.request",
//   "corrId": "wf-abc123",
//   "attempts": 0,
//   "duration": 125,
//   "result": "success"
// }
```

### Correlation Tracing

All envelopes carry `corrId` (correlation ID), enabling end-to-end tracing:

```
PlanRequest (corrId: wf-abc123)
  → logs with corrId
  → produces PlanResult (corrId: wf-abc123)
    → logs with corrId
    → produces CodeRequest (corrId: wf-abc123)
      → logs with corrId
      → etc.

// All operations for workflow wf-abc123 can be traced:
grep 'wf-abc123' logs/* | jq .
```

---

## Validation Rules

### Envelope Schema (Zod)

```typescript
EnvelopeSchema = z.object({
  id: z.string().uuid(),                    // Must be valid UUID
  type: z.string().regex(/^[a-z0-9.]+$/),  // Lowercase + dots
  ts: z.string().datetime(),                // ISO 8601
  corrId: z.string().optional(),            // Optional
  tenantId: z.string().optional(),          // Optional
  source: z.string().optional(),            // Optional
  payload: z.unknown(),                     // Any type
  meta: z.object({...}).optional(),         // Optional metadata
}).strict();
```

### Validation Points

| Operation | Validation |
|-----------|-----------|
| `createEnvelope()` | Validates before returning |
| `retryEnvelope()` | Validates before returning |
| `parseEnvelope()` | Throws on invalid |
| `tryParseEnvelope()` | Returns null on invalid |
| Redis publish | Serialize, then validate |
| Redis subscribe | Parse, then validate |

---

## Benefits

### Type Safety
- ✅ Payload types tied to event types
- ✅ TypeScript compile-time checking
- ✅ IDE autocomplete for payload fields
- ✅ No runtime `as any` casts

### Reliability
- ✅ Deterministic IDs prevent duplicates
- ✅ Structured retry tracking
- ✅ Correlation ID tracing
- ✅ Dead-letter queue routing

### Observability
- ✅ Structured logging with envelopes
- ✅ Correlation tracing across phases
- ✅ Audit trail via envelope history
- ✅ Error tracking in metadata

### Developer Experience
- ✅ Factory functions with defaults
- ✅ Type guards for safe dispatch
- ✅ Handler registry for clean code
- ✅ Snapshot helpers for logging

---

## Testing

### Unit Testing

```typescript
import { createEnvelope, EventType } from '../envelope-schema';

describe('Envelope Contract', () => {
  it('creates valid envelope', () => {
    const env = createEnvelope(
      EventType.PLAN_REQUEST,
      { projectId: '123', requirements: 'test' }
    );

    expect(env.id).toBeDefined();
    expect(env.type).toBe(EventType.PLAN_REQUEST);
    expect(env.payload.projectId).toBe('123');
  });

  it('validates envelope on creation', () => {
    expect(() => {
      createEnvelope('invalid.type', { data: 'test' } as any);
    }).toThrow('Invalid envelope');
  });
});
```

### Integration Testing

```typescript
describe('Redis Envelope Integration', () => {
  it('publishes and receives envelope', async () => {
    const env = createEnvelope(EventType.PLAN_REQUEST, {...});

    let received: Envelope | null = null;
    await redis.subscribe(EventType.PLAN_REQUEST, async (msg) => {
      received = msg;
    });

    await bus.publish(EventType.PLAN_REQUEST, env);
    await new Promise(r => setTimeout(r, 100));

    expect(received).toEqual(env.payload);
  });
});
```

---

## Migration Guide

### Before (Ad-hoc)

```typescript
// No validation, loose types
const message = {
  taskId: '123',
  action: 'plan',
  data: { requirements: 'test' }
};

await redis.publish('phase.plan', JSON.stringify(message));

// On receive: no type safety
redis.subscribe('phase.plan', (raw) => {
  const msg = JSON.parse(raw);
  console.log(msg.data?.requirements); // Might be undefined!
});
```

### After (Envelope Contract)

```typescript
// Fully typed and validated
const envelope = createEnvelope(
  EventType.PLAN_REQUEST,
  { projectId: '123', requirements: 'test' },
  'correlation-xyz'
);

await bus.publish(EventType.PLAN_REQUEST, envelope);

// On receive: type-safe dispatch
if (isEnvelopeOfType(envelope, EventType.PLAN_REQUEST)) {
  const { projectId, requirements } = envelope.payload;
  // TypeScript guarantees these fields exist
}
```

---

## Summary

The **Envelope Contract** provides:

1. ✅ **Validation** - Zod schemas enforce structure
2. ✅ **Type Safety** - Discriminated unions eliminate `as any`
3. ✅ **Auto-Generation** - IDs, timestamps created automatically
4. ✅ **Retry Tracking** - Metadata captures attempts and errors
5. ✅ **Correlation** - `corrId` enables end-to-end tracing
6. ✅ **Handler Registry** - Type-safe dispatch to handlers
7. ✅ **Serialization** - JSON helpers for Redis operations
8. ✅ **Testing** - Easy to mock and verify contracts

This ensures all Redis pub/sub, streams, and KV operations follow a consistent, validated, type-safe contract.

---

**File Location:** `/packages/orchestrator/src/hexagonal/core/envelope-schema.ts`

**Integration:** Already exported from `index.ts` and available to all adapters.
