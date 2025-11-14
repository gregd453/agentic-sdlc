#!/bin/bash
#
# Dashboard Deployment Script
# Supports: development, staging, production
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Functions
log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }

# Usage
usage() {
  cat << EOF
Usage: $0 [ENVIRONMENT] [OPTIONS]

Deploy the Agentic SDLC Dashboard

ENVIRONMENTS:
  dev         Deploy to local development (PM2)
  docker      Deploy to local Docker
  staging     Deploy to staging (Kubernetes)
  production  Deploy to production (Kubernetes)

OPTIONS:
  -h, --help           Show this help message
  -b, --build          Force rebuild before deployment
  -t, --test           Run tests before deployment
  --skip-health        Skip health checks
  --dry-run            Print commands without executing

EXAMPLES:
  $0 dev                      # Start dashboard via PM2
  $0 docker --build           # Build and run via Docker
  $0 staging --test           # Test and deploy to staging
  $0 production --dry-run     # Show production deployment plan

EOF
  exit 1
}

# Parse arguments
ENVIRONMENT="${1:-dev}"
BUILD=false
TEST=false
SKIP_HEALTH=false
DRY_RUN=false

shift || true
while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help) usage ;;
    -b|--build) BUILD=true ;;
    -t|--test) TEST=true ;;
    --skip-health) SKIP_HEALTH=true ;;
    --dry-run) DRY_RUN=true ;;
    *) log_error "Unknown option: $1" && usage ;;
  esac
  shift
done

# Validate environment
case $ENVIRONMENT in
  dev|docker|staging|production) ;;
  *) log_error "Invalid environment: $ENVIRONMENT" && usage ;;
esac

log_info "Dashboard Deployment: ${ENVIRONMENT}"
echo ""

# ==========================================
# DEV DEPLOYMENT (PM2)
# ==========================================
if [[ $ENVIRONMENT == "dev" ]]; then
  log_info "Deploying dashboard to PM2..."

  # Build if requested
  if [[ $BUILD == true ]]; then
    log_info "Building dashboard..."
    cd "$PROJECT_ROOT"
    pnpm --filter @agentic-sdlc/dashboard build
    log_success "Build complete"
  fi

  # Run tests if requested
  if [[ $TEST == true ]]; then
    log_info "Running E2E tests..."
    cd "$PROJECT_ROOT/packages/dashboard"
    pnpm test:e2e
    log_success "Tests passed"
  fi

  # Start with PM2
  log_info "Starting dashboard via PM2..."
  cd "$PROJECT_ROOT"

  if [[ $DRY_RUN == true ]]; then
    echo "Would run: pm2 start pm2/ecosystem.dev.config.js --only dashboard"
  else
    pm2 start pm2/ecosystem.dev.config.js --only dashboard || \
      pm2 restart dashboard
    log_success "Dashboard started"

    # Health check
    if [[ $SKIP_HEALTH == false ]]; then
      log_info "Waiting for dashboard to be ready..."
      timeout 30 bash -c 'until curl -sf http://localhost:3001/health; do sleep 2; done' || {
        log_error "Health check failed"
        pm2 logs dashboard --lines 50
        exit 1
      }
      log_success "Dashboard is healthy"
    fi

    # Show status
    pm2 ls
    echo ""
    log_success "Dashboard deployed successfully!"
    echo ""
    echo "  URL:  http://localhost:3001"
    echo "  Logs: pm2 logs dashboard"
    echo ""
  fi
fi

# ==========================================
# DOCKER DEPLOYMENT
# ==========================================
if [[ $ENVIRONMENT == "docker" ]]; then
  log_info "Deploying dashboard to Docker..."

  cd "$PROJECT_ROOT"

  # Build if requested
  if [[ $BUILD == true ]]; then
    log_info "Building Docker image..."
    if [[ $DRY_RUN == true ]]; then
      echo "Would run: docker-compose build dashboard"
    else
      docker-compose build dashboard
      log_success "Build complete"
    fi
  fi

  # Run tests if requested
  if [[ $TEST == true ]]; then
    log_info "Running E2E tests..."
    cd "$PROJECT_ROOT/packages/dashboard"
    pnpm test:e2e
    log_success "Tests passed"
    cd "$PROJECT_ROOT"
  fi

  # Start container
  log_info "Starting dashboard container..."
  if [[ $DRY_RUN == true ]]; then
    echo "Would run: docker-compose up -d dashboard"
  else
    docker-compose up -d dashboard
    log_success "Container started"

    # Health check
    if [[ $SKIP_HEALTH == false ]]; then
      log_info "Waiting for dashboard to be ready..."
      timeout 30 bash -c 'until docker exec agentic-sdlc-dashboard curl -sf http://localhost:3001/health; do sleep 2; done' || {
        log_error "Health check failed"
        docker logs agentic-sdlc-dashboard --tail 50
        exit 1
      }
      log_success "Dashboard is healthy"
    fi

    # Show status
    docker ps | grep dashboard
    echo ""
    log_success "Dashboard deployed successfully!"
    echo ""
    echo "  URL:  http://localhost:3001"
    echo "  Logs: docker logs -f agentic-sdlc-dashboard"
    echo ""
  fi
fi

# ==========================================
# STAGING DEPLOYMENT (Kubernetes)
# ==========================================
if [[ $ENVIRONMENT == "staging" ]]; then
  log_info "Deploying dashboard to staging..."

  # Verify kubectl configured
  if ! command -v kubectl &> /dev/null; then
    log_error "kubectl not found. Please install kubectl."
    exit 1
  fi

  # Run tests if requested
  if [[ $TEST == true ]]; then
    log_info "Running E2E tests..."
    cd "$PROJECT_ROOT/packages/dashboard"
    pnpm test:e2e
    log_success "Tests passed"
  fi

  # Build and push image
  IMAGE_TAG="staging-$(git rev-parse --short HEAD)"
  IMAGE_NAME="gcr.io/${GCP_PROJECT_ID}/agentic-sdlc-dashboard:${IMAGE_TAG}"

  if [[ $BUILD == true ]]; then
    log_info "Building production image..."
    if [[ $DRY_RUN == true ]]; then
      echo "Would run: docker build -f packages/dashboard/Dockerfile.production -t ${IMAGE_NAME} packages/dashboard/"
    else
      docker build \
        -f packages/dashboard/Dockerfile.production \
        --build-arg VITE_API_URL="https://api-staging.agentic-sdlc.example.com" \
        --build-arg VITE_WS_URL="wss://api-staging.agentic-sdlc.example.com" \
        -t "${IMAGE_NAME}" \
        packages/dashboard/
      log_success "Build complete"

      log_info "Pushing image to registry..."
      docker push "${IMAGE_NAME}"
      log_success "Image pushed"
    fi
  fi

  # Deploy to Kubernetes
  log_info "Deploying to Kubernetes (staging)..."
  if [[ $DRY_RUN == true ]]; then
    echo "Would run: kubectl set image deployment/dashboard dashboard=${IMAGE_NAME} -n staging"
  else
    kubectl set image deployment/dashboard \
      "dashboard=${IMAGE_NAME}" \
      -n staging

    log_info "Waiting for rollout to complete..."
    kubectl rollout status deployment/dashboard -n staging --timeout=5m
    log_success "Rollout complete"

    # Health check
    if [[ $SKIP_HEALTH == false ]]; then
      log_info "Running smoke tests..."
      DASHBOARD_URL="https://dashboard-staging.agentic-sdlc.example.com"
      curl -f "${DASHBOARD_URL}/health" || {
        log_error "Health check failed"
        kubectl logs -n staging deployment/dashboard --tail=50
        exit 1
      }
      log_success "Health check passed"
    fi

    log_success "Dashboard deployed to staging!"
    echo ""
    echo "  URL: https://dashboard-staging.agentic-sdlc.example.com"
    echo ""
  fi
fi

# ==========================================
# PRODUCTION DEPLOYMENT (Kubernetes)
# ==========================================
if [[ $ENVIRONMENT == "production" ]]; then
  log_warning "PRODUCTION DEPLOYMENT"
  echo ""
  read -p "Are you sure you want to deploy to production? (yes/no): " confirm
  if [[ $confirm != "yes" ]]; then
    log_info "Deployment cancelled"
    exit 0
  fi

  log_info "Deploying dashboard to production..."

  # Verify kubectl configured
  if ! command -v kubectl &> /dev/null; then
    log_error "kubectl not found. Please install kubectl."
    exit 1
  fi

  # Run tests (required for production)
  log_info "Running E2E tests..."
  cd "$PROJECT_ROOT/packages/dashboard"
  pnpm test:e2e
  log_success "Tests passed"

  # Build and push image
  IMAGE_TAG="v$(jq -r .version package.json)-$(git rev-parse --short HEAD)"
  IMAGE_NAME="gcr.io/${GCP_PROJECT_ID}/agentic-sdlc-dashboard:${IMAGE_TAG}"

  log_info "Building production image..."
  if [[ $DRY_RUN == true ]]; then
    echo "Would run: docker build -f packages/dashboard/Dockerfile.production -t ${IMAGE_NAME} packages/dashboard/"
  else
    cd "$PROJECT_ROOT"
    docker build \
      -f packages/dashboard/Dockerfile.production \
      --build-arg VITE_API_URL="https://api.agentic-sdlc.example.com" \
      --build-arg VITE_WS_URL="wss://api.agentic-sdlc.example.com" \
      --build-arg VITE_POLLING_INTERVAL=10000 \
      -t "${IMAGE_NAME}" \
      packages/dashboard/
    log_success "Build complete"

    log_info "Pushing image to registry..."
    docker push "${IMAGE_NAME}"
    log_success "Image pushed"
  fi

  # Blue-green deployment
  log_info "Deploying to Kubernetes (production - blue-green)..."
  if [[ $DRY_RUN == true ]]; then
    echo "Would run blue-green deployment sequence"
  else
    # Deploy to blue environment
    log_info "Deploying to blue environment..."
    kubectl set image deployment/dashboard-blue \
      "dashboard=${IMAGE_NAME}" \
      -n production

    kubectl rollout status deployment/dashboard-blue -n production --timeout=10m
    log_success "Blue deployment complete"

    # Run smoke tests on blue
    log_info "Running smoke tests on blue..."
    kubectl run smoke-test --rm -i --restart=Never --image=curlimages/curl -- \
      curl -f http://dashboard-blue.production.svc.cluster.local:3001/health
    log_success "Blue health check passed"

    # Switch traffic to blue
    log_info "Switching traffic to blue..."
    kubectl patch service dashboard -n production \
      -p '{"spec":{"selector":{"version":"blue"}}}'
    log_success "Traffic switched to blue"

    # Wait for traffic switch
    sleep 10

    # Verify production
    log_info "Verifying production..."
    curl -f https://dashboard.agentic-sdlc.example.com/health
    log_success "Production verified"

    # Update green (for next deployment)
    log_info "Updating green environment..."
    kubectl set image deployment/dashboard-green \
      "dashboard=${IMAGE_NAME}" \
      -n production
    log_success "Green updated"

    log_success "Dashboard deployed to production!"
    echo ""
    echo "  URL: https://dashboard.agentic-sdlc.example.com"
    echo "  Version: ${IMAGE_TAG}"
    echo ""
    echo "  To rollback: kubectl patch service dashboard -n production -p '{\"spec\":{\"selector\":{\"version\":\"green\"}}}'"
    echo ""
  fi
fi
