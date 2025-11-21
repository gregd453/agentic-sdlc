# AgentEnvelope Schema Unification - Implementation Plan

**Session:** #65 (EPCC Plan Phase)
**Date:** 2025-11-14
**Status:** READY FOR IMPLEMENTATION ✅
**Approach:** Strategic Nuclear Cleanup - ONE Canonical State, ZERO Backward Compatibility
**Estimated Duration:** 5-7 hours
**Priority:** CRITICAL (blocking all workflows)

---

## Executive Summary

### Strategic Decision: ONE Canonical Schema

**The buildAgentEnvelope() function output IS the canonical format.**

**Why:**
- ✅ Already implemented and tested in production code
- ✅ Includes all required fields (tracing, context passing, execution control)
- ✅ Orchestrator is the authority (producer owns the contract)
- ✅ Minimal changes needed (only add message_id and clean up structure)

**NOT Going With TaskAssignmentSchema Because:**
- ❌ Created in Session #64 based on false assumption
- ❌ Doesn't match production reality
- ❌ Missing critical fields (span_id, parent_span_id, workflow_context)
- ❌ Would require massive orchestrator rewrite

### The ONE Canonical State

```typescript
/**
 * AgentEnvelope - THE canonical task format
 * Session #65: Unified schema based on buildAgentEnvelope() production format
 */
export const AgentEnvelopeSchema = z.object({
  // === Identification & Idempotency ===
  message_id: z.string().uuid(),           // NEW: Idempotency key
  task_id: z.string().uuid(),
  workflow_id: z.string().uuid(),

  // === Routing ===
  agent_type: z.enum(['scaffold', 'validation', 'e2e_test', 'integration', 'deployment']),

  // === Execution Control ===
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['pending', 'queued', 'running']),
  constraints: z.object({
    timeout_ms: z.number().default(300000),
    max_retries: z.number().default(3),
    required_confidence: z.number().min(0).max(100).default(80)
  }),
  retry_count: z.number().default(0),

  // === Payload ===
  payload: z.record(z.unknown()),          // Agent-specific data

  // === Metadata ===
  metadata: z.object({
    created_at: z.string().datetime(),
    created_by: z.string(),
    envelope_version: z.literal('2.0.0')   // Version bump: 1.0.0 → 2.0.0 (breaking change)
  }),

  // === Distributed Tracing (Session #60) ===
  trace: z.object({
    trace_id: z.string(),
    span_id: z.string(),
    parent_span_id: z.string().optional()
  }),

  // === Workflow Context (Stage Output Passing) ===
  workflow_context: z.object({
    workflow_type: z.string(),
    workflow_name: z.string(),
    current_stage: z.string(),
    stage_outputs: z.record(z.unknown())
  })
});

export type AgentEnvelope = z.infer<typeof AgentEnvelopeSchema>;
```

### What Changed from Current State

**Added:**
- ✅ `message_id` - Idempotency key (UUID v4)
- ✅ `constraints` object - Groups timeout_ms, max_retries, required_confidence
- ✅ `metadata` object - Groups created_at, created_by, envelope_version
- ✅ `trace` object - Groups trace_id, span_id, parent_span_id
- ✅ `priority` enum - Changed from string literal to enum

**Removed:**
- ❌ All flat fields moved into nested objects
- ❌ TaskAssignmentSchema (replaced by AgentEnvelopeSchema)
- ❌ TaskResultSchema rename (keep as-is, working correctly)
- ❌ Old envelope validation code (Session #36-37)

**Preserved:**
- ✅ All existing functionality (tracing, context passing, execution control)
- ✅ Agent-specific payloads
- ✅ Workflow context passing
- ✅ Result schema (TaskResultSchema unchanged)

---

## Phase 1: Schema Definition (1 hour)

### 1.1 Create AgentEnvelopeSchema

**File:** `packages/shared/types/src/messages/agent-envelope.ts` (NEW)

```typescript
/**
 * AgentEnvelope - Canonical Task Assignment Format
 * Session #65: Unified schema based on buildAgentEnvelope() production format
 *
 * This is THE ONLY valid schema for tasks sent from orchestrator to agents.
 * Version 2.0.0 - Breaking change from 1.0.0 (Session #64 cleanup)
 */

import { z } from 'zod';

// === Priority Levels ===
export const PriorityEnum = z.enum(['low', 'medium', 'high', 'critical']);
export type Priority = z.infer<typeof PriorityEnum>;

// === Task Status ===
export const TaskStatusEnum = z.enum(['pending', 'queued', 'running']);
export type TaskStatus = z.infer<typeof TaskStatusEnum>;

// === Agent Types ===
export const AgentTypeEnum = z.enum([
  'scaffold',
  'validation',
  'e2e_test',
  'integration',
  'deployment'
]);
export type AgentType = z.infer<typeof AgentTypeEnum>;

// === Execution Constraints ===
export const ExecutionConstraintsSchema = z.object({
  timeout_ms: z.number().int().min(1000).default(300000),  // Min 1s, default 5min
  max_retries: z.number().int().min(0).max(10).default(3),
  required_confidence: z.number().min(0).max(100).default(80)
});
export type ExecutionConstraints = z.infer<typeof ExecutionConstraintsSchema>;

// === Envelope Metadata ===
export const EnvelopeMetadataSchema = z.object({
  created_at: z.string().datetime(),
  created_by: z.string(),
  envelope_version: z.literal('2.0.0')  // Version 2.0.0
});
export type EnvelopeMetadata = z.infer<typeof EnvelopeMetadataSchema>;

// === Trace Context (Session #60) ===
export const TraceContextSchema = z.object({
  trace_id: z.string(),                 // UUID v4 or custom trace ID
  span_id: z.string(),                  // 16-char hex
  parent_span_id: z.string().optional() // 16-char hex (optional for root span)
});
export type TraceContext = z.infer<typeof TraceContextSchema>;

// === Workflow Context (Stage Output Passing) ===
export const WorkflowContextSchema = z.object({
  workflow_type: z.string(),            // 'app' | 'service' | 'feature' | 'capability'
  workflow_name: z.string(),
  current_stage: z.string(),            // 'initialization' | 'validation' | etc.
  stage_outputs: z.record(z.unknown())  // Previous stage outputs
});
export type WorkflowContext = z.infer<typeof WorkflowContextSchema>;

// === CANONICAL SCHEMA ===
export const AgentEnvelopeSchema = z.object({
  // Identification & Idempotency
  message_id: z.string().uuid(),
  task_id: z.string().uuid(),
  workflow_id: z.string().uuid(),

  // Routing
  agent_type: AgentTypeEnum,

  // Execution Control
  priority: PriorityEnum,
  status: TaskStatusEnum,
  constraints: ExecutionConstraintsSchema,
  retry_count: z.number().int().min(0).default(0),

  // Payload (agent-specific data)
  payload: z.record(z.unknown()),

  // Metadata
  metadata: EnvelopeMetadataSchema,

  // Distributed Tracing
  trace: TraceContextSchema,

  // Workflow Context
  workflow_context: WorkflowContextSchema
});

export type AgentEnvelope = z.infer<typeof AgentEnvelopeSchema>;

// === Type Guards ===
export const isAgentEnvelope = (data: unknown): data is AgentEnvelope => {
  return AgentEnvelopeSchema.safeParse(data).success;
};

// === Validation Helper ===
export const validateAgentEnvelope = (data: unknown): AgentEnvelope => {
  return AgentEnvelopeSchema.parse(data);
};
```

### 1.2 Update shared-types Index

**File:** `packages/shared/types/src/index.ts`

```typescript
// SESSION #65: AgentEnvelope is THE canonical task format (v2.0.0)
export {
  AgentEnvelopeSchema,
  AgentEnvelope,
  PriorityEnum,
  Priority,
  TaskStatusEnum,
  TaskStatus,
  AgentTypeEnum,
  AgentType,
  ExecutionConstraintsSchema,
  ExecutionConstraints,
  EnvelopeMetadataSchema,
  EnvelopeMetadata,
  TraceContextSchema,
  TraceContext,
  WorkflowContextSchema,
  WorkflowContext,
  isAgentEnvelope,
  validateAgentEnvelope
} from './messages/agent-envelope';

// Keep TaskResultSchema (unchanged, working correctly)
export {
  TaskResultSchema,
  TaskResult
} from './messages/task-contracts';

// SESSION #65: Remove TaskAssignmentSchema exports (replaced by AgentEnvelopeSchema)
// DELETE: export { TaskAssignmentSchema, TaskAssignment } from './messages/task-contracts';
```

### 1.3 Delete Obsolete Schemas

**Files to DELETE:**
1. `packages/shared/types/src/messages/task-contracts.ts` (Lines 1-107)
   - Keep only TaskResultSchema (Lines 62-97)
   - Delete TaskAssignmentSchema (Lines 27-55)
   - Delete ExecutionEnvelopeSchema alias (Lines 104-106)

**Result:** `task-contracts.ts` becomes 40 lines (just TaskResultSchema + exports)

---

## Phase 2: Update Orchestrator (2-3 hours)

### 2.1 Update buildAgentEnvelope()

**File:** `packages/orchestrator/src/services/workflow.service.ts`
**Lines:** 994-1100+ → Rewrite to produce AgentEnvelopeSchema

**Before (Current - Lines 1020-1040):**
```typescript
const envelopeBase = {
  task_id: taskId,
  workflow_id: workflowId,
  priority: 'medium' as const,
  status: 'pending' as const,
  retry_count: 0,
  max_retries: 3,
  timeout_ms: 300000,
  created_at: now,
  trace_id: traceId,
  span_id: taskSpanId,
  parent_span_id: parentSpanId,
  envelope_version: '1.0.0' as const,
  workflow_context: {
    workflow_type: workflow.type,
    workflow_name: workflow.name,
    current_stage: stage,
    stage_outputs: stageOutputs
  }
};
```

**After (AgentEnvelopeSchema v2.0.0):**
```typescript
/**
 * SESSION #65: Build agent envelope conforming to AgentEnvelopeSchema v2.0.0
 * This is the canonical task format - single source of truth
 */
private buildAgentEnvelope(
  taskId: string,
  workflowId: string,
  stage: string,
  agentType: AgentType,  // Use typed enum
  stageOutputs: Record<string, any>,
  workflowData: any,
  workflow: any
): AgentEnvelope {
  const now = new Date().toISOString();

  // Generate message_id for idempotency
  const messageId = randomUUID();

  // Propagate trace_id from workflow and create child span context (Session #60)
  const traceId = workflow.trace_id || generateTraceIdUtil();
  const parentSpanId = workflow.current_span_id;
  const taskSpanId = generateSpanId();

  logger.info('🔍 [SESSION #65] Building AgentEnvelope v2.0.0', {
    message_id: messageId,
    task_id: taskId,
    workflow_id: workflowId,
    trace_id: traceId,
    span_id: taskSpanId,
    parent_span_id: parentSpanId,
    stage,
    agent_type: agentType
  });

  // Common envelope base conforming to AgentEnvelopeSchema
  const envelopeBase: Omit<AgentEnvelope, 'payload'> = {
    // Identification & Idempotency
    message_id: messageId,
    task_id: taskId,
    workflow_id: workflowId,

    // Routing
    agent_type: agentType,

    // Execution Control
    priority: 'medium',  // Will be enum in schema
    status: 'pending',   // Will be enum in schema
    constraints: {
      timeout_ms: 300000,
      max_retries: 3,
      required_confidence: 80
    },
    retry_count: 0,

    // Metadata
    metadata: {
      created_at: now,
      created_by: 'orchestrator',
      envelope_version: '2.0.0'
    },

    // Distributed Tracing
    trace: {
      trace_id: traceId,
      span_id: taskSpanId,
      parent_span_id: parentSpanId
    },

    // Workflow Context
    workflow_context: {
      workflow_type: workflow.type,
      workflow_name: workflow.name,
      current_stage: stage,
      stage_outputs: stageOutputs
    }
  };

  // Build agent-specific envelope based on type
  switch (agentType) {
    case 'scaffold': {
      return {
        ...envelopeBase,
        payload: {
          project_type: workflow.type,
          name: workflow.name,
          description: workflow.description || '',
          tech_stack: workflowData.tech_stack || {
            language: 'typescript',
            runtime: 'node',
            testing: 'vitest',
            package_manager: 'pnpm'
          },
          requirements: workflowData.requirements || []
        }
      };
    }

    case 'validation': {
      return {
        ...envelopeBase,
        payload: {
          project_path: stageOutputs.initialization?.project_path,
          policies: workflowData.validation_policies || {},
          quality_gates: workflowData.quality_gates || {}
        }
      };
    }

    case 'e2e_test': {
      return {
        ...envelopeBase,
        payload: {
          project_path: stageOutputs.initialization?.project_path,
          base_url: workflowData.base_url || 'http://localhost:3000',
          test_framework: workflowData.test_framework || 'playwright'
        }
      };
    }

    case 'integration': {
      return {
        ...envelopeBase,
        payload: {
          project_path: stageOutputs.initialization?.project_path,
          git_repo: workflowData.git_repo || '',
          ci_config: workflowData.ci_config || {}
        }
      };
    }

    case 'deployment': {
      return {
        ...envelopeBase,
        payload: {
          project_path: stageOutputs.initialization?.project_path,
          target_env: workflowData.target_env || 'staging',
          deployment_config: workflowData.deployment_config || {}
        }
      };
    }

    default: {
      throw new Error(`Unknown agent type: ${agentType}`);
    }
  }
}
```

### 2.2 Update Imports

**File:** `packages/orchestrator/src/services/workflow.service.ts`
**Lines:** 1-15

**Remove:**
```typescript
import { CreateWorkflowRequest, TaskAssignment, WorkflowResponse } from '../types';
```

**Add:**
```typescript
import { CreateWorkflowRequest, WorkflowResponse } from '../types';
import { AgentEnvelope, AgentType } from '@agentic-sdlc/shared-types';
```

### 2.3 Update Type Annotations

**File:** `packages/orchestrator/src/types/index.ts`

**Remove:**
```typescript
export { TaskAssignment } from '@agentic-sdlc/shared-types';
```

**Add:**
```typescript
export { AgentEnvelope } from '@agentic-sdlc/shared-types';
```

---

## Phase 3: Update BaseAgent (1 hour)

### 3.1 Update Imports

**File:** `packages/agents/base-agent/src/base-agent.ts`
**Lines:** 1-22

**Remove:**
```typescript
import {
  TaskAssignment,
  TaskAssignmentSchema,
  // ...
} from './types';
```

**Add:**
```typescript
import {
  AgentEnvelope,
  AgentEnvelopeSchema,
  validateAgentEnvelope
} from '@agentic-sdlc/shared-types';
import { TaskResult, TaskResultSchema } from './types';
```

### 3.2 Update validateTask()

**File:** `packages/agents/base-agent/src/base-agent.ts`
**Lines:** 285-296

**Before:**
```typescript
validateTask(task: unknown): TaskAssignment {
  try {
    return TaskAssignmentSchema.parse(task);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(
        'Invalid task assignment',
        error.errors
      );
    }
    throw error;
  }
}
```

**After:**
```typescript
/**
 * SESSION #65: Validate task against AgentEnvelopeSchema v2.0.0
 */
validateTask(task: unknown): AgentEnvelope {
  try {
    const envelope = AgentEnvelopeSchema.parse(task);

    this.logger.info('✅ [SESSION #65] Task validated against AgentEnvelopeSchema v2.0.0', {
      message_id: envelope.message_id,
      task_id: envelope.task_id,
      agent_type: envelope.agent_type,
      envelope_version: envelope.metadata.envelope_version
    });

    return envelope;
  } catch (error) {
    if (error instanceof z.ZodError) {
      this.logger.error('❌ [SESSION #65] Task validation failed', {
        errors: error.errors,
        task_preview: JSON.stringify(task).substring(0, 200)
      });
      throw new ValidationError(
        'Invalid agent envelope (v2.0.0)',
        error.errors
      );
    }
    throw error;
  }
}
```

### 3.3 Update execute() Signature

**File:** `packages/agents/base-agent/src/base-agent.ts`
**Line:** 298

**Before:**
```typescript
abstract execute(task: TaskAssignment): Promise<TaskResult>;
```

**After:**
```typescript
/**
 * SESSION #65: Execute task using AgentEnvelope v2.0.0
 */
abstract execute(task: AgentEnvelope): Promise<TaskResult>;
```

### 3.4 Update types.ts

**File:** `packages/agents/base-agent/src/types.ts`

**Remove (Lines 3-13):**
```typescript
// SESSION #64: Import canonical schemas from shared-types
// These are the ONLY valid schemas for task assignments and results
import {
  TaskAssignmentSchema,
  TaskAssignment,
  TaskResultSchema,
  TaskResult
} from '@agentic-sdlc/shared-types';

// Re-export for backward compatibility during migration
export { TaskAssignmentSchema, TaskAssignment, TaskResultSchema, TaskResult };
```

**Add:**
```typescript
// SESSION #65: AgentEnvelope is THE canonical task format (v2.0.0)
import {
  AgentEnvelopeSchema,
  AgentEnvelope
} from '@agentic-sdlc/shared-types';

// Keep TaskResult (unchanged, working correctly)
import {
  TaskResultSchema,
  TaskResult
} from '@agentic-sdlc/shared-types';

// Re-export
export {
  AgentEnvelopeSchema,
  AgentEnvelope,
  TaskResultSchema,
  TaskResult
};
```

### 3.5 Update AgentLifecycle Interface

**File:** `packages/agents/base-agent/src/types.ts`
**Lines:** 54-62

**Before:**
```typescript
export interface AgentLifecycle {
  initialize(): Promise<void>;
  receiveTask(message: AgentMessage): Promise<void>;
  validateTask(task: unknown): TaskAssignment;
  execute(task: TaskAssignment): Promise<TaskResult>;
  reportResult(result: TaskResult): Promise<void>;
  cleanup(): Promise<void>;
  healthCheck(): Promise<HealthStatus>;
}
```

**After:**
```typescript
/**
 * SESSION #65: Updated to use AgentEnvelope v2.0.0
 */
export interface AgentLifecycle {
  initialize(): Promise<void>;
  receiveTask(message: AgentMessage): Promise<void>;
  validateTask(task: unknown): AgentEnvelope;
  execute(task: AgentEnvelope): Promise<TaskResult>;
  reportResult(result: TaskResult): Promise<void>;
  cleanup(): Promise<void>;
  healthCheck(): Promise<HealthStatus>;
}
```

---

## Phase 4: Update All Agents (2-3 hours)

### 4.1 Scaffold Agent

**File:** `packages/agents/scaffold-agent/src/scaffold-agent.ts`
**Status:** ✅ Already mostly compatible (extracts from task.payload)

**Update execute() signature (Line 58):**

**Before:**
```typescript
async execute(task: TaskAssignment): Promise<TaskResult> {
```

**After:**
```typescript
/**
 * SESSION #65: Updated to use AgentEnvelope v2.0.0
 */
async execute(task: AgentEnvelope): Promise<TaskResult> {
```

**Update payload extraction (Lines 69-99) - NO CHANGE NEEDED:**
```typescript
// Already correct - extracts from task.payload
const payload = task.payload as any;
const scaffoldTask: ScaffoldTask = {
  task_id: task.task_id as any,
  workflow_id: task.workflow_id as any,
  // ...
};
```

**Update result construction (Lines 126-156) - Use message_id:**

**Before:**
```typescript
const result: TaskResult = {
  message_id: task.message_id,  // ← Already using it!
  task_id: scaffoldTask.task_id,
  // ...
};
```

**After - NO CHANGE NEEDED** (already uses task.message_id correctly)

### 4.2 Validation Agent

**File:** `packages/agents/validation-agent/src/validation-agent.ts`
**Status:** ❌ BROKEN (expects task.context)

**Update execute() signature (Line 67):**

**Before:**
```typescript
async execute(task: TaskAssignment): Promise<TaskResult> {
```

**After:**
```typescript
/**
 * SESSION #65: Updated to use AgentEnvelope v2.0.0
 * Removed Session #36-37 envelope extraction - now direct payload access
 */
async execute(task: AgentEnvelope): Promise<TaskResult> {
```

**DELETE old envelope extraction (Lines 77-151) - Replace with:**

```typescript
const startTime = Date.now();

this.logger.info('[SESSION #65] Executing validation task', {
  message_id: task.message_id,
  task_id: task.task_id,
  workflow_id: task.workflow_id,
  trace_id: task.trace.trace_id,
  envelope_version: task.metadata.envelope_version
});

// Extract validation data from task.payload
const payload = task.payload as any;
const validationData = {
  project_path: payload.project_path,
  policies: payload.policies || {},
  quality_gates: payload.quality_gates || {}
};

if (!validationData.project_path) {
  throw new AgentError('Missing required field: project_path', 'VALIDATION_ERROR');
}

// Verify working directory exists
const workingDir = validationData.project_path;
if (!fs.existsSync(workingDir)) {
  throw new AgentError(
    `Working directory not found: ${workingDir}`,
    'VALIDATION_ERROR'
  );
}

this.logger.info('[SESSION #65] Validation context ready', {
  project_path: workingDir,
  has_policies: Object.keys(validationData.policies).length > 0,
  has_quality_gates: Object.keys(validationData.quality_gates).length > 0
});

// Continue with validation checks...
const checks = await this.runValidationChecks(validationData);
const qualityGateResults = await this.evaluateQualityGates(checks, validationData.quality_gates);
const report = await this.generateReport(checks, qualityGateResults);

// ... rest of execute method unchanged
```

**Update imports (Lines 1-10):**

**Remove:**
```typescript
import { TaskAssignment, TaskResult } from '@agentic-sdlc/base-agent';
```

**Add:**
```typescript
import { AgentEnvelope, TaskResult } from '@agentic-sdlc/base-agent';
```

### 4.3 E2E Agent

**File:** `packages/agents/e2e-agent/src/e2e-agent.ts`

**Update execute() signature (Line 48):**

**Before:**
```typescript
async execute(task: TaskAssignment): Promise<TaskResult> {
```

**After:**
```typescript
/**
 * SESSION #65: Updated to use AgentEnvelope v2.0.0
 */
async execute(task: AgentEnvelope): Promise<TaskResult> {
```

**Update parseTaskContext() method (Line 60) - Replace with direct extraction:**

**Before:**
```typescript
const context = this.parseTaskContext(task);
```

**After:**
```typescript
const startTime = Date.now();

this.logger.info('[SESSION #65] Executing E2E test task', {
  message_id: task.message_id,
  task_id: task.task_id,
  workflow_id: task.workflow_id,
  trace_id: task.trace.trace_id
});

// Extract E2E test data from task.payload
const payload = task.payload as any;
const context = {
  project_path: payload.project_path,
  base_url: payload.base_url || 'http://localhost:3000',
  test_framework: payload.test_framework || 'playwright',
  artifact_storage: payload.artifact_storage || 'local',
  test_output_path: payload.test_output_path,
  s3_bucket: payload.s3_bucket
};

// Continue with test generation...
```

**Update imports:**

**Remove:**
```typescript
import { TaskAssignment, TaskResult } from '@agentic-sdlc/base-agent';
```

**Add:**
```typescript
import { AgentEnvelope, TaskResult } from '@agentic-sdlc/base-agent';
```

### 4.4 Integration Agent

**File:** `packages/agents/integration-agent/src/integration-agent.ts`

**Apply same pattern as E2E agent:**
1. Update execute() signature to use AgentEnvelope
2. Extract data directly from task.payload
3. Update imports
4. Remove any parseTaskContext() or envelope extraction methods

### 4.5 Deployment Agent

**File:** `packages/agents/deployment-agent/src/deployment-agent.ts`

**Apply same pattern as E2E agent:**
1. Update execute() signature to use AgentEnvelope
2. Extract data directly from task.payload
3. Update imports
4. Remove any parseTaskContext() or envelope extraction methods

---

## Phase 5: Testing & Validation (1-2 hours)

### 5.1 Build Validation

```bash
# Clean build
pnpm clean
pnpm install
pnpm build

# Expected: All 13 packages build successfully
# Expected: Zero TypeScript errors
```

### 5.2 Type Checking

```bash
pnpm typecheck

# Expected: All 19 typecheck tasks pass
# Expected: Zero type errors in all packages
```

### 5.3 Unit Tests (Create New)

**File:** `packages/orchestrator/src/services/__tests__/workflow.service.envelope.test.ts` (NEW)

```typescript
import { describe, it, expect } from 'vitest';
import { AgentEnvelopeSchema } from '@agentic-sdlc/shared-types';
import { WorkflowService } from '../workflow.service';

describe('WorkflowService.buildAgentEnvelope', () => {
  it('should produce AgentEnvelopeSchema v2.0.0 compliant envelope', async () => {
    // Create workflow service with test dependencies
    const service = createTestWorkflowService();

    // Build envelope via private method (use reflection or expose for testing)
    const envelope = await service['buildAgentEnvelope'](
      'task-123',
      'workflow-456',
      'initialization',
      'scaffold',
      {},
      { requirements: [] },
      { trace_id: 'trace-789', current_span_id: 'span-abc' }
    );

    // Should validate against schema
    expect(() => AgentEnvelopeSchema.parse(envelope)).not.toThrow();
  });

  it('should include message_id for idempotency', async () => {
    const service = createTestWorkflowService();
    const envelope = await service['buildAgentEnvelope'](/* ... */);

    expect(envelope.message_id).toMatch(/^[a-f0-9-]{36}$/);
  });

  it('should nest execution control in constraints object', async () => {
    const service = createTestWorkflowService();
    const envelope = await service['buildAgentEnvelope'](/* ... */);

    expect(envelope.constraints.timeout_ms).toBe(300000);
    expect(envelope.constraints.max_retries).toBe(3);
    expect(envelope.constraints.required_confidence).toBe(80);
  });

  it('should nest tracing in trace object', async () => {
    const service = createTestWorkflowService();
    const envelope = await service['buildAgentEnvelope'](
      'task-123',
      'workflow-456',
      'initialization',
      'scaffold',
      {},
      {},
      { trace_id: 'trace-789', current_span_id: 'span-abc' }
    );

    expect(envelope.trace.trace_id).toBe('trace-789');
    expect(envelope.trace.span_id).toMatch(/^[a-f0-9]{16}$/);
    expect(envelope.trace.parent_span_id).toBe('span-abc');
  });

  it('should use envelope_version 2.0.0', async () => {
    const service = createTestWorkflowService();
    const envelope = await service['buildAgentEnvelope'](/* ... */);

    expect(envelope.metadata.envelope_version).toBe('2.0.0');
  });
});
```

**File:** `packages/agents/base-agent/src/__tests__/base-agent.envelope.test.ts` (NEW)

```typescript
import { describe, it, expect } from 'vitest';
import { AgentEnvelopeSchema } from '@agentic-sdlc/shared-types';
import { BaseAgent } from '../base-agent';

describe('BaseAgent.validateTask', () => {
  it('should accept valid AgentEnvelope v2.0.0', () => {
    const mockEnvelope = {
      message_id: '123e4567-e89b-12d3-a456-426614174000',
      task_id: '123e4567-e89b-12d3-a456-426614174001',
      workflow_id: '123e4567-e89b-12d3-a456-426614174002',
      agent_type: 'scaffold',
      priority: 'medium',
      status: 'pending',
      constraints: {
        timeout_ms: 300000,
        max_retries: 3,
        required_confidence: 80
      },
      retry_count: 0,
      payload: { name: 'test' },
      metadata: {
        created_at: new Date().toISOString(),
        created_by: 'orchestrator',
        envelope_version: '2.0.0'
      },
      trace: {
        trace_id: 'trace-123',
        span_id: 'a1b2c3d4e5f6g7h8',
        parent_span_id: 'h8g7f6e5d4c3b2a1'
      },
      workflow_context: {
        workflow_type: 'app',
        workflow_name: 'test-app',
        current_stage: 'initialization',
        stage_outputs: {}
      }
    };

    const agent = createTestAgent();
    expect(() => agent.validateTask(mockEnvelope)).not.toThrow();
  });

  it('should reject envelope missing message_id', () => {
    const invalidEnvelope = { /* ... missing message_id */ };
    const agent = createTestAgent();

    expect(() => agent.validateTask(invalidEnvelope)).toThrow('Invalid agent envelope');
  });
});
```

### 5.4 E2E Test

```bash
# Start environment
./scripts/env/start-dev.sh

# Wait for all services to be online
pnpm pm2:status

# Run E2E workflow test
./scripts/run-pipeline-test.sh "Hello World API"

# Expected results:
# ✅ Workflow advances from 0% to 100%
# ✅ All 5 agents execute successfully
# ✅ Zero "Invalid task assignment" errors
# ✅ Workflow completes in <5 minutes
# ✅ All stage_outputs populated
```

### 5.5 Validation Checklist

**Schema Validation:**
- [ ] AgentEnvelopeSchema.parse() succeeds on buildAgentEnvelope() output
- [ ] All required fields present (message_id, task_id, workflow_id, etc.)
- [ ] All nested objects present (constraints, metadata, trace, workflow_context)
- [ ] Enum values validate correctly (priority, status, agent_type)

**Build & Type Checking:**
- [ ] `pnpm build` succeeds (all 13 packages)
- [ ] `pnpm typecheck` passes (all 19 tasks)
- [ ] Zero TypeScript compilation errors
- [ ] Zero import errors

**Agent Execution:**
- [ ] Scaffold agent executes and returns success
- [ ] Validation agent executes and returns success
- [ ] E2E agent executes and returns success
- [ ] Integration agent executes and returns success
- [ ] Deployment agent executes and returns success

**Workflow Completion:**
- [ ] Workflow advances beyond 0%
- [ ] All workflow stages complete
- [ ] stage_outputs populated correctly
- [ ] Final workflow status is 'completed'

**Tracing (Session #60):**
- [ ] trace_id propagates from workflow to tasks
- [ ] span_id generated for each task
- [ ] parent_span_id links task to workflow span
- [ ] Trace queries work (DATABASE_QUERY_GUIDE.md)

**Logging:**
- [ ] "✅ [SESSION #65] Task validated" logs appear
- [ ] "🔍 [SESSION #65] Building AgentEnvelope v2.0.0" logs appear
- [ ] Zero "Invalid task assignment" errors
- [ ] Zero "No context envelope found" errors

---

## Success Criteria

### Definition of Done

**✅ Technical:**
- AgentEnvelopeSchema is THE ONLY task schema (v2.0.0)
- All buildAgentEnvelope() output validates against AgentEnvelopeSchema
- All 5 agents use AgentEnvelope type (no TaskAssignment references)
- All unit tests pass (envelope validation tests)
- All E2E tests pass (workflow completion)
- Zero TypeScript errors (pnpm typecheck)

**✅ Functional:**
- Workflows advance from 0% to 100%
- All agents execute tasks successfully
- Zero "Invalid task assignment" errors in logs
- Trace propagation works (Session #60)
- Workflow context passing works (stage_outputs)

**✅ Cleanup:**
- TaskAssignmentSchema deleted (replaced by AgentEnvelopeSchema)
- All "SESSION #64" markers removed or updated to "SESSION #65"
- All backward compatibility code removed
- Documentation updated (CLAUDE.md, VALIDATION_REPORT.md)

---

## Rollback Plan

If implementation fails, rollback is simple:

```bash
# Stop all services
./scripts/env/stop-dev.sh

# Reset to pre-Session #65 commit
git reset --hard 1ef3728  # Session #64 Phase 1-3.1 commit

# Restart services
./scripts/env/start-dev.sh
```

**Rollback triggers:**
- Any agent fails to validate tasks (100% failure rate)
- Orchestrator crashes on envelope creation
- More than 3 TypeScript compilation errors after fixes

---

## Files Modified Summary

### Created (2 files):
1. `packages/shared/types/src/messages/agent-envelope.ts` - AgentEnvelopeSchema v2.0.0
2. `packages/orchestrator/src/services/__tests__/workflow.service.envelope.test.ts` - Unit tests

### Modified (11 files):
1. `packages/shared/types/src/index.ts` - Export AgentEnvelope, remove TaskAssignment
2. `packages/shared/types/src/messages/task-contracts.ts` - Keep only TaskResultSchema
3. `packages/orchestrator/src/services/workflow.service.ts` - Update buildAgentEnvelope()
4. `packages/orchestrator/src/types/index.ts` - Export AgentEnvelope
5. `packages/agents/base-agent/src/base-agent.ts` - Update validateTask(), execute()
6. `packages/agents/base-agent/src/types.ts` - Export AgentEnvelope
7. `packages/agents/scaffold-agent/src/scaffold-agent.ts` - Update execute() signature
8. `packages/agents/validation-agent/src/validation-agent.ts` - Remove envelope extraction
9. `packages/agents/e2e-agent/src/e2e-agent.ts` - Update execute(), remove parseTaskContext
10. `packages/agents/integration-agent/src/integration-agent.ts` - Update execute()
11. `packages/agents/deployment-agent/src/deployment-agent.ts` - Update execute()

### Deleted (0 files):
- None (task-contracts.ts kept for TaskResultSchema)

**Total Impact:** 2 new, 11 modified, 0 deleted = 13 files

---

## Estimated Timeline

| Phase | Task | Duration |
|-------|------|----------|
| 1 | Schema Definition | 1 hour |
| 2 | Update Orchestrator | 2-3 hours |
| 3 | Update BaseAgent | 1 hour |
| 4 | Update All Agents (5 agents) | 2-3 hours |
| 5 | Testing & Validation | 1-2 hours |
| **Total** | **End-to-End** | **7-10 hours** |

---

## Next Steps

1. **Review this plan** for approval
2. **Execute Phase 1** (Schema Definition)
3. **Execute Phase 2** (Update Orchestrator)
4. **Execute Phase 3** (Update BaseAgent)
5. **Execute Phase 4** (Update All Agents)
6. **Execute Phase 5** (Testing & Validation)
7. **Create VALIDATION_REPORT.md**
8. **Update CLAUDE.md** (Session #65 complete)
9. **Commit all changes** with Session #65 markers

---

**Ready for Implementation** ✅

This plan defines ONE canonical state (AgentEnvelopeSchema v2.0.0) with ZERO backward compatibility.
All agents will use the same schema. All envelopes will validate. All workflows will complete.
