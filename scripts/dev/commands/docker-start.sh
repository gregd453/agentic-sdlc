#!/bin/bash
set -e

# Start development environment with Docker
# All services run in containers via docker-compose
#
# Usage: dev docker-start [options]
#   --build   Rebuild images from scratch
#   --clean   Clean volumes and start fresh
#   --logs    Follow logs after starting
#
# Services started: postgres, redis, nginx, zyp-pilot, 6 APIs, 5 frontends

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"

source "$SCRIPT_DIR/../lib/colors.sh"
source "$SCRIPT_DIR/../lib/helpers.sh"
source "$SCRIPT_DIR/../lib/services.sh"

# Parse arguments
BUILD=false
CLEAN=false
LOGS=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --build) BUILD=true; shift ;;
    --clean) CLEAN=true; shift ;;
    --logs) LOGS=true; shift ;;
    *) shift ;;
  esac
done

# Checks
check_docker
check_compose_file
setup_interrupt_trap

# Initialize logging
LOG_FILE=$(init_log_file "start")
export_log_file "$LOG_FILE"

print_header "ZYP Platform - Starting with Docker (docker-compose)"
log_output "$LOG_FILE" "Log file: $LOG_FILE"
log_output "$LOG_FILE" ""

# Clean if requested
if [ "$CLEAN" = true ]; then
  print_subheader "Cleaning existing deployment..."
  docker_compose down -v --remove-orphans 2>/dev/null || true
  print_success "Cleanup complete"
  echo ""
fi

# Build if requested
if [ "$BUILD" = true ]; then
  print_subheader "Building images..."
  docker_compose build --no-cache
  print_success "Build complete"
  echo ""
fi

# Run codegen if building
if [ "$BUILD" = true ]; then
  print_subheader "Regenerating API client types..."
  cd "$PROJECT_ROOT"
  if pnpm codegen > /dev/null 2>&1; then
    print_success "Code generation complete"
  else
    print_warning "Code generation had issues (check manually)"
  fi
  echo ""
fi

# Start infrastructure
print_subheader "Starting infrastructure services..."
docker_compose up -d postgres redis

echo -n "  Waiting for PostgreSQL... "
if timeout 60 bash -c 'until docker exec zyp-dev-postgres pg_isready -U postgres > /dev/null 2>&1; do sleep 1; done'; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC}"
  print_error "PostgreSQL failed to start"
  exit 1
fi

echo -n "  Waiting for Redis... "
if timeout 30 bash -c 'until docker exec zyp-dev-redis redis-cli ping > /dev/null 2>&1; do sleep 1; done'; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC}"
  print_warning "Redis failed to start (continuing anyway)"
fi

echo ""

# Run migrations
print_subheader "Running database migrations..."
docker_compose run --rm user-core-api pnpm exec prisma migrate deploy > /dev/null 2>&1
docker_compose run --rm user-core-api pnpm exec prisma generate > /dev/null 2>&1
docker_compose run --rm user-chat-api pnpm exec prisma generate > /dev/null 2>&1
docker_compose run --rm user-credit-api pnpm run prisma:migrate:deploy > /dev/null 2>&1
docker_compose run --rm user-credit-api pnpm exec prisma generate > /dev/null 2>&1
docker_compose run --rm nfl-games-api pnpm exec prisma generate > /dev/null 2>&1
docker_compose run --rm nfl-square-api pnpm exec prisma generate > /dev/null 2>&1
docker_compose run --rm user-credit-worker pnpm exec prisma generate > /dev/null 2>&1

print_success "Migrations complete"
echo ""

# Start application services
print_subheader "Starting application services..."
docker_compose up -d nginx
sleep 5
docker_compose up -d

# Wait for services
echo -n "  Waiting for services to be ready... "
sleep 10
echo -e "${GREEN}✓${NC}"

echo ""

# Health checks
print_subheader "Running health checks..."

HEALTHY_COUNT=0
TOTAL_SERVICES=6

for service in zyp-pilot user-core-api user-chat-api user-credit-api nfl-games-api nfl-square-api; do
  echo -n "  ${service}... "

  if [ "$service" = "zyp-pilot" ]; then
    ENDPOINT="http://localhost:3050/"
  else
    ENDPOINT="http://localhost:$(get_service_port $service)/health"
  fi

  if curl -f -s "$ENDPOINT" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
    HEALTHY_COUNT=$((HEALTHY_COUNT + 1))
  else
    echo -e "${YELLOW}⚠${NC} (still starting)"
  fi
done

echo ""
print_header "✓ Development Environment Started"

# Display information
list_service_urls

echo -e "${YELLOW}Useful commands:${NC}"
echo -e "  ${BLUE}dev status${NC}     - Check service status"
echo -e "  ${BLUE}dev logs${NC}       - View live logs"
echo -e "  ${BLUE}dev restart${NC}    - Restart services"
echo -e "  ${BLUE}dev shell${NC}      - Open shell in API container"
echo -e "  ${BLUE}dev migrate${NC}    - Run database migrations"
echo -e "  ${BLUE}dev stop${NC}       - Stop all services"
echo ""

# Print log location
print_log_location "$LOG_FILE"

# Follow logs if requested
if [ "$LOGS" = true ]; then
  echo -e "${BLUE}========================================${NC}"
  echo -e "${YELLOW}Following logs (press Ctrl+C to stop)${NC}"
  echo -e "${BLUE}========================================${NC}"
  echo ""
  docker_compose logs -f | tee -a "$LOG_FILE"
fi
