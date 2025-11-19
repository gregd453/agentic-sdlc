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

---

---

# Exploration Report: Mock Workflow Management UI Design

**Date:** 2025-11-19 | **Session:** EPCC Explore Phase | **Status:** Complete

**Task:** Review all aspects of mock agent workflows and their configurations and methods for starting workflows. Design a user interface for the dashboard that enables end users to define, create and run mock workflows and agents for testing that they can then monitor in the dashboard.

---

## Executive Summary

This exploration focuses on designing a user interface for the dashboard that enables end users to:
1. Define mock workflows with customizable behaviors
2. Create and run mock workflows and agents for testing
3. Monitor workflow execution in real-time
4. Visualize trace hierarchies and test results

**Current State:** The agentic-sdlc platform is production-ready (Phase 7B complete, Session #80) with:
- Fully functional mock agent system with metadata-driven behavior control
- 7 PM2 services (orchestrator, 5 agents, dashboard)
- Distributed tracing infrastructure (trace_id, span hierarchy)
- Dashboard UI for workflow/trace monitoring (functional but limited for mock creation)
- Comprehensive test infrastructure using behavior metadata presets

**Key Finding:** The foundation for mock workflow management already exists. The system supports:
- GenericMockAgent with BEHAVIOR_SAMPLES (success, failure, timeout, crash, partial_success)
- Behavior metadata-driven test scenarios
- Full workflow state machine with distributed tracing
- REST API for workflow creation and querying
- React dashboard with routing and data fetching hooks

**Design Opportunity:** Create a new dashboard section that abstracts away the complexity of behavior metadata and provides a visual workflow builder interface.

---

## 1. MOCK AGENT WORKFLOWS & CONFIGURATIONS

### 1.1 Mock Agent System

**Location:** `packages/agents/generic-mock-agent/src/generic-mock-agent.ts`

The GenericMockAgent is the backbone of testing infrastructure:
- **Flexible Design:** Supports all agent types (scaffold, validation, e2e_test, integration, deployment)
- **Platform-Aware:** Optional platform context for multi-platform testing
- **Metadata-Driven:** Behavior controlled via metadata without code changes
- **Configurable Delays:** Simulates realistic execution timing
- **Failure Injection:** Support for success/failure/timeout/crash/partial scenarios

### 1.2 Behavior Metadata System (Key to Mock Testing)

**Primary Reference:** `packages/agents/generic-mock-agent/BEHAVIOR_METADATA_GUIDE.md` (556 lines, Session #77)

**Available Execution Modes:**

1. **success** - Normal completion
2. **failure** - Agent failure with customizable error codes
3. **timeout** - Timeout simulation
4. **partial** - Partial success (e.g., 8/10 tests pass)
5. **crash** - Agent crash simulation

**Behavior Presets (BEHAVIOR_SAMPLES):**
```typescript
{
  success: { mode: 'success' },
  fast_success: { mode: 'success', delay_ms: 10 },
  slow_success: { mode: 'success', delay_ms: 5000 },
  validation_error: { mode: 'failure', error_code: 'VALIDATION_ERROR' },
  deployment_failed: { mode: 'failure', error_code: 'DEPLOYMENT_FAILED' },
  unrecoverable_error: { mode: 'failure', error_code: 'FATAL_ERROR', retryable: false },
  timeout: { mode: 'timeout', trigger_delay_ms: 5000 },
  tests_partial_pass: { mode: 'partial', output: { tests_passed: 8, tests_run: 10 } },
  high_resource_usage: { mode: 'success', duration_ms: 30000, memory_mb: 500 },
  crash: { mode: 'crash' }
}
```

**Location:** `packages/shared/types/src/messages/agent-behavior.ts`

### 1.3 Behavior Executor

**Location:** `packages/agents/generic-mock-agent/src/behavior-executor.ts`

Implements behavior execution logic, handling result generation and metric customization.

---

## 2. WORKFLOW STARTING METHODS

### 2.1 API Endpoint: POST /api/v1/workflows

**File:** `packages/orchestrator/src/api/routes/workflow.routes.ts`

**Request Format:**
```json
POST /api/v1/workflows
{
  "name": "string (required)",
  "type": "app|feature|bugfix (required)",
  "priority": "low|medium|high|critical (required)",
  "description": "string (optional)",
  "platform_id": "uuid (optional)"
}
```

**Returns:** Workflow object with trace_id for distributed tracing.

### 2.2 Dashboard Hook: useWorkflowCreation()

**File:** `packages/dashboard/src/hooks/useWorkflowCreation.ts`

Manages form state and API submission with automatic navigation.

### 2.3 Workflow Service: createWorkflow()

**File:** `packages/orchestrator/src/services/workflow.service.ts`

**Execution Steps:**
1. Generate UUID for workflow_id and trace_id (Session #60)
2. Create workflow record in PostgreSQL
3. Emit WORKFLOW_CREATED event
4. Transition to START state in state machine
5. Create first task via buildAgentEnvelope()

### 2.4 Workflow State Machine

**File:** `packages/orchestrator/src/state-machine/workflow-state-machine.ts`

**States:** initiated → running → evaluating → completed/failed/paused/cancelled

**Events:** START, STAGE_COMPLETE, STAGE_FAILED, PAUSE, RESUME, CANCEL, RETRY

### 2.5 buildAgentEnvelope(): Canonical Task Pattern

**File:** `packages/orchestrator/src/services/workflow.service.ts` (lines ~1135-1300)

**Purpose:** Canonical producer of AgentEnvelopeSchema v2.0.0 for task assignment

**Generated Fields:**
- Identification: message_id, task_id, workflow_id
- Routing: agent_type
- Execution Control: priority, status, constraints (timeout, max_retries)
- Payload: agent-specific data
- Distributed Tracing: trace_id, span_id, parent_span_id
- Workflow Context: workflow_type, current_stage, stage_outputs, platform_id

---

## 3. EXISTING DASHBOARD UI FOR WORKFLOW MANAGEMENT

### 3.1 Dashboard Pages

**Dashboard.tsx** - Overview with metrics and running workflows list

**WorkflowsPage.tsx** - Table with Name | Type | Status | Stage | Progress | Trace ID | Actions
- Filters: Status, Type
- Progress bars showing completion %
- Links to trace/workflow detail pages

**WorkflowPage.tsx** - Single workflow detail
- Metadata cards: ID, Type, Priority, Current Stage, Trace ID
- Progress bar with stage labels
- Tasks table with Agent | Status | Assigned | Retries | Duration
- Events log placeholder

**TracesPage.tsx** - Distributed traces list
- Search by trace ID
- Filter by status
- Pagination with configurable size

**TraceDetailPage.tsx** (Session #80) - Trace hierarchical view
- Summary: ID, Status, Start time, Duration
- Key metrics: Workflows, Tasks, Spans, Errors
- Workflows and Spans tables

### 3.2 Routing Structure

```
/                    → Dashboard
/workflows           → Workflows List
/workflows/:id       → Workflow Detail
/traces              → Traces List
/traces/:traceId     → Trace Detail
```

### 3.3 Data Fetching Hooks

**Location:** `packages/dashboard/src/hooks/`

- `useWorkflows()` - List with filters (5s refetch)
- `useWorkflow()` - Single workflow with polling
- `useWorkflowTasks()` - Tasks for workflow (5s refetch, Session #82)
- `useTraces()` - Traces with pagination and filtering
- `useTrace()` - Single trace details
- `useWorkflowCreation()` - Form state and submission

All use TanStack React Query with 5s refetch intervals.

### 3.4 API Client

**File:** `packages/dashboard/src/api/client.ts`

**Base URL:** `http://localhost:3051/api/v1`

**Key Endpoints:**
```
GET    /workflows?status=&type=&limit=&offset=
GET    /workflows/:id
GET    /workflows/:id/tasks
POST   /workflows
GET    /traces
GET    /traces/:traceId
```

---

## 4. MOCK DATA AND TEST SCENARIO SYSTEM

### 4.1 Workflow Test Definitions

Examples of mock workflow JSON definitions for testing (feature, app, bugfix types).

### 4.2 E2E Pipeline Tests

**File:** `packages/orchestrator/src/__tests__/services/phase-6-e2e-pipelines.test.ts`

**Test Scenarios:**
- Feature Workflow (5 stages)
- App Workflow (8 stages)
- Bugfix Workflow (3 stages)
- Platform-specific pipelines

All use GenericMockAgent with behavior metadata presets.

### 4.3 Behavior Metadata Test Patterns

**Pattern Examples:**

1. Happy Path: `{ behavior_metadata: BEHAVIOR_SAMPLES.success }`
2. Failure Injection: `{ behavior_metadata: BEHAVIOR_SAMPLES.validation_error }`
3. Partial Success: `{ behavior_metadata: BEHAVIOR_SAMPLES.tests_partial_pass }`
4. Timeout: `{ behavior_metadata: BEHAVIOR_SAMPLES.timeout }`
5. Custom: Custom mode with output and metrics override

### 4.4 Mock Factory Functions

**Locations:**
- `packages/agents/deployment-agent/src/__tests__/mock-factories.ts`
- `packages/agents/integration-agent/src/__tests__/mock-factories.ts`

---

## 5. RELATED INFRASTRUCTURE

### 5.1 Database Persistence

**Repository:** `packages/orchestrator/src/repositories/workflow.repository.ts`

**Tables:** workflows, tasks, spans, traces, trace_metadata

**Database:** PostgreSQL (localhost:5433, user: agentic)

### 5.2 Redis Message Bus (CANONICAL - DO NOT DUPLICATE)

**Adapter:** `packages/orchestrator/src/hexagonal/adapters/redis-bus.adapter.ts`

**Connection:** Redis localhost:6380

**Channels:** orchestrator:tasks, orchestrator:results, orchestrator:events

**Pattern:** Redis Streams with consumer groups for reliability.

### 5.3 Status Enums (Session #79 Unified)

**File:** `packages/shared/types/src/core/schemas.ts`

```typescript
type PipelineStatus = 'initiated' | 'running' | 'completed' | 'failed' | 'paused' | 'cancelled'
type TaskStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
```

### 5.4 AgentEnvelopeSchema v2.0.0 (CANONICAL - DO NOT DUPLICATE)

**Location:** `packages/shared/types/src/messages/agent-envelope.ts`

All messages validated against this schema. Contains:
- message_id, task_id, workflow_id
- agent_type, priority, status, constraints
- payload, trace context, workflow_context

### 5.5 Trace Routes API

**File:** `packages/orchestrator/src/api/routes/trace.routes.ts`

**Endpoints:**
```
GET /api/v1/traces
GET /api/v1/traces/:traceId
GET /api/v1/traces/:traceId/spans
GET /api/v1/traces/:traceId/workflows
GET /api/v1/traces/:traceId/tasks
```

### 5.6 Workflow Routes API

**File:** `packages/orchestrator/src/api/routes/workflow.routes.ts`

**Endpoints:**
```
POST /api/v1/workflows
GET /api/v1/workflows
GET /api/v1/workflows/:id
POST /api/v1/workflows/:id/cancel
POST /api/v1/workflows/:id/retry
```

---

## 6. ARCHITECTURE PATTERNS & CRITICAL CONSTRAINTS

### 6.1 Canonical Files (DO NOT DUPLICATE)

1. `packages/shared/types/src/messages/agent-envelope.ts` - Schema v2.0.0
2. `packages/orchestrator/src/hexagonal/adapters/redis-bus.adapter.ts` - Message bus
3. `packages/agents/base-agent/src/base-agent.ts` - Base agent class
4. `packages/shared/types/src/messages/agent-behavior.ts` - Behavior schema

### 6.2 Import Rules

**CORRECT:** `import { AgentEnvelopeSchema } from '@agentic-sdlc/shared-types';`

**WRONG:** `import { ... } from '@agentic-sdlc/shared-types/src/...';`

### 6.3 Message Bus Pattern

All message publishing/subscription via `redis-bus.adapter.ts` (CRITICAL - DO NOT DUPLICATE).

### 6.4 Distributed Tracing (Session #60, #65)

- Trace initiated at workflow creation: `trace_id = generateTraceId()`
- Each task creates span: `span_id = generateSpanId()`
- Parent-child relationships via `parent_span_id`
- All envelopes carry trace context
- Spans persisted with entity_type and duration

### 6.5 Workflow State Machine Pattern

Single point of state transitions with automatic task creation on completion.

---

## 7. CURRENT LIMITATIONS & OPPORTUNITIES

### 7.1 Current Dashboard Limitations

1. **No Mock Workflow Builder**
   - Users cannot visually create mock workflows with behavior metadata
   - Requires API knowledge to send POST /workflows
   - No UI for defining behavior metadata

2. **No Behavior Metadata Editor**
   - Complex JSON structure not abstracted into UI
   - No presets selection (easy way to pick BEHAVIOR_SAMPLES)

3. **Limited Test Scenario Creation**
   - Creating multi-stage test scenarios requires manual definition
   - No visual pipeline builder

4. **No Workflow Template System**
   - Users must recreate workflows manually
   - No saved templates for common scenarios

5. **Trace Visualization is One-Directional**
   - Can view traces created by workflows
   - Cannot trigger workflows specifically for tracing/debugging

### 7.2 Design Opportunities

1. **Mock Workflow Builder**
   - Visual form to create workflows
   - Behavior preset selector
   - Custom behavior editor for advanced scenarios

2. **Behavior Metadata Configurator**
   - Dropdown for BEHAVIOR_SAMPLES presets
   - Custom mode selection with relevant fields
   - Live preview of behavior impact

3. **Multi-Stage Workflow Designer**
   - Visual pipeline editor
   - Drag-drop stages with behavior assignment
   - Per-stage failure injection

4. **Workflow Templates**
   - Pre-built templates (Happy Path, Error Recovery, Load Test)
   - Save custom workflows as templates

5. **Enhanced Trace Debugging**
   - Link workflows to traces for investigation
   - Filter traces by workflow type/status

---

## 8. KEY TECHNOLOGY STACK

- **Frontend:** React 19 + TypeScript + React Router v6
- **State Management:** TanStack React Query + React Hook Form
- **Styling:** Tailwind CSS + Shadcn/ui components
- **Backend:** Node.js/TypeScript + Express
- **Database:** PostgreSQL
- **Message Bus:** Redis Streams
- **Build:** Turbo + pnpm workspaces (21 packages)
- **Process Management:** PM2 (7 services)

---

## 9. RECOMMENDATIONS FOR UI DESIGN

### 9.1 Phased Implementation Approach

**Phase 1 (MVP - Quick Win):** Simple workflow creation + behavior preset selection
- Add "Create Mock Workflow" button
- Simple form: Name + Type + Priority + Behavior Preset
- Map BEHAVIOR_SAMPLES to radio buttons

**Phase 2 (Medium):** Behavior metadata editor
- Advanced form for custom configurations
- Conditional fields based on selected mode
- Preview section

**Phase 3 (Higher):** Multi-stage workflow builder
- Visual pipeline editor
- Per-stage behavior assignment
- Platform-specific templates

**Phase 4 (Polish):** Templates & management
- Template library
- Clone workflows for testing variations

### 9.2 Design Principles

1. **Abstraction Over Complexity**
   - Hide AgentEnvelopeSchema complexity
   - Behavior metadata → Simple dropdowns/toggles
   - Advanced options for power users

2. **Visual Feedback**
   - Show what stages will run
   - Preview behavior impact
   - Real-time validation

3. **Progressive Disclosure**
   - Basic workflow creation in main UI
   - Advanced behavior editor in modal
   - Custom JSON editor for power users

4. **Consistency**
   - Reuse existing components
   - Match current routing pattern
   - Use same data fetching hooks pattern

### 9.3 Suggested UI Structure

```
Dashboard / Workflows Page
├── Existing Workflows List
├── [NEW] "Create Mock Workflow" Button
│   └── Modal: Simple Workflow Creation
│       ├── Name input
│       ├── Type selector
│       ├── Priority selector
│       ├── Behavior preset (radio)
│       ├── [Advanced] Custom behavior editor
│       └── Create button
│
└── Enhanced Workflow Detail Page
    ├── Existing metadata + progress
    ├── Tasks table
    └── [NEW] "Re-run with different behavior"
```

### 9.4 Integration Points

**Existing APIs to Leverage:**
- `POST /api/v1/workflows`
- `GET /api/v1/workflows`
- `GET /api/v1/workflows/:id`
- `GET /api/v1/traces/:traceId`

**New API Endpoints (Optional):**
- `POST /api/v1/workflows/:id/clone`
- `POST /api/v1/workflows/templates`

---

## 10. CRITICAL SUCCESS FACTORS

### 10.1 Must-Haves

1. **Behavior Metadata Abstraction** - Users shouldn't know about AgentEnvelopeSchema
2. **Real-Time Monitoring Integration** - Workflows appear in list within 5s
3. **Error Handling** - Clear error messages and retry mechanisms
4. **Performance** - Form validation < 100ms, API submission < 5s

### 10.2 Avoid These Mistakes

1. ❌ Do NOT duplicate AgentEnvelopeSchema or BEHAVIOR_SAMPLES
2. ❌ Do NOT create new packages or break monorepo structure
3. ❌ Do NOT skip distributed tracing (trace_id propagation)
4. ❌ Do NOT add synchronous API calls in React components
5. ❌ Do NOT break existing routing or data fetching patterns
6. ❌ Do NOT create custom message bus logic

---

## 11. EXPLORATION COMPLETION CHECKLIST

- [x] Mock agent system (GenericMockAgent) reviewed
- [x] Behavior metadata system thoroughly explored
- [x] Behavior presets catalogued (success/failure/timeout/crash/partial)
- [x] Workflow creation API and hooks reviewed
- [x] Existing Dashboard UI mapped
- [x] Data fetching patterns understood
- [x] Status enum consistency verified
- [x] API client and routing structure documented
- [x] All critical files and patterns identified
- [x] Constraints and opportunities identified
- [x] Architecture patterns and design principles documented

---

## EXPLORATION SUMMARY

### What We Learned

The agentic-sdlc platform has a **complete foundation** for mock workflow management:

1. **GenericMockAgent** - Fully functional mock agent with behavior metadata
2. **Behavior Metadata System** - Flexible, preset-based test scenarios
3. **Workflow State Machine** - Reliable state management with auto-progression
4. **Distributed Tracing** - Full trace hierarchy support
5. **React Dashboard** - Functional monitoring with routing and polling
6. **REST API** - Complete workflow and trace endpoints

### Design Opportunity

Create a **user-friendly UI** that abstracts behavior metadata complexity and provides:
1. Visual workflow builder
2. Behavior preset selector
3. Test scenario templates
4. Real-time monitoring integration

### Implementation Path

**Phase 1 (MVP):** Form + preset selector (quick win)
**Phase 2:** Behavior editor + preview
**Phase 3:** Pipeline builder + templates
**Phase 4:** Advanced features

All building on existing APIs without duplicating canonical code.

---

**Next Steps:** Proceed to PLAN phase to design detailed implementation approach.

**Exploration Date:** 2025-11-19 | **Created by:** Claude Code (EPCC Explore) | **Status:** Complete & Ready for Planning
