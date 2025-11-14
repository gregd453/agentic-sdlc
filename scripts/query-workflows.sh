#!/bin/bash
# Workflow Database Query Helper
# Provides common queries for monitoring workflows, tasks, and traces

DB_CONTAINER="agentic-sdlc-postgres"
DB_USER="agentic"
DB_NAME="agentic_sdlc"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

function run_query() {
  docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c "$1"
}

function show_help() {
  echo -e "${BLUE}Workflow Database Query Helper${NC}"
  echo ""
  echo "Usage: $0 [command] [arguments]"
  echo ""
  echo "Commands:"
  echo "  list                     - List all workflows (recent first)"
  echo "  show <workflow_id>       - Show detailed workflow info"
  echo "  tasks <workflow_id>      - Show all tasks for a workflow"
  echo "  events <workflow_id>     - Show all events for a workflow"
  echo "  trace <trace_id>         - Find all workflows/tasks with trace_id"
  echo "  timeline <workflow_id>   - Show workflow timeline (creation → completion)"
  echo "  active                   - Show currently active workflows"
  echo "  failed                   - Show failed workflows"
  echo "  stats                    - Show workflow statistics"
  echo ""
}

case "$1" in
  list)
    echo -e "${GREEN}Recent Workflows (last 20)${NC}"
    run_query "
      SELECT
        id,
        name,
        type,
        status,
        current_stage,
        progress,
        trace_id,
        created_at,
        EXTRACT(EPOCH FROM (updated_at - created_at)) as duration_seconds
      FROM \"Workflow\"
      ORDER BY created_at DESC
      LIMIT 20;
    "
    ;;

  show)
    if [ -z "$2" ]; then
      echo "Usage: $0 show <workflow_id>"
      exit 1
    fi
    echo -e "${GREEN}Workflow Details: $2${NC}"
    run_query "
      SELECT
        id,
        name,
        type,
        status,
        current_stage,
        priority,
        progress,
        version,
        trace_id,
        current_span_id,
        created_at,
        updated_at,
        completed_at,
        created_by,
        stage_outputs
      FROM \"Workflow\"
      WHERE id = '$2';
    "
    ;;

  tasks)
    if [ -z "$2" ]; then
      echo "Usage: $0 tasks <workflow_id>"
      exit 1
    fi
    echo -e "${GREEN}Tasks for Workflow: $2${NC}"
    run_query "
      SELECT
        task_id,
        agent_type,
        status,
        priority,
        trace_id,
        span_id,
        parent_span_id,
        assigned_at,
        started_at,
        completed_at,
        retry_count,
        EXTRACT(EPOCH FROM (completed_at - assigned_at)) as duration_seconds
      FROM \"AgentTask\"
      WHERE workflow_id = '$2'
      ORDER BY assigned_at;
    "
    ;;

  events)
    if [ -z "$2" ]; then
      echo "Usage: $0 events <workflow_id>"
      exit 1
    fi
    echo -e "${GREEN}Events for Workflow: $2${NC}"
    run_query "
      SELECT
        id,
        event_type,
        trace_id,
        timestamp,
        payload
      FROM \"WorkflowEvent\"
      WHERE workflow_id = '$2'
      ORDER BY timestamp;
    "
    ;;

  trace)
    if [ -z "$2" ]; then
      echo "Usage: $0 trace <trace_id>"
      exit 1
    fi
    echo -e "${GREEN}Workflows with Trace ID: $2${NC}"
    run_query "
      SELECT
        id,
        name,
        status,
        current_stage,
        trace_id,
        created_at
      FROM \"Workflow\"
      WHERE trace_id = '$2';
    "
    echo ""
    echo -e "${GREEN}Tasks with Trace ID: $2${NC}"
    run_query "
      SELECT
        task_id,
        workflow_id,
        agent_type,
        status,
        trace_id,
        span_id,
        parent_span_id,
        assigned_at
      FROM \"AgentTask\"
      WHERE trace_id = '$2'
      ORDER BY assigned_at;
    "
    ;;

  timeline)
    if [ -z "$2" ]; then
      echo "Usage: $0 timeline <workflow_id>"
      exit 1
    fi
    echo -e "${GREEN}Workflow Timeline: $2${NC}"
    run_query "
      SELECT
        'Workflow Created' as event,
        created_at as timestamp,
        NULL as agent_type
      FROM \"Workflow\"
      WHERE id = '$2'

      UNION ALL

      SELECT
        'Task ' || status as event,
        assigned_at as timestamp,
        agent_type
      FROM \"AgentTask\"
      WHERE workflow_id = '$2'

      UNION ALL

      SELECT
        event_type as event,
        timestamp,
        NULL as agent_type
      FROM \"WorkflowEvent\"
      WHERE workflow_id = '$2'

      ORDER BY timestamp;
    "
    ;;

  active)
    echo -e "${GREEN}Active Workflows (initiated or running)${NC}"
    run_query "
      SELECT
        id,
        name,
        status,
        current_stage,
        progress,
        trace_id,
        created_at,
        EXTRACT(EPOCH FROM (NOW() - created_at)) as age_seconds
      FROM \"Workflow\"
      WHERE status IN ('initiated', 'running')
      ORDER BY created_at DESC;
    "
    ;;

  failed)
    echo -e "${YELLOW}Failed Workflows${NC}"
    run_query "
      SELECT
        id,
        name,
        current_stage,
        progress,
        trace_id,
        created_at,
        updated_at
      FROM \"Workflow\"
      WHERE status = 'failed'
      ORDER BY updated_at DESC
      LIMIT 20;
    "
    ;;

  stats)
    echo -e "${GREEN}Workflow Statistics${NC}"
    run_query "
      SELECT
        status,
        COUNT(*) as count,
        ROUND(AVG(progress), 2) as avg_progress,
        ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at))), 2) as avg_duration_seconds
      FROM \"Workflow\"
      GROUP BY status
      ORDER BY count DESC;
    "
    echo ""
    echo -e "${GREEN}Tasks by Agent Type${NC}"
    run_query "
      SELECT
        agent_type,
        status,
        COUNT(*) as count,
        ROUND(AVG(retry_count), 2) as avg_retries
      FROM \"AgentTask\"
      GROUP BY agent_type, status
      ORDER BY agent_type, status;
    "
    ;;

  *)
    show_help
    ;;
esac
