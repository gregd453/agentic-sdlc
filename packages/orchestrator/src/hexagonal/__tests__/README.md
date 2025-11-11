# Hexagonal Architecture Integration Tests

Comprehensive test suite for the hexagonal architecture framework, testing all components with real Redis.

## Test Structure

### Integration Tests (`integration.test.ts`)

Complete end-to-end tests covering:

#### 1. Message Bus (Pub/Sub)
- Publishing and receiving messages
- Multiple subscribers on same topic
- JSON serialization/deserialization
- Health checks with latency metrics

#### 2. KV Store
- GET/SET operations
- TTL (time-to-live) support
- DELETE operations
- Atomic INCREMENT for counters
- CAS (compare-and-swap) for optimistic locking
- Health checks

#### 3. Idempotency
- Exactly-once execution guarantees
- TTL-based cleanup
- Event deduplication
- Duplicate detection after expiry

#### 4. Retry Logic
- Success on first attempt
- Retry on transient failures
- Max attempt exhaustion
- Exponential backoff timing
- Delay cap enforcement

#### 5. Envelope Format
- Default envelope creation
- Correlation ID support
- Tenant ID support
- Retry envelope with attempt tracking
- Error message preservation

#### 6. End-to-End Flows
- Complete message cycle
- Idempotency with retries
- Combined features

#### 7. Error Handling
- JSON parse errors
- Handler exceptions
- Graceful error recovery

## Running Tests

### Prerequisites

Start Redis before running tests:

```bash
# Using Docker
docker run -d -p 6380:6379 redis:7-alpine

# Or using local Redis
redis-server --port 6380
```

### Run All Tests

```bash
cd /Users/Greg/Projects/apps/zyp/agent-sdlc

# Run all integration tests
pnpm --filter @agentic-sdlc/orchestrator test

# Run specific test file
pnpm --filter @agentic-sdlc/orchestrator test integration.test.ts

# Run with coverage
pnpm --filter @agentic-sdlc/orchestrator test --coverage

# Run in watch mode (development)
pnpm --filter @agentic-sdlc/orchestrator test --watch
```

### Custom Redis URL

```bash
REDIS_URL=redis://localhost:6380 pnpm --filter @agentic-sdlc/orchestrator test
```

## Test Coverage

| Component | Tests | Coverage |
|-----------|-------|----------|
| **Message Bus** | 4 | Pub/sub, serialization, health |
| **KV Store** | 6 | CRUD, TTL, CAS, health |
| **Idempotency** | 4 | Once, dedup, expiry |
| **Retry** | 5 | Success, retries, backoff, caps |
| **Envelopes** | 5 | Creation, correlation, retry |
| **E2E Flows** | 2 | Full cycle, combined features |
| **Error Handling** | 2 | Graceful degradation |
| **TOTAL** | **28 tests** | **All core features** |

## Test Patterns

### Setting Up

```typescript
let bus: IMessageBus;
let kv: IKVStore;

beforeAll(async () => {
  bus = await makeRedisBus({ redisUrl: REDIS_URL });
  kv = await makeRedisKV({ redisUrl: REDIS_URL });
});

afterAll(async () => {
  await bus.disconnect();
  await kv.disconnect();
});

beforeEach(async () => {
  // Clean up test data
  await kv.del('test:key');
});
```

### Testing Pub/Sub

```typescript
it('should publish and receive', async () => {
  const messages: any[] = [];

  // Subscribe
  const unsub = await bus.subscribe('topic', async (msg) => {
    messages.push(msg);
  });

  // Publish
  const envelope = createEnvelope('topic', { data: 'test' });
  await bus.publish('topic', envelope);

  // Wait and verify
  await new Promise((r) => setTimeout(r, 100));
  expect(messages).toHaveLength(1);

  await unsub();
});
```

### Testing Idempotency

```typescript
it('should execute once', async () => {
  let count = 0;

  for (let i = 0; i < 3; i++) {
    await once(kv, 'key', async () => {
      count++;
    });
  }

  expect(count).toBe(1);
});
```

### Testing Retry

```typescript
it('should retry with backoff', async () => {
  let attempts = 0;

  await retry(
    async () => {
      attempts++;
      if (attempts < 3) throw new Error('fail');
      return 'ok';
    },
    { maxAttempts: 5, baseDelayMs: 10 }
  );

  expect(attempts).toBe(3);
});
```

## Expected Results

When all tests pass:

```
✓ Message Bus (4 tests)
  ✓ should publish and receive a message
  ✓ should handle multiple subscribers
  ✓ should handle JSON serialization
  ✓ should check health

✓ KV Store (6 tests)
  ✓ should set and get values
  ✓ should respect TTL
  ✓ should delete values
  ✓ should increment counters
  ✓ should support CAS
  ✓ should check health

✓ Idempotency (4 tests)
  ✓ should execute function only once
  ✓ should respect TTL
  ✓ should deduplicate events
  ✓ should detect duplicates after expiry

✓ Retry Logic (5 tests)
  ✓ should succeed on first try
  ✓ should retry on transient failure
  ✓ should throw after max attempts
  ✓ should apply exponential backoff
  ✓ should cap max delay

✓ Envelope Format (5 tests)
  ✓ should create envelope with defaults
  ✓ should create with correlation ID
  ✓ should create with tenant ID
  ✓ should retry envelope
  ✓ should increment attempts

✓ End-to-End (2 tests)
  ✓ should complete full message cycle
  ✓ should handle idempotency and retry

✓ Error Handling (2 tests)
  ✓ should handle invalid JSON
  ✓ should continue after handler error

Test Files  1 passed (1)
     Tests  28 passed (28)
  Duration  4.5s
```

## Troubleshooting

### Redis Not Available

```
Error: Redis not available for testing. Start Redis first.
```

**Solution:** Start Redis on port 6380

```bash
docker run -d -p 6380:6379 redis:7-alpine
```

### Tests Timeout

If tests timeout (> 30s), check Redis performance:

```bash
redis-cli -p 6380 PING
```

Should respond with `PONG` immediately.

### Tests Flake (Intermittent Failures)

Common causes:
- **Timing issues**: Tests wait 100ms for async operations
- **Redis performance**: Slow Redis can cause timing failures
- **System load**: High CPU can delay async operations

Solutions:
- Run tests on quieter system
- Increase timeout in tests if needed
- Check Redis is not swapping

## Continuous Integration

These tests are designed to run in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Start Redis
  run: docker run -d -p 6380:6379 redis:7-alpine

- name: Run Integration Tests
  run: pnpm --filter @agentic-sdlc/orchestrator test
  env:
    REDIS_URL: redis://localhost:6380
```

## Next Steps After Tests Pass

Once all 28 tests pass, the framework is verified to:
- ✅ Work with real Redis
- ✅ Handle edge cases correctly
- ✅ Provide reliable pub/sub messaging
- ✅ Support idempotent execution
- ✅ Implement safe retry logic
- ✅ Guarantee exactly-once semantics

Proceed with:
1. Integrating hexagonal adapters into main pipeline
2. Creating additional coordinators (Code, Certify, Deploy)
3. Running end-to-end tests with all agents

---

**Last Updated:** 2025-11-11
**Test Count:** 28
**Coverage:** All core features
**Status:** Ready to execute
