#!/bin/bash

##############################################################################
# RESET-DEV.sh - Reset Agentic SDLC to Clean State
#
# WARNING: This will DESTROY all data!
# - Removes Docker containers and volumes
# - Clears generated apps from /tmp/agentic-sdlc-output
# - Resets all databases
#
# Usage:
#   ./scripts/env/reset-dev.sh              # Interactive (prompts for confirmation)
#   ./scripts/env/reset-dev.sh --force      # Reset without prompting
#   ./scripts/env/reset-dev.sh --keep-apps  # Keep generated apps
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
DOCKER_COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"
APPS_OUTPUT="/tmp/agentic-sdlc-output"

# Parse arguments
FORCE=false
KEEP_APPS=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --force) FORCE=true; shift ;;
    --keep-apps) KEEP_APPS=true; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

echo -e "${RED}================================================${NC}"
echo -e "${RED}⚠️  RESET AGENTIC SDLC - DATA WILL BE DESTROYED!${NC}"
echo -e "${RED}================================================${NC}"
echo ""

# Confirmation
if [ "$FORCE" = false ]; then
  echo "This will:"
  echo "  - Stop all services"
  echo "  - Remove Docker containers"
  echo "  - Clear all database data"
  if [ "$KEEP_APPS" = false ]; then
    echo "  - Delete generated apps"
  fi
  echo ""
  read -p "Continue? (yes/no): " confirm
  if [ "$confirm" != "yes" ]; then
    echo "Reset cancelled."
    exit 0
  fi
else
  echo "Force reset enabled - proceeding without confirmation"
  echo ""
fi

echo -e "${YELLOW}[1/4]${NC} Stopping services..."
"$PROJECT_ROOT/scripts/env/stop-dev.sh" --force > /dev/null 2>&1 || true
echo -e "  ${GREEN}✓${NC} Services stopped"

echo ""
echo -e "${YELLOW}[2/4]${NC} Removing Docker containers and volumes..."
docker-compose -f "$DOCKER_COMPOSE_FILE" down -v 2>/dev/null || true
echo -e "  ${GREEN}✓${NC} Docker cleanup complete"

echo ""
echo -e "${YELLOW}[3/4]${NC} Cleaning up generated apps..."
if [ "$KEEP_APPS" = false ]; then
  rm -rf "$APPS_OUTPUT" 2>/dev/null || true
  echo -e "  ${GREEN}✓${NC} Generated apps removed"
else
  echo -e "  ${YELLOW}!${NC} Keeping generated apps (--keep-apps)"
fi

echo ""
echo -e "${YELLOW}[4/4]${NC} Cleanup..."
rm -rf "$PROJECT_ROOT/.pids" 2>/dev/null || true
rm -rf "$PROJECT_ROOT/scripts/logs"/* 2>/dev/null || true
echo -e "  ${GREEN}✓${NC} Cache and logs cleared"

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}✓ Reset Complete! Ready for fresh start.${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo "To start fresh environment:"
echo "  ./scripts/env/start-dev.sh"
echo ""
