# Product Owner Agent - Output Storage

## Where Requirements Are Stored

The Product Owner Agent generates requirements and stores them in **multiple locations** for different purposes:

### 1. **PostgreSQL Database (Primary Storage)** ✅

**Table:** `AgentTask`
**Location:** PostgreSQL database (`agentic_sdlc` database on port 5433)

```sql
-- Schema (from packages/orchestrator/prisma/schema.prisma)
model AgentTask {
  id              String          @id @default(uuid())
  task_id         String          @unique
  workflow_id     String
  agent_type      AgentType
  status          TaskStatus
  priority        Priority
  payload         Json            -- Input parameters
  result          Json?           -- ⭐ REQUIREMENTS STORED HERE

  trace_id        String?
  span_id         String?
  parent_span_id  String?

  assigned_at     DateTime        @default(now())
  started_at      DateTime?
  completed_at    DateTime?
  retry_count     Int             @default(0)
  max_retries     Int             @default(3)
  timeout_ms      Int             @default(300000)

  workflow        Workflow        @relation(fields: [workflow_id], references: [id])
}
```

**Result Structure (JSON):**
```json
{
  "data": {
    "requirements": {
      "application": {
        "name": "E-Commerce Application",
        "description": "Online marketplace for handmade crafts",
        "type": "e-commerce",
        "industry": "Retail",
        "target_users": ["Buyers", "Sellers", "Administrators"]
      },
      "domains": [
        {
          "name": "Product Catalog",
          "bounded_context": "CatalogContext",
          "capabilities": [...],
          "entities": ["Product", "Category", "Inventory"],
          "value_objects": ["Price", "SKU"],
          "aggregates": ["ProductAggregate"]
        }
      ],
      "non_functional_requirements": {...},
      "technical_constraints": [...],
      "assumptions": [...],
      "risks": [...],
      "success_metrics": [...],
      "mvp_scope": {
        "included_features": [...],
        "excluded_features": [...],
        "timeline": "3 months"
      }
    },
    "metadata": {
      "generated_at": "2025-11-21T18:30:00Z",
      "generator": "product-owner-agent",
      "version": "1.0.0",
      "model_used": "claude-haiku-4-5"
    },
    "statistics": {
      "domains_count": 5,
      "total_capabilities": 12,
      "total_features": 45,
      "mvp_features": 15
    }
  },
  "metrics": {
    "duration_ms": 5420
  }
}
```

**Query to Retrieve Requirements:**
```sql
-- Get requirements for a specific task
SELECT
  task_id,
  workflow_id,
  agent_type,
  status,
  result,
  completed_at
FROM "AgentTask"
WHERE agent_type = 'product-owner'
  AND status = 'completed'
ORDER BY completed_at DESC;

-- Get requirements for a specific workflow
SELECT result
FROM "AgentTask"
WHERE workflow_id = 'your-workflow-id'
  AND agent_type = 'product-owner';
```

### 2. **Redis Streams (Real-Time Events)** 📡

**Channel:** `orchestrator:results`
**Stream:** `stream:orchestrator:results`
**Purpose:** Real-time event propagation to orchestrator and downstream agents

The result is published via Redis for immediate processing:
```typescript
await this.messageBus.publish(
  'orchestrator:results',
  resultWithMetadata,
  {
    key: workflow_id,
    mirrorToStream: 'stream:orchestrator:results'
  }
);
```

**Message Format:**
```json
{
  "task_id": "uuid",
  "workflow_id": "uuid",
  "agent_id": "product-owner-abc123",
  "agent_type": "product-owner",
  "success": true,
  "status": "success",
  "action": "execute_product-owner",
  "result": {
    "data": {
      "requirements": {...},
      "metadata": {...},
      "statistics": {...}
    },
    "metrics": {...}
  },
  "metrics": {...},
  "timestamp": "2025-11-21T18:30:00Z",
  "version": "2.0.0",
  "stage": "requirements-generation"
}
```

### 3. **Workflow Context (Next Stages)** 🔄

**Purpose:** Requirements are passed to subsequent workflow stages via `workflow_context`

When the next agent in the workflow executes, it receives:
```typescript
{
  workflow_context: {
    current_stage: "architecture-design",
    previous_stages: [
      {
        stage: "requirements-generation",
        agent_type: "product-owner",
        status: "completed",
        result: {
          // Full requirements object available here
        }
      }
    ],
    workflow_id: "uuid",
    trace_id: "trace_uuid"
  }
}
```

### 4. **Distributed Tracing (Observability)** 🔍

**Tables:**
- `WorkflowEvent` - High-level workflow events
- `AgentTask.trace_id` - Links tasks to distributed traces

**Fields:**
```typescript
{
  trace_id: "trace_abc123",     // Links all related tasks
  span_id: "span_456",           // Unique span for this task
  parent_span_id: "span_789"     // Parent task reference
}
```

## How to Access Requirements

### Via API (Dashboard/Frontend)

```typescript
// GET /api/v1/workflows/:workflowId/tasks
const response = await fetch(
  `http://localhost:3051/api/v1/workflows/${workflowId}/tasks`
);
const tasks = await response.json();

// Find product-owner task
const requirementsTask = tasks.find(t => t.agent_type === 'product-owner');
const requirements = requirementsTask.result.data.requirements;
```

### Via Database Query

```bash
# Using psql
psql -h localhost -p 5433 -U agentic -d agentic_sdlc

# Query
SELECT
  t.task_id,
  t.workflow_id,
  w.name as workflow_name,
  t.result->'data'->'requirements' as requirements,
  t.result->'data'->'statistics' as statistics,
  t.completed_at
FROM "AgentTask" t
JOIN "Workflow" w ON t.workflow_id = w.id
WHERE t.agent_type = 'product-owner'
  AND t.status = 'completed'
ORDER BY t.completed_at DESC
LIMIT 10;
```

### Via Dashboard UI

1. **Workflows Page** → Select workflow → View tasks
2. **Task Details Modal** → Shows full result JSON
3. **Trace Viewer** → Navigate workflow execution graph

### Programmatically (TypeScript)

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get latest requirements
const task = await prisma.agentTask.findFirst({
  where: {
    agent_type: 'product-owner',
    status: 'completed'
  },
  orderBy: {
    completed_at: 'desc'
  },
  include: {
    workflow: true
  }
});

const requirements = task.result.data.requirements;
console.log('Domains:', requirements.domains);
console.log('MVP Scope:', requirements.mvp_scope);
```

## Data Retention

- **PostgreSQL:** Permanent storage (until manually deleted)
- **Redis Streams:** Retained based on Redis config (default: no expiration for streams)
- **Redis Pub/Sub:** Transient (disappears after consumption)

## Next Agent Access

The requirements are automatically available to the next agent in the workflow:

```typescript
// Example: Architecture Agent receives requirements
async execute(task: AgentEnvelope): Promise<TaskResult> {
  // Access previous stage results
  const requirementsStage = task.workflow_context.previous_stages.find(
    s => s.agent_type === 'product-owner'
  );

  const requirements = requirementsStage.result.data.requirements;

  // Use requirements to design architecture
  const architecture = await this.designArchitecture(requirements);

  return {
    // ... return architecture result
  };
}
```

## Storage Flow Diagram

```
Product Owner Agent
        ↓
  [Generate Requirements]
        ↓
  [Build TaskResult]
        ↓
  BaseAgent.reportResult()
        ↓
        ├──→ Redis Pub/Sub: 'orchestrator:results' (real-time)
        ↓
  State Machine Receives Result
        ↓
        ├──→ PostgreSQL: Update AgentTask.result (persistent)
        ├──→ PostgreSQL: Create WorkflowEvent (audit trail)
        └──→ Next Agent: Include in workflow_context (propagation)
```

## Summary

✅ **Primary Storage:** PostgreSQL `AgentTask.result` column (JSON)
✅ **Real-Time Events:** Redis `orchestrator:results` channel
✅ **Next Stages:** Automatically included in `workflow_context`
✅ **Observability:** Linked via `trace_id` for distributed tracing
✅ **Access Methods:** API, Database, Dashboard UI, Programmatic

The requirements are **permanently stored** in PostgreSQL and **automatically propagated** to downstream agents in the workflow!
