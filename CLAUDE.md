# CLAUDE.md - AI Assistant Guide for Agentic SDLC

**Status:** ✅ Phase 7B Complete + Session #80 (Dashboard E2E) | **Updated:** 2025-11-18 | **Version:** 55.0

**📚 Key Resources:** [Runbook](./AGENTIC_SDLC_RUNBOOK.md) | [Logging](./LOGGING_LEVELS.md) | [Strategy](./STRATEGIC-ARCHITECTURE.md) | [Behavior Metadata](./packages/agents/generic-mock-agent/BEHAVIOR_METADATA_GUIDE.md)

---

## 🤖 FOR AI AGENTS - Start Here

**One-command startup:**
```bash
./dev start              # Start all services (Docker + PM2 + health checks) ~60 seconds
./dev watch             # Enable auto-rebuild on code changes (in another terminal)
./dev stop              # Graceful shutdown
./dev restart           # Restart everything
```

**Service Access (after ./dev start):**
| Service | URL | Port |
|---------|-----|------|
| **Dashboard** | http://localhost:3050 | 3050 |
| **Orchestrator API** | http://localhost:3051/api/v1/health | 3051 |
| **PostgreSQL** | psql -h localhost -p 5433 -U agentic | 5433 |
| **Redis** | redis-cli -p 6380 | 6380 |

**Monitoring:**
```bash
./dev status            # Check what's running
./dev health            # Service health checks
./dev logs              # View real-time logs
```

**Key Docs for Your Task:**
- **Setup**: [QUICKSTART-UNIFIED.md](./QUICKSTART-UNIFIED.md)
- **Architecture**: [UNIFIED-ORCHESTRATION.md](./infrastructure/local/UNIFIED-ORCHESTRATION.md)
- **Ports**: [PORT_CONFIGURATION.md](./PORT_CONFIGURATION.md)
- **Schemas**: [Agent Envelope v2.0](./packages/shared/types/src/messages/agent-envelope.ts)
- **Logging**: [LOGGING_LEVELS.md](./LOGGING_LEVELS.md)

**Common Tasks:**
```bash
# Restart specific service
./dev restart-orchestrator          # Restart just orchestrator
./dev restart-agents                # Restart just agents

# Start individual services (if needed)
./dev orchestrator-only
./dev agents-only
./dev dashboard-only
./dev db-only
./dev cache-only

# Emergency: Check what's using a port
lsof -i :3051                       # Check orchestrator port
lsof -i :3050                       # Check dashboard port
```

---

## 🏗️ Architecture Rules (CRITICAL)

### Core Principles
1. ✅ **Schema:** AgentEnvelopeSchema v2.0.0 from @agentic-sdlc/shared-types (ALL validation)
2. ✅ **Imports:** Use package index, NEVER /src/ paths
3. ✅ **Message Bus:** redis-bus.adapter.ts handles ALL wrapping/unwrapping
4. ✅ **Envelopes:** buildAgentEnvelope() in orchestrator is canonical producer
5. ✅ **DI:** Use OrchestratorContainer
6. ✅ **No Duplication:** Never copy schemas/validators between packages

**Critical Files (Never Duplicate):**
- `packages/shared/types/src/messages/agent-envelope.ts` - Schema
- `packages/orchestrator/src/hexagonal/adapters/redis-bus.adapter.ts` - Bus
- `packages/agents/base-agent/src/base-agent.ts` - Validation

---

## 🚀 Quick Start (Detailed)

For fast reference, see **🤖 FOR AI AGENTS** section above.

Full development workflow:

```bash
# Terminal 1: Start infrastructure
./dev start              # Start all services (~60 seconds)

# Terminal 2: Enable auto-rebuild
./dev watch             # Auto-rebuild on code changes

# Terminal 3: View services
./dev dashboard          # Open dashboard (localhost:3050)
./dev api                # Open orchestrator API (localhost:3051)

# Monitoring
./dev status             # Show service status
./dev health             # Health checks
./dev logs               # Show logs

# Cleanup
./dev stop               # Stop all services gracefully
./dev restart            # Restart all services
```

**Service URLs:**
- Dashboard UI: http://localhost:3050
- Orchestrator API: http://localhost:3051/api/v1/health
- PostgreSQL: localhost:5433 (user: agentic, db: agentic_sdlc)
- Redis: localhost:6380

---

## ✅ Current Status

**Phase 7B COMPLETE (45 hours, ON TIME) + Session #79 Critical Fixes**
- ✅ 27+ CLI commands fully implemented
- ✅ 7 core services (API, DB, Config, Test, Deploy, Metrics, Advanced)
- ✅ 2,050+ lines of production code
- ✅ 121+ test cases, 0 TypeScript errors
- ✅ All 21 packages building successfully
- ✅ 99%+ production ready

**Session #80: Dashboard E2E Testing & Trace Visualization (COMPLETE)**
- ✅ **Infrastructure:** Terraform deployment with Docker containers (Dashboard, Orchestrator, PostgreSQL, Redis)
- ✅ **Mock E2E Workflows:** Created 3+ test workflows (feature, bugfix, app types) for integration testing
- ✅ **Traces Page Fix:** Fixed undefined metadata errors with defensive null checks and optional chaining
- ✅ **Trace Details Page:** Created new dedicated TraceDetailPage component showing:
  - Summary metrics (Trace ID, Status, Start time, Duration)
  - Key metrics (Workflows, Tasks, Spans, Errors)
  - Detailed workflows table with name, type, status, priority
  - Span breakdown with entity type and duration
- ✅ **React Router Integration:** Proper routing with `/traces/:traceId` for detail view
- ✅ **Responsive UI:** Grid layouts with proper Tailwind styling and status badges

**Session #79: Critical Status Consistency Audit (COMPLETE)**
- ✅ **Phase 1:** Unified Status Enums - PipelineStatus 'success'→'completed', added PAUSED state
- ✅ **Phase 2:** Fixed Terminal State Persistence - notifyError/notifyCancellation now persist to DB before publishing
- ✅ **Phase 3:** Restored Distributed Tracing - Propagate trace_id from RequestContext in all events
- ✅ **Phase 5:** Improved Code Quality - Renamed updateWorkflowStatus→updateWorkflowStage, enhanced logging
- ⏳ **Phase 4:** Deferred - Pipeline pause/resume persistence (requires Prisma schema migration, low priority)

**Build & Test Validation (Session #79):**
- ✅ Full TypeScript compilation: 21 packages, 0 errors
- ✅ Unit tests: 10 test suites passing
- ℹ️ analytics-service test failure pre-existing (no test files)

**Recent Additions (Session #77):**
- ✅ Mock Agent Behavior Metadata System - Flexible test scenario creation
- ✅ Logging Levels Definition - 6 tiers, environment configs, module-specific
- ✅ Comprehensive Documentation - 3,000+ lines across 9 docs

**System Status:**
- ✅ AgentEnvelope v2.0.0 schema validation
- ✅ Redis Streams message bus with ACK
- ✅ Definition-driven workflow routing
- ✅ Platform-scoped agent registry
- ✅ 130+ integration tests
- ✅ Dashboard platform-aware with Traces visualization (Session #80)
- ✅ Trace detail page with hierarchical data display (Session #80)
- ✅ React Router integration for SPA navigation (Session #80)
- ✅ Structured logging (Pino) integrated
- ✅ Status enum consistency (Session #79)
- ✅ Terminal state persistence (Session #79)
- ✅ Distributed tracing restoration (Session #79)

---

## 📚 Key Documentation

- **LOGGING_LEVELS.md** - Log level hierarchy, environments, modules
- **LOGGING_IMPLEMENTATION.md** - How-to guide with 5 patterns
- **AGENTIC_SDLC_RUNBOOK.md** - Operational guide
- **STRATEGIC-ARCHITECTURE.md** - Multi-platform strategy
- **Behavior Metadata Guide** - Mock agent test scenarios

---

## 🎯 Completed Enhancements (Session #80)

**Dashboard & E2E Testing:**
- ✅ Mock E2E test workflows (feature, bugfix, app types)
- ✅ Traces page with list view and filtering
- ✅ Trace detail page with full hierarchy visualization
- ✅ React Router integration for SPA navigation
- ✅ Defensive null checking for metadata fields
- ✅ Responsive grid layouts with Tailwind

## 🎯 Optional Polish Items (Low Priority)

**Platform is production-ready. These are enhancements only:**

1. Remove DEBUG console.log statements (30 min)
2. File-based log rotation (1-2 hours)
3. Advanced trace tree visualization (2-3 hours)
4. Dashboard performance analytics pages (2-3 hours)

---