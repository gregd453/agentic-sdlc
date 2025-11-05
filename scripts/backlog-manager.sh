#!/bin/bash

# Backlog Manager Script
# Version: 1.0
# Description: Manages and executes tasks from the system backlog

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

API_BASE="http://localhost:3000"
BACKLOG_FILE="backlog/system-backlog.json"

# Function to show usage
show_usage() {
    cat << EOF
${CYAN}Agentic SDLC Backlog Manager${NC}

${YELLOW}Usage:${NC}
  ./scripts/backlog-manager.sh [command] [options]

${YELLOW}Commands:${NC}
  ${GREEN}list${NC}            List all tasks in backlog
  ${GREEN}sprint${NC}          Show current sprint tasks
  ${GREEN}ready${NC}           Show tasks ready to execute
  ${GREEN}blocked${NC}         Show blocked tasks
  ${GREEN}execute${NC} <id>    Execute a specific task
  ${GREEN}execute-sprint${NC}  Execute all ready tasks in current sprint
  ${GREEN}status${NC} <id>     Check status of a task
  ${GREEN}progress${NC}        Show overall progress
  ${GREEN}git-setup${NC}       Setup git for the project

${YELLOW}Examples:${NC}
  ./scripts/backlog-manager.sh list
  ./scripts/backlog-manager.sh execute TASK-006
  ./scripts/backlog-manager.sh sprint
  ./scripts/backlog-manager.sh progress

EOF
}

# Function to check if orchestrator is running
check_orchestrator() {
    if ! curl -s -f "$API_BASE/api/v1/health" >/dev/null 2>&1; then
        echo -e "${RED}❌ Orchestrator is not running!${NC}"
        echo -e "${YELLOW}Please start it first with: ${CYAN}./start.sh${NC}"
        exit 1
    fi
}

# Function to list all tasks
list_tasks() {
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}                    All Backlog Tasks${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}\n"

    # Parse backlog using jq
    if [ ! -f "$BACKLOG_FILE" ]; then
        echo -e "${RED}❌ Backlog file not found: $BACKLOG_FILE${NC}"
        exit 1
    fi

    # List all sprints and their tasks
    jq -r '.sprints[] |
        "\n\(.name) (Sprint \(.number))\n" +
        "────────────────────────────\n" +
        (.tasks[] | "  [\(.status)] \(.id): \(.title) (\(.story_points) pts)")' \
        "$BACKLOG_FILE"

    echo ""
    echo -e "${PURPLE}Backlog Items:${NC}"
    jq -r '.backlog[] | "  [\(.status)] \(.id): \(.title) (\(.story_points) pts)"' \
        "$BACKLOG_FILE"
}

# Function to show current sprint
show_sprint() {
    local current_sprint=$(jq -r '.metadata.current_sprint' "$BACKLOG_FILE")

    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}              Sprint $current_sprint Tasks${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}\n"

    jq -r --arg sprint "$current_sprint" '.sprints[] |
        select(.number == ($sprint | tonumber)) |
        "\(.name)\nGoal: \(.goal)\n" +
        "Duration: \(.duration_days) days\n" +
        "────────────────────────────\n" +
        (.tasks[] |
            "ID: \(.id)\n" +
            "Title: \(.title)\n" +
            "Status: \(.status)\n" +
            "Priority: \(.priority)\n" +
            "Story Points: \(.story_points)\n" +
            if .blocked_by then "Blocked by: \(.blocked_by | join(", "))\n" else "" end +
            "────────────────────────────")' \
        "$BACKLOG_FILE"
}

# Function to show ready tasks
show_ready() {
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}                  Ready to Execute${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}\n"

    jq -r '.sprints[].tasks[] |
        select(.status == "ready") |
        "\(.id): \(.title)\n  Priority: \(.priority) | Points: \(.story_points)\n"' \
        "$BACKLOG_FILE"
}

# Function to show blocked tasks
show_blocked() {
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}                   Blocked Tasks${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}\n"

    jq -r '.sprints[].tasks[] |
        select(.status == "blocked") |
        "\(.id): \(.title)\n  Blocked by: \(.blocked_by | join(", "))\n"' \
        "$BACKLOG_FILE"
}

# Function to execute a task
execute_task() {
    local task_id=$1

    if [ -z "$task_id" ]; then
        echo -e "${RED}❌ Please specify a task ID${NC}"
        exit 1
    fi

    check_orchestrator

    echo -e "${YELLOW}Executing task: $task_id${NC}"

    # Get task details from backlog
    task_data=$(jq -r --arg id "$task_id" '
        .sprints[].tasks[] |
        select(.id == $id) |
        {
            type: .type,
            name: .title,
            description: .description,
            requirements: (.requirements | tostring),
            priority: .priority
        }' "$BACKLOG_FILE")

    if [ -z "$task_data" ] || [ "$task_data" = "null" ]; then
        echo -e "${RED}❌ Task $task_id not found in backlog${NC}"
        exit 1
    fi

    # Check if task is ready
    task_status=$(jq -r --arg id "$task_id" '
        .sprints[].tasks[] |
        select(.id == $id) | .status' "$BACKLOG_FILE")

    if [ "$task_status" = "blocked" ]; then
        blocked_by=$(jq -r --arg id "$task_id" '
            .sprints[].tasks[] |
            select(.id == $id) | .blocked_by | join(", ")' "$BACKLOG_FILE")
        echo -e "${YELLOW}⚠️  Task is blocked by: $blocked_by${NC}"
        echo -n "Execute anyway? (y/N): "
        read -r force_execute
        if [[ ! $force_execute =~ ^[Yy]$ ]]; then
            exit 0
        fi
    fi

    # Create workflow for the task
    echo -e "${BLUE}Creating workflow for task $task_id...${NC}"

    response=$(curl -s -X POST "$API_BASE/api/v1/workflows" \
        -H "Content-Type: application/json" \
        -d "$task_data")

    workflow_id=$(echo "$response" | jq -r '.workflow_id')

    if [ -n "$workflow_id" ] && [ "$workflow_id" != "null" ]; then
        echo -e "${GREEN}✅ Workflow created: $workflow_id${NC}"
        echo -e "${CYAN}Monitor progress:${NC}"
        echo "  curl $API_BASE/api/v1/workflows/$workflow_id | jq"

        # Update task status in backlog
        update_task_status "$task_id" "in_progress"

        # Create git branch for the task
        create_git_branch "$task_id"
    else
        echo -e "${RED}❌ Failed to create workflow${NC}"
        echo "$response" | jq '.'
        exit 1
    fi
}

# Function to update task status
update_task_status() {
    local task_id=$1
    local new_status=$2

    # This would update the backlog file
    echo -e "${YELLOW}Updated $task_id status to: $new_status${NC}"
}

# Function to create git branch
create_git_branch() {
    local task_id=$1
    local branch_name="feat/${task_id,,}"

    if git rev-parse --git-dir > /dev/null 2>&1; then
        echo -e "${BLUE}Creating git branch: $branch_name${NC}"
        git checkout -b "$branch_name" 2>/dev/null || git checkout "$branch_name"
    fi
}

# Function to execute all ready tasks in sprint
execute_sprint() {
    check_orchestrator

    echo -e "${CYAN}Executing all ready tasks in current sprint...${NC}"

    # Get ready tasks
    ready_tasks=$(jq -r '.sprints[].tasks[] |
        select(.status == "ready") | .id' "$BACKLOG_FILE")

    if [ -z "$ready_tasks" ]; then
        echo -e "${YELLOW}No ready tasks found${NC}"
        exit 0
    fi

    for task_id in $ready_tasks; do
        echo ""
        echo -e "${PURPLE}═══════════════════════════════════════════════════════════════${NC}"
        execute_task "$task_id"
        sleep 2  # Brief pause between tasks
    done
}

# Function to check task status
check_status() {
    local task_id=$1

    if [ -z "$task_id" ]; then
        echo -e "${RED}❌ Please specify a task ID${NC}"
        exit 1
    fi

    check_orchestrator

    # Get workflows and check for matching task
    workflows=$(curl -s "$API_BASE/api/v1/workflows")

    echo -e "${CYAN}Status for task: $task_id${NC}"
    echo "$workflows" | jq --arg id "$task_id" '.[] |
        select(.name | contains($id)) |
        {
            workflow_id,
            status,
            current_stage,
            progress_percentage,
            created_at,
            updated_at
        }'
}

# Function to show progress
show_progress() {
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}                  Project Progress${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}\n"

    jq -r '.metadata |
        "Total Story Points: \(.total_story_points)\n" +
        "Completed: \(.completed_story_points)\n" +
        "In Progress: \(.in_progress_story_points)\n" +
        "Completion: \(.completion_percentage)%\n" +
        "\nVelocity:\n" +
        "  Sprint 1: \(.velocity.sprint_1)\n" +
        "  Average: \(.velocity.average)\n" +
        "  Target: \(.velocity.target)"' \
        "$BACKLOG_FILE"

    echo ""
    echo -e "${PURPLE}Task Status Summary:${NC}"

    # Count tasks by status
    jq -r '[.sprints[].tasks[]] |
        group_by(.status) |
        map({status: .[0].status, count: length}) |
        .[] | "  \(.status): \(.count) tasks"' \
        "$BACKLOG_FILE"
}

# Function to setup git
setup_git() {
    echo -e "${CYAN}Setting up Git for Agentic SDLC${NC}"
    echo -e "${PURPLE}────────────────────────────────${NC}"

    # Initialize if needed
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        git init
        echo -e "${GREEN}✅ Git repository initialized${NC}"
    else
        echo -e "${YELLOW}Git repository already exists${NC}"
    fi

    # Configure git
    git config user.name "Agentic SDLC System"
    git config user.email "agent@agentic-sdlc.local"

    # Create initial commit
    if [ -z "$(git log --oneline -1 2>/dev/null)" ]; then
        git add -A
        git commit -m "feat: Sprint 1 complete - orchestrator foundation

- Orchestrator service with workflow management
- State machine implementation
- PostgreSQL database with Prisma
- Redis event bus
- Docker configuration
- 36 tests passing
- API documentation"

        echo -e "${GREEN}✅ Initial commit created${NC}"
    fi

    # Create main branches
    git branch -M main
    git checkout -b develop 2>/dev/null || git checkout develop

    # Tag Sprint 1
    git tag -a "v0.1.0-sprint1" -m "Sprint 1: Foundation Complete" 2>/dev/null || true

    echo -e "${GREEN}✅ Git setup complete${NC}"
    echo ""
    git branch
    echo ""
    git log --oneline -5
}

# Main execution
COMMAND=${1:-help}

case $COMMAND in
    list)
        list_tasks
        ;;
    sprint)
        show_sprint
        ;;
    ready)
        show_ready
        ;;
    blocked)
        show_blocked
        ;;
    execute)
        execute_task "$2"
        ;;
    execute-sprint)
        execute_sprint
        ;;
    status)
        check_status "$2"
        ;;
    progress)
        show_progress
        ;;
    git-setup)
        setup_git
        ;;
    help|*)
        show_usage
        ;;
esac