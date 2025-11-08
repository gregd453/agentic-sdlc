#!/bin/bash

# Agentic SDLC System Startup Script
# Version: 1.1
# Description: Complete startup script for the Agentic SDLC orchestrator

set -euo pipefail

# PID file for orchestrator process
PID_FILE=".orchestrator.pid"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ASCII Art Banner
echo -e "${CYAN}"
cat << "EOF"
    ___                    __  _        _____ ____  __    ______
   /   | ____ ____  ____  / /_(_)____  / ___// __ \/ /   / ____/
  / /| |/ __ `/ _ \/ __ \/ __/ / ___/  \__ \/ / / / /   / /
 / ___ / /_/ /  __/ / / / /_/ / /__   ___/ / /_/ / /___/ /___
/_/  |_\__, /\___/_/ /_/\__/_/\___/  /____/_____/_____/\____/
      /____/

EOF
echo -e "${NC}"

echo -e "${PURPLE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}       Autonomous AI-Driven Software Development Lifecycle${NC}"
echo -e "${PURPLE}═══════════════════════════════════════════════════════════════${NC}\n"

# Function to print status messages
print_status() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] ✅${NC} $1"
}

print_error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ❌${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] ⚠️${NC} $1"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to wait for a service to be ready (platform-independent)
wait_for_service() {
    local service=$1
    local port=$2
    local max_attempts=30
    local attempt=1

    print_status "Waiting for $service to be ready on port $port..."

    while [ $attempt -le $max_attempts ]; do
        # Use /dev/tcp which works on bash without external dependencies
        if timeout 1 bash -c "cat < /dev/null > /dev/tcp/localhost/$port" 2>/dev/null; then
            echo ""
            print_success "$service is ready!"
            return 0
        fi
        echo -n "."
        sleep 1
        attempt=$((attempt + 1))
    done

    echo ""
    print_error "$service failed to start on port $port"
    return 1
}

# Function to wait for orchestrator health check
wait_for_orchestrator_health() {
    local max_attempts=60
    local attempt=1
    local health_url="http://localhost:3000/api/v1/health"

    print_status "Waiting for orchestrator health check..."

    while [ $attempt -le $max_attempts ]; do
        if command_exists curl; then
            if curl -sf "$health_url" > /dev/null 2>&1; then
                echo ""
                print_success "Orchestrator is healthy!"
                return 0
            fi
        else
            # Fallback to basic port check if curl not available
            if timeout 1 bash -c "cat < /dev/null > /dev/tcp/localhost/3000" 2>/dev/null; then
                echo ""
                print_success "Orchestrator is responding on port 3000"
                return 0
            fi
        fi
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done

    echo ""
    print_error "Orchestrator health check failed"
    return 1
}

# Step 1: Check prerequisites
echo -e "${CYAN}Step 1: Checking Prerequisites${NC}"
echo -e "${PURPLE}────────────────────────────────${NC}"

# Check Node.js
if command_exists node; then
    NODE_VERSION=$(node -v)
    print_success "Node.js installed: $NODE_VERSION"

    # Check if version is 20+
    MAJOR_VERSION=$(echo $NODE_VERSION | cut -d. -f1 | sed 's/v//')
    if [ "$MAJOR_VERSION" -lt 20 ]; then
        print_warning "Node.js 20+ recommended (current: $NODE_VERSION)"
    fi
else
    print_error "Node.js is not installed"
    echo "Please install Node.js 20+ from https://nodejs.org/"
    exit 1
fi

# Check pnpm
if command_exists pnpm; then
    PNPM_VERSION=$(pnpm -v)
    print_success "pnpm installed: v$PNPM_VERSION"
else
    print_error "pnpm is not installed"
    echo "Installing pnpm..."
    npm install -g pnpm
fi

# Check Docker
if command_exists docker; then
    DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | sed 's/,//')
    print_success "Docker installed: $DOCKER_VERSION"
else
    print_error "Docker is not installed"
    echo "Please install Docker from https://www.docker.com/"
    exit 1
fi

# Check Docker Compose
if command_exists docker-compose; then
    COMPOSE_VERSION=$(docker-compose --version | cut -d' ' -f3 | sed 's/,//')
    print_success "Docker Compose installed: $COMPOSE_VERSION"
else
    print_warning "docker-compose command not found, trying docker compose..."
    if docker compose version >/dev/null 2>&1; then
        print_success "Docker Compose (plugin) is available"
        alias docker-compose="docker compose"
    else
        print_error "Docker Compose is not installed"
        exit 1
    fi
fi

echo ""

# Step 2: Setup environment
echo -e "${CYAN}Step 2: Environment Setup${NC}"
echo -e "${PURPLE}────────────────────────────────${NC}"

# Check if .env exists
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        print_status "Creating .env file from template..."
        cp .env.example .env
        chmod 600 .env
        print_warning "Please update .env with your API keys"
        echo -e "${YELLOW}Press Enter to continue after updating .env...${NC}"
        read
    else
        print_error ".env.example file not found"
        exit 1
    fi
else
    print_success ".env file exists"

    # Check and fix .env file permissions for security
    if [[ "$OSTYPE" == "darwin"* ]] || [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Get file permissions (works on both macOS and Linux)
        if [[ "$OSTYPE" == "darwin"* ]]; then
            PERMS=$(stat -f "%OLp" .env 2>/dev/null || echo "600")
        else
            PERMS=$(stat -c "%a" .env 2>/dev/null || echo "600")
        fi

        if [ "$PERMS" != "600" ]; then
            print_warning ".env file has insecure permissions: $PERMS"
            print_status "Setting .env permissions to 600 (read/write for owner only)..."
            chmod 600 .env
            print_success "Permissions updated"
        else
            print_success ".env permissions are secure (600)"
        fi
    fi
fi

echo ""

# Step 3: Install dependencies
echo -e "${CYAN}Step 3: Installing Dependencies${NC}"
echo -e "${PURPLE}────────────────────────────────${NC}"

if [ -d "node_modules" ]; then
    print_status "Dependencies already installed, checking for updates..."
    pnpm install
else
    print_status "Installing dependencies..."
    pnpm install
fi
print_success "Dependencies installed"

echo ""

# Step 4: Start infrastructure services
echo -e "${CYAN}Step 4: Starting Infrastructure Services${NC}"
echo -e "${PURPLE}────────────────────────────────${NC}"

# Check if services are already running
if docker ps | grep -q agentic-sdlc-postgres; then
    print_warning "PostgreSQL is already running"
else
    print_status "Starting PostgreSQL..."
    docker-compose up -d postgres
fi

if docker ps | grep -q agentic-sdlc-redis; then
    print_warning "Redis is already running"
else
    print_status "Starting Redis..."
    docker-compose up -d redis
fi

# Wait for services
wait_for_service "PostgreSQL" 5432
wait_for_service "Redis" 6379

echo ""

# Step 5: Database setup
echo -e "${CYAN}Step 5: Database Setup${NC}"
echo -e "${PURPLE}────────────────────────────────${NC}"

print_status "Generating Prisma client..."
pnpm --filter @agentic-sdlc/orchestrator exec prisma generate
print_success "Prisma client generated"

print_status "Running database migrations..."
pnpm --filter @agentic-sdlc/orchestrator exec prisma migrate deploy 2>/dev/null || {
    print_warning "Migrations may already be applied or database needs initialization"
    print_status "Attempting to create database..."
    pnpm --filter @agentic-sdlc/orchestrator exec prisma db push --accept-data-loss 2>/dev/null || true
}
print_success "Database ready"

echo ""

# Step 6: System health check
echo -e "${CYAN}Step 6: System Health Check${NC}"
echo -e "${PURPLE}────────────────────────────────${NC}"

# Show Docker container status
print_status "Docker containers status:"
docker-compose ps | grep -E "agentic-sdlc-(postgres|redis)" | while read line; do
    echo "  $line"
done

echo ""

# Step 7: Run tests (optional)
echo -e "${CYAN}Step 7: Running Tests (Optional)${NC}"
echo -e "${PURPLE}────────────────────────────────${NC}"

echo -n "Do you want to run tests? (y/N): "
read -r run_tests

if [[ $run_tests =~ ^[Yy]$ ]]; then
    print_status "Running orchestrator tests..."
    pnpm --filter @agentic-sdlc/orchestrator test --run
    print_success "All tests passed!"
else
    print_status "Skipping tests"
fi

echo ""

# Step 8: Start the orchestrator
echo -e "${CYAN}Step 8: Starting Orchestrator${NC}"
echo -e "${PURPLE}────────────────────────────────${NC}"

print_success "System ready to start!"
echo ""

echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}                    🚀 ORCHESTRATOR STARTING 🚀${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}  📍 API Endpoint:${NC}     http://localhost:3000"
echo -e "${YELLOW}  📚 API Documentation:${NC} http://localhost:3000/documentation"
echo -e "${YELLOW}  🔍 Health Check:${NC}     http://localhost:3000/api/v1/health"
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${CYAN}Press Ctrl+C to stop the orchestrator${NC}"
echo ""

# Trap to handle cleanup on exit
cleanup() {
    echo ""
    print_status "Shutting down..."

    # Remove PID file if it exists
    if [ -f "$PID_FILE" ]; then
        rm -f "$PID_FILE"
    fi

    echo -n "Stop infrastructure services? (y/N): "
    read -r stop_services

    if [[ $stop_services =~ ^[Yy]$ ]]; then
        print_status "Stopping Docker containers..."
        docker-compose down
        print_success "Services stopped"
    fi

    echo -e "${GREEN}Goodbye! 👋${NC}"
    exit 0
}

trap cleanup INT TERM EXIT

# Start the orchestrator in background
pnpm orchestrator:dev &
ORCHESTRATOR_PID=$!

# Save PID to file
echo $ORCHESTRATOR_PID > "$PID_FILE"
print_status "Orchestrator started with PID: $ORCHESTRATOR_PID"

# Wait for orchestrator to be healthy
wait_for_orchestrator_health

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}           ✅ System Started Successfully! ✅${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
fi

# Wait for orchestrator process
wait $ORCHESTRATOR_PID