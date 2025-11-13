#!/bin/bash
# Local database management for development
# Helps start/stop postgres and redis on local machine

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/colors.sh"
source "$SCRIPT_DIR/../lib/helpers.sh"

# Check if postgres is installed
check_postgres() {
  if ! command -v psql &> /dev/null; then
    print_error "PostgreSQL is not installed"
    echo ""
    echo "Install PostgreSQL:"
    echo "  macOS (homebrew): brew install postgresql@15"
    echo "  Linux (apt):      sudo apt-get install postgresql postgresql-contrib"
    echo "  Windows:          https://www.postgresql.org/download/windows/"
    exit 1
  fi
}

# Check if redis is installed
check_redis() {
  if ! command -v redis-cli &> /dev/null; then
    print_error "Redis is not installed"
    echo ""
    echo "Install Redis:"
    echo "  macOS (homebrew): brew install redis"
    echo "  Linux (apt):      sudo apt-get install redis-server"
    echo "  Windows:          https://redis.io/download or use WSL"
    exit 1
  fi
}

# Start postgres locally
start_postgres() {
  echo -n "Checking PostgreSQL... "

  if pg_isready -h localhost -U postgres > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Running${NC}"
    return 0
  fi

  echo "Starting..."

  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS with homebrew
    if brew services start postgresql@15 > /dev/null 2>&1; then
      echo -e "${GREEN}✓ Started${NC}"
      sleep 2
      return 0
    fi
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    if sudo systemctl start postgresql > /dev/null 2>&1; then
      echo -e "${GREEN}✓ Started${NC}"
      sleep 2
      return 0
    fi
  fi

  print_error "Could not start PostgreSQL. Try running it manually or check your installation"
  exit 1
}

# Start redis locally
start_redis() {
  echo -n "Checking Redis... "

  if redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Running${NC}"
    return 0
  fi

  echo "Starting..."

  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS with homebrew
    if brew services start redis > /dev/null 2>&1; then
      echo -e "${GREEN}✓ Started${NC}"
      sleep 1
      return 0
    fi
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    if sudo systemctl start redis-server > /dev/null 2>&1; then
      echo -e "${GREEN}✓ Started${NC}"
      sleep 1
      return 0
    fi
  fi

  print_error "Could not start Redis. Try running it manually or check your installation"
  exit 1
}

# Stop postgres
stop_postgres() {
  echo -n "Stopping PostgreSQL... "

  if [[ "$OSTYPE" == "darwin"* ]]; then
    brew services stop postgresql@15 > /dev/null 2>&1 && echo -e "${GREEN}✓${NC}" || echo -e "${YELLOW}(not running)${NC}"
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    sudo systemctl stop postgresql > /dev/null 2>&1 && echo -e "${GREEN}✓${NC}" || echo -e "${YELLOW}(not running)${NC}"
  fi
}

# Stop redis
stop_redis() {
  echo -n "Stopping Redis... "

  if [[ "$OSTYPE" == "darwin"* ]]; then
    brew services stop redis > /dev/null 2>&1 && echo -e "${GREEN}✓${NC}" || echo -e "${YELLOW}(not running)${NC}"
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    sudo systemctl stop redis-server > /dev/null 2>&1 && echo -e "${GREEN}✓${NC}" || echo -e "${YELLOW}(not running)${NC}"
  fi
}

# Show status
show_status() {
  echo ""
  echo -n "PostgreSQL:  "
  if pg_isready -h localhost -U postgres > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Running (localhost:5432)${NC}"
  else
    echo -e "${RED}✗ Not running${NC}"
  fi

  echo -n "Redis:       "
  if redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Running (localhost:6379)${NC}"
  else
    echo -e "${RED}✗ Not running${NC}"
  fi
  echo ""
}

# Main
COMMAND=${1:-status}

case "$COMMAND" in
  start)
    check_postgres
    check_redis
    print_subheader "Starting local databases..."
    start_postgres
    start_redis
    show_status
    print_success "Local databases ready"
    ;;
  stop)
    print_subheader "Stopping local databases..."
    stop_postgres
    stop_redis
    print_success "Local databases stopped"
    ;;
  status)
    print_header "Local Database Status"
    check_postgres
    check_redis
    show_status
    ;;
  *)
    echo "Usage: local-db [start|stop|status]"
    exit 1
    ;;
esac
