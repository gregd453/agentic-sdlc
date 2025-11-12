# Redis Integration Test Failure Analysis
## Orchestrator Hexagonal Architecture - Sessions #39-50

**Analysis Date:** 2025-11-12  
**Test Suites Analyzed:**
- `packages/orchestrator/src/hexagonal/__tests__/smoke.test.ts` (18 tests)
- `packages/orchestrator/src/hexagonal/__tests__/integration.test.ts` (48 tests)

**System Status:** ~95.5% test pass rate - Integration tests require Redis dependency management

---

## 1. TEST STRUCTURE & ARCHITECTURE

### 1.1 Smoke Tests (18 tests)
**Purpose:** Quick validation that framework works with real Redis

**Test Categories:**
| Category | Tests | Goal |
|----------|-------|------|
| Bootstrap & Container | 3 | Container initialization, health checks |
| Pub/Sub Messaging | 2 | Message publish/subscribe cycle |
| KV Store Operations | 3 | Get/Set/TTL/Counter operations |
| Envelope Format | 2 | Envelope creation and validation |
| Error Recovery | 2 | Graceful error handling |
| Correlation & Tracing | 2 | Trace ID preservation |
| Resource Cleanup | 2 | Graceful shutdown |

**Key Characteristics:**
- Requires **real Redis** running (connection required during test)
- Tests operate with 100-200ms wait times for message delivery
- No Docker mocking - expects live Redis on `localhost:6380`
- Disables coordinators (`plan: false`) to avoid multi-service complexity

### 1.2 Integration Tests (48 tests)
**Purpose:** Complete framework validation with real Redis

**Test Categories:**
| Category | Tests | Dependencies |
|----------|-------|--------------|
| Message Bus (Pub/Sub) | 4 | Redis pub/sub, envelope serialization |
| KV Store | 6 | Redis KV, TTL, CAS, counters |
| Idempotency | 4 | Deduplication logic, TTL expiry |
| Retry Logic | 5 | Exponential backoff, max attempts |
| Envelope Format | 5 | Envelope creation, retry handling |
| End-to-End Flow | 2 | Full message cycle with processing |
| Error Handling | 2 | JSON parsing, handler errors |

**Setup Requirements:**
```typescript
// Before all tests
const suite = await makeRedisSuite(REDIS_URL);
const bus = makeRedisBus(suite.pub, suite.sub);
const kv = makeRedisKV(suite.base, TEST_NAMESPACE);

// Cleanup before each test
await kv.del('test:envelope');
await kv.del('test:dedup');
await kv.del('test:once');
await kv.del('test:retry');
```

---

## 2. MESSAGE DELIVERY ARCHITECTURE

### 2.1 Redis Suite (3 Separate Clients)

**Critical Pattern:** Redis subscribers cannot issue other commands while subscribed

```typescript
// redis-suite.ts - Factory Pattern
RedisSuite {
  base:  RedisClient  // General operations (KV store)
  pub:   RedisClient  // Publishing messages
  sub:   RedisClient  // Subscribing to channels (SUBSCRIBE mode)
}
```

**Initialization Flow:**
```
1. createClient(url) for each client
2. client.on('error', handler) - error listener setup
3. await client.connect() - async connection
4. client.ping() - health verification
5. Parallel creation of all 3 clients
```

**Lifecycle Management:**
```
Connect: createClient → on('error') → connect() → ready
Operate: publish() / get() / subscribe()
Disconnect: quit() → disconnected (can fail gracefully)
```

### 2.2 Message Bus Adapter (Pub/Sub)

**Key Implementation Details:**

```typescript
// redis-bus.adapter.ts - Message Flow
1. LISTENER SETUP (async, background)
   - pSubscribe('*', handler) - pattern matching all topics
   - Message signature: (message: string, channel: string)
   - NOT (channel, message) - order is critical!

2. ENVELOPE WRAPPING
   - Input: Envelope<T> with metadata
   - Format: { key?: string, msg: Envelope<T> }
   - Serialized: JSON.stringify(envelope)

3. MESSAGE PARSING
   - JSON.parse(message) extracts envelope
   - msg = envelope.msg ?? envelope
   - Handles both wrapped and raw envelope formats

4. HANDLER EXECUTION
   - subscriptions.get(channel) returns Set<handlers>
   - Promise.all() executes all handlers concurrently
   - Error in one handler doesn't block others
   - Logging on each handler execution

5. PUBLISH
   - await pub.publish(topic, payload)
   - Returns receiver count
   - Optional stream mirroring for durability
```

**Critical Issue: Async Listener Setup**

```typescript
// CURRENT: Async IIFE without await
(async () => {
  try {
    await sub.pSubscribe('*', async (message, channel) => {
      // Handler code
    });
  } catch (e) {
    log.error('PSubscribe listener error', { error: String(e) });
  }
})().catch((e) => log.error('Uncaught pSubscribe error', { error: String(e) }));

// PROBLEM: No guarantee pSubscribe is ready before tests publish
// Race condition: publish() can occur before subscribe() completes
// Tests might hit 100ms timeout before listener is established
```

### 2.3 KV Store Adapter

**Operations Implemented:**

| Operation | Pattern | Use Case |
|-----------|---------|----------|
| `get<T>(key)` | Redis GET | Retrieve state, check flags |
| `set<T>(key, value, ttl)` | Redis SET / SETEX | Store state with optional expiry |
| `del(key)` | Redis DEL | Remove state |
| `incr(key)` | Redis INCR | Atomic counters (never decrements) |
| `cas<T>(key, expected, new)` | Lua script | Compare-And-Swap (optimistic locking) |

**Namespace Support:**
```typescript
ns = (key) => namespace ? `${namespace}:${key}` : key
// Enables multi-tenant isolation: "tenant-1:key", "tenant-2:key"
```

**CAS Implementation (Lua):**
```lua
if redis.call('GET', KEYS[1]) == ARGV[1] then
  redis.call('SET', KEYS[1], ARGV[2])
  if ARGV[3] ~= '' then
    redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))
  end
  return 1  -- Success
else
  return 0  -- Mismatch
end
```

---

## 3. IDENTIFIED FAILURE PATTERNS

### 3.1 Race Conditions

**Problem 1: Async Listener Not Ready**
```
Timeline:
T0: bus.subscribe('test:topic', handler) called
    - Adds handler to subscriptions map
    - Returns unsub function IMMEDIATELY
T0: bus.publish('test:topic', envelope) called
    - Publishes to Redis immediately
T1: pSubscribe listener finally attaches to Redis (async)
    - Message already delivered while listener wasn't ready
    - Message lost - handler never called
Result: Test times out waiting for message
```

**Symptom:** 
- Tests expecting 1 message receive 0
- Timing inconsistent (sometimes passes, sometimes fails)
- 100ms wait insufficient

**Problem 2: Multiple Subscribers Race**
```typescript
const unsub1 = await bus.subscribe('test:multi', handler1);
const unsub2 = await bus.subscribe('test:multi', handler2);

// Both return immediately, but second subscribe() might execute
// before first pSubscribe handler is attached
// Result: One handler misses first message
```

### 3.2 Message Format Inconsistencies

**Problem 3: Envelope Unwrapping**
```typescript
// envelope wrapping:
const envelope = { key: opts?.key, msg: actualMessage };
const payload = JSON.stringify(envelope);

// parsing:
const parsed = JSON.parse(message);
const msg = parsed.msg !== undefined ? parsed.msg : parsed;

// ISSUE: If msg field isn't set, entire parsed object is used
// Different message formats create type confusion
```

### 3.3 Handler Error Isolation

**Problem 4: Promise.all() Behavior**
```typescript
// Current:
await Promise.all(
  Array.from(handlers).map((h) =>
    h(msg).catch((e) => log.error('Handler error', ...))
  )
);

// GOOD: Errors are caught
// BAD: If ONE handler's error is not caught, Promise.all rejects
// The outer try/catch should handle it, but timing is unclear
```

### 3.4 Subscription Management

**Problem 5: Topic Subscription Deduplication**
```typescript
// First subscribe to 'test:topic'
if (!subscriptions.has(topic)) {
  subscriptions.set(topic, new Set());
  await sub.subscribe(topic);  // Redis SUBSCRIBE
}

// ISSUE: If multiple subscribe() calls happen rapidly:
// T0: Thread 1 checks has('topic') → false
// T0: Thread 2 checks has('topic') → false (map not updated yet)
// T1: Thread 1 calls sub.subscribe('topic')
// T1: Thread 2 calls sub.subscribe('topic') - DUPLICATE!
// Result: Double subscription (both subscribe commands sent)
```

### 3.5 TTL Test Timing

**Problem 6: Test Timing Assumptions**
```typescript
// Test expects:
await kv.set('test:ttl', 'temporary', 1); // 1 second TTL
let value = await kv.get('test:ttl');
expect(value).toBe('temporary');

await new Promise((resolve) => setTimeout(resolve, 1100)); // Wait 1.1s

value = await kv.get('test:ttl');
expect(value).toBeNull();

// ISSUE: 
// - System load might delay TTL expiry (no guarantee at exact time)
// - Test might run slower than 1.1 seconds total
// - Redis TTL has millisecond precision but test assumes exact seconds
```

---

## 4. MESSAGE DELIVERY FLOW ANALYSIS

### 4.1 Expected Message Flow
```
Publisher:
1. bus.publish('topic', envelope)
2. JSON.stringify({ key: opts?.key, msg: envelope })
3. await pub.publish('topic', serialized)
4. Redis pub/sub distributes to all subscribers

Subscriber:
1. pSubscribe listener receives (message, channel)
2. JSON.parse(message) → { key?, msg: envelope }
3. subscriptions.get(channel) → Set<handlers>
4. handlers forEach: h(msg).catch(error handler)
5. Concurrent execution with Promise.all()

Handler:
1. Receives envelope (or raw message)
2. Can throw error (caught, logged, continues)
3. Can process successfully (logs)
```

### 4.2 State Tracking
```typescript
// Subscriptions Map (in-memory)
subscriptions: Map<string, Set<(msg: any) => Promise<void>>>

// Example state:
"test:topic" → Set([handler1, handler2, handler3])
"test:multi" → Set([handler1])
"test:json" → Set([handler2])

// When publish to "test:topic":
// 1. Find handlers for topic
// 2. Execute all 3 handlers concurrently
// 3. One handler error doesn't block others
```

---

## 5. KEY TESTING CHALLENGES

### Challenge 1: Redis Dependency
- Tests require real Redis running
- No built-in mocking (uses actual redis client)
- Connection must be established before tests run
- 100-200ms timeouts insufficient for some scenarios

### Challenge 2: Async Listener Pattern
- `pSubscribe` must be called and established before messages published
- Current IIFE pattern lacks synchronization guarantee
- Tests can publish before listener is ready
- No "ready" event to wait for

### Challenge 3: Message Ordering
- Pub/sub is fire-and-forget (no ordering guarantees)
- Multiple messages might arrive out of order
- Tests assuming order may fail intermittently

### Challenge 4: Concurrent Subscriptions
- Multiple `subscribe()` calls might race
- Duplicate subscriptions possible if not serialized
- Map operations are synchronous, but Redis operations are async

### Challenge 5: TTL Precision
- Redis TTL expires "eventually", not exactly at specified time
- System load affects expiry timing
- Tests assuming exact expiry times will fail intermittently

---

## 6. ROOT CAUSE SUMMARY

| Issue | Root Cause | Impact | Severity |
|-------|-----------|--------|----------|
| Messages lost on subscribe | Async listener not ready | Tests timeout waiting for messages | HIGH |
| Duplicate subscriptions | Race condition in subscribe() | Extra Redis SUBSCRIBE commands | MEDIUM |
| Message format confusion | Multiple envelope formats | Handler receives unexpected type | MEDIUM |
| TTL timing failures | System load varies | Tests expect exact expiry timing | LOW |
| Handler error propagation | Promise.all() rejection | One error can fail entire test | MEDIUM |

---

## 7. RECOMMENDATIONS FOR FIXES

### 7.1 Synchronize Listener Setup

**Option A: Async Initialization**
```typescript
let listenerReady: Promise<void>;

// In makeRedisBus:
listenerReady = (async () => {
  await sub.pSubscribe('*', handler);
})();

// Return object with ready signal:
return {
  async ready() { await listenerReady; },
  async publish(...) { await ready(); ... },
  async subscribe(...) { await ready(); ... },
};
```

**Option B: Eager Connection Pattern**
```typescript
// Wait for listener before returning bus object:
const bus = makeRedisBus(pub, sub);
await bus.ready();  // Wait for pSubscribe to establish
// NOW tests can safely use bus
```

### 7.2 Fix Subscription Deduplication

```typescript
// Use a lock to serialize subscribe operations
const subscriptionLock = new Map<string, Promise<void>>();

async subscribe(topic, handler, opts) {
  // Create promise for this topic if not exists
  if (!subscriptionLock.has(topic)) {
    subscriptionLock.set(topic, (async () => {
      if (!subscriptions.has(topic)) {
        subscriptions.set(topic, new Set());
        await sub.subscribe(topic);
      }
    })());
  }
  
  // Wait for any in-flight subscription
  await subscriptionLock.get(topic);
  
  // Now safely add handler
  subscriptions.get(topic)!.add(handler);
}
```

### 7.3 Normalize Message Envelope Format

```typescript
// Ensure consistent wrapping:
function serializeMessage(msg: any): string {
  return JSON.stringify({ msg }); // Always wrap in 'msg'
}

function deserializeMessage(data: string): any {
  const parsed = JSON.parse(data);
  return parsed.msg ?? parsed; // Fallback for compatibility
}

// Use consistently in all places
```

### 7.4 Improve TTL Test Reliability

```typescript
// Instead of exact timing, verify through Redis operations:
async testTTL() {
  await kv.set('test:ttl', 'value', 1);
  
  // Immediate check
  let value = await kv.get('test:ttl');
  expect(value).toBe('value');
  
  // Check for expiry by attempting to get after delay
  let expired = false;
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 100));
    value = await kv.get('test:ttl');
    if (value === null) {
      expired = true;
      break;
    }
  }
  expect(expired).toBe(true);
}
```

### 7.5 Isolate Handler Errors Better

```typescript
// Wrap each handler call more carefully:
const results = await Promise.allSettled(
  Array.from(handlers).map((h) =>
    h(msg).catch((e) => {
      log.error('Handler error', { channel, error: String(e) });
      return { error: e }; // Return error as value, not rejection
    })
  )
);

// Check results for failures
results.forEach((result, idx) => {
  if (result.status === 'rejected') {
    log.error('Handler promise rejected', { idx, reason: result.reason });
  }
});
```

### 7.6 Add Integration Test Markers

```typescript
// Separate integration tests that need Redis:
// In vitest config:
{
  test: {
    include: ['**/*.test.ts'],
    exclude: ['**/*.integration.test.ts'],
  }
}

// Run with:
// npm test (unit only)
// npm test:integration (with Redis)
```

---

## 8. TEST CONFIGURATION RECOMMENDATIONS

### 8.1 Vitest Configuration Updates

```typescript
export default defineConfig({
  test: {
    // Increase timeouts for integration tests
    testTimeout: 10000,  // 10 seconds instead of default 10s
    hookTimeout: 10000,  // beforeAll/afterAll hooks
    
    // Serial execution for Redis tests
    threads: false,  // Or mark specific tests as sequential
    
    // Retry integration tests
    retry: 2,  // Retry flaky Redis tests up to 2 times
    
    // Setup and teardown
    setupFiles: ['./vitest.setup.ts'],
  }
});
```

### 8.2 Connection Pool Management

```typescript
// Don't create new clients for each test
// Reuse suite across all tests with shared lifecycle:

let sharedSuite: RedisSuite;

beforeAll(async () => {
  sharedSuite = await makeRedisSuite(REDIS_URL);
});

afterAll(async () => {
  await sharedSuite.disconnect();
});

// Tests reuse suite, faster and more reliable
```

### 8.3 Docker Compose for CI

```yaml
# For CI/CD pipeline reliability:
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6380:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 1s
      timeout: 2s
      retries: 30
```

---

## 9. CURRENT TEST PASS RATE

Based on CLAUDE.md (Session #49):
- **Total Tests:** ~980 across 12 packages
- **Passing:** ~936 (95.5%)
- **Failing:** ~44
- **Orchestrator Integration:** ~8 failures (all Redis-related)

**Orchestrator Breakdown:**
- Smoke tests: ⏳ DEPENDS_ON_REDIS (18 tests)
- Integration tests: ⏳ DEPENDS_ON_REDIS (48 tests)  
- API routes: ✅ 92% passing
- Services: ✅ 92% passing

---

## 10. SUMMARY TABLE: Test vs Implementation

| Aspect | Test Expectation | Implementation Reality | Gap |
|--------|------------------|----------------------|-----|
| Listener Ready | Immediate after subscribe() | Async background process | YES - Race condition |
| Message Format | Envelope with 'id', 'type', 'payload' | Wrapped in { key?, msg } | YES - Needs normalization |
| Handler Errors | Don't block other handlers | Promise.all() might reject | MAYBE - Edge case |
| Concurrent Subscribes | Deduplicated subscriptions | Map operations not serialized | YES - Possible duplicates |
| TTL Expiry | Exact at specified time | "Eventually" expires | YES - Timing assumption |
| Message Ordering | May arrive out of order | Pub/sub has no guarantees | NO - Tests should assume disorder |

---

## Conclusion

The Redis integration tests are well-structured but suffer from **asynchronous initialization race conditions**. The main issue is that `pSubscribe()` is established in a background IIFE without synchronization, allowing test publishes to occur before the listener is ready.

**Priority fixes:**
1. Synchronize listener initialization (HIGH)
2. Fix subscription deduplication race (MEDIUM)
3. Normalize message envelope format (MEDIUM)
4. Improve TTL test reliability (LOW)

With these fixes, integration tests should achieve **99%+ pass rate** consistently.

