#!/bin/bash
# Start development environment locally (not in Docker)
# Services run on your local machine, requires postgres + redis installed
#
# Usage: dev local-start [options]
#   --no-db    Skip database/redis startup (assume already running)
#   --logs     Show service logs (default: background)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"

source "$SCRIPT_DIR/../lib/colors.sh"
source "$SCRIPT_DIR/../lib/helpers.sh"

# Parse arguments
SKIP_DB=false
SHOW_LOGS=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --no-db) SKIP_DB=true; shift ;;
    --logs) SHOW_LOGS=true; shift ;;
    *) shift ;;
  esac
done

# Initialize logging
LOG_FILE=$(init_log_file "local-start")
export_log_file "$LOG_FILE"

print_header "ZYP Platform - Starting Locally (pnpm dev)"
log_output "$LOG_FILE" "Log file: $LOG_FILE"
log_output "$LOG_FILE" ""
log_output "$LOG_FILE" "Development Mode: Local (services on your machine)"
log_output "$LOG_FILE" ""

# Start databases if not skipped
if [ "$SKIP_DB" = false ]; then
  print_subheader "Starting local databases..."
  log_output "$LOG_FILE" "Starting databases..."

  if "$SCRIPT_DIR/local-db.sh" start >> "$LOG_FILE" 2>&1; then
    print_success "Databases ready"
  else
    print_error "Failed to start databases"
    print_warning "Use 'dev local-db' to diagnose or install postgres/redis"
    exit 1
  fi
  echo ""
fi

# Check if already running
print_subheader "Checking for port conflicts..."
log_output "$LOG_FILE" "Checking for port conflicts..."

CONFLICTS=()

# Check critical ports
for PORT in 3001 3002 3003 3004 3005 3050 5173 5174 3100 3101 3102; do
  if lsof -i :$PORT > /dev/null 2>&1; then
    CONFLICTS+=("$PORT")
  fi
done

if [ ${#CONFLICTS[@]} -gt 0 ]; then
  print_error "Port conflicts detected on ports: ${CONFLICTS[*]}"
  echo ""
  echo "Solution options:"
  echo "1. Stop existing services: $( echo "${CONFLICTS[*]}" | xargs -I {} sh -c 'lsof -i :{} | tail -1')"
  echo "2. Kill processes: ${BLUE}lsof -i :[port] | awk \"NR!=1 {print \\\$2}\" | xargs kill -9${NC}"
  echo "3. Run with Docker instead: ${BLUE}dev docker-start${NC}"
  exit 1
fi

print_success "No port conflicts"
echo ""

# Install dependencies if needed
if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
  print_subheader "Installing dependencies..."
  cd "$PROJECT_ROOT"
  pnpm install >> "$LOG_FILE" 2>&1
  print_success "Dependencies installed"
  echo ""
fi

# Run migrations
print_subheader "Running database migrations..."
log_output "$LOG_FILE" "Running migrations..."

cd "$PROJECT_ROOT"

# For local dev, we run migrations directly
# (Not via docker-compose)
if pnpm run seed:fresh >> "$LOG_FILE" 2>&1; then
  print_success "Migrations complete"
else
  print_warning "Migrations had issues - check manually with: pnpm run seed:fresh"
fi
echo ""

# Start services
print_subheader "Starting application services locally..."
log_output "$LOG_FILE" "Starting pnpm dev..."
echo ""
echo -e "${BLUE}Services starting (${BOLD}Ctrl+C to stop${BLUE}):${NC}"
echo "  • Shell:      ${BLUE}http://localhost:3050${NC}"
echo "  • Nginx:      ${BLUE}http://localhost:3000${NC}"
echo "  • APIs:       ${BLUE}http://localhost:3001-3005${NC}"
echo "  • Frontends:  ${BLUE}http://localhost:3100-3102, 5173-5174${NC}"
echo ""
echo -e "${YELLOW}Tip: Use 'dev logs' in another terminal to monitor${NC}"
echo ""

# Print log location
print_log_location "$LOG_FILE"
echo ""

# Start services
cd "$PROJECT_ROOT"

if [ "$SHOW_LOGS" = true ]; then
  # Run in foreground with logs visible
  pnpm dev 2>&1 | tee -a "$LOG_FILE"
else
  # Run in background
  pnpm dev > /tmp/zyp-local-dev.log 2>&1 &
  PID=$!

  echo -e "${GREEN}✓ Services started (PID: $PID)${NC}"
  echo ""
  echo "Use these commands:"
  echo "  ${BLUE}dev logs${NC}              - Watch all logs"
  echo "  ${BLUE}dev logs [service]${NC}    - Watch specific service"
  echo "  ${BLUE}dev stop${NC}              - Stop all services"
  echo "  ${BLUE}tail -f /tmp/zyp-local-dev.log${NC} - Initial startup logs"
  echo ""

  # Wait a bit for services to start
  sleep 5

  # Check if services are up
  print_subheader "Checking services..."
  for service in zyp-pilot user-core-api user-chat-api user-credit-api nfl-games-api nfl-square-api; do
    echo -n "  ${service}... "

    if [ "$service" = "zyp-pilot" ]; then
      ENDPOINT="http://localhost:3050/"
    else
      ENDPOINT="http://localhost:$(get_service_port $service)/health"
    fi

    if curl -f -s "$ENDPOINT" > /dev/null 2>&1; then
      echo -e "${GREEN}✓${NC}"
    else
      echo -e "${YELLOW}⚠ (starting)${NC}"
    fi
  done
  echo ""
fi
