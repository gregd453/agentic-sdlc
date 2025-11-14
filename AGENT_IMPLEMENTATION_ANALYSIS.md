# Agent Implementation Analysis

**Generated:** 2025-11-14
**Purpose:** Comprehensive comparison of all agent implementations to identify patterns, inconsistencies, and consolidation opportunities

---

## Executive Summary

This document analyzes all 5 agent implementations (Scaffold, Validation, E2E, Integration, Deployment) to identify:
- Common patterns that could be abstracted to BaseAgent
- Inconsistent approaches to the same problems
- Schema mismatches between TaskAssignment and agent-specific types
- Opportunities for shared utilities

### Key Findings

1. **Critical Schema Mismatch**: All agents receive `TaskAssignment` but parse it differently to extract their agent-specific payloads
2. **Inconsistent Task Parsing**: 5 different approaches to extracting task data from the envelope
3. **Duplicate Claude Integration**: Scaffold and E2E both implement Claude API calls independently
4. **Missing Standardization**: No common pattern for task-to-internal mapping
5. **Error Handling Variance**: Different error reporting strategies across agents

---

## Comparison Matrix

| Dimension | Scaffold | Validation | E2E | Integration | Deployment |
|-----------|----------|------------|-----|-------------|------------|
| **Task Input Type** | `TaskAssignment` | `TaskAssignment` | `TaskAssignment` | `IntegrationTask` | `DeploymentTask` |
| **Internal Task Type** | `ScaffoldTask` | N/A (uses envelope) | `E2ETaskContext` | `IntegrationTask` | `DeploymentTask` |
| **Task Parsing Method** | Manual envelope parsing | Envelope validation + extraction | Schema parse on `task.context` | Direct schema parse | Direct schema parse |
| **Claude API Usage** | ✅ Yes (requirements analysis) | ❌ No | ✅ Yes (test generation) | ✅ Yes (conflict resolution) | ❌ No |
| **Result Type** | `TaskResult` | `TaskResult` | `TaskResult` | `IntegrationResult` → `TaskResult` | `DeploymentResultType` → `TaskResult` |
| **Error Handling** | Try-catch with fallback result | Try-catch with AgentError | Try-catch with failure result | Try-catch with re-throw | Try-catch with rollback |
| **Schema Validation** | ❌ No input validation | ✅ validateEnvelope() | ✅ E2ETaskContextSchema.parse() | ✅ IntegrationTaskSchema.parse() | ✅ DeploymentTaskSchema.parse() |
| **Helper Methods** | parseClaudeJsonResponse() | runValidationChecks() | generateTests() | handleMergeBranch(), etc. | handleBuildDockerImage(), etc. |
| **Dependencies** | TemplateEngine, FileGenerator | Validators (TS, ESLint, etc.) | TestGenerator, PlaywrightRunner | GitService, ConflictResolver, etc. | DockerService, ECSService, etc. |
| **Execute Wrapper** | ❌ Direct execute() | ❌ Direct execute() | ❌ Direct execute() | ✅ executeTask() + execute() wrapper | ✅ executeTask() + execute() wrapper |

---

## Detailed Analysis by Dimension

### 1. Task Input Handling

#### Pattern A: Manual Envelope Parsing (Scaffold)
```typescript
// Scaffold Agent - Lines 70-101
const envelope = task as any;
const scaffoldTask: ScaffoldTask = {
  task_id: task.task_id as any,
  workflow_id: task.workflow_id as any,
  agent_type: AGENT_TYPES.SCAFFOLD as any,
  action: 'generate_structure',
  // ... manual field mapping
  payload: {
    project_type: envelope.payload?.project_type || 'app',
    name: envelope.payload?.name || task.name || 'untitled',
    // ... more fallbacks
  }
};
```

**Issues:**
- ❌ No type safety
- ❌ Multiple fallback chains (`envelope.payload?.name || task.name || 'untitled'`)
- ❌ Manual type assertions (`as any`)
- ❌ No schema validation

#### Pattern B: Envelope Validation (Validation)
```typescript
// Validation Agent - Lines 78-137
const taskObj = task as any;
const envelopeData = taskObj.context;

const validation = validateEnvelope(envelopeData);
if (!validation.success) {
  throw new AgentError(`Invalid envelope: ${validation.error}`, 'ENVELOPE_VALIDATION_ERROR');
}

const envelope = validation.envelope!;
if (!isValidationEnvelope(envelope)) {
  throw new AgentError(`Wrong agent type: expected validation, got ${envelope.agent_type}`, 'WRONG_AGENT_TYPE');
}

// Extract context from envelope (type-safe!)
const context = {
  project_path: envelope.payload.working_directory,
  validation_types: envelope.payload.validation_types.filter(...),
  // ...
};
```

**Issues:**
- ✅ Type-safe envelope validation
- ✅ Agent type verification
- ⚠️ Still requires manual context extraction
- ⚠️ Assumes envelope is at `task.context`

#### Pattern C: Schema Parse on Context (E2E)
```typescript
// E2E Agent - Lines 219-227
private parseTaskContext(task: TaskAssignment): E2ETaskContext {
  try {
    const context = E2ETaskContextSchema.parse(task.context);
    return context;
  } catch (error) {
    this.logger.error('Invalid task context', { error, context: task.context });
    throw new Error(`Invalid task context: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
```

**Issues:**
- ✅ Clean schema validation
- ✅ Type-safe result
- ⚠️ Assumes all task data is in `task.context`
- ❌ Doesn't use task-level fields (task_id, workflow_id, etc.)

#### Pattern D: Direct Schema Parse (Integration/Deployment)
```typescript
// Integration Agent - Lines 51-56
async executeTask(task: IntegrationTask): Promise<IntegrationResult> {
  const validatedTask = IntegrationTaskSchema.parse(task);
  // ...
}

// Deployment Agent - Lines 64-69
async executeTask(task: DeploymentTask): Promise<DeploymentResultType> {
  const validatedTask = DeploymentTaskSchema.parse(task);
  // ...
}
```

**Issues:**
- ✅ Direct validation of full task object
- ✅ Type-safe throughout
- ❌ Incompatible with `TaskAssignment` schema from BaseAgent
- ❌ Requires execute() wrapper to bridge types

### 2. TaskAssignment → Agent-Specific Type Mapping

**Root Cause:** BaseAgent expects `TaskAssignment`, but agents need different schemas:

```typescript
// BaseAgent.types.ts - Lines 19-29
export const TaskAssignmentSchema = z.object({
  task_id: z.string().uuid(),
  workflow_id: z.string().uuid(),
  type: z.string(),
  name: z.string(),
  description: z.string(),
  requirements: z.string(),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  context: z.record(z.unknown()).optional(),  // ← Generic catch-all
  deadline: z.string().optional()
});
```

**Problem:** Each agent needs different fields in different structures:

| Agent | What It Needs | Where It Looks |
|-------|---------------|----------------|
| Scaffold | `project_type`, `tech_stack`, `template` | `task.payload.*` or `task.*` |
| Validation | `working_directory`, `validation_types`, `thresholds` | `task.context.payload.*` |
| E2E | `base_url`, `browsers`, `requirements` | `task.context.*` |
| Integration | `action`, `payload` (varies by action) | Entire `task` object |
| Deployment | `action`, `payload` (varies by action) | Entire `task` object |

**Current Workarounds:**
1. **Scaffold**: Casts to `any`, manually builds internal type
2. **Validation**: Validates envelope, extracts fields to anonymous object
3. **E2E**: Parses `task.context` only
4. **Integration/Deployment**: Define own task types, add execute() wrapper

### 3. Execute Method Signatures

**BaseAgent Contract:**
```typescript
abstract execute(task: TaskAssignment): Promise<TaskResult>;
```

**Agent Implementations:**

| Agent | Execute Signature | Notes |
|-------|-------------------|-------|
| Scaffold | `execute(task: TaskAssignment): Promise<TaskResult>` | ✅ Matches contract |
| Validation | `execute(task: TaskAssignment): Promise<TaskResult>` | ✅ Matches contract |
| E2E | `execute(task: TaskAssignment): Promise<TaskResult>` | ✅ Matches contract |
| Integration | `executeTask(task: IntegrationTask): Promise<IntegrationResult>` + `execute(task: any): Promise<any>` wrapper | ⚠️ Wrapper pattern |
| Deployment | `executeTask(task: DeploymentTask): Promise<DeploymentResultType>` + `execute(task: any): Promise<any>` wrapper | ⚠️ Wrapper pattern |

**Integration/Deployment Wrapper Pattern:**
```typescript
// Integration Agent - Lines 404-413
async execute(task: any): Promise<any> {
  const result = await this.executeTask(task);
  return {
    task_id: task.task_id || this.generateTraceId(),
    workflow_id: task.workflow_id || 'integration-workflow',
    status: result.result.success ? 'success' : 'failure',
    output: result,
    errors: result.result.success ? [] : ['Task execution failed']
  };
}
```

**Issue:** This pattern exists because their internal schemas don't match `TaskAssignment`

### 4. Claude API Integration

**Agents Using Claude:**
- ✅ **Scaffold**: Requirements analysis (lines 188-267)
- ✅ **E2E**: Test scenario generation (via generators)
- ✅ **Integration**: Conflict resolution (via ConflictResolverService)

**Current Implementation:**

| Agent | Usage | Location | Pattern |
|-------|-------|----------|---------|
| Scaffold | Direct `this.callClaude()` | `analyzeRequirements()` | Uses BaseAgent helper |
| E2E | Via generator utility | `generateTestScenarios()` | External utility |
| Integration | Via service class | `ConflictResolverService` | Injected service |

**BaseAgent Helper (lines 492-531):**
```typescript
protected async callClaude(
  prompt: string,
  systemPrompt?: string,
  maxTokens: number = 4096
): Promise<string> {
  return this.claudeCircuitBreaker.execute(async () => {
    const response = await this.anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: maxTokens,
      temperature: 0.3,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }]
    });
    // ... extract text
  });
}
```

**Scaffold-Specific Helper (lines 957-1034):**
```typescript
private parseClaudeJsonResponse(response: string, taskId: string): any {
  // Strategy 1: Try parsing as pure JSON
  // Strategy 2: Extract from markdown code blocks
  // Strategy 3: Find JSON object boundaries
  // Strategy 4: Find JSON array boundaries
  // ... extensive parsing logic
}
```

**Issues:**
- ✅ Circuit breaker protection in BaseAgent
- ❌ JSON parsing logic duplicated in Scaffold (should be in BaseAgent)
- ❌ E2E doesn't use BaseAgent helper (uses external utility)
- ❌ Integration uses separate service (inconsistent pattern)

### 5. Result Generation

**Common Pattern:**
All agents build a `TaskResult` object with similar structure:

```typescript
const result: TaskResult = {
  task_id: task.task_id,
  workflow_id: task.workflow_id,
  status: 'success' | 'failure' | 'partial',
  output: { /* agent-specific data */ },
  errors: [...],
  metrics: {
    duration_ms: Date.now() - startTime,
    tokens_used: ...,
    api_calls: ...
  },
  next_stage: 'next-stage-name'
};
```

**Variations:**

| Agent | Output Structure | Next Stage Determination |
|-------|------------------|--------------------------|
| Scaffold | Includes `analysis`, `structure`, `files_generated`, `generation_metrics` | Hardcoded: `WORKFLOW_STAGES.VALIDATION` |
| Validation | Includes `report`, `validation_checks`, `quality_gates` | Conditional: `'integration'` if success |
| E2E | Includes `report`, `scenarios_generated`, `artifacts` | Conditional: `'deployment'` if passed, else `'validation'` |
| Integration | Wraps `IntegrationResult` in output | Not specified (uses wrapper) |
| Deployment | Wraps `DeploymentResultType` in output | Not specified (uses wrapper) |

**Opportunities:**
- 📝 `next_stage` logic could be centralized
- 📝 Metrics collection could be standardized
- 📝 Output structure could have common base type

### 6. Error Handling Strategies

**Pattern A: Fallback Result (Scaffold)**
```typescript
// Lines 159-186
catch (error) {
  const duration = Date.now() - startTime;
  this.logger.error('Scaffold task failed', { error, ... });

  const failureResult: TaskResult = {
    task_id: task.task_id,
    workflow_id: task.workflow_id,
    status: 'failure',
    output: { error_code: 'SCAFFOLD_ERROR', ... },
    errors: [error instanceof Error ? error.message : 'Unknown error'],
    metrics: { duration_ms: duration }
  };

  return failureResult;  // ✅ Returns result, doesn't throw
}
```

**Pattern B: AgentError with Re-throw (Validation)**
```typescript
// Lines 267-292
catch (error) {
  this.logger.error('[SESSION #32] Validation task failed', { ... });

  // If already AgentError, re-throw
  if (error instanceof AgentError) {
    throw error;  // ❌ Throws to caller
  }

  // Otherwise wrap in AgentError
  throw new AgentError(
    `Validation task failed: ${error instanceof Error ? error.message : String(error)}`,
    'VALIDATION_FAILED',
    { cause: error instanceof Error ? error : undefined }
  );
}
```

**Pattern C: Failure Result (E2E)**
```typescript
// Lines 201-213
catch (error) {
  this.logger.error('E2E test task failed', { error, task_id: task.task_id });

  return {
    task_id: task.task_id,
    workflow_id: task.workflow_id,
    status: 'failure',
    output: { error: `E2E test failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
    errors: [error instanceof Error ? error.message : 'Unknown error']
  };  // ✅ Returns result, doesn't throw
}
```

**Pattern D: Rollback + Throw (Integration/Deployment)**
```typescript
// Deployment - Lines 337-363
catch (error) {
  this.logger.error('ECS deployment failed', { error });

  // Attempt rollback
  try {
    await this.ecsService.rollbackDeployment(...);
  } catch (rollbackError) {
    this.logger.error('Rollback also failed', { error: rollbackError });
  }

  return {
    success: false,
    rollback_info: { rollback_triggered: true, reason: ... }
  };  // ✅ Returns result (in executeTask), but execute() wrapper handles it
}
```

**Inconsistency Summary:**

| Agent | Throws on Error? | Returns Failure Result? | Special Handling |
|-------|------------------|-------------------------|------------------|
| Scaffold | ❌ No | ✅ Yes | Fallback to default analysis |
| Validation | ✅ Yes | ❌ No | Re-throws AgentError |
| E2E | ❌ No | ✅ Yes | None |
| Integration | ⚠️ Wrapped | ✅ Yes (via executeTask) | Rollback on failure |
| Deployment | ⚠️ Wrapped | ✅ Yes (via executeTask) | Rollback on failure |

**Impact:**
- BaseAgent's `receiveTask()` catches all errors and calls `reportResult()` with failure
- But inconsistent error handling means:
  - Scaffold: Self-reports failure ✅
  - Validation: Throws → BaseAgent catches → reports failure ✅
  - E2E: Self-reports failure ✅
  - Integration/Deployment: executeTask returns failure → execute() wraps → reported ✅

All patterns work, but they're inconsistent!

### 7. Dependencies & Helper Classes

**Scaffold:**
- `TemplateEngine` - Handlebars template processing
- `FileGenerator` - File system operations
- Own helper: `parseClaudeJsonResponse()` (400+ lines)

**Validation:**
- `validators/typescript-validator`
- `validators/eslint-validator`
- `validators/coverage-validator`
- `validators/security-validator`
- `validators/quality-gates`
- `utils/policy-loader`
- `utils/report-generator`

**E2E:**
- `generators/test-generator`
- `generators/page-object-generator`
- `runners/playwright-runner`
- `utils/artifact-storage`
- `utils/report-generator`

**Integration:**
- `services/git.service`
- `services/conflict-resolver.service`
- `services/dependency-updater.service`
- `services/integration-test-runner.service`

**Deployment:**
- `services/docker.service`
- `services/ecr.service`
- `services/ecs.service`
- `services/deployment-strategy.service`
- `services/health-check.service`

**Common Pattern:**
- All agents use service/utility classes for domain logic ✅
- Clear separation of concerns ✅
- Consistent naming conventions (service/validator/generator/runner) ✅

**Opportunity:**
- Some services could be shared:
  - Report generation (Validation & E2E both have this)
  - Artifact storage (could be generic)

### 8. Schema Validation

**Input Validation:**

| Agent | Validates Input? | Schema Used | Location |
|-------|------------------|-------------|----------|
| Scaffold | ❌ No | N/A | Relies on manual parsing |
| Validation | ✅ Yes | `validateEnvelope()` | Lines 118-135 |
| E2E | ✅ Yes | `E2ETaskContextSchema` | Lines 219-227 |
| Integration | ✅ Yes | `IntegrationTaskSchema` | Line 56 |
| Deployment | ✅ Yes | `DeploymentTaskSchema` | Line 69 |

**Output Validation:**

| Agent | Validates Output? | Schema Used | Purpose |
|-------|-------------------|-------------|---------|
| Scaffold | ❌ No | N/A | N/A |
| Validation | ❌ No | N/A | N/A |
| E2E | ❌ No | N/A | N/A |
| Integration | ✅ Yes | `IntegrationResultSchema` | Line 95 |
| Deployment | ✅ Yes | `DeploymentResultSchemaExtended` | Line 116 |

**BaseAgent Validation:**
```typescript
// BaseAgent - Line 299
const validatedResult = TaskResultSchema.parse(result);
```

✅ BaseAgent validates all results before publishing!

**Issue:**
- Only Integration/Deployment validate their output before returning
- Scaffold/Validation/E2E rely on BaseAgent's validation
- If agent returns invalid structure, error occurs in `reportResult()` not `execute()`

---

## Common Patterns Worth Extracting

### 1. Claude JSON Response Parsing

**Current State:** Scaffold has 400+ line helper (lines 957-1034)

**Should Be:** BaseAgent utility

**Proposed:**
```typescript
// In BaseAgent
protected async callClaudeForJson<T>(
  prompt: string,
  systemPrompt: string,
  schema?: z.ZodSchema<T>
): Promise<T> {
  const response = await this.callClaude(prompt, systemPrompt);

  // Try multiple parsing strategies
  const parsed = this.parseJsonResponse(response);

  // Optional schema validation
  if (schema) {
    return schema.parse(parsed);
  }

  return parsed as T;
}

private parseJsonResponse(response: string): any {
  // Strategy 1: Direct parse
  // Strategy 2: Extract from markdown
  // Strategy 3: Find JSON boundaries
  // (move logic from Scaffold)
}
```

**Benefit:** Eliminates 400 lines of duplication, makes Claude integration consistent

### 2. Task Context Extraction

**Current State:** 5 different patterns

**Should Be:** BaseAgent utility with type parameter

**Proposed:**
```typescript
// In BaseAgent
protected extractTaskContext<T extends z.ZodSchema>(
  task: TaskAssignment,
  schema: T,
  location: 'context' | 'payload' | 'root' = 'context'
): z.infer<T> {
  let data: unknown;

  switch (location) {
    case 'context':
      data = task.context;
      break;
    case 'payload':
      data = (task as any).payload;
      break;
    case 'root':
      data = task;
      break;
  }

  try {
    return schema.parse(data);
  } catch (error) {
    throw new ValidationError(
      `Invalid task context at ${location}`,
      error instanceof z.ZodError ? error.errors : [error]
    );
  }
}
```

**Usage:**
```typescript
// In agent's execute()
const context = this.extractTaskContext(task, E2ETaskContextSchema, 'context');
```

**Benefit:** Standardized parsing, type-safe, clear error messages

### 3. Duration Tracking

**Current State:** Every agent does this:
```typescript
const startTime = Date.now();
// ... work
const duration = Date.now() - startTime;
```

**Should Be:** BaseAgent decorator or wrapper

**Proposed:**
```typescript
// In BaseAgent
protected async executeWithMetrics<T>(
  operation: () => Promise<T>
): Promise<{ result: T; duration_ms: number }> {
  const startTime = Date.now();
  const result = await operation();
  return { result, duration_ms: Date.now() - startTime };
}
```

**Usage:**
```typescript
const { result, duration_ms } = await this.executeWithMetrics(async () => {
  // agent work
  return taskResult;
});
```

### 4. Result Builder

**Current State:** Every agent manually builds TaskResult

**Should Be:** BaseAgent helper

**Proposed:**
```typescript
// In BaseAgent
protected buildResult(
  task_id: string,
  workflow_id: string,
  status: 'success' | 'failure' | 'partial',
  output: Record<string, unknown>,
  options?: {
    errors?: string[];
    metrics?: { duration_ms: number; tokens_used?: number; api_calls?: number };
    next_stage?: string;
  }
): TaskResult {
  return {
    task_id,
    workflow_id,
    status,
    output,
    errors: options?.errors,
    metrics: options?.metrics,
    next_stage: options?.next_stage
  };
}
```

**Benefit:** Consistent result structure, less boilerplate

### 5. Error Result Helper

**Current State:** Scaffold/E2E duplicate this pattern

**Should Be:** BaseAgent helper

**Proposed:**
```typescript
// In BaseAgent
protected buildErrorResult(
  task: TaskAssignment,
  error: Error,
  duration_ms: number,
  errorCode?: string
): TaskResult {
  return {
    task_id: task.task_id,
    workflow_id: task.workflow_id,
    status: 'failure',
    output: {
      error_code: errorCode || 'EXECUTION_ERROR',
      error_message: error.message,
      error_type: error.constructor.name
    },
    errors: [error.message],
    metrics: { duration_ms }
  };
}
```

---

## Schema Mismatch Root Cause Analysis

### The Problem

**BaseAgent defines:**
```typescript
abstract execute(task: TaskAssignment): Promise<TaskResult>;
```

**But agents need:**
- Scaffold: `ScaffoldTask` (has `payload.project_type`, `payload.tech_stack`, etc.)
- Validation: Custom envelope format (has `payload.working_directory`, `payload.validation_types`)
- E2E: `E2ETaskContext` (has `base_url`, `browsers`, `requirements`)
- Integration: `IntegrationTask` (has `action`, action-specific `payload`)
- Deployment: `DeploymentTask` (has `action`, action-specific `payload`)

### Why This Happened

1. **TaskAssignment is too generic:**
   - `context: z.record(z.unknown())` accepts anything
   - No structure for agent-specific fields

2. **Agents have different needs:**
   - Some need flat structure (E2E)
   - Some need nested payload (Scaffold, Validation)
   - Some need action-based routing (Integration, Deployment)

3. **No standard envelope format:**
   - Validation uses `AgentEnvelope<ValidationPayload>`
   - Others use `TaskAssignment` directly
   - Inconsistent nesting levels

### Solutions

#### Option 1: Make TaskAssignment Generic

```typescript
export interface TaskAssignment<TContext = Record<string, unknown>> {
  task_id: string;
  workflow_id: string;
  type: string;
  name: string;
  description: string;
  requirements: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  context: TContext;  // Generic context type
  deadline?: string;
}

// Agent implementations
class ScaffoldAgent extends BaseAgent {
  async execute(task: TaskAssignment<ScaffoldContext>): Promise<TaskResult> {
    // task.context is now type-safe!
  }
}
```

**Pros:**
- Type-safe context extraction
- Backward compatible
- Clear contract

**Cons:**
- Requires BaseAgent to be generic too
- More complex type signatures

#### Option 2: Standard Envelope Format

```typescript
// All agents receive AgentEnvelope
export interface AgentEnvelope<TPayload> {
  task_id: string;
  workflow_id: string;
  agent_type: string;
  action: string;
  payload: TPayload;
  workflow_context: WorkflowContext;
  trace_id?: string;
  span_id?: string;
  parent_span_id?: string;
  // ... metadata
}

// BaseAgent becomes
abstract execute(envelope: AgentEnvelope<unknown>): Promise<TaskResult>;

// Agents extract typed payload
class E2EAgent extends BaseAgent {
  async execute(envelope: AgentEnvelope<unknown>): Promise<TaskResult> {
    const context = E2ETaskContextSchema.parse(envelope.payload);
    // ...
  }
}
```

**Pros:**
- Consistent envelope structure
- Clear payload extraction
- Already used by Validation

**Cons:**
- Breaking change to BaseAgent interface
- Requires updating all agents

#### Option 3: Helper Method in BaseAgent (Recommended)

```typescript
// In BaseAgent
protected extractContext<T>(
  task: TaskAssignment,
  schema: z.ZodSchema<T>,
  options?: {
    location?: 'context' | 'payload' | 'envelope';
    required?: boolean;
  }
): T {
  const loc = options?.location || 'context';

  let data: unknown;
  if (loc === 'envelope') {
    // Handle AgentEnvelope format
    data = (task as any).context || task;
  } else if (loc === 'payload') {
    data = (task as any).payload;
  } else {
    data = task.context;
  }

  const result = schema.safeParse(data);

  if (!result.success) {
    if (options?.required !== false) {
      throw new ValidationError(
        `Invalid ${loc} for ${this.capabilities.type} agent`,
        result.error.errors
      );
    }
    return {} as T;
  }

  return result.data;
}
```

**Usage:**
```typescript
// Scaffold
const context = this.extractContext(task, ScaffoldContextSchema, { location: 'payload' });

// Validation
const envelope = this.extractContext(task, ValidationEnvelopeSchema, { location: 'envelope' });

// E2E
const context = this.extractContext(task, E2ETaskContextSchema);
```

**Pros:**
- No breaking changes
- Flexible for different patterns
- Type-safe extraction
- Clear error messages

**Cons:**
- Doesn't fix underlying inconsistency
- Still allows multiple patterns

---

## Recommendations

### 1. Immediate Fixes (High Priority)

#### A. Add `extractContext()` to BaseAgent
```typescript
// Location: packages/agents/base-agent/src/base-agent.ts
// Add after line 295 (after validateTask)

protected extractContext<T>(
  task: TaskAssignment,
  schema: z.ZodSchema<T>,
  location: 'context' | 'payload' | 'root' = 'context'
): T {
  let data: unknown;

  switch (location) {
    case 'payload':
      data = (task as any).payload;
      break;
    case 'root':
      data = task;
      break;
    case 'context':
    default:
      data = task.context;
      break;
  }

  const result = schema.safeParse(data);

  if (!result.success) {
    this.logger.error('Task context validation failed', {
      agent_type: this.capabilities.type,
      location,
      errors: result.error.errors,
      task_id: task.task_id
    });

    throw new ValidationError(
      `Invalid task context for ${this.capabilities.type} agent at ${location}`,
      result.error.errors
    );
  }

  this.logger.debug('Task context validated successfully', {
    agent_type: this.capabilities.type,
    location,
    task_id: task.task_id
  });

  return result.data;
}
```

#### B. Move JSON Parsing to BaseAgent
```typescript
// Location: packages/agents/base-agent/src/base-agent.ts
// Add after callClaude method (line 531)

protected parseJsonResponse(response: string): any {
  // Strategy 1: Try parsing as pure JSON first
  try {
    return JSON.parse(response);
  } catch (firstError) {
    this.logger.debug('Direct JSON parse failed, trying extraction strategies');
  }

  // Strategy 2: Extract JSON from markdown code blocks (```json ... ```)
  const jsonCodeBlockMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonCodeBlockMatch?.[1]) {
    try {
      return JSON.parse(jsonCodeBlockMatch[1].trim());
    } catch (blockError) {
      this.logger.debug('Failed to parse extracted code block');
    }
  }

  // Strategy 3: Find JSON object by looking for { } boundaries
  const jsonObjectMatch = response.match(/\{[\s\S]*\}/);
  if (jsonObjectMatch) {
    try {
      return JSON.parse(jsonObjectMatch[0].trim());
    } catch (objError) {
      this.logger.debug('Failed to parse extracted JSON object');
    }
  }

  // Strategy 4: Find JSON array by looking for [ ] boundaries
  const jsonArrayMatch = response.match(/\[[\s\S]*\]/);
  if (jsonArrayMatch) {
    try {
      return JSON.parse(jsonArrayMatch[0].trim());
    } catch (arrError) {
      this.logger.debug('Failed to parse extracted JSON array');
    }
  }

  throw new Error(
    `Failed to extract valid JSON from Claude response. Preview: ${response.substring(0, 200)}`
  );
}

protected async callClaudeForJson<T>(
  prompt: string,
  systemPrompt: string = 'You are a helpful assistant. Return responses as pure JSON only - no markdown, no code blocks, no explanatory text.',
  schema?: z.ZodSchema<T>
): Promise<T> {
  const response = await this.callClaude(prompt, systemPrompt);
  const parsed = this.parseJsonResponse(response);

  if (schema) {
    const result = schema.safeParse(parsed);
    if (!result.success) {
      this.logger.error('Claude JSON response failed schema validation', {
        errors: result.error.errors,
        response_preview: JSON.stringify(parsed).substring(0, 200)
      });
      throw new ValidationError('Claude response invalid', result.error.errors);
    }
    return result.data;
  }

  return parsed as T;
}
```

#### C. Add Result Builder Helpers
```typescript
// Location: packages/agents/base-agent/src/base-agent.ts
// Add after reportResult method (line 426)

protected buildSuccessResult(
  task_id: string,
  workflow_id: string,
  output: Record<string, unknown>,
  options?: {
    metrics?: { duration_ms: number; tokens_used?: number; api_calls?: number };
    next_stage?: string;
  }
): TaskResult {
  return {
    task_id,
    workflow_id,
    status: 'success',
    output,
    metrics: options?.metrics,
    next_stage: options?.next_stage
  };
}

protected buildFailureResult(
  task_id: string,
  workflow_id: string,
  error: Error | string,
  options?: {
    duration_ms?: number;
    error_code?: string;
    output?: Record<string, unknown>;
  }
): TaskResult {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorCode = options?.error_code || 'EXECUTION_ERROR';

  return {
    task_id,
    workflow_id,
    status: 'failure',
    output: {
      error_code: errorCode,
      error_message: errorMessage,
      ...(options?.output || {})
    },
    errors: [errorMessage],
    metrics: options?.duration_ms ? { duration_ms: options.duration_ms } : undefined
  };
}

protected async executeWithMetrics<T>(
  operation: () => Promise<T>
): Promise<{ result: T; duration_ms: number }> {
  const startTime = Date.now();
  const result = await operation();
  return {
    result,
    duration_ms: Date.now() - startTime
  };
}
```

### 2. Standardize Agent Implementations (Medium Priority)

#### Update Scaffold Agent
```typescript
// Replace lines 59-101 with:
async execute(task: TaskAssignment): Promise<TaskResult> {
  const { result, duration_ms } = await this.executeWithMetrics(async () => {
    // Extract scaffold-specific context
    const scaffoldCtx = this.extractContext(task, ScaffoldContextSchema, 'payload');

    // Step 1: Analyze requirements
    const analysis = await this.analyzeRequirements(scaffoldCtx);

    // Step 2: Generate structure
    const structure = await this.generateProjectStructure(scaffoldCtx, analysis);

    // Step 3: Create files
    const createResult = await this.createFiles(structure, scaffoldCtx);

    return {
      analysis,
      structure,
      files_generated: structure.files_generated,
      creation_result: createResult
    };
  });

  return this.buildSuccessResult(
    task.task_id,
    task.workflow_id,
    result,
    {
      metrics: {
        duration_ms,
        tokens_used: result.analysis?.tokens_used,
        api_calls: result.analysis?.api_calls
      },
      next_stage: WORKFLOW_STAGES.VALIDATION
    }
  );
}

// Update analyzeRequirements to use new helper:
private async analyzeRequirements(task: ScaffoldContext) {
  const prompt = this.buildRequirementsPrompt(task);
  const analysis = await this.callClaudeForJson(
    prompt,
    'You are a software architect. Return pure JSON only.',
    RequirementsAnalysisSchema  // Optional schema validation
  );

  return {
    ...analysis,
    tokens_used: 1500,  // From metrics
    api_calls: 1
  };
}
```

#### Update E2E Agent
```typescript
// Replace lines 48-214 with:
async execute(task: TaskAssignment): Promise<TaskResult> {
  try {
    const context = this.extractContext(task, E2ETaskContextSchema);

    const { result, duration_ms } = await this.executeWithMetrics(async () => {
      // Generate tests
      const { testFiles, pageObjectFiles, scenariosGenerated } =
        await this.generateTests(context);

      // Store files
      const storage = this.createArtifactStorage(context);
      const artifacts = await this.storeAllFiles(
        storage,
        context,
        testFiles,
        pageObjectFiles
      );

      // Execute tests if base_url provided
      const execution = context.base_url
        ? await this.executeTests(context, testOutputPath)
        : undefined;

      return { artifacts, execution, scenariosGenerated };
    });

    const report = this.generateReport(task, context, result);

    return this.buildSuccessResult(
      task.task_id,
      task.workflow_id,
      { report, ...result },
      {
        metrics: { duration_ms, api_calls: 1 },
        next_stage: report.overall_status === 'passed' ? 'deployment' : 'validation'
      }
    );

  } catch (error) {
    const duration = Date.now() - startTime;  // Need to track this outside executeWithMetrics
    return this.buildFailureResult(
      task.task_id,
      task.workflow_id,
      error as Error,
      { duration_ms: duration, error_code: 'E2E_EXECUTION_ERROR' }
    );
  }
}
```

#### Validation Agent - Already Good!
Validation agent's approach is actually the cleanest:
- ✅ Uses envelope validation
- ✅ Type-safe extraction
- ✅ Clear error messages

**Only change:** Use new `extractContext()` helper:
```typescript
// Replace lines 78-137 with:
async execute(task: TaskAssignment): Promise<TaskResult> {
  const { result, duration_ms } = await this.executeWithMetrics(async () => {
    // Extract and validate envelope
    const envelope = this.extractContext(
      task,
      ValidationEnvelopeSchema,
      'context'
    );

    // Verify agent type
    if (!isValidationEnvelope(envelope)) {
      throw new AgentError(
        `Wrong agent type: expected validation, got ${envelope.agent_type}`,
        'WRONG_AGENT_TYPE'
      );
    }

    // Build context from envelope
    const context: ValidationTaskContext = {
      project_path: envelope.payload.working_directory,
      validation_types: envelope.payload.validation_types.filter(...),
      coverage_threshold: envelope.payload.thresholds?.coverage,
      package_manager: 'pnpm'
    };

    // Run validations
    const checks = await this.runValidationChecks(context);
    const gates = evaluateQualityGates(checks, this.policy || getDefaultPolicy());
    const report = generateValidationReport(task.task_id, task.workflow_id, context.project_path, checks, gates, Date.now());

    return { report, checks, gates };
  });

  const taskStatus = result.report.overall_status === 'passed' ? 'success' :
                     result.report.overall_status === 'warning' ? 'partial' : 'failure';

  return this.buildSuccessResult(
    task.task_id,
    task.workflow_id,
    result,
    {
      metrics: { duration_ms, api_calls: 0 },
      next_stage: taskStatus === 'success' ? 'integration' : undefined
    }
  );
}
```

### 3. Create Shared Utilities (Low Priority)

#### A. Shared Report Generator
```typescript
// Location: packages/shared/utils/src/report-generator.ts

export interface ReportSection {
  title: string;
  status: 'passed' | 'failed' | 'warning' | 'info';
  items: Array<{
    label: string;
    value: string | number;
    status?: 'passed' | 'failed' | 'warning';
  }>;
  subsections?: ReportSection[];
}

export interface AgentReport {
  task_id: string;
  workflow_id: string;
  agent_type: string;
  overall_status: 'passed' | 'failed' | 'warning';
  timestamp: string;
  duration_ms: number;
  sections: ReportSection[];
}

export function formatReportAsText(report: AgentReport): string {
  const lines: string[] = [];

  lines.push('='.repeat(80));
  lines.push(`${report.agent_type.toUpperCase()} AGENT REPORT`);
  lines.push('='.repeat(80));
  lines.push(`Task ID: ${report.task_id}`);
  lines.push(`Status: ${report.overall_status.toUpperCase()}`);
  lines.push(`Duration: ${report.duration_ms}ms`);
  lines.push('');

  for (const section of report.sections) {
    lines.push(...formatSection(section, 0));
  }

  lines.push('='.repeat(80));

  return lines.join('\n');
}

function formatSection(section: ReportSection, indent: number): string[] {
  const prefix = '  '.repeat(indent);
  const lines: string[] = [];

  const statusIcon = section.status === 'passed' ? '✓' :
                     section.status === 'failed' ? '✗' :
                     section.status === 'warning' ? '⚠' : 'ℹ';

  lines.push(`${prefix}${statusIcon} ${section.title}`);

  for (const item of section.items) {
    const itemStatus = item.status ? ` [${item.status}]` : '';
    lines.push(`${prefix}  ${item.label}: ${item.value}${itemStatus}`);
  }

  if (section.subsections) {
    for (const sub of section.subsections) {
      lines.push('');
      lines.push(...formatSection(sub, indent + 1));
    }
  }

  return lines;
}
```

**Usage in agents:**
```typescript
// Validation agent
const report: AgentReport = {
  task_id,
  workflow_id,
  agent_type: 'validation',
  overall_status: validationReport.overall_status,
  timestamp: new Date().toISOString(),
  duration_ms,
  sections: [
    {
      title: 'Validation Checks',
      status: validationReport.overall_status,
      items: validationReport.validation_checks.map(check => ({
        label: check.type,
        value: check.status,
        status: check.status
      }))
    },
    {
      title: 'Quality Gates',
      status: qualityGates.passed ? 'passed' : 'failed',
      items: [
        { label: 'Gates Passed', value: qualityGates.gates_passed },
        { label: 'Gates Failed', value: qualityGates.gates_failed }
      ]
    }
  ]
};

this.logger.info(formatReportAsText(report));
```

### 4. Long-term Architectural Improvements (Future)

#### A. Introduce Agent-Specific Task Types at Type Level

```typescript
// In BaseAgent
export abstract class BaseAgent<TTaskContext = Record<string, unknown>> {
  abstract execute(task: TaskAssignment): Promise<TaskResult>;

  // Type-safe context extraction helper
  protected abstract getTaskContextSchema(): z.ZodSchema<TTaskContext>;

  // Automatically called by execute to get typed context
  protected getTaskContext(task: TaskAssignment): TTaskContext {
    const schema = this.getTaskContextSchema();
    return this.extractContext(task, schema);
  }
}

// Agent implementations
export class ScaffoldAgent extends BaseAgent<ScaffoldContext> {
  protected getTaskContextSchema() {
    return ScaffoldContextSchema;
  }

  async execute(task: TaskAssignment): Promise<TaskResult> {
    const context = this.getTaskContext(task);  // Type-safe!
    // context is ScaffoldContext
  }
}
```

#### B. Standardize Envelope Format Across All Agents

```typescript
// Create unified envelope in shared-types
export interface UnifiedAgentEnvelope<TPayload> {
  task_id: string;
  workflow_id: string;
  agent_type: string;
  action: string;
  payload: TPayload;
  metadata: {
    priority: 'critical' | 'high' | 'medium' | 'low';
    deadline?: string;
    retry_count: number;
    max_retries: number;
  };
  workflow_context: {
    current_stage: string;
    previous_stage?: string;
    workflow_state: Record<string, unknown>;
  };
  trace: {
    trace_id: string;
    span_id: string;
    parent_span_id?: string;
  };
  created_at: string;
  updated_at?: string;
}

// Update orchestrator to always send this format
// Update agents to expect this format
// Backward compatibility with adapter layer
```

#### C. Action-Based Routing Pattern for All Agents

```typescript
// Make all agents action-based like Integration/Deployment
export class ScaffoldAgent extends BaseAgent {
  async execute(task: TaskAssignment): Promise<TaskResult> {
    const envelope = this.extractContext(task, ScaffoldEnvelopeSchema);

    // Route to action handler
    switch (envelope.action) {
      case 'analyze_requirements':
        return this.handleAnalyzeRequirements(envelope.payload);

      case 'generate_structure':
        return this.handleGenerateStructure(envelope.payload);

      case 'create_files':
        return this.handleCreateFiles(envelope.payload);

      case 'full_scaffold':
      default:
        return this.handleFullScaffold(envelope.payload);
    }
  }
}
```

**Benefits:**
- More granular control
- Easier testing (test individual actions)
- Better reusability
- Clearer intent

---

## Summary of Recommendations

### Immediate (Do This Week)
1. ✅ Add `extractContext()` helper to BaseAgent
2. ✅ Move JSON parsing to BaseAgent (`parseJsonResponse()` and `callClaudeForJson()`)
3. ✅ Add result builder helpers (`buildSuccessResult()`, `buildFailureResult()`, `executeWithMetrics()`)
4. ✅ Update Scaffold agent to use new helpers
5. ✅ Update E2E agent to use new helpers

### Short-term (Do Next Sprint)
6. ⚠️ Standardize error handling across all agents (document preferred pattern)
7. ⚠️ Create shared report generator utility
8. ⚠️ Update Integration/Deployment to use BaseAgent helpers instead of wrappers

### Long-term (Roadmap)
9. 📋 Make BaseAgent generic with task context type parameter
10. 📋 Standardize envelope format across all communication
11. 📋 Implement action-based routing for all agents
12. 📋 Create comprehensive agent testing framework using new patterns

---

## Impact Assessment

### Code Reduction
- **BaseAgent additions:** ~200 lines
- **Scaffold agent reduction:** ~450 lines (parseClaudeJsonResponse removal + simplified execute)
- **E2E agent reduction:** ~80 lines (simplified execute + error handling)
- **Validation agent reduction:** ~30 lines (use new helpers)
- **Net change:** -360 lines, +improved consistency

### Type Safety Improvements
- ✅ All context extraction becomes type-safe
- ✅ Schema validation happens in one place
- ✅ Clear error messages for validation failures
- ✅ No more `as any` casts

### Maintainability
- ✅ One place to update JSON parsing logic
- ✅ Consistent result building
- ✅ Easier to add new agents (use helpers)
- ✅ Clear patterns to follow

### Testing
- ✅ Helpers can be unit tested independently
- ✅ Agent tests become simpler (mock helpers)
- ✅ Less duplication in test code

---

## Conclusion

The agent implementations show good separation of concerns and consistent use of service/utility classes, but suffer from:

1. **Inconsistent task parsing** - 5 different approaches
2. **Duplicated Claude integration** - JSON parsing logic repeated
3. **Schema mismatch** - TaskAssignment doesn't match agent needs
4. **Inconsistent error handling** - 4 different patterns

The recommended changes above will:
- ✅ Standardize common patterns
- ✅ Reduce code duplication by ~360 lines
- ✅ Improve type safety throughout
- ✅ Make adding new agents easier
- ✅ Maintain backward compatibility

**Next Steps:**
1. Review and approve recommendations
2. Implement BaseAgent helpers (2-3 hours)
3. Update agents one at a time (1-2 hours each)
4. Test end-to-end workflow (1 hour)
5. Document new patterns (1 hour)

**Total effort:** ~12-15 hours
**Benefit:** Permanent improvement to agent architecture
