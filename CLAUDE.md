# CLAUDE.md - AI Assistant Guide for Agentic SDLC

**Status:** ✅ Phase 7B Complete + Session #84 (Deployment Pipeline) | **Updated:** 2025-11-19 | **Version:** 57.0

**📚 Key Resources:** [Runbook](./AGENTIC_SDLC_RUNBOOK.md) | [Logging](./LOGGING_LEVELS.md) | [Strategy](./STRATEGIC-ARCHITECTURE.md) | [Behavior Metadata](./packages/agents/generic-mock-agent/BEHAVIOR_METADATA_GUIDE.md) | [GitHub Repo](https://github.com/gregd453/agentic-sdlc) | [GitHub Actions](https://github.com/gregd453/agentic-sdlc/actions) | [Deployment Pipeline](./DEPLOYMENT_PIPELINE.md) | [Quick Start](./DEPLOYMENT_QUICKSTART.md)

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

# Complete reset (clears everything, rebuilds from scratch)
./infrastructure/local/full-reset.sh              # Full reset with migrations
CLEAN_NODE_MODULES=true ./infrastructure/local/full-reset.sh  # Full reset + npm reinstall

# Post-deployment health checks
./infrastructure/local/post-deploy-validation.sh  # Verify all services healthy

# Emergency: Check what's using a port
lsof -i :3051                       # Check orchestrator port
lsof -i :3050                       # Check dashboard port
```

**React Component Changes:**
```bash
# Changes automatically propagate through:
# 1. Source code changes
# 2. Vite build (with asset hashing)
# 3. Docker image rebuild
# 4. Container restart
# 5. Browser cache invalidation (automatic via hash)

./dev watch  # Enables auto-rebuild on file changes
# Make edits → save → 2s → dashboard rebuilds → browser refreshes
```

---

## 🔄 CI/CD & Deployment

### GitHub Actions (Automated Cloud Deployment)
**Workflow:** `.github/workflows/deploy.yml` - Auto-triggers on push to main
```bash
# View workflow runs
gh run list -R gregd453/agentic-sdlc --limit 10

# Check specific run details
gh run view <run-id> -R gregd453/agentic-sdlc

# View workflow actions
https://github.com/gregd453/agentic-sdlc/actions
```

**Pipeline Stages:**
1. **Test Job** - Linter, TypeScript check, build
2. **Security Job** - Trivy vulnerability scan
3. **Deploy Job** - Terraform apply to infrastructure
4. **Health Check Job** - Verify Dashboard & API endpoints
5. **Notify Job** - Report deployment status

### Local Pre-Push Hook (Developer Validation)
**Hook:** `.git/hooks/pre-push` - Runs BEFORE any push to GitHub
```bash
# The hook runs automatically. To verify it's executable:
ls -la .git/hooks/pre-push     # Should show -rwx------

# If not executable:
chmod +x .git/hooks/pre-push
```

**What the hook does:**
- Runs linter (catches style issues)
- Runs TypeScript check (catches type errors)
- Runs full build (ensures packages compile)
- **Blocks push** if any check fails (prevents broken code on main)

**Workflow when making changes:**
```bash
# 1. Make code changes
# 2. Commit your work
git commit -m "feat: your feature here"

# 3. Try to push (hook runs automatically)
git push origin main
# ↓ Pre-push hook validates...
# 🔍 Running linter... ✓
# 🔍 Running TypeScript check... ✓
# 🔍 Building packages... ✓
# ✅ All pre-push checks passed! Ready to push.
# ↓ Push succeeds → GitHub Actions auto-triggers
```

### Deployment Pipeline (Session #84)
**Automated Component Change Propagation:**
- ✅ **Production Dockerfile** (Dockerfile.prod) - Multi-stage build with Vite asset hashing
- ✅ **Smart Cache Control** - Hashed assets cached 1 year, index.html never cached (cache-busting)
- ✅ **Automated Migrations** - Prisma migrations run automatically during reset
- ✅ **Post-Deploy Validation** - Comprehensive health checks verify all services
- ✅ **Complete Documentation** - [DEPLOYMENT_PIPELINE.md](./DEPLOYMENT_PIPELINE.md) & [DEPLOYMENT_QUICKSTART.md](./DEPLOYMENT_QUICKSTART.md)

**One-Command Complete Reset:**
```bash
./infrastructure/local/full-reset.sh
# Does everything automatically:
# 1. Stops all services
# 2. Destroys Docker infrastructure
# 3. Clears React artifacts
# 4. Resets Terraform state
# 5. Rebuilds Docker image
# 6. Applies Terraform
# 7. Runs Prisma migrations (NEW)
# 8. Starts Orchestrator API (NEW)
# 9. Starts PM2 agents (NEW)
# 10. Validates all services
# Result: Everything running and healthy
```

### Git History Management
**Large files have been cleaned** using `git-filter-repo`:
- Removed log files >100MB from entire history
- Repository is now lean and fast to clone
- Do NOT commit large files (.log, .tmp, cache/ directories)

**If you accidentally commit a large file:**
```bash
# 1. Remove from working directory
git rm --cached <large-file>
git commit --amend

# 2. Use git-filter-repo to remove from history
git filter-repo --path <large-file> --invert-paths --force

# 3. Force push
git push origin main -f
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

**Session #84: Deployment Pipeline & Automated Reset (COMPLETE)**
- ✅ **Infrastructure Audit:** Identified and fixed 5 critical deployment gaps
  - Dev server in production (now: Production Dockerfile.prod with Express)
  - Unused build artifacts (now: Integrated into Docker image)
  - No cache invalidation (now: Smart cache headers with Vite asset hashing)
  - Missing health verification (now: Complete post-deploy validation)
  - Incomplete component propagation (now: Full automation)
- ✅ **Automated Full Reset:** `./infrastructure/local/full-reset.sh` does everything
  - Destroys and recreates Docker infrastructure
  - Clears React artifacts and caches
  - Resets Terraform state
  - Rebuilds Docker image with Dockerfile.prod
  - Applies Terraform infrastructure
  - **NEW:** Runs 7 Prisma migrations automatically
  - **NEW:** Starts Orchestrator API with health check
  - **NEW:** Starts all 5 PM2 agent services
  - Validates all services are healthy
  - Time: ~60 seconds (full automation, zero manual steps)
- ✅ **Cache Invalidation Strategy:** Smart HTTP headers
  - Hashed assets: 1 year cache (immutable, content-addressed)
  - index.html: No-cache (always gets latest asset references)
  - Automatic cache-busting when component changes
- ✅ **Complete Documentation:**
  - [DEPLOYMENT_PIPELINE.md](./DEPLOYMENT_PIPELINE.md) - Architecture & flows
  - [DEPLOYMENT_QUICKSTART.md](./DEPLOYMENT_QUICKSTART.md) - Quick reference
- ✅ **Dashboard Fixes:** Fixed 24+ TypeScript errors in server code
  - Corrected Prisma field names (camelCase → snake_case)
  - Added proper response headers
  - Cache control middleware

**Session #83: CI/CD & GitHub Actions Integration (COMPLETE)**
- ✅ **GitHub Actions Workflow:** Full pipeline with 5 jobs (test → security scan → deploy → health check → notify)
  - Automated test validation (linter, TypeScript, build)
  - Security scanning with Trivy
  - Terraform infrastructure deployment
  - Health checks for Dashboard (3050) and Orchestrator API (3051)
  - Auto-triggers on push to main branch
- ✅ **Git History Cleanup:** Removed 3.3GB+ log files from history using `git-filter-repo --strip-blobs-bigger-than 100M`
- ✅ **Pre-Push Hook:** Local validation hook configured and executable
  - Runs: linter → TypeScript check → build before allowing push
  - Prevents pushing failing code
  - Colored console output for user feedback
- ✅ **Repository Push:** Successfully pushed cleaned history to GitHub
  - Repository: https://github.com/gregd453/agentic-sdlc
  - Workflows automatically triggered and running
  - All 3 GitHub Actions workflows visible in Actions tab

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

## 📋 Next Steps for Future Agents

### Ready to Start Working?
**Status:** Platform is fully operational with local and cloud CI/CD
- ✅ All services running (Dashboard, Orchestrator, PostgreSQL, Redis)
- ✅ GitHub Actions pipeline auto-configured
- ✅ Pre-push hook prevents broken code from being pushed
- ✅ Phase 3 UI implementation complete (Mock Workflow Pipeline Builder)

### What to Work On:
1. **Phase 4 - Pipeline Pause/Resume** (Low Priority)
   - Requires Prisma schema migration for workflow state persistence
   - Estimated: 2-3 hours
   - Epic: Store/restore workflow state between pause and resume

2. **Polish Items** (Low Priority)
   - Remove DEBUG console.log statements
   - Implement file-based log rotation
   - Advanced trace visualization improvements
   - Dashboard analytics pages

3. **New Features** (As Requested)
   - Expand agent capabilities
   - Add new service types
   - Enhance dashboard features
   - Improve CLI commands

### Development Workflow:
```bash
# 1. Start services
./dev start

# 2. Enable auto-rebuild (in another terminal)
./dev watch

# 3. Make changes and commit
git commit -m "feat: your feature"

# 4. Push (pre-push hook validates automatically)
git push origin main

# 5. GitHub Actions auto-triggers for cloud deployment
# → Check status: https://github.com/gregd453/agentic-sdlc/actions
```

### Important Notes for Future Agents:
- **Always use**: `./dev start` to begin development
- **Always test**: Pre-push hook will run automatically on push attempts
- **Never ignore**: TypeScript errors or linter warnings
- **Review**: `.gitignore` before committing large files
- **Monitor**: GitHub Actions tab for deployment status
- **Document**: Changes in this CLAUDE.md file before completing work

---