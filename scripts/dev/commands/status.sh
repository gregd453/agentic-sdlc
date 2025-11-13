#!/bin/bash

# Show status of all development services
# Usage: dev status

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"

source "$SCRIPT_DIR/../lib/colors.sh"
source "$SCRIPT_DIR/../lib/helpers.sh"
source "$SCRIPT_DIR/../lib/services.sh"

check_docker

print_header "ZYP Platform - Service Status"

# Check each infrastructure service
print_subheader "Infrastructure Services"
for service in "${INFRASTRUCTURE_SERVICES[@]}"; do
  if is_running "$service"; then
    print_service_status "$service" "running"
  else
    print_service_status "$service" "exited"
  fi
done

echo ""

# Check application services
print_subheader "Application Services"
for service in "${APPLICATION_SERVICES[@]}"; do
  if is_running "$service"; then
    print_service_status "$service" "running"
  else
    print_service_status "$service" "exited"
  fi
done

echo ""

# Check frontend services
print_subheader "Frontend Services"
for service in "${FRONTEND_SERVICES[@]}"; do
  if is_running "$service"; then
    print_service_status "$service" "running"
  else
    print_service_status "$service" "exited"
  fi
done

echo ""

# Port availability
print_subheader "Key Ports"
declare -a KEY_SERVICES=("zyp-pilot" "user-core-api" "user-chat-api" "nfl-games-api" "postgres" "redis")
for service in "${KEY_SERVICES[@]}"; do
  port=$(get_service_port "$service")
  name=$(get_service_name "$service")

  if is_running "$service"; then
    echo -e "  ${GREEN}${SUCCESS}${NC} ${BOLD}localhost:${port}${NC} - ${name}"
  else
    echo -e "  ${RED}${ERROR}${NC} ${BOLD}localhost:${port}${NC} - ${name} ${DIM}[offline]${NC}"
  fi
done

echo ""

# Overall status
print_header "✓ Status Check Complete"
