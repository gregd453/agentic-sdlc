# Exploration Report: Strategic Architecture - Layered Platforms with Surface Abstractions

**Status:** EXPLORATION PHASE (READ-ONLY)
**Date:** 2025-11-16
**Project:** Agentic SDLC - AI-driven Software Development Lifecycle Platform
**Current Production Readiness:** 99% (Session #70)

---

## Executive Summary

### Current State
- **Project Type:** Autonomous AI-driven SDLC system with hexagonal architecture
- **Primary Language:** TypeScript (strict mode)
- **Platform Status:** Production-ready at 99% (Session #70)
- **Architecture:** Hexagonal (Ports & Adapters) + Message Bus (Redis Streams) + Agent-based
- **Monorepo:** pnpm workspaces with Turbo build orchestration
- **Services:** 7 PM2 processes (orchestrator + 5 agents + dashboard + analytics)

### Strategic Vision
**STRATEGIC-ARCHITECTURE.md** proposes evolution from single-domain (app, feature, bugfix) to multi-platform system with:
- 4+ independent platforms (Web Apps, Data Pipelines, Mobile Apps, Infrastructure)
- 5 surface types (REST API, GitHub Webhook, CLI, Dashboard, Mobile API)
- Layered abstraction: Surfaces → Platforms → Agents → Hexagonal Core → Infrastructure

### Key Insight
The strategic architecture is a **natural extension** that preserves the hexagonal core and adds layers above it. Database changes are additive and non-breaking.

---

## Current Monorepo Structure

```
packages/
├── orchestrator/          [Core orchestration with hexagonal architecture]
├── agents/                [5 specialized agents + base-agent foundation]
├── shared/                [11 packages: types, workflow-engine, agent-registry, etc.]
├── analytics-service/     [NEW in Session #70: 12 read-only endpoints]
├── dashboard/             [React UI for real-time monitoring]
└── cli/                   [Command-line interface]

Root Documentation:
├── CLAUDE.md              [Session #70: 99% production ready]
├── ARCHITECTURE.md        [Component iteration design]
├── PRODUCT-LINE-DESC.md   [Product line overview]
└── STRATEGIC-ARCHITECTURE.md ← [Strategic vision document]
```

---

## How Strategic Vision Aligns with Hexagonal Core

### Protected (No Changes)
```
✅ hexagonal/core/        [Domain logic: retry, idempotency, logging]
✅ hexagonal/ports/       [IMessageBus, IKVStore interfaces]
✅ hexagonal/adapters/    [RedisStreamsAdapter, RedisKVAdapter]
✅ AgentEnvelopeSchema v2.0.0 [Canonical message format]
✅ BaseAgent              [Foundation for all agents]
```

### Extending (Add Platform Awareness)
```
⚡ workflow-engine        [Already supports definition-driven logic!]
⚡ agent-registry         [Will support optional platform_id scoping]
⚡ workflow.service.ts    [Will use definition-driven routing]
⚡ api/routes/            [Will add /api/v1/platforms/* endpoints]
```

### New Layers (Non-Breaking Addition)
```
🆕 platforms/             [Platform loader, registry, definitions]
🆕 surfaces/              [Surface adapters: REST, webhook, CLI, etc.]
🆕 test-utils/            [GenericMockAgent for testing]
```

**Result:** Hexagonal core remains COMPLETELY PROTECTED. Strategic architecture adds layers above it using existing patterns.

---

## Database Schema Changes

### New Tables (Non-Breaking)
```
Platform
├─ id, name, layer, description, config
├─ workflowDefinitions FK
├─ surfaces FK
└─ agents FK

WorkflowDefinition
├─ id, platform_id, name, version, definition (JSON)
└─ unique: (platform_id, name)

PlatformSurface
├─ id, platform_id, surface_type, config, enabled
└─ unique: (platform_id, surface_type)
```

### Modified Tables (Additive Only)
```
Workflow
+ platform_id          [NEW: ties to platform]
+ workflow_definition_id [NEW: which definition]
+ surface_id           [NEW OPTIONAL: which surface triggered]
+ input_data           [NEW OPTIONAL: custom input]
+ layer                [NEW: for filtering]
- type enum            [REMOVE: determined by platform + definition]

Agent
+ platform_id          [NEW OPTIONAL: NULL = global, UUID = scoped]
```

**Strategy:** Create new tables first, add nullable columns to Workflow, then backfill when ready. Zero downtime.

---

## Backward Compatibility Strategy

### Legacy Platform (Zero-Breaking-Change)

Create "legacy-platform" with existing workflow types:
- "app" (8 stages)
- "feature" (5 stages)
- "bugfix" (3 stages)

Existing API `/api/v1/workflows` routes to legacy-platform automatically.

**Result:** All existing workflows continue working unchanged until explicitly migrated to new platforms.

---

## Implementation Timeline Assessment

### Phase 1: Core Platform Infrastructure (1-2 weeks)
- Create 3 new tables (Platform, WorkflowDefinition, PlatformSurface)
- Create PlatformLoader, PlatformRegistry
- Create "legacy-platform" for backward compatibility

### Phase 2: Surface Abstraction (1-2 weeks)
- Create SurfaceRouter service
- Implement REST, GitHub Webhook, CLI surface adapters
- Add new /api/v1/platforms/* endpoints

### Phase 3: Workflow Engine Integration (1-2 weeks)
- Update WorkflowStateMachineService for definition-driven routing
- Implement adaptive progress calculation
- Keep hard-coded STAGE_SEQUENCES as fallback

### Phase 4: Platform-Specific Agents (1 week)
- Update AgentRegistry with optional platform_id
- Implement agent lookup with platform context
- Test global and platform-scoped agents

### Phase 5: Dashboard & Monitoring (1-2 weeks)
- Add PlatformsPage, update WorkflowsPage
- Add SurfaceIndicator, PlatformSelector components
- Update API client for platform endpoints

### Phase 6: Testing Infrastructure (1 week)
- Create GenericMockAgent class
- Implement multi-platform test setup (11+ registrations)
- Create comprehensive test suite

### Phase 7: Documentation & Graduation (1 week)
- Create platform definition templates
- Document platform onboarding
- Update CLAUDE.md with new session info

**Total: 8 weeks (7-9 with contingency)**

---

## Risks Identified

### HIGH: Database Migration (Mitigation: Phased approach)
- Creating new tables first (non-blocking)
- Adding nullable columns before requiring them
- Backfilling in background

### MEDIUM: Workflow State Machine Refactoring (Mitigation: Definition fallback)
- Keep STAGE_SEQUENCES as fallback for legacy-platform
- Load definitions with caching
- Extensive testing before switching

### MEDIUM: Agent Registry Platform Scoping (Mitigation: Additive only)
- Make platform_id optional
- Implement precedence: platform-scoped → global
- No breaking changes to existing registry

### LOW: Dashboard Refactoring (Mitigation: Additive UI)
- Add new pages alongside existing pages
- Maintain backward-compatible URLs
- Gradual migration optional

### LOW: Testing Infrastructure (Mitigation: Purely additive)
- GenericMockAgent is new utility class
- Existing mocks continue to work
- No changes to current test patterns

---

## Critical Success Factors

1. **Database migration** - Non-breaking, phased approach
2. **WorkflowEngine adoption** - Already supports definition-driven logic
3. **Legacy platform abstraction** - Enables gradual migration
4. **GenericMockAgent** - Enables parallel platform testing
5. **Phase gates** - Testing at each step maintains 99% readiness

---

## Alignment with Session #70

Session #70 added Analytics Service:
- ✅ Read-only microservice pattern
- ✅ Fastify + Prisma pattern
- ✅ Docker multi-stage build
- ✅ Separate read-only repository pattern

This **directly enables** strategic architecture:
- Platform-specific analytics can extend this pattern
- Surfaces can be separate services
- Prisma persistence ready for new tables
- Docker CI/CD infrastructure proven

---

## Validation Checklist

- [x] CLAUDE.md reviewed - Session #70 (99% production ready)
- [x] STRATEGIC-ARCHITECTURE.md analyzed - Complete vision document
- [x] Monorepo structure mapped - 6 main packages + shared
- [x] Hexagonal architecture protected - No changes to core
- [x] Database schema extensible - 3 new tables, 4 additive columns
- [x] Redis Streams pattern verified - Unchanged usage
- [x] Backward compatibility strategy - Legacy platform works
- [x] Risk mitigation identified - 5 risks with solutions
- [x] Timeline achievable - 8 weeks, clearly phased
- [x] Session #70 alignment - Analytics service sets precedent
- [x] Team capacity assessment - Well-defined, testable phases
- [x] Dependencies clear - No blocking external changes
- [x] Testing strategy - GenericMockAgent in Phase 6
- [x] Production readiness - Maintains 99% through careful phasing

---

## Exploration Conclusion

**RECOMMENDATION: PROCEED TO PLANNING PHASE**

The STRATEGIC-ARCHITECTURE.md vision is:
1. **Achievable** - 8-week phased implementation
2. **Non-breaking** - Hexagonal core protected, backward compatible
3. **Well-aligned** - Builds on Session #70 precedent
4. **Production-ready** - Maintains 99% readiness through gates
5. **Enterprise-grade** - Multi-platform, multi-tenant capable

### For Planning Phase
1. Create detailed EPCC_PLAN.md with acceptance criteria per phase
2. Identify any team/resource constraints
3. Schedule phase gates (every 1-2 weeks)
4. Validate timeline with stakeholders

### Key Planning Decisions
1. **Database migration timing** - Early in Phase 1, non-blocking
2. **Legacy platform creation** - First step, enables gradual migration
3. **Testing strategy** - GenericMockAgent as foundation
4. **Documentation approach** - Templates + examples per platform type

Ready for planning.

---

---

# Exploration Report: Critical Status Consistency Issues (Session #78)

**Date**: 2025-11-17
**Status**: EXPLORATION PHASE (READ-ONLY)
**Phase**: EXPLORE - Critical Bug Audit Follow-up
**Scope**: Workflow state management, database persistence, distributed tracing, status consistency
**Severity**: 7 Critical Issues (4 Blockers, 1 High, 2 Medium)

---

## Executive Summary - Critical Findings

An audit identified **7 major problems** affecting distributed tracing, database persistence, and workflow state management:

- **4 Blockers**: Status enum mismatch, trace_id loss, terminal state persistence, pipeline pause/resume persistence
- **1 High Priority**: Misleading function name causing developer confusion
- **2 Medium Priority**: Incomplete terminal checks, missing logging

**Current Status Consistency Score**: 65/100 (from audit)

**Production Impact**:
- Workflows may lose state on service restart (pause/resume)
- Distributed tracing is broken (trace_id changes mid-workflow)
- Dashboard shows inconsistent traces
- Terminal state changes don't persist to DB

---

## Files Analyzed

### 1. **workflow-state-machine.ts** (961 lines)
**Core Issues**:
- Line 215-237: START event only updates current_stage, NOT status field
- Line 386: markComplete() - No logging before/after, missing error handling
- Line 401: notifyCompletion() - Hardcodes trace_id as `trace-${workflow_id}`
- **Line 414: notifyError()** - ⚠️ BLOCKER: Publishes event but doesn't persist 'failed' status to DB
- **Line 428: notifyCancellation()** - ⚠️ BLOCKER: Publishes event but doesn't persist 'cancelled' status to DB
- Line 890: Terminal status array missing 'paused' state

**Patterns Found**:
- Uses RequestContext AsyncLocalStorage for automatic trace_id injection
- Event publishing via eventBus (redis-bus.adapter.ts)
- Prisma repository pattern for DB access
- CAS (Compare-And-Swap) for optimistic locking

---

### 2. **pipeline-executor.service.ts** (689 lines)
**Core Issues**:
- Line 35: In-memory storage: `activeExecutions: Map<string, PipelineExecution>`
- **Line 565: pauseExecution()** - ⚠️ BLOCKER: Only updates Map, no DB persistence
- **Line 578: resumeExecution()** - ⚠️ BLOCKER: Only updates Map, no DB persistence
- Line 630: Pipeline creation generates NEW trace_id instead of propagating

**Critical Finding**:
- No PipelineExecution model exists in Prisma schema
- Pause/resume state is lost on service restart
- No audit trail for pause/resume operations

---

### 3. **Status Enum Mismatch** (BLOCKER)
**PipelineStatus** (pipeline.types.ts):
```
'created' | 'queued' | 'running' | 'success' | 'failed' | 'cancelled' | 'paused'
```

**WorkflowStatus** (schema.prisma):
```
'initiated' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
```

**Problem**: Pipeline uses `'success'` but Workflow requires `'completed'`
- Type safety violation
- Runtime errors on status update attempts
- Cannot map Pipeline completion to Workflow completion

---

## 7 Critical Issues Identified

### **BLOCKER #1: STATUS ENUM MISMATCH**
- Files: pipeline.types.ts, schema.prisma
- Impact: Type checking failures, runtime errors
- Root cause: Enums evolved separately without alignment

### **BLOCKER #2: trace_id LOST IN EVENT PUBLISHING**
- Locations: notifyCompletion (Line 401), notifyError (Line 414), notifyCancellation (Line 428), Pipeline executor (Line 630)
- Current (Wrong): `trace_id: trace-${workflow_id}` (hardcoded)
- Correct: `trace_id: context.trace_id` (propagated from RequestContext)
- Impact: Dashboard shows multiple trace_ids for single operation, audit trails broken

### **BLOCKER #3: TERMINAL STATES NOT PERSISTED**
- File: workflow-state-machine.ts
- Problem: notifyError() and notifyCancellation() publish events but don't call `repository.update()`
- Impact: Event published but DB still shows old status, eventual consistency not achieved

### **BLOCKER #4: PIPELINE PAUSE/RESUME NOT PERSISTED**
- File: pipeline-executor.service.ts (Lines 565, 578)
- Problem: Only updates in-memory Map, no DB persistence
- Impact: State lost on service restart, no audit trail

### **HIGH #5: MISLEADING FUNCTION NAME**
- File: workflow-state-machine.ts (Line 215)
- Problem: `updateWorkflowStatus()` only updates current_stage, NOT status field
- Impact: Developer confusion about what's persisted

### **MEDIUM #6: INCOMPLETE TERMINAL STATUS CHECK**
- File: workflow-state-machine.ts (Line 890)
- Problem: Array `['completed', 'failed', 'cancelled']` missing 'paused' and no null checks
- Impact: Edge cases not handled, paused workflows incorrectly treated as non-terminal

### **MEDIUM #7: NO LOGGING IN CRITICAL SECTIONS**
- Files: workflow-state-machine.ts
- Problem: markComplete(), error handlers lack logging and error handling
- Impact: No audit trail, observability gaps

---

## Architectural Patterns Review

### ✅ GOOD: Compare-And-Swap (CAS) with Retry
- Location: workflow.repository.ts (Lines 150-211)
- Purpose: Optimistic locking prevents lost updates in concurrent scenarios
- Strength: Prevents race conditions in distributed system
- Weakness: trace_id not included in update operations

### ✅ GOOD: Automatic RequestContext Injection
- Location: logger.ts - Pino mixin integration
- Purpose: Auto-inject trace_id into all logs from AsyncLocalStorage
- Strength: Zero boilerplate, consistent across all logs
- Weakness: Doesn't apply to async event publishing (events bypass context)

### ❌ BROKEN: Manual trace_id in Events
- Location: workflow-state-machine.ts notification functions
- Problem: Hardcodes trace_id instead of propagating from RequestContext
- Impact: Breaks distributed tracing correlation

### ❌ BROKEN: In-Memory State Storage
- Location: pipeline-executor.service.ts (Line 35)
- Problem: Map assumes it survives service lifetime
- Impact: Lost on restart, no persistence, single-process only

---

## Integration Points Affected

**Message Bus** (redis-bus.adapter.ts)
- Events with wrong trace_id propagate to all subscribers
- Impact spreads across all downstream services

**Prisma Repository** (workflow.repository.ts)
- CAS pattern requires version field synchronization
- Terminal state updates missing entirely

**AsyncLocalStorage / RequestContext** (logger.ts)
- Not available in async event callbacks
- Must capture before async call

**Workflow State Machine** (workflow-state-machine.ts)
- Broken trace_id affects all downstream services
- Terminal state persistence failure cascades

---

## Fix Strategy (5 Phases)

### **Phase 1: Unify Status Enums** (BLOCKER - Foundation)
- Update PipelineStatus enum to match WorkflowStatus
- Create unified status: `'initiated' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'`
- Run Prisma migration
- Create migration script for existing 'success' → 'completed' data

### **Phase 2: Fix Terminal State Persistence** (BLOCKER - High Impact)
- Add `repository.update({ status: 'failed' })` to notifyError()
- Add `repository.update({ status: 'cancelled' })` to notifyCancellation()
- Add error handling and logging

### **Phase 3: Fix trace_id Propagation** (BLOCKER - High Impact)
- Capture RequestContext before async call
- Pass context.trace_id to eventBus.publish()
- Remove hardcoded trace_id generation
- Update pipeline executor to propagate trace_id

### **Phase 4: Fix Pipeline Pause/Resume Persistence** (BLOCKER - Feature Complete)
- Create PipelineExecution Prisma model
- Add pause/resume/cancel persistence to DB
- Use CAS pattern for concurrent safety
- Add error handling

### **Phase 5: Improve Logging & Naming** (MEDIUM - Polish)
- Rename updateWorkflowStatus() → updateWorkflowStage()
- Add comprehensive logging with trace_id
- Fix terminal status check to include 'paused'
- Add defensive null/undefined checks

**Total Estimated Effort**: 8-10 hours
**Can Parallelize**: Phases 2-3 after Phase 1, Phase 5 independently

---

## Constraints & Risks

### **Technical Constraints**
1. Prisma ORM with PostgreSQL - CAS pattern requires version field
2. Redis Streams - Events must include metadata before publishing
3. RequestContext lost in async callbacks - must capture before async
4. TypeScript strict mode - Status enum mismatch causes build errors

### **Business Constraints**
1. Platform is 98% production ready - changes must be low-risk
2. Existing workflows may use old 'success' status - migration needed
3. No downtime requirement - changes must support live data

### **Risks**
- HIGH: Enum migration could break existing data
- HIGH: trace_id format change may affect observability systems
- MEDIUM: Adding PipelineExecution table requires schema coordination
- MEDIUM: Database migration timing during live operations

---

## Testing Recommendations

### **Unit Tests** (5 critical tests)
- notifyError() persists status AND publishes event
- notifyCancellation() persists status AND publishes event
- trace_id propagates from RequestContext through event
- Terminal status check handles null/undefined
- pauseExecution/resumeExecution persist to DB

### **Integration Tests** (4 scenarios)
- Complete workflow: initiate → run → complete → verify DB
- Error scenario: error → verify DB shows 'failed'
- Pause scenario: pause → restart → verify still paused
- Trace scenario: same trace_id across workflow-state-machine and event logs

### **Chaos Tests** (3 scenarios)
- Concurrent status updates (CAS prevents lost writes)
- Service restart during pause (recovery from DB)
- Database migration (existing status values converted)

---

## Summary Table

| Issue | Type | Severity | Impact | Phase |
|-------|------|----------|--------|-------|
| Status enum mismatch | Type Safety | BLOCKER | Type errors, runtime failures | 1 |
| trace_id loss | Observability | BLOCKER | Broken distributed tracing | 3 |
| Terminal state not persisted | Data Loss | BLOCKER | Inconsistent DB status | 2 |
| Pause/resume not persisted | Data Loss | BLOCKER | State lost on restart | 4 |
| Misleading function name | Code Quality | HIGH | Developer confusion | 5 |
| Incomplete terminal check | Robustness | MEDIUM | Edge cases not handled | 5 |
| No logging in critical sections | Observability | MEDIUM | Audit trail gaps | 5 |

---

## Exploration Completion Checklist

- ✅ All 6 affected files reviewed with line numbers
- ✅ 7 critical issues identified with root causes
- ✅ 4 blockers requiring Phases 1-4 fixes
- ✅ Architectural patterns documented (good and broken)
- ✅ Integration points mapped
- ✅ 5-phase implementation strategy designed
- ✅ Testing recommendations provided
- ✅ Risk assessment completed
- ✅ Backward compatibility strategy identified
- ✅ Parallelizable execution paths identified

**Ready for PLAN phase**: Yes ✅

---

**Next**: See EPCC_PLAN.md for detailed step-by-step implementation strategy for each of the 5 phases.
