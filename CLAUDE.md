# CLAUDE.md - AI Assistant Guide for Agentic SDLC

**Status:** ✅ Phase 7B Complete + Session #85 (Dashboard Agent Extensibility) + Session #86 (Dashboard Rebuild Automation) | **Updated:** 2025-11-20 | **Version:** 60.0

**📚 Key Resources:** [Runbook](./AGENTIC_SDLC_RUNBOOK.md) | [Logging](./LOGGING_LEVELS.md) | [Strategy](./STRATEGIC-ARCHITECTURE.md) | [Agent Guide](./AGENT_CREATION_GUIDE.md) | [Dashboard Rebuild](./DASHBOARD_REBUILD.md) | [Behavior Metadata](./packages/agents/generic-mock-agent/BEHAVIOR_METADATA_GUIDE.md) | [GitHub Repo](https://github.com/gregd453/agentic-sdlc) | [GitHub Actions](https://github.com/gregd453/agentic-sdlc/actions) | [Deployment Pipeline](./DEPLOYMENT_PIPELINE.md) | [Quick Start](./DEPLOYMENT_QUICKSTART.md)

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
- **Custom Agents**: [AGENT_CREATION_GUIDE.md](./AGENT_CREATION_GUIDE.md) ⭐ NEW (Session #85)
- **Ports**: [PORT_CONFIGURATION.md](./PORT_CONFIGURATION.md)
- **Schemas**: [Agent Envelope v2.0](./packages/shared/types/src/messages/agent-envelope.ts)
- **Logging**: [LOGGING_LEVELS.md](./LOGGING_LEVELS.md)

**Common Tasks:**
```bash
# Restart specific service
./dev restart-orchestrator          # Restart just orchestrator
./dev restart-agents                # Restart just agents

# Rebuild & redeploy dashboard (NEW - Session #86)
./dev rebuild-dashboard             # Rebuild React + Docker image + restart container
# Automates: pnpm build → docker build → container restart → health check

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

# Custom Agents (NEW - Session #85)
agentic list-agents                           # List all registered agents
agentic list-agents --platform my-platform   # List agents for specific platform
agentic validate-workflow workflow.json       # Validate workflow definition
```

**Dashboard Development Workflow:**
```bash
# Edit dashboard components: packages/dashboard/src/**/*.tsx

# Quick redeploy after code changes (NEW - Session #86)
./dev rebuild-dashboard

# OR manual process (if needed more control):
source .env.development
pnpm run build --filter=@agentic-sdlc/dashboard
docker build -f packages/dashboard/Dockerfile.prod -t agentic-sdlc-dashboard:latest .
docker rm -f agentic-sdlc-dev-dashboard && docker run -d --name agentic-sdlc-dev-dashboard --network agentic-network -p 3050:3050 -e NODE_ENV=production -e PORT=3050 agentic-sdlc-dashboard:latest

# After deploy: Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
```

**React Component Changes:**
```bash
# Standard workflow:
# 1. Edit component (packages/dashboard/src/...)
# 2. Run: ./dev rebuild-dashboard
# 3. Hard refresh browser: Ctrl+Shift+R (or Cmd+Shift+R on Mac)

# Expected time: 30-60 seconds
#   - React build: 5-10s
#   - Docker image: 15-30s
#   - Container restart: 5-10s
#   - Health check: 1-5s

# Automated rebuild process includes:
# 1. Load environment variables
# 2. Build React app (pnpm)
# 3. Build Docker image (with Prisma generation)
# 4. Stop old container
# 5. Start new container with proper networking
# 6. Verify health check (HTTP 200)

# See DASHBOARD_REBUILD.md for detailed guide
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
7. ✅ **Custom Agents:** Any agent extending BaseAgent with any string agent_type (Session #85)
   - agent_type now accepts arbitrary strings (kebab-case: ml-training, data-validation, etc)
   - Validation happens BEFORE task creation via validateAgentExists()
   - See AGENT_CREATION_GUIDE.md for complete pattern

**Critical Files (Never Duplicate):**
- `packages/shared/types/src/messages/agent-envelope.ts` - Schema
- `packages/orchestrator/src/hexagonal/adapters/redis-bus.adapter.ts` - Bus
- `packages/agents/base-agent/src/base-agent.ts` - Validation
- `packages/shared/agent-registry/src/agent-registry.ts` - Agent validation (NEW - Session #85)

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

**Phase 7B COMPLETE (45 hours, ON TIME) + Session #85 (Unbounded Agent Extensibility)**
- ✅ 27+ CLI commands fully implemented
- ✅ 7 core services (API, DB, Config, Test, Deploy, Metrics, Advanced)
- ✅ 2,050+ lines of production code
- ✅ 121+ test cases, 0 TypeScript errors
- ✅ All 21 packages building successfully
- ✅ 100%+ production ready (Agent extensibility complete)

**Session #86: Dashboard Rebuild Automation (COMPLETE)**
- ✅ **Workflow Save Feature**
  - SaveWorkflowDefinitionModal component for persisting workflows
  - "💾 Save as Definition" button in WorkflowPipelineBuilder
  - Form validation (name, platform, version, description)
  - Integration with createWorkflowDefinition API
  - Saved workflows reloadable via "Load from Saved Definition"
- ✅ **Build Automation Script**
  - Created `scripts/rebuild-dashboard.sh` (95 lines)
  - Automates: pnpm build → docker build → container restart → health check
  - Added `./dev rebuild-dashboard` command to dev script
  - Eliminates manual 5-step process
  - Expected execution time: 30-60 seconds
- ✅ **Dashboard Rebuild Documentation**
  - Created DASHBOARD_REBUILD.md with complete developer guide
  - Includes troubleshooting section for common issues
  - Manual process reference for advanced users
- ✅ **CLAUDE.md Updates**
  - Added dashboard development workflow
  - Documented automated rebuild process
  - Updated key resources and status
- ✅ **Git Commits:**
  - ddb2c17: feat: Add automated dashboard rebuild script and dev command
  - d84c88c: docs: Add dashboard rebuild guide and reference

**Session #85: Unbounded Agent Extensibility + Dashboard Integration (COMPLETE)**

*Phase 1: Core Extensibility (P0-P1)*
- ✅ **Type System Flexibility:** AgentTypeEnum → AgentTypeSchema (accepts any string)
  - Custom agents can use any agent_type identifier (kebab-case)
  - Predefined types: scaffold, validation, e2e_test, integration, deployment, monitoring, debug, recovery
  - Built-in agent type constants and naming conventions documented
- ✅ **Agent Registry Enhancement:** validateAgentExists() with intelligent error messages
  - Platform-scoped + global agent routing
  - Levenshtein distance typo detection ("Did you mean?")
  - Shows available agents for current platform
- ✅ **Orchestrator Validation (CRITICAL):** Fail-fast before task creation
  - Validates agent exists in createTaskForStage() BEFORE persistence
  - Prevents orphaned tasks in Redis queue
  - Updates workflow status to 'failed' with clear error messages
  - Publishes WORKFLOW_FAILED event for monitoring
- ✅ **Complete Documentation:** AGENT_CREATION_GUIDE.md (800+ lines)
  - 5-minute quick start
  - 8 complete, runnable code examples (ML training agent, etc)
  - 6 common patterns with code
  - Testing guide (unit + E2E)
  - Troubleshooting section
  - Deployment checklist
- ✅ **Architecture Achievement:** Platforms now support ANY agent extending BaseAgent
  - Zero breaking changes (100% backward compatible)
  - TypeScript: 0 errors
  - Build: 100% success rate
  - Ready for production deployment

*Phase 2-4: Dashboard Integration (P2-P4) - NEW THIS SESSION*
- ✅ **P2: Platform-Agent Visualization**
  - New `/api/v1/platforms/:id/agents` endpoint showing available agents per platform
  - PlatformCard component - clickable cards with agent/workflow counts
  - AgentMatrixTable - comprehensive agent listing (type, version, scope, timeout, capabilities)
  - PlatformDetailsPage - full platform view with analytics and agent matrix
  - Route: `/platforms/:id` for detailed platform inspection
- ✅ **P3: Trace Agent Context**
  - Tasks section in TraceDetailPage with agent_type column (blue code badges)
  - TaskDetailsModal - deep-dive task inspection with agent metadata
  - Shows task info (ID, workflow, status, duration, retries) + agent details
  - Display task payload and result in formatted JSON
  - Full dark mode and responsive design
- ✅ **P4: Client-Side Workflow Validation**
  - useWorkflowValidation hook with Levenshtein distance typo detection
  - ValidationErrorCard component for error display with suggestions
  - Auto-validates workflow stages on changes
  - Submit button states: "✓ Create Workflow" / "✗ Fix Errors" / "⏳ Validating..."
  - Clickable suggestions to auto-fix invalid agent types
  - Non-blocking validation with graceful degradation
- ✅ **Components & Hooks Created:** 6 UI components + 1 validation hook
  - PlatformCard, AgentMatrixTable, PlatformDetailsPage
  - TaskDetailsModal, ValidationErrorCard, AgentSelector, SchemaFormBuilder
  - useWorkflowValidation with intelligent suggestions
- ✅ **Quality Metrics:**
  - TypeScript: 0 errors (verified)
  - New Code: 800+ lines
  - Full dark mode support
  - Responsive mobile-first design
  - Git Commit: 5a7b0fd

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
- ✅ Platform-scoped agent registry with typo detection
- ✅ Unbounded agent extensibility (custom agent_type support)
- ✅ 130+ integration tests
- ✅ Dashboard platform-aware with Traces visualization (Session #80)
- ✅ Trace detail page with hierarchical data display (Session #80)
- ✅ React Router integration for SPA navigation (Session #80)
- ✅ Structured logging (Pino) integrated
- ✅ Status enum consistency (Session #79)
- ✅ Terminal state persistence (Session #79)
- ✅ Distributed tracing restoration (Session #79)
- ✅ Platform visualization with agent matrix (Session #85 P2)
- ✅ Trace task details modal with agent metadata (Session #85 P3)
- ✅ Client-side workflow validation with suggestions (Session #85 P4)

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
**Status:** Platform is fully operational with complete dashboard agent extensibility
- ✅ All services running (Dashboard, Orchestrator, PostgreSQL, Redis)
- ✅ GitHub Actions pipeline auto-configured
- ✅ Pre-push hook prevents broken code from being pushed
- ✅ Full dashboard integration complete (Platform discovery, trace context, validation)
- ✅ Unbounded agent extensibility production-ready (any custom agent_type supported)

### What to Work On:
1. **Integration Testing** (Recommended Next)
   - End-to-end workflow creation with custom agents
   - Platform visualization and agent discovery flows
   - Validation suggestions in real-world scenarios
   - Estimated: 1-2 hours

2. **Optional Enhancements** (Low Priority)
   - Pipeline pause/resume (requires Prisma migration, 2-3 hours)
   - Remove DEBUG console.log statements (30 min)
   - Implement file-based log rotation (1-2 hours)
   - Advanced trace tree visualization (2-3 hours)
   - Dashboard performance analytics pages (2-3 hours)

3. **New Features** (As Requested)
   - Expand agent capabilities
   - Add new service types
   - Enhance dashboard features
   - Improve CLI commands
   - Custom platform creation UI

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