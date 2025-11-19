#!/bin/bash

################################################################################
# FULL RESET - Complete cleanup and rebuild
#
# Clears EVERYTHING and rebuilds from scratch:
# - Docker containers and images
# - React build artifacts
# - Node modules cache
# - PM2 processes
# - Database
# - Terraform state
# - Browser caches (local instructions)
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
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INFRA_DIR="$PROJECT_ROOT/infrastructure/local"

# Logging
log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[✓]${NC} $*"; }
log_error() { echo -e "${RED}[✗]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[!]${NC} $*"; }
log_phase() { echo -e "${MAGENTA}[PHASE]${NC} $*"; }

################################################################################
# Phase 1: Stop All Services
################################################################################

phase_stop_services() {
  log_phase "Phase 1: Stopping all services"

  log_info "Stopping PM2 services..."
  cd "$PROJECT_ROOT"
  pm2 delete all 2>/dev/null || true
  pm2 kill 2>/dev/null || true
  log_success "PM2 stopped"

  echo ""
}

################################################################################
# Phase 2: Destroy Docker Infrastructure
################################################################################

phase_destroy_docker() {
  log_phase "Phase 2: Destroying Docker containers and images"

  log_info "Destroying Terraform infrastructure..."
  cd "$INFRA_DIR"
  terraform destroy -auto-approve 2>/dev/null || true
  log_success "Docker infrastructure destroyed"

  log_info "Removing all dashboard images..."
  docker rmi agentic-sdlc-dashboard:latest 2>/dev/null || true
  docker rmi agentic-sdlc-dashboard 2>/dev/null || true
  docker image prune -f --filter "label!=keep" 2>/dev/null || true
  log_success "Images removed"

  log_info "Removing dangling containers and volumes..."
  docker container prune -f 2>/dev/null || true
  docker volume prune -f 2>/dev/null || true
  log_success "Cleanup complete"

  echo ""
}

################################################################################
# Phase 3: Clean React Artifacts
################################################################################

phase_clean_react() {
  log_phase "Phase 3: Cleaning React build artifacts"

  log_info "Clearing dashboard dist..."
  rm -rf "$PROJECT_ROOT/packages/dashboard/dist"
  log_success "dist/ removed"

  log_info "Clearing build caches..."
  rm -rf "$PROJECT_ROOT/packages/dashboard/.vite"
  rm -rf "$PROJECT_ROOT/packages/dashboard/node_modules/.vite"
  log_success "Cache cleared"

  echo ""
}

################################################################################
# Phase 4: Clean Node Modules (Optional - slow)
################################################################################

phase_clean_node_modules() {
  log_phase "Phase 4: Cleaning node_modules (this will reinstall - slow!)"

  if [ "${CLEAN_NODE_MODULES:-false}" != "true" ]; then
    log_warn "Skipping node_modules cleanup (set CLEAN_NODE_MODULES=true to force)"
    log_info "If you want FULL clean: CLEAN_NODE_MODULES=true ./full-reset.sh"
    echo ""
    return
  fi

  log_info "Removing node_modules (this is slow)..."
  find "$PROJECT_ROOT" -name "node_modules" -type d -prune -exec rm -rf {} + 2>/dev/null || true
  log_success "node_modules removed"

  log_info "Reinstalling dependencies (pnpm install)..."
  cd "$PROJECT_ROOT"
  pnpm install 2>&1 | tail -5
  log_success "Dependencies reinstalled"

  echo ""
}

################################################################################
# Phase 5: Clean Terraform State
################################################################################

phase_clean_terraform() {
  log_phase "Phase 5: Cleaning Terraform state"

  cd "$INFRA_DIR"

  log_info "Removing Terraform state..."
  rm -f terraform.tfstate*
  rm -rf .terraform 2>/dev/null || true
  log_success "State removed"

  log_info "Reinitializing Terraform..."
  terraform init > /dev/null
  log_success "Terraform reinitialized"

  echo ""
}

################################################################################
# Phase 6: Rebuild Everything
################################################################################

phase_rebuild() {
  log_phase "Phase 6: Rebuilding everything from scratch"

  log_info "Building dashboard image..."
  cd "$PROJECT_ROOT"
  docker build \
    -f packages/dashboard/Dockerfile.prod \
    -t agentic-sdlc-dashboard:latest \
    . 2>&1 | tail -10
  log_success "Dashboard image built"

  log_info "Applying Terraform (creating containers)..."
  cd "$INFRA_DIR"
  terraform apply -auto-approve > /dev/null
  log_success "Infrastructure created"

  echo ""
}

################################################################################
# Phase 6.5: Run Database Migrations
################################################################################

phase_run_migrations() {
  log_phase "Phase 6.5: Running database migrations"

  log_info "Waiting for PostgreSQL to be ready..."
  sleep 3

  log_info "Running Prisma migrations..."
  cd "$PROJECT_ROOT/packages/orchestrator"
  if npx prisma migrate deploy > /dev/null 2>&1; then
    log_success "Database migrations applied"
  else
    log_error "Failed to run migrations"
    return 1
  fi

  echo ""
}

################################################################################
# Phase 6.75: Start Orchestrator Service
################################################################################

phase_start_orchestrator() {
  log_phase "Phase 6.75: Starting Orchestrator service"

  log_info "Starting Orchestrator (backend API)..."
  cd "$PROJECT_ROOT"
  node packages/orchestrator/dist/server.js > /tmp/orchestrator.log 2>&1 &
  ORCHESTRATOR_PID=$!

  log_info "Waiting for Orchestrator to be ready..."
  sleep 3

  # Check if Orchestrator is responding
  if curl -s http://localhost:3051/api/v1/health > /dev/null 2>&1; then
    log_success "Orchestrator started and healthy"
  else
    log_error "Orchestrator failed to start"
    log_info "Check logs: tail -50 /tmp/orchestrator.log"
    return 1
  fi

  echo ""
}

################################################################################
# Phase 7: Start PM2 Services (Agents)
################################################################################

phase_start_agents() {
  log_phase "Phase 7: Starting PM2 agent services"

  log_info "Starting PM2 services (Scaffold, Validation, E2E, Integration, Deployment agents)..."
  cd "$PROJECT_ROOT"
  pnpm pm2:start pm2/ecosystem.dev.config.js 2>&1 | grep -E "\[PM2\]|\[✓\]" | tail -10
  log_success "PM2 services started"

  sleep 2
  echo ""
}

################################################################################
# Phase 8: Validation
################################################################################

phase_validate() {
  log_phase "Phase 8: Validating fresh state"

  log_info "Running health checks..."
  if "$INFRA_DIR/post-deploy-validation.sh"; then
    log_success "All systems healthy"
  else
    log_error "Some systems failed health check"
    echo ""
    echo "Try manually:"
    echo "  ./dev logs"
    echo "  docker ps"
    return 1
  fi

  echo ""
}

################################################################################
# Phase 9: Browser Cache Instructions
################################################################################

phase_browser_instructions() {
  log_phase "Phase 9: Browser Cache Instructions"

  echo ""
  echo "To ensure React components load fresh:"
  echo ""
  echo "🌐 CLEAR BROWSER CACHE:"
  echo "   Chrome/Edge:  Cmd+Shift+Delete (Mac) or Ctrl+Shift+Delete (Windows)"
  echo "   Firefox:      Cmd+Shift+Delete (Mac) or Ctrl+Shift+Delete (Windows)"
  echo "   Safari:       Develop → Empty Caches"
  echo ""
  echo "🔄 HARD REFRESH BROWSER:"
  echo "   Mac:     Cmd+Shift+R (or Cmd+Option+R)"
  echo "   Windows: Ctrl+Shift+R (or Ctrl+F5)"
  echo ""
  echo "✅ After that, your React components will load fresh"
  echo ""
}

################################################################################
# Summary
################################################################################

phase_summary() {
  echo ""
  echo "╔════════════════════════════════════════════════════════════╗"
  echo "║             FULL RESET COMPLETE ✅                        ║"
  echo "╚════════════════════════════════════════════════════════════╝"
  echo ""
  echo "Everything has been reset and rebuilt from scratch:"
  echo ""
  echo "Cleaned:"
  echo "  ✓ Docker containers and images"
  echo "  ✓ React build artifacts"
  echo "  ✓ Terraform state"
  echo "  ✓ Vite cache"
  echo ""
  echo "Rebuilt:"
  echo "  ✓ Dashboard Docker image"
  echo "  ✓ Terraform infrastructure (Docker containers)"
  echo "  ✓ Database migrations (7 Prisma migrations)"
  echo "  ✓ Orchestrator API (backend service)"
  echo "  ✓ PM2 agent services (5 agents)"
  echo ""
  echo "Running Services:"
  echo "  ✅ Dashboard (React UI)     → http://localhost:3050"
  echo "  ✅ Orchestrator API         → http://localhost:3051"
  echo "  ✅ PostgreSQL Database      → localhost:5433"
  echo "  ✅ Redis Cache              → localhost:6380"
  echo "  ✅ Agents (PM2)             → Running"
  echo ""
  echo "Next:"
  echo "  1. Clear browser cache (see instructions above)"
  echo "  2. Hard refresh browser (Cmd+Shift+R)"
  echo "  3. Make React component changes"
  echo "  4. Run: ./dev watch (for auto-rebuild on changes)"
  echo ""
}

################################################################################
# Main
################################################################################

main() {
  echo ""
  echo "╔════════════════════════════════════════════════════════════╗"
  echo "║         FULL RESET - Complete Rebuild                    ║"
  echo "║                                                            ║"
  echo "║  This will:                                               ║"
  echo "║  - Delete all Docker containers/images                   ║"
  echo "║  - Clear React build artifacts                           ║"
  echo "║  - Reset Terraform state                                 ║"
  echo "║  - Rebuild everything from scratch                       ║"
  echo "║                                                            ║"
  echo "║  Time: ~60 seconds (or ~5 minutes with node_modules)     ║"
  echo "╚════════════════════════════════════════════════════════════╝"
  echo ""

  if [ "${CLEAN_NODE_MODULES:-false}" = "true" ]; then
    log_warn "⚠️  CLEAN_NODE_MODULES=true - Will reinstall all dependencies (slow!)"
    echo ""
  fi

  phase_stop_services
  phase_destroy_docker
  phase_clean_react
  phase_clean_node_modules
  phase_clean_terraform
  phase_rebuild
  phase_run_migrations
  phase_start_orchestrator
  phase_start_agents
  phase_validate
  phase_browser_instructions
  phase_summary

  log_success "FULL RESET COMPLETE!"
}

main
