# Exploration Report: Concurrency Fix - Strategic Message Bus Redesign

**Date:** 2025-11-14 (Session #63)
**Status:** EXPLORE Phase
**Goal:** Design strategic solution for duplicate message delivery causing workflow failures

---

## Executive Summary

### Current Problem
Workflows fail at initialization (0% progress) due to **duplicate message delivery** causing concurrent workflow updates and CAS (Compare-And-Swap) failures.

**Root Cause:** Redis bus adapter delivers messages via BOTH pub/sub AND streams to the same handler set, resulting in 2-4x duplicate processing per message.

**Evidence:**
- Orchestrator logs: 2 messages processed 30ms apart
- Database: 4 duplicate UPDATE queries for same workflow
- Scaffold agent: Task received 4 times
- Prisma error: P2025 "Record to update not found" (CAS version mismatch)

### Strategic Direction
Given **no backward compatibility requirement**, redesign message bus architecture from scratch to eliminate dual delivery and implement proper idempotency.

**Recommended Approach:** Split into two logical buses
1. **ExecutionBus** (Streams-only, durable, idempotent) - for workflow execution
2. **NotificationBus** (Pub/Sub, ephemeral) - for monitoring/dashboards

---

## Current Architecture Analysis

### File: `packages/orchestrator/src/hexagonal/adapters/redis-bus.adapter.ts`

#### Problem 1: Dual Delivery System

**Pub/Sub Delivery (Lines 38-67):**
```typescript
await sub.pSubscribe('*', async (message: string, channel: string) => {
  const handlers = subscriptions.get(channel);
  // ... parse message ...
  await Promise.all(
    Array.from(handlers).map(h => h(msg))  // ⚠️ FIRST INVOCATION
  );
});
```

**Stream Delivery (Lines 122-207):**
```typescript
while (subscriptions.has(topic)) {
  const results = await pub.xReadGroup(...);
  // ... parse message ...
  const handlers = subscriptions.get(topic);
  await Promise.all(
    Array.from(handlers).map(h => h(parsedMessage))  // ⚠️ SECOND INVOCATION
  );
}
```

**Impact:** Same handler invoked twice (pub/sub + stream) for every message with `mirrorToStream` option.

#### Problem 2: Unstable Consumer Names (Line 107)
```typescript
const consumerName = `consumer-${Date.now()}`;
```
- Creates new consumer on every subscribe call
- No consumer name stability
- Consumer group chaos across restarts

#### Problem 3: No Idempotency Layer
- Messages have no stable `message_id` for deduplication
- No idempotency storage (Redis KV or Postgres)
- Handlers not protected from duplicate invocation

### File: `packages/orchestrator/src/repositories/workflow.repository.ts`

#### CAS Implementation (Lines 113-149)

**Correctly Implemented:**
```typescript
const updated = await this.prisma.workflow.update({
  where: {
    id,
    version: currentVersion  // ✅ CAS condition
  },
  data: {
    ...data,
    version: { increment: 1 }  // ✅ Atomic increment
  }
});
```

**Missing:**
```typescript
if (error.code === 'P2025') {
  // ❌ NO RETRY - just throws error
  throw new Error(`CAS failed for workflow ${id}: concurrent update detected`);
}
```
- No bounded retry with jitter
- No exponential backoff
- Fails immediately on first conflict

---

## Strategic Architecture Redesign

### Principle 1: One Delivery Semantics per Domain

**For Agentic SDLC Execution:**
- `workflow:commands` → **Streams-only**
- `workflow:events` → **Streams-only**
- `orchestrator:results` → **Streams-only**
- `agent:tasks:*` → **Streams-only**

**For Monitoring/Debug:**
- `monitoring:*` → Pub/Sub (ephemeral, fire-and-forget)
- `logs:*` → Pub/Sub
- `devtools:*` → Pub/Sub

**Result:** Execution path = Streams ONLY. No pub/sub overlap.

---

### Principle 2: Two Logical Buses

#### ExecutionBus (Durable, Idempotent)
**Technology:** Redis Streams
**Topics:**
- `workflow:commands` - Start, cancel, retry commands
- `workflow:events` - STAGE_COMPLETE, WORKFLOW_COMPLETED, WORKFLOW_FAILED
- `orchestrator:results` - Agent task results
- `agent:tasks` - Task assignments to agents

**Guarantees:**
- At-least-once delivery via consumer groups
- Ordering per workflow/trace key
- Idempotent handlers (exactly-once effects)
- Durability and replay capability

**Used by:**
- Orchestrator service
- All agents (scaffold, validation, e2e, integration, deployment)
- Workflow state machine

#### NotificationBus (Ephemeral, Best-Effort)
**Technology:** Redis Pub/Sub
**Topics:**
- `monitoring:metrics` - Real-time metrics for dashboard
- `logs:*` - Debug logs
- `devtools:hot-reload` - Development tooling

**Guarantees:**
- Fire-and-forget, no durability
- Best-effort delivery
- No retries

**Used by:**
- Dashboard UI (http://localhost:3001)
- Debug/monitoring tools
- Non-critical side-processors

---

### Principle 3: ExecutionEnvelope - First-Class Idempotency

**Canonical Message Envelope:**
```typescript
type ExecutionEnvelope<Payload> = {
  // Idempotency & Tracing
  message_id: string;      // UUID v4 - stable idempotency key
  trace_id: string;        // Workflow trace (from Session #60)
  span_id?: string;        // Current span (from Session #60)
  causation_id?: string;   // Message that caused this message
  correlation_id?: string; // Workflow ID for correlation

  // Domain Identifiers
  workflow_id?: string;
  task_id?: string;
  stage?: string;
  agent_type?: string;

  // Temporal
  created_at: string;      // ISO 8601 timestamp

  // Business Payload
  payload: Payload;        // AgentResultSchema, TaskAssignment, etc.
};
```

**Requirements:**
- **Every** ExecutionBus message MUST have `message_id`
- **Every** ExecutionBus message MUST have `trace_id` (Session #60 tracing)
- **Every** ExecutionBus message SHOULD have `workflow_id` when applicable

**Schema Location:**
- `packages/shared/types/src/execution/envelope.ts` (new file)
- `AgentResultSchema` becomes `ExecutionEnvelope<AgentResult>`
- `TaskAssignmentSchema` becomes `ExecutionEnvelope<TaskAssignment>`

---

### Principle 4: Idempotency Strategy

**Goal:** Exactly-once effects on top of at-least-once message delivery

#### 4a. Idempotency Storage

**Option 1: Postgres Table (RECOMMENDED)**
```sql
CREATE TABLE processed_messages (
  message_id UUID PRIMARY KEY,
  handler_name VARCHAR(100) NOT NULL,
  processed_at TIMESTAMP NOT NULL,
  workflow_id UUID,
  trace_id UUID,
  INDEX idx_workflow_id (workflow_id),
  INDEX idx_trace_id (trace_id)
);
```

**Benefits:**
- Same transactional boundary as workflow updates
- Atomic idempotency check + workflow update
- Full audit trail for debugging

**Option 2: Redis KV**
```typescript
await redisClient.set(
  `idempotency:${message_id}`,
  JSON.stringify({ processed_at: new Date(), handler: 'WorkflowService.handleResult' }),
  { EX: 86400 } // 24 hour TTL
);
```

**Benefits:**
- Faster lookups (in-memory)
- Automatic cleanup via TTL
- Simpler implementation

**Recommendation:** Start with **Postgres** for strong consistency, migrate to Redis if performance becomes issue.

#### 4b. Handler Contract (Universal Pattern)

```typescript
async function handleExecutionMessage(env: ExecutionEnvelope<any>) {
  // 1. Idempotency Check
  const alreadyProcessed = await idempotencyStore.has(env.message_id);
  if (alreadyProcessed) {
    logger.debug('Skipping duplicate message', {
      message_id: env.message_id,
      trace_id: env.trace_id
    });
    return; // ✅ Safe to skip
  }

  // 2. Business Logic (within transaction if using Postgres)
  await prisma.$transaction(async (tx) => {
    // Apply workflow updates
    await applyBusinessLogic(env, tx);

    // Mark as processed (same transaction)
    await tx.processedMessage.create({
      data: {
        message_id: env.message_id,
        handler_name: 'WorkflowService.handleAgentResult',
        processed_at: new Date(),
        workflow_id: env.workflow_id,
        trace_id: env.trace_id
      }
    });
  });

  logger.info('Message processed', {
    message_id: env.message_id,
    trace_id: env.trace_id
  });
}
```

**Apply to:**
- ✅ `orchestrator:results` handler (WorkflowService.handleAgentResult)
- ✅ `workflow:events` handler (State machine event handler)
- ✅ `agent:tasks` handler (BaseAgent.handleTaskAssignment)

#### 4c. CAS Retry Strategy

**Current (workflow.repository.ts:138-148):**
```typescript
if (error.code === 'P2025') {
  throw new Error(`CAS failed for workflow ${id}: concurrent update detected`);
}
```

**Strategic Pattern:**
```typescript
async function updateWorkflowWithRetry(id: string, data: any, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const existing = await findById(id);
      const updated = await prisma.workflow.update({
        where: { id, version: existing.version },
        data: { ...data, version: { increment: 1 } }
      });
      return updated; // ✅ Success
    } catch (error: any) {
      if (error.code === 'P2025' && attempt < maxRetries) {
        // CAS conflict - another process updated it
        const jitter = Math.random() * 100; // 0-100ms
        const backoff = Math.pow(2, attempt) * 50; // 100ms, 200ms, 400ms
        await sleep(backoff + jitter);
        logger.warn('CAS conflict, retrying', { attempt, workflow_id: id });
        continue;
      }
      throw error; // Give up after max retries or non-CAS error
    }
  }

  // Emit conflict event for human/agent intervention
  await messageBus.publish('workflow:events', {
    type: 'WORKFLOW_CONFLICT',
    workflow_id: id,
    error: 'Max CAS retries exceeded',
    trace_id: existing.trace_id
  });

  throw new Error(`CAS failed for workflow ${id} after ${maxRetries} retries`);
}
```

---

### Principle 5: Stream Consumer Topology

**Strategic Design:**
- **One consumer group per logical service** (not per instance)
- Multiple instances share the same consumer group
- Horizontal scaling via consumer names

**Consumer Groups:**
```typescript
// Orchestrator
group = "orchestrator-workflow"
consumer = `orchestrator-${process.env.HOSTNAME || 'local'}-${process.pid}`

// Scaffold Agent
group = "scaffold-agent"
consumer = `scaffold-${process.env.HOSTNAME || 'local'}-${process.pid}`

// Validation Agent
group = "validation-agent"
consumer = `validation-${process.env.HOSTNAME || 'local'}-${process.pid}`
```

**Stream Consumption (orchestrator:results example):**
```typescript
const stream = "orchestrator:results:stream";
const group = "orchestrator-workflow";
const consumer = `orchestrator-${process.env.HOSTNAME}-${process.pid}`;

executionBus.consumeStream(stream, group, consumer, handleExecutionMessage);
```

**NO pub/sub subscription for execution topics.**

---

### Principle 6: ExecutionBus API Design

**Current Generic API (message-bus.port.ts):**
```typescript
interface IMessageBus {
  publish(topic: string, msg: any, opts?: PublishOptions): Promise<void>;
  subscribe(topic: string, handler: (msg: any) => Promise<void>): Promise<() => Promise<void>>;
}
```

**Strategic ExecutionBus API:**
```typescript
interface IExecutionBus {
  publishCommand(
    channel: 'workflow:commands' | 'agent:tasks',
    envelope: ExecutionEnvelope<any>
  ): Promise<void>;

  publishEvent(
    channel: 'workflow:events' | 'orchestrator:results',
    envelope: ExecutionEnvelope<any>
  ): Promise<void>;

  consume(
    channel: string,
    group: string,
    consumer: string,
    handler: (env: ExecutionEnvelope<any>) => Promise<void>
  ): Promise<void>;

  health(): Promise<BusHealth>;
  disconnect(): Promise<void>;
}
```

**Internal Implementation:**
```typescript
async publishCommand(channel, envelope) {
  // Validate envelope has required fields
  if (!envelope.message_id || !envelope.trace_id) {
    throw new Error('ExecutionEnvelope must have message_id and trace_id');
  }

  // Map channel → Redis stream name
  const streamKey = `stream:${channel}`;

  // ONLY xAdd - no pub/sub
  await redisClient.xAdd(streamKey, '*', {
    envelope: JSON.stringify(envelope)
  });

  logger.info('Command published', { channel, message_id: envelope.message_id });
}
```

**No dual delivery - streams ONLY.**

---

### Principle 7: Single Writer per Workflow

**Strategic Invariant:** Only one logical handler mutates workflow state.

**Flow:**
1. Agent processes task → publishes `orchestrator:results` with `ExecutionEnvelope<AgentResult>`
2. WorkflowService consumes `orchestrator:results`:
   - Checks idempotency by `message_id`
   - Applies DB update for workflow stage (with CAS retry)
   - Emits next `workflow:events` / `agent:tasks`
   - Sends event to state machine
3. Agents **never** directly update Workflow rows

**File Changes:**
- `packages/orchestrator/src/services/workflow.service.ts` - Only service that calls `workflowRepository.update()`
- `packages/agents/base-agent/src/base-agent.ts` - Only publishes results, never updates workflows

**Enforcement:** Database-level constraint (Prisma schema validation).

---

### Principle 8: Remove Pub/Sub from Execution Path

**Current Code (redis-bus.adapter.ts:74-90):**
```typescript
async publish(topic: string, msg: any, opts?: PublishOptions) {
  // Mirror to stream
  if (opts?.mirrorToStream) {
    await pub.xAdd(opts.mirrorToStream, '*', { topic, payload });
  }

  // ❌ REMOVE THIS - causes dual delivery
  const receivers = await pub.publish(topic, payload);
}
```

**Strategic Change:**
```typescript
// ExecutionBus.publishEvent()
async publishEvent(channel: string, envelope: ExecutionEnvelope<any>) {
  const streamKey = `stream:${channel}`;

  // ✅ ONLY xAdd - no pub.publish()
  await redisClient.xAdd(streamKey, '*', {
    envelope: JSON.stringify(envelope)
  });
}
```

**Result:** Execution topics (`orchestrator:results`, `workflow:events`) delivered ONLY via streams.

---

### Principle 9: Migration Strategy

**Quick Fix (Immediate - 30 minutes):**
```typescript
// redis-bus.adapter.ts:74-90
async publish(topic: string, msg: any, opts?: PublishOptions) {
  // ONLY use streams - disable pub/sub
  if (opts?.mirrorToStream) {
    await pub.xAdd(opts.mirrorToStream, '*', { topic, payload });
    // ❌ REMOVE: await pub.publish(topic, payload)
  }
}
```
- Eliminates duplicate delivery immediately
- Workflows should complete successfully
- Allows time for strategic refactor

**Strategic Refactor (Full Solution - 4-6 hours):**

**Phase 1: Split Buses (2 hours)**
1. Create `IExecutionBus` interface in `packages/orchestrator/src/hexagonal/ports/execution-bus.port.ts`
2. Implement `RedisExecutionBus` in `packages/orchestrator/src/hexagonal/adapters/redis-execution-bus.adapter.ts`
3. Keep existing `IMessageBus` for notifications (rename to `INotificationBus`)

**Phase 2: ExecutionEnvelope (1 hour)**
1. Create `ExecutionEnvelope<T>` schema in `packages/shared/types/src/execution/envelope.ts`
2. Update `TaskAssignmentSchema` to use envelope
3. Update `TaskResultSchema` to use envelope

**Phase 3: Idempotency Layer (2 hours)**
1. Create Prisma migration for `processed_messages` table
2. Implement idempotency check in `WorkflowService.handleAgentResult()`
3. Wrap in transaction with workflow update
4. Add CAS retry logic to `WorkflowRepository.update()`

**Phase 4: Consumer Topology (1 hour)**
1. Fix consumer names to use `${HOSTNAME}-${PID}` pattern
2. Update all subscribe calls to use stable consumer groups
3. Remove pub/sub subscriptions from execution topics

---

## Implementation Path Forward

### Recommended Approach: **Quick Fix → Strategic Refactor**

**Step 1: Quick Fix (This Session - 30 min)**
- Comment out `pub.publish()` in redis-bus.adapter.ts:88
- Test workflow completion
- Verify no duplicate messages in logs

**Step 2: Validate Fix (Next Session - 1 hour)**
- Run full pipeline test suite
- Check orchestrator logs for single message processing
- Verify CAS conflicts eliminated
- Monitor dashboard for workflow progress

**Step 3: Strategic Refactor (Following Session - 6 hours)**
- Implement ExecutionBus/NotificationBus split
- Add ExecutionEnvelope with message_id
- Implement Postgres idempotency table
- Add CAS retry logic
- Fix consumer topology

---

## Risks & Mitigations

### Risk 1: Quick Fix Breaks Pub/Sub Consumers
**Likelihood:** Low
**Impact:** Medium
**Mitigation:** Only execution topics are affected. Dashboard/monitoring use REST API polling, not pub/sub.

### Risk 2: Idempotency Storage Performance
**Likelihood:** Medium
**Impact:** Low
**Mitigation:**
- Start with Postgres (simpler, transactional)
- Monitor query performance
- Migrate to Redis KV if needed (indexed by message_id)
- Add TTL cleanup job (delete processed_messages older than 7 days)

### Risk 3: CAS Retry Loop (Infinite Retries)
**Likelihood:** Low
**Impact:** High
**Mitigation:**
- Bounded retry (max 3 attempts)
- Exponential backoff with jitter
- Emit `WORKFLOW_CONFLICT` event after max retries
- Alert/monitoring for conflict events

### Risk 4: Consumer Name Instability Across Restarts
**Likelihood:** Medium
**Impact:** Low
**Mitigation:**
- Use stable consumer names: `${service}-${HOSTNAME}-${PID}`
- Document consumer naming convention
- Add health check to verify consumer group membership

---

## Dependencies & Constraints

### External Dependencies
- Redis 7.0+ (Streams support with consumer groups)
- PostgreSQL 14+ (for processed_messages table)
- Prisma 5.x (CAS via version field)

### Internal Dependencies
- Session #60 tracing implementation (trace_id, span_id)
- Hexagonal architecture (ports & adapters)
- Existing CAS implementation in WorkflowRepository

### Constraints
- **No backward compatibility required** (user confirmed)
- Must maintain distributed tracing from Session #60
- Must preserve hexagonal architecture pattern
- Must work with existing PM2 deployment

---

## Success Criteria

### Quick Fix Success
- ✅ Workflows complete successfully (not stuck at 0%)
- ✅ No duplicate message processing in logs
- ✅ No CAS P2025 errors in orchestrator logs
- ✅ Pipeline tests pass end-to-end

### Strategic Refactor Success
- ✅ ExecutionBus and NotificationBus clearly separated
- ✅ All execution messages use ExecutionEnvelope
- ✅ Idempotency storage prevents duplicate effects
- ✅ CAS conflicts auto-retry with backoff
- ✅ Consumer topology stable across restarts
- ✅ Zero duplicate message delivery
- ✅ Dashboard continues working (via REST API)
- ✅ All existing tests pass

---

## Key Files to Modify

### Quick Fix (30 min)
1. `packages/orchestrator/src/hexagonal/adapters/redis-bus.adapter.ts:88` - Comment out pub.publish()

### Strategic Refactor (6 hours)

**New Files:**
1. `packages/shared/types/src/execution/envelope.ts` - ExecutionEnvelope schema
2. `packages/orchestrator/src/hexagonal/ports/execution-bus.port.ts` - IExecutionBus interface
3. `packages/orchestrator/src/hexagonal/adapters/redis-execution-bus.adapter.ts` - ExecutionBus impl
4. `packages/orchestrator/prisma/migrations/YYYYMMDD_processed_messages.sql` - Idempotency table

**Modified Files:**
1. `packages/orchestrator/src/hexagonal/adapters/redis-bus.adapter.ts` - Rename to notification-bus
2. `packages/orchestrator/src/services/workflow.service.ts` - Add idempotency checks
3. `packages/orchestrator/src/repositories/workflow.repository.ts` - Add CAS retry
4. `packages/agents/base-agent/src/base-agent.ts` - Use ExecutionEnvelope
5. `packages/orchestrator/src/hexagonal/orchestration/orchestrator-container.ts` - Wire ExecutionBus
6. `packages/shared/types/src/core/schemas.ts` - Wrap schemas in ExecutionEnvelope

**Total Impact:** 6 new files, ~10 modified files, ~800 lines of code

---

## Exploration Checklist

- [x] CLAUDE.md reviewed (Session #62 status)
- [x] Current architecture mapped (redis-bus.adapter.ts analyzed)
- [x] Root cause identified (dual delivery pub/sub + streams)
- [x] Strategic guidance reviewed (9-point architecture)
- [x] Coding patterns documented (CAS, consumer groups)
- [x] Similar implementations reviewed (Session #60 tracing)
- [x] Constraints understood (no backward compat needed)
- [x] Risks assessed (performance, retry loops)
- [x] Dependencies identified (Redis, Postgres, Prisma)
- [x] Testing approach understood (pipeline test suite)
- [x] Migration strategy defined (quick fix → strategic)

---

## Appendix A: Message Flow Comparison

### Current (Broken) Flow

```
HTTP POST /api/v1/workflows
  ↓
WorkflowService.createWorkflow()
  ↓
messageBus.publish('agent:tasks:scaffold', task, { mirrorToStream: 'stream:agent:tasks:scaffold' })
  ↓
┌─────────────────────────────────────┐
│ redis-bus.adapter.ts                │
│                                     │
│ 1. xAdd to stream                  │ ← First delivery path
│ 2. publish to pub/sub              │ ← Second delivery path
└─────────────────────────────────────┘
  ↓                    ↓
┌─────────────────┐  ┌──────────────────┐
│ Stream Consumer │  │ Pub/Sub Listener │
│ (Line 122-207)  │  │ (Line 38-67)     │
└─────────────────┘  └──────────────────┘
  ↓                    ↓
  └────────┬───────────┘
           ↓
  BaseAgent.handleTaskAssignment()  ← INVOKED TWICE
           ↓
  messageBus.publish('orchestrator:results', result, { mirrorToStream: 'stream:orchestrator:results' })
           ↓
┌─────────────────────────────────────┐
│ redis-bus.adapter.ts                │
│                                     │
│ 1. xAdd to stream                  │ ← First delivery path
│ 2. publish to pub/sub              │ ← Second delivery path
└─────────────────────────────────────┘
  ↓                    ↓
┌─────────────────┐  ┌──────────────────┐
│ Stream Consumer │  │ Pub/Sub Listener │
└─────────────────┘  └──────────────────┘
  ↓                    ↓
  └────────┬───────────┘
           ↓
  WorkflowService.handleAgentResult()  ← INVOKED TWICE (30ms apart)
           ↓
  workflowRepository.update(workflow_id, { progress: 10 })
           ↓
┌─────────────────────────────────────┐
│ Prisma UPDATE                       │
│ WHERE id = ? AND version = 0        │ ← First update succeeds
│ SET progress = 10, version = 1      │
└─────────────────────────────────────┘
           ↓
  (30ms later - duplicate message)
           ↓
  workflowRepository.update(workflow_id, { progress: 10 })
           ↓
┌─────────────────────────────────────┐
│ Prisma UPDATE                       │
│ WHERE id = ? AND version = 0        │ ← No matching row (version is now 1)
│ SET progress = 10, version = 1      │ ❌ FAILS with P2025
└─────────────────────────────────────┘
           ↓
  Error: CAS failed for workflow
  Workflow stuck at 0%
```

### Strategic (Fixed) Flow

```
HTTP POST /api/v1/workflows
  ↓
WorkflowService.createWorkflow()
  ↓
executionBus.publishCommand('agent:tasks', ExecutionEnvelope<TaskAssignment>)
  ↓
┌─────────────────────────────────────┐
│ redis-execution-bus.adapter.ts      │
│                                     │
│ ONLY: xAdd to stream                │ ← Single delivery path
└─────────────────────────────────────┘
  ↓
┌─────────────────┐
│ Stream Consumer │
│ (stable name)   │
└─────────────────┘
  ↓
BaseAgent.handleTaskAssignment(envelope: ExecutionEnvelope<TaskAssignment>)
  ↓
  1. Check idempotency: has(envelope.message_id)? SKIP : CONTINUE
  2. Process task
  3. Mark processed: store(envelope.message_id)
  ↓
executionBus.publishEvent('orchestrator:results', ExecutionEnvelope<AgentResult>)
  ↓
┌─────────────────────────────────────┐
│ redis-execution-bus.adapter.ts      │
│                                     │
│ ONLY: xAdd to stream                │ ← Single delivery path
└─────────────────────────────────────┘
  ↓
┌─────────────────┐
│ Stream Consumer │
└─────────────────┘
  ↓
WorkflowService.handleAgentResult(envelope: ExecutionEnvelope<AgentResult>)
  ↓
  1. Check idempotency: has(envelope.message_id)? SKIP : CONTINUE
  2. Update workflow (with CAS retry)
  3. Mark processed: store(envelope.message_id)
  ↓
prisma.$transaction(async (tx) => {
  // CAS update with retry
  const updated = await tx.workflow.update({
    where: { id, version },
    data: { progress: 10, version: { increment: 1 } }
  });

  // Mark as processed (same transaction)
  await tx.processedMessage.create({
    data: { message_id: envelope.message_id, ... }
  });
})
  ↓
✅ Workflow advances to 10%
✅ No duplicate processing (idempotency check)
✅ No CAS conflicts (single writer + retry)
```

---

## Appendix B: Code Samples

### ExecutionEnvelope Schema

```typescript
// packages/shared/types/src/execution/envelope.ts

import { z } from 'zod';

export const ExecutionEnvelopeSchema = z.object({
  // Idempotency & Tracing
  message_id: z.string().uuid(),
  trace_id: z.string().uuid(),
  span_id: z.string().optional(),
  causation_id: z.string().uuid().optional(),
  correlation_id: z.string().uuid().optional(),

  // Domain Identifiers
  workflow_id: z.string().uuid().optional(),
  task_id: z.string().uuid().optional(),
  stage: z.string().optional(),
  agent_type: z.string().optional(),

  // Temporal
  created_at: z.string().datetime(),

  // Generic payload
  payload: z.unknown()
});

export type ExecutionEnvelope<T = unknown> = Omit<z.infer<typeof ExecutionEnvelopeSchema>, 'payload'> & {
  payload: T;
};

// Helper to create envelope
export function createExecutionEnvelope<T>(
  payload: T,
  meta: {
    trace_id: string;
    workflow_id?: string;
    task_id?: string;
    span_id?: string;
  }
): ExecutionEnvelope<T> {
  return {
    message_id: crypto.randomUUID(),
    trace_id: meta.trace_id,
    span_id: meta.span_id,
    workflow_id: meta.workflow_id,
    task_id: meta.task_id,
    created_at: new Date().toISOString(),
    payload
  };
}
```

### IExecutionBus Interface

```typescript
// packages/orchestrator/src/hexagonal/ports/execution-bus.port.ts

export interface ExecutionBusHealth {
  ok: boolean;
  latencyMs?: number;
  details?: {
    streamConnected: boolean;
    consumerGroups: string[];
  };
}

export interface IExecutionBus {
  /**
   * Publish a command (workflow:commands, agent:tasks)
   */
  publishCommand<T>(
    channel: 'workflow:commands' | 'agent:tasks',
    envelope: ExecutionEnvelope<T>
  ): Promise<void>;

  /**
   * Publish an event (workflow:events, orchestrator:results)
   */
  publishEvent<T>(
    channel: 'workflow:events' | 'orchestrator:results',
    envelope: ExecutionEnvelope<T>
  ): Promise<void>;

  /**
   * Consume from a stream with consumer group
   */
  consume<T>(
    channel: string,
    consumerGroup: string,
    consumerName: string,
    handler: (envelope: ExecutionEnvelope<T>) => Promise<void>
  ): Promise<() => Promise<void>>;

  /**
   * Health check
   */
  health(): Promise<ExecutionBusHealth>;

  /**
   * Graceful shutdown
   */
  disconnect(): Promise<void>;
}
```

### Idempotency Check Pattern

```typescript
// packages/orchestrator/src/services/workflow.service.ts

async handleAgentResult(envelope: ExecutionEnvelope<AgentResult>): Promise<void> {
  logger.info('Received agent result', {
    message_id: envelope.message_id,
    trace_id: envelope.trace_id,
    workflow_id: envelope.workflow_id,
    task_id: envelope.task_id
  });

  // Use Prisma transaction for idempotency + workflow update
  await this.prisma.$transaction(async (tx) => {
    // 1. Check if already processed
    const existing = await tx.processedMessage.findUnique({
      where: { message_id: envelope.message_id }
    });

    if (existing) {
      logger.debug('Skipping duplicate message', {
        message_id: envelope.message_id,
        processed_at: existing.processed_at
      });
      return; // ✅ Idempotent - safe to skip
    }

    // 2. Apply business logic
    const result = envelope.payload;
    await this.processAgentResult(result, tx);

    // 3. Mark as processed (same transaction)
    await tx.processedMessage.create({
      data: {
        message_id: envelope.message_id,
        handler_name: 'WorkflowService.handleAgentResult',
        processed_at: new Date(),
        workflow_id: envelope.workflow_id,
        trace_id: envelope.trace_id,
        task_id: envelope.task_id
      }
    });

    logger.info('Message processed successfully', {
      message_id: envelope.message_id,
      trace_id: envelope.trace_id
    });
  });
}
```

### CAS Retry Helper

```typescript
// packages/orchestrator/src/repositories/workflow.repository.ts

async updateWithRetry(
  id: string,
  data: Partial<Workflow>,
  maxRetries = 3
): Promise<Workflow> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const existing = await this.findById(id);
      if (!existing) {
        throw new NotFoundError(`Workflow ${id} not found`);
      }

      const updated = await this.prisma.workflow.update({
        where: {
          id,
          version: existing.version  // CAS condition
        },
        data: {
          ...data,
          version: { increment: 1 }
        }
      });

      logger.info('Workflow updated (CAS success)', {
        workflow_id: id,
        attempt,
        version: existing.version,
        new_version: existing.version + 1
      });

      return updated;
    } catch (error: any) {
      if (error.code === 'P2025' && attempt < maxRetries) {
        // CAS conflict - retry with backoff
        const jitter = Math.random() * 100; // 0-100ms
        const backoff = Math.pow(2, attempt) * 50; // 100ms, 200ms, 400ms
        await new Promise(resolve => setTimeout(resolve, backoff + jitter));

        logger.warn('CAS conflict, retrying', {
          workflow_id: id,
          attempt,
          max_retries: maxRetries,
          backoff_ms: backoff + jitter
        });
        continue;
      }

      // Give up after max retries
      if (error.code === 'P2025') {
        logger.error('CAS failed after max retries', {
          workflow_id: id,
          attempts: maxRetries
        });
        throw new Error(`CAS failed for workflow ${id} after ${maxRetries} retries`);
      }

      throw error;
    }
  }

  throw new Error('Unreachable');
}
```

---

## Next Steps

**Decision Required:** Choose implementation path:

1. **Quick Fix Only** (30 min) - Comment out pub.publish(), test, validate
2. **Quick Fix + Strategic Refactor** (6.5 hours) - Full architectural redesign
3. **Hybrid** - Quick fix now, strategic refactor in stages over next 3 sessions

**Recommendation:** Start with Quick Fix to unblock pipeline testing, then proceed with Strategic Refactor in next session.

Ready to proceed to PLAN phase when approved.
