#!/bin/bash
set -e

# Build Docker images
# Usage: dev build [options]
#   --force   Force rebuild without cache

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"

source "$SCRIPT_DIR/../lib/colors.sh"
source "$SCRIPT_DIR/../lib/helpers.sh"

# Initialize logging
LOG_FILE=$(init_log_file "build")
export_log_file "$LOG_FILE"

check_docker

FORCE=false
while [[ $# -gt 0 ]]; do
  case $1 in
    --force) FORCE=true; shift ;;
    *) shift ;;
  esac
done

print_header "ZYP Platform - Building Docker Images"

print_subheader "Building images..."
if [ "$FORCE" = true ]; then
  docker_compose build --no-cache 2>&1 | tee -a "$LOG_FILE"
else
  docker_compose build 2>&1 | tee -a "$LOG_FILE"
fi

print_success "Build complete"
echo ""

# Print log location
print_log_location "$LOG_FILE"
