#!/bin/bash

# Agentic SDLC System Status Check
# Version: 1.0
# Description: Checks the status of all Agentic SDLC components

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Status icons
CHECK="✅"
CROSS="❌"
WARN="⚠️"

echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}           Agentic SDLC System Status${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}\n"

# Function to check if a service is running
check_service() {
    local service_name=$1
    local check_command=$2
    local port=$3

    echo -n -e "${YELLOW}$service_name:${NC} "

    if eval "$check_command" >/dev/null 2>&1; then
        if [ -n "$port" ]; then
            if nc -z localhost $port 2>/dev/null; then
                echo -e "${GREEN}$CHECK Running (Port $port)${NC}"
                return 0
            else
                echo -e "${YELLOW}$WARN Container running but port $port not accessible${NC}"
                return 1
            fi
        else
            echo -e "${GREEN}$CHECK Running${NC}"
            return 0
        fi
    else
        echo -e "${RED}$CROSS Not Running${NC}"
        return 1
    fi
}

# Function to check HTTP endpoint
check_http() {
    local name=$1
    local url=$2

    echo -n -e "${YELLOW}$name:${NC} "

    if curl -s -f -o /dev/null "$url" 2>/dev/null; then
        echo -e "${GREEN}$CHECK Accessible${NC}"
        return 0
    else
        echo -e "${RED}$CROSS Not Accessible${NC}"
        return 1
    fi
}

# Infrastructure Services
echo -e "${PURPLE}Infrastructure Services:${NC}"
echo "────────────────────────────"

check_service "PostgreSQL" "docker ps | grep -q agentic-sdlc-postgres" "5432"
check_service "Redis" "docker ps | grep -q agentic-sdlc-redis" "6379"
check_service "Docker" "docker info" ""

echo ""

# Application Services
echo -e "${PURPLE}Application Services:${NC}"
echo "────────────────────────────"

# Check if orchestrator is running
echo -n -e "${YELLOW}Orchestrator:${NC} "
if pgrep -f "tsx watch src/index.ts" >/dev/null || pgrep -f "node dist/index.js" >/dev/null; then
    echo -e "${GREEN}$CHECK Running${NC}"
    ORCHESTRATOR_RUNNING=true
else
    echo -e "${RED}$CROSS Not Running${NC}"
    ORCHESTRATOR_RUNNING=false
fi

echo ""

# API Endpoints (if orchestrator is running)
if [ "$ORCHESTRATOR_RUNNING" = true ]; then
    echo -e "${PURPLE}API Endpoints:${NC}"
    echo "────────────────────────────"

    check_http "Health Check" "http://localhost:3000/api/v1/health"
    check_http "API Documentation" "http://localhost:3000/documentation/"

    # Try to get workflow count
    echo -n -e "${YELLOW}Workflows API:${NC} "
    RESPONSE=$(curl -s "http://localhost:3000/api/v1/workflows" 2>/dev/null)
    if [ $? -eq 0 ]; then
        WORKFLOW_COUNT=$(echo "$RESPONSE" | grep -o "workflow_id" | wc -l)
        echo -e "${GREEN}$CHECK Accessible (${WORKFLOW_COUNT} workflows)${NC}"
    else
        echo -e "${RED}$CROSS Not Accessible${NC}"
    fi
fi

echo ""

# System Resources
echo -e "${PURPLE}System Resources:${NC}"
echo "────────────────────────────"

# Check disk space
DISK_USAGE=$(df -h . | awk 'NR==2 {print $5}' | sed 's/%//')
echo -n -e "${YELLOW}Disk Usage:${NC} "
if [ "$DISK_USAGE" -lt 80 ]; then
    echo -e "${GREEN}$CHECK ${DISK_USAGE}%${NC}"
else
    echo -e "${YELLOW}$WARN ${DISK_USAGE}%${NC}"
fi

# Check memory for Docker containers
if docker ps | grep -q agentic-sdlc; then
    echo -e "${YELLOW}Container Memory:${NC}"
    docker stats --no-stream --format "table {{.Container}}\t{{.MemUsage}}\t{{.CPUPerc}}" | grep agentic-sdlc | while read line; do
        echo "  $line"
    done
fi

echo ""

# Configuration
echo -e "${PURPLE}Configuration:${NC}"
echo "────────────────────────────"

echo -n -e "${YELLOW}.env file:${NC} "
if [ -f .env ]; then
    echo -e "${GREEN}$CHECK Present${NC}"

    # Check for API keys
    if grep -q "ANTHROPIC_API_KEY=your_key_here" .env || grep -q "OPENAI_API_KEY=your_key_here" .env; then
        echo -e "  ${YELLOW}$WARN API keys not configured${NC}"
    fi
else
    echo -e "${RED}$CROSS Missing${NC}"
fi

echo -n -e "${YELLOW}Node modules:${NC} "
if [ -d "node_modules" ]; then
    PACKAGE_COUNT=$(find node_modules -maxdepth 1 -type d | wc -l)
    echo -e "${GREEN}$CHECK Installed ($PACKAGE_COUNT packages)${NC}"
else
    echo -e "${RED}$CROSS Not installed${NC}"
fi

echo ""

# Summary
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Summary:${NC}"

ISSUES=0

# Check critical services
if ! docker ps | grep -q agentic-sdlc-postgres; then
    echo -e "  ${RED}• PostgreSQL is not running${NC}"
    ISSUES=$((ISSUES + 1))
fi

if ! docker ps | grep -q agentic-sdlc-redis; then
    echo -e "  ${RED}• Redis is not running${NC}"
    ISSUES=$((ISSUES + 1))
fi

if [ "$ORCHESTRATOR_RUNNING" = false ]; then
    echo -e "  ${YELLOW}• Orchestrator is not running${NC}"
    echo -e "    Run: ${CYAN}./start.sh${NC} to start the system"
    ISSUES=$((ISSUES + 1))
fi

if [ $ISSUES -eq 0 ]; then
    echo -e "  ${GREEN}✅ All systems operational!${NC}"
    echo ""
    echo -e "${BLUE}Available endpoints:${NC}"
    echo -e "  • API: ${CYAN}http://localhost:3000${NC}"
    echo -e "  • Docs: ${CYAN}http://localhost:3000/documentation${NC}"
    echo -e "  • Health: ${CYAN}http://localhost:3000/api/v1/health${NC}"
else
    echo ""
    echo -e "${YELLOW}To start the system, run: ${CYAN}./start.sh${NC}"
fi

echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"