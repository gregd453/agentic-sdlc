# Agentic SDLC - Distributed Tracing Guide

**Version:** 1.0 | **Date:** 2025-11-13 | **Status:** Implementation Ready

## Overview

The Agentic SDLC system uses distributed tracing to correlate events across HTTP requests, workflows, tasks, and agent executions. This enables fast debugging, performance analysis, and end-to-end observability.

### Core Concepts

| Concept | Format | Purpose | Example |
|---------|--------|---------|---------|
| **trace_id** | UUID v4 (36 chars) | End-to-end correlation across all services | `550e8400-e29b-41d4-a716-446655440000` |
| **span_id** | 16-char hex | Per-operation tracking within a trace | `a1b2c3d4e5f6g7h8` |
| **parent_span_id** | 16-char hex | Hierarchical relationship between operations | `9ab3f1e27c8d4e6f` |
| **request_id** | UUID v4 (36 chars) | HTTP request correlation | `660e8400-e29b-41d4-a716-446655440001` |

### Propagation Flow

```
HTTP Request (x-trace-id header)
  ↓ [extract/generate]
Workflow Creation (trace_id persisted)
  ↓ [inherit trace_id, new span_id]
Task Envelope (trace_id + span_id + parent_span_id)
  ↓ [preserve trace_id]
Agent Execution (logs with trace context)
  ↓ [preserve trace_id, new span_id]
Result Envelope (trace_id + span_id + parent_span_id)
  ↓ [trace correlation]
State Machine Event (trace_id)
```

---

## Policies & Best Practices

### 1. ID Generation Policy

**DO:**
- ✅ Use `generateTraceId()` from `@agentic-sdlc/shared-utils` for new traces
- ✅ Use `generateSpanId()` for each new operation within a trace
- ✅ Use `crypto.randomUUID()` for all UUIDs (built-in, secure, fast)
- ✅ Accept trace_id from HTTP headers (`x-trace-id`) when present
- ✅ Return trace_id in HTTP response headers and body

**DON'T:**
- ❌ Create custom trace ID formats (use UUID only)
- ❌ Generate new trace_id for child operations (inherit from parent)
- ❌ Use timestamp-based IDs (not UUID-compliant)
- ❌ Hard-code trace IDs (always generate or extract)

### 2. Trace Propagation Policy

**DO:**
- ✅ Propagate trace_id from HTTP request → Workflow
- ✅ Propagate trace_id from Workflow → Task → Result
- ✅ Generate new span_id for each operation
- ✅ Set parent_span_id to link operations hierarchically
- ✅ Store trace_id in database (Workflow, AgentTask tables)
- ✅ Include trace_id in all message envelopes

**DON'T:**
- ❌ Break the trace chain (always propagate)
- ❌ Skip span_id generation (needed for hierarchy)
- ❌ Modify trace_id during propagation (preserve original)

### 3. Logging Policy

**DO:**
- ✅ Use child loggers with trace context: `logger.child({ trace_id, span_id, workflow_id })`
- ✅ Include trace_id in all structured logs
- ✅ Include span_id for operation-level tracking
- ✅ Use consistent field names: `trace_id`, `span_id`, `parent_span_id`, `workflow_id`, `task_id`
- ✅ Log at appropriate levels: INFO for milestones, DEBUG for details

**DON'T:**
- ❌ Manually add trace fields to every log (use child logger)
- ❌ Use inconsistent field names (trace-id vs trace_id)
- ❌ Log sensitive data (PII, secrets, credentials)
- ❌ Over-log (balance observability with performance)

### 4. Database Query Policy

**DO:**
- ✅ Query by trace_id to find all related entities
- ✅ Use indexed trace_id fields for fast queries
- ✅ Include ORDER BY for chronological ordering
- ✅ Filter NULL trace_ids when querying historical data

**Example:**
```sql
-- Find all tasks for a trace
SELECT * FROM "AgentTask"
WHERE trace_id = '550e8400-...'
ORDER BY assigned_at;

-- Find workflow for a trace
SELECT * FROM "Workflow"
WHERE trace_id = '550e8400-...';
```

### 5. Testing Policy

**DO:**
- ✅ Pass custom x-trace-id header in E2E tests
- ✅ Verify trace propagation in integration tests
- ✅ Assert trace_id persisted in database
- ✅ Check logs filtered by trace_id
- ✅ Validate span hierarchy (parent_span_id links)

**Example:**
```typescript
test('E2E trace propagation', async () => {
  const traceId = generateTraceId();

  const workflow = await createWorkflow({ traceId });
  const tasks = await getTasks(workflow.id);

  expect(workflow.trace_id).toBe(traceId);
  tasks.forEach(task => expect(task.trace_id).toBe(traceId));
});
```

---

## Patterns & Code Examples

### Pattern 1: HTTP Request with Trace

```typescript
// Client sends trace header
const response = await fetch('/api/v1/workflows', {
  headers: {
    'x-trace-id': generateTraceId(),
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ type: 'app', name: 'My App' })
});

// Server extracts and returns trace
const { trace_id } = await response.json();
console.log('Workflow trace:', trace_id);
```

### Pattern 2: Workflow Creation with Trace

```typescript
// WorkflowService.createWorkflow
async createWorkflow(
  request: CreateWorkflowRequest,
  requestTraceId?: string  // From HTTP context
): Promise<WorkflowResponse> {
  const trace_id = requestTraceId || generateTraceId();
  const span_id = generateSpanId();

  const workflow = await this.repository.create({
    ...request,
    trace_id,
    current_span_id: span_id
  });

  logger.info('Workflow created', { trace_id, span_id, workflow_id: workflow.id });

  return { workflow_id: workflow.id, trace_id };
}
```

### Pattern 3: Task Envelope with Trace

```typescript
// buildAgentEnvelope
private buildAgentEnvelope(workflow: Workflow, stage: string): TaskEnvelope {
  return {
    task_id: generateTaskId(),
    workflow_id: workflow.id,
    trace_id: workflow.trace_id,  // Inherit from workflow
    span_id: generateSpanId(),     // New span for this task
    parent_span_id: workflow.current_span_id,  // Link to parent
    workflow_context: { current_stage: stage },
    // ... rest of envelope
  };
}
```

### Pattern 4: Agent with Child Logger

```typescript
// BaseAgent.receiveTask
async receiveTask(message: AgentMessage): Promise<void> {
  // Create child logger with trace context
  this.taskLogger = this.logger.child({
    trace_id: message.trace_id,
    span_id: message.span_id,
    parent_span_id: message.parent_span_id,
    workflow_id: message.workflow_id,
    task_id: message.id
  });

  this.taskLogger.info('Task received');

  try {
    const result = await this.execute(task);
    await this.reportResult(result);
    this.taskLogger.info('Task completed');
  } catch (error) {
    this.taskLogger.error('Task failed', { error });
  } finally {
    this.taskLogger = undefined;  // Clean up
  }
}
```

### Pattern 5: Result with Trace

```typescript
// BaseAgent.reportResult
async reportResult(result: TaskResult): Promise<void> {
  const agentResult = {
    task_id: result.task_id,
    workflow_id: result.workflow_id,
    trace_id: this.currentTraceId,      // From task envelope
    span_id: generateSpanId(),          // New span for result
    parent_span_id: this.currentSpanId, // Link to task span
    success: result.status === 'success',
    result: result.output,
    timestamp: new Date().toISOString()
  };

  await this.messageBus.publish('orchestrator:results', agentResult);
}
```

### Pattern 6: Trace Debugging

```bash
# CLI tool
./scripts/debug-trace.sh 550e8400-e29b-41d4-a716-446655440000

# Manual database query
SELECT * FROM "Workflow" WHERE trace_id = '550e8400-...';
SELECT * FROM "AgentTask" WHERE trace_id = '550e8400-...' ORDER BY assigned_at;

# Log filtering
docker logs agentic-orchestrator-1 | jq "select(.trace_id == \"550e8400-...\")"
```

---

## Quick Reference

### Utilities

```typescript
import {
  generateTraceId,
  generateSpanId,
  createChildContext,
  extractTraceContext
} from '@agentic-sdlc/shared-utils';

// Generate new trace
const trace_id = generateTraceId();  // UUID v4

// Generate span for operation
const span_id = generateSpanId();    // 16-char hex

// Create child context
const parent = { trace_id, span_id };
const child = createChildContext(parent);
// child = { trace_id, span_id: new, parent_span_id: parent.span_id }
```

### HTTP Headers

| Header | Direction | Purpose |
|--------|-----------|---------|
| `x-trace-id` | Request & Response | End-to-end trace correlation |
| `x-span-id` | Response | Current operation span |
| `x-request-id` | Request & Response | HTTP request correlation |
| `x-correlation-id` | Request & Response | Cross-workflow correlation (optional) |

### Database Fields

```typescript
// Workflow table
{
  trace_id: string | null;         // Root trace for workflow
  current_span_id: string | null;  // Span of current operation
}

// AgentTask table
{
  trace_id: string | null;        // Inherited from workflow
  span_id: string | null;         // Span for this task
  parent_span_id: string | null;  // Link to parent span (workflow)
}
```

---

## Troubleshooting

| Issue | Diagnosis | Solution |
|-------|-----------|----------|
| **Trace not propagating** | Check logs for trace_id field | Verify child logger creation, check envelope building |
| **Database query slow** | Check if trace_id indexed | Run `CREATE INDEX IF NOT EXISTS "Workflow_trace_id_idx" ON "Workflow"("trace_id");` |
| **Logs missing trace_id** | Check logger configuration | Use `logger.child({ trace_id })` instead of manual fields |
| **Span hierarchy broken** | Check parent_span_id values | Ensure parent_span_id set when creating child context |
| **Duplicate traces** | Multiple trace_id values | Verify trace_id inherited, not regenerated |

---

## Migration Checklist

When implementing tracing in new services:

- [ ] Add `@agentic-sdlc/shared-utils` dependency
- [ ] Import trace utilities (`generateTraceId`, `generateSpanId`)
- [ ] Update database schema (add trace_id fields + indexes)
- [ ] Update service to accept requestTraceId parameter
- [ ] Propagate trace_id in message envelopes
- [ ] Use child loggers with trace context
- [ ] Include trace_id in result envelopes
- [ ] Add E2E tests with x-trace-id header
- [ ] Document trace flow in service README

---

**For full implementation details, see:** `EPCC_PLAN.md`
**For debugging workflows, see:** `AGENTIC_SDLC_RUNBOOK.md`
**For architectural decisions, see:** `docs/TRACEABILITY_ADR.md`
