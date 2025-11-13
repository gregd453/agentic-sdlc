#!/bin/bash
set -e

# Open a shell in a service container
# Usage: dev shell [service]
#   service - Service name (defaults to user-core-api)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"

source "$SCRIPT_DIR/../lib/colors.sh"
source "$SCRIPT_DIR/../lib/helpers.sh"

check_docker

SERVICE=${1:-user-core-api}

# Verify service exists
if ! docker_compose config --services 2>/dev/null | grep -q "^${SERVICE}$"; then
  print_error "Service not found: $SERVICE"
  list_services
  exit 1
fi

# Check if service is running
if ! is_running "$SERVICE"; then
  print_error "Service is not running: $SERVICE"
  print_info "Start services with: ${BLUE}dev start${NC}"
  exit 1
fi

print_header "ZYP Platform - Shell: $SERVICE"
echo -e "${YELLOW}Type 'exit' to return to host shell${NC}"
echo ""

# Open interactive shell
docker_compose exec -it "$SERVICE" bash
