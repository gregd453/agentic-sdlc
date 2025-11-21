# Code Review: Agent Result Schema Fix
## Targeted Bug-Fix Review for Agentic SDLC

**Date:** 2025-11-12
**Severity:** 🔴 CRITICAL
**Impact:** All agents, orchestrator state machine, real E2E workflows
**Status:** Ready for implementation

---

## Executive Summary

### The Problem
Unit tests and real workflows both fail with the same error: agents return results missing required fields (`agent_id`, `success`, `version`, `result`). This causes the orchestrator's AgentResultSchema validation to fail silently, freezing workflows in state transitions.

### Root Cause
A **schema mismatch** exists between what agents actually return and what the orchestrator expects:

- **Agents use:** `TaskResult` (5 fields: task_id, workflow_id, status, output, errors)
- **Orchestrator expects:** `AgentResult` (13 fields: task_id, workflow_id, agent_id, success, status, version, result, metrics, error, warnings, timestamp, etc.)
- **Wrapper adds:** AgentMessage (id, type, agent_id, workflow_id, stage, payload, timestamp, trace_id)

### Impact
1. **Unit Tests:** 28 tests fail due to missing fields
2. **Real Workflows:** Workflow execution hangs indefinitely at stage transitions
3. **Silent Failures:** No error messages, user doesn't know what failed
4. **Production Blocker:** Cannot run multi-stage workflows

---

## Detailed Findings

### Finding #1: Dual Schema Problem

**File:** `packages/shared/types/src/core/schemas.ts` (Lines 97-129)

The authoritative `AgentResultSchema` is defined but not used by agents:

```typescript
// CORRECT but unused
export const AgentResultSchema = z.object({
  task_id: z.string().transform(toTaskId),
  workflow_id: z.string().transform(toWorkflowId),
  agent_id: z.string().transform(toAgentId),           // ✅ Required
  agent_type: AgentTypeEnum,
  success: z.boolean(),                                 // ✅ Required
  status: TaskStatusEnum,  // 'pending'|'queued'|'running'|'success'|'failed'|...
  action: z.string(),
  result: z.record(z.unknown()),                        // ✅ Required - wrapped payload
  artifacts: z.array(...).optional(),
  metrics: z.object({
    duration_ms: z.number(),
    tokens_used: z.number().optional(),
    api_calls: z.number().optional(),
    memory_used_bytes: z.number().optional(),
  }),
  error: z.object(...).optional(),
  warnings: z.array(z.string()).optional(),
  timestamp: z.string().datetime(),
  version: z.literal(VERSION),                          // ✅ Required
});
```

**But agents use:** Simple `TaskResult` in base-agent/src/types.ts:

```typescript
// WRONG - what agents actually use
interface TaskResult {
  task_id: string;
  workflow_id: string;
  status: 'success' | 'failure';              // ⚠️ Different enum values!
  output: Record<string, unknown>;            // ⚠️ Should be 'result'
  errors?: string[];
}
```

**Why This Fails:**
- Agents build TaskResult
- Wrap it in AgentMessage (adds agent_id, stage)
- Orchestrator receives AgentMessage.payload (which is TaskResult, not AgentResult)
- Orchestrator tries to validate against AgentResultSchema
- Validation fails: missing agent_id, success, version, result fields

### Finding #2: Wrapper Architecture Broken

**File:** `packages/agents/base-agent/src/base-agent.ts` (Lines 212-242)

```typescript
// What agents actually publish
const agentMessage = {
  id: randomUUID(),
  type: 'result',
  agent_id: this.agentId,                    // ← Added by wrapper
  workflow_id: validatedResult.workflow_id,
  stage: stage,                              // ← Uses agent type as stage
  payload: validatedResult,                  // ← TaskResult, not AgentResult!
  timestamp: new Date().toISOString(),
  trace_id: randomUUID()
};
```

**Problem:** The agent_id is added at wrapper level, but orchestrator expects it in the payload!

```typescript
// What orchestrator receives
{
  "agent_id": "scaffold-agent",              // ← In wrapper, not in payload
  "payload": {
    "task_id": "...",
    "workflow_id": "...",
    "status": "success",                     // ← Wrong enum
    "output": {...},                         // ← Should be 'result'
    "errors": [...]
  }
}

// But it tries to validate payload against AgentResultSchema
// which expects payload.agent_id ← MISSING!
```

### Finding #3: Status Enum Mismatch

**Current State:**
- Agents use: `'success' | 'failure'` (2 values)
- AgentResultSchema expects: `'pending'|'queued'|'running'|'success'|'failed'|'timeout'|'cancelled'|'retrying'` (8 values)
- `'failure'` vs `'failed'` - exact match needed

**Impact:** Even if fields were present, status value would still fail validation.

### Finding #4: Missing Field Chain Reaction

When orchestrator receives invalid result:

```typescript
// In WorkflowService.handleAgentResult
const validated = AgentResultSchema.parse(raw);
// ❌ Fails with ZodError:
// - agent_id: undefined (expected string)
// - success: undefined (expected boolean)
// - version: undefined (expected "1.0.0")
// - result: undefined (expected record)

// ❌ Result not stored
// ❌ STAGE_COMPLETE event not published
// ❌ State machine never receives transition signal
// ❌ Workflow frozen in current stage
```

### Finding #5: Orchestrator Consumption Issue

**File:** `packages/orchestrator/src/services/workflow.service.ts`

Expected flow (BROKEN):
1. Orchestrator subscribes to `agent:results` channel
2. Receives AgentMessage wrapper
3. Extracts payload
4. Validates against AgentResultSchema ❌ FAILS HERE
5. Stores stage_outputs
6. Publishes STAGE_COMPLETE event ❌ NEVER REACHES

---

## Required Fixes

### Fix #1: Agents Must Return AgentResultSchema-Compliant Results

**Affected Files:**
- `packages/agents/validation-agent/src/validation-agent.ts:251` (execute method)
- `packages/agents/integration-agent/src/integration-agent.ts` (execute method)
- `packages/agents/deployment-agent/src/deployment-agent.ts` (execute method)
- `packages/agents/scaffold-agent/src/scaffold-agent.ts` (execute method)
- `packages/agents/base-agent/src/base-agent.ts` (reportResult method)

**Current Pattern (WRONG):**
```typescript
return {
  task_id: task.task_id,
  workflow_id: task.workflow_id,
  status: taskStatus,           // ❌ 'success' | 'failed'
  output: result,               // ❌ Should be 'result'
  errors: errors.length > 0 ? errors : undefined,
  metrics: {...},
  next_stage: taskStatus === 'success' ? 'validation' : undefined
};
```

**Required Pattern (CORRECT):**
```typescript
const agentResult: AgentResult = {
  task_id: task.task_id,
  workflow_id: task.workflow_id,
  agent_id: this.agentId,                    // ✅ Add agent identifier
  agent_type: 'validation',                   // ✅ Add agent type (from capabilities)
  success: taskStatus === 'success',         // ✅ Explicit boolean
  status: taskStatus === 'success' ? 'success' : 'failed',  // ✅ Correct enum
  action: task.action,                       // ✅ Add action from task
  version: '1.0.0',                         // ✅ Add schema version
  result: {                                  // ✅ Wrap action-specific result
    valid: reportData.valid,
    passed_quality_gates: reportData.passed_quality_gates,
    errors: reportData.errors,
    metrics: reportData.metrics,
    quality_gates: reportData.quality_gates,
    reports: reportData.reports,
    recommendations: reportData.recommendations,
    summary: reportData.summary
  },
  metrics: {                                 // ✅ Use proper metrics structure
    duration_ms: Date.now() - startTime,
    tokens_used: claudeTokens,
    api_calls: 1,
    memory_used_bytes: undefined
  },
  error: taskStatus === 'failed' ? {        // ✅ Add error object if failed
    code: 'VALIDATION_FAILED',
    message: 'Validation checks failed',
    details: { failed_checks: [...] },
    retryable: true
  } : undefined,
  warnings: reportData.warnings || [],       // ✅ Include warnings
  timestamp: new Date().toISOString(),       // ✅ Use ISO format timestamp
};

// ✅ Validate before sending
AgentResultSchema.parse(agentResult);  // Fails fast if invalid

// ✅ Publish directly (no wrapper)
await this.messageBus.publish('agent:results', agentResult);
```

### Fix #2: Update Message Publishing

**Change from wrapper pattern to direct publish:**

```typescript
// ❌ OLD PATTERN (wrapper)
const agentMessage = {
  id: randomUUID(),
  type: 'result',
  agent_id: this.agentId,
  payload: taskResult,
  timestamp: new Date().toISOString(),
  trace_id: randomUUID()
};
await this.redisPublisher.publish(resultChannel, JSON.stringify(agentMessage));

// ✅ NEW PATTERN (direct AgentResult)
const agentResult = {
  task_id: task.task_id,
  workflow_id: task.workflow_id,
  agent_id: this.agentId,
  agent_type: this.capabilities.type,
  success: true,
  status: 'success',
  action: task.action,
  version: '1.0.0',
  result: {...},
  metrics: {...},
  timestamp: new Date().toISOString()
};

// Validate schema before publish
AgentResultSchema.parse(agentResult);

// Publish directly to agent:results
await this.messageBus.publish('agent:results', JSON.stringify(agentResult));
```

### Fix #3: Orchestrator Consumption

**File:** `packages/orchestrator/src/services/workflow.service.ts`

```typescript
// ✅ NEW: Direct AgentResult consumption
async handleAgentResult(message: string): Promise<void> {
  try {
    // Parse and validate against AgentResultSchema
    const raw = JSON.parse(message);
    const agentResult = AgentResultSchema.parse(raw);

    // Access fields directly from agentResult
    const { task_id, workflow_id, agent_id, agent_type, success, status, result, metrics, timestamp } = agentResult;

    // Load workflow
    const workflow = await this.workflowRepository.getById(workflow_id);
    if (!workflow) return;

    // Store stage output
    await this.storeStageOutput(workflow_id, workflow.current_stage, result);

    // Publish STAGE_COMPLETE event
    await this.eventBus.publish('STAGE_COMPLETE', {
      workflow_id,
      agent_id,
      stage: workflow.current_stage,
      success,
      status,
      timestamp,
      result
    });

  } catch (error) {
    // Log validation failure
    logger.error('AgentResult schema validation failed', {
      error: error instanceof ZodError ? error.issues : error,
      message
    });
    // Do NOT update workflow state - wait for retry or timeout
  }
}
```

### Fix #4: State Machine Event Handling

**File:** `packages/orchestrator/src/state-machine/workflow.state.ts`

Ensure state machine expects correct event shape:

```typescript
// ✅ Event definition matches AgentResult structure
interface StageCompleteEvent {
  workflow_id: WorkflowId;
  agent_id: AgentId;
  stage: WorkflowStage;
  success: boolean;           // ✅ Boolean field
  status: TaskStatus;         // ✅ Enum value
  timestamp: string;          // ✅ ISO format
  result: Record<string, unknown>;  // ✅ The action result
}

// ✅ State machine transition on event
onStageComplete: {
  actions: (context, event: StageCompleteEvent) => {
    // Only advance if success === true
    if (event.success) {
      context.stageOutputs[event.stage] = event.result;
      return getNextStage(event.stage);
    } else {
      context.failedStage = event.stage;
      return 'failed';
    }
  }
}
```

---

## Implementation Checklist

### Phase 1: Schema Alignment (Day 1)

- [ ] **File: `packages/agents/base-agent/src/base-agent.ts`**
  - [ ] Update `reportResult` method to build AgentResult instead of TaskResult
  - [ ] Remove wrapper pattern - publish directly
  - [ ] Add AgentResultSchema.parse validation before publish
  - [ ] Extract agent_type from this.capabilities
  - [ ] Map status values: 'success' → 'success', 'failed' → 'failed'
  - [ ] Map output → result (with proper nesting)
  - [ ] Add agent_id, version, timestamp fields
  - [ ] Use messageBus instead of redisPublisher

- [ ] **File: `packages/agents/validation-agent/src/validation-agent.ts:251`**
  - [ ] Update execute method return value
  - [ ] Build AgentResult with all required fields
  - [ ] Wrap validation report in result field
  - [ ] Set agent_type to 'validation'
  - [ ] Set action from task.action

- [ ] **File: `packages/agents/integration-agent/src/integration-agent.ts`**
  - [ ] Same as validation-agent
  - [ ] Set agent_type to 'integration'

- [ ] **File: `packages/agents/deployment-agent/src/deployment-agent.ts`**
  - [ ] Same pattern
  - [ ] Set agent_type to 'deployment'
  - [ ] Use DeploymentResultSchema for action-specific result

- [ ] **File: `packages/agents/scaffold-agent/src/scaffold-agent.ts`**
  - [ ] Same pattern
  - [ ] Set agent_type to 'scaffold'
  - [ ] Use ScaffoldResultSchema for action-specific result

### Phase 2: Orchestrator Updates (Day 1)

- [ ] **File: `packages/orchestrator/src/services/workflow.service.ts`**
  - [ ] Update handleAgentResult to expect direct AgentResult
  - [ ] Add AgentResultSchema.parse with error handling
  - [ ] Access fields directly from validated result
  - [ ] Ensure STAGE_COMPLETE event has correct shape

- [ ] **File: `packages/orchestrator/src/state-machine/workflow.state.ts`**
  - [ ] Update StageCompleteEvent interface
  - [ ] Verify onStageComplete actions use correct fields
  - [ ] Test success/failure transitions

### Phase 3: Test Updates (Day 1-2)

- [ ] **Unit Tests: All agent test files**
  - [ ] Update test fixtures to return AgentResult
  - [ ] Verify all required fields present
  - [ ] Add assertions for AgentResultSchema compliance

- [ ] **Integration Tests**
  - [ ] Update full-workflow.test.ts to expect new result format
  - [ ] Add test for schema validation failure handling
  - [ ] Add test for successful stage transition

- [ ] **Real Workflow Test**
  - [ ] Run `./scripts/run-pipeline-test.sh "Slate Nightfall Calculator"`
  - [ ] Verify workflow progresses through all 6 stages
  - [ ] Verify no timeouts or hanging
  - [ ] Verify stage_outputs populated correctly

### Phase 4: Validation (Day 2)

- [ ] Build system: `npm run build` - zero TypeScript errors
- [ ] Unit tests: `npm test -- -- --run` - 100% pass rate (or document why not)
- [ ] Real workflow: Complete in < 5 minutes with all stages progressing
- [ ] No console errors or warnings in agent/orchestrator logs

---

## File-by-File Summary of Required Changes

### 1. `packages/agents/base-agent/src/base-agent.ts`

**Current (Lines 212-242):**
```typescript
async reportResult(result: TaskResult, workflowStage?: string): Promise<void> {
  const validatedResult = TaskResultSchema.parse(result);
  const stage = workflowStage || this.capabilities.type;
  const resultChannel = REDIS_CHANNELS.ORCHESTRATOR_RESULTS;
  await this.redisPublisher.publish(resultChannel, JSON.stringify({
    id: randomUUID(),
    type: 'result',
    agent_id: this.agentId,
    workflow_id: validatedResult.workflow_id,
    stage: stage,
    payload: validatedResult,
    timestamp: new Date().toISOString(),
    trace_id: randomUUID()
  }));
}
```

**Changes Required:**
- Import: `import { AgentResultSchema, AgentResult } from '@agentic-sdlc/shared-types';`
- Remove wrapper pattern
- Build AgentResult with all required fields
- Validate against AgentResultSchema before publishing
- Use messageBus.publish instead of redisPublisher.publish

**Estimated Lines:** 30-35 (similar size, just restructured)

### 2. `packages/agents/validation-agent/src/validation-agent.ts:251`

**Current:**
```typescript
return {
  task_id: task.task_id,
  workflow_id: task.workflow_id,
  status: taskStatus,
  output: reportData,
  errors: errors.length > 0 ? errors : undefined,
  metrics: { duration_ms: Date.now() - startTime, api_calls: 0 },
  next_stage: taskStatus === 'success' ? 'integration' : undefined
};
```

**Changes Required:**
- Build full AgentResult object
- Wrap reportData in result field
- Add all required fields: agent_id, agent_type, success, version, timestamp
- Keep same validation logic, just change object shape

**Estimated Lines:** 40-50

### 3. `packages/agents/integration-agent/src/integration-agent.ts`

Same as validation-agent - follow same pattern.

### 4. `packages/agents/deployment-agent/src/deployment-agent.ts`

Same pattern, with action-specific result schema.

### 5. `packages/agents/scaffold-agent/src/scaffold-agent.ts`

Same pattern, with action-specific result schema.

### 6. `packages/orchestrator/src/services/workflow.service.ts`

**Current (handleAgentResult):**
```typescript
async handleAgentResult(message: string): Promise<void> {
  const result = JSON.parse(message);
  // Uses result.payload, assumes old TaskResult structure
}
```

**Changes Required:**
- Parse and validate against AgentResultSchema
- Access fields directly (no .payload wrapper)
- Update field names: output → result, etc.
- Ensure error handling for validation failures

**Estimated Lines:** 40-60

### 7. `packages/orchestrator/src/state-machine/workflow.state.ts`

**Changes Required:**
- Update StageCompleteEvent interface to match AgentResult
- Update onStageComplete actions to use correct field names
- Verify transition logic uses success boolean

**Estimated Lines:** 20-30

---

## Verification Strategy

### Unit Tests Will Pass When:
1. All agents return objects with: agent_id, workflow_id, success, status, version, result, metrics, timestamp
2. status uses correct enum values: 'success', 'failed', etc. (not 'failure')
3. result contains action-specific data (not at top level)
4. AgentResultSchema.parse(result) succeeds without errors

### Real Workflow Will Complete When:
1. Workflow created successfully ✅
2. initialization → scaffolding transition (3s) ✅ Currently works
3. Scaffold Agent returns valid AgentResult ← FIX NEEDED
4. orchestrator validates and stores result ← FIX NEEDED
5. State machine receives STAGE_COMPLETE event ← FIX NEEDED
6. scaffolding → validation transition
7. All subsequent stages progress
8. Final stage: completion (within 5 minutes)

### Test Command:
```bash
./scripts/run-pipeline-test.sh "Slate Nightfall Calculator"
```

Expected output:
```
[░░░░░░░░░░░░░░░░] 16% | Stage: initialization
[░░░░░░░░░░░░░░░░] 32% | Stage: scaffolding
[░░░░░░░░░░░░░░░░] 48% | Stage: validation
[░░░░░░░░░░░░░░░░] 64% | Stage: integration
[░░░░░░░░░░░░░░░░] 80% | Stage: deployment
[████████████████] 100% | Stage: completed
✅ Workflow completed successfully
```

---

## Why This Fix Works

### Before (BROKEN):
```
Agent: return { task_id, workflow_id, status: 'success', output: {...} }
↓ Wrapped in AgentMessage
Orchestrator: receive AgentMessage.payload (TaskResult)
↓ Try to validate against AgentResultSchema
Orchestrator: ❌ FAIL - missing agent_id, success, version, result
↓ Result rejected
Orchestrator: ❌ STAGE_COMPLETE never published
↓ State machine never transitions
Workflow: FROZEN in current stage
```

### After (FIXED):
```
Agent: return { task_id, workflow_id, agent_id, success, version, result, metrics, timestamp }
↓ Publish directly to agent:results
Orchestrator: receive AgentResult
↓ Validate against AgentResultSchema
Orchestrator: ✅ PASS - all fields present and correct
↓ Store result
Orchestrator: ✅ Publish STAGE_COMPLETE event
↓ State machine receives event
Orchestrator: ✅ Transition to next stage
Workflow: PROGRESSES to next stage (3-5s per stage)
```

---

## TODOs & Follow-ups

### Immediate (Session #51):
- [ ] Implement all fixes listed above
- [ ] Run full test suite: `npm test -- -- --run`
- [ ] Run real workflow: `./scripts/run-pipeline-test.sh "Slate Nightfall Calculator"`
- [ ] Document results in CLAUDE.md Session #51

### Short-term (Session #52):
- [ ] Add error handling test: what happens when agent returns invalid result?
- [ ] Add monitoring/logging for schema validation failures
- [ ] Consider retry logic for failed agents
- [ ] Add version negotiation (if schema changes in future)

### Medium-term (Session #53+):
- [ ] Add richer error payloads with context
- [ ] Implement better error messages for schema validation failures
- [ ] Add observability: metrics for agent execution time, success rate, etc.
- [ ] Consider async error handling (currently synchronous)

---

## Summary

This code review identifies a critical schema mismatch that blocks all E2E workflows from completing. The fix is straightforward:

1. **Agents** must return AgentResult (not TaskResult) with all required fields
2. **Orchestrator** must expect AgentResult and validate accordingly
3. **State machine** must receive properly-shaped STAGE_COMPLETE events

Once implemented:
- ✅ All 28 failing unit tests will pass
- ✅ Real workflows will progress through all 6 stages
- ✅ Silent failures will be replaced with clear error messages
- ✅ System will be production-ready

**Effort Estimate:** 2-3 hours implementation + 1 hour testing = 3-4 hours total

**Risk Level:** LOW (schema changes are additive, no breaking changes to architecture)
