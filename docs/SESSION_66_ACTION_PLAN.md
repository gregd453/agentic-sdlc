# Session #66 - Action Plan & Enhanced Logging Strategy
**Date:** 2025-11-14
**Status:** NO CHANGES MADE - Investigation & Planning Only
**Next Session:** Implement logging, investigate, fix root cause

---

## Problem Summary

**Critical Issue:** State machine not advancing workflows. All 5 E2E tests stuck at 0% progress.

**Symptom:** "SESSION #23 FIX: DOUBLE INVOCATION DETECTED! Ignoring second call." - blocking legitimate state transitions

**Impact:** Complete workflow system failure. Test #2 executed 16 scaffold tasks in a loop because workflow never advanced.

**Evidence:** See `SESSION_66_E2E_TEST_REPORT.md` for full details.

---

## Investigation Strategy

### Phase 1: Enhanced Logging (NO CODE CHANGES - LOGGING ONLY)

**Goal:** Capture complete state machine call sequence to identify root cause

**Approach:** Add console.log statements at critical points (similar to Session #65 DEBUG-ORCH approach)

---

## Enhanced Logging Implementation

### File 1: `packages/orchestrator/src/state-machine/workflow-state-machine.ts`

**Locations to Add Logging:**

#### 1. At Method Entry (Find Session #23 "DOUBLE INVOCATION" check)

Search for: `SESSION #23 FIX: DOUBLE INVOCATION DETECTED`

Add BEFORE the check:
```typescript
console.log('[DEBUG-STATE-1] 🔵 State machine method called', {
  method: '<method_name>',  // e.g., 'handleStageComplete' or similar
  workflow_id: '<extract from args>',
  current_state: '<current workflow state>',
  timestamp: new Date().toISOString()
});
```

Add in the duplicate detection logic:
```typescript
// Existing code (Session #23 fix)
if (/* duplicate condition */) {
  console.log('[DEBUG-STATE-2] ❌ DUPLICATE DETECTED', {
    workflow_id: '<id>',
    reason: '<why considered duplicate>',
    last_call_timestamp: '<when was last call>',
    this_call_timestamp: new Date().toISOString(),
    time_diff_ms: '<difference>'
  });

  log.error('SESSION #23 FIX: DOUBLE INVOCATION DETECTED! Ignoring second call.');
  return; // Existing early return
}

console.log('[DEBUG-STATE-3] ✅ NOT a duplicate, proceeding with transition', {
  workflow_id: '<id>'
});
```

#### 2. Before State Transition

Search for where workflow state is updated (likely `workflow.status = ...` or `workflow.current_stage = ...`)

Add:
```typescript
console.log('[DEBUG-STATE-4] 🟢 BEFORE state transition', {
  workflow_id: workflow.workflow_id,
  from_status: workflow.status,
  from_stage: workflow.current_stage,
  from_progress: workflow.progress,
  to_status: '<new status>',
  to_stage: '<new stage>',
  to_progress: '<new progress>'
});

// Existing state update code
workflow.status = newStatus;
workflow.current_stage = newStage;
workflow.progress = newProgress;

console.log('[DEBUG-STATE-5] 🟢 AFTER state transition', {
  workflow_id: workflow.workflow_id,
  actual_status: workflow.status,
  actual_stage: workflow.current_stage,
  actual_progress: workflow.progress
});
```

#### 3. At Method Exit

Add before return statements:
```typescript
console.log('[DEBUG-STATE-6] ✅ State machine method complete', {
  workflow_id: workflow.workflow_id,
  final_status: workflow.status,
  final_stage: workflow.current_stage,
  final_progress: workflow.progress,
  duration_ms: Date.now() - entryTime
});
```

---

### File 2: `packages/orchestrator/src/services/workflow.service.ts`

**Locations to Add Logging:**

#### 1. In handleTaskCompletion (Find where STAGE_COMPLETE is sent)

Search for: `Sending STAGE_COMPLETE to state machine` or `handleStageComplete`

Add:
```typescript
console.log('[DEBUG-WF-1] 🔵 handleTaskCompletion called', {
  workflow_id: result.workflow_id,
  task_id: result.task_id,
  stage: result.stage,
  current_workflow_stage: '<query current workflow stage>',
  current_workflow_progress: '<query current workflow progress>'
});
```

Before sending STAGE_COMPLETE:
```typescript
console.log('[DEBUG-WF-2] 🟢 About to send STAGE_COMPLETE', {
  workflow_id: result.workflow_id,
  completed_stage: result.stage,
  timestamp: new Date().toISOString()
});

// Existing code: send STAGE_COMPLETE event
await this.stateMachine.handleStageComplete(...);

console.log('[DEBUG-WF-3] ✅ STAGE_COMPLETE call completed', {
  workflow_id: result.workflow_id
});
```

#### 2. Track handleTaskCompletion Invocation Count

At top of file (outside class):
```typescript
const taskCompletionCalls = new Map<string, number>(); // workflow_id → count
```

In handleTaskCompletion:
```typescript
const callCount = (taskCompletionCalls.get(result.workflow_id) || 0) + 1;
taskCompletionCalls.set(result.workflow_id, callCount);

console.log('[DEBUG-WF-4] 📊 handleTaskCompletion call tracker', {
  workflow_id: result.workflow_id,
  call_number: callCount,
  total_calls_for_workflow: callCount
});
```

#### 3. In buildAgentEnvelope (Task Dispatch)

Before dispatching task:
```typescript
console.log('[DEBUG-WF-5] 🟢 Dispatching task', {
  workflow_id: workflow.workflow_id,
  task_id: '<generated task id>',
  agent_type: agentType,
  current_stage: workflow.current_stage,
  current_progress: workflow.progress,
  reason: 'Stage requires task execution'
});
```

---

### File 3: `packages/orchestrator/src/hexagonal/adapters/redis-bus.adapter.ts`

**Locations to Add Logging:**

#### In Result Stream Consumer (Around ACK)

Search for: `[DEBUG-STREAM] Message ACKed`

Add BEFORE ACK:
```typescript
console.log('[DEBUG-STREAM-ACK-1] 🟢 About to ACK result message', {
  streamKey: 'stream:orchestrator:results',
  messageId: message.id,
  workflow_id: '<extract from message>',
  task_id: '<extract from message>'
});

// Existing ACK code
await pub.xAck(...);

console.log('[DEBUG-STREAM-ACK-2] ✅ Result message ACKed successfully', {
  messageId: message.id
});
```

Add in error handler (to see why ACK might not happen):
```typescript
} catch (error) {
  console.log('[DEBUG-STREAM-ACK-3] ❌ Handler error - message will NOT be ACKed', {
    streamKey: 'stream:orchestrator:results',
    messageId: message.id,
    error: String(error),
    stack: error instanceof Error ? error.stack : undefined
  });

  throw error; // Re-throw to prevent ACK
}
```

---

## Testing Plan with Enhanced Logging

### Step 1: Implement Logging (No Functional Changes)

1. Add all console.log statements above
2. DO NOT change any logic or control flow
3. Only add logging for visibility

### Step 2: Rebuild & Restart

```bash
pnpm build              # Rebuild orchestrator package
pnpm pm2:restart        # Restart all services
```

### Step 3: Run Single Test Case

```bash
# Clear old test data
pnpm pm2:logs --lines 0  # Clear PM2 logs

# Run test
./scripts/run-pipeline-test.sh "Hello World API" 2>&1 | tee /tmp/test-debug.log

# Monitor logs in real-time (separate terminal)
pnpm pm2:logs orchestrator --lines 100
```

### Step 4: Capture Log Sequence

Watch for this sequence:
1. `[DEBUG-WF-5]` - Task dispatched
2. (Agent executes task)
3. `[DEBUG-ORCH-1]` - Result received
4. `[DEBUG-WF-1]` - handleTaskCompletion called
5. `[DEBUG-WF-2]` - About to send STAGE_COMPLETE
6. `[DEBUG-STATE-1]` - State machine method called
7. `[DEBUG-STATE-2]` **OR** `[DEBUG-STATE-3]` - Duplicate check result
8. `[DEBUG-STATE-4/5]` - State transition (if not duplicate)
9. `[DEBUG-WF-3]` - STAGE_COMPLETE call completed
10. `[DEBUG-STREAM-ACK-2]` - Message ACKed

### Step 5: Analyze Captured Logs

Extract logs:
```bash
pnpm pm2:logs orchestrator --lines 500 --nostream > /tmp/orchestrator-debug.log
grep "DEBUG-STATE\|DEBUG-WF\|DEBUG-STREAM-ACK" /tmp/orchestrator-debug.log > /tmp/debug-sequence.log
```

Look for:
- **Duplicate invocations:** Multiple `[DEBUG-STATE-1]` for same workflow without state change
- **Rejected transitions:** `[DEBUG-STATE-2]` showing duplicate detection
- **Missing transitions:** No `[DEBUG-STATE-4/5]` after `[DEBUG-STATE-3]`
- **ACK failures:** No `[DEBUG-STREAM-ACK-2]` after result received

---

## Expected Findings & Fix Scenarios

### Scenario A: Session #23 Guard Too Aggressive

**Log Pattern:**
```
[DEBUG-STATE-1] Called (workflow: X, state: scaffolding)
[DEBUG-STATE-2] DUPLICATE DETECTED (reason: "same stage")
ERROR: DOUBLE INVOCATION DETECTED
```

**Diagnosis:** Guard is rejecting valid transitions (e.g., scaffolding → validation)

**Fix:** Adjust duplicate detection logic in state machine
- Only reject true duplicates (same event, same args, within time window)
- Allow legitimate transitions even if same method called multiple times

---

### Scenario B: Workflow State Not Persisting

**Log Pattern:**
```
[DEBUG-STATE-4] BEFORE (from: scaffolding, progress: 0)
[DEBUG-STATE-5] AFTER (actual: validation, progress: 45)
... later ...
[DEBUG-WF-1] handleTaskCompletion (current_stage: scaffolding, progress: 0)
```

**Diagnosis:** State updates not being saved to database

**Fix:** Add await to repository save call, ensure transaction commits

---

### Scenario C: Multiple Concurrent Calls

**Log Pattern:**
```
[DEBUG-STATE-1] Called (timestamp: T1)
[DEBUG-STATE-1] Called (timestamp: T2)  # T2 - T1 < 100ms
[DEBUG-STATE-2] DUPLICATE DETECTED (time_diff_ms: 50)
```

**Diagnosis:** Race condition - multiple result messages for same stage arriving concurrently

**Fix:** Add mutex/lock around state transitions for same workflow

---

### Scenario D: Progress Calculation Bug

**Log Pattern:**
```
[DEBUG-STATE-4] BEFORE (progress: 0, to_progress: 45)
[DEBUG-STATE-5] AFTER (actual_progress: 0)  # Not updated!
```

**Diagnosis:** Progress calculation returns 0 or not being set

**Fix:** Review progress calculation logic in state machine

---

## Implementation Checklist

### Phase 1: Logging (Session #66 Continued)
- [ ] Add DEBUG-STATE-1 through DEBUG-STATE-6 in state machine
- [ ] Add DEBUG-WF-1 through DEBUG-WF-5 in workflow service
- [ ] Add DEBUG-STREAM-ACK-1 through DEBUG-STREAM-ACK-3 in redis-bus
- [ ] Rebuild orchestrator package
- [ ] Restart PM2 services

### Phase 2: Testing
- [ ] Run single test case (Hello World API)
- [ ] Capture PM2 logs (500+ lines)
- [ ] Extract DEBUG-* sequence
- [ ] Analyze for patterns matching scenarios above

### Phase 3: Root Cause Identification
- [ ] Identify which scenario matches log pattern
- [ ] Locate exact code causing issue
- [ ] Document root cause in session notes

### Phase 4: Fix Implementation
- [ ] Implement fix based on scenario
- [ ] Remove or comment out DEBUG-* logging
- [ ] Rebuild and test
- [ ] Verify workflow advances correctly
- [ ] Run all 5 E2E tests again

---

## Success Criteria

**Logging Phase:**
- Complete log sequence captured from task dispatch → state transition → ACK
- Duplicate detection logic visible in logs
- State before/after transitions visible

**Fix Phase:**
- Workflows advance from initialization → scaffolding → validation → e2e_testing → ...
- Progress updates correctly (0% → 15% → 30% → 45% → ...)
- No "DOUBLE INVOCATION DETECTED" errors for valid transitions
- All result messages ACKed successfully
- No task dispatch loops

**E2E Validation:**
- All 5 test cases complete successfully
- Each workflow reaches 100% and status='completed'
- No stuck workflows at 0%

---

## Alternative: Quick Investigation First

If you want to investigate BEFORE adding logging:

### Quick Check #1: Review Session #23 Code

```bash
git log --all --grep="SESSION #23" --oneline
git show <commit-hash>
```

Look for what was added to prevent double invocation.

### Quick Check #2: Search for Duplicate Guard

```bash
grep -r "DOUBLE INVOCATION" packages/orchestrator/src/
grep -r "SESSION #23" packages/orchestrator/src/
```

Review the guard logic - what condition triggers it?

### Quick Check #3: Check State Machine Transition Logic

Read `workflow-state-machine.ts`:
- How does it track if a transition already happened?
- Is there a timestamp check?
- Is there a state comparison?

**If guard logic is obvious, can fix immediately without logging.**
**If unclear, proceed with logging strategy above.**

---

## Files to Investigate (Read-Only)

1. `packages/orchestrator/src/state-machine/workflow-state-machine.ts`
   - Search for "SESSION #23" or "DOUBLE INVOCATION"
   - Review duplicate detection logic
   - Check state transition implementation

2. `packages/orchestrator/src/services/workflow.service.ts`
   - Find handleTaskCompletion method
   - Check how STAGE_COMPLETE is sent
   - Review dispatch logic (why 16 tasks for test #2?)

3. `packages/orchestrator/src/hexagonal/adapters/redis-bus.adapter.ts`
   - Confirm ACK only happens after handler success (Session #65 fix)
   - Check error handling prevents ACK

---

**Action Plan End**

**Next Step:** Decide:
- **Option A:** Quick investigation of Session #23 code (5-10 min)
- **Option B:** Implement full enhanced logging (20-30 min)
- **Option C:** Both - quick check first, add logging if needed
