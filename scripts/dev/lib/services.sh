#!/bin/bash
# Service definitions and utilities for Agentic SDLC

# Source colors
source "$(dirname "${BASH_SOURCE[0]}")/colors.sh"

# Infrastructure services (must start first)
INFRASTRUCTURE_SERVICES=("postgres" "redis")

# Application services (depend on infrastructure)
APPLICATION_SERVICES=(
  "orchestrator"
)

# Agent services (depend on orchestrator)
AGENT_SERVICES=(
  "scaffold-agent"
  "validation-agent"
  "e2e-agent"
)

# Get service display name
get_service_name() {
  local service=$1
  case "$service" in
    postgres) echo "Database (PostgreSQL 16)" ;;
    redis) echo "Cache & Message Bus (Redis 7)" ;;
    orchestrator) echo "Workflow Orchestrator (Fastify + Hexagonal)" ;;
    scaffold-agent) echo "Scaffold Agent (Autonomous)" ;;
    validation-agent) echo "Validation Agent (Autonomous)" ;;
    e2e-agent) echo "E2E Testing Agent (Autonomous)" ;;
    *) echo "$service" ;;
  esac
}

# Get service port
get_service_port() {
  local service=$1
  case "$service" in
    postgres) echo "5433" ;;
    redis) echo "6380" ;;
    orchestrator) echo "3000" ;;
    scaffold-agent) echo "none" ;;
    validation-agent) echo "none" ;;
    e2e-agent) echo "none" ;;
    *) echo "unknown" ;;
  esac
}

# Pretty print service status
print_service_status() {
  local service=$1
  local status=$2
  local name=$(get_service_name "$service")
  local port=$(get_service_port "$service")

  case $status in
    "running")
      echo -e "  ${GREEN}${SUCCESS}${NC} ${BOLD}${service}${NC} ${DIM}(${port})${NC} - ${name}"
      ;;
    "exited")
      echo -e "  ${RED}${ERROR}${NC} ${BOLD}${service}${NC} ${DIM}(${port})${NC} - ${name} ${DIM}[stopped]${NC}"
      ;;
    "unhealthy")
      echo -e "  ${YELLOW}⚠${NC} ${BOLD}${service}${NC} ${DIM}(${port})${NC} - ${name} ${DIM}[unhealthy]${NC}"
      ;;
    *)
      echo -e "  ${CYAN}?${NC} ${BOLD}${service}${NC} ${DIM}(${port})${NC} - ${name} ${DIM}[${status}]${NC}"
      ;;
  esac
}
