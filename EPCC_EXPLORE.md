# Exploration Report: Strategic Architecture Consolidation

**Date:** 2025-11-13 (Session #57)
**Status:** Exploration Complete - Ready for Planning
**Goal:** Define unified strategic architecture to replace partially-implemented integration approach

---

## Executive Summary

### Mission Statement
Consolidate the architecture information from STRATEGIC-DESIGN-REDIS-API-INTEGRATION.md and HEXAGONAL-ARCHITECTURE-IMPLEMENTATION.md into a single, coherent target architecture that ensures consistent agent lifecycles and unified system design across all components.

### Current State Assessment
- **Architecture:** Hexagonal (Ports & Adapters) + Message Bus + Agent-based
- **Primary Language:** TypeScript with strict mode
- **Monorepo:** pnpm workspaces with Turbo build orchestration
- **Progress:** Phase 3 PARTIALLY implemented (~60% complete)
- **Critical Issues:**
  - Asymmetric message bus integration (agents receive via bus, send via Redis)
  - AgentDispatcherService still exists (callback-based, conflicts with event-driven pattern)
  - Handler lifecycle issues (handlers lost after first stage)
  - Workflow tests timeout at scaffolding stage (0% E2E completion)

### Key Finding
**Root Cause:** Architectural mismatch between callback/handler pattern (AgentDispatcherService) and event-driven pattern (OrchestratorContainer + IMessageBus). The system has ONE FOOT in the old architecture and ONE FOOT in the new architecture.

---

## Current System Architecture Analysis

### 1. Project Structure

```
agent-sdlc/
├── packages/
│   ├── orchestrator/                    # Central orchestration service
│   │   ├── src/
│   │   │   ├── hexagonal/               # NEW: Hexagonal architecture (60% implemented)
│   │   │   │   ├── core/                # Primitives: envelopes, idempotency, retry, logger ✅
│   │   │   │   ├── ports/               # Interfaces: IMessageBus, IKVStore ✅
│   │   │   │   ├── adapters/            # Implementations: RedisBus, RedisKV ✅
│   │   │   │   ├── orchestration/       # BaseOrchestrator, PlanCoordinator ✅
│   │   │   │   ├── persistence/         # WorkflowStateManager ✅
│   │   │   │   └── bootstrap.ts         # OrchestratorContainer (DI) ✅
│   │   │   ├── services/                # OLD: Application services (callback-based)
│   │   │   │   ├── workflow.service.ts  # ⚠️  HYBRID (partial Phase 3)
│   │   │   │   └── agent-dispatcher.service.ts  # ❌ OLD PATTERN (to be removed)
│   │   │   ├── state-machine/           # xstate workflow state machine
│   │   │   ├── repositories/            # Data access layer
│   │   │   └── server.ts                # ⚠️  HYBRID (not fully wired to hexagonal)
│   │   └── package.json
│   ├── agents/                          # Agent packages
│   │   ├── base-agent/                  # Base agent implementation
│   │   │   └── src/
│   │   │       ├── base-agent.ts        # ⚠️  HYBRID (receives via bus, sends via Redis)
│   │   │       └── types.ts             # Agent type definitions
│   │   ├── scaffold-agent/              # Scaffolding agent
│   │   │   └── src/
│   │   │       ├── scaffold-agent.ts    # Extends BaseAgent
│   │   │       └── run-agent.ts         # ✅ Uses OrchestratorContainer
│   │   ├── validation-agent/            # Validation agent
│   │   │   └── src/
│   │   │       ├── validation-agent.ts  # Extends BaseAgent
│   │   │       └── run-agent.ts         # ✅ Uses OrchestratorContainer
│   │   ├── e2e-agent/                   # E2E testing agent
│   │   │   └── src/
│   │   │       ├── e2e-agent.ts         # Extends BaseAgent
│   │   │       └── run-agent.ts         # ✅ Uses OrchestratorContainer
│   │   ├── integration-agent/           # Integration agent
│   │   └── deployment-agent/            # Deployment agent
│   └── shared/                          # Shared packages
│       ├── types/                       # Shared TypeScript types ✅
│       │   └── src/
│       │       ├── core/                # Schemas, brands, enums
│       │       ├── agents/              # Agent-specific types
│       │       ├── envelope/            # Agent envelope types
│       │       └── constants/           # REDIS_CHANNELS, AGENT_TYPES
│       ├── utils/                       # Shared utilities ✅
│       │   └── src/
│       │       ├── retry.ts             # Retry with backoff
│       │       ├── circuit-breaker.ts   # Circuit breaker pattern
│       │       ├── error-handler.ts     # Error handling utilities
│       │       └── redis-subscription.ts # Robust Redis subscriber
│       ├── contracts/                   # Contract validation ✅
│       │   └── src/
│       │       ├── contracts/           # Agent contracts
│       │       └── contract-validator.ts # Validation logic
│       └── test-utils/                  # Test factories and mocks ✅
├── scripts/                             # Build, test, deployment scripts
│   ├── env/                             # Environment management ✅
│   │   ├── start-dev.sh                 # Start all services
│   │   ├── stop-dev.sh                  # Stop all services
│   │   └── check-health.sh              # Health checks
│   └── run-pipeline-test.sh             # E2E workflow testing
└── .claude/                             # Claude Code configuration
    └── commands/                        # Custom slash commands
        └── epcc/                        # EPCC workflow commands ✅
```

### 2. Component Inventory

#### 2.1 Core Components (Hexagonal Architecture)

**Location:** `packages/orchestrator/src/hexagonal/`

| Component | Purpose | Status | Notes |
|-----------|---------|--------|-------|
| **OrchestratorContainer** | DI container, lifecycle management | ✅ Complete | Provides IMessageBus, IKVStore |
| **IMessageBus (Port)** | Pub/sub abstraction | ✅ Complete | Interface for event-driven communication |
| **RedisBus (Adapter)** | Redis pub/sub + streams implementation | ✅ Complete | Implements IMessageBus, supports durability |
| **IKVStore (Port)** | Key-value store abstraction | ✅ Complete | Interface for state persistence |
| **RedisKV (Adapter)** | Redis KV implementation | ✅ Complete | Atomic operations, CAS, TTL |
| **Envelope System** | Message wrapper with correlation | ✅ Complete | Supports tracing, dedup, multi-tenancy |
| **Idempotency** | Exactly-once execution | ✅ Complete | Prevents duplicate work |
| **Retry Logic** | Exponential backoff with jitter | ✅ Complete | Handles transient failures |
| **Logger** | Structured logging | ✅ Complete | JSON logs with correlation IDs |

#### 2.2 Agent Components

**Location:** `packages/agents/*/src/`

| Component | Purpose | Status | Issues |
|-----------|---------|--------|--------|
| **BaseAgent** | Base class for all agents | ⚠️  Hybrid | - Receives tasks via IMessageBus ✅<br>- Sends results via direct Redis ❌<br>- Should use IMessageBus.publish() |
| **ScaffoldAgent** | Scaffolding logic | ✅ Complete | Extends BaseAgent correctly |
| **ValidationAgent** | Validation logic | ✅ Complete | Extends BaseAgent correctly |
| **E2EAgent** | E2E testing logic | ✅ Complete | Extends BaseAgent correctly |
| **IntegrationAgent** | Integration logic | ✅ Complete | Extends BaseAgent correctly |
| **DeploymentAgent** | Deployment logic | ✅ Complete | Extends BaseAgent correctly |
| **run-agent.ts** (all) | Agent entry points | ✅ Complete | All use OrchestratorContainer |

#### 2.3 Orchestrator Components

**Location:** `packages/orchestrator/src/`

| Component | Purpose | Status | Issues |
|-----------|---------|--------|--------|
| **WorkflowService** | Workflow orchestration | ⚠️  Hybrid | - Has messageBus injected ✅<br>- Has setupMessageBusSubscription() ✅<br>- May not be fully using bus |
| **AgentDispatcherService** | Task dispatch & result handling | ❌ OLD PATTERN | - Callback-based (incompatible)<br>- Should be removed<br>- Replaced by IMessageBus |
| **WorkflowStateMachineService** | State transitions (xstate) | ✅ Complete | Event-driven state machine |
| **WorkflowRepository** | Data access | ✅ Complete | CRUD for workflows |
| **EventBus** | Internal event bus | ✅ Complete | For state machine events |
| **server.ts** | Fastify server bootstrap | ⚠️  Hybrid | Not fully wired to hexagonal |

#### 2.4 Shared Components

**Location:** `packages/shared/*/src/`

| Package | Purpose | Status | Usage |
|---------|---------|--------|-------|
| **shared-types** | Type system, schemas | ✅ Complete | Used by all components |
| **shared-utils** | Retry, circuit breaker, errors | ✅ Complete | Used by agents, orchestrator |
| **shared-contracts** | Contract validation | ✅ Complete | Used by agents for validation |
| **shared-test-utils** | Test factories, mocks | ✅ Complete | Used in tests |

---

## Agent Lifecycle Analysis

### Current Agent Lifecycle (Hybrid State)

```
┌─────────────────────────────────────────────────────────────────┐
│ AGENT INITIALIZATION (run-agent.ts)                             │
├─────────────────────────────────────────────────────────────────┤
│ 1. Load environment variables (ANTHROPIC_API_KEY, REDIS_URL)   │
│ 2. Create OrchestratorContainer                           ✅   │
│ 3. await container.initialize()                           ✅   │
│    - Creates RedisSuite (base, pub, sub clients)               │
│    - Creates IMessageBus (RedisBus adapter)                    │
│    - Creates IKVStore (RedisKV adapter)                        │
│ 4. Extract messageBus from container                      ✅   │
│ 5. Create agent instance with messageBus                  ✅   │
│ 6. await agent.initialize()                               ✅   │
│    - Subscribe to tasks via IMessageBus                   ✅   │
│    - Register with orchestrator (Redis hash)              ✅   │
│ 7. Keep process alive, handle SIGINT/SIGTERM              ✅   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ AGENT TASK RECEPTION (BaseAgent.initialize)                     │
├─────────────────────────────────────────────────────────────────┤
│ 1. Subscribe to task channel via IMessageBus              ✅   │
│    - Channel: agent:<type>:tasks (e.g., agent:scaffold:tasks)  │
│    - Consumer group: agent-<type>-group                        │
│    - Handler: async (message) => { ... }                       │
│ 2. Message bus delivers task envelope                     ✅   │
│ 3. Parse envelope and convert to AgentMessage             ✅   │
│ 4. Call this.receiveTask(agentMessage)                    ✅   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ AGENT TASK EXECUTION (BaseAgent.receiveTask)                    │
├─────────────────────────────────────────────────────────────────┤
│ 1. Validate task against schema                           ✅   │
│ 2. Extract workflow stage from envelope                   ✅   │
│ 3. Execute task with retry logic                          ✅   │
│    - await retry(() => this.execute(task), {...})              │
│    - Uses RetryPresets.standard from shared-utils              │
│ 4. Report result or error                                 ⚠️    │
│    - await this.reportResult(result, workflowStage)            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ AGENT RESULT REPORTING (BaseAgent.reportResult) - PROBLEM!      │
├─────────────────────────────────────────────────────────────────┤
│ 1. Validate result against TaskResultSchema               ✅   │
│ 2. Transform to AgentResultSchema format                  ✅   │
│ 3. Validate against AgentResultSchema                     ✅   │
│ 4. Create AgentMessage envelope                           ✅   │
│ 5. ❌ Publish via DIRECT REDIS (this.redisPublisher)      ❌   │
│    - Channel: orchestrator:results                             │
│    - NOT using IMessageBus.publish()                      ❌   │
│    - Should use: await this.messageBus.publish(...)       ❌   │
│ 6. Mirror to Redis stream (direct Redis XADD)             ⚠️    │
│    - Should be handled by message bus adapter                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ AGENT CLEANUP (BaseAgent.cleanup)                               │
├─────────────────────────────────────────────────────────────────┤
│ 1. Deregister from orchestrator (Redis hash)              ✅   │
│ 2. Unsubscribe from Redis channels                        ✅   │
│ 3. Disconnect Redis clients                               ✅   │
│ 4. (Should also) Disconnect messageBus                    ❌   │
└─────────────────────────────────────────────────────────────────┘
```

### Target Agent Lifecycle (Fully Symmetric)

```
┌─────────────────────────────────────────────────────────────────┐
│ AGENT INITIALIZATION (run-agent.ts) - NO CHANGES NEEDED         │
├─────────────────────────────────────────────────────────────────┤
│ [Same as current - already correct]                        ✅   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ AGENT TASK RECEPTION - NO CHANGES NEEDED                        │
├─────────────────────────────────────────────────────────────────┤
│ [Same as current - already correct]                        ✅   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ AGENT TASK EXECUTION - NO CHANGES NEEDED                        │
├─────────────────────────────────────────────────────────────────┤
│ [Same as current - already correct]                        ✅   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ AGENT RESULT REPORTING (BaseAgent.reportResult) - FIX NEEDED    │
├─────────────────────────────────────────────────────────────────┤
│ 1. Validate result against TaskResultSchema               ✅   │
│ 2. Transform to AgentResultSchema format                  ✅   │
│ 3. Validate against AgentResultSchema                     ✅   │
│ 4. Create envelope with correlation ID                    ✅   │
│ 5. ✅ Publish via IMessageBus.publish()                   ✅   │
│    - await this.messageBus.publish(                            │
│        'orchestrator:results',                                  │
│        agentResult,                                             │
│        {                                                        │
│          key: workflow_id,                                      │
│          mirrorToStream: 'stream:orchestrator:results'          │
│        }                                                        │
│      );                                                         │
│    - Adapter handles stream mirroring automatically       ✅   │
│    - Adapter handles deduplication                        ✅   │
│    - No direct Redis access needed                        ✅   │
│ 6. Remove direct Redis publishing code                    ✅   │
│ 7. Remove stream mirroring code (adapter handles it)      ✅   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ AGENT CLEANUP (BaseAgent.cleanup) - ENHANCED                    │
├─────────────────────────────────────────────────────────────────┤
│ 1. Deregister from orchestrator                           ✅   │
│ 2. Cleanup managed by container.shutdown()                ✅   │
│    - Called in run-agent.ts signal handlers                    │
│    - Disconnects message bus                                   │
│    - Disconnects KV store                                      │
│    - Disconnects all Redis clients                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Orchestrator Lifecycle Analysis

### Current Orchestrator Lifecycle (Hybrid State)

```
┌─────────────────────────────────────────────────────────────────┐
│ ORCHESTRATOR INITIALIZATION (server.ts)                         │
├─────────────────────────────────────────────────────────────────┤
│ 1. Initialize Fastify server                              ✅   │
│ 2. ❌ Create AgentDispatcherService (OLD PATTERN)         ❌   │
│    - Callback-based result handling                            │
│    - Per-workflow handler registration                         │
│    - Handler cleanup after first stage                         │
│ 3. Create WorkflowRepository                              ✅   │
│ 4. Create EventBus                                        ✅   │
│ 5. Create WorkflowStateMachineService                     ✅   │
│ 6. ⚠️  Create WorkflowService (HYBRID)                    ⚠️    │
│    - Constructor accepts optional IMessageBus                  │
│    - May or may not be passed in                               │
│    - Falls back to direct Redis if not provided                │
│ 7. Register routes                                        ✅   │
│ 8. Start server                                           ✅   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ WORKFLOW CREATION (WorkflowService.createWorkflow)              │
├─────────────────────────────────────────────────────────────────┤
│ 1. Validate request                                       ✅   │
│ 2. Create workflow in database                            ✅   │
│ 3. Initialize state machine                               ✅   │
│ 4. ❌ Register result handler with AgentDispatcherService ❌   │
│    - agentDispatcher.onResult(workflowId, handler)             │
│    - Handler will be lost after first stage                    │
│    - Not using message bus subscription                        │
│ 5. Create task for first stage                            ✅   │
│ 6. ❌ Dispatch task via AgentDispatcherService            ❌   │
│    - agentDispatcher.dispatchTask(task)                        │
│    - Should use message bus                                    │
│ 7. Return workflow response                               ✅   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ AGENT RESULT HANDLING (AgentDispatcherService) - PROBLEM!       │
├─────────────────────────────────────────────────────────────────┤
│ 1. Subscribe to orchestrator:results channel              ✅   │
│ 2. Receive result message from Redis                      ✅   │
│ 3. ❌ Look up handler in Map (may not exist)              ❌   │
│    - const handler = this.resultHandlers.get(workflowId)       │
│    - Handler may have been deleted after previous stage        │
│    - Handler may have timed out                                │
│ 4. If handler exists, call it                             ⚠️    │
│ 5. ❌ Clean up handler after terminal status              ❌   │
│    - Deletes handler after first stage completion              │
│    - Subsequent stages will not have handler                   │
│    - Workflow gets stuck!                                      │
└─────────────────────────────────────────────────────────────────┘
```

### Target Orchestrator Lifecycle (Fully Event-Driven)

```
┌─────────────────────────────────────────────────────────────────┐
│ ORCHESTRATOR INITIALIZATION (server.ts) - COMPLETE REWRITE      │
├─────────────────────────────────────────────────────────────────┤
│ 1. Initialize Fastify server                              ✅   │
│ 2. ✅ Create OrchestratorContainer                        ✅   │
│    - container = new OrchestratorContainer({ ... })            │
│    - await container.initialize()                              │
│    - Creates IMessageBus, IKVStore                             │
│ 3. Extract dependencies from container                    ✅   │
│    - const messageBus = container.getBus()                     │
│    - const kvStore = container.getKV()                         │
│ 4. Create WorkflowRepository (with kvStore)               ✅   │
│ 5. Create EventBus                                        ✅   │
│ 6. Create WorkflowStateMachineService                     ✅   │
│ 7. ✅ Create WorkflowService (with messageBus)            ✅   │
│    - new WorkflowService(repository, eventBus,                 │
│        stateMachineService, messageBus)                        │
│    - messageBus is REQUIRED, not optional                      │
│ 8. WorkflowService subscribes to agent results ONCE       ✅   │
│    - Happens in constructor or init method                     │
│    - Single persistent subscription for ALL workflows          │
│    - await messageBus.subscribe('orchestrator:results',        │
│        async (result) => { ... })                              │
│ 9. ❌ Delete AgentDispatcherService                       ✅   │
│    - No longer needed                                          │
│    - Message bus replaces it                                   │
│ 10. Register routes                                       ✅   │
│ 11. Start server                                          ✅   │
│ 12. Register shutdown hook                                ✅   │
│     - fastify.addHook('onClose', async () => {                 │
│         await container.shutdown();                            │
│       })                                                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ WORKFLOW CREATION (WorkflowService.createWorkflow) - SIMPLIFIED │
├─────────────────────────────────────────────────────────────────┤
│ 1. Validate request                                       ✅   │
│ 2. Create workflow in database                            ✅   │
│ 3. Initialize state machine                               ✅   │
│ 4. ✅ No handler registration needed!                     ✅   │
│    - Single subscription handles ALL workflows                 │
│    - No per-workflow handler management                        │
│ 5. Create task envelope for first stage                   ✅   │
│ 6. ✅ Dispatch via IMessageBus.publish()                  ✅   │
│    - await messageBus.publish(                                 │
│        'agent:scaffold:tasks',                                  │
│        taskEnvelope,                                            │
│        { key: workflowId, mirrorToStream: '...' }              │
│      )                                                          │
│ 7. Return workflow response                               ✅   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ AGENT RESULT HANDLING (WorkflowService) - EVENT-DRIVEN          │
├─────────────────────────────────────────────────────────────────┤
│ 1. Message bus delivers result to subscription handler    ✅   │
│    - Handler was registered ONCE during initialization         │
│    - Same handler processes ALL workflow results               │
│ 2. Extract workflow_id from result envelope               ✅   │
│ 3. Load workflow from database                            ✅   │
│    - const workflow = await repository.findById(workflowId)    │
│ 4. Validate result against schema                         ✅   │
│ 5. Store stage output in database                         ✅   │
│ 6. Publish STAGE_COMPLETE event to EventBus               ✅   │
│    - await eventBus.publish({                                  │
│        type: 'STAGE_COMPLETE',                                 │
│        workflow_id,                                            │
│        payload: { stage, status, output }                      │
│      })                                                        │
│ 7. ✅ No handler cleanup!                                 ✅   │
│    - Single subscription persists forever                      │
│    - Handles all stages of all workflows                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ STATE MACHINE PROCESSING (WorkflowStateMachineService)          │
├─────────────────────────────────────────────────────────────────┤
│ 1. Receives STAGE_COMPLETE event from EventBus            ✅   │
│ 2. Retrieve state machine for workflow                    ✅   │
│ 3. Send event to state machine                            ✅   │
│    - sm.send({ type: 'STAGE_COMPLETE', ... })                  │
│ 4. State machine transitions automatically                ✅   │
│    - initialization -> scaffolding                             │
│    - scaffolding -> validation                                 │
│    - ... (all 6 stages)                                        │
│ 5. Update workflow in database                            ✅   │
│    - current_stage, progress, updated_at                       │
│ 6. If not terminal, create task for next stage            ✅   │
│    - await workflowService.createTaskForStage(...)             │
│ 7. Dispatch next task via message bus                     ✅   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Integration Patterns Analysis

### Current Integration (Asymmetric)

```
┌──────────────┐                     ┌──────────────┐
│ Orchestrator │                     │    Agent     │
├──────────────┤                     ├──────────────┤
│              │                     │              │
│ Task Dispatch│                     │Task Reception│
│      ↓       │                     │      ↑       │
│ ❌ Direct    │ ─────publish────→  │ ✅ IMessageBus│
│    Redis     │   agent:tasks       │  .subscribe()│
│              │                     │              │
│              │                     │              │
│Result Handler│                     │Result Report │
│      ↑       │                     │      ↓       │
│ ❌ Callback  │ ←────publish────   │ ❌ Direct    │
│   Dispatcher │  orch:results       │    Redis     │
│              │                     │              │
└──────────────┘                     └──────────────┘

PROBLEMS:
1. Orchestrator uses AgentDispatcherService (callbacks)
2. Agents publish results via direct Redis
3. Handler lifecycle issues (lost after first stage)
4. No persistence or replay capability
5. Workflows get stuck at first stage
```

### Target Integration (Symmetric)

```
┌──────────────┐                     ┌──────────────┐
│ Orchestrator │                     │    Agent     │
├──────────────┤                     ├──────────────┤
│              │                     │              │
│ Task Dispatch│                     │Task Reception│
│      ↓       │                     │      ↑       │
│ ✅ IMessageBus│ ─────publish────→ │ ✅ IMessageBus│
│  .publish()  │   agent:tasks       │  .subscribe()│
│              │                     │              │
│              │                     │              │
│Result Handler│                     │Result Report │
│      ↑       │                     │      ↓       │
│ ✅ IMessageBus│ ←────publish────   │ ✅ IMessageBus│
│  .subscribe()│  orch:results       │  .publish()  │
│              │                     │              │
└──────────────┘                     └──────────────┘
                          │
                          ↓
                ┌─────────────────┐
                │ OrchestratorCon-│
                │     tainer      │
                ├─────────────────┤
                │ • IMessageBus   │
                │ • IKVStore      │
                │ • RedisBus      │
                │ • RedisKV       │
                └─────────────────┘

BENEFITS:
1. Symmetric architecture (both sides use IMessageBus)
2. Single persistent subscription (no handler lifecycle)
3. Type-safe with envelopes and schemas
4. Durable with stream mirroring
5. Idempotent with deduplication
6. Traceable with correlation IDs
7. Testable with mocked ports
```

---

## Shared Utilities Inventory

### 1. Shared Types Package (`@agentic-sdlc/shared-types`)

**Purpose:** Centralized type system with Zod schemas for validation

**Exports:**
- **Core Schemas:**
  - `WorkflowSchema` - Workflow entity with state tracking
  - `AgentTaskSchema` - Task assignment to agents
  - `AgentResultSchema` - Agent execution results
  - `PipelineStageSchema` - Stage definitions
  - `EventSchema` - Event bus events
- **Enums:**
  - `WorkflowTypeEnum` - app, service, feature, capability
  - `WorkflowStateEnum` - initiated, scaffolding, validating, etc.
  - `AgentTypeEnum` - scaffold, validation, e2e, integration, deployment
  - `TaskStatusEnum` - pending, queued, running, success, failed, etc.
- **Brands:** Type-safe IDs (WorkflowId, AgentId, TaskId)
- **Constants:**
  - `REDIS_CHANNELS` - Channel name factories
  - `AGENT_TYPES` - Agent type constants
  - `WORKFLOW_STAGES` - Stage name constants
- **Envelopes:** Agent message envelope types
- **Schema Registry:** Central schema validation
- **Contract Validator:** Contract enforcement

**Usage:** Import in ALL components for type safety

### 2. Shared Utils Package (`@agentic-sdlc/shared-utils`)

**Purpose:** Resilience and error handling utilities

**Exports:**
- **Retry Logic:**
  - `retry()` - Retry with exponential backoff
  - `retryWithMetadata()` - Retry with attempt tracking
  - `RetryPresets` - Standard, aggressive, gentle presets
  - `RetryError` - Retry failure error type
- **Circuit Breaker:**
  - `CircuitBreaker` - Circuit breaker implementation
  - `createCircuitBreaker()` - Factory function
  - `CircuitState` - CLOSED, OPEN, HALF_OPEN
  - `CircuitBreakerError` - Circuit open error
- **Redis Subscription:**
  - `RobustRedisSubscriber` - Resilient Redis subscriber
  - `createRobustRedisSubscriber()` - Factory
- **Error Handling:**
  - `ErrorHandler` - Error processing utilities
  - `toErrorMessage()` - Extract error messages
  - `safeErrorLog()` - Safe error logging
  - `wrapAsync()` - Async error wrapper
  - `withFallback()` - Fallback on error
  - `withRetry()` - Retry wrapper
  - `isRetryable()` - Check if error is retryable
  - `getCauseChain()` - Extract error cause chain

**Usage:** Used by agents for resilience, by orchestrator for error handling

### 3. Shared Contracts Package (`@agentic-sdlc/shared-contracts`)

**Purpose:** Contract validation between components

**Exports:**
- **Contract Definitions:**
  - `scaffoldContract` - Scaffold agent contract
  - `validationContract` - Validation agent contract
  - `e2eContract` - E2E agent contract
  - `integrationContract` - Integration agent contract
  - `deploymentContract` - Deployment agent contract
- **Validator:**
  - `ContractValidator` - Validate inputs/outputs against contracts
  - `VersionValidator` - Validate version compatibility

**Usage:** Agents validate their results, orchestrator validates tasks

### 4. Shared Test Utils Package (`@agentic-sdlc/shared-test-utils`)

**Purpose:** Test factories and mocks

**Exports:**
- **Mocks:**
  - `RedisMock` - Mock Redis client
  - `AnthropicMock` - Mock Anthropic client
- **Factories:**
  - `ScaffoldFactory` - Create test scaffold data
- **Test Setup:**
  - Test configuration and helpers

**Usage:** Used in all test files

---

## Target Architecture Definition

### 1. System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        UNIFIED SYSTEM ARCHITECTURE                       │
│                   (Hexagonal + Event-Driven + Agent-Based)               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                    ORCHESTRATOR (Fastify)                       │    │
│  ├────────────────────────────────────────────────────────────────┤    │
│  │                                                                 │    │
│  │  HTTP API (REST)                                               │    │
│  │    POST /api/v1/workflows       ← Create workflow             │    │
│  │    GET  /api/v1/workflows/:id   ← Get workflow status         │    │
│  │    GET  /api/v1/workflows       ← List workflows              │    │
│  │                                                                 │    │
│  │  ┌──────────────────────────────────────────────────────────┐ │    │
│  │  │ APPLICATION LAYER                                         │ │    │
│  │  ├──────────────────────────────────────────────────────────┤ │    │
│  │  │                                                           │ │    │
│  │  │  WorkflowService                                         │ │    │
│  │  │  • createWorkflow()                                      │ │    │
│  │  │  • getWorkflow()                                         │ │    │
│  │  │  • listWorkflows()                                       │ │    │
│  │  │  • handleAgentResult() ← Message bus subscription       │ │    │
│  │  │                                                           │ │    │
│  │  │  WorkflowStateMachineService (xstate)                   │ │    │
│  │  │  • State transitions (automatic)                         │ │    │
│  │  │  • initialization → scaffolding → validation → ...      │ │    │
│  │  │                                                           │ │    │
│  │  │  WorkflowRepository                                      │ │    │
│  │  │  • CRUD operations on workflows                          │ │    │
│  │  │                                                           │ │    │
│  │  └──────────────────────────────────────────────────────────┘ │    │
│  │                           ↕                                    │    │
│  │  ┌──────────────────────────────────────────────────────────┐ │    │
│  │  │ HEXAGONAL CORE (OrchestratorContainer)                   │ │    │
│  │  ├──────────────────────────────────────────────────────────┤ │    │
│  │  │                                                           │ │    │
│  │  │  Ports (Interfaces)                                      │ │    │
│  │  │  • IMessageBus    ← Pub/sub abstraction                 │ │    │
│  │  │  • IKVStore       ← Key-value abstraction               │ │    │
│  │  │                                                           │ │    │
│  │  │  Adapters (Implementations)                              │ │    │
│  │  │  • RedisBus       ← Implements IMessageBus              │ │    │
│  │  │  • RedisKV        ← Implements IKVStore                 │ │    │
│  │  │                                                           │ │    │
│  │  │  Core Primitives                                         │ │    │
│  │  │  • Envelope       ← Message wrapper with correlation    │ │    │
│  │  │  • Idempotency    ← Exactly-once execution              │ │    │
│  │  │  • Retry          ← Exponential backoff                 │ │    │
│  │  │  • Logger         ← Structured JSON logging             │ │    │
│  │  │                                                           │ │    │
│  │  └──────────────────────────────────────────────────────────┘ │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                 ↕                                       │
│                        IMessageBus (Redis)                              │
│                                 ↕                                       │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐           │
│  │             │             │             │             │           │
│  ▼             ▼             ▼             ▼             ▼           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Scaffold │ │Validation│ │   E2E    │ │Integration││Deployment│  │
│  │  Agent   │ │  Agent   │ │  Agent   │ │  Agent   │ │  Agent   │  │
│  ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤  │
│  │          │ │          │ │          │ │          │ │          │  │
│  │ Extends  │ │ Extends  │ │ Extends  │ │ Extends  │ │ Extends  │  │
│  │BaseAgent │ │BaseAgent │ │BaseAgent │ │BaseAgent │ │BaseAgent │  │
│  │          │ │          │ │          │ │          │ │          │  │
│  │• receive │ │• receive │ │• receive │ │• receive │ │• receive │  │
│  │  (bus)   │ │  (bus)   │ │  (bus)   │ │  (bus)   │ │  (bus)   │  │
│  │• execute │ │• execute │ │• execute │ │• execute │ │• execute │  │
│  │  (logic) │ │  (logic) │ │  (logic) │ │  (logic) │ │  (logic) │  │
│  │• report  │ │• report  │ │• report  │ │• report  │ │• report  │  │
│  │  (bus)   │ │  (bus)   │ │  (bus)   │ │  (bus)   │ │  (bus)   │  │
│  │          │ │          │ │          │ │          │ │          │  │
│  │Uses:     │ │Uses:     │ │Uses:     │ │Uses:     │ │Uses:     │  │
│  │• IMessage│ │• IMessage│ │• IMessage│ │• IMessage│ │• IMessage│  │
│  │  Bus     │ │  Bus     │ │  Bus     │ │  Bus     │ │  Bus     │  │
│  │• Retry   │ │• Retry   │ │• Retry   │ │• Retry   │ │• Retry   │  │
│  │• Circuit │ │• Circuit │ │• Circuit │ │• Circuit │ │• Circuit │  │
│  │  Breaker │ │  Breaker │ │  Breaker │ │  Breaker │ │  Breaker │  │
│  │• Shared  │ │• Shared  │ │• Shared  │ │• Shared  │ │• Shared  │  │
│  │  Types   │ │  Types   │ │  Types   │ │  Types   │ │  Types   │  │
│  │          │ │          │ │          │ │          │ │          │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │               SHARED PACKAGES (Cross-Cutting)                   │ │
│  ├────────────────────────────────────────────────────────────────┤ │
│  │                                                                 │ │
│  │  @agentic-sdlc/shared-types                                    │ │
│  │  • Schemas (Workflow, AgentTask, AgentResult)                  │ │
│  │  • Enums (WorkflowState, AgentType, TaskStatus)                │ │
│  │  • Brands (WorkflowId, AgentId, TaskId)                        │ │
│  │  • Constants (REDIS_CHANNELS, AGENT_TYPES)                     │ │
│  │  • Schema Registry, Contract Validator                         │ │
│  │                                                                 │ │
│  │  @agentic-sdlc/shared-utils                                    │ │
│  │  • Retry (exponential backoff, presets)                        │ │
│  │  • Circuit Breaker (fault tolerance)                           │ │
│  │  • Error Handling (wrapAsync, withFallback)                    │ │
│  │  • Redis Subscription (robust subscriber)                      │ │
│  │                                                                 │ │
│  │  @agentic-sdlc/shared-contracts                                │ │
│  │  • Agent contracts (input/output validation)                   │ │
│  │  • Contract validator, version validator                       │ │
│  │                                                                 │ │
│  │  @agentic-sdlc/shared-test-utils                               │ │
│  │  • Mocks (Redis, Anthropic)                                    │ │
│  │  • Factories (test data generation)                            │ │
│  │                                                                 │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### 2. Message Flow Diagram

```
WORKFLOW EXECUTION FLOW (Target Architecture)

1. User creates workflow
   ↓
2. Orchestrator creates workflow in DB
   ↓
3. Orchestrator publishes task via IMessageBus
   Topic: agent:scaffold:tasks
   Payload: TaskEnvelope { workflow_id, payload, ... }
   ↓
4. Scaffold Agent receives task (IMessageBus.subscribe)
   ↓
5. Scaffold Agent executes task (with retry, circuit breaker)
   ↓
6. Scaffold Agent publishes result via IMessageBus
   Topic: orchestrator:results
   Payload: ResultEnvelope { workflow_id, status, output, ... }
   ↓
7. Orchestrator receives result (IMessageBus.subscribe - persistent!)
   ↓
8. Orchestrator stores stage output in DB
   ↓
9. Orchestrator publishes STAGE_COMPLETE event to EventBus
   ↓
10. State machine receives event and transitions
    scaffolding → validation
    ↓
11. Orchestrator creates task for next stage
    ↓
12. Orchestrator publishes task via IMessageBus
    Topic: agent:validation:tasks
    ↓
13. Validation Agent receives task
    ↓
14. [Repeat steps 5-12 for all stages]
    ↓
15. Final stage completes, state machine transitions to "completed"
    ↓
16. Workflow status = "completed", progress = 100%
```

### 3. Core Components and Responsibilities

#### 3.1 OrchestratorContainer (Bootstrap / DI)

**Location:** `packages/orchestrator/src/hexagonal/bootstrap.ts`

**Responsibilities:**
1. Initialize RedisSuite (base, pub, sub clients)
2. Create IMessageBus adapter (RedisBus)
3. Create IKVStore adapter (RedisKV)
4. Provide dependency injection for all components
5. Manage lifecycle (initialize, shutdown)
6. Health monitoring

**Dependencies:** None (root of dependency tree)

**Lifecycle:**
- `new OrchestratorContainer(config)` - Create container
- `await container.initialize()` - Initialize all adapters
- `container.getBus()` - Get IMessageBus
- `container.getKV()` - Get IKVStore
- `await container.shutdown()` - Graceful shutdown

#### 3.2 IMessageBus (Port) + RedisBus (Adapter)

**Location:**
- Port: `packages/orchestrator/src/hexagonal/ports/message-bus.port.ts`
- Adapter: `packages/orchestrator/src/hexagonal/adapters/redis-bus.adapter.ts`

**Responsibilities:**
1. Publish messages to topics (fire-and-forget or durable)
2. Subscribe to topics with handlers (persistent subscriptions)
3. Optional stream mirroring for durability
4. Deduplication support via envelope IDs
5. Health checking

**Interface:**
```typescript
interface IMessageBus {
  publish<T>(topic: string, msg: T, opts?: PublishOptions): Promise<void>;
  subscribe<T>(topic: string, handler: (msg: T) => Promise<void>, opts?: SubscriptionOptions): Promise<() => Promise<void>>;
  health(): Promise<BusHealth>;
  disconnect(): Promise<void>;
}
```

**Usage:**
- Orchestrator: Publish tasks, subscribe to results
- Agents: Subscribe to tasks, publish results

#### 3.3 IKVStore (Port) + RedisKV (Adapter)

**Location:**
- Port: `packages/orchestrator/src/hexagonal/ports/kv-store.port.ts`
- Adapter: `packages/orchestrator/src/hexagonal/adapters/redis-kv.adapter.ts`

**Responsibilities:**
1. Store key-value pairs with TTL
2. Retrieve values with type safety
3. Atomic operations (CAS, INCR)
4. Idempotency tracking
5. State persistence

**Interface:**
```typescript
interface IKVStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSec?: number): Promise<void>;
  del(key: string): Promise<void>;
  cas<T>(key: string, expected: T, value: T): Promise<boolean>;
  incr(key: string): Promise<number>;
  health(): Promise<boolean>;
  disconnect(): Promise<void>;
}
```

**Usage:**
- Idempotency: Track processed message IDs
- State: Persist workflow state
- Caching: Cache expensive computations

#### 3.4 BaseAgent (Agent Lifecycle)

**Location:** `packages/agents/base-agent/src/base-agent.ts`

**Responsibilities:**
1. Subscribe to tasks via IMessageBus
2. Validate task assignments
3. Execute tasks with retry and circuit breaker
4. Report results via IMessageBus
5. Register/deregister with orchestrator
6. Health monitoring

**Lifecycle:**
```typescript
// Initialization
constructor(capabilities, messageBus)
await agent.initialize()
  → Subscribe to agent:<type>:tasks
  → Register with orchestrator

// Task processing
await agent.receiveTask(message)
  → Validate task
  → Execute with retry
  → Report result

// Cleanup
await agent.cleanup()
  → Deregister from orchestrator
  → Handled by container.shutdown()
```

**Usage:**
- All concrete agents extend BaseAgent
- Override `execute()` method with specific logic
- Inherit all resilience patterns

#### 3.5 WorkflowService (Orchestration Logic)

**Location:** `packages/orchestrator/src/services/workflow.service.ts`

**Responsibilities:**
1. Create workflows
2. Subscribe to agent results (ONCE, persistently)
3. Handle agent results
4. Store stage outputs
5. Publish STAGE_COMPLETE events
6. Coordinate with state machine

**Dependencies:**
- IMessageBus (for agent communication)
- WorkflowRepository (for data access)
- EventBus (for state machine events)
- WorkflowStateMachineService (for state transitions)

**Key Methods:**
```typescript
class WorkflowService {
  constructor(repository, eventBus, stateMachine, messageBus) {
    // Subscribe to agent results ONCE
    this.setupMessageBusSubscription();
  }

  private async setupMessageBusSubscription() {
    await this.messageBus.subscribe('orchestrator:results',
      async (result) => this.handleAgentResult(result)
    );
  }

  private async handleAgentResult(result: AgentResult) {
    // 1. Load workflow
    // 2. Store stage output
    // 3. Publish STAGE_COMPLETE event
    // 4. State machine handles rest
  }

  async createWorkflow(request) {
    // 1. Create in DB
    // 2. Initialize state machine
    // 3. Create first task
    // 4. Publish via messageBus
  }
}
```

#### 3.6 WorkflowStateMachineService (State Transitions)

**Location:** `packages/orchestrator/src/state-machine/workflow-state-machine.ts`

**Responsibilities:**
1. Define workflow state machine (xstate)
2. Handle STAGE_COMPLETE events
3. Transition states automatically
4. Update workflow in database
5. Trigger next stage task creation

**State Transitions:**
```
initialization
  --STAGE_COMPLETE--> scaffolding
  --STAGE_COMPLETE--> validation
  --STAGE_COMPLETE--> e2e
  --STAGE_COMPLETE--> integration
  --STAGE_COMPLETE--> deployment
  --STAGE_COMPLETE--> completed
```

---

## Implementation Strategy (High-Level)

### Phase 1: Fix Agent Result Publishing (1 hour)
**Goal:** Agents publish results via IMessageBus instead of direct Redis

**Changes:**
1. Update `BaseAgent.reportResult()`:
   - Remove direct Redis publishing
   - Use `await this.messageBus.publish('orchestrator:results', result, { ... })`
   - Remove stream mirroring (adapter handles it)
2. No changes to other agent methods (already correct)
3. Test with one agent first (scaffold)

### Phase 2: Remove AgentDispatcherService (1 hour)
**Goal:** Delete old callback-based dispatcher

**Changes:**
1. Delete `packages/orchestrator/src/services/agent-dispatcher.service.ts`
2. Remove all references in WorkflowService
3. Remove handler registration code
4. Remove handler cleanup code

### Phase 3: Wire OrchestratorContainer into server.ts (1 hour)
**Goal:** Orchestrator uses hexagonal architecture

**Changes:**
1. Update `server.ts`:
   - Create OrchestratorContainer
   - Initialize container
   - Extract messageBus and kvStore
   - Pass to WorkflowService
2. Update WorkflowService constructor to require messageBus
3. Register shutdown hook

### Phase 4: Update Task Dispatch to Use Message Bus (1 hour)
**Goal:** Orchestrator dispatches tasks via IMessageBus

**Changes:**
1. Update WorkflowService.createWorkflow():
   - Create task envelope
   - Publish via `messageBus.publish('agent:<type>:tasks', envelope, { ... })`
   - Remove dispatcher calls

### Phase 5: Verify Message Bus Subscription (30 min)
**Goal:** Ensure WorkflowService subscribes to results

**Changes:**
1. Verify `setupMessageBusSubscription()` is called in constructor
2. Verify subscription handler processes all workflows
3. Add diagnostic logging

### Phase 6: E2E Testing & Validation (1.5 hours)
**Goal:** All workflow tests pass

**Testing:**
1. Start environment: `./scripts/env/start-dev.sh`
2. Run pipeline test: `./scripts/run-pipeline-test.sh "Hello World API"`
3. Verify all 6 stages complete
4. Check progress reaches 100%
5. Verify no handler errors in logs

**Total Estimated Time:** 6 hours

---

## Success Criteria

### Before Implementation
- ❌ All pipeline tests timeout at scaffolding (0%)
- ❌ Handler lost after first stage
- ❌ Asymmetric architecture (bus + Redis)
- ❌ AgentDispatcherService exists

### After Implementation
- ✅ All pipeline tests complete (100% success rate)
- ✅ Workflows progress through all 6 stages
- ✅ Progress percentage updates (0% → 100%)
- ✅ Workflow status changes to "completed"
- ✅ All stage_outputs stored in database
- ✅ Symmetric architecture (IMessageBus on both sides)
- ✅ No handler lifecycle issues
- ✅ Persistent subscriptions
- ✅ AgentDispatcherService deleted
- ✅ Type-safe validation throughout
- ✅ Production-ready architecture

---

## Risk Assessment

### Risk 1: Breaking Existing Workflows
**Impact:** High
**Likelihood:** Medium
**Mitigation:**
- Make changes incrementally
- Test after each phase
- Run pipeline tests frequently
- Rollback capability with git

### Risk 2: Message Bus Performance
**Impact:** Medium
**Likelihood:** Low
**Mitigation:**
- Bus already tested with concurrent handlers
- pSubscribe pattern is proven
- Stream mirroring provides durability
- Redis is production-ready

### Risk 3: Missing Messages
**Impact:** High
**Likelihood:** Low
**Mitigation:**
- Stream mirroring for durability
- Consumer groups for reliability
- Message deduplication
- Dead letter queue for failures

### Risk 4: Type Safety Issues
**Impact:** Medium
**Likelihood:** Low
**Mitigation:**
- Zod schemas validate at runtime
- TypeScript validates at compile time
- Contract validation in place
- Comprehensive test coverage

---

## Key Architectural Principles

### 1. Hexagonal (Ports & Adapters) Architecture
**Principle:** Separate business logic from infrastructure
**Implementation:**
- Ports define interfaces (IMessageBus, IKVStore)
- Adapters implement ports (RedisBus, RedisKV)
- Business logic depends ONLY on ports
- Easy to swap implementations (Redis → NATS, RabbitMQ, etc.)

### 2. Event-Driven Architecture
**Principle:** Components communicate via events, not callbacks
**Implementation:**
- Single persistent subscriptions (not per-workflow)
- No handler lifecycle management
- State machine processes events automatically
- Idempotent event handlers

### 3. Dependency Injection
**Principle:** Dependencies injected, not hardcoded
**Implementation:**
- OrchestratorContainer provides all dependencies
- Constructor injection for testability
- Easy to mock for unit tests

### 4. Type Safety
**Principle:** Catch errors at compile time and runtime
**Implementation:**
- TypeScript with strict mode
- Zod schemas for runtime validation
- Branded types for domain entities
- Contract validation between components

### 5. Resilience Patterns
**Principle:** Handle failures gracefully
**Implementation:**
- Retry with exponential backoff
- Circuit breaker for external calls
- Dead letter queue for failed messages
- Health checks and monitoring

### 6. Observability
**Principle:** System behavior must be observable
**Implementation:**
- Structured JSON logging
- Correlation IDs across components
- Metrics and counters
- Health endpoints

---

## Next Steps (For Planning Phase)

1. **Review This Document**
   - Validate architectural decisions
   - Confirm component responsibilities
   - Verify risk mitigation strategies

2. **Create Detailed Plan**
   - Break down implementation into tasks
   - Estimate time for each task
   - Identify dependencies
   - Define acceptance criteria

3. **Prepare Test Strategy**
   - Unit tests for modified components
   - Integration tests for message bus
   - E2E tests for workflows
   - Performance tests for message throughput

4. **Document Migration Path**
   - Step-by-step instructions
   - Rollback procedures
   - Verification checkpoints
   - Troubleshooting guide

---

## Appendix: File Change Summary

### Files to Modify

| File | Change Type | Priority | Estimated LOC |
|------|-------------|----------|---------------|
| `packages/agents/base-agent/src/base-agent.ts` | Modify | P0 | 50 lines |
| `packages/orchestrator/src/server.ts` | Modify | P0 | 30 lines |
| `packages/orchestrator/src/services/workflow.service.ts` | Modify | P0 | 80 lines |
| `packages/orchestrator/src/services/agent-dispatcher.service.ts` | Delete | P0 | -380 lines |

### Files to Keep (No Changes)

- All hexagonal architecture files ✅
- All shared packages ✅
- All agent implementations ✅
- All run-agent.ts files ✅
- State machine service ✅
- Repository layer ✅

### Total Impact

- **Files Modified:** 3
- **Files Deleted:** 1
- **Net Lines Changed:** ~-200 (net reduction!)
- **Complexity:** Decreased (simpler architecture)

---

## Glossary

**Hexagonal Architecture:** Architecture pattern that separates business logic from infrastructure via ports (interfaces) and adapters (implementations)

**Port:** Interface that defines a capability (e.g., IMessageBus)

**Adapter:** Implementation of a port (e.g., RedisBus implements IMessageBus)

**Envelope:** Message wrapper that adds metadata (correlation ID, timestamp, etc.)

**Idempotency:** Property where operation produces same result when executed multiple times

**Circuit Breaker:** Pattern that prevents cascading failures by stopping calls to failing services

**Consumer Group:** Redis Streams feature for load balancing message consumption

**Stream Mirroring:** Publishing messages to both pub/sub and streams for durability

**CAS (Compare-And-Swap):** Atomic operation that updates value only if current value matches expected

**DI (Dependency Injection):** Pattern where dependencies are provided to components rather than created internally

---

**Status:** Exploration Complete ✅
**Next Phase:** Planning
**Estimated Implementation Time:** 6 hours
**Confidence Level:** High (90%)
