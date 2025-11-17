# CLI Infrastructure Test Plan

**Purpose:** Validate the start/stop infrastructure for the Agentic SDLC CLI, ensuring clean startup, graceful shutdown, no runaway processes, and single-instance enforcement for critical services.

**Environment:** Development (Docker + PM2)
**Duration:** ~2-3 hours for full execution
**Date:** Started November 16, 2025

---

## 🎯 Test Objectives

1. ✅ **Cold Start:** Environment starts cleanly from zero state
2. ✅ **Service Verification:** All expected services are running
3. ✅ **Singleton Enforcement:** Only 1 Dashboard, 1 Orchestrator API
4. ✅ **Runaway Processes:** No orphaned/duplicate processes
5. ✅ **Graceful Shutdown:** All services stop cleanly
6. ✅ **Resource Cleanup:** Zero leftover processes/files post-shutdown
7. ✅ **Stability:** Multiple start/stop cycles work consistently
8. ✅ **CLI Commands:** All CLI commands execute as expected

---

## 📋 Phase 1: Pre-Test Validation

**Goal:** Ensure system is in known state before testing begins

### 1.1 Cleanup Current State
```bash
# Stop any existing infrastructure
./scripts/env/stop-dev.sh

# Wait for cleanup
sleep 5

# Verify nothing remains
ps aux | grep -E "node|npm|tsx|pm2" | grep -v grep
docker ps -a
```

**Expected Result:**
- No node/npm/tsx/pm2 processes
- No Docker containers running (except dangling volumes)
- Clean state for testing

### 1.2 Verify Build Artifacts
```bash
# Check that all packages are built
ls -la packages/orchestrator/dist/server.js
ls -la packages/agents/scaffold-agent/dist/run-agent.js
ls -la packages/agents/validation-agent/dist/run-agent.js
ls -la packages/agents/e2e-agent/dist/run-agent.js
ls -la packages/agents/integration-agent/dist/run-agent.js
ls -la packages/agents/deployment-agent/dist/run-agent.js
```

**Expected Result:**
- All 6 dist files exist
- All files are recent (modified within last session)

### 1.3 Verify Environment Configuration
```bash
# Check DATABASE_URL and REDIS_URL
echo "DATABASE_URL: $DATABASE_URL"
echo "REDIS_URL: $REDIS_URL"
echo "ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:0:10}..."

# Check CLAUDE.md for current phase
grep "Phase 7" CLAUDE.md | head -3
```

**Expected Result:**
- DATABASE_URL set or uses default
- REDIS_URL set or uses default
- ANTHROPIC_API_KEY present
- Phase 7A context visible

---

## 📋 Phase 2: Cold Start Test

**Goal:** Start environment from clean state, verify all services come online

### 2.1 Execute Start Script
```bash
# Record start time
START_TIME=$(date +%s)
echo "Start time: $(date)"

# Execute start with verbose output
./scripts/env/start-dev.sh --verbose

# Record end time
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
echo "Startup duration: ${DURATION}s"
```

**Acceptance Criteria:**
- ✓ Script completes without errors
- ✓ Startup takes < 60 seconds
- ✓ All 4 phases complete (Docker, Build, Preflight, PM2)
- ✓ No FAILED messages in output

### 2.2 Capture Process List
```bash
# Document all running processes
echo "=== PM2 STATUS ===" > /tmp/test-baseline.txt
pnpm pm2:status >> /tmp/test-baseline.txt

# Document Docker containers
echo -e "\n=== DOCKER CONTAINERS ===" >> /tmp/test-baseline.txt
docker ps >> /tmp/test-baseline.txt

# Document listening ports
echo -e "\n=== LISTENING PORTS ===" >> /tmp/test-baseline.txt
netstat -tlnp 2>/dev/null | grep -E ":3000|:3001|:3002|:5433|:6380" >> /tmp/test-baseline.txt

# Display captured state
cat /tmp/test-baseline.txt
```

**Expected Services Running:**

| Service | Port | Manager | Process Count |
|---------|------|---------|--------|
| Orchestrator | 3000 | PM2 | 1 |
| Dashboard | 3001 | Docker | 1 |
| Analytics | 3002 | Docker | 1 |
| PostgreSQL | 5433 | Docker | 1 |
| Redis | 6380 | Docker | 1 |
| Scaffold Agent | - | PM2 | 1 |
| Validation Agent | - | PM2 | 1 |
| E2E Agent | - | PM2 | 1 |
| Integration Agent | - | PM2 | 1 |
| Deployment Agent | - | PM2 | 1 |

**Total Expected: 10 distinct services**

---

## 📋 Phase 3: Service Verification

**Goal:** Verify each service is responding correctly

### 3.1 Health Checks (HTTP)
```bash
# Orchestrator health
echo "Orchestrator..."
curl -s http://localhost:3000/api/v1/health | jq . || echo "FAILED"

# Dashboard health (check for HTML response)
echo -e "\nDashboard..."
curl -s http://localhost:3001 | head -1 | grep -q "<!doctype" && echo "OK" || echo "FAILED"

# Analytics health
echo -e "\nAnalytics..."
curl -s http://localhost:3002/health | jq . || echo "FAILED"

# Hexagonal health
echo -e "\nHexagonal..."
curl -s http://localhost:3000/health/hexagonal | jq . || echo "FAILED"
```

**Expected Responses:**
- Orchestrator: `{"status": "healthy", ...}`
- Dashboard: HTML response with `<!doctype html>`
- Analytics: `{"status": "healthy", ...}`
- Hexagonal: `{"status": "ok", ...}`

### 3.2 Database Health
```bash
# PostgreSQL connection
echo "PostgreSQL..."
docker exec agentic-sdlc-postgres pg_isready -U agentic 2>/dev/null

# Check database exists
docker exec agentic-sdlc-postgres psql -U agentic -d agentic_sdlc -c "\dt" 2>/dev/null | head -3

# Redis connection
echo -e "\nRedis..."
docker exec agentic-sdlc-redis redis-cli ping 2>/dev/null
```

**Expected Results:**
- PostgreSQL: `accepting connections`
- Database tables: `Platform`, `Workflow`, etc.
- Redis: `PONG`

### 3.3 Agent Connectivity
```bash
# Check PM2 status for all agents
pnpm pm2:status | grep agent

# Expected output:
# agent-scaffold      │ id │ 1 online
# agent-validation    │ id │ 1 online
# agent-e2e           │ id │ 1 online
# agent-integration   │ id │ 1 online
# agent-deployment    │ id │ 1 online
```

---

## 📋 Phase 4: Runaway Process Detection

**Goal:** Detect and report any orphaned or duplicate processes

### 4.1 Process Scanning
```bash
echo "=== PROCESS SCAN ===" > /tmp/process-scan.txt

# Node processes
echo "Node processes:" >> /tmp/process-scan.txt
pgrep -a node >> /tmp/process-scan.txt 2>/dev/null || echo "No node processes"

# npm processes
echo -e "\nnpm processes:" >> /tmp/process-scan.txt
pgrep -a npm >> /tmp/process-scan.txt 2>/dev/null || echo "No npm processes"

# tsx processes
echo -e "\ntsx processes:" >> /tmp/process-scan.txt
pgrep -a tsx >> /tmp/process-scan.txt 2>/dev/null || echo "No tsx processes"

# PM2 processes
echo -e "\nPM2 daemon:" >> /tmp/process-scan.txt
pgrep -a pm2 >> /tmp/process-scan.txt 2>/dev/null || echo "No PM2 daemon"

cat /tmp/process-scan.txt
```

**Analysis:**
```bash
# Count process occurrences
echo "Process Summary:"
echo "Node processes: $(pgrep node | wc -l)"
echo "npm processes: $(pgrep npm | wc -l || echo 0)"
echo "tsx processes: $(pgrep tsx | wc -l || echo 0)"
echo "PM2 daemon: $(pgrep -f "pm2 daemon" | wc -l)"
```

**Expected Results:**
- Node processes: 6 (1 orchestrator + 5 agents)
- npm processes: 0
- tsx processes: 0
- PM2 daemon: 1

### 4.2 Port Verification (No Duplicates)
```bash
# Check each critical port has exactly 1 listener
for port in 3000 3001 3002; do
  count=$(netstat -tlnp 2>/dev/null | grep ":$port" | wc -l || echo 0)
  echo "Port $port: $count listener(s) - $([ $count -eq 1 ] && echo '✓ OK' || echo '✗ DUPLICATE')"
done
```

**Expected Results:**
- Port 3000: 1 listener (Orchestrator)
- Port 3001: 1 listener (Dashboard)
- Port 3002: 1 listener (Analytics)

### 4.3 PM2 Process Count Verification
```bash
# Get expected vs actual
EXPECTED_PM2_PROCESSES=6  # orchestrator + 5 agents
ACTUAL_PM2_PROCESSES=$(pnpm pm2:status | grep "online\|exited\|stopped" | wc -l)

echo "Expected PM2 processes: $EXPECTED_PM2_PROCESSES"
echo "Actual PM2 processes: $ACTUAL_PM2_PROCESSES"
[ "$EXPECTED_PM2_PROCESSES" -eq "$ACTUAL_PM2_PROCESSES" ] && echo "✓ PASS" || echo "✗ FAIL"
```

---

## 📋 Phase 5: Graceful Shutdown Test

**Goal:** Stop all services cleanly without resource leaks

### 5.1 Execute Stop Script
```bash
# Record time
STOP_START=$(date +%s)
echo "Stop start time: $(date)"

# Execute stop
./scripts/env/stop-dev.sh

# Record completion
STOP_END=$(date +%s)
STOP_DURATION=$((STOP_END - STOP_START))
echo "Stop duration: ${STOP_DURATION}s"
```

**Acceptance Criteria:**
- ✓ Script completes without errors
- ✓ Stop takes < 30 seconds
- ✓ All 5 phases complete (PM2 stop, orphan cleanup, Docker down, PM2 daemon kill, verification)
- ✓ No ERROR messages in output

### 5.2 Immediate Post-Stop Verification
```bash
# Check PM2 processes
echo "PM2 processes post-stop:"
pnpm pm2:status 2>&1 | head -5 || echo "No PM2 processes (expected)"

# Check Docker containers
echo -e "\nDocker containers post-stop:"
docker ps | wc -l

# Check critical ports
echo -e "\nListening on critical ports:"
netstat -tlnp 2>/dev/null | grep -E ":3000|:3001|:3002" | wc -l
```

**Expected Results:**
- No PM2 processes listed
- Docker containers: 1 (only header from `docker ps`)
- Listening on critical ports: 0

---

## 📋 Phase 6: Resource Cleanup Verification

**Goal:** Verify complete cleanup, no stale files/sockets

### 6.1 Process Cleanup Verification
```bash
sleep 2  # Give OS time to clean up

# Verify no node processes remain
NODE_COUNT=$(pgrep node | wc -l || echo 0)
echo "Node processes remaining: $NODE_COUNT (expected: 0)"
[ "$NODE_COUNT" -eq 0 ] && echo "✓ PASS" || echo "✗ FAIL"

# Verify no npm processes remain
npm_COUNT=$(pgrep npm | wc -l || echo 0)
echo "npm processes remaining: $npm_COUNT (expected: 0)"
[ "$npm_COUNT" -eq 0 ] && echo "✓ PASS" || echo "✗ FAIL"

# Verify no PM2 daemon
PM2_COUNT=$(pgrep -f "pm2 daemon" | wc -l || echo 0)
echo "PM2 daemon remaining: $PM2_COUNT (expected: 0)"
[ "$PM2_COUNT" -eq 0 ] && echo "✓ PASS" || echo "✗ FAIL"
```

### 6.2 File Cleanup Verification
```bash
# Check PM2 state files are cleaned
echo "PM2 state files:"
ls -la ~/.pm2/pids/ 2>/dev/null | wc -l || echo "Directory empty/removed ✓"

# Check PM2 sockets
echo "PM2 sockets:"
ls -la ~/.pm2/*.sock 2>/dev/null | wc -l || echo "No socket files ✓"

# Check logs directory exists (but old logs cleaned)
echo "Log files:"
ls -la scripts/logs/*.log 2>/dev/null | wc -l || echo "No old logs"
```

### 6.3 Port Cleanup Verification
```bash
# Verify all ports released
echo "Port 3000: $(netstat -tlnp 2>/dev/null | grep ':3000' | wc -l) listener(s) - $([ $(netstat -tlnp 2>/dev/null | grep ':3000' | wc -l) -eq 0 ] && echo '✓' || echo '✗')"
echo "Port 3001: $(netstat -tlnp 2>/dev/null | grep ':3001' | wc -l) listener(s) - $([ $(netstat -tlnp 2>/dev/null | grep ':3001' | wc -l) -eq 0 ] && echo '✓' || echo '✗')"
echo "Port 3002: $(netstat -tlnp 2>/dev/null | grep ':3002' | wc -l) listener(s) - $([ $(netstat -tlnp 2>/dev/null | grep ':3002' | wc -l) -eq 0 ] && echo '✓' || echo '✗')"
echo "Port 5433: $(netstat -tlnp 2>/dev/null | grep ':5433' | wc -l) listener(s) - $([ $(netstat -tlnp 2>/dev/null | grep ':5433' | wc -l) -eq 0 ] && echo '✓' || echo '✗')"
echo "Port 6380: $(netstat -tlnp 2>/dev/null | grep ':6380' | wc -l) listener(s) - $([ $(netstat -tlnp 2>/dev/null | grep ':6380' | wc -l) -eq 0 ] && echo '✓' || echo '✗')"
```

---

## 📋 Phase 7: Rapid Cycle Test

**Goal:** Test multiple start/stop cycles for stability

### 7.1 Cycle 1
```bash
echo "=== CYCLE 1 ===" && date
./scripts/env/start-dev.sh --skip-build
sleep 3
pnpm pm2:status | grep -c "online"  # Should be 6
./scripts/env/stop-dev.sh
sleep 5
pgrep node | wc -l  # Should be 0
```

### 7.2 Cycle 2
```bash
echo "=== CYCLE 2 ===" && date
./scripts/env/start-dev.sh --skip-build
sleep 3
pnpm pm2:status | grep -c "online"  # Should be 6
./scripts/env/stop-dev.sh
sleep 5
pgrep node | wc -l  # Should be 0
```

### 7.3 Cycle 3
```bash
echo "=== CYCLE 3 ===" && date
./scripts/env/start-dev.sh --skip-build
sleep 3
pnpm pm2:status | grep -c "online"  # Should be 6
./scripts/env/stop-dev.sh
sleep 5
pgrep node | wc -l  # Should be 0
```

**Acceptance Criteria:**
- ✓ All 3 cycles start successfully
- ✓ All 3 cycles show 6 online processes
- ✓ All 3 cycles stop cleanly
- ✓ All 3 cycles leave 0 node processes

---

## 📋 Phase 8: Singleton Enforcement Test

**Goal:** Verify only 1 Dashboard and 1 Orchestrator API are running

### 8.1 Manual Duplicate Attempt - Dashboard
```bash
# With infrastructure running, try to start another dashboard on 3001
echo "Attempting to start duplicate dashboard..."
PORT=3001 timeout 5 npm run dev --prefix packages/dashboard 2>&1 | grep -i "error\|already\|port" || echo "Dialog would fail (expected)"
```

**Expected Result:**
- Start fails with "port already in use" or similar error

### 8.2 Manual Duplicate Attempt - Orchestrator
```bash
# With infrastructure running, try to start another orchestrator on 3000
echo "Attempting to start duplicate orchestrator..."
NODE_ENV=development PORT=3000 timeout 5 node packages/orchestrator/dist/server.js 2>&1 | grep -i "error\|already\|port" || echo "Would fail (expected)"
```

**Expected Result:**
- Start fails with "port already in use" error

### 8.3 Docker Container Count Verification
```bash
# Verify only 1 dashboard container
DASHBOARD_COUNT=$(docker ps | grep dashboard | wc -l)
echo "Dashboard containers: $DASHBOARD_COUNT (expected: 1) - $([ $DASHBOARD_COUNT -eq 1 ] && echo '✓' || echo '✗')"

# Verify only 1 analytics container
ANALYTICS_COUNT=$(docker ps | grep analytics | wc -l)
echo "Analytics containers: $ANALYTICS_COUNT (expected: 1) - $([ $ANALYTICS_COUNT -eq 1 ] && echo '✓' || echo '✗')"

# Verify only 1 postgres container
POSTGRES_COUNT=$(docker ps | grep postgres | wc -l)
echo "PostgreSQL containers: $POSTGRES_COUNT (expected: 1) - $([ $POSTGRES_COUNT -eq 1 ] && echo '✓' || echo '✗')"

# Verify only 1 redis container
REDIS_COUNT=$(docker ps | grep redis | wc -l)
echo "Redis containers: $REDIS_COUNT (expected: 1) - $([ $REDIS_COUNT -eq 1 ] && echo '✓' || echo '✗')"
```

---

## 📋 Phase 9: CLI Command Testing

**Goal:** Test CLI commands work with running infrastructure

### 9.1 Build CLI Package
```bash
# Ensure CLI is built
pnpm build

# Verify CLI binary exists
ls -la packages/cli/dist/index.js || echo "CLI not built"
```

### 9.2 Test Status Command
```bash
# Start infrastructure
./scripts/env/start-dev.sh --skip-build

# Run status check
agentic-sdlc status
agentic-sdlc status --json  # Should output valid JSON
```

**Expected Output:**
- Service statuses (redis, postgres, orchestrator, agents)
- JSON output should parse without errors

### 9.3 Test Health Commands
```bash
# Health checks
agentic-sdlc health
agentic-sdlc health:services
agentic-sdlc health:database
agentic-sdlc health:agents

# All should return 0 (success)
```

### 9.4 Test Restart Command
```bash
# Restart services
agentic-sdlc restart

# Verify still running
pnpm pm2:status | grep -c "online"  # Should be 6
curl -s http://localhost:3000/api/v1/health | jq .
```

### 9.5 Test Logs Command
```bash
# Get logs
agentic-sdlc logs orchestrator
agentic-sdlc logs agent:scaffold

# Get last N lines
agentic-sdlc logs orchestrator -n 50
```

### 9.6 Test Metrics Command
```bash
# Get metrics
agentic-sdlc metrics

# Expected: JSON with CPU, memory, uptime for each service
```

---

## 📋 Phase 10: Report Generation

**Goal:** Create comprehensive test results document

### 10.1 Collect Test Results
```bash
# Create report file
REPORT="/tmp/cli-test-report-$(date +%Y%m%d-%H%M%S).txt"

{
  echo "CLI INFRASTRUCTURE TEST REPORT"
  echo "=============================="
  echo "Date: $(date)"
  echo "Environment: $(uname -s) $(uname -r)"
  echo "Node: $(node --version)"
  echo "Docker: $(docker --version)"
  echo ""

  echo "Test Matrix:"
  echo "============"
  echo "Phase 1 (Pre-Test): PASS/FAIL"
  echo "Phase 2 (Cold Start): PASS/FAIL"
  echo "Phase 3 (Service Verification): PASS/FAIL"
  echo "Phase 4 (Runaway Processes): PASS/FAIL"
  echo "Phase 5 (Graceful Shutdown): PASS/FAIL"
  echo "Phase 6 (Resource Cleanup): PASS/FAIL"
  echo "Phase 7 (Rapid Cycles): PASS/FAIL"
  echo "Phase 8 (Singleton): PASS/FAIL"
  echo "Phase 9 (CLI Commands): PASS/FAIL"
  echo ""

  echo "Summary:"
  echo "========"
  echo "Total Tests: 9"
  echo "Passed: X/9"
  echo "Failed: Y/9"
  echo "Success Rate: X%"

} | tee "$REPORT"

echo "Report saved: $REPORT"
```

### 10.2 Document Issues
```bash
# If any tests failed, document them:
cat > /tmp/test-issues.txt << 'EOF'
Test Issues Found:
==================

Issue 1:
- Phase: [X]
- Description: [What failed]
- Impact: [How critical]
- Reproduction: [Steps to reproduce]
- Fix: [Suggested fix]

EOF

cat /tmp/test-issues.txt
```

---

## 🔍 Troubleshooting Guide

### Issue: "Port 3000 already in use"
```bash
# Find process using port
lsof -i :3000
# or
netstat -tlnp | grep 3000

# Kill it
kill -9 <PID>

# Or use stop script
./scripts/env/stop-dev.sh
```

### Issue: "PM2 processes not stopping"
```bash
# Force kill PM2
pkill -9 pm2
pkill -9 pm2-daemon
pkill -9 -f "pm2 daemon"

# Clean state
rm -f ~/.pm2/pids/*.pid
rm -f ~/.pm2/*.sock

# Try stop again
./scripts/env/stop-dev.sh
```

### Issue: "Docker containers not stopping"
```bash
# Force stop containers
docker-compose -f docker-compose.yml down -v

# Or individually
docker stop $(docker ps -q)
docker rm $(docker ps -aq)
```

### Issue: "Duplicate port listener detected"
```bash
# Find all processes on port
netstat -tlnp 2>/dev/null | grep ":3000"

# Kill extras
kill -9 <PID>

# Restart infrastructure
./scripts/env/stop-dev.sh
sleep 5
./scripts/env/start-dev.sh
```

### Issue: "CLI Command not found"
```bash
# Rebuild CLI
pnpm --filter @agentic-sdlc/cli build

# Link if needed
cd packages/cli
npm link
cd ../..

# Or use directly
node packages/cli/dist/index.js <command>
```

---

## ✅ Test Completion Checklist

- [ ] Phase 1: Pre-Test Validation - PASS
- [ ] Phase 2: Cold Start Test - PASS
- [ ] Phase 3: Service Verification - PASS
- [ ] Phase 4: Runaway Process Detection - PASS
- [ ] Phase 5: Graceful Shutdown - PASS
- [ ] Phase 6: Resource Cleanup - PASS
- [ ] Phase 7: Rapid Cycle Test (3 cycles) - PASS
- [ ] Phase 8: Singleton Enforcement - PASS
- [ ] Phase 9: CLI Command Testing - PASS
- [ ] Phase 10: Report Generated - PASS

**Overall Result:** ✅ **PASS** / ❌ **FAIL**

**Signed Off By:** __________________
**Date:** __________________

---

## 📊 Metrics Summary

| Metric | Expected | Actual | Status |
|--------|----------|--------|--------|
| Startup Time | < 60s | | |
| Shutdown Time | < 30s | | |
| PM2 Processes | 6 | | |
| Docker Containers | 5 | | |
| Port 3000 Listeners | 1 | | |
| Port 3001 Listeners | 1 | | |
| Port 3002 Listeners | 1 | | |
| Orphaned Processes | 0 | | |
| Cleanup Time | < 10s | | |
| Rapid Cycle Success | 3/3 | | |
| CLI Commands Working | All | | |

---

## 🔗 Related Documentation

- [CLAUDE.md](./CLAUDE.md) - Project context
- [AGENTIC_SDLC_RUNBOOK.md](./AGENTIC_SDLC_RUNBOOK.md) - Debugging guide
- [start-dev.sh](./scripts/env/start-dev.sh) - Startup script
- [stop-dev.sh](./scripts/env/stop-dev.sh) - Shutdown script
- [check-health.sh](./scripts/env/check-health.sh) - Health check script
- [pm2/ecosystem.dev.config.js](./pm2/ecosystem.dev.config.js) - PM2 configuration

---

**Created:** 2025-11-16
**Version:** 1.0
**Status:** Ready for Execution
