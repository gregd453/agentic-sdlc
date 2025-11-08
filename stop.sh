#!/bin/bash

# Agentic SDLC System Shutdown Script
# Version: 1.1
# Description: Gracefully stops the Agentic SDLC system

set -euo pipefail

# PID file for orchestrator process
PID_FILE=".orchestrator.pid"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] ✅${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] ⚠️${NC} $1"
}

echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}           Stopping Agentic SDLC System${NC}"
echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}\n"

# Stop orchestrator using PID file
print_status "Stopping orchestrator..."

if [ -f "$PID_FILE" ]; then
    ORCHESTRATOR_PID=$(cat "$PID_FILE")

    # Check if process is running
    if ps -p "$ORCHESTRATOR_PID" > /dev/null 2>&1; then
        print_status "Sending SIGTERM to orchestrator (PID: $ORCHESTRATOR_PID)..."
        kill "$ORCHESTRATOR_PID" 2>/dev/null || true

        # Wait for graceful shutdown (up to 30 seconds)
        TIMEOUT=30
        while [ $TIMEOUT -gt 0 ] && ps -p "$ORCHESTRATOR_PID" > /dev/null 2>&1; do
            echo -n "."
            sleep 1
            TIMEOUT=$((TIMEOUT - 1))
        done
        echo ""

        # Force kill if still running
        if ps -p "$ORCHESTRATOR_PID" > /dev/null 2>&1; then
            print_warning "Graceful shutdown timed out, force killing..."
            kill -9 "$ORCHESTRATOR_PID" 2>/dev/null || true
        fi

        print_success "Orchestrator stopped"
    else
        print_warning "Process $ORCHESTRATOR_PID not running"
    fi

    # Clean up PID file
    rm -f "$PID_FILE"
else
    print_warning "No PID file found, attempting fallback method..."
    # Fallback to pkill if PID file doesn't exist
    pkill -f "tsx watch src/index.ts" 2>/dev/null || true
    pkill -f "node dist/index.js" 2>/dev/null || true
    print_success "Orchestrator stopped (fallback method)"
fi

# Stop Docker containers
print_status "Stopping Docker containers..."
docker-compose stop
print_success "Docker containers stopped"

echo ""
echo -n "Remove Docker containers and volumes? (y/N): "
read -r remove_containers

if [[ $remove_containers =~ ^[Yy]$ ]]; then
    print_status "Removing containers and volumes..."
    docker-compose down -v
    print_success "Containers and volumes removed"
else
    print_status "Containers preserved (use 'docker-compose up -d' to restart)"
fi

echo ""
print_success "System stopped successfully!"