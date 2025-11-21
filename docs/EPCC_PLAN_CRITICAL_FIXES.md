# Implementation Plan: Critical Status Consistency Fixes

**Status**: PLANNING PHASE (READ-ONLY)
**Session**: #78
**Date**: 2025-11-17
**Based On**: EPCC_EXPLORE.md critical findings audit
**Timeline**: 8-10 hours (5 phases)
**Production Impact**: High (4 blockers affecting data integrity and observability)

---

## 📋 Executive Summary

This plan addresses **7 critical issues** identified in the status consistency audit:
- **4 Blockers** (Phase 1-4): Data loss, type safety, broken tracing
- **1 High** (Phase 5): Developer confusion
- **2 Medium** (Phase 5): Robustness gaps

**Success Criteria**:
- ✅ All 4 blockers fixed and tested
- ✅ Status consistency score: 65/100 → 95/100
- ✅ Distributed tracing restored
- ✅ Pause/resume state survives restarts
- ✅ Terminal states persisted to DB
- ✅ Full test coverage (unit + integration + E2E)
- ✅ Zero production regressions

**Risk Level**: Medium (schema migration required, but non-breaking approach)

---

## 🎯 Phase Overview

```
Phase 1 (Foundation)     → Status Enum Unification [1-2h]
    ↓
Phase 2 & 3 (Parallel)  → Terminal State Persistence [1-2h] + trace_id Propagation [2h]
    ↓
Phase 4                  → Pipeline Pause/Resume Persistence [2-3h]
    ↓
Phase 5 (Polish)         → Logging & Naming Improvements [1-2h]

TOTAL: 8-10 hours (with testing and validation)
```

---

## Phase 1: Status Enum Unification (BLOCKER - Foundation)

**Objective**: Create unified WorkflowStatus/PipelineStatus enum
**Estimated Effort**: 1-2 hours
**Severity**: BLOCKER
**Dependency**: Foundation for all subsequent phases

### Current State
**PipelineStatus** (pipeline.types.ts):
```typescript
'created' | 'queued' | 'running' | 'success' | 'failed' | 'cancelled' | 'paused'
```

**WorkflowStatus** (schema.prisma):
```prisma
enum WorkflowStatus {
  initiated
  running
  paused
  completed
  failed
  cancelled
}
```

**Problem**: Pipeline uses `'success'` but Workflow requires `'completed'`
- Type checking fails
- Runtime errors on status updates
- Cannot map statuses between systems

### Implementation Strategy

#### 1.1 Create Unified Enum
**File**: `packages/shared/types/src/enums/workflow-status.ts`
**Task**: Define canonical WorkflowStatus enum

```typescript
export const WorkflowStatusEnum = {
  INITIATED: 'initiated',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export type WorkflowStatus = typeof WorkflowStatusEnum[keyof typeof WorkflowStatusEnum];
```

**Success Criteria**:
- [ ] Enum defined in shared/types
- [ ] Exported from @agentic-sdlc/shared-types index
- [ ] No /src/ imports in consumers
- [ ] TypeScript build passes

#### 1.2 Update Prisma Schema
**File**: `schema.prisma`
**Task**: Align schema enum with unified status

```prisma
enum WorkflowStatus {
  initiated
  running
  paused
  completed
  failed
  cancelled
}
```

**Change**: Already correct! Just ensure alignment confirmed.

**Success Criteria**:
- [ ] Schema matches unified enum
- [ ] No migrations required yet (just verification)

#### 1.3 Update Pipeline Types
**File**: `packages/shared/types/src/types/pipeline.types.ts`
**Task**: Import and use unified enum

```typescript
// Remove local PipelineStatus definition
// Add:
import { WorkflowStatus } from '../enums/workflow-status';

export interface Pipeline {
  status: WorkflowStatus;  // Changed from PipelineStatus
  // ... rest of interface
}
```

**Change Scope**:
- Lines 29-37: Remove hardcoded `'success' | 'completed'` enum
- Import unified enum from shared-types
- Update all type references

**Success Criteria**:
- [ ] All PipelineStatus references replaced
- [ ] No local enum duplication
- [ ] Build passes
- [ ] No /src/ imports

#### 1.4 Update Consumer Code
**Files to Update**:
- `pipeline-executor.service.ts`: Update status assignments
- `workflow-state-machine.ts`: Verify enum usage
- Any code with hardcoded status strings

**Changes**:
```typescript
// Before
execution.status = 'success';  // ❌ Type error

// After
execution.status = WorkflowStatusEnum.COMPLETED;  // ✅ Correct
```

**Success Criteria**:
- [ ] All `'success'` references changed to `'completed'`
- [ ] All hardcoded strings replaced with enum constants
- [ ] TypeScript strict mode passes
- [ ] No type errors

#### 1.5 Create Data Migration Script
**File**: `scripts/migrations/migrate-pipeline-status.sql`
**Task**: Convert existing 'success' status to 'completed' in database

```sql
-- Migration: Convert PipelineStatus 'success' to 'completed'
BEGIN TRANSACTION;

UPDATE Workflow
SET status = 'completed'
WHERE status = 'success';

-- Verify migration
SELECT status, COUNT(*) FROM Workflow GROUP BY status;

COMMIT;
```

**Success Criteria**:
- [ ] Script created and tested against staging DB
- [ ] Rollback script created
- [ ] No data loss
- [ ] All 'success' values converted

#### 1.6 Run Build Validation
**Commands**:
```bash
pnpm build
pnpm typecheck
pnpm test
```

**Success Criteria**:
- [ ] `turbo run build` passes (no errors)
- [ ] All packages build in order
- [ ] TypeScript strict mode completes
- [ ] No /src/ imports in dist
- [ ] Package indexes export correctly

### Testing for Phase 1

**Unit Tests** (location: `packages/shared/types/src/__tests__/`):
```typescript
describe('WorkflowStatusEnum', () => {
  it('should have all required statuses', () => {
    expect(WorkflowStatusEnum).toHaveProperty('INITIATED');
    expect(WorkflowStatusEnum).toHaveProperty('COMPLETED');
    expect(WorkflowStatusEnum).toHaveProperty('FAILED');
  });

  it('should not have deprecated "success" status', () => {
    expect(WorkflowStatusEnum).not.toHaveProperty('SUCCESS');
  });

  it('should be compatible with Prisma enum', () => {
    // Verify enum values match schema.prisma
  });
});
```

**Integration Test**:
```typescript
it('should convert pipeline status to workflow status', () => {
  const pipeline = { status: WorkflowStatusEnum.COMPLETED };
  const workflow = { status: pipeline.status };
  expect(workflow.status).toBe(WorkflowStatusEnum.COMPLETED);
});
```

### Blockers & Dependencies
- **Blocker**: None - Phase 1 is foundation
- **Dependency**: None - can run immediately

### Risk Assessment - Phase 1
| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Type errors after update | Low | Medium | Comprehensive find/replace, build validation |
| Existing data issues | Low | High | Create migration script, test in staging |
| Package export failures | Low | High | Run `turbo run build` before proceeding |

---

## Phase 2: Fix Terminal State Persistence (BLOCKER - High Impact)

**Objective**: Ensure failed/cancelled workflows persist status to DB
**Estimated Effort**: 1-2 hours
**Severity**: BLOCKER
**Dependency**: Requires Phase 1 (status enum unification)

### Current State
**Issue**: Events published but DB not updated

```typescript
// workflow-state-machine.ts Line 414
private notifyError(workflow: Workflow, error: Error): void {
  // ✅ Event published
  this.eventBus.publish({
    type: 'WORKFLOW_FAILED',
    status: 'failed',
  });

  // ❌ MISSING: repository.update({ status: 'failed' })
  // Result: DB shows old status
}
```

**Impact**:
- Dashboard shows 'running' but event says 'failed'
- Eventual consistency not achieved
- Admin cannot see which workflows failed

### Implementation Strategy

#### 2.1 Update notifyError() Function
**File**: `packages/orchestrator/src/state-machine/workflow-state-machine.ts`
**Line**: 414-420
**Task**: Add database persistence before event publish

**Current Code** (WRONG):
```typescript
private notifyError(workflow: Workflow, error: Error): void {
  // Only publishes event, doesn't persist
  this.eventBus.publish({
    type: 'WORKFLOW_FAILED',
    workflow_id: workflow.id,
    status: 'failed',
    error: error.message,
  });
}
```

**New Code** (CORRECT):
```typescript
private async notifyError(workflow: Workflow, error: Error): void {
  // Step 1: Update DB first (ensures persistence)
  try {
    await this.workflowRepository.update(workflow.id, {
      status: WorkflowStatusEnum.FAILED,
      error_message: error.message,
      failed_at: new Date(),
    });

    logger.info('Workflow status updated to failed', {
      workflow_id: workflow.id,
      error: error.message,
      trace_id: getRequestContext()?.trace_id,
    });
  } catch (dbError) {
    logger.error('Failed to persist error status to DB', {
      workflow_id: workflow.id,
      error: dbError,
      trace_id: getRequestContext()?.trace_id,
    });
    // Still publish event even if DB fails (eventual consistency)
  }

  // Step 2: Publish event to notify subscribers
  this.eventBus.publish({
    type: 'WORKFLOW_FAILED',
    workflow_id: workflow.id,
    status: WorkflowStatusEnum.FAILED,
    error: error.message,
  });
}
```

**Key Changes**:
1. Make function async (await repository update)
2. Add try/catch around DB operation
3. Update status BEFORE publishing event
4. Add comprehensive logging with trace_id
5. Use WorkflowStatusEnum.FAILED (from Phase 1)

**Success Criteria**:
- [ ] Function is async
- [ ] DB update called before event publish
- [ ] Error handling implemented
- [ ] Logging includes trace_id
- [ ] Uses unified enum from Phase 1

#### 2.2 Update notifyCancellation() Function
**File**: `packages/orchestrator/src/state-machine/workflow-state-machine.ts`
**Line**: 428-433
**Task**: Add database persistence (same pattern as notifyError)

**New Code** (same pattern):
```typescript
private async notifyCancellation(workflow: Workflow): void {
  // Step 1: Update DB first
  try {
    await this.workflowRepository.update(workflow.id, {
      status: WorkflowStatusEnum.CANCELLED,
      cancelled_at: new Date(),
    });

    logger.info('Workflow status updated to cancelled', {
      workflow_id: workflow.id,
      trace_id: getRequestContext()?.trace_id,
    });
  } catch (dbError) {
    logger.error('Failed to persist cancellation status to DB', {
      workflow_id: workflow.id,
      error: dbError,
      trace_id: getRequestContext()?.trace_id,
    });
  }

  // Step 2: Publish event
  this.eventBus.publish({
    type: 'WORKFLOW_CANCELLED',
    workflow_id: workflow.id,
    status: WorkflowStatusEnum.CANCELLED,
  });
}
```

**Success Criteria**:
- [ ] Function is async
- [ ] DB update called before event publish
- [ ] Error handling implemented
- [ ] Logging includes trace_id
- [ ] Uses unified enum from Phase 1

#### 2.3 Verify markComplete() Function
**File**: `packages/orchestrator/src/state-machine/workflow-state-machine.ts`
**Line**: 386
**Task**: Verify it has proper error handling and logging

**Check**:
```typescript
private async markComplete(workflow: Workflow): Promise<void> {
  // Should already call repository.update()
  // Add logging if missing
}
```

**Success Criteria**:
- [ ] Function calls repository.update()
- [ ] Error handling in place
- [ ] Logging with trace_id included
- [ ] Returns Promise (async function)

#### 2.4 Update Callers of Notification Functions
**Task**: Update all callers to handle async functions

**Search**: Find all callers of `notifyError()`, `notifyCancellation()`

**Changes**:
```typescript
// Before
this.notifyError(workflow, error);

// After
await this.notifyError(workflow, error);
```

**Files to Check**:
- workflow-state-machine.ts (event handlers)
- Any service that calls these methods

**Success Criteria**:
- [ ] All callers use await
- [ ] No unhandled promises
- [ ] TypeScript build passes

#### 2.5 Add Database Schema Updates (if needed)
**Task**: Verify Workflow table has these columns

**Expected Columns**:
- `error_message` (TEXT, nullable)
- `failed_at` (TIMESTAMP, nullable)
- `cancelled_at` (TIMESTAMP, nullable)

**Action**: If columns missing, add via Prisma migration
```prisma
model Workflow {
  // ... existing fields
  error_message  String?
  failed_at      DateTime?
  cancelled_at   DateTime?
}
```

**Success Criteria**:
- [ ] All required columns exist in schema
- [ ] Migration created if columns added
- [ ] pnpm prisma generate passes

### Testing for Phase 2

**Unit Test** (`packages/orchestrator/src/__tests__/workflow-state-machine.test.ts`):
```typescript
describe('notifyError', () => {
  it('should persist error status to DB before publishing event', async () => {
    const mockRepository = mock(WorkflowRepository);
    const mockEventBus = mock(MessageBus);

    await stateMachine.notifyError(workflow, error);

    // Verify DB update called FIRST
    expect(mockRepository.update).toHaveBeenCalledWith(
      workflow.id,
      expect.objectContaining({ status: 'failed' })
    );

    // Verify event published AFTER
    expect(mockEventBus.publish).toHaveBeenCalled();
    expect(mockRepository.update).toHaveBeenCalledBefore(
      mockEventBus.publish
    );
  });

  it('should still publish event if DB update fails', async () => {
    mockRepository.update.mockRejectedValue(new Error('DB error'));

    await stateMachine.notifyError(workflow, error);

    // Event should still be published
    expect(mockEventBus.publish).toHaveBeenCalled();
  });

  it('should include trace_id in logging', async () => {
    setRequestContext({ trace_id: 'trace-123' });

    await stateMachine.notifyError(workflow, error);

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ trace_id: 'trace-123' })
    );
  });
});
```

**Integration Test** (`packages/orchestrator/src/__tests__/integration/`):
```typescript
describe('Terminal State Persistence', () => {
  it('should persist failed status and publish event', async () => {
    // Start workflow
    const workflow = await orchestrator.initiate(...);

    // Trigger error
    await orchestrator.handleError(workflow.id, new Error('test'));

    // Verify DB shows failed status
    const updated = await workflowRepository.getById(workflow.id);
    expect(updated.status).toBe('failed');
    expect(updated.error_message).toBe('test');

    // Verify event was published
    expect(publishedEvents).toContainEqual(
      expect.objectContaining({
        type: 'WORKFLOW_FAILED',
        workflow_id: workflow.id,
      })
    );
  });

  it('should persist cancelled status and publish event', async () => {
    const workflow = await orchestrator.initiate(...);

    await orchestrator.cancel(workflow.id);

    const updated = await workflowRepository.getById(workflow.id);
    expect(updated.status).toBe('cancelled');
    expect(updated.cancelled_at).not.toBeNull();
  });
});
```

### Blockers & Dependencies
- **Blocker**: None (after Phase 1 complete)
- **Dependency**: Phase 1 (enum unification)
- **Can Parallelize**: With Phase 3

### Risk Assessment - Phase 2
| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Async changes break callers | Medium | Medium | Comprehensive search, build validation |
| DB column missing | Low | High | Verify schema, add migration if needed |
| Performance impact of extra DB call | Low | Low | Update already fast, minimal overhead |

---

## Phase 3: Fix trace_id Propagation (BLOCKER - High Impact)

**Objective**: Restore distributed tracing by propagating trace_id correctly
**Estimated Effort**: 2 hours
**Severity**: BLOCKER
**Dependency**: Requires Phase 1 (enum for event types)
**Can Run in Parallel**: With Phase 2 (after Phase 1)

### Current State
**Issue**: trace_id hardcoded instead of propagated

**Broken Pattern** (Current):
```typescript
// Line 401: notifyCompletion()
await this.eventBus.publish({
  trace_id: `trace-${workflow_id}`,  // ❌ NEW trace_id created
  type: 'WORKFLOW_COMPLETED',
  workflow_id: workflow.id,
});

// Line 414: notifyError()
await this.eventBus.publish({
  trace_id: `trace-${workflow_id}`,  // ❌ NEW trace_id created
  type: 'WORKFLOW_FAILED',
  workflow_id: workflow.id,
});

// Line 428: notifyCancellation()
await this.eventBus.publish({
  trace_id: `trace-${workflow_id}`,  // ❌ NEW trace_id created
  type: 'WORKFLOW_CANCELLED',
  workflow_id: workflow.id,
});

// pipeline-executor.service.ts Line 630
const traceId = generateTraceId();  // ❌ NEW trace_id generated
```

**Impact**:
- Each event creates new trace_id
- Dashboard shows multiple unrelated traces
- Cannot correlate logs across services
- Distributed tracing completely broken

### Implementation Strategy

#### 3.1 Understand RequestContext Pattern
**File**: `packages/shared/types/src/utils/request-context.ts`
**Task**: Review how RequestContext stores trace_id

**Key Pattern**:
```typescript
// AsyncLocalStorage stores request context
const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export interface RequestContext {
  trace_id: string;
  workflow_id: string;
  user_id?: string;
  timestamp: Date;
}

export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

export function setRequestContext(context: RequestContext): void {
  requestContextStorage.run(context, () => {
    // Code here has access to context
  });
}
```

**Key Insight**: RequestContext is available in AsyncLocalStorage throughout request lifetime.

**Success Criteria**:
- [ ] Understand AsyncLocalStorage mechanics
- [ ] Know where RequestContext is set (entry point)
- [ ] Know where it's available (sync code path)
- [ ] Know where it's lost (async callbacks)

#### 3.2 Fix notifyCompletion() Function
**File**: `packages/orchestrator/src/state-machine/workflow-state-machine.ts`
**Line**: 401
**Task**: Propagate trace_id from RequestContext

**Current Code** (WRONG):
```typescript
private notifyCompletion(workflow: Workflow): void {
  this.eventBus.publish({
    trace_id: `trace-${workflow_id}`,  // ❌ New trace_id
    type: 'WORKFLOW_COMPLETED',
    workflow_id: workflow.id,
  });
}
```

**New Code** (CORRECT):
```typescript
private notifyCompletion(workflow: Workflow): void {
  // Capture context BEFORE async call
  const context = getRequestContext();
  const traceId = context?.trace_id || `trace-${workflow.id}`;  // Fallback if context not available

  this.eventBus.publish({
    trace_id: traceId,  // ✅ Propagated from original request
    type: 'WORKFLOW_COMPLETED',
    workflow_id: workflow.id,
  });

  logger.info('Workflow completed', {
    workflow_id: workflow.id,
    trace_id: traceId,
  });
}
```

**Key Changes**:
1. Import `getRequestContext` from shared-types
2. Capture context at function start (before async)
3. Use context.trace_id with fallback to `trace-${id}`
4. Pass trace_id to all event fields
5. Log with trace_id included

**Success Criteria**:
- [ ] trace_id captured from context
- [ ] Fallback to `trace-${id}` if context unavailable
- [ ] Same trace_id used in logging
- [ ] No new trace_id generation

#### 3.3 Fix notifyError() Function
**File**: `packages/orchestrator/src/state-machine/workflow-state-machine.ts`
**Line**: 414
**Task**: Apply same pattern as notifyCompletion

```typescript
private async notifyError(workflow: Workflow, error: Error): void {
  // Capture context BEFORE async
  const context = getRequestContext();
  const traceId = context?.trace_id || `trace-${workflow.id}`;

  try {
    await this.workflowRepository.update(workflow.id, {
      status: WorkflowStatusEnum.FAILED,
      error_message: error.message,
      failed_at: new Date(),
    });

    logger.info('Workflow status updated to failed', {
      workflow_id: workflow.id,
      error: error.message,
      trace_id: traceId,  // ✅ Use propagated trace_id
    });
  } catch (dbError) {
    logger.error('Failed to persist error status', {
      workflow_id: workflow.id,
      error: dbError,
      trace_id: traceId,  // ✅ Use propagated trace_id
    });
  }

  this.eventBus.publish({
    trace_id: traceId,  // ✅ Use propagated trace_id
    type: 'WORKFLOW_FAILED',
    workflow_id: workflow.id,
    status: WorkflowStatusEnum.FAILED,
    error: error.message,
  });
}
```

**Success Criteria**:
- [ ] trace_id captured from context at function start
- [ ] Same trace_id used in all logging
- [ ] Same trace_id passed to event
- [ ] Fallback to `trace-${id}` if context unavailable

#### 3.4 Fix notifyCancellation() Function
**File**: `packages/orchestrator/src/state-machine/workflow-state-machine.ts`
**Line**: 428
**Task**: Apply same pattern as notifyError

```typescript
private async notifyCancellation(workflow: Workflow): void {
  const context = getRequestContext();
  const traceId = context?.trace_id || `trace-${workflow.id}`;

  try {
    await this.workflowRepository.update(workflow.id, {
      status: WorkflowStatusEnum.CANCELLED,
      cancelled_at: new Date(),
    });

    logger.info('Workflow status updated to cancelled', {
      workflow_id: workflow.id,
      trace_id: traceId,  // ✅ Use propagated trace_id
    });
  } catch (dbError) {
    logger.error('Failed to persist cancellation status', {
      workflow_id: workflow.id,
      error: dbError,
      trace_id: traceId,  // ✅ Use propagated trace_id
    });
  }

  this.eventBus.publish({
    trace_id: traceId,  // ✅ Use propagated trace_id
    type: 'WORKFLOW_CANCELLED',
    workflow_id: workflow.id,
    status: WorkflowStatusEnum.CANCELLED,
  });
}
```

**Success Criteria**:
- [ ] Same pattern as other notification functions
- [ ] trace_id propagated from context
- [ ] Logging includes trace_id
- [ ] Event includes trace_id

#### 3.5 Fix Pipeline Executor trace_id Generation
**File**: `packages/orchestrator/src/services/pipeline-executor.service.ts`
**Line**: 630
**Task**: Propagate trace_id instead of generating new one

**Current Code** (WRONG):
```typescript
// Line 630
const traceId = generateTraceId();  // ❌ Creates NEW trace_id
const pipeline = createPipeline({
  trace_id: traceId,
});
```

**New Code** (CORRECT):
```typescript
// Capture context
const context = getRequestContext();
const traceId = context?.trace_id || generateTraceId();  // ✅ Use existing or generate fallback

const pipeline = createPipeline({
  trace_id: traceId,
});

logger.info('Pipeline created', {
  pipeline_id: pipeline.id,
  trace_id: traceId,
});
```

**Success Criteria**:
- [ ] Capture RequestContext
- [ ] Use context.trace_id if available
- [ ] Generate new only if context unavailable
- [ ] Pass trace_id to pipeline creation
- [ ] Log with trace_id

#### 3.6 Search for All trace_id Hardcodes
**Task**: Find all other locations with hardcoded trace_id

**Search Command**:
```bash
grep -r "trace_id.*trace-" packages/orchestrator --include="*.ts"
grep -r "generateTraceId()" packages/orchestrator --include="*.ts"
grep -r "trace-\${" packages/orchestrator --include="*.ts"
```

**Apply Fix**: Replace all with RequestContext propagation pattern

**Success Criteria**:
- [ ] No hardcoded `trace-${id}` patterns
- [ ] All events use context.trace_id
- [ ] Fallback only for unavailable context
- [ ] All modified locations logged

### Testing for Phase 3

**Unit Test**:
```typescript
describe('trace_id Propagation', () => {
  it('should use trace_id from RequestContext in events', () => {
    const testContext = {
      trace_id: 'trace-test-123',
      workflow_id: 'wf-456',
    };

    setRequestContext(testContext);

    stateMachine.notifyCompletion(workflow);

    expect(publishedEvent).toEqual(
      expect.objectContaining({
        trace_id: 'trace-test-123',  // ✅ Propagated from context
      })
    );
  });

  it('should fallback to trace-${id} if context unavailable', () => {
    // Clear context
    clearRequestContext();

    stateMachine.notifyCompletion(workflow);

    expect(publishedEvent).toEqual(
      expect.objectContaining({
        trace_id: `trace-${workflow.id}`,  // ✅ Fallback
      })
    );
  });
});
```

**Integration Test**:
```typescript
describe('Distributed Tracing', () => {
  it('should maintain same trace_id across workflow lifecycle', async () => {
    const traceId = 'trace-dist-123';
    setRequestContext({ trace_id: traceId, workflow_id: 'wf-789' });

    // Initiate workflow
    const workflow = await orchestrator.initiate(...);

    // Complete workflow
    await orchestrator.complete(workflow.id);

    // Verify all logs and events have same trace_id
    const logs = getLogsByWorkflow(workflow.id);
    logs.forEach(log => {
      expect(log.trace_id).toBe(traceId);
    });

    const events = getEventsByWorkflow(workflow.id);
    events.forEach(event => {
      expect(event.trace_id).toBe(traceId);
    });
  });
});
```

### Blockers & Dependencies
- **Blocker**: None (after Phase 1)
- **Dependency**: Phase 1 (enum unification)
- **Can Parallelize**: With Phase 2

### Risk Assessment - Phase 3
| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Trace_id format change breaks observability | Medium | Medium | Use fallback pattern, maintain backward compatibility |
| RequestContext not available in some paths | Low | High | Use fallback to `trace-${id}` |
| Missing imports causing build failures | Low | Medium | Comprehensive grep search before coding |

---

## Phase 4: Fix Pipeline Pause/Resume Persistence (BLOCKER - Feature Complete)

**Objective**: Persist pause/resume state to database (survives service restart)
**Estimated Effort**: 2-3 hours
**Severity**: BLOCKER
**Dependency**: Requires Phase 1 (enum unification)
**Cannot Parallelize**: Requires DB schema (Phase 1 for enum, but own schema work)

### Current State
**Issue**: In-memory Map only, no database persistence

```typescript
// pipeline-executor.service.ts Line 35
private activeExecutions: Map<string, PipelineExecution> = new Map();

// Line 565: pauseExecution()
pauseExecution(execution_id: string): void {
  const execution = this.activeExecutions.get(execution_id);
  execution.status = 'paused';  // ✅ Memory updated
  // ❌ MISSING: await db.pipelineExecution.update(...)
}

// Line 578: resumeExecution()
resumeExecution(execution_id: string): void {
  const execution = this.activeExecutions.get(execution_id);
  execution.status = 'running';  // ✅ Memory updated
  // ❌ MISSING: await db.pipelineExecution.update(...)
}
```

**Impact**:
- Service restart loses pause/resume state
- Running executions unexpectedly resume after crash
- No audit trail of pause/resume operations
- No recovery from persistent state

### Implementation Strategy

#### 4.1 Create PipelineExecution Prisma Model
**File**: `schema.prisma`
**Task**: Add new table to track active pipeline executions

```prisma
model PipelineExecution {
  id            String   @id @default(cuid())
  pipeline_id   String
  workflow_id   String
  status        WorkflowStatus  @default(initiated)
  current_stage Int
  started_at    DateTime
  paused_at     DateTime?
  resumed_at    DateTime?
  completed_at  DateTime?
  failed_at     DateTime?
  error_message String?

  // Metadata
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt
  version       Int      @default(1)  // For CAS pattern

  // Relationships
  pipeline      Pipeline   @relation(fields: [pipeline_id], references: [id])
  workflow      Workflow   @relation(fields: [workflow_id], references: [id])

  @@index([workflow_id])
  @@index([status])
  @@index([created_at])
}

// Update Pipeline model to include relationship
model Pipeline {
  // ... existing fields
  executions    PipelineExecution[]
}

// Update Workflow model to include relationship
model Workflow {
  // ... existing fields
  executions    PipelineExecution[]
}
```

**Success Criteria**:
- [ ] Model defined with all required fields
- [ ] Relationships to Pipeline and Workflow
- [ ] version field for CAS pattern
- [ ] Timestamps for tracking
- [ ] Indexes for common queries

#### 4.2 Create Prisma Migration
**Task**: Generate migration for new table

```bash
pnpm prisma migrate dev --name "add_pipeline_execution_table"
```

**Output**:
- `prisma/migrations/[timestamp]_add_pipeline_execution_table/migration.sql`

**Verify**:
```bash
pnpm prisma generate
```

**Success Criteria**:
- [ ] Migration file created and valid SQL
- [ ] prisma generate succeeds
- [ ] No TypeScript errors in generated client
- [ ] Schema is deployable

#### 4.3 Create PipelineExecutionRepository
**File**: `packages/orchestrator/src/repositories/pipeline-execution.repository.ts`
**Task**: Implement repository for DB persistence with CAS pattern

```typescript
import { PrismaClient } from '@prisma/client';
import { Logger } from 'pino';
import { WorkflowStatus } from '@agentic-sdlc/shared-types';

const MAX_RETRIES = 5;
const RETRY_DELAY = 100;  // ms

export interface CreatePipelineExecutionInput {
  pipeline_id: string;
  workflow_id: string;
  current_stage: number;
}

export interface UpdatePipelineExecutionInput {
  status?: WorkflowStatus;
  current_stage?: number;
  paused_at?: Date | null;
  resumed_at?: Date | null;
  completed_at?: Date | null;
  failed_at?: Date | null;
  error_message?: string | null;
}

export class PipelineExecutionRepository {
  constructor(
    private prisma: PrismaClient,
    private logger: Logger
  ) {}

  async create(input: CreatePipelineExecutionInput): Promise<PipelineExecution> {
    return this.prisma.pipelineExecution.create({
      data: {
        pipeline_id: input.pipeline_id,
        workflow_id: input.workflow_id,
        current_stage: input.current_stage,
        status: 'initiated',
        started_at: new Date(),
      },
    });
  }

  async getById(id: string): Promise<PipelineExecution | null> {
    return this.prisma.pipelineExecution.findUnique({
      where: { id },
    });
  }

  async getByWorkflowId(workflow_id: string): Promise<PipelineExecution[]> {
    return this.prisma.pipelineExecution.findMany({
      where: { workflow_id },
      orderBy: { created_at: 'desc' },
    });
  }

  // ✅ CAS Pattern (Compare-And-Swap) with retry
  async updateWithCAS(
    id: string,
    updates: UpdatePipelineExecutionInput,
    expectedVersion: number
  ): Promise<PipelineExecution> {
    let retries = 0;

    while (retries < MAX_RETRIES) {
      try {
        const result = await this.prisma.pipelineExecution.update({
          where: { id },
          data: {
            ...updates,
            version: expectedVersion + 1,
          },
          // Only update if version matches (optimistic lock)
          where: {
            id,
            version: expectedVersion,
          },
        });

        return result;
      } catch (error) {
        if (error.code === 'P2025') {  // Record not found (version mismatch)
          // Version changed, retry with fresh data
          const current = await this.getById(id);
          if (!current) throw new Error('PipelineExecution not found');

          retries++;
          if (retries < MAX_RETRIES) {
            await this.delay(RETRY_DELAY);
            continue;
          }
        }
        throw error;
      }
    }

    throw new Error(`Failed to update after ${MAX_RETRIES} retries`);
  }

  async updateStatus(
    id: string,
    status: WorkflowStatus
  ): Promise<PipelineExecution> {
    const current = await this.getById(id);
    if (!current) throw new Error('PipelineExecution not found');

    return this.updateWithCAS(id, { status }, current.version);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

**Success Criteria**:
- [ ] Repository created with all CRUD operations
- [ ] CAS pattern implemented with retry
- [ ] getById, getByWorkflowId queries implemented
- [ ] updateStatus uses CAS pattern
- [ ] Error handling for concurrent updates

#### 4.4 Update PipelineExecutor Service
**File**: `packages/orchestrator/src/services/pipeline-executor.service.ts`
**Task**: Replace in-memory Map with database persistence

**Current Code** (WRONG):
```typescript
export class PipelineExecutorService {
  private activeExecutions: Map<string, PipelineExecution> = new Map();

  pauseExecution(execution_id: string): void {
    const execution = this.activeExecutions.get(execution_id);
    execution.status = 'paused';  // ❌ Only memory, no DB
  }

  resumeExecution(execution_id: string): void {
    const execution = this.activeExecutions.get(execution_id);
    execution.status = 'running';  // ❌ Only memory, no DB
  }
}
```

**New Code** (CORRECT):
```typescript
export class PipelineExecutorService {
  constructor(
    private pipelineExecutionRepository: PipelineExecutionRepository,
    private logger: Logger
  ) {}

  async pauseExecution(execution_id: string): Promise<void> {
    try {
      const execution = await this.pipelineExecutionRepository.getById(execution_id);
      if (!execution) throw new Error('Execution not found');

      // ✅ Persist to DB
      await this.pipelineExecutionRepository.updateStatus(
        execution_id,
        WorkflowStatusEnum.PAUSED
      );

      const updated = await this.pipelineExecutionRepository.getById(execution_id);
      updated.paused_at = new Date();

      logger.info('Pipeline execution paused', {
        execution_id,
        workflow_id: updated.workflow_id,
        trace_id: getRequestContext()?.trace_id,
      });

      return updated;
    } catch (error) {
      logger.error('Failed to pause execution', {
        execution_id,
        error,
        trace_id: getRequestContext()?.trace_id,
      });
      throw error;
    }
  }

  async resumeExecution(execution_id: string): Promise<void> {
    try {
      const execution = await this.pipelineExecutionRepository.getById(execution_id);
      if (!execution) throw new Error('Execution not found');

      // ✅ Persist to DB
      await this.pipelineExecutionRepository.updateStatus(
        execution_id,
        WorkflowStatusEnum.RUNNING
      );

      const updated = await this.pipelineExecutionRepository.getById(execution_id);
      updated.resumed_at = new Date();

      logger.info('Pipeline execution resumed', {
        execution_id,
        workflow_id: updated.workflow_id,
        trace_id: getRequestContext()?.trace_id,
      });

      return updated;
    } catch (error) {
      logger.error('Failed to resume execution', {
        execution_id,
        error,
        trace_id: getRequestContext()?.trace_id,
      });
      throw error;
    }
  }

  async createExecution(pipeline_id: string, workflow_id: string): Promise<PipelineExecution> {
    // ✅ Persist new execution to DB
    return this.pipelineExecutionRepository.create({
      pipeline_id,
      workflow_id,
      current_stage: 0,
    });
  }

  async recoveryExistingExecutions(): Promise<void> {
    // ✅ On service startup, load paused executions from DB
    const paused = await this.pipelineExecutionRepository.findByStatus(
      WorkflowStatusEnum.PAUSED
    );

    logger.info('Recovered paused executions on startup', {
      count: paused.length,
    });

    // Resume or clean up based on strategy
    for (const execution of paused) {
      logger.info('Recovered paused execution', {
        execution_id: execution.id,
        workflow_id: execution.workflow_id,
      });
    }
  }
}
```

**Key Changes**:
1. Remove in-memory Map
2. Inject PipelineExecutionRepository
3. All operations persist to DB
4. Add error handling and logging
5. Add recovery on service startup
6. All functions are async (await DB calls)

**Success Criteria**:
- [ ] In-memory Map removed
- [ ] All operations persist to DB
- [ ] Error handling for DB failures
- [ ] Logging with trace_id
- [ ] Recovery on startup implemented
- [ ] All functions are async

#### 4.5 Update Service Initialization
**Task**: Inject repository into service

```typescript
// In orchestrator container/DI setup
const pipelineExecutionRepository = new PipelineExecutionRepository(
  prisma,
  logger
);

const pipelineExecutor = new PipelineExecutorService(
  pipelineExecutionRepository,
  logger
);

// On service startup
await pipelineExecutor.recoveryExistingExecutions();
```

**Success Criteria**:
- [ ] Repository injected into service
- [ ] Recovery called on startup
- [ ] All dependencies wired correctly

#### 4.6 Handle Concurrent Updates (CAS Pattern)
**Task**: Verify CAS pattern prevents lost updates

**Pattern** (already in repository):
```typescript
// Optimistic locking with version field
// Only updates if version matches
const result = await prisma.pipelineExecution.update({
  where: { id, version: expectedVersion },
  data: { ...updates, version: expectedVersion + 1 },
});
```

**Success Criteria**:
- [ ] CAS pattern implemented in repository
- [ ] Retry logic with exponential backoff
- [ ] No lost updates in concurrent scenarios

### Testing for Phase 4

**Unit Test**:
```typescript
describe('PipelineExecutionRepository', () => {
  it('should persist pause status to database', async () => {
    const execution = await repository.create({
      pipeline_id: 'p-1',
      workflow_id: 'w-1',
      current_stage: 2,
    });

    await repository.updateStatus(execution.id, 'paused');

    const updated = await repository.getById(execution.id);
    expect(updated.status).toBe('paused');
  });

  it('should use CAS pattern to prevent lost updates', async () => {
    const execution = await repository.create(...);

    // Concurrent updates
    const p1 = repository.updateWithCAS(
      execution.id,
      { current_stage: 2 },
      execution.version
    );
    const p2 = repository.updateWithCAS(
      execution.id,
      { current_stage: 3 },
      execution.version
    );

    // One should succeed, other should retry and succeed with new version
    const [result1] = await Promise.all([p1, p2]);

    const final = await repository.getById(execution.id);
    expect(final.version).toBeGreaterThan(execution.version);
  });

  it('should recover paused executions on startup', async () => {
    const execution = await repository.create(...);
    await repository.updateStatus(execution.id, 'paused');

    const recovered = await repository.findByStatus('paused');

    expect(recovered).toContainEqual(
      expect.objectContaining({
        id: execution.id,
        status: 'paused',
      })
    );
  });
});
```

**Integration Test**:
```typescript
describe('Pipeline Pause/Resume Persistence', () => {
  it('should persist pause state across service restart', async () => {
    // Start pipeline
    const execution = await service.createExecution('p-1', 'w-1');

    // Pause it
    await service.pauseExecution(execution.id);

    // Simulate service restart
    await service.stop();
    await service.recoveryExistingExecutions();
    await service.start();

    // Verify state persisted
    const recovered = await service.getExecution(execution.id);
    expect(recovered.status).toBe('paused');
  });

  it('should resume paused execution', async () => {
    const execution = await service.createExecution('p-1', 'w-1');
    await service.pauseExecution(execution.id);

    await service.resumeExecution(execution.id);

    const updated = await service.getExecution(execution.id);
    expect(updated.status).toBe('running');
    expect(updated.resumed_at).not.toBeNull();
  });
});
```

### Blockers & Dependencies
- **Blocker**: None (after Phase 1 for enums, but own schema work)
- **Dependency**: Phase 1 (enum unification)
- **Cannot Parallelize**: Requires new DB table

### Risk Assessment - Phase 4
| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| DB migration blocks other services | Low | Medium | Non-breaking migration, add nullable columns |
| Performance impact of DB queries | Low | Medium | Add indexes, monitor query performance |
| Concurrent update race conditions | Medium | High | Implement CAS pattern with retry |
| Data migration from in-memory to DB | Low | High | Create migration script for existing data |

---

## Phase 5: Improve Logging & Naming (MEDIUM - Polish)

**Objective**: Improve code quality, clarity, and observability
**Estimated Effort**: 1-2 hours
**Severity**: MEDIUM (Code quality and robustness)
**Dependency**: None (can run after Phase 1 for enum access)
**Can Parallelize**: Yes, independently after Phase 1

### Current State
**Issues**:
1. Function name `updateWorkflowStatus()` misleading - only updates stage
2. Terminal status check missing 'paused' and lacks null checks
3. Missing logging in critical sections (markComplete, error handlers)

### Implementation Strategy

#### 5.1 Rename updateWorkflowStatus() → updateWorkflowStage()
**File**: `packages/orchestrator/src/state-machine/workflow-state-machine.ts`
**Line**: 215
**Task**: Clarify function intent

**Current Code** (MISLEADING):
```typescript
private updateWorkflowStatus(workflow: Workflow, event: WorkflowEvent): void {
  // Only updates stage, not status!
  workflow.current_stage = event.stage;

  logger.info('Workflow status updated successfully', {
    // Misleading - says "status" but only stage changed
    workflow_id: workflow.id,
    new_stage: event.stage,
  });
}
```

**New Code** (CLEAR):
```typescript
private updateWorkflowStage(workflow: Workflow, event: WorkflowEvent): void {
  // ✅ Name clearly indicates only stage is updated
  workflow.current_stage = event.stage;

  logger.info('Workflow stage updated', {
    // Accurate - now says "stage"
    workflow_id: workflow.id,
    new_stage: event.stage,
    trace_id: getRequestContext()?.trace_id,
  });
}
```

**Changes Required**:
1. Rename function definition
2. Update all callers
3. Update logging message
4. Add trace_id to logging

**Search for Callers**:
```bash
grep -r "updateWorkflowStatus" packages/orchestrator --include="*.ts"
```

**Success Criteria**:
- [ ] Function renamed throughout
- [ ] All callers updated
- [ ] Logging message updated
- [ ] No references to old name
- [ ] Build passes

#### 5.2 Fix Terminal Status Check
**File**: `packages/orchestrator/src/state-machine/workflow-state-machine.ts`
**Line**: 890
**Task**: Add defensive checks and include 'paused'

**Current Code** (INCOMPLETE):
```typescript
const isTerminal = ['completed', 'failed', 'cancelled'].includes(workflow.status);
```

**Problems**:
1. Missing 'paused' - paused workflows are terminal (no new tasks)
2. No null check - null status returns false (false negative)
3. No case-sensitivity handling - 'FAILED' vs 'failed' fails
4. No type guard

**New Code** (ROBUST):
```typescript
private isTerminalStatus(status: string | null | undefined): boolean {
  if (!status) {
    logger.warn('Terminal status check called with null/undefined status');
    return false;  // Conservative - treat undefined as non-terminal
  }

  const terminalStatuses = [
    WorkflowStatusEnum.INITIATED,
    WorkflowStatusEnum.RUNNING,
    WorkflowStatusEnum.PAUSED,
    WorkflowStatusEnum.COMPLETED,
    WorkflowStatusEnum.FAILED,
    WorkflowStatusEnum.CANCELLED,
  ];

  const normalizedStatus = status.toLowerCase();
  const isTerminal = terminalStatuses
    .map(s => s.toLowerCase())
    .includes(normalizedStatus);

  if (!isTerminal) {
    logger.warn('Unknown workflow status encountered', {
      status,
      normalizedStatus,
    });
  }

  return isTerminal;
}

// Usage:
if (!this.isTerminalStatus(workflow.status)) {
  // Create new tasks only for non-terminal states
  await this.createTasksForStage(workflow);
}
```

**Key Changes**:
1. Extract to named function for clarity
2. Check for null/undefined explicitly
3. Use enum constants for type safety
4. Normalize case-sensitivity
5. Log unexpected values
6. Add defensive programming
7. Include 'paused' as terminal

**Usage Update**:
```typescript
// Before
const isTerminal = ['completed', 'failed', 'cancelled'].includes(workflow.status);

// After
const isTerminal = this.isTerminalStatus(workflow.status);
```

**Success Criteria**:
- [ ] Function created with null/undefined checks
- [ ] 'paused' included as terminal
- [ ] Case-insensitive comparison
- [ ] Enum constants used
- [ ] Logging for unexpected values
- [ ] All callers updated

#### 5.3 Add Logging to markComplete()
**File**: `packages/orchestrator/src/state-machine/workflow-state-machine.ts`
**Line**: 386
**Task**: Add comprehensive logging and error handling

**Current Code** (MINIMAL):
```typescript
private markComplete(workflow: Workflow): void {
  // No logging, no error handling
  workflow.status = WorkflowStatusEnum.COMPLETED;
}
```

**New Code** (OBSERVABLE):
```typescript
private async markComplete(workflow: Workflow): Promise<void> {
  const context = getRequestContext();

  logger.info('Marking workflow as complete', {
    workflow_id: workflow.id,
    current_status: workflow.status,
    trace_id: context?.trace_id,
  });

  try {
    const updated = await this.workflowRepository.update(workflow.id, {
      status: WorkflowStatusEnum.COMPLETED,
      completed_at: new Date(),
    });

    logger.info('Workflow marked complete successfully', {
      workflow_id: workflow.id,
      status: updated.status,
      completed_at: updated.completed_at,
      trace_id: context?.trace_id,
    });

    workflow.status = updated.status;
  } catch (error) {
    logger.error('Failed to mark workflow complete', {
      workflow_id: workflow.id,
      error,
      trace_id: context?.trace_id,
    });
    throw error;  // Propagate error to caller
  }
}
```

**Key Changes**:
1. Add logging before operation
2. Call repository.update() with timestamp
3. Add error handling with try/catch
4. Log success with details
5. Log errors with context
6. Make function async
7. Include trace_id in all logs

**Success Criteria**:
- [ ] Before/after logging
- [ ] Error handling implemented
- [ ] Repository.update() called
- [ ] trace_id included in logs
- [ ] Function is async
- [ ] Error propagated

#### 5.4 Add Error Handler Logging
**Task**: Find all error handlers and add comprehensive logging

**Search**:
```bash
grep -r "catch" packages/orchestrator --include="*.ts" | grep -v "logger"
```

**Pattern** (apply to all error handlers):
```typescript
try {
  // Operation
} catch (error) {
  logger.error('Operation failed', {
    workflow_id: workflow.id,
    error: error.message,
    stack: error.stack,
    trace_id: getRequestContext()?.trace_id,
  });
  // Handle or propagate
}
```

**Success Criteria**:
- [ ] All catch blocks have logging
- [ ] Error message and stack included
- [ ] trace_id included
- [ ] Context information included

#### 5.5 Verify All Logging Includes trace_id
**Task**: Audit all logger calls to include trace_id

**Pattern**:
```typescript
logger.info('Message', {
  workflow_id: id,
  trace_id: getRequestContext()?.trace_id,  // ✅ Always include
});
```

**Search**:
```bash
grep -r "logger\." packages/orchestrator --include="*.ts" | grep -v "trace_id"
```

**Fix**: Add trace_id to any missing locations

**Success Criteria**:
- [ ] All logger.info() calls have trace_id
- [ ] All logger.error() calls have trace_id
- [ ] All logger.warn() calls have trace_id

### Testing for Phase 5

**Unit Test**:
```typescript
describe('Terminal Status Checks', () => {
  it('should identify paused as terminal', () => {
    expect(isTerminalStatus('paused')).toBe(true);
  });

  it('should handle null gracefully', () => {
    expect(isTerminalStatus(null)).toBe(false);
  });

  it('should be case-insensitive', () => {
    expect(isTerminalStatus('FAILED')).toBe(true);
    expect(isTerminalStatus('Failed')).toBe(true);
  });

  it('should log unknown statuses', () => {
    isTerminalStatus('unknown');
    expect(mockLogger.warn).toHaveBeenCalled();
  });
});

describe('markComplete Logging', () => {
  it('should log before and after marking complete', async () => {
    await service.markComplete(workflow);

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Marking workflow as complete',
      expect.any(Object)
    );

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Workflow marked complete successfully',
      expect.any(Object)
    );
  });

  it('should log errors when marking complete fails', async () => {
    mockRepository.update.mockRejectedValue(new Error('DB error'));

    try {
      await service.markComplete(workflow);
    } catch (e) {
      // Expected
    }

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to mark workflow complete',
      expect.objectContaining({ error: expect.any(Object) })
    );
  });
});
```

### Blockers & Dependencies
- **Blocker**: None
- **Dependency**: Phase 1 (enum constants)
- **Can Parallelize**: Yes, independently

### Risk Assessment - Phase 5
| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Naming change breaks callers | Low | Medium | Comprehensive grep search, build validation |
| Logging performance impact | Low | Low | Already using Pino, minimal overhead |
| Defensive checks cause unexpected behavior | Low | Medium | Comprehensive unit tests |

---

## 📊 Cross-Phase Summary

### Dependencies and Sequencing
```
Phase 1 (Enum Unification)
├─→ Phase 2 (Terminal State Persistence)
├─→ Phase 3 (trace_id Propagation) [Can parallel with Phase 2]
├─→ Phase 4 (Pause/Resume Persistence)
└─→ Phase 5 (Logging & Naming) [Can run independently after Phase 1]
```

### Resource Requirements
- **Backend Developer**: 1 person, 8-10 hours
- **Database Admin**: For schema migration review (~30 min)
- **QA/Testing**: For E2E validation (~1 hour)
- **Total Team Effort**: ~10 hours

### Testing Coverage

**Unit Tests**:
- Enum definitions (Phase 1)
- Repository CRUD operations (Phase 4)
- Terminal status checks (Phase 5)
- trace_id propagation (Phase 3)
- Error handling (All phases)

**Integration Tests**:
- Terminal state persistence flow (Phase 2)
- trace_id consistency across workflow (Phase 3)
- Pipeline pause/resume/restart (Phase 4)
- Full workflow lifecycle (All phases)

**E2E Tests**:
- Complete workflow: error handling (Phase 2)
- Service restart with paused workflow (Phase 4)
- Distributed tracing correlation (Phase 3)

### Success Metrics

**Pre-Fix**:
- Status consistency score: 65/100
- Distributed tracing: 30% (hardcoded trace_ids)
- Data persistence: 50% (events published, no DB update)
- Code clarity: 40% (misleading names, incomplete checks)

**Post-Fix Target**:
- Status consistency score: 95/100
- Distributed tracing: 100% (trace_id propagation)
- Data persistence: 100% (events + DB updates)
- Code clarity: 95% (clear names, defensive checks)

---

## 🚀 Execution Checklist

### Pre-Implementation
- [ ] EPCC_EXPLORE.md reviewed and understood
- [ ] All 7 issues clearly understood
- [ ] Team aligned on 5-phase approach
- [ ] Database backup created
- [ ] Staging environment ready for testing

### Phase 1 Execution
- [ ] Enum unification completed
- [ ] All type errors resolved
- [ ] Build passes
- [ ] Data migration script tested
- [ ] Ready for Phase 2/3

### Phase 2 & 3 Execution (Parallel)
- [ ] Terminal state persistence implemented
- [ ] trace_id propagation fixed
- [ ] All tests passing
- [ ] Both phases verified in staging

### Phase 4 Execution
- [ ] PipelineExecution table created
- [ ] Repository implementation complete
- [ ] Service integration done
- [ ] Pause/resume recovery tested
- [ ] E2E test validates restart scenario

### Phase 5 Execution
- [ ] Function renaming complete
- [ ] Terminal checks enhanced
- [ ] Logging added to critical sections
- [ ] All callers updated
- [ ] Build and tests pass

### Post-Implementation
- [ ] Full E2E pipeline test passes
- [ ] Staging validation complete
- [ ] Production deployment planned
- [ ] CLAUDE.md updated (Session #79)
- [ ] Documentation updated

---

## 📋 Final Deliverables

Upon completion of all 5 phases:

1. **Code Changes**:
   - ✅ Unified status enum
   - ✅ Terminal state persistence
   - ✅ trace_id propagation
   - ✅ Pipeline execution persistence
   - ✅ Improved logging and naming

2. **Database**:
   - ✅ PipelineExecution table
   - ✅ Schema migrations applied
   - ✅ Data migration completed

3. **Testing**:
   - ✅ 30+ unit tests
   - ✅ 10+ integration tests
   - ✅ E2E pipeline validation
   - ✅ 85%+ code coverage

4. **Documentation**:
   - ✅ Updated CLAUDE.md
   - ✅ Code comments explaining patterns
   - ✅ Migration guide for status values

5. **Quality Metrics**:
   - ✅ Status consistency: 65/100 → 95/100
   - ✅ Zero regressions
   - ✅ All tests passing
   - ✅ Build validates (turbo, types, lints)

---

## Next Steps

**Ready for CODE phase**: Yes ✅

Proceed to CODE phase to implement each phase sequentially following this plan.

Reference this EPCC_PLAN_CRITICAL_FIXES.md during coding for:
- Task breakdown and acceptance criteria
- Code examples and patterns
- Test requirements
- Risk mitigation strategies

---

**Status**: PLANNING COMPLETE
**Recommendation**: Proceed to CODE phase
**Estimated Timeline**: 8-10 hours of focused development
