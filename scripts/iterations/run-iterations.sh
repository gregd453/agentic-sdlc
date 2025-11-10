#!/bin/bash

# Master script for running hello world generation iterations
# This follows the iterative implementation plan for Zyp compliance

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if services are running
check_services() {
    echo -e "${BLUE}Checking required services...${NC}"

    # Check PostgreSQL
    if docker ps | grep -q postgres; then
        echo -e "${GREEN}✓ PostgreSQL is running${NC}"
    else
        echo -e "${RED}✗ PostgreSQL is not running${NC}"
        echo "  Run: docker-compose up -d postgres"
        exit 1
    fi

    # Check Redis
    if docker ps | grep -q redis; then
        echo -e "${GREEN}✓ Redis is running${NC}"
    else
        echo -e "${RED}✗ Redis is not running${NC}"
        echo "  Run: docker-compose up -d redis"
        exit 1
    fi

    # Check Orchestrator
    if curl -s http://localhost:3000/api/v1/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Orchestrator is running${NC}"
    else
        echo -e "${YELLOW}⚠ Orchestrator may not be running${NC}"
        echo "  Run: pnpm --filter @agentic-sdlc/orchestrator dev"
    fi

    echo ""
}

# Display menu
show_menu() {
    echo "================================================"
    echo "   Zyp-Compliant Hello World Generation"
    echo "   Iterative Implementation Test Suite"
    echo "================================================"
    echo ""
    echo "Select an iteration to test:"
    echo ""
    echo "  1) Frontend Compliance    - React 19.2.0 with exact versions"
    echo "  2) Backend Templates      - Fastify 5.6.1 API server"
    echo "  3) Database Integration   - Prisma 5.14.0 with PostgreSQL"
    echo "  4) Full-Stack Integration - Complete hello world app"
    echo "  5) Production Ready       - Full features with auth pattern"
    echo ""
    echo "  a) Run ALL iterations sequentially"
    echo "  c) Check service status"
    echo "  h) Show help"
    echo "  q) Quit"
    echo ""
}

# Show help
show_help() {
    echo ""
    echo -e "${BLUE}Prerequisites:${NC}"
    echo "1. PostgreSQL and Redis running:"
    echo "   docker-compose up -d postgres redis"
    echo ""
    echo "2. Orchestrator running:"
    echo "   pnpm --filter @agentic-sdlc/orchestrator dev"
    echo ""
    echo "3. Scaffold Agent running:"
    echo "   cd packages/agents/scaffold-agent"
    echo "   node dist/run-agent.js"
    echo ""
    echo -e "${BLUE}Iteration Details:${NC}"
    echo ""
    echo -e "${GREEN}Iteration 1: Frontend Compliance${NC}"
    echo "  - Updates React templates to 19.2.0"
    echo "  - Enforces exact version pinning"
    echo "  - Removes all ^ and ~ prefixes"
    echo ""
    echo -e "${GREEN}Iteration 2: Backend Templates${NC}"
    echo "  - Adds Fastify 5.6.1 server templates"
    echo "  - Implements envelope response pattern"
    echo "  - Includes health check endpoint"
    echo ""
    echo -e "${GREEN}Iteration 3: Database Integration${NC}"
    echo "  - Adds Prisma 5.14.0 ORM"
    echo "  - PostgreSQL with migrations"
    echo "  - Zod 3.23.0 validation"
    echo "  - NO raw SQL (Prisma only)"
    echo ""
    echo -e "${GREEN}Iteration 4: Full-Stack Integration${NC}"
    echo "  - Complete React + Fastify app"
    echo "  - Frontend calls backend API"
    echo "  - Database persistence"
    echo "  - Full Zyp compliance"
    echo ""
    echo -e "${GREEN}Iteration 5: Production Ready${NC}"
    echo "  - Auth pattern (no JWT signing)"
    echo "  - Error handling & logging"
    echo "  - Test setup included"
    echo "  - Production configurations"
    echo ""
    echo -e "${BLUE}Output Location:${NC}"
    echo "  Generated apps: /tmp/agentic-sdlc-output/"
    echo ""
}

# Run iteration
run_iteration() {
    local iteration=$1
    local script=""

    case $iteration in
        1)
            script="test-iteration-1.sh"
            echo -e "${GREEN}Running Iteration 1: Frontend Compliance${NC}"
            ;;
        2)
            script="test-iteration-2.sh"
            echo -e "${GREEN}Running Iteration 2: Backend Templates${NC}"
            ;;
        3)
            script="test-iteration-3.sh"
            echo -e "${GREEN}Running Iteration 3: Database Integration${NC}"
            ;;
        4)
            script="test-iteration-4.sh"
            echo -e "${GREEN}Running Iteration 4: Full-Stack Integration${NC}"
            ;;
        5)
            script="test-final.sh"
            echo -e "${GREEN}Running Final: Production Ready${NC}"
            ;;
        *)
            echo -e "${RED}Invalid iteration number${NC}"
            return 1
            ;;
    esac

    echo ""
    bash "$(dirname "$0")/$script"
    echo ""
    echo -e "${GREEN}Iteration $iteration completed!${NC}"
    echo ""
}

# Run all iterations
run_all() {
    echo -e "${YELLOW}Running all iterations sequentially...${NC}"
    echo ""

    for i in 1 2 3 4 5; do
        run_iteration $i

        if [ $i -lt 5 ]; then
            echo "Waiting 5 seconds before next iteration..."
            sleep 5
        fi
    done

    echo -e "${GREEN}All iterations completed!${NC}"
}

# Main loop
main() {
    # Initial service check
    check_services

    while true; do
        show_menu
        read -p "Enter your choice: " choice

        case $choice in
            1|2|3|4|5)
                run_iteration $choice
                read -p "Press Enter to continue..."
                ;;
            a|A)
                run_all
                read -p "Press Enter to continue..."
                ;;
            c|C)
                check_services
                read -p "Press Enter to continue..."
                ;;
            h|H)
                show_help
                read -p "Press Enter to continue..."
                ;;
            q|Q)
                echo "Exiting..."
                exit 0
                ;;
            *)
                echo -e "${RED}Invalid option. Please try again.${NC}"
                sleep 2
                ;;
        esac
    done
}

# Run main function
main