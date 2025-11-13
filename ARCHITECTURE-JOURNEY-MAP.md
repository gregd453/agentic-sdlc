# Architecture Journey Map: From Patch to Strategic Vision

**Visual Guide showing the progression from current state through the strategic architecture**

---

## Current State (Before Patch)

```
┌─────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR (Fastify)                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  HTTP Routes                                                 │
│    └─→ WorkflowService                                       │
│          └─→ AgentDispatcherService (CALLBACK-BASED)        │
│              ├─ resultHandlers: Map<workflowId, callback>  │
│              ├─ onResult(workflowId, handler)               │
│              ├─ offResult(workflowId)                       │
│              └─ Handler lifecycle per workflow              │
│                  (Deleted after first stage!)                │
│                                                               │
│  Problems:                                                   │
│  ❌ Per-workflow handler registration                       │
│  ❌ Handler deletion loses callbacks                        │
│  ❌ No message persistence                                  │
│  ❌ Agents emit TaskResult, not AgentResultSchema          │
│  ❌ No schema validation at boundaries                      │
│  ❌ Workflows hang at stage transitions                     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                           │
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
       Scaffold         Validation        E2E
       Agent (3)        Agent (3)         Agent (3)
            │              │              │
            └──────────────┼──────────────┘
                           │
            ┌──────────────▼──────────────┐
            │   Redis Pub/Sub             │
            │   ├─ agent:results          │
            │   ├─ (raw publish)          │
            │   └─ (no persistence)       │
            └────────────────────────────┘
```

**Result Message Format (Non-Compliant):**
```typescript
{
  agent_id: 'scaffold-xyz',
  workflow_id: 'wf_123',
  stage: 'scaffolding',
  payload: {
    task_id: 'task_123',
    status: 'success',           // ❌ Wrong enum
    output: { files: [...] },    // ❌ Wrong field name
    errors: []
    // ❌ MISSING: agent_id, success, version, action, result wrapper
  }
}
```

**Status:** 95.5% test pass rate, workflows hang at stage transitions

---

## After Patch (Session #52) ✅

```
┌─────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR (Fastify)                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  HTTP Routes                                                 │
│    └─→ WorkflowService                                       │
│          ├─→ AgentDispatcherService (CALLBACK-BASED)        │
│          │   ├─ onResult(workflowId, handler) [still here]  │
│          │   ├─ Handlers deleted after first result          │
│          │   └─ Issue: Handler lifecycle missing             │
│          │                                                   │
│          └─→ handleAgentResult() [NOW UPDATED] ✅            │
│              ├─ Validates AgentResultSchema ✅              │
│              ├─ Extracts from correct fields ✅             │
│              ├─ Uses success boolean ✅                     │
│              └─ Throws on non-compliance ✅                 │
│                                                               │
│  Improvements:                                               │
│  ✅ Schema validation at consumption                        │
│  ✅ Field extraction correct                                │
│  ✅ Type-safe result processing                             │
│  ✅ Fail-fast on non-compliance                             │
│  (Still using callbacks, but safer)                          │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                           │
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
       Scaffold         Validation        E2E
       Agent ✅         Agent ✅          Agent ✅
            │              │              │
            │ [UPDATED]     │ [UPDATED]    │ [UPDATED]
            │ reportResult()│ reportResult()│ reportResult()
            │ Validates    │ Validates    │ Validates
            │ Compliant   │ Compliant   │ Compliant
            │              │              │
            └──────────────┼──────────────┘
                           │
            ┌──────────────▼──────────────┐
            │   Redis Pub/Sub             │
            │   ├─ agent:results          │
            │   ├─ (raw publish)          │
            │   └─ (no persistence)       │
            └────────────────────────────┘
```

**Result Message Format (Compliant ✓):**
```typescript
{
  agent_id: 'scaffold-xyz',
  workflow_id: 'wf_123',
  stage: 'scaffolding',
  payload: {
    task_id: 'task_123',
    agent_id: 'scaffold-xyz',        // ✅ ADDED
    agent_type: 'scaffold',          // ✅ ADDED
    success: true,                   // ✅ ADDED (boolean)
    status: 'success',               // ✅ Correct enum
    action: 'scaffolding',           // ✅ ADDED
    result: {                        // ✅ CRITICAL: Wrapped
      output: { files: [...] },
      status: 'success',
      errors: []
    },
    metrics: { duration_ms: 1234 },  // ✅ ADDED
    timestamp: '2025-11-12...',      // ✅ ADDED
    version: '1.0.0'                 // ✅ ADDED
  }
}
```

**Status:** ✅ Schema-compliant results, ready for strategic integration

---

## Strategic Phase 1-3: Message Bus Integration (Next)

```
┌─────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR (Fastify)                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  HTTP Routes                                                 │
│    └─→ WorkflowService                                       │
│          ├─ Removes: AgentDispatcherService ❌              │
│          ├─ Adds: messageBus.subscribe() ✅                │
│          │    └─ Single subscription to 'agent:results'     │
│          │    └─ Persists for service lifetime              │
│          │                                                   │
│          └─→ handleAgentResult() [REUSED, now centralized]  │
│              ├─ Validates AgentResultSchema ✓               │
│              ├─ Extracts fields ✓                           │
│              ├─ Publishes STAGE_COMPLETE                    │
│              └─ (No handler lifecycle management!)          │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ OrchestratorContainer (NEW) ✅                      │   │
│  │ ├─ IMessageBus (Redis pub/sub)                      │   │
│  │ ├─ IKVStore (Redis KV)                              │   │
│  │ └─ Lifecycle management                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  Improvements:                                               │
│  ✅ Single service-level subscription (not per-workflow)   │
│  ✅ Handlers never deleted (persistent)                    │
│  ✅ Message bus instead of raw Redis                       │
│  ✅ Messages persisted to stream                           │
│  ✅ Prepared for state machine events                      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
             │              │              │
             │ Message Bus  │              │
             │ (CENTRALIZED)│              │
             │              │              │
             ▼              ▼              ▼
       Scaffold         Validation        E2E
       Agent            Agent             Agent
       (with IMessageBus) (with IMessageBus) (with IMessageBus)
             │              │              │
             │ publish()    │ publish()    │ publish()
             │ to bus       │ to bus       │ to bus
             │              │              │
             └──────────────┼──────────────┘
                            │
         ┌──────────────────▼──────────────────┐
         │ OrchestratorContainer.getBus()       │
         │ ├─ Pub/Sub: agent:results topic     │
         │ ├─ Stream: agent:results:stream     │
         │ ├─ Pattern: agent:* topics          │
         │ └─ Concurrent handler execution     │
         └──────────────────────────────────────┘
                            │
         ┌──────────────────▼──────────────────┐
         │        Redis Server (6380)           │
         │ ├─ Streams (durability)              │
         │ ├─ Pub/Sub (real-time)              │
         │ └─ KV Store (state)                 │
         └──────────────────────────────────────┘
```

**Message Flow (Now Persistent & Type-Safe):**
```
Agent publishes:
  ├─ Validates AgentResultSchema (patch) ✓
  ├─ Publishes to 'agent:results' topic
  ├─ Message persisted to stream
  │
WorkflowService receives:
  ├─ Validates AgentResultSchema ✓
  ├─ Extracts fields correctly ✓
  ├─ Stores stage_outputs
  ├─ Publishes STAGE_COMPLETE event
  │
State Machine receives: STAGE_COMPLETE
  ├─ Transitions to next stage
  ├─ Updates database
  │
Next Stage:
  └─ Task created, agents notified
```

**Advantages:**
- ✅ Results persist in Redis stream
- ✅ Service can be restarted, missed messages replayed
- ✅ All messages schema-compliant (no validation surprises)
- ✅ Single subscription (not per-workflow)

---

## Strategic Phase 4-6: Autonomous State Machine & Persistence (Then)

```
┌────────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR (Fastify)                       │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│  HTTP Routes (Create workflows)                                 │
│    └─→ WorkflowService (handles agent results)                 │
│          ├─ messageBus.subscribe('agent:results') ✓            │
│          ├─ Validates AgentResultSchema ✓                      │
│          ├─ Stores stage_outputs                               │
│          ├─ Publishes STAGE_COMPLETE event                     │
│          └─ (No longer needs state machine reference!)         │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ WorkflowStateMachineService (AUTONOMOUS) ✅            │   │
│  │ ├─ Subscribes to STAGE_COMPLETE events                │   │
│  │ ├─ Receives event from event bus                      │   │
│  │ ├─ State machine transitions (xstate)                 │   │
│  │ ├─ Updates database with new stage                    │   │
│  │ ├─ [No more manual invocation!]                       │   │
│  │ └─ (WorkflowService creates next task)               │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ Persistence Layer (KV Store) ✅                        │   │
│  │ ├─ Store workflow state snapshots                      │   │
│  │ ├─ Persist stage_outputs                              │   │
│  │ ├─ Recovery from Redis stream on startup              │   │
│  │ └─ Idempotent replay of missed events                 │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ OrchestratorContainer (Fully Integrated)               │   │
│  │ ├─ IMessageBus (pub/sub + streams)                     │   │
│  │ ├─ IKVStore (state persistence)                        │   │
│  │ ├─ Event Bus (STAGE_COMPLETE events)                   │   │
│  │ └─ Lifecycle management                               │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
             │              │              │
             ▼              ▼              ▼
       Scaffold         Validation        E2E
       Agent ✅         Agent ✅          Agent ✅
       ├─ Validates    ├─ Validates      ├─ Validates
       ├─ Publishes    ├─ Publishes      ├─ Publishes
       │ (AgentResult) │ (AgentResult)   │ (AgentResult)
       │               │                  │
       └───────────────┼──────────────────┘
                       │
        ┌──────────────▼──────────────────┐
        │   OrchestratorContainer.getBus()│
        │                                  │
        │ Topic: agent:results             │
        │   └─ All agent results published │
        │   └─ Stream: agent:results:stream │
        │   └─ Durability: persisted       │
        │                                  │
        │ Topic: events (Internal)         │
        │   └─ STAGE_COMPLETE events      │
        │   └─ Used by state machine      │
        └──────────────────────────────────┘
                       │
        ┌──────────────▼──────────────────┐
        │        Redis Server (6380)       │
        │ ├─ Streams (persistence)        │
        │ │  └─ agent:results:stream      │
        │ ├─ Pub/Sub (real-time)          │
        │ │  ├─ agent:results             │
        │ │  ├─ events (internal)         │
        │ │  └─ agent:type:tasks          │
        │ ├─ KV Store (state)             │
        │ │  ├─ workflow:*:state          │
        │ │  ├─ workflow:*:outputs        │
        │ │  └─ workflow:*:context        │
        │ └─ Deduplication sets           │
        │    └─ seen:* (event IDs)        │
        └──────────────────────────────────┘
```

**Complete Workflow Execution:**
```
1. Client creates workflow (HTTP POST)
   │
2. WorkflowService receives request
   ├─ Creates workflow in database
   ├─ Creates state machine instance
   ├─ Publishes WORKFLOW_CREATED event
   └─ Creates task for initialization stage
   │
3. Task dispatched to Scaffold Agent via message bus
   │
4. Scaffold Agent executes
   ├─ Validates AgentResultSchema before publishing ✓
   ├─ Publishes AgentResult to 'agent:results' topic
   └─ Message persisted to stream
   │
5. WorkflowService receives result
   ├─ Validates AgentResultSchema ✓
   ├─ Stores stage_outputs in database
   ├─ Publishes STAGE_COMPLETE event
   │
6. WorkflowStateMachineService receives event (autonomous!)
   ├─ State machine transitions: initialization → scaffolding
   ├─ Updates database: current_stage = 'scaffolding'
   │
7. WorkflowService creates task for validation stage
   └─ Cycle repeats for all 6 stages
   │
8. Final result: Workflow completes
   └─ All stage_outputs persisted
   └─ All events logged
   └─ Can be recovered from stream if needed
```

**Key Improvements:**
- ✅ State machine is autonomous (not invoked by WorkflowService)
- ✅ No per-workflow handler registration
- ✅ Message persistence enables recovery
- ✅ Idempotent replay of missed events
- ✅ All messages schema-compliant throughout
- ✅ Scalable to multiple orchestrator instances

---

## Comparison Table: Current → Patch → Strategic

| Aspect | Current | After Patch | After Strategic |
|--------|---------|-------------|-----------------|
| **Schema Compliance** | ❌ Mismatch | ✅ Compliant | ✅ Compliant |
| **Validation** | ❌ None | ✅ At boundaries | ✅ At boundaries |
| **Message Persistence** | ❌ No | ❌ No | ✅ Yes (streams) |
| **Result Handling** | ❌ Callbacks | ✅ Callbacks (safer) | ✅ Message bus |
| **Per-Workflow Handlers** | ❌ Yes (issues) | ❌ Yes (issues) | ✅ No (centralized) |
| **State Machine** | ❌ Manual | ❌ Manual | ✅ Autonomous |
| **Recovery** | ❌ No | ❌ No | ✅ From stream |
| **Workflows Complete** | ❌ 0% | ⏳ Hang at stage 2 | ✅ All 6 stages |
| **Production Ready** | ❌ No | ⏳ Partial | ✅ Yes |

---

## Key Takeaways

### What the Patch Accomplishes
```
Patch = Type Safety + Validation

Before: Agents say X, Orchestrator hears Y
After:  Agents say X, Orchestrator hears X (guaranteed by schema)
```

### What the Strategic Architecture Accomplishes
```
Strategic = Patch + Architecture + Persistence

Before: Results → Callbacks → Workflows hang
After:  Results → Message Bus → Workflows autonomous → Complete
```

### Why the Order Matters
```
Without Patch: Strategic architecture can't trust message shape
With Patch:    Strategic architecture has solid foundation
               Phase 1-3: Wire components together
               Phase 4-6: Add state machine autonomy
```

---

**Journey: Current State → Patch (✅ Done) → Strategic Phases 1-3 (Next) → Strategic Phases 4-6 (Then) → Production Ready**
