# Session #51: Implementation Guide - Agent Schema Fix

**Objective:** Fix critical schema mismatch blocking all E2E workflows
**Status:** Ready to implement
**Estimated Time:** 3-4 hours
**Priority:** 🔴 CRITICAL - Blocking all workflow tests

---

## Quick Start: 5-Step Implementation Plan

### Step 1: Update BaseAgent (30 minutes)

**File:** `packages/agents/base-agent/src/base-agent.ts`

Change the `reportResult` method to return AgentResult instead of TaskResult:

```typescript
// BEFORE (lines 212-242)
async reportResult(result: TaskResult, workflowStage?: string): Promise<void> {
  const validatedResult = TaskResultSchema.parse(result);
  // ... wrapper pattern with AgentMessage
}

// AFTER
async reportResult(result: TaskResult, workflowStage?: string): Promise<void> {
  // Convert TaskResult to AgentResult
  const agentResult: AgentResult = {
    task_id: result.task_id,
    workflow_id: result.workflow_id,
    agent_id: this.agentId,
    agent_type: this.capabilities.type as AgentType,
    success: result.status === 'success',
    status: result.status === 'success' ? 'success' : 'failed',
    action: '', // Will be overridden by subclasses
    version: '1.0.0',
    result: result.output || {},
    metrics: {
      duration_ms: 0,  // Will be overridden by subclasses
      tokens_used: 0,
      api_calls: 0,
    },
    timestamp: new Date().toISOString(),
  };

  // Validate
  AgentResultSchema.parse(agentResult);

  // Publish directly
  await this.messageBus.publish('agent:results', JSON.stringify(agentResult));
}
```

**Imports needed:**
```typescript
import { AgentResultSchema, AgentResult, AgentType } from '@agentic-sdlc/shared-types';
```

---

### Step 2: Update ValidationAgent (30 minutes)

**File:** `packages/agents/validation-agent/src/validation-agent.ts` (line ~251)

In the `execute` method, change the return statement:

```typescript
// BEFORE (wrong structure)
return {
  task_id: task.task_id,
  workflow_id: task.workflow_id,
  status: taskStatus,
  output: reportData,
  errors: errors.length > 0 ? errors : undefined,
  metrics: { duration_ms: Date.now() - startTime, api_calls: 0 },
  next_stage: taskStatus === 'success' ? 'integration' : undefined
};

// AFTER (correct AgentResult)
const agentResult = {
  task_id: task.task_id,
  workflow_id: task.workflow_id,
  agent_id: this.agentId,
  agent_type: 'validation' as const,
  success: taskStatus === 'success',
  status: taskStatus === 'success' ? 'success' as const : 'failed' as const,
  action: task.action || 'validate_code',
  version: '1.0.0' as const,
  result: {
    valid: reportData.valid,
    passed_quality_gates: reportData.passed_quality_gates,
    errors: reportData.errors,
    metrics: reportData.metrics,
    quality_gates: reportData.quality_gates,
    reports: reportData.reports,
    recommendations: reportData.recommendations,
    summary: reportData.summary,
  },
  metrics: {
    duration_ms: Date.now() - startTime,
    api_calls: 0,
  },
  timestamp: new Date().toISOString(),
  ...(taskStatus !== 'success' && errors.length > 0 ? {
    error: {
      code: 'VALIDATION_FAILED',
      message: 'Validation checks failed',
      details: { errors },
      retryable: true,
    }
  } : {}),
};

await this.reportResult(agentResult as any);
return agentResult;
```

---

### Step 3: Update IntegrationAgent (30 minutes)

**File:** `packages/agents/integration-agent/src/integration-agent.ts`

Same pattern as ValidationAgent, just adapt for integration result structure.

---

### Step 4: Update DeploymentAgent (30 minutes)

**File:** `packages/agents/deployment-agent/src/deployment-agent.ts`

Same pattern as ValidationAgent, adapt for deployment result structure.

---

### Step 5: Update ScaffoldAgent (30 minutes)

**File:** `packages/agents/scaffold-agent/src/scaffold-agent.ts`

Same pattern as ValidationAgent, adapt for scaffold result structure.

---

## Testing Checklist

After implementation, run these in order:

### Test 1: TypeScript Build (5 minutes)
```bash
npm run build
# ✅ Should pass with zero errors
```

### Test 2: Unit Tests (10 minutes)
```bash
npm test -- -- --run
# ✅ Should show:
# - validation-agent: 28 tests passing (currently 7 failing)
# - integration-agent: 35 tests passing (currently 4 failing)
# - deployment-agent: 6 tests passing (currently 4 failing)
# - scaffold-agent: 46 tests passing
```

### Test 3: Real Workflow (5 minutes)
```bash
./scripts/run-pipeline-test.sh "Slate Nightfall Calculator"
# ✅ Should show:
# - Workflow created
# - initialization → scaffolding (3s)
# - scaffolding → validation (5-10s) ← CURRENTLY STUCK HERE
# - validation → integration (5-10s)
# - integration → deployment (5-10s)
# - deployment → completed (5-10s)
# - Total: < 5 minutes
# - Status: ✅ COMPLETED
```

---

## Key Things to Remember

### ✅ DO:
- Use `agent_id` property (from this.agentId)
- Use `agent_type` as string literal: `'validation'`, `'integration'`, etc.
- Use `success` as boolean: `true` or `false`
- Use `status` with enum values: `'success'`, `'failed'`, `'timeout'`, etc.
- Wrap action-specific data in `result` field
- Include `timestamp` in ISO format
- Include `version` as `'1.0.0'`
- Call `AgentResultSchema.parse()` before publish
- Use `this.messageBus.publish()` not `this.redisPublisher.publish()`

### ❌ DON'T:
- Use `status: 'success' | 'failure'` ← Should be `'success' | 'failed'`
- Put action-specific data at top level ← Should be in `result` field
- Forget `agent_id`, `success`, or `version` fields
- Use wrapper pattern with `AgentMessage`
- Publish to `orchestrator:results` channel ← Should be `agent:results`
- Mix TaskResult and AgentResult patterns

---

## Expected Results

### Before Fix:
```
Workflow stuck at scaffolding stage
Error in logs: ZodError - missing agent_id, success, version
Unit tests: 15 failing
Real workflow: Hangs after 3-5 seconds
```

### After Fix:
```
Workflow progresses through all 6 stages
All stage outputs populated
Unit tests: All passing
Real workflow: Completes in < 5 minutes
```

---

## Debugging Tips

If something goes wrong:

### Test agents in isolation:
```bash
cd packages/agents/validation-agent
npm test -- src/__tests__/validation-agent.test.ts
# Check exact error message
```

### Check orchestrator logs:
```bash
tail -f /tmp/real-workflow-execution.log
# Look for "AgentResult schema validation failed"
```

### Check workflow status:
```bash
curl http://localhost:3000/api/workflows/{workflow_id}
# Look for: current_stage, status, error
```

### Verify schema definition:
```bash
grep -A 20 "AgentResultSchema" packages/shared/types/src/core/schemas.ts
# Confirm all required fields
```

---

## Commit Message Template

When pushing fixes:

```
fix(agents): Align result schemas with AgentResultSchema spec

- Update all agents to return AgentResult instead of TaskResult
- Add missing fields: agent_id, success, version
- Wrap action-specific payload in 'result' field
- Use correct enum values for 'status'
- Add AgentResultSchema.parse validation before publish
- Fixes: workflows stuck at stage transitions (#SESSION-50)
- Resolves: Unit test failures (validation, integration, deployment agents)

Session #51: Agent Schema Fix Implementation
```

---

## Success Criteria

✅ All changes completed when:
1. TypeScript build passes with zero errors
2. All unit tests pass (980/980 or 95%+ pass rate)
3. Real workflow test completes all 6 stages
4. No timeouts or hanging
5. Workflow status is "completed" (not "initiated")
6. All stage_outputs populated with action results

---

## Files to Modify (Summary)

| File | Lines | Change |
|------|-------|--------|
| base-agent.ts | 212-242 | Update reportResult method |
| validation-agent.ts | ~251 | Update execute return statement |
| integration-agent.ts | ~N/A | Same pattern as validation |
| deployment-agent.ts | ~N/A | Same pattern as validation |
| scaffold-agent.ts | ~N/A | Same pattern as validation |
| workflow.service.ts | ~N/A | Update handleAgentResult |
| workflow.state.ts | ~N/A | Update event interface |
| **Total:** | ~7-10 files | **Estimated 300-400 LOC changed** |

---

## Time Breakdown

- BaseAgent fix: 30 min
- ValidationAgent fix: 30 min
- IntegrationAgent fix: 30 min
- DeploymentAgent fix: 30 min
- ScaffoldAgent fix: 30 min
- Orchestrator updates: 30 min
- Testing & verification: 60 min
- **Total: 3.5 hours**

---

## Next Steps

1. **TODAY (Session #51):**
   - Implement all 5 agent fixes
   - Update orchestrator
   - Run tests
   - Verify workflow completion

2. **TOMORROW (Session #52):**
   - Add error handling improvements
   - Add monitoring/observability
   - Document lessons learned

3. **FOLLOW-UP:**
   - Version negotiation for schema changes
   - Richer error payloads
   - Performance optimization

---

**Ready to implement? Follow the 5 steps above and use the test checklist to verify.**
