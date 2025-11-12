# Session #51 - Complete Test Fix Plan
**Goal:** Achieve 380/380 tests passing (100% pass rate)
**Target Date:** Next session
**Estimated Duration:** 4-6 hours

---

## 📊 Current State
- **Total Tests:** 380
- **Passing:** 351 (92.4%)
- **Failing:** 29 (7.6%)
- **Build Status:** ✅ PASSING (Zero TypeScript errors)

---

## 🎯 Session #51 Objectives

| Objective | Target | Effort | Priority |
|-----------|--------|--------|----------|
| Fix test framework errors | 2/2 | Low | P0 |
| Fix handler cleanup issues | 4/4 | Medium | P1 |
| Fix Redis integration tests | 17/17 | High | P1 |
| Fix service logic tests | 8/8 | Medium | P1 |
| Fix base-agent mocks | 3/3 | Medium | P2 |
| **Achieve 100% pass rate** | **380/380** | **High** | **GOAL** |

---

## 📋 Detailed Fix Plan

### Phase 1: Test Framework Errors (P0 - 15-30 minutes)
**Impact:** Unblocks ~24 tests

#### Fix 1.1: full-workflow.test.ts Module Resolution
**File:** `packages/orchestrator/tests/e2e/full-workflow.test.ts`

**Problem:**
```
Error: Cannot resolve "../../src/state-machine/state-machine"
Status: Test file cannot load
Blocked Tests: ~15 tests
```

**Investigation Steps:**
1. Check if `src/state-machine/state-machine.ts` exists
2. Verify import path is correct
3. Check for typos in file path or directory structure

**Solution Options:**
```typescript
// Option A: Fix import path (if file exists elsewhere)
import { StateMachine } from '../../src/state-machine';

// Option B: Create missing file if needed
// packages/orchestrator/src/state-machine/state-machine.ts

// Option C: Remove unused import if not needed
```

**Implementation Steps:**
1. Locate state-machine module in codebase
2. Update import path to correct location
3. OR create missing file with stub implementation
4. Verify test file loads successfully
5. Run tests to confirm all tests in file execute

**Verification:**
```bash
cd packages/orchestrator
npm test -- tests/e2e/full-workflow.test.ts
# Should show ~15 tests running instead of module error
```

---

#### Fix 1.2: scaffold-happy-path.test.ts CommonJS/ESM Issue
**File:** `packages/orchestrator/tests/e2e/scaffold-happy-path.test.ts`

**Problem:**
```
Error: Vitest cannot be imported in CommonJS module using require()
Status: Test file cannot load
Blocked Tests: ~9 tests
```

**Investigation Steps:**
1. Check test file for CommonJS requires
2. Verify vitest.config.ts module settings
3. Look for incompatible import patterns

**Solution Options:**
```typescript
// Option A: Change to ESM imports
import { describe, it, expect } from 'vitest';
// Instead of: const { describe, it, expect } = require('vitest');

// Option B: Fix vitest config
// vitest.config.ts - ensure proper ESM/CJS handling

// Option C: Update module config in package.json
// "type": "module" or similar
```

**Implementation Steps:**
1. Open test file and identify CommonJS patterns
2. Convert all `require()` calls to `import` statements
3. Verify mock imports are using ESM syntax
4. Update package.json type if needed
5. Check vitest.config.ts for module compatibility

**Verification:**
```bash
cd packages/orchestrator
npm test -- tests/e2e/scaffold-happy-path.test.ts
# Should show ~9 tests running instead of module error
```

**Estimated Time:** 15-30 minutes
**Expected Result:** All tests in both files can execute

---

### Phase 2: Handler Cleanup Issues (P1 - 30-60 minutes)
**Impact:** Fixes 4 critical tests, enables workflow dispatcher

#### Fix 2.1: Agent Dispatcher Handler Cleanup
**File:** `packages/orchestrator/src/services/agent-dispatcher.service.ts`
**Test File:** `packages/orchestrator/tests/services/agent-dispatcher.service.test.ts`

**Failing Tests:**
```
Line 220: should auto-remove handler after success status
Line 239: should auto-remove handler after failure status
Line 610: should handle complete workflow lifecycle
Line 677: should handle multiple concurrent workflows
```

**Problem Analysis:**
```
Expected: Handlers removed from resultHandlers map after completion
Actual: Handlers still in map after success/failure
Root Cause: Cleanup logic not being called or not working
```

**Investigation Steps:**
1. Review `handleAgentResult()` method in agent-dispatcher.service.ts
2. Check for handler cleanup logic
3. Verify cleanup is called on success AND failure
4. Check for race conditions in async cleanup

**Solution Plan:**
```typescript
// Current issue: Handler not being removed
// Fix: Ensure cleanup happens in both success and failure paths

private async handleAgentResult(message: string) {
  try {
    // ... existing code ...

    // After handling result:
    const handlers = (this as any).resultHandlers;

    // SUCCESS PATH
    if (status === 'success' || status === 'failure') {
      // Must remove handler here
      handlers.delete(workflowId);  // ← Add this
    }

  } catch (error) {
    // FAILURE PATH
    // Must also remove handler on error
    handlers.delete(workflowId);  // ← Add this
  }
}
```

**Implementation Steps:**
1. Locate `resultHandlers` map management in agent-dispatcher.service.ts
2. Identify where handlers are created (subscribe)
3. Find where handlers should be cleaned up (result handling)
4. Add cleanup logic for:
   - Success status results
   - Failure status results
   - Error cases
   - Timeout scenarios
5. Verify cleanup works for concurrent workflows

**Testing Strategy:**
```bash
cd packages/orchestrator
npm test -- tests/services/agent-dispatcher.service.test.ts
# Run specific tests:
npm test -- --grep "should auto-remove handler"
npm test -- --grep "concurrent workflows"
```

**Verification Criteria:**
- ✅ handlers.has(workflowId) === false after success
- ✅ handlers.has(workflowId) === false after failure
- ✅ handlers.size === 0 after concurrent workflows complete
- ✅ No memory leaks from accumulated handlers

**Estimated Time:** 30-60 minutes
**Expected Result:** 4 tests passing

---

### Phase 3: Redis Integration Issues (P1 - 2-3 hours)
**Impact:** Fixes 17 tests, enables pub/sub messaging

#### Fix 3.1: Pub/Sub Message Delivery
**Files:**
- `packages/orchestrator/src/hexagonal/__tests__/smoke.test.ts` (6 failures)
- `packages/orchestrator/src/hexagonal/__tests__/integration.test.ts` (11 failures)

**Failing Tests (Sample):**
```
Line 80:  should publish and receive message
Line 88:  should publish and receive a message
Line 114: should handle multiple subscribers
```

**Problem Analysis:**
```
Expected: Messages delivered to subscribers
Actual: Received messages array empty (0 messages)
Root Cause: Pub/sub mock not implementing message delivery
```

**Investigation Steps:**
1. Check Redis/pub-sub implementation in `hexagonal/adapters/redis-bus.adapter.ts`
2. Review test setup for pub/sub mock
3. Verify message delivery flow
4. Check for timing issues (async operations)

**Solution Plan:**
```typescript
// Current issue: Messages not being delivered
// Fix: Ensure pub/sub mock properly delivers messages

// In test:
await messageBus.subscribe('test-channel', (message) => {
  messages.push(message);  // This callback should be called
});

// Then publish:
await messageBus.publish('test-channel', testMessage);

// Wait for delivery:
await new Promise(resolve => setTimeout(resolve, 100));

// Messages should now contain the published message
expect(messages).toHaveLength(1);
```

**Implementation Steps:**
1. Review message bus subscribe implementation
2. Ensure callbacks are registered correctly
3. Check publish method calls registered callbacks
4. Verify async timing (messages may be async)
5. Test with real Redis if mock is incomplete

**File-by-file fixes:**

**smoke.test.ts fixes:**
1. Fix message bus health check (latencyMs > 0)
2. Fix pub/sub message delivery
3. Fix atomic counter state isolation
4. Fix error handler invocation
5. Fix correlation ID preservation

**integration.test.ts fixes:**
1. Fix envelope factory defaults
2. Fix envelope ID preservation on retry
3. Fix attempt counter tracking
4. Fix idempotency tracking
5. Fix message processing pipeline
6. Fix error handler triggering

**Key Implementation Areas:**
```typescript
// 1. Message delivery in pub/sub
export class RedisBusAdapter {
  async subscribe(pattern: string, handler: (msg) => void) {
    // Must store handler and call it on message
    this.handlers.set(pattern, handler);
  }

  async publish(channel: string, message: any) {
    // Must call all matching handlers
    const handler = this.handlers.get(channel);
    if (handler) {
      await handler(message);  // ← Ensure this happens
    }
  }
}

// 2. State isolation in tests
beforeEach(() => {
  // Clear all state before each test
  redis.flushdb();  // Clear database
  handlers.clear(); // Clear handlers
  counters.clear(); // Clear counters
});

// 3. Envelope factory
function createEnvelope(data, options = {}) {
  return {
    id: uuidv4(),  // Always generate new ID
    ts: Date.now(),
    payload: data,
    corrId: options.corrId,  // Only set if provided
    attempts: options.attempts  // Only set if provided
  };
}
```

**Testing Strategy:**
```bash
cd packages/orchestrator
npm test -- src/hexagonal/__tests__/smoke.test.ts
npm test -- src/hexagonal/__tests__/integration.test.ts
```

**Verification Criteria:**
- ✅ Messages delivered to subscribers
- ✅ State isolated between tests
- ✅ Envelope ID preserved on retry
- ✅ Attempt counter incremented correctly
- ✅ Idempotency working (duplicates not reprocessed)
- ✅ Error handlers called on errors

**Estimated Time:** 2-3 hours
**Expected Result:** 17 tests passing

---

### Phase 4: Service Logic Issues (P1 - 1-2 hours)
**Impact:** Fixes 8 tests, enables workflow management

#### Fix 4.1: Pipeline Executor State Transitions
**File:** `packages/orchestrator/src/services/pipeline-executor.service.ts`
**Test File:** `packages/orchestrator/src/__tests__/services/pipeline-executor.service.test.ts`

**Failing Tests:**
```
Line 85:  should start pipeline execution successfully (status wrong)
Line 228: should enforce quality gates (execution is null)
Line 293: should fail stage on quality gate (status undefined)
```

**Problem Analysis:**
```
Test 1: Pipeline starting with status='running' (expected 'queued')
Test 2: Pipeline execution not being created/stored
Test 3: Failed stage status not being set to 'failed'
```

**Investigation Steps:**
1. Check pipeline initialization logic
2. Verify execution object creation
3. Check state transition flow
4. Verify error handling sets correct status

**Solution Plan:**
```typescript
// Fix 1: Initial state should be 'queued'
function startPipeline() {
  const execution = {
    status: 'queued',  // ← Change from 'running'
    // ... other fields
  };
  return execution;
}

// Fix 2: Ensure execution is stored
async function createExecution(pipeline, user) {
  const execution = await prisma.pipelineExecution.create({
    data: {
      pipeline_id: pipeline.id,
      status: 'queued',
      // ... all required fields
    }
  });
  return execution;
}

// Fix 3: Set stage status on failure
async function executeStage(stage) {
  try {
    // ... execute stage
  } catch (error) {
    // Set status to 'failed'
    await updateStageResult({
      status: 'failed',
      error: error.message
    });
    throw error;
  }
}
```

**Implementation Steps:**
1. Review pipeline-executor.service.ts
2. Fix initial state logic (queued → running transition)
3. Ensure execution object is persisted
4. Add proper error handling for stage failures
5. Verify stage result updates

**Estimated Time:** 30-45 minutes
**Expected Result:** 3 tests passing

---

#### Fix 4.2: Workflow API Validation
**File:** `packages/orchestrator/src/api/routes/workflow.routes.ts`
**Test File:** `packages/orchestrator/tests/api/workflow.routes.test.ts`

**Failing Tests:**
```
Line 47: should create a new workflow (400 instead of 200)
Line 88: should handle service errors (400 instead of 500)
```

**Problem Analysis:**
```
Test 1: Valid request being rejected (400 Bad Request)
Test 2: Server error returning 400 instead of 500
Root Cause: Validation logic too strict or error handling wrong status
```

**Solution Plan:**
1. Review request body validation
2. Check if test request matches schema requirements
3. Fix error response status codes
4. Ensure validation only rejects truly invalid requests

**Implementation Steps:**
1. Check CreateWorkflowSchema requirements
2. Update test request to match schema
3. OR relax validation if test request is reasonable
4. Fix error handling to return 500 for service errors
5. Return 400 only for validation errors

**Estimated Time:** 15-30 minutes
**Expected Result:** 2 tests passing

---

#### Fix 4.3: Type Guard Issues
**File:** `packages/shared/types/src/core/brands.ts`
**Test File:** `packages/orchestrator/tests/simple-happy-path.test.ts`

**Failing Tests:**
```
Line 123: should support type branding for IDs (isAgentId() returns false)
Line 161: should handle workflow state transitions (validation not throwing)
```

**Problem Analysis:**
```
Test 1: AgentId format not matching type guard pattern
Test 2: Schema validation accepting invalid state transitions
```

**Solution Plan:**
```typescript
// Fix 1: Type guard pattern
export const isAgentId = (id: unknown): id is AgentId => {
  return typeof id === 'string' && id.includes('_agent_');
};

// Fix 2: Ensure test uses correct ID format
const agentId = 'scaffold_agent_123' as AgentId;  // Must have '_agent_'

// Fix 3: Schema validation
const schema = z.object({
  current_stage: z.enum(['initialization', 'development', 'testing', 'integration', 'deployment'])
});

// Invalid state should throw
expect(() => schema.parse({ current_stage: 'invalid' })).toThrow();
```

**Implementation Steps:**
1. Review type guard implementations
2. Verify test uses correct ID format
3. Check schema validation constraints
4. Update test expectations if needed

**Estimated Time:** 15-30 minutes
**Expected Result:** 2 tests passing

---

#### Fix 4.4: Database Mocking
**File:** `packages/orchestrator/tests/services/workflow.service.test.ts`

**Failing Tests:**
```
Line 73: should successfully create a workflow (workflow not found after creation)
```

**Problem Analysis:**
```
Expected: Workflow persisted in database
Actual: Workflow not found when queried
Root Cause: Mock Prisma not storing data
```

**Solution Plan:**
1. Use in-memory database mock or store data
2. Ensure Prisma mock returns created data
3. Or use real test database

**Implementation Steps:**
1. Review Prisma mock setup
2. Implement data storage in mock
3. Or switch to real database for integration test
4. Verify workflow is returned after creation

**Estimated Time:** 15-30 minutes
**Expected Result:** 1 test passing

**Estimated Time (Phase 4 Total):** 1-2 hours
**Expected Result:** 8 tests passing

---

### Phase 5: Base-Agent Mock Issues (P2 - 45 minutes)
**Impact:** Fixes 3 tests, non-blocking to pipeline

#### Fix 5.1: Base-Agent Mock Setup
**File:** `packages/agents/base-agent/tests/base-agent.test.ts`

**Failing Tests:**
```
Line 190: should retry failed operations
Line 221: should call Claude API successfully
Line 244: should handle Claude API errors
```

**Problem Analysis:**
```
Tests 1-3: Claude client mock not wired correctly
Root Cause: Mock not returning proper values or callbacks not being invoked
```

**Solution Plan:**
```typescript
// Fix: Properly mock Claude client
vi.mock('@anthropic-ai/sdk', () => {
  const mockMessages = {
    create: vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'mocked response' }]
    })
  };
  return {
    default: vi.fn(() => ({
      messages: mockMessages
    }))
  };
});

// Ensure retry logic works
const operation = vi.fn()
  .mockRejectedValueOnce(new Error('First'))
  .mockRejectedValueOnce(new Error('Second'))
  .mockResolvedValueOnce('Success');

// Should eventually succeed after retries
```

**Implementation Steps:**
1. Review Claude client mocking
2. Ensure mock returns correct response format
3. Verify retry logic actually retries
4. Check error handling throws correctly

**Estimated Time:** 45 minutes
**Expected Result:** 3 tests passing

---

## 📅 Session #51 Schedule

### Total Estimated Time: 4-6 hours

| Phase | Task | Time | Tests Fixed | Cumulative |
|-------|------|------|-------------|-----------|
| 1 | Fix test framework | 15-30 min | 2 | 353/380 |
| 2 | Fix handler cleanup | 30-60 min | 4 | 357/380 |
| 3 | Fix Redis integration | 2-3 hrs | 17 | 374/380 |
| 4 | Fix service logic | 1-2 hrs | 8 | 382/380 |
| 5 | Fix base-agent | 45 min | 3 | 385/380 |
| **TOTAL** | | **4-6 hrs** | **29** | **380/380 ✅** |

*Note: Numbers may overlap as some tests are blocked by others*

---

## 🔧 Implementation Checklist

### Pre-Session Setup
- [ ] Review all failing test files
- [ ] Understand current implementation of each failing component
- [ ] Set up debugging tools/logs
- [ ] Ensure fresh development environment

### Phase 1: Framework Errors
- [ ] Investigate full-workflow.test.ts import
- [ ] Fix module resolution or create missing file
- [ ] Investigate scaffold-happy-path.test.ts CommonJS/ESM
- [ ] Convert imports to ESM or fix config
- [ ] Verify tests load and execute

### Phase 2: Handler Cleanup
- [ ] Review agent-dispatcher.service.ts
- [ ] Identify handler creation/cleanup logic
- [ ] Add success path cleanup
- [ ] Add failure path cleanup
- [ ] Test with concurrent workflows
- [ ] Verify handlers.size === 0 after completion

### Phase 3: Redis Integration
- [ ] Review message bus implementation
- [ ] Check pub/sub message delivery
- [ ] Fix state isolation between tests
- [ ] Fix envelope factory defaults
- [ ] Fix envelope retry logic
- [ ] Fix idempotency tracking
- [ ] Fix error handler invocation

### Phase 4: Service Logic
- [ ] Fix pipeline initial state
- [ ] Fix execution persistence
- [ ] Fix stage failure status
- [ ] Fix API validation
- [ ] Fix type guards
- [ ] Fix database mocking

### Phase 5: Base-Agent
- [ ] Review Claude mock setup
- [ ] Fix retry logic
- [ ] Fix error handling
- [ ] Verify all 3 tests pass

### Post-Session
- [ ] Run full test suite: `npm test -- -- --run`
- [ ] Verify 380/380 tests passing
- [ ] Check TypeScript compilation: `npm run build`
- [ ] Commit changes with proper message
- [ ] Document any remaining issues

---

## 🔍 Testing & Verification

### During Development
```bash
# Test specific phase
cd packages/orchestrator
npm test -- tests/e2e/full-workflow.test.ts        # Phase 1
npm test -- tests/services/agent-dispatcher.service.test.ts  # Phase 2
npm test -- src/hexagonal/__tests__/smoke.test.ts  # Phase 3
npm test -- tests/api/workflow.routes.test.ts      # Phase 4
cd packages/agents/base-agent
npm test                                            # Phase 5
```

### Final Verification
```bash
# Full test suite
npm test -- -- --run

# Expected output:
# Test Files  22 passed (22)
# Tests       380 passed (380)
```

---

## 📊 Success Criteria

- ✅ All 29 failing tests passing
- ✅ No new test failures introduced
- ✅ Zero TypeScript compilation errors
- ✅ All 5 services still operational
- ✅ No performance regressions
- ✅ Build passes cleanly

---

## 🎯 Key Implementation Notes

### For Test Framework Fixes
- Module paths are case-sensitive on Linux
- Check both the import statement AND file location
- Vitest configuration affects how modules are loaded

### For Handler Cleanup
- Use Map.delete() or Set.delete() consistently
- Check for both sync and async cleanup paths
- Test with concurrent operations to find race conditions

### For Redis Integration
- Redis pub/sub timing can be flaky in tests
- Use real Redis or a complete mock implementation
- State isolation is critical (flush before each test)
- Envelopes should be immutable (don't modify originals)

### For Service Logic
- State transitions should be explicit and documented
- Always persist state to database before returning
- Error responses should use correct HTTP status codes
- Type guards should match ID generation patterns

### For Base-Agent
- Mock libraries at module level before imports
- Verify mock is called with expected arguments
- Retry logic needs to actually catch and retry
- Error handling must throw with correct message

---

## 🚀 Next Steps After Session #51

1. **Commit Changes**
   ```bash
   git add .
   git commit -m "Session #51: Fix all 29 failing tests, achieve 100% pass rate"
   ```

2. **Update Documentation**
   - Add Session #51 completion notes to CLAUDE.md
   - Update system status to 100% operational
   - Document any architectural changes made

3. **Plan Session #52**
   - Run comprehensive end-to-end workflows
   - Test production scenarios
   - Optimize performance if needed

---

## 📝 Notes & Learnings

- Keep detailed logs of what was fixed and why
- Document any design patterns discovered
- Note any test infrastructure improvements needed
- Identify any systemic issues to prevent in future

---

**Generated:** 2025-11-12
**Session:** #50 (Planning for #51)
**Status:** Ready for Execution
**Target:** 100% Test Pass Rate (380/380)
