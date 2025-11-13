#!/bin/bash

##############################################################################
# CHECK-HEALTH.sh - Verify Environment Health
#
# Checks the status of all services and reports health status
#
# Usage:
#   ./scripts/env/check-health.sh              # Quick health check
#   ./scripts/env/check-health.sh --verbose    # Detailed status
#   ./scripts/env/check-health.sh --wait       # Wait for all services ready
##############################################################################

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
VERBOSE=false
WAIT=false
TIMEOUT=60

while [[ $# -gt 0 ]]; do
  case $1 in
    --verbose) VERBOSE=true; shift ;;
    --wait) WAIT=true; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}Agentic SDLC - Environment Health Check${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

HEALTHY=true
CHECKS_PASSED=0
CHECKS_FAILED=0

# Function to check service
check_service() {
  local name=$1
  local url=$2
  local expected=$3

  if [ "$VERBOSE" = true ]; then
    echo -n "Checking $name... "
  fi

  start_time=$(date +%s)
  while true; do
    response=$(curl -s "$url" 2>/dev/null || echo "")
    if echo "$response" | grep -q "$expected" 2>/dev/null; then
      echo -e "  ${GREEN}✓${NC} $name"
      ((CHECKS_PASSED++))
      return 0
    fi

    elapsed=$(($(date +%s) - start_time))
    if [ $elapsed -gt $TIMEOUT ]; then
      echo -e "  ${RED}✗${NC} $name (timeout)"
      ((CHECKS_FAILED++))
      HEALTHY=false
      return 1
    fi

    if [ "$WAIT" = false ]; then
      break
    fi

    sleep 1
  done

  if [ "$WAIT" = false ]; then
    echo -e "  ${RED}✗${NC} $name"
    ((CHECKS_FAILED++))
    HEALTHY=false
  fi
}

# Check each service
echo "Service Status:"
echo ""

# PostgreSQL
if docker ps 2>/dev/null | grep -q "agentic-sdlc-postgres"; then
  if docker exec agentic-sdlc-postgres pg_isready -U agentic 2>/dev/null | grep -q "accepting"; then
    echo -e "  ${GREEN}✓${NC} PostgreSQL 16 on :5433"
    ((CHECKS_PASSED++))
  else
    echo -e "  ${RED}✗${NC} PostgreSQL 16 (not responding)"
    ((CHECKS_FAILED++))
    HEALTHY=false
  fi
else
  echo -e "  ${RED}✗${NC} PostgreSQL 16 (not running)"
  ((CHECKS_FAILED++))
  HEALTHY=false
fi

# Redis
if docker ps 2>/dev/null | grep -q "agentic-sdlc-redis"; then
  if docker exec agentic-sdlc-redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
    echo -e "  ${GREEN}✓${NC} Redis 7 on :6380"
    ((CHECKS_PASSED++))
  else
    echo -e "  ${RED}✗${NC} Redis 7 (not responding)"
    ((CHECKS_FAILED++))
    HEALTHY=false
  fi
else
  echo -e "  ${RED}✗${NC} Redis 7 (not running)"
  ((CHECKS_FAILED++))
  HEALTHY=false
fi

# Orchestrator API
if check_service "Orchestrator API" "http://localhost:3000/api/v1/health" "healthy"; then
  :
fi

# Hexagonal Architecture Health (Phase 3)
if check_service "Message Bus & KV" "http://localhost:3000/health/hexagonal" "ok"; then
  :
fi

echo ""
echo "Process Status:"
echo ""

# Check node processes
if pgrep -f "npm run dev" > /dev/null 2>&1; then
  NODE_COUNT=$(pgrep -f "npm run dev" | wc -l)
  echo -e "  ${GREEN}✓${NC} $NODE_COUNT Node processes running"
  ((CHECKS_PASSED++))
else
  echo -e "  ${YELLOW}!${NC} No Node processes running"
fi

echo ""
echo -e "${BLUE}================================================${NC}"
if [ "$HEALTHY" = true ]; then
  echo -e "${GREEN}✓ Environment Healthy ($CHECKS_PASSED/6 checks passed)${NC}"
else
  echo -e "${RED}✗ Environment Issues Detected ($CHECKS_FAILED failed, $CHECKS_PASSED passed)${NC}"
fi
echo -e "${BLUE}================================================${NC}"
echo ""

if [ "$HEALTHY" = false ] && [ "$WAIT" = false ]; then
  echo "To wait for services: ./scripts/env/check-health.sh --wait"
  echo ""
  exit 1
fi
