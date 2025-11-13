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
  print_subheader "Restarting..."
  docker_compose restart
  print_success "All services restarted"
else
  print_header "ZYP Platform - Restarting Service: $SERVICE"
  print_subheader "Restarting $SERVICE..."
  docker_compose restart "$SERVICE"
  print_success "$SERVICE restarted"
fi

echo ""
print_subheader "Waiting for services to stabilize..."
sleep 5
print_success "Ready!"
echo ""

# Print log location
print_log_location "$LOG_FILE"
