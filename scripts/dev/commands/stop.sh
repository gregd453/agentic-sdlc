#!/bin/bash
set -e

# Stop development environment
# Usage: dev stop [options]
#   --hard    Remove volumes (clean shutdown)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"

source "$SCRIPT_DIR/../lib/colors.sh"
source "$SCRIPT_DIR/../lib/helpers.sh"

# Parse arguments
HARD=false
while [[ $# -gt 0 ]]; do
  case $1 in
    --hard) HARD=true; shift ;;
    *) shift ;;
  esac
done

check_docker

print_header "ZYP Platform - Stopping Development Environment"

if [ "$HARD" = true ]; then
  print_subheader "Stopping services and removing volumes..."
  docker_compose down -v --remove-orphans
  print_success "All services stopped and volumes removed"
else
  print_subheader "Stopping services..."
  docker_compose down --remove-orphans
  print_success "All services stopped"
  echo ""
  echo -e "${CYAN}${ARROW}${NC} To remove volumes, run: ${BLUE}dev stop --hard${NC}"
fi

echo ""
print_header "✓ Services Stopped"
