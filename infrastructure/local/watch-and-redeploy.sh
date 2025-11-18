#!/bin/bash

################################################################################
# Watch & Auto-Redeploy Script
#
# Monitors for changes in source code and automatically rebuilds/redeploys:
# - Dashboard container on Dockerfile or src changes
# - PM2 services on package changes
################################################################################

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
INFRA_DIR="$PROJECT_ROOT/infrastructure/local"
DASHBOARD_DIR="$PROJECT_ROOT/packages/dashboard"
ORCHESTRATOR_DIR="$PROJECT_ROOT/packages/orchestrator"

# Logging
log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[✓]${NC} $*"; }
log_error() { echo -e "${RED}[✗]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[!]${NC} $*"; }
log_change() { echo -e "${MAGENTA}[CHANGE]${NC} $*"; }

################################################################################
# Redeploy Functions
################################################################################

redeploy_dashboard() {
    log_change "Dashboard source changed, rebuilding container..."
    
    cd "$INFRA_DIR"
    
    # Rebuild dashboard image
    log_info "Building dashboard image..."
    docker build -f "$DASHBOARD_DIR/Dockerfile" -t agent-sdlc-dashboard:latest "$PROJECT_ROOT" || {
        log_error "Dashboard build failed"
        return 1
    }
    
    # Recreate container
    log_info "Recreating dashboard container..."
    docker stop agentic-sdlc-dev-dashboard || true
    docker rm agentic-sdlc-dev-dashboard || true
    
    docker run -d \
        --name agentic-sdlc-dev-dashboard \
        --network agentic-network \
        -p 3050:3050 \
        -e NODE_ENV=development \
        -e LOG_LEVEL=debug \
        -e VITE_PROXY_TARGET=http://host.docker.internal:3051 \
        agent-sdlc-dashboard:latest || {
        log_error "Failed to start dashboard container"
        return 1
    }
    
    log_success "Dashboard redeployed successfully"
}

redeploy_orchestrator() {
    log_change "Orchestrator source changed, restarting PM2..."
    
    cd "$PROJECT_ROOT"
    
    # Rebuild orchestrator
    log_info "Building orchestrator..."
    pnpm --filter @agentic-sdlc/orchestrator build || {
        log_error "Orchestrator build failed"
        return 1
    }
    
    # Restart via PM2
    pm2 restart ecosystem.dev.config.js --name orchestrator || {
        log_error "Failed to restart orchestrator"
        return 1
    }
    
    log_success "Orchestrator redeployed successfully"
}

redeploy_agents() {
    log_change "Agent source changed, restarting agents..."
    
    cd "$PROJECT_ROOT"
    
    # Build all agents
    log_info "Building agents..."
    pnpm --filter @agentic-sdlc/\*-agent build || {
        log_error "Agent build failed"
        return 1
    }
    
    # Restart via PM2
    pm2 restart ecosystem.dev.config.js || {
        log_error "Failed to restart agents"
        return 1
    }
    
    log_success "Agents redeployed successfully"
}

################################################################################
# File Watching
################################################################################

watch_for_changes() {
    log_info "Watching for changes..."
    log_info "Press Ctrl+C to stop"
    echo ""
    
    # Track last modified times
    declare -A last_mod
    
    # Get initial file hashes for key areas
    get_dashboard_hash() {
        find "$DASHBOARD_DIR/src" "$DASHBOARD_DIR/Dockerfile" -type f 2>/dev/null | \
            xargs ls -l | awk '{print $6, $7, $8, $9}' | md5sum | cut -d' ' -f1
    }
    
    get_orchestrator_hash() {
        find "$ORCHESTRATOR_DIR/src" -type f 2>/dev/null | \
            xargs ls -l | awk '{print $6, $7, $8, $9}' | md5sum | cut -d' ' -f1
    }
    
    get_agents_hash() {
        find "$PROJECT_ROOT/packages/agents" -path "*/src/*" -type f 2>/dev/null | \
            xargs ls -l | awk '{print $6, $7, $8, $9}' | md5sum | cut -d' ' -f1
    }
    
    last_mod[dashboard]=$(get_dashboard_hash)
    last_mod[orchestrator]=$(get_orchestrator_hash)
    last_mod[agents]=$(get_agents_hash)
    
    # Watch loop
    while true; do
        sleep 2
        
        # Check dashboard
        current_hash=$(get_dashboard_hash)
        if [ "${current_hash}" != "${last_mod[dashboard]}" ]; then
            last_mod[dashboard]="$current_hash"
            redeploy_dashboard
            echo ""
        fi
        
        # Check orchestrator
        current_hash=$(get_orchestrator_hash)
        if [ "${current_hash}" != "${last_mod[orchestrator]}" ]; then
            last_mod[orchestrator]="$current_hash"
            redeploy_orchestrator
            echo ""
        fi
        
        # Check agents
        current_hash=$(get_agents_hash)
        if [ "${current_hash}" != "${last_mod[agents]}" ]; then
            last_mod[agents]="$current_hash"
            redeploy_agents
            echo ""
        fi
    done
}

################################################################################
# Main
################################################################################

main() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║      Watch & Auto-Redeploy System                        ║"
    echo "║                                                            ║"
    echo "║  Monitoring for changes in:                              ║"
    echo "║  - Dashboard (port 3050)                                 ║"
    echo "║  - Orchestrator (port 3051)                              ║"
    echo "║  - Agents                                                 ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    
    watch_for_changes
}

# Trap Ctrl+C for graceful shutdown
trap 'echo ""; log_info "Stopping watch..."; exit 0' INT

main
