# CLAUDE.md - AI Assistant Guide for Agentic SDLC Project

**Version:** 6.5 | **Last Updated:** 2025-11-10 06:10 UTC | **Status:** Session #21 IN PROGRESS - Invoked Service Pattern + Polling Fix Deployed

---

## ⚡ QUICK REFERENCE (START HERE)

### Current Focus: Session #20 - Multi-Stage Task Creation Pattern

| Item | Status | Details |
|------|--------|---------|
| **Initialization Blocker** | ✅ FIXED | Workflows now properly dispatch initialization task (commit e584802) |
| **Handler Persistence** | ✅ FIXED | Removed auto-cleanup, handlers persist across all stages (commit 9e297b2) |
| **Task Creation Pattern** | ❌ NEW ISSUE | No scaffolding task created after initialization completes |
| **Stage Progression** | ⚠️ PARTIAL | Init→Scaffolding transition works, but scaffolding task never created |
| **Pipeline Tests** | ⚠️ PARTIAL PASS | Initialization stage completes, but no scaffolding task dispatched |
| **Build Status** | ✅ PASSING | All modules compile successfully |
| **Next Action** | ➡️ IMPLEMENT | Create task for current stage after state machine transitions |

### Key Documentation
- **CALCULATOR-SLATE-INTEGRATION.md** - Template details & integration
- **ZYP-PATTERNS-SUMMARY.md** - Quick compliance reference
- **ZYP-PATTERN-ANALYSIS-AND-ENHANCEMENTS.md** - Detailed roadmap
- **ADR-GOVERNANCE-INTEGRATION.md** - ADR integration guide
- **PIPELINE-TESTING-FRAMEWORK.md** - Test framework documentation

### Quick Commands
```bash
./scripts/env/start-dev.sh                      # Start environment
./scripts/run-pipeline-test.sh "Calculator"    # Run test
./scripts/env/stop-dev.sh                      # Stop environment
```

---

## 🎯 SESSION #21 STATUS - Invoked Service Pattern + Polling Fix

### ✅ COMPLETED: XState Double-Invocation Fix

**Implementation Complete (commit 5c00fff):**
1. **Replaced `always` block with `invoke` pattern** in "evaluating" state
   - Used `fromPromise` to wrap async next stage computation
   - Entry action uses pure `assign` to compute nextStage synchronously
   - Single invoked service guarantees exactly one execution per evaluation cycle
   - `onDone` guard checks if workflow complete, otherwise transitions to running

2. **Added `waitForStageTransition()` polling mechanism**
   - Replaced fragile 100ms fixed wait with intelligent polling
   - Polls database every 100ms for up to 5 seconds
   - Waits for workflow.current_stage to change from completed stage
   - Ensures async `transitionToNextStage` action completes before querying

3. **Improved error handling and logging**
   - Added "Stage transition detected in database" log with attempt count
   - Added timeout warning if polling exceeds 5 seconds
   - Graceful fallback - returns workflow anyway for terminal state checks

**Key Files Modified:**
- `packages/orchestrator/src/state-machine/workflow-state-machine.ts` - Complete state refactor
- `packages/orchestrator/src/services/workflow.service.ts` - Added polling mechanism

### ⚠️ REMAINING ISSUE: Stage Progression Logic

**Observation from Testing:**
- Workflow now transitions from "initialization" → "e2e_testing" (bypassing scaffolding & validation)
- Database polling IS working (stage changes are detected)
- Tasks ARE being created for new stages
- **Problem:** The stage indexing logic is computing wrong next stages

**Root Cause Hypothesis:**
- In `evaluating` state entry action (workflow-state-machine.ts:112-135)
- `getStagesForType(context.type)` returns correct stage array
- `stages.indexOf(context.current_stage)` might be finding wrong index
- Or the invoked service is being evaluated multiple times with stale context

**Next Steps for Session #22:**
1. Add detailed logging to `getStagesForType()` and index calculation
2. Log stage array, current stage, and computed nextStage at each transition
3. Verify invoked service is only called ONCE per STAGE_COMPLETE event
4. Check if context.type is correct for "Hello World API" test (should be "app")
5. Consider if there's still re-evaluation happening despite invoked service pattern

---

## 🎯 SESSION #20 STATUS - Double Invocation Investigation

### ⚠️ Issue Under Investigation: moveToNextStage Double Invocation

**Problem Confirmed:**
- State machine's `always` transition block in "evaluating" state is triggering `moveToNextStage` multiple times
- Test output shows workflow jumping from "initialization" → "validation", skipping "scaffolding"
- This confirms the double invocation hypothesis from Session #19

**Attempted Fix (Incomplete):**
Added idempotency guard to prevent re-evaluation:
- Added `_stageTransitionInProgress` flag to WorkflowContext
- Added `setTransitionInProgress` and `clearTransitionInProgress` actions
- Added `isNotTransitioningAlready` guard to prevent re-transition
- Added entry action to `running` state to clear flag

**Result:** Fix did NOT work - workflows still skip intermediate stages

**Root Cause Analysis:**
- Guard evaluation happens BEFORE action execution in xstate
- Flag is set too late in the action lifecycle to prevent the issue
- The always block may be re-evaluating AFTER the async moveToNextStage completes
- The clearTransitionInProgress runs synchronously before moveToNextStage completes (async)

**Next Steps for Session #21:**
1. Try clearing flag INSIDE the moveToNextStage action after it completes
2. Consider restructuring state machine to avoid always blocks with async actions
3. Add detailed logging to track exactly when moveToNextStage is invoked
4. Consider moving the stage transition logic OUT of the state machine action into a separate layer

---

## 🎯 SESSION #19 ACCOMPLISHMENTS & FINDINGS

### ✅ PRIMARY FIX: Initialization Task Dispatch Bug - COMPLETE

**Problem Identified:**
- Line 107 in `workflow.service.ts` was creating a `'scaffolding'` task instead of `'initialization'` task
- First workflow stage is always "initialization", but code was skipping it
- Caused workflows to get stuck at initialization forever, never transitioning to scaffolding

**Solution Implemented (commit e584802):**
```typescript
// BEFORE (BROKEN):
await this.createTaskForStage(workflow.id, 'scaffolding', { ... });

// AFTER (FIXED):
await this.createTaskForStage(workflow.id, 'initialization', { ... });
```

**Result:**
- ✅ Workflows now properly dispatch initialization task
- ✅ Initialization stage completes and workflow transitions to scaffolding
- ✅ Tests now progress from 0% (initialization) → next stage (was stuck indefinitely)

### ⚠️ SECONDARY ISSUE DISCOVERED: Handler Re-registration Bug

**Problem Identified During Testing:**
- `agent-dispatcher.service.ts` (lines 177-184): Result handlers are auto-removed after first stage completes
- Code comment says "Auto-cleanup handler after result is processed (workflow is complete or failed)"
- But handler is removed even for intermediate stages, not just final workflow completion
- Causes scaffolding (and subsequent stages) to have NO HANDLER registered when results arrive
- Workflow gets stuck at scaffolding stage (0% progress, never completes)

**Root Cause:**
```typescript
// In agent-dispatcher.service.ts handleAgentResult():
const status = result.payload?.status;
if (status === 'success' || status === 'failure') {
  this.offResult(result.workflow_id);  // ← BUG: Removes handler after EVERY stage
}
```

**Partial Fix Implemented:**
- Added handler re-registration in `workflow.service.ts` (lines 307-312)
- After each successful stage, re-registers the handler for next stage
- Prevents handler from being permanently removed

**Status:** Partially working - needs validation that re-registration is executing correctly for scaffolding and beyond

### 🔍 Key Findings - Workflow Message Flow

**Correct Flow (Currently):**
1. Workflow created → initialization task dispatched
2. Scaffold agent receives task, completes successfully
3. Agent publishes result to `orchestrator:results` Redis channel
4. Orchestrator receives result, calls handler
5. Handler sends `STAGE_COMPLETE` event to state machine
6. ✅ State machine transitions: initialization → scaffolding
7. Scaffolding task created and dispatched
8. Agent completes scaffolding task, publishes result
9. ❌ Orchestrator handler NOT found (was removed after init) → STUCK

### ⚠️ TERTIARY ISSUE: Multi-Stage Task Creation Gap

**Problem Discovered (Testing commit 9e297b2):**
- Initialization task is created and completes successfully
- State machine transitions from "initialization" → "scaffolding"
- But NO scaffolding task is created or dispatched
- Tests timeout at scaffolding stage (0% progress, waiting indefinitely)

**Root Cause:**
- `createWorkflow()` creates the initialization task (line 107 in workflow.service.ts)
- `handleTaskCompletion()` only sends `STAGE_COMPLETE` event to state machine
- State machine transitions to "scaffolding" but no task creation mechanism is triggered
- No scaffolding task exists to dispatch to agent

**Solution Pattern (for Session #20):**
After state machine transitions to a new stage:
1. Query current workflow stage
2. Create task for that stage via `createTaskForStage()`
3. Dispatch to appropriate agent
4. Repeat for each subsequent stage until workflow completes

**Implementation Approach:**
- Modify `handleTaskCompletion()` to create task for new stage AFTER sending STAGE_COMPLETE
- OR: Modify `handleAgentResult()` to create next task after completing current one
- Need to get next stage name from workflow or state machine
- Call `createTaskForStage()` for scaffolding after initialization completes

---

## 🎯 SESSION #19 ACCOMPLISHMENTS (In Progress - MOVED BELOW)

### ✅ Redis Subscription Pattern Refactoring - COMPLETE
**Discovery:** Identified recurring Redis subscription pattern in 3+ locations with same bug
- `agent-dispatcher.service.ts` (line 111)
- `event-bus.ts` (line 93)
- `base-agent.ts` (potential third location)

**Solution Created:** `RobustRedisSubscriber` utility class
- **File:** `packages/shared/utils/src/redis-subscription.ts`
- **Features:**
  - Promise-based `.subscribe().then()` API (IORedis v5.3.2 compatible)
  - Built-in reconnection with health checks (detects silent failures)
  - Comprehensive debug logging with timestamps
  - Configurable timeouts & automatic cleanup
  - Exported in `packages/shared/utils/src/index.ts`

**Implementation Status:**
- ✅ Utility created and exported
- ✅ Agent-dispatcher uses improved promise-based pattern
- ✅ Event-bus restored to working state with proper listeners
- ✅ Build passing: `pnpm --filter @agentic-sdlc/orchestrator build`

**Benefit:** Reusable pattern available for other services (BaseAgent, etc.)

---

## 🎯 SESSION #18 ACCOMPLISHMENTS & FINDINGS

### ✅ Redis Pub/Sub Message Delivery - FIXED
**Problem:** Agent results never reached orchestrator handlers, causing workflow timeouts
**Root Cause:** IORedis v5.3.2 callback-based `subscribe()` API doesn't work correctly
**Solution:** Switched to promise-based API in `agent-dispatcher.service.ts`

**Code Changes:**
- File: `packages/orchestrator/src/services/agent-dispatcher.service.ts`
- Refactored `setupResultListener()` to use `.subscribe().then()`
- Separated event listeners into `setupEventListeners()` (called once in constructor)
- Added comprehensive error logging with error object properties
- Added health check mechanism for silent failure detection

**Verification:**
```
✅ REDIS SUBSCRIBER CONNECTED
✅ SUCCESSFULLY SUBSCRIBED TO CHANNEL
📨 RAW MESSAGE RECEIVED FROM REDIS
✅ HANDLER FOUND - Executing callback
Stage completed
Workflow updated
```

**Commit:** `1277a28` - "fix: use promise-based IORedis subscribe API to fix message delivery"

### ❌ NEW ISSUE DISCOVERED: Initialization Stage Blocker
**Symptom:** Tests timeout at **initialization stage** (0% progress) instead of scaffolding stage
**Pattern:** Workflows never progress from "initialization" → "scaffolding"
**Impact:** No task dispatch occurs, workflow stuck indefinitely

**Test Data from 3 runs:**
- Test 1: Initialization timeout (300s)
- Test 2: Test parser error (multi-word name parsing bug)
- Test 3: Initialization timeout (300s)

**Key Observations:**
- Database queries continue (repeated workflow status polls)
- No dispatch logs appearing: "PUBLISHING TASK TO AGENT CHANNEL" never fires
- Stage status: stuck at "initiated" forever
- Earlier in session (commit analysis): dispatch WAS working before initialization became blocker

---

## 🎯 SESSION #16 PREP ACCOMPLISHMENTS

### 1️⃣ Calculator-Slate Template ✅
**Files:** 10 in `packages/agents/scaffold-agent/templates/app/calculator-slate/`
- React 19.2.0 + Vite 6.0.11, 350+ LOC
- Slate Nightfall design (dark, sky-blue accents)
- Full functionality: operations, keyboard, history panel
- Status: **Production-ready, 71% Zyp-compliant**
- Gap: Needs ESLint configuration & test templates

### 2️⃣ Zyp Platform Analysis ✅
**Compliance Findings:**
- Calculator: 71% (5/7 policies, 2/6 quality gates)
- Scaffold-Agent: 58% (4/7 policies)
- **Roadmap:** 5 phases to 100% (16-21 hours)
  1. Quality Gates (2-3h) → ESLint, Prettier, husky
  2. Testing (3-4h) → Vitest setup, 80% coverage
  3. API Patterns (4-5h) → Fastify, Zod, envelope
  4. Database (3-4h) → Prisma, isolation
  5. Full-Stack (4-5h) → Complete integration

### 3️⃣ ADR Governance Framework ✅ (Documented, NOT Operational)

**What's Done:**
- ✅ adr-index.json: 12 policies fully defined
- ✅ adr-template.md: Template for writing ADRs
- ✅ ADR-GOVERNANCE-INTEGRATION.md: Integration guide
- ✅ All exports ready (JSON format for consumption)

**What's NOT Done (Session #17-18 work - 16-24 hours):**
- ❌ Validation scripts (will read adr-index.json)
- ❌ Pre-commit hook integration
- ❌ CI/CD stage validators
- ❌ Scaffold-Agent ADR consumption
- ❌ Orchestrator ADR policy loading

**12 Core ADRs (Designed):**
0001-Guardrails | 0002-Contracts | 0003-Testing | 0004-Priority | 0005-Scaffolding | 0006-Layering | 0007-TypeScript | 0008-Versions | 0009-Database | 0010-Security | 0011-Performance | 0020-API | 0021-Events

---

## 📋 SESSION #19 ACTION ITEMS - FIX INITIALIZATION BLOCKER

**Priority:** CRITICAL - Blocks all pipeline tests from progressing

### Phase 1: Diagnosis (2-3 hours)
1. **Identify initialization logic**
   - Find where "initialization" stage is created/handled
   - Locate the code that should transition "initialization" → "scaffolding"
   - Check for error handling in initialization phase

2. **Collect diagnostic data**
   - Add enhanced logging to initialization stage handler
   - Check for failed agent registrations
   - Look for failed prerequisite checks
   - Verify agent readiness status

3. **Check scaffold-agent logs**
   - Confirm agent is running and listening for tasks
   - Check if agent receives task dispatch messages
   - Look for subscription/connection issues

### Phase 2: Fix (2-4 hours)
4. **Identify and fix initialization blocker**
   - Once root cause found, implement fix
   - Add validation/error messages for debugging
   - Ensure proper state transition

5. **Test progression**
   - Verify workflow moves from initialization to scaffolding
   - Confirm tasks are dispatched
   - Check message delivery through Redis

### Phase 3: Secondary Fixes (1-2 hours)
6. **Fix test script parsing**
   - Handle multi-word test names (e.g., "Hello World API")
   - Update `run-pipeline-test.sh` argument parsing

7. **Validate all tests**
   - Run all 8 pipeline tests
   - Confirm none timeout
   - Check for new issues

### Reference Data for Session 19
- **Issue Files:** SPRINT-18-ROOT-CAUSE-ANALYSIS.md, SPRINT-18-PREP.md
- **Fixed File:** packages/orchestrator/src/services/agent-dispatcher.service.ts
- **Test Command:** `./scripts/run-pipeline-test.sh "Hello World API"`
- **Logs Location:** scripts/logs/orchestrator.log, scripts/logs/scaffold-agent.log
- **Key Search Terms:** "initialization", "stage", "status", "workflow created"

---

## 📋 SESSION #17 ACTION ITEMS (COMPLETED)

✅ Session #17 successfully set foundation for testing framework
✅ All pipeline test infrastructure ready
⚠️ Pipeline tests blocked by initialization issue (discovered in Session #18)

---

## 🔗 KEY FILES REFERENCE

**Calculator & Integration**
- Templates: `packages/agents/scaffold-agent/templates/app/calculator-slate/`
- Integration Guide: `CALCULATOR-SLATE-INTEGRATION.md`
- Architecture Review: `CALCULATOR-ARCHITECTURE-REVIEW.md`

**Zyp Analysis & Compliance**
- Summary: `ZYP-PATTERNS-SUMMARY.md` (4 pages)
- Detailed: `ZYP-PATTERN-ANALYSIS-AND-ENHANCEMENTS.md` (40+ pages)

**ADR Governance**
- Template: `platform/governance/adr/adr-template.md`
- Registry: `platform/governance/adr/adr-index.json`
- Integration: `ADR-GOVERNANCE-INTEGRATION.md`

**Pipeline Testing**
- Framework: `PIPELINE-TESTING-FRAMEWORK.md`
- Test Cases: `PIPELINE-TEST-CASES.md`
- Environment Scripts: `scripts/env/`

---

## 📊 SYSTEM STATE

| Component | Current | Target | Timeline |
|-----------|---------|--------|----------|
| Calculator | 71% Zyp | 100% | 2-4 weeks |
| Scaffold-Agent | 58% policy | 100% | 3-4 weeks |
| ADR Framework | Documented | Operational | Session #17-18 |
| Pipeline Tests | 100% ready | 100% passing | Session #17 |

---

## 🏛️ PREVIOUS SESSION SUMMARY

**Session #15: Pipeline Testing Framework** ✅ COMPLETE
- 4 environment scripts (start, stop, reset, health)
- 1 test executor with real-time monitoring
- 8 reproducible test cases (Markdown-based)
- 2 comprehensive guides (754 lines)
- **Result:** One-command startup, repeatable tests, result capture

**Session #14: Tier 4+ Testing & Deployment** ✅ COMPLETE
- 21 Tier 4 integration test boxes (100% passing)
- Test coverage: 55% → 82% (42/77 → 63/77 boxes)
- Production deployment guides (500+ lines)
- Docker configuration files
- **Result:** Production readiness 10/10 verified

**Session #13: Phase 5 CI/CD** ✅ COMPLETE
- GitHub Actions workflows
- Integration testing procedures
- Release candidate policies

---

## 💡 IMPLEMENTATION NOTES

### ADR Important Clarification
- **adr-index.json:** Fully written, policies complete, ready to be consumed
- **Framework:** Complete with template and integration guide
- **Operational:** NOT YET IMPLEMENTED (this is Session #17-18 work)
- **Future scripts will:** Read adr-index.json, enforce policies, report violations

### Calculator Status
- **Framework:** Complete and functional
- **Zyp Compliance:** 71% (missing quality automation)
- **Path to 100%:** ESLint + Vitest setup (2-4 weeks)

### Pipeline Communication
- **Current Issue:** Workflow gets stuck at "scaffolding" (0% progress)
- **Root Cause:** Scaffold agent not receiving tasks from Redis
- **Debugging:** Run tests to isolate issue, check logs

---

## 🔍 REFERENCE

### Code Pattern Examples
- **Agent Integration:** See `ADR-GOVERNANCE-INTEGRATION.md` Part 3
- **Pre-Commit Hook:** See `adr-template.md` Appendix
- **CI/CD Integration:** See `ADR-GOVERNANCE-INTEGRATION.md` Phase 2

### Documentation Links
- Zyp Platform Policies: `/Users/Greg/Projects/apps/zyp/zyp-platform/knowledge-base/apps/`
- All ADR files: `platform/governance/adr/`
- Test framework: `scripts/env/` and `scripts/run-pipeline-test.sh`

---

**Ready for Session #17? Execute quickstart commands above or refer to specific documentation for details.**
