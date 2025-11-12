#!/bin/bash

##############################################################################
# process-manager.sh - Process Management Library
#
# Provides utilities for tracking and cleaning up process trees.
# Handles graceful shutdown with timeout fallback to force kill.
#
# Features:
# - Process tree tracking with service names
# - Process group management
# - Graceful shutdown with SIGTERM
# - Force kill with SIGKILL after timeout
# - Post-cleanup verification
#
# Usage:
#   source scripts/lib/process-manager.sh
#   save_process_tree "service-name" 1234 "$PIDS_FILE"
#   kill_process_tree 1234 false
##############################################################################

set -u  # Error on undefined variables

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

##############################################################################
# save_process_tree
#
# Save process information for later cleanup.
# Records PID, process group, and service name.
#
# Arguments:
#   $1 = service name (e.g., "orchestrator", "scaffold-agent")
#   $2 = process ID to track
#   $3 = path to PID file
#
# Creates/Updates:
#   $3 = Main PID file
#   ${3}.groups = Process group mappings
#   ${3}.services = Service name to PID mappings
##############################################################################
save_process_tree() {
  local service_name="$1"
  local pid="$2"
  local pids_file="$3"

  if [ ! -d "$(dirname "$pids_file")" ]; then
    mkdir -p "$(dirname "$pids_file")"
  fi

  # Record the main PID
  echo "$pid" >> "$pids_file"

  # Get and record process group ID
  local pgid
  pgid=$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ' || echo "0")
  if [ "$pgid" != "0" ]; then
    echo "PGID:$service_name:$pgid" >> "${pids_file}.groups"
  fi

  # Record service name for logging
  echo "$service_name:$pid" >> "${pids_file}.services"
}

##############################################################################
# get_all_descendants
#
# Recursively get all descendant processes of a given PID.
# Returns PIDs in breadth-first order (parents before children).
#
# Arguments:
#   $1 = parent process ID
#
# Output:
#   Space-separated list of all descendant PIDs
##############################################################################
get_all_descendants() {
  local parent_pid="$1"
  local all_pids="$parent_pid"
  local to_process="$parent_pid"
  local current_pid

  while [ -n "$to_process" ]; do
    # Get first PID from queue
    current_pid=$(echo "$to_process" | awk '{print $1}')
    # Remove first PID from queue
    to_process=$(echo "$to_process" | awk '{$1=""; print}' | xargs)

    # Find children of current PID
    local children
    children=$(pgrep -P "$current_pid" 2>/dev/null || true)

    # Add children to all_pids and to_process queue
    for child in $children; do
      all_pids="$all_pids $child"
      to_process="$to_process $child"
    done
  done

  echo "$all_pids"
}

##############################################################################
# kill_process_tree
#
# Gracefully kill a process and all its descendants.
# Attempts SIGTERM first, falls back to SIGKILL after timeout.
#
# Arguments:
#   $1 = process ID to kill
#   $2 = force mode (true/false) - skip graceful shutdown
#   $3 = timeout in seconds (optional, default 2)
#
# Returns:
#   0 = success
#   1 = process did not exist
##############################################################################
kill_process_tree() {
  local pid="$1"
  local force="${2:-false}"
  local timeout="${3:-2}"

  # Check if process exists
  if ! kill -0 "$pid" 2>/dev/null; then
    return 1
  fi

  local all_pids
  all_pids=$(get_all_descendants "$pid")

  if [ "$force" = true ]; then
    # Force kill all processes
    for p in $all_pids; do
      kill -9 "$p" 2>/dev/null || true
    done
  else
    # Graceful shutdown: SIGTERM first
    for p in $all_pids; do
      kill -15 "$p" 2>/dev/null || true
    done

    # Wait for graceful shutdown
    sleep "$timeout"

    # Force kill any remaining processes
    for p in $all_pids; do
      if kill -0 "$p" 2>/dev/null; then
        kill -9 "$p" 2>/dev/null || true
      fi
    done
  fi

  return 0
}

##############################################################################
# kill_process_group
#
# Kill all processes in a process group.
# Typically used after killing parent process to catch any stragglers.
#
# Arguments:
#   $1 = process group ID (PGID)
#   $2 = force mode (true/false)
##############################################################################
kill_process_group() {
  local pgid="$1"
  local force="${2:-false}"

  if [ "$force" = true ]; then
    kill -9 "-$pgid" 2>/dev/null || true
  else
    kill -15 "-$pgid" 2>/dev/null || true
    sleep 2
    kill -9 "-$pgid" 2>/dev/null || true
  fi
}

##############################################################################
# count_running_processes
#
# Count how many processes are currently running from a PID list.
#
# Arguments:
#   $1 = path to PID file
#
# Returns:
#   Number of running processes
##############################################################################
count_running_processes() {
  local pids_file="$1"
  local count=0

  if [ ! -f "$pids_file" ]; then
    echo 0
    return 0
  fi

  while IFS= read -r pid; do
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      ((count++)) || true
    fi
  done < "$pids_file"

  echo "$count"
}

##############################################################################
# get_service_name
#
# Get the service name for a given PID.
#
# Arguments:
#   $1 = process ID
#   $2 = path to services file
#
# Returns:
#   Service name or "unknown"
##############################################################################
get_service_name() {
  local pid="$1"
  local services_file="$2"

  if [ ! -f "$services_file" ]; then
    echo "unknown"
    return 0
  fi

  local service
  service=$(grep ":$pid$" "$services_file" 2>/dev/null | cut -d: -f1 || echo "unknown")
  echo "$service"
}

##############################################################################
# log_process_info
#
# Log information about a process.
#
# Arguments:
#   $1 = process ID
#   $2 = service name (optional)
##############################################################################
log_process_info() {
  local pid="$1"
  local service_name="${2:-unknown}"
  local cmd
  local mem
  local cpu

  if ! kill -0 "$pid" 2>/dev/null; then
    echo -e "  ${YELLOW}PID $pid${NC} - not running"
    return 0
  fi

  # Get process command
  cmd=$(ps -o command= -p "$pid" 2>/dev/null | head -c 60)

  # Get memory and CPU usage
  mem=$(ps -o rss= -p "$pid" 2>/dev/null | awk '{print int($1/1024)}')
  cpu=$(ps -o %cpu= -p "$pid" 2>/dev/null | tr -d ' ')

  echo -e "  ${YELLOW}$service_name${NC} (PID: $pid) - ${cpu}% CPU, ${mem}MB RAM"
}

##############################################################################
# verify_cleanup
#
# Verify that all processes from a PID file are dead.
# Returns non-zero if any processes still running.
#
# Arguments:
#   $1 = path to PID file
#
# Returns:
#   0 = all processes cleaned
#   >0 = number of remaining processes
##############################################################################
verify_cleanup() {
  local pids_file="$1"
  local remaining=0

  if [ ! -f "$pids_file" ]; then
    return 0
  fi

  while IFS= read -r pid; do
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      ((remaining++)) || true
    fi
  done < "$pids_file"

  return "$remaining"
}

##############################################################################
# cleanup_tracking_files
#
# Remove all process tracking files.
#
# Arguments:
#   $1 = path to main PID file
##############################################################################
cleanup_tracking_files() {
  local pids_file="$1"

  rm -f "$pids_file"
  rm -f "${pids_file}.groups"
  rm -f "${pids_file}.services"
}

##############################################################################
# Export functions for use in other scripts
##############################################################################

export -f save_process_tree
export -f get_all_descendants
export -f kill_process_tree
export -f kill_process_group
export -f count_running_processes
export -f get_service_name
export -f log_process_info
export -f verify_cleanup
export -f cleanup_tracking_files

