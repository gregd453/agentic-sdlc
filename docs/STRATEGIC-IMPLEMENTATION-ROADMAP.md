# Strategic Architecture Implementation Roadmap

**Status:** Ready to Begin Phases 1-6
**Current State:** Schema compliance complete, callbacks still in use
**Goal:** Replace callbacks with event-driven message bus + autonomous state machine
**Timeline:** 6-8 hours across 4-6 sessions

---

## Current Architecture (Callback-Based)

```
Agent                                Orchestrator
  │                                       │
  └─→ redis.publish('agent:results')     │
       └─→ Payload is AgentResultSchema  │
            (now compliant ✅)            │
                                         │
                    ┌────────────────────┘
                    │
          AgentDispatcherService
          ├─ onResult(workflowId, handler)
          │  └─ Registers callback
          ├─ Waits for Redis message
          └─ Calls callback with result
               │
               ▼
          WorkflowService.handleAgentResult()
          ├─ Validates result
          ├─ Stores stage_output
          ├─ Publishes STAGE_COMPLETE event
          └─ State machine processes event
               │
               ▼
          State Machine (xstate)
          └─ Transitions stage
               │
               ▼
          WorkflowService.createTaskForStage()
          └─ Creates next task

PROBLEMS:
❌ Per-workflow handler registration
❌ Handler deleted after first result
❌ Workflows hang at stage 2+
❌ No message persistence
❌ No recovery from stream
❌ Tightly coupled components
```

---

## Target Architecture (Event-Driven)

```
Agent                                Orchestrator Container
  │                                        │
  └─→ messageBus.publish(                 │
       'agent:results',                   │
       agentResult                        │
  ) ─────────────────────────────────────┐│
       │ (persisted to stream)            ││
       │                                   ││
       └──────────────────────────────────┘│
                                          │
                            OrchestratorContainer
                            ├─ IMessageBus
                            │  ├─ pSubscribe('agent:results')
                            │  └─ Stream persistence
                            └─ IKVStore
                               ├─ workflow:*:state
                               └─ workflow:*:outputs
                                  │
                    ┌─────────────┴──────────────┐
                    │                            │
            WorkflowService              StateMachineService
            ├─ subscribe('agent:results')  ├─ subscribe('STAGE_COMPLETE')
            │  └─ Single subscription      │  └─ Autonomous transitions
            ├─ handleAgentResult()         └─ xstate state machine
            ├─ storeStageOutput()
            └─ publishStageComplete()

BENEFITS:
✅ Single centralized subscription
✅ Handlers persist lifetime
✅ Message persistence in stream
✅ Recovery on startup
✅ Decoupled components
✅ Autonomous state machine
✅ No per-workflow lifecycle
✅ Production-ready
```

---

## Phase-by-Phase Implementation Plan

### **PHASE 1: Initialize OrchestratorContainer** (1 hour)
**Goal:** Wire hexagonal container into application bootstrap

**What Gets Removed:**
- ❌ `AgentDispatcherService` initialization
- ❌ Raw `redisUrl` parameter passing
- ❌ Manual handler registration setup

**What Gets Added:**
- ✅ `OrchestratorContainer` instantiation
- ✅ Container async initialization
- ✅ `messageBus` and `kvStore` extraction
- ✅ Graceful shutdown integration

**Key Files:**
- `packages/orchestrator/src/server.ts`
- `packages/orchestrator/src/services/workflow.service.ts` (constructor)

**Changes Required:**

```typescript
// BEFORE:
const agentDispatcher = new AgentDispatcherService(redisUrl);
const workflowService = new WorkflowService(
  workflowRepository,
  eventBus,
  stateMachineService,
  agentDispatcher
);

// AFTER:
import { OrchestratorContainer } from './hexagonal';

const container = new OrchestratorContainer({
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6380',
  redisNamespace: 'agentic-sdlc'
});
await container.initialize();

const messageBus = container.getBus();
const kvStore = container.getKV();

const workflowService = new WorkflowService(
  workflowRepository,
  eventBus,
  stateMachineService,
  messageBus  // ← Changed from agentDispatcher
);

// On shutdown:
fastify.addHook('onClose', async () => {
  await container.shutdown();
});
```

**Expected Outcome:**
- Orchestrator starts with container
- Bus and KV store healthy
- No more AgentDispatcherService
- Graceful startup/shutdown

**Testing:**
```bash
npm run dev
# Should see: "OrchestratorContainer initialized successfully"
# Should see: "Message bus health: OK"
# Should see: "KV store health: OK"
```

**Estimated Time:** 1 hour
**Risk Level:** Low (isolated bootstrap changes)

---

### **PHASE 2: Subscribe WorkflowService to Message Bus** (1 hour)
**Goal:** Replace per-workflow callback registration with single bus subscription

**What Gets Removed:**
- ❌ `agentDispatcher.onResult(workflowId, handler)` calls
- ❌ `agentDispatcher.offResult(workflowId)` calls
- ❌ Handler registration in `createTaskForStage()`
- ❌ Handler lifecycle management
- ❌ `resultHandlers` Map
- ❌ `handlerTimeouts` tracking

**What Gets Added:**
- ✅ Message bus subscription in constructor
- ✅ Single `handleAgentResultFromBus()` handler
- ✅ Result validated and processed centrally
- ✅ No handler deletion logic

**Key Files:**
- `packages/orchestrator/src/services/workflow.service.ts`

**Changes Required:**

```typescript
// BEFORE (in createTaskForStage):
await this.agentDispatcher.dispatchTask(envelope, workflowData);

this.agentDispatcher.onResult(workflowId, async (result) => {
  await this.handleAgentResult(result);
});

// AFTER (in constructor):
// Subscribe ONCE to agent:results topic
this.messageBus.subscribe(
  'agent:results',
  async (result: any) => {
    await this.handleAgentResult(result);
  },
  { key: 'workflow-service' }  // Named subscription
);

// And in createTaskForStage:
await this.messageBus.publish('agent:tasks:' + agentType, envelope);
```

**Remove Methods:**
- Delete `agentDispatcher.onResult()` registration
- Delete handler lifecycle logic
- Delete `resultHandlers` Map management

**Expected Outcome:**
- WorkflowService subscribes to bus once
- All agent results routed to single handler
- Handlers persist for service lifetime
- No per-workflow overhead

**Testing:**
```bash
npm run dev
# Create workflow via POST /api/v1/workflows
# Should see: "WorkflowService subscribed to 'agent:results'"
# Task dispatched to agent
# Result should be processed by handler
```

**Estimated Time:** 1 hour
**Risk Level:** Medium (changes core result flow)

---

### **PHASE 3: Update Agents to Publish to Message Bus** (1.5 hours)
**Goal:** Agents publish to message bus instead of raw Redis

**What Gets Removed:**
- ❌ `redis.publish('orchestrator:results', ...)`
- ❌ Raw Redis channel publishing
- ❌ Manual JSON.stringify()

**What Gets Added:**
- ✅ `messageBus.publish('agent:results', agentResult)`
- ✅ Stream persistence (mirrorToStream)
- ✅ Message durability
- ✅ Typed message bus interface

**Key Files:**
- `packages/agents/base-agent/src/base-agent.ts` (reportResult already uses redis.publish)
- All agent `run-agent.ts` entry points

**Changes Required:**

```typescript
// In BaseAgent.reportResult():

// BEFORE:
await this.redisPublisher.publish(
  REDIS_CHANNELS.ORCHESTRATOR_RESULTS,
  JSON.stringify({
    id: randomUUID(),
    type: 'result',
    agent_id: this.agentId,
    workflow_id: validatedResult.workflow_id,
    stage: stage,
    payload: agentResult,
    timestamp: new Date().toISOString(),
    trace_id: randomUUID()
  } as AgentMessage)
);

// AFTER:
await this.messageBus.publish(
  'agent:results',
  agentResult,  // Already AgentResultSchema-compliant
  {
    key: validatedResult.workflow_id,
    mirrorToStream: 'agent:results:stream'  // Durability
  }
);
```

**Agent Initialization:**
```typescript
// In each agent's run-agent.ts:

// BEFORE:
const agent = new ScaffoldAgent();
await agent.initialize();

// AFTER:
const container = new OrchestratorContainer({...});
await container.initialize();

const messageBus = container.getBus();
const agent = new ScaffoldAgent(messageBus);
await agent.initialize();
```

**Expected Outcome:**
- Agents publish to message bus
- Results persist to Redis stream
- No raw Redis.publish() calls remain
- Messages durable across restarts

**Testing:**
```bash
npm run dev
# Start agents
# Create workflow
# Monitor Redis:
#   XRANGE agent:results:stream -count 1
#   Should show result persisted
```

**Estimated Time:** 1.5 hours
**Risk Level:** Medium-High (affects all agents)

---

### **PHASE 4: State Machine Event Integration** (1 hour)
**Goal:** State machine becomes autonomous, receiving events from message bus

**What Gets Removed:**
- ❌ Manual `stateMachine.send()` calls in WorkflowService
- ❌ WorkflowService managing state transitions
- ❌ WorkflowService waiting for transitions

**What Gets Added:**
- ✅ StateMachineService subscribes to STAGE_COMPLETE events
- ✅ State machine transitions automatically
- ✅ Database updated by state machine
- ✅ Next task created autonomously

**Key Files:**
- `packages/orchestrator/src/state-machine/workflow-state-machine.ts`
- `packages/orchestrator/src/services/workflow.service.ts` (remove state machine calls)

**Changes Required:**

```typescript
// In WorkflowStateMachineService constructor:

constructor(
  private repository: WorkflowRepository,
  private eventBus: EventBus
) {
  // Subscribe to STAGE_COMPLETE events
  this.eventBus.subscribe('STAGE_COMPLETE', async (event) => {
    const sm = this.getStateMachine(event.workflow_id);
    if (sm) {
      // Send event to state machine
      sm.send({
        type: 'STAGE_COMPLETE',
        stage: event.payload.stage,
        output: event.payload.output
      });

      // State machine's onDone handler updates database
      logger.info('State machine transitioned', {
        workflow_id: event.workflow_id,
        new_stage: sm.getSnapshot().value
      });
    }
  });
}

// In state machine's onDone handler:
onDone: async (context) => {
  // Update database with new stage
  await repository.update(context.workflow_id, {
    current_stage: context.nextStage,
    progress: calculateProgress(context.nextStage),
    updated_at: new Date()
  });
}
```

**Remove from WorkflowService:**
```typescript
// DELETE: this.stateMachineService.getStateMachine()
// DELETE: stateMachine.send({...})
// DELETE: waitForStageTransition()
// DELETE: All state machine invocation logic
```

**Expected Outcome:**
- State machine is fully autonomous
- No direct invocation from WorkflowService
- Transitions driven by events
- Clean separation of concerns

**Testing:**
```bash
npm run dev
# Create workflow
# Monitor state transitions:
#   Should see: initialization → scaffolding → validation → ...
# No manual invocation logs
```

**Estimated Time:** 1 hour
**Risk Level:** Medium (changes orchestration flow)

---

### **PHASE 5: Enhanced Type-Safe Validation** (1 hour)
**Goal:** Centralize and extend schema validation with SchemaRegistry

**What Gets Removed:**
- ❌ Direct `AgentResultSchema.parse()` calls
- ❌ Scattered validation logic
- ❌ Duplicate validation code

**What Gets Added:**
- ✅ `SchemaRegistry` for centralized schemas
- ✅ `ContractValidator` for contract enforcement
- ✅ Version management for schema evolution
- ✅ Centralized error handling

**Key Files:**
- `packages/shared/contracts/src/` (new or enhanced)
- `packages/orchestrator/src/services/workflow.service.ts`
- `packages/agents/base-agent/src/base-agent.ts`

**Changes Required:**

```typescript
// In orchestrator/workflow.service.ts:
import { SchemaRegistry } from '@agentic-sdlc/shared-types';

private async handleAgentResult(result: any): Promise<void> {
  const schema = SchemaRegistry.get('agent.result');

  try {
    const validatedResult = schema.parse(result.payload);
    // Process validated result...
  } catch (error) {
    logger.error('Result validation failed', { error });
    await this.eventBus.publish({
      type: 'VALIDATION_FAILED',
      error: error.message
    });
    return;
  }
}

// In agents/base-agent.ts:
import { ContractValidator } from '@agentic-sdlc/contracts';

private async reportResult(result: TaskResult): Promise<void> {
  const validator = new ContractValidator(this.capabilities.type);

  const validationResult = validator.validateResult(result);
  if (!validationResult.isValid) {
    logger.error('Result violates contract', {
      errors: validationResult.errors
    });
    throw new Error('Contract violation');
  }

  // Build and publish AgentResult...
}
```

**Expected Outcome:**
- Centralized schema management
- Version-aware validation
- Contract enforcement
- Better error reporting

**Testing:**
```bash
npm run dev
# Inject invalid result to test validation
# Should see: "Result validation failed"
# No invalid results reach database
```

**Estimated Time:** 1 hour
**Risk Level:** Low (enhancement to validation)

---

### **PHASE 6: Persistence & Recovery** (1 hour)
**Goal:** Store state in KV, recover from streams, enable multi-instance orchestrator

**What Gets Removed:**
- ❌ Reliance on in-memory state
- ❌ Loss of state on restart
- ❌ Manual recovery logic

**What Gets Added:**
- ✅ KV store persistence after each stage
- ✅ Stream consumer for missed events
- ✅ Idempotent event replay
- ✅ Multi-instance safe coordination

**Key Files:**
- `packages/orchestrator/src/services/workflow.service.ts`
- `packages/orchestrator/src/hexagonal/bootstrap.ts`

**Changes Required:**

```typescript
// After state machine transition:
private async persistWorkflowState(
  workflowId: string,
  state: any
): Promise<void> {
  await this.kvStore.set(
    `workflow:${workflowId}:state`,
    {
      current_stage: state.value,
      progress: state.context.progress,
      stage_outputs: state.context.outputs,
      timestamp: new Date().toISOString()
    },
    3600  // 1 hour TTL
  );
}

// On service startup:
async initialize(): Promise<void> {
  // Consume missed events from stream
  const lastProcessedId = await this.kvStore.get(
    `stream:agent:results:lastid`
  ) || '$';

  const missedEvents = await this.messageBus.consumeStream(
    'agent:results:stream',
    {
      groupId: 'orchestrator-workflow-service',
      lastId: lastProcessedId
    }
  );

  // Replay missed events
  for (const event of missedEvents) {
    await this.handleAgentResult(event.data);
  }
}
```

**Expected Outcome:**
- State persisted to KV after each stage
- Service can be restarted without data loss
- Missed events replayed on startup
- Multi-instance orchestrators coordinate via Redis

**Testing:**
```bash
npm run dev
# Create workflow, let it run
# Kill orchestrator service mid-workflow
# Restart service
# Workflow should continue from last saved state
# No duplicate processing
```

**Estimated Time:** 1 hour
**Risk Level:** Low (adds persistence without breaking current flow)

---

## Implementation Timeline

### **Session #53: Phase 1** (1 hour)
- OrchestratorContainer initialization
- Remove AgentDispatcherService
- Verify health checks pass

### **Session #54: Phase 2** (1 hour)
- Message bus subscription
- Remove handler lifecycle
- Test single subscription working

### **Session #55: Phase 3** (1.5 hours)
- Agents publish to bus
- Agent initialization with container
- Test stream persistence

### **Session #56: Phase 4** (1 hour)
- State machine autonomy
- Event-driven transitions
- Remove manual state machine calls

### **Session #57: Phase 5** (1 hour)
- SchemaRegistry integration
- ContractValidator implementation
- Centralized validation

### **Session #58: Phase 6** (1 hour)
- KV persistence
- Stream recovery
- Multi-instance support

---

## Risk Management

### Phase 1-2 Risk: Moderate
**Issue:** Changing result routing could break workflow progression
**Mitigation:**
- Keep AgentDispatcherService working until Phase 2 complete
- Run parallel tests with both old and new code
- Gradual cutover: test one workflow type at a time

### Phase 3 Risk: High
**Issue:** All agents must be updated simultaneously
**Mitigation:**
- Update agents one at a time
- Test each agent independently
- Blue-green deployment strategy

### Phase 4 Risk: Medium
**Issue:** State machine autonomy is fundamental change
**Mitigation:**
- Keep manual state machine calls as fallback initially
- Add logging to track state transitions
- Test with simple workflows first

### Phase 5-6 Risk: Low
**Issue:** Enhancement layers, built on solid foundation
**Mitigation:**
- Full test coverage before rollout
- Gradual migration to new validation

---

## Success Criteria

### Per-Phase
- ✅ Phase 1: Container initializes, health checks pass
- ✅ Phase 2: Single subscription receives all results
- ✅ Phase 3: Agents publish to bus, results persist to stream
- ✅ Phase 4: State machine transitions without manual invocation
- ✅ Phase 5: Centralized validation working
- ✅ Phase 6: State persists, recovery works on restart

### End-to-End
- ✅ Workflows complete all 6 stages without hanging
- ✅ No per-workflow handler registration
- ✅ Results persist to stream
- ✅ Recovery works from stream
- ✅ State machine autonomous
- ✅ Multi-instance safe

---

## Before & After Metrics

### Callbacks (Current)
- Handlers per workflow: 1 (deleted after first result)
- Result handling: Per-workflow callback
- Message persistence: None
- State machine invocation: Manual
- Multi-instance support: No
- Recovery capability: None

### Event-Driven (Target)
- Handlers per service: 1 (lifetime)
- Result handling: Centralized subscription
- Message persistence: Stream-based
- State machine invocation: Autonomous
- Multi-instance support: Yes (Redis-coordinated)
- Recovery capability: Full stream replay

---

## When to Start?

### **Ready Now (Session #53)**
- Patch is complete ✅
- Build successful ✅
- Schemas compliant ✅
- All prerequisites met ✅

### **Start Recommendation**
1. Review STRATEGIC-DESIGN-REDIS-API-INTEGRATION.md
2. Plan Phase 1 in detail
3. Start Phase 1 in next session

### **No Blockers**
- No schema compliance issues (patch fixed)
- No build errors (verified)
- No architectural conflicts (hexagonal ready)
- No dependency issues (container available)

---

## Communication Plan

**Stakeholders:**
- Keep strategic architecture vision in mind
- Each phase builds toward complete vision
- No shortcuts that would block later phases

**Documentation:**
- Update CLAUDE.md after each phase
- Keep roadmap synchronized
- Document any deviations

**Testing:**
- Unit tests for each component
- Integration tests per phase
- End-to-end tests at completion

---

## Summary

| Aspect | Status |
|--------|--------|
| **Patch Complete** | ✅ Yes |
| **Build Successful** | ✅ Yes |
| **Ready for Phase 1** | ✅ Yes |
| **Timeline Available** | ✅ 6-8 hours total |
| **Estimated Sessions** | ✅ 6 sessions |
| **Risk Level** | ✅ Manageable with mitigation |
| **Production Ready After** | ✅ Phase 6 complete |

---

**NEXT STEP: Plan Phase 1 implementation details and begin Session #53**
