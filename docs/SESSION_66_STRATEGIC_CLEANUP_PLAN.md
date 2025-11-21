# Session #66 - Strategic Cleanup Plan

**Date:** 2025-11-15
**Status:** Session #66 fix deployed, needs strategic refinement
**Goal:** Transform tactical fix into clean, strategic architecture

---

## Executive Summary

✅ **What Works:** Task creation is now happening - validation tasks are being created!
⚠️ **What's Tactical:** Current implementation has race conditions and architectural smells
🎯 **Strategic Goal:** Clean, state-machine-centric orchestration with no legacy paths

---

## Issues to Address (Priority Order)

### 🔴 CRITICAL: Race Condition in State Machine (Priority 1)

**Current Code (RISKY):**
```typescript
// workflow-state-machine.ts:791
await new Promise(resolve => setTimeout(resolve, 200));  // ❌ Hope-based timing
const workflow = await this.repository.findById(workflowId);
```

**Problem:**
- 200ms is a guess - may not be enough under load
- Could read stale `current_stage` from database
- Will cause wrong tasks to be dispatched or skipped tasks

**Strategic Solution:**
Use existing `waitForStageTransition()` pattern from WorkflowService:

```typescript
// OPTION A: Reuse existing helper (cleanest)
private async waitForStageTransition(
  workflowId: string,
  previousStage: string
): Promise<Workflow | null> {
  const maxAttempts = 50; // 5 seconds with 100ms polling
  for (let i = 0; i < maxAttempts; i++) {
    const workflow = await this.repository.findById(workflowId);
    if (workflow && workflow.current_stage !== previousStage) {
      return workflow;  // Stage transition complete!
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return null;  // Timeout
}

// Usage in state machine:
const workflow = await this.waitForStageTransition(workflowId, completedStage);
if (workflow && !isTerminal(workflow.status)) {
  await this.taskCreator(workflowId, workflow.current_stage, {...});
}
```

**Estimated Time:** 30 minutes

---

### 🟡 HIGH: Remove Legacy handleAgentResult Path (Priority 2)

**Current State:**
- `WorkflowService.setupMessageBusSubscription()` subscribes to `orchestrator:results`
- Calls `handleAgentResult()` → `handleTaskCompletion()` → tries to create tasks
- BUT state machine ALSO subscribes to same channel!
- **Result:** Duplicate processing, confusing code paths

**Strategic Solution:**
Remove the WorkflowService subscription entirely. State machine is now the authoritative orchestrator.

```typescript
// workflow.service.ts - REMOVE THIS METHOD ENTIRELY
❌ private async setupMessageBusSubscription(): Promise<void> {
  // ... DELETE 50 lines ...
}

// In constructor, REMOVE the call:
❌ this.setupMessageBusSubscription();

// ADD deprecation notice:
/**
 * ⚠️ DEPRECATED (Session #66): handleAgentResult is no longer used.
 * Task creation is now handled by WorkflowStateMachineService.
 * This method will be removed in a future session.
 *
 * Historical context: Previously, WorkflowService subscribed to orchestrator:results
 * and called handleAgentResult → handleTaskCompletion → createTaskForStage.
 * This caused duplicate processing with the state machine.
 */
private async handleAgentResult(result: any): Promise<void> {
  throw new Error('DEPRECATED: Use state machine for task orchestration');
}
```

**Files to Modify:**
1. `workflow.service.ts:50` - Remove `setupMessageBusSubscription()` call
2. `workflow.service.ts:93-140` - Delete `setupMessageBusSubscription()` method
3. `workflow.service.ts:597-710` - Mark `handleAgentResult()` as deprecated
4. `workflow.service.ts:717-924` - Mark `handleTaskCompletion()` as deprecated

**Estimated Time:** 20 minutes

---

### 🟡 MEDIUM: Verify Single Task Per Stage Invariant (Priority 3)

**Test Query:**
```sql
-- For each workflow, verify tasks match completed stages
SELECT
  w.id AS workflow_id,
  w.current_stage,
  w.progress,
  COUNT(DISTINCT at.agent_type) AS unique_agent_types,
  COUNT(*) AS total_tasks,
  STRING_AGG(DISTINCT at.agent_type::text, ', ' ORDER BY at.agent_type::text) AS agent_types,
  STRING_AGG(at.status::text, ', ') AS task_statuses
FROM "Workflow" w
LEFT JOIN "AgentTask" at ON at.workflow_id = w.id
WHERE w.status = 'initiated'
GROUP BY w.id, w.current_stage, w.progress
HAVING COUNT(*) > 0
ORDER BY w.created_at DESC;
```

**Expected Invariant:**
- For stage `validation` (index 2 of 7 stages), expect:
  - 1 completed `scaffold` task
  - 0-1 `validation` tasks (pending/running/completed)
  - Progress should be 15-30%

**If Violated:**
- Multiple tasks for same stage = duplicate dispatch bug
- Tasks for wrong stage = race condition in stage detection

**Estimated Time:** 15 minutes

---

### 🟢 LOW: Move waitForStageTransition to State Machine (Priority 4)

**Strategic Refactor:**
Currently `waitForStageTransition()` lives in WorkflowService but is needed by state machine.

```typescript
// workflow-state-machine.ts - ADD THIS HELPER
private async waitForStageTransition(
  workflowId: string,
  previousStage: string,
  maxWaitMs: number = 5000
): Promise<any> {
  const maxAttempts = Math.floor(maxWaitMs / 100);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const workflow = await this.repository.findById(workflowId);

    if (!workflow) {
      logger.error('Workflow not found during stage transition wait', { workflowId });
      return null;
    }

    if (workflow.current_stage !== previousStage) {
      logger.info('Stage transition detected', {
        workflowId,
        from: previousStage,
        to: workflow.current_stage,
        attempts: attempt + 1
      });
      return workflow;
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  logger.warn('Timeout waiting for stage transition', {
    workflowId,
    previousStage,
    maxWaitMs
  });

  return await this.repository.findById(workflowId);  // Return anyway
}
```

**Estimated Time:** 15 minutes

---

### 🟢 LOW: Redis ACK Strategy Verification (Priority 5)

**Current Code Review Needed:**
```typescript
// redis-bus.adapter.ts - VERIFY THIS PATTERN
await Promise.all(
  Array.from(handlers).map(h => h(parsedMessage))  // ✅ Execute handlers
);
// ONLY ACK AFTER all handlers succeed ✅
await pub.xAck(streamKey, consumerGroup, message.id);
```

**Verify:**
1. ACK happens AFTER handler execution ✅
2. If handler throws, ACK doesn't happen (message stays pending) ✅
3. XREADGROUP uses `id: '>'` for live consumption ✅

**If violations found:** Fix ACK timing

**Estimated Time:** 10 minutes (code review only)

---

## Implementation Plan

### Phase 1: Critical Fixes (1 hour)
1. ✅ Replace 200ms setTimeout with waitForStageTransition (30 min)
2. ✅ Remove WorkflowService.setupMessageBusSubscription (20 min)
3. ✅ Verify single task per stage with SQL query (10 min)

### Phase 2: Cleanup (30 minutes)
4. ✅ Move waitForStageTransition helper to state machine (15 min)
5. ✅ Verify Redis ACK strategy (10 min)
6. ✅ Add architectural documentation (5 min)

### Phase 3: Validation (30 minutes)
7. ✅ Full rebuild and test
8. ✅ Run 3 workflows end-to-end
9. ✅ Verify no duplicate tasks
10. ✅ Verify progress tracking works

**Total Time:** ~2 hours

---

## Success Criteria

### Functional Requirements
- ✅ Tasks dispatched for ALL stages (scaffold → validation → e2e → integration → deployment)
- ✅ NO duplicate tasks per stage
- ✅ Progress advances correctly (0% → 15% → 30% → ... → 100%)
- ✅ Workflows complete end-to-end
- ✅ NO race conditions or timing-based bugs

### Architectural Requirements
- ✅ State machine is the ONLY orchestrator
- ✅ NO legacy handleAgentResult path
- ✅ NO setTimeout-based coordination
- ✅ Deterministic transition detection
- ✅ Clean separation of concerns

### Code Quality
- ✅ No dead code
- ✅ No deprecated methods still being called
- ✅ Clear comments explaining architecture
- ✅ Redis patterns follow best practices

---

## Risk Mitigation

### If Phase 1 breaks things:
```bash
# Rollback strategy
git stash  # Save changes
git checkout HEAD -- packages/orchestrator/src/
pnpm build --filter=@agentic-sdlc/orchestrator
pnpm pm2:restart orchestrator
```

### If tasks still not dispatching:
1. Check state machine logs for taskCreator errors
2. Verify waitForStageTransition timeout isn't too short
3. Check database for stage transition timing

### If duplicate tasks appear:
1. Verify WorkflowService subscription is FULLY removed
2. Check for any other subscribers to orchestrator:results
3. Add distributed lock around task creation (if needed)

---

## Post-Cleanup: Next Strategic Steps

### Integration & Deployment Agents (30 min)
Once core orchestration is solid:
1. Fix integration agent crashloop
2. Fix deployment agent crashloop
3. Verify full pipeline: initialization → deployment → monitoring

### Monitoring & Observability (1 hour)
1. Add metrics for task dispatch rate
2. Add alerts for stuck workflows
3. Dashboard for stage progression

### Performance Optimization (Optional)
1. Reduce DB polling frequency once stable
2. Consider event-driven stage detection (if needed)
3. Batch task creation for parallel stages (future)

---

**End of Plan**
