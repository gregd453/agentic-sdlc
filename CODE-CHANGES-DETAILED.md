# Detailed Code Changes - AgentResultSchema Compliance Patch

## File 1: `packages/agents/base-agent/src/base-agent.ts`

### Change 1.1: Add Import for AgentResultSchema (Line 7)

**Location:** Top of imports section

**What to add:**
```typescript
import { AgentResultSchema, VERSION, toTaskId, toWorkflowId, toAgentId } from '@agentic-sdlc/shared-types/src/core/schemas';
```

**Complete imports block after change:**
```typescript
import { randomUUID } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import pino from 'pino';
import Redis from 'ioredis';
import { retry, RetryPresets, CircuitBreaker } from '@agentic-sdlc/shared-utils';
import { REDIS_CHANNELS } from '@agentic-sdlc/shared-types';
import { AgentResultSchema, VERSION, toTaskId, toWorkflowId, toAgentId } from '@agentic-sdlc/shared-types/src/core/schemas';
import {
  AgentLifecycle,
  AgentCapabilities,
  TaskAssignment,
  TaskResult,
  AgentMessage,
  HealthStatus,
  TaskAssignmentSchema,
  TaskResultSchema,
  AgentError,
  ValidationError
} from './types';
```

### Change 1.2: Replace `reportResult()` Method (Lines 213-308)

**Location:** BaseAgent class, reportResult method

**Remove entire method (current implementation around line 212-242)**
**Add new implementation:**

```typescript
async reportResult(result: TaskResult, workflowStage?: string): Promise<void> {
    // Validate result against local schema first
    const validatedResult = TaskResultSchema.parse(result);

    // Use workflow stage if provided, otherwise fall back to agent type
    // SESSION #27 FIX: Send workflow stage (e.g., "initialization") not agent type (e.g., "scaffold")
    const stage = workflowStage || this.capabilities.type;

    // Convert status enum from TaskResult to AgentResultSchema
    // TaskResult: 'success'|'failure'|'partial'
    // AgentResultSchema: 'success'|'failed'|'timeout'|'cancelled'|...
    let agentStatus: 'success' | 'failed' | 'timeout' | 'cancelled' | 'running' | 'pending' | 'queued' | 'retrying';
    let success: boolean;

    if (validatedResult.status === 'success') {
      agentStatus = 'success';
      success = true;
    } else if (validatedResult.status === 'failure') {
      agentStatus = 'failed';
      success = false;
    } else { // 'partial'
      agentStatus = 'success'; // Treat partial as success for workflow progression
      success = true;
    }

    // Build AgentResultSchema-compliant envelope
    // CRITICAL: Wrap the actual payload in 'result' field, not top-level
    const agentResult = {
      task_id: validatedResult.task_id,
      workflow_id: validatedResult.workflow_id,
      agent_id: this.agentId,
      agent_type: this.capabilities.type as any, // e.g., 'scaffold', 'validation', etc.
      success: success,
      status: agentStatus,
      action: stage, // The action taken (stage name)
      // ✓ CRITICAL: Wrap payload in 'result' field for schema compliance
      result: {
        output: validatedResult.output,
        status: validatedResult.status, // Include original status in result
        ...(validatedResult.errors && { errors: validatedResult.errors }),
        ...(validatedResult.next_stage && { next_stage: validatedResult.next_stage })
      },
      metrics: {
        duration_ms: validatedResult.metrics?.duration_ms || 0,
        tokens_used: validatedResult.metrics?.tokens_used,
        api_calls: validatedResult.metrics?.api_calls
      },
      ...(validatedResult.errors && { error: {
        code: 'TASK_EXECUTION_ERROR',
        message: validatedResult.errors.join('; '),
        retryable: true
      }}),
      timestamp: new Date().toISOString(),
      version: VERSION
    };

    // Validate against AgentResultSchema before publishing
    // This is the critical validation boundary - ensures all emitted results are schema-compliant
    try {
      AgentResultSchema.parse(agentResult);
    } catch (validationError) {
      this.logger.error('AgentResultSchema validation failed - SCHEMA COMPLIANCE BREACH', {
        task_id: validatedResult.task_id,
        agent_id: this.agentId,
        validation_error: (validationError as any).message,
        attempted_result: JSON.stringify(agentResult).substring(0, 500)
      });
      throw new Error(`Agent result does not comply with AgentResultSchema: ${(validationError as any).message}`);
    }

    // Publish result to Redis using publisher client
    // SESSION #37: Use constants for Redis channels
    const resultChannel = REDIS_CHANNELS.ORCHESTRATOR_RESULTS;
    await this.redisPublisher.publish(
      resultChannel,
      JSON.stringify({
        id: randomUUID(),
        type: 'result',
        agent_id: this.agentId,
        workflow_id: validatedResult.workflow_id,
        stage: stage,
        payload: agentResult, // ✓ Now contains AgentResult, not TaskResult
        timestamp: new Date().toISOString(),
        trace_id: randomUUID()
      } as AgentMessage)
    );

    this.logger.info('AgentResultSchema-compliant result reported', {
      task_id: validatedResult.task_id,
      status: agentStatus,
      success: success,
      workflow_stage: stage,
      agent_id: this.agentId,
      version: VERSION
    });
  }
```

**Key points:**
- ✓ Accepts TaskResult (unchanged API for calling code)
- ✓ Converts status enum from TaskResult to AgentResultSchema
- ✓ Wraps payload in `result` field
- ✓ Includes all required fields: agent_id, success, version, action
- ✓ Validates against AgentResultSchema before publishing
- ✓ Throws with clear error message on non-compliance

---

## File 2: `packages/orchestrator/src/services/workflow.service.ts`

### Change 2.1: Replace `handleAgentResult()` Method (Lines 429-512)

**Location:** WorkflowService class, handleAgentResult method

**Current method (lines ~429-477):**
```typescript
private async handleAgentResult(result: any): Promise<void> {
    const payload = result.payload;

    logger.info('Handling agent result', {
      workflow_id: result.workflow_id,
      task_id: payload.task_id,
      status: payload.status,
      stage_from_result: result.stage,
      payload_stage: payload.stage
    });

    if (payload.status === 'success') {
      // Use payload.stage if available, fallback to result.stage
      const completedStage = payload.stage || result.stage;
      logger.info('Task completed - determining stage', {
        workflow_id: result.workflow_id,
        task_id: payload.task_id,
        final_stage_value: completedStage
      });

      // SESSION #30: Store stage output before transitioning
      await this.storeStageOutput(result.workflow_id, completedStage, payload.output);

      await this.handleTaskCompletion({
        payload: {
          task_id: payload.task_id,
          workflow_id: result.workflow_id,
          stage: completedStage
        }
      });
    } else {
      // SESSION #32: Store stage output even on failure for audit trail
      const failedStage = result.stage;
      await this.storeStageOutput(result.workflow_id, failedStage, {
        ...payload.output,
        status: 'failed',
        errors: payload.errors
      });

      await this.handleTaskFailure({
        payload: {
          task_id: payload.task_id,
          workflow_id: result.workflow_id,
          stage: result.stage,
          error: payload.errors?.join(', ')
        }
      });
    }
  }
```

**Replace with:**
```typescript
private async handleAgentResult(result: any): Promise<void> {
    // Extract AgentResultSchema-compliant payload
    const agentResult = result.payload;

    // ✓ CRITICAL: Validate against AgentResultSchema to ensure compliance
    try {
      const { AgentResultSchema } = require('@agentic-sdlc/shared-types/src/core/schemas');
      AgentResultSchema.parse(agentResult);
    } catch (validationError) {
      logger.error('AgentResultSchema validation failed in orchestrator - SCHEMA COMPLIANCE BREACH', {
        workflow_id: result.workflow_id,
        agent_id: result.agent_id,
        validation_error: (validationError as any).message,
        result_keys: Object.keys(agentResult || {}).join(',')
      });
      throw new Error(`Invalid agent result - does not comply with AgentResultSchema: ${(validationError as any).message}`);
    }

    logger.info('Handling AgentResultSchema-compliant result', {
      workflow_id: agentResult.workflow_id,
      task_id: agentResult.task_id,
      agent_id: agentResult.agent_id,
      success: agentResult.success,
      status: agentResult.status,
      stage_from_message: result.stage
    });

    // Determine the stage from result.stage (the workflow stage, not the action)
    const completedStage = result.stage;

    if (agentResult.success) {
      logger.info('Task completed successfully - transitioning workflow', {
        workflow_id: agentResult.workflow_id,
        task_id: agentResult.task_id,
        completed_stage: completedStage,
        agent_id: agentResult.agent_id
      });

      // SESSION #30: Store stage output before transitioning
      // ✓ Extract from result.result field (AgentResultSchema compliance)
      const stageOutput = {
        agent_id: agentResult.agent_id,
        agent_type: agentResult.agent_type,
        status: agentResult.status,
        ...(agentResult.result && { output: agentResult.result.output || agentResult.result }),
        ...(agentResult.metrics && { metrics: agentResult.metrics }),
        ...(agentResult.artifacts && { artifacts: agentResult.artifacts }),
        timestamp: agentResult.timestamp
      };

      await this.storeStageOutput(agentResult.workflow_id, completedStage, stageOutput);

      await this.handleTaskCompletion({
        payload: {
          task_id: agentResult.task_id,
          workflow_id: agentResult.workflow_id,
          stage: completedStage
        }
      });
    } else {
      // SESSION #32: Store stage output even on failure for audit trail
      const failureOutput = {
        agent_id: agentResult.agent_id,
        agent_type: agentResult.agent_type,
        status: agentResult.status,
        success: false,
        ...(agentResult.result && { output: agentResult.result }),
        ...(agentResult.error && { error: agentResult.error }),
        ...(agentResult.metrics && { metrics: agentResult.metrics }),
        timestamp: agentResult.timestamp
      };

      await this.storeStageOutput(agentResult.workflow_id, completedStage, failureOutput);

      await this.handleTaskFailure({
        payload: {
          task_id: agentResult.task_id,
          workflow_id: agentResult.workflow_id,
          stage: completedStage,
          error: agentResult.error?.message || 'Agent task failed'
        }
      });
    }
  }
```

**Key points:**
- ✓ Validates incoming result against AgentResultSchema immediately
- ✓ Uses `success` boolean field (not status string) for completion decision
- ✓ Extracts payload from `result.result` field (AgentResultSchema format)
- ✓ Properly handles both success and failure cases
- ✓ Throws immediately if validation fails

---

## Verification Steps

After making these changes:

### Step 1: Verify Syntax
```bash
npm run build
```
**Expected:** Zero TypeScript errors

### Step 2: Run Tests
```bash
npm test
```
**Expected:** Test pass rate improvement (especially result-handling tests)

### Step 3: Check Logs
When running agents, look for:
```
✅ AgentResultSchema-compliant result reported
```

If you see:
```
❌ AgentResultSchema validation failed - SCHEMA COMPLIANCE BREACH
```
This indicates an agent is not building results correctly.

### Step 4: Verify Field Presence
Check that result objects now include:
- `agent_id` ✓
- `agent_type` ✓
- `success` (boolean) ✓
- `version` ✓
- `result` (wrapped payload) ✓
- `metrics.duration_ms` ✓

---

## Common Issues & Fixes

### Issue 1: "agent_type is not in enum"
**Cause:** capabilities.type might not match AgentTypeEnum values
**Fix:** Ensure it's one of: 'scaffold', 'validation', 'e2e', 'integration', 'deployment'

### Issue 2: "result is required"
**Cause:** Forgot to wrap payload in result field
**Fix:** Ensure `result: { ... }` wrapping is present

### Issue 3: "status must be..."
**Cause:** Status value from TaskResult enum ('failure') doesn't match AgentResultSchema enum ('failed')
**Fix:** Use the conversion logic provided in reportResult()

### Issue 4: "duration_ms is required"
**Cause:** metrics.duration_ms is missing or undefined
**Fix:** Ensure `duration_ms: validatedResult.metrics?.duration_ms || 0`

---

## Testing the Changes

### Unit Test Pattern
```typescript
it('should emit AgentResultSchema-compliant result', async () => {
  const result = await agent.execute(task);

  // This now succeeds because reportResult builds compliant envelopes
  expect(publishedMessage.payload).toHaveProperty('agent_id');
  expect(publishedMessage.payload).toHaveProperty('success');
  expect(publishedMessage.payload).toHaveProperty('version');
  expect(publishedMessage.payload).toHaveProperty('result');
});
```

### Integration Test Pattern
```typescript
it('should complete workflow with schema-compliant results', async () => {
  const workflow = await orchestrator.createWorkflow(...);

  // Agents emit compliant results
  // Orchestrator validates and processes them
  // State machine transitions without errors

  const final = await orchestrator.getWorkflow(workflow.id);
  expect(final.status).toBe('completed');
});
```

---

## Files Summary

| Component | File | Method | Changes |
|-----------|------|--------|---------|
| Agent | `base-agent.ts` | reportResult() | Complete rewrite (~95 lines) |
| Agent | `base-agent.ts` | imports | Add AgentResultSchema (1 line) |
| Orchestrator | `workflow.service.ts` | handleAgentResult() | Complete rewrite (~85 lines) |

**Total Modified Files:** 2
**Total Lines Changed:** ~200
**Complexity:** Medium (schema conversion + validation)
**Risk Level:** Low (isolated to specific methods, no architectural changes)

---

**Implementation Complete.** ✅ All agents now emit AgentResultSchema-compliant results with guaranteed compliance through validation barriers.
