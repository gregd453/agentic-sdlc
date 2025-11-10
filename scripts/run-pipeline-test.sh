#!/bin/bash

##############################################################################
# RUN-PIPELINE-TEST.sh - Execute Pipeline Test Cases
#
# Automatically runs test cases defined in PIPELINE-TEST-CASES.md
# Submits workflows to orchestrator and monitors completion
#
# Usage:
#   ./scripts/run-pipeline-test.sh <test_name>      # Run specific test
#   ./scripts/run-pipeline-test.sh --list            # List available tests
#   ./scripts/run-pipeline-test.sh --all             # Run all tests
#   ./scripts/run-pipeline-test.sh <test> --verbose  # Show detailed output
##############################################################################

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_CASES_FILE="$PROJECT_ROOT/PIPELINE-TEST-CASES.md"
LOGS_DIR="$PROJECT_ROOT/scripts/logs"
RESULTS_DIR="$PROJECT_ROOT/.test-results"
ORCHESTRATOR_URL="http://localhost:3000"

# Parse arguments
TEST_NAME=""
LIST_ONLY=false
RUN_ALL=false
VERBOSE=false
TIMEOUT=300  # 5 minutes per test

while [[ $# -gt 0 ]]; do
  case $1 in
    --list) LIST_ONLY=true; shift ;;
    --all) RUN_ALL=true; shift ;;
    --verbose) VERBOSE=true; shift ;;
    --*) echo "Unknown option: $1"; exit 1 ;;
    *) TEST_NAME="$1"; shift ;;
  esac
done

# Create results directory
mkdir -p "$RESULTS_DIR"
mkdir -p "$LOGS_DIR"

# Function to extract test case by name
extract_test_case() {
  local test=$1
  local mode=$2  # "payload" or "name"

  # Use awk to extract test case payload from markdown
  awk -v test="$test" -v mode="$mode" '
    /^### / {
      current_section = substr($0, 5)
      in_section = (current_section == test)
    }
    in_section && /^```json$/ {
      in_json = 1
      next
    }
    in_json && /^```$/ {
      in_json = 0
      exit
    }
    in_json { print }
  ' "$TEST_CASES_FILE"
}

# Function to list available tests
list_tests() {
  echo -e "${BLUE}Available Test Cases:${NC}"
  echo ""
  grep "^### " "$TEST_CASES_FILE" | sed 's/^### /  • /' | nl
  echo ""
}

# Function to run a single test
run_test() {
  local test_name=$1
  local payload=$(extract_test_case "$test_name")

  if [ -z "$payload" ]; then
    echo -e "${RED}✗${NC} Test case '$test_name' not found"
    return 1
  fi

  local test_id=$(echo "$test_name" | tr ' ' '-' | tr '[:upper:]' '[:lower:]')
  local start_time=$(date +%s)
  local log_file="$LOGS_DIR/test-${test_id}-$(date +%Y%m%d-%H%M%S).log"

  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${CYAN}Test: $test_name${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  if [ "$VERBOSE" = true ]; then
    echo "Payload:"
    echo "$payload" | jq '.'
    echo ""
  fi

  # 1. Submit workflow
  echo -n "Submitting workflow... "
  local response=$(curl -s -X POST "$ORCHESTRATOR_URL/api/v1/workflows" \
    -H "Content-Type: application/json" \
    -d "$payload" 2>/dev/null || echo "")

  if [ -z "$response" ]; then
    echo -e "${RED}✗ Failed to connect to orchestrator${NC}"
    echo "  Make sure orchestrator is running on :3000"
    return 1
  fi

  local workflow_id=$(echo "$response" | jq -r '.workflow_id' 2>/dev/null)
  if [ -z "$workflow_id" ] || [ "$workflow_id" = "null" ]; then
    echo -e "${RED}✗ Invalid response${NC}"
    if [ "$VERBOSE" = true ]; then
      echo "$response" | jq '.'
    fi
    return 1
  fi

  echo -e "${GREEN}✓${NC}"
  echo "  Workflow ID: $workflow_id"
  echo ""

  # 2. Monitor workflow
  echo "Monitoring progress:"
  echo ""

  local attempts=0
  local max_attempts=$((TIMEOUT / 2))

  while [ $attempts -lt $max_attempts ]; do
    local status_response=$(curl -s "$ORCHESTRATOR_URL/api/v1/workflows/$workflow_id")
    local status=$(echo "$status_response" | jq -r '.status' 2>/dev/null)
    local stage=$(echo "$status_response" | jq -r '.current_stage' 2>/dev/null)
    local progress=$(echo "$status_response" | jq -r '.progress_percentage' 2>/dev/null)

    # Progress bar
    local bar_width=30
    local filled=$((progress * bar_width / 100))
    local empty=$((bar_width - filled))
    local bar=$(printf "%${filled}s" | tr ' ' '█')
    local bar=$(printf "%-${bar_width}s" "$bar" | tr ' ' '░')

    printf "\r  [$bar] %3d%% | Stage: %-15s | Status: %s" "$progress" "$stage" "$status"

    case "$status" in
      completed)
        echo ""
        echo ""
        echo -e "${GREEN}✓ Workflow completed!${NC}"
        echo ""

        # Save results
        local result_file="$RESULTS_DIR/test-${test_id}-result.json"
        echo "$status_response" | jq '.' > "$result_file"

        # Show summary
        local app_path=$(echo "$status_response" | jq -r '.output.app_path // empty')
        if [ ! -z "$app_path" ]; then
          echo "Generated app: $app_path"
          echo "Files created:"
          find "$app_path" -type f | head -5 | sed 's/^/  /'
          if [ $(find "$app_path" -type f | wc -l) -gt 5 ]; then
            echo "  ... and $(( $(find "$app_path" -type f | wc -l) - 5 )) more files"
          fi
        fi
        echo ""

        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        echo -e "${GREEN}Duration: ${duration}s${NC}"

        return 0
        ;;

      failed)
        echo ""
        echo ""
        echo -e "${RED}✗ Workflow failed!${NC}"
        local error=$(echo "$status_response" | jq -r '.error // .message // "Unknown error"')
        echo "Error: $error"
        echo ""
        return 1
        ;;
    esac

    ((attempts++))
    sleep 2
  done

  echo ""
  echo ""
  echo -e "${RED}✗ Workflow timeout${NC}"
  echo "  Exceeded ${TIMEOUT}s limit"
  echo ""
  return 1
}

# Main execution
echo ""

if [ "$LIST_ONLY" = true ]; then
  list_tests
  exit 0
fi

if [ -z "$TEST_NAME" ] && [ "$RUN_ALL" = false ]; then
  echo -e "${RED}Usage: $0 <test_name|--list|--all> [--verbose]${NC}"
  echo ""
  list_tests
  exit 1
fi

# Header
echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}Pipeline Test Executor${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Check health
echo "Checking environment health..."
"$PROJECT_ROOT/scripts/env/check-health.sh" > /dev/null 2>&1 || {
  echo -e "${RED}✗ Environment not ready${NC}"
  echo "  Run: ./scripts/env/start-dev.sh"
  exit 1
}
echo -e "${GREEN}✓ Environment healthy${NC}"
echo ""

# Run tests
if [ "$RUN_ALL" = true ]; then
  # Define all test cases (only those with JSON payloads)
  tests=(
    "Simple Calculator"
    "Hello World API"
    "React Dashboard"
    "Form Application"
    "Todo List"
    "Fullstack Notes App"
    "Performance Test"
    "Component Library"
  )

  total=${#tests[@]}
  passed=0
  failed=0

  for test in "${tests[@]}"; do
    if run_test "$test"; then
      ((passed++))
    else
      ((failed++))
    fi
  done

  echo ""
  echo -e "${BLUE}================================================${NC}"
  echo "Summary: $passed passed, $failed failed (out of $total tests)"
  echo -e "${BLUE}================================================${NC}"
  echo ""
else
  if run_test "$TEST_NAME"; then
    exit 0
  else
    exit 1
  fi
fi
