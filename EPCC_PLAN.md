# EPCC Implementation Plan: React Monitoring Dashboard

**Status:** Ready to Implement
**Created:** 2025-11-13
**Updated:** 2025-11-13 (Session #61 - Comprehensive Analysis)
**Estimated Duration:** 15-20 hours (broken into 5 phases)
**Priority:** HIGH
**Owner:** Development Team

---

## Overview

### Objective

Build a production-ready React monitoring dashboard for the Agentic SDLC system that provides:
- Real-time visibility into workflow execution
- Distributed tracing visualization
- Agent performance metrics
- Interactive data filtering and search
- Responsive UI with TailwindCSS

### Current Status

**✅ COMPLETED:**
- Package structure created (`packages/dashboard/`)
- Dependencies installed (React, Vite, TailwindCSS, Recharts, React Query)
- Basic routing configured (App.tsx with 6 routes)
- Common components scaffolded (StatusBadge, LoadingSpinner, ErrorDisplay, ProgressBar)
- E2E test suite created (11 tests, 4 failing due to missing content)
- Build configuration (Vite, TypeScript, Playwright)
- Some API route files exist (stats.routes.ts, task.routes.ts, trace.routes.ts) but NOT WIRED UP

**❌ MISSING:**
- **CRITICAL:** Backend API routes NOT registered in server.ts (routes exist but not accessible)
- Backend service implementations (stats.service.ts, trace.service.ts, task.service.ts may be incomplete)
- Frontend page implementations (Dashboard, WorkflowsPage, WorkflowPage mostly empty)
- Data visualization components (charts, trace trees, timelines)
- API client integration (client.ts has stubs, needs implementation)
- Real-time data polling

**🔍 E2E TEST RESULTS:**
```
4 failed tests (missing UI elements):
  ✗ Dashboard Overview page - no heading, no metrics, no tables
  ✗ Active Workflows table - no content
  ✗ Navigation tests - no page headings
  ✗ Workflows table columns - no table structure

7 passed tests (routing, navigation links, 404 handling):
  ✓ All routes render (routing works)
  ✓ Navigation links clickable
  ✓ 404 page displays
  ✓ Header visible on all pages
  ✓ Active nav link highlighted
  ✓ Page navigation functional
  ✓ Filter controls present

Missing API endpoints causing proxy errors:
  - GET /api/v1/stats/overview (ECONNREFUSED - routes NOT registered!)
  - GET /api/v1/workflows (ECONNREFUSED)
  - GET /api/v1/workflows?status=running (ECONNREFUSED)
  - GET /api/v1/workflows?type=feature (ECONNREFUSED)
```

**ROOT CAUSE:** API route files exist in `packages/orchestrator/src/api/routes/` but are NOT imported and registered in `server.ts`. This is the #1 blocker.

### Why It's Needed

**Business Value:**
- Operators can monitor workflow health and progress in real-time
- Developers can debug failures with distributed trace correlation
- Product teams can track agent performance and SLA metrics
- Reduces MTTR (Mean Time To Resolution) for workflow issues

**Technical Value:**
- Validates distributed tracing implementation (Session #60 work)
- Provides observability into hexagonal architecture
- Enables data-driven optimization of agent performance
- Demonstrates production-readiness of the system

### Success Criteria

- [ ] **Criterion 1:** All 11 E2E tests pass (100% test coverage)
- [ ] **Criterion 2:** Dashboard loads with real data from orchestrator API (< 500ms initial load)
- [ ] **Criterion 3:** Trace visualization shows complete workflow → task → agent hierarchy
- [ ] **Criterion 4:** Real-time updates refresh every 5 seconds (configurable polling)
- [ ] **Criterion 5:** All charts render correctly with mock and real data
- [ ] **Criterion 6:** Mobile-responsive layout works on 768px+ screens
- [ ] **Criterion 7:** Zero TypeScript errors in frontend and backend code
- [ ] **Criterion 8:** API response times < 200ms for list endpoints, < 100ms for stats

### Non-Goals (What We're NOT Doing)

- **Not implementing WebSocket support** (will use polling for now, WebSockets in later phase)
- **Not adding user authentication** (out of scope, assume internal tool)
- **Not building workflow creation UI** (read-only dashboard, use API/CLI for creation)
- **Not implementing custom alerting** (just visualization, alerting is separate)
- **Not optimizing for mobile < 768px** (desktop/tablet only)
- **Not adding export to PDF/Excel** (CSV only for now)

---

## Technical Approach

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    React Dashboard (Port 3001)                │
│  ┌─────────────┬─────────────┬─────────────┬──────────────┐  │
│  │  Dashboard  │  Workflows  │   Traces    │    Agents    │  │
│  │    Page     │    Page     │    Page     │     Page     │  │
│  └──────┬──────┴──────┬──────┴──────┬──────┴──────┬───────┘  │
│         │             │             │             │          │
│         └─────────────┴─────────────┴─────────────┘          │
│                       │                                      │
│               React Query (Client)                           │
│                       │                                      │
│              Vite Dev Server (Proxy)                         │
└───────────────────────┼──────────────────────────────────────┘
                        │ HTTP (proxied)
                        ▼
┌──────────────────────────────────────────────────────────────┐
│              Orchestrator (Port 3000)                         │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Fastify HTTP API Layer                     │ │
│  ├─────────────┬────────────┬────────────┬────────────────┤ │
│  │  Workflow   │   Stats    │   Trace    │     Task       │ │
│  │   Routes    │   Routes   │   Routes   │    Routes      │ │
│  │  (EXISTS)   │  (EXISTS)  │  (EXISTS)  │   (EXISTS)     │ │
│  │    ⚠️       │     ⚠️     │     ⚠️     │      ⚠️        │ │
│  │ NOT WIRED!  │ NOT WIRED! │ NOT WIRED! │  NOT WIRED!    │ │
│  └──────┬──────┴─────┬──────┴─────┬──────┴──────┬─────────┘ │
│         │            │            │             │           │
│  ┌──────▼──────┬─────▼──────┬─────▼──────┬──────▼─────────┐ │
│  │  Workflow   │   Stats    │   Trace    │     Task       │ │
│  │   Service   │  Service   │  Service   │   Service      │ │
│  │  (EXISTS)   │  (VERIFY)  │  (VERIFY)  │   (CREATE)     │ │
│  └──────┬──────┴─────┬──────┴─────┬──────┴──────┬─────────┘ │
│         │            │            │             │           │
│  ┌──────▼──────┬─────▼──────┬─────▼──────┬──────▼─────────┐ │
│  │  Workflow   │   Stats    │   Trace    │     Task       │ │
│  │ Repository  │ Repository │ Repository │  Repository    │ │
│  │  (EXISTS)   │  (VERIFY)  │  (VERIFY)  │   (CREATE)     │ │
│  └──────┬──────┴─────┬──────┴─────┬──────┴──────┬─────────┘ │
│         │            │            │             │           │
└─────────┼────────────┼────────────┼─────────────┼───────────┘
          │            │            │             │
          └────────────┴────────────┴─────────────┘
                        │
                ┌───────▼────────┐
                │  PostgreSQL    │
                │   (Prisma)     │
                │   ✅ READY     │
                └────────────────┘
```

### Hexagonal Architecture Layers

| Layer | Components | Responsibility | Status |
|-------|-----------|----------------|--------|
| **HTTP Adapter** | `*.routes.ts` | Request validation, response formatting | FILES EXIST, NOT REGISTERED |
| **Service Layer** | `*.service.ts` | Business logic, data aggregation | NEEDS VERIFICATION |
| **Repository Layer** | `*.repository.ts` | Database queries, data access | NEEDS VERIFICATION |
| **Core Domain** | Prisma schema | Data models and constraints | ✅ COMPLETE (Session #60) |

### Design Decisions

| Decision | Option Chosen | Rationale |
|----------|--------------|-----------|
| **State Management** | React Query | Built-in caching, polling, error handling; no Redux needed |
| **Routing** | React Router v6 | Standard choice, nested routes support |
| **Styling** | TailwindCSS | Rapid prototyping, consistent design system |
| **Charts** | Recharts | Declarative API, good TypeScript support, customizable |
| **HTTP Client** | Fetch API | Native, no extra dependencies |
| **Polling Strategy** | React Query `refetchInterval` | Built-in, configurable, automatic cleanup |
| **Backend API** | Fastify | Already in use, fast, good plugin system |
| **Database Queries** | Prisma ORM | Already in use, type-safe, migration support |

### Data Flow

```
1. User navigates to /dashboard
   ↓
2. React Router renders Dashboard component
   ↓
3. Component calls useStats() hook
   ↓
4. React Query checks cache → if stale, fetch
   ↓
5. API client: GET /api/v1/stats/overview
   ↓
6. Vite proxy forwards to http://localhost:3000
   ↓
7. ⚠️ CURRENT ISSUE: Route not registered → ECONNREFUSED
   ↓
8. ✅ AFTER FIX: Orchestrator stats.routes.ts receives request
   ↓
9. stats.service.ts aggregates data from repositories
   ↓
10. stats.repository.ts queries PostgreSQL via Prisma
   ↓
11. Response flows back through layers
   ↓
12. React Query caches result, triggers re-render
   ↓
13. Dashboard displays metrics and charts
   ↓
14. After 5s, React Query auto-refetches (polling)
```

---

## Task Breakdown

### Phase 1: Backend API Routes (CRITICAL - 4-5 hours)

**🚨 PRIORITY 1: This must be completed first to unblock frontend development**

#### 1.1: Verify & Register Stats Service (1.5 hours)
**Package:** `@agentic-sdlc/orchestrator`
**Files:**
- `packages/orchestrator/src/repositories/stats.repository.ts` (EXISTS - VERIFY)
- `packages/orchestrator/src/services/stats.service.ts` (EXISTS - VERIFY)
- `packages/orchestrator/src/api/routes/stats.routes.ts` (EXISTS - VERIFY)
- `packages/orchestrator/src/server.ts` (MODIFY - ADD REGISTRATION)

**Investigation Tasks:**
- [ ] Read `stats.repository.ts` - Does it implement all required queries?
  - `getOverviewStats()` - Total, running, completed, failed workflow counts
  - `getWorkflowTimeSeries(hours: number)` - Workflows created per hour
  - `getAgentPerformance()` - Success rate, avg duration by agent type
- [ ] Read `stats.service.ts` - Does it orchestrate repository calls correctly?
- [ ] Read `stats.routes.ts` - Does it expose all needed endpoints?
  - `GET /api/v1/stats/overview` → DashboardStats
  - `GET /api/v1/stats/timeseries?hours=24` → TimeSeriesData[]
  - `GET /api/v1/stats/agents` → AgentStats[]

**Implementation Tasks:**
- [ ] **CRITICAL:** Add to `server.ts`:
  ```typescript
  import { statsRoutes } from './api/routes/stats.routes';

  // In server setup
  await server.register(statsRoutes, {
    prefix: '/api/v1',
    statsService: container.statsService // or equivalent
  });
  ```
- [ ] Fix any missing service/repository implementations
- [ ] Test with `curl http://localhost:3000/api/v1/stats/overview`
- [ ] Verify response schema matches frontend types

**Dependencies:** None (FIRST TASK)
**Estimate:** 1.5 hours
**Priority:** 🔥 CRITICAL - E2E tests depend on this

#### 1.2: Verify & Register Trace Service (1.5 hours)
**Package:** `@agentic-sdlc/orchestrator`
**Files:**
- `packages/orchestrator/src/repositories/trace.repository.ts` (EXISTS - VERIFY)
- `packages/orchestrator/src/services/trace.service.ts` (EXISTS - VERIFY)
- `packages/orchestrator/src/api/routes/trace.routes.ts` (EXISTS - VERIFY)
- `packages/orchestrator/src/server.ts` (MODIFY - ADD REGISTRATION)

**Investigation Tasks:**
- [ ] Verify `trace.repository.ts` implements:
  - `getTraceById(trace_id: string)` - Get trace metadata
  - `getSpansByTraceId(trace_id: string)` - Get all spans in hierarchy
  - `getWorkflowsByTraceId(trace_id: string)` - Get workflows with trace
  - `getTasksByTraceId(trace_id: string)` - Get tasks with trace
- [ ] Verify `trace.service.ts` builds span tree hierarchy
- [ ] Verify `trace.routes.ts` exposes:
  - `GET /api/v1/traces/:traceId` → TraceMetadata
  - `GET /api/v1/traces/:traceId/spans` → TraceSpan[] (hierarchical)
  - `GET /api/v1/traces/:traceId/workflows` → Workflow[]
  - `GET /api/v1/traces/:traceId/tasks` → Task[]

**Implementation Tasks:**
- [ ] **Register routes in `server.ts`** (same pattern as stats)
- [ ] Test with real trace_id from database
- [ ] Verify span hierarchy is correct (parent → child relationships)

**Dependencies:** None
**Estimate:** 1.5 hours
**Priority:** HIGH

#### 1.3: Create/Verify Task Service & Register Routes (1.5 hours)
**Package:** `@agentic-sdlc/orchestrator`
**Files:**
- `packages/orchestrator/src/repositories/task.repository.ts` (CREATE if missing)
- `packages/orchestrator/src/services/task.service.ts` (CREATE if missing)
- `packages/orchestrator/src/api/routes/task.routes.ts` (EXISTS - VERIFY)
- `packages/orchestrator/src/server.ts` (MODIFY - ADD REGISTRATION)

**Investigation Tasks:**
- [ ] Check if `task.repository.ts` exists - if not, create it:
  - `listTasks(filters: TaskFilters)` - Paginated task list
  - `getTaskById(task_id: string)` - Single task details
  - `getTasksByWorkflowId(workflow_id: string)` - All tasks for workflow
- [ ] Check if `task.service.ts` exists - if not, create it:
  - Wraps repository calls
  - Validates input
  - Formats output
- [ ] Verify `task.routes.ts` exposes:
  - `GET /api/v1/tasks?workflow_id=...&status=...&agent_type=...` → Task[]
  - `GET /api/v1/tasks/:taskId` → Task

**Implementation Tasks:**
- [ ] **Register routes in `server.ts`**
- [ ] Test task queries with filters

**Dependencies:** None
**Estimate:** 1.5 hours
**Priority:** MEDIUM

#### 1.4: Extend Workflow Routes (30 min)
**Package:** `@agentic-sdlc/orchestrator`
**Files:**
- `packages/orchestrator/src/api/routes/workflow.routes.ts` (EXTEND EXISTING)

**Investigation Tasks:**
- [ ] Check if workflow routes are already registered (they should be)
- [ ] Verify existing endpoints work:
  - `GET /api/v1/workflows` (exists, test filtering)
  - `GET /api/v1/workflows/:id` (exists, test response)

**Implementation Tasks:**
- [ ] Add missing endpoints (if needed):
  - `GET /api/v1/workflows/:id/tasks` → Task[] (delegate to task service)
  - `GET /api/v1/workflows/:id/timeline` → WorkflowEvent[]
- [ ] Test with curl

**Dependencies:** Task 1.3 (task service)
**Estimate:** 30 min
**Priority:** MEDIUM

#### 1.5: Verify All Routes Registered (30 min)
**Package:** `@agentic-sdlc/orchestrator`
**Files:**
- `packages/orchestrator/src/server.ts`

**Tasks:**
- [ ] Read `server.ts` - document current route registrations
- [ ] Create checklist of all routes that need registration:
  - [ ] workflow.routes.ts (should exist)
  - [ ] stats.routes.ts (ADD)
  - [ ] trace.routes.ts (ADD)
  - [ ] task.routes.ts (ADD)
- [ ] Verify all routes appear in logs: `pnpm pm2:logs orchestrator | grep "Route registered"`
- [ ] Test all endpoints with `curl` or create test script
- [ ] Document API in README or API.md file

**Dependencies:** Tasks 1.1, 1.2, 1.3
**Estimate:** 30 min
**Priority:** HIGH

**Phase 1 Summary:**
- **Total Time:** 4-5 hours
- **Files:** ~10 files (verify 6, modify 1-2, create 0-2)
- **Critical Path:** Must complete before frontend can work
- **Success Metric:** All API endpoints return 200 OK with valid data

---

### Phase 2: Frontend API Client & Hooks (2-3 hours)

#### 2.1: Implement API Client (1.5 hours)
**Package:** `@agentic-sdlc/dashboard`
**Files:**
- `packages/dashboard/src/api/client.ts` (EXTEND EXISTING)

**Tasks:**
- [ ] Implement all API client functions:
  - `fetchStats()` → DashboardStats
  - `fetchTimeSeries(hours: number)` → TimeSeriesData[]
  - `fetchAgentStats()` → AgentStats[]
  - `fetchWorkflows(filters?: WorkflowFilters)` → Workflow[]
  - `fetchWorkflow(id: string)` → Workflow
  - `fetchWorkflowTasks(id: string)` → Task[]
  - `fetchTrace(traceId: string)` → TraceMetadata
  - `fetchTraceSpans(traceId: string)` → TraceSpan[]
  - `fetchTasks(filters?: TaskFilters)` → Task[]
- [ ] Add error handling (throw on non-200)
- [ ] Add TypeScript return types
- [ ] Test with real API (once Phase 1 complete)

**Dependencies:** Phase 1 (API endpoints)
**Estimate:** 1.5 hours
**Priority:** HIGH

#### 2.2: Create React Query Hooks (1 hour)
**Package:** `@agentic-sdlc/dashboard`
**Files:**
- `packages/dashboard/src/hooks/useStats.ts` (EXTEND EXISTING)
- `packages/dashboard/src/hooks/useWorkflows.ts` (EXTEND EXISTING)
- `packages/dashboard/src/hooks/useWorkflow.ts` (CREATE NEW)
- `packages/dashboard/src/hooks/useTasks.ts` (CREATE NEW)
- `packages/dashboard/src/hooks/useTrace.ts` (CREATE NEW)

**Tasks:**
- [ ] Implement `useStats(refetchInterval?: number)` hook
- [ ] Implement `useWorkflows(filters, options)` hook
- [ ] Implement `useWorkflow(id: string)` hook
- [ ] Implement `useTasks(filters, options)` hook
- [ ] Implement `useTrace(traceId: string)` hook
- [ ] Configure default polling intervals (5s for dashboard, 10s for lists)
- [ ] Add error states and retry logic

**Dependencies:** Task 2.1 (API client)
**Estimate:** 1 hour
**Priority:** HIGH

#### 2.3: Verify TypeScript Types (30 min)
**Package:** `@agentic-sdlc/dashboard`
**Files:**
- `packages/dashboard/src/types/index.ts` (VERIFY/EXTEND)

**Tasks:**
- [ ] Ensure types match Prisma schema from orchestrator
- [ ] Add any missing interfaces (Workflow, Task, TraceSpan, DashboardStats, etc.)
- [ ] Verify all enums are defined
- [ ] Run `pnpm typecheck` - ensure 0 errors

**Dependencies:** None
**Estimate:** 30 min
**Priority:** MEDIUM

**Phase 2 Summary:**
- **Total Time:** 2-3 hours
- **Files:** ~8 files (extend 3, create 5)
- **Dependencies:** Phase 1
- **Success Metric:** All hooks return typed data without errors

---

### Phase 3: Core Pages Implementation (4-5 hours)

#### 3.1: Dashboard Page Implementation (1.5 hours)
**Package:** `@agentic-sdlc/dashboard`
**Files:**
- `packages/dashboard/src/pages/Dashboard.tsx` (IMPLEMENT)

**Tasks:**
- [ ] Build Dashboard page layout:
  - Heading: "Dashboard Overview"
  - 4 metric cards (Total, Running, Completed, Failed)
  - Time series chart (workflows over time) - use placeholder for now
  - Active workflows table (status=running)
- [ ] Use `useStats()` hook for metrics
- [ ] Use `useWorkflows({ status: 'running' })` for active workflows
- [ ] Add auto-refresh (5s polling)
- [ ] Show loading states (LoadingSpinner)
- [ ] Show error states (ErrorDisplay)
- [ ] **Fix E2E tests:**
  - "Dashboard Overview" heading visible ✅
  - Metric cards visible ✅
  - Active workflows table visible ✅

**Dependencies:** Phase 2 (hooks)
**Estimate:** 1.5 hours
**Priority:** 🔥 HIGH (fixes 3 E2E tests)

#### 3.2: Workflows Page Implementation (1.5 hours)
**Package:** `@agentic-sdlc/dashboard`
**Files:**
- `packages/dashboard/src/pages/WorkflowsPage.tsx` (IMPLEMENT)
- `packages/dashboard/src/components/Workflows/WorkflowTable.tsx` (CREATE NEW)

**Tasks:**
- [ ] Build Workflows page:
  - Heading: "Workflows"
  - Filter controls (status, type dropdowns)
  - Workflows table with columns:
    - Name, Type, Status, Stage, Progress, Trace ID, Created, Actions
  - Pagination controls (if needed)
- [ ] Use `useWorkflows(filters)` hook
- [ ] Implement filter state management (useState)
- [ ] Make table rows clickable (navigate to `/workflows/:id`)
- [ ] Add StatusBadge component for status column
- [ ] Add ProgressBar component for progress column
- [ ] **Fix E2E test:**
  - Table columns visible (Name, Type, Status, Stage, etc.) ✅

**Dependencies:** Phase 2 (hooks)
**Estimate:** 1.5 hours
**Priority:** HIGH (fixes 1 E2E test)

#### 3.3: Workflow Detail Page Implementation (1-1.5 hours)
**Package:** `@agentic-sdlc/dashboard`
**Files:**
- `packages/dashboard/src/pages/WorkflowPage.tsx` (IMPLEMENT)
- `packages/dashboard/src/components/Workflows/WorkflowTimeline.tsx` (CREATE NEW)

**Tasks:**
- [ ] Build Workflow detail page:
  - Heading with workflow name
  - Status badge and progress bar
  - Metadata section (ID, Type, Trace ID, timestamps)
  - Tasks table (all tasks for workflow)
  - Event timeline (stage transitions) - simplified for MVP
- [ ] Use `useWorkflow(id)` hook from URL params
- [ ] Use `useTasks({ workflow_id: id })` hook
- [ ] Make trace_id clickable (link to `/traces/:traceId`)
- [ ] Handle 404 if workflow not found

**Dependencies:** Phase 2 (hooks)
**Estimate:** 1-1.5 hours
**Priority:** MEDIUM

**Phase 3 Summary:**
- **Total Time:** 4-5 hours
- **Files:** ~5 files (implement 3 pages, create 2 components)
- **Dependencies:** Phase 2
- **Success Metric:** 10/11 E2E tests pass (missing only Agents page test)

---

### Phase 4: Trace Visualization (2-3 hours)

#### 4.1: Span Tree Component (1.5 hours)
**Package:** `@agentic-sdlc/dashboard`
**Files:**
- `packages/dashboard/src/components/Traces/SpanTree.tsx` (CREATE NEW)
- `packages/dashboard/src/components/Traces/SpanNode.tsx` (CREATE NEW)

**Tasks:**
- [ ] Create hierarchical span tree component:
  - Recursive TreeNode rendering
  - Expand/collapse functionality (useState)
  - Indent by depth (20px per level using margin/padding)
  - Show span_id, entity_type, duration, status
- [ ] Build tree from flat span list using parent_span_id linking
- [ ] Color-code by status (use StatusBadge colors)
- [ ] Show duration in ms
- [ ] Handle orphaned spans gracefully

**Dependencies:** Phase 2 (useTrace hook)
**Estimate:** 1.5 hours
**Priority:** MEDIUM

#### 4.2: Traces Page Implementation (1 hour)
**Package:** `@agentic-sdlc/dashboard`
**Files:**
- `packages/dashboard/src/pages/TracesPage.tsx` (IMPLEMENT)

**Tasks:**
- [ ] Build Traces page:
  - Trace search input (by trace_id) - get from URL params
  - Trace metadata display
  - Span tree visualization (use SpanTree component)
  - Related workflows table
  - Related tasks table
- [ ] Use `useTrace(traceId)` hook from URL params
- [ ] Handle empty state (no trace_id in URL)
- [ ] Handle not found state (404)

**Dependencies:** Task 4.1 (SpanTree component)
**Estimate:** 1 hour
**Priority:** MEDIUM

**Phase 4 Summary:**
- **Total Time:** 2-3 hours
- **Files:** ~3 files (1 page, 2 components)
- **Dependencies:** Phase 2
- **Success Metric:** Trace page displays span hierarchy correctly

---

### Phase 5: Charts & Polish (3-4 hours)

#### 5.1: Time Series Chart (1 hour)
**Package:** `@agentic-sdlc/dashboard`
**Files:**
- `packages/dashboard/src/components/Charts/TimeSeriesChart.tsx` (CREATE NEW)

**Tasks:**
- [ ] Create Recharts LineChart component
- [ ] Props: `data: TimeSeriesData[], height?: number`
- [ ] X-axis: timestamp (formatted as "HH:mm" using date-fns)
- [ ] Y-axis: workflow count
- [ ] Tooltip with formatted date
- [ ] Responsive container
- [ ] Color: Blue gradient
- [ ] Add to Dashboard page

**Dependencies:** None (isolated component)
**Estimate:** 1 hour
**Priority:** MEDIUM

#### 5.2: Agent Performance Page (1.5 hours)
**Package:** `@agentic-sdlc/dashboard`
**Files:**
- `packages/dashboard/src/pages/AgentsPage.tsx` (IMPLEMENT)
- `packages/dashboard/src/components/Charts/AgentPerformanceChart.tsx` (CREATE NEW)

**Tasks:**
- [ ] Create Recharts BarChart component (stacked: success vs failed)
- [ ] Build Agents page:
  - Heading: "Agent Performance"
  - Agent stats cards (one per agent type)
  - Success rate chart (use AgentPerformanceChart)
  - Response time metrics table (p50, p95, p99)
  - Retry analysis chart (optional, time permitting)
- [ ] Use `useStats()` hook for agent data
- [ ] Add auto-refresh (10s polling)

**Dependencies:** Phase 2 (hooks)
**Estimate:** 1.5 hours
**Priority:** LOW (not tested by E2E)

#### 5.3: Styling & UX Polish (1 hour)
**Package:** `@agentic-sdlc/dashboard`
**Files:**
- All component files

**Tasks:**
- [ ] Apply consistent spacing (Tailwind spacing scale: p-4, mb-6, etc.)
- [ ] Add hover states to interactive elements (hover:bg-gray-50)
- [ ] Ensure color contrast meets WCAG AA
- [ ] Test layout on 768px, 1024px, 1440px widths
- [ ] Polish tables (zebra striping, borders, rounded corners)
- [ ] Add empty states ("No workflows found" messages)
- [ ] Improve loading states (consider skeletons)

**Dependencies:** All previous frontend tasks
**Estimate:** 1 hour
**Priority:** MEDIUM

**Phase 5 Summary:**
- **Total Time:** 3-4 hours
- **Files:** ~5 files (2 pages, 2 charts, various styling)
- **Dependencies:** Phase 2-4
- **Success Metric:** All pages polished and professional-looking

---

## Risk Assessment

### Risk Matrix

| Risk | Probability | Impact | Mitigation Strategy |
|------|------------|--------|-------------------|
| **API routes not registered** | HIGH (current issue) | CRITICAL | **Phase 1 Task 1.5** - Verify all routes in server.ts immediately; test with curl |
| **Service implementations incomplete** | Medium | High | **Phase 1 Tasks 1.1-1.3** - Thorough verification step before coding; create missing implementations |
| **Database queries too slow** | Low | High | Add indexes on trace_id, workflow_id, status columns; use EXPLAIN ANALYZE; implement pagination |
| **E2E tests flaky** | Medium | Medium | Add explicit waits for API calls; use Playwright's auto-waiting; increase timeouts |
| **Charts rendering incorrectly** | Low | Medium | Test with various data sizes (empty, 1 item, 100 items); validate Recharts props with TypeScript |
| **Polling causing performance issues** | Low | Medium | Make polling intervals configurable; add tab visibility detection to pause when hidden |
| **TypeScript type mismatches** | Low | Low | Share types between frontend and backend; use Zod schemas for validation |
| **Build size too large** | Low | Low | Code-split routes with React.lazy; tree-shake unused Recharts components |
| **Missing trace_id in old workflows** | High | Low | Handle null gracefully; show "N/A" in UI |

---

## Testing Strategy

### E2E Tests (Playwright) - PRIMARY VALIDATION
**EXISTING TESTS (must pass):**
- [ ] Dashboard page loads with heading ✅
- [ ] Dashboard displays metric cards ✅
- [ ] Dashboard displays active workflows table ✅
- [ ] Workflows page loads ✅
- [ ] Workflows page filters by status ✅
- [ ] Workflows page filters by type ✅
- [ ] Workflows page displays correct columns ✅
- [ ] Navigation between pages works ✅
- [ ] Active nav link highlighted ✅
- [ ] 404 page displays for invalid routes ✅
- [ ] Header displays on all pages ✅

**Run:** `pnpm test:e2e` (from packages/dashboard/)
**Success Criteria:** 11/11 tests pass

### Manual Testing (During Development)
- [ ] Start orchestrator: `./scripts/env/start-dev.sh`
- [ ] Start dashboard: `cd packages/dashboard && pnpm dev`
- [ ] Test all API endpoints with curl
- [ ] Test all pages load without errors
- [ ] Test filters and navigation
- [ ] Test with real workflow data

### Build Validation
- [ ] TypeScript compilation: `pnpm typecheck` (dashboard + orchestrator)
- [ ] Frontend build: `cd packages/dashboard && pnpm build`
- [ ] Backend build: `cd packages/orchestrator && pnpm build`
- [ ] All packages build: `turbo run build` (from root)

### Performance Tests (Manual)
- [ ] Dashboard page loads in < 500ms (empty cache)
- [ ] API responses < 200ms for stats endpoints
- [ ] Charts render smoothly (no jank)
- [ ] Polling doesn't block UI interaction

---

## Timeline & Milestones

### Recommended Implementation Order

**Day 1 (4-5 hours): Backend API Foundation**
- Phase 1: Tasks 1.1-1.5 (Verify & Register All Routes)
- **Milestone:** All API endpoints accessible and returning data
- **Validation:** `curl http://localhost:3000/api/v1/stats/overview` returns JSON

**Day 2 (3-4 hours): Frontend Data Layer**
- Phase 2: Tasks 2.1-2.3 (API Client & Hooks)
- **Milestone:** React Query successfully fetching data
- **Validation:** React Query DevTools shows successful queries

**Day 3 (4-5 hours): Core Pages**
- Phase 3: Tasks 3.1-3.3 (Dashboard, Workflows, Workflow Detail)
- **Milestone:** 10/11 E2E tests pass
- **Validation:** `pnpm test:e2e` shows improvements

**Day 4 (2-3 hours): Trace Visualization**
- Phase 4: Tasks 4.1-4.2 (SpanTree, Traces Page)
- **Milestone:** Trace page displays hierarchy
- **Validation:** Manual test with real trace_id

**Day 5 (3-4 hours): Charts & Polish**
- Phase 5: Tasks 5.1-5.3 (Charts, Agents, Styling)
- **Milestone:** All 11 E2E tests pass, production-ready UI
- **Validation:** Full E2E suite passes, manual QA complete

**Total Estimated Time:** 15-20 hours over 5 days

---

## Success Metrics

### Technical Metrics
- **Code Quality:**
  - 0 TypeScript errors ✅
  - All 11 E2E tests pass ✅
  - All API endpoints return 200 OK ✅
- **Performance:**
  - Initial load < 500ms ✅
  - API response < 200ms (p95) ✅
  - Chart render < 100ms ✅
- **Test Coverage:**
  - 11/11 E2E tests pass ✅
  - All API endpoints manually tested ✅

### User Experience Metrics
- **Usability:**
  - Dashboard loads without errors ✅
  - Filters work as expected ✅
  - Navigation is intuitive ✅
- **Observability:**
  - Can find any workflow by ID ✅
  - Can correlate workflow to trace ✅
  - Can see agent performance ✅
- **Reliability:**
  - Handles API errors gracefully ✅
  - Shows loading states ✅
  - Auto-recovers from failures ✅

---

## Dependencies

### External Dependencies (Already Installed ✅)
- React 18.2.0
- React Router DOM 6.20.0
- TanStack React Query 5.12.0
- Recharts 2.10.0
- TailwindCSS 3.3.6
- date-fns 2.30.0
- Vite 5.0.8
- Playwright 1.44.0

### Internal Dependencies (Package Build Order)
```
1. @agentic-sdlc/shared-types (exists, no changes needed)
   ↓
2. @agentic-sdlc/shared-utils (exists, no changes needed)
   ↓
3. @agentic-sdlc/orchestrator (MODIFY - verify & register API routes)
   ↓
4. @agentic-sdlc/dashboard (IMPLEMENT - frontend components)
```

### Infrastructure Dependencies
- PostgreSQL database (running, with trace fields from Session #60) ✅
- Redis (running, for message bus) ✅
- Orchestrator service (running on port 3000) ✅

### Data Dependencies
- Workflow records in database (create test workflows if empty)
- Task records with trace_id populated
- At least 1 completed workflow for testing

---

## Key Files Summary

### Backend Files (Orchestrator)
| File | Action | Status | Priority |
|------|--------|--------|----------|
| `src/repositories/stats.repository.ts` | VERIFY/EXTEND | EXISTS | 🔥 CRITICAL |
| `src/services/stats.service.ts` | VERIFY/EXTEND | EXISTS | 🔥 CRITICAL |
| `src/api/routes/stats.routes.ts` | VERIFY | EXISTS | 🔥 CRITICAL |
| `src/repositories/trace.repository.ts` | VERIFY/EXTEND | EXISTS | HIGH |
| `src/services/trace.service.ts` | VERIFY/EXTEND | EXISTS | HIGH |
| `src/api/routes/trace.routes.ts` | VERIFY | EXISTS | HIGH |
| `src/repositories/task.repository.ts` | CREATE/VERIFY | UNKNOWN | MEDIUM |
| `src/services/task.service.ts` | CREATE/VERIFY | UNKNOWN | MEDIUM |
| `src/api/routes/task.routes.ts` | VERIFY | EXISTS | MEDIUM |
| `src/api/routes/workflow.routes.ts` | EXTEND | EXISTS | MEDIUM |
| `src/server.ts` | **MODIFY** | EXISTS | 🔥 **CRITICAL** |

### Frontend Files (Dashboard)
| File | Action | Status | Priority |
|------|--------|--------|----------|
| `src/api/client.ts` | IMPLEMENT | STUB | HIGH |
| `src/hooks/useStats.ts` | IMPLEMENT | STUB | HIGH |
| `src/hooks/useWorkflows.ts` | EXTEND | STUB | HIGH |
| `src/hooks/useWorkflow.ts` | CREATE | MISSING | HIGH |
| `src/hooks/useTasks.ts` | CREATE | MISSING | MEDIUM |
| `src/hooks/useTrace.ts` | CREATE | MISSING | MEDIUM |
| `src/pages/Dashboard.tsx` | IMPLEMENT | STUB | 🔥 HIGH |
| `src/pages/WorkflowsPage.tsx` | IMPLEMENT | STUB | HIGH |
| `src/pages/WorkflowPage.tsx` | IMPLEMENT | STUB | MEDIUM |
| `src/pages/TracesPage.tsx` | IMPLEMENT | STUB | MEDIUM |
| `src/pages/AgentsPage.tsx` | IMPLEMENT | STUB | LOW |
| `src/components/Charts/TimeSeriesChart.tsx` | CREATE | MISSING | MEDIUM |
| `src/components/Charts/AgentPerformanceChart.tsx` | CREATE | MISSING | LOW |
| `src/components/Traces/SpanTree.tsx` | CREATE | MISSING | MEDIUM |

---

## References

### Design Documents
- [DASHBOARD_IMPLEMENTATION_PLAN.md](./DASHBOARD_IMPLEMENTATION_PLAN.md) - Original specification
- [agentic-sdlc-tracing.md](./agentic-sdlc-tracing.md) - Distributed tracing design
- [DATABASE_QUERY_GUIDE.md](./DATABASE_QUERY_GUIDE.md) - SQL query examples
- [TRACE_IMPLEMENTATION_REVIEW.md](./TRACE_IMPLEMENTATION_REVIEW.md) - Tracing compliance review
- [CLAUDE.md](./CLAUDE.md) - Project overview and session history

### Codebase References
- Orchestrator API: `packages/orchestrator/src/api/routes/`
- Workflow Service: `packages/orchestrator/src/services/workflow.service.ts`
- Prisma Schema: `packages/orchestrator/prisma/schema.prisma`
- Dashboard App: `packages/dashboard/src/App.tsx`

---

## Checklist for CODE Phase

Before proceeding to `/epcc-code`, ensure:

- [x] All objectives are clearly defined ✅
- [x] All tasks are broken down into < 4 hour chunks ✅
- [x] All dependencies are identified ✅
- [x] All risks are assessed and mitigated ✅
- [x] Test strategy is comprehensive ✅
- [x] Success criteria are measurable ✅
- [x] Timeline is realistic ✅
- [ ] All stakeholders agree on scope ⏳ (awaiting user confirmation)

---

**Plan Status:** ✅ READY TO IMPLEMENT
**Next Step:** Await user approval, then proceed to `/epcc-code`
**Estimated Completion:** 15-20 hours (5 days @ 3-4 hours/day)

---

## 🚨 CRITICAL FIRST STEP

**Before ANY frontend work, MUST complete:**

1. **Phase 1, Task 1.1:** Verify stats routes exist and register in server.ts
2. **Phase 1, Task 1.5:** Test `curl http://localhost:3000/api/v1/stats/overview`
3. **Verify response:** Should return JSON, not ECONNREFUSED

**This single change will fix 4/11 failing E2E tests immediately.**

---

**Ready for CODE phase?** ⏳ Awaiting user approval to begin implementation.
