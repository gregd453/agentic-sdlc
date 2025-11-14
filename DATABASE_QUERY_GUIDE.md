# Database Query Guide - Workflow Monitoring

**Quick Reference:** Use `./scripts/query-workflows.sh` for common queries

---

## Quick Start

```bash
# List recent workflows
./scripts/query-workflows.sh list

# Show detailed workflow info
./scripts/query-workflows.sh show <workflow_id>

# Show all tasks for a workflow
./scripts/query-workflows.sh tasks <workflow_id>

# Find workflows/tasks by trace ID
./scripts/query-workflows.sh trace <trace_id>

# Show workflow timeline
./scripts/query-workflows.sh timeline <workflow_id>

# Show active workflows
./scripts/query-workflows.sh active

# Show failed workflows
./scripts/query-workflows.sh failed

# Show statistics
./scripts/query-workflows.sh stats
```

---

## Database Tables

### 1. Workflow Table
Stores workflow state, progress, and trace information.

**Key Fields:**
- `id` - Workflow UUID
- `name` - Human-readable name
- `status` - initiated, running, completed, failed, cancelled, paused
- `current_stage` - initialization, validation, e2e, integration, deployment
- `progress` - 0-100 percentage
- `trace_id` - Distributed trace ID (UUID v4) ✨
- `current_span_id` - Current operation span (16-char hex) ✨
- `stage_outputs` - JSONB with results from completed stages
- `created_at`, `updated_at`, `completed_at` - Timestamps

### 2. AgentTask Table
Stores tasks assigned to agents.

**Key Fields:**
- `task_id` - Task UUID
- `workflow_id` - Parent workflow ID
- `agent_type` - scaffold, validation, e2e, integration, deployment
- `status` - pending, assigned, running, completed, failed, cancelled
- `trace_id` - Inherited from workflow ✨
- `span_id` - Task operation span ✨
- `parent_span_id` - Links to workflow span ✨
- `payload` - JSONB with task envelope
- `result` - JSONB with task result
- `assigned_at`, `started_at`, `completed_at` - Timestamps
- `retry_count` - Number of retries

### 3. WorkflowEvent Table
Stores workflow lifecycle events.

**Key Fields:**
- `workflow_id` - Parent workflow
- `event_type` - WORKFLOW_CREATED, STAGE_COMPLETED, etc.
- `trace_id` - Trace correlation
- `payload` - Event data
- `timestamp` - When event occurred

### 4. WorkflowStage Table
Stores individual stage status.

**Key Fields:**
- `workflow_id` - Parent workflow
- `name` - Stage name
- `status` - pending, running, completed, failed, skipped
- `started_at`, `completed_at` - Stage timing
- `agent_id` - Agent that executed the stage
- `retry_count` - Stage retry attempts

---

## Common Queries

### Find Workflow by ID
```sql
SELECT * FROM "Workflow" WHERE id = '<workflow_id>';
```

### Find All Workflows with Trace ID
```sql
SELECT id, name, status, current_stage, trace_id, created_at
FROM "Workflow"
WHERE trace_id = '<trace_id>'
ORDER BY created_at;
```

### Find All Tasks for Trace ID
```sql
SELECT
  task_id,
  workflow_id,
  agent_type,
  status,
  trace_id,
  span_id,
  parent_span_id,
  assigned_at,
  completed_at
FROM "AgentTask"
WHERE trace_id = '<trace_id>'
ORDER BY assigned_at;
```

### Show Workflow Timeline
```sql
SELECT
  event_type,
  timestamp,
  payload
FROM "WorkflowEvent"
WHERE workflow_id = '<workflow_id>'
ORDER BY timestamp;
```

### Find Stuck Workflows (Running >30 min)
```sql
SELECT
  id,
  name,
  status,
  current_stage,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at)) / 60 as age_minutes
FROM "Workflow"
WHERE status IN ('initiated', 'running')
  AND created_at < NOW() - INTERVAL '30 minutes'
ORDER BY created_at;
```

### Find Workflows by Name Pattern
```sql
SELECT id, name, status, created_at
FROM "Workflow"
WHERE name ILIKE '%hello%'
ORDER BY created_at DESC
LIMIT 10;
```

### Calculate Workflow Duration
```sql
SELECT
  id,
  name,
  status,
  EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - created_at)) as duration_seconds,
  created_at,
  completed_at
FROM "Workflow"
WHERE id = '<workflow_id>';
```

### Find Failed Tasks with Details
```sql
SELECT
  t.task_id,
  t.workflow_id,
  w.name as workflow_name,
  t.agent_type,
  t.status,
  t.retry_count,
  t.result,
  t.completed_at
FROM "AgentTask" t
JOIN "Workflow" w ON t.workflow_id = w.id
WHERE t.status = 'failed'
ORDER BY t.completed_at DESC
LIMIT 20;
```

### Show Workflow Progress Details
```sql
SELECT
  w.id,
  w.name,
  w.status,
  w.current_stage,
  w.progress,
  COUNT(t.task_id) as total_tasks,
  SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
  SUM(CASE WHEN t.status = 'failed' THEN 1 ELSE 0 END) as failed_tasks
FROM "Workflow" w
LEFT JOIN "AgentTask" t ON w.id = t.workflow_id
WHERE w.id = '<workflow_id>'
GROUP BY w.id, w.name, w.status, w.current_stage, w.progress;
```

### Agent Performance by Type
```sql
SELECT
  agent_type,
  COUNT(*) as total_tasks,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
  ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - assigned_at))), 2) as avg_duration_seconds,
  ROUND(AVG(retry_count), 2) as avg_retries
FROM "AgentTask"
WHERE completed_at IS NOT NULL
GROUP BY agent_type
ORDER BY agent_type;
```

### Find Workflows Created Today
```sql
SELECT
  id,
  name,
  status,
  current_stage,
  progress,
  trace_id,
  created_at
FROM "Workflow"
WHERE created_at >= CURRENT_DATE
ORDER BY created_at DESC;
```

### Trace Hierarchy (Parent-Child Spans)
```sql
-- Show full trace hierarchy
WITH RECURSIVE trace_tree AS (
  -- Start with workflow (root span)
  SELECT
    w.id as entity_id,
    'Workflow' as entity_type,
    w.trace_id,
    w.current_span_id as span_id,
    NULL::text as parent_span_id,
    0 as level,
    w.created_at as timestamp
  FROM "Workflow" w
  WHERE w.trace_id = '<trace_id>'

  UNION ALL

  -- Add tasks (child spans)
  SELECT
    t.task_id as entity_id,
    'Task' as entity_type,
    t.trace_id,
    t.span_id,
    t.parent_span_id,
    1 as level,
    t.assigned_at as timestamp
  FROM "AgentTask" t
  WHERE t.trace_id = '<trace_id>'
)
SELECT
  entity_type,
  entity_id,
  span_id,
  parent_span_id,
  level,
  timestamp
FROM trace_tree
ORDER BY level, timestamp;
```

---

## Direct Database Access

### Connect to Database
```bash
# Using Docker
docker exec -it agentic-sdlc-postgres psql -U agentic -d agentic_sdlc

# From host machine (if exposed)
psql -h localhost -p 5433 -U agentic -d agentic_sdlc
```

### Useful psql Commands
```sql
\dt                    -- List all tables
\d+ "Workflow"         -- Describe Workflow table structure
\d+ "AgentTask"        -- Describe AgentTask table structure
\x                     -- Toggle expanded display (good for wide rows)
\timing                -- Show query execution time
\q                     -- Quit psql
```

---

## Monitoring Tips

### 1. Real-Time Monitoring
```bash
# Watch active workflows (refreshes every 2 seconds)
watch -n 2 './scripts/query-workflows.sh active'
```

### 2. Trace Debugging
When debugging an issue:
1. Get trace_id from logs or HTTP response
2. Query all workflows with that trace: `./scripts/query-workflows.sh trace <trace_id>`
3. Check task details: `./scripts/query-workflows.sh tasks <workflow_id>`
4. Review timeline: `./scripts/query-workflows.sh timeline <workflow_id>`
5. Filter logs by trace_id: `grep <trace_id> scripts/logs/orchestrator.log`

### 3. Performance Analysis
```sql
-- Find slow workflows
SELECT
  id,
  name,
  EXTRACT(EPOCH FROM (completed_at - created_at)) as duration_seconds
FROM "Workflow"
WHERE status = 'completed'
  AND completed_at IS NOT NULL
ORDER BY duration_seconds DESC
LIMIT 10;

-- Find slow tasks
SELECT
  task_id,
  workflow_id,
  agent_type,
  EXTRACT(EPOCH FROM (completed_at - assigned_at)) as duration_seconds
FROM "AgentTask"
WHERE completed_at IS NOT NULL
ORDER BY duration_seconds DESC
LIMIT 10;
```

### 4. Health Checks
```sql
-- Check for workflows stuck in initiated
SELECT COUNT(*)
FROM "Workflow"
WHERE status = 'initiated'
  AND created_at < NOW() - INTERVAL '1 hour';

-- Check for tasks with high retry counts
SELECT task_id, workflow_id, agent_type, retry_count, status
FROM "AgentTask"
WHERE retry_count > 3
ORDER BY retry_count DESC;
```

---

## JSON Field Queries

### Query Stage Outputs
```sql
-- Get specific stage output
SELECT
  id,
  name,
  stage_outputs->'scaffolding' as scaffolding_output
FROM "Workflow"
WHERE id = '<workflow_id>';

-- Check if stage has output
SELECT id, name
FROM "Workflow"
WHERE stage_outputs ? 'validation';
```

### Query Task Payload
```sql
-- Extract specific field from task payload
SELECT
  task_id,
  agent_type,
  payload->'name' as project_name,
  payload->'requirements' as requirements
FROM "AgentTask"
WHERE workflow_id = '<workflow_id>';
```

---

## Cleanup Queries

### Delete Old Workflows (use with caution!)
```sql
-- Delete workflows older than 30 days
DELETE FROM "Workflow"
WHERE created_at < NOW() - INTERVAL '30 days'
  AND status IN ('completed', 'failed', 'cancelled');
```

### Archive Completed Workflows
```sql
-- Create archive table (run once)
CREATE TABLE "WorkflowArchive" AS
SELECT * FROM "Workflow"
WHERE 1=0;  -- Copy structure only

-- Move old completed workflows to archive
BEGIN;
INSERT INTO "WorkflowArchive"
SELECT * FROM "Workflow"
WHERE status = 'completed'
  AND completed_at < NOW() - INTERVAL '90 days';

DELETE FROM "Workflow"
WHERE status = 'completed'
  AND completed_at < NOW() - INTERVAL '90 days';
COMMIT;
```

---

## Example Workflows

### Investigate Failed Workflow
```bash
# 1. Find recent failures
./scripts/query-workflows.sh failed

# 2. Get detailed info
./scripts/query-workflows.sh show <workflow_id>

# 3. Check tasks
./scripts/query-workflows.sh tasks <workflow_id>

# 4. Review timeline
./scripts/query-workflows.sh timeline <workflow_id>

# 5. Check logs
grep <workflow_id> scripts/logs/orchestrator.log | tail -50
```

### Track End-to-End Trace
```bash
# 1. Create workflow with custom trace
TRACE_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
curl -X POST http://localhost:3000/api/v1/workflows \
  -H "x-trace-id: $TRACE_ID" \
  -H "Content-Type: application/json" \
  -d '{"type":"app","name":"Test","...}'

# 2. Query all entities with trace
./scripts/query-workflows.sh trace $TRACE_ID

# 3. Filter logs by trace
grep $TRACE_ID scripts/logs/orchestrator.log
grep $TRACE_ID scripts/logs/scaffold-agent.log
```

---

## Related Documentation

- **Distributed Tracing Guide:** `agentic-sdlc-tracing.md`
- **Implementation Review:** `TRACE_IMPLEMENTATION_REVIEW.md`
- **E2E Test Results:** `TRACE_E2E_TEST_RESULTS.md`
- **Database Schema:** `packages/orchestrator/prisma/schema.prisma`

---

**Last Updated:** 2025-11-13 (Session #60)
