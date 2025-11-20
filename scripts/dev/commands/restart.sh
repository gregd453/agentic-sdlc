#!/bin/bash
set -e

# Restart development services
# Usage: dev restart [service]
#   service - Optional service name (defaults to all)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"

source "$SCRIPT_DIR/../lib/colors.sh"
source "$SCRIPT_DIR/../lib/helpers.sh"

# Initialize logging
LOG_FILE=$(init_log_file "restart")
export_log_file "$LOG_FILE"

check_docker

SERVICE=$1

if [ -z "$SERVICE" ]; then
  print_header "ZYP Platform - Restarting All Services"

  # Rebuild dashboard image with latest code
  print_subheader "Rebuilding dashboard Docker image..."
  cd "$PROJECT_ROOT"
  docker build -f packages/dashboard/Dockerfile.prod -t agentic-sdlc-dashboard:latest . > /dev/null 2>&1
  print_success "Dashboard image rebuilt"

  print_subheader "Restarting containers..."
  docker_compose restart
  print_success "All services restarted with latest code"
else
  print_header "ZYP Platform - Restarting Service: $SERVICE"

  # Rebuild dashboard image if restarting dashboard
  if [ "$SERVICE" = "dashboard" ] || [ "$SERVICE" = "agentic-sdlc-dev-dashboard" ]; then
    print_subheader "Rebuilding dashboard Docker image..."
    cd "$PROJECT_ROOT"
    docker build -f packages/dashboard/Dockerfile.prod -t agentic-sdlc-dashboard:latest . > /dev/null 2>&1
    print_success "Dashboard image rebuilt"
  fi

  print_subheader "Restarting $SERVICE..."
  docker_compose restart "$SERVICE"
  print_success "$SERVICE restarted with latest code"
fi

echo ""
print_subheader "Waiting for services to stabilize..."
sleep 5
print_success "Ready!"
echo ""

# Print log location
print_log_location "$LOG_FILE"
