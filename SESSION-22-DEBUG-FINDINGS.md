# Session #22 - Stage Progression Bug - Detailed Findings

**Status**: Bug identified and partially debugged
**Date**: 2025-11-10
**Workflow Issue**: Workflow jumps from `initialization` → `e2e_testing`, skipping `scaffolding` and `validation`

## Test Observations

From pipeline test runs:
```
Stage: initialization  | Status: initiated   (0%)
Stage: e2e_testing     | Status: initiated   (0% - repeating)
```

The workflow:
1. ✅ Starts correctly at "initialization"
2. ❌ Jumps directly to "e2e_testing" (skips 2 stages)
3. ❌ Loops at "e2e_testing" forever (no forward progress)

## Stage Configuration

App-type stages array (in `getStagesForType`):
```typescript
['initialization', 'scaffolding', 'validation', 'e2e_testing', 'integration', 'deployment', 'monitoring']
```
Index 0=init, 1=scaffolding, 2=validation, 3=e2e_testing

## Root Cause Analysis

### What's Happening

1. **First STAGE_COMPLETE(initialization)**:
   - State machine evaluating entry: should compute nextStage from index 0 → index 1 = "scaffolding"
   - Shows computed nextStage = "scaffolding" in logs ✓
   - Creates task for scaffolding stage ✓

2. **But workflow shows stage jumping to e2e_testing**:
   - This suggests stage calculation is off by 2 indices
   - Could indicate: `indexOf("initialization")` returns 3 instead of 0?
   - Or: rapid events causing parallel evaluation?

### Hypothesis

The state machine's `context.current_stage` might be getting corrupted or misaligned with actual stage values. When `transitionToNextStage` action updates it, there might be a race condition or async timing issue.

## Code Locations to Investigate

### 1. Stage Computation Logic
**File**: `packages/orchestrator/src/state-machine/workflow-state-machine.ts:112-157`

```typescript
const stages = getStagesForType(context.type);
const currentIndex = stages.indexOf(context.current_stage);
const next = stages[currentIndex + 1];
```

**Debug Added**: Session #22 logs show:
- `all_stages`: Array of stage names
- `current_stage`: Current stage value
- `currentIndex`: Index result
- `stage_at_current_index`: Verification that index is correct

### 2. Database Sync Issue
**File**: `packages/orchestrator/src/state-machine/workflow-state-machine.ts:285-336`

Added mismatch detection in `transitionToNextStage`:
```typescript
const dbWorkflow = await repository.findById(context.workflow_id);
if (dbWorkflow && dbWorkflow.current_stage !== context.current_stage) {
  // Mismatch detected - using DB as source of truth
}
```

### 3. Task Creation & Agent Results
**File**: `packages/orchestrator/src/services/workflow.service.ts:292-329`

`handleAgentResult` extracts stage from agent response:
```typescript
const completedStage = payload.stage || result.stage;
```

**Possibility**: Agent might be returning wrong stage value from task payload.

### 4. Task Completion Handler
**File**: `packages/orchestrator/src/services/workflow.service.ts:331-398`

`handleTaskCompletion`:
- Sends `STAGE_COMPLETE` event with completed stage
- Polls database via `waitForStageTransition` to confirm DB update
- Creates task for new stage

## Debugging Steps Completed

✅ Added detailed logging to evaluate entry action:
- Logs: stage array, current_stage, computed index, next stage
- Added trimmed stage value check to detect whitespace issues
- Added CRITICAL error logging if stage not found in array

✅ Added database sync check to transitionToNextStage:
- Detects mismatches between context and database
- Logs old_stage, new_stage, and update confirmation

✅ Built and tested - bug still present
- Stage IS being found (no "CRITICAL: Current stage not found" messages)
- Workflow consistently jumps: initialization → e2e_testing (indices 0 → 3)
- No whitespace issues detected (trimmed values checked)

## Key Discovery

The fact that no "CRITICAL" errors appear means `indexOf(context.current_stage)` is **successfully finding** the stage in the array. This rules out:
- ❌ Stage name mismatch
- ❌ Whitespace issues
- ❌ Type mismatch (non-string value)
- ❌ stages array being empty or corrupted

The issue must be in how `context.current_stage` is being updated or passed through state transitions.

## Next Steps for Session #22

1. **Check Log Output (Priority 1)**
   ```bash
   grep "SESSION #22 DEBUG: Computing next stage" scripts/logs/orchestrator.log | head -5
   ```
   - Look for: what `currentIndex` is being computed for "initialization"
   - If index is wrong, `indexOf` is not finding the stage correctly

2. **Verify Stage Array Content**
   - Add logging to show exact stage names in array
   - Check for whitespace/case sensitivity issues
   - Verify `getStagesForType` returns correct array

3. **Check Agent Result Stage Value**
   - Log what stage value is in the agent result payload
   - Verify it matches database stage exactly
   - Check for case/whitespace mismatches

4. **Trace Multi-Event Scenario**
   - Add logging to show when STAGE_COMPLETE events arrive
   - Log timestamps to see if events overlap
   - Verify state machine processes them sequentially

5. **Consider Alternative Fix**
   - Instead of relying on state machine context, always read current_stage from database
   - Pass database-fetched stage into computation function
   - Ensures single source of truth

## Key Files Modified

- `packages/orchestrator/src/state-machine/workflow-state-machine.ts`:
  - Added enhanced logging in evaluating entry action (lines 116-126)
  - Added database sync check in transitionToNextStage (lines 301-310)
  - Added explicit logging of all stage computation values

## Test Commands

```bash
# Run with logs visible
./scripts/env/stop-dev.sh && sleep 2 && ./scripts/env/start-dev.sh && sleep 15 && timeout 120 ./scripts/run-pipeline-test.sh "Hello World API" 2>&1 | tee test-output.log

# View relevant debug logs
grep "SESSION #22 DEBUG" scripts/logs/orchestrator.log | head -100

# Check for stage mismatch warnings
grep "Stage mismatch detected" scripts/logs/orchestrator.log
```

## Commits Made in Session #22

- Enhanced debug logging for stage progression
- Added database sync verification in transitionToNextStage
- Build verified to compile successfully

## Notes

The issue is consistent and reproducible. The workflow reliably skips stages, suggesting a systematic problem in the stage calculation logic rather than a race condition. The fact that it jumps by exactly 3 indices (0→3) suggests the problem might be in how `indexOf` is finding the stage, or the stage value being passed in has unexpected content.
