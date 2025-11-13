#!/bin/bash

# Health check for all services
# Usage: dev health

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"

source "$SCRIPT_DIR/../lib/colors.sh"
source "$SCRIPT_DIR/../lib/helpers.sh"
source "$SCRIPT_DIR/../lib/services.sh"

# Initialize logging
LOG_FILE=$(init_log_file "health")
export_log_file "$LOG_FILE"

check_docker

print_header "Agentic SDLC - Health Check"

# Test infrastructure
print_subheader "Infrastructure"

echo -n "  PostgreSQL (5433)... "
if timeout 5 bash -c 'docker exec agentic-postgres-1 pg_isready -U agentic > /dev/null 2>&1' || \
   timeout 5 bash -c 'PGPASSWORD=dev_password psql -h localhost -p 5433 -U agentic -d agentic_sdlc_dev -c "SELECT 1" > /dev/null 2>&1'; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC}"
fi

echo -n "  Redis (6380)... "
if timeout 5 bash -c 'docker exec agentic-redis-1 redis-cli ping > /dev/null 2>&1' || \
   timeout 5 bash -c 'redis-cli -p 6380 ping > /dev/null 2>&1'; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC}"
fi

echo ""

# Test Orchestrator
print_subheader "Orchestrator"

echo -n "  Orchestrator API (3000)... "
if timeout 5 curl -f -s "http://localhost:3000/api/v1/health" > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${YELLOW}⚠${NC} (unavailable)"
fi

echo ""

# Test Agents
print_subheader "Agents"

for agent in "${AGENT_SERVICES[@]}"; do
  container_name="agentic-${agent}-1"
  echo -n "  ${agent}... "

  # Check if container is running
  if docker ps --format '{{.Names}}' | grep -q "^${container_name}$"; then
    # Check if process is healthy (look for node process)
    if docker exec "$container_name" pgrep -f "node.*${agent}" > /dev/null 2>&1; then
      echo -e "${GREEN}✓${NC} (running)"
    else
      echo -e "${YELLOW}⚠${NC} (container up, process unclear)"
    fi
  else
    echo -e "${RED}✗${NC} (not running)"
  fi
done

echo ""

# Test Message Bus
print_subheader "Message Bus"

echo -n "  Redis Streams... "
if timeout 5 bash -c 'docker exec agentic-redis-1 redis-cli XINFO GROUPS stream:agent:scaffold:tasks 2>/dev/null | grep -q "agent-scaffold-group"' || \
   timeout 5 bash -c 'redis-cli -p 6380 XINFO GROUPS stream:agent:scaffold:tasks 2>/dev/null | grep -q "agent-scaffold-group"'; then
  echo -e "${GREEN}✓${NC} (consumer groups active)"
else
  echo -e "${YELLOW}⚠${NC} (streams not initialized)"
fi

echo -n "  Pub/Sub Channels... "
if timeout 5 bash -c 'docker exec agentic-redis-1 redis-cli PUBSUB CHANNELS "agent:*" > /dev/null 2>&1' || \
   timeout 5 bash -c 'redis-cli -p 6380 PUBSUB CHANNELS "agent:*" > /dev/null 2>&1'; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${YELLOW}⚠${NC}"
fi

echo ""
print_header "✓ Health Check Complete"
echo ""

# Print log location
print_log_location "$LOG_FILE"
