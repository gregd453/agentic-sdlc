#!/bin/bash

################################################################################
# Unified Infrastructure Stop Script
#
# Gracefully stops:
# - PM2 services (Orchestrator + Agents)
# - Docker infrastructure (via Terraform)
################################################################################

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
INFRA_DIR="$PROJECT_ROOT/infrastructure/local"

# Logging
log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[✓]${NC} $*"; }
log_error() { echo -e "${RED}[✗]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[!]${NC} $*"; }

main() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║     Stopping Agentic SDLC Infrastructure                  ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    
    # Phase 1: Stop PM2 services
    log_info "Stopping PM2 services (Orchestrator + Agents)..."
    cd "$PROJECT_ROOT"
    if pm2 list &>/dev/null; then
        pm2 stop ecosystem.dev.config.js || true
        log_success "PM2 services stopped"
    else
        log_warn "PM2 not running"
    fi
    
    echo ""
    
    # Phase 2: Destroy Docker infrastructure (optional - commented by default)
    log_info "Stopping Docker infrastructure..."
    cd "$INFRA_DIR"
    
    if [ "${KEEP_VOLUMES:-false}" = "true" ]; then
        log_info "Keeping volumes for data persistence"
    else
        log_warn "Use KEEP_VOLUMES=true to preserve database and cache data"
    fi
    
    terraform destroy -auto-approve
    log_success "Docker infrastructure stopped"
    
    echo ""
    log_success "Infrastructure stopped successfully"
    echo ""
    echo "To start again, run: ./start-infra.sh"
    echo ""
}

main
