#!/bin/bash

# Agentic SDLC API Test Script
# Version: 1.0
# Description: Tests the orchestrator API endpoints

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

API_BASE="http://localhost:3000"

echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}           Agentic SDLC API Test Suite${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}\n"

# Function to test an endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4

    echo -e "${YELLOW}Testing:${NC} $description"
    echo -e "${BLUE}$method${NC} $endpoint"

    if [ -n "$data" ]; then
        echo -e "${PURPLE}Payload:${NC}"
        echo "$data" | jq '.' 2>/dev/null || echo "$data"
    fi

    echo -e "${CYAN}Response:${NC}"

    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$API_BASE$endpoint")
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$API_BASE$endpoint")
    fi

    # Extract status code
    status=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)
    body=$(echo "$response" | sed '/HTTP_STATUS/d')

    # Pretty print JSON response
    echo "$body" | jq '.' 2>/dev/null || echo "$body"

    # Check status
    if [ "$status" -ge 200 ] && [ "$status" -lt 300 ]; then
        echo -e "${GREEN}✅ Success (HTTP $status)${NC}"
    else
        echo -e "${RED}❌ Failed (HTTP $status)${NC}"
    fi

    echo -e "${PURPLE}───────────────────────────────────────────────────────────────${NC}\n"
}

# Check if orchestrator is running
echo -e "${YELLOW}Checking orchestrator status...${NC}"
if ! curl -s -f "$API_BASE/api/v1/health" >/dev/null 2>&1; then
    echo -e "${RED}❌ Orchestrator is not running!${NC}"
    echo -e "${YELLOW}Please start it first with: ${CYAN}./start.sh${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Orchestrator is running${NC}\n"

# Test 1: Health Check
test_endpoint "GET" "/api/v1/health" "" "Health Check"

# Test 2: List Workflows (should be empty initially)
test_endpoint "GET" "/api/v1/workflows" "" "List All Workflows"

# Test 3: Create a Workflow
WORKFLOW_DATA='{
  "type": "app",
  "name": "test-rewards-app",
  "description": "Test rewards application",
  "requirements": "Build a rewards system for users",
  "priority": "high"
}'

echo -e "${CYAN}Creating a test workflow...${NC}"
test_endpoint "POST" "/api/v1/workflows" "$WORKFLOW_DATA" "Create Workflow"

# Save workflow ID if creation was successful
WORKFLOW_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "$WORKFLOW_DATA" \
    "$API_BASE/api/v1/workflows")

WORKFLOW_ID=$(echo "$WORKFLOW_RESPONSE" | jq -r '.workflow_id' 2>/dev/null)

if [ -n "$WORKFLOW_ID" ] && [ "$WORKFLOW_ID" != "null" ]; then
    echo -e "${GREEN}Workflow created with ID: ${CYAN}$WORKFLOW_ID${NC}\n"

    # Test 4: Get Workflow by ID
    test_endpoint "GET" "/api/v1/workflows/$WORKFLOW_ID" "" "Get Workflow by ID"

    # Test 5: List Workflows (should show our workflow)
    test_endpoint "GET" "/api/v1/workflows" "" "List Workflows After Creation"

    # Test 6: Cancel Workflow
    test_endpoint "POST" "/api/v1/workflows/$WORKFLOW_ID/cancel" "" "Cancel Workflow"

    # Test 7: Retry Workflow
    test_endpoint "POST" "/api/v1/workflows/$WORKFLOW_ID/retry" '{"from_stage": "validation"}' "Retry Workflow from Validation"
else
    echo -e "${YELLOW}⚠️  Could not extract workflow ID, skipping individual workflow tests${NC}\n"
fi

# Test 8: Filter Workflows
test_endpoint "GET" "/api/v1/workflows?status=running&type=app" "" "Filter Workflows by Status and Type"

# Summary
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}           API Test Suite Complete!${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}\n"

echo -e "${BLUE}API Documentation available at:${NC}"
echo -e "${CYAN}$API_BASE/documentation${NC}\n"