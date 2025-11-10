#!/bin/bash

##############################################################################
# START-DEV.sh - Start Agentic SDLC Development Environment
#
# Starts all required services for pipeline testing:
# - PostgreSQL 16
# - Redis 7
# - Orchestrator API
# - Scaffold Agent
# - Validation Agent (optional)
# - E2E Agent (optional)
#
# Usage:
#   ./scripts/env/start-dev.sh              # Start core services
#   ./scripts/env/start-dev.sh --all        # Start all agents
#   ./scripts/env/start-dev.sh --verbose    # Show detailed output
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
PIDS_FILE="$PROJECT_ROOT/.pids/services.pids"
LOGS_DIR="$PROJECT_ROOT/scripts/logs"

# Parse arguments
VERBOSE=false
ALL_AGENTS=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --verbose) VERBOSE=true; shift ;;
    --all) ALL_AGENTS=true; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Ensure directories exist
mkdir -p "$PROJECT_ROOT/.pids"
mkdir -p "$LOGS_DIR"

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}Agentic SDLC - Development Environment Startup${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# 1. Start Docker containers (PostgreSQL + Redis)
echo -e "${YELLOW}[1/4]${NC} Starting Docker containers..."
if docker-compose -f "$DOCKER_COMPOSE_FILE" up -d postgres redis 2>/dev/null; then
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

# 2. Start Orchestrator
echo -e "${YELLOW}[2/4]${NC} Starting Orchestrator API..."
(
  cd "$PROJECT_ROOT/packages/orchestrator"
  npm run dev > "$LOGS_DIR/orchestrator.log" 2>&1 &
  echo $! >> "$PIDS_FILE"
)

# Wait for orchestrator to be ready
echo "  Waiting for Orchestrator on :3000..."
for i in {1..30}; do
  if curl -s http://localhost:3000/api/v1/health | grep -q "healthy" 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} Orchestrator ready on http://localhost:3000"
    break
  fi
  if [ $i -eq 30 ]; then
    echo -e "  ${RED}✗${NC} Orchestrator failed to start"
    exit 1
  fi
  sleep 1
done

echo ""

# 3. Start Scaffold Agent
echo -e "${YELLOW}[3/4]${NC} Starting Scaffold Agent..."
(
  cd "$PROJECT_ROOT/packages/agents/scaffold-agent"
  npm start > "$LOGS_DIR/scaffold-agent.log" 2>&1 &
  echo $! >> "$PIDS_FILE"
)

sleep 3
echo -e "  ${GREEN}✓${NC} Scaffold Agent started (PID: $(tail -1 $PIDS_FILE))"

echo ""

# 4. Start additional agents (if --all)
if [ "$ALL_AGENTS" = true ]; then
  echo -e "${YELLOW}[4/4]${NC} Starting additional agents..."

  for agent in validation-agent e2e-agent; do
    if [ -d "$PROJECT_ROOT/packages/agents/$agent" ]; then
      (
        cd "$PROJECT_ROOT/packages/agents/$agent"
        npm run dev > "$LOGS_DIR/$agent.log" 2>&1 &
        echo $! >> "$PIDS_FILE"
      )
      echo -e "  ${GREEN}✓${NC} $agent started"
    fi
  done
else
  echo -e "${YELLOW}[4/4]${NC} Skipping additional agents (use --all to enable)"
fi

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}✓ Development Environment Ready!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo "Services running:"
echo -e "  ${BLUE}PostgreSQL${NC}     → localhost:5433"
echo -e "  ${BLUE}Redis${NC}          → localhost:6380"
echo -e "  ${BLUE}Orchestrator${NC}   → http://localhost:3000"
echo -e "  ${BLUE}Scaffold Agent${NC} → listening for tasks"
echo ""
echo "Logs directory: $LOGS_DIR"
echo "Process IDs saved to: $PIDS_FILE"
echo ""
echo "To stop services: ./scripts/env/stop-dev.sh"
echo "To monitor workflow: ./scripts/monitor-workflow.sh <workflow_id>"
echo ""
