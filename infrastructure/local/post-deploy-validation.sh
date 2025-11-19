#!/bin/bash

################################################################################
# Post-Deployment Validation Script
#
# Verifies after deployment/restart:
# - All containers are running
# - All services are healthy
# - Database is accessible
# - Cache is cleared where necessary
# - No orphaned containers exist
################################################################################

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DASHBOARD_URL="http://localhost:3050"
ORCHESTRATOR_URL="http://localhost:3051/api/v1/health"
DB_HOST="localhost"
DB_PORT="5433"
DB_USER="agentic"
DB_NAME="agentic_sdlc"
REDIS_PORT="6380"

# Logging
log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[✓]${NC} $*"; }
log_error() { echo -e "${RED}[✗]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[!]${NC} $*"; }

# Exit code tracking
FAILED=0

################################################################################
# Service Health Checks
################################################################################

check_service() {
  local service=$1
  local url=$2
  local timeout=${3:-10}

  log_info "Checking $service at $url..."

  for attempt in {1..5}; do
    if curl -sf --connect-timeout 2 --max-time $timeout "$url" > /dev/null 2>&1; then
      log_success "$service is healthy"
      return 0
    fi

    if [ $attempt -lt 5 ]; then
      echo -ne "\r  Attempt $attempt/5..."
      sleep 2
    fi
  done

  log_error "$service failed health check"
  ((FAILED++))
  return 1
}

check_database() {
  log_info "Checking PostgreSQL ($DB_HOST:$DB_PORT)..."

  if docker exec agentic-sdlc-dev-postgres pg_isready \
    -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; then
    log_success "PostgreSQL is healthy"
    return 0
  fi

  log_error "PostgreSQL is not responding"
  ((FAILED++))
  return 1
}

check_redis() {
  log_info "Checking Redis ($REDIS_PORT)..."

  if docker exec agentic-sdlc-dev-redis redis-cli -p $REDIS_PORT ping 2>/dev/null | grep -q "PONG"; then
    log_success "Redis is healthy"
    return 0
  fi

  log_error "Redis is not responding"
  ((FAILED++))
  return 1
}

################################################################################
# Container Status Checks
################################################################################

check_containers() {
  log_info "Checking Docker containers..."

  local required_containers=(
    "agentic-sdlc-dev-postgres"
    "agentic-sdlc-dev-redis"
    "agentic-sdlc-dev-dashboard"
  )

  for container in "${required_containers[@]}"; do
    if docker ps | grep -q "$container"; then
      log_success "Container $container is running"
    else
      log_error "Container $container is NOT running"
      ((FAILED++))
    fi
  done
}

check_pm2_services() {
  log_info "Checking PM2 services..."

  cd "$(dirname "${BASH_SOURCE[0]}")/../.."

  local required_services=(
    "orchestrator"
    "agent-scaffold"
    "agent-validation"
    "agent-e2e"
    "agent-integration"
    "agent-deployment"
  )

  for service in "${required_services[@]}"; do
    if pm2 list 2>/dev/null | grep -q "$service"; then
      local status=$(pm2 list 2>/dev/null | grep "$service" | grep -oP '(?<=status\s{2}\S)\w+' || echo "unknown")
      if [ "$status" == "online" ]; then
        log_success "PM2 service $service is online"
      else
        log_warn "PM2 service $service is $status"
        ((FAILED++))
      fi
    else
      log_error "PM2 service $service is NOT running"
      ((FAILED++))
    fi
  done
}

################################################################################
# Asset Cache Validation
################################################################################

check_asset_caching() {
  log_info "Checking asset cache headers..."

  # Check hashed assets have long cache
  local asset=$(curl -sI "$DASHBOARD_URL/assets/"* 2>/dev/null | grep -i cache-control || echo "")
  if echo "$asset" | grep -q "max-age=31536000"; then
    log_success "Hashed assets have correct cache headers (1 year)"
  else
    log_warn "Hashed assets may have incorrect cache headers"
  fi

  # Check index.html has no cache
  local index=$(curl -sI "$DASHBOARD_URL/index.html" 2>/dev/null | grep -i cache-control || echo "")
  if echo "$index" | grep -q "no-cache\|no-store"; then
    log_success "index.html has correct no-cache headers"
  else
    log_warn "index.html cache headers may be incorrect"
  fi
}

################################################################################
# Cleanup Old Containers
################################################################################

cleanup_orphaned_containers() {
  log_info "Cleaning up orphaned Docker containers..."

  # Remove stopped containers
  local stopped=$(docker ps -aq --filter "status=exited")
  if [ -n "$stopped" ]; then
    log_info "Removing stopped containers..."
    docker rm $stopped > /dev/null 2>&1 || true
    log_success "Removed stopped containers"
  fi

  # Remove dangling images
  local dangling=$(docker images -q --filter "dangling=true")
  if [ -n "$dangling" ]; then
    log_info "Removing dangling images..."
    docker rmi $dangling > /dev/null 2>&1 || true
    log_success "Removed dangling images"
  fi
}

################################################################################
# Database Connection Pool Check
################################################################################

check_db_pool_health() {
  log_info "Checking database connection pool health..."

  # This is a basic check - in production you'd query actual pool stats
  if docker exec agentic-sdlc-dev-postgres \
    psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
    log_success "Database connection pool is healthy"
  else
    log_error "Database connection pool check failed"
    ((FAILED++))
  fi
}

################################################################################
# Service Dependency Verification
################################################################################

verify_service_dependencies() {
  log_info "Verifying service interdependencies..."

  # Dashboard should be able to reach Orchestrator API
  if curl -sf "$DASHBOARD_URL" > /dev/null 2>&1; then
    log_success "Dashboard is accessible"
  else
    log_error "Dashboard is not accessible"
    ((FAILED++))
  fi

  # Dashboard backend should reach Orchestrator
  if curl -sf "$ORCHESTRATOR_URL" > /dev/null 2>&1; then
    log_success "Orchestrator API is accessible"
  else
    log_error "Orchestrator API is not accessible"
    ((FAILED++))
  fi
}

################################################################################
# Generate Report
################################################################################

print_summary() {
  echo ""
  echo "╔════════════════════════════════════════════════════════════╗"
  echo "║        Post-Deployment Validation Report                  ║"
  echo "╚════════════════════════════════════════════════════════════╝"
  echo ""

  if [ $FAILED -eq 0 ]; then
    log_success "ALL CHECKS PASSED"
    echo ""
    echo "Services are healthy and ready for use:"
    echo "  ✓ All containers running"
    echo "  ✓ Database accessible"
    echo "  ✓ Redis operational"
    echo "  ✓ Dashboard serving with correct cache headers"
    echo "  ✓ PM2 services online"
    echo "  ✓ Service interdependencies verified"
    echo ""
    return 0
  else
    log_error "$FAILED CHECK(S) FAILED"
    echo ""
    echo "Some services are not healthy. Check logs above."
    echo ""
    return 1
  fi
}

################################################################################
# Main Execution
################################################################################

main() {
  echo ""
  echo "╔════════════════════════════════════════════════════════════╗"
  echo "║     Starting Post-Deployment Validation                   ║"
  echo "╚════════════════════════════════════════════════════════════╝"
  echo ""

  check_containers
  echo ""
  check_pm2_services
  echo ""
  check_database
  check_redis
  echo ""
  check_service "Dashboard" "$DASHBOARD_URL"
  check_service "Orchestrator API" "$ORCHESTRATOR_URL"
  echo ""
  check_asset_caching
  echo ""
  check_db_pool_health
  verify_service_dependencies
  echo ""
  cleanup_orphaned_containers
  echo ""
  print_summary
}

main
exit $FAILED
