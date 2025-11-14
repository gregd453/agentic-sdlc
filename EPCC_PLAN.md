# Implementation Plan: Nuclear Cleanup - Option A

**Phase:** PLAN
**Feature:** Remove all backward compatibility code and unify schema architecture
**Approach:** Nuclear Cleanup (simultaneous updates across all agents)
**Estimated Duration:** 6-8 hours
**Priority:** CRITICAL (blocking all workflows)
**Session:** #64
**Created:** 2025-11-14

---

## Executive Summary

### What We're Building
A unified, forward-looking agent architecture that:
- Uses a single canonical `ExecutionEnvelope` schema across all components
- Eliminates duplicate `TaskAssignmentSchema` definitions causing "Invalid task assignment" errors
- Removes ~250 lines of backward compatibility code accumulated across Sessions #36, #37, #47, #60-63
- Establishes clear architectural boundaries between orchestrator (message producer) and agents (message consumers)

### Why It's Needed
**Critical Blocker:** Workflows are stuck at 0% due to schema validation failures. The orchestrator sends:
```typescript
{
  agent_type: "scaffold",
  payload: { name: "...", description: "...", requirements: [...] }
}
```

But agents expect:
```typescript
{
  type: "scaffold",
  name: "...",
  description: "...",
  requirements: "..." // string, not array
}
```

This mismatch causes immediate validation failure before any agent can execute tasks.

**Secondary Benefits:**
- Cleaner codebase (removes 250+ lines of legacy code)
- Consistent message handling across all agents
- Easier future maintenance
- Clear architectural patterns

### Success Criteria
- [ ] All workflows execute without "Invalid task assignment" errors
- [ ] All 5 agents (scaffold, validation, e2e, integration, deployment) process tasks successfully
- [ ] Zero TypeScript compilation errors
- [ ] All unit tests pass
- [ ] E2E pipeline test completes successfully
- [ ] No backward compatibility code remains (SESSION markers, deprecated types, etc.)
- [ ] Clean build output: `turbo run build` succeeds
- [ ] PM2 processes all show "online" status with zero restarts

### Non-Goals (What We're NOT Doing)
- Not implementing strategic BaseAgent refactor (that's a separate 15-20 hour effort documented in EPCC_EXPLORE.md)
- Not adding new features (idempotency, prompt auditing, etc.)
- Not refactoring agent business logic
- Not changing message bus architecture (Redis pub/sub + streams)
- Not modifying database schema
- Not updating distributed tracing implementation

---

## Technical Approach

### High-Level Strategy

**Nuclear Cleanup** = Delete conflicting code and rebuild all agents simultaneously

```
┌─────────────────────────────────────────────────────────────┐
│                    BEFORE (Broken)                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Orchestrator                Base Agent                    │
│  ┌─────────────┐            ┌──────────────┐              │
│  │TaskAssignment│            │TaskAssignment│              │
│  │Schema        │            │Schema        │              │
│  │              │            │              │              │
│  │ agent_type ✓ │            │ type ✗       │              │
│  │ payload {}   │            │ name ✗       │              │
│  │ metadata     │            │ requirements │              │
│  └──────┬───────┘            └──────┬───────┘              │
│         │                           │                      │
│         │    Message Flow           │                      │
│         │  {agent_type, payload}    │                      │
│         └──────────X─────────────►  │                      │
│                MISMATCH!        Validation Fails           │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    AFTER (Fixed)                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Orchestrator                All Agents                    │
│  ┌─────────────┐            ┌──────────────┐              │
│  │Execution    │            │Use Orchestrator│             │
│  │Envelope     │            │Schema         │             │
│  │(Canonical)  │            │(Import Only)  │             │
│  │             │            │               │             │
│  │ message_id  │            │ Parse payload │             │
│  │ task_id     │            │ Extract domain│             │
│  │ workflow_id │            │ data          │             │
│  │ agent_type  │            │               │             │
│  │ payload {}  │            │               │             │
│  │ constraints │            │               │             │
│  │ metadata    │            │               │             │
│  └──────┬──────┘            └──────┬────────┘             │
│         │                          │                      │
│         │   Message Flow           │                      │
│         │  ExecutionEnvelope       │                      │
│         └──────────────────────────►                      │
│                SUCCESS!        ✓ Validates                │
│                                ✓ Parses payload           │
│                                ✓ Executes task            │
│                                                            │
└─────────────────────────────────────────────────────────────┘
```

### Design Decisions

| Decision | Option Chosen | Rationale |
|----------|---------------|-----------|
| **Cleanup Approach** | Nuclear (simultaneous) | Faster (6-8h vs 9-13h), cleaner result, no half-migrated state |
| **Schema Authority** | Orchestrator owns canonical schema | Orchestrator is producer, agents are consumers |
| **Agent Schema Handling** | Delete base-agent schema entirely | Eliminate source of conflict, force import from orchestrator |
| **Message Parsing** | Extract from `payload` field | Aligns with ExecutionEnvelope pattern from Session #60 |
| **Backward Compatibility** | Zero (full removal) | User explicitly requested: "remove backward compatibility requirement and remove old code" |
| **Testing Strategy** | Unit tests + E2E validation | Fast feedback loop, validates real workflow execution |
| **Rollback Plan** | Git branch with clear commits | Can revert individual changes if needed |

### Affected Components

**Packages:**
1. `@agentic-sdlc/orchestrator` - Schema owner
2. `@agentic-sdlc/shared-types` - May need type exports
3. `@agentic-sdlc/agents/base-agent` - Remove duplicate schema
4. `@agentic-sdlc/agents/scaffold-agent` - Update parsing
5. `@agentic-sdlc/agents/validation-agent` - Update parsing
6. `@agentic-sdlc/agents/e2e-agent` - Update parsing
7. `@agentic-sdlc/agents/integration-agent` - Update parsing + remove execute wrapper
8. `@agentic-sdlc/agents/deployment-agent` - Update parsing + remove execute wrapper

**Files to Modify:**
1. `packages/agents/base-agent/src/types.ts` - Delete TaskAssignmentSchema (lines 19-31)
2. `packages/agents/base-agent/src/base-agent.ts` - Import from orchestrator, update validateTask
3. `packages/agents/scaffold-agent/src/scaffold-agent.ts` - Simplify envelope parsing
4. `packages/agents/validation-agent/src/validation-agent.ts` - Remove debug logs, simplify parsing
5. `packages/agents/e2e-agent/src/e2e-agent.ts` - Update parsing
6. `packages/agents/integration-agent/src/integration-agent.ts` - Remove execute wrapper, update parsing
7. `packages/agents/integration-agent/src/types.ts` - Delete deprecated file
8. `packages/agents/deployment-agent/src/deployment-agent.ts` - Remove execute wrapper, update parsing
9. `packages/agents/deployment-agent/src/types.ts` - Delete deprecated file

**Files to Delete:**
- `packages/agents/integration-agent/src/types.ts` - Deprecated re-exports
- `packages/agents/deployment-agent/src/types.ts` - Deprecated re-exports

### Data Flow

**Current (Broken):**
```
1. User creates workflow → Orchestrator
2. Orchestrator creates task with ExecutionEnvelope:
   {
     message_id: "uuid",
     task_id: "uuid",
     workflow_id: "uuid",
     agent_type: "scaffold",
     payload: { name, description, requirements[] },
     constraints: { timeout_ms, max_retries, required_confidence },
     metadata: { created_at, created_by, trace_id }
   }
3. Orchestrator publishes to Redis stream
4. Agent receives message
5. BaseAgent.validateTask() parses with wrong schema:
   TaskAssignmentSchema.parse(task) → expects {type, name, description, requirements: string}
6. ❌ VALIDATION FAILS → "Invalid task assignment"
7. Agent never executes
8. Workflow stuck at 0%
```

**Fixed (After Cleanup):**
```
1. User creates workflow → Orchestrator
2. Orchestrator creates task with ExecutionEnvelope (same as before)
3. Orchestrator publishes to Redis stream
4. Agent receives message
5. BaseAgent.validateTask() parses with correct schema:
   ExecutionEnvelopeSchema.parse(task) → expects {message_id, task_id, agent_type, payload{}}
6. ✅ VALIDATION SUCCEEDS
7. Agent extracts domain data from envelope.payload:
   const scaffoldData = envelope.payload as ScaffoldPayload
8. Agent executes business logic
9. Agent publishes result
10. Orchestrator receives result
11. Workflow advances to next stage
```

---

## Task Breakdown

### Phase 1: Preparation (1 hour)

**1.1 Create Feature Branch**
- **Package:** N/A (git operation)
- **Estimate:** 5 minutes
- **Dependencies:** None
- **Priority:** Critical
- **Tasks:**
  - Create branch: `git checkout -b fix/nuclear-cleanup-option-a`
  - Ensure working directory is clean
  - Note current commit SHA for rollback

**1.2 Backup Current State**
- **Package:** N/A (filesystem operation)
- **Estimate:** 5 minutes
- **Dependencies:** 1.1
- **Priority:** Critical
- **Tasks:**
  - Export current database state: `./scripts/backup-db.sh` (if exists)
  - Document current PM2 status: `pnpm pm2:status > pre-cleanup-status.txt`
  - Take snapshot of logs: `pnpm pm2:logs --lines 100 > pre-cleanup-logs.txt`

**1.3 Run Pre-Cleanup Validation**
- **Package:** All packages
- **Estimate:** 10 minutes
- **Dependencies:** 1.2
- **Priority:** High
- **Tasks:**
  - Build all packages: `turbo run build`
  - Run type checks: `turbo run typecheck`
  - Capture baseline test results: `turbo run test > pre-cleanup-test-results.txt`
  - Document failures (we expect "Invalid task assignment" errors)

**1.4 Stop Running Services**
- **Package:** N/A (PM2 operation)
- **Estimate:** 2 minutes
- **Dependencies:** 1.3
- **Priority:** High
- **Tasks:**
  - Stop all PM2 processes: `pnpm pm2:stop`
  - Verify all stopped: `pnpm pm2:status`
  - Clear Redis streams: `redis-cli FLUSHALL` (optional, for clean test)

**1.5 Review Canonical Schema**
- **Package:** `@agentic-sdlc/orchestrator`
- **Estimate:** 15 minutes
- **Dependencies:** None
- **Priority:** Medium
- **Tasks:**
  - Read `packages/orchestrator/src/types/index.ts` lines 4-32
  - Document ExecutionEnvelope structure
  - Identify required imports for agents
  - Plan export strategy from `@agentic-sdlc/shared-types`

**1.6 Create Rollback Script**
- **Package:** N/A (tooling)
- **Estimate:** 15 minutes
- **Dependencies:** 1.1, 1.5
- **Priority:** Medium
- **Tasks:**
  - Create `scripts/rollback-cleanup.sh`
  - Document manual rollback steps
  - Test rollback procedure on test branch

### Phase 2: Schema Unification (2 hours)

**2.1 Export Canonical Schema to Shared Package**
- **Package:** `@agentic-sdlc/shared-types`
- **Estimate:** 30 minutes
- **Dependencies:** 1.5
- **Priority:** Critical
- **Tasks:**
  - Add `packages/orchestrator/src/types/index.ts` exports to `packages/shared/types/src/index.ts`
  - Export `ExecutionEnvelopeSchema`, `TaskAssignmentSchema`, `ExecutionEnvelope`, `TaskAssignment`
  - Ensure types are re-exported from package root
  - Update `package.json` exports if needed
  - Build shared-types: `cd packages/shared/types && pnpm build`

**2.2 Delete Base Agent Duplicate Schema**
- **Package:** `@agentic-sdlc/agents/base-agent`
- **Estimate:** 15 minutes
- **Dependencies:** 2.1
- **Priority:** Critical
- **Tasks:**
  - Delete lines 19-31 in `packages/agents/base-agent/src/types.ts`
  - Remove TaskAssignmentSchema definition
  - Remove TaskAssignment type export
  - Add import from `@agentic-sdlc/shared-types`
  - Update package.json dependencies to include `@agentic-sdlc/shared-types`

**2.3 Update BaseAgent Validation Method**
- **Package:** `@agentic-sdlc/agents/base-agent`
- **Estimate:** 30 minutes
- **Dependencies:** 2.2
- **Priority:** Critical
- **Tasks:**
  - Update `base-agent.ts` line 287 validateTask method
  - Import ExecutionEnvelopeSchema from shared-types
  - Change validation to use ExecutionEnvelopeSchema.parse()
  - Update return type to ExecutionEnvelope
  - Add JSDoc comments explaining envelope structure
  - Handle parsing errors with clear messages

**2.4 Update BaseAgent Task Handling**
- **Package:** `@agentic-sdlc/agents/base-agent`
- **Estimate:** 45 minutes
- **Dependencies:** 2.3
- **Priority:** Critical
- **Tasks:**
  - Update all references to TaskAssignment type → ExecutionEnvelope
  - Update task processing methods to extract from envelope.payload
  - Ensure trace_id, span_id propagation still works
  - Remove manual envelope unwrapping code (lines with SESSION #37 comments)
  - Add type-safe payload extraction helper methods
  - Update error messages to reference envelope fields

### Phase 3: Agent-Specific Updates (2.5 hours)

**3.1 Update Scaffold Agent**
- **Package:** `@agentic-sdlc/agents/scaffold-agent`
- **Estimate:** 30 minutes
- **Dependencies:** 2.4
- **Priority:** Critical
- **Tasks:**
  - Remove manual envelope parsing in scaffold-agent.ts (lines 70-100)
  - Use ExecutionEnvelope type from shared-types
  - Extract ScaffoldPayload from envelope.payload
  - Remove SESSION #37 comment markers
  - Simplify executeTask method
  - Update type annotations

**3.2 Update Validation Agent**
- **Package:** `@agentic-sdlc/agents/validation-agent`
- **Estimate:** 30 minutes
- **Dependencies:** 2.4
- **Priority:** Critical
- **Tasks:**
  - Remove SESSION #47 debug console.log statements
  - Update envelope parsing to use ExecutionEnvelope type
  - Extract ValidationPayload from envelope.payload
  - Remove backward compatibility fallbacks
  - Simplify executeTask method
  - Update type annotations

**3.3 Update E2E Agent**
- **Package:** `@agentic-sdlc/agents/e2e-agent`
- **Estimate:** 30 minutes
- **Dependencies:** 2.4
- **Priority:** Critical
- **Tasks:**
  - Update envelope parsing to use ExecutionEnvelope type
  - Extract E2EPayload from envelope.payload
  - Remove backward compatibility fallbacks
  - Simplify executeTask method
  - Update type annotations

**3.4 Update Integration Agent**
- **Package:** `@agentic-sdlc/agents/integration-agent`
- **Estimate:** 45 minutes
- **Dependencies:** 2.4
- **Priority:** Critical
- **Tasks:**
  - Delete `packages/agents/integration-agent/src/types.ts` (deprecated re-exports)
  - Remove execute wrapper pattern (if present)
  - Update envelope parsing to use ExecutionEnvelope type
  - Extract IntegrationPayload from envelope.payload
  - Remove backward compatibility fallbacks
  - Update imports to remove local types.ts references
  - Update type annotations

**3.5 Update Deployment Agent**
- **Package:** `@agentic-sdlc/agents/deployment-agent`
- **Estimate:** 45 minutes
- **Dependencies:** 2.4
- **Priority:** Critical
- **Tasks:**
  - Delete `packages/agents/deployment-agent/src/types.ts` (deprecated re-exports)
  - Remove execute wrapper pattern (if present)
  - Update envelope parsing to use ExecutionEnvelope type
  - Extract DeploymentPayload from envelope.payload
  - Remove backward compatibility fallbacks
  - Update imports to remove local types.ts references
  - Update type annotations

### Phase 4: Cleanup Legacy Code (1 hour)

**4.1 Remove Session Markers and Debug Logs**
- **Package:** All agent packages
- **Estimate:** 30 minutes
- **Dependencies:** 3.1-3.5
- **Priority:** Medium
- **Tasks:**
  - Search for `SESSION #36` markers → remove
  - Search for `SESSION #37` markers → remove
  - Search for `SESSION #47` markers → remove
  - Search for `PHASE-3` markers → remove
  - Remove debug console.log statements
  - Remove commented-out code with session references

**4.2 Remove Context Field Compatibility Wrappers**
- **Package:** All agent packages
- **Estimate:** 20 minutes
- **Dependencies:** 4.1
- **Priority:** Low
- **Tasks:**
  - Search for context field fallbacks: `task.context || envelope.context`
  - Remove dual-path parsing for context
  - Standardize on envelope.metadata or envelope.payload.context

**4.3 Update Documentation**
- **Package:** N/A (docs)
- **Estimate:** 10 minutes
- **Dependencies:** 4.2
- **Priority:** Medium
- **Tasks:**
  - Update CLAUDE.md Session #64 notes
  - Document schema unification approach
  - Add notes about ExecutionEnvelope as canonical schema
  - Update developer guide (if exists)

### Phase 5: Build and Test (1.5 hours)

**5.1 Build All Packages**
- **Package:** All packages
- **Estimate:** 10 minutes
- **Dependencies:** Phase 4 complete
- **Priority:** Critical
- **Tasks:**
  - Run: `turbo run build`
  - Verify zero TypeScript errors
  - Check build output for warnings
  - Document any build issues

**5.2 Run Unit Tests**
- **Package:** All packages
- **Estimate:** 20 minutes
- **Dependencies:** 5.1
- **Priority:** Critical
- **Tasks:**
  - Run: `turbo run test`
  - Fix failing tests related to schema changes
  - Update test fixtures to use ExecutionEnvelope
  - Verify all agent unit tests pass
  - Update mocks and stubs

**5.3 Run Type Checks**
- **Package:** All packages
- **Estimate:** 5 minutes
- **Dependencies:** 5.1
- **Priority:** High
- **Tasks:**
  - Run: `turbo run typecheck`
  - Verify zero type errors
  - Fix any type mismatches
  - Check for unused imports

**5.4 Start Services and Health Check**
- **Package:** N/A (PM2 operations)
- **Estimate:** 10 minutes
- **Dependencies:** 5.1-5.3
- **Priority:** Critical
- **Tasks:**
  - Rebuild packages with fresh build: `turbo run build --force`
  - Start services: `./scripts/env/start-dev.sh`
  - Verify all PM2 processes online: `pnpm pm2:status`
  - Check for crashloops
  - Run health checks: `./scripts/env/check-health.sh`

**5.5 E2E Pipeline Test**
- **Package:** N/A (integration test)
- **Estimate:** 30 minutes
- **Dependencies:** 5.4
- **Priority:** Critical
- **Tasks:**
  - Run: `./scripts/run-pipeline-test.sh "Hello World API"`
  - Monitor logs for "Invalid task assignment" errors
  - Verify workflow advances beyond 0%
  - Check scaffold agent task execution
  - Verify result publishing
  - Monitor orchestrator result receipt
  - Validate workflow state transitions

**5.6 Monitor for Regressions**
- **Package:** N/A (monitoring)
- **Estimate:** 15 minutes
- **Dependencies:** 5.5
- **Priority:** High
- **Tasks:**
  - Run: `pnpm pm2:logs --lines 200`
  - Search for ConcurrencyConflictError (should see retry logic working)
  - Search for schema validation errors (should be zero)
  - Check for unexpected errors
  - Verify trace logging still works
  - Monitor agent task completion

**5.7 Run Multiple Workflows**
- **Package:** N/A (stress test)
- **Estimate:** 10 minutes
- **Dependencies:** 5.5
- **Priority:** Medium
- **Tasks:**
  - Run 3-5 workflows concurrently
  - Verify no race conditions
  - Check CAS retry logic under load
  - Monitor resource usage
  - Validate all workflows complete successfully

### Phase 6: Documentation and Commit (30 minutes)

**6.1 Update CLAUDE.md**
- **Package:** N/A (docs)
- **Estimate:** 15 minutes
- **Dependencies:** Phase 5 complete
- **Priority:** High
- **Tasks:**
  - Add Session #64 completion summary
  - Document schema unification
  - List files modified
  - Update known issues (remove "Invalid task assignment")
  - Update next session priorities

**6.2 Create Commit**
- **Package:** N/A (git operation)
- **Estimate:** 10 minutes
- **Dependencies:** 6.1
- **Priority:** High
- **Tasks:**
  - Stage all changes: `git add .`
  - Create descriptive commit message
  - Reference Session #64 and Option A
  - List key changes (schema unification, 250 lines removed)
  - Include before/after comparison

**6.3 Final Validation**
- **Package:** All packages
- **Estimate:** 5 minutes
- **Dependencies:** 6.2
- **Priority:** Medium
- **Tasks:**
  - Verify all success criteria met
  - Check git status is clean
  - Review commit diff
  - Ensure no debug code committed
  - Verify build artifacts not committed

---

## Risk Matrix

| Risk | Probability | Impact | Mitigation Strategy |
|------|------------|--------|-------------------|
| **Breaking all agents simultaneously** | High | Critical | Feature branch + rollback script, thorough testing before merge |
| **Missing edge cases in envelope parsing** | Medium | High | Comprehensive unit tests, E2E validation, manual testing with various payloads |
| **TypeScript compilation errors** | Medium | Medium | Incremental builds after each phase, fix errors immediately |
| **Agent crashloops after deployment** | Low | High | Pre-deployment health checks, PM2 auto-restart, monitor logs closely |
| **Lost business logic during refactor** | Low | Critical | Careful code review, preserve all domain logic, only remove compatibility wrappers |
| **Trace context broken** | Medium | Medium | Test distributed tracing after changes, verify trace_id propagation |
| **Performance degradation** | Low | Medium | Monitor response times, check for added parsing overhead |
| **Concurrency issues resurface** | Medium | High | Already have retry logic (Session #64), monitor CAS conflicts |
| **Rollback needed mid-cleanup** | Low | High | Git feature branch allows clean revert, document rollback procedure |
| **Workflow stuck for different reason** | Medium | Medium | Comprehensive logging, trace message flow, have debugging runbook ready |
| **Schema evolution breaks again** | Low | Medium | Establish schema versioning policy, document canonical schema location |
| **Agent-specific payload validation fails** | Medium | Medium | Add payload schema validation in each agent, clear error messages |

### Risk Mitigation Details

**High-Risk Mitigations:**
1. **Feature Branch Isolation**: All changes on `fix/nuclear-cleanup-option-a`, can revert instantly
2. **Incremental Testing**: Test after each phase, not just at the end
3. **Rollback Script**: Pre-written script to restore previous state
4. **Backup State**: Database and logs backed up before starting
5. **PM2 Auto-Restart**: Services automatically restart on crash (limit 5 restarts)
6. **Health Monitoring**: Continuous health checks during testing

**Medium-Risk Mitigations:**
1. **Type Safety**: TypeScript catches most schema issues at compile time
2. **Unit Tests**: Each agent has unit tests for parsing logic
3. **E2E Validation**: Real workflow execution validates end-to-end
4. **Code Review**: Careful review of each agent's executeTask method
5. **Trace Logging**: `🔍 [AGENT-TRACE]` markers help debug message flow

---

## Testing Strategy

### Unit Tests (Vitest)

**Location:** `packages/agents/*/src/__tests__/*.test.ts`

**Test Cases to Add/Update:**

**BaseAgent Tests** (`packages/agents/base-agent/src/__tests__/base-agent.test.ts`)
```typescript
describe('BaseAgent - Schema Validation', () => {
  it('should validate ExecutionEnvelope successfully', () => {
    const envelope = {
      message_id: uuid(),
      task_id: uuid(),
      workflow_id: uuid(),
      agent_type: 'scaffold',
      payload: { name: 'test', description: 'test', requirements: ['req1'] },
      constraints: { timeout_ms: 300000, max_retries: 3, required_confidence: 80 },
      metadata: { created_at: new Date().toISOString(), created_by: 'test', trace_id: 'trace-123' }
    };

    const result = baseAgent.validateTask(envelope);
    expect(result).toEqual(envelope);
  });

  it('should reject invalid envelope structure', () => {
    const invalidEnvelope = {
      type: 'scaffold', // Wrong field name
      name: 'test',
      description: 'test'
    };

    expect(() => baseAgent.validateTask(invalidEnvelope)).toThrow('Invalid task assignment');
  });

  it('should reject envelope missing required fields', () => {
    const incompleteEnvelope = {
      task_id: uuid(),
      workflow_id: uuid()
      // Missing agent_type, payload, etc.
    };

    expect(() => baseAgent.validateTask(incompleteEnvelope)).toThrow();
  });

  it('should preserve trace context from envelope', () => {
    const envelope = createValidEnvelope({
      metadata: { trace_id: 'trace-456', span_id: 'span-789' }
    });

    const result = baseAgent.validateTask(envelope);
    expect(result.metadata.trace_id).toBe('trace-456');
  });
});
```

**Scaffold Agent Tests** (`packages/agents/scaffold-agent/src/__tests__/scaffold-agent.test.ts`)
```typescript
describe('ScaffoldAgent - Envelope Parsing', () => {
  it('should extract ScaffoldPayload from envelope', () => {
    const envelope = createValidEnvelope({
      agent_type: 'scaffold',
      payload: {
        name: 'my-app',
        description: 'Test app',
        requirements: ['Node.js', 'Express']
      }
    });

    const scaffoldTask = scaffoldAgent.parseTask(envelope);
    expect(scaffoldTask.payload.name).toBe('my-app');
    expect(scaffoldTask.payload.requirements).toHaveLength(2);
  });

  it('should handle array requirements correctly', () => {
    const envelope = createValidEnvelope({
      payload: {
        requirements: ['req1', 'req2', 'req3']
      }
    });

    const scaffoldTask = scaffoldAgent.parseTask(envelope);
    expect(Array.isArray(scaffoldTask.payload.requirements)).toBe(true);
    expect(scaffoldTask.payload.requirements).toEqual(['req1', 'req2', 'req3']);
  });

  it('should preserve trace_id through execution', async () => {
    const envelope = createValidEnvelope({
      metadata: { trace_id: 'trace-123' }
    });

    const result = await scaffoldAgent.executeTask(envelope);
    expect(result.trace_id).toBe('trace-123');
  });
});
```

**Expected Test Results:**
- [ ] All BaseAgent unit tests pass
- [ ] All ScaffoldAgent unit tests pass
- [ ] All ValidationAgent unit tests pass
- [ ] All E2EAgent unit tests pass
- [ ] All IntegrationAgent unit tests pass
- [ ] All DeploymentAgent unit tests pass
- [ ] Coverage: 90%+ on modified files

**Run Command:**
```bash
turbo run test
```

### Integration Tests

**Redis Message Bus Integration**
```typescript
describe('Message Bus - ExecutionEnvelope Integration', () => {
  it('should publish and receive ExecutionEnvelope correctly', async () => {
    const envelope = createValidEnvelope();

    await messageBus.publish('agent:scaffold:tasks', envelope);

    const received = await new Promise((resolve) => {
      messageBus.subscribe('agent:scaffold:tasks', (msg) => resolve(msg));
    });

    expect(received).toEqual(envelope);
  });

  it('should handle envelope serialization/deserialization', async () => {
    const envelope = createValidEnvelope({
      payload: { complex: { nested: { data: [1, 2, 3] } } }
    });

    await messageBus.publish('test:topic', envelope);
    const received = await consumeMessage('test:topic');

    expect(received.payload.complex.nested.data).toEqual([1, 2, 3]);
  });
});
```

**Orchestrator-Agent Communication**
```typescript
describe('Orchestrator → Agent → Orchestrator Flow', () => {
  it('should complete full message roundtrip', async () => {
    const workflow = await orchestrator.createWorkflow({
      type: 'app',
      name: 'test-workflow'
    });

    // Wait for scaffold agent to pick up task
    await waitFor(() => {
      const logs = getAgentLogs('scaffold');
      return logs.includes('Task received');
    });

    // Wait for result to return
    const updatedWorkflow = await waitFor(async () => {
      const wf = await orchestrator.getWorkflow(workflow.id);
      return wf.progress > 0 ? wf : null;
    });

    expect(updatedWorkflow.progress).toBeGreaterThan(0);
  });
});
```

**Expected Results:**
- [ ] Message bus correctly serializes ExecutionEnvelope
- [ ] Agents receive envelopes without corruption
- [ ] Full orchestrator → agent → orchestrator flow works
- [ ] No "Invalid task assignment" errors in integration tests

**Run Command:**
```bash
turbo run test
```

### End-to-End Tests

**Pipeline Test** (`./scripts/run-pipeline-test.sh`)

**Test Case 1: Simple Workflow**
```bash
./scripts/run-pipeline-test.sh "Hello World API"
```

**Expected Outcome:**
- [ ] Workflow created successfully
- [ ] Scaffold agent receives task (no "Invalid task assignment" error)
- [ ] Scaffold agent executes task
- [ ] Scaffold agent publishes result
- [ ] Orchestrator receives result
- [ ] Workflow advances to next stage (progress > 0%)
- [ ] No schema validation errors in logs
- [ ] Trace context preserved through execution

**Validation Steps:**
1. Monitor logs: `pnpm pm2:logs`
2. Search for errors: `pnpm pm2:logs | grep -i error`
3. Check workflow status: Query database for workflow progress
4. Verify agent task execution: Check agent logs for "Task received" and "Publishing result"
5. Confirm state transitions: Verify workflow moved from "initialization" to next stage

**Test Case 2: Concurrent Workflows**
```bash
./scripts/run-pipeline-test.sh "Test App 1" &
./scripts/run-pipeline-test.sh "Test App 2" &
./scripts/run-pipeline-test.sh "Test App 3" &
wait
```

**Expected Outcome:**
- [ ] All 3 workflows execute concurrently
- [ ] No race conditions
- [ ] CAS retry logic handles concurrent updates (may see `[SESSION #64 RETRY]` in logs - this is expected and correct)
- [ ] All workflows complete successfully
- [ ] No schema validation errors

**Test Case 3: Error Recovery**
```bash
# Simulate agent failure by stopping scaffold agent mid-execution
./scripts/run-pipeline-test.sh "Error Recovery Test"
# After 30s, kill scaffold agent
pnpm pm2:stop scaffold-agent
# Wait 30s
# Restart scaffold agent
pnpm pm2:start scaffold-agent
# Workflow should resume
```

**Expected Outcome:**
- [ ] Workflow survives agent restart
- [ ] Task gets reprocessed after agent restart
- [ ] No duplicate execution
- [ ] Workflow completes successfully

**E2E Test Checklist:**
- [ ] Single workflow completes end-to-end
- [ ] Concurrent workflows execute without conflicts
- [ ] Agent restart doesn't break workflows
- [ ] No "Invalid task assignment" errors in any scenario
- [ ] Trace context preserved across all operations
- [ ] State machine advances workflows correctly
- [ ] Results published and received successfully

### Build Validation

**Full Build Test:**
```bash
# Clean build from scratch
rm -rf packages/*/dist
turbo run build --force
```

**Expected Results:**
- [ ] All 12+ packages build successfully
- [ ] Zero TypeScript compilation errors
- [ ] Zero TypeScript type errors
- [ ] No circular dependency warnings
- [ ] Build completes in < 2 minutes (with cache)

**Type Check Test:**
```bash
turbo run typecheck
```

**Expected Results:**
- [ ] All packages pass type checking
- [ ] Zero type errors
- [ ] ExecutionEnvelope type properly exported
- [ ] No missing imports

**Lint Check:**
```bash
turbo run lint
```

**Expected Results:**
- [ ] Zero linting errors (if ESLint configured)
- [ ] Code formatting consistent
- [ ] No unused imports

### Performance Tests

**Baseline Metrics** (to verify no regression):
- Workflow creation: < 100ms
- Task dispatch: < 50ms
- Agent task receipt: < 200ms
- Schema validation: < 5ms
- End-to-end workflow: < 30 seconds

**Load Test:**
```bash
# Create 10 workflows simultaneously
for i in {1..10}; do
  ./scripts/run-pipeline-test.sh "Load Test $i" &
done
wait
```

**Expected Results:**
- [ ] All workflows complete successfully
- [ ] Response times within acceptable range
- [ ] No memory leaks
- [ ] PM2 processes remain stable
- [ ] Database connections don't exhaust

### Regression Tests

**Verify No Functionality Lost:**
- [ ] Distributed tracing still works (trace_id propagation)
- [ ] CAS retry logic still works (optimistic locking)
- [ ] Workflow state machine still advances correctly
- [ ] All agent types can execute tasks
- [ ] Result publishing still works
- [ ] Dashboard can still query workflows
- [ ] Health checks still pass

### Security Tests

**Schema Validation Security:**
```typescript
describe('Security - Schema Validation', () => {
  it('should reject malicious payloads', () => {
    const maliciousEnvelope = {
      task_id: uuid(),
      agent_type: 'scaffold',
      payload: {
        __proto__: { polluted: true },
        constructor: { prototype: { polluted: true } }
      }
    };

    expect(() => validateTask(maliciousEnvelope)).toThrow();
  });

  it('should sanitize user input in payload', () => {
    const envelope = createValidEnvelope({
      payload: {
        name: '<script>alert("xss")</script>',
        description: '../../etc/passwd'
      }
    });

    const sanitized = scaffoldAgent.parseTask(envelope);
    expect(sanitized.payload.name).not.toContain('<script>');
  });
});
```

**Expected Results:**
- [ ] Prototype pollution prevented
- [ ] XSS attempts sanitized
- [ ] Path traversal blocked
- [ ] Schema validation rejects malformed data

---

## Success Metrics

### Functional Success

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| **Schema Validation Errors** | Zero | Search logs for "Invalid task assignment" |
| **Workflow Completion Rate** | 100% | Run 10 test workflows, all complete |
| **Agent Task Execution** | 100% | All 5 agents execute tasks without validation failures |
| **Concurrent Workflow Success** | 100% | 5 concurrent workflows all complete |
| **Build Success** | 100% | `turbo run build` exits with code 0 |
| **Test Pass Rate** | 100% | All unit tests pass |
| **E2E Test Success** | 100% | Pipeline test completes successfully |

### Code Quality

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| **TypeScript Errors** | Zero | `turbo run typecheck` |
| **Lines of Code Removed** | 250+ | Git diff summary |
| **Backward Compatibility Code** | Zero | Manual code review |
| **Session Markers Remaining** | Zero | Search for `SESSION #36`, `#37`, `#47` |
| **Deprecated Files Deleted** | 2 | integration-agent/types.ts, deployment-agent/types.ts |
| **Code Duplication** | Zero duplicate schemas | Only 1 TaskAssignmentSchema exists |

### Performance

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| **Schema Validation Time** | < 5ms | Benchmark test |
| **Agent Startup Time** | < 5 seconds | PM2 logs |
| **Workflow Creation Time** | < 100ms | API response time |
| **End-to-End Workflow Time** | < 60 seconds | Pipeline test duration |
| **Memory Usage** | No increase | PM2 monit before/after |

### Reliability

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| **Agent Crashloop Rate** | Zero | PM2 restart count after 1 hour |
| **CAS Conflict Retry Success** | 100% | Monitor `[SESSION #64 RETRY]` logs |
| **Trace Context Preservation** | 100% | Verify trace_id in all agent logs |
| **Message Delivery Success** | 100% | No messages stuck in Redis streams |
| **Database Transaction Success** | 100% | No Prisma errors in logs |

---

## Dependencies

### External Dependencies
- **Prisma Client**: Database ORM (already installed)
- **Zod**: Schema validation (already installed)
- **Redis**: Message bus (running in Docker)
- **PostgreSQL**: Database (running in Docker)
- **PM2**: Process manager (already installed)
- **Turbo**: Monorepo build system (already installed)

### Internal Dependencies (Build Order)

```
@agentic-sdlc/shared-types
    ↓
@agentic-sdlc/shared-utils
    ↓
@agentic-sdlc/orchestrator
    ↓
@agentic-sdlc/agents/base-agent
    ↓
┌───────────┬───────────┬────────┬───────────┬───────────┐
│  scaffold │validation │  e2e   │integration│deployment │
└───────────┴───────────┴────────┴───────────┴───────────┘
```

**Build Strategy:**
1. Build shared-types first (exports canonical schema)
2. Build orchestrator (uses shared-types)
3. Build base-agent (depends on shared-types)
4. Build all concrete agents (depend on base-agent)

**Turbo handles this automatically via `turbo run build`**

### Blockers

| Blocker | Impact | Resolution |
|---------|--------|------------|
| None identified | N/A | No external blockers |

---

## Rollout Plan

### Phase 1: Development (This Session)
- Implement all changes on feature branch
- Test locally with PM2 dev environment
- Validate E2E with test workflows
- Fix any issues discovered
- Complete all success criteria

### Phase 2: Validation (Before Commit)
- Run full test suite 3 times to verify consistency
- Test with various workflow types (app, feature, bugfix)
- Monitor for 1 hour under normal load
- Review all code changes for quality
- Ensure no debug code or TODOs remain

### Phase 3: Commit (End of Session)
- Create detailed commit message
- Update CLAUDE.md with Session #64 completion
- Document lessons learned
- Mark all success criteria as met

### Phase 4: Future Sessions
- Consider implementing strategic BaseAgent refactor (15-20 hours, see EPCC_EXPLORE.md)
- Add idempotency layer (2-3 hours)
- Add prompt auditing (2-3 hours)
- Implement message deduplication (1-2 hours)

### Rollback Procedure

**If something goes wrong during implementation:**

1. **Immediate Rollback:**
   ```bash
   git checkout main
   ./scripts/env/stop-dev.sh
   turbo run build
   ./scripts/env/start-dev.sh
   ```

2. **Partial Rollback (revert specific commits):**
   ```bash
   git log --oneline  # Find commit SHA
   git revert <commit-sha>
   turbo run build
   ./scripts/env/start-dev.sh
   ```

3. **Emergency Rollback (nuclear option):**
   ```bash
   git reset --hard HEAD~1  # Go back 1 commit
   git clean -fd            # Remove untracked files
   turbo run build --force
   ./scripts/env/start-dev.sh
   ```

4. **Verify Rollback Success:**
   ```bash
   pnpm pm2:status  # All processes online
   ./scripts/run-pipeline-test.sh "Rollback Verification Test"
   # Workflow should complete (even if with "Invalid task assignment" error)
   ```

---

## Implementation Checklist

Before proceeding to CODE phase, verify:

### Planning Complete
- [x] Objectives clearly defined
- [x] Technical approach thoroughly designed
- [x] All tasks broken down with estimates (6-8 hours total)
- [x] Dependencies identified (build order documented)
- [x] Risks assessed with mitigation strategies (12 risks documented)
- [x] Test strategy comprehensive (unit, integration, E2E, security)
- [x] Success criteria measurable (functional, quality, performance, reliability)
- [x] Documentation plan created (CLAUDE.md, commit message)
- [x] Timeline realistic (6 phases over 6-8 hours)
- [x] Resources available (all tools installed, services running)
- [x] Rollback plan documented (4-step procedure)

### Stakeholder Alignment
- [ ] User confirmed Option A (Nuclear Cleanup) is preferred approach
- [ ] User understands this is breaking change (all agents updated simultaneously)
- [ ] User aware of 6-8 hour time commitment
- [ ] User ready to proceed to CODE phase

### Environment Ready
- [x] Feature branch strategy planned
- [x] Backup procedure documented
- [x] Build validation steps defined
- [x] Test cases documented
- [x] Rollback procedure ready

---

## Next Steps

**Ready for CODE Phase!**

Once user confirms approval of this plan:

1. **User Action Required:**
   - Review this plan (EPCC_PLAN.md)
   - Confirm Option A (Nuclear Cleanup) is still desired approach
   - Approve proceeding to CODE phase
   - Provide any feedback or adjustments

2. **After User Approval:**
   - Transition to `/epcc-code` command
   - Begin Phase 1: Preparation
   - Follow task breakdown exactly as documented
   - Update todo list with progress
   - Commit when all success criteria met

3. **During CODE Phase:**
   - Execute tasks in order (no skipping)
   - Test after each phase (not just at end)
   - Monitor for issues continuously
   - Document any deviations from plan
   - Use rollback procedure if needed

4. **After CODE Phase:**
   - Run `/epcc-commit` to create commit
   - Update CLAUDE.md with Session #64 completion
   - Mark Session #64 as complete
   - Plan next session priorities

---

## Appendix: Key Code Patterns

### Before (Broken)

**Base Agent - Duplicate Schema:**
```typescript
// packages/agents/base-agent/src/types.ts (LINES 19-31 - DELETE THIS)
export const TaskAssignmentSchema = z.object({
  task_id: z.string().uuid(),
  workflow_id: z.string().uuid(),
  type: z.string(),  // ❌ Wrong field name
  name: z.string(),  // ❌ Expects at root
  description: z.string(),
  requirements: z.string(),  // ❌ Expects string, not array
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  context: z.record(z.unknown()).optional(),
  deadline: z.string().optional()
});
```

**Base Agent - Wrong Validation:**
```typescript
// packages/agents/base-agent/src/base-agent.ts (LINE 287 - UPDATE THIS)
validateTask(task: unknown): TaskAssignment {
  try {
    return TaskAssignmentSchema.parse(task);  // ❌ Wrong schema!
  } catch (error) {
    throw new ValidationError('Invalid task assignment', ...);
  }
}
```

**Scaffold Agent - Manual Envelope Unwrapping:**
```typescript
// packages/agents/scaffold-agent/src/scaffold-agent.ts (LINES 70-100 - SIMPLIFY THIS)
// SESSION #37: Use envelope payload directly
const envelope = task as any;
const scaffoldTask: ScaffoldTask = {
  task_id: task.task_id as any,
  workflow_id: task.workflow_id as any,
  payload: {
    project_type: envelope.payload?.project_type || 'app',
    name: envelope.payload?.name || task.name || 'untitled',  // ❌ Messy fallbacks
    description: envelope.payload?.description || task.description || '',
    requirements: Array.isArray(envelope.payload?.requirements)
      ? envelope.payload.requirements
      : (task.requirements || '').split('. ')  // ❌ String vs array confusion
  }
};
```

### After (Fixed)

**Shared Types - Canonical Schema:**
```typescript
// packages/shared/types/src/index.ts (ADD EXPORTS)
export {
  ExecutionEnvelopeSchema,
  ExecutionEnvelope,
  TaskAssignmentSchema,  // Re-export from orchestrator
  TaskAssignment
} from '@agentic-sdlc/orchestrator/types';
```

**Base Agent - Correct Validation:**
```typescript
// packages/agents/base-agent/src/base-agent.ts (UPDATE)
import { ExecutionEnvelopeSchema, ExecutionEnvelope } from '@agentic-sdlc/shared-types';

/**
 * Validates incoming task envelope against canonical schema.
 * @param task - Raw task data from message bus
 * @returns Validated ExecutionEnvelope
 * @throws ValidationError if schema validation fails
 */
validateTask(task: unknown): ExecutionEnvelope {
  try {
    return ExecutionEnvelopeSchema.parse(task);  // ✅ Correct schema!
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(
        'Invalid task envelope',
        error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      );
    }
    throw new ValidationError('Invalid task assignment', [String(error)]);
  }
}
```

**Scaffold Agent - Clean Envelope Parsing:**
```typescript
// packages/agents/scaffold-agent/src/scaffold-agent.ts (SIMPLIFY)
import { ExecutionEnvelope } from '@agentic-sdlc/shared-types';

async executeTask(envelope: ExecutionEnvelope): Promise<AgentResult> {
  // ✅ Clean extraction from envelope.payload
  const scaffoldPayload = envelope.payload as ScaffoldPayload;

  const scaffoldTask: ScaffoldTask = {
    task_id: envelope.task_id,
    workflow_id: envelope.workflow_id,
    payload: {
      project_type: scaffoldPayload.project_type || 'app',
      name: scaffoldPayload.name,  // ✅ No fallbacks needed
      description: scaffoldPayload.description,
      requirements: scaffoldPayload.requirements  // ✅ Already an array
    }
  };

  // Execute business logic...
  const result = await this.scaffoldProject(scaffoldTask);

  return {
    task_id: envelope.task_id,
    workflow_id: envelope.workflow_id,
    trace_id: envelope.metadata.trace_id,  // ✅ Trace context preserved
    status: 'success',
    result
  };
}
```

**Key Improvements:**
1. ✅ Single source of truth for schema (orchestrator types)
2. ✅ Type-safe envelope parsing
3. ✅ No backward compatibility fallbacks
4. ✅ Clean separation: envelope structure vs. domain payload
5. ✅ Trace context preserved automatically
6. ✅ Clear error messages on validation failure

---

## Summary

This plan provides a comprehensive, executable strategy for **Option A: Nuclear Cleanup** to:

1. **Fix Critical Blocker:** Eliminate "Invalid task assignment" errors blocking all workflows
2. **Unify Architecture:** Single canonical schema (ExecutionEnvelope) across all components
3. **Remove Legacy Code:** Clean up 250+ lines of backward compatibility code
4. **Improve Maintainability:** Clear architectural boundaries, no duplication
5. **Validate Thoroughly:** Comprehensive testing strategy (unit, integration, E2E, security)

**Estimated Time:** 6-8 hours
**Risk Level:** Medium-High (mitigated by feature branch, rollback plan, incremental testing)
**Expected Outcome:** All workflows execute successfully, clean codebase, production-ready system

**Ready to proceed to CODE phase upon user approval.**
