# Implementation Plan: Full Multi-Platform SDLC System Evolution

**Version:** 1.0.0 | **Status:** PLANNING PHASE | **Date:** 2025-11-16
**Timeline:** 8 weeks | **Production Readiness:** 99% → 99.5% (maintained through phasing)

---

## 📋 Executive Summary

**Vision:** Transform single-domain system (app, feature, bugfix) into enterprise-grade **multi-platform architecture** with 4+ independent platforms (Web Apps, Data Pipelines, Mobile, Infrastructure) and 5 surface types (REST, Webhook, CLI, Dashboard, Mobile API).

**Key Characteristics:**
- ✅ **Non-breaking** - Hexagonal core protected, backward-compatible via "legacy-platform"
- ✅ **Phased** - 7 phases over 8 weeks with gates maintaining 99% readiness
- ✅ **Proven** - Builds on Session #70 Analytics Service precedent
- ✅ **Enterprise-Ready** - Multi-tenant capable, definition-driven workflows

**Success Criteria:**
- ✅ All 7 phases complete with phase gates passing
- ✅ Hexagonal core unchanged (zero modifications)
- ✅ Backward compatibility verified
- ✅ Database migration non-breaking
- ✅ 100+ tests passing with 80%+ coverage
- ✅ CLAUDE.md updated with Session #72+

---

## 🏗️ Technical Approach

### Layered Architecture
```
SURFACE LAYER       [NEW] REST API, GitHub Webhook, CLI, Dashboard, Mobile
  ↓ (SurfaceRouterService)
PLATFORM LAYER      [NEW] Web Apps, Data Pipelines, Mobile, Infrastructure
  ↓ (definition-driven WorkflowEngine)
AGENT LAYER         [EXTENDS] Global + platform-scoped agents
  ↓ (AgentRegistry with platform_id)
HEXAGONAL CORE      [PROTECTED] Unchanged (ports, adapters, core)
  ↓
INFRASTRUCTURE      [UNCHANGED] Redis, PostgreSQL, Claude API, AWS, GitHub
```

### Design Principles
1. Additive only (no modifications to existing layers)
2. Definition-driven platforms & surfaces (YAML/JSON)
3. Reusable components (GenericMockAgent, PlatformLoader, SurfaceRouter)
4. Clear separation (Surfaces → Platforms → Agents → Core)
5. Production-safe (phase gates before each stage)

---

## 📊 Database Schema Changes

### New Tables (Phase 1)
```sql
CREATE TABLE Platform (
  id UUID PRIMARY KEY,
  name String UNIQUE,
  layer String (APPLICATION|DATA|INFRASTRUCTURE|ENTERPRISE),
  description String,
  config JSON,
  created_at DateTime,
  updated_at DateTime
);

CREATE TABLE WorkflowDefinition (
  id UUID PRIMARY KEY,
  platform_id UUID FOREIGN KEY,
  name String,
  version String,
  description String,
  definition JSON,
  created_at DateTime,
  updated_at DateTime,
  UNIQUE(platform_id, name)
);

CREATE TABLE PlatformSurface (
  id UUID PRIMARY KEY,
  platform_id UUID FOREIGN KEY,
  surface_type String (REST|WEBHOOK|CLI|DASHBOARD|MOBILE_API),
  config JSON,
  enabled Boolean,
  created_at DateTime,
  updated_at DateTime,
  UNIQUE(platform_id, surface_type)
);
```

### Modified Tables (Phase 1, additive only)
```sql
ALTER TABLE Workflow ADD COLUMN platform_id UUID FOREIGN KEY;
ALTER TABLE Workflow ADD COLUMN workflow_definition_id UUID FOREIGN KEY;
ALTER TABLE Workflow ADD COLUMN surface_id UUID FOREIGN KEY;
ALTER TABLE Workflow ADD COLUMN input_data JSON;
ALTER TABLE Workflow ADD COLUMN layer String;

ALTER TABLE Agent ADD COLUMN platform_id UUID FOREIGN KEY (NULL = global);
```

**Migration Strategy:** Create tables first (non-blocking), add nullable columns, backfill in Phase 2.

---

## 📋 7-Phase Implementation Plan (54 Core Tasks + 7 Phase Tests)

### Phase 1: Core Platform Infrastructure (Weeks 1-2, 12 days)

**Goal:** Establish platform abstraction layer with backward compatibility

**Tasks:**
1. Database Schema - New Tables (2d)
2. Database Schema - Modified Tables (1d)
3. Create PlatformLoader Service (2d)
4. Create PlatformRegistry Service (2d)
5. Create Legacy Platform Definition (1d)
6. Update WorkflowService for Platform Awareness (2d)
7. Update Workflow Repository (1d)
8. Phase 1 Integration Test (1d)

**Gate Validation:**
- ✅ All 3 new tables created
- ✅ All 5 nullable columns added
- ✅ PlatformLoader caching working
- ✅ PlatformRegistry lookups working
- ✅ Legacy platform workflows progressing
- ✅ Production readiness: 99%

---

### Phase 2: Surface Abstraction (Weeks 2-3, 13 days)

**Goal:** Enable multiple entry points (REST, Webhook, CLI, Dashboard)

**Tasks:**
1. Define SurfaceRouter Service (2d)
2. Implement REST API Surface (2d)
3. Implement GitHub Webhook Surface (2d)
4. Implement CLI Surface (2d)
5. Implement Dashboard Surface Updates (2d)
6. Database Backfill - Legacy Platform Assignment (1d)
7. Update API Routes for Backward Compatibility (1d)
8. Phase 2 Integration Test (1d)

**Gate Validation:**
- ✅ REST API surface working
- ✅ GitHub webhook surface working
- ✅ CLI surface working
- ✅ Dashboard platform awareness added
- ✅ Legacy workflows still progressing
- ✅ Production readiness: 99%

---

### Phase 3: Workflow Engine Integration (Weeks 3-4, 10 days)

**Goal:** Replace hard-coded STAGE_SEQUENCES with definition-driven routing

**Tasks:**
1. Create WorkflowDefinitionSchema (1d)
2. Create PlatformAwareWorkflowEngine Service (2d)
3. Update WorkflowStateMachineService (2d)
4. Implement Adaptive Progress Calculation (1d)
5. Create Platform Definition Files (YAML) (2d)
6. Seed Platform Tables with Definitions (1d)
7. Update Dashboard Progress Calculation (1d)
8. Phase 3 Integration Test (1d)

**Gate Validation:**
- ✅ Definition-driven routing working
- ✅ Adaptive progress calculation working
- ✅ All 4 platform definitions seeded
- ✅ Dashboard showing correct progress rates
- ✅ Legacy fallback working
- ✅ Production readiness: 99%

---

### Phase 4: Platform-Specific Agents (Weeks 4-5, 10 days)

**Goal:** Enable agents scoped to specific platforms and global agents

**Tasks:**
1. Extend AgentRegistry with Platform Scoping (1d)
2. Update Agent Base Class for Platform Context (1d)
3. Register Platform-Specific Agents (2d)
4. Update Task Creation for Platform-Aware Agent Selection (1d)
5. Update WorkflowStateMachineService for Agent Routing (1d)
6. Create GenericMockAgent for Testing (2d)
7. Multi-Platform Test Suite (2d)
8. Phase 4 Integration Test (1d)

**Gate Validation:**
- ✅ Platform-specific agent lookup working
- ✅ GenericMockAgent registered 11+ times
- ✅ Multi-platform parallel execution working
- ✅ Independent trace IDs per platform
- ✅ All agents completing tasks
- ✅ Production readiness: 99%

---

### Phase 5: Dashboard & Monitoring (Weeks 5-6, 9 days)

**Goal:** Platform-aware dashboard with real-time monitoring

**Tasks:**
1. Create PlatformsPage Component (2d)
2. Create PlatformSelector Component (1d)
3. Create SurfaceIndicator Component (1d)
4. Create WorkflowBuilderPage (2d)
5. Create WorkflowDetailPage Enhancement (1d)
6. Add Platform Analytics Endpoint (1d)
7. Update API Client for Platform Endpoints (1d)
8. Phase 5 Integration Test (1d)

**Gate Validation:**
- ✅ PlatformsPage displaying all platforms
- ✅ WorkflowBuilderPage creating workflows
- ✅ WorkflowDetailPage showing platform info
- ✅ API endpoints returning platform data
- ✅ Dashboard responsive to platform selection
- ✅ Production readiness: 99%

---

### Phase 6: Testing Infrastructure (Weeks 6-7, 8 days)

**Goal:** Comprehensive test coverage for multi-platform system

**Tasks:**
1. Finalize GenericMockAgent (1d)
2. Create Multi-Platform Test Scenarios (2d)
3. Create Unit Tests for Platform Services (1d)
4. Create Integration Tests for Message Bus (1d)
5. Create E2E Pipeline Tests (1d)
6. Create Dashboard E2E Tests (1d)
7. Create Documentation Tests (1d)
8. Phase 6 Integration Test (1d)

**Gate Validation:**
- ✅ GenericMockAgent working with 11+ registrations
- ✅ 100+ tests passing
- ✅ 80%+ code coverage
- ✅ Multi-platform test scenarios all passing
- ✅ Dashboard E2E tests passing
- ✅ Production readiness: 99.5%

---

### Phase 7: Documentation & Graduation (Weeks 7-8, 7 days)

**Goal:** Documentation, cleanup, and production graduation

**Tasks:**
1. Create Platform Definition Templates (1d)
2. Create Surface Adapter Templates (1d)
3. Update CLAUDE.md with Multi-Platform Architecture (1d)
4. Create Platform Onboarding Guide (1d)
5. Create Architecture Migration Guide (1d)
6. Update API Documentation (Swagger) (1d)
7. Production Graduation & Cleanup (1d)

**Gate Validation:**
- ✅ All documentation complete
- ✅ Platform onboarding guide tested
- ✅ API documentation complete
- ✅ Final smoke tests passing
- ✅ Production readiness: 99.5%

---

## 🎯 Success Criteria Summary

### Overall Success Criteria
- ✅ All 7 phases complete on schedule (8 weeks)
- ✅ Production readiness maintained at 99%+ throughout
- ✅ Hexagonal core completely protected
- ✅ Backward compatibility verified
- ✅ Database migration non-breaking
- ✅ 100+ tests passing (unit + integration + E2E)
- ✅ 80%+ code coverage maintained
- ✅ Documentation complete

### Phase Gates (Go/No-Go)
- **Phase 1:** Database ready, PlatformRegistry working, legacy workflows progressing
- **Phase 2:** All 4 surfaces working, API routes updated, backfill complete
- **Phase 3:** Definition-driven routing working, 4 platforms seeded, dashboard updated
- **Phase 4:** Platform-scoped agents working, GenericMockAgent registered, multi-platform testing
- **Phase 5:** Dashboard components working, API endpoints returning data, E2E tests passing
- **Phase 6:** 100+ tests passing, 80%+ coverage, multi-platform test scenarios all passing
- **Phase 7:** Documentation complete, smoke tests passing, production ready

---

## 🔄 Risk Assessment & Mitigation

### HIGH Risk: Database Migration
**Risk:** Breaking workflows or data loss
**Mitigation:** Create new tables first, add nullable columns, backfill in background, keep pre-migration snapshot

### MEDIUM Risk: Workflow State Machine Refactoring
**Risk:** Bugs in definition-driven routing breaking progression
**Mitigation:** Keep hard-coded STAGE_SEQUENCES as fallback, extensive testing before switch, gradual rollout

### MEDIUM Risk: Agent Registry Platform Scoping
**Risk:** Agent lookup bugs or ambiguity
**Mitigation:** Make platform_id optional, implement clear precedence, unit + integration tests, Phase 4 gate testing

### MEDIUM Risk: Dashboard Breaking Changes
**Risk:** Existing URLs/components breaking
**Mitigation:** Add new pages alongside existing (additive), maintain backward-compatible URLs, "All Platforms" default option

### LOW Risk: Testing Infrastructure
**Risk:** GenericMockAgent not reflecting real behavior
**Mitigation:** Mock is additive, existing tests continue working, use real agents for critical E2E tests

### LOW Risk: Performance Degradation
**Risk:** New layers causing latency reduction
**Mitigation:** PlatformRegistry caching, WorkflowEngine caching, database indexes, load testing, monitoring

---

## 📈 Metrics & Success Indicators

### Development Metrics
- Code Coverage: 80%+ (unit + integration)
- Test Count: 100+ tests (unit + integration + E2E)
- Lines of Code: ~3,000 new lines
- Technical Debt: Minimal
- Build Time: < 60 seconds (no regression)

### Production Metrics
- Availability: 99%+ uptime (no degradation)
- Response Time: < 200ms (p95) for API endpoints
- Workflow Success Rate: 95%+ (no regression)
- Error Rate: < 0.5% (no new error types)

### Timeline Metrics
- Phase Completion On-Time: 100% (all 7 phases)
- Phase Gate Pass Rate: 100% (all phases pass gates)
- No Major Blockers: Minimal blocking issues

---

## 🚀 Resource Requirements

### Team Composition
- **Architecture Lead:** 1 person
- **Backend Engineers:** 2 people
- **Frontend Engineers:** 1 person
- **QA/Test Engineer:** 1 person
- **DevOps/Infrastructure:** 0.5 person

**Total:** 5.5 FTE for 8 weeks | **Estimated:** 69 person-days

---

## 🔧 Technical Dependencies

### Required Packages (Already Exist)
- ✅ @agentic-sdlc/shared-types (v1.0.0)
- ✅ @agentic-sdlc/base-agent (v1.0.0)
- ✅ @agentic-sdlc/agent-registry (v1.0.0)
- ✅ @agentic-sdlc/orchestrator (v1.0.0)
- ✅ Redis 7+, PostgreSQL 16+, Prisma ORM

### New Packages (to Create)
- ⚡ @agentic-sdlc/platforms (monorepo package)
- ⚡ @agentic-sdlc/surfaces (monorepo package)
- ⚡ @agentic-sdlc/cli (monorepo package)

### External Services (No Changes)
- Claude API (Haiku 4.5)
- AWS (ECS, ECR)
- GitHub API
- Playwright

---

## 📋 Phase Gate Checklist

### Phase 1 Gate
- [ ] All 3 new tables created
- [ ] All 5 nullable columns added
- [ ] PlatformLoader operational
- [ ] PlatformRegistry operational
- [ ] Legacy platform workflows progressing
- [ ] Integration test passing
- [ ] Production readiness: 99%

### Phase 2 Gate
- [ ] REST API surface working
- [ ] GitHub webhook surface working
- [ ] CLI surface working
- [ ] Dashboard platform awareness added
- [ ] Database backfill complete
- [ ] Legacy API routes still working
- [ ] 3 workflows via different surfaces
- [ ] Production readiness: 99%

### Phase 3 Gate
- [ ] Definition-driven routing working
- [ ] Adaptive progress calculation working
- [ ] All 4 platform definitions seeded
- [ ] Dashboard showing correct progress rates
- [ ] Fallback to hard-coded STAGE_SEQUENCES working
- [ ] Web-apps (6 stages) + data-pipelines (5 stages) test passing
- [ ] Production readiness: 99%

### Phase 4 Gate
- [ ] Platform-specific agents registered
- [ ] AgentRegistry lookup with platform context
- [ ] GenericMockAgent registered 11+ times
- [ ] Multi-platform parallel execution
- [ ] Independent trace IDs per platform
- [ ] 2 platforms with independent traces
- [ ] Production readiness: 99%

### Phase 5 Gate
- [ ] PlatformsPage operational
- [ ] WorkflowBuilderPage operational
- [ ] PlatformSelector working
- [ ] SurfaceIndicator working
- [ ] API platform endpoints working
- [ ] Playwright E2E tests passing
- [ ] Production readiness: 99%

### Phase 6 Gate
- [ ] 100+ tests passing
- [ ] 80%+ code coverage
- [ ] Multi-platform test scenarios passing
- [ ] GenericMockAgent reliable
- [ ] Dashboard E2E tests passing
- [ ] No performance regressions
- [ ] Production readiness: 99.5%

### Phase 7 Gate
- [ ] All documentation complete
- [ ] Platform onboarding guide tested
- [ ] API documentation complete
- [ ] Session #72+ summary written
- [ ] Final smoke tests passing
- [ ] All cleanup tasks done
- [ ] Production ready: 99.5%

---

## 📚 Documentation Deliverables

### At Completion
1. **STRATEGIC-ARCHITECTURE.md** (Session #71 - DONE)
2. **EPCC_PLAN.md** (THIS DOCUMENT)
3. **PLATFORM_ONBOARDING.md** - New platforms guide
4. **MIGRATION_GUIDE.md** - Backward compatibility
5. **API_DOCUMENTATION.md** - Platform endpoints
6. **SESSION_SUMMARY.md** - Completion report

---

## ✅ Next Steps: Ready for CODE Phase

Once approved, CODE phase will execute:
- **Week 1:** Phase 1 tasks (database, services, legacy platform)
- **Week 2:** Phase 2 tasks (surfaces, API routes)
- **Week 3:** Phase 3 tasks (definition-driven routing)
- **Week 4:** Phase 4 tasks (platform-specific agents)
- **Week 5:** Phase 5 tasks (dashboard)
- **Week 6:** Phase 6 tasks (testing)
- **Week 7-8:** Phase 7 tasks (documentation, graduation)

Each phase will:
- Implement tasks sequentially
- Run tests after each task
- Update CLAUDE.md with progress
- Execute phase gate validation
- Go/No-Go decision before next phase

---

**Status:** ✅ PLANNING PHASE COMPLETE - Ready for CODE Phase

**Prepared By:** Claude Code | **Date:** 2025-11-16 | **Session:** #72 (Planning Phase)

**Next Action:** Stakeholder approval → Begin CODE Phase with Week 1 (Phase 1) tasks
