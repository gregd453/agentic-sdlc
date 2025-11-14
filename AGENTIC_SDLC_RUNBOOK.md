# Agentic SDLC Runbook

**Purpose:** Quick reference for debugging common issues in the Agentic SDLC system.
**Audience:** AI agents and developers troubleshooting workflow, agent, or orchestrator problems.
**Last Updated:** 2025-11-13 (Session #59)

---

## 🚨 Quick Diagnostics

### Check System Health

```bash
# 1. Check all services are running
pnpm pm2:status

# 2. Health check orchestrator
curl http://localhost:3000/health

# 3. Check Docker services
docker ps | grep -E "(postgres|redis)"

# 4. View recent logs
pnpm pm2:logs --lines 50
```

**Expected:**
- Orchestrator: online
- 3+ agents: online (scaffold, validation, e2e minimum)
- Postgres: healthy
- Redis: healthy

---

## 🔍 Workflow Stuck at 0% - Debug Checklist

**Symptom:** Workflow submits successfully but never advances from initialization stage.

### Step 1: Verify Workflow Created

```bash
# Get workflow ID from submission response
WORKFLOW_ID="<your-workflow-id>"

# Check orchestrator logs for workflow creation
grep -E "(WORKFLOW-TRACE|$WORKFLOW_ID)" scripts/logs/orchestrator-out.log | head -20
```

**Look for:**
- `🔍 [WORKFLOW-TRACE] Workflow created`
- `🔍 [WORKFLOW-TRACE] Task created and published`

**If missing:** Issue in `WorkflowService.createWorkflow()` or `createTaskForStage()`

### Step 2: Verify Task Published to Redis

```bash
# Monitor Redis pub/sub in real-time
docker exec -it agentic-sdlc-redis redis-cli

# In Redis CLI:
PSUBSCRIBE agent:*:tasks
```

Then submit a workflow in another terminal.

**Look for:** Message on `agent:scaffold:tasks` channel with workflow_id

**If missing:** Issue in `messageBus.publish()` or channel name mismatch

### Step 3: Verify Agent Receives Task

```bash
# Check scaffold agent logs
grep "AGENT-TRACE\|Task received" scripts/logs/scaffold-agent-out.log | tail -20
```

**Look for:**
- `🔍 [AGENT-TRACE] Task received`
- `workflow_id` matching your workflow

**If missing:**
- Agent subscription not working
- Channel name mismatch (check `agent:scaffold:tasks` vs `agent:scaffold:task`)
- Agent crashed/restarting

### Step 4: Verify Agent Publishes Result

```bash
# Monitor agent result channel
docker exec -it agentic-sdlc-redis redis-cli
PSUBSCRIBE agent:results
```

**Look for:** Result message with `success`, `status`, `workflow_id`

**If missing:**
- Agent execution failed (check agent error logs)
- `BaseAgent.reportResult()` not being called
- Schema validation failure in agent

### Step 5: Verify Orchestrator Receives Result

```bash
# Check orchestrator logs for result processing
grep "WORKFLOW-TRACE.*Agent result received" scripts/logs/orchestrator-out.log | tail -10
```

**Look for:**
- `🔍 [WORKFLOW-TRACE] Agent result received`
- `🔍 [WORKFLOW-TRACE] Sending STAGE_COMPLETE to state machine`

**If missing:**
- Orchestrator not subscribed to `agent:results`
- Schema validation failure (check error logs)
- Message bus adapter issue

---

## 🐛 Common Issues & Fixes

### Issue 1: Schema Import Errors

**Symptom:**
```
Cannot find module '@agentic-sdlc/shared-types/src/core/schemas'
Error: Invalid agent result - does not comply with AgentResultSchema
```

**Root Cause:** Direct imports to `/src/` paths fail in compiled code.

**Fix:**
```typescript
// ❌ WRONG
const { AgentResultSchema } = require('@agentic-sdlc/shared-types/src/core/schemas');

// ✅ CORRECT
const { AgentResultSchema } = await import('@agentic-sdlc/shared-types');
// or
import { AgentResultSchema } from '@agentic-sdlc/shared-types';
```

**Files to check:**
- `packages/orchestrator/src/services/workflow.service.ts`
- Any file importing from shared-types

### Issue 2: Agent Crashloop After Code Changes

**Symptom:** PM2 shows agent restarting repeatedly (high restart count)

**Root Cause:** Stale build cache or import errors

**Fix:**
```bash
# 1. Stop environment
./scripts/env/stop-dev.sh

# 2. Clean rebuild the affected agent
pnpm --filter @agentic-sdlc/scaffold-agent build

# 3. Start environment
./scripts/env/start-dev.sh

# 4. Check for errors
pnpm pm2:logs scaffold-agent --lines 50
```

**If still failing:** Check error logs for import/syntax errors

### Issue 3: Port Conflicts (EADDRINUSE)

**Symptom:**
```
Error: listen EADDRINUSE :::3000
```

**Root Cause:** Ghost process from previous session

**Fix:**
```bash
# Find process on port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use the script
./scripts/env/stop-dev.sh
```

### Issue 4: PM2 Commands Failing

**Symptom:**
```
[PM2][ERROR] File ecosystem.dev.config.js not found
```

**Root Cause:** Incorrect path in package.json scripts

**Fix:** Ensure all PM2 scripts use `pm2/ecosystem.dev.config.js`:
```json
{
  "scripts": {
    "pm2:start": "pm2 start pm2/ecosystem.dev.config.js",
    "pm2:stop": "pm2 stop pm2/ecosystem.dev.config.js",
    "pm2:restart": "pm2 restart pm2/ecosystem.dev.config.js"
  }
}
```

### Issue 5: Messages Not Routing Through Bus

**Symptom:** Tasks dispatched but agents never receive them

**Diagnosis:**
```bash
# Check Redis channels
docker exec -it agentic-sdlc-redis redis-cli

# List all active channels
PUBSUB CHANNELS agent:*

# Monitor all agent traffic
PSUBSCRIBE agent:*
```

**Common Causes:**
1. **Channel name mismatch:** `agent:scaffold:tasks` vs `agent:scaffold:task`
2. **Wrong Redis instance:** Check `REDIS_HOST` and `REDIS_PORT` env vars
3. **Message bus not initialized:** Check orchestrator startup logs

**Fix:**
- Verify channel names in `REDIS_CHANNELS` constants (`packages/shared/types/src/constants/`)
- Ensure all agents use same Redis connection settings
- Check `messageBus.subscribe()` calls match `messageBus.publish()` topics

---

## 🔧 Adding Trace Logging

When debugging new issues, add trace logs to track execution flow:

### Orchestrator (workflow.service.ts)

```typescript
logger.info('🔍 [WORKFLOW-TRACE] <Event Description>', {
  workflow_id,
  stage,
  // ... relevant context
});
```

**Key locations:**
- Workflow creation
- Task dispatch
- Agent result receipt
- State machine transitions

### Agents (base-agent.ts or specific agent)

```typescript
this.logger.info('🔍 [AGENT-TRACE] <Event Description>', {
  workflow_id,
  task_id,
  // ... relevant context
});
```

**Key locations:**
- Task receipt
- Execution start/end
- Result publishing

### Viewing Traces

```bash
# Grep all trace logs for a workflow
grep "WORKFLOW-TRACE.*<workflow-id>" scripts/logs/orchestrator-out.log

# Grep all agent traces
grep "AGENT-TRACE.*<workflow-id>" scripts/logs/scaffold-agent-out.log

# Live tail with traces
pnpm pm2:logs | grep -E "(WORKFLOW-TRACE|AGENT-TRACE)"
```

---

## 📊 Message Flow Verification

### Complete Pipeline Check

```bash
# Terminal 1: Monitor agent task channel
docker exec -it agentic-sdlc-redis redis-cli
PSUBSCRIBE agent:*:tasks

# Terminal 2: Monitor result channel
docker exec -it agentic-sdlc-redis redis-cli
PSUBSCRIBE agent:results

# Terminal 3: Submit workflow
curl -X POST http://localhost:3000/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "type":"app",
    "name":"test-workflow",
    "description":"Debug test",
    "requirements":"Simple test",
    "priority":"medium"
  }'
```

**Expected Flow:**
1. Terminal 1: See task message on `agent:scaffold:tasks`
2. Terminal 2: See result message on `agent:results` (2-5 seconds later)
3. Orchestrator logs: See STAGE_COMPLETE

**If flow breaks:** Note where it stops and debug that component

---

## ⚠️ Known Monitoring Gaps

These areas lack sufficient logging for debugging:

### 1. State Machine Transitions
**Gap:** No trace logging inside state machine for transitions or stage completion logic
```bash
# Can see result going TO state machine but not what happens inside
tail -f scripts/logs/orchestrator-out.log | grep "STAGE_COMPLETE"
```
**Impact:** Workflow advancement failures inside state machine are silent
**Location:** `packages/orchestrator/src/state-machine/workflow-state-machine.ts:handleStageComplete()`

### 2. Agent Task Execution Errors
**Gap:** Errors logged as "Task execution failed" without error details or stack traces
```bash
# See failures but not root cause
tail -f scripts/logs/scaffold-agent-out.log | grep -B 5 "Task execution failed"
```
**Impact:** Must add debugging to agent executeTask() to see actual error
**Location:** `packages/agents/base-agent/src/base-agent.ts:handleTask()` error handling

### 3. Workflow Advancement Logic
**Gap:** When workflows stuck at 0%, no logging shows why state machine didn't advance
```bash
# Check full pipeline for specific workflow
WORKFLOW_ID="xxx"
grep "$WORKFLOW_ID" scripts/logs/orchestrator-out.log scripts/logs/*-agent-out.log
```
**Impact:** Workflows stuck at 0% with no error indication
**Diagnosis:** Check state machine stage transition conditions and add trace logs

### Existing Trace Logging (Added Session #59)
**✅ Already instrumented:**
- `workflow.service.ts`: Workflow creation, task dispatch, result receipt, STAGE_COMPLETE message
- `base-agent.ts`: Task receipt, result publishing
- Use: `grep "WORKFLOW-TRACE\|AGENT-TRACE" scripts/logs/*.log`

### Quick Gap Diagnostics
```bash
# Verify agent is receiving AND executing tasks (not just receiving)
tail -100 scripts/logs/scaffold-agent-out.log | grep -E "(AGENT-TRACE|Task received|Publishing result)"

# Check for errors in orchestrator (excluding Redis connection noise)
tail -200 scripts/logs/orchestrator-out.log | grep -iE "(error|fail|exception)" | grep -v "ECONNREFUSED"

# Trace complete flow for workflow ID
WORKFLOW_ID="xxx"
echo "=== Orchestrator ===" && grep "$WORKFLOW_ID" scripts/logs/orchestrator-out.log
echo "=== Agents ===" && grep "$WORKFLOW_ID" scripts/logs/*-agent-out.log
```

---

## 🔄 Clean Environment Reset

When all else fails, full reset:

```bash
# 1. Stop everything
./scripts/env/stop-dev.sh

# 2. Clean all builds
pnpm clean

# 3. Rebuild everything
pnpm build

# 4. Restart environment
./scripts/env/start-dev.sh

# 5. Verify health
curl http://localhost:3000/health
pnpm pm2:status
```

---

## 📝 Log Locations

```bash
# PM2 process logs (live)
scripts/logs/orchestrator-out.log      # Orchestrator stdout
scripts/logs/orchestrator-error.log    # Orchestrator stderr
scripts/logs/scaffold-agent-out.log    # Scaffold agent stdout
scripts/logs/scaffold-agent-error.log  # Scaffold agent stderr
# ... similar for other agents

# View all logs
ls -lh scripts/logs/

# Tail specific log
tail -f scripts/logs/orchestrator-out.log

# Grep across all logs
grep -r "ERROR" scripts/logs/
```

---

## 🎯 Debugging Strategy

### For Workflow Issues

1. **Start from the top:** Verify workflow creation
2. **Follow the message:** Track through each step of pipeline
3. **Use trace logs:** Grep for `WORKFLOW-TRACE` and workflow_id
4. **Check Redis:** Monitor pub/sub channels in real-time
5. **Isolate component:** Find where the chain breaks

### For Agent Issues

1. **Check agent logs:** Look for errors or missing trace logs
2. **Verify subscription:** Ensure agent subscribes to correct channel
3. **Test execution:** Check if agent can execute tasks (may be Claude API issue)
4. **Validate schema:** Ensure agent result matches AgentResultSchema

### For Message Bus Issues

1. **Monitor Redis:** Use `PSUBSCRIBE` to watch traffic
2. **Check adapter:** Review `redis-bus.adapter.ts` for errors
3. **Verify channels:** Ensure publish/subscribe use same topic names
4. **Test connectivity:** Confirm Redis is reachable from all services

---

## 🚀 Quick Commands Reference

```bash
# Environment
./scripts/env/start-dev.sh              # Start all services
./scripts/env/stop-dev.sh               # Stop all services
./scripts/env/check-health.sh           # Health check

# PM2 Management
pnpm pm2:status                         # Process status
pnpm pm2:logs                           # Tail logs
pnpm pm2:restart orchestrator           # Restart service
pnpm pm2:restart                        # Restart all

# Testing
./scripts/run-pipeline-test.sh "Hello World API"  # Run test
./scripts/run-pipeline-test.sh --list            # List tests

# Rebuild
pnpm --filter @agentic-sdlc/orchestrator build   # Single package
pnpm build                                        # All packages

# Redis CLI
docker exec -it agentic-sdlc-redis redis-cli     # Enter Redis CLI
```

---

## 📞 Escalation

If none of these steps resolve the issue:

1. **Capture full logs:**
   ```bash
   pnpm pm2:logs --lines 500 > debug-logs.txt
   tail -500 scripts/logs/orchestrator-error.log >> debug-logs.txt
   ```

2. **Document the issue:**
   - What you were trying to do
   - Steps you took
   - Where the pipeline breaks
   - Error messages
   - Workflow ID

3. **Check CLAUDE.md:** Review recent session notes for similar issues

4. **Create investigation report:** Use `SESSION_XX_INVESTIGATION_REPORT.md` template

---

**Remember:** Most workflow issues are in the pipeline flow, not infrastructure. Use trace logging and Redis monitoring to pinpoint exactly where the message chain breaks.
