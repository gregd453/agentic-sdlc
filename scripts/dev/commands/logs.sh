#!/bin/bash

# View development service logs
# Usage: dev logs [service]
#   service - Optional service name (defaults to all)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"

source "$SCRIPT_DIR/../lib/colors.sh"
source "$SCRIPT_DIR/../lib/helpers.sh"
source "$SCRIPT_DIR/../lib/services.sh"

check_docker
setup_interrupt_trap

SERVICE=$1

if [ -z "$SERVICE" ]; then
  print_header "ZYP Platform - Service Logs (all services)"
  echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
  echo ""
  docker_compose logs -f
else
  print_header "ZYP Platform - Service Logs: $SERVICE"
  echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
  echo ""
  docker_compose logs -f "$SERVICE"
fi
