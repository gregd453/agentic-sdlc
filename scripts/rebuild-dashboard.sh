#!/bin/bash

# ============================================================================
# rebuild-dashboard.sh - Rebuild and redeploy dashboard with latest code
# Automates the full build -> Docker image -> container restart cycle
# ============================================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║       Dashboard Rebuild & Redeploy Script                 ║"
echo "║  Rebuilds React app, Docker image, and restarts container ║"
echo "╚════════════════════════════════════════════════════════════╝"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ============================================================================
# Step 1: Source environment variables
# ============================================================================
echo -e "\n${BLUE}[1/5]${NC} Loading environment variables..."
if [ -f .env.development ]; then
  export $(cat .env.development | grep -v '^#' | xargs)
  echo -e "${GREEN}✓${NC} Environment variables loaded"
else
  echo -e "${RED}✗${NC} .env.development not found"
  exit 1
fi

# ============================================================================
# Step 2: Build React dashboard with pnpm
# ============================================================================
echo -e "\n${BLUE}[2/5]${NC} Building React dashboard..."
if ! pnpm run build --filter=@agentic-sdlc/dashboard 2>&1 | grep -E "Tasks:|error|ERROR" | tail -10; then
  echo -e "${RED}✗${NC} Dashboard build failed"
  exit 1
fi
echo -e "${GREEN}✓${NC} Dashboard React build successful"

# ============================================================================
# Step 3: Build Docker image
# ============================================================================
echo -e "\n${BLUE}[3/5]${NC} Building Docker image..."
if docker build -f packages/dashboard/Dockerfile.prod -t agentic-sdlc-dashboard:latest . > /tmp/docker-build.log 2>&1; then
  echo -e "${GREEN}✓${NC} Docker image built successfully"
else
  echo -e "${RED}✗${NC} Docker build failed"
  cat /tmp/docker-build.log | tail -20
  exit 1
fi

# ============================================================================
# Step 4: Stop and remove old container
# ============================================================================
echo -e "\n${BLUE}[4/5]${NC} Restarting dashboard container..."
if docker ps | grep -q agentic-sdlc-dev-dashboard; then
  echo "  Stopping old container..."
  docker rm -f agentic-sdlc-dev-dashboard > /dev/null 2>&1
  sleep 2
fi

# ============================================================================
# Step 5: Start new container
# ============================================================================
echo "  Starting new container..."
if docker run -d \
  --name agentic-sdlc-dev-dashboard \
  --network agentic-network \
  -p 3050:3050 \
  -e NODE_ENV=production \
  -e PORT=3050 \
  agentic-sdlc-dashboard:latest > /dev/null 2>&1; then

  sleep 3

  # Verify the container is healthy
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:3050 | grep -q "200"; then
    echo -e "${GREEN}✓${NC} Dashboard container restarted and healthy"
  else
    echo -e "${YELLOW}⚠${NC} Container started but health check failed"
    docker logs agentic-sdlc-dev-dashboard | tail -20
    exit 1
  fi
else
  echo -e "${RED}✗${NC} Failed to start container"
  exit 1
fi

# ============================================================================
# Success!
# ============================================================================
echo -e "\n${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║${NC}         Dashboard Rebuild Complete!                      ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}                                                          ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ✓ React app rebuilt                                    ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ✓ Docker image updated                                 ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ✓ Container restarted                                  ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  ✓ Health check passed                                  ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}                                                          ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Dashboard: http://localhost:3050                       ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}                                                          ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  💡 Hard refresh your browser to see changes:           ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}     Chrome: Ctrl+Shift+R                                ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}     Mac:    Cmd+Shift+R                                 ${GREEN}║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"

exit 0
