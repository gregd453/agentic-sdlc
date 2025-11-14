#!/bin/bash

##############################################################################
# STOP-DEV.sh - Stop Agentic SDLC Development Environment
#
# Gracefully stops all running services:
# - Orchestrator (via PM2)
# - Dashboard (via PM2)
# - All Agents (via PM2)
# - Redis
# - PostgreSQL
#
# Updated in Session #58: Now uses PM2 for process management
# Updated in Session #61: Added Dashboard UI
#
# Usage:
#   ./scripts/env/stop-dev.sh              # Stop all services gracefully
#   ./scripts/env/stop-dev.sh --containers # Stop only Docker containers
##############################################################################

set -e
set -u  # Error on undefined variables

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DOCKER_COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"

# Parse arguments
CONTAINERS_ONLY=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --containers) CONTAINERS_ONLY=true; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}Agentic SDLC - Development Environment Shutdown${NC}"
echo -e "${BLUE}(Using PM2 Process Management)${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# 1. Stop PM2 processes (if not --containers-only)
if [ "$CONTAINERS_ONLY" = false ]; then
  echo -e "${YELLOW}[1/3]${NC} Stopping PM2 processes..."
  cd "$PROJECT_ROOT"
  if pnpm pm2:stop 2>&1 | grep -q "stopped"; then
    echo -e "  ${GREEN}✓${NC} PM2 processes stopped"
  else
    echo -e "  ${YELLOW}!${NC} PM2 processes already stopped or not running"
  fi

  sleep 1
  echo ""
fi

# 2. Cleanup orphaned processes (in case PM2 missed something)
echo -e "${YELLOW}[2/3]${NC} Cleaning up orphaned processes..."

# Define patterns that might be orphaned
declare -a KILL_PATTERNS=(
  "tsx.*run-agent"
  "tsx watch"
  "npm run dev"
  "npm start"
  "vitest"
  "vite.*--host"
)

ORPHAN_COUNT=0
for pattern in "${KILL_PATTERNS[@]}"; do
  count=$(pgrep -f "$pattern" 2>/dev/null | wc -l || true)
  if [ "$count" -gt 0 ]; then
    echo -e "  Killing $count orphaned process(es) matching: $pattern"
    pkill -9 -f "$pattern" 2>/dev/null || true
    ((ORPHAN_COUNT += count)) || true
  fi
done

if [ "$ORPHAN_COUNT" -gt 0 ]; then
  echo -e "  ${YELLOW}!${NC} Cleaned up $ORPHAN_COUNT orphaned process(es)"
else
  echo -e "  ${GREEN}✓${NC} No orphaned processes found"
fi

sleep 1
echo ""

# 3. Stop Docker containers
echo -e "${YELLOW}[3/3]${NC} Stopping Docker containers..."
if docker-compose -f "$DOCKER_COMPOSE_FILE" down 2>/dev/null; then
  echo -e "  ${GREEN}✓${NC} Docker containers stopped"
else
  echo -e "  ${YELLOW}!${NC} Docker containers already stopped or not running"
fi

echo ""

# 4. Final verification
echo -e "${YELLOW}[4/4]${NC} Final verification..."

# Verify no orphaned processes remain
STRAGGLERS=$(pgrep -f "node|npm|vitest|tsx|esbuild" 2>/dev/null | grep -v VSCode | wc -l || true)
if [ "$STRAGGLERS" -eq 0 ]; then
  echo -e "  ${GREEN}✓${NC} No orphaned processes remain"
else
  echo -e "  ${YELLOW}⚠${NC}  $STRAGGLERS non-critical process(es) remain"
fi

# Remove old logs (keep recent ones)
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
