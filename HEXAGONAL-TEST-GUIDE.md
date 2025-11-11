# Hexagonal Architecture - Test Execution Guide

**Status:** Integration test suite created and ready to execute
**Framework:** Vitest
**Total Tests:** 46 (28 integration + 18 smoke tests)
**Estimated Time:** 5-10 seconds

---

## Prerequisites

### 1. Start Redis

```bash
# Option A: Docker (recommended)
docker run -d -p 6380:6379 redis:7-alpine

# Option B: Local Redis
redis-server --port 6380

# Verify connection
redis-cli -p 6380 PING
# Should respond: PONG
```

### 2. Install Dependencies

```bash
cd /Users/Greg/Projects/apps/zyp/agent-sdlc
pnpm install
```

---

## Running Tests

### Option 1: Quick Smoke Test (Fastest)

```bash
# Run just the smoke tests (~2 seconds)
pnpm --filter @agentic-sdlc/orchestrator test smoke.test.ts
```

**What it tests:**
- Container initialization
- Pub/Sub messaging (publish/receive)
- KV store operations
- Envelope creation
- Error recovery
- Correlation tracking
- Resource cleanup

**Expected result:** All 18 tests should pass ✅

### Option 2: Full Integration Tests (Complete)

```bash
# Run comprehensive integration tests (~8 seconds)
pnpm --filter @agentic-sdlc/orchestrator test integration.test.ts
```

**What it tests:**
- Message bus pub/sub (4 tests)
- KV store operations (6 tests)
- Idempotency guarantees (4 tests)
- Retry with backoff (5 tests)
- Envelope format (5 tests)
- End-to-end flows (2 tests)
- Error handling (2 tests)

**Expected result:** All 28 tests should pass ✅

### Option 3: Run All Hexagonal Tests

```bash
# Run both test suites
pnpm --filter @agentic-sdlc/orchestrator test
```

**Expected result:** All 46 tests should pass ✅

### Option 4: Watch Mode (Development)

```bash
# Run tests in watch mode - re-runs on file changes
pnpm --filter @agentic-sdlc/orchestrator test --watch
```

Useful while developing new features or fixing issues.

### Option 5: With Coverage

```bash
# Run tests and generate coverage report
pnpm --filter @agentic-sdlc/orchestrator test --coverage
```

Generates coverage metrics for code analysis.

---

## Expected Test Output

### Smoke Tests Success

```
 ✓ packages/orchestrator/src/hexagonal/__tests__/smoke.test.ts (18)
   ✓ Bootstrap & Container (3)
     ✓ should initialize container successfully
     ✓ should have healthy message bus
     ✓ should have healthy KV store
   ✓ Pub/Sub Messaging (2)
     ✓ should publish and receive message
     ✓ should handle multiple publish/subscribe cycles
   ✓ KV Store Operations (3)
     ✓ should read and write values
     ✓ should support atomic counters
     ✓ should support TTL
   ✓ Envelope Format (2)
     ✓ should create valid envelope
     ✓ should support complex payloads
   ✓ Error Recovery (2)
     ✓ should handle missing keys gracefully
     ✓ should continue after message error
   ✓ Correlation & Tracing (2)
     ✓ should preserve correlation ID
     ✓ should track tenant IDs
   ✓ Resource Cleanup (1)
     ✓ should allow graceful shutdown

Test Files  1 passed (1)
     Tests  18 passed (18)
  Duration  1.8s
```

### Integration Tests Success

```
 ✓ packages/orchestrator/src/hexagonal/__tests__/integration.test.ts (28)
   ✓ Message Bus (4)
     ✓ should publish and receive a message
     ✓ should handle multiple subscribers
     ✓ should handle JSON serialization
     ✓ should check health
   ✓ KV Store (6)
     ✓ should set and get values
     ✓ should respect TTL
     ✓ should delete values
     ✓ should increment counters
     ✓ should support CAS (compare-and-swap)
     ✓ should check health
   ✓ Idempotency (4)
     ✓ should execute function only once
     ✓ should respect TTL for idempotency
     ✓ should deduplicate events
     ✓ should detect duplicates after expiry
   ✓ Retry Logic (5)
     ✓ should succeed on first try
     ✓ should retry on transient failure
     ✓ should throw after max attempts
     ✓ should apply exponential backoff
     ✓ should cap max delay
   ✓ Envelope Format (5)
     ✓ should create envelope with defaults
     ✓ should create with correlation ID
     ✓ should create with tenant ID
     ✓ should retry envelope
     ✓ should increment attempts
   ✓ End-to-End Message Flow (2)
     ✓ should complete full message cycle
     ✓ should handle message with idempotency and retry
   ✓ Error Handling (2)
     ✓ should handle invalid JSON
     ✓ should continue after handler error

Test Files  1 passed (1)
     Tests  28 passed (28)
  Duration  6.2s
```

### All Tests Success

```
 ✓ packages/orchestrator/src/hexagonal/__tests__/smoke.test.ts (18)
 ✓ packages/orchestrator/src/hexagonal/__tests__/integration.test.ts (28)

Test Files  2 passed (2)
     Tests  46 passed (46)
  Duration  8.1s
```

---

## Troubleshooting

### Issue: "Redis not available for testing"

**Error message:**
```
Error: Redis not available for testing. Start Redis first.
```

**Solution:**
```bash
# Start Redis
docker run -d -p 6380:6379 redis:7-alpine

# Verify connection
redis-cli -p 6380 PING
```

### Issue: "ECONNREFUSED"

**Error message:**
```
Error: connect ECONNREFUSED 127.0.0.1:6380
```

**Cause:** Redis is not running or not accessible on port 6380

**Solution:**
```bash
# Check if Redis is running
docker ps | grep redis

# If not, start it
docker run -d -p 6380:6379 redis:7-alpine

# If port 6380 is in use, use different port
docker run -d -p 6381:6379 redis:7-alpine
REDIS_URL=redis://localhost:6381 pnpm test
```

### Issue: Tests timeout (> 30 seconds)

**Cause:** Redis is slow or system is under load

**Solutions:**
1. Check Redis health:
   ```bash
   redis-cli -p 6380 INFO stats
   ```

2. Run on quieter system (close other applications)

3. Increase timeout if needed:
   ```bash
   pnpm test --reporter=verbose --timeout=60000
   ```

### Issue: "TIMEOUT: Exceeded timeout of 5000ms"

**Cause:** Async operations taking too long

**Solutions:**
1. Check system load: `top` or `Activity Monitor`
2. Check Redis latency: `redis-cli -p 6380 LATENCY LATEST`
3. Restart Redis to clear any stuck connections

---

## Continuous Integration

### GitHub Actions Example

```yaml
name: Hexagonal Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      redis:
        image: redis:7-alpine
        ports:
          - 6380:6379
        options: >-
          --health-cmd "redis-cli PING"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - uses: pnpm/action-setup@v2

      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'

      - run: pnpm install

      - name: Run Smoke Tests
        run: pnpm --filter @agentic-sdlc/orchestrator test smoke.test.ts
        env:
          REDIS_URL: redis://localhost:6380

      - name: Run Integration Tests
        run: pnpm --filter @agentic-sdlc/orchestrator test integration.test.ts
        env:
          REDIS_URL: redis://localhost:6380
```

---

## Test Success Criteria

All tests pass when:

✅ **Message Bus Works**
- Publish/subscribe functioning
- Multiple subscribers supported
- JSON serialization working

✅ **KV Store Works**
- GET/SET operations functional
- TTL cleanup working
- Atomic operations (INCR, CAS) safe

✅ **Idempotency Works**
- Exactly-once execution guaranteed
- Deduplication preventing duplicates
- TTL-based cleanup functional

✅ **Retry Works**
- Exponential backoff applied
- Max attempts enforced
- Jitter preventing thundering herd

✅ **Envelopes Work**
- Correlation IDs tracked
- Retry counters incremented
- Tenant IDs preserved

✅ **Error Recovery Works**
- Graceful handling of failures
- Continued processing after errors
- Resource cleanup successful

---

## Next Steps After Tests Pass

Once all 46 tests pass ✅:

### 1. Verify Framework Reliability
- Framework is production-ready with real Redis
- All critical features working correctly
- Edge cases handled gracefully

### 2. Create Missing Coordinators
- CodeCoordinator (for code generation)
- CertifyCoordinator (for validation)
- DeployCoordinator (for deployment)

### 3. Integrate into Pipeline
- Update orchestrator main to use hexagonal bootstrap
- Migrate agent dispatcher to use hexagonal bus
- Update agent registration to use hexagonal ports

### 4. Run E2E Tests
- Test complete workflow with new architecture
- Verify stage progression working
- Validate envelope format end-to-end

---

## Performance Benchmarks

Expected performance with real Redis:

| Operation | Latency | Notes |
|-----------|---------|-------|
| Pub/Sub Publish | 1-5ms | Fire-and-forget |
| KV GET | 1-2ms | Simple read |
| KV SET | 1-3ms | With JSON serialization |
| CAS Operation | 2-5ms | Lua script execution |
| Health Check | 2-4ms | PING + KV round-trip |
| Retry Backoff | Exponential | 100ms → 30s |

Total test suite time: 8-10 seconds (all 46 tests)

---

## Success Checklist

Run through this before proceeding to integration:

- [ ] Redis is running and accessible on port 6380
- [ ] `pnpm install` completes without errors
- [ ] Smoke tests pass (18/18) ✅
- [ ] Integration tests pass (28/28) ✅
- [ ] All tests pass together (46/46) ✅
- [ ] No timeout errors
- [ ] No Redis connectivity errors
- [ ] All health checks passing

Once all items checked: **Framework verified and production-ready** ✅

---

**Ready to execute tests. Start with:** `pnpm --filter @agentic-sdlc/orchestrator test smoke.test.ts`
