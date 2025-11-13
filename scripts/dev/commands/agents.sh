#!/bin/bash

# Display agent status and information
# Usage: dev agents [agent-name]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"

source "$SCRIPT_DIR/../lib/colors.sh"
source "$SCRIPT_DIR/../lib/helpers.sh"
source "$SCRIPT_DIR/../lib/services.sh"

# Initialize logging
LOG_FILE=$(init_log_file "agents")
export_log_file "$LOG_FILE"

check_docker

AGENT_NAME="${1:-}"

if [ -n "$AGENT_NAME" ]; then
  # Show specific agent details
  print_header "Agent Details: $AGENT_NAME"

  container_name="agentic-${AGENT_NAME}-1"

  # Check if agent exists
  if ! printf '%s\n' "${AGENT_SERVICES[@]}" | grep -q "^${AGENT_NAME}$"; then
    echo -e "${RED}Error:${NC} Unknown agent '${AGENT_NAME}'"
    echo ""
    echo "Available agents:"
    for agent in "${AGENT_SERVICES[@]}"; do
      echo "  - $agent"
    done
    exit 1
  fi

  echo ""
  print_subheader "Container Status"

  if docker ps --format '{{.Names}}' | grep -q "^${container_name}$"; then
    echo -e "  Status: ${GREEN}Running${NC}"

    # Get container details
    uptime=$(docker inspect --format='{{.State.StartedAt}}' "$container_name" 2>/dev/null | xargs -I{} date -j -f "%Y-%m-%dT%H:%M:%S" "{}" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "Unknown")
    echo "  Started: $uptime"

    # Check resource usage
    stats=$(docker stats "$container_name" --no-stream --format "table {{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null | tail -1)
    if [ -n "$stats" ]; then
      echo "  Resources: $stats"
    fi
  else
    echo -e "  Status: ${RED}Not Running${NC}"
  fi

  echo ""
  print_subheader "Recent Logs (last 20 lines)"
  echo ""

  docker logs "$container_name" --tail 20 2>&1 || echo "  No logs available"

else
  # Show all agents
  print_header "Agentic SDLC - Agent Status"

  echo ""
  print_subheader "Active Agents"
  echo ""

  for agent in "${AGENT_SERVICES[@]}"; do
    container_name="agentic-${agent}-1"
    name=$(get_service_name "$agent")

    echo -n "  ${BOLD}${agent}${NC} - ${name}"

    if docker ps --format '{{.Names}}' | grep -q "^${container_name}$"; then
      echo -e " ${GREEN}[Running]${NC}"

      # Check for recent activity in logs
      recent_activity=$(docker logs "$container_name" --since 5m 2>&1 | wc -l | tr -d ' ')
      if [ "$recent_activity" -gt 0 ]; then
        echo -e "    ${DIM}Active: ${recent_activity} log entries in last 5min${NC}"
      fi
    else
      echo -e " ${RED}[Stopped]${NC}"
    fi
  done

  echo ""
  print_subheader "Message Bus Activity"
  echo ""

  # Check Redis streams for agent activity
  for agent in scaffold validation e2e; do
    stream_name="stream:agent:${agent}:tasks"
    echo -n "  ${agent} tasks: "

    # Count pending tasks in stream
    count=$(docker exec agentic-redis-1 redis-cli XLEN "$stream_name" 2>/dev/null || redis-cli -p 6380 XLEN "$stream_name" 2>/dev/null || echo "0")

    if [ "$count" = "0" ]; then
      echo -e "${GREEN}0 pending${NC}"
    else
      echo -e "${YELLOW}${count} pending${NC}"
    fi
  done

  echo ""
  echo "Usage: dev agents [agent-name]  # Show detailed info for specific agent"
  echo "       dev logs [agent-name]     # Stream agent logs"
  echo "       dev shell [agent-name]    # Access agent container shell"
fi

echo ""
print_header "✓ Agent Status Complete"
echo ""

# Print log location
print_log_location "$LOG_FILE"
