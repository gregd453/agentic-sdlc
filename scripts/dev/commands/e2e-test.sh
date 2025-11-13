#!/bin/bash
# Run Playwright E2E tests for ZYP Platform shell
#
# Usage: dev e2e-test [options] [test-file]
#   --start-services    Auto-start required services (shell + frontends)
#   --headed            Run tests with visible browser
#   --ui                Run in interactive UI mode
#   --debug             Run in debug mode with inspector
#   --report            Show HTML test report
#   [test-file]         Optional specific test file (e.g., shell-health.spec.ts)
#
# Examples:
#   dev e2e-test                           # Run all tests
#   dev e2e-test --start-services          # Auto-start services and run tests
#   dev e2e-test --headed shell-health     # Run specific test with browser visible
#   dev e2e-test --debug                   # Debug mode

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"
E2E_DIR="$PROJECT_ROOT/tests/e2e"

source "$SCRIPT_DIR/../lib/colors.sh"
source "$SCRIPT_DIR/../lib/helpers.sh"

# Parse arguments
START_SERVICES=false
HEADED=false
UI_MODE=false
DEBUG=false
SHOW_REPORT=false
TEST_FILE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --start-services) START_SERVICES=true; shift ;;
    --headed) HEADED=true; shift ;;
    --ui) UI_MODE=true; shift ;;
    --debug) DEBUG=true; shift ;;
    --report) SHOW_REPORT=true; shift ;;
    *) TEST_FILE="$1"; shift ;;
  esac
done

# Initialize logging
LOG_FILE=$(init_log_file "e2e-test")
export_log_file "$LOG_FILE"

print_header "ZYP Platform - E2E Tests (Playwright)"
log_output "$LOG_FILE" "Log file: $LOG_FILE"
log_output "$LOG_FILE" ""

# Verify E2E directory exists
if [ ! -d "$E2E_DIR" ]; then
  print_error "E2E tests directory not found: $E2E_DIR"
  exit 1
fi

# Check if Playwright is installed
if [ ! -d "$E2E_DIR/node_modules/@playwright" ]; then
  print_warning "Playwright not found. Installing dependencies..."
  log_output "$LOG_FILE" "Installing Playwright dependencies..."

  cd "$E2E_DIR"
  pnpm install >> "$LOG_FILE" 2>&1 || {
    print_error "Failed to install Playwright"
    exit 1
  }

  print_success "Playwright installed"
  log_output "$LOG_FILE" "Playwright installed successfully"
  echo ""
fi

# Start services if requested
if [ "$START_SERVICES" = true ]; then
  print_subheader "Starting required services (shell + frontends)..."
  log_output "$LOG_FILE" "Starting development services..."

  # Check if services are already running
  SHELL_RUNNING=false
  if curl -s http://localhost:3050/ > /dev/null 2>&1; then
    SHELL_RUNNING=true
    print_warning "Shell already running on port 3050"
  fi

  if [ "$SHELL_RUNNING" = false ]; then
    # Start shell in background
    print_status "Starting shell (port 3050)..."
    cd "$PROJECT_ROOT"
    pnpm dev --filter=@zyp/zyp-rspack-1 > "$LOG_FILE.shell" 2>&1 &
    SHELL_PID=$!
    log_output "$LOG_FILE" "Shell PID: $SHELL_PID"

    # Wait for shell to be ready
    print_status "Waiting for shell to be ready..."
    SHELL_READY=false
    for i in {1..60}; do
      if curl -s http://localhost:3050/ > /dev/null 2>&1; then
        SHELL_READY=true
        break
      fi
      echo -n "."
      sleep 2
    done

    if [ "$SHELL_READY" = false ]; then
      print_error "Shell failed to start within 120 seconds"
      kill $SHELL_PID 2>/dev/null || true
      exit 1
    fi
    print_success "Shell ready"
    echo ""
  fi

  # Start frontend apps in background
  print_status "Starting frontend apps (ports 3200-3203)..."
  cd "$PROJECT_ROOT"
  pnpm dev --filter='@zyp/*frontend' > "$LOG_FILE.frontends" 2>&1 &
  FRONTENDS_PID=$!
  log_output "$LOG_FILE" "Frontends PID: $FRONTENDS_PID"

  # Wait for at least one frontend to be ready
  print_status "Waiting for frontends to be ready..."
  FRONTENDS_READY=false
  for i in {1..60}; do
    ready_count=0
    for port in 3200 3201 3202 3203; do
      curl -s http://localhost:$port/ > /dev/null 2>&1 && ((ready_count++)) || true
    done

    if [ $ready_count -ge 2 ]; then
      FRONTENDS_READY=true
      break
    fi
    echo -n "."
    sleep 2
  done

  if [ "$FRONTENDS_READY" = false ]; then
    print_warning "Not all frontends started, but continuing anyway..."
  else
    print_success "Frontends ready"
  fi
  echo ""
fi

# Build playwright command
print_subheader "Running E2E tests..."
log_output "$LOG_FILE" "Running Playwright E2E tests..."
echo ""

cd "$E2E_DIR"

PLAYWRIGHT_CMD="npm test"

if [ -n "$TEST_FILE" ]; then
  PLAYWRIGHT_CMD="$PLAYWRIGHT_CMD -- specs/$TEST_FILE"
fi

if [ "$HEADED" = true ]; then
  PLAYWRIGHT_CMD="$PLAYWRIGHT_CMD --headed"
fi

if [ "$UI_MODE" = true ]; then
  PLAYWRIGHT_CMD="$PLAYWRIGHT_CMD --ui"
fi

if [ "$DEBUG" = true ]; then
  PLAYWRIGHT_CMD="$PLAYWRIGHT_CMD --debug"
fi

log_output "$LOG_FILE" "Command: $PLAYWRIGHT_CMD"
log_output "$LOG_FILE" ""

# Run tests with progress output
if eval "$PLAYWRIGHT_CMD" | tee -a "$LOG_FILE"; then
  print_success "Tests completed successfully"
  TEST_RESULT=0
else
  print_error "Tests failed"
  TEST_RESULT=1
fi

echo ""

# Show report if requested
if [ "$SHOW_REPORT" = true ] && [ -d "$E2E_DIR/reports/html" ]; then
  print_subheader "Opening test report..."
  cd "$E2E_DIR"
  npx playwright show-report reports/html
fi

# Print cleanup instructions if services were started
if [ "$START_SERVICES" = true ]; then
  echo ""
  print_subheader "Cleanup:"
  echo "To stop services, run:"
  echo "  ${CYAN}dev stop${NC}"
fi

print_log_location "$LOG_FILE"

exit $TEST_RESULT
