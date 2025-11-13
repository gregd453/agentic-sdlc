#!/bin/bash
set -e

# Full reset of development environment
# Usage: dev reset [options]
#   --rebuild   Also rebuild images from scratch

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"

source "$SCRIPT_DIR/../lib/colors.sh"
source "$SCRIPT_DIR/../lib/helpers.sh"

# Initialize logging
LOG_FILE=$(init_log_file "reset")
export_log_file "$LOG_FILE"

check_docker

REBUILD=false
while [[ $# -gt 0 ]]; do
  case $1 in
    --rebuild) REBUILD=true; shift ;;
    *) shift ;;
  esac
done

print_header "ZYP Platform - Full Reset"

echo -e "${BRIGHT_RED}⚠ WARNING: This will stop all services and remove all volumes${NC}"
echo ""
read -p "Are you sure? (yes/no): " -r confirm

if [ "$confirm" != "yes" ]; then
  print_info "Reset cancelled"
  exit 0
fi

echo ""

# Stop and clean
print_subheader "Stopping all services..."
docker_compose down -v --remove-orphans 2>/dev/null || true
print_success "Services stopped and volumes removed"

echo ""

# Rebuild if requested
if [ "$REBUILD" = true ]; then
  print_subheader "Rebuilding images..."
  docker_compose build --no-cache
  print_success "Images rebuilt"
  echo ""
fi

# Regenerate code
print_subheader "Regenerating code..."
cd "$PROJECT_ROOT"
if pnpm codegen > /dev/null 2>&1; then
  print_success "Code generated"
else
  print_warning "Code generation had issues"
fi

echo ""
print_header "✓ Reset Complete"
echo ""
echo -e "${CYAN}${ARROW}${NC} Start services with: ${BLUE}dev start${NC}"
echo ""

# Print log location
print_log_location "$LOG_FILE"
