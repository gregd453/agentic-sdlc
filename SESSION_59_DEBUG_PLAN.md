# Session #59 - Workflow Debug Plan

**Date:** 2025-11-13
**Status:** Ready to Execute
**Focus:** Fix "0% stuck" workflow advancement issue

---

## 🎯 Problem Statement

**Symptoms:**
- Orchestrator and 3 core agents running stable
- Workflows submit successfully but stuck at 0% initialization
- No visible errors in logs

**Root Cause Hypothesis:**
The workflow → task → agent → result → state-machine pipeline is broken at some point. Need to instrument each step to find where the chain breaks.

---

## ✅ What Was Done Well (Session #58)

Your partner successfully debugged several infrastructure issues:

1. **Orchestrator startup bug** - Added missing `if (require.main === module)` block
2. **Port conflict** - Killed ghost process blocking :3000
3. **Stale builds** - Rebuilt integration/deployment agents
4. **Stable environment** - Got orchestrator + 3 agents running under PM2

This was solid bootstrap-phase debugging.

---

## ⚠️ Identified Risks & Gaps

### A. PM2 Configuration Issues

**Problem:**
```bash
[PM2][ERROR] File ecosystem.dev.config.js not found
```

**Root Cause:**
- Scripts reference `ecosystem.dev.config.js` without path
- Actual config may be in `pm2/` subdirectory
- CLI commands fail due to wrong path

**Impact:** Medium (affects DX, not runtime)

### B. Integration/Deployment Agents Still Crashing

**Problem:**
- PM2 shows 38+ restarts
- Error logs stale since 17:32
- No new error output

**Possible Causes:**
1. Wrong log paths configured in PM2
2. Process exits before logger initializes
3. Import/require error at module load time

**Impact:** Low (not needed for initialization stage)
**Decision:** Park for now, focus on initialization flow

### C. Workflow Stuck at 0% (Primary Issue)

**Problem:** Pipeline never advances from initialization stage

**Possible Break Points:**
1. ❓ Initialization task never created
2. ❓ Task created but not dispatched to Redis
3. ❓ Task dispatched but agent never receives it
4. ❓ Agent receives but never publishes result
5. ❓ Result published but doesn't reach `agent:results`
6. ❓ Orchestrator receives but schema validation fails
7. ❓ Result processed but `STAGE_COMPLETE` not emitted
8. ❓ `STAGE_COMPLETE` emitted but state machine doesn't transition

---

## 🔍 Debugging Strategy

### Phase: Instrumentation (Not Bootstrap)

We're past the "get it running" phase. Now we need **signal on the path** to see where the workflow chain breaks.

**Approach:**
- Add trace logging at each key step
- Use a single workflow_id to grep a complete narrative
- Verify data at each layer (DB → Redis → Agent → Redis → Orchestrator → State Machine)

---

## 📋 Step-by-Step Debug Plan

### Step 0: Fix PM2 Configuration (Quick Win)

**Goal:** Normalize PM2 scripts so CLI commands work

**Actions:**
1. Verify PM2 config location:
   ```bash
   find . -name "ecosystem.dev.config.js" -o -name "ecosystem.*.js"
   ```

2. Update `package.json` scripts to use correct path:
   ```json
   {
     "scripts": {
       "pm2:start": "pm2 start pm2/ecosystem.dev.config.js",
       "pm2:stop": "pm2 stop pm2/ecosystem.dev.config.js",
       "pm2:restart": "pm2 restart pm2/ecosystem.dev.config.js",
       "pm2:status": "pm2 status",
       "pm2:logs": "pm2 logs",
       "pm2:monit": "pm2 monit"
     }
   }
   ```

3. Test:
   ```bash
   pnpm pm2:status  # Should work without error
   ```

**Expected:** PM2 commands work reliably

---

### Step 1: Verify Workflow & Task in Database

**Goal:** Confirm workflow and initialization task exist in Postgres

**Actions:**

1. Run a test workflow:
   ```bash
   ./scripts/run-pipeline-test.sh "Hello World API"
   ```

2. Capture the workflow_id from output or logs

3. Query Postgres:
   ```sql
   -- Check workflow exists and status
   SELECT id, status, current_stage, progress, created_at
   FROM workflows
   ORDER BY created_at DESC
   LIMIT 5;

   -- Check initialization task exists
   SELECT id, workflow_id, stage, status, agent_type, created_at
   FROM workflow_tasks
   WHERE workflow_id = '<workflow-id>'
   ORDER BY created_at ASC;
   ```

**Expected Results:**
- ✅ Workflow row with `status = 'in_progress'` and `current_stage = 'initialization'`
- ✅ Task row with `stage = 'initialization'` and `status = 'pending'` or `'in_progress'`

**If Missing:**
- Bug is in `createWorkflow()` or `createTaskForStage()` logic
- Check: `packages/orchestrator/src/services/workflow.service.ts`

**If Present:** → Go to Step 2

---

### Step 2: Confirm Task Published to Redis

**Goal:** Verify task is published to `agent:scaffold:tasks` topic

**Actions:**

1. Open Redis CLI:
   ```bash
   docker exec -it $(docker ps -q -f name=redis) redis-cli
   ```

2. Subscribe to agent task channels:
   ```
   PSUBSCRIBE agent:*:tasks
   ```

3. In another terminal, run test:
   ```bash
   ./scripts/run-pipeline-test.sh "Hello World API"
   ```

4. Watch for message like:
   ```json
   {
     "task_id": "task_...",
     "workflow_id": "wf_...",
     "agent_type": "scaffold",
     "stage": "initialization",
     "payload": { ... }
   }
   ```

**Expected Result:**
- ✅ Message appears on `agent:scaffold:tasks` channel

**If Missing:**
- Bug is in `WorkflowService.createTaskForStage()` or `messageBus.publish()`
- Check: `packages/orchestrator/src/services/workflow.service.ts` dispatch logic
- Verify channel name format matches agent subscription

**If Present:** → Go to Step 3

---

### Step 3: Confirm Scaffold Agent Receives Task

**Goal:** Verify scaffold-agent logs task receipt

**Actions:**

1. Tail scaffold-agent logs:
   ```bash
   tail -f scripts/logs/scaffold-agent.log
   # or
   pnpm pm2:logs scaffold-agent
   ```

2. Run test workflow

3. Look for:
   - ✅ "subscribed to agent:scaffold:tasks"
   - ✅ "received task assignment" with workflow_id
   - ✅ Task processing started

**Expected Result:**
- ✅ Agent logs show task received and processing started

**If Missing:**
- Agent is subscribed to wrong topic name (typo: `task` vs `tasks`)
- Message bus routing is incorrect
- Check: `packages/agents/scaffold-agent/src/run-agent.ts` subscription logic
- Check: `packages/agents/base-agent/src/base-agent.ts` message handling

**If Present:** → Go to Step 4

---

### Step 4: Confirm Agent Publishes Result

**Goal:** Verify agent result published to `agent:results` topic

**Actions:**

1. In Redis CLI:
   ```
   PSUBSCRIBE agent:results
   ```

2. Run test workflow

3. Watch for result envelope:
   ```json
   {
     "workflow_id": "wf_...",
     "task_id": "task_...",
     "stage": "initialization",
     "agent_type": "scaffold",
     "status": "success",
     "result": { ... },
     "execution_time_ms": 1234
   }
   ```

**Expected Result:**
- ✅ Result message published to `agent:results`

**If Missing:**
- Bug is in `BaseAgent.reportResult()` or scaffold agent's result reporting
- Check: `packages/agents/base-agent/src/base-agent.ts` reportResult method
- Check: Scaffold agent calls `reportResult()` correctly
- Check: Error handling doesn't swallow exceptions

**If Present:** → Go to Step 5

---

### Step 5: Confirm Orchestrator Handles Result

**Goal:** Verify `handleAgentResultFromBus` fires and emits `STAGE_COMPLETE`

**Actions:**

1. Add trace logging to WorkflowService (temporary):
   ```typescript
   // In packages/orchestrator/src/services/workflow.service.ts
   async handleAgentResultFromBus(envelope: AgentResultSchema) {
     logger.info('🔍 [TRACE] handleAgentResultFromBus invoked', {
       workflow_id: envelope.workflow_id,
       stage: envelope.stage,
       status: envelope.status,
       agent_type: envelope.agent_type
     });

     // ... existing code ...

     logger.info('🔍 [TRACE] Emitting STAGE_COMPLETE event', {
       workflow_id,
       stage: envelope.stage
     });

     this.eventBus.publish(DomainEvents.STAGE_COMPLETE, {
       workflowId: workflow_id,
       stage: envelope.stage,
       result: envelope.result
     });

     logger.info('🔍 [TRACE] STAGE_COMPLETE event emitted');
   }
   ```

2. Rebuild orchestrator:
   ```bash
   pnpm --filter @agentic-sdlc/orchestrator build
   ```

3. Restart orchestrator:
   ```bash
   pnpm pm2:restart orchestrator
   ```

4. Run test and watch orchestrator logs:
   ```bash
   pnpm pm2:logs orchestrator | grep TRACE
   ```

**Expected Results:**
- ✅ `handleAgentResultFromBus invoked` log appears
- ✅ `Emitting STAGE_COMPLETE event` log appears
- ✅ `STAGE_COMPLETE event emitted` log appears

**Failure Scenarios:**

**A. No "invoked" log:**
- Orchestrator not subscribed to `agent:results` correctly
- Check: `packages/orchestrator/src/hexagonal/adapters/redis-bus.adapter.ts` subscription
- Check: Handler registration in container initialization

**B. "invoked" but workflow doesn't advance:**
- Bug in `storeStageOutput()` (doesn't update DB)
- Bug in `eventBus.publish(STAGE_COMPLETE)` (not actually publishing)
- State machine not subscribed to `STAGE_COMPLETE`
- Check: `packages/orchestrator/src/services/workflow-state-machine.service.ts`

**C. "STAGE_COMPLETE emitted" but still no progress:**
- State machine not instantiated per workflow
- State machine mapping from `STAGE_COMPLETE` → nextStage is broken
- Check: `WorkflowStateMachineService.handleStageComplete()` logic

---

## 🔧 Implementation: Add Workflow Trace Logging

To make the above debugging easier, add trace logging at key points:

### Files to Instrument:

1. **`packages/orchestrator/src/services/workflow.service.ts`**
   ```typescript
   // In createWorkflow()
   logger.info('🔍 [WORKFLOW-TRACE] Workflow created', {
     workflow_id: workflow.id,
     current_stage: 'initialization'
   });

   // In createTaskForStage()
   logger.info('🔍 [WORKFLOW-TRACE] Task created and published', {
     workflow_id,
     task_id: task.id,
     stage,
     agent_type,
     channel: `agent:${agent_type}:tasks`
   });

   // In handleAgentResultFromBus()
   logger.info('🔍 [WORKFLOW-TRACE] Agent result received', {
     workflow_id: envelope.workflow_id,
     stage: envelope.stage,
     status: envelope.status
   });

   logger.info('🔍 [WORKFLOW-TRACE] Emitting STAGE_COMPLETE', {
     workflow_id: envelope.workflow_id,
     stage: envelope.stage
   });
   ```

2. **`packages/agents/base-agent/src/base-agent.ts`**
   ```typescript
   // In message handler
   logger.info('🔍 [AGENT-TRACE] Task received', {
     workflow_id: task.workflow_id,
     task_id: task.task_id,
     stage: task.stage
   });

   // In reportResult()
   logger.info('🔍 [AGENT-TRACE] Publishing result', {
     workflow_id: this.currentTask?.workflow_id,
     stage: this.currentTask?.stage,
     status: result.status,
     channel: 'agent:results'
   });
   ```

3. **`packages/orchestrator/src/services/workflow-state-machine.service.ts`**
   ```typescript
   // In handleStageComplete()
   logger.info('🔍 [STATE-MACHINE-TRACE] STAGE_COMPLETE received', {
     workflow_id: data.workflowId,
     stage: data.stage
   });

   logger.info('🔍 [STATE-MACHINE-TRACE] Transitioning to next stage', {
     workflow_id: data.workflowId,
     from_stage: data.stage,
     to_stage: nextStage
   });
   ```

### Rebuild After Adding Logs:
```bash
pnpm build
pnpm pm2:restart
```

### Grep for Complete Workflow Narrative:
```bash
# Replace <workflow-id> with actual ID
pnpm pm2:logs | grep "WORKFLOW-TRACE.*<workflow-id>"
pnpm pm2:logs | grep "AGENT-TRACE.*<workflow-id>"
pnpm pm2:logs | grep "STATE-MACHINE-TRACE.*<workflow-id>"
```

This gives you a chronological story of the workflow's journey through the system.

---

## 📊 Expected Outcomes

### Success Criteria:
- ✅ PM2 scripts work reliably
- ✅ Complete trace logging from workflow creation → completion
- ✅ Identified exact break point in pipeline (DB, Redis pub, agent receive, Redis pub, orchestrator receive, or state machine)
- ✅ Root cause identified with specific file and line number
- ✅ Ready to implement fix

### Failure Modes & Next Steps:

| Break Point | Root Cause Area | Next Action |
|-------------|----------------|-------------|
| No task in DB | Workflow creation logic | Debug `createWorkflow()` / `createTaskForStage()` |
| Task not published | Message bus publish | Debug `messageBus.publish()` in WorkflowService |
| Agent doesn't receive | Subscription mismatch | Fix channel name or subscription pattern |
| Agent doesn't publish result | Agent result reporting | Debug `BaseAgent.reportResult()` |
| Result not on Redis | Message bus publish (agent) | Debug agent's `messageBus.publish()` call |
| Orchestrator doesn't receive | Subscription issue | Debug `redis-bus.adapter.ts` subscription |
| Result received but no STAGE_COMPLETE | Event bus issue | Debug `eventBus.publish()` in WorkflowService |
| STAGE_COMPLETE but no transition | State machine issue | Debug `WorkflowStateMachineService.handleStageComplete()` |

---

## 🎯 Next Session Priorities

### High Priority (Block workflow advancement):
1. Execute Steps 0-5 above
2. Identify break point in pipeline
3. Implement fix
4. Validate workflow advances to scaffolding stage

### Medium Priority (After workflow works):
1. Fix integration/deployment agent crashloops
2. Investigate stale log issue

### Low Priority (Technical debt):
1. ESLint configuration (see `ESLINT_ISSUES_REPORT.md`)
2. PM2 config cleanup

---

## 📝 Notes for Next Session

**Strategic Mindset:**
- We're in **instrumentation phase**, not bootstrap phase
- Infrastructure is stable; focus on business logic flow
- Park integration/deployment issues temporarily
- Single workflow_id trace is more valuable than scanning all logs

**Key Insight:**
> "The only way you get 'stuck at 0%' is if the workflow → task → agent → result → state-machine pipeline breaks somewhere. We just need to find where."

**Success Metric:**
> A single grep command shows the complete journey of one workflow_id through all layers of the system.

---

**Status:** Ready to execute
**Estimated Time:** 2-3 hours (instrumentation + debugging + fix)
**Confidence:** High (architecture is sound, just need to find the break point)
