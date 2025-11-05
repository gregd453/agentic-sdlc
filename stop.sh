#!/bin/bash

# Agentic SDLC System Shutdown Script
# Version: 1.0
# Description: Gracefully stops the Agentic SDLC system

set -e

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

# Kill any running Node.js processes for the orchestrator
print_status "Stopping orchestrator..."
pkill -f "tsx watch src/index.ts" 2>/dev/null || true
pkill -f "node dist/index.js" 2>/dev/null || true
print_success "Orchestrator stopped"

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