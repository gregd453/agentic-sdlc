# EPCC Exploration: Unified Command Center CLI for Agentic SDLC

**Date:** 2025-11-16 | **Session:** #75 | **Phase:** EXPLORE (CLI Command Center)

---

## Executive Summary

The Agentic SDLC platform is a sophisticated autonomous AI-driven system with complex infrastructure, multi-platform support, and comprehensive CI/CD. However, operational control is fragmented across **45+ shell scripts**, PM2 configuration, Docker Compose, and GitHub Actions. This exploration identifies the gaps and designs a unified **Command Center CLI** that provides:

- **Cohesive Interface:** Single command structure for all operations
- **AI-Agent Ready:** Machine-parseable output, error codes, structured responses
- **Production-Grade:** Deployment management, health monitoring, rollback capabilities
- **Developer-Friendly:** Clear documentation, helpful error messages, status indicators
- **CI/CD Integrated:** Works seamlessly with GitHub Actions and deployment pipelines

**Current Production Readiness:** 99.5% (Phase 6 complete)
**Infrastructure Complexity:** High (7 services, 3 databases, distributed architecture)
**Command Fragmentation:** ~45 scattered scripts across scripts/ directory

---

## Part 1: Current Infrastructure Overview

### 1.1 Service Architecture

```
┌──────────────────────────────────────────────────────────┐
│          OPERATIONAL LAYER (FRAGMENTED)                  │
├──────────────────────────────────────────────────────────┤
│ • 45+ shell scripts (start-dev.sh, stop-dev.sh, etc)     │
│ • PM2 ecosystem config (6 processes: orch + 5 agents)    │
│ • Docker Compose (postgres, redis, dashboard, analytics) │
│ • GitHub Actions (4 workflows - CI/CD)                   │
│ • Turbo build orchestration (pnpm workspaces)           │
└──────────────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────────────┐
│         SERVICES (PHASE 6 COMPLETE)                      │
├──────────────────────────────────────────────────────────┤
│ • Orchestrator API (3000) - REST, WebSocket, Health     │
│ • 5 Agent Services - Scaffold, Validation, E2E, etc     │
│ • Dashboard UI (3001) - React, real-time                │
│ • Analytics Service (3002) - 12 read-only APIs          │
│ • PostgreSQL (5433) - Primary database                  │
│ • Redis (6380) - Message bus (streams)                  │
└──────────────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────────────┐
│      HEXAGONAL CORE (PROTECTED, PHASES 1-6)             │
├──────────────────────────────────────────────────────────┤
│ • Workflow State Machine                                │
│ • Agent Envelope Messaging (v2.0.0)                     │
│ • Distributed Tracing                                   │
│ • Platform-Aware Workflow Engine                        │
└──────────────────────────────────────────────────────────┘
```

### 1.2 Key Technologies

| Component | Technology | Status |
|-----------|-----------|--------|
| Language | TypeScript 5.3 | ✅ Stable |
| Monorepo | pnpm workspaces + Turbo | ✅ Stable |
| API | Fastify + REST | ✅ Stable |
| Message Bus | Redis Streams | ✅ Stable |
| Database | PostgreSQL 16 + Prisma | ✅ Stable |
| Processes | PM2 cluster mode | ✅ Stable |
| Containers | Docker/Docker Compose | ✅ Stable |
| CI/CD | GitHub Actions | ✅ Stable |
| Testing | Vitest | ✅ Stable |
| UI | React + TypeScript | ✅ Stable |

---

## Part 2: Current Operational Landscape (The Problem)

### 2.1 Fragmented Command Structure

```
scripts/ directory contains 45+ files:
├── env/
│   ├── start-dev.sh           ← Main startup (8.4 KB)
│   ├── stop-dev.sh            ← Graceful shutdown (3.9 KB)
│   ├── check-health.sh        ← Health monitoring (3.9 KB)
│   ├── reset-dev.sh           ← Nuclear reset (2.9 KB)
│   └── QUICK_REFERENCE.md     ← Manual documentation
├── tests/                      ← 41 test scripts (test-box-1 to 41)
├── logs/                       ← 6 service log files
├── pm2-preflight.sh           ← Build artifact validation
├── e2e-test-agent.sh          ← Agent testing
├── cleanup-test-env.sh        ← Test cleanup
└── (30+ more scripts)         ← Ad-hoc operations
```

**Problems:**
1. ❌ **No Single Entry Point** - Users must know which script
2. ❌ **Inconsistent Naming** - start-dev.sh vs e2e-test-agent.sh
3. ❌ **Manual Orchestration** - Complex workflows need multiple scripts
4. ❌ **Limited Error Recovery** - No automatic rollback/retry
5. ❌ **Hard to Automate** - AI agents can't parse colored output
6. ❌ **Scattered Logic** - Bugs hard to track across 45 files
7. ❌ **Poor Discoverability** - How to find what command?
8. ❌ **No Structured Output** - Mix of echo, colors, inconsistent format

### 2.2 Current PM2 Configuration (6 Processes)

```javascript
ecosystem.config.js:
- orchestrator        (cluster mode, CPU cores, max 1GB)
- scaffold-agent      (2 instances, cluster mode, max 512MB)
- validation-agent    (2 instances, cluster mode, max 512MB)
- e2e-agent          (2 instances, cluster mode, max 1GB)
- integration-agent   (2 instances, cluster mode, max 512MB)
- deployment-agent    (2 instances, cluster mode, max 512MB)
```

**Gaps:**
- ❌ No health monitoring integration
- ❌ No automatic recovery on failure
- ❌ No log rotation configured
- ❌ No metrics collection

### 2.3 Docker Compose Services (4 Containers)

```yaml
postgres:3000    → 5433
redis:6380       → 6379
dashboard:3001   → 3001
analytics:3002   → 3001 (port conflict in docker)
```

**Gaps:**
- ❌ Analytics service startup is non-critical (doesn't block)
- ❌ Orchestrator runs both PM2 and Docker (conflict!)
- ❌ Health checks not integrated with PM2

### 2.4 GitHub Actions CI/CD (4 Workflows, 937 lines)

```
ci-cd.yml (369 lines)
├─ Job 1: Quality (lint, typecheck, format)
├─ Job 2: Tests (unit + integration + coverage)
├─ Job 3: Security (npm audit + Trivy scanner)
├─ Job 4: Build (Docker image)
├─ Job 5: Deploy Staging (develop branch)
├─ Job 6: Deploy Prod (main branch, blue-green)
└─ Job 7: Rollback (auto on failure)

+ 3 more workflows (deploy-with-validation, generate-and-test, performance)
```

**Gap:**
- ❌ Can't test locally before push

### 2.5 REST API Structure (8 Routes, 1,626 lines)

```
orchestrator/src/api/routes/
├─ health.routes.ts        ✅ Health endpoints
├─ workflow.routes.ts      ✅ CRUD + filtering
├─ task.routes.ts         ✅ Agent task management
├─ pipeline.routes.ts     ✅ Pipeline execution
├─ trace.routes.ts        ✅ Distributed tracing
├─ scaffold.routes.ts     ✅ Code generation
├─ stats.routes.ts        ✅ Analytics
└─ platform.routes.ts     ✅ Multi-platform (Phase 5)
```

**Gap:**
- ❌ No unified operational endpoint (all management scattered)

### 2.6 Test Infrastructure (41 Scripts)

```
Tier 1 (Trivial):  test-box-1 through 5      (5 tests, ~5-10 min)
Tier 2 (Easy):     test-box-6 through 13     (8 tests, ~15-25 min)
Tier 3 (Medium):   test-box-14 through 20    (7 tests, ~30-40 min)
Tier 4 (Hard):     test-box-21 through 41    (21 tests, ~60-90 min)
```

**Gap:**
- ❌ No test runner UI
- ❌ Manual script selection
- ❌ No parallel execution
- ❌ No result aggregation

---

## Part 3: Identified Requirements

### 3.1 Command Center Design (Proposed)

```bash
agentic-sdlc <command> [subcommand] [options]

Commands:
├── start              Start environment
├── stop               Stop environment  
├── restart            Restart services
├── reset              Reset (data loss!)
├── status             Show status
├── logs               View logs
├── health             Health checks
├── build              Build packages
├── test               Run tests
├── deploy             Deployment ops
├── db                 Database ops
├── agents             Agent management
├── workflows          Workflow ops
└── help               Show help
```

### 3.2 Core Commands Needed

```bash
# Environment
agentic-sdlc start [--services=NAME] [--verbose]
agentic-sdlc stop [--force]
agentic-sdlc restart [--service=NAME]
agentic-sdlc reset [--confirm]
agentic-sdlc status [--json] [--watch]

# Health & Diagnostics
agentic-sdlc health [--verbose] [--wait=60s]
agentic-sdlc health:services
agentic-sdlc health:database
agentic-sdlc health:agents

# Testing
agentic-sdlc test [--tier=1-4] [--match=pattern]
agentic-sdlc test:units
agentic-sdlc test:integration
agentic-sdlc test:e2e [--workflow=NAME]
agentic-sdlc validate:ci [--local]

# Logs & Monitoring
agentic-sdlc logs [--service=NAME] [--follow] [--lines=100]
agentic-sdlc metrics [--service=NAME] [--period=1h]

# Deployment
agentic-sdlc deploy [--env=staging|prod] [--dry-run]
agentic-sdlc deploy:validate
agentic-sdlc deploy:rollback [--env=prod]

# Database
agentic-sdlc db:setup
agentic-sdlc db:migrate
agentic-sdlc db:reset [--confirm]
agentic-sdlc db:backup

# Workflows & Agents
agentic-sdlc workflows:list [--status=running]
agentic-sdlc workflows:get <id> [--json]
agentic-sdlc agents:list [--json]
agentic-sdlc agents:status [--platform=NAME]
```

### 3.3 Output Formats

```bash
# Human-friendly (default)
$ agentic-sdlc start
Starting environment...
✓ Docker containers ready
✓ Orchestrator started
✓ Agents started
✅ Ready in 45s

# Machine-readable (--json)
$ agentic-sdlc start --json
{
  "success": true,
  "code": 0,
  "duration": 45000,
  "services": {...}
}

# Error case (clear exit code)
$ agentic-sdlc start
Error: Port 3000 in use
❌ Failed
Exit: 3
```

---

## Part 4: Architecture & Design

### 4.1 Proposed CLI Package Structure

```
packages/cli/
├── src/
│   ├── index.ts              # Entry point
│   ├── commands/             # Command implementations (20+)
│   │   ├── start.ts
│   │   ├── stop.ts
│   │   ├── status.ts
│   │   ├── health.ts
│   │   ├── logs.ts
│   │   ├── test.ts
│   │   ├── deploy.ts
│   │   ├── db.ts
│   │   ├── workflows.ts
│   │   └── agents.ts
│   ├── services/             # Core logic (7 services)
│   │   ├── environment.service.ts
│   │   ├── health.service.ts
│   │   ├── logs.service.ts
│   │   ├── test.service.ts
│   │   ├── deploy.service.ts
│   │   ├── api-client.ts
│   │   └── database.service.ts
│   ├── utils/                # Utilities (5 files)
│   │   ├── output-formatter.ts
│   │   ├── logger.ts
│   │   ├── shell.ts
│   │   └── validators.ts
│   ├── types/
│   └── config/
├── tests/
├── package.json
└── tsconfig.json
```

### 4.2 Technology Choices

| Component | Choice | Reason |
|-----------|--------|--------|
| CLI Framework | Commander.js | Simple, popular, TS support |
| Colors | chalk | Standard in Node.js CLIs |
| Tables | table | ASCII tables for output |
| Process Mgmt | Query PM2 API | Don't interfere with clusters |
| Testing | Vitest | Already in project |
| Output Format | JSON + text | Both humans and AI agents |

### 4.3 Service Startup Order (Dependency Graph)

```
1. Validation (input, env checks)
2. Prerequisites (Docker, node, pnpm)
3. Docker services (postgres, redis, analytics)
   └─ Wait for health checks
4. Build (Turbo pnpm if needed)
5. PM2 processes (orchestrator + 5 agents)
6. Health checks (all services)
7. Ready!
```

### 4.4 Integration Points

```
CLI Package
├─ Turbo: pnpm build, test, typecheck
├─ PM2: pm2 start/stop/logs/status
├─ Docker: docker-compose up/down
├─ Prisma: migrate, db push, seed
├─ Vitest: run tests, coverage
└─ Orchestrator API: HTTP endpoints
```

---

## Part 5: Command Categories & Examples

### 5.1 Environment Management (5 commands)

```bash
agentic-sdlc start
# Starts Docker containers + PM2 processes

agentic-sdlc stop [--force]
# Graceful shutdown (or force kill)

agentic-sdlc restart [--service=NAME]
# Restart specific service or all

agentic-sdlc status [--watch]
# Show current status (update live with --watch)

agentic-sdlc reset --confirm
# Complete reset (data loss!)
```

### 5.2 Health & Monitoring (4 commands)

```bash
agentic-sdlc health
# All checks in one command

agentic-sdlc health:services
# Just service health

agentic-sdlc health:database
# Database connectivity

agentic-sdlc health:agents
# Agent registration & connection
```

### 5.3 Testing (6 commands)

```bash
agentic-sdlc test --tier 1
# Run Tier 1 tests (5 tests, ~5-10 min)

agentic-sdlc test --match "Hello World"
# Run tests matching pattern

agentic-sdlc test:units
# Unit tests only

agentic-sdlc test:integration
# Integration tests only

agentic-sdlc test:e2e
# E2E workflow tests

agentic-sdlc validate:ci --local
# Validate before commit
```

### 5.4 Deployment (3 commands)

```bash
agentic-sdlc deploy --env staging --dry-run
# Show what would deploy

agentic-sdlc deploy --env production --approve
# Deploy with approval

agentic-sdlc deploy:rollback --env prod
# Automatic rollback
```

### 5.5 Database (4 commands)

```bash
agentic-sdlc db:setup
# Initial setup

agentic-sdlc db:migrate
# Apply pending migrations

agentic-sdlc db:reset --confirm
# Clear all data

agentic-sdlc db:backup
# Backup current state
```

### 5.6 Workflow & Agent Mgmt (6 commands)

```bash
agentic-sdlc workflows:list --status running
agentic-sdlc workflows:get <id> --json
agentic-sdlc workflows:create --definition app
agentic-sdlc agents:list --json
agentic-sdlc agents:status --platform web-apps
agentic-sdlc agents:register <type>
```

---

## Part 6: Detailed Specifications

### 6.1 Output Examples

**Human Format (start command):**
```
$ agentic-sdlc start
Starting Agentic SDLC environment...

[1/4] Docker containers
  ✓ PostgreSQL (5433)
  ✓ Redis (6380)
  ✓ Dashboard (3001)

[2/4] Building packages
  ✓ Cached (no changes)

[3/4] PM2 processes
  ✓ Orchestrator (1 instance)
  ✓ Scaffold Agent (2 instances)
  ✓ Validation Agent (2 instances)
  ✓ E2E Agent (2 instances)
  ✓ Integration Agent (2 instances)
  ✓ Deployment Agent (2 instances)

[4/4] Health checks
  ✓ Database connected
  ✓ Redis connected
  ✓ Orchestrator responding
  ✓ All agents registered

✅ Environment ready in 45 seconds
```

**JSON Format (start command with --json):**
```json
{
  "success": true,
  "code": 0,
  "duration": 45000,
  "message": "Environment ready",
  "services": {
    "docker": {
      "status": "running",
      "containers": 4
    },
    "pm2": {
      "status": "running",
      "processes": 6
    },
    "health": {
      "database": "ok",
      "redis": "ok",
      "orchestrator": "ok",
      "agents": "ok"
    }
  }
}
```

### 6.2 Exit Codes

```
0 - Success
1 - Generic error
2 - Invalid usage
3 - Service unavailable
4 - Database error
5 - Permission denied
6 - Timeout
7 - Configuration error
8 - Validation failed
```

### 6.3 Health Check Results

```
$ agentic-sdlc health --verbose

INFRASTRUCTURE
  Docker: 4/4 containers (postgres, redis, dashboard, analytics)
  Memory: 3.2GB/16GB used
  Disk: 156GB free
  Ports: All available

DATABASE
  PostgreSQL: ✓ Connected (45ms)
  Tables: 8 tables
  Migrations: 27/27 applied
  Records: 45,234 total
  
MESSAGE BUS
  Redis: ✓ Connected (12ms)
  Streams: 5 active
  Lag: 0 messages
  
SERVICES
  Orchestrator API: ✓ Running (200ms)
  Dashboard: ✓ Running (120ms)
  Analytics: ✓ Running (85ms)
  
AGENTS
  Scaffold: ✓ 2/2 instances
  Validation: ✓ 2/2 instances
  E2E: ✓ 2/2 instances
  Integration: ✓ 2/2 instances
  Deployment: ✓ 2/2 instances

Overall: ✅ HEALTHY (5/5 subsystems ok)
```

---

## Part 7: Implementation Timeline

### Phase 7A: Core CLI (Weeks 1-2)

**Deliverables:**
- CLI package structure
- start/stop/restart commands
- Basic health checks
- Log aggregation
- 100% test coverage

**Effort:** 40 hours

### Phase 7B: Testing & Deployment (Weeks 3-4)

**Deliverables:**
- Test runner (all 41 tests)
- Deployment commands
- Rollback support
- Database operations
- Integration tests

**Effort:** 35 hours

### Phase 7C: Monitoring & Polish (Weeks 5-6)

**Deliverables:**
- Metrics/monitoring
- Configuration management
- Documentation generation
- Performance optimization
- Error messages

**Effort:** 25 hours

**Total Phase 7:** ~100 hours (12-14 days @ 1 FTE)

---

## Part 8: Success Criteria

### 8.1 Functional Requirements

- ✅ All 45+ scripts consolidated into unified CLI
- ✅ All existing functionality preserved (backward compatible)
- ✅ Structured output (--json flag)
- ✅ Works for humans AND AI agents
- ✅ Zero breaking changes

### 8.2 Performance Requirements

- Start environment: < 2 minutes (maintain current speed)
- Health check: < 5 seconds
- Status update: < 1 second
- Test execution: < 120 seconds (aggregated)

### 8.3 Quality Requirements

- 100% test coverage (CLI code)
- 0 TypeScript errors
- All services health checks pass
- All 41 tests still pass
- Documentation complete

---

## Part 9: Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Break existing workflows | CRITICAL | Keep old scripts, wrap with CLI |
| PM2 interference | HIGH | Use PM2 API, don't send signals |
| Database corruption | CRITICAL | Test migrations, backup before |
| Slow startup | MEDIUM | Parallel startup, timeout mgmt |
| Output consistency | MEDIUM | Centralized formatter |

---

## Conclusion

The Agentic SDLC platform is mature and production-ready (99.5%), but operational management needs consolidation. Building a unified **Command Center CLI** in Phase 7 will:

1. ✅ **Unify operations** - Single entry point for all commands
2. ✅ **Enable AI agents** - Structured, parseable output
3. ✅ **Improve DX** - Better errors, faster iteration
4. ✅ **Support production** - Deployment, rollback, monitoring
5. ✅ **Reduce maintenance** - Consolidate 45 scripts into 1 package

**Status:** Ready for EPCC_PLAN.md (planning phase)

---

**Exploration Complete** ✅ | Next Phase: PLAN

