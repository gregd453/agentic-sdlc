#!/bin/bash

################################################################################
# Unified Infrastructure Start Script
# 
# Manages:
# - Docker infrastructure (via Terraform)
# - PM2 orchestrator and agents
# - Health checks and readiness validation
################################################################################

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INFRA_DIR="$PROJECT_ROOT/infrastructure/local"
SCRIPT_DIR="$INFRA_DIR"

# Logging
log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[✓]${NC} $*"; }
log_error() { echo -e "${RED}[✗]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[!]${NC} $*"; }

################################################################################
# Phase 1: Docker Infrastructure (Terraform)
################################################################################

start_docker_infrastructure() {
    log_info "Phase 1: Starting Docker Infrastructure (PostgreSQL, Redis, Dashboard)"
    
    cd "$INFRA_DIR"
    
    # Check Terraform initialization
    if [ ! -d .terraform ]; then
        log_info "Initializing Terraform..."
        terraform init
    fi
    
    # Apply infrastructure
    log_info "Applying Terraform configuration..."
    terraform apply -auto-approve
    
    log_success "Docker infrastructure ready"
}

################################################################################
# Phase 2: PM2 Services (Orchestrator + Agents)
################################################################################

start_pm2_services() {
    log_info "Phase 2: Starting PM2 Services (Orchestrator + Agents)"

    cd "$PROJECT_ROOT"

    # Start PM2 ecosystem via pnpm
    log_info "Starting PM2 services..."
    pnpm pm2:start pm2/ecosystem.dev.config.js || true

    log_success "PM2 services started"
}

################################################################################
# Phase 3: Health Checks
################################################################################

check_service_health() {
    local service=$1
    local port=$2
    local check_cmd=$3
    local max_attempts=30
    local attempt=1
    
    log_info "Checking $service on port $port..."
    
    while [ $attempt -le $max_attempts ]; do
        if eval "$check_cmd" &>/dev/null; then
            log_success "$service is healthy"
            return 0
        fi
        
        echo -ne "\r  Attempt $attempt/$max_attempts..."
        sleep 1
        ((attempt++))
    done
    
    log_error "$service failed to become healthy after ${max_attempts}s"
    return 1
}

validate_all_services() {
    log_info "Phase 3: Validating Service Health"
    
    local failed=0
    
    # Check PostgreSQL
    if ! check_service_health "PostgreSQL" "5433" "docker exec agentic-sdlc-dev-postgres pg_isready -U agentic -d agentic_sdlc"; then
        ((failed++))
    fi
    
    # Check Redis
    if ! check_service_health "Redis" "6380" "docker exec agentic-sdlc-dev-redis redis-cli ping"; then
        ((failed++))
    fi
    
    # Check Dashboard
    if ! check_service_health "Dashboard" "3050" "curl -s http://localhost:3050 > /dev/null"; then
        ((failed++))
    fi
    
    # Check Orchestrator (PM2)
    if ! check_service_health "Orchestrator" "3051" "curl -s http://localhost:3051/api/v1/health > /dev/null"; then
        ((failed++))
    fi
    
    if [ $failed -gt 0 ]; then
        log_error "$failed service(s) failed health check"
        return 1
    fi
    
    log_success "All services are healthy"
}

################################################################################
# Phase 4: Summary
################################################################################

print_summary() {
    log_info "Phase 4: Summary"
    
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║                  INFRASTRUCTURE READY                      ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    echo "Services:"
    echo "  ✓ PostgreSQL        → psql -h localhost -p 5433 -U agentic"
    echo "  ✓ Redis             → redis-cli -p 6380"
    echo "  ✓ Dashboard         → http://localhost:3050"
    echo "  ✓ Orchestrator API  → http://localhost:3051/api/v1/health"
    echo ""
    echo "Commands:"
    echo "  Stop all:           $SCRIPT_DIR/stop-infra.sh"
    echo "  Watch & redeploy:   $SCRIPT_DIR/watch-and-redeploy.sh"
    echo "  View logs:          pm2 logs"
    echo ""
}

################################################################################
# Main
################################################################################

main() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║        Starting Agentic SDLC Infrastructure               ║"
    echo "║   (Docker via Terraform + PM2 Services)                   ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    
    if start_docker_infrastructure && \
       start_pm2_services && \
       validate_all_services; then
        print_summary
        log_success "All infrastructure started successfully!"
        exit 0
    else
        log_error "Infrastructure startup failed"
        exit 1
    fi
}

main
