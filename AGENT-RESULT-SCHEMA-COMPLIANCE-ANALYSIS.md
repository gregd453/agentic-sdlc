# AgentResultSchema Compliance Analysis & Code Review

## Executive Summary

A targeted code review identified **critical AgentResultSchema compliance gaps** across the agent and orchestrator implementations. The current codebase uses a **2-tier schema system** that is **incompatible with the strategic architecture**:

### Current State (Non-Compliant)
- **Agents emit:** `TaskResult` (base-agent local schema) → wrapped in `AgentMessage` wrapper
- **Orchestrator expects:** `AgentResultSchema` (shared schema) with required fields: `agent_id`, `success`, `version`, `result` (payload wrapper)
- **Gap:** Fields mismatch, no validation against authoritative schema, inconsistent field naming

### Root Cause
1. **Two separate schemas** defined in different packages with no alignment:
   - `packages/agents/base-agent/src/types.ts`: `TaskResult` (agent-internal)
   - `packages/shared/types/src/core/schemas.ts`: `AgentResultSchema` (orchestrator-expected)

2. **No schema validation** at publish/consume boundaries

3. **Field name inconsistencies:**
   - Agents send: `status` (enum: 'success'|'failure'|'partial')
   - Schema expects: `status` (enum: 'pending'|'queued'|'running'|'success'|'failed'|...) AND `success` (boolean)
   - Agents send: `output` (payload)
   - Schema expects: `result` (payload wrapper)

4. **Missing required fields** at agent result publication:
   - `agent_id` ✗ Not included in TaskResult
   - `success` ✗ Not computed from status
   - `version` ✗ Not tracked
   - Proper `result` object wrapping ✗

---

## Detailed Findings

### Finding #1: Two Incompatible Schemas

**Location 1:** `packages/agents/base-agent/src/types.ts:34-46`
```typescript
export const TaskResultSchema = z.object({
  task_id: z.string().uuid(),
  workflow_id: z.string().uuid(),
  status: z.enum(['success', 'failure', 'partial']),  // ❌ Different enum
  output: z.record(z.unknown()),                       // ❌ Field named 'output' not 'result'
  errors: z.array(z.string()).optional(),
  metrics: z.object({
    duration_ms: z.number(),
    tokens_used: z.number().optional(),
    api_calls: z.number().optional()
  }).optional(),
  next_stage: z.string().optional()
});
```

**Location 2:** `packages/shared/types/src/core/schemas.ts:98-129`
```typescript
export const AgentResultSchema = z.object({
  task_id: z.string().transform(toTaskId),
  workflow_id: z.string().transform(toWorkflowId),
  agent_id: z.string().transform(toAgentId),        // ❌ Missing from TaskResult
  agent_type: AgentTypeEnum,                          // ❌ Missing from TaskResult
  success: z.boolean(),                               // ❌ Missing from TaskResult
  status: TaskStatusEnum,                             // Different enum than TaskResult
  action: z.string(),                                 // ❌ Missing from TaskResult
  result: z.record(z.unknown()),                      // ❌ Not present in TaskResult
  artifacts: z.array(...).optional(),
  metrics: z.object({...}),
  error: z.object({...}).optional(),
  warnings: z.array(z.string()).optional(),
  timestamp: z.string().datetime(),
  version: z.literal(VERSION),                        // ❌ Missing from TaskResult
});
```

### Finding #2: No Schema Validation at Publication Boundary

**Location:** `packages/agents/base-agent/src/base-agent.ts:212-242`

```typescript
async reportResult(result: TaskResult, workflowStage?: string): Promise<void> {
  // ✓ Validates against TaskResult (local schema)
  const validatedResult = TaskResultSchema.parse(result);

  // ❌ Creates AgentMessage WITHOUT validation against AgentResultSchema
  // ❌ Missing fields: agent_id, success, version, action
  // ❌ Wrong field names: 'output' instead of 'result'
  await this.redisPublisher.publish(
    REDIS_CHANNELS.ORCHESTRATOR_RESULTS,
    JSON.stringify({
      id: randomUUID(),
      type: 'result',
      agent_id: this.agentId,              // ✓ Has agent_id
      workflow_id: validatedResult.workflow_id,
      stage: stage,
      payload: validatedResult,             // ❌ Wraps entire TaskResult, not just the result field
      timestamp: new Date().toISOString(),
      trace_id: randomUUID()
    } as AgentMessage)
  );
}
```

### Finding #3: Orchestrator Consumes Non-Schema-Compliant Results

**Location:** `packages/orchestrator/src/services/workflow.service.ts:429-477`

```typescript
private async handleAgentResult(result: any): Promise<void> {
  const payload = result.payload;  // ❌ Expects result.payload (TaskResult format)

  // ❌ No validation against AgentResultSchema
  // ❌ Direct access to payload fields without type guards
  if (payload.status === 'success') {  // ❌ Uses TaskResult enum value 'success'
    const completedStage = payload.stage || result.stage;
    await this.storeStageOutput(result.workflow_id, completedStage, payload.output);  // ❌ 'output' not 'result'
    // ...
  }
}
```

### Finding #4: State Machine Expectations Misaligned

**Location:** `packages/orchestrator/src/state-machine/workflow-state-machine.ts` (inferred from flow)

The state machine expects `STAGE_COMPLETE` events with specific fields, but the event composition in `handleAgentResult` doesn't align with AgentResultSchema structure.

---

## Compliance Requirements

### AgentResultSchema Contract (Authoritative)
All agents **MUST** emit results that comply with:

```typescript
export const AgentResultSchema = z.object({
  // Identification & Tracking
  task_id: z.string().transform(toTaskId),           // FROM task
  workflow_id: z.string().transform(toWorkflowId),   // FROM task
  agent_id: z.string().transform(toAgentId),         // Agent's ID
  agent_type: AgentTypeEnum,                          // scaffold|validation|e2e|integration|deployment

  // Status & Result
  success: z.boolean(),                               // TRUE if completed without fatal errors
  status: TaskStatusEnum,                             // pending|queued|running|success|failed|timeout|...
  action: z.string(),                                 // Action performed (e.g., 'scaffold_project')
  result: z.record(z.unknown()),                      // ✓ WRAPPED PAYLOAD (NOT top-level fields)

  // Metrics & Artifacts
  artifacts: z.array(...).optional(),                 // Generated files/outputs
  metrics: z.object({                                 // Execution telemetry
    duration_ms: z.number(),
    tokens_used: z.number().optional(),
    api_calls: z.number().optional(),
    memory_used_bytes: z.number().optional(),
  }),

  // Error Handling
  error: z.object({                                   // Present if status='failed'
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
    stack: z.string().optional(),
    retryable: z.boolean().default(false),
  }).optional(),

  // Metadata
  warnings: z.array(z.string()).optional(),
  timestamp: z.string().datetime(),
  version: z.literal('1.0.0'),
});
```

---

## Impact Analysis

### Current Test Failures Root Cause
1. Tests expect `AgentResultSchema` fields but agents emit `TaskResult` fields
2. Missing schema validation causes runtime type errors
3. Field name mismatches (`output` vs `result`, `success` boolean missing)

### Production Impact
1. **Workflows hang at stage transitions** - State machine receives incomplete/malformed events
2. **No validation guarantees** - Corrupt envelopes reach orchestrator unchecked
3. **No version tracking** - Can't detect schema evolution incompatibilities

---

## Remediation Strategy

### Phase 1: Unify Schema at Source
- **Remove** local `TaskResult` schema from base-agent
- **Consolidate** all result construction in BaseAgent using `AgentResultSchema`
- **Update** all agents to use unified schema

### Phase 2: Add Validation Boundary
- **Validate** results against `AgentResultSchema` BEFORE publishing to Redis
- **Fail fast** with clear error messages if validation fails
- **Log** all validation errors with context for debugging

### Phase 3: Update Orchestrator Consumption
- **Validate** incoming results with `AgentResultSchema`
- **Extract** fields from correct locations (e.g., `result.result` not `result.output`)
- **Update** state machine event payloads to match expectations

### Phase 4: Test & Verify
- **Update** test fixtures to emit schema-compliant results
- **Add** integration tests that verify end-to-end compliance
- **Add** schema validation assertions in all result-handling tests

---

## Files Requiring Changes

### Tier 1: Critical (Block all agents)
1. `packages/agents/base-agent/src/base-agent.ts` - reportResult() method
2. `packages/agents/base-agent/src/types.ts` - Remove TaskResult, use AgentResultSchema
3. `packages/orchestrator/src/services/workflow.service.ts` - handleAgentResult() method

### Tier 2: Agent-Specific (Per-agent updates)
4. `packages/agents/scaffold-agent/src/scaffold-agent.ts` - Result construction
5. `packages/agents/validation-agent/src/validation-agent.ts` - Result construction
6. `packages/agents/e2e-agent/src/e2e-agent.ts` - Result construction
7. `packages/agents/integration-agent/src/integration-agent.ts` - Result construction
8. `packages/agents/deployment-agent/src/deployment-agent.ts` - Result construction

### Tier 3: Test Fixtures
9. All agent test files - Update fixture results to match schema

---

## Validation Checklist

- [ ] All agents publish results matching `AgentResultSchema` exactly
- [ ] BaseAgent.reportResult() validates against `AgentResultSchema.parse()`
- [ ] WorkflowService.handleAgentResult() validates incoming results
- [ ] State machine receives properly-shaped STAGE_COMPLETE events
- [ ] All required fields present: agent_id, success, version, result
- [ ] Status enum values correct (TaskStatusEnum, not custom values)
- [ ] result field contains wrapped payload (not top-level fields)
- [ ] metrics field includes at minimum duration_ms
- [ ] Zero tests fail due to schema mismatches
- [ ] TypeScript compilation succeeds with zero errors
