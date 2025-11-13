# Agent Result Schema & Flow Map

## 1. AUTHORITATIVE SCHEMA DEFINITIONS

### Location
**`packages/shared/types/src/core/schemas.ts`** - Lines 97-129

### Base AgentResultSchema
```typescript
export const AgentResultSchema = z.object({
  task_id: z.string().transform(toTaskId),
  workflow_id: z.string().transform(toWorkflowId),
  agent_id: z.string().transform(toAgentId),
  agent_type: AgentTypeEnum,
  success: z.boolean(),
  status: TaskStatusEnum,  // 'pending'|'queued'|'running'|'success'|'failed'|'timeout'|'cancelled'|'retrying'
  action: z.string(),
  result: z.record(z.unknown()),  // Action-specific result data
  artifacts: z.array(z.object({
    name: z.string(),
    path: z.string(),
    type: z.string(),
    size_bytes: z.number().optional(),
  })).optional(),
  metrics: z.object({
    duration_ms: z.number(),
    tokens_used: z.number().optional(),
    api_calls: z.number().optional(),
    memory_used_bytes: z.number().optional(),
  }),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
    stack: z.string().optional(),
    retryable: z.boolean().default(false),
  }).optional(),
  warnings: z.array(z.string()).optional(),
  timestamp: z.string().datetime(),
  version: z.literal(VERSION),
});

// Type inference
export type AgentResult = z.infer<typeof AgentResultSchema>;

// Type guard
export const isAgentResult = (data: unknown): data is AgentResult => {
  return AgentResultSchema.safeParse(data).success;
};
```

### Agent-Specific Result Schemas

#### ScaffoldResultSchema
**File:** `packages/shared/types/src/agents/scaffold.ts` (Lines 95-176)
- Extends: `AgentResultSchema`
- agent_type: `'scaffold'` (literal)
- action: `ScaffoldActionEnum` (generate_structure|analyze_requirements|create_templates|validate_structure|generate_config)
- result object contains:
  - files_generated: array with path, type, size_bytes, checksum, template_source, content_preview
  - structure: root_path, directories, entry_points, config_files, test_files, total_lines_of_code
  - templates_used: array with name, version, source
  - analysis: estimated_complexity, recommended_agents, dependencies_identified, potential_issues, ai_suggestions
  - package_info: name, version, scripts, dependencies, dev_dependencies
  - generation_metrics: total_files, total_directories, total_size_bytes, generation_time_ms
  - next_steps: array with agent, action, reason, priority

#### ValidationResultSchema
**File:** `packages/shared/types/src/agents/validation.ts` (Lines 112-204)
- Extends: `AgentResultSchema`
- agent_type: `'validation'` (literal)
- action: `ValidationActionEnum`
- result object contains:
  - valid: boolean
  - passed_quality_gates: boolean
  - errors: ValidationErrorSchema array
  - metrics: ValidationMetricsSchema
  - quality_gates: QualityGateResultSchema array
  - reports: typescript, eslint, security, coverage (optional objects)
  - recommendations: array with type, priority, message, file, line, effort
  - summary: overall_status, total_issues, critical_issues, time_to_fix_estimate_minutes, next_actions

#### DeploymentResultSchema (Extended)
**File:** `packages/shared/types/src/agents/deployment.ts` (Lines 320-336)
- Extends: `AgentResultSchema`
- agent_type: `'deployment'` (literal)
- action: `DeploymentActionEnum`
- result: Union of 5 specific result types:
  1. BuildResultSchema: success, image_id, image_size_bytes, build_duration_ms, layers, warnings
  2. PushResultSchema: success, repository_uri, image_digest, image_uri, pushed_at
  3. DeploymentResultSchema: success, deployment_id, task_definition_arn, service_arn, desired_count, running_count, deployment_status, tasks, rollback_info
  4. RollbackResultSchema: success, previous_deployment_id, rolled_back_to_deployment_id, rollback_duration_ms
  5. HealthCheckResultSchema: healthy, status_code, response_time_ms, error

#### IntegrationResultSchema
**File:** `packages/shared/types/src/agents/integration.ts` (Lines 218-233)
- Extends: `AgentResultSchema`
- agent_type: `'integration'` (literal)
- action: `IntegrationActionEnum`
- result: Union of 4 specific result types:
  1. MergeResultSchema: success, merge_commit, conflicts_resolved, conflicts_remaining, files_changed, conflicts, rollback_performed
  2. ConflictResolutionResultSchema: success, resolved_conflicts, unresolved_conflicts
  3. DependencyUpdateResultSchema: success, updates, tests_passed, pull_request_url
  4. IntegrationTestResultSchema: success, total_tests, passed, failed, skipped, duration_ms, failed_tests

---

## 2. AGENT RESULT CONSTRUCTION

### BaseAgent Implementation
**File:** `packages/agents/base-agent/src/base-agent.ts`

#### TaskResult Type Definition
```typescript
// From TaskResultSchema in base-agent/src/types.ts
interface TaskResult {
  task_id: string;
  workflow_id: string;
  status: 'success' | 'failure';
  output: Record<string, unknown>;
  errors?: string[];
}
```

**⚠️ MISMATCH ALERT:** BaseAgent uses `TaskResult` (simple schema) but publishes as wrapper with extra fields!

#### Result Publishing Flow (reportResult method, lines 212-242)
```typescript
async reportResult(result: TaskResult, workflowStage?: string): Promise<void> {
  // 1. Validate result against TaskResultSchema
  const validatedResult = TaskResultSchema.parse(result);

  // 2. Determine stage (prefer workflowStage from envelope)
  const stage = workflowStage || this.capabilities.type;

  // 3. Create AgentMessage wrapper
  const resultChannel = REDIS_CHANNELS.ORCHESTRATOR_RESULTS;
  await this.redisPublisher.publish(
    resultChannel,
    JSON.stringify({
      id: randomUUID(),
      type: 'result',
      agent_id: this.agentId,
      workflow_id: validatedResult.workflow_id,
      stage: stage,
      payload: validatedResult,  // ← TaskResult payload
      timestamp: new Date().toISOString(),
      trace_id: randomUUID()
    } as AgentMessage)
  );
}
```

**Structure Published to Redis:**
```typescript
{
  id: string (UUID),
  type: 'result',
  agent_id: string,
  workflow_id: string,
  stage: string,
  payload: TaskResult,  // ← { task_id, workflow_id, status, output, errors? }
  timestamp: ISO string,
  trace_id: UUID
}
```

### Agent-Specific Implementations

#### ScaffoldAgent (lines 56-150)
```typescript
async execute(task: TaskAssignment): Promise<TaskResult> {
  // Constructs result as TaskResult type:
  return {
    task_id: scaffoldTask.task_id,
    workflow_id: scaffoldTask.workflow_id,
    status: 'success',
    output: {
      files_generated: [...],
      structure: {...},
      templates_used: [...],
      analysis: {...},
      package_info: {...},
      generation_metrics: {...},
      next_steps: [...]
    },
    errors: undefined
  };
}
```

#### ValidationAgent (lines 63-300+)
```typescript
async execute(task: TaskAssignment): Promise<TaskResult> {
  // 1. Extracts envelope from task.context
  const envelopeData = taskObj.context;  // ← AgentEnvelope format
  
  // 2. Validates envelope
  const validation = validateEnvelope(envelopeData);
  
  // 3. Constructs result as TaskResult
  return {
    task_id: task.task_id,
    workflow_id: task.workflow_id,
    status: 'success',
    output: {
      valid: boolean,
      errors: ValidationErrorSchema[],
      metrics: ValidationMetricsSchema,
      quality_gates: QualityGateResultSchema[],
      reports: {...},
      recommendations: [...],
      summary: {...}
    }
  };
}
```

---

## 3. REDIS MESSAGE BUS PATTERN

### Channel Names
**Source:** `packages/shared/types/src/constants/pipeline.constants.ts`

```typescript
export const REDIS_CHANNELS = {
  // Agent receives tasks on type-specific channels
  AGENT_TASKS: (agentType: string) => `agents:${agentType}:tasks`,
  
  // All agents publish results to single orchestrator channel
  ORCHESTRATOR_RESULTS: 'orchestrator:results',
  
  // Workflow events (used by state machine)
  WORKFLOW_EVENTS: 'workflow:events'
};
```

### Message Flow Diagram
```
Agent A (Scaffold)
  └─→ TaskAssignment
      └─→ execute()
          └─→ TaskResult
              └─→ reportResult()
                  └─→ JSON.stringify(AgentMessage)
                      └─→ REDIS: orchestrator:results

Orchestrator AgentDispatcherService
  └─→ subscribe(ORCHESTRATOR_RESULTS)
      └─→ handleAgentResult(message: string)
          └─→ JSON.parse() → AgentMessage
              └─→ resultHandlers.get(workflow_id)
                  └─→ callback(result)
```

---

## 4. ORCHESTRATOR RESULT CONSUMPTION

### AgentDispatcherService
**File:** `packages/orchestrator/src/services/agent-dispatcher.service.ts`

#### Subscription Setup (lines 92-145)
```typescript
private async setupResultListener(): Promise<void> {
  const channel = REDIS_CHANNELS.ORCHESTRATOR_RESULTS;
  
  const boundHandler = this.handleAgentResult.bind(this);
  
  await this.redisSubscriber.subscribe(channel, async (message: string) => {
    try {
      logger.info('📨 RAW MESSAGE RECEIVED FROM REDIS');
      await boundHandler(message);
    } catch (error) {
      logger.error('❌ ERROR IN MESSAGE CALLBACK');
    }
  });
}
```

#### Result Handling (lines 150-220)
```typescript
private async handleAgentResult(message: string): Promise<void> {
  try {
    // 1. Parse message from Redis
    let result: any = JSON.parse(message);
    // result is AgentMessage type with structure:
    // {
    //   id: string,
    //   type: 'result',
    //   agent_id: string,
    //   workflow_id: string,
    //   status?: string,
    //   payload: TaskResult,  // ← The actual result
    //   timestamp: string,
    //   trace_id: string
    // }

    // 2. Find registered callback for this workflow
    const handler = this.resultHandlers.get(result.workflow_id);
    
    if (handler) {
      // 3. Call handler (passes entire AgentMessage)
      await handler(result);
      
      // 4. Clean up on terminal status
      if (result.payload?.status === 'success' || 'failure') {
        this.resultHandlers.delete(result.workflow_id);
      }
    } else {
      logger.warn('❌ NO HANDLER FOUND FOR WORKFLOW');
    }
  } catch (error) {
    logger.error('Failed to process agent result');
  }
}
```

#### Handler Registration
```typescript
// Called by WorkflowService when creating task
registerResultHandler(
  workflowId: string,
  handler: (result: any) => Promise<void>
): void {
  this.resultHandlers.set(workflowId, handler);
  
  // Set timeout to clean up stale handlers
  const timeout = setTimeout(() => {
    this.resultHandlers.delete(workflowId);
  }, this.HANDLER_TIMEOUT_MS);
  
  this.handlerTimeouts.set(workflowId, timeout);
}
```

### State Machine Integration
**File:** `packages/orchestrator/src/state-machine/workflow-state-machine.ts`

#### Event Flow (lines 58-77)
```typescript
running: {
  on: {
    STAGE_COMPLETE: [
      {
        // Guard: deduplication check
        guard: ({ context, event }: any) => {
          if (!context._seenEventIds) context._seenEventIds = new Set();
          const eventId = event.eventId;
          return !context._seenEventIds.has(eventId);
        },
        target: 'evaluating',
        actions: [
          'updateProgress',
          'logStageComplete',
          'computeNextStageOnEvent',
          'trackEventId'
        ]
      }
    ]
  }
}
```

#### State Transition Actions
```typescript
updateProgress: ({ context, event }) => {
  if (event.type === 'STAGE_COMPLETE') {
    context.progress = Math.min(100, context.progress + 15);
  }
}

computeNextStageOnEvent: assign({
  nextStage: ({ context }) => {
    // Compute next stage based on current stage
    // Returns undefined if completed
    // Returns next stage name otherwise
  }
})
```

#### Evaluating State (lines 128-159)
```typescript
evaluating: {
  entry: 'logEvaluatingEntry',
  invoke: {
    id: 'advanceStage',
    src: fromPromise(async ({ input }: any) => {
      // Simulate async work (stage already computed)
      await new Promise(resolve => setTimeout(resolve, 10));
      return input.nextStage;  // undefined or next stage
    }),
    input: ({ context }: any) => ({
      workflow_id: context.workflow_id,
      nextStage: context.nextStage
    }),
    onDone: [
      {
        // If nextStage is undefined, mark complete
        guard: ({ context }: any) => context.nextStage === undefined,
        target: 'completed',
        actions: ['markComplete']
      },
      {
        // Otherwise transition to next stage
        target: 'running',
        actions: ['transitionToNextStageAbsolute']
      }
    ]
  }
}
```

---

## 5. SCHEMA MISMATCH ANALYSIS

### Current State
The system has **TWO SEPARATE RESULT SCHEMAS** in use:

**System 1: BaseAgent → TaskResult (Simplified)**
- Location: `packages/agents/base-agent/src/types.ts`
- Structure: `{ task_id, workflow_id, status, output, errors? }`
- Used by: All agents (extend BaseAgent and return TaskResult)

**System 2: Shared Types → AgentResultSchema (Comprehensive)**
- Location: `packages/shared/types/src/core/schemas.ts` (lines 97-129)
- Structure: `{ task_id, workflow_id, agent_id, agent_type, success, status, action, result, artifacts, metrics, error, warnings, timestamp, version }`
- Used by: Contracts, type definitions, validation
- **NOT CURRENTLY USED** by agent implementations

### Gap Analysis

| Aspect | TaskResult | AgentResultSchema | Issue |
|--------|-----------|------------------|-------|
| task_id | ✅ | ✅ | ✅ Same |
| workflow_id | ✅ | ✅ | ✅ Same |
| status | ✅ (success\|failure) | ✅ (TaskStatusEnum) | ⚠️ Different enum values |
| output | ✅ | result | ⚠️ Field name mismatch |
| agent_id | ❌ | ✅ | ⚠️ Missing from TaskResult |
| agent_type | ❌ | ✅ | ⚠️ Missing from TaskResult |
| success | ❌ | ✅ | ⚠️ Missing from TaskResult |
| action | ❌ | ✅ | ⚠️ Missing from TaskResult |
| metrics | ❌ | ✅ | ⚠️ Missing from TaskResult |
| error | ❌ (in errors array) | ✅ (structured object) | ⚠️ Different structure |
| artifacts | ❌ | ✅ | ⚠️ Missing from TaskResult |
| warnings | ❌ | ✅ | ⚠️ Missing from TaskResult |
| timestamp | ❌ | ✅ | ⚠️ Missing from TaskResult |
| version | ❌ | ✅ | ⚠️ Missing from TaskResult |

### Enumeration Mismatch
```typescript
// TaskResult status (in base-agent/src/types.ts)
status: 'success' | 'failure'

// AgentResultSchema status (in core/schemas.ts)
status: TaskStatusEnum = 'pending'|'queued'|'running'|'success'|'failed'|'timeout'|'cancelled'|'retrying'
```

**Issue:** TaskResult uses `'success'|'failure'` but schema expects full enum with 'failed' not 'failure'

---

## 6. MESSAGE PUBLICATION WRAPPER

### What Gets Published to Redis

```typescript
// Original result from agent
{
  task_id: string,
  workflow_id: string,
  status: 'success' | 'failure',
  output: Record<string, any>,
  errors?: string[]
}

// Wrapped by BaseAgent.reportResult() as AgentMessage
{
  id: UUID,
  type: 'result',
  agent_id: string,
  workflow_id: string,
  stage: string,  // ← workflow stage name or agent type
  payload: {
    task_id: string,
    workflow_id: string,
    status: 'success' | 'failure',
    output: Record<string, any>,
    errors?: string[]
  },
  timestamp: ISO string,
  trace_id: UUID
}

// Received by AgentDispatcherService.handleAgentResult()
// Handler uses: result.payload.status, result.agent_id, result.workflow_id
```

### Actual Field Access Paths

In `agent-dispatcher.service.ts` (line 179):
```typescript
const status = result.payload?.status;  // 'success' or 'failure'
```

In `agent-dispatcher.service.ts` (line 185):
```typescript
const handler = this.resultHandlers.get(result.workflow_id);  // Top-level field
```

---

## 7. CONTRACTS LAYER

**File:** `packages/shared/contracts/src/contracts/`

Each agent has a contract file that defines:
- Request/response schemas
- Validation rules
- Version compatibility

Example (`scaffold.contract.ts`):
```typescript
export const SCAFFOLD_CONTRACT = {
  version: '1.0.0',
  requests: {
    generate_structure: { /* payload schema */ }
  },
  responses: {
    generate_structure: { /* result schema */ }
  }
};
```

**Current Status:** Contracts exist but are not actively validated against results

---

## 8. SUMMARY OF CURRENT FLOW

```
1. TASK CREATION (WorkflowService)
   └─→ AgentTask created with task_id, workflow_id, action, payload

2. TASK DISPATCH (AgentDispatcherService.dispatchTask)
   └─→ Wraps in AgentMessage
   └─→ Publishes to REDIS: agents:{agent_type}:tasks

3. AGENT RECEIVES (BaseAgent)
   └─→ Subscribes to agents:{agent_type}:tasks
   └─→ receiveTask() validates with TaskAssignmentSchema
   └─→ Extracts envelope from message.payload.context

4. AGENT EXECUTES (Specific Agent impl)
   └─→ execute(task) returns TaskResult
   └─→ result: { task_id, workflow_id, status, output }

5. RESULT PUBLISHED (BaseAgent.reportResult)
   └─→ Wraps TaskResult in AgentMessage
   └─→ Publishes to REDIS: orchestrator:results
   └─→ { id, type, agent_id, workflow_id, stage, payload, timestamp, trace_id }

6. ORCHESTRATOR RECEIVES (AgentDispatcherService)
   └─→ Subscribes to orchestrator:results
   └─→ handleAgentResult() parses message
   └─→ Calls registered handler with AgentMessage

7. STATE MACHINE UPDATES (WorkflowService)
   └─→ Handler fires STAGE_COMPLETE event
   └─→ State machine transitions to evaluating
   └─→ Computes nextStage
   └─→ If nextStage exists, creates new task for next agent
   └─→ If nextStage undefined, marks workflow completed
```

---

## 9. KEY FILES REFERENCE

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| **Schema** | `packages/shared/types/src/core/schemas.ts` | 97-129 | AgentResultSchema definition |
| **Agent-Specific** | `packages/shared/types/src/agents/*.ts` | various | Extended result schemas |
| **Agent Task** | `packages/agents/base-agent/src/types.ts` | all | TaskResult, TaskAssignmentSchema |
| **BaseAgent** | `packages/agents/base-agent/src/base-agent.ts` | 212-242 | reportResult() implementation |
| **Dispatcher** | `packages/orchestrator/src/services/agent-dispatcher.service.ts` | 150-220 | handleAgentResult() |
| **State Machine** | `packages/orchestrator/src/state-machine/workflow-state-machine.ts` | 58-164 | STAGE_COMPLETE event handling |
| **Constants** | `packages/shared/types/src/constants/pipeline.constants.ts` | all | REDIS_CHANNELS |

---

## 10. RECOMMENDATIONS

### To Align Schemas
1. Update TaskResult to include agent_id, agent_type, action, metrics
2. Change status enum from 'success'|'failure' to TaskStatusEnum
3. Rename 'output' field to 'result' for consistency
4. Add timestamp, version fields
5. Update TaskResultSchema to match AgentResultSchema structure

### To Improve Contracts
1. Auto-validate agent results against contracts
2. Add contract version negotiation
3. Store contract versions in each result

### To Enhance Observability
1. Add detailed trace IDs to results (currently in wrapper only)
2. Include metrics in all result objects
3. Track result validation against schema
