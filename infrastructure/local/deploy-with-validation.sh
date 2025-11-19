#!/bin/bash

################################################################################
# Complete Deployment & Validation Pipeline
#
# Orchestrates:
# 1. Pre-deployment: Clean up old containers and images
# 2. Build phase: Build production/dev dashboard image
# 3. Infrastructure: Apply Terraform configuration
# 4. Services: Start PM2 services
# 5. Validation: Comprehensive health checks
# 6. Report: Generate deployment summary
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
DASHBOARD_DIR="$PROJECT_ROOT/packages/dashboard"
ENVIRONMENT="${ENVIRONMENT:-dev}"
BUILD_ENV="${BUILD_ENV:-dev}"  # 'dev' or 'prod'
VALIDATE="${VALIDATE:-true}"

# Logging
log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[✓]${NC} $*"; }
log_error() { echo -e "${RED}[✗]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[!]${NC} $*"; }
log_section() { echo -e "${MAGENTA}[PHASE]${NC} $*"; }

# Timing
DEPLOY_START=$(date +%s)

################################################################################
# Phase 0: Pre-Deployment Cleanup
################################################################################

phase_cleanup() {
  log_section "Pre-Deployment Cleanup"

  log_info "Removing old dashboard containers..."
  docker stop agentic-sdlc-dev-dashboard 2>/dev/null || true
  docker rm agentic-sdlc-dev-dashboard 2>/dev/null || true

  log_info "Removing old dashboard images..."
  docker rmi agentic-sdlc-dashboard:latest 2>/dev/null || true

  log_success "Cleanup complete"
  echo ""
}

################################################################################
# Phase 1: Build Dashboard Image
################################################################################

phase_build_image() {
  log_section "Building Dashboard Image"

  if [ "$BUILD_ENV" == "prod" ]; then
    log_info "Building production image (Dockerfile.prod)..."
    DOCKERFILE="$DASHBOARD_DIR/Dockerfile.prod"
    if [ ! -f "$DOCKERFILE" ]; then
      log_error "Dockerfile.prod not found at $DOCKERFILE"
      return 1
    fi
  else
    log_info "Building development image (Dockerfile)..."
    DOCKERFILE="$DASHBOARD_DIR/Dockerfile"
  fi

  if docker build \
    -f "$DOCKERFILE" \
    -t agentic-sdlc-dashboard:latest \
    "$PROJECT_ROOT" 2>&1 | tail -20; then
    log_success "Dashboard image built successfully"
  else
    log_error "Failed to build dashboard image"
    return 1
  fi

  echo ""
}

################################################################################
# Phase 2: Apply Infrastructure (Terraform)
################################################################################

phase_apply_terraform() {
  log_section "Applying Terraform Configuration"

  cd "$INFRA_DIR"

  # Initialize Terraform if needed
  if [ ! -d .terraform ]; then
    log_info "Initializing Terraform..."
    terraform init > /dev/null
  fi

  # Validate configuration
  log_info "Validating Terraform configuration..."
  if ! terraform validate > /dev/null; then
    log_error "Terraform validation failed"
    return 1
  fi

  # Apply configuration
  log_info "Applying infrastructure..."
  if terraform apply \
    -auto-approve \
    -var="environment=$ENVIRONMENT" 2>&1 | tail -20; then
    log_success "Terraform applied successfully"
  else
    log_error "Terraform apply failed"
    return 1
  fi

  echo ""
}

################################################################################
# Phase 3: Start PM2 Services
################################################################################

phase_start_pm2() {
  log_section "Starting PM2 Services (Orchestrator + Agents)"

  cd "$PROJECT_ROOT"

  log_info "Starting PM2 ecosystem..."
  if pnpm pm2:start pm2/ecosystem.dev.config.js 2>&1 | tail -10; then
    log_success "PM2 services started"
  else
    log_error "Failed to start PM2 services"
    return 1
  fi

  # Wait for services to be ready
  log_info "Waiting for services to initialize..."
  sleep 3

  echo ""
}

################################################################################
# Phase 4: Service Validation
################################################################################

phase_validate() {
  log_section "Service Health Validation"

  if [ "$VALIDATE" != "true" ]; then
    log_warn "Skipping validation (VALIDATE=$VALIDATE)"
    echo ""
    return 0
  fi

  log_info "Running comprehensive health checks..."

  if bash "$INFRA_DIR/post-deploy-validation.sh"; then
    log_success "All validation checks passed"
  else
    log_error "Some validation checks failed"
    return 1
  fi

  echo ""
}

################################################################################
# Phase 5: Deployment Summary
################################################################################

phase_summary() {
  log_section "Deployment Summary"

  DEPLOY_END=$(date +%s)
  DEPLOY_TIME=$((DEPLOY_END - DEPLOY_START))

  echo ""
  echo "╔════════════════════════════════════════════════════════════╗"
  echo "║           DEPLOYMENT COMPLETED SUCCESSFULLY                ║"
  echo "╚════════════════════════════════════════════════════════════╝"
  echo ""
  echo "Timeline:"
  echo "  Start Time:          $(date -d @$DEPLOY_START '+%Y-%m-%d %H:%M:%S')"
  echo "  Duration:            ${DEPLOY_TIME}s"
  echo ""
  echo "Configuration:"
  echo "  Environment:         $ENVIRONMENT"
  echo "  Build Type:          $BUILD_ENV"
  echo "  Docker Image:        agentic-sdlc-dashboard:latest"
  echo ""
  echo "Services Status:"
  echo "  Dashboard:           http://localhost:3050"
  echo "  Orchestrator API:    http://localhost:3051/api/v1/health"
  echo "  PostgreSQL:          psql -h localhost -p 5433 -U agentic"
  echo "  Redis:               redis-cli -p 6380"
  echo ""
  echo "Next Steps:"
  echo "  View logs:           $INFRA_DIR/stop-infra.sh && pm2 logs"
  echo "  Watch changes:       $INFRA_DIR/watch-and-redeploy.sh"
  echo "  Run validation:      $INFRA_DIR/post-deploy-validation.sh"
  echo ""
}

################################################################################
# Error Handler
################################################################################

on_error() {
  log_error "Deployment failed at line $1"
  echo ""
  echo "Troubleshooting:"
  echo "  1. Check Docker is running: docker ps"
  echo "  2. Check available disk space: df -h"
  echo "  3. Check port availability: lsof -i :3050 :3051"
  echo "  4. View logs: pm2 logs"
  echo ""
  exit 1
}

trap 'on_error $LINENO' ERR

################################################################################
# Main Execution
################################################################################

main() {
  echo ""
  echo "╔════════════════════════════════════════════════════════════╗"
  echo "║     Agentic SDLC Deployment & Validation Pipeline         ║"
  echo "║                                                            ║"
  echo "║  Environment: $ENVIRONMENT"
  echo "║  Build Type:  $BUILD_ENV"
  echo "║  Validation:  $VALIDATE"
  echo "╚════════════════════════════════════════════════════════════╝"
  echo ""

  phase_cleanup
  phase_build_image
  phase_apply_terraform
  phase_start_pm2
  phase_validate
  phase_summary

  log_success "All phases completed successfully!"
}

main
