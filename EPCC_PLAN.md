# Implementation Plan: Strategic Architecture Migration

**Date:** 2025-11-13 (Session #57)
**Status:** Planning Complete - Ready for Implementation
**Objective:** Replace hybrid callback-based architecture with unified event-driven hexagonal architecture
**Timeline:** 8 hours (6 hours implementation + 2 hours validation)
**Priority:** CRITICAL (P0) - Blocks all workflow execution

---

## Executive Summary

### What We're Building

A **complete migration** from the current hybrid architecture (callback-based AgentDispatcherService + partial message bus) to a **fully symmetric, event-driven hexagonal architecture** where all components communicate exclusively via IMessageBus.

### Why It's Needed

**Current State:**
- ❌ Workflows timeout at first stage (0% E2E completion rate)
- ❌ Handler lifecycle issues (handlers lost after first stage)
- ❌ Asymmetric architecture (agents receive via bus, send via Redis)
- ❌ AgentDispatcherService creates callback hell
- ❌ No persistence or replay capability

**Target State:**
- ✅ Workflows complete all 6 stages successfully
- ✅ 100% E2E test pass rate
- ✅ Symmetric architecture (IMessageBus on both sides)
- ✅ Single persistent subscription (no handler lifecycle)
- ✅ Type-safe, testable, production-ready

### Success Criteria

- [ ] All 5+ pipeline tests complete successfully (`./scripts/run-pipeline-test.sh --all`)
- [ ] Workflows progress through all 6 stages (initialization → deployment)
- [ ] Progress percentage updates correctly (0% → 100%)
- [ ] Workflow status transitions to "completed"
- [ ] All stage outputs stored in database
- [ ] No handler lifecycle errors in logs
- [ ] AgentDispatcherService completely removed
- [ ] All builds pass: `turbo run build`
- [ ] All type checks pass: `turbo run typecheck`
- [ ] All lints pass: `turbo run lint`
- [ ] All unit tests pass: `pnpm test`
- [ ] Zero TypeScript errors
- [ ] Zero ESLint warnings

### Non-Goals (What We're NOT Doing)

- ✗ Not adding new features or agents
- ✗ Not changing database schema
- ✗ Not modifying state machine transitions
- ✗ Not optimizing performance (separate effort)
- ✗ Not adding new hexagonal components (already exist)
- ✗ Not changing API contracts or endpoints

---

## Technical Approach

### High-Level Architecture Change

```
BEFORE (Hybrid - BROKEN):
┌──────────────┐                     ┌──────────────┐
│ Orchestrator │                     │    Agent     │
├──────────────┤                     ├──────────────┤
│ Task Dispatch│ ─────Redis─────→   │Task Reception│
│   (direct)   │                     │  (IMessageBus)│
│              │                     │              │
│Result Handler│ ←────Redis─────    │Result Report │
│  (callback)  │                     │   (direct)   │
└──────────────┘                     └──────────────┘
      ↑
  AgentDispatcherService
  (callback hell)

AFTER (Symmetric - WORKING):
┌──────────────┐                     ┌──────────────┐
│ Orchestrator │                     │    Agent     │
├──────────────┤                     ├──────────────┤
│ Task Dispatch│ ──IMessageBus──→   │Task Reception│
│ (IMessageBus)│                     │ (IMessageBus)│
│              │                     │              │
│Result Handler│ ←─IMessageBus──    │Result Report │
│(IMessageBus) │                     │ (IMessageBus)│
└──────────────┘                     └──────────────┘
      ↑
  OrchestratorContainer
  (DI, clean)
```

### Design Decisions

| Decision | Option Chosen | Rationale |
|----------|--------------|-----------|
| **Message Bus** | IMessageBus (RedisBus adapter) | Already implemented, symmetric, durable with streams |
| **Task Dispatch** | IMessageBus.publish() | Replaces AgentDispatcherService, event-driven |
| **Result Handling** | Single persistent subscription | No per-workflow handlers, no lifecycle issues |
| **Cleanup Strategy** | Delete AgentDispatcherService entirely | No longer needed, reduces complexity |
| **Container Wiring** | OrchestratorContainer in server.ts | DI pattern, clean initialization |
| **Validation Strategy** | Checkpoint after each phase | Catch issues early, easy rollback |

### Data Flow (After Migration)

```
1. User creates workflow via HTTP POST
   ↓
2. WorkflowService.createWorkflow()
   → Creates workflow in DB
   → Initializes state machine
   → Creates task envelope
   ↓
3. WorkflowService publishes task
   → await messageBus.publish('agent:scaffold:tasks', taskEnvelope)
   ↓
4. Scaffold Agent receives task (via IMessageBus.subscribe)
   ↓
5. Scaffold Agent executes task
   → Validates input
   → Calls Claude API (with circuit breaker)
   → Generates scaffolding
   ↓
6. Scaffold Agent publishes result
   → await messageBus.publish('orchestrator:results', resultEnvelope)
   ↓
7. WorkflowService receives result (via persistent subscription)
   → Loads workflow from DB
   → Stores stage output
   → Publishes STAGE_COMPLETE event to EventBus
   ↓
8. State machine receives event and transitions
   → scaffolding → validation
   → Updates DB: current_stage, progress
   ↓
9. WorkflowService creates next task
   → await messageBus.publish('agent:validation:tasks', taskEnvelope)
   ↓
10. [Repeat 4-9 for all stages]
    ↓
11. Final stage completes
    → State machine: deployment → completed
    → Workflow status = "completed", progress = 100%
```

---

## Phase Breakdown

### Phase 1: Fix Agent Result Publishing ⏱️ 1.5 hours

**Objective:** Agents publish results via IMessageBus instead of direct Redis

**Package:** `@agentic-sdlc/base-agent`

**Files to Modify:**
- `packages/agents/base-agent/src/base-agent.ts` (lines 271-428)

**Changes:**

1. **Remove direct Redis publishing in `reportResult()` method:**
   ```typescript
   // REMOVE lines 359-402 (direct Redis publish + stream mirroring)
   // DELETE:
   // await this.redisPublisher.publish(resultChannel, messageJson);
   // await this.redisPublisher.xadd(...);
   ```

2. **Add IMessageBus.publish() call:**
   ```typescript
   // ADD after line 340 (after AgentResultSchema validation):
   await this.messageBus.publish(
     REDIS_CHANNELS.ORCHESTRATOR_RESULTS,
     agentResult,  // Already validated against AgentResultSchema
     {
       key: validatedResult.workflow_id,
       mirrorToStream: `stream:${REDIS_CHANNELS.ORCHESTRATOR_RESULTS}`
     }
   );
   ```

3. **Update logging:**
   ```typescript
   // REPLACE lines 430-437 with:
   this.logger.info('[PHASE-3] Result published via IMessageBus', {
     task_id: validatedResult.task_id,
     workflow_id: validatedResult.workflow_id,
     status: agentStatus,
     success: success,
     workflow_stage: stage,
     agent_id: this.agentId,
     version: VERSION
   });
   ```

4. **Remove redisPublisher and redisSubscriber fields (cleanup):**
   ```typescript
   // NOTE: Keep redisPublisher/redisSubscriber for now
   // They're still used for agent registration (lines 560-572)
   // Will be migrated to IKVStore in future iteration
   ```

**Validation Steps:**

```bash
# 1. Type check
cd packages/agents/base-agent
pnpm run typecheck
# Expected: 0 errors

# 2. Lint
pnpm run lint
# Expected: 0 warnings

# 3. Build
turbo run build --filter=@agentic-sdlc/base-agent
# Expected: Success

# 4. Build dependent packages
turbo run build --filter=@agentic-sdlc/scaffold-agent
turbo run build --filter=@agentic-sdlc/validation-agent
turbo run build --filter=@agentic-sdlc/e2e-agent
# Expected: All succeed

# 5. Unit tests
pnpm test packages/agents/base-agent
# Expected: All tests pass
```

**Acceptance Criteria:**
- [ ] No direct Redis publish calls in `reportResult()`
- [ ] Results published via `IMessageBus.publish()`
- [ ] Stream mirroring configured via options
- [ ] All type checks pass
- [ ] All lints pass
- [ ] All builds succeed
- [ ] All unit tests pass

**Estimated Time:** 1.5 hours (1h code + 0.5h validation)

---

### Phase 2: Remove AgentDispatcherService ⏱️ 1 hour

**Objective:** Delete old callback-based dispatcher, remove all references

**Package:** `@agentic-sdlc/orchestrator`

**Files to Delete:**
- `packages/orchestrator/src/services/agent-dispatcher.service.ts` (381 lines)
- `packages/orchestrator/tests/services/agent-dispatcher.service.test.ts`

**Files to Modify:**
- `packages/orchestrator/src/services/workflow.service.ts`

**Changes:**

1. **Remove AgentDispatcherService import:**
   ```typescript
   // DELETE line 9 (if exists):
   // import { AgentDispatcherService } from './agent-dispatcher.service';
   ```

2. **Remove agentDispatcher field and references:**
   ```typescript
   // In WorkflowService class:
   // DELETE any agentDispatcher fields
   // DELETE any handler registration code (agentDispatcher.onResult...)
   // DELETE any handler cleanup code (agentDispatcher.offResult...)
   ```

3. **Update WorkflowService constructor:**
   ```typescript
   // Line 22-29: Make messageBus REQUIRED (not optional)
   constructor(
     private repository: WorkflowRepository,
     private eventBus: EventBus,
     private stateMachineService: WorkflowStateMachineService,
     redisUrl: string = process.env.REDIS_URL || 'redis://127.0.0.1:6379',
     messageBus: IMessageBus  // REMOVE '?' - now REQUIRED
   ) {
     // Validate messageBus is provided
     if (!messageBus) {
       throw new Error('[PHASE-3] WorkflowService requires IMessageBus - cannot initialize without it');
     }
     this.messageBus = messageBus;
     // ... rest of constructor
   }
   ```

4. **Clean up workflow creation:**
   ```typescript
   // In createWorkflow() method:
   // REMOVE all agentDispatcher.onResult() calls
   // REMOVE all handler registration logic
   ```

5. **Update cleanup method:**
   ```typescript
   // In cleanup() method (line 132-149):
   // DELETE lines 141-142:
   // // Phase 3: Agent dispatcher removed - no longer needed
   ```

**Validation Steps:**

```bash
# 1. Delete files
rm packages/orchestrator/src/services/agent-dispatcher.service.ts
rm packages/orchestrator/tests/services/agent-dispatcher.service.test.ts

# 2. Verify no references remain
grep -r "AgentDispatcherService" packages/orchestrator/src/
# Expected: No results

grep -r "agentDispatcher" packages/orchestrator/src/
# Expected: No results (or only in comments)

# 3. Type check
cd packages/orchestrator
pnpm run typecheck
# Expected: 0 errors

# 4. Lint
pnpm run lint
# Expected: 0 warnings

# 5. Build
turbo run build --filter=@agentic-sdlc/orchestrator
# Expected: Success

# 6. Unit tests
pnpm test packages/orchestrator
# Expected: All tests pass (some may be skipped if they tested AgentDispatcherService)
```

**Acceptance Criteria:**
- [ ] `agent-dispatcher.service.ts` deleted
- [ ] No references to AgentDispatcherService remain
- [ ] No references to agentDispatcher remain
- [ ] messageBus is required parameter (not optional)
- [ ] All type checks pass
- [ ] All lints pass
- [ ] All builds succeed
- [ ] All relevant unit tests pass

**Estimated Time:** 1 hour (0.5h code + 0.5h validation)

---

### Phase 3: Wire OrchestratorContainer into server.ts ⏱️ 1.5 hours

**Objective:** Orchestrator uses hexagonal architecture for dependency injection

**Package:** `@agentic-sdlc/orchestrator`

**Files to Modify:**
- `packages/orchestrator/src/server.ts`

**Changes:**

1. **Add OrchestratorContainer import:**
   ```typescript
   // ADD at top of file:
   import { OrchestratorContainer } from './hexagonal/bootstrap';
   ```

2. **Initialize container before creating services:**
   ```typescript
   // BEFORE creating WorkflowService, add:

   // Phase 3: Initialize hexagonal container
   logger.info('[PHASE-3] Initializing OrchestratorContainer');
   const container = new OrchestratorContainer({
     redisUrl: process.env.REDIS_URL || 'redis://localhost:6380',
     redisNamespace: 'agentic-sdlc',
     redisDefaultTtl: 3600, // 1 hour
     coordinators: {} // No coordinators needed for workflow orchestration
   });

   await container.initialize();
   logger.info('[PHASE-3] OrchestratorContainer initialized successfully');

   // Extract dependencies
   const messageBus = container.getBus();
   const kvStore = container.getKV();

   logger.info('[PHASE-3] Extracted dependencies from container', {
     messageBusAvailable: !!messageBus,
     kvStoreAvailable: !!kvStore
   });
   ```

3. **Update WorkflowService initialization:**
   ```typescript
   // REPLACE WorkflowService creation with:
   const workflowService = new WorkflowService(
     workflowRepository,
     eventBus,
     stateMachineService,
     process.env.REDIS_URL || 'redis://localhost:6380',
     messageBus  // Pass messageBus from container
   );

   logger.info('[PHASE-3] WorkflowService created with messageBus');
   ```

4. **Add graceful shutdown:**
   ```typescript
   // ADD shutdown hook:
   fastify.addHook('onClose', async () => {
     logger.info('[PHASE-3] Shutting down OrchestratorContainer');
     await container.shutdown();
     logger.info('[PHASE-3] Container shutdown complete');
   });
   ```

5. **Add health check endpoint (optional):**
   ```typescript
   // ADD route:
   fastify.get('/health/hexagonal', async (request, reply) => {
     const health = await container.health();
     return {
       timestamp: new Date().toISOString(),
       hexagonal: health
     };
   });
   ```

**Validation Steps:**

```bash
# 1. Type check
cd packages/orchestrator
pnpm run typecheck
# Expected: 0 errors

# 2. Lint
pnpm run lint
# Expected: 0 warnings

# 3. Build
turbo run build --filter=@agentic-sdlc/orchestrator
# Expected: Success

# 4. Start orchestrator locally
cd packages/orchestrator
pnpm start
# Expected: Server starts, logs show:
# - "[PHASE-3] Initializing OrchestratorContainer"
# - "[PHASE-3] OrchestratorContainer initialized successfully"
# - "[PHASE-3] WorkflowService created with messageBus"

# 5. Check health endpoint
curl http://localhost:3000/health/hexagonal
# Expected: { "ok": true, "bus": { "ok": true }, "kv": true }

# 6. Stop server (Ctrl+C)
# Expected: Logs show graceful shutdown

# 7. Integration tests (if any)
pnpm test packages/orchestrator/tests/integration
# Expected: All pass
```

**Acceptance Criteria:**
- [ ] OrchestratorContainer created and initialized
- [ ] messageBus extracted from container
- [ ] WorkflowService receives messageBus
- [ ] Graceful shutdown implemented
- [ ] Health check endpoint works
- [ ] All type checks pass
- [ ] All lints pass
- [ ] All builds succeed
- [ ] Server starts without errors
- [ ] Logs confirm Phase 3 initialization

**Estimated Time:** 1.5 hours (1h code + 0.5h validation)

---

### Phase 4: Update Task Dispatch to Use Message Bus ⏱️ 1 hour

**Objective:** Orchestrator dispatches tasks via IMessageBus instead of AgentDispatcherService

**Package:** `@agentic-sdlc/orchestrator`

**Files to Modify:**
- `packages/orchestrator/src/services/workflow.service.ts`

**Changes:**

1. **Find task dispatch code:**
   ```typescript
   // Search for:
   // agentDispatcher.dispatchTask(...)
   // Or direct task creation/publishing
   ```

2. **Replace with IMessageBus.publish():**
   ```typescript
   // EXAMPLE (adapt to actual code):

   private async dispatchTaskToAgent(
     agentType: string,
     workflowId: string,
     taskData: any
   ): Promise<void> {
     const taskEnvelope = {
       task_id: randomUUID(),
       workflow_id: workflowId,
       agent_type: agentType,
       payload: taskData,
       workflow_context: {
         current_stage: taskData.stage,
         workflow_name: taskData.name
       },
       created_at: new Date().toISOString(),
       trace_id: generateTraceId()
     };

     const taskChannel = REDIS_CHANNELS.AGENT_TASKS(agentType);

     logger.info('[PHASE-3] Dispatching task via IMessageBus', {
       workflow_id: workflowId,
       task_id: taskEnvelope.task_id,
       agent_type: agentType,
       channel: taskChannel
     });

     await this.messageBus!.publish(taskChannel, taskEnvelope, {
       key: workflowId,
       mirrorToStream: `stream:${taskChannel}`
     });

     logger.info('[PHASE-3] Task dispatched successfully', {
       workflow_id: workflowId,
       task_id: taskEnvelope.task_id
     });
   }
   ```

3. **Update createWorkflow to use new dispatch:**
   ```typescript
   // In createWorkflow() method:
   // REPLACE agentDispatcher.dispatchTask(...) with:
   await this.dispatchTaskToAgent(
     firstStageAgentType,
     workflow.workflow_id,
     taskData
   );
   ```

4. **Update stage transition handlers:**
   ```typescript
   // In handleTaskCompletion() or wherever next stage is triggered:
   // REPLACE agentDispatcher.dispatchTask(...) with:
   await this.dispatchTaskToAgent(...);
   ```

**Validation Steps:**

```bash
# 1. Type check
cd packages/orchestrator
pnpm run typecheck
# Expected: 0 errors

# 2. Lint
pnpm run lint
# Expected: 0 warnings

# 3. Build
turbo run build --filter=@agentic-sdlc/orchestrator
# Expected: Success

# 4. Unit tests
pnpm test packages/orchestrator
# Expected: All tests pass

# 5. Check for remaining dispatcher references
grep -r "dispatchTask" packages/orchestrator/src/
# Expected: Only in new dispatchTaskToAgent method

grep -r "agentDispatcher" packages/orchestrator/src/
# Expected: No results
```

**Acceptance Criteria:**
- [ ] No AgentDispatcherService.dispatchTask() calls remain
- [ ] All task dispatch uses IMessageBus.publish()
- [ ] Task envelopes include all required fields
- [ ] Stream mirroring configured
- [ ] Logging includes Phase 3 markers
- [ ] All type checks pass
- [ ] All lints pass
- [ ] All builds succeed
- [ ] All unit tests pass

**Estimated Time:** 1 hour (0.5h code + 0.5h validation)

---

### Phase 5: Verify Message Bus Subscription ⏱️ 1 hour

**Objective:** Ensure WorkflowService subscribes to agent results correctly

**Package:** `@agentic-sdlc/orchestrator`

**Files to Modify:**
- `packages/orchestrator/src/services/workflow.service.ts`

**Changes:**

1. **Verify setupMessageBusSubscription exists:**
   ```typescript
   // In constructor (line 22-55):
   // VERIFY this code exists (around line 49-54):
   if (messageBus) {
     this.setupMessageBusSubscription().catch(err => {
       logger.error('[PHASE-2] Failed to initialize message bus subscription', { error: err });
     });
   }
   ```

2. **Enhance setupMessageBusSubscription with logging:**
   ```typescript
   // Update method (line 89-127) to add more diagnostics:
   private async setupMessageBusSubscription(): Promise<void> {
     if (!this.messageBus) {
       logger.warn('[PHASE-2] setupMessageBusSubscription called but messageBus not available');
       return;
     }

     logger.info('[PHASE-2] Setting up message bus subscription for agent results');

     try {
       const { REDIS_CHANNELS } = await import('@agentic-sdlc/shared-types');
       const topic = REDIS_CHANNELS.ORCHESTRATOR_RESULTS;

       logger.info('[PHASE-2] Subscribing to topic', { topic });

       // Subscribe to agent results topic with centralized handler
       await this.messageBus.subscribe(topic, async (message: any) => {
         logger.info('[PHASE-2] Received agent result from message bus', {
           message_id: message.id,
           workflow_id: message.workflow_id,
           agent_id: message.agent_id,
           type: message.type,
           has_payload: !!message.payload
         });

         // Handle the agent result using existing handler
         await this.handleAgentResult(message);
       });

       logger.info('[PHASE-2] Message bus subscription established successfully', {
         topic,
         subscriptionActive: true
       });
     } catch (error) {
       logger.error('[PHASE-2] Failed to set up message bus subscription', {
         error: error instanceof Error ? error.message : String(error),
         stack: error instanceof Error ? error.stack : undefined
       });
       throw error;
     }
   }
   ```

3. **Verify handleAgentResult processes messages:**
   ```typescript
   // Ensure handleAgentResult method exists and processes results
   // Should load workflow, store output, publish STAGE_COMPLETE event
   ```

4. **Add subscription health check:**
   ```typescript
   // ADD method:
   async getSubscriptionHealth(): Promise<boolean> {
     return !!this.messageBus;
   }
   ```

**Validation Steps:**

```bash
# 1. Type check
cd packages/orchestrator
pnpm run typecheck
# Expected: 0 errors

# 2. Lint
pnpm run lint
# Expected: 0 warnings

# 3. Build
turbo run build --filter=@agentic-sdlc/orchestrator
# Expected: Success

# 4. Start orchestrator
./scripts/env/start-dev.sh
# Expected: Logs show:
# - "[PHASE-2] Setting up message bus subscription for agent results"
# - "[PHASE-2] Subscribing to topic: orchestrator:results"
# - "[PHASE-2] Message bus subscription established successfully"

# 5. Check Redis subscription
docker exec -it agentic-redis-1 redis-cli
> PUBSUB CHANNELS
# Expected: orchestrator:results listed

# 6. Stop environment
./scripts/env/stop-dev.sh
```

**Acceptance Criteria:**
- [ ] setupMessageBusSubscription called in constructor
- [ ] Subscription to 'orchestrator:results' topic
- [ ] handleAgentResult processes messages correctly
- [ ] Enhanced logging for diagnostics
- [ ] All type checks pass
- [ ] All lints pass
- [ ] All builds succeed
- [ ] Logs confirm subscription established
- [ ] Redis shows active subscription

**Estimated Time:** 1 hour (0.5h code + 0.5h validation)

---

### Phase 6: E2E Testing & Validation ⏱️ 2 hours

**Objective:** All workflow tests pass, system works end-to-end

**Changes:** No code changes - pure validation

**Validation Steps:**

```bash
# === BUILD VALIDATION ===

# 1. Clean build all packages
turbo run clean
turbo run build
# Expected: All 12 packages build successfully

# 2. Type check all packages
turbo run typecheck
# Expected: 0 errors across all packages

# 3. Lint all packages
turbo run lint
# Expected: 0 warnings across all packages

# 4. Unit tests
pnpm test
# Expected: All unit tests pass (may have some skipped)

# === E2E VALIDATION ===

# 5. Start development environment
./scripts/env/start-dev.sh
# Expected:
# - Orchestrator starts on port 3000
# - All 5 agents start successfully
# - Redis connected on port 6380
# - Postgres connected on port 5432
# - All health checks pass

# 6. Verify agent subscriptions
docker exec -it agentic-redis-1 redis-cli
> PUBSUB CHANNELS
# Expected channels:
# - agent:scaffold:tasks
# - agent:validation:tasks
# - agent:e2e:tasks
# - agent:integration:tasks
# - agent:deployment:tasks
# - orchestrator:results

# 7. Check agent registry
> HGETALL agents:registry
# Expected: 5 agents registered

# 8. Run single workflow test
./scripts/run-pipeline-test.sh "Hello World API"
# Expected:
# ✅ Workflow created
# ✅ initialization stage completes
# ✅ scaffolding stage completes
# ✅ validation stage completes
# ✅ e2e stage completes
# ✅ integration stage completes
# ✅ deployment stage completes
# ✅ Workflow status: completed
# ✅ Progress: 100%

# 9. Run all pipeline tests
./scripts/run-pipeline-test.sh --all
# Expected: All 5+ tests complete successfully

# 10. Check workflow in database
docker exec -it agentic-postgres-1 psql -U postgres -d agentic_sdlc
> SELECT workflow_id, name, current_stage, progress, status FROM workflows ORDER BY created_at DESC LIMIT 5;
# Expected: All workflows show status='completed', progress=100

# 11. Check orchestrator logs
docker logs agentic-orchestrator-1 --tail 100 | grep "PHASE-3"
# Expected: Phase 3 markers present, no errors

# 12. Check agent logs
docker logs agentic-scaffold-agent-1 --tail 50 | grep "PHASE-3"
docker logs agentic-validation-agent-1 --tail 50 | grep "PHASE-3"
docker logs agentic-e2e-agent-1 --tail 50 | grep "PHASE-3"
# Expected: Phase 3 markers present, results published via IMessageBus

# === REGRESSION VALIDATION ===

# 13. Create workflow via API
curl -X POST http://localhost:3000/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "type": "app",
    "name": "Test App",
    "description": "Regression test",
    "requirements": "Build a simple REST API"
  }'
# Expected: 201 Created, workflow_id returned

# 14. Poll workflow status
WORKFLOW_ID="<from previous response>"
curl http://localhost:3000/api/v1/workflows/$WORKFLOW_ID
# Expected: Status progresses through stages, eventually reaches "completed"

# 15. List workflows
curl http://localhost:3000/api/v1/workflows
# Expected: List includes all test workflows, all completed

# === PERFORMANCE VALIDATION ===

# 16. Check Redis memory usage
docker exec -it agentic-redis-1 redis-cli INFO memory | grep used_memory_human
# Expected: Reasonable memory usage (< 100MB)

# 17. Check stream lengths
docker exec -it agentic-redis-1 redis-cli
> XLEN stream:orchestrator:results
> XLEN stream:agent:scaffold:tasks
# Expected: Messages present but not excessive

# 18. Check for memory leaks
docker stats --no-stream
# Expected: All containers stable memory usage

# === CLEANUP VALIDATION ===

# 19. Graceful shutdown
./scripts/env/stop-dev.sh
# Expected: All containers stop cleanly, no errors

# 20. Verify no orphaned processes
ps aux | grep node
# Expected: No lingering node processes

# === FINAL CHECKS ===

# 21. Code quality
grep -r "AgentDispatcherService" packages/
# Expected: No results

grep -r "agentDispatcher" packages/ | grep -v "// OLD:"
# Expected: No results (except comments)

grep -r "TODO.*Phase 3" packages/
# Expected: List any remaining TODOs

# 22. Documentation
ls -la *.md
# Expected:
# - EPCC_EXPLORE.md ✅
# - EPCC_PLAN.md ✅
# - README.md updated
# - CLAUDE.md updated
```

**Acceptance Criteria:**

**Build:**
- [ ] All packages build successfully
- [ ] Zero TypeScript errors
- [ ] Zero ESLint warnings
- [ ] All unit tests pass

**E2E:**
- [ ] All 5+ pipeline tests pass
- [ ] Workflows complete all 6 stages
- [ ] Progress updates correctly (0% → 100%)
- [ ] Status transitions to "completed"
- [ ] All stage outputs stored

**Architecture:**
- [ ] No AgentDispatcherService references
- [ ] All communication via IMessageBus
- [ ] Symmetric architecture achieved
- [ ] Health checks pass

**Logging:**
- [ ] Phase 3 markers in all logs
- [ ] No handler lifecycle errors
- [ ] No "handler not found" errors
- [ ] Clean graceful shutdown

**Performance:**
- [ ] Memory usage stable
- [ ] No memory leaks
- [ ] Reasonable stream lengths
- [ ] All containers healthy

**Documentation:**
- [ ] EPCC_EXPLORE.md complete
- [ ] EPCC_PLAN.md complete
- [ ] README.md updated
- [ ] CLAUDE.md updated

**Estimated Time:** 2 hours (pure validation)

---

## Complete Task List with Dependencies

### Task Dependency Graph

```
Phase 1 (Agent Fix)
    ↓
Phase 2 (Remove Dispatcher) ← depends on Phase 1
    ↓
Phase 3 (Wire Container) ← depends on Phase 2
    ↓
Phase 4 (Task Dispatch) ← depends on Phase 3
    ↓
Phase 5 (Verify Subscription) ← depends on Phase 4
    ↓
Phase 6 (E2E Testing) ← depends on Phase 5
```

### Detailed Task Breakdown

| ID | Task | Package | Files | Estimate | Dependencies | Priority |
|----|------|---------|-------|----------|--------------|----------|
| **1.1** | Update BaseAgent.reportResult() to use IMessageBus | base-agent | base-agent.ts | 1h | None | P0 |
| **1.2** | Remove direct Redis publishing code | base-agent | base-agent.ts | 15m | 1.1 | P0 |
| **1.3** | Update logging with Phase 3 markers | base-agent | base-agent.ts | 15m | 1.2 | P1 |
| **1.4** | Type check + lint + build base-agent | base-agent | - | 15m | 1.3 | P0 |
| **1.5** | Build all agent packages | all agents | - | 15m | 1.4 | P0 |
| | | | | | | |
| **2.1** | Delete agent-dispatcher.service.ts | orchestrator | agent-dispatcher.service.ts | 5m | 1.5 | P0 |
| **2.2** | Delete agent-dispatcher tests | orchestrator | agent-dispatcher.service.test.ts | 5m | 2.1 | P0 |
| **2.3** | Remove dispatcher imports from WorkflowService | orchestrator | workflow.service.ts | 10m | 2.2 | P0 |
| **2.4** | Make messageBus required in constructor | orchestrator | workflow.service.ts | 10m | 2.3 | P0 |
| **2.5** | Remove handler registration code | orchestrator | workflow.service.ts | 20m | 2.4 | P0 |
| **2.6** | Update cleanup method | orchestrator | workflow.service.ts | 10m | 2.5 | P0 |
| **2.7** | Verify no dispatcher references remain | orchestrator | - | 10m | 2.6 | P0 |
| **2.8** | Type check + lint + build orchestrator | orchestrator | - | 15m | 2.7 | P0 |
| | | | | | | |
| **3.1** | Import OrchestratorContainer in server.ts | orchestrator | server.ts | 5m | 2.8 | P0 |
| **3.2** | Initialize container before services | orchestrator | server.ts | 20m | 3.1 | P0 |
| **3.3** | Extract messageBus from container | orchestrator | server.ts | 10m | 3.2 | P0 |
| **3.4** | Pass messageBus to WorkflowService | orchestrator | server.ts | 10m | 3.3 | P0 |
| **3.5** | Add graceful shutdown hook | orchestrator | server.ts | 15m | 3.4 | P1 |
| **3.6** | Add health check endpoint | orchestrator | server.ts | 15m | 3.5 | P2 |
| **3.7** | Type check + lint + build orchestrator | orchestrator | - | 15m | 3.6 | P0 |
| **3.8** | Start server and verify initialization | orchestrator | - | 10m | 3.7 | P0 |
| | | | | | | |
| **4.1** | Create dispatchTaskToAgent method | orchestrator | workflow.service.ts | 30m | 3.8 | P0 |
| **4.2** | Update createWorkflow to use new dispatch | orchestrator | workflow.service.ts | 15m | 4.1 | P0 |
| **4.3** | Update stage transition handlers | orchestrator | workflow.service.ts | 15m | 4.2 | P0 |
| **4.4** | Remove old dispatch code | orchestrator | workflow.service.ts | 10m | 4.3 | P0 |
| **4.5** | Type check + lint + build orchestrator | orchestrator | - | 15m | 4.4 | P0 |
| | | | | | | |
| **5.1** | Verify setupMessageBusSubscription exists | orchestrator | workflow.service.ts | 10m | 4.5 | P0 |
| **5.2** | Enhance subscription logging | orchestrator | workflow.service.ts | 20m | 5.1 | P1 |
| **5.3** | Verify handleAgentResult processes messages | orchestrator | workflow.service.ts | 15m | 5.2 | P0 |
| **5.4** | Add subscription health check | orchestrator | workflow.service.ts | 15m | 5.3 | P2 |
| **5.5** | Type check + lint + build orchestrator | orchestrator | - | 15m | 5.4 | P0 |
| **5.6** | Start environment and verify subscription | orchestrator | - | 15m | 5.5 | P0 |
| | | | | | | |
| **6.1** | Clean build all packages | all | - | 20m | 5.6 | P0 |
| **6.2** | Run all type checks | all | - | 10m | 6.1 | P0 |
| **6.3** | Run all lints | all | - | 10m | 6.2 | P0 |
| **6.4** | Run all unit tests | all | - | 15m | 6.3 | P0 |
| **6.5** | Start development environment | all | - | 10m | 6.4 | P0 |
| **6.6** | Verify agent subscriptions in Redis | all | - | 5m | 6.5 | P0 |
| **6.7** | Run single workflow test | all | - | 10m | 6.6 | P0 |
| **6.8** | Run all pipeline tests | all | - | 20m | 6.7 | P0 |
| **6.9** | Check workflows in database | all | - | 5m | 6.8 | P0 |
| **6.10** | Verify logs (orchestrator + agents) | all | - | 10m | 6.9 | P0 |
| **6.11** | Regression testing via API | all | - | 15m | 6.10 | P1 |
| **6.12** | Performance validation | all | - | 10m | 6.11 | P1 |
| **6.13** | Graceful shutdown test | all | - | 5m | 6.12 | P1 |
| **6.14** | Final cleanup validation | all | - | 10m | 6.13 | P0 |
| **6.15** | Update documentation | all | *.md | 15m | 6.14 | P1 |

**Total Estimated Time:** 8 hours

---

## Risk Assessment

### Risk Matrix

| Risk | Probability | Impact | Mitigation Strategy | Contingency Plan |
|------|------------|--------|-------------------|------------------|
| **Build breaks after Phase 1** | Low | High | - Validate types/build after each file change<br>- Test with single agent first | - Rollback Phase 1 changes<br>- Fix type errors incrementally |
| **WorkflowService fails without messageBus** | Low | Critical | - Make messageBus required<br>- Add validation in constructor<br>- Fail fast if not provided | - Add fallback to direct Redis (temporary)<br>- Revert to optional messageBus |
| **Workflows still timeout** | Medium | Critical | - Verify subscription active<br>- Check Redis logs<br>- Add diagnostic logging | - Check handleAgentResult logic<br>- Verify state machine transitions<br>- Test with minimal workflow |
| **Message bus performance issues** | Low | Medium | - Bus already tested at scale<br>- Stream mirroring is optional<br>- Monitor Redis metrics | - Disable stream mirroring temporarily<br>- Increase Redis resources<br>- Add backpressure handling |
| **State transitions fail** | Low | High | - State machine already working<br>- Only changing trigger mechanism<br>- Extensive E2E testing | - Check event payload format<br>- Verify STAGE_COMPLETE events published<br>- Add state machine logging |
| **Agents don't receive tasks** | Medium | High | - Verify agent subscriptions in Redis<br>- Check channel names match constants<br>- Add subscription logging | - Restart agents<br>- Check Redis connection<br>- Verify channel name format |
| **Results lost in transit** | Low | Medium | - Stream mirroring provides durability<br>- Consumer groups prevent message loss<br>- Redis persistence enabled | - Check stream backlog<br>- Manually replay from stream<br>- Add result persistence |
| **Type errors after removing dispatcher** | Medium | Medium | - Type check after each change<br>- Use strict TypeScript<br>- IDE will catch most issues | - Fix type errors incrementally<br>- Add type assertions if needed<br>- Update type definitions |
| **Tests fail after migration** | Medium | Medium | - Most tests mock dependencies<br>- Integration tests may need updates<br>- E2E tests validate end-to-end | - Update test mocks<br>- Fix integration test setup<br>- Skip failing tests temporarily |
| **Documentation out of sync** | High | Low | - Update docs in Phase 6<br>- Reference EPCC_EXPLORE.md<br>- Update CLAUDE.md | - Add TODO markers<br>- Create separate doc update task |

### Rollback Procedures

**Phase 1 Rollback:**
```bash
git checkout packages/agents/base-agent/src/base-agent.ts
turbo run build --filter=@agentic-sdlc/base-agent
```

**Phase 2 Rollback:**
```bash
git checkout packages/orchestrator/src/services/
turbo run build --filter=@agentic-sdlc/orchestrator
```

**Phase 3 Rollback:**
```bash
git checkout packages/orchestrator/src/server.ts
turbo run build --filter=@agentic-sdlc/orchestrator
./scripts/env/stop-dev.sh
./scripts/env/start-dev.sh
```

**Complete Rollback:**
```bash
git reset --hard HEAD
turbo run clean
turbo run build
./scripts/env/stop-dev.sh
./scripts/env/start-dev.sh
```

---

## Testing Strategy

### Unit Testing (Vitest)

**Target Coverage:** 90%

**Test Locations:**
- `packages/agents/base-agent/tests/base-agent.test.ts`
- `packages/orchestrator/tests/services/workflow.service.test.ts`
- `packages/orchestrator/src/hexagonal/__tests__/*.test.ts`

**Key Test Cases:**

1. **BaseAgent Tests:**
   ```typescript
   describe('BaseAgent.reportResult', () => {
     it('should publish result via IMessageBus', async () => {
       const mockBus = { publish: jest.fn() };
       const agent = new TestAgent(capabilities, mockBus);

       await agent.reportResult(mockResult, 'scaffolding');

       expect(mockBus.publish).toHaveBeenCalledWith(
         'orchestrator:results',
         expect.objectContaining({
           workflow_id: mockResult.workflow_id,
           task_id: mockResult.task_id
         }),
         expect.objectContaining({
           key: mockResult.workflow_id,
           mirrorToStream: 'stream:orchestrator:results'
         })
       );
     });
   });
   ```

2. **WorkflowService Tests:**
   ```typescript
   describe('WorkflowService', () => {
     it('should require messageBus in constructor', () => {
       expect(() => {
         new WorkflowService(mockRepo, mockEventBus, mockStateMachine, redisUrl, undefined);
       }).toThrow('requires IMessageBus');
     });

     it('should subscribe to orchestrator:results on init', async () => {
       const mockBus = { subscribe: jest.fn(), publish: jest.fn() };
       const service = new WorkflowService(mockRepo, mockEventBus, mockStateMachine, redisUrl, mockBus);

       await waitFor(() => {
         expect(mockBus.subscribe).toHaveBeenCalledWith(
           'orchestrator:results',
           expect.any(Function)
         );
       });
     });

     it('should dispatch task via IMessageBus', async () => {
       const mockBus = { subscribe: jest.fn(), publish: jest.fn() };
       const service = new WorkflowService(mockRepo, mockEventBus, mockStateMachine, redisUrl, mockBus);

       await service.createWorkflow(mockRequest);

       expect(mockBus.publish).toHaveBeenCalledWith(
         'agent:scaffold:tasks',
         expect.objectContaining({
           workflow_id: expect.any(String),
           agent_type: 'scaffold'
         }),
         expect.any(Object)
       );
     });
   });
   ```

3. **OrchestratorContainer Tests:**
   ```typescript
   describe('OrchestratorContainer', () => {
     it('should initialize successfully', async () => {
       const container = new OrchestratorContainer(mockConfig);
       await container.initialize();

       const bus = container.getBus();
       const kv = container.getKV();

       expect(bus).toBeDefined();
       expect(kv).toBeDefined();
     });

     it('should perform health check', async () => {
       const container = new OrchestratorContainer(mockConfig);
       await container.initialize();

       const health = await container.health();

       expect(health.ok).toBe(true);
       expect(health.bus.ok).toBe(true);
       expect(health.kv).toBe(true);
     });
   });
   ```

**Run Commands:**
```bash
# All unit tests
pnpm test

# Specific package
pnpm test packages/agents/base-agent
pnpm test packages/orchestrator

# With coverage
pnpm test --coverage

# Watch mode
pnpm test --watch
```

### Integration Testing (Vitest)

**Target Coverage:** 80%

**Test Locations:**
- `packages/orchestrator/tests/integration/*.test.ts`
- `packages/orchestrator/src/hexagonal/__tests__/integration.test.ts`

**Key Test Cases:**

1. **Message Bus Integration:**
   ```typescript
   describe('Message Bus Integration', () => {
     let container: OrchestratorContainer;

     beforeAll(async () => {
       container = new OrchestratorContainer({ redisUrl: TEST_REDIS_URL });
       await container.initialize();
     });

     afterAll(async () => {
       await container.shutdown();
     });

     it('should publish and receive messages', async () => {
       const bus = container.getBus();
       const received: any[] = [];

       await bus.subscribe('test:topic', async (msg) => {
         received.push(msg);
       });

       await bus.publish('test:topic', { data: 'test' });

       await waitFor(() => expect(received).toHaveLength(1));
       expect(received[0]).toEqual({ data: 'test' });
     });
   });
   ```

2. **Workflow Orchestration Integration:**
   ```typescript
   describe('Workflow Orchestration Integration', () => {
     it('should create workflow and dispatch first task', async () => {
       const container = await createTestContainer();
       const service = createWorkflowServiceWithContainer(container);

       const workflow = await service.createWorkflow({
         type: 'app',
         name: 'Test App',
         requirements: 'Test requirements'
       });

       // Verify task was published
       const tasks = await getPublishedTasks(container);
       expect(tasks).toHaveLength(1);
       expect(tasks[0].agent_type).toBe('scaffold');
       expect(tasks[0].workflow_id).toBe(workflow.workflow_id);
     });
   });
   ```

**Run Commands:**
```bash
# Integration tests
pnpm test packages/orchestrator/tests/integration

# With real Redis
REDIS_URL=redis://localhost:6380 pnpm test
```

### E2E Testing

**Target Coverage:** Critical paths

**Test Locations:**
- `packages/orchestrator/tests/e2e/*.test.ts`
- `scripts/run-pipeline-test.sh`

**Test Cases:**

1. **Single Stage Workflow:**
   ```bash
   ./scripts/run-pipeline-test.sh "Single Stage Test"
   # Verifies: initialization stage completes
   ```

2. **Two Stage Workflow:**
   ```bash
   ./scripts/run-pipeline-test.sh "Two Stage Test"
   # Verifies: initialization → scaffolding
   ```

3. **Full Pipeline:**
   ```bash
   ./scripts/run-pipeline-test.sh "Hello World API"
   # Verifies: All 6 stages complete
   ```

4. **Multiple Concurrent Workflows:**
   ```bash
   for i in {1..5}; do
     ./scripts/run-pipeline-test.sh "Concurrent Test $i" &
   done
   wait
   # Verifies: Concurrent workflow handling
   ```

5. **Error Recovery:**
   ```bash
   ./scripts/run-pipeline-test.sh "Error Recovery Test"
   # Verifies: Retry logic, circuit breaker, error handling
   ```

**Run Commands:**
```bash
# Start environment
./scripts/env/start-dev.sh

# Single test
./scripts/run-pipeline-test.sh "Test Name"

# All tests
./scripts/run-pipeline-test.sh --all

# List available tests
./scripts/run-pipeline-test.sh --list

# Stop environment
./scripts/env/stop-dev.sh
```

### Build Validation

**Checkpoints:**
- After Phase 1: Build base-agent and all agent packages
- After Phase 2: Build orchestrator
- After Phase 3: Build orchestrator and start server
- After Phase 4: Build orchestrator
- After Phase 5: Build orchestrator
- After Phase 6: Clean build all packages

**Commands:**
```bash
# Type check
turbo run typecheck
# Expected: 0 errors

# Lint
turbo run lint
# Expected: 0 warnings

# Build
turbo run build
# Expected: All packages succeed

# Clean build
turbo run clean && turbo run build
# Expected: All packages succeed
```

### Security Testing

**Test Areas:**
1. **Message Validation:**
   - Schema validation enforced
   - Invalid messages rejected
   - Type safety maintained

2. **Input Sanitization:**
   - User input validated
   - SQL injection prevented
   - XSS prevention

3. **Dependency Audit:**
   ```bash
   pnpm audit
   # Expected: No critical vulnerabilities
   ```

4. **Secret Management:**
   - No secrets in code
   - Environment variables used
   - .env files not committed

---

## Success Metrics

### Quantitative Metrics

| Metric | Before | Target | Measurement |
|--------|--------|--------|-------------|
| **E2E Test Pass Rate** | 0% | 100% | `./scripts/run-pipeline-test.sh --all` |
| **Workflow Completion Rate** | 0% | 100% | Database query: completed/total |
| **Handler Lifecycle Errors** | Many | 0 | `grep "handler not found" logs/` |
| **TypeScript Errors** | ? | 0 | `turbo run typecheck` |
| **ESLint Warnings** | ? | 0 | `turbo run lint` |
| **Unit Test Coverage** | ? | >90% | `pnpm test --coverage` |
| **Build Time** | Baseline | Similar | `time turbo run build` |
| **Lines of Code** | Baseline | -200 | `cloc packages/` |
| **Cyclomatic Complexity** | ? | Lower | Code analysis |

### Qualitative Metrics

- [ ] **Code Quality:** Architecture is symmetric and clean
- [ ] **Maintainability:** Hexagonal pattern followed consistently
- [ ] **Testability:** All components easily mockable
- [ ] **Observability:** Comprehensive logging with correlation IDs
- [ ] **Documentation:** CLAUDE.md and README.md updated
- [ ] **Developer Experience:** Easy to understand and extend
- [ ] **Production Readiness:** No known blockers for production

### Business Metrics

- [ ] **Workflow Throughput:** System can handle multiple concurrent workflows
- [ ] **Mean Time to Complete:** Workflows complete in expected time
- [ ] **Error Rate:** < 1% of workflows fail due to system errors
- [ ] **Recovery Time:** Failed workflows can be retried successfully

---

## Rollout Plan

### Phase 1: Development (Current)
- **Timeline:** 1 day (8 hours)
- **Environment:** Local development
- **Scope:** Complete migration, all tests passing
- **Validation:** E2E tests, manual testing

### Phase 2: Staging (Future)
- **Timeline:** 2 days
- **Environment:** Staging environment
- **Scope:** Deploy migrated code, run load tests
- **Validation:** Performance testing, stress testing

### Phase 3: Production (Future)
- **Timeline:** 1 day
- **Environment:** Production
- **Scope:** Blue-green deployment
- **Validation:** Canary release, gradual rollout

**Rollback Procedure:**
```bash
# If issues detected in production:
1. Switch traffic back to old deployment
2. Investigate issues in staging
3. Fix and re-deploy
```

---

## Documentation Updates

### Files to Update

1. **CLAUDE.md:**
   - Update "Current Status" section
   - Mark Phase 3 as 100% complete
   - Update "Next Steps"
   - Add migration completion date

2. **README.md:**
   - Update architecture diagram
   - Update "How It Works" section
   - Remove references to AgentDispatcherService
   - Add message bus architecture explanation

3. **packages/orchestrator/README.md:**
   - Document OrchestratorContainer usage
   - Update server.ts initialization example
   - Add hexagonal architecture overview

4. **packages/agents/base-agent/README.md:**
   - Document IMessageBus requirement
   - Update result publishing example
   - Add migration notes

5. **Create MIGRATION_COMPLETE.md:**
   - Document what changed
   - Document what was removed
   - Document new patterns to follow
   - Document troubleshooting guide

---

## Appendix

### A. File Change Summary

| File | Change Type | Lines Changed | Priority |
|------|-------------|---------------|----------|
| `packages/agents/base-agent/src/base-agent.ts` | Modify | ~50 | P0 |
| `packages/orchestrator/src/server.ts` | Modify | ~30 | P0 |
| `packages/orchestrator/src/services/workflow.service.ts` | Modify | ~80 | P0 |
| `packages/orchestrator/src/services/agent-dispatcher.service.ts` | Delete | -381 | P0 |
| `packages/orchestrator/tests/services/agent-dispatcher.service.test.ts` | Delete | ~-100 | P1 |
| `CLAUDE.md` | Modify | ~20 | P1 |
| `README.md` | Modify | ~50 | P1 |
| `MIGRATION_COMPLETE.md` | Create | +100 | P2 |

**Total Net Impact:** ~-300 lines (net reduction!)

### B. Command Reference

```bash
# === BUILD ===
turbo run clean                          # Clean all packages
turbo run build                          # Build all packages
turbo run build --filter=<package>       # Build specific package
turbo run typecheck                      # Type check all
turbo run lint                           # Lint all

# === TEST ===
pnpm test                                # Run all unit tests
pnpm test --coverage                     # With coverage
pnpm test packages/<package>             # Specific package
./scripts/run-pipeline-test.sh <name>   # E2E test
./scripts/run-pipeline-test.sh --all    # All E2E tests

# === ENVIRONMENT ===
./scripts/env/start-dev.sh               # Start all services
./scripts/env/stop-dev.sh                # Stop all services
./scripts/env/check-health.sh            # Health checks

# === REDIS ===
docker exec -it agentic-redis-1 redis-cli
> PUBSUB CHANNELS                        # List active channels
> HGETALL agents:registry                # List registered agents
> XLEN stream:orchestrator:results       # Check stream length

# === LOGS ===
docker logs agentic-orchestrator-1       # Orchestrator logs
docker logs agentic-scaffold-agent-1     # Scaffold agent logs
docker logs -f agentic-orchestrator-1    # Follow logs
```

### C. Troubleshooting Guide

**Issue:** Workflows timeout at first stage

**Diagnosis:**
```bash
# Check if agents are subscribed
docker exec -it agentic-redis-1 redis-cli PUBSUB CHANNELS
# Should see: agent:scaffold:tasks, agent:validation:tasks, etc.

# Check if orchestrator subscribed to results
# Should see: orchestrator:results

# Check orchestrator logs
docker logs agentic-orchestrator-1 | grep "PHASE-2"
# Should see: "Message bus subscription established successfully"

# Check agent logs
docker logs agentic-scaffold-agent-1 | grep "PHASE-3"
# Should see: "Agent subscribed to message bus for tasks"
```

**Solution:**
- Restart agents if not subscribed
- Check Redis connection
- Verify channel name constants match

**Issue:** Build fails with TypeScript errors

**Diagnosis:**
```bash
turbo run typecheck
# Identify which package has errors

cd packages/<package>
pnpm run typecheck
# See detailed error messages
```

**Solution:**
- Fix type errors incrementally
- Add type assertions if needed
- Update type definitions

**Issue:** Tests fail after migration

**Diagnosis:**
```bash
pnpm test 2>&1 | grep "FAIL"
# Identify failing tests

pnpm test <specific-test-file>
# Run specific test for details
```

**Solution:**
- Update test mocks
- Fix integration test setup
- Update expectations

### D. Glossary

- **IMessageBus:** Interface for pub/sub messaging abstraction
- **RedisBus:** Redis implementation of IMessageBus
- **OrchestratorContainer:** DI container for hexagonal dependencies
- **AgentDispatcherService:** OLD callback-based dispatcher (being removed)
- **Envelope:** Message wrapper with metadata (correlation ID, etc.)
- **Stream Mirroring:** Publishing messages to both pub/sub and streams
- **Consumer Group:** Redis Streams feature for load balancing
- **Hexagonal Architecture:** Pattern separating business logic from infrastructure
- **Port:** Interface defining a capability
- **Adapter:** Implementation of a port

---

**Status:** Planning Complete ✅
**Next Phase:** Code
**Ready to Implement:** Yes
**Estimated Duration:** 8 hours
**Confidence Level:** High (95%)
