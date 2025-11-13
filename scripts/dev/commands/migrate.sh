#!/bin/bash
set -e

# Run database migrations
# Usage: dev migrate [service]
#   service - Optional service name (runs all if not specified)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"

source "$SCRIPT_DIR/../lib/colors.sh"
source "$SCRIPT_DIR/../lib/helpers.sh"

# Initialize logging
LOG_FILE=$(init_log_file "migrate")
export_log_file "$LOG_FILE"

check_docker

SERVICE=$1

run_migration() {
  local svc=$1
  local name=$2
  local cmd=$3

  echo -n "  ${svc}... "

  if docker_compose run --rm "$svc" bash -c "$cmd" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
    return 0
  else
    echo -e "${RED}✗${NC}"
    return 1
  fi
}

print_header "ZYP Platform - Database Migrations"

if [ -z "$SERVICE" ]; then
  print_subheader "Running migrations for all services..."
  echo ""

  run_migration "user-core-api" "User Core" "pnpm exec prisma migrate deploy && pnpm exec prisma generate"
  run_migration "user-chat-api" "User Chat" "pnpm exec prisma generate"
  run_migration "user-credit-api" "User Credit" "pnpm run prisma:migrate:deploy && pnpm exec prisma generate"
  run_migration "nfl-games-api" "NFL Games" "pnpm exec prisma generate"
  run_migration "nfl-square-api" "NFL Squares" "pnpm exec prisma generate"
  run_migration "user-credit-worker" "User Credit Worker" "pnpm exec prisma generate"

  echo ""
  print_success "Migrations complete"
else
  print_subheader "Running migration for $SERVICE..."
  echo ""

  case "$SERVICE" in
    user-core-api)
      run_migration "$SERVICE" "User Core" "pnpm exec prisma migrate deploy && pnpm exec prisma generate"
      ;;
    user-chat-api)
      run_migration "$SERVICE" "User Chat" "pnpm exec prisma generate"
      ;;
    user-credit-api)
      run_migration "$SERVICE" "User Credit" "pnpm run prisma:migrate:deploy && pnpm exec prisma generate"
      ;;
    nfl-games-api)
      run_migration "$SERVICE" "NFL Games" "pnpm exec prisma generate"
      ;;
    nfl-square-api)
      run_migration "$SERVICE" "NFL Squares" "pnpm exec prisma generate"
      ;;
    user-credit-worker)
      run_migration "$SERVICE" "User Credit Worker" "pnpm exec prisma generate"
      ;;
    *)
      print_error "Unknown service: $SERVICE"
      exit 1
      ;;
  esac

  echo ""
  print_success "Migration complete"
fi

echo ""

# Print log location
print_log_location "$LOG_FILE"
