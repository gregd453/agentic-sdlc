# Strategic Design: Full Redis & API Layer Integration
**Version:** 1.0
**Date:** 2025-11-12
**Status:** Ready for Implementation
**Estimated Duration:** 4-6 hours

---

## Executive Summary

This document defines the strategic architecture for fully integrating the Agentic SDLC platform using:
1. **Hexagonal Redis Architecture** - Already implemented in `/packages/orchestrator/src/hexagonal`
2. **Shared Core Packages** - Type system, contracts, utilities from `/packages/shared`
3. **Event-Driven Workflow** - Replace callback pattern with message bus
4. **Type-Safe Contracts** - Full schema validation across all agents

**Key Achievement:** Replace scattered, callback-based workflow orchestration with a unified, event-driven, type-safe architecture that is production-ready, scalable, and testable.

---

## Current State Assessment

### What's Working ✅
- Hexagonal architecture implemented (Redis, ports, adapters)
- Shared type system (full schema registry)
- Contract validation framework
- All 5 agent packages operational
- State machine (xstate) ready for events
- 95.5% test pass rate on unit tests

### What's Broken ❌
- **Agent result handler lifecycle** - Handlers deleted after first stage completion
- **No event bus integration** - Results go to callbacks, not event bus
- **Scattered orchestration logic** - State transitions not using state machine
- **Callback-based communication** - Not using hexagonal message bus pattern
- **No persistence** - Handlers lost if service crashes mid-workflow
- **Workflow tests timeout** - All hang at scaffolding stage (0% completion)

### Root Cause
**Architectural Mismatch:** Current code path uses callback/handler pattern (AgentDispatcherService), but hexagonal architecture implements event-driven pattern (OrchestratorContainer + IMessageBus).

---

## Target Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     ORCHESTRATOR FASTIFY SERVER                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  HTTP Routes (workflow.routes.ts)                                    │
│    │                                                                 │
│    ├─→ POST /api/v1/workflows              ← Create workflow       │
│    ├─→ GET /api/v1/workflows/:id           ← Get status            │
│    └─→ GET /api/v1/workflows               ← List workflows        │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ WORKFLOW SERVICE (WorkflowService)                            │  │
│  │ ──────────────────────────────────────────────────────────    │  │
│  │ • Create workflow from request                                │  │
│  │ • Publish WORKFLOW_CREATED event                             │  │
│  │ • Initialize state machine                                    │  │
│  │ • Create task for first stage (initialization)               │  │
│  │                                                               │  │
│  │ Handler: Receives STAGE_COMPLETE events from event bus      │  │
│  │   └─→ Loads workflow context                                 │  │
│  │   └─→ Stores stage outputs                                   │  │
│  │   └─→ Sends state machine: STAGE_COMPLETE event             │  │
│  │   └─→ State machine transitions to next stage                │  │
│  │   └─→ Creates task for next stage (if not terminal)          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│          ▲                                  │                       │
│          │                                  ▼                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ STATE MACHINE SERVICE (WorkflowStateMachineService)          │  │
│  │ ──────────────────────────────────────────────────────────    │  │
│  │ • Manages workflow state transitions (xstate)                │  │
│  │ • State: initialization → scaffolding → validation → ...     │  │
│  │ • Receives: STAGE_COMPLETE events                            │  │
│  │ • Sends: State machine transitions (automatic)               │  │
│  │                                                               │  │
│  │ Transitions:                                                  │  │
│  │   START → initialization stage                               │  │
│  │   STAGE_COMPLETE (scaffolding) → validation stage            │  │
│  │   STAGE_COMPLETE (validation) → e2e stage                    │  │
│  │   ... (all 6 stages)                                          │  │
│  │   STAGE_COMPLETE (deployment) → completed                    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│          ▲                                  │                       │
│          │                                  ▼                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ ORCHESTRATOR CONTAINER (OrchestratorContainer)              │  │
│  │ ──────────────────────────────────────────────────────────    │  │
│  │ await container.initialize()                                  │  │
│  │   ├─→ makeRedisSuite(redisUrl)                               │  │
│  │   │   ├─ client.base (KV, CAS)                              │  │
│  │   │   ├─ client.pub (publish)                               │  │
│  │   │   └─ client.sub (subscribe)                             │  │
│  │   ├─→ makeRedisBus(pub, sub)                                │  │
│  │   │   ├─ Implements IMessageBus interface                    │  │
│  │   │   ├─ pSubscribe('*') on all channels                    │  │
│  │   │   ├─ Concurrent handler execution                       │  │
│  │   │   └─ Stream mirroring for durability                    │  │
│  │   └─→ makeRedisKV(base, namespace)                          │  │
│  │       ├─ Implements IKVStore interface                       │  │
│  │       ├─ GET/SET/DEL with JSON serialization                │  │
│  │       └─ CAS (compare-and-swap) atomic updates              │  │
│  │                                                               │  │
│  │ container.getBus()  → IMessageBus (for pub/sub)             │  │
│  │ container.getKV()   → IKVStore (for state storage)          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                            │                                        │
└────────────────────────────┼────────────────────────────────────────┘
                             │
                    ┌────────▼─────────┐
                    │                  │
                    ▼                  ▼
            ┌────────────────┐  ┌────────────────┐
            │  Redis Pub/Sub │  │  Redis KV      │
            │  (Topics)      │  │  (Namespaced)  │
            └────────────────┘  └────────────────┘
                    │                  │
                    │    ┌─────────────┘
                    │    │
                    ▼    ▼
            ┌─────────────────────┐
            │  Redis Server       │
            │  (port 6380)        │
            │                     │
            │ • Streams (mirror)  │
            │ • Pub/Sub topics    │
            │ • KV store (JSON)   │
            │ • State dedup       │
            └─────────────────────┘
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
    ┌─────────┐ ┌─────────┐ ┌─────────┐
    │ Scaffold│ │Validation│ │  E2E    │
    │ Agent   │ │ Agent    │ │ Agent   │
    └────┬────┘ └────┬────┘ └────┬────┘
         │           │           │
         └─────────────────────────┘
              (publish results to)
              agent:results topic


┌─────────────────────────────────────────────────────────────────────┐
│                    EVENT FLOW (MESSAGE BUS)                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│ Topic: agent:results  (Agent publishes here)                        │
│   Message: {                                                         │
│     workflow_id: "wf_...",                                           │
│     stage: "scaffolding",                                            │
│     status: "success",                                               │
│     output: { ... }                                                  │
│   }                                                                   │
│        │                                                             │
│        ▼                                                             │
│ Redis Bus (pSubscribe listener):                                    │
│   • Receives all published messages on agent:results                │
│   • Routes to all registered handlers                               │
│   • Concurrent execution with Promise.all()                         │
│   • Error handling per handler                                      │
│        │                                                             │
│        ▼                                                             │
│ Handler 1 (WorkflowService):                                        │
│   • Parse result envelope                                            │
│   • Load workflow context                                            │
│   • Store stage output in database                                   │
│   • Publish STAGE_COMPLETE event                                    │
│   • State machine processes event                                    │
│   • Transition to next stage                                        │
│        │                                                             │
│        ▼                                                             │
│ State Machine (xstate):                                             │
│   initialization --STAGE_COMPLETE-→ scaffolding                    │
│   scaffolding --STAGE_COMPLETE-→ validation                        │
│   ... (automatic transitions)                                        │
│        │                                                             │
│        ▼                                                             │
│ Create Task for Next Stage:                                         │
│   • Build agent envelope                                             │
│   • Publish TASK_ASSIGNED event                                     │
│   • Dispatch envelope via agent-specific Redis topic               │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Initialize Hexagonal Architecture (1 hour)

**Goal:** Wire OrchestratorContainer into the application bootstrap

**Changes:**

1. **Update `server.ts`** - Replace AgentDispatcherService initialization

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
     redisNamespace: 'agentic-sdlc',
     redisDefaultTtl: 86400, // 24 hours
     coordinators: { plan: true }
   });
   await container.initialize();

   const messageBus = container.getBus();
   const kvStore = container.getKV();

   const workflowService = new WorkflowService(
     workflowRepository,
     eventBus,
     stateMachineService,
     messageBus // ← Use hexagonal bus instead of dispatcher
   );
   ```

2. **Update type signature** - Change agentDispatcher to messageBus

   ```typescript
   // WorkflowService constructor
   constructor(
     private repository: WorkflowRepository,
     private eventBus: EventBus,
     private stateMachineService: WorkflowStateMachineService,
     private messageBus: IMessageBus // ← Changed from AgentDispatcherService
   ) { }
   ```

3. **Graceful shutdown integration**

   ```typescript
   // In fastify close hook:
   fastify.addHook('onClose', async () => {
     await container.shutdown();
   });
   ```

**Files to Modify:**
- `packages/orchestrator/src/server.ts`
- `packages/orchestrator/src/services/workflow.service.ts`

**Testing:**
- ✅ Orchestrator starts without errors
- ✅ Health endpoint responds
- ✅ Bus reports healthy
- ✅ KV store reports healthy

---

### Phase 2: Subscribe WorkflowService to Message Bus (1 hour)

**Goal:** Subscribe to agent results and handle state transitions

**Changes:**

1. **Add bus subscription in WorkflowService constructor**

   ```typescript
   constructor(
     private repository: WorkflowRepository,
     private eventBus: EventBus,
     private stateMachineService: WorkflowStateMachineService,
     private messageBus: IMessageBus
   ) {
     // Subscribe to agent results ONCE during initialization
     this.messageBus.subscribe(
       'agent:results',
       async (result: any) => {
         await this.handleAgentResultFromBus(result);
       },
       { key: 'workflow-service' }
     );
   }
   ```

2. **Replace handleAgentResult with bus-aware version**

   ```typescript
   private async handleAgentResultFromBus(result: any): Promise<void> {
     const { workflow_id, stage, status, output, errors } = result;

     logger.info('Received agent result from message bus', {
       workflow_id,
       stage,
       status
     });

     // Load workflow
     const workflow = await this.repository.findById(workflow_id);
     if (!workflow) {
       logger.error('Workflow not found', { workflow_id });
       return;
     }

     // Store stage output
     if (status === 'success') {
       await this.storeStageOutput(workflow_id, stage, output);
     }

     // Publish event for state machine
     await this.eventBus.publish({
       id: `event-${Date.now()}`,
       type: 'STAGE_COMPLETE',
       workflow_id,
       payload: {
         stage,
         status,
         output,
         errors
       },
       timestamp: new Date().toISOString(),
       trace_id: generateTraceId()
     });

     // State machine handles the rest (autonomous transition)
   }
   ```

3. **Remove all handler registration code**

   ```typescript
   // DELETE: this.agentDispatcher.onResult(workflowId, handler);
   // DELETE: agentDispatcher.offResult();
   // DELETE: resultHandlers Map
   // DELETE: handler lifecycle logic
   ```

**Files to Modify:**
- `packages/orchestrator/src/services/workflow.service.ts`

**Testing:**
- ✅ Service subscribes to `agent:results` topic
- ✅ Subscription happens once per service instance
- ✅ Handler receives agent results
- ✅ Events published to event bus

---

### Phase 3: Update Agents to Publish to Message Bus (1.5 hours)

**Goal:** Replace raw Redis publishing with typed, envelope-based message bus publishing

**Changes:**

1. **Update BaseAgent to accept messageBus**

   ```typescript
   // base-agent.ts

   export class BaseAgent {
     private messageBus: IMessageBus;

     constructor(messageBus: IMessageBus) {
       this.messageBus = messageBus;
     }

     protected async reportResult(result: TaskResult): Promise<void> {
       // Validate result against schema
       const validatedResult = TaskResultSchema.parse(result);

       // Publish to message bus with envelope
       await this.messageBus.publish(
         'agent:results',
         {
           workflow_id: validatedResult.workflow_id,
           stage: validatedResult.stage,
           status: validatedResult.status,
           output: validatedResult.output,
           errors: validatedResult.errors
         },
         {
           key: validatedResult.workflow_id,
           mirrorToStream: 'agent:results:stream' // Durability
         }
       );

       logger.info('Result published to message bus', {
         workflow_id: validatedResult.workflow_id,
         stage: validatedResult.stage,
         status: validatedResult.status
       });
     }
   }
   ```

2. **Update agent run-agent.ts entry points**

   ```typescript
   // Each agent (scaffold-agent/run-agent.ts, etc.)

   import { OrchestratorContainer } from '@agentic-sdlc/orchestrator/hexagonal';

   async function main() {
     // Initialize hexagonal container for agents
     const container = new OrchestratorContainer({
       redisUrl: process.env.REDIS_URL,
       redisNamespace: 'agentic-sdlc'
     });
     await container.initialize();

     const messageBus = container.getBus();

     // Create agent with message bus
     const agent = new ScaffoldAgent(messageBus);

     // Subscribe to tasks for this agent
     const taskChannel = REDIS_CHANNELS.AGENT_TASKS('scaffold');
     await messageBus.subscribe(taskChannel, async (task) => {
       await agent.executeTask(task);
     });

     logger.info('Agent listening for tasks...');
   }

   main().catch((error) => {
     logger.error('Agent fatal error', { error });
     process.exit(1);
   });
   ```

3. **Remove old Redis publishing**

   ```typescript
   // DELETE: this.redisPublisher.publish('orchestrator:results', ...)
   // DELETE: Raw channel publishing
   // DELETE: AgentDispatcherService usage
   ```

**Files to Modify:**
- `packages/agents/base-agent/src/base-agent.ts` - reportResult() method
- `packages/agents/base-agent/src/run-agent.ts` - Initialization
- `packages/agents/scaffold-agent/src/run-agent.ts` - Initialization
- `packages/agents/validation-agent/src/run-agent.ts` - Initialization
- `packages/agents/e2e-agent/src/run-agent.ts` - Initialization
- `packages/agents/integration-agent/src/run-agent.ts` - Initialization
- `packages/agents/deployment-agent/src/run-agent.ts` - Initialization

**Testing:**
- ✅ Agents initialize with message bus
- ✅ Agents publish results to correct topic
- ✅ Results are envelopes with required fields
- ✅ Stream mirroring captures results

---

### Phase 4: State Machine Integration (1 hour)

**Goal:** Verify state machine receives events and auto-transitions

**Changes:**

1. **Verify state machine is subscribed to EventBus**

   ```typescript
   // WorkflowStateMachineService

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

         logger.info('State machine transitioned', {
           workflow_id: event.workflow_id,
           from_stage: event.payload.stage,
           to_stage: sm.getSnapshot().value
         });
       }
     });
   }
   ```

2. **Update workflow context in state machine transitions**

   ```typescript
   // After state transition, update database
   onDone: async (context, event) => {
     const workflow = await repository.findById(context.workflow_id);

     // Update current_stage
     await repository.update(context.workflow_id, {
       current_stage: context.nextStage,
       progress: calculateProgress(context.nextStage),
       updated_at: new Date()
     });

     logger.info('Workflow updated', {
       workflow_id: context.workflow_id,
       new_stage: context.nextStage
     });
   }
   ```

**Files to Modify:**
- `packages/orchestrator/src/state-machine/workflow-state-machine.ts`

**Testing:**
- ✅ State machine receives STAGE_COMPLETE events
- ✅ State transitions execute
- ✅ Database updated with new stage
- ✅ Next stage task is created

---

### Phase 5: Type-Safe Contract Validation (1 hour)

**Goal:** Enforce schema validation using shared contracts

**Changes:**

1. **Use SchemaRegistry for agent results**

   ```typescript
   // workflow.service.ts - handleAgentResultFromBus()

   import { SchemaRegistry } from '@agentic-sdlc/shared-types';

   private async handleAgentResultFromBus(result: any): Promise<void> {
     // Validate against agent result schema
     const schema = SchemaRegistry.get(`agent.result`);

     try {
       const validatedResult = schema.parse(result);
       // ... proceed with validated data
     } catch (error) {
       logger.error('Agent result validation failed', {
         error: error.message,
         result
       });
       // Publish VALIDATION_FAILED event
       // Handle failure appropriately
       return;
     }
   }
   ```

2. **Use ContractValidator for agent communication**

   ```typescript
   // base-agent.ts - reportResult()

   import { ContractValidator, scaffoldContract } from '@agentic-sdlc/contracts';

   protected async reportResult(result: TaskResult): Promise<void> {
     const validator = new ContractValidator(this.agentType);

     // Validate result matches contract
     const validationResult = validator.validateResult(result);

     if (!validationResult.isValid) {
       logger.error('Result violates contract', {
         errors: validationResult.errors
       });
       throw new Error('Contract violation');
     }

     // Publish validated result
     await this.messageBus.publish('agent:results', result, {
       key: result.workflow_id,
       mirrorToStream: 'agent:results:stream'
     });
   }
   ```

**Files to Modify:**
- `packages/orchestrator/src/services/workflow.service.ts`
- `packages/agents/base-agent/src/base-agent.ts`

**Testing:**
- ✅ Invalid results rejected
- ✅ Contract mismatches caught
- ✅ Type safety enforced
- ✅ Validation errors logged

---

### Phase 6: Persistence & Recovery (1 hour)

**Goal:** Enable workflow recovery from Redis persistence

**Changes:**

1. **Store workflow state in KV store**

   ```typescript
   // workflow.service.ts - storeStageOutput()

   private async storeStateSnapshot(workflowId: string, state: any): Promise<void> {
     // Store workflow state in KV for recovery
     await this.kvStore.set(
       `workflow:${workflowId}:state`,
       {
         current_stage: state.value,
         progress: state.context.progress,
         stage_outputs: state.context.outputs,
         timestamp: new Date().toISOString()
       },
       3600 // 1 hour TTL (or longer)
     );

     logger.info('Workflow state persisted', {
       workflow_id: workflowId,
       stage: state.value
     });
   }
   ```

2. **Enable stream-based recovery**

   ```typescript
   // bootstrap.ts - Container initialization

   // Consume missed events from stream on startup
   const missedEvents = await messageBus.consumeStream('agent:results:stream', {
     groupId: 'orchestrator-workflow-service',
     lastId: '$' // Start from now
   });

   // Replay any missed events
   for (const event of missedEvents) {
     await this.handleAgentResultFromBus(event.data);
   }
   ```

**Files to Modify:**
- `packages/orchestrator/src/services/workflow.service.ts`
- `packages/orchestrator/src/hexagonal/bootstrap.ts`

**Testing:**
- ✅ State stored in KV after each transition
- ✅ Service can recover from stream
- ✅ Missed events are replayed
- ✅ Idempotency prevents duplicates

---

## Integration Checkpoints

### Checkpoint 1: Architecture Bootstrap (After Phase 1)
```bash
✓ Orchestrator starts
✓ Container initializes
✓ Redis bus health check passes
✓ KV store health check passes
✓ Graceful shutdown works
```

### Checkpoint 2: Message Bus Integration (After Phase 2)
```bash
✓ WorkflowService subscribes to agent:results
✓ Creates test workflow via API
✓ Task created for first stage
✓ Logs show subscription ready
```

### Checkpoint 3: Agent Integration (After Phase 3)
```bash
✓ Agents start and initialize with message bus
✓ Agents listen on agent:type:tasks topic
✓ Agents publish results to agent:results topic
✓ Results visible in Redis logs
✓ No raw Redis publish() calls remain
```

### Checkpoint 4: State Machine (After Phase 4)
```bash
✓ Workflow transitions from initialization → scaffolding
✓ Database shows new current_stage
✓ No "handler not found" errors
✓ Task created for validation stage
```

### Checkpoint 5: Contract Validation (After Phase 5)
```bash
✓ Invalid results rejected
✓ Validation errors logged properly
✓ Only valid results processed
✓ Schema registry used throughout
```

### Checkpoint 6: Full Workflow (After Phase 6)
```bash
✓ Workflow completes all 6 stages
✓ progress_percentage reaches 100%
✓ status = "completed"
✓ All stage_outputs stored in database
✓ Test: All 5 pipeline tests pass ✅
```

---

## File-by-File Changes Summary

### Core Changes (Must Change)

| File | Change | Lines | Priority |
|------|--------|-------|----------|
| `server.ts` | Replace AgentDispatcherService with OrchestratorContainer | 20 | P0 |
| `workflow.service.ts` | Subscribe to message bus, remove handlers | 80 | P0 |
| `workflow-state-machine.ts` | Verify event subscription | 30 | P0 |
| `base-agent.ts` | Use message bus for publishing | 40 | P0 |
| `scaffold-agent/run-agent.ts` | Initialize with container, use bus | 20 | P0 |
| `validation-agent/run-agent.ts` | Initialize with container, use bus | 20 | P0 |
| `e2e-agent/run-agent.ts` | Initialize with container, use bus | 20 | P0 |
| `integration-agent/run-agent.ts` | Initialize with container, use bus | 20 | P0 |
| `deployment-agent/run-agent.ts` | Initialize with container, use bus | 20 | P0 |

### Cleanup (Can Delete)

| File | Reason | Lines |
|------|--------|-------|
| `agent-dispatcher.service.ts` | No longer needed (replaced by messageBus) | ~400 |
| Handler lifecycle code in `workflow.service.ts` | No longer needed (bus manages lifecycle) | ~100 |
| Handler registration in workflow creation | No longer needed (single subscription) | ~50 |

### New Files (Optional)

| File | Purpose |
|------|---------|
| `INTEGRATION-GUIDE.md` | Step-by-step guide for developers |
| `HEXAGONAL-PATTERNS.md` | Common patterns and examples |
| `TROUBLESHOOTING.md` | Debug guide for issues |

---

## Testing Strategy

### Unit Tests (No Changes Needed)
- All existing unit tests continue to pass
- Schema validation tests already exist
- Contract tests already exist

### Integration Tests (Update)

**Before Integration:**
```typescript
// Mock AgentDispatcherService
const mockDispatcher = {
  onResult: jest.fn(),
  dispatchTask: jest.fn()
};
const service = new WorkflowService(..., mockDispatcher);
```

**After Integration:**
```typescript
// Use real OrchestratorContainer
const container = new OrchestratorContainer({ ... });
await container.initialize();
const bus = container.getBus();
const service = new WorkflowService(..., bus);

// Subscribe to results
await bus.subscribe('agent:results', handler);
```

### E2E Tests (Update)

**Test: Complete Single Workflow**
```typescript
it('should complete workflow through all stages', async () => {
  // Create workflow
  const response = await api.post('/workflows', {
    type: 'app',
    name: 'Test App',
    requirements: 'Build a test app'
  });
  const workflowId = response.body.workflow_id;

  // Simulate agent completing scaffolding
  await messageBus.publish('agent:results', {
    workflow_id: workflowId,
    stage: 'scaffolding',
    status: 'success',
    output: { files: [...] }
  });

  // Wait for state transition
  await delay(500);

  // Check workflow progressed
  const workflow = await api.get(`/workflows/${workflowId}`);
  expect(workflow.current_stage).toBe('validation');
  expect(workflow.progress).toBe(33);
});
```

**Test: Run All Pipeline Tests**
```bash
# Start environment
./scripts/env/start-dev.sh

# Run tests
./scripts/run-pipeline-test.sh --all

# Expected: All 5+ tests complete successfully ✅
```

---

## Migration Path for Existing Deployments

### For Development
1. Make changes in sequence (phase by phase)
2. Test each checkpoint
3. Run full pipeline tests
4. If issues, rollback one phase

### For Production
1. Deploy with feature flag for new bus
2. Run both old and new paths in parallel
3. Compare results
4. Gradually switch to new path
5. Remove old code after validation

---

## Success Metrics

### Before Integration
- ❌ All pipeline tests timeout at scaffolding (0%)
- ❌ No state machine transitions
- ❌ Callback handlers not persisting
- ❌ No persistence on crash

### After Integration
- ✅ All pipeline tests complete (100% success rate)
- ✅ Workflows progress through all 6 stages
- ✅ Progress percentage updates (0% → 100%)
- ✅ Workflow status changes to "completed"
- ✅ All stage_outputs stored in database
- ✅ No handler lifecycle issues
- ✅ Persistent state via Redis streams
- ✅ Type-safe validation throughout
- ✅ Production-ready architecture

---

## Risk Mitigation

### Risk 1: Breaking Existing Workflows
**Mitigation:**
- Make changes backward compatible initially
- Run both paths in parallel
- Validate outputs match

### Risk 2: Message Bus Not Handling Load
**Mitigation:**
- Bus already tested with concurrent handlers
- pSubscribe pattern is proven
- Stream mirroring provides durability

### Risk 3: State Machine Issues
**Mitigation:**
- State machine already implemented
- Just needs event subscription (minor change)
- Transitions already tested in unit tests

### Risk 4: Agent Compatibility
**Mitigation:**
- All agents use base class
- Change base class once, all inherit
- Interface is same (publish message)

---

## Timeline Estimate

| Phase | Duration | Cumulative | Dependencies |
|-------|----------|-----------|--------------|
| Phase 1: Bootstrap | 1 hour | 1h | None |
| Phase 2: Bus Subscribe | 1 hour | 2h | Phase 1 |
| Phase 3: Agent Updates | 1.5 hours | 3.5h | Phase 1-2 |
| Phase 4: State Machine | 1 hour | 4.5h | Phase 1-3 |
| Phase 5: Contracts | 1 hour | 5.5h | Phase 1-4 |
| Phase 6: Persistence | 1 hour | 6.5h | Phase 1-5 |
| Testing & Validation | 1.5 hours | 8h | All phases |

**Total: 8 hours end-to-end** (with checkpoints after each phase)

---

## Deployment Checklist

### Pre-Deployment
- [ ] All phases implemented
- [ ] All 6 checkpoints verified
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] E2E tests passing (all 5+ pipeline tests)
- [ ] No TypeScript errors
- [ ] Code reviewed
- [ ] Documentation updated

### Deployment
- [ ] Tag release with version
- [ ] Commit changes
- [ ] Push to main
- [ ] Monitor production logs
- [ ] Verify workflows complete successfully
- [ ] Check Redis metrics
- [ ] Confirm no regressions

### Post-Deployment
- [ ] Delete old AgentDispatcherService code
- [ ] Remove any feature flags
- [ ] Update monitoring
- [ ] Document lessons learned
- [ ] Plan next improvements

---

## Appendix: Key Files Reference

### Hexagonal Architecture
- `packages/orchestrator/src/hexagonal/index.ts` - Public API
- `packages/orchestrator/src/hexagonal/bootstrap.ts` - Container initialization
- `packages/orchestrator/src/hexagonal/adapters/redis-bus.adapter.ts` - Message bus
- `packages/orchestrator/src/hexagonal/adapters/redis-suite.ts` - Redis clients
- `packages/orchestrator/src/hexagonal/ports/message-bus.port.ts` - IMessageBus interface

### Shared Components
- `packages/shared/types/src/index.ts` - Type exports
- `packages/shared/contracts/src/index.ts` - Contract validation
- `packages/shared/utils/src/index.ts` - Utilities (retry, circuit breaker)

### Core Services
- `packages/orchestrator/src/server.ts` - Fastify bootstrap
- `packages/orchestrator/src/services/workflow.service.ts` - Orchestration logic
- `packages/orchestrator/src/state-machine/workflow-state-machine.ts` - xstate machine
- `packages/agents/base-agent/src/base-agent.ts` - Agent base class

### Current (To Remove)
- `packages/orchestrator/src/services/agent-dispatcher.service.ts` - Old pattern
- Handler lifecycle code scattered in workflow.service.ts

---

**Status:** Ready for implementation
**Last Updated:** 2025-11-12
**Next Step:** Begin Phase 1 implementation
