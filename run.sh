#!/bin/bash

# Agentic SDLC System Runner
# Version: 1.0
# Description: Main entry point for running the Agentic SDLC system

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to show usage
show_usage() {
    cat << EOF
${CYAN}Agentic SDLC System Runner${NC}

${YELLOW}Usage:${NC}
  ./run.sh [command] [options]

${YELLOW}Commands:${NC}
  ${GREEN}start${NC}           Start the complete system (default)
  ${GREEN}stop${NC}            Stop all services
  ${GREEN}status${NC}          Check system status
  ${GREEN}test${NC}            Run tests
  ${GREEN}test-api${NC}        Test API endpoints
  ${GREEN}dev${NC}             Start in development mode
  ${GREEN}prod${NC}            Start in production mode
  ${GREEN}logs${NC}            Show orchestrator logs
  ${GREEN}db:migrate${NC}      Run database migrations
  ${GREEN}db:reset${NC}        Reset database
  ${GREEN}docker:up${NC}       Start only Docker services
  ${GREEN}docker:down${NC}     Stop Docker services
  ${GREEN}build${NC}           Build all packages
  ${GREEN}clean${NC}           Clean build artifacts

${YELLOW}Options:${NC}
  ${GREEN}--help, -h${NC}      Show this help message
  ${GREEN}--verbose, -v${NC}   Enable verbose output
  ${GREEN}--no-docker${NC}     Skip Docker services
  ${GREEN}--no-tests${NC}      Skip running tests

${YELLOW}Examples:${NC}
  ./run.sh                    # Start system with default settings
  ./run.sh start --no-tests   # Start without running tests
  ./run.sh dev                # Start in development mode
  ./run.sh test               # Run all tests
  ./run.sh status             # Check system status

${YELLOW}Quick Commands:${NC}
  ${CYAN}API Endpoint:${NC}     http://localhost:3000
  ${CYAN}Documentation:${NC}    http://localhost:3000/documentation
  ${CYAN}Health Check:${NC}     http://localhost:3000/api/v1/health

EOF
}

# Default values
COMMAND=${1:-start}
VERBOSE=false
USE_DOCKER=true
RUN_TESTS=false

# Parse arguments
shift
while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            show_usage
            exit 0
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --no-docker)
            USE_DOCKER=false
            shift
            ;;
        --no-tests)
            RUN_TESTS=false
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            show_usage
            exit 1
            ;;
    esac
done

# Execute command
case $COMMAND in
    start)
        echo -e "${CYAN}Starting Agentic SDLC System...${NC}"
        if [ "$USE_DOCKER" = true ]; then
            ./start.sh
        else
            echo -e "${YELLOW}Starting without Docker services...${NC}"
            pnpm orchestrator:dev
        fi
        ;;

    stop)
        echo -e "${YELLOW}Stopping Agentic SDLC System...${NC}"
        ./stop.sh
        ;;

    status)
        ./status.sh
        ;;

    test)
        echo -e "${CYAN}Running tests...${NC}"
        pnpm test
        ;;

    test-api)
        echo -e "${CYAN}Testing API endpoints...${NC}"
        ./test-api.sh
        ;;

    dev)
        echo -e "${CYAN}Starting in development mode...${NC}"
        export NODE_ENV=development
        ./start.sh
        ;;

    prod)
        echo -e "${CYAN}Starting in production mode...${NC}"
        export NODE_ENV=production

        # Build first
        echo -e "${YELLOW}Building packages...${NC}"
        pnpm build

        # Start with Docker Compose production config
        docker-compose up --build
        ;;

    logs)
        echo -e "${CYAN}Showing orchestrator logs...${NC}"
        if docker ps | grep -q agentic-sdlc-orchestrator; then
            docker-compose logs -f orchestrator
        else
            echo -e "${YELLOW}Orchestrator container is not running${NC}"
            echo -e "Showing recent logs from development mode..."
            tail -f packages/orchestrator/logs/*.log 2>/dev/null || \
                echo -e "${RED}No log files found${NC}"
        fi
        ;;

    db:migrate)
        echo -e "${CYAN}Running database migrations...${NC}"
        pnpm --filter @agentic-sdlc/orchestrator exec prisma migrate deploy
        ;;

    db:reset)
        echo -e "${RED}WARNING: This will delete all data!${NC}"
        echo -n "Are you sure? (y/N): "
        read -r confirm
        if [[ $confirm =~ ^[Yy]$ ]]; then
            pnpm --filter @agentic-sdlc/orchestrator exec prisma migrate reset --force
        else
            echo -e "${YELLOW}Cancelled${NC}"
        fi
        ;;

    docker:up)
        echo -e "${CYAN}Starting Docker services...${NC}"
        docker-compose up -d postgres redis
        ;;

    docker:down)
        echo -e "${YELLOW}Stopping Docker services...${NC}"
        docker-compose down
        ;;

    build)
        echo -e "${CYAN}Building all packages...${NC}"
        pnpm build
        ;;

    clean)
        echo -e "${YELLOW}Cleaning build artifacts...${NC}"
        pnpm clean
        rm -rf dist coverage .turbo
        echo -e "${GREEN}✅ Clean complete${NC}"
        ;;

    *)
        echo -e "${RED}Unknown command: $COMMAND${NC}"
        show_usage
        exit 1
        ;;
esac