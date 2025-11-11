# Agent Envelope Migration Guide

**Session #36** | **Date:** 2025-11-11 | **Status:** Implementation Ready

---

## Overview

This guide documents the migration from the adapter pattern (Session #34 hotfix) to a standardized agent envelope format that provides type-safe, unified communication between the orchestrator and all agents.

## The Problem

**Before (Sessions #31-35):**
- Orchestrator sends `TaskAssignment` (base-agent format)
- Agents expect agent-specific formats (e.g., `ValidationTask`)
- **Mismatch** requires runtime adaptation via `adapter.ts`
- Adapter uses `as any` to bypass TypeScript strictness
- No compile-time safety
- Error handling is minimal

## The Solution

**After (Session #36):**
- Standardized `AgentEnvelope` format using discriminated unions
- Compile-time type safety with Zod validation
- Enhanced error reporting with structured `TaskError`
- Workflow context passed automatically between stages
- No runtime adaptation needed

---

## Architecture

### Envelope Structure

```typescript
AgentEnvelope = discriminatedUnion('agent_type', [
  ScaffoldEnvelope,
  ValidationEnvelope,
  E2EEnvelope,
  IntegrationEnvelope,
  DeploymentEnvelope,
])
```

### Key Features

1. **Discriminated Union**: TypeScript narrows types based on `agent_type`
2. **Common Metadata**: Shared envelope fields (task_id, workflow_id, priority, etc.)
3. **Agent-Specific Payload**: Strongly typed payload per agent type
4. **Workflow Context**: Automatic context passing via `workflow_context` field
5. **Enhanced Errors**: Structured `TaskError` with severity, category, retryability

---

## Migration Steps

### Phase 1: Orchestrator Updates

**File:** `packages/orchestrator/src/services/workflow.service.ts`

#### Before (createTaskForStage):
```typescript
const task = {
  task_id: taskId,
  workflow_id: workflowId,
  type: agentType,
  name: workflow.name,
  description: workflow.description || '',
  requirements: workflow.requirements || '',
  priority: 'medium',
  context: {
    stage,
    working_directory: '/path/to/code',
    // ... other fields
  }
};
```

#### After (using envelope):
```typescript
import { createValidationEnvelope } from '@agentic-sdlc/shared-types';

// For validation stage
const envelope = createValidationEnvelope({
  task_id: taskId,
  workflow_id: workflowId,
  file_paths: extractedFilePaths,
  working_directory: extractedWorkingDir,
  validation_types: ['typescript', 'eslint'],
  workflow_context: {
    workflow_type: workflow.type,
    workflow_name: workflow.name,
    current_stage: 'validation',
    previous_stage: 'scaffolding',
    stage_outputs: workflow.stage_outputs,
  },
  priority: 'medium',
  trace_id: generateTraceId(),
});

await this.agentDispatcher.dispatch(envelope);
```

### Phase 2: Agent Updates

**File:** `packages/agents/validation-agent/src/validation-agent.ts`

#### Before (with adapter):
```typescript
import { adaptToValidationTask } from './adapter';

async receiveTask(message: AgentMessage): Promise<void> {
  const taskAssignment = this.validateTask(message.payload);

  // Adapter hotfix
  const adapted = adaptToValidationTask(taskAssignment);
  if (!adapted.success) {
    this.logger.error('Adapter failed:', adapted.error);
    return;
  }

  const result = await this.execute(adapted.task);
}
```

#### After (using envelope):
```typescript
import {
  ValidationEnvelope,
  isValidationEnvelope,
  validateEnvelope,
  createTaskError,
  AgentResultEnvelope
} from '@agentic-sdlc/shared-types';

async receiveTask(message: AgentMessage): Promise<void> {
  // Validate envelope format
  const validation = validateEnvelope(message.payload);

  if (!validation.success) {
    this.logger.error('Invalid envelope:', validation.error);
    await this.reportError(createTaskError({
      code: 'INVALID_ENVELOPE',
      message: validation.error,
      severity: 'error',
      category: 'validation',
      retryable: false,
    }));
    return;
  }

  const envelope = validation.envelope!;

  // Type guard ensures type safety
  if (!isValidationEnvelope(envelope)) {
    this.logger.warn('Wrong agent type routed to validation agent');
    return;
  }

  // TypeScript now knows envelope.payload has validation-specific fields
  const result = await this.executeValidation(envelope);
}

private async executeValidation(
  envelope: ValidationEnvelope
): Promise<AgentResultEnvelope> {
  try {
    // Access payload fields with full type safety
    const { file_paths, working_directory, validation_types } = envelope.payload;

    // Execute validation...
    const validationResults = await this.runChecks(
      file_paths,
      working_directory,
      validation_types
    );

    // Return result envelope
    return {
      task_id: envelope.task_id,
      workflow_id: envelope.workflow_id,
      agent_type: 'validation',
      status: 'success',
      success: true,
      result: validationResults,
      metrics: {
        duration_ms: Date.now() - startTime,
      },
      completed_at: new Date().toISOString(),
      envelope_version: '1.0.0',
    };
  } catch (error) {
    // Enhanced error reporting
    return {
      task_id: envelope.task_id,
      workflow_id: envelope.workflow_id,
      agent_type: 'validation',
      status: 'failure',
      success: false,
      result: {},
      errors: [
        createTaskError({
          code: 'VALIDATION_EXECUTION_ERROR',
          message: error.message,
          severity: 'error',
          category: 'execution',
          details: {
            file_path: envelope.payload.working_directory,
            stack_trace: error.stack,
          },
          retryable: true,
          retry_after_ms: 5000,
          suggested_action: 'Check working directory exists and has correct permissions',
          trace_id: envelope.trace_id,
        })
      ],
      metrics: {
        duration_ms: Date.now() - startTime,
      },
      completed_at: new Date().toISOString(),
      envelope_version: '1.0.0',
    };
  }
}
```

### Phase 3: Testing

1. **Unit Tests**: Validate envelope schemas
   ```typescript
   import { ValidationEnvelopeSchema } from '@agentic-sdlc/shared-types';

   describe('ValidationEnvelope', () => {
     it('should validate correct envelope', () => {
       const envelope = {
         task_id: '123e4567-e89b-12d3-a456-426614174000',
         workflow_id: '123e4567-e89b-12d3-a456-426614174001',
         agent_type: 'validation',
         priority: 'medium',
         status: 'pending',
         // ... other fields
         payload: {
           file_paths: ['src/index.ts'],
           working_directory: '/path/to/code',
           validation_types: ['typescript'],
         },
       };

       const result = ValidationEnvelopeSchema.safeParse(envelope);
       expect(result.success).toBe(true);
     });
   });
   ```

2. **Integration Tests**: End-to-end workflow with envelope
   ```bash
   curl -X POST http://localhost:3000/api/v1/workflows \
     -H "Content-Type: application/json" \
     -d '{
       "type": "app",
       "name": "envelope-test",
       "description": "Test envelope migration",
       "requirements": "Create a simple app"
     }'
   ```

3. **Verify logs show envelope format**
   ```bash
   grep "AgentEnvelope" scripts/logs/orchestrator.log
   grep "envelope_version" scripts/logs/validation-agent.log
   ```

### Phase 4: Cleanup

Once verified working:

1. **Remove adapter.ts**
   ```bash
   rm packages/agents/validation-agent/src/adapter.ts
   ```

2. **Remove old TaskAssignment usage**
   - Search for `TaskAssignment` imports
   - Replace with `AgentEnvelope`

3. **Update documentation**
   - Update CLAUDE.md with Session #36 status
   - Mark Session #34 adapter as deprecated

---

## Benefits

### 1. Type Safety
**Before:**
```typescript
const task: any = adaptToValidationTask(input).task;
// No compile-time checks
```

**After:**
```typescript
const envelope: ValidationEnvelope = validateEnvelope(input).envelope!;
// TypeScript enforces correct structure
```

### 2. Error Handling
**Before:**
```typescript
throw new Error('Validation failed');
// Minimal context
```

**After:**
```typescript
createTaskError({
  code: 'TYPESCRIPT_ERROR',
  message: 'Type checking failed',
  severity: 'error',
  category: 'validation',
  details: {
    file_path: 'src/index.ts',
    line_number: 42,
    stack_trace: error.stack,
  },
  retryable: true,
  retry_after_ms: 5000,
  suggested_action: 'Fix type errors in src/index.ts:42',
});
// Rich, actionable error information
```

### 3. Workflow Context
**Before:**
```typescript
// Manual extraction from context object
const workingDir = task.context?.working_directory;
const previousOutputs = task.context?.previous_outputs;
// Risk of missing fields
```

**After:**
```typescript
// Automatic context passing
const { workflow_context } = envelope;
const previousOutputs = workflow_context?.stage_outputs?.scaffolding;
// Type-safe access to previous stage outputs
```

### 4. Maintainability
- Single source of truth for agent payloads
- No more `as any` casts
- Easier to add new agents (just add to discriminated union)
- Clear separation between envelope metadata and payload

---

## Error Categories

The envelope introduces structured error categories:

| Category | Use Case | Example |
|----------|----------|---------|
| `validation` | Schema validation errors | Invalid envelope format |
| `execution` | Runtime execution errors | File not found |
| `timeout` | Task exceeded time limit | Validation took > 5 minutes |
| `resource` | Resource unavailable | Out of memory |
| `dependency` | External dependency failure | npm install failed |
| `configuration` | Configuration issues | Missing TypeScript config |
| `network` | Network-related errors | Cannot connect to API |
| `unknown` | Uncategorized errors | Unexpected error |

---

## Workflow Context Schema

The envelope automatically includes workflow context for stage-to-stage communication:

```typescript
workflow_context: {
  workflow_type: 'app' | 'service' | 'feature' | 'capability',
  workflow_name: string,
  current_stage: string,
  previous_stage?: string,
  stage_outputs?: {
    initialization?: {...},
    scaffolding?: {
      output_path: string,
      files_generated: string[],
      entry_points: string[],
    },
    validation?: {...},
    // ... other stages
  },
}
```

This replaces the manual context extraction that was failing in Session #31.

---

## Rollback Plan

If issues arise during migration:

1. **Keep adapter.ts** until envelope is fully verified
2. **Feature flag**: Add `USE_ENVELOPE=true` env var
3. **Dual mode**: Support both formats temporarily
4. **Gradual rollout**: Migrate one agent at a time

---

## Next Steps

1. ✅ Design envelope schema (Session #36)
2. ✅ Implement in shared-types (Session #36)
3. ⏭️ Update orchestrator `createTaskForStage()`
4. ⏭️ Update validation agent
5. ⏭️ Test end-to-end
6. ⏭️ Migrate remaining agents (scaffold, e2e, integration, deployment)
7. ⏭️ Remove adapter.ts
8. ⏭️ Update CLAUDE.md

---

## References

- **Envelope Implementation**: `packages/shared/types/src/envelope/agent-envelope.ts`
- **Session #34 Adapter**: `packages/agents/validation-agent/src/adapter.ts`
- **CLAUDE.md Session #34**: Details on why adapter was created
- **CLAUDE.md Session #35**: Adapter verification results

---

**Status:** Ready for implementation
**Estimated Time:** 4-6 hours for complete migration
**Risk Level:** Low (can run adapter and envelope in parallel during testing)
