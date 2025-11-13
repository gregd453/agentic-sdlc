#!/bin/bash

# Run a workflow pipeline end-to-end
# Usage: dev pipeline [description]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"

source "$SCRIPT_DIR/../lib/colors.sh"
source "$SCRIPT_DIR/../lib/helpers.sh"
source "$SCRIPT_DIR/../lib/services.sh"

# Initialize logging
LOG_FILE=$(init_log_file "pipeline")
export_log_file "$LOG_FILE"

DESCRIPTION="${1:-Test Workflow}"

print_header "Agentic SDLC - Pipeline Test"

echo ""
echo "  Description: ${BOLD}${DESCRIPTION}${NC}"
echo ""

# Check if orchestrator is running
echo -n "Checking orchestrator... "
if ! timeout 5 curl -f -s "http://localhost:3000/api/v1/health" > /dev/null 2>&1; then
  echo -e "${RED}✗${NC}"
  echo ""
  echo -e "${RED}Error:${NC} Orchestrator is not running"
  echo "Start services with: ${BOLD}dev start${NC}"
  exit 1
fi
echo -e "${GREEN}✓${NC}"

# Check if agents are running
echo -n "Checking agents... "
running_count=0
for agent in "${AGENT_SERVICES[@]}"; do
  container_name="agentic-${agent}-1"
  if docker ps --format '{{.Names}}' | grep -q "^${container_name}$"; then
    ((running_count++))
  fi
done

if [ "$running_count" -eq 0 ]; then
  echo -e "${RED}✗${NC}"
  echo ""
  echo -e "${YELLOW}Warning:${NC} No agents are running"
  echo "Start services with: ${BOLD}dev start${NC}"
  exit 1
elif [ "$running_count" -lt "${#AGENT_SERVICES[@]}" ]; then
  echo -e "${YELLOW}⚠${NC} (${running_count}/${#AGENT_SERVICES[@]} running)"
else
  echo -e "${GREEN}✓${NC} (all running)"
fi

echo ""
print_subheader "Executing Pipeline"
echo ""

# Check if run-pipeline-test.sh exists
PIPELINE_SCRIPT="$PROJECT_ROOT/scripts/run-pipeline-test.sh"
if [ ! -f "$PIPELINE_SCRIPT" ]; then
  echo -e "${YELLOW}Warning:${NC} Pipeline script not found at $PIPELINE_SCRIPT"
  echo ""
  echo "Creating workflow via API..."

  # Create workflow via API
  RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/workflows \
    -H "Content-Type: application/json" \
    -d "{
      \"description\": \"$DESCRIPTION\",
      \"priority\": \"high\",
      \"metadata\": {
        \"source\": \"dev-cli\",
        \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
      }
    }")

  WORKFLOW_ID=$(echo "$RESPONSE" | jq -r '.id // .workflowId // empty')

  if [ -z "$WORKFLOW_ID" ]; then
    echo -e "${RED}Error:${NC} Failed to create workflow"
    echo "Response: $RESPONSE"
    exit 1
  fi

  echo "  Workflow ID: ${BOLD}${WORKFLOW_ID}${NC}"
  echo ""
  echo "  Monitoring workflow progress..."
  echo ""

  # Poll for workflow completion
  MAX_WAIT=300  # 5 minutes
  ELAPSED=0
  INTERVAL=5

  while [ $ELAPSED -lt $MAX_WAIT ]; do
    STATUS_RESPONSE=$(curl -s "http://localhost:3000/api/v1/workflows/$WORKFLOW_ID")
    STATE=$(echo "$STATUS_RESPONSE" | jq -r '.state // empty')
    STAGE=$(echo "$STATUS_RESPONSE" | jq -r '.currentStage // empty')

    echo -ne "  [$ELAPSED s] State: ${BOLD}${STATE}${NC}, Stage: ${BOLD}${STAGE}${NC}\r"

    if [ "$STATE" = "completed" ]; then
      echo ""
      echo ""
      echo -e "  ${GREEN}✓${NC} Workflow completed successfully"
      break
    elif [ "$STATE" = "failed" ]; then
      echo ""
      echo ""
      echo -e "  ${RED}✗${NC} Workflow failed"
      echo ""
      echo "  Error details:"
      echo "$STATUS_RESPONSE" | jq '.error // .errors // "No error details"'
      exit 1
    fi

    sleep $INTERVAL
    ((ELAPSED+=INTERVAL))
  done

  if [ $ELAPSED -ge $MAX_WAIT ]; then
    echo ""
    echo ""
    echo -e "  ${RED}✗${NC} Workflow timeout (${MAX_WAIT}s)"
    exit 1
  fi

else
  # Use existing pipeline script
  echo "Running: $PIPELINE_SCRIPT \"$DESCRIPTION\""
  echo ""

  "$PIPELINE_SCRIPT" "$DESCRIPTION"
fi

echo ""
print_header "✓ Pipeline Complete"
echo ""

# Print log location
print_log_location "$LOG_FILE"
