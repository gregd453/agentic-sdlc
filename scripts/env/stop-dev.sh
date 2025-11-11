#!/bin/bash

##############################################################################
# STOP-DEV.sh - Stop Agentic SDLC Development Environment
#
# Gracefully stops all running services:
# - Orchestrator
# - All Agents (Scaffold, Validation, E2E, Integration, Deployment)
# - Redis
# - PostgreSQL
#
# Updated in Session #37: Now handles all 5 pipeline agents
#
# Usage:
#   ./scripts/env/stop-dev.sh              # Stop all services gracefully
#   ./scripts/env/stop-dev.sh --force      # Force kill all services
#   ./scripts/env/stop-dev.sh --containers # Stop only Docker containers
##############################################################################

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PIDS_FILE="$PROJECT_ROOT/.pids/services.pids"
DOCKER_COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"

# Parse arguments
FORCE=false
CONTAINERS_ONLY=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --force) FORCE=true; shift ;;
    --containers) CONTAINERS_ONLY=true; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}Agentic SDLC - Development Environment Shutdown${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# 1. Stop Node processes (if not --containers-only)
if [ "$CONTAINERS_ONLY" = false ]; then
  echo -e "${YELLOW}[1/3]${NC} Stopping Node services..."

  if [ -f "$PIDS_FILE" ]; then
    while IFS= read -r pid; do
      if kill -0 "$pid" 2>/dev/null; then
        if [ "$FORCE" = true ]; then
          kill -9 "$pid" 2>/dev/null || true
          echo -e "  ${GREEN}✓${NC} Killed process $pid (force)"
        else
          kill "$pid" 2>/dev/null || true
          echo -e "  ${GREEN}✓${NC} Stopped process $pid"
        fi
      fi
    done < "$PIDS_FILE"
    rm "$PIDS_FILE"
  else
    echo -e "  ${YELLOW}!${NC} No processes file found"
  fi

  # Also kill any stray Node processes
  pkill -f "npm run dev" 2>/dev/null || true
  pkill -f "tsx watch" 2>/dev/null || true

  sleep 2
  echo ""
fi

# 2. Stop Docker containers
echo -e "${YELLOW}[2/3]${NC} Stopping Docker containers..."
if docker-compose -f "$DOCKER_COMPOSE_FILE" down 2>/dev/null; then
  echo -e "  ${GREEN}✓${NC} Docker containers stopped"
else
  echo -e "  ${YELLOW}!${NC} Docker containers already stopped or not running"
fi

echo ""

# 3. Cleanup
echo -e "${YELLOW}[3/3]${NC} Cleanup..."

# Remove PID file if it still exists
rm -f "$PIDS_FILE"
echo -e "  ${GREEN}✓${NC} Cleaned up PID files"

# Remove old logs (keep last 10)
LOG_DIR="$PROJECT_ROOT/scripts/logs"
if [ -d "$LOG_DIR" ]; then
  find "$LOG_DIR" -type f -name "*.log" -mtime +7 -delete 2>/dev/null || true
  echo -e "  ${GREEN}✓${NC} Cleaned up old logs"
fi

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}✓ Development Environment Stopped!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo "To start again: ./scripts/env/start-dev.sh"
echo ""
