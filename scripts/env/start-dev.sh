#!/bin/bash

##############################################################################
# START-DEV.sh - Start Agentic SDLC Development Environment
#
# Starts all required services for complete pipeline testing:
# - PostgreSQL 16 (via Docker)
# - Redis 7 (via Docker)
# - Dashboard UI (via Docker)
# - Orchestrator API (via PM2)
# - Scaffold Agent (via PM2)
# - Validation Agent (via PM2)
# - E2E Agent (via PM2)
# - Integration Agent (via PM2)
# - Deployment Agent (via PM2)
#
# Updated in Session #58: Now uses PM2 for process management
# Updated in Session #59: Auto-rebuild if source files are newer than builds
# Updated in Session #61: Added Dashboard UI
# Updated in Session #68: Dashboard moved to Docker-only (no PM2 duplication)
#
# Usage:
#   ./scripts/env/start-dev.sh              # Start all services (auto-rebuild if needed)
#   ./scripts/env/start-dev.sh --verbose    # Show detailed output
#   ./scripts/env/start-dev.sh --skip-build # Skip build check (faster startup)
#   ./scripts/env/start-dev.sh --build      # Force full rebuild before starting
##############################################################################

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DOCKER_COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"
LOGS_DIR="$PROJECT_ROOT/scripts/logs"

# Parse arguments
VERBOSE=false
SKIP_BUILD=false
FORCE_BUILD=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --verbose) VERBOSE=true; shift ;;
    --skip-build) SKIP_BUILD=true; shift ;;
    --build) FORCE_BUILD=true; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Ensure directories exist
mkdir -p "$LOGS_DIR"

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}Agentic SDLC - Development Environment Startup${NC}"
echo -e "${BLUE}(Docker + PM2 Process Management)${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# 1. Start Docker containers (PostgreSQL + Redis + Dashboard)
echo -e "${YELLOW}[1/3]${NC} Starting Docker containers..."
if docker-compose -f "$DOCKER_COMPOSE_FILE" up -d postgres redis dashboard 2>/dev/null || docker-compose -f "$PROJECT_ROOT/docker-compose.simple.yml" up -d 2>/dev/null; then
  echo -e "${GREEN}✓${NC} Docker containers started"

  # Wait for containers to be healthy
  echo "  Waiting for services to be healthy..."
  sleep 5

  # Check PostgreSQL
  if docker exec agentic-sdlc-postgres pg_isready -U agentic 2>/dev/null | grep -q "accepting"; then
    echo -e "  ${GREEN}✓${NC} PostgreSQL 16 ready on :5433"
  else
    echo -e "  ${RED}✗${NC} PostgreSQL not ready"
    exit 1
  fi

  # Check Redis
  if docker exec agentic-sdlc-redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
    echo -e "  ${GREEN}✓${NC} Redis 7 ready on :6380"
  else
    echo -e "  ${RED}✗${NC} Redis not ready"
    exit 1
  fi
else
  echo -e "${RED}✗${NC} Failed to start Docker containers"
  exit 1
fi

echo ""

# 2. Build packages if needed
if [ "$SKIP_BUILD" = false ]; then
  if [ "$FORCE_BUILD" = true ]; then
    echo -e "${YELLOW}[2/4]${NC} Force rebuilding all packages..."
  else
    echo -e "${YELLOW}[2/4]${NC} Ensuring latest builds..."
  fi
  cd "$PROJECT_ROOT"

  # Run build (turbo will use cache for unchanged packages unless --build flag)
  BUILD_CMD="pnpm build"
  if [ "$FORCE_BUILD" = true ]; then
    BUILD_CMD="pnpm build --force"
  fi

  if [ "$VERBOSE" = true ]; then
    $BUILD_CMD
  else
    $BUILD_CMD > /dev/null 2>&1
  fi

  if [ $? -eq 0 ]; then
    if [ "$FORCE_BUILD" = true ]; then
      echo -e "  ${GREEN}✓${NC} All packages rebuilt"
    else
      echo -e "  ${GREEN}✓${NC} Packages built (or cached)"
    fi
  else
    echo -e "  ${RED}✗${NC} Build failed"
    echo ""
    echo "Build errors detected. Run manually to see details:"
    echo "  pnpm build"
    exit 1
  fi
else
  echo -e "${YELLOW}[2/4]${NC} Skipping build (--skip-build flag)"
fi

echo ""

# 3. Run PM2 preflight check
echo -e "${YELLOW}[3/4]${NC} Validating build artifacts..."
if bash "$PROJECT_ROOT/scripts/pm2-preflight.sh"; then
  echo -e "  ${GREEN}✓${NC} All build artifacts present"
else
  echo -e "  ${RED}✗${NC} Build artifacts missing"
  echo ""
  echo "Please build all packages first:"
  echo "  pnpm build"
  exit 1
fi

echo ""

# 4. Start PM2 processes
echo -e "${YELLOW}[4/4]${NC} Starting PM2 processes (orchestrator + agents)..."
cd "$PROJECT_ROOT"
if pnpm pm2:start 2>&1 | grep -v "pnpm pm2:start"; then
  echo -e "  ${GREEN}✓${NC} PM2 processes started"
else
  echo -e "  ${RED}✗${NC} Failed to start PM2 processes"
  exit 1
fi

# Wait for orchestrator to be ready
echo "  Waiting for Orchestrator on :3051..."
for i in {1..30}; do
  if curl -s http://localhost:3051/api/v1/health | grep -q "healthy" 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} Orchestrator ready on http://localhost:3051"
    break
  fi
  if [ $i -eq 30 ]; then
    echo -e "  ${RED}✗${NC} Orchestrator failed to start"
    echo "  Check logs: pnpm pm2:logs"
    exit 1
  fi
  sleep 1
done

# Dashboard is now managed by Docker, not removed

# Wait for dashboard to be ready (Docker manages it)
echo "  Waiting for Dashboard on :3050..."
for i in {1..30}; do
  if curl -s http://localhost:3050 2>/dev/null | grep -q "<!doctype html"; then
    echo -e "  ${GREEN}✓${NC} Dashboard ready on http://localhost:3050"
    break
  fi
  if [ $i -eq 30 ]; then
    echo -e "  ${YELLOW}!${NC} Dashboard may not be ready (non-critical)"
    echo "  Check logs: pnpm pm2:logs dashboard"
    break
  fi
  sleep 1
done

# Check and stop analytics service if running
echo "  Checking Analytics Service..."
if docker ps | grep -q "agentic-sdlc-analytics"; then
  echo -e "  ${YELLOW}→${NC} Analytics service already running, stopping..."
  docker-compose -f "$DOCKER_COMPOSE_FILE" down analytics-service 2>/dev/null || true
  sleep 2
fi

# Start analytics service
echo "  Starting Analytics Service on :3002..."
if docker-compose -f "$DOCKER_COMPOSE_FILE" up -d analytics-service; then
  for i in {1..30}; do
    if curl -s http://localhost:3002/health 2>/dev/null | grep -q "healthy"; then
      echo -e "  ${GREEN}✓${NC} Analytics Service ready on http://localhost:3002"
      break
    fi
    if [ $i -eq 30 ]; then
      echo -e "  ${YELLOW}!${NC} Analytics Service may not be ready"
      docker logs agentic-sdlc-analytics 2>&1 | tail -5
      break
    fi
    sleep 1
  done
else
  echo -e "  ${YELLOW}!${NC} Analytics Service startup non-critical"
fi

# Give agents a moment to initialize
sleep 2

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}✓ Development Environment Ready!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo "Services running (managed by PM2):"
echo -e "  ${BLUE}PostgreSQL${NC}       → localhost:5433"
echo -e "  ${BLUE}Redis${NC}            → localhost:6380"
echo -e "  ${BLUE}Orchestrator${NC}     → http://localhost:3051"
echo -e "  ${BLUE}Dashboard${NC}        → http://localhost:3050"
echo -e "  ${BLUE}Analytics Service${NC} → http://localhost:3002"
echo -e "  ${BLUE}Scaffold Agent${NC}   → listening for tasks"
echo -e "  ${BLUE}Validation Agent${NC} → listening for tasks"
echo -e "  ${BLUE}E2E Agent${NC}        → listening for tasks"
echo -e "  ${BLUE}Integration Agent${NC} → listening for tasks"
echo -e "  ${BLUE}Deployment Agent${NC} → listening for tasks"
echo ""
echo "PM2 Management:"
echo -e "  ${BLUE}pnpm pm2:status${NC}  → Show process status"
echo -e "  ${BLUE}pnpm pm2:logs${NC}    → Tail all logs"
echo -e "  ${BLUE}pnpm pm2:logs dashboard${NC} → Dashboard logs only"
echo -e "  ${BLUE}pnpm pm2:monit${NC}   → Live monitoring dashboard"
echo ""
echo "Quick Links:"
echo -e "  ${BLUE}Orchestrator API${NC} → http://localhost:3051/api/v1/health"
echo -e "  ${BLUE}Dashboard UI${NC}     → http://localhost:3050"
echo -e "  ${BLUE}Analytics API${NC}    → http://localhost:3002/health"
echo -e "  ${BLUE}Analytics Docs${NC}   → http://localhost:3002/docs"
echo ""
echo "Logs directory: $LOGS_DIR"
echo ""
echo "To stop services: ./scripts/env/stop-dev.sh"
echo "To monitor workflow: ./scripts/monitor-workflow.sh <workflow_id>"
echo ""
