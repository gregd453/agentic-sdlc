# Implementation Plan: Phase 3 Complete Message Bus Integration

**Date:** 2025-11-13
**Planner:** Claude Code (Session #55)
**Estimated Time:** 2.5 hours + 0.5 hours validation = **3 hours total**
**Risk Level:** MEDIUM (well-defined scope, clear target architecture, but affects all agents)

---

## Executive Summary

- **Current State:** Phase 3 is 33% complete - agents publish results ✅ but cannot receive tasks ❌
- **Target State:** Symmetric message bus architecture - both directions use messageBus + streams
- **Key Changes:** 8 files across agents and orchestrator, remove AgentDispatcherService, wire containers
- **Dependencies:** Phase 1-2 complete ✅, OrchestratorContainer available ✅, message bus working ✅

**Impact:** This fixes the critical asymmetry causing 100% E2E workflow failure. After completion, agents will receive tasks via message bus with stream durability, enabling full workflow execution.

---

## Gap Analysis

### Current State vs Target State

| Component | Current (Broken) | Target (Required) | Gap |
|-----------|------------------|-------------------|-----|
| **Agent Initialization** | `new ScaffoldAgent()` | `new ScaffoldAgent(messageBus)` | No container, no DI |
| **Agent Task Subscription** | `redis.subscribe('agent:X:tasks')` | `messageBus.subscribe('agent:X:tasks')` | Raw Redis, no streams |
| **Orchestrator Task Dispatch** | `agentDispatcher.dispatchTask()` | `messageBus.publish('agent:X:tasks')` | Old service, no streams |
| **AgentDispatcherService** | Still instantiated & used | Completely removed | Present in server.ts |
| **Task Persistence** | Ephemeral pub/sub only | Pub/sub + stream mirroring | No durability |

### Data Flow Asymmetry (Current)

```
BROKEN PATH: Orchestrator → Agent (Tasks)
┌─────────────────────────────────────────┐
│  WorkflowService                        │
│       ↓                                  │
│  AgentDispatcherService ⚠️ OLD          │
│       ↓                                  │
│  redis.publish() ⚠️ RAW                 │
│       ↓                                  │
│  Agent ??? ❌ NOT RECEIVING             │
└─────────────────────────────────────────┘

WORKING PATH: Agent → Orchestrator (Results)
┌─────────────────────────────────────────┐
│  Agent.reportResult()                   │
│       ↓                                  │
│  redis.publish() + xadd() ✅            │
│       ↓            ↓                     │
│  Pub/Sub      Stream ✅                 │
│       ↓            ↓                     │
│  messageBus.subscribe() ✅              │
└─────────────────────────────────────────┘
```

### What's Missing

**5 critical items:**

- [ ] **Agent Container Integration** - Agents don't initialize with OrchestratorContainer
- [ ] **Agent Task Subscription** - Agents use raw redis.subscribe(), not messageBus.subscribe()
- [ ] **Orchestrator Task Publishing** - Uses AgentDispatcherService, not messageBus.publish()
- [ ] **AgentDispatcherService Removal** - Still instantiated in server.ts:119
- [ ] **Task Stream Persistence** - Tasks only use pub/sub, no stream mirroring

### What's Incomplete

- [ ] **Phase 1** - Container created ✅, but AgentDispatcherService not removed ❌
- [ ] **Symmetric Architecture** - Only one direction uses message bus

---

## Implementation Steps

### Step 1: Agent Container Integration (30 minutes)

**Purpose:** Wire OrchestratorContainer into all 6 agents, enable DI

#### File 1.1: `packages/agents/base-agent/src/base-agent.ts`

**Changes:**
1. **Line 20-26:** Update constructor signature to accept `IMessageBus` parameter
   ```typescript
   // BEFORE
   constructor(capabilities: AgentCapabilities) {
     this.agentId = `${capabilities.type}-${randomUUID().slice(0, 8)}`;
     this.capabilities = capabilities;
     // ... Redis initialization ...
   }

   // AFTER
   import { IMessageBus } from '@agentic-sdlc/orchestrator/hexagonal/ports/message-bus.port';

   protected messageBus: IMessageBus; // Add field

   constructor(
     capabilities: AgentCapabilities,
     messageBus: IMessageBus // Add parameter
   ) {
     this.agentId = `${capabilities.type}-${randomUUID().slice(0, 8)}`;
     this.capabilities = capabilities;
     this.messageBus = messageBus; // Store messageBus
     // Keep Redis for now (Phase 3.2 will migrate subscription)
   }
   ```

2. **Line 34:** Add validation
   ```typescript
   if (!messageBus) {
     throw new AgentError('messageBus is required', 'CONFIG_ERROR');
   }
   ```

**Dependencies:** None
**Test Impact:** `base-agent.test.ts` - update constructor calls with mock messageBus

---

#### File 1.2: `packages/agents/scaffold-agent/src/run-agent.ts`

**Changes:**
1. **Line 1-5:** Add imports
   ```typescript
   import { OrchestratorContainer } from '@agentic-sdlc/orchestrator/hexagonal/bootstrap';
   import { IMessageBus } from '@agentic-sdlc/orchestrator/hexagonal/ports/message-bus.port';
   ```

2. **Line 19-24:** Initialize container and inject messageBus
   ```typescript
   // BEFORE
   const agent = new ScaffoldAgent();

   // AFTER
   // Create and initialize container
   const container = new OrchestratorContainer({
     redisUrl: process.env.REDIS_URL || 'redis://localhost:6380',
     redisNamespace: 'agent-scaffold',
     coordinators: {} // No coordinators needed for agents
   });

   await container.initialize();
   console.log('[PHASE-3] OrchestratorContainer initialized for scaffold agent');

   const messageBus = container.getBus();
   const agent = new ScaffoldAgent(messageBus);
   ```

3. **Line 33-43:** Update shutdown to close container
   ```typescript
   // Add to SIGINT/SIGTERM handlers
   await container.shutdown();
   ```

**Dependencies:** Step 1.1 complete
**Test Impact:** Integration tests - verify agent starts with container

---

#### Files 1.3-1.7: Remaining Agent `run-agent.ts` Files

**Apply identical changes to:**
- `packages/agents/validation-agent/src/run-agent.ts`
- `packages/agents/e2e-agent/src/run-agent.ts`
- `packages/agents/integration-agent/src/run-agent.ts`
- `packages/agents/deployment-agent/src/run-agent.ts`

**Pattern:** Same as 1.2, update `redisNamespace` to match agent type:
- `'agent-validation'`
- `'agent-e2e'`
- `'agent-integration'`
- `'agent-deployment'`

**Dependencies:** Step 1.1 complete
**Test Impact:** All agent integration tests

---

### Step 2: Agent Task Subscription via Message Bus (45 minutes)

**Purpose:** Agents subscribe to tasks via messageBus with stream consumer groups

#### File 2.1: `packages/agents/base-agent/src/base-agent.ts`

**Changes:**
1. **Line 92-125:** Replace `initialize()` method's Redis subscription with messageBus subscription
   ```typescript
   async initialize(): Promise<void> {
     this.logger.info('Initializing agent', {
       type: this.capabilities.type,
       version: this.capabilities.version,
       capabilities: this.capabilities.capabilities
     });

     // Test Redis connections (keep for now - used for result publishing)
     await this.redisPublisher.ping();

     // PHASE 3: Subscribe to tasks via message bus
     const taskChannel = REDIS_CHANNELS.AGENT_TASKS(this.capabilities.type);

     await this.messageBus.subscribe(
       taskChannel,
       async (message: any) => {
         try {
           const agentMessage: AgentMessage = typeof message === 'string'
             ? JSON.parse(message)
             : message;
           await this.receiveTask(agentMessage);
         } catch (error) {
           this.logger.error('[PHASE-3] Failed to process task from message bus', {
             error,
             message
           });
           this.errorsCount++;
         }
       },
       {
         consumerGroup: `agent-${this.capabilities.type}-group`,
         fromBeginning: false // Only new messages
       }
     );

     this.logger.info('[PHASE-3] Agent subscribed to message bus for tasks', {
       taskChannel,
       consumerGroup: `agent-${this.capabilities.type}-group`
     });

     // Register agent with orchestrator (use publisher connection)
     await this.registerWithOrchestrator();

     this.logger.info('[PHASE-3] Agent initialized successfully with message bus');
   }
   ```

2. **Remove old Redis subscriber setup:**
   - Delete lines 104-117 (old `redisSubscriber.on('message')` handler)
   - Delete lines 114-117 (old `redisSubscriber.subscribe()` call)

3. **Update cleanup method** to unsubscribe from message bus if needed

**Dependencies:** Step 1.1-1.7 complete (messageBus available)
**Test Impact:** Agent task reception tests - verify tasks received via messageBus

---

### Step 3: Orchestrator Task Publishing via Message Bus (30 minutes)

**Purpose:** Orchestrator publishes tasks via messageBus with stream mirroring

#### File 3.1: `packages/orchestrator/src/services/workflow.service.ts`

**Changes:**
1. **Line 468-483:** Replace `createTaskForStage()` dispatch logic
   ```typescript
   // BEFORE (Line 468-475)
   // Dispatch envelope to agent via Redis
   if (this.agentDispatcher) {
     // Phase 2: Removed per-workflow callback registration
     // Results now handled by persistent messageBus subscription in setupMessageBusSubscription()
     // No more: this.agentDispatcher.onResult(workflowId, handler)

     // Dispatch the envelope to agent
     await this.agentDispatcher.dispatchTask(envelope, workflowData);
   }

   // AFTER
   // Phase 3: Dispatch envelope to agent via message bus
   if (this.messageBus) {
     const taskChannel = `agent:${agentType}:tasks`;

     await this.messageBus.publish(
       taskChannel,
       envelope,
       {
         key: workflowId,
         mirrorToStream: `stream:${taskChannel}` // Durability via stream
       }
     );

     logger.info('[PHASE-3] Task dispatched via message bus', {
       task_id: taskId,
       workflow_id: workflowId,
       stage,
       agent_type: agentType,
       channel: taskChannel,
       stream_mirrored: true
     });
   } else {
     logger.error('[PHASE-3] messageBus not available for task dispatch', {
       workflow_id: workflowId,
       stage
     });
     throw new Error('Message bus not initialized - cannot dispatch task');
   }
   ```

2. **Line 25:** Remove `agentDispatcher` parameter (will be removed in Step 4)
   - Keep for now to avoid breaking constructor calls
   - Mark as deprecated with comment

**Dependencies:** None (messageBus already available from Phase 2)
**Test Impact:** Workflow service tests - verify tasks published to messageBus

---

### Step 4: Remove AgentDispatcherService (15 minutes)

**Purpose:** Complete Phase 1 by removing deprecated dispatch service

#### File 4.1: `packages/orchestrator/src/server.ts`

**Changes:**
1. **Line 116-120:** Remove AgentDispatcherService initialization
   ```typescript
   // DELETE these lines:
   // Phase 2: AgentDispatcherService kept for task dispatch
   // Note: Per-workflow callbacks removed, using messageBus subscription instead
   // TODO Phase 3: Agents will publish directly to messageBus, then AgentDispatcherService can be fully removed
   const { AgentDispatcherService } = await import('./services/agent-dispatcher.service');
   const agentDispatcher = new AgentDispatcherService(redisUrl);
   ```

2. **Line 122-129:** Remove agentDispatcher from WorkflowService constructor
   ```typescript
   // BEFORE
   const workflowService = new WorkflowService(
     workflowRepository,
     eventBus,
     stateMachineService,
     agentDispatcher, // Phase 2: Used for dispatch only, not callbacks
     redisUrl,
     messageBus // Phase 2: messageBus subscription active for agent results
   );

   // AFTER
   const workflowService = new WorkflowService(
     workflowRepository,
     eventBus,
     stateMachineService,
     undefined, // No longer needed
     redisUrl,
     messageBus
   );
   ```

3. **Line 133-137:** Remove agentDispatcher from PipelineExecutorService
   ```typescript
   // BEFORE
   const pipelineExecutor = new PipelineExecutorService(
     eventBus,
     agentDispatcher,
     qualityGateService
   );

   // AFTER
   const pipelineExecutor = new PipelineExecutorService(
     eventBus,
     undefined, // No longer needed - using messageBus
     qualityGateService
   );
   ```

4. **Line 143:** Remove agentDispatcher from HealthCheckService
   ```typescript
   // BEFORE
   const healthCheckService = new HealthCheckService(prisma, eventBus, agentDispatcher);

   // AFTER
   const healthCheckService = new HealthCheckService(prisma, eventBus, undefined);
   ```

5. **Line 161:** Remove agentDispatcher from scaffoldRoutes
   ```typescript
   // BEFORE
   await fastify.register(scaffoldRoutes, { agentDispatcher });

   // AFTER
   // May need to remove entire scaffoldRoutes registration if it depends on agentDispatcher
   // OR update scaffoldRoutes to not require agentDispatcher
   ```

**Dependencies:** Step 3.1 complete (task dispatch using messageBus)
**Test Impact:** Server initialization tests - verify starts without agentDispatcher

---

#### File 4.2: `packages/orchestrator/src/services/workflow.service.ts`

**Changes:**
1. **Line 25:** Remove agentDispatcher parameter completely
   ```typescript
   // BEFORE
   constructor(
     private repository: WorkflowRepository,
     private eventBus: EventBus,
     private stateMachineService: WorkflowStateMachineService,
     private agentDispatcher?: AgentDispatcherService,
     redisUrl: string = process.env.REDIS_URL || 'redis://127.0.0.1:6379',
     messageBus?: IMessageBus
   )

   // AFTER
   constructor(
     private repository: WorkflowRepository,
     private eventBus: EventBus,
     private stateMachineService: WorkflowStateMachineService,
     redisUrl: string = process.env.REDIS_URL || 'redis://127.0.0.1:6379',
     messageBus?: IMessageBus
   )
   ```

2. **Remove field:** Delete `private agentDispatcher?: AgentDispatcherService` declaration

**Dependencies:** Step 4.1 complete (no more references to agentDispatcher)
**Test Impact:** All WorkflowService tests - remove agentDispatcher mocks

---

### Step 5: Diagnostic Logging & Phase 3 Markers (15 minutes)

**Purpose:** Add visibility into message flow for debugging

#### File 5.1: All Modified Files

**Add `[PHASE-3]` log markers at key points:**

1. **Agent initialization** (base-agent.ts)
   ```typescript
   logger.info('[PHASE-3] Agent initializing with message bus', {
     agent_type: this.capabilities.type,
     messageBus_available: !!this.messageBus
   });
   ```

2. **Agent task subscription** (base-agent.ts)
   ```typescript
   logger.info('[PHASE-3] Agent subscribed to message bus for tasks', {
     taskChannel,
     consumerGroup: `agent-${this.capabilities.type}-group`
   });
   ```

3. **Agent task reception** (base-agent.ts)
   ```typescript
   logger.info('[PHASE-3] Agent received task from message bus', {
     workflow_id: message.workflow_id,
     task_id: message.payload?.task_id,
     channel: taskChannel
   });
   ```

4. **Orchestrator task publish** (workflow.service.ts)
   ```typescript
   logger.info('[PHASE-3] Task dispatched via message bus', {
     task_id: taskId,
     workflow_id: workflowId,
     stage,
     agent_type: agentType,
     channel: taskChannel,
     stream_mirrored: true
   });
   ```

5. **Container initialization** (run-agent.ts files)
   ```typescript
   console.log('[PHASE-3] OrchestratorContainer initialized for [agent-type] agent');
   ```

**Dependencies:** Steps 1-4 complete
**Test Impact:** Log output verification

---

## Implementation Sequence

### Timeline Breakdown

| Step | Description | Time | Cumulative | Risk |
|------|-------------|------|------------|------|
| 1 | Agent Container Integration | 30 min | 0:30 | LOW |
| 2 | Agent Task Subscription | 45 min | 1:15 | MEDIUM |
| 3 | Orchestrator Task Publishing | 30 min | 1:45 | LOW |
| 4 | AgentDispatcherService Removal | 15 min | 2:00 | LOW |
| 5 | Diagnostic Logging | 15 min | 2:15 | LOW |
| 6 | Build & Unit Tests | 15 min | 2:30 | LOW |
| 7 | E2E Validation | 30 min | 3:00 | MEDIUM |

**Total Time:** 3 hours

### Execution Order

**Phase A: Foundation (Steps 1-2, 1 hour 15 min)**
1. Update BaseAgent constructor to accept messageBus
2. Update all 6 agent run-agent.ts files with container
3. Update BaseAgent.initialize() to subscribe via messageBus
4. **Checkpoint:** Agents can start and subscribe (no tasks yet)

**Phase B: Task Dispatch (Step 3, 30 min)**
5. Update WorkflowService to publish tasks via messageBus
6. Add stream mirroring for task durability
7. **Checkpoint:** Tasks published to message bus

**Phase C: Cleanup (Steps 4-5, 30 min)**
8. Remove AgentDispatcherService from server.ts
9. Remove agentDispatcher parameter from WorkflowService
10. Add Phase 3 diagnostic logging
11. **Checkpoint:** No AgentDispatcherService references remain

**Phase D: Validation (Steps 6-7, 45 min)**
12. Run full build
13. Run unit tests (expect 100%)
14. Run E2E pipeline test
15. **Final Checkpoint:** E2E workflow completes all stages ✅

---

## Test Strategy

### Unit Tests

**Test Files to Run:**
```bash
# Agent tests
cd packages/agents/base-agent && npm test
cd packages/agents/scaffold-agent && npm test

# Orchestrator tests
cd packages/orchestrator && npm test

# Full suite
npm run test
```

**Expected Changes:**
- ✅ All unit tests should remain PASSING (100%)
- ⚠️ Some tests may need mock updates for messageBus parameter
- ✅ No new test failures

**Why unit tests may still pass despite system being broken:**
- Unit tests use mocks and stubs
- They don't test real message flow
- Integration failures are hidden

### Integration Tests

**Test Files:**
```bash
# Three-agent pipeline
packages/orchestrator/tests/e2e/three-agent-pipeline.test.ts

# Five-agent pipeline
packages/orchestrator/tests/e2e/five-agent-pipeline.test.ts
```

**Expected Outcome:**
- Should remain passing with mocked messageBus
- Real integration tested in E2E

### E2E Tests (CRITICAL)

**Real Pipeline Test:**
```bash
# Start infrastructure
./scripts/env/start-dev.sh

# Wait for services
sleep 10

# Run E2E workflow test
./scripts/run-pipeline-test.sh "Hello World API"
```

**Success Criteria:**
```
✅ Workflow created successfully
✅ Initialization stage completes
✅ Scaffolding stage completes
✅ Validation stage completes
✅ E2E testing stage completes
✅ Integration testing stage completes
✅ Deployment stage completes
✅ Workflow status: completed
✅ No hangs or timeouts
✅ All agents received tasks
✅ All agents published results
```

**Failure Indicators:**
```
❌ Workflow stuck in 'initialization'
❌ Timeout waiting for agent response
❌ Agent logs show "no task received"
❌ Orchestrator logs show "no result received"
❌ Missing [PHASE-3] markers in logs
```

**Diagnostic Commands:**
```bash
# Check agent logs
docker logs agentic-scaffold-agent-1 2>&1 | grep "PHASE-3"

# Check orchestrator logs
docker logs agentic-orchestrator-1 2>&1 | grep "PHASE-3"

# Check Redis streams
redis-cli -p 6380 XRANGE stream:agent:scaffold:tasks - + COUNT 10

# Check Redis pub/sub
redis-cli -p 6380 PUBSUB CHANNELS "agent:*"
```

---

## Success Criteria

### Phase 3 Completion Checklist

- [ ] **Agent Container Integration**
  - [ ] BaseAgent accepts messageBus parameter
  - [ ] All 6 run-agent.ts files create OrchestratorContainer
  - [ ] Container initialized successfully for each agent
  - [ ] messageBus extracted and injected

- [ ] **Agent Task Subscription**
  - [ ] Agents subscribe via messageBus.subscribe()
  - [ ] Stream consumer groups configured
  - [ ] Raw redis.subscribe() calls removed
  - [ ] Agents log subscription success with [PHASE-3]

- [ ] **Orchestrator Task Publishing**
  - [ ] Tasks published via messageBus.publish()
  - [ ] Stream mirroring enabled with mirrorToStream
  - [ ] agentDispatcher.dispatchTask() calls removed
  - [ ] Orchestrator logs publish success with [PHASE-3]

- [ ] **AgentDispatcherService Removal**
  - [ ] Removed from server.ts initialization
  - [ ] Removed from WorkflowService constructor
  - [ ] Removed from all other services
  - [ ] No remaining references in codebase

- [ ] **Diagnostic Logging**
  - [ ] [PHASE-3] markers in agent initialization
  - [ ] [PHASE-3] markers in task subscription
  - [ ] [PHASE-3] markers in task dispatch
  - [ ] [PHASE-3] markers in task reception

- [ ] **Build & Tests**
  - [ ] Full build passes (all 12 packages)
  - [ ] Unit tests pass (100%, 86/86)
  - [ ] No TypeScript errors
  - [ ] No linting errors

- [ ] **E2E Validation**
  - [ ] Workflow completes all 6 stages
  - [ ] No hangs at initialization
  - [ ] All agents receive tasks
  - [ ] All agents publish results
  - [ ] Symmetric message bus confirmed

### Verification Commands

```bash
# 1. Build
npm run build

# 2. Unit tests
npm run test

# 3. E2E test
./scripts/run-pipeline-test.sh "Hello World API"

# 4. Log verification
grep -r "PHASE-3" packages/agents/*/src/*.ts
grep -r "PHASE-3" packages/orchestrator/src/**/*.ts

# 5. Code verification
grep -r "AgentDispatcherService" packages/orchestrator/src/
# Expected: No results (completely removed)
```

---

## Rollback Plan

### Rollback Points

**Rollback Point 1: After Step 1 (Agent Container Integration)**
- If agents fail to start with container
- Action: Revert BaseAgent constructor changes
- Recovery: `git checkout -- packages/agents/*/src/`

**Rollback Point 2: After Step 2 (Agent Task Subscription)**
- If agents fail to subscribe to messageBus
- Action: Revert to raw redis.subscribe()
- Recovery: `git checkout -- packages/agents/base-agent/src/base-agent.ts`

**Rollback Point 3: After Step 3 (Orchestrator Task Publishing)**
- If tasks not published correctly
- Action: Revert to agentDispatcher.dispatchTask()
- Recovery: `git checkout -- packages/orchestrator/src/services/workflow.service.ts`

**Rollback Point 4: After Step 4 (AgentDispatcherService Removal)**
- If system completely breaks
- Action: Restore AgentDispatcherService
- Recovery: `git checkout -- packages/orchestrator/src/server.ts`

### Failure Detection

**Early Detection:**
- Build errors → Stop immediately, fix TypeScript issues
- Unit test failures → Stop, update test mocks
- Agent startup failures → Rollback to previous step

**Late Detection:**
- E2E workflow hangs → Check logs for [PHASE-3] markers
- No tasks received → Verify messageBus subscription
- No results received → Check task dispatch logs

### Recovery Strategy

**If E2E test fails after completion:**

1. **Diagnose:** Check logs for missing [PHASE-3] markers
   ```bash
   docker logs agentic-scaffold-agent-1 2>&1 | grep -E "(PHASE-3|ERROR)"
   docker logs agentic-orchestrator-1 2>&1 | grep -E "(PHASE-3|ERROR)"
   ```

2. **Common Issues:**
   - Container not initialized → Check run-agent.ts
   - MessageBus not injected → Check BaseAgent constructor
   - Tasks not published → Check workflow.service.ts
   - Tasks not received → Check base-agent.ts subscription

3. **Quick Fix:**
   - Add more diagnostic logging
   - Verify channel names match
   - Check Redis connection health
   - Verify stream consumer groups

4. **Full Rollback:**
   ```bash
   git reset --hard HEAD~1
   npm install
   npm run build
   ./scripts/env/start-dev.sh
   ```

---

## Documentation Updates

### Files to Update After Completion

- [ ] **CLAUDE.md**
  - Update Phase 3 status: 33% → 100%
  - Remove asymmetry warnings
  - Update "What Works" section
  - Change status from "INCOMPLETE" to "COMPLETE"

- [ ] **PHASE-1-6-IMPLEMENTATION-ANALYSIS.md**
  - Mark all Phase 3 items as complete
  - Update data flow diagrams
  - Remove gap analysis sections
  - Add completion timestamp

- [ ] **Session Notes**
  - Create SESSION-55-SUMMARY.md
  - Document Phase 3 completion
  - Include before/after metrics
  - Note any issues encountered

- [ ] **CODE-CHANGES-DETAILED.md**
  - Append Phase 3 completion changes
  - List all 8 modified files
  - Document key transformations

---

## Risk Assessment

### Risk Level: MEDIUM

**Why Medium (not High):**
- ✅ Clear target architecture (follow result path pattern)
- ✅ Well-defined scope (8 files, known changes)
- ✅ Container infrastructure already exists
- ✅ Message bus already working (one direction)
- ✅ Comprehensive rollback plan

**Why Not Low:**
- ⚠️ Affects all 6 agents simultaneously
- ⚠️ Changes core message dispatch mechanism
- ⚠️ Removes deprecated service (AgentDispatcherService)
- ⚠️ Requires E2E testing to verify

### Mitigation Strategies

1. **Incremental Implementation**
   - Complete one agent first (scaffold)
   - Test thoroughly before others
   - Then replicate to remaining 5 agents

2. **Continuous Validation**
   - Run build after each file change
   - Run unit tests after each step
   - Check logs for [PHASE-3] markers

3. **Parallel Monitoring**
   - Keep old logs for comparison
   - Monitor Redis pub/sub traffic
   - Watch stream consumer groups

4. **Communication**
   - Document each step completion
   - Note any deviations from plan
   - Capture unexpected issues

---

## Key Technical Details

### Message Bus Interface (IMessageBus)

**From:** `packages/orchestrator/src/hexagonal/ports/message-bus.port.ts`

```typescript
interface IMessageBus {
  publish<T>(topic: string, msg: T, opts?: PublishOptions): Promise<void>;
  subscribe<T>(topic: string, handler: (msg: T) => Promise<void>, opts?: SubscriptionOptions): Promise<() => Promise<void>>;
  health(): Promise<BusHealth>;
  disconnect(): Promise<void>;
}

interface PublishOptions {
  key?: string;
  durable?: boolean;
  ttlSec?: number;
  mirrorToStream?: string; // CRITICAL: Enable stream persistence
  consumerGroup?: string;
}

interface SubscriptionOptions {
  fromBeginning?: boolean;
  consumerGroup?: string; // CRITICAL: Enable load balancing
}
```

### Container Pattern

**From:** `packages/orchestrator/src/hexagonal/bootstrap.ts`

```typescript
// Agent initialization pattern:
const container = new OrchestratorContainer({
  redisUrl: process.env.REDIS_URL,
  redisNamespace: 'agent-[type]',
  coordinators: {} // Not needed for agents
});

await container.initialize();
const messageBus = container.getBus();
const agent = new AgentType(messageBus);
await agent.initialize();

// Cleanup:
await container.shutdown();
```

### Channel Naming Convention

**Tasks:** `agent:${agentType}:tasks`
- Example: `agent:scaffold:tasks`

**Results:** `orchestrator:results` (already implemented)

**Streams:** `stream:${channel}`
- Example: `stream:agent:scaffold:tasks`

---

## Appendix: File Change Summary

### Files Modified (8 total)

**Agents (7 files):**
1. `packages/agents/base-agent/src/base-agent.ts` - Constructor + subscription
2. `packages/agents/scaffold-agent/src/run-agent.ts` - Container init
3. `packages/agents/validation-agent/src/run-agent.ts` - Container init
4. `packages/agents/e2e-agent/src/run-agent.ts` - Container init
5. `packages/agents/integration-agent/src/run-agent.ts` - Container init
6. `packages/agents/deployment-agent/src/run-agent.ts` - Container init

**Orchestrator (2 files):**
7. `packages/orchestrator/src/services/workflow.service.ts` - Task publish + remove agentDispatcher
8. `packages/orchestrator/src/server.ts` - Remove AgentDispatcherService

### Lines Changed (Estimated)

- **Lines Added:** ~150
- **Lines Removed:** ~80
- **Lines Modified:** ~40
- **Net Change:** +70 lines

### Complexity Metrics

- **Files Touched:** 8
- **Functions Modified:** 12
- **Classes Modified:** 2 (BaseAgent, WorkflowService)
- **New Dependencies:** 1 (IMessageBus import in BaseAgent)
- **Removed Dependencies:** 1 (AgentDispatcherService)

---

## Plan Approval Required

**⚠️ USER APPROVAL NEEDED BEFORE PROCEEDING TO `/code`**

**This plan will:**
1. Modify 8 files across agents and orchestrator
2. Remove AgentDispatcherService completely
3. Migrate all agents to message bus architecture
4. Enable symmetric message flow (both directions)
5. Restore full E2E workflow functionality

**Estimated Time:** 3 hours
**Risk Level:** Medium
**Rollback:** Available at multiple checkpoints

**Questions to resolve before starting:**
1. Should we implement all agents simultaneously or one-by-one?
2. Any specific validation requirements beyond E2E test?
3. Should we keep scaffold.routes or remove it (depends on AgentDispatcherService)?

**Please approve this plan or request modifications before proceeding to `/code`.**

---

**Plan Status:** ✅ COMPLETE - Awaiting User Approval
**Next Command:** `/code` (after approval)
**Estimated Completion:** +3 hours from approval
