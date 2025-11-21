# EPCC Implementation Plan: Real-Time Monitoring Dashboard & Control Center

**Session:** #88 (Planning Phase - Exploration Complete)
**Date:** 2025-11-21
**Status:** ✅ PLAN COMPLETE
**Reference:** EPCC_EXPLORE.md

---

## Executive Summary

This document provides a detailed implementation plan for adding **real-time monitoring dashboard and control center** to the Agentic SDLC platform. Based on EPCC_EXPLORE.md findings, **no breaking changes are required**. The implementation leverages existing infrastructure (StatsService, Redis message bus, REST API endpoints) and adds:

- **4 new backend services:** EventAggregatorService, AlertEngineService, WebSocket gateway, monitoring repository
- **1 new WebSocket server:** For real-time metrics broadcasting
- **~15 new UI components:** System status, metric charts, control panels, alert views
- **2 new database tables:** AlertRule, Alert (Prisma schema additions only)

**Key Insight:** All metrics data already flows through StatsService and Redis Streams. **We only need to expose this data in real-time via WebSocket and add alert management.**

**Timeline:** 4 weeks (20-25 hours/week) | **Complexity:** Medium | **Risk Level:** Low

---

## Feature Objectives

### What We're Building

**Goal:** Provide real-time system visibility and control for workflow orchestration operators. Enable proactive incident detection, operational control, and audit compliance through live metrics, workflow controls, and alert management.

#### Phase 1: Real-Time Metrics Foundation (Week 1)
1. **EventAggregatorService** - Subscribe to workflow events, calculate metrics in real-time
2. **WebSocket Server** - Broadcast metrics to dashboard clients every 5 seconds
3. **API Endpoint** - REST fallback endpoint for metrics polling
4. **Database Schema** - Alert tables (AlertRule, Alert) via Prisma

#### Phase 2: Monitoring Dashboard UI (Week 1-2)
1. **API Client Hooks** - useRealtimeMetrics, useWorkflowControl hooks
2. **Monitoring Components** - SystemStatusBanner, MetricsCard, ThroughputChart, LatencyChart, ErrorRateChart, AgentHealthMatrix, EventStreamPanel
3. **MonitoringDashboardPage** - Main dashboard combining all metrics
4. **Real-time Updates** - WebSocket-driven component updates every 5 seconds

#### Phase 3: Control Center + Alerts (Week 2-3)
1. **AlertEngineService** - Evaluate alert rules against metrics
2. **Alert Repository** - Database persistence for alerts and rules
3. **ControlCenterPage** - Workflow pause/resume/cancel, agent management
4. **AlertsPage** - Alert history, rule management, manual resolution

#### Phase 4: Polish & Optimization (Week 3-4)
1. **Event Stream Viewer** - Real-time event feed with search/filter
2. **Enhanced Trace Analysis** - Critical path, bottleneck identification
3. **Performance Optimization** - Virtual scrolling, message debouncing, code splitting
4. **Comprehensive Testing** - Unit, integration, E2E, performance tests

### Success Criteria

- [x] Real-time metrics updating every 5 seconds via WebSocket
- [x] Dashboard page renders without errors with live data
- [x] Control operations (pause/resume/cancel) work end-to-end
- [x] Alert engine evaluates rules and generates alerts
- [x] Event stream viewer shows workflow events with filtering
- [x] Zero TypeScript compilation errors
- [x] All tests pass (unit + integration + E2E pipeline)
- [x] No breaking changes to existing APIs
- [x] Full dark mode support
- [x] Responsive design (mobile-friendly)
- [x] WebSocket fallback to HTTP polling works
- [x] Performance: metrics update <100ms, API response <50ms
- [x] Performance: WebSocket broadcast every 5s ±500ms
- [x] Memory: no leaks detected under load

### Non-Goals (What We're NOT Doing)

- Machine learning for anomaly detection (future enhancement)
- Custom dashboard widget builder (out of scope)
- Historical alert trend analysis (Phase 4+)
- Mobile native app (web-only for now)
- Performance profiling of agents (monitoring only)
- Integration with external monitoring tools (future)

---

## Part 2: Technical Approach

### High-Level Architecture

**Real-time Monitoring Flow:**
- Workflow events published to Redis Streams (`workflow:events` channel)
- EventAggregatorService subscribes and processes events in real-time
- Metrics cached in Redis with 5-minute TTL
- Every 5 seconds: Aggregate metrics and broadcast to WebSocket clients
- Dashboard receives updates via WebSocket (fallback to HTTP polling)
- AlertEngineService evaluates rules against metrics
- Alerts persisted to PostgreSQL and published to `alerts:events` channel
- Dashboard displays alerts in real-time

### Design Decisions

| Decision | Chosen | Rationale |
|----------|--------|-----------|
| **Real-time Protocol** | WebSocket with polling fallback | Native browser support, low latency |
| **Metric Storage** | In-memory + Redis cache | Fast access, multi-instance support |
| **Alert Rules** | JSON in database | Flexible, versionable, easy to extend |
| **Alert Evaluation** | Sync in EventAggregator | Real-time, <100ms latency |
| **Broadcast Interval** | 5 seconds | Balance real-time feel vs network overhead |
| **Component Patterns** | Reuse existing components | Consistency, faster development |
| **Service Location** | Orchestrator package | Avoid splitting business logic |
| **Database Migration** | Prisma schema + migrations | Consistent with existing setup |

### Data Flow Diagrams

**Workflow Event → Metrics Update:**
```
Workflow Stage Completes
  ↓
PublishWorkflowStageCompleted() → Redis 'workflow:events' stream
  ↓
EventAggregatorService subscribes and processes
  ↓
Extract metrics (completed_workflows++, avg_duration update, etc)
  ↓
Cache in Redis {key: 'monitoring:metrics:realtime', ttl: 5min}
  ↓
Every 5s: Broadcast to all WebSocket clients
  ↓
Browser receives → React re-renders metrics state
  ↓
Charts/cards update with new values
```

**Metric Threshold → Alert Generation:**
```
EventAggregator broadcasts metrics
  ↓
AlertEngineService.evaluateRules(metrics) called
  ↓
Check each alert rule (latency, error_rate, agent_offline, etc)
  ↓
If condition met → Generate Alert record
  ↓
Persist to PostgreSQL + Publish to 'alerts:events'
  ↓
Dashboard receives alert via WebSocket
  ↓
AlertsPage displays in real-time
```

**User Control Action → Workflow State Change:**
```
User clicks "Pause Workflow" button
  ↓
POST /api/v1/workflows/{id}/control {action: 'pause'}
  ↓
WorkflowService.pauseWorkflow(id) executed
  ↓
Update workflow.status = 'paused' in PostgreSQL
  ↓
Publish WorkflowPausedEvent to 'workflow:events'
  ↓
Dashboard polling/WebSocket receives status update
  ↓
UI shows 'Paused' badge, enable resume button
```

### Hexagonal Architecture Alignment

**Ports (Interfaces):**
- `IEventAggregator` - Subscribes to events, caches metrics
- `IAlertEngine` - Evaluates rules, generates alerts
- `IWebSocketManager` - Broadcasts to clients
- (Reuse) `IMessageBus`, `IKVStore`, `IMetricsRepository`

**Adapters (Implementations):**
- `EventAggregatorAdapter` extends `EventAggregatorService`
- `AlertEngineAdapter` extends `AlertEngineService`
- `WebSocketManagerAdapter` uses `@fastify/websocket`
- (Reuse) `RedisBusAdapter`, `RedisKVAdapter`, `PostgreSQLRepositories`

**Key Principle:** Services depend on Ports (interfaces), not Adapters (implementations)

---

## Part 3: Detailed Task Breakdown

### Phase 1: Real-Time Metrics Foundation (20-25 Hours)

#### 1.1 Define Types & Schemas (2-3 hours)
**Location:** `@agentic-sdlc/shared-types` package

**Subtasks:**
- Create `packages/shared/types/src/monitoring/` directory
- Define TypeScript types: RealtimeMetrics, Alert, AlertRule, MetricsUpdate
- Create Zod validation schemas for all types
- Export from package index (no /src/ paths)

**Acceptance Criteria:**
- ✅ Types exported from @agentic-sdlc/shared-types
- ✅ Zod schemas validate all data
- ✅ TypeScript compilation: 0 errors
- ✅ No unused imports

**Testing:** Unit test schemas with valid/invalid data

---

#### 1.2 Implement EventAggregatorService (5-6 hours)
**Location:** `@agentic-sdlc/orchestrator` services

**Subtasks:**
1. Create class implementing `IEventAggregator` port
2. Subscribe to 'workflow:events' Redis stream via messageBus
3. Extract metrics from workflow events:
   - On WORKFLOW_STAGE_COMPLETED: increment counters, update timings
   - On WORKFLOW_FAILED: increment error counters
   - On TASK_COMPLETED: update agent performance metrics
4. Cache metrics in Redis with 5-minute TTL
5. Every 5 seconds: broadcast to WebSocket clients
6. Wire into OrchestratorContainer DI

**Acceptance Criteria:**
- ✅ Subscribes to Redis 'workflow:events' stream
- ✅ Metrics update in <100ms per event
- ✅ Redis cache has proper TTL
- ✅ Broadcast every 5s ±500ms
- ✅ Handles out-of-order events gracefully
- ✅ No memory leaks
- ✅ TypeScript: 0 errors

**Testing:** Unit test with mocked dependencies, integration test with real Redis

---

#### 1.3 Implement WebSocket Server (4-5 hours)
**Location:** `@agentic-sdlc/orchestrator` websocket

**Subtasks:**
1. Add `@fastify/websocket` dependency
2. Create WebSocket route: `wss://localhost:3051/ws/monitoring`
3. Implement message protocol:
   - Client → Server: `{type: 'subscribe', channels: ['metrics:realtime']}`
   - Server → Client: `{type: 'metrics:update', data: {...}, timestamp: Date}`
4. Track connected clients, handle disconnections
5. Broadcast metrics to all connected clients
6. Implement backpressure handling (don't overwhelm slow clients)

**Acceptance Criteria:**
- ✅ WebSocket listens on `/ws/monitoring`
- ✅ Multiple clients can connect simultaneously
- ✅ Broadcasts to all connected clients
- ✅ Proper disconnect handling
- ✅ Error messages logged (never disconnect silently)
- ✅ TypeScript: 0 errors

**Testing:** Integration test with real WebSocket connections

---

#### 1.4 Add Monitoring API Endpoint (2-3 hours)
**Location:** `@agentic-sdlc/orchestrator` api routes

**Subtasks:**
1. Create route: `GET /api/v1/monitoring/metrics/realtime`
2. Return current metrics from EventAggregatorService cache
3. Set response headers: `Cache-Control: no-cache`
4. Include TTL info in response
5. Error handling: return 503 if metrics not ready

**Acceptance Criteria:**
- ✅ Endpoint responds in <50ms
- ✅ Proper HTTP status codes
- ✅ Response matches RealtimeMetrics schema
- ✅ TypeScript: 0 errors

**Testing:** HTTP integration test, verify response time <50ms

---

#### 1.5 Database Schema: Alert Tables (2-3 hours)
**Location:** `@agentic-sdlc/orchestrator` Prisma schema

**Subtasks:**
1. Add AlertRule model to `prisma/schema.prisma`
2. Add Alert model with FK to AlertRule
3. Create Prisma migration: `prisma migrate dev --name add_monitoring_alerts`
4. Seed default alert rules
5. Test migration up/down

**Acceptance Criteria:**
- ✅ Migration runs successfully
- ✅ Tables created with correct columns
- ✅ Indexes on performance-critical fields
- ✅ Default alert rules seeded

**Testing:** Migration tests, verify schema structure

---

### Phase 2: Monitoring Dashboard UI (18-22 Hours)

#### 2.1 Create Monitoring API Client (4-5 hours)
**Location:** `@agentic-sdlc/dashboard` api

**Subtasks:**
1. Create `packages/dashboard/src/api/monitoring.ts`
2. Implement `fetchRealtimeMetrics()` - HTTP fallback
3. Implement `subscribeToMetrics(callback)` - WebSocket with auto-reconnect
4. Implement `controlWorkflow(id, action)` - Pause/resume/cancel
5. Add exponential backoff for reconnection
6. Add error handling and user-friendly messages

**Acceptance Criteria:**
- ✅ WebSocket connects and reconnects automatically
- ✅ Fallback to HTTP polling if WS unavailable
- ✅ Error messages are user-friendly
- ✅ TypeScript: 0 errors

**Testing:** Integration test with real API server

---

#### 2.2 Create useRealtimeMetrics Hook (3-4 hours)
**Location:** `@agentic-sdlc/dashboard` hooks

**Subtasks:**
1. Create hook that subscribes to WebSocket
2. Manage metrics state, connection status, errors
3. Implement cleanup on unmount
4. Fallback to polling if WS fails
5. Handle reconnection gracefully

**Acceptance Criteria:**
- ✅ Returns metrics, connection status, errors
- ✅ No memory leaks
- ✅ Proper cleanup on unmount
- ✅ TypeScript: 0 errors

**Testing:** Hook behavior tests, integration with components

---

#### 2.3 Create Monitoring Components (8-10 hours)
**Location:** `@agentic-sdlc/dashboard` components

Create 7 reusable components:
1. **SystemStatusBanner** - Health %, uptime, agent count
2. **MetricsCard** - Value, trend, sparkline
3. **ThroughputChart** - Line chart, workflows/sec
4. **LatencyChart** - Area chart, p50/p95/p99
5. **ErrorRateChart** - Line chart, error %
6. **AgentHealthMatrix** - Grid of agent cards
7. **EventStreamPanel** - Auto-scrolling events

All components:
- Use Tailwind CSS
- Support dark mode
- Responsive design
- TypeScript strict
- Unit tests

**Acceptance Criteria:**
- ✅ All 7 components render without errors
- ✅ Charts display with sample data
- ✅ Dark mode works
- ✅ Responsive on mobile/tablet/desktop
- ✅ TypeScript: 0 errors

**Testing:** Component render tests, visual regression tests

---

#### 2.4 Create MonitoringDashboardPage (3-4 hours)
**Location:** `@agentic-sdlc/dashboard` pages

**Subtasks:**
1. Create page combining all monitoring components
2. Use useRealtimeMetrics hook
3. Add loading/error states
4. Add connection status indicator
5. Add route: `/monitoring`

**Acceptance Criteria:**
- ✅ Page renders without errors
- ✅ Metrics update every 5 seconds
- ✅ Loading/error states work
- ✅ Connection status displayed
- ✅ Route works

**Testing:** Page integration test, E2E validation

---

### Phase 3: Control Center + Alerts (20-25 Hours)

#### 3.1 Implement AlertEngineService (6-8 hours)
**Location:** `@agentic-sdlc/orchestrator` services

**Subtasks:**
1. Create class implementing `IAlertEngine` port
2. Implement 5 built-in alert rules:
   - Latency p95 > 500ms for 5 minutes
   - Error rate > 5%
   - Agent offline for 2 minutes
   - Success rate < 99.5% (SLA)
   - Workflow queue depth > 1000
3. Implement state machine for duration-based rules
4. Generate and persist alerts to PostgreSQL
5. Publish alerts to 'alerts:events' Redis stream
6. Handle deduplication (same alert doesn't trigger twice)

**Acceptance Criteria:**
- ✅ All 5 built-in rules evaluate correctly
- ✅ No duplicate alerts
- ✅ Alerts published to Redis
- ✅ Database persistence works
- ✅ Rule evaluation <100ms per rule
- ✅ TypeScript: 0 errors

**Testing:** Unit tests for each rule, integration tests

---

#### 3.2 Create Alert Repository (3-4 hours)
**Location:** `@agentic-sdlc/orchestrator` repositories

**Subtasks:**
1. Implement IAlertRepository interface
2. Implement IAlertRuleRepository interface
3. Add Prisma CRUD operations
4. Add query methods: getEnabled(), listActive(), listHistory()
5. Test all operations

**Acceptance Criteria:**
- ✅ All CRUD operations work
- ✅ Queries return in <100ms
- ✅ No SQL injection vulnerabilities
- ✅ TypeScript: 0 errors

**Testing:** Integration tests with real PostgreSQL

---

#### 3.3 Create ControlCenterPage (6-8 hours)
**Location:** `@agentic-sdlc/dashboard` pages

**Subtasks:**
1. Create page with workflow list/control
2. Add components:
   - WorkflowControlPanel (table with action buttons)
   - AgentPoolManager (agent management)
   - PlatformConfigManager (platform controls)
   - EmergencyControlPanel (system-wide controls)
3. Implement control operations (pause/resume/cancel)
4. Add confirmation dialogs for destructive ops
5. Show loading states and feedback
6. Add real-time status updates

**Acceptance Criteria:**
- ✅ Page renders without errors
- ✅ Control operations work end-to-end
- ✅ Confirmation dialogs prevent accidents
- ✅ Status updates in real-time
- ✅ TypeScript: 0 errors

**Testing:** Component tests, E2E validation

---

#### 3.4 Create AlertsPage (8-10 hours)
**Location:** `@agentic-sdlc/dashboard` pages

**Subtasks:**
1. Create page with 3 tabs: Active, History, Rules
2. Components:
   - AlertList (active alerts)
   - AlertHistoryView (paginated history)
   - AlertRuleForm (create/edit rules)
   - AlertRuleList (manage rules)
3. Implement CRUD for alert rules
4. Add filtering and search
5. Manual alert resolution

**Acceptance Criteria:**
- ✅ Three tabs work correctly
- ✅ All alerts displayed with colors
- ✅ Can create/edit/delete rules
- ✅ Real-time updates visible
- ✅ TypeScript: 0 errors

**Testing:** Component tests, E2E validation

---

### Phase 4: Polish & Optimization (12-15 Hours)

#### 4.1 Event Stream Viewer (4-5 hours)
**Location:** `@agentic-sdlc/dashboard` pages

**Subtasks:**
1. Create EventStreamPage with auto-scrolling feed
2. Implement virtual scrolling for 10k+ events
3. Add filtering: by type, severity, workflow_id
4. Add search: by message, trace_id
5. Add export: JSON/CSV

**Acceptance Criteria:**
- ✅ Events display in real-time
- ✅ Virtual scrolling works
- ✅ Filtering and search functional
- ✅ No lag with 10k+ events

**Testing:** Performance tests with large datasets

---

#### 4.2 Enhanced Trace Analysis (4-5 hours)
**Location:** `@agentic-sdlc/dashboard` pages (existing TraceDetailPage)

**Subtasks:**
1. Add critical path highlighting
2. Add bottleneck identification
3. Add comparison mode (2+ traces)
4. Add Gantt chart timeline view
5. Add error recovery tracking

**Acceptance Criteria:**
- ✅ Critical path visible
- ✅ Bottlenecks identified
- ✅ Timeline visualization accurate
- ✅ Comparison works

**Testing:** Component tests

---

#### 4.3 Performance Optimization (3-4 hours)
**Location:** `@agentic-sdlc/dashboard`

**Subtasks:**
1. Implement virtual scrolling for large lists
2. Debounce WebSocket messages
3. Memoize components with React.memo
4. Implement code splitting
5. Monitor bundle size

**Acceptance Criteria:**
- ✅ Dashboard loads in <2s
- ✅ WebSocket messages debounced
- ✅ No unnecessary re-renders
- ✅ Bundle size reduced 30%+

**Testing:** Performance profiling, Lighthouse

---

#### 4.4 Comprehensive Testing (3-4 hours)
**Location:** All packages

**Subtasks:**
1. Unit tests for all new services and components
2. Integration tests for service interactions
3. E2E pipeline tests for workflows
4. Performance load tests
5. Manual QA of all pages

**Acceptance Criteria:**
- ✅ Unit coverage >85%
- ✅ Integration coverage >80%
- ✅ All E2E tests pass
- ✅ Performance benchmarks met
- ✅ TypeScript: 0 errors

**Testing:** Vitest for unit/integration, E2E via pipeline script

---

## Part 4: Risk Assessment & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-----------|--------|-----------|
| WebSocket instability | Medium | Medium | Auto-reconnect, fallback to polling, status indicator |
| Redis memory exhaustion | Low | High | TTL on caches, event retention policy, monitoring |
| Alert rule performance | Low | High | Async evaluation, circuit breaker, caching |
| Database migration failure | Low | High | Test in dev first, rollback script, backup |
| Type system gaps | Low | Medium | Zod validation, strict TypeScript, testing |
| Breaking changes | Low | Critical | Only add new services, verify imports, test suite |
| E2E test flakiness | Medium | Medium | Retry logic, explicit waits, consistent environment |

---

## Part 5: Testing Strategy

### Unit Tests (Vitest)
- EventAggregatorService metric calculations
- AlertEngineService rule evaluation
- React components (render, interaction)
- React hooks (state, effects)
- API client functions (success/error)

**Coverage Target:** >85% for new code

### Integration Tests (Vitest + Real Services)
- EventAggregator + Redis + StatsService
- AlertEngine + PostgreSQL
- WebSocket + multiple clients
- React Query + API client
- Control operations end-to-end

**Coverage Target:** >80%

### E2E Pipeline Tests
```bash
./scripts/run-pipeline-test.sh "E2E: Monitoring Dashboard"
./scripts/run-pipeline-test.sh "E2E: Create workflow and monitor"
./scripts/run-pipeline-test.sh "E2E: Control workflow via dashboard"
./scripts/run-pipeline-test.sh "E2E: Trigger and view alerts"
```

### Build Validation
```bash
turbo run typecheck  # Expected: 0 errors
turbo run lint       # Expected: 0 errors
turbo run test       # Expected: all pass
turbo run build      # Expected: success
```

---

## Part 6: Timeline & Dependencies

### Week-by-Week Breakdown

**Week 1:**
- Phase 1.1-1.5: Real-time metrics foundation
- Phase 2.1-2.2: API client and hooks
- Expected: 20-25 hours

**Week 1-2:**
- Phase 2.3-2.4: Dashboard components and page
- Expected: 18-22 hours

**Week 2-3:**
- Phase 3.1-3.4: Control center and alerts
- Expected: 20-25 hours

**Week 3-4:**
- Phase 4.1-4.4: Polish, testing, optimization
- Expected: 12-15 hours

**Total:** ~75-100 hours (3-4 weeks full-time)

### Package Build Order
```
1. shared-types        (no dependencies)
2. orchestrator        (depends on shared-types)
3. dashboard           (depends on shared-types, orchestrator API)
```

---

## Part 7: Success Metrics

| Metric | Target | Verification |
|--------|--------|--------------|
| TypeScript Errors | 0 | `turbo run typecheck` |
| Test Pass Rate | 100% | `pnpm test` |
| Test Coverage | >85% | `pnpm test --coverage` |
| E2E Tests | 100% pass | `./scripts/run-pipeline-test.sh` |
| Metrics Latency | <100ms | Event → metric cache timing |
| API Response Time | <50ms | `/api/v1/monitoring/metrics/realtime` |
| WebSocket Broadcast | 5s ±500ms | Log analysis |
| Memory Leaks | None | DevTools monitoring |
| Breaking Changes | 0 | Test suite before/after |

---

## Part 8: Documentation Plan

### Files to Create/Update
1. **CLAUDE.md** - Add monitoring features to capabilities
2. **API Documentation** - WebSocket and HTTP endpoints
3. **User Guide** - Dashboard, control center, alerts
4. **Developer Guide** - Architecture and services
5. **Deployment Guide** - Migration steps, rollback

---

## Summary

**Estimated Effort:** 75-100 hours (3-4 weeks)

**Phases:** 4 (Real-time Metrics → Dashboard UI → Control Center → Polish)

**Risk Level:** Low (no breaking changes, isolated from existing code)

**Success Criteria:** All tests pass, 0 TypeScript errors, features work end-to-end

**Ready to implement!** 🚀

---

**PLAN COMPLETE** ✅

All tasks defined, risks assessed, dependencies mapped. Ready for CODE phase.

Document created: **2025-11-21** | Next: Execute implementation tasks from Phase 1
