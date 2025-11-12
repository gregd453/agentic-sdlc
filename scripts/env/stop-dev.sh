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
# Updated in Session #51: Enhanced process cleanup with tree management
#
# Usage:
#   ./scripts/env/stop-dev.sh              # Stop all services gracefully
#   ./scripts/env/stop-dev.sh --force      # Force kill all services
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

# Source process manager library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ -f "$SCRIPT_DIR/lib/process-manager.sh" ]; then
  source "$SCRIPT_DIR/lib/process-manager.sh"
else
  echo -e "${RED}ERROR: Process manager library not found${NC}"
  exit 1
fi

# 1. Stop Node processes (if not --containers-only)
if [ "$CONTAINERS_ONLY" = false ]; then
  echo -e "${YELLOW}[1/4]${NC} Stopping Node services (graceful)..."

  GRACEFUL_TIMEOUT=3
  REMAINING=0

  # Phase 1: Send SIGTERM to all tracked processes
  if [ -f "$PIDS_FILE" ]; then
    local services_file="${PIDS_FILE}.services"

    while IFS= read -r pid; do
      [ -z "$pid" ] && continue

      if kill -0 "$pid" 2>/dev/null; then
        local service_name
        service_name=$(get_service_name "$pid" "$services_file")

        if [ "$FORCE" = true ]; then
          # Force kill immediately
          kill -9 "$pid" 2>/dev/null || true
          echo -e "  ${GREEN}✓${NC} Force killed $service_name (PID: $pid)"
        else
          # Graceful shutdown: SIGTERM
          kill -15 "$pid" 2>/dev/null || true
          echo -e "  ${GREEN}✓${NC} Sent SIGTERM to $service_name (PID: $pid)"
        fi
      fi
    done < "$PIDS_FILE"

    # Phase 2: Wait for graceful shutdown
    if [ "$FORCE" = false ]; then
      echo "  Waiting ${GRACEFUL_TIMEOUT}s for graceful shutdown..."
      sleep "$GRACEFUL_TIMEOUT"

      # Phase 3: Kill any remaining processes
      echo -e "${YELLOW}[2/4]${NC} Force killing remaining processes..."
      while IFS= read -r pid; do
        [ -z "$pid" ] && continue

        if kill -0 "$pid" 2>/dev/null; then
          local service_name
          service_name=$(get_service_name "$pid" "$services_file")
          kill -9 "$pid" 2>/dev/null || true
          echo -e "  ${GREEN}✓${NC} Force killed $service_name (PID: $pid)"
          ((REMAINING++)) || true
        fi
      done < "$PIDS_FILE"

      if [ "$REMAINING" -gt 0 ]; then
        echo -e "  ${YELLOW}!${NC} Had to force kill $REMAINING process(es)"
      fi
    fi
  else
    echo -e "  ${YELLOW}!${NC} No process tracking file found, falling back to pkill"
  fi

  sleep 1
  echo ""
fi

# 2. Kill orphaned processes using comprehensive pkill patterns
echo -e "${YELLOW}[3/4]${NC} Cleaning up orphaned processes..."

# Define all patterns to kill
declare -a KILL_PATTERNS=(
  "npm run dev"
  "npm run start"
  "npm start"
  "npm run test"
  "npm test"
  "tsx watch"
  "tsx.*run-agent"
  "vitest"
  "turbo run test"
  "pnpm run test"
  "esbuild"
)

ORPHAN_COUNT=0
for pattern in "${KILL_PATTERNS[@]}"; do
  local count
  count=$(pgrep -f "$pattern" 2>/dev/null | wc -l || true)
  if [ "$count" -gt 0 ]; then
    echo -e "  Killing $count orphaned process(es) matching: $pattern"
    pkill -9 -f "$pattern" 2>/dev/null || true
    ((ORPHAN_COUNT += count)) || true
  fi
done

if [ "$ORPHAN_COUNT" -gt 0 ]; then
  echo -e "  ${YELLOW}!${NC} Cleaned up $ORPHAN_COUNT orphaned process(es)"
fi

sleep 1
echo ""

# 4. Stop Docker containers
echo -e "${YELLOW}[4/4]${NC} Stopping Docker containers..."
if docker-compose -f "$DOCKER_COMPOSE_FILE" down 2>/dev/null; then
  echo -e "  ${GREEN}✓${NC} Docker containers stopped"
else
  echo -e "  ${YELLOW}!${NC} Docker containers already stopped or not running"
fi

echo ""

# 5. Final cleanup and verification
echo -e "${YELLOW}[5/5]${NC} Final cleanup and verification..."

# Remove process tracking files
cleanup_tracking_files "$PIDS_FILE"
echo -e "  ${GREEN}✓${NC} Cleaned up process tracking files"

# Verify no orphaned processes remain
STRAGGLERS=$(pgrep -f "node|npm|vitest|tsx|esbuild" 2>/dev/null | grep -v VSCode | wc -l || true)
if [ "$STRAGGLERS" -eq 0 ]; then
  echo -e "  ${GREEN}✓${NC} No orphaned processes remain"
else
  echo -e "  ${YELLOW}⚠${NC}  $STRAGGLERS non-critical process(es) remain"
fi

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
