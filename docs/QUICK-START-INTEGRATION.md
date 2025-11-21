# Quick Start: Integration Checklist
**Use this while implementing the 6 phases**

---

## Phase 1: Bootstrap ✓ Do First

**File:** `packages/orchestrator/src/server.ts`

```bash
[ ] Import OrchestratorContainer
[ ] Create container with OrchestratorContainer config
[ ] await container.initialize()
[ ] Get messageBus = container.getBus()
[ ] Pass messageBus to WorkflowService constructor
[ ] Add fastify close hook with container.shutdown()
[ ] Start server, verify "Container initialized successfully" in logs
```

**Checkpoint 1 Test:**
```bash
./scripts/env/start-dev.sh  # Should start without errors
curl http://localhost:3000/health  # Should respond
grep "Container initialized" scripts/logs/orchestrator.log  # Should find log
```

---

## Phase 2: Subscribe ✓ Do Second

**File:** `packages/orchestrator/src/services/workflow.service.ts`

```bash
[ ] Import IMessageBus interface
[ ] Change constructor parameter: agentDispatcher → messageBus: IMessageBus
[ ] In setupEventHandlers(), add: await this.messageBus.subscribe('agent:results', handler)
[ ] Create handleAgentResultFromBus() method
[ ] Move logic from old handleAgentResult to handleAgentResultFromBus
[ ] Publish STAGE_COMPLETE event to EventBus (not callback)
[ ] Delete all old handler registration code
[ ] Delete resultHandlers Map and cleanup logic
```

**Checkpoint 2 Test:**
```bash
Create workflow via API
curl -X POST http://localhost:3000/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d '{"type":"app","name":"Test","requirements":"Build test"}'
grep "SUBSCRIBED\|agent:results" scripts/logs/orchestrator.log  # Should find
```

---

## Phase 3: Agents ✓ Do Third

**Files:** All `*-agent/src/run-agent.ts` and `base-agent.ts`

### For each agent (scaffold, validation, e2e, integration, deployment):

```bash
[ ] Import OrchestratorContainer
[ ] In main(): const container = new OrchestratorContainer(...)
[ ] await container.initialize()
[ ] const messageBus = container.getBus()
[ ] const agent = new YourAgent(messageBus)
[ ] await messageBus.subscribe(REDIS_CHANNELS.AGENT_TASKS('type'), handler)
[ ] In BaseAgent.reportResult(): await this.messageBus.publish('agent:results', ...)
[ ] Include mirrorToStream option for durability
[ ] Remove all raw redisPublisher.publish() calls
```

**Checkpoint 3 Test:**
```bash
# Restart agents
pkill -f "agent"
sleep 2
npm run dev:agents  # or however agents are started

# Check logs
tail scripts/logs/scaffold-agent.log | grep "listening\|ready"
tail scripts/logs/orchestrator.log | grep "Result published\|agent:results"
```

---

## Phase 4: State Machine ✓ Do Fourth

**File:** `packages/orchestrator/src/state-machine/workflow-state-machine.ts`

```bash
[ ] In constructor, verify EventBus subscription for STAGE_COMPLETE
[ ] Create handleStageComplete() method
[ ] In handler: get state machine, send event
[ ] Update database with new stage
[ ] Calculate progress percentage
[ ] No changes to xstate logic (already correct)
```

**Checkpoint 4 Test:**
```bash
Create workflow
Simulate agent completing: messageBus.publish('agent:results', {...})
grep "State machine transition\|STAGE_COMPLETE" scripts/logs/orchestrator.log
Check database: SELECT current_stage FROM Workflow WHERE id='...'  # Should be validation
```

---

## Phase 5: Contracts ✓ Do Fifth

**File:** `packages/orchestrator/src/services/workflow.service.ts`

```bash
[ ] Import SchemaRegistry from '@agentic-sdlc/shared-types'
[ ] In handleAgentResultFromBus(), add schema validation
[ ] Wrap in try-catch, log validation errors
[ ] Only process if validation passes
[ ] Publish VALIDATION_FAILED event on error
```

**Checkpoint 5 Test:**
```bash
Publish invalid result
grep "SCHEMA_VALID\|SCHEMA_INVALID" scripts/logs/orchestrator.log
grep "Result passed schema\|failed validation" scripts/logs/orchestrator.log
```

---

## Phase 6: Persistence ✓ Do Last

**File:** `packages/orchestrator/src/services/workflow.service.ts`

```bash
[ ] Get kvStore from container
[ ] After each stage: await kvStore.set('workflow:id:state', {...})
[ ] Include current_stage, progress, outputs
[ ] Set TTL (3600 = 1 hour)
[ ] Optional: Implement replay from Redis streams on startup
```

**Checkpoint 6 Test:**
```bash
Check KV store:
redis-cli -p 6380
> GET agentic-sdlc:workflow:id:state
Should return JSON with state

Service restart:
Kill orchestrator, restart
Service should recover state from KV
```

---

## Full Integration Test ✓ Do At End

```bash
# Start fresh environment
./scripts/env/stop-dev.sh
./scripts/env/start-dev.sh

# Run pipeline tests
./scripts/run-pipeline-test.sh --all

# Expected output:
# ✓ Slate Nightfall Calculator
# ✓ Hello World API
# ✓ React Dashboard
# ✓ Form Application
# ✓ Todo List
# (all with 100% completion and proper status transitions)

# Check logs for errors
grep -i "error\|fail\|exception" scripts/logs/orchestrator.log | head -20
# Should be minimal/none
```

---

## Cleanup ✓ Do After All Tests Pass

```bash
[ ] Delete AgentDispatcherService (no longer used)
[ ] Delete all handler lifecycle code
[ ] Remove any old callback references
[ ] Run tests again (should still pass)
[ ] Commit changes
```

---

## Common Issues & Fixes

### "No handler found for topic"
- Check if subscription happened: `grep "SUBSCRIBED" logs/orchestrator.log`
- Check if message published: `grep "agent:results" logs`
- Verify topic name matches: should be `agent:results` everywhere

### "State machine not transitioning"
- Check STAGE_COMPLETE event published: `grep "STAGE_COMPLETE" logs`
- Check event bus subscription: `grep "subscribed" logs/orchestrator.log`
- Verify state machine received event: `grep "handleStageComplete\|transition" logs`

### "Workflow stuck at 0%"
- Workflow created but no results received
- Check agent logs: `tail -f logs/scaffold-agent.log`
- Check Redis connectivity: `redis-cli -p 6380 PING` should return PONG
- Check if agent subscribes to task channel

### "Container initialization failed"
- Check Redis running: `ps aux | grep redis`
- Check Redis port: `lsof -i :6380`
- Check redisUrl in config: should be `redis://localhost:6380`

---

## Files Modified Summary

| File | Phase | Change |
|------|-------|--------|
| server.ts | 1 | Container init |
| workflow.service.ts | 2,5,6 | Bus subscribe, validation, persistence |
| workflow-state-machine.ts | 4 | Event handling verification |
| base-agent.ts | 3 | Message bus publish |
| 5x run-agent.ts | 3 | Container init, bus get |

---

## Verification Commands

```bash
# Check subscription happened
grep -c "agent:results" scripts/logs/orchestrator.log  # Should be > 0

# Check results published
grep -c "Result published" scripts/logs/orchestrator.log  # Should match completed tasks

# Check state transitions
grep -c "State machine transition" scripts/logs/orchestrator.log  # Should match stages

# Check no errors
grep -i "error\|failed\|exception" scripts/logs/orchestrator.log | wc -l  # Should be minimal

# Final test
npm run test  # All tests should pass
```

---

**Status:** Ready to implement
**Next:** Start with Phase 1 (server.ts)
**Est. Time:** 8 hours total
**Questions:** See STRATEGIC-DESIGN-REDIS-API-INTEGRATION.md for details
