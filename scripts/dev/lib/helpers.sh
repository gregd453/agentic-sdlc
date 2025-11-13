#!/bin/bash
# Helper functions used across dev scripts

source "$(dirname "${BASH_SOURCE[0]}")/colors.sh"

# ============================================================================
# Logging Functions
# ============================================================================

# Get or create logs directory
get_logs_dir() {
  local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  local logs_dir="$(dirname "$(dirname "$script_dir")")/logs"

  if [ ! -d "$logs_dir" ]; then
    mkdir -p "$logs_dir"
  fi

  echo "$logs_dir"
}

# Initialize a new timestamped log file
init_log_file() {
  local command_name=$1
  local logs_dir=$(get_logs_dir)
  local timestamp=$(date +"%Y%m%d-%H%M%S")
  local log_file="${logs_dir}/dev-${command_name}-${timestamp}.log"

  # Create log file with header
  {
    echo "=========================================="
    echo "ZYP Platform - Development Log"
    echo "Command: $command_name"
    echo "Started: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "=========================================="
    echo ""
  } > "$log_file"

  echo "$log_file"
}

# Log to both stdout and file
log_output() {
  local log_file=$1
  shift
  local message="$@"
  echo "$message" | tee -a "$log_file"
}

# Export log file for use in scripts
export_log_file() {
  local log_file=$1
  export DEV_LOG_FILE="$log_file"
}

# Print final log location
print_log_location() {
  local log_file=$1
  echo ""
  echo -e "${BLUE}========================================${NC}"
  echo -e "${GREEN}Log saved to:${NC}"
  echo -e "  ${YELLOW}${log_file}${NC}"
  echo -e "${BLUE}========================================${NC}"
  echo ""
}

# Print header
print_header() {
  local title=$1
  echo -e "${BLUE}========================================${NC}"
  echo -e "${BLUE}${title}${NC}"
  echo -e "${BLUE}========================================${NC}"
  echo ""
}

# Print subheader
print_subheader() {
  local title=$1
  echo -e "${YELLOW}${title}${NC}"
}

# Print status message (in progress)
print_status() {
  local message=$1
  echo -e "${CYAN}${ARROW}${NC} ${message}"
}

# Print info message
print_info() {
  local message=$1
  echo -e "${CYAN}${ARROW}${NC} ${message}"
}

# Print success message
print_success() {
  local message=$1
  echo -e "${GREEN}${SUCCESS}${NC} ${message}"
}

# Print error message
print_error() {
  local message=$1
  echo -e "${RED}${ERROR}${NC} ${message}"
}

# Print warning message
print_warning() {
  local message=$1
  echo -e "${YELLOW}⚠${NC} ${message}"
}

# Check if Docker is running
check_docker() {
  if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running"
    exit 1
  fi
}

# Check if Docker Compose file exists
check_compose_file() {
  if [ ! -f "$PROJECT_ROOT/docker-compose.dev.yml" ]; then
    print_error "docker-compose.dev.yml not found at $PROJECT_ROOT"
    exit 1
  fi
}

# Get project root (script's parent directory)
get_project_root() {
  local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  # Go up: scripts/dev/lib -> scripts/dev -> scripts -> root
  echo "$(dirname "$(dirname "$(dirname "$script_dir")")")"
}

# Docker compose wrapper
docker_compose() {
  docker compose -f "$PROJECT_ROOT/docker-compose.dev.yml" "$@"
}

# Wait for service to be healthy
wait_for_service() {
  local service=$1
  local max_retries=${2:-30}
  local retry_count=0

  while [ $retry_count -lt $max_retries ]; do
    if docker_compose ps "$service" 2>/dev/null | grep -q "healthy\|running"; then
      return 0
    fi
    retry_count=$((retry_count + 1))
    sleep 1
  done

  return 1
}

# Get container status
get_container_status() {
  local container=$1
  docker ps --format "{{.Status}}" -f "name=$container" 2>/dev/null | head -1
}

# Check if service is running
is_running() {
  local service=$1
  docker_compose ps "$service" 2>/dev/null | tail -1 | grep -q "Up"
}

# Trap Ctrl+C for graceful shutdown
setup_interrupt_trap() {
  trap 'print_warning "Interrupted"; exit 0' INT TERM
}

# Display list of services nicely
list_services() {
  echo ""
  echo -e "${YELLOW}Available Services:${NC}"
  echo ""
  echo -e "  ${BRIGHT_CYAN}Infrastructure:${NC}"
  echo -e "    postgres          - PostgreSQL 15 database"
  echo -e "    redis             - Redis 7 cache"
  echo ""
  echo -e "  ${BRIGHT_CYAN}APIs:${NC}"
  echo -e "    user-core-api     - User core service (port 3001)"
  echo -e "    user-chat-api     - Chat service (port 3004)"
  echo -e "    user-credit-api   - Credit service (port 3002)"
  echo -e "    nfl-games-api     - NFL games service (port 3003)"
  echo -e "    nfl-square-api    - NFL squares service (port 3005)"
  echo ""
  echo -e "  ${BRIGHT_CYAN}Frontends:${NC}"
  echo -e "    user-core-frontend    - User core UI (port 5173)"
  echo -e "    user-chat-frontend    - Chat UI (port 5174)"
  echo -e "    user-credit-frontend  - Credit UI (port 3100)"
  echo -e "    nfl-games-frontend    - Games UI (port 3200)"
  echo -e "    nfl-square-frontend   - Squares UI (port 3006)"
  echo ""
  echo -e "  ${BRIGHT_CYAN}Infrastructure:${NC}"
  echo -e "    nginx             - Reverse proxy (port 3000)"
  echo -e "    zyp-pilot         - Shell application (port 3050)"
  echo ""
}

# Display service URLs
list_service_urls() {
  echo ""
  echo -e "${YELLOW}Service URLs:${NC}"
  echo ""
  echo -e "  ${BRIGHT_CYAN}Shell:${NC}"
  echo -e "    ${BLUE}http://localhost:3050${NC}  - ZypPilot (unified entry point)"
  echo ""
  echo -e "  ${BRIGHT_CYAN}APIs:${NC}"
  echo -e "    ${BLUE}http://localhost:3001${NC}  - User Core API"
  echo -e "    ${BLUE}http://localhost:3002${NC}  - User Credit API"
  echo -e "    ${BLUE}http://localhost:3003${NC}  - NFL Games API"
  echo -e "    ${BLUE}http://localhost:3004${NC}  - User Chat API"
  echo -e "    ${BLUE}http://localhost:3005${NC}  - NFL Squares API"
  echo ""
  echo -e "  ${BRIGHT_CYAN}Frontends (via nginx proxy):${NC}"
  echo -e "    ${BLUE}http://localhost:3000${NC}  - User Core Frontend"
  echo -e "    ${BLUE}http://localhost:3100${NC}  - User Credit Frontend"
  echo -e "    ${BLUE}http://localhost:3200${NC}  - NFL Games Frontend"
  echo ""
  echo -e "  ${BRIGHT_CYAN}Infrastructure:${NC}"
  echo -e "    ${BLUE}localhost:5432${NC}  - PostgreSQL"
  echo -e "    ${BLUE}localhost:6379${NC}  - Redis"
  echo ""
}
