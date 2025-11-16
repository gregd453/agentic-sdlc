# Session #66 - Next Steps Plan
**Date:** 2025-11-15
**Status:** ✅ Critical Bug Fixed - Planning Production Readiness
**Current State:** Workflows advancing (0% → 45%), but stuck at e2e_testing stage

---

## Current Situation Assessment

### ✅ What's Working
- Schema validation (AgentEnvelope v2.0.0)
- Task execution (scaffold, validation agents working)
- Result publishing (results reaching orchestrator)
- State transitions (initialization → scaffolding → validation → e2e_testing)
- **Progress tracking (0% → 15% → 30% → 45%)** ← FIXED!
- Database persistence (stages and progress saving correctly)

### ⚠️ What's Blocked
- **E2E agent not completing tasks** - Workflow stuck at e2e_testing/45%
- Integration agent crashloop (309 restarts)
- Deployment agent crashloop (307 restarts)

### 🔍 What Needs Investigation
- Why is the e2e agent not completing tasks?
- Why are integration/deployment agents crashing?
- Will workflows complete through all stages once agents are fixed?

---

## Recommended Approach: Systematic Agent Investigation

### Phase 1: E2E Agent Investigation (IMMEDIATE - 30 minutes)

**Goal:** Understand why e2e agent isn't completing tasks

#### Step 1.1: Check E2E Agent Logs (5 min)

```bash
# Check if e2e agent is receiving tasks
pnpm pm2:logs agent-e2e --lines 100 --nostream | grep -E "Task received|Task validated|execute|ERROR|Error"

# Check for specific workflow
pnpm pm2:logs agent-e2e --lines 200 --nostream | grep "44180cea"
```

**Expected Findings:**
- Is agent receiving e2e tasks?
- Is task validation passing?
- Is agent executing tasks or throwing errors?
- Are tasks timing out?

#### Step 1.2: Check Database for E2E Tasks (5 min)

```bash
# Check e2e tasks for current workflow
./scripts/query-workflows.sh tasks 44180cea-039e-4313-88b5-6c6b20683700 | grep e2e
```

**Expected Findings:**
- Are e2e tasks being dispatched?
- What's the task status (pending/running/completed/failed)?
- How long have tasks been pending?

#### Step 1.3: Add E2E Agent Logging (10 min)

**File:** `packages/agents/e2e-agent/src/e2e-agent.ts`

Add logging at key points:

```typescript
// At task execution entry
console.log('[DEBUG-E2E-1] 🔵 E2E task execution started', {
  task_id: task.task_id,
  workflow_id: task.workflow_id,
  payload_keys: Object.keys(task.payload || {})
});

// Before Claude API call (if applicable)
console.log('[DEBUG-E2E-2] 🟢 About to call Claude API', {
  task_id: task.task_id,
  has_stage_outputs: !!task.workflow_context?.stage_outputs
});

// After execution attempt
console.log('[DEBUG-E2E-3] 🟢 E2E execution completed', {
  task_id: task.task_id,
  success: true/false,
  error: error?.message
});
```

#### Step 1.4: Rebuild & Test (10 min)

```bash
pnpm build --filter=@agentic-sdlc/e2e-agent
pnpm pm2:restart agent-e2e
# Wait 30 seconds for task to execute
pnpm pm2:logs agent-e2e --lines 50
```

---

### Phase 2: Integration/Deployment Agent Crashloop Fix (15 minutes)

**Goal:** Stop crashloops, get agents online

#### Step 2.1: Check Crashloop Logs (5 min)

```bash
# Get error logs from integration agent
pnpm pm2:logs agent-integration --lines 50 --nostream | grep -E "ERROR|Error|Fatal|Exception"

# Get error logs from deployment agent
pnpm pm2:logs agent-deployment --lines 50 --nostream | grep -E "ERROR|Error|Fatal|Exception"
```

**Expected Findings (Based on Session #59):**
- Stale build errors (old base-agent schema imports)
- Missing dependencies
- Configuration errors

#### Step 2.2: Rebuild Both Agents (10 min)

```bash
# Rebuild integration agent
pnpm build --filter=@agentic-sdlc/integration-agent

# Rebuild deployment agent
pnpm build --filter=@agentic-sdlc/deployment-agent

# Restart both
pnpm pm2:restart agent-integration
pnpm pm2:restart agent-deployment

# Verify they stay online
sleep 5
pnpm pm2:status | grep -E "agent-integration|agent-deployment"
```

**Success Criteria:**
- Both agents show `status: online` (not `waiting restart`)
- Restart count stops incrementing
- No immediate errors in logs

---

### Phase 3: Enhanced Workflow Monitoring (20 minutes)

**Goal:** Add logging to track complete workflow lifecycle

#### Step 3.1: Add Task Dispatch Logging (10 min)

**File:** `packages/orchestrator/src/services/workflow.service.ts`

Find the task dispatch logic (likely in `dispatchNextTask` or similar method):

```typescript
console.log('[DEBUG-DISPATCH-1] 🔵 Dispatching task for stage', {
  workflow_id: workflow.workflow_id,
  current_stage: workflow.current_stage,
  current_progress: workflow.progress,
  agent_type: agentType,
  task_id: generatedTaskId
});

// After task dispatched
console.log('[DEBUG-DISPATCH-2] ✅ Task dispatched to agent stream', {
  workflow_id: workflow.workflow_id,
  task_id: generatedTaskId,
  stream: `stream:agent:${agentType}:tasks`
});
```

#### Step 3.2: Add Completion Detection Logging (10 min)

**File:** `packages/orchestrator/src/state-machine/workflow-state-machine.ts`

In the `markComplete` action (around line 385):

```typescript
console.log('[DEBUG-COMPLETE-1] 🎉 Workflow marked complete!', {
  workflow_id: context.workflow_id,
  final_stage: context.current_stage,
  final_progress: context.progress,
  total_stages: getStagesForType(context.type).length
});
```

In the `notifyCompletion` action (around line 393):

```typescript
console.log('[DEBUG-COMPLETE-2] 🎉 Workflow completion event published', {
  workflow_id: context.workflow_id,
  event_type: 'WORKFLOW_COMPLETED'
});
```

---

### Phase 4: Full E2E Validation (30 minutes)

**Goal:** Run complete test suite and validate all stages work

#### Step 4.1: Stop Old Test Processes

```bash
# Kill all running test processes
pkill -f "run-pipeline-test.sh"

# Clear PM2 logs for fresh start
pnpm pm2:flush
```

#### Step 4.2: Run Single Complete Test (15 min)

```bash
# Run Hello World API test (simplest)
./scripts/run-pipeline-test.sh "Hello World API" 2>&1 | tee /tmp/test-complete-validation.log

# Monitor in real-time (separate terminal)
watch -n 2 './scripts/query-workflows.sh active | head -5'
```

**Monitor for:**
- Progress advancing: 0% → 15% → 30% → 45% → 60% → 75% → 90% → 100%
- Stages: initialization → scaffolding → validation → e2e_testing → integration → deployment → monitoring
- Status: initiated → running → completed
- No task loops (same stage executed multiple times)

#### Step 4.3: Capture Complete Log Sequence (5 min)

Once workflow completes (or gets stuck):

```bash
# Get workflow ID from test log
WORKFLOW_ID=$(grep "Workflow ID:" /tmp/test-complete-validation.log | awk '{print $NF}')

# Get complete workflow details
./scripts/query-workflows.sh show $WORKFLOW_ID > /tmp/workflow-final-state.txt

# Get all tasks
./scripts/query-workflows.sh tasks $WORKFLOW_ID > /tmp/workflow-tasks.txt

# Get DEBUG logs
grep "DEBUG-" /Users/Greg/Projects/apps/zyp/agent-sdlc/scripts/logs/orchestrator-out.log | \
  grep $WORKFLOW_ID > /tmp/workflow-debug-sequence.txt
```

#### Step 4.4: Run 5 Test Suite (10 min) - ONLY if Step 4.2 succeeds

```bash
# Run all 5 tests in sequence (not parallel to avoid interference)
for test in "Hello World API" "Todo List" "React Dashboard" "Form Application" "Component Library"; do
  echo "=== Running: $test ==="
  ./scripts/run-pipeline-test.sh "$test" 2>&1 | tee /tmp/test-$test.log
  sleep 10  # Brief pause between tests
done

# Check results
./scripts/query-workflows.sh active | head -10
```

---

## Logging Strategy Summary

### What Logging to Add

#### High Priority (Add Now)

1. **E2E Agent Execution Logging**
   - Entry/exit of execute method
   - Claude API calls (if any)
   - Error handling
   - Result publication

2. **Integration/Deployment Agent Error Logging**
   - Startup errors (to understand crashloop)
   - Dependency loading errors
   - Task execution attempts

3. **Task Dispatch Logging**
   - When tasks are dispatched
   - Which agent/stream
   - Task details (stage, workflow_id)

4. **Workflow Completion Logging**
   - When workflow marked complete
   - Final state details
   - Completion event publication

#### Medium Priority (Add If Needed)

5. **Redis Streams Consumer Logging (Agent Side)**
   - Task message receipt
   - Message parsing
   - Handler invocation

6. **Stage Output Storage Logging**
   - What outputs are being stored
   - Where they're stored
   - If retrieval works for downstream stages

7. **Progress Calculation Logging**
   - Current progress before update
   - New progress after update
   - Stage index calculations

#### Low Priority (For Deep Debugging Only)

8. **State Machine Guard Logging**
   - Event deduplication checks (`_seenEventIds`)
   - In-flight guard checks (already added)
   - Transition guard evaluations

9. **Database CAS Operation Logging**
   - When CAS conflicts occur
   - Which field values conflicted
   - Resolution strategy

10. **EventBus Publication Logging**
    - What events are published
    - Event payload structure
    - Subscriber count

---

## Decision Tree: What to Do Based on Findings

### If E2E Agent is Receiving Tasks But Not Executing

**Root Cause Options:**
- A) Agent execute() method has bugs
- B) Claude API calls failing
- C) Task payload missing required data
- D) Agent throwing unhandled exceptions

**Action:** Add DEBUG-E2E logging → Rebuild → Check logs → Fix bugs in e2e-agent.ts

---

### If E2E Agent is NOT Receiving Tasks

**Root Cause Options:**
- A) Tasks not being dispatched for e2e_testing stage
- B) Tasks dispatched to wrong stream
- C) Consumer group not created for e2e agent
- D) Redis streams connectivity issue

**Action:** Add DEBUG-DISPATCH logging → Check Redis streams → Fix dispatch logic

---

### If Integration/Deployment Agents Have Stale Builds

**Root Cause:** Base-agent changes not propagated

**Action:** Full rebuild of both agents → Restart PM2 → Verify online status

---

### If Integration/Deployment Agents Have Missing Dependencies

**Root Cause:** Workspace dependencies not resolved

**Action:** `pnpm install` in agent packages → Rebuild → Restart

---

### If Workflow Completes Through All Stages

**Root Cause:** System is working! 🎉

**Action:**
1. Remove DEBUG logging (comment out console.log statements)
2. Run full 5-test suite
3. Document success in CLAUDE.md
4. Mark Session #66 as complete

---

## Estimated Timeline

### If E2E Agent Just Needs Bug Fix
- Investigation: 15 min
- Fix: 15 min
- Rebuild & Test: 10 min
- **Total: 40 minutes**

### If Integration/Deployment Need Rebuild
- Investigation: 5 min
- Rebuild: 10 min
- Test: 5 min
- **Total: 20 minutes**

### If Multiple Issues
- E2E Agent: 40 min
- Integration/Deployment: 20 min
- Full E2E Test: 30 min
- **Total: 90 minutes (1.5 hours)**

### Best Case Scenario
- All agents just need rebuild: 30 min
- Full E2E test passes: 15 min
- Cleanup & documentation: 15 min
- **Total: 60 minutes (1 hour)**

---

## Success Criteria

### Phase 1 Success
- ✅ E2E agent online and stable
- ✅ E2E agent receiving tasks
- ✅ E2E agent executing tasks (no errors)
- ✅ E2E agent publishing results

### Phase 2 Success
- ✅ Integration agent online (no crashloop)
- ✅ Deployment agent online (no crashloop)
- ✅ Both agents ready to receive tasks

### Phase 3 Success
- ✅ Task dispatch logging shows tasks being sent to all agent types
- ✅ Completion logging shows when workflows finish

### Phase 4 Success (FINAL VALIDATION)
- ✅ At least 1 workflow completes 100% through all stages
- ✅ Status changes: initiated → running → completed
- ✅ Progress: 0% → 100%
- ✅ All 7 stages execute: initialization → scaffolding → validation → e2e_testing → integration → deployment → monitoring
- ✅ No task loops
- ✅ No "stuck" workflows
- ✅ All 5 test cases pass

---

## Rollback Plan (If Things Break)

### If Logging Causes Issues

```bash
# Revert orchestrator changes
git checkout HEAD -- packages/orchestrator/src/state-machine/workflow-state-machine.ts
git checkout HEAD -- packages/orchestrator/src/services/workflow.service.ts

# Rebuild
pnpm build --filter=@agentic-sdlc/orchestrator

# Restart
pnpm pm2:restart orchestrator
```

### If Agent Rebuilds Cause Issues

```bash
# Check git status
git status

# Revert any changes
git checkout HEAD -- packages/agents/

# Rebuild from clean state
pnpm build

# Restart all
pnpm pm2:restart
```

---

## Files to Modify (Logging Phase)

### Definitely Add Logging

1. **`packages/agents/e2e-agent/src/e2e-agent.ts`**
   - DEBUG-E2E-1, DEBUG-E2E-2, DEBUG-E2E-3
   - Entry/exit/errors in execute method

2. **`packages/agents/integration-agent/src/integration-agent.ts`**
   - DEBUG-INT-ERROR in startup error handler
   - Catch crashloop root cause

3. **`packages/agents/deployment-agent/src/deployment-agent.ts`**
   - DEBUG-DEP-ERROR in startup error handler
   - Catch crashloop root cause

### Possibly Add Logging (If Needed)

4. **`packages/orchestrator/src/services/workflow.service.ts`**
   - DEBUG-DISPATCH-1, DEBUG-DISPATCH-2 in task dispatch
   - Only if tasks aren't reaching agents

5. **`packages/orchestrator/src/state-machine/workflow-state-machine.ts`**
   - DEBUG-COMPLETE-1, DEBUG-COMPLETE-2 in completion handlers
   - Only if workflows don't complete

---

## Recommended Immediate Action

**Start with Phase 1 (E2E Agent Investigation)** because:
1. Workflow is currently stuck waiting for e2e agent
2. E2E agent appears to be online (not crashing)
3. This is blocking progress observation
4. Quick investigation (5-10 min) will reveal if it's simple or complex

**Commands to run RIGHT NOW:**

```bash
# 1. Check e2e agent logs
pnpm pm2:logs agent-e2e --lines 100 --nostream | tail -50

# 2. Check if e2e tasks exist
./scripts/query-workflows.sh tasks 44180cea-039e-4313-88b5-6c6b20683700

# 3. Check Redis streams for e2e tasks
docker exec agentic-sdlc-redis redis-cli XPENDING stream:agent:e2e_test:tasks e2e-group - + 10
```

These 3 commands will immediately tell you:
- Is e2e agent receiving/processing tasks?
- Are e2e tasks being dispatched?
- Are tasks pending in Redis streams?

**Then proceed based on findings.**

---

**End of Plan**
