#!/bin/bash
# Start development environment - Choose between Docker or Local
# Usage: dev start [MODE] [OPTIONS]
#   Modes: docker (default), local
#   Options for docker: --build, --clean, --logs
#   Options for local:  --no-db, --logs

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "$SCRIPT_DIR/../lib/colors.sh"

# Detect mode from first argument
MODE=${1:-docker}

# Check if first arg is a mode keyword
if [[ "$MODE" == "docker" ]] || [[ "$MODE" == "local" ]]; then
  ACTUAL_MODE="$MODE"
  shift || true
else
  # Default to docker for backward compatibility
  ACTUAL_MODE="docker"
fi

case "$ACTUAL_MODE" in
  docker)
    exec "$SCRIPT_DIR/docker-start.sh" "$@"
    ;;
  local)
    exec "$SCRIPT_DIR/local-start.sh" "$@"
    ;;
  *)
    print_error "Unknown mode: $ACTUAL_MODE"
    echo "Use: dev start [docker|local] [options]"
    exit 1
    ;;
esac
