# When Do We Get Rid of Callbacks? Timeline & Roadmap

## TL;DR

**Now:** Patch complete, ready to start Phase 1
**Next Session:** Begin Phase 1 (OrchestratorContainer initialization)
**Session #54:** Phase 2 (Actually replace callbacks with message bus subscription)
**Sessions #55-58:** Phases 3-6 (Complete event-driven architecture)

---

## Current Status (Session #52)

```
Callbacks: ✅ ACTIVE
Message Bus: ❌ NOT YET INTEGRATED
Schema Compliance: ✅ COMPLETE
Build: ✅ PASSING

Workflow Progression: ❌ HANGS AT STAGE 2
Root Cause: Per-workflow handler gets deleted after first result
```

---

## Why Callbacks Still Here

The callback pattern (AgentDispatcherService) has a fundamental flaw:
```typescript
// In WorkflowService.createTaskForStage():
agentDispatcher.onResult(workflowId, async (result) => {
  await this.handleAgentResult(result);
});

// This creates per-workflow callback...
// Then somewhere else it gets deleted:
agentDispatcher.offResult(workflowId);  // ← Handler is GONE

// When next result arrives, no handler exists
// ❌ Workflow hangs
```

**The Solution:** Replace with single message bus subscription:
```typescript
// In WorkflowService constructor (ONE TIME):
this.messageBus.subscribe('agent:results', async (result) => {
  await this.handleAgentResult(result);
});

// ✅ This subscription is PERSISTENT
// ✅ Works for ALL workflows
// ✅ No per-workflow cleanup needed
```

---

## Phase-by-Phase Getting Rid of Callbacks

### Phase 1: Initialize Container (Session #53)
**What:** Wire OrchestratorContainer into bootstrap
**Status:** Callbacks still there
**Goal:** Lay groundwork for removing callbacks
**Code Impact:** 30 lines in server.ts

```
BEFORE:              AFTER:
AgentDispatcher  →   OrchestratorContainer
(callbacks)          (container)
                     │
                     ├─ messageBus (for Phase 2)
                     └─ kvStore (for Phase 6)
```

### Phase 2: Replace Callbacks (Session #54) ⭐ **ACTUAL REMOVAL**
**What:** Replace per-workflow callback registration with single bus subscription
**Status:** **Callbacks REMOVED here**
**Goal:** Centralized, persistent result handling
**Code Impact:** Significant refactor of WorkflowService

```
BEFORE:
agentDispatcher.onResult(workflowId, handler)  ← Per-workflow
agentDispatcher.offResult(workflowId)          ← Callback deleted
❌ Handler lifecycle fragmented

AFTER:
messageBus.subscribe('agent:results', handler)  ← Single subscription
✅ Handler persists lifetime
✅ No per-workflow management
✅ All workflows routed to same handler
```

**Before Phase 2:** Callbacks are central to result handling
**After Phase 2:** Message bus is central, callbacks are gone

### Phase 3: Update Agents (Session #55)
**What:** Agents publish to message bus instead of raw Redis
**Callbacks Status:** Already removed (from Phase 2)
**Goal:** Complete message bus integration
**Benefit:** Results persist to stream

```
Agent publishes to message bus
  └─ Results persisted to stream
  └─ No callbacks involved anymore
  └─ Durability enabled
```

### Phase 4: State Machine Autonomy (Session #56)
**What:** State machine transitions autonomously on STAGE_COMPLETE events
**Callbacks Status:** Long gone
**Goal:** Orchestration fully event-driven
**Benefit:** Decoupled components

```
No more manual state machine invocation
No more WorkflowService managing state machine
Fully autonomous event-driven system
```

### Phase 5-6: Persistence & Validation (Sessions #57-58)
**What:** Enhanced validation, state persistence, recovery
**Callbacks Status:** Not relevant
**Goal:** Production-ready system
**Benefit:** Enterprise-grade resilience

---

## Timeline to Zero Callbacks

```
Session #52: Patch Complete ✅
    └─ Callbacks: Still active (with improved schema validation)

Session #53: Phase 1 (OrchestratorContainer)
    └─ Callbacks: Still active
    └─ Container: Initialized, ready for Phase 2

Session #54: Phase 2 (Replace Callbacks) ⭐ CALLBACKS REMOVED
    └─ Callbacks: GONE
    └─ Message Bus: Active
    └─ Result handling: Centralized

Sessions #55-58: Phases 3-6 (Complete Architecture)
    └─ No callbacks
    └─ Full event-driven
    └─ Production ready
```

**Exact Session When Callbacks Are Gone: SESSION #54**

---

## What Changes in Phase 2

### Before Phase 2 (Sessions #52-53)
```typescript
// Callbacks exist for every workflow
WorkflowService {
  constructor() {
    this.agentDispatcher = agentDispatcher;  // ← Has callbacks
  }

  createTaskForStage() {
    this.agentDispatcher.onResult(workflowId, handler);  // ← Register
    this.agentDispatcher.dispatchTask(task);
  }

  handleAgentResult() {
    // Processes result...
    this.agentDispatcher.offResult(workflowId);  // ← Delete callback
  }
}
```

### After Phase 2 (Sessions #54+)
```typescript
// Single message bus subscription
WorkflowService {
  constructor(messageBus) {
    this.messageBus = messageBus;

    // Subscribe ONCE in constructor
    this.messageBus.subscribe('agent:results', async (result) => {
      await this.handleAgentResult(result);
    });
  }

  createTaskForStage() {
    // NO callback registration
    this.messageBus.publish('agent:tasks:' + type, task);
  }

  handleAgentResult() {
    // Processes result...
    // NO callback cleanup
  }
}
```

**Difference:**
- Per-workflow handler registration ❌ → Single bus subscription ✅
- Handler lifecycle management ❌ → Persistent subscription ✅
- Fragmented cleanup logic ❌ → Clean message routing ✅

---

## Why Not Remove Callbacks in Phase 1?

**Question:** Why not just get rid of them now?

**Answer:** Dependencies:

```
Phase 2 Requires:
  ├─ OrchestratorContainer to be initialized (Phase 1)
  ├─ messageBus to be available (Phase 1)
  ├─ WorkflowService to accept messageBus (Phase 1 change)
  └─ Removal logic to work (Phase 2)

Phase 1 is just the groundwork.
Phase 2 is the actual removal.
```

Think of it like renovating a house:
- **Phase 1:** Install new electrical panel (OrchestratorContainer)
- **Phase 2:** Disconnect old wiring (Remove callbacks) ← Callbacks gone here
- **Phase 3-6:** Finish renovations

**You need the new system in place BEFORE you can remove the old one.**

---

## Impact Timeline

### Sessions #52-53 (Before Callback Removal)
```
Callbacks: Active
Workflows: Still hang at stage 2
Status: Improving but not fixed yet
```

### Session #54 (Callback Removal Happens)
```
Callbacks: REMOVED
Workflows: Should work through all stages
Status: Major improvement
```

### Sessions #55-58 (Finishing)
```
Callbacks: Gone
Architecture: Fully event-driven
Status: Production-ready
```

---

## Why Schema Compliance Was First (Session #52)

You might wonder: "Why did we do schema compliance BEFORE removing callbacks?"

**Because:**
1. **Callbacks still exist** - So we needed to make sure results are compliant
2. **Message bus needs compliance** - In Phase 2, message bus expects AgentResultSchema
3. **Foundation first** - Type safety before architecture changes

**Analogy:**
- Schema compliance = Making sure the wiring is correct before you switch systems
- Callback removal = Actually making the switch

**Order:** Make wiring correct → Switch systems → Complete integration

---

## What "Remove Callbacks" Means

### Old System (Sessions #52-53)
```
AgentDispatcherService
├─ Per-workflow handler registration (onResult)
├─ Handler cleanup (offResult)
├─ Callback-based result processing
└─ Handler lifecycle management
   └─ ❌ Loses handlers after first stage
```

### New System (Sessions #54+)
```
OrchestratorContainer + Message Bus
├─ Single service-level subscription
├─ Central result handling
├─ Event-based processing
└─ Persistent handlers
   └─ ✅ Works for all stages
```

**"Remove callbacks" = Eliminate per-workflow handler registration**
**Result = Single bus subscription that handles everything**

---

## Exact Timeline

| When | What | Callbacks |
|------|------|-----------|
| **Now (Session #52)** | Patch completes | ✅ Active |
| **Session #53 (Phase 1)** | Initialize container | ✅ Active |
| **Session #54 (Phase 2)** | Replace callbacks | ❌ **REMOVED** |
| **Session #55 (Phase 3)** | Agents to bus | ❌ Gone |
| **Session #56 (Phase 4)** | State machine | ❌ Gone |
| **Session #57 (Phase 5)** | Enhanced validation | ❌ Gone |
| **Session #58 (Phase 6)** | Persistence | ❌ Gone |

**Callbacks removed in Session #54**

---

## What Happens in Phase 2 (When Callbacks Die)

### Changes Required
1. Remove `agentDispatcher` parameter from WorkflowService
2. Replace with `messageBus` parameter
3. Remove `onResult()` registration in `createTaskForStage()`
4. Add `subscribe('agent:results')` in constructor
5. Remove `offResult()` calls
6. Remove handler lifecycle logic
7. Remove `resultHandlers` Map
8. Remove `handlerTimeouts` tracking

### Result
```
Before Phase 2:
└─ Per-workflow callbacks
└─ Handlers deleted
└─ Workflows hang

After Phase 2:
└─ Single bus subscription
└─ Handlers persist
└─ Workflows work through all stages
```

### Workflow Progression
```
Before: initialization ─→ scaffolding ─→ HANG (handler deleted)

After: initialization ─→ scaffolding ─→ validation ─→ e2e
       ─→ integration ─→ deployment ─→ completed
```

---

## Quick Answer to Your Question

**Q: When do we get rid of callbacks?**

**A: Session #54, Phase 2**
- Today (Session #52): Patch, callbacks still there
- Next session (Session #53): Phase 1, callbacks still there
- Session after (Session #54): Phase 2, callbacks **completely removed**
- Rest (Sessions #55-58): Finish the architecture

**You're ~2 sessions away from getting rid of callbacks.**

The patch you just completed (Session #52) is the prerequisite foundation. Phase 1 (Session #53) sets up the new system. Phase 2 (Session #54) removes the old system.

---

## Confidence Level

✅ **Schema compliance complete** - Solid foundation
✅ **Build passing** - No technical blockers
✅ **Architecture designed** - Clear plan
✅ **Timeline realistic** - 1 hour per phase

**Callbacks WILL be removed in Session #54. No doubt.**

---

## Documents to Review Before Starting Phase 1

1. **STRATEGIC-DESIGN-REDIS-API-INTEGRATION.md** - The vision
2. **STRATEGIC-IMPLEMENTATION-ROADMAP.md** - Phase breakdown
3. **NEXT-SESSION-PLAN.md** - Exact code changes for Phase 1

Then start Phase 1 in Session #53.
Phase 2 (callback removal) follows right after.

---

**Bottom Line: Callbacks are done in Session #54. You're ready to start Phase 1 (Session #53) immediately.**
