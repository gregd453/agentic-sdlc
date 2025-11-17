# Implementation Roadmap: Fix Status, Stage, and Progress Fields
**Priority:** CRITICAL | **Effort:** 7-11 hours | **Impact:** Dashboard Progress Tracking

---

## QUICK SUMMARY

**Problem:** Dashboard shows 0% progress for all workflows; progress field never updated.

**Root Cause:**
- Progress calculation disconnected from API
- Metric should be: (agents completed / agents total) * 100
- Currently: stored database value (always 0)

**Solution:** Create ProgressCalculatorService to calculate real-time progress from AgentTask completion

---

## PHASE 1: Create Progress Calculation Service

### Step 1.1: Create New Service File

**File:** `packages/orchestrator/src/services/progress-calculator.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { WorkflowRepository } from '../repositories/workflow.repository';

interface ProgressResult {
  progress_percentage: number;
  agents_completed: number;
  agents_total: number;
  calculation_method: 'agent-based';
  last_updated_at: string;
}

@Injectable()
export class ProgressCalculatorService {
  constructor(private readonly workflowRepository: WorkflowRepository) {}

  /**
   * Calculate workflow progress based on completed agent tasks
   * Formula: (completed_tasks / total_tasks) * 100
   */
  async calculateProgress(workflowId: string): Promise<ProgressResult> {
    try {
      // Fetch all tasks for the workflow
      const tasks = await this.workflowRepository.getWorkflowTasks(workflowId);

      if (!tasks || tasks.length === 0) {
        return {
          progress_percentage: 0,
          agents_completed: 0,
          agents_total: 0,
          calculation_method: 'agent-based',
          last_updated_at: new Date().toISOString()
        };
      }

      // Count completed tasks
      const completed = tasks.filter(task => task.status === 'completed').length;
      const total = tasks.length;

      // Calculate percentage (round to nearest integer)
      const percentage = Math.round((completed / total) * 100);

      return {
        progress_percentage: percentage,
        agents_completed: completed,
        agents_total: total,
        calculation_method: 'agent-based',
        last_updated_at: new Date().toISOString()
      };
    } catch (error) {
      // Fallback to 0 on error
      console.error(`Failed to calculate progress for workflow ${workflowId}:`, error);
      return {
        progress_percentage: 0,
        agents_completed: 0,
        agents_total: 0,
        calculation_method: 'agent-based',
        last_updated_at: new Date().toISOString()
      };
    }
  }
}
```

### Step 1.2: Register Service in Module

**File:** `packages/orchestrator/src/services/index.ts`

Add:
```typescript
export { ProgressCalculatorService } from './progress-calculator.service';
```

**File:** `packages/orchestrator/src/orchestrator.module.ts` (or OrchestratorContainer)

Add to providers:
```typescript
import { ProgressCalculatorService } from './services/progress-calculator.service';

// In your module or container:
ProgressCalculatorService,
```

### Step 1.3: Verify Repository Method

**File:** `packages/orchestrator/src/repositories/workflow.repository.ts`

Verify this method exists:
```typescript
async getWorkflowTasks(workflowId: string): Promise<AgentTask[]> {
  return this.prisma.agentTask.findMany({
    where: { workflow_id: workflowId },
    select: { status: true, task_id: true, completed_at: true }
  });
}
```

If it doesn't exist, add it:
```typescript
async getWorkflowTasks(workflowId: string): Promise<AgentTask[]> {
  return this.prisma.agentTask.findMany({
    where: { workflow_id: workflowId },
    orderBy: { assigned_at: 'desc' }
  });
}
```

---

## PHASE 2: Update API Response Schema

### Step 2.1: Update Response Schema Type

**File:** `packages/orchestrator/src/types/index.ts`

Find and update WorkflowResponseSchema:

```typescript
// BEFORE:
export interface WorkflowResponseSchema {
  workflow_id: string;
  name: string;
  description?: string | null;
  type: WorkflowType;
  status: string;
  current_stage: string;
  priority: Priority;
  progress_percentage: number;
  trace_id?: string;
  estimated_duration_ms?: number;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}

// AFTER:
export interface WorkflowResponseSchema {
  workflow_id: string;
  name: string;
  description?: string | null;
  type: WorkflowType;
  status: string;
  current_stage: string;
  priority: Priority;
  progress_percentage: number;          // NOW: calculated in real-time
  agents_completed: number;             // NEW
  agents_total: number;                 // NEW
  progress_calculation_method: 'agent-based';  // NEW
  trace_id?: string;
  estimated_duration_ms?: number;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}
```

### Step 2.2: Update WorkflowService

**File:** `packages/orchestrator/src/services/workflow.service.ts`

#### Find the getWorkflow method (around line ~375-410)

```typescript
// BEFORE:
async getWorkflow(id: string): Promise<WorkflowResponseSchema> {
  const workflow = await this.repository.findById(id);
  return {
    workflow_id: workflow.id,
    name: workflow.name,
    description: workflow.description,
    type: workflow.type,
    status: workflow.status,
    current_stage: workflow.current_stage,
    priority: workflow.priority,
    progress_percentage: workflow.progress,  // ← FROM DATABASE (always 0)
    trace_id: workflow.trace_id,
    created_at: workflow.created_at.toISOString(),
    updated_at: workflow.updated_at.toISOString(),
    completed_at: workflow.completed_at?.toISOString() || null
  };
}

// AFTER:
async getWorkflow(id: string): Promise<WorkflowResponseSchema> {
  const workflow = await this.repository.findById(id);

  // Calculate progress from agent tasks
  const progress = await this.progressCalculatorService.calculateProgress(id);

  return {
    workflow_id: workflow.id,
    name: workflow.name,
    description: workflow.description,
    type: workflow.type,
    status: workflow.status,
    current_stage: workflow.current_stage,
    priority: workflow.priority,
    progress_percentage: progress.progress_percentage,  // ← CALCULATED
    agents_completed: progress.agents_completed,         // ← NEW
    agents_total: progress.agents_total,                 // ← NEW
    progress_calculation_method: progress.calculation_method,  // ← NEW
    trace_id: workflow.trace_id,
    created_at: workflow.created_at.toISOString(),
    updated_at: workflow.updated_at.toISOString(),
    completed_at: workflow.completed_at?.toISOString() || null
  };
}
```

#### Inject the service in constructor

```typescript
// BEFORE:
constructor(
  private readonly repository: WorkflowRepository,
  private readonly stateMachine: WorkflowStateMachine,
  // ... other services
) {}

// AFTER:
constructor(
  private readonly repository: WorkflowRepository,
  private readonly stateMachine: WorkflowStateMachine,
  private readonly progressCalculatorService: ProgressCalculatorService,  // ADD THIS
  // ... other services
) {}
```

#### Update getWorkflows (list method) - around line ~408-430

```typescript
// BEFORE:
async getWorkflows(filters?: any): Promise<WorkflowResponseSchema[]> {
  const workflows = await this.repository.findAll(filters);
  return workflows.map(w => ({
    workflow_id: w.id,
    // ... other fields
    progress_percentage: w.progress  // ← FROM DATABASE
  }));
}

// AFTER:
async getWorkflows(filters?: any): Promise<WorkflowResponseSchema[]> {
  const workflows = await this.repository.findAll(filters);

  // Calculate progress for each workflow
  return Promise.all(
    workflows.map(async (w) => {
      const progress = await this.progressCalculatorService.calculateProgress(w.id);
      return {
        workflow_id: w.id,
        // ... other fields
        progress_percentage: progress.progress_percentage,  // ← CALCULATED
        agents_completed: progress.agents_completed,
        agents_total: progress.agents_total,
        progress_calculation_method: progress.calculation_method
      };
    })
  );
}
```

---

## PHASE 3: Test the Implementation

### Step 3.1: Manual Testing

Run these commands to test:

```bash
# 1. Start fresh
./dev restart

# 2. Create a workflow
curl -X POST http://localhost:3051/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Progress Test",
    "type": "app",
    "priority": "high"
  }'

# Copy the workflow_id from response
export WF_ID="<workflow_id_from_response>"

# 3. Check progress (should be 0% initially if no tasks yet)
curl http://localhost:3051/api/v1/workflows/$WF_ID | jq '.progress_percentage'

# 4. Create some test tasks manually (or trigger agent)
# This depends on your workflow engine - simulate tasks being created

# 5. Check progress again (should show calculated percentage)
curl http://localhost:3051/api/v1/workflows/$WF_ID | jq '{id: .workflow_id, progress: .progress_percentage, completed: .agents_completed, total: .agents_total}'

# Expected output:
# {
#   "id": "e460a00f-...",
#   "progress": 50,
#   "completed": 1,
#   "total": 2
# }
```

### Step 3.2: Dashboard Testing

1. Start dashboard: `./dev dashboard`
2. Create a workflow via API or UI
3. Open Workflows List page
4. Verify:
   - [ ] Progress bar shows > 0% (not 0%)
   - [ ] Progress bar updates as tasks complete
   - [ ] Workflow Details page shows agent count
   - [ ] Dashboard page shows progress in active workflows table

### Step 3.3: Verify Backward Compatibility

1. Check that existing endpoints still work
2. Verify dashboard still renders without errors
3. Check API response has all expected fields

---

## PHASE 4: Update Dashboard (Optional)

### Step 4.1: Update Type Definition

**File:** `packages/dashboard/src/types/index.ts`

```typescript
// ADD to Workflow interface:
agents_completed?: number;
agents_total?: number;
progress_calculation_method?: string;
```

### Step 4.2: Update Progress Bar Display (Optional Enhancement)

**File:** `packages/dashboard/src/pages/WorkflowsPage.tsx`

Add agent count display next to progress bar:

```typescript
// In the table, add this next to the progress bar:
<span style={{ marginLeft: '8px', fontSize: '12px', color: '#666' }}>
  ({workflow.agents_completed} of {workflow.agents_total})
</span>
```

---

## Verification Checklist

### Pre-Implementation
- [ ] Understand the three-tier architecture (DB, API, Dashboard)
- [ ] Verify AgentTask table has workflow_id relationship
- [ ] Confirm repository has getWorkflowTasks method
- [ ] Read DATA-FLOW-ANALYSIS.md completely

### During Implementation
- [ ] Create ProgressCalculatorService
- [ ] Inject into WorkflowService
- [ ] Update response schema
- [ ] Update both getWorkflow and getWorkflows methods
- [ ] Add new fields to response

### After Implementation
- [ ] Compile without errors: `pnpm build`
- [ ] Start services: `./dev restart`
- [ ] Test API endpoint returns new fields
- [ ] Test dashboard displays progress > 0
- [ ] Test progress updates in real-time
- [ ] Verify no regressions in status/stage

### Performance Check
- [ ] Calculate progress query < 100ms
- [ ] No N+1 query problems
- [ ] Dashboard doesn't lag on refresh
- [ ] List endpoint doesn't timeout with many workflows

---

## Rollback Plan

If issues occur:

```bash
# 1. Revert service changes
git checkout packages/orchestrator/src/services/workflow.service.ts

# 2. Revert type changes
git checkout packages/orchestrator/src/types/index.ts

# 3. Restart services
./dev restart

# 4. Dashboard will use fallback values (progress_percentage: 0)
```

---

## Common Issues & Fixes

### Issue: "ProgressCalculatorService not found"
**Solution:** Make sure it's exported from `services/index.ts` and injected in constructor

### Issue: "getWorkflowTasks method not found"
**Solution:** Add method to WorkflowRepository if missing

### Issue: "Progress still shows 0%"
**Solution:** Verify tasks are being created for the workflow. Check database:
```sql
SELECT * FROM agent_task WHERE workflow_id = '<your-id>';
```

### Issue: "API response slow (>1s)"
**Solution:** Add database index on AgentTask:
```sql
CREATE INDEX idx_agent_task_workflow_status ON agent_task(workflow_id, status);
```

### Issue: "Dashboard shows error"
**Solution:** Check browser console for errors. The new fields are optional, so it should be backward compatible.

---

## Performance Optimization (Future)

Once working, consider:

1. **Cache results for 2-5 seconds** to reduce database queries
2. **Add database index** on (workflow_id, status) for AgentTask
3. **Move calculation to state machine** - persist progress on each stage transition
4. **Use Redis cache** for frequently accessed workflows

---

## Files to Modify Summary

| File | Change | Effort |
|------|--------|--------|
| `progress-calculator.service.ts` | CREATE | 15 min |
| `workflow.service.ts` | UPDATE inject + 2 methods | 20 min |
| `types/index.ts` | UPDATE schema | 5 min |
| `orchestrator.module.ts` | UPDATE providers | 5 min |
| `dashboard/types/index.ts` | UPDATE interface | 5 min |

**Total Time:** ~50 minutes of coding + 1-2 hours testing

---

## Success Criteria

- [ ] API returns `progress_percentage > 0` for workflows with completed tasks
- [ ] Progress matches calculated agent completion rate
- [ ] Dashboard displays progress bar correctly
- [ ] No console errors in browser
- [ ] All three pages (Dashboard, List, Details) show same progress
- [ ] Performance is acceptable (< 100ms per calculation)
- [ ] Status and Stage fields still work correctly

---

**Ready to implement?** Start with Phase 1 Step 1.1!
