# Schema Validation Architecture Analysis

**Date:** 2025-11-14
**Session:** #65 Follow-up Analysis
**Status:** Exploration Only - No Implementation

---

## Executive Summary

This document analyzes the current schema validation architecture across the Agentic SDLC platform, focusing on the producer-consumer contract for task assignment and result reporting. The analysis identifies the current validation points, error handling patterns, and opportunities for improvement.

**Key Findings:**
1. **Dual Schema Legacy**: Two AgentEnvelope schemas coexist (v1.0.0 and v2.0.0)
2. **Single Validation Point**: Validation happens only at consumer (agents), not producer
3. **Inconsistent Error Handling**: Mix of simple Error throws and structured error classes
4. **No Shared Validation Utilities**: Each component reimplements validation logic
5. **Missing Schema Evolution Strategy**: No clear plan for v3.0.0 transition

---

## 1. Current Validation Architecture

### 1.1 Producer → Message Bus → Consumer Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     PRODUCER (Orchestrator)                      │
│  workflow.service.ts::buildAgentEnvelope() (lines 993-1215)    │
│                                                                   │
│  ❌ NO VALIDATION: Builds envelope manually, trusts structure   │
│  Creates: message_id, trace context, nested objects             │
│  Output: Plain JS object (not validated against schema)         │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  │ publish(taskChannel, envelope)
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                MESSAGE BUS (Redis Adapter)                       │
│  redis-bus.adapter.ts::publish() + subscribe()                  │
│                                                                   │
│  ❌ NO VALIDATION: JSON.parse only, no schema checks            │
│  Transforms: JS object → JSON string → JS object                │
│  Unwraps: Extracts message from envelope wrapper                │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  │ handler(message)
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                     CONSUMER (Agents)                            │
│  base-agent.ts::validateTask() (lines 300-334)                  │
│                                                                   │
│  ✅ VALIDATION HERE: AgentEnvelopeSchema.parse(task)            │
│  - First and only validation point                              │
│  - Throws ValidationError on failure                            │
│  - Logs detailed error diagnostics                              │
└─────────────────────────────────────────────────────────────────┘
```

**Critical Gap:** Producer never validates its own output. Validation errors only discovered at runtime when agents consume tasks.

---

## 2. Schema Landscape

### 2.1 Canonical Schema (Session #65)

**Location:** `/packages/shared/types/src/messages/agent-envelope.ts`
**Version:** 2.0.0
**Status:** Active, production use

**Structure:**
```typescript
AgentEnvelopeSchema = z.object({
  // Identification & Idempotency
  message_id: z.string().uuid(),           // NEW in v2.0.0
  task_id: z.string().uuid(),
  workflow_id: z.string().uuid(),

  // Routing
  agent_type: z.enum([...]),

  // Execution Control (NESTED in v2.0.0)
  constraints: ExecutionConstraintsSchema, // timeout_ms, max_retries, required_confidence
  retry_count: z.number(),
  priority: z.enum([...]),
  status: z.enum([...]),

  // Payload (agent-specific data)
  payload: z.record(z.unknown()),

  // Metadata (NESTED in v2.0.0)
  metadata: EnvelopeMetadataSchema,        // created_at, created_by, envelope_version

  // Distributed Tracing (NESTED in v2.0.0)
  trace: TraceContextSchema,               // trace_id, span_id, parent_span_id

  // Workflow Context (NESTED in v2.0.0)
  workflow_context: WorkflowContextSchema  // workflow_type, workflow_name, current_stage, stage_outputs
});
```

**Validation Helpers Provided:**
- `isAgentEnvelope(data: unknown): boolean` - Type guard (safe parse)
- `validateAgentEnvelope(data: unknown): AgentEnvelope` - Throws on failure

### 2.2 Legacy Schema (Session #36)

**Location:** `/packages/shared/types/src/envelope/agent-envelope.ts`
**Version:** 1.0.0
**Status:** ⚠️ Still in codebase, unused

**Structure:**
```typescript
AgentEnvelopeSchema = z.discriminatedUnion('agent_type', [
  ScaffoldEnvelopeSchema,
  ValidationEnvelopeSchema,
  E2EEnvelopeSchema,
  IntegrationEnvelopeSchema,
  DeploymentEnvelopeSchema
]);
```

**Key Differences from v2.0.0:**
- Discriminated union (type-safe payload per agent)
- Flat structure (no nested objects)
- No `message_id` (idempotency added in v2.0.0)
- Trace fields at root level (not nested)
- `envelope_version: "1.0.0"`

**Risk:** Potential confusion - which schema is canonical?

### 2.3 Result Schema

**Location:** `/packages/shared/types/src/messages/task-contracts.ts`
**Usage:** Validated by **both** producer (agents) and consumer (orchestrator)

```typescript
TaskResultSchema = z.object({
  message_id: z.string().uuid(),
  task_id: z.string().uuid(),
  workflow_id: z.string().uuid(),
  agent_id: z.string(),
  status: z.enum(['success', 'failure', 'partial', 'blocked']),
  result: z.object({
    data: z.record(z.unknown()),
    metrics: z.object({ duration_ms, ... })
  }),
  errors: z.array(z.object({ code, message, recoverable })),
  metadata: z.object({ completed_at, trace_id })
});
```

**Validation Points:**
1. **Agent side** (base-agent.ts:386): Before publishing result
2. **Orchestrator side** (workflow.service.ts:586): After receiving result

**Pattern:** Dual validation (both sides) - **this is better than single-side validation!**

---

## 3. Validation Points Analysis

### 3.1 Task Assignment (Producer → Consumer)

| Location | Validates? | Schema | Failure Mode |
|----------|-----------|--------|--------------|
| **Producer** (workflow.service.ts:456-465) | ❌ No | N/A | Silent schema drift |
| **Message Bus** (redis-bus.adapter.ts:49, 150-159) | ❌ No | JSON parse only | Runtime errors |
| **Consumer** (base-agent.ts:300-334) | ✅ Yes | AgentEnvelopeSchema.parse | ValidationError thrown |

**Issue:** Producer builds envelope manually (lines 993-1215) with no compile-time or runtime validation. If `buildAgentEnvelope()` produces wrong structure, error only discovered when agent tries to consume.

**Example Failure Scenario:**
```typescript
// Producer (orchestrator) builds this:
const envelope = {
  task_id: taskId,
  // ... other fields
  trace: {
    trace_id: traceId,
    span_id: spanId
    // ❌ Missing parent_span_id (optional but expected)
  }
};

// No validation here! Published to Redis.
await messageBus.publish(taskChannel, envelope);

// Agent receives, tries to validate:
AgentEnvelopeSchema.parse(task); // ❌ Fails if schema strict

// Result: Workflow stuck, agent crashes, no clear root cause
```

### 3.2 Task Result (Consumer → Producer)

| Location | Validates? | Schema | Failure Mode |
|----------|-----------|--------|--------------|
| **Producer (Agent)** (base-agent.ts:386) | ✅ Yes | AgentResultSchema.parse | Error logged, throws |
| **Message Bus** (redis-bus.adapter.ts) | ❌ No | JSON parse only | N/A |
| **Consumer (Orch)** (workflow.service.ts:586) | ✅ Yes | AgentResultSchema.parse | Error logged, throws |

**Pattern:** **Dual validation** - both sides validate. This is superior to task assignment's single-side validation.

**Why This Works Better:**
1. Agent validates before publishing → catches issues at source
2. Orchestrator validates on receipt → defense in depth
3. Clear contract enforcement on both sides

---

## 4. Error Handling Analysis

### 4.1 Validation Error Patterns

**Pattern 1: Simple Error (base-agent.ts:329-332)**
```typescript
throw new ValidationError(
  'Invalid task assignment - must conform to AgentEnvelope v2.0.0',
  error instanceof Error ? [error.message] : ['Unknown validation error']
);
```

**Pattern 2: Structured Error (shared-types TaskValidationError)**
```typescript
export class TaskValidationError extends AgentError {
  constructor(message, {
    agentType, taskId, validationErrors,
    metadata, cause
  }) {
    super(message, AgentErrorCode.TASK_VALIDATION_FAILED, {
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.MEDIUM,
      retryable: false,
      recoveryStrategy: RecoveryStrategy.ABORT
    });
  }
}
```

**Issue:** Two error hierarchies coexist:
1. **Local errors** (packages/agents/base-agent/src/types.ts): AgentError, ValidationError, TaskExecutionError
2. **Shared errors** (packages/shared/types/src/errors/): BaseError, AgentError, TaskValidationError

**Inconsistency:** BaseAgent uses local ValidationError, but shared-types provides TaskValidationError with richer metadata.

### 4.2 Error Propagation Flow

```
Agent validateTask() failure:
  ├─ Throws ValidationError (local class)
  ├─ Caught by receiveTask() (base-agent.ts:250-297)
  ├─ Logged with console.error + logger.error
  ├─ Creates TaskResult with status='failure'
  └─ Published to orchestrator (not re-thrown)

Orchestrator handleAgentResult() failure:
  ├─ AgentResultSchema.parse fails (line 586)
  ├─ Logs error with logger.error
  ├─ Throws Error (generic)
  └─ ❓ What catches this? Event loop? PM2?
```

**Gap:** No clear failure recovery documented. When orchestrator validation fails, what happens to the workflow?

---

## 5. Shared Validation Opportunities

### 5.1 Duplicated Validation Logic

**Current State:**
- **AgentEnvelope validation**: Only in base-agent.ts (consumer side)
- **TaskResult validation**: In both base-agent.ts (producer) and workflow.service.ts (consumer)

**Opportunity:** Extract common validation patterns into shared utilities:

```typescript
// packages/shared/types/src/validation/envelope-validator.ts (hypothetical)
export class EnvelopeValidator {
  static validateAgentEnvelope(data: unknown): Result<AgentEnvelope> {
    try {
      const envelope = AgentEnvelopeSchema.parse(data);
      return { success: true, value: envelope };
    } catch (error) {
      return {
        success: false,
        error: new TaskValidationError('Invalid AgentEnvelope', {
          validationErrors: error instanceof ZodError ? error.errors : [error]
        })
      };
    }
  }

  static validateTaskResult(data: unknown): Result<TaskResult> {
    // Similar pattern
  }
}
```

**Benefits:**
1. Single implementation of validation logic
2. Consistent error handling
3. Structured error responses
4. Type-safe result types (no throws)

### 5.2 Pre-Flight Validation (Producer Side)

**Current Gap:** Orchestrator builds envelopes without validation.

**Opportunity:** Add validation in `buildAgentEnvelope()`:

```typescript
// workflow.service.ts (lines 993-1215)
private buildAgentEnvelope(...): AgentEnvelope {  // ← Return typed envelope
  const envelope = {
    // ... build logic
  };

  // VALIDATE before returning
  const validation = EnvelopeValidator.validateAgentEnvelope(envelope);
  if (!validation.success) {
    logger.error('🚨 Producer validation failed - envelope malformed', {
      workflow_id: workflowId,
      task_id: taskId,
      validation_errors: validation.error
    });
    throw validation.error;
  }

  return validation.value;  // Type-safe!
}
```

**Benefits:**
1. Catches schema errors at source (producer)
2. Prevents invalid messages from reaching message bus
3. Fail-fast (before network/persistence)
4. Clear root cause (producer, not consumer)

---

## 6. Schema Evolution Strategy

### 6.1 Current Version Handling

**AgentEnvelope v2.0.0:**
- `envelope_version: "2.0.0"` field in metadata
- Breaking change from v1.0.0 (nested structure)
- No backward compatibility

**Problem:** How will v3.0.0 be handled?

**Current Approach:**
```typescript
// base-agent.ts:303-311
const envelope = AgentEnvelopeSchema.parse(task);
this.logger.info('✅ Task validated against AgentEnvelope v2.0.0', {
  envelope_version: envelope.metadata.envelope_version
});
```

**Issues:**
1. Hardcoded version check in logs (not in schema)
2. No version negotiation
3. No migration path documented
4. v1.0.0 schema still in codebase (dead code?)

### 6.2 Recommended Evolution Strategy

**Option A: Versioned Schemas with Union Type**
```typescript
export const AgentEnvelopeSchemaV1 = z.object({
  envelope_version: z.literal('1.0.0'),
  // ... v1 fields
});

export const AgentEnvelopeSchemaV2 = z.object({
  envelope_version: z.literal('2.0.0'),
  // ... v2 fields (current)
});

export const AgentEnvelopeSchemaV3 = z.object({
  envelope_version: z.literal('3.0.0'),
  // ... v3 fields
});

export const AgentEnvelopeSchema = z.discriminatedUnion('envelope_version', [
  AgentEnvelopeSchemaV3,  // Try latest first
  AgentEnvelopeSchemaV2,
  AgentEnvelopeSchemaV1   // Fallback to oldest
]);

// Migration utilities
export function migrateEnvelopeToV3(envelope: AgentEnvelope): AgentEnvelopeV3 {
  if (envelope.envelope_version === '3.0.0') return envelope;
  if (envelope.envelope_version === '2.0.0') {
    // Transform v2 → v3
  }
  // Transform v1 → v3
}
```

**Option B: Semantic Versioning with Breaking Changes**
```typescript
// Each major version is a separate schema file
import { AgentEnvelopeSchema as V1 } from './v1/agent-envelope';
import { AgentEnvelopeSchema as V2 } from './v2/agent-envelope';
import { AgentEnvelopeSchema as V3 } from './v3/agent-envelope';

// Agents declare supported versions
export interface AgentCapabilities {
  type: string;
  supportedEnvelopeVersions: ['3.0.0', '2.0.0'];  // In order of preference
}

// Orchestrator selects compatible version
function selectEnvelopeVersion(agentCapabilities: AgentCapabilities): string {
  const orchestratorVersions = ['3.0.0', '2.0.0', '1.0.0'];
  return orchestratorVersions.find(v =>
    agentCapabilities.supportedEnvelopeVersions.includes(v)
  );
}
```

**Option C: Current Approach (Nuclear Cleanup)**
- Session #65 approach: one canonical schema, zero backward compatibility
- All services must upgrade simultaneously
- Benefits: Simple, no migration logic
- Risks: Coordination overhead, deployment complexity

**Recommendation:** Hybrid approach:
1. **Current major version (v2.0.0)**: Use nuclear cleanup (current approach)
2. **Future versions (v3.0.0+)**: Use Option B (semantic versioning)
3. **Rationale**: Platform is young, breaking changes acceptable now. Future stability requires versioning.

---

## 7. Validation Consistency Recommendations

### 7.1 Establish Validation Principles

**Principle 1: Validate at Producer (Fail-Fast)**
- All schemas validated BEFORE publishing to message bus
- Benefits: Clear root cause, prevents invalid data propagation
- Apply to: Task assignment (currently missing), Task results (already done)

**Principle 2: Validate at Consumer (Defense-in-Depth)**
- All schemas validated AFTER receiving from message bus
- Benefits: Protects against schema drift, network corruption
- Apply to: Task assignment (already done), Task results (already done)

**Principle 3: Use Shared Validation Utilities**
- Single implementation, imported by all components
- Consistent error handling and logging
- Type-safe result types (no throws unless intended)

**Principle 4: Structured Errors Only**
- Use shared error classes (BaseError, AgentError, etc.)
- Include metadata: agent type, task ID, validation errors
- Enable recovery strategies (retry, abort, fallback)

### 7.2 Implementation Roadmap

**Phase 1: Extract Shared Validation Utilities (1 day)**
```
packages/shared/types/src/validation/
  ├─ envelope-validator.ts      # validateAgentEnvelope(), validateTaskResult()
  ├─ validation-result.ts       # Result<T, E> type
  └─ index.ts
```

**Phase 2: Add Producer-Side Validation (1 day)**
- Update `buildAgentEnvelope()` to validate before returning
- Add structured error handling
- Update tests

**Phase 3: Migrate to Shared Error Classes (1 day)**
- Replace local ValidationError with TaskValidationError
- Update error handling in base-agent.ts
- Ensure error metadata captured

**Phase 4: Document Schema Evolution Strategy (0.5 day)**
- Create SCHEMA_VERSIONING.md
- Define migration process
- Add version compatibility matrix

**Phase 5: Clean Up Legacy Schemas (0.5 day)**
- Remove v1.0.0 AgentEnvelopeSchema if unused
- Document breaking changes
- Update CLAUDE.md

**Total Estimated Effort:** 4 days

---

## 8. Validation Error Flow (Detailed)

### 8.1 Current State - Task Assignment Failure

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Producer (Orchestrator)                                      │
│    buildAgentEnvelope() builds invalid envelope                 │
│    ❌ No validation - published to Redis                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Message Bus                                                   │
│    JSON.stringify() succeeds (any object serializes)            │
│    Message stored in Redis Stream                               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Consumer (Agent)                                              │
│    validateTask() called                                         │
│    AgentEnvelopeSchema.parse(task) fails                        │
│    ├─ ZodError thrown                                            │
│    ├─ Wrapped in ValidationError                                │
│    ├─ console.error() dumps full task + error                   │
│    └─ logger.error() logs validation failure                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Error Recovery (receiveTask catch block)                     │
│    errorsCount++                                                 │
│    Creates TaskResult with status='failure'                     │
│    Publishes error result to orchestrator                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Orchestrator (handleAgentResult)                             │
│    Receives failure result                                       │
│    Calls handleTaskFailure()                                     │
│    State machine → STAGE_FAILED                                  │
│    Workflow stuck (no retry for validation errors)              │
└─────────────────────────────────────────────────────────────────┘
```

**Problem:** Validation error treated as task execution failure. Workflow fails permanently (validation errors not retryable).

### 8.2 Proposed State - With Producer Validation

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Producer (Orchestrator)                                      │
│    buildAgentEnvelope() builds envelope                         │
│    ✅ validateAgentEnvelope() called                            │
│    ├─ Validation fails                                           │
│    ├─ Logs detailed error with workflow/task context            │
│    └─ Throws TaskValidationError                                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Error Caught (createTaskForStage catch block)                │
│    Logs producer validation failure                             │
│    State machine → STAGE_FAILED with clear cause                │
│    Workflow marked as failed immediately                        │
│    ❌ Message NEVER published to Redis                          │
└─────────────────────────────────────────────────────────────────┘
```

**Benefits:**
1. Fail-fast (before network/persistence)
2. Clear root cause (producer code bug, not data corruption)
3. No invalid messages in system
4. Agent never sees malformed tasks

---

## 9. Known Issues & Gaps

### 9.1 Schema Drift Risk

**Issue:** Producer builds envelope manually without compile-time type checking.

**Evidence:**
```typescript
// workflow.service.ts:1046-1086
const envelopeBase = {
  message_id: messageId,
  task_id: taskId,
  // ... 40+ lines of manual object construction
};
```

**Risk:** If `AgentEnvelopeSchema` changes (e.g., add required field), TypeScript won't catch missing field in `buildAgentEnvelope()`.

**Mitigation:** Use factory function with schema validation:
```typescript
function createAgentEnvelope(params: CreateEnvelopeParams): AgentEnvelope {
  const envelope = {
    // ... build logic
  };
  return AgentEnvelopeSchema.parse(envelope);  // ✅ Runtime + compile-time safety
}
```

### 9.2 Legacy Schema Confusion

**Issue:** Two AgentEnvelope schemas in codebase:
1. `/packages/shared/types/src/messages/agent-envelope.ts` (v2.0.0) - **Active**
2. `/packages/shared/types/src/envelope/agent-envelope.ts` (v1.0.0) - **Unused?**

**Risk:** Developers may import wrong schema.

**Verification Needed:**
```bash
grep -r "from.*envelope/agent-envelope" packages/
# If no results → safe to delete v1.0.0 file
```

### 9.3 Inconsistent Error Handling

**Issue:** Mix of local and shared error classes.

**Evidence:**
- base-agent.ts uses `ValidationError` (local class)
- shared-types exports `TaskValidationError` (shared class)

**Risk:** Error metadata inconsistency, difficult to handle errors uniformly.

**Mitigation:** Standardize on shared error classes.

### 9.4 No Validation at Message Bus Layer

**Issue:** redis-bus.adapter.ts performs JSON parse only, no schema validation.

**Design Question:** Should message bus validate schemas?

**Arguments FOR:**
- Defense-in-depth (three layers: producer, bus, consumer)
- Catch serialization/deserialization issues
- Centralized enforcement point

**Arguments AGAINST:**
- Performance overhead (parse twice: JSON + Zod)
- Tight coupling (bus knows all schemas)
- Violation of hexagonal architecture (port shouldn't know domain)

**Recommendation:** Keep validation at producer/consumer only. Message bus is infrastructure layer, should remain schema-agnostic.

---

## 10. Summary & Action Items

### 10.1 Current State Summary

**Strengths:**
✅ Consumer-side validation comprehensive (agents validate all inputs)
✅ Dual validation for results (both agent and orchestrator)
✅ Structured schemas with Zod (type-safe)
✅ Trace context propagation working

**Weaknesses:**
❌ No producer-side validation (orchestrator trusts manual envelope construction)
❌ Legacy schema still in codebase (v1.0.0)
❌ Inconsistent error handling (local vs shared classes)
❌ No schema evolution strategy documented
❌ Duplicated validation logic (no shared utilities)

### 10.2 Recommended Actions (Priority Order)

**CRITICAL (Fix Next Session):**
1. **Add producer-side validation** in `buildAgentEnvelope()` - Prevents invalid tasks from reaching agents
2. **Remove legacy v1.0.0 schema** if unused - Eliminates confusion

**HIGH (Fix Within 1 Week):**
3. **Extract shared validation utilities** - EnvelopeValidator class
4. **Migrate to shared error classes** - Use TaskValidationError consistently
5. **Document schema evolution strategy** - SCHEMA_VERSIONING.md

**MEDIUM (Technical Debt):**
6. **Add compile-time type safety** to buildAgentEnvelope() - Use factory pattern
7. **Create validation test suite** - Test all edge cases
8. **Add schema version negotiation** - Prepare for v3.0.0

### 10.3 Validation Principles (Establish as Standards)

1. **Fail-Fast:** Validate at producer before publishing
2. **Defense-in-Depth:** Validate at consumer after receiving
3. **Structured Errors:** Use shared error classes with metadata
4. **Type Safety:** Use Zod schemas + TypeScript for compile-time checks
5. **Versioning:** Use semantic versioning with explicit `envelope_version` field

---

## Appendix A: File Locations Reference

### Active Schemas
- **AgentEnvelope v2.0.0:** `/packages/shared/types/src/messages/agent-envelope.ts`
- **TaskResult:** `/packages/shared/types/src/messages/task-contracts.ts`
- **AgentResult (legacy):** `/packages/shared/types/src/core/schemas.ts`

### Legacy Schemas (Unused?)
- **AgentEnvelope v1.0.0:** `/packages/shared/types/src/envelope/agent-envelope.ts`

### Validation Points
- **Producer:** `/packages/orchestrator/src/services/workflow.service.ts:993-1215` (buildAgentEnvelope)
- **Consumer:** `/packages/agents/base-agent/src/base-agent.ts:300-334` (validateTask)
- **Result Producer:** `/packages/agents/base-agent/src/base-agent.ts:386` (reportResult)
- **Result Consumer:** `/packages/orchestrator/src/services/workflow.service.ts:586` (handleAgentResult)

### Error Classes
- **Local Errors:** `/packages/agents/base-agent/src/types.ts:67-86`
- **Shared Errors:** `/packages/shared/types/src/errors/agent.error.ts`

### Message Bus
- **Redis Adapter:** `/packages/orchestrator/src/hexagonal/adapters/redis-bus.adapter.ts`

---

## Appendix B: Validation Error Examples

### Example 1: Missing Required Field
```typescript
// Producer builds envelope missing message_id
const envelope = {
  task_id: '123',
  workflow_id: '456',
  // ❌ message_id missing
  // ... other fields
};

// Agent validation:
AgentEnvelopeSchema.parse(envelope);
// ZodError: Required at "message_id"
```

### Example 2: Wrong Nested Structure
```typescript
// Producer builds envelope with flat trace (v1.0.0 style)
const envelope = {
  // ... other fields
  trace_id: '789',        // ❌ Should be nested
  span_id: 'abc',         // ❌ Should be nested
  // Missing: trace: { trace_id, span_id }
};

// Agent validation:
AgentEnvelopeSchema.parse(envelope);
// ZodError: Required at "trace"
```

### Example 3: Invalid Enum Value
```typescript
// Producer uses wrong agent_type
const envelope = {
  // ... other fields
  agent_type: 'e2e',  // ❌ Should be 'e2e_test'
};

// Agent validation:
AgentEnvelopeSchema.parse(envelope);
// ZodError: Invalid enum value at "agent_type"
```

---

**End of Analysis**
