#!/bin/bash

##############################################################################
# CLI INFRASTRUCTURE TEST SCRIPT
#
# Comprehensive testing of agentic-sdlc CLI with start/stop cycles
# Tests for:
# - Cold start functionality
# - Service verification
# - Runaway process detection
# - Singleton enforcement (1 Dashboard, 1 API)
# - Graceful shutdown
# - Resource cleanup
# - Rapid cycle stability
# - CLI command execution
#
# Usage:
#   ./scripts/test-cli-infrastructure.sh          # Run full test suite
#   ./scripts/test-cli-infrastructure.sh --quick  # Run quick test only
#   ./scripts/test-cli-infrastructure.sh --phase <N>  # Run specific phase
#
# Exit codes:
#   0 = All tests PASS
#   1 = Some tests FAIL
#   2 = Setup/cleanup error
##############################################################################

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORT_FILE="/tmp/cli-test-report-$(date +%Y%m%d-%H%M%S).txt"
SUMMARY_FILE="/tmp/cli-test-summary.txt"

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# Parse arguments
QUICK_MODE=false
SPECIFIC_PHASE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --quick) QUICK_MODE=true; shift ;;
    --phase) SPECIFIC_PHASE="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 2 ;;
  esac
done

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

log_header() {
  echo -e "${BLUE}================================================${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}================================================${NC}"
}

log_phase() {
  echo ""
  echo -e "${YELLOW}[Phase $1]${NC} $2"
}

log_test() {
  echo -e "  ${GRAY}→${NC} $1"
}

log_pass() {
  echo -e "  ${GREEN}✓${NC} $1"
  ((TESTS_PASSED++))
}

log_fail() {
  echo -e "  ${RED}✗${NC} $1"
  ((TESTS_FAILED++))
}

log_skip() {
  echo -e "  ${YELLOW}⊘${NC} $1"
  ((TESTS_SKIPPED++))
}

report() {
  echo "$1" >> "$REPORT_FILE"
}

# Build status file
status_check() {
  local name=$1
  local expected=$2
  local actual=$3

  if [ "$actual" -eq "$expected" ]; then
    log_pass "$name ($actual/$expected)"
    return 0
  else
    log_fail "$name (expected $expected, got $actual)"
    return 1
  fi
}

# ============================================================================
# PHASE 0: SETUP & INITIALIZATION
# ============================================================================

phase_setup() {
  log_phase 0 "Setup & Initialization"

  log_test "Creating report file"
  mkdir -p "$(dirname "$REPORT_FILE")"
  cat > "$REPORT_FILE" << 'EOF'
CLI INFRASTRUCTURE TEST REPORT
==============================

EOF
  report "Date: $(date)"
  report "Project: $PROJECT_ROOT"
  report "Tester: $(whoami)"
  report ""

  log_test "Checking Node version"
  NODE_VERSION=$(node --version)
  report "Node: $NODE_VERSION"
  log_pass "Node version: $NODE_VERSION"

  log_test "Checking Docker"
  DOCKER_VERSION=$(docker --version 2>/dev/null || echo "Not installed")
  report "Docker: $DOCKER_VERSION"
  log_pass "Docker: $DOCKER_VERSION"

  log_test "Verifying CLI is built"
  if [ -f "$PROJECT_ROOT/packages/cli/dist/index.js" ]; then
    log_pass "CLI binary exists"
  else
    log_fail "CLI binary not found - building..."
    cd "$PROJECT_ROOT"
    pnpm build --filter @agentic-sdlc/cli > /dev/null 2>&1 || {
      log_fail "CLI build failed"
      exit 2
    }
  fi

  log_test "Checking for existing processes"
  EXISTING_NODES=$(pgrep node | wc -l || echo 0)
  if [ "$EXISTING_NODES" -gt 0 ]; then
    log_skip "Found $EXISTING_NODES existing node processes - stopping first"
    ./scripts/env/stop-dev.sh > /dev/null 2>&1 || true
    sleep 3
  else
    log_pass "No existing processes"
  fi

  report ""
  report "SETUP COMPLETE"
  report ""
}

# ============================================================================
# PHASE 1: COLD START TEST
# ============================================================================

phase_cold_start() {
  log_phase 1 "Cold Start Test - Start fresh environment"

  report "PHASE 1: COLD START TEST"
  report "========================"

  log_test "Starting infrastructure"
  START_TIME=$(date +%s)

  if ./scripts/env/start-dev.sh --skip-build > /tmp/start-dev.log 2>&1; then
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    log_pass "Infrastructure started (${DURATION}s)"
    report "Startup duration: ${DURATION}s"
  else
    log_fail "Infrastructure startup failed"
    report "STARTUP FAILED"
    tail -20 /tmp/start-dev.log >> "$REPORT_FILE"
    return 1
  fi

  sleep 2

  log_test "Checking PM2 process count"
  PM2_COUNT=$(pnpm pm2:status 2>/dev/null | grep -c "online" || echo 0)
  expected_pm2=6  # orchestrator + 5 agents
  status_check "PM2 processes" "$expected_pm2" "$PM2_COUNT"
  report "PM2 online processes: $PM2_COUNT"

  report ""
}

# ============================================================================
# PHASE 2: SERVICE VERIFICATION
# ============================================================================

phase_service_verification() {
  log_phase 2 "Service Verification - Verify all services responding"

  report "PHASE 2: SERVICE VERIFICATION"
  report "============================="

  # Orchestrator
  log_test "Checking Orchestrator API"
  if curl -s http://localhost:3000/api/v1/health | grep -q "healthy"; then
    log_pass "Orchestrator responding"
    report "Orchestrator: OK"
  else
    log_fail "Orchestrator not responding"
    report "Orchestrator: FAILED"
  fi

  # Dashboard
  log_test "Checking Dashboard UI"
  if curl -s http://localhost:3001 | grep -q "<!doctype"; then
    log_pass "Dashboard responding"
    report "Dashboard: OK"
  else
    log_fail "Dashboard not responding"
    report "Dashboard: FAILED"
  fi

  # Analytics
  log_test "Checking Analytics Service"
  if curl -s http://localhost:3002/health | grep -q "healthy"; then
    log_pass "Analytics responding"
    report "Analytics: OK"
  else
    log_skip "Analytics not responding (non-critical)"
    report "Analytics: SKIPPED"
  fi

  # PostgreSQL
  log_test "Checking PostgreSQL"
  if docker exec agentic-sdlc-postgres pg_isready -U agentic 2>/dev/null | grep -q "accepting"; then
    log_pass "PostgreSQL responding"
    report "PostgreSQL: OK"
  else
    log_fail "PostgreSQL not responding"
    report "PostgreSQL: FAILED"
  fi

  # Redis
  log_test "Checking Redis"
  if docker exec agentic-sdlc-redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
    log_pass "Redis responding"
    report "Redis: OK"
  else
    log_fail "Redis not responding"
    report "Redis: FAILED"
  fi

  report ""
}

# ============================================================================
# PHASE 3: PROCESS SCANNING
# ============================================================================

phase_process_scan() {
  log_phase 3 "Process Scanning - Detect orphaned/runaway processes"

  report "PHASE 3: PROCESS SCANNING"
  report "=========================="

  log_test "Counting node processes"
  NODE_COUNT=$(pgrep node | wc -l || echo 0)
  status_check "Node processes" 6 "$NODE_COUNT"
  report "Node processes: $NODE_COUNT (expected 6)"

  log_test "Counting npm processes"
  NPM_COUNT=$(pgrep npm | wc -l || echo 0)
  status_check "npm processes (should be 0)" 0 "$NPM_COUNT"
  report "npm processes: $NPM_COUNT (expected 0)"

  log_test "Checking PM2 daemon"
  PM2_DAEMON=$(pgrep -f "pm2 daemon" | wc -l || echo 0)
  status_check "PM2 daemon count" 1 "$PM2_DAEMON"
  report "PM2 daemon: $PM2_DAEMON (expected 1)"

  log_test "Port 3000 (Orchestrator)"
  PORT_3000=$(netstat -tlnp 2>/dev/null | grep -c ":3000" || echo 0)
  status_check "Port 3000 listeners" 1 "$PORT_3000"
  report "Port 3000 listeners: $PORT_3000 (expected 1)"

  log_test "Port 3001 (Dashboard)"
  PORT_3001=$(netstat -tlnp 2>/dev/null | grep -c ":3001" || echo 0)
  status_check "Port 3001 listeners" 1 "$PORT_3001"
  report "Port 3001 listeners: $PORT_3001 (expected 1)"

  report ""
}

# ============================================================================
# PHASE 4: CLI COMMAND TESTING
# ============================================================================

phase_cli_testing() {
  log_phase 4 "CLI Command Testing - Execute CLI commands"

  report "PHASE 4: CLI COMMAND TESTING"
  report "============================"

  cd "$PROJECT_ROOT"

  # Test: status command
  log_test "CLI: agentic-sdlc status"
  if node packages/cli/dist/index.js status --json > /tmp/cli-status.json 2>&1; then
    if grep -q "status" /tmp/cli-status.json; then
      log_pass "Status command works"
      report "CLI status: OK"
    else
      log_fail "Status command returned invalid JSON"
      report "CLI status: INVALID_JSON"
    fi
  else
    log_fail "Status command failed"
    report "CLI status: FAILED"
  fi

  # Test: health command
  log_test "CLI: agentic-sdlc health"
  if node packages/cli/dist/index.js health --json > /tmp/cli-health.json 2>&1; then
    if grep -q "summary\|status" /tmp/cli-health.json; then
      log_pass "Health command works"
      report "CLI health: OK"
    else
      log_fail "Health command returned invalid JSON"
      report "CLI health: INVALID_JSON"
    fi
  else
    log_fail "Health command failed"
    report "CLI health: FAILED"
  fi

  # Test: health:services
  log_test "CLI: agentic-sdlc health:services"
  if node packages/cli/dist/index.js health:services --json > /tmp/cli-health-svc.json 2>&1; then
    log_pass "Health:services command works"
    report "CLI health:services: OK"
  else
    log_fail "Health:services command failed"
    report "CLI health:services: FAILED"
  fi

  # Test: logs command
  log_test "CLI: agentic-sdlc logs"
  if node packages/cli/dist/index.js logs --lines 10 > /tmp/cli-logs.txt 2>&1; then
    log_pass "Logs command works"
    report "CLI logs: OK"
  else
    log_fail "Logs command failed"
    report "CLI logs: FAILED"
  fi

  # Test: metrics command
  log_test "CLI: agentic-sdlc metrics"
  if timeout 5 node packages/cli/dist/index.js metrics > /tmp/cli-metrics.txt 2>&1; then
    log_pass "Metrics command works"
    report "CLI metrics: OK"
  else
    log_fail "Metrics command failed"
    report "CLI metrics: FAILED"
  fi

  # Test: restart command
  log_test "CLI: agentic-sdlc restart"
  if timeout 60 node packages/cli/dist/index.js restart orchestrator > /tmp/cli-restart.txt 2>&1; then
    sleep 3
    if pnpm pm2:status | grep -q "orchestrator.*online"; then
      log_pass "Restart command works"
      report "CLI restart: OK"
    else
      log_fail "Restart didn't return process to online"
      report "CLI restart: PROCESS_NOT_ONLINE"
    fi
  else
    log_fail "Restart command failed"
    report "CLI restart: FAILED"
  fi

  report ""
}

# ============================================================================
# PHASE 5: GRACEFUL SHUTDOWN
# ============================================================================

phase_graceful_shutdown() {
  log_phase 5 "Graceful Shutdown - Stop all services cleanly"

  report "PHASE 5: GRACEFUL SHUTDOWN"
  report "=========================="

  log_test "Stopping infrastructure"
  STOP_START=$(date +%s)

  if ./scripts/env/stop-dev.sh > /tmp/stop-dev.log 2>&1; then
    STOP_END=$(date +%s)
    STOP_DURATION=$((STOP_END - STOP_START))
    log_pass "Infrastructure stopped (${STOP_DURATION}s)"
    report "Stop duration: ${STOP_DURATION}s"
  else
    log_fail "Infrastructure stop failed"
    report "STOP FAILED"
    tail -20 /tmp/stop-dev.log >> "$REPORT_FILE"
    return 1
  fi

  sleep 3

  report ""
}

# ============================================================================
# PHASE 6: CLEANUP VERIFICATION
# ============================================================================

phase_cleanup_verification() {
  log_phase 6 "Cleanup Verification - Verify complete cleanup"

  report "PHASE 6: CLEANUP VERIFICATION"
  report "=============================="

  log_test "Checking for orphaned node processes"
  NODE_REMAINING=$(pgrep node | wc -l || echo 0)
  status_check "No orphaned node processes" 0 "$NODE_REMAINING"
  report "Node processes remaining: $NODE_REMAINING (expected 0)"

  log_test "Checking for orphaned npm processes"
  NPM_REMAINING=$(pgrep npm | wc -l || echo 0)
  status_check "No orphaned npm processes" 0 "$NPM_REMAINING"
  report "npm processes remaining: $NPM_REMAINING (expected 0)"

  log_test "Checking for Docker containers"
  DOCKER_REMAINING=$(docker ps | wc -l)
  # Should be 1 (just header line)
  if [ "$DOCKER_REMAINING" -eq 1 ]; then
    log_pass "No Docker containers running"
    report "Docker containers: 0 (expected 0)"
  else
    log_fail "Found $((DOCKER_REMAINING - 1)) running containers"
    report "Docker containers: $((DOCKER_REMAINING - 1)) (expected 0)"
  fi

  log_test "Checking ports released"
  PORT_3000=$(netstat -tlnp 2>/dev/null | grep -c ":3000" || echo 0)
  PORT_3001=$(netstat -tlnp 2>/dev/null | grep -c ":3001" || echo 0)
  PORT_3002=$(netstat -tlnp 2>/dev/null | grep -c ":3002" || echo 0)

  status_check "Port 3000 released" 0 "$PORT_3000"
  status_check "Port 3001 released" 0 "$PORT_3001"
  status_check "Port 3002 released" 0 "$PORT_3002"

  report ""
}

# ============================================================================
# PHASE 7: RAPID CYCLE TEST
# ============================================================================

phase_rapid_cycles() {
  log_phase 7 "Rapid Cycle Test - Multiple start/stop cycles"

  report "PHASE 7: RAPID CYCLE TEST"
  report "=========================="

  for cycle in 1 2 3; do
    log_test "Cycle $cycle: Start"
    if ./scripts/env/start-dev.sh --skip-build > /dev/null 2>&1; then
      sleep 2
      PM2_RUNNING=$(pnpm pm2:status 2>/dev/null | grep -c "online" || echo 0)

      if [ "$PM2_RUNNING" -eq 6 ]; then
        log_pass "Cycle $cycle: Started successfully (6 processes)"
        report "Cycle $cycle: Start - OK"
      else
        log_fail "Cycle $cycle: Expected 6 processes, got $PM2_RUNNING"
        report "Cycle $cycle: Start - FAILED (wrong process count)"
      fi
    else
      log_fail "Cycle $cycle: Start failed"
      report "Cycle $cycle: Start - FAILED"
      continue
    fi

    log_test "Cycle $cycle: Stop"
    if ./scripts/env/stop-dev.sh > /dev/null 2>&1; then
      sleep 3
      REMAINING=$(pgrep node | wc -l || echo 0)

      if [ "$REMAINING" -eq 0 ]; then
        log_pass "Cycle $cycle: Stopped cleanly (0 processes)"
        report "Cycle $cycle: Stop - OK"
      else
        log_fail "Cycle $cycle: Expected 0 processes, got $REMAINING"
        report "Cycle $cycle: Stop - FAILED (orphaned processes)"
      fi
    else
      log_fail "Cycle $cycle: Stop failed"
      report "Cycle $cycle: Stop - FAILED"
    fi

    [ "$cycle" -lt 3 ] && sleep 3
  done

  report ""
}

# ============================================================================
# SUMMARY & REPORTING
# ============================================================================

phase_summary() {
  log_header "TEST SUMMARY"

  TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED + TESTS_SKIPPED))
  SUCCESS_RATE=0

  if [ "$TOTAL_TESTS" -gt 0 ]; then
    SUCCESS_RATE=$(( (TESTS_PASSED * 100) / TOTAL_TESTS ))
  fi

  echo ""
  echo -e "Total Tests: ${BLUE}$TOTAL_TESTS${NC}"
  echo -e "Passed:      ${GREEN}$TESTS_PASSED${NC}"
  echo -e "Failed:      ${RED}$TESTS_FAILED${NC}"
  echo -e "Skipped:     ${YELLOW}$TESTS_SKIPPED${NC}"
  echo -e "Success Rate: ${BLUE}${SUCCESS_RATE}%${NC}"
  echo ""

  # Write summary to file
  cat > "$SUMMARY_FILE" << EOF
CLI INFRASTRUCTURE TEST SUMMARY
==============================

Date: $(date)
Duration: $(echo "$(date +%s) - $START_TIME" | bc)s

Test Results:
  Total:   $TOTAL_TESTS
  Passed:  $TESTS_PASSED
  Failed:  $TESTS_FAILED
  Skipped: $TESTS_SKIPPED

Success Rate: ${SUCCESS_RATE}%

Status: $([ "$TESTS_FAILED" -eq 0 ] && echo "✓ PASS" || echo "✗ FAIL")

Detailed Report: $REPORT_FILE
EOF

  cat "$SUMMARY_FILE"

  echo ""
  echo -e "${GRAY}Full report: $REPORT_FILE${NC}"

  # Determine exit code
  if [ "$TESTS_FAILED" -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    return 0
  else
    echo -e "${RED}✗ Some tests failed!${NC}"
    return 1
  fi
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
  START_TIME=$(date +%s)

  log_header "CLI Infrastructure Test Suite"
  echo ""
  echo "Test Mode: $([ "$QUICK_MODE" = true ] && echo "QUICK" || echo "FULL")"
  echo "Start Time: $(date)"

  if [ -n "$SPECIFIC_PHASE" ]; then
    echo "Running Phase: $SPECIFIC_PHASE"
  fi
  echo ""

  # Run phases
  phase_setup

  if [ -z "$SPECIFIC_PHASE" ] || [ "$SPECIFIC_PHASE" = "1" ]; then
    phase_cold_start || exit 1
  fi

  if [ -z "$SPECIFIC_PHASE" ] || [ "$SPECIFIC_PHASE" = "2" ]; then
    phase_service_verification
  fi

  if [ -z "$SPECIFIC_PHASE" ] || [ "$SPECIFIC_PHASE" = "3" ]; then
    phase_process_scan
  fi

  if [ -z "$SPECIFIC_PHASE" ] || [ "$SPECIFIC_PHASE" = "4" ]; then
    phase_cli_testing
  fi

  if [ -z "$SPECIFIC_PHASE" ] || [ "$SPECIFIC_PHASE" = "5" ]; then
    phase_graceful_shutdown || exit 1
  fi

  if [ -z "$SPECIFIC_PHASE" ] || [ "$SPECIFIC_PHASE" = "6" ]; then
    phase_cleanup_verification
  fi

  if ! [ "$QUICK_MODE" = true ] && ([ -z "$SPECIFIC_PHASE" ] || [ "$SPECIFIC_PHASE" = "7" ); then
    phase_rapid_cycles
  fi

  # Summary
  phase_summary
  EXIT_CODE=$?

  echo ""
  exit $EXIT_CODE
}

# Execute main
main "$@"
