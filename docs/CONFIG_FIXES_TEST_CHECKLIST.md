# Configuration Fixes - Testing Checklist

This checklist validates all applied fixes work correctly across development, testing, and production environments.

## Pre-Testing Setup

- [ ] All code changes are committed
- [ ] `.env` file is configured with ANTHROPIC_API_KEY
- [ ] Docker is running and working (`docker ps`)
- [ ] Docker-compose is installed (`docker-compose --version`)
- [ ] pnpm is installed (`pnpm --version`)
- [ ] Node 20+ is installed (`node --version`)

---

## Development Environment Tests

### Starting Services

- [ ] Run `./dev start` from project root
- [ ] No deprecation warnings about using ./start.sh or ./stop.sh
- [ ] Services start successfully (should see all 4 steps complete)

### Verify Ports are Correct

```bash
# Port 5433 - PostgreSQL (Docker)
lsof -i :5433
# Expected: docker container listening

# Port 6380 - Redis (Docker)
lsof -i :6380
# Expected: docker container listening

# Port 3051 - Orchestrator (PM2)
lsof -i :3051
# Expected: node process (PM2 managed)

# Port 3050 - Dashboard (Docker)
lsof -i :3050
# Expected: docker container listening

# Port 3002 - Analytics (Docker)
lsof -i :3002
# Expected: docker container listening
```

### Verify Services are Healthy

- [ ] `./dev status` shows all services running
- [ ] `./dev health` shows all services healthy
- [ ] Orchestrator API accessible: `curl http://localhost:3051/api/v1/health`
- [ ] Dashboard accessible: `curl http://localhost:3050` (returns HTML)
- [ ] Analytics accessible: `curl http://localhost:3002/health`

### Test Dashboard Backend Communication

- [ ] Open http://localhost:3050 in browser
- [ ] Dashboard loads without errors
- [ ] API calls from dashboard to orchestrator succeed
- [ ] No CORS errors in console

### Test Database Access

```bash
# Connect to PostgreSQL
psql -h localhost -p 5433 -U agentic -d agentic_sdlc

# Run simple query
SELECT version();

# Exit
\q
```

- [ ] Connection successful
- [ ] Database version returned

### Test Redis Access

```bash
# Connect to Redis
redis-cli -p 6380

# Run ping command
PING

# Exit
QUIT
```

- [ ] Connection successful
- [ ] PONG response returned

### Stopping Services

- [ ] Run `./dev stop` from project root
- [ ] All services stopped gracefully
- [ ] No zombie processes remain: `pgrep node | wc -l` should be 0
- [ ] No deprecation warnings (should only recommend `./dev` commands)

---

## Test Environment Tests

### Preparation

- [ ] `./dev stop` is completed (dev environment fully stopped)
- [ ] Verify no services running on isolated test ports:
  - [ ] Port 5434 free: `lsof -i :5434` (should show nothing)
  - [ ] Port 6381 free: `lsof -i :6381` (should show nothing)

### Start Test Environment

```bash
docker-compose -f docker-compose.test.yml up -d
```

- [ ] All services start successfully
- [ ] No port conflicts
- [ ] Health checks pass (docker-compose status shows all healthy)

### Verify Test Ports are Isolated

```bash
# Port 5434 - PostgreSQL (Test)
lsof -i :5434
# Expected: docker container listening

# Port 6381 - Redis (Test)
lsof -i :6381
# Expected: docker container listening

# Port 3000 - Orchestrator (Test Docker)
lsof -i :3000
# Expected: docker container listening

# Port 3001 - Dashboard (Test)
lsof -i :3001
# Expected: docker container listening
```

### Test Database Connection

```bash
# Connect to test PostgreSQL (different port than dev!)
psql -h localhost -p 5434 -U agentic -d agentic_sdlc_test

# Run query
SELECT version();

# Exit
\q
```

- [ ] Connection successful to port 5434 (NOT 5433)
- [ ] Database name is `agentic_sdlc_test` (isolated)

### Test Redis Connection with Authentication

```bash
# Connect to test Redis (different port than dev!)
redis-cli -p 6381

# Should fail without password (agentic_redis_test)
PING
# Expected: NOAUTH Authentication required

# Connect with password
redis-cli -p 6381 -a agentic_redis_test
PING
# Expected: PONG

# Exit
QUIT
```

- [ ] Redis requires authentication on port 6381
- [ ] Password `agentic_redis_test` works correctly
- [ ] Ping command responds with PONG

### Run Unit Tests (if available)

```bash
# This would normally be: npm test or pnpm test
# Just verify test environment doesn't interfere with tests
```

### Stop Test Environment

```bash
docker-compose -f docker-compose.test.yml down
```

- [ ] All test services stopped
- [ ] Ports 5434, 6381 freed
- [ ] No orphaned containers remain

---

## Production Dockerfile Tests

### Build Production Images

```bash
# Build Dockerfile.production (multi-service)
docker build -f Dockerfile.production -t agentic-sdlc-orchestrator:test .
# Expected: Multi-stage build completes successfully

# Build Dockerfile.dashboard
docker build -f Dockerfile.dashboard -t agentic-sdlc-dashboard:test .
# Expected: Multi-stage build completes successfully, serve installed
```

- [ ] Dockerfile.production builds without errors
- [ ] Dockerfile.dashboard builds without errors
- [ ] Multi-stage builds produce lean final images

### Test Production Dockerfile with SERVICE_TYPE

```bash
# Test orchestrator entrypoint
docker run -e SERVICE_TYPE=orchestrator agentic-sdlc-orchestrator:test \
  /app/entrypoint.sh

# Test agent entrypoint
docker run -e SERVICE_TYPE=scaffold-agent agentic-sdlc-orchestrator:test \
  /app/entrypoint.sh
```

- [ ] Orchestrator entrypoint works
- [ ] Agent entrypoint works
- [ ] Correct service binary is selected

### Verify Health Checks in Production

- [ ] Dockerfile.production has health check: `/api/v1/health`
- [ ] Dockerfile.dashboard has health check: `wget --spider http://localhost:3001/`
- [ ] docker-compose.production.yml has health checks for all services

---

## CI/CD Workflow Tests

### Verify Workflow Configuration

- [ ] `.github/workflows/ci-cd.yml` has NODE_ENV=test in test job
- [ ] OPENAI_API_KEY secret is referenced
- [ ] ANTHROPIC_API_KEY secret is referenced
- [ ] Test database uses: `agentic_sdlc_test`
- [ ] Test Redis uses: `localhost:6379` (GitHub service)

### Run Workflow (Manual Trigger or via PR)

- [ ] Workflow quality job passes (TypeScript, ESLint)
- [ ] Workflow test job passes (tests with coverage)
- [ ] Workflow security job passes (npm audit, Trivy)
- [ ] Workflow build job passes (Docker image builds)

---

## Port Configuration Documentation

- [ ] PORT_CONFIGURATION.md exists and is comprehensive
- [ ] Quick reference table is accurate
- [ ] Network architecture diagrams are clear
- [ ] Environment-specific sections match actual configuration
- [ ] Troubleshooting section helps resolve port conflicts
- [ ] Health check definitions are documented

---

## Script Consolidation

### Verify Canonical Entry Point

```bash
./dev help
```

- [ ] Shows all available commands
- [ ] Recommends `./dev start`, `./dev stop`, etc.

### Verify Deprecation Warnings

```bash
./start.sh --help
```

- [ ] Shows DEPRECATED notice in header
- [ ] Recommends using `./dev` instead

```bash
./stop.sh --help
```

- [ ] Shows DEPRECATED notice in header
- [ ] Recommends using `./dev stop` instead

```bash
./scripts/env/dev --help
```

- [ ] Shows DEPRECATED notice in header
- [ ] Recommends using `./dev` instead

---

## Concurrent Environment Test

### Verify Test Environment Cannot Run with Dev

- [ ] Start dev: `./dev start`
- [ ] Try to start test: `docker-compose -f docker-compose.test.yml up -d`
- [ ] Should succeed because test uses different database/redis ports (5434, 6381)
- [ ] **BUT:** Other services (orchestrator) on port 3000/3051 may conflict
- [ ] **Solution:** Document that tests require dev to be stopped

---

## Final Validation

### All Services Start Successfully

- [ ] Dev environment: `./dev start` → all services healthy
- [ ] Test environment: `docker-compose -f docker-compose.test.yml up -d` → all services healthy (after stopping dev)
- [ ] Production ready: `docker-compose -f docker-compose.production.yml` → can build successfully

### All Ports Correct

| Environment | Port | Service | Status |
|-------------|------|---------|--------|
| Dev | 5433 | PostgreSQL | ✅ |
| Dev | 6380 | Redis | ✅ |
| Dev | 3051 | Orchestrator | ✅ |
| Dev | 3050 | Dashboard | ✅ |
| Test | 5434 | PostgreSQL | ✅ |
| Test | 6381 | Redis | ✅ |
| Test | 3000 | Orchestrator | ✅ |
| Test | 3001 | Dashboard | ✅ |
| Prod | - | PostgreSQL (RDS) | ✅ |
| Prod | - | Redis (ElastiCache) | ✅ |
| Prod | 3000 | Orchestrator | ✅ |
| Prod | 3001 | Dashboard | ✅ |

### All Documentation Current

- [ ] PORT_CONFIGURATION.md is accurate
- [ ] CONFIG_REVIEW_FIXES_SUMMARY.md is complete
- [ ] CONFIG_FIXES_TEST_CHECKLIST.md (this file) guides testing

---

## Issues Found During Testing

Document any new issues discovered:

```
Issue #1: [Description]
- Severity: [Critical/Major/Moderate]
- Affected: [Component/Environment]
- Fix: [Action taken or recommendation]

Issue #2: [Description]
...
```

---

## Sign-Off

- [ ] Development environment works correctly
- [ ] Test environment works correctly
- [ ] Production Dockerfiles build successfully
- [ ] CI/CD workflow configuration is correct
- [ ] All documentation is accurate
- [ ] No breaking changes to existing workflows
- [ ] All tests pass

**Tested by:** ________________  
**Date:** ________________  
**Result:** ✅ PASS / ⚠️ NEEDS FIXES / ❌ FAILED

---

**Total Test Items:** 50+  
**Status:** Ready for testing
