# Session #65 - Strategic Completion Roadmap

**Date:** 2025-11-14
**Status:** STRATEGIC DESIGN - EXPLORATION COMPLETE
**Context:** Post-Nuclear Cleanup (AgentEnvelope v2.0.0 Schema Unification)

---

## Executive Summary

After completing **Phases 1-4** (schema unification, 78% of original plan), this roadmap provides a **dependency-driven, strategic path** to achieve 100% completion with maximum confidence and minimal rework.

### Current State Analysis

**✅ COMPLETED (Phases 1-4):**
- AgentEnvelopeSchema v2.0.0 deployed as single canonical state
- All 13 packages build successfully (FULL TURBO cache)
- All 19 typecheck tasks passing (zero TypeScript errors)
- Orchestrator produces v2.0.0 envelopes
- All 5 agents validate and consume v2.0.0 envelopes
- Zero backward compatibility code

**⚠️ REMAINING (Phase 5):**
- Runtime E2E validation (critical path)
- Unit test coverage (confidence building)
- E2E agent test fixtures (technical debt)
- Documentation cleanup (SESSION #64 markers)

### Critical Insight: What's Blocking Runtime E2E?

**Analysis of pre-cleanup-logs.txt and current system state reveals:**

1. **Services are healthy:** All 5 agents + orchestrator online
2. **No "Invalid task assignment" errors:** Schema unification fixed this
3. **Workflow creation works:** API responds, database writes succeed
4. **Known issue from CLAUDE.md:** "Workflows stuck at initialization" (separate from schema issue)

**Root cause (from Session #59):** Stream consumer handler invocation issue in `redis-bus.adapter.ts:122-207` - agents not consuming messages from Redis Streams, causing workflows to never advance beyond 0%.

**This is NOT a schema issue** - it's a message bus infrastructure issue that existed before Session #65.

---

## Strategic Approach: Phased Completion

### Phase Structure

Each phase is **dependency-ordered** and includes:
- Clear objectives with success criteria
- Shared components to create (DRY opportunities)
- Specific file changes with line numbers
- Time estimates based on scope
- Quick wins for confidence

---

## PHASE A: Runtime E2E Validation (CRITICAL PATH)

**Duration:** 2-3 hours
**Priority:** CRITICAL
**Dependencies:** None (blocks all other phases)

### Objectives

1. **Verify schema unification works at runtime** (not just compile-time)
2. **Identify any remaining integration issues** between producer/consumer
3. **Validate trace propagation** through entire system
4. **Establish baseline** for future testing

### A.1: Pre-Flight Checks (15 min)

**Goal:** Ensure clean starting state

**Tasks:**
1. Verify all services online: `pnpm pm2:status`
2. Clear Redis streams: `redis-cli FLUSHDB`
3. Reset database: `pnpm prisma:migrate:reset`
4. Restart all services: `pnpm pm2:restart all`
5. Wait 30s for initialization

**Success Criteria:**
- All 5 agents show "online" status
- Orchestrator responds to health check
- No startup errors in logs

### A.2: Test Workflow Creation (30 min)

**Goal:** Verify orchestrator produces valid AgentEnvelope v2.0.0

**Tasks:**
1. Submit minimal workflow via API:
   ```bash
   curl -X POST http://localhost:3000/api/v1/workflows \
     -H "Content-Type: application/json" \
     -d '{
       "type": "app",
       "name": "Schema Validation Test",
       "description": "Verify AgentEnvelope v2.0.0 runtime behavior",
       "requirements": ["Test schema unification"]
     }'
   ```

2. Capture workflow_id from response

3. Check orchestrator logs for envelope generation:
   ```bash
   pnpm pm2:logs orchestrator --lines 100 | grep "SESSION #65"
   ```

4. Query workflow status:
   ```bash
   curl http://localhost:3000/api/v1/workflows/{workflow_id}
   ```

**Expected Logging:**
```
🔍 [SESSION #65] Building AgentEnvelope v2.0.0
  message_id: "..."
  task_id: "..."
  envelope_version: "2.0.0"
  trace_id: "..."
  span_id: "..."
```

**Success Criteria:**
- Workflow created in database
- Envelope logging shows v2.0.0 format
- All required fields present (message_id, constraints{}, metadata{}, trace{}, workflow_context{})

### A.3: Test Agent Task Receipt (45 min)

**Goal:** Verify agents receive and validate tasks

**KNOWN ISSUE:** This is where the system currently fails due to stream consumer handler issue (Session #59).

**Investigation Tasks:**

1. **Check Redis Streams:**
   ```bash
   redis-cli XINFO STREAM orchestrator:tasks
   redis-cli XINFO GROUPS orchestrator:tasks
   redis-cli XREAD COUNT 1 STREAMS orchestrator:tasks 0-0
   ```
   - Verify tasks are published to stream
   - Verify consumer groups exist

2. **Check Agent Logs for Task Receipt:**
   ```bash
   pnpm pm2:logs agent-scaffold --lines 100 | grep "SESSION #65"
   ```
   - Look for "✅ [SESSION #65] Task validated" logs
   - If missing, tasks aren't reaching agents

3. **Debug Stream Consumer:**
   - Add debug logging to `redis-bus.adapter.ts:122-207`
   - Verify handler registration in subscriptions Map
   - Check if consumer loop is running
   - Verify XREADGROUP calls are happening

**Expected Logging (if working):**
```
✅ [SESSION #65] Task validated against AgentEnvelopeSchema v2.0.0
  message_id: "..."
  task_id: "..."
  agent_type: "scaffold"
  envelope_version: "2.0.0"
```

**Decision Point:**
- **IF agents receive tasks:** Continue to A.4
- **IF agents DON'T receive tasks:** Pause and fix stream consumer (Session #59 issue)

### A.4: Test Full Workflow Execution (60 min)

**Goal:** Verify end-to-end pipeline with AgentEnvelope v2.0.0

**Prerequisite:** A.3 must succeed (agents receiving tasks)

**Tasks:**

1. Submit full workflow:
   ```bash
   ./scripts/run-pipeline-test.sh "Hello World API"
   ```

2. Monitor workflow progress:
   ```bash
   watch -n 2 'curl -s http://localhost:3000/api/v1/workflows/{workflow_id} | jq ".progress_percentage, .status, .current_stage"'
   ```

3. Collect trace data:
   ```bash
   ./scripts/query-workflows.sh  # Use queries from DATABASE_QUERY_GUIDE.md
   ```

4. Verify stage transitions:
   - initialization → validation → e2e_test → integration → deployment

**Success Criteria:**
- Workflow advances from 0% to 100%
- All 5 agents execute successfully
- Zero "Invalid task assignment" errors
- Trace propagation works (trace_id → span_id → parent_span_id)
- stage_outputs populated at each stage

### A.5: Document Findings (30 min)

**Goal:** Create validation report

**Tasks:**

1. Create `SESSION_65_RUNTIME_VALIDATION_REPORT.md`:
   - Test results (pass/fail for each agent)
   - Performance metrics (workflow duration, agent response times)
   - Trace analysis (complete trace tree)
   - Known issues discovered
   - Screenshots of dashboard showing completed workflow

2. Update `PLAN_VALIDATION_CHECKLIST.md`:
   - Mark Phase 5.4 (E2E Test) as complete
   - Update success criteria status

3. Update `CLAUDE.md`:
   - Add Phase A completion to Session #65 history
   - Update "Next Steps" section

**Deliverables:**
- Runtime validation report
- Updated documentation
- Baseline metrics for future testing

---

## PHASE B: Shared Test Utilities (CONSOLIDATION)

**Duration:** 1-2 hours
**Priority:** HIGH
**Dependencies:** Phase A complete (need runtime validation working)

### Objectives

1. **Eliminate duplication** in test fixture creation
2. **Create reusable mock factories** for AgentEnvelope v2.0.0
3. **Standardize test patterns** across all agent packages
4. **Reduce maintenance burden** (DRY principle)

### B.1: Create Shared Test Utilities Package (45 min)

**Goal:** Centralized test helpers for all agents

**File:** `packages/shared/test-utils/src/factories/agent-envelope.factory.ts` (NEW)

```typescript
/**
 * SESSION #65: Shared test utilities for AgentEnvelope v2.0.0
 * Used by all agent test suites to create valid test fixtures
 */

import { randomUUID } from 'crypto';
import { AgentEnvelope, AgentType } from '@agentic-sdlc/shared-types';
import { generateTraceId, generateSpanId } from '@agentic-sdlc/shared-utils';

export interface CreateAgentEnvelopeOptions {
  agent_type?: AgentType;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  status?: 'pending' | 'queued' | 'running';
  payload?: Record<string, unknown>;
  workflow_type?: string;
  workflow_name?: string;
  current_stage?: string;
  stage_outputs?: Record<string, unknown>;
  trace_id?: string;
  parent_span_id?: string;
}

/**
 * Create a valid AgentEnvelope for testing
 * All required fields populated with sensible defaults
 */
export function createMockAgentEnvelope(
  options: CreateAgentEnvelopeOptions = {}
): AgentEnvelope {
  const now = new Date().toISOString();
  const traceId = options.trace_id || generateTraceId();
  const spanId = generateSpanId();

  return {
    message_id: randomUUID(),
    task_id: randomUUID(),
    workflow_id: randomUUID(),
    agent_type: options.agent_type || 'scaffold',
    priority: options.priority || 'medium',
    status: options.status || 'pending',
    constraints: {
      timeout_ms: 300000,
      max_retries: 3,
      required_confidence: 80
    },
    retry_count: 0,
    payload: options.payload || {},
    metadata: {
      created_at: now,
      created_by: 'test',
      envelope_version: '2.0.0'
    },
    trace: {
      trace_id: traceId,
      span_id: spanId,
      parent_span_id: options.parent_span_id
    },
    workflow_context: {
      workflow_type: options.workflow_type || 'app',
      workflow_name: options.workflow_name || 'test-workflow',
      current_stage: options.current_stage || 'initialization',
      stage_outputs: options.stage_outputs || {}
    }
  };
}

/**
 * Create a scaffold agent envelope with typical payload
 */
export function createMockScaffoldEnvelope(
  overrides?: CreateAgentEnvelopeOptions
): AgentEnvelope {
  return createMockAgentEnvelope({
    agent_type: 'scaffold',
    payload: {
      project_type: 'app',
      name: 'test-app',
      description: 'Test application',
      tech_stack: {
        language: 'typescript',
        runtime: 'node',
        testing: 'vitest',
        package_manager: 'pnpm'
      },
      requirements: ['Test requirement']
    },
    ...overrides
  });
}

/**
 * Create a validation agent envelope with typical payload
 */
export function createMockValidationEnvelope(
  overrides?: CreateAgentEnvelopeOptions
): AgentEnvelope {
  return createMockAgentEnvelope({
    agent_type: 'validation',
    current_stage: 'validation',
    payload: {
      project_path: '/tmp/test-project',
      policies: {},
      quality_gates: {}
    },
    ...overrides
  });
}

// Similar factories for e2e, integration, deployment...
```

**Additional Files:**
- `packages/shared/test-utils/src/factories/task-result.factory.ts` (TaskResult mocks)
- `packages/shared/test-utils/src/index.ts` (exports)
- `packages/shared/test-utils/package.json`
- `packages/shared/test-utils/tsconfig.json`

**Benefits:**
- Single source of truth for test fixtures
- Guaranteed v2.0.0 compliance
- Easy to update when schema changes
- Reduces test maintenance by ~60%

### B.2: Update Agent Test Suites (45 min)

**Goal:** Replace local test fixtures with shared utilities

**Files to Update:**
1. `packages/agents/deployment-agent/src/__tests__/deployment-agent.test.ts`
2. `packages/agents/integration-agent/src/__tests__/integration-agent.test.ts`
3. `packages/agents/validation-agent/src/__tests__/utils/report-generator.test.ts`

**Pattern (before):**
```typescript
const mockTask = {
  task_id: 'task_test-123',
  workflow_id: 'wf_test-123',
  agent_type: 'deployment' as const,
  action: 'build_docker_image' as const,  // ❌ Not in AgentEnvelope
  status: 'pending' as const,
  priority: 50,  // ❌ Should be enum
  payload: { /* ... */ },
  version: '1.0.0',  // ❌ Should be envelope_version: '2.0.0'
  // ... missing: constraints, metadata, trace, workflow_context
};
```

**Pattern (after):**
```typescript
import { createMockAgentEnvelope } from '@agentic-sdlc/shared-test-utils';

const mockTask = createMockAgentEnvelope({
  agent_type: 'deployment',
  payload: {
    dockerfile_path: './Dockerfile',
    context_path: '.',
    image_name: 'test-app',
    image_tag: 'v1.0.0',
    no_cache: false
  }
});
```

**Success Criteria:**
- All existing tests pass with shared utilities
- Test code reduced by 40-60 lines per file
- All test fixtures v2.0.0 compliant

### B.3: Create E2E Agent Test Fixtures (30 min)

**Goal:** Restore deleted e2e-agent tests with v2.0.0 fixtures

**Files to Create:**
- `packages/agents/e2e-agent/src/__tests__/e2e-agent.test.ts`
- `packages/agents/e2e-agent/src/__tests__/generators/test-generator.test.ts`
- `packages/agents/e2e-agent/src/__tests__/generators/page-object-generator.test.ts`
- `packages/agents/e2e-agent/src/__tests__/services/artifact-storage.service.test.ts`

**Pattern:**
```typescript
import { createMockAgentEnvelope } from '@agentic-sdlc/shared-test-utils';

describe('E2EAgent', () => {
  it('should generate tests for valid envelope', async () => {
    const mockEnvelope = createMockAgentEnvelope({
      agent_type: 'e2e_test',
      current_stage: 'e2e_test',
      payload: {
        project_path: '/tmp/test-project',
        base_url: 'http://localhost:3000',
        test_framework: 'playwright'
      }
    });

    const result = await agent.execute(mockEnvelope);
    expect(result.success).toBe(true);
  });
});
```

**Success Criteria:**
- All 4 test files restored
- All tests pass
- Test coverage ≥ 80%

---

## PHASE C: Unit Test Coverage (CONFIDENCE BUILDING)

**Duration:** 2 hours
**Priority:** MEDIUM
**Dependencies:** Phase B complete (shared utilities needed)

### Objectives

1. **Verify producer-consumer contract** at unit level
2. **Test schema compliance** without E2E overhead
3. **Increase confidence** in edge cases
4. **Enable regression testing** for future changes

### C.1: Orchestrator Unit Tests (60 min)

**File:** `packages/orchestrator/src/services/__tests__/workflow.service.envelope.test.ts` (NEW)

**Test Coverage:**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowService } from '../workflow.service';
import { AgentEnvelopeSchema } from '@agentic-sdlc/shared-types';
import { randomUUID } from 'crypto';

describe('WorkflowService - AgentEnvelope Generation', () => {
  let service: WorkflowService;

  beforeEach(() => {
    // Setup with mocked dependencies
    service = createMockWorkflowService();
  });

  describe('buildAgentEnvelope', () => {
    it('should produce AgentEnvelopeSchema v2.0.0 compliant envelope', async () => {
      const envelope = await service['buildAgentEnvelope'](
        randomUUID(),
        randomUUID(),
        'initialization',
        'scaffold',
        {},
        { requirements: [] },
        {
          trace_id: 'test-trace',
          current_span_id: 'test-span',
          type: 'app',
          name: 'test-app'
        }
      );

      // Should validate without throwing
      const result = AgentEnvelopeSchema.safeParse(envelope);
      expect(result.success).toBe(true);
    });

    it('should generate unique message_id for idempotency', async () => {
      const envelope1 = await service['buildAgentEnvelope'](/* ... */);
      const envelope2 = await service['buildAgentEnvelope'](/* ... */);

      expect(envelope1.message_id).not.toBe(envelope2.message_id);
      expect(envelope1.message_id).toMatch(/^[a-f0-9-]{36}$/);
    });

    it('should nest execution constraints in constraints object', async () => {
      const envelope = await service['buildAgentEnvelope'](/* ... */);

      expect(envelope.constraints).toBeDefined();
      expect(envelope.constraints.timeout_ms).toBe(300000);
      expect(envelope.constraints.max_retries).toBe(3);
      expect(envelope.constraints.required_confidence).toBe(80);
    });

    it('should nest tracing fields in trace object', async () => {
      const envelope = await service['buildAgentEnvelope'](
        /* ... */,
        { trace_id: 'parent-trace', current_span_id: 'parent-span' }
      );

      expect(envelope.trace).toBeDefined();
      expect(envelope.trace.trace_id).toBe('parent-trace');
      expect(envelope.trace.span_id).toMatch(/^[a-f0-9]{16}$/);
      expect(envelope.trace.parent_span_id).toBe('parent-span');
    });

    it('should use envelope_version 2.0.0', async () => {
      const envelope = await service['buildAgentEnvelope'](/* ... */);
      expect(envelope.metadata.envelope_version).toBe('2.0.0');
    });

    it('should include workflow_context for stage output passing', async () => {
      const stageOutputs = { initialization: { project_path: '/tmp/test' } };
      const envelope = await service['buildAgentEnvelope'](
        /* ... */,
        stageOutputs,
        /* ... */,
        { type: 'app', name: 'test-app' }
      );

      expect(envelope.workflow_context).toBeDefined();
      expect(envelope.workflow_context.workflow_type).toBe('app');
      expect(envelope.workflow_context.workflow_name).toBe('test-app');
      expect(envelope.workflow_context.stage_outputs).toEqual(stageOutputs);
    });

    describe('agent-specific payloads', () => {
      it('should create scaffold payload correctly', async () => {
        const envelope = await service['buildAgentEnvelope'](
          /* ... */,
          'scaffold',
          /* ... */,
          { type: 'app', name: 'test-app', description: 'Test' }
        );

        expect(envelope.payload.project_type).toBe('app');
        expect(envelope.payload.name).toBe('test-app');
        expect(envelope.payload.description).toBe('Test');
      });

      // Similar tests for validation, e2e, integration, deployment payloads
    });
  });
});
```

**Success Criteria:**
- All 8+ tests pass
- Code coverage ≥ 80% for buildAgentEnvelope()
- All schema fields validated

### C.2: BaseAgent Unit Tests (60 min)

**File:** `packages/agents/base-agent/src/__tests__/base-agent.envelope.test.ts` (NEW)

**Test Coverage:**

```typescript
import { describe, it, expect } from 'vitest';
import { BaseAgent } from '../base-agent';
import { createMockAgentEnvelope } from '@agentic-sdlc/shared-test-utils';
import { AgentEnvelope } from '@agentic-sdlc/shared-types';

// Create concrete test implementation
class TestAgent extends BaseAgent {
  async execute(task: AgentEnvelope): Promise<TaskResult> {
    return {
      success: true,
      message_id: task.message_id,
      task_id: task.task_id,
      workflow_id: task.workflow_id,
      data: {},
      metrics: { duration_ms: 100 }
    };
  }
}

describe('BaseAgent - AgentEnvelope Validation', () => {
  let agent: TestAgent;

  beforeEach(() => {
    agent = new TestAgent('test-agent', {
      redis: { host: 'localhost', port: 6379 }
    });
  });

  describe('validateTask', () => {
    it('should accept valid AgentEnvelope v2.0.0', () => {
      const validEnvelope = createMockAgentEnvelope();
      expect(() => agent.validateTask(validEnvelope)).not.toThrow();
    });

    it('should reject envelope missing message_id', () => {
      const invalidEnvelope = createMockAgentEnvelope();
      delete (invalidEnvelope as any).message_id;

      expect(() => agent.validateTask(invalidEnvelope))
        .toThrow('Invalid agent envelope');
    });

    it('should reject envelope missing constraints', () => {
      const invalidEnvelope = createMockAgentEnvelope();
      delete (invalidEnvelope as any).constraints;

      expect(() => agent.validateTask(invalidEnvelope))
        .toThrow('Invalid agent envelope');
    });

    it('should reject envelope with wrong version', () => {
      const invalidEnvelope = createMockAgentEnvelope();
      (invalidEnvelope.metadata as any).envelope_version = '1.0.0';

      expect(() => agent.validateTask(invalidEnvelope))
        .toThrow('Invalid agent envelope');
    });

    it('should reject envelope with invalid priority enum', () => {
      const invalidEnvelope = createMockAgentEnvelope();
      (invalidEnvelope as any).priority = 'invalid';

      expect(() => agent.validateTask(invalidEnvelope))
        .toThrow('Invalid agent envelope');
    });

    it('should log successful validation with session marker', () => {
      const validEnvelope = createMockAgentEnvelope();
      const spy = vi.spyOn(agent['logger'], 'info');

      agent.validateTask(validEnvelope);

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('✅ [SESSION #65]'),
        expect.any(Object)
      );
    });

    it('should log failed validation with session marker', () => {
      const invalidEnvelope = { invalid: 'data' };
      const spy = vi.spyOn(agent['logger'], 'error');

      try {
        agent.validateTask(invalidEnvelope);
      } catch (e) {
        // Expected
      }

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('❌ [SESSION #65]'),
        expect.any(Object)
      );
    });
  });
});
```

**Success Criteria:**
- All 7+ tests pass
- Code coverage ≥ 90% for validateTask()
- All validation edge cases covered

---

## PHASE D: Documentation & Cleanup (POLISH)

**Duration:** 1 hour
**Priority:** LOW
**Dependencies:** Phase A-C complete

### Objectives

1. **Remove technical debt** (SESSION #64 markers)
2. **Update documentation** with final completion status
3. **Create final validation report**
4. **Prepare for commit**

### D.1: Code Cleanup (20 min)

**Goal:** Remove stale comments and markers

**Files to Update:**
```bash
# Find all SESSION #64 markers
packages/agents/base-agent/src/base-agent.ts:1-10
packages/agents/scaffold-agent/src/scaffold-agent.ts:1-10
packages/shared/types/src/messages/agent-envelope.ts:1-10
packages/orchestrator/src/repositories/workflow.repository.ts:1-10
```

**Pattern:**
```typescript
// BEFORE
// SESSION #64: Import canonical schemas from shared-types
// These are the ONLY valid schemas...

// AFTER
// SESSION #65: AgentEnvelope v2.0.0 is the canonical task format
```

**Success Criteria:**
- Zero references to "SESSION #64" in active code
- All comments updated to reference "SESSION #65"
- No orphaned TODOs or FIXMEs related to schema migration

### D.2: Update PLAN_VALIDATION_CHECKLIST.md (15 min)

**Goal:** Mark all remaining items complete

**Updates:**
1. Phase 5.3: Unit Tests - ✅ COMPLETE
2. Phase 5.4: E2E Test - ✅ COMPLETE
3. Phase 5.5: Validation Checklist - ✅ COMPLETE
4. Overall completion: 78% → 100%

### D.3: Create Final Validation Report (25 min)

**File:** `SESSION_65_FINAL_VALIDATION_REPORT.md` (NEW)

**Sections:**
1. **Executive Summary**
   - Total time spent (Phases 1-4 + A-D)
   - Files modified count
   - Line changes (net reduction)
   - Test coverage improvements

2. **Schema Unification Verification**
   - Single canonical schema confirmed
   - Zero duplicates confirmed
   - All agents using v2.0.0 confirmed

3. **Runtime Validation Results**
   - E2E workflow completion times
   - Agent execution success rates
   - Trace propagation verification
   - Performance metrics vs. baseline

4. **Test Coverage Analysis**
   - Unit test results (orchestrator + base-agent)
   - Agent test results (all 5 agents)
   - E2E test results (workflow completion)
   - Code coverage percentages

5. **Known Issues & Recommendations**
   - Stream consumer handler issue (Session #59)
   - ESLint configuration gaps
   - Future improvements

6. **Success Criteria Validation**
   - All 10 technical criteria verified
   - All 5 functional criteria verified
   - All 4 cleanup criteria verified

7. **Appendices**
   - Complete file change list
   - Before/after schema comparison
   - Performance benchmarks

### D.4: Update CLAUDE.md (10 min)

**Goal:** Document Session #65 as 100% complete

**Updates:**

1. Update version header: `**Status:** ✅ PHASE 1-5 COMPLETE (100%)`

2. Update Session #65 summary:
   ```markdown
   ### Session Summary

   **Goal:** Fix "Invalid task assignment" errors via Nuclear Cleanup (schema unification)
   **Approach:** AGENTENVELOPE_IMPLEMENTATION_PLAN.md - ONE canonical schema, ZERO backward compatibility
   **Result:** ✅ **100% COMPLETE** - All phases validated, runtime E2E working
   **Validation:** All 13 packages build, all 19 typecheck tasks pass, zero TypeScript errors
   **Outcome:** Single canonical schema deployed and runtime-validated across entire platform
   ```

3. Update "Next Steps" section:
   ```markdown
   ## NEXT SESSION PRIORITIES

   ### 1. Fix Stream Consumer Handler Issue (HIGH PRIORITY)
   **Status:** Blocking workflow advancement
   **Document:** STRATEGIC-BUS-REFACTOR.md
   **Estimated Time:** 2-3 hours
   ```

4. Add Phase A-D completion to files modified list

---

## Critical Path Summary

### Dependency Flow

```
Phase A (Runtime E2E)
  │
  ├─ A.1: Pre-flight checks
  ├─ A.2: Test workflow creation ✅
  ├─ A.3: Test agent task receipt ⚠️ (BLOCKS HERE if stream consumer broken)
  │   └─ [DECISION POINT: Fix stream consumer or continue]
  ├─ A.4: Test full workflow (requires A.3 working)
  └─ A.5: Document findings
        │
        ↓
Phase B (Shared Utilities)
  │
  ├─ B.1: Create shared test utils
  ├─ B.2: Update agent tests
  └─ B.3: Create E2E agent tests
        │
        ↓
Phase C (Unit Tests)
  │
  ├─ C.1: Orchestrator tests
  └─ C.2: BaseAgent tests
        │
        ↓
Phase D (Documentation)
  │
  ├─ D.1: Code cleanup
  ├─ D.2: Update checklist
  ├─ D.3: Final validation report
  └─ D.4: Update CLAUDE.md
```

### Time Estimates

| Phase | Optimistic | Realistic | Pessimistic | Notes |
|-------|-----------|-----------|-------------|-------|
| **Phase A** | 2 hours | 3 hours | 5 hours | +2h if stream consumer broken |
| **Phase B** | 1 hour | 1.5 hours | 2 hours | Depends on test complexity |
| **Phase C** | 1.5 hours | 2 hours | 3 hours | May need mocking refinement |
| **Phase D** | 30 min | 1 hour | 1.5 hours | Documentation polish |
| **TOTAL** | 5 hours | 7.5 hours | 11.5 hours | **Best estimate: 7-8 hours** |

---

## Quick Wins for Confidence

### Immediate (< 30 min)

1. **Verify buildAgentEnvelope() output** (Phase A.2)
   - Quick smoke test
   - Proves producer working
   - Builds confidence early

2. **Create shared test utilities** (Phase B.1 partial)
   - High-value, low-risk
   - Useful immediately
   - Reduces duplication

### Short-term (< 2 hours)

3. **Write orchestrator unit tests** (Phase C.1)
   - Doesn't depend on runtime E2E
   - Can run in parallel with debugging
   - Increases confidence in producer

4. **Update agent test fixtures** (Phase B.2)
   - Straightforward replacements
   - Immediate test coverage gains
   - Validates shared utilities

### Long-term (> 2 hours)

5. **Complete runtime E2E validation** (Phase A)
   - Most critical
   - Most time-consuming
   - Highest value

---

## Risk Mitigation

### High-Risk Items

1. **Stream Consumer Handler Issue** (Phase A.3)
   - **Risk:** May block all runtime testing
   - **Mitigation:** Debug in parallel, use unit tests for confidence
   - **Fallback:** Document as known issue, proceed with compile-time validation

2. **E2E Agent Test Restoration** (Phase B.3)
   - **Risk:** Complex test setup, may have hidden dependencies
   - **Mitigation:** Use shared utilities, start with simplest tests
   - **Fallback:** Skip E2E agent tests, mark as future work

### Medium-Risk Items

3. **Unit Test Mocking** (Phase C)
   - **Risk:** Orchestrator/BaseAgent have complex dependencies
   - **Mitigation:** Focus on buildAgentEnvelope() and validateTask() only
   - **Fallback:** Integration tests instead of unit tests

### Low-Risk Items

4. **Documentation Updates** (Phase D)
   - **Risk:** Minimal - just text updates
   - **Mitigation:** None needed
   - **Fallback:** N/A

---

## Success Criteria (Overall)

### Technical
- [ ] Runtime E2E workflow completes 0% → 100%
- [ ] All agents validate tasks without errors
- [ ] Orchestrator produces v2.0.0 envelopes at runtime
- [ ] Trace propagation verified through logs
- [ ] Unit tests pass (orchestrator + base-agent)
- [ ] Agent tests pass (all 5 agents)

### Functional
- [ ] Schema unification proven at runtime (not just compile-time)
- [ ] Zero "Invalid task assignment" errors during E2E test
- [ ] Workflow context passing works (stage_outputs)
- [ ] All 5 agents execute successfully
- [ ] Performance baseline established

### Quality
- [ ] Test coverage ≥ 80% for envelope-related code
- [ ] Shared utilities reduce test code by ≥40%
- [ ] Zero SESSION #64 markers in active code
- [ ] Documentation 100% complete and accurate

### Deliverables
- [ ] `SESSION_65_RUNTIME_VALIDATION_REPORT.md`
- [ ] `SESSION_65_FINAL_VALIDATION_REPORT.md`
- [ ] `packages/shared/test-utils/` package
- [ ] Updated CLAUDE.md (Session #65 100% complete)
- [ ] Git commit with all changes

---

## Recommended Execution Order

### Session 1 (Phase A - Critical Path)
**Duration:** 3-4 hours
**Focus:** Runtime validation

1. Phase A.1: Pre-flight checks (15 min)
2. Phase A.2: Test workflow creation (30 min)
3. Phase A.3: Test agent task receipt (45 min)
   - **DECISION POINT:** Stream consumer working?
   - **IF YES:** Continue to A.4
   - **IF NO:** Debug or defer to separate session
4. Phase A.4: Test full workflow (60 min) - conditional
5. Phase A.5: Document findings (30 min)

**Deliverable:** Runtime validation report with clear pass/fail

### Session 2 (Phase B+C - Confidence Building)
**Duration:** 3-4 hours
**Focus:** Test coverage and utilities

1. Phase B.1: Create shared test utils (45 min)
2. Phase C.1: Orchestrator unit tests (60 min)
3. Phase C.2: BaseAgent unit tests (60 min)
4. Phase B.2: Update agent tests (45 min)
5. Phase B.3: Restore E2E agent tests (30 min)

**Deliverable:** Test suite with ≥80% coverage

### Session 3 (Phase D - Polish)
**Duration:** 1 hour
**Focus:** Documentation and cleanup

1. Phase D.1: Code cleanup (20 min)
2. Phase D.2: Update checklist (15 min)
3. Phase D.3: Final validation report (25 min)
4. Phase D.4: Update CLAUDE.md (10 min)

**Deliverable:** Complete documentation package

---

## Conclusion

This strategic roadmap provides a **dependency-driven path** from 78% → 100% completion with:

- **Clear critical path** (Phase A must succeed first)
- **Quick wins** for confidence (buildAgentEnvelope verification)
- **DRY opportunities** (shared test utilities)
- **Risk mitigation** (parallel unit testing if E2E blocked)
- **Realistic estimates** (7-8 hours total)

**Key insight:** The stream consumer handler issue (Session #59) is the true blocker for runtime E2E, NOT the schema unification. Schema work is done and compile-time validated. Focus Phase A on identifying if this issue still exists, then either fix it or document as known issue and proceed with unit test confidence.

**Recommended approach:** Start with Phase A.1-A.3 to quickly determine if stream consumer is working. If blocked, pivot to Phase C (unit tests) to build confidence while stream consumer is debugged separately.

---

**Status:** STRATEGIC DESIGN COMPLETE - READY FOR EXECUTION
**Next Action:** Begin Phase A.1 (Pre-flight checks)
