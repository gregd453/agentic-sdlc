# Exploration Report: AgentEnvelope Schema Unification

**Session:** #65 (EPCC Explore Phase)
**Date:** 2025-11-14
**Status:** EXPLORATION COMPLETE ✅
**Context:** Exploring corrected approach to fix "Invalid task assignment" errors
**Previous Session:** #64 (Nuclear Cleanup Phase 1-3.1 - 40% complete, discovered false assumption)

---

## Executive Summary

### What We're Exploring
Understanding the **root cause** of schema mismatch between orchestrator and agents, and documenting the **correct unification approach** after Session #64 discovered the original plan was based on a false assumption.

### Key Discovery from Session #64
❌ **FALSE ASSUMPTION:** "Orchestrator and agents have duplicate TaskAssignmentSchema definitions"
✅ **ACTUAL TRUTH:** "Orchestrator doesn't use TaskAssignmentSchema at all - it uses `buildAgentEnvelope()` function"

### Current State (After Session #64 Phase 1-3.1)
- ✅ **40% Complete:** shared-types package created with canonical TaskAssignmentSchema
- ✅ **base-agent updated:** Now imports TaskAssignmentSchema from shared-types
- ✅ **scaffold-agent updated:** Extracts data from task.payload
- ❌ **4 agents NOT updated:** validation, e2e, integration, deployment still expect old format
- ❌ **Orchestrator NOT updated:** buildAgentEnvelope() still produces custom structure

### The Real Problem
**Schema Mismatch at the Source:**
```typescript
// What buildAgentEnvelope() ACTUALLY produces (workflow.service.ts:994-1100):
{
  task_id: string,
  workflow_id: string,
  agent_type: "scaffold",           // ← Key: agent_type (not "type")
  payload: {                         // ← Key: payload is nested object
    project_type: string,
    name: string,
    description: string,
    tech_stack: {},
    requirements: []
  },
  priority: "medium",
  status: "pending",
  trace_id: string,
  span_id: string,
  parent_span_id: string,
  workflow_context: {},
  // ... more fields
}

// What TaskAssignmentSchema expects (shared-types/messages/task-contracts.ts:27-55):
{
  message_id: string,                // ← Missing from buildAgentEnvelope
  task_id: string,
  workflow_id: string,
  agent_type: enum,
  action: string,
  priority: enum,
  payload: Record<string, unknown>,  // ← Generic payload
  constraints: {                     // ← Missing from buildAgentEnvelope
    timeout_ms: number,
    max_retries: number,
    required_confidence: number
  },
  metadata: {                        // ← Missing from buildAgentEnvelope
    created_at: string,
    created_by: string,
    trace_id: string,
    parent_task_id?: string
  }
}
```

**Result:** Agents receive messages that don't match any schema they validate against!

---

## 1. Project Context

### 1.1 Architecture Overview

**System:** Agentic SDLC - Autonomous AI-driven Software Development Lifecycle
**Pattern:** Hexagonal Architecture (Ports & Adapters) + Message Bus
**Language:** TypeScript (strict mode)
**Monorepo:** pnpm workspaces with Turbo build system

```
┌─────────────────────────────────────────────────────────────┐
│                   MESSAGE FLOW (Current)                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  HTTP Request                                               │
│       ↓                                                     │
│  Orchestrator (workflow.service.ts)                         │
│       ↓                                                     │
│  buildAgentEnvelope() (Lines 994-1100)                      │
│       ↓ Produces custom envelope structure                 │
│  Redis Message Bus                                          │
│       ↓ Published to stream:agent:{type}:tasks             │
│  BaseAgent.subscribe() (base-agent.ts:129-182)              │
│       ↓ Receives message                                   │
│  BaseAgent.validateTask() (base-agent.ts:285-296)           │
│       ↓ ❌ Validation fails with TaskAssignmentSchema      │
│  ❌ "Invalid task assignment" error                        │
│       ↓                                                     │
│  Agent never executes                                       │
│  Workflow stuck at 0%                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Key Components

**Orchestrator Package** (`packages/orchestrator/`)
- **workflow.service.ts:** Core workflow orchestration logic
  - `buildAgentEnvelope()` (Lines 994-1100+): Creates task envelopes
  - `createWorkflow()`: Workflow initialization
  - `handleAgentResult()`: Processes agent responses
- **hexagonal/core/envelope-schema.ts:** Old envelope validation system (Session #39)
- **hexagonal/adapters/redis-bus.adapter.ts:** Message bus implementation

**Shared Types Package** (`packages/shared/types/`)
- **messages/task-contracts.ts:** Canonical schemas (Created Session #64)
  - `TaskAssignmentSchema`: Standard task format
  - `TaskResultSchema`: Standard result format
- **core/schemas.ts:** Legacy core schemas (pre-Session #64)
- **envelope/agent-envelope.ts:** Agent-specific envelope types

**Base Agent Package** (`packages/agents/base-agent/`)
- **base-agent.ts:** Abstract agent implementation
  - `initialize()`: Message bus subscription
  - `receiveTask()`: Task intake and execution wrapper
  - `validateTask()`: Schema validation (Lines 285-296)
  - `execute()`: Abstract method (implemented by concrete agents)
  - `reportResult()`: Result publishing
- **types.ts:** Agent type definitions (Updated Session #64 to import from shared-types)

**Concrete Agents** (`packages/agents/{scaffold,validation,e2e,integration,deployment}-agent/`)
- **scaffold-agent:** ✅ Updated Session #64 Phase 3.1
- **validation-agent:** ❌ NOT updated (expects task.context envelope)
- **e2e-agent:** ❌ NOT updated
- **integration-agent:** ❌ NOT updated
- **deployment-agent:** ❌ NOT updated

---

## 2. Deep Dive: buildAgentEnvelope() Implementation

### 2.1 Function Location & Signature

**File:** `packages/orchestrator/src/services/workflow.service.ts`
**Lines:** 994-1100+
**Visibility:** `private` (only used within WorkflowService)

```typescript
private buildAgentEnvelope(
  taskId: string,
  workflowId: string,
  stage: string,
  agentType: string,
  stageOutputs: Record<string, any>,
  workflowData: any,
  workflow: any
): any {
  // Returns custom envelope structure
}
```

### 2.2 What It Actually Produces

**Common Base Structure** (Lines 1020-1040):
```typescript
{
  // Task identification
  task_id: taskId,                          // UUID
  workflow_id: workflowId,                  // UUID

  // Agent routing
  agent_type: agentType,                    // 'scaffold' | 'validation' | etc.

  // Execution metadata
  priority: 'medium' as const,
  status: 'pending' as const,
  retry_count: 0,
  max_retries: 3,
  timeout_ms: 300000,                       // 5 minutes
  created_at: now,                          // ISO timestamp

  // Distributed tracing (Session #60)
  trace_id: traceId,                        // Inherited from workflow
  span_id: taskSpanId,                      // New span for this task
  parent_span_id: parentSpanId,             // Link to workflow span

  // Versioning
  envelope_version: '1.0.0' as const,

  // Context
  workflow_context: {
    workflow_type: workflow.type,           // 'app' | 'service' | etc.
    workflow_name: workflow.name,
    current_stage: stage,
    stage_outputs: stageOutputs             // Previous stage outputs
  }
}
```

**Agent-Specific Payloads** (Switch statement Lines 1042+):

**Scaffold Agent** (Lines 1044-1059):
```typescript
{
  ...envelopeBase,
  agent_type: 'scaffold' as const,
  payload: {
    project_type: workflow.type,            // 'app' | 'service' | etc.
    name: workflow.name,
    description: workflow.description || '',
    tech_stack: workflowData.tech_stack || {},
    requirements: workflowData.requirements || []
  }
}
```

**Validation Agent** (Lines 1060-1075):
```typescript
{
  ...envelopeBase,
  agent_type: 'validation' as const,
  payload: {
    project_path: stageOutputs.initialization?.project_path,
    policies: workflowData.validation_policies || {},
    quality_gates: workflowData.quality_gates || {}
  }
}
```

**E2E Agent** (Lines 1076-1091):
```typescript
{
  ...envelopeBase,
  agent_type: 'e2e_test' as const,
  payload: {
    project_path: stageOutputs.initialization?.project_path,
    base_url: workflowData.base_url || 'http://localhost:3000',
    test_framework: workflowData.test_framework || 'playwright'
  }
}
```

### 2.3 Key Observations

**What's Present:**
- ✅ `agent_type` field (matches TaskAssignmentSchema)
- ✅ `task_id`, `workflow_id` (matches)
- ✅ `payload` field (matches - generic Record<string, unknown>)
- ✅ `priority` field (but as string, not enum)
- ✅ Trace fields: `trace_id`, `span_id`, `parent_span_id` (Session #60)

**What's Missing (compared to TaskAssignmentSchema):**
- ❌ `message_id` (idempotency key) - CRITICAL for deduplication
- ❌ `action` field (optional in schema)
- ❌ `constraints` object (timeout, retries, confidence) - scattered in root
- ❌ `metadata` object (created_at, created_by, trace_id) - scattered in root

**What's Extra (not in TaskAssignmentSchema):**
- ➕ `status`, `retry_count`, `max_retries` (task execution state)
- ➕ `span_id`, `parent_span_id` (should be in metadata.trace_id)
- ➕ `envelope_version` (versioning)
- ➕ `workflow_context` (context passing)

### 2.4 Why This Matters

**Implication 1: TaskAssignmentSchema is NOT the canonical format**
- buildAgentEnvelope() predates TaskAssignmentSchema (created Session #64)
- All production workflows use buildAgentEnvelope() output
- TaskAssignmentSchema was created as an "ideal" schema, not documenting reality

**Implication 2: Agents can't validate correctly**
- BaseAgent.validateTask() calls `TaskAssignmentSchema.parse(task)`
- Parse fails because buildAgentEnvelope() output doesn't match schema
- Agents reject valid orchestrator messages

**Implication 3: Two conflicting approaches**
- **Approach A:** Update buildAgentEnvelope() to produce TaskAssignmentSchema format
  - Pros: Clean, canonical schema
  - Cons: Breaks workflow_context, trace propagation, loses state fields
- **Approach B:** Update TaskAssignmentSchema to match buildAgentEnvelope() output
  - Pros: Minimal changes, preserves existing logic
  - Cons: Schema has scattered fields, less clean structure

---

## 3. Schema Analysis

### 3.1 Current Schemas in Codebase

**Schema 1: TaskAssignmentSchema** (Created Session #64)
- **File:** `packages/shared/types/src/messages/task-contracts.ts`
- **Lines:** 27-55
- **Purpose:** Intended canonical task format
- **Status:** ⚠️ NOT USED by orchestrator buildAgentEnvelope()
- **Compliance:** ❌ Orchestrator doesn't produce this format

```typescript
export const TaskAssignmentSchema = z.object({
  message_id: z.string().uuid(),           // ❌ Missing from buildAgentEnvelope
  task_id: z.string().uuid(),              // ✅ Present
  workflow_id: z.string().uuid(),          // ✅ Present
  agent_type: z.enum([...]),               // ✅ Present
  action: z.string().optional(),           // ⚠️ Missing from buildAgentEnvelope
  priority: z.enum([...]),                 // ⚠️ String in envelope, enum in schema
  payload: z.record(z.unknown()),          // ✅ Present
  constraints: z.object({                  // ❌ Missing from buildAgentEnvelope
    timeout_ms: z.number().default(300000),
    max_retries: z.number().default(3),
    required_confidence: z.number().min(0).max(100).default(80)
  }),
  metadata: z.object({                     // ❌ Missing from buildAgentEnvelope
    created_at: z.string().datetime(),
    created_by: z.string(),
    trace_id: z.string(),
    parent_task_id: z.string().optional()
  })
});
```

**Schema 2: buildAgentEnvelope() Output** (Production Format)
- **File:** `packages/orchestrator/src/services/workflow.service.ts`
- **Lines:** 994-1100+
- **Purpose:** Actual runtime task format
- **Status:** ✅ ACTIVELY USED by orchestrator
- **Compliance:** ❌ Doesn't match any Zod schema

```typescript
// Inferred type (no explicit schema):
{
  task_id: string,
  workflow_id: string,
  agent_type: string,
  payload: Record<string, unknown>,
  priority: 'medium',                      // Literal, not enum
  status: 'pending',                       // Extra field
  retry_count: number,                     // Extra field
  max_retries: number,                     // Extra field
  timeout_ms: number,                      // In root, not constraints
  created_at: string,                      // In root, not metadata
  trace_id: string,                        // In root, not metadata
  span_id: string,                         // Extra field (tracing)
  parent_span_id?: string,                 // Extra field (tracing)
  envelope_version: '1.0.0',               // Extra field (versioning)
  workflow_context: {                      // Extra field (context)
    workflow_type: string,
    workflow_name: string,
    current_stage: string,
    stage_outputs: Record<string, any>
  }
}
```

**Schema 3: Old EnvelopeSchema** (Session #39)
- **File:** `packages/orchestrator/src/hexagonal/core/envelope-schema.ts`
- **Lines:** 32-49
- **Purpose:** Generic envelope wrapper (not task-specific)
- **Status:** ⚠️ Still in codebase but NOT used for tasks
- **Compliance:** Different abstraction level (generic events, not tasks)

```typescript
export const EnvelopeBaseSchema = z.object({
  id: z.string().uuid('Envelope ID must be UUID'),
  type: z.string().min(1).regex(/^[a-z0-9.]+$/),
  ts: z.string().datetime('Timestamp must be ISO 8601'),
  corrId: z.string().optional(),
  tenantId: z.string().optional(),
  source: z.string().optional(),
  meta: EnvelopeMetaSchema.optional(),
  payload: z.unknown()  // Generic payload
});
```

### 3.2 Schema Comparison Matrix

| Field | TaskAssignmentSchema | buildAgentEnvelope() | EnvelopeSchema |
|-------|---------------------|----------------------|----------------|
| **Identification** ||||
| message_id | ✅ Required (UUID) | ❌ Missing | ✅ id (UUID) |
| task_id | ✅ Required (UUID) | ✅ Present (UUID) | N/A |
| workflow_id | ✅ Required (UUID) | ✅ Present (UUID) | N/A |
| **Routing** ||||
| agent_type | ✅ Enum | ✅ String | N/A |
| action | ⚠️ Optional | ❌ Missing | N/A |
| type | N/A | N/A | ✅ String pattern |
| **Priority** ||||
| priority | ✅ Enum (4 levels) | ✅ String literal | N/A |
| **Payload** ||||
| payload | ✅ Generic Record | ✅ Agent-specific | ✅ unknown |
| **Execution Control** ||||
| constraints.timeout_ms | ✅ In object | ✅ In root | N/A |
| constraints.max_retries | ✅ In object | ✅ In root (max_retries) | N/A |
| constraints.required_confidence | ✅ In object | ❌ Missing | N/A |
| status | N/A | ✅ 'pending' | N/A |
| retry_count | N/A | ✅ Number | ✅ meta.attempts |
| **Metadata** ||||
| metadata.created_at | ✅ In object | ✅ In root (created_at) | ✅ ts |
| metadata.created_by | ✅ In object | ❌ Missing | ✅ source |
| metadata.trace_id | ✅ In object | ✅ In root (trace_id) | ✅ corrId |
| metadata.parent_task_id | ⚠️ Optional | ❌ Missing | N/A |
| **Tracing (Session #60)** ||||
| trace_id | ✅ In metadata | ✅ In root | ✅ corrId |
| span_id | N/A | ✅ In root | N/A |
| parent_span_id | N/A | ✅ In root | N/A |
| **Versioning** ||||
| version | N/A | ✅ envelope_version | ✅ meta.version |
| **Context** ||||
| workflow_context | N/A | ✅ Object | N/A |

### 3.3 Compatibility Analysis

**TaskAssignmentSchema vs buildAgentEnvelope():**
- ✅ **Compatible:** 40% (task_id, workflow_id, agent_type, payload, trace_id)
- ⚠️ **Partially Compatible:** 30% (priority type mismatch, scattered fields)
- ❌ **Incompatible:** 30% (missing message_id, missing constraints object, missing metadata object)

**Verdict:** ❌ **NOT COMPATIBLE** - Would fail Zod validation

---

## 4. Agent Implementation Analysis

### 4.1 BaseAgent Task Validation (Current)

**File:** `packages/agents/base-agent/src/base-agent.ts`
**Method:** `validateTask()` (Lines 285-296)

```typescript
validateTask(task: unknown): TaskAssignment {
  try {
    return TaskAssignmentSchema.parse(task);  // ❌ Fails on buildAgentEnvelope() output
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

**Problem:** Validates against TaskAssignmentSchema, which doesn't match buildAgentEnvelope() output.

### 4.2 Concrete Agent Status

**Scaffold Agent** ✅ (Updated Session #64 Phase 3.1)
- **File:** `packages/agents/scaffold-agent/src/scaffold-agent.ts`
- **Status:** WORKING (extracts from task.payload)
- **Lines:** 69-99 (execute method)
- **Approach:**
  ```typescript
  const payload = task.payload as any;
  const scaffoldTask: ScaffoldTask = {
    // ... extract from payload
    project_type: payload.project_type || payload.type,
    name: payload.name,
    description: payload.description,
    // ...
  };
  ```

**Validation Agent** ❌ (NOT Updated)
- **File:** `packages/agents/validation-agent/src/validation-agent.ts`
- **Status:** BROKEN (expects task.context envelope)
- **Lines:** 78-151 (envelope extraction)
- **Problem:**
  ```typescript
  const taskObj = task as any;
  const envelopeData = taskObj.context;  // ❌ Expects task.context, but buildAgentEnvelope doesn't produce this

  if (!envelopeData) {
    throw new AgentError('No context envelope found in task', 'ENVELOPE_MISSING_ERROR');
  }
  ```
- **Root Cause:** Expects old agent-dispatcher format (Session #36-37)

**E2E Agent** ❌ (NOT Updated)
- **File:** `packages/agents/e2e-agent/src/e2e-agent.ts`
- **Status:** UNKNOWN (needs parsing analysis)
- **Lines:** 60 (parseTaskContext)
- **Approach:**
  ```typescript
  const context = this.parseTaskContext(task);  // Need to check this method
  ```

**Integration Agent** ❌ (NOT Updated)
- **File:** `packages/agents/integration-agent/src/integration-agent.ts`
- **Status:** UNKNOWN (needs inspection)

**Deployment Agent** ❌ (NOT Updated)
- **File:** `packages/agents/deployment-agent/src/deployment-agent.ts`
- **Status:** UNKNOWN (needs inspection)

### 4.3 Migration Patterns Observed

**Pattern 1: Direct payload extraction** (Scaffold Agent)
```typescript
const payload = task.payload as any;
const data = {
  field1: payload.field1,
  field2: payload.field2
};
```
- ✅ **Pros:** Simple, works with buildAgentEnvelope() output
- ⚠️ **Cons:** No validation, relies on any casting

**Pattern 2: Envelope context extraction** (Validation Agent - OLD)
```typescript
const taskObj = task as any;
const envelopeData = taskObj.context;
const envelope = validateEnvelope(envelopeData);
```
- ❌ **Incompatible** with buildAgentEnvelope() output (no .context field)
- ⚠️ Expects old agent-dispatcher format

---

## 5. Root Cause Summary

### 5.1 The Core Problem

**Two Parallel Schema Systems:**
1. **Intended (TaskAssignmentSchema):** Created Session #64 as "canonical" format
2. **Actual (buildAgentEnvelope):** Pre-existing production format

**Result:** Orchestrator publishes format B, agents validate against format A → validation fails.

### 5.2 Why This Happened

**Historical Context:**
- **Sessions #36-37:** Agent envelope system created (agent-dispatcher wrapper)
- **Sessions #53-57:** Message bus migration (Phase 1-6 complete)
- **Session #60:** Distributed tracing added (trace_id, span_id fields)
- **Session #64:** TaskAssignmentSchema created as "ideal" without checking orchestrator

**False Assumption in Session #64:**
> "Agents have duplicate TaskAssignmentSchema, let's consolidate them"

**Reality:**
> "Orchestrator doesn't use any TaskAssignmentSchema - it builds custom envelopes"

### 5.3 Current Blockers

**Blocker 1: Schema Validation Failure**
- BaseAgent.validateTask() rejects buildAgentEnvelope() output
- Workflows stuck at 0% (agents never execute)

**Blocker 2: Partial Migration State**
- Scaffold agent updated to new approach (extract from payload)
- Validation agent still expects old approach (task.context)
- Mixed state prevents any workflow from completing

**Blocker 3: Missing Idempotency**
- buildAgentEnvelope() doesn't include message_id
- No duplicate detection possible
- Agents may process same task multiple times (if message bus delivers duplicates)

---

## 6. Solution Options

### Option A: Update buildAgentEnvelope() to Produce TaskAssignmentSchema

**Approach:** Make orchestrator conform to the canonical schema

**Changes Required:**
1. Add `message_id` generation in buildAgentEnvelope()
2. Restructure flat fields into `constraints` object
3. Restructure flat fields into `metadata` object
4. Move `span_id`, `parent_span_id` into metadata
5. Handle `workflow_context` (either add to schema or pass via payload)

**Pros:**
- ✅ Clean canonical schema
- ✅ Agents validate with one schema
- ✅ Future-proof (clear contract)

**Cons:**
- ❌ Large orchestrator changes (workflow.service.ts)
- ❌ May break workflow_context usage
- ❌ May break trace propagation (span_id in root vs metadata)
- ⚠️ Medium risk (orchestrator is complex)

**Estimated Effort:** 4-6 hours

### Option B: Update TaskAssignmentSchema to Match buildAgentEnvelope()

**Approach:** Make schema document reality

**Changes Required:**
1. Add optional `message_id` to schema
2. Make `constraints` optional, allow flat timeout_ms, max_retries
3. Make `metadata` optional, allow flat created_at, trace_id
4. Add `span_id`, `parent_span_id` as optional root fields
5. Add `status`, `retry_count` as optional root fields
6. Add `envelope_version` as optional root field
7. Add `workflow_context` as optional root field

**Pros:**
- ✅ Minimal orchestrator changes
- ✅ Preserves existing logic
- ✅ Low risk (schema change only)
- ✅ Fast to implement

**Cons:**
- ❌ Schema has scattered structure
- ❌ Less clean (fields in both root and nested)
- ⚠️ Future maintenance harder

**Estimated Effort:** 2-3 hours

### Option C: Hybrid Approach (RECOMMENDED)

**Approach:** Core fields match schema, extensions in payload or workflow_context

**Changes Required:**
1. **Orchestrator (buildAgentEnvelope):**
   - Add `message_id: randomUUID()`
   - Wrap timeout_ms, max_retries in `constraints` object
   - Wrap created_at, trace_id in `metadata` object
   - Keep `span_id`, `parent_span_id` in root (trace fields)
   - Keep `workflow_context` in root (extension)

2. **Schema (TaskAssignmentSchema):**
   - Add optional `span_id`, `parent_span_id` (trace fields from Session #60)
   - Add optional `workflow_context` (context passing)
   - Keep `constraints` and `metadata` as required objects

3. **Agents:**
   - Update validation-agent to extract from task.payload (like scaffold-agent)
   - Update e2e-agent, integration-agent, deployment-agent similarly
   - Remove task.context expectations

**Pros:**
- ✅ Clean core schema (constraints, metadata as objects)
- ✅ Preserves trace fields at root (Session #60 design)
- ✅ Preserves workflow_context (context passing)
- ✅ Adds idempotency (message_id)
- ✅ Moderate risk (both orchestrator and schema change)

**Cons:**
- ⚠️ Schema has some "extensions" beyond core
- ⚠️ Requires changes in both orchestrator and agents

**Estimated Effort:** 5-7 hours

---

## 7. Recommended Implementation Plan

### Phase 1: Validate Current State (1 hour)
1. Run workflow and capture exact envelope produced by buildAgentEnvelope()
2. Attempt to parse with TaskAssignmentSchema and document all errors
3. Confirm validation-agent, e2e-agent, integration-agent, deployment-agent status

### Phase 2: Update TaskAssignmentSchema (1 hour)
1. Add optional fields to support buildAgentEnvelope() output:
   - `span_id`, `parent_span_id` (distributed tracing)
   - `workflow_context` (context passing)
   - Make `action` optional (not always provided)
2. Keep `message_id` required (idempotency)
3. Keep `constraints` and `metadata` as required objects

### Phase 3: Update buildAgentEnvelope() (2-3 hours)
1. Add `message_id: randomUUID()` generation
2. Restructure timeout_ms, max_retries into `constraints` object
3. Restructure created_at, trace_id into `metadata` object
4. Add `created_by: 'orchestrator'` to metadata
5. Keep `span_id`, `parent_span_id` at root (pass to schema)
6. Keep `workflow_context` at root (pass to schema)
7. Update priority to use enum values

### Phase 4: Update Remaining Agents (2-3 hours)
1. **validation-agent:**
   - Remove task.context extraction (Lines 78-151)
   - Extract directly from task.payload (like scaffold-agent)
   - Remove old envelope validation

2. **e2e-agent, integration-agent, deployment-agent:**
   - Update parseTaskContext() methods to extract from task.payload
   - Remove any envelope wrapper expectations

### Phase 5: Testing & Validation (1-2 hours)
1. Run full E2E workflow test
2. Verify all agents receive and validate tasks
3. Confirm no "Invalid task assignment" errors
4. Verify workflows advance through all stages
5. Check trace propagation still works (Session #60)

**Total Estimated Time:** 7-10 hours

---

## 8. Dependencies & Constraints

### 8.1 Technical Dependencies

**Must NOT Break:**
- ✅ Distributed tracing (Session #60) - trace_id, span_id, parent_span_id
- ✅ Message bus architecture (Sessions #53-57) - IMessageBus interface
- ✅ Workflow context passing - stage_outputs between stages
- ✅ Result schema (TaskResultSchema) - already working

**Can Modify:**
- ✅ TaskAssignmentSchema (add optional fields)
- ✅ buildAgentEnvelope() (restructure fields)
- ✅ Agent task parsing (update all agents)

### 8.2 Business Constraints

**Non-Goals (NOT Changing):**
- Message bus delivery mechanism (Redis pub/sub + streams)
- Database schema (Workflow, AgentTask tables)
- Agent business logic (validation rules, scaffolding templates, etc.)
- API routes (HTTP endpoints)

### 8.3 Architectural Constraints

**Hexagonal Architecture Principles:**
- Orchestrator owns message format (producer authority)
- Agents consume via IMessageBus port (consumer role)
- Schemas live in shared-types (neutral package)

**Message Bus Principles (Sessions #53-57):**
- Symmetric architecture (no callbacks)
- Agents subscribe to streams with consumer groups
- Orchestrator publishes to agent-specific channels
- Results published to orchestrator:results channel

---

## 9. Risks & Mitigations

### Risk 1: Breaking Existing Workflows
**Probability:** MEDIUM
**Impact:** HIGH (all workflows would fail)
**Mitigation:**
- Add comprehensive logging at envelope creation
- Add schema validation logging at agent intake
- Test with multiple workflow types before committing
- Keep rollback script handy (git reset)

### Risk 2: Trace Propagation Regression
**Probability:** LOW
**Impact:** MEDIUM (lose trace correlation)
**Mitigation:**
- Preserve trace fields at root level (don't nest in metadata)
- Add trace_id validation in tests
- Verify trace queries still work (DATABASE_QUERY_GUIDE.md)

### Risk 3: Agent Parsing Errors
**Probability:** MEDIUM
**Impact:** MEDIUM (individual agents fail)
**Mitigation:**
- Update agents one at a time (scaffold ✅, then validation, then e2e, etc.)
- Test each agent independently
- Add defensive parsing with clear error messages

### Risk 4: Idempotency Issues
**Probability:** LOW
**Impact:** HIGH (duplicate task processing)
**Mitigation:**
- Add message_id tracking in agents (Phase 2 enhancement)
- Log message_id in all task processing
- Add idempotency table (future - STRATEGIC-BUS-REFACTOR.md)

---

## 10. Testing Strategy

### 10.1 Unit Tests

**Package: @agentic-sdlc/orchestrator**
```typescript
describe('buildAgentEnvelope', () => {
  it('should produce TaskAssignmentSchema-compliant envelope', () => {
    const envelope = buildAgentEnvelope(...);
    expect(() => TaskAssignmentSchema.parse(envelope)).not.toThrow();
  });

  it('should include message_id for idempotency', () => {
    const envelope = buildAgentEnvelope(...);
    expect(envelope.message_id).toMatch(/^[a-f0-9-]{36}$/);
  });

  it('should nest timeout_ms in constraints object', () => {
    const envelope = buildAgentEnvelope(...);
    expect(envelope.constraints.timeout_ms).toBe(300000);
  });
});
```

**Package: @agentic-sdlc/base-agent**
```typescript
describe('BaseAgent.validateTask', () => {
  it('should accept envelope from buildAgentEnvelope', () => {
    const envelope = mockBuildAgentEnvelope();
    const agent = new MockAgent(messageBus);
    expect(() => agent.validateTask(envelope)).not.toThrow();
  });
});
```

### 10.2 Integration Tests

**Test 1: Orchestrator → Agent Message Flow**
1. Create workflow via API
2. Capture envelope published to Redis
3. Parse envelope with TaskAssignmentSchema
4. Assert validation passes

**Test 2: All Agents Process Tasks**
1. Create workflow requiring all 5 agents
2. Verify scaffold-agent executes
3. Verify validation-agent executes
4. Verify e2e-agent executes
5. Verify integration-agent executes
6. Verify deployment-agent executes

### 10.3 E2E Tests

**Test Script:** `./scripts/run-pipeline-test.sh "Hello World API"`

**Success Criteria:**
- ✅ Workflow advances from 0% to 100%
- ✅ All agents execute without "Invalid task assignment" errors
- ✅ Workflow completes in <5 minutes
- ✅ All stage_outputs populated
- ✅ Trace correlation works (query by trace_id)

---

## 11. Documentation Requirements

### Files to Create/Update

**1. AGENTENVELOPE_IMPLEMENTATION_PLAN.md** (This exploration → Plan)
- Detailed implementation steps
- Code snippets for each change
- Before/after comparisons
- Testing checklist

**2. VALIDATION_REPORT.md** (After implementation)
- Build status (typecheck, lint)
- Test results (unit, integration, E2E)
- Agent status (all 5 agents working)
- Performance metrics (workflow completion time)

**3. CLAUDE.md** (Session #65 update)
- Session summary
- Files modified
- Migration status (100% complete)
- Known issues (none, hopefully!)

**4. SCHEMA_MIGRATION_GUIDE.md** (For future reference)
- Schema evolution history
- Migration patterns used
- Lessons learned
- Best practices for schema changes

---

## 12. Success Criteria

### Definition of Done

**Technical:**
- [ ] TaskAssignmentSchema accepts buildAgentEnvelope() output (validation passes)
- [ ] All 5 agents extract data from task.payload (no task.context dependencies)
- [ ] buildAgentEnvelope() includes message_id, constraints, metadata
- [ ] All unit tests pass (0 failures)
- [ ] All integration tests pass (0 failures)
- [ ] E2E workflow completes successfully (0% → 100%)

**Quality:**
- [ ] Zero TypeScript compilation errors (pnpm typecheck)
- [ ] Zero "Invalid task assignment" errors in logs
- [ ] Trace propagation works (can query by trace_id)
- [ ] PM2 processes all show "online" with zero restarts

**Documentation:**
- [ ] CLAUDE.md updated with Session #65 status
- [ ] VALIDATION_REPORT.md created
- [ ] All code changes commented with Session #65 markers

---

## 13. Next Steps

### Immediate Actions (Next Session)

1. **Review this exploration** with user for approval
2. **Create EPCC_PLAN.md** with detailed implementation steps
3. **Execute EPCC_CODE.md** phase with careful validation
4. **Run E2E tests** to confirm workflow completion
5. **Commit changes** with EPCC_COMMIT.md

### Future Enhancements (Not in Scope)

- Idempotency layer (STRATEGIC-BUS-REFACTOR.md Phase 3)
- Message deduplication (Redis Streams consumer groups)
- Prompt auditing (BaseAgent enhancement)
- Error classification (transient vs permanent)

---

## 14. References

### Session History
- **Session #60:** Distributed tracing implementation (trace_id, span_id)
- **Session #64:** Nuclear Cleanup attempt (40% complete, false assumption discovered)
- **Sessions #53-57:** Message bus migration (Phase 1-6 complete)
- **Sessions #36-37:** Agent envelope system creation

### Related Documents
- `EPCC_PLAN.md` (Session #64 - flawed plan)
- `EPCC_CODE.md` (Session #60 - tracing implementation)
- `STRATEGIC-BUS-REFACTOR.md` (Session #63 - future enhancements)
- `AGENTIC_SDLC_RUNBOOK.md` (Debugging guide)
- `TRACE_IMPLEMENTATION_REVIEW.md` (Session #60 - tracing validation)

### Code References
- `packages/orchestrator/src/services/workflow.service.ts:994-1100+` (buildAgentEnvelope)
- `packages/shared/types/src/messages/task-contracts.ts:27-55` (TaskAssignmentSchema)
- `packages/agents/base-agent/src/base-agent.ts:285-296` (validateTask)
- `packages/agents/scaffold-agent/src/scaffold-agent.ts:69-99` (execute - WORKING)
- `packages/agents/validation-agent/src/validation-agent.ts:78-151` (execute - BROKEN)

---

**Exploration Complete** ✅

Ready for EPCC_PLAN.md phase.
