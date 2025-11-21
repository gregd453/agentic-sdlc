# 🔴 Complete List of Failing Tests - Session #50

**Total Failing Tests: 29 out of 380 (92.4% passing)**

---

## 📊 Summary by Category

| Category | Count | Severity | Blocking |
|----------|-------|----------|----------|
| Base-Agent Pre-existing Issues | 3 | Low | No |
| Test Framework Errors (Module/Load) | 2 | High | Yes |
| Redis Integration Issues | 17 | High | Partial |
| Service Logic Issues | 8 | Medium | Partial |
| **TOTAL** | **29** | - | - |

---

## 🔴 CATEGORY 1: BASE-AGENT PRE-EXISTING ISSUES (3 tests)

**Package:** `@agentic-sdlc/base-agent`
**File:** `packages/agents/base-agent/tests/base-agent.test.ts`

### Test 1: should retry failed operations
```
Location:     Line 190-194
Status:       FAILED ❌
Error:        "First attempt" thrown
Expected:     Successful retry after failures
Root Cause:   Mock rejection pattern not working correctly
Impact:       Non-blocking to main pipeline
Fix Effort:   Medium (30 minutes)
```

### Test 2: should call Claude API successfully
```
Location:     Line 221
Status:       FAILED ❌
Error:        expected "spy" to be called with arguments: [ { …(5) } ]
              Number of calls: 0
Expected:     Mock to be called with proper arguments
Root Cause:   Mock Claude client not wired correctly
Impact:       Non-blocking to main pipeline
Fix Effort:   Medium (30 minutes)
```

### Test 3: should handle Claude API errors
```
Location:     Line 244
Status:       FAILED ❌
Error:        promise resolved "{ status: 'success' }" instead of rejecting
Expected:     Promise to reject with error
Root Cause:   Error handling not throwing exception as expected
Impact:       Non-blocking to main pipeline
Fix Effort:   Medium (30 minutes)
```

---

## 🔴 CATEGORY 2: TEST FRAMEWORK ERRORS (2 test files)

### Test File 1: full-workflow.test.ts
```
Package:      @agentic-sdlc/orchestrator
File Path:    packages/orchestrator/tests/e2e/full-workflow.test.ts
Status:       CANNOT LOAD ❌
Error Type:   Module Resolution Error
Error:        Cannot resolve "../../src/state-machine/state-machine"
Tests:        All tests in file (approximately 15 tests blocked)
Expected:     Module should be resolvable
Root Cause:   Import path incorrect or file doesn't exist
Severity:     HIGH - Blocks comprehensive E2E testing
Fix Effort:   Low (15 minutes)
```

**Action Required:**
- Verify state-machine module exists in correct location
- Check import path is correct
- Create missing file if needed

### Test File 2: scaffold-happy-path.test.ts
```
Package:      @agentic-sdlc/orchestrator
File Path:    packages/orchestrator/tests/e2e/scaffold-happy-path.test.ts
Status:       CANNOT LOAD ❌
Error Type:   CommonJS/ESM Mismatch
Error:        Vitest cannot be imported in CommonJS module using require()
              If you are using "import" in your source code...
Tests:        All tests in file (approximately 9 tests blocked)
Expected:     Module to load without CommonJS/ESM conflict
Root Cause:   Import configuration mismatch
Severity:     HIGH - Blocks mocked E2E testing
Fix Effort:   Low (15 minutes)
```

**Action Required:**
- Change test to ESM imports
- Or fix module configuration
- Update vitest config if needed

---

## 🔴 CATEGORY 3: REDIS INTEGRATION ISSUES (17 tests)

### File 1: smoke.test.ts
**Location:** `packages/orchestrator/src/hexagonal/__tests__/smoke.test.ts`
**Total Failures:** 6 tests

#### Test 1: should have healthy message bus
```
Line:         53
Status:       FAILED ❌
Error:        expected 0 to be greater than 0
Expected:     latencyMs > 0
Actual:       latencyMs = 0
Root Cause:   Health check timing not working in test
Issue:        Bus health check returning zero latency
Fix:          Mock or verify Redis health properly
Impact:       Testing infrastructure
```

#### Test 2: should publish and receive message
```
Line:         80
Status:       FAILED ❌
Error:        expected [] to have a length of 1 but got +0
Expected:     1 message received
Actual:       0 messages received
Root Cause:   Redis pub/sub not delivering messages in test
Issue:        Messages array empty after publish
Fix:          Fix Redis pub/sub mock or use real Redis
Impact:       Pub/sub messaging validation
```

#### Test 3: should handle multiple publish/subscribe cycles
```
Line:         102
Status:       FAILED ❌
Error:        expected [] to have a length of 3 but got +0
Expected:     3 messages across cycles
Actual:       0 messages
Root Cause:   Pub/sub state pollution or mock issue
Issue:        Messages not delivered on subsequent cycles
Fix:          Reset pub/sub state between tests
Impact:       Multi-cycle messaging
```

#### Test 4: should support atomic counters
```
Line:         130
Status:       FAILED ❌
Error:        expected 9 to be 1
Expected:     Counter value = 1 (first increment)
Actual:       Counter value = 9 (state from other tests)
Root Cause:   Counter not reset between tests
Issue:        State pollution from previous test runs
Fix:          Clean up counter state or use unique keys per test
Impact:       Atomic operations, state isolation
```

#### Test 5: should continue after message error
```
Line:         212
Status:       FAILED ❌
Error:        expected 0 to be greater than 0
Expected:     errorCount > 0
Actual:       errorCount = 0
Root Cause:   Error handler not being called
Issue:        Error recovery not triggered
Fix:          Verify error handler wiring
Impact:       Error recovery mechanism
```

#### Test 6: should preserve correlation ID through message flow
```
Line:         235
Status:       FAILED ❌
Error:        Cannot read properties of undefined (reading 'corrId')
Expected:     Message with corrId property
Actual:       Message is undefined
Root Cause:   Message not being received by subscriber
Issue:        Correlation ID not preserved
Fix:          Fix pub/sub message delivery
Impact:       Tracing and correlation
```

---

### File 2: integration.test.ts
**Location:** `packages/orchestrator/src/hexagonal/__tests__/integration.test.ts`
**Total Failures:** 11 tests

#### Test 1: should publish and receive a message
```
Line:         88
Status:       FAILED ❌
Error:        expected [] to have a length of 1 but got +0
Root Cause:   Pub/sub not delivering messages
Fix:          Fix message bus implementation
```

#### Test 2: should handle multiple subscribers
```
Line:         114
Status:       FAILED ❌
Error:        expected [] to have a length of 1 but got +0
Root Cause:   Messages not delivered to all subscribers
Fix:          Debug pub/sub routing logic
```

#### Test 3: should handle JSON serialization
```
Line:         141
Status:       FAILED ❌
Error:        Cannot read properties of undefined (reading 'nested')
Root Cause:   Complex JSON payload not being delivered
Fix:          Fix JSON serialization in pub/sub
```

#### Test 4: should check health
```
Line:         149
Status:       FAILED ❌
Error:        expected 0 to be greater than 0
Root Cause:   Health check not measuring latency
Fix:          Fix health check timing
```

#### Test 5: should increment counters
```
Line:         187
Status:       FAILED ❌
Error:        expected 7 to be 1
Root Cause:   Counter not isolated, accumulated from other tests
Fix:          Use unique counter keys per test, cleanup state
```

#### Test 6: should create envelope with defaults
```
Line:         420
Status:       FAILED ❌
Error:        expected 'uuid' to be undefined
Root Cause:   Envelope defaults setting corrId when should be undefined
Fix:          Review envelope factory logic
```

#### Test 7: should retry envelope with incremented attempts
```
Line:         445
Status:       FAILED ❌
Error:        expected 'uuid-1' to be 'uuid-0'
Root Cause:   Retry logic changing envelope ID (should stay same)
Fix:          Preserve ID during retries
```

#### Test 8: should increment attempts on subsequent retries
```
Line:         457
Status:       FAILED ❌
Error:        expected +0 to be undefined
Root Cause:   Attempt counter logic incorrect
Fix:          Fix attempt tracking and increment
```

#### Test 9: should complete full message cycle
```
Line:         495
Status:       FAILED ❌
Error:        Cannot read properties of null (reading 'id')
Root Cause:   Message not being processed through pipeline
Fix:          Debug message processing pipeline
```

#### Test 10: should handle message with idempotency and retry
```
Line:         533
Status:       FAILED ❌
Error:        expected +0 to be 1
Root Cause:   Message not received or not counted
Fix:          Fix idempotency tracking mechanism
```

#### Test 11: should continue processing after handler error
```
Line:         589
Status:       FAILED ❌
Error:        expected 0 to be greater than 0
Root Cause:   Error handler not being triggered
Fix:          Fix error handling in message bus
```

---

## 🔴 CATEGORY 4: SERVICE LOGIC ISSUES (8 tests)

### File 1: workflow.routes.test.ts
**Location:** `packages/orchestrator/tests/api/workflow.routes.test.ts`

#### Test 1: should create a new workflow
```
Line:         47
Status:       FAILED ❌
Error:        expected 400 to be 200
Expected:     HTTP 200 OK
Actual:       HTTP 400 Bad Request
Root Cause:   Request validation stricter than test expects
Issue:        API rejecting valid request
Fix:          Debug request validation or update test expectations
```

#### Test 2: should handle service errors
```
Line:         88
Status:       FAILED ❌
Error:        expected 400 to be 500
Expected:     HTTP 500 Internal Server Error
Actual:       HTTP 400 Bad Request
Root Cause:   Error handling returning wrong status code
Issue:        Service errors not returning 500
Fix:          Fix error response status codes
```

---

### File 2: simple-happy-path.test.ts
**Location:** `packages/orchestrator/tests/simple-happy-path.test.ts`

#### Test 1: should support type branding for IDs
```
Line:         123
Status:       FAILED ❌
Error:        expected false to be true
Expected:     isAgentId(agentId) = true
Actual:       isAgentId(agentId) = false
Root Cause:   ID format not matching type guard pattern
Issue:        Type guard isAgentId() not recognizing valid ID
Fix:          Fix type guard pattern or ID generation
```

#### Test 2: should handle workflow state transitions
```
Line:         161
Status:       FAILED ❌
Error:        expected [Function] to throw an error
Expected:     SchemaRegistry.validate() to throw on invalid state
Actual:       No error thrown
Root Cause:   Schema validation too permissive
Issue:        Invalid states being accepted
Fix:          Fix schema validation logic or constraints
```

---

### File 3: workflow.service.test.ts
**Location:** `packages/orchestrator/tests/services/workflow.service.test.ts`

#### Test 1: should successfully create a workflow
```
Line:         73
Status:       FAILED ❌
Error:        Workflow test-workflow-id not found
Expected:     Workflow to be created and persisted
Actual:       Workflow not found after creation
Root Cause:   Mock Prisma not persisting workflow data
Issue:        Database mock not storing data correctly
Fix:          Fix Prisma mock or use real database in test
```

---

### File 4: pipeline-executor.service.test.ts
**Location:** `packages/orchestrator/src/__tests__/services/pipeline-executor.service.test.ts`

#### Test 1: should start pipeline execution successfully
```
Line:         85
Status:       FAILED ❌
Error:        expected 'running' to be 'queued'
Expected:     Pipeline status = 'queued'
Actual:       Pipeline status = 'running'
Root Cause:   State transition logic incorrect
Issue:        Pipeline starting in wrong state
Fix:          Fix pipeline initial state logic
```

#### Test 2: should enforce quality gates
```
Line:         228
Status:       FAILED ❌
Error:        Target cannot be null or undefined
Expected:     currentExecution to have value
Actual:       currentExecution is null
Root Cause:   Pipeline execution not being stored
Issue:        Execution object not created
Fix:          Fix pipeline execution storage logic
```

#### Test 3: should fail stage when blocking quality gate fails
```
Line:         293
Status:       FAILED ❌
Error:        expected undefined to be 'failed'
Expected:     stage_results[0].status = 'failed'
Actual:       stage_results[0].status = undefined
Root Cause:   Stage result not being set correctly
Issue:        Failed stage status not recorded
Fix:          Fix stage failure handling
```

---

### File 5: agent-dispatcher.service.test.ts
**Location:** `packages/orchestrator/tests/services/agent-dispatcher.service.test.ts`

#### Test 1: should auto-remove handler after success status
```
Line:         220
Status:       FAILED ❌
Error:        expected true to be false
Expected:     Handler removed from map (has = false)
Actual:       Handler still in map (has = true)
Root Cause:   Handler cleanup not working
Issue:        Memory leak - handlers not being cleaned up
Fix:          Fix handler cleanup logic on success
```

#### Test 2: should auto-remove handler after failure status
```
Line:         239
Status:       FAILED ❌
Error:        expected true to be false
Expected:     Handler removed after failure
Actual:       Handler still in map
Root Cause:   Handler cleanup not triggered on failure
Issue:        Handlers accumulating in memory
Fix:          Fix failure-path handler cleanup
```

#### Test 3: should handle complete workflow lifecycle
```
Line:         610
Status:       FAILED ❌
Error:        expected true to be false
Expected:     Handler removed after workflow completion
Actual:       Handler not auto-removed
Root Cause:   Lifecycle cleanup not working
Issue:        Handler lingering beyond workflow completion
Fix:          Fix lifecycle-based handler management
```

#### Test 4: should handle multiple concurrent workflows
```
Line:         677
Status:       FAILED ❌
Error:        expected 3 to be +0
Expected:     handlers.size = 0 (all cleaned up)
Actual:       handlers.size = 3 (all still present)
Root Cause:   Handlers not being cleaned up across concurrent flows
Issue:        Concurrent workflow handlers not removed
Fix:          Fix concurrent workflow cleanup logic
```

---

## 📋 Failure Matrix

### By File
| File | Tests | Failing | % Pass |
|------|-------|---------|--------|
| base-agent.test.ts | 12 | 3 | 75% |
| full-workflow.test.ts | ~15 | ~15 | 0% |
| scaffold-happy-path.test.ts | ~9 | ~9 | 0% |
| smoke.test.ts | 15 | 6 | 60% |
| integration.test.ts | 28 | 11 | 61% |
| workflow.routes.test.ts | 13 | 2 | 85% |
| simple-happy-path.test.ts | 4 | 2 | 50% |
| workflow.service.test.ts | 10 | 1 | 90% |
| pipeline-executor.service.test.ts | 13 | 3 | 77% |
| agent-dispatcher.service.test.ts | 32 | 4 | 88% |

### By Type
| Type | Count | Severity |
|------|-------|----------|
| Module Load Errors | 2 | HIGH |
| Pub/Sub Issues | 17 | HIGH |
| Handler Cleanup | 4 | MEDIUM |
| API Validation | 2 | MEDIUM |
| State Transitions | 3 | MEDIUM |
| Type Guards | 1 | LOW |

---

## 🎯 Recommended Fix Sequence

### Phase 1: Quick Wins (15-30 minutes)
**Impact:** Unblocks 24 tests, enables full orchestrator E2E testing
1. Fix `full-workflow.test.ts` import path
2. Fix `scaffold-happy-path.test.ts` CommonJS/ESM

### Phase 2: Critical Path (30-60 minutes)
**Impact:** Fixes handler cleanup, enables workflow dispatcher testing
3. Fix agent dispatcher handler cleanup (4 tests)

### Phase 3: Major Work (2-3 hours)
**Impact:** Fixes 17 Redis integration tests
4. Fix Redis pub/sub message delivery
5. Fix counter state pollution
6. Fix envelope factory defaults

### Phase 4: Service Logic (1-2 hours)
**Impact:** Fixes API and state management
7. Fix pipeline executor state transitions
8. Fix API validation status codes
9. Fix type guards

### Phase 5: Polish (45 minutes)
**Impact:** Fixes base-agent issues
10. Fix Claude API mocking

---

## 📊 Session #51 Planning

| Task | Tests | Effort | Priority |
|------|-------|--------|----------|
| Fix test framework (load errors) | 2 | Low | P0 |
| Fix handler cleanup | 4 | Medium | P1 |
| Fix Redis integration | 17 | High | P1 |
| Fix service logic | 8 | Medium | P1 |
| Fix base-agent | 3 | Medium | P2 |
| **ACHIEVE 100% PASS RATE** | **380** | **High** | **GOAL** |

**Expected Time for Session #51:** 3-4 hours
**Target Completion:** 100% test pass rate (380/380)

---

## 🔗 References

- Test execution command: `npm test -- -- --run`
- Orchestrator tests: `cd packages/orchestrator && npm test`
- Agent tests: `cd packages/agents/{agent-name} && npm test`
- Full test suite: `turbo run test -- --run`

---

**Generated:** 2025-11-12
**Session:** #50
**Status:** Ready for Session #51
