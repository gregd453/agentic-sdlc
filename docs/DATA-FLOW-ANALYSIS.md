# Data Flow Analysis: Status, Stage, and Progress Fields
**Date:** 2025-11-17 | **Status:** Diagnostic Complete | **Severity:** CRITICAL

---

## EXECUTIVE SUMMARY

Three critical discrepancies found in how workflow **status**, **current_stage**, and **progress** flow through the system:

| Issue | Severity | Impact | Root Cause |
|-------|----------|--------|------------|
| **Progress always shows 0% for running workflows** | CRITICAL | Dashboard unusable for tracking progress | Progress field never updated after workflow creation |
| **Progress calculation disconnected from API** | CRITICAL | Dashboard shows stale data | Sophisticated calculation in AdaptiveProgressCalculator not integrated with REST API |
| **Progress should reflect agent completion rate** | CRITICAL | Wrong metric entirely | Current system: stored Int (0-100). Required: (completed_tasks / total_tasks) * 100 |
| **Status/Stage may be stale due to async state machine** | HIGH | Dashboard shows outdated workflow state | State machine updates not awaited by API |

---

## PART 1: DATA FLOW MAPPING

### Current Data Flow (As Implemented)

```
┌─────────────────┐
│   Client App    │
└────────┬────────┘
         │ HTTP GET /api/v1/workflows/:id
         ▼
┌─────────────────────────────────────────────┐
│  Orchestrator API (WorkflowService)          │
│  - getWorkflow(id)                          │
│  - Calls repository.findById(id)            │
│  - Maps DB fields to API response           │
└────────┬────────────────────────────────────┘
         │ Maps: workflow.progress → progress_percentage
         ▼
┌─────────────────────────────────────────────┐
│  Prisma ORM (WorkflowRepository)             │
│  - findUnique({ where: {id} })              │
│  - Includes: stages, tasks, events          │
└────────┬────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│  PostgreSQL Database                        │
│  - SELECT * FROM "Workflow"                 │
│  - progress = 0 (never updated)             │
│  - current_stage = "initialization"         │
│  - status = "initiated" → "running"         │
└─────────────────────────────────────────────┘
```

**Key Issue:** Progress field stuck at 0 because state machine only updates `current_stage` and `status`, not `progress`.

### Desired Data Flow (Agent-Based Progress)

```
┌─────────────────────────────────────────────┐
│  Workflow State                             │
│  - 5 total tasks (agents) needed            │
│  - 2 tasks completed                        │
│  - 3 tasks pending/running                  │
└────────┬────────────────────────────────────┘
         │ Calculate: (2/5) * 100 = 40%
         ▼
┌──────────────────────────────────────┐
│  REAL-TIME CALCULATION               │
│  SELECT COUNT(*) FROM AgentTask      │
│  WHERE workflow_id = ? AND status = 'completed'
│  + COUNT(*) total                    │
│  → Progress = completed / total * 100
└────────┬───────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│  API Response includes:                     │
│  - progress_percentage: 40                  │
│  - progress_calculation_method: "agent-based"
│  - agents_completed: 2                      │
│  - agents_total: 5                          │
└────────┬────────────────────────────────────┘
         │ HTTP Response
         ▼
┌─────────────────────────────────────────────┐
│  Dashboard Client                           │
│  - Displays 40% progress bar                │
│  - Shows "2 of 5 agents complete"           │
└─────────────────────────────────────────────┘
```

---

## PART 2: DETAILED DISCREPANCIES

### Discrepancy #1: Progress Field Never Updated

**Location:** `packages/orchestrator/prisma/schema.prisma:22`

```prisma
model Workflow {
  progress         Int              @default(0)
  // ↑ Initialized to 0, never updated
}
```

**Problem:**
1. Workflow created with `progress = 0`
2. State machine transitions stages (updates `current_stage`, `status`)
3. Progress field remains 0 throughout workflow execution
4. API returns `progress_percentage: 0` even for 80% complete workflows

**Evidence:**
```
Database State:
  id: "e460a00f-1c86-4de0-9a52-92ae4b46ab10"
  status: "running"
  current_stage: "validation"
  progress: 0  ← PROBLEM: Still 0 despite being in middle of workflow

API Response:
  "progress_percentage": 0  ← Dashboard shows 0%
```

**Impact:** Dashboard progress bars broken; users can't track workflow completion.

---

### Discrepancy #2: Progress Calculation Disconnected from API

**Calculation Engine Location:** `packages/orchestrator/src/services/workflow-definition-adapter.service.ts`

```typescript
// Lines 39-143: Definition-driven progress calculation
async getProgressWithFallback(context) {
  try {
    // Uses weighted stage progression from platform definition
    const calculation = await this.workflowEngine.calculateProgress(
      context.platform_id,
      context.workflow_type,
      context.current_stage
    );
    return calculation.progress_percentage;  // e.g., 45% for "validation" stage
  } catch (error) {
    // Fallback to linear: (currentIndex + 1) / totalStages * 100
    const stages = await this.getStagesLegacy(context.workflow_type);
    return (2/7) * 100 = 28.57%;
  }
}
```

**Problem:**
- This sophisticated calculation EXISTS but is NOT called by the API layer
- API calls `WorkflowService.getWorkflow()` which returns DB value only
- The calculation is isolated in its own service, never integrated

**Evidence:**
```
Database: progress = 0
API should call: WorkflowService.getProgressFromDefinition(workflow)
API actually calls: return database.progress  // ← Wrong!
```

**Impact:** System has two progress systems:
1. Database storage (0) - used by API ✗
2. Definition-based calculation - available but unused ✓

---

### Discrepancy #3: Wrong Progress Metric Entirely

**Current Approach:** Stored integer in database (0-100)

```typescript
// workflow.progress = 0 (stored statically)
// API returns: progress_percentage = 0
// Calculation basis: NONE (just database value)
```

**Correct Approach (Per Requirements):** Agent completion rate

```typescript
// Query: SELECT COUNT(*) FROM AgentTask
// WHERE workflow_id = ? AND status = 'completed'
// Result: 2 tasks completed out of 5 total
// Calculation: (2/5) * 100 = 40%
// Updated in real-time as agents complete tasks
```

**Schema Relations Available:**
```prisma
model Workflow {
  tasks  AgentTask[]  // ← All tasks (agents) for this workflow
}

model AgentTask {
  workflow_id  String
  status       TaskStatus  // pending, assigned, running, completed, failed
  completed_at DateTime?
}
```

**Evidence - Database Has Required Data:**
```sql
-- Query that should calculate progress
SELECT
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
  COUNT(*) as total_tasks,
  ROUND(
    COUNT(CASE WHEN status = 'completed' THEN 1 END)::numeric / COUNT(*) * 100, 0
  ) as progress_percentage
FROM agent_task
WHERE workflow_id = 'e460a00f-1c86-4de0-9a52-92ae4b46ab10';

-- Example Result:
-- completed_tasks: 2
-- total_tasks: 5
-- progress_percentage: 40
```

**Impact:** Progress metric is completely wrong; doesn't reflect actual workflow progress.

---

### Discrepancy #4: Status and Stage May Be Stale

**Location:** `packages/orchestrator/src/state-machine/workflow-state-machine.ts`

**Problem:**
```typescript
// State machine updates happen asynchronously
await stateMachine.send({ type: 'START' });
// ↓ State machine processes independently
// ↓ Database gets updated
// ↓ But API doesn't wait for update

return workflow;  // ← May have old status/stage!
```

**Evidence:**
- State machine runs in background (async)
- API queries database immediately
- No cache invalidation between state machine and API layer
- Potential race condition: API returns stale `status` or `current_stage`

**Impact:** Dashboard may briefly show outdated workflow state.

---

## PART 3: DASHBOARD FIELD REQUIREMENTS

### Pages Showing Status/Stage/Progress

| Page | status | current_stage | progress | Required Fields |
|------|--------|---------------|----------|-----------------|
| Dashboard | ✓ | ✓ | ✗ | Active workflows table |
| Workflows List | ✓ | ✓ | ✗ | Filterable list with progress bar |
| Workflow Details | ✓ | ✓ | ✗ | Full details + stage timeline |
| Traces | - | - | - | - |
| Agents | - | - | - | - |

### Expected Progress Format

```typescript
// Dashboard client expects (from packages/dashboard/src/api/client.ts:48-56)
const workflow = {
  id: "e460a00f-1c86...",
  name: "Test Workflow",
  status: "running",           // ✓ OK: from DB
  current_stage: "validation", // ✓ OK: from DB
  progress: 40,                // ✗ BROKEN: should be 40, is 0
  progress_percentage: 40,     // ✗ BROKEN: should be 40, is 0
  agents_completed: 2,         // ✗ MISSING: not in API response
  agents_total: 5,             // ✗ MISSING: not in API response
};
```

---

## PART 4: ROOT CAUSE ANALYSIS

### Why Progress is Broken (The Complete Chain)

1. **Workflow Created**
   ```typescript
   WorkflowService.createWorkflow({
     name: "Test Workflow",
     type: "app"
   })
   // Creates with: status = "initiated", progress = 0
   ```

2. **State Machine Starts**
   ```typescript
   await stateMachine.initialize(workflow);
   await stateMachine.send({ type: 'START' });
   // Updates: status → "running", current_stage → "initialization"
   // Does NOT update: progress (remains 0)
   ```

3. **Stage Completes**
   ```typescript
   await stateMachine.send({ type: 'STAGE_COMPLETE' });
   // Updates: current_stage → "scaffolding"
   // Does NOT update: progress (remains 0)
   ```

4. **API Query**
   ```typescript
   WorkflowService.getWorkflow(id) {
     const workflow = await repository.findById(id);
     return {
       progress_percentage: workflow.progress  // ← 0 from DB!
     };
   }
   ```

5. **Dashboard Display**
   ```
   Progress Bar: ▯░░░░░░░░░ 0%  ← Completely wrong!
   ```

### Why Agent-Based Calculation Not in API

The `WorkflowDefinitionAdapterService` has sophisticated logic, but:

1. It's a separate service not integrated into WorkflowService
2. API layer doesn't call it
3. It's only used internally by state machine (if at all)
4. No REST endpoint exposes this calculation

**Result:** Dashboard can't access calculated progress; gets 0% instead.

---

## PART 5: COMPREHENSIVE REMEDIATION DESIGN

### Solution Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  NEW: Real-Time Agent-Based Progress Calculation Layer      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ProgressCalculationService {                               │
│    calculateWorkflowProgress(workflowId): Promise<{         │
│      progress_percentage: number;                           │
│      agents_completed: number;                              │
│      agents_total: number;                                  │
│      calculation_method: 'agent-based';                     │
│      last_updated_at: DateTime;                             │
│    }>                                                        │
│                                                              │
│    Query: SELECT COUNT FROM AgentTask                       │
│    WHERE workflow_id = ? AND status = 'completed'           │
│    Formula: (completed / total) * 100                       │
│  }                                                           │
│                                                              │
└────────┬──────────────────────────────────────────────────┘
         │ Called by
         ▼
┌─────────────────────────────────────────────────────────────┐
│  UPDATED: WorkflowService.getWorkflow(id)                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  return {                                                   │
│    ...workflow,                                             │
│    progress_percentage: await progressService.calculate()   │
│    agents_completed: ...,                                   │
│    agents_total: ...,                                       │
│  }                                                           │
│                                                              │
└────────┬──────────────────────────────────────────────────┘
         │ HTTP Response
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Dashboard Client (Unchanged)                               │
│  - Receives progress_percentage: 40                         │
│  - Displays 40% progress bar ✓                              │
│  - Shows "2 of 5 agents complete" ✓                         │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Phases

#### Phase 1: Create Progress Calculation Service (4-6 hours)

**Files to Create:**
- `packages/orchestrator/src/services/progress-calculator.service.ts`

**Files to Modify:**
- `packages/orchestrator/src/services/workflow.service.ts` - Integrate progress calculation
- `packages/orchestrator/src/types/index.ts` - Add response fields

**Code Skeleton:**

```typescript
// NEW: ProgressCalculatorService
export class ProgressCalculatorService {
  constructor(private repository: WorkflowRepository) {}

  async calculateProgress(workflowId: string): Promise<{
    progress_percentage: number;
    agents_completed: number;
    agents_total: number;
    calculation_method: 'agent-based';
  }> {
    const tasks = await this.repository.getWorkflowTasks(workflowId);
    const completed = tasks.filter(t => t.status === 'completed').length;
    const total = tasks.length;

    return {
      progress_percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      agents_completed: completed,
      agents_total: total,
      calculation_method: 'agent-based'
    };
  }
}

// MODIFY: WorkflowService.getWorkflow()
async getWorkflow(id: string) {
  const workflow = await this.repository.findById(id);
  const progress = await this.progressCalculator.calculateProgress(id);

  return {
    workflow_id: workflow.id,
    name: workflow.name,
    status: workflow.status,
    current_stage: workflow.current_stage,
    progress_percentage: progress.progress_percentage,    // NEW
    agents_completed: progress.agents_completed,          // NEW
    agents_total: progress.agents_total,                  // NEW
    // ... rest of fields
  };
}
```

**Database Query:**
```sql
-- Direct SQL (or Prisma equivalent)
SELECT
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
  COUNT(*) as total
FROM agent_task
WHERE workflow_id = $1;
```

**Prisma Equivalent:**
```typescript
const tasks = await prisma.agentTask.findMany({
  where: { workflow_id },
  select: { status: true }
});

const completed = tasks.filter(t => t.status === 'completed').length;
const total = tasks.length;
```

---

#### Phase 2: Update API Response Schema (2-3 hours)

**Files to Modify:**
- `packages/orchestrator/src/types/index.ts` - Add fields to WorkflowResponseSchema
- `packages/shared/types/src/` - If using shared schema

**Current Schema:**
```typescript
export interface WorkflowResponseSchema {
  workflow_id: string;
  name: string;
  description?: string | null;
  type: WorkflowType;
  status: WorkflowStatus;
  current_stage: string;
  priority: Priority;
  progress_percentage: number;
  trace_id?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}
```

**Updated Schema:**
```typescript
export interface WorkflowResponseSchema {
  workflow_id: string;
  name: string;
  description?: string | null;
  type: WorkflowType;
  status: WorkflowStatus;
  current_stage: string;
  priority: Priority;
  progress_percentage: number;           // Now calculated
  agents_completed: number;               // NEW
  agents_total: number;                   // NEW
  progress_calculation_method: 'agent-based';  // NEW
  trace_id?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}
```

---

#### Phase 3: Update Dashboard Client (1-2 hours)

**Files to Modify:**
- `packages/dashboard/src/api/client.ts` - No changes needed (response already has fields)
- `packages/dashboard/src/types/index.ts` - Update Workflow interface

**Current Workflow Type:**
```typescript
interface Workflow {
  progress: number;
}
```

**Updated Workflow Type:**
```typescript
interface Workflow {
  progress: number;              // Same as progress_percentage
  progress_percentage: number;   // From API
  agents_completed?: number;     // NEW
  agents_total?: number;         // NEW
}
```

**Dashboard Display Changes:**
- Show "2 of 5 agents complete" next to progress bar
- Add tooltip on progress bar with agent details

---

#### Phase 4: Update State Machine (Optional, Future) (4-6 hours)

**Purpose:** Also persist progress to database for faster reads

**Current:** State machine only updates `current_stage`, `status`

**Future Enhancement:** Also update `progress` field when stages transition

```typescript
// In WorkflowStateMachine.transitionToNextStage()
await this.repository.updateState({
  current_stage: nextStage,
  status: newStatus,
  progress: await this.progressCalculator.calculateProgress(workflowId)
});
```

**Benefit:** Database queries can return progress directly (no calculation needed)

**Trade-off:** Extra DB write on each stage transition

---

### Implementation Timeline

| Phase | Effort | Priority | Timeline |
|-------|--------|----------|----------|
| Phase 1: Progress Service | 4-6h | CRITICAL | 1-2 days |
| Phase 2: API Schema | 2-3h | CRITICAL | Same day |
| Phase 3: Dashboard | 1-2h | HIGH | Same day |
| Phase 4: State Machine Persistence | 4-6h | MEDIUM | Optional, future |

**Total Critical Path:** 7-11 hours (1-2 days)

---

## PART 6: DATA VALIDATION CHECKLIST

### Before Implementation

- [ ] Verify `AgentTask` table has `workflow_id` foreign key
- [ ] Verify `AgentTask.status` values include 'completed'
- [ ] Confirm database has tasks for test workflows
- [ ] Test calculation query manually on database

### After Implementation

- [ ] API returns progress_percentage > 0 for running workflows
- [ ] Progress increases as tasks complete
- [ ] Dashboard shows agent count (e.g., "2 of 5")
- [ ] Progress bar fills as workflow progresses
- [ ] All three pages (Dashboard, List, Details) show consistent progress
- [ ] No regressions in status/stage display

---

## PART 7: MONITORING & OBSERVABILITY

### Metrics to Track Post-Implementation

```typescript
// New metrics to log
{
  workflow_id: string;
  progress_percentage: number;
  agents_completed: number;
  agents_total: number;
  calculation_time_ms: number;
  stale_data: boolean;  // If different from DB.progress
}
```

### Questions to Answer Post-Implementation

1. ✓ Is progress now > 0 for running workflows?
2. ✓ Does progress match agent completion rate?
3. ✓ Is dashboard showing correct progress?
4. ✓ Are there any performance issues (calculation taking > 100ms)?
5. ✓ Is there ever a mismatch between calculated and DB progress?

---

## PART 8: RISK ASSESSMENT

### Implementation Risks

| Risk | Mitigation |
|------|-----------|
| Calculation query too slow | Add DB index on (workflow_id, status) for AgentTask |
| Progress fluctuates during updates | Cache result for 2-5 seconds |
| API response breaking changes | Add fields as optional, maintain backward compatibility |
| State machine not creating tasks | Verify tasks are created before calculating progress |

### Testing Requirements

```typescript
// Test cases needed
✓ Empty workflow (0 tasks) → 0%
✓ All tasks pending → 0%
✓ 1 of 5 tasks completed → 20%
✓ 5 of 5 tasks completed → 100%
✓ Task fails → progress still counts it toward total (agent was involved)
✓ Multiple status changes rapidly → no double-counting
```

---

## SUMMARY TABLE: Before vs After

| Aspect | BEFORE | AFTER |
|--------|--------|-------|
| **Progress Value** | 0% (always) | 40% (calculated from tasks) |
| **Calculation Method** | Database stored value | Agent completion count |
| **Update Frequency** | Never | Real-time (on each query) |
| **API Response Fields** | progress_percentage | progress_percentage, agents_completed, agents_total |
| **Dashboard Display** | Broken progress bar | Working progress bar + agent count |
| **Data Accuracy** | Completely wrong | Accurate reflection of workflow progress |

---

## NEXT STEPS

1. **Validate this design** with requirements (complete ✓)
2. **Create ProgressCalculatorService** (Phase 1)
3. **Update API response schema** (Phase 2)
4. **Test with live workflow** (Phase 3)
5. **Monitor and optimize** (Phase 4)

---

**Document Version:** 1.0
**Last Updated:** 2025-11-17
**Status:** Ready for Implementation
