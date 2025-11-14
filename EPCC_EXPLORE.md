# Strategic BaseAgent Design Exploration

**Session:** #63 Follow-up
**Date:** 2025-11-14
**Status:** EXPLORATION COMPLETE
**Scope:** Comprehensive agent architecture analysis for strategic BaseAgent refactor

---

## Executive Summary

### Current State
The BaseAgent implements a **mixture of pipeline and business logic** with significant duplication and inconsistency across concrete agents. The architecture suffers from:

1. **Pipeline logic scattered**: Task intake, error handling, retry, and result emission duplicated in concrete agents
2. **Idempotency missing**: No message_id tracking, no duplicate detection at agent level
3. **Tracing incomplete**: Session #60 added trace context, but agents don't create child spans properly
4. **Error classification absent**: All errors treated equally (no transient vs permanent distinction)
5. **Prompt auditing nonexistent**: AI agent LLM calls not tracked for cost/compliance

### Strategic Vision
BaseAgent should own the **EXECUTION PIPELINE**, not business logic. This exploration documents:
- Current responsibilities (what BaseAgent owns vs what agents own)
- Gap analysis (what's missing, what's duplicated, what's inconsistent)
- Migration path (3 phases: consolidate → refactor → enhance)
- Template method design (abstract interface for concrete agents)
- Risk assessment (breaking changes, migration complexity)

---

## 1. Current State Assessment

### 1.1 What BaseAgent Owns Today

**File:** `packages/agents/base-agent/src/base-agent.ts` (562 lines)

#### Infrastructure ✅
```typescript
// Lines 24-107: Constructor
- agentId generation (line 46)
- Logger setup (lines 56-65)
- Anthropic client initialization (lines 73-75)
- Redis pub/sub clients (lines 84-85)
- IMessageBus injection (Phase 3, line 44)
- Circuit breaker for Claude API (lines 88-104)
```

#### Message Bus Wiring ✅
```typescript
// Lines 109-193: initialize()
- messageBus.subscribe() (lines 129-182)
- Task channel subscription with consumer groups (lines 121-127)
- Message parsing and envelope extraction (lines 134-166)
- Handler invocation (line 168: receiveTask)
- Agent registration with orchestrator (line 190)
```

#### Task Intake (Partial) ⚠️
```typescript
// Lines 195-283: receiveTask()
- Envelope unwrapping (lines 199-200)
- Trace context extraction (lines 199-210)
- Trace logging (lines 202-210)
- Task validation (line 214)
- Stage extraction from envelope (lines 216-227)
- Retry wrapper around execute() (lines 230-242)
- Error handling with reportResult (lines 250-283)
```

**Missing:**
- ❌ Message_id/task_id idempotency check
- ❌ Duplicate message detection
- ❌ Task persistence updates (status changes to database)

#### Result Emission ✅
```typescript
// Lines 298-426: reportResult()
- Status enum mapping (lines 309-321)
- AgentResultSchema construction (lines 325-356)
- Schema validation enforcement (lines 361-370)
- Trace context propagation (lines 351-353)
- IMessageBus.publish() (lines 387-394)
- Result logging (lines 375-412)
```

#### Error Handling (Basic) ⚠️
```typescript
// Lines 250-283: receiveTask() catch block
- Error logging (lines 277-281)
- Failure result construction (lines 260-275)
- reportResult() invocation for errors (line 268)
```

**Missing:**
- ❌ Error classification (transient vs permanent vs upstream)
- ❌ Retry strategy (just uses RetryPresets.standard)
- ❌ Backoff configuration per agent type

#### Utilities ✅
```typescript
// Lines 465-536: Helper methods
- executeWithRetry (lines 466-490)
- callClaude with circuit breaker (lines 492-531)
- generateTraceId (lines 534-536)
```

#### Cleanup ✅
```typescript
// Lines 428-450: cleanup()
- Orchestrator deregistration (line 432)
- Redis unsubscribe (line 435)
- Listener removal (lines 438-443)
- Redis disconnect (lines 446-447)
```

---

### 1.2 What Concrete Agents Own Today

Analyzed 5 agents: ScaffoldAgent, ValidationAgent, E2EAgent, IntegrationAgent, DeploymentAgent

#### ScaffoldAgent (`packages/agents/scaffold-agent/src/scaffold-agent.ts`)

**Business Logic** (Correct) ✅
```typescript
// Lines 59-186: execute() method
- Requirements analysis via Claude (lines 103-105)
- Project structure generation (lines 108-109)
- File creation from templates (lines 112-117)
- Result construction (lines 128-156)
```

**Agent-Specific Utilities** (Correct) ✅
```typescript
- TemplateEngine (lines 24-25, 45-47)
- FileGenerator (lines 24-25, 44)
- parseClaudeJsonResponse (lines 957-1034)
- buildRequirementsPrompt (lines 893-928)
- getFallbackContent (lines 652-857)
```

**Pipeline Logic** (Should be in BaseAgent) ❌
```typescript
// Lines 59-67: execute() entry
- Duplicate trace ID generation (line 61) - BaseAgent already has one!
- Start time tracking (line 60)
- Task logging (lines 63-67)

// Lines 159-185: execute() exit
- Failure handling (lines 159-185)
- Error result construction (lines 170-182)
```

**Observations:**
- ✅ Clean separation in execution logic (lines 103-156)
- ❌ Duplicates tracing setup already in BaseAgent.receiveTask
- ❌ Duplicates error handling already in BaseAgent.receiveTask catch block

#### ValidationAgent (`packages/agents/validation-agent/src/validation-agent.ts`)

**Business Logic** (Correct) ✅
```typescript
// Lines 67-293: execute() method
- Envelope validation (lines 79-151)
- Working directory check (lines 173-198)
- Validation checks execution (lines 201)
- Quality gates evaluation (lines 204-207)
- Report generation (lines 210-241)
```

**Agent-Specific Utilities** (Correct) ✅
```typescript
- Policy loading (lines 46-59)
- Validator modules (typescript, eslint, coverage, security)
- Report generation utilities
```

**Pipeline Logic** (Should be in BaseAgent) ❌
```typescript
// Lines 67-75: execute() entry
- Duplicate trace ID generation (line 69)
- Start time tracking (line 68)
- Session #36 envelope extraction (lines 78-151) - too much boilerplate

// Lines 267-293: execute() error handling
- Error logging (lines 269-279)
- AgentError wrapping (lines 282-291)
```

**Observations:**
- ⚠️ Envelope extraction is 73 lines of defensive parsing (lines 78-151)
- ❌ Duplicates tracing/timing setup from BaseAgent
- ✅ Type guards (isValidationEnvelope) are agent-specific - correct placement

#### E2EAgent (`packages/agents/e2e-agent/src/e2e-agent.ts`)

**Business Logic** (Correct) ✅
```typescript
// Lines 48-214: execute() method
- Task context parsing (line 60)
- Test generation (lines 63-66)
- Test file storage (lines 69-102)
- Test execution (lines 105-146)
- Report generation (lines 149-167)
```

**Agent-Specific Utilities** (Correct) ✅
```typescript
- Test generators (test-generator.ts, page-object-generator.ts)
- Playwright runner (playwright-runner.ts)
- Artifact storage (artifact-storage.ts)
```

**Pipeline Logic** (Should be in BaseAgent) ❌
```typescript
// Lines 48-56: execute() entry
- Duplicate trace ID generation (line 50)
- Start time tracking (line 49)
- Task logging (lines 52-56)

// Lines 201-213: execute() error handling
- Error logging (line 202)
- Failure result construction (lines 204-212)
```

**Observations:**
- ✅ Clean separation: E2E logic is pure domain (Playwright, test gen)
- ❌ Same tracing/timing/logging duplication as other agents

#### IntegrationAgent (`packages/agents/integration-agent/src/integration-agent.ts`)

**Business Logic** (Correct) ✅
```typescript
// Lines 51-115: executeTask() method (note: different signature!)
- Action routing (lines 64-84)
- Merge/conflict/dependency/test handling (private methods)
```

**Agent-Specific Utilities** (Correct) ✅
```typescript
- GitService
- ConflictResolverService
- DependencyUpdaterService
- IntegrationTestRunnerService
```

**Anti-Pattern** ❌
```typescript
// Lines 404-413: execute() wrapper
// Wraps executeTask() to conform to BaseAgent signature
// This is a sign that BaseAgent interface is too rigid!
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

**Observations:**
- ⚠️ IntegrationAgent doesn't follow BaseAgent pattern cleanly
- ❌ Has its own schemas (IntegrationTaskSchema, IntegrationResultSchema)
- ❌ executeTask() doesn't match BaseAgent.execute() signature

#### DeploymentAgent (`packages/agents/deployment-agent/src/deployment-agent.ts`)

**Business Logic** (Correct) ✅
```typescript
// Lines 64-138: executeTask() method (same anti-pattern as Integration)
- Action routing (Docker, ECR, ECS, rollback, health check)
```

**Agent-Specific Utilities** (Correct) ✅
```typescript
- DockerService
- ECRService
- ECSService
- DeploymentStrategyService
- HealthCheckService
```

**Anti-Pattern** ❌
```typescript
// Lines 456-472: execute() wrapper (same as IntegrationAgent)
```

**Observations:**
- ⚠️ Same executeTask() + execute() wrapper anti-pattern
- ❌ Has its own schemas (DeploymentTaskSchema, DeploymentResultSchema)

---

### 1.3 Duplication Matrix

| Concern | BaseAgent | Scaffold | Validation | E2E | Integration | Deployment |
|---------|-----------|----------|------------|-----|-------------|------------|
| **Trace ID generation** | ✅ Line 61 | ❌ Dup 61 | ❌ Dup 69 | ❌ Dup 50 | ❌ Dup 66 | ❌ Dup 66 |
| **Start time tracking** | ❌ None | ✅ Line 60 | ✅ Line 68 | ✅ Line 49 | ✅ Line 65 | ✅ Line 65 |
| **Task logging** | ✅ Lines 202-210 | ❌ Dup 63-67 | ❌ Dup 71-75 | ❌ Dup 52-56 | ❌ Dup 71-76 | ❌ Dup 71-76 |
| **Error handling** | ✅ Lines 250-283 | ❌ Dup 159-185 | ❌ Dup 267-293 | ❌ Dup 201-213 | ❌ None | ❌ None |
| **Result construction** | ✅ Lines 325-356 | ❌ Dup 128-156 | ❌ Dup 255-266 | ❌ Dup 178-199 | ❌ Custom | ❌ Custom |
| **Idempotency check** | ❌ None | ❌ None | ❌ None | ❌ None | ❌ None | ❌ None |
| **Task status update** | ❌ None | ❌ None | ❌ None | ❌ None | ❌ None | ❌ None |
| **Prompt auditing** | ❌ None | ❌ None | ❌ None | ❌ None | ❌ None | ❌ None |

**Key Findings:**
- 🔴 **High duplication**: Trace ID, task logging, error handling (5/5 agents duplicate)
- 🟡 **Inconsistent ownership**: Start time tracking in agents, not BaseAgent
- 🟡 **Zero idempotency**: No agent checks message_id for duplicates
- 🟡 **Integration/Deployment divergence**: Custom execute() wrappers, different schemas

---

### 1.4 Inconsistency Catalog

#### Inconsistency 1: Schema Handling
**Scaffold/Validation/E2E:**
- Use base TaskAssignment/TaskResult schemas
- Extend with agent-specific payload validation

**Integration/Deployment:**
- Define completely custom schemas (IntegrationTaskSchema, DeploymentTaskSchema)
- Wrap BaseAgent.execute() to convert custom schema → TaskResult

**Problem:** No consistent schema pattern. Should all agents have typed payloads?

#### Inconsistency 2: Execute Signature
**Scaffold/Validation/E2E:**
```typescript
async execute(task: TaskAssignment): Promise<TaskResult>
```

**Integration/Deployment:**
```typescript
async executeTask(task: IntegrationTask): Promise<IntegrationResult>
async execute(task: any): Promise<any> // Wrapper
```

**Problem:** Integration/Deployment don't follow BaseAgent contract cleanly.

#### Inconsistency 3: Trace ID Generation
**BaseAgent (line 534):**
```typescript
protected generateTraceId(): string {
  return `trace_${randomUUID()}`;
}
```

**All Agents (execute() method):**
```typescript
const traceId = this.generateTraceId(); // Duplicates BaseAgent.receiveTask line 61
```

**Problem:** Agents regenerate trace IDs that were already generated in receiveTask().

#### Inconsistency 4: Error Result Construction
**Scaffold (lines 170-182):**
```typescript
const failureResult: TaskResult = {
  task_id: task.task_id,
  workflow_id: task.workflow_id,
  status: 'failure',
  output: { error_code: 'SCAFFOLD_ERROR', error_details: {...} },
  errors: [error message],
  metrics: { duration_ms }
};
```

**Validation (lines 255-266):**
```typescript
return {
  task_id, workflow_id,
  status: taskStatus,
  output: { report, validation_checks, quality_gates },
  errors: errors.length > 0 ? errors : undefined,
  metrics: { duration_ms, api_calls: 0 },
  next_stage: taskStatus === 'success' ? 'integration' : undefined
};
```

**E2E (lines 204-212):**
```typescript
return {
  task_id, workflow_id,
  status: 'failure',
  output: { error: `E2E test failed: ${error message}` },
  errors: [error message]
};
```

**Problem:** Different error result structures, inconsistent field presence.

---

## 2. Gap Analysis

### 2.1 What's Missing from BaseAgent

#### Priority 1: Idempotency ❌ CRITICAL
**Missing:** Message-level duplicate detection

**Why Critical:**
- Session #63 bug: Duplicate message delivery → CAS failures
- No protection against at-least-once delivery semantics
- Agents process same task multiple times

**What's Needed:**
```typescript
// In BaseAgent.receiveTask(), before execute():
const isDuplicate = await this.idempotencyStore.has(envelope.message_id);
if (isDuplicate) {
  this.logger.debug('Duplicate message detected', {
    message_id: envelope.message_id,
    task_id: envelope.task_id
  });
  return; // Skip silently
}
```

**Implementation Options:**
1. **Postgres table** (recommended, see STRATEGIC-BUS-REFACTOR.md:209-226)
   - Same transactional boundary as task updates
   - Durable audit trail
2. **Redis KV** (fallback, see STRATEGIC-BUS-REFACTOR.md:227-240)
   - Faster lookups
   - TTL-based cleanup

**Estimate:** 2-3 hours (Postgres) or 1 hour (Redis)

#### Priority 2: Task Persistence ❌ CRITICAL
**Missing:** AgentTask row updates during task lifecycle

**Current State:**
- Orchestrator creates AgentTask row (workflow.service.ts:479)
- BaseAgent never updates task status
- Task stays "pending" forever in database

**What's Needed:**
```typescript
// In BaseAgent.receiveTask(), at key lifecycle points:
1. Before execute(): updateTaskStatus(task_id, 'running')
2. After execute() success: updateTaskStatus(task_id, 'completed')
3. After execute() failure: updateTaskStatus(task_id, 'failed')
```

**Database Schema (already exists):**
```sql
-- packages/orchestrator/prisma/schema.prisma:59-87
model AgentTask {
  id              String   @id
  task_id         String   @unique
  status          TaskStatus  // pending | assigned | running | completed | failed
  started_at      DateTime?
  completed_at    DateTime?
  ...
}
```

**Problem:** BaseAgent doesn't have PrismaClient access. Need to inject ITaskRepository.

**Estimate:** 3-4 hours (add repository injection + implement updates)

#### Priority 3: Error Classification ❌ HIGH
**Missing:** Transient vs permanent vs upstream error distinction

**Current State:**
- All errors caught and wrapped uniformly (base-agent.ts:250-283)
- No retry decision based on error type
- No upstream error propagation (e.g., Claude API rate limit vs business logic error)

**What's Needed:**
```typescript
enum ErrorClass {
  TRANSIENT,    // Network timeout, Redis unavailable → retry
  PERMANENT,    // Schema validation error, missing file → fail immediately
  UPSTREAM,     // Claude API rate limit → propagate to orchestrator for backoff
  TIMEOUT       // Task timeout → cancel and report
}

function classifyError(error: unknown): ErrorClass {
  if (error instanceof NetworkError) return ErrorClass.TRANSIENT;
  if (error instanceof ValidationError) return ErrorClass.PERMANENT;
  if (error instanceof Anthropic.RateLimitError) return ErrorClass.UPSTREAM;
  if (error instanceof TimeoutError) return ErrorClass.TIMEOUT;
  return ErrorClass.TRANSIENT; // Conservative default
}
```

**Integrate with RetryPresets:**
```typescript
await retry(
  () => this.execute(task),
  {
    ...RetryPresets.standard,
    shouldRetry: (error, attempt) => {
      const errorClass = classifyError(error);
      return errorClass === ErrorClass.TRANSIENT && attempt < 3;
    }
  }
);
```

**Estimate:** 2-3 hours

#### Priority 4: Tracing Enhancements ⚠️ MEDIUM
**Missing:** Child span creation for agent operations

**Current State:**
- Session #60 added trace_id/span_id propagation ✅
- Agents extract trace context (base-agent.ts:199-210) ✅
- But agents don't create child spans for sub-operations ❌

**What's Needed:**
```typescript
// In BaseAgent.execute() wrapper:
const childContext = createChildContext(this.currentTraceContext);
this.logger.info('Agent operation started', {
  trace_id: childContext.trace_id,
  span_id: childContext.span_id,
  parent_span_id: childContext.parent_span_id,
  operation: 'agent_execute'
});

// Pass child context to result:
await this.reportResult(result, workflowStage, childContext);
```

**Estimate:** 1-2 hours

#### Priority 5: Prompt Auditing ⚠️ MEDIUM
**Missing:** LLM call tracking for AI agents

**Current State:**
- callClaude() exists (base-agent.ts:492-531) ✅
- Circuit breaker tracks failures ✅
- But no cost/token/latency audit trail ❌

**What's Needed:**
```typescript
// In BaseAgent.callClaude():
const startTime = Date.now();
const response = await this.anthropic.messages.create({...});

await this.auditStore.record({
  agent_id: this.agentId,
  task_id: this.currentTaskId,
  trace_id: this.currentTraceContext?.trace_id,
  model: 'claude-3-haiku-20240307',
  prompt_tokens: response.usage.input_tokens,
  completion_tokens: response.usage.output_tokens,
  latency_ms: Date.now() - startTime,
  cost_usd: calculateCost(response.usage),
  timestamp: new Date().toISOString()
});
```

**Database Schema (new table):**
```sql
CREATE TABLE llm_audit_log (
  id UUID PRIMARY KEY,
  agent_id VARCHAR(100),
  task_id UUID,
  trace_id UUID,
  model VARCHAR(100),
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  latency_ms INTEGER,
  cost_usd DECIMAL(10, 6),
  timestamp TIMESTAMP,
  INDEX idx_trace_id (trace_id),
  INDEX idx_task_id (task_id)
);
```

**Estimate:** 3-4 hours (schema + implementation + cost calculation)

#### Priority 6: Retry Strategy Configuration ⚠️ LOW
**Missing:** Per-agent retry configuration

**Current State:**
- BaseAgent hardcodes RetryPresets.standard (base-agent.ts:233)
- No way for ScaffoldAgent to use aggressive retry, ValidationAgent to use quick

**What's Needed:**
```typescript
// In BaseAgent constructor:
constructor(
  capabilities: AgentCapabilities,
  messageBus: IMessageBus,
  options?: {
    retryPreset?: keyof typeof RetryPresets; // 'quick' | 'standard' | 'aggressive'
    customRetry?: RetryOptions;
  }
) {
  this.retryOptions = options?.customRetry ||
                      RetryPresets[options?.retryPreset || 'standard'];
}

// In receiveTask():
await retry(() => this.execute(task), this.retryOptions);
```

**Estimate:** 1 hour

---

### 2.2 What Needs to be Extracted from Concrete Agents

#### Extract 1: Trace ID Generation
**Current:** Every agent duplicates (5/5 agents)
**Move to:** BaseAgent.receiveTask() (already has it at line 61!)
**Action:** Remove from all concrete agents' execute() methods

**Estimate:** 15 minutes (delete code from 5 files)

#### Extract 2: Start Time Tracking
**Current:** Every agent implements (5/5 agents)
**Move to:** BaseAgent.receiveTask() before execute()
**Pass to:** execute() as parameter or store in BaseAgent field

**Estimate:** 30 minutes

#### Extract 3: Task Logging
**Current:** Duplicated in all agents
**Move to:** BaseAgent.receiveTask() (already logs at lines 202-210)
**Action:** Remove from concrete agents

**Estimate:** 15 minutes

#### Extract 4: Error Result Construction
**Current:** Inconsistent across agents
**Move to:** BaseAgent.receiveTask() catch block (lines 260-275)
**Standardize:** Common error result structure

**Estimate:** 1 hour (including schema alignment)

---

### 2.3 What Needs to be Added New

#### Add 1: ITaskRepository Injection
**Why:** BaseAgent needs to update AgentTask rows
**What:** Add repository parameter to constructor
**Where:** `packages/orchestrator/src/repositories/workflow.repository.ts`

**Changes:**
```typescript
// BaseAgent constructor:
constructor(
  capabilities: AgentCapabilities,
  messageBus: IMessageBus,
  taskRepository: ITaskRepository // NEW
) { ... }

// ITaskRepository interface:
interface ITaskRepository {
  updateTask(task_id: string, updates: {
    status: TaskStatus;
    started_at?: Date;
    completed_at?: Date;
  }): Promise<void>;
}
```

**Estimate:** 2 hours (interface + implementation + wiring)

#### Add 2: IdempotencyStore Injection
**Why:** Message-level duplicate detection
**What:** Add idempotency store parameter to constructor
**Where:** `packages/shared/utils/src/idempotency.ts` (new file)

**Changes:**
```typescript
// BaseAgent constructor:
constructor(
  capabilities: AgentCapabilities,
  messageBus: IMessageBus,
  taskRepository: ITaskRepository,
  idempotencyStore: IIdempotencyStore // NEW
) { ... }

// IIdempotencyStore interface:
interface IIdempotencyStore {
  has(message_id: string): Promise<boolean>;
  add(message_id: string, metadata: IdempotencyMetadata): Promise<void>;
}
```

**Estimate:** 2-3 hours (interface + Postgres impl + Redis impl)

#### Add 3: Error Classifier
**Why:** Retry decision logic
**What:** Add error classification utility
**Where:** `packages/shared/utils/src/error-classifier.ts` (new file)

**Estimate:** 2 hours

#### Add 4: Prompt Audit Store
**Why:** LLM cost tracking
**What:** Add audit store parameter to constructor
**Where:** `packages/shared/utils/src/prompt-audit.ts` (new file)

**Estimate:** 3-4 hours (schema + store + cost calculation)

---

## 3. Migration Path

### Phase 1: Consolidate (3-4 hours)
**Goal:** Move duplicated code from concrete agents into BaseAgent

**Changes:**
1. ✅ Extract trace ID generation (already in BaseAgent.receiveTask:61)
   - **Action:** Delete from all concrete agents
   - **Files:** 5 agent files
   - **Estimate:** 15 min

2. ✅ Extract start time tracking
   - **Action:** Add to BaseAgent.receiveTask() before execute()
   - **Store:** `this.currentTaskStartTime`
   - **Pass:** To reportResult() for metrics
   - **Estimate:** 30 min

3. ✅ Extract task logging
   - **Action:** Already in BaseAgent.receiveTask:202-210
   - **Remove:** Duplicate logs from agents
   - **Estimate:** 15 min

4. ✅ Standardize error result construction
   - **Action:** Consolidate into BaseAgent.receiveTask:260-275 catch block
   - **Standardize:** Error result structure
   - **Estimate:** 1 hour

**Deliverable:** Reduced duplication, zero functional change

**Risk:** Low (mostly deletions)

---

### Phase 2: Refactor (8-10 hours)
**Goal:** Add missing pipeline concerns to BaseAgent

**Changes:**
1. ✅ Add ITaskRepository injection (2 hours)
   - Create ITaskRepository interface
   - Implement in WorkflowRepository
   - Inject into BaseAgent constructor
   - Wire through run-agent.ts files (5 agents)

2. ✅ Implement task status updates (1 hour)
   - Call repository.updateTask() at lifecycle points
   - Add started_at/completed_at timestamps

3. ✅ Add IIdempotencyStore injection (2-3 hours)
   - Create IIdempotencyStore interface
   - Implement PostgresIdempotencyStore
   - Implement RedisIdempotencyStore (optional)
   - Add to BaseAgent constructor
   - Wire through run-agent.ts files

4. ✅ Implement idempotency check (1 hour)
   - Add to BaseAgent.receiveTask() before execute()
   - Skip duplicate messages silently
   - Log duplicate detection

5. ✅ Add error classifier (2 hours)
   - Create ErrorClass enum
   - Implement classifyError()
   - Integrate with retry shouldRetry callback

**Deliverable:** BaseAgent owns complete execution pipeline

**Risk:** Medium (requires dependency injection changes)

---

### Phase 3: Enhance (4-6 hours)
**Goal:** Add advanced features (tracing, auditing, configurability)

**Changes:**
1. ✅ Child span creation (1-2 hours)
   - Call createChildContext() in execute() wrapper
   - Pass child context to reportResult()
   - Log span hierarchy

2. ✅ Prompt auditing (3-4 hours)
   - Create llm_audit_log table
   - Implement IPromptAuditStore
   - Add to callClaude()
   - Calculate cost per model

3. ✅ Retry configuration (1 hour)
   - Add RetryOptions to constructor
   - Allow per-agent customization
   - Document presets (quick/standard/aggressive)

**Deliverable:** Production-ready BaseAgent with full observability

**Risk:** Low (additive changes)

---

### Total Estimate: 15-20 hours across 3 phases

---

## 4. Template Method Design

### 4.1 Proposed BaseAgent<TPayload, TRawResult, TResult> Interface

```typescript
/**
 * Strategic BaseAgent - Owns the Execution Pipeline
 *
 * Responsibilities:
 * - Message bus subscription and task intake
 * - Idempotency checking (message_id deduplication)
 * - Task persistence (AgentTask row updates)
 * - Distributed tracing (trace_id/span_id propagation)
 * - Error classification and retry strategy
 * - Result emission and schema validation
 * - Prompt auditing (for AI agents)
 * - Observability (structured logs, metrics)
 *
 * Concrete agents implement:
 * - Task payload schema (validatePayload)
 * - Execution logic (execute)
 * - Result mapping (mapResult)
 */
export abstract class BaseAgent<TPayload, TRawResult, TResult> {
  // ============================================================================
  // DEPENDENCIES (Injected via Constructor)
  // ============================================================================
  protected readonly logger: pino.Logger;
  protected readonly anthropic: Anthropic;
  protected readonly messageBus: IMessageBus;
  protected readonly taskRepository: ITaskRepository;
  protected readonly idempotencyStore: IIdempotencyStore;
  protected readonly promptAuditStore?: IPromptAuditStore; // Optional
  protected readonly agentId: string;
  protected readonly capabilities: AgentCapabilities;
  protected readonly retryOptions: RetryOptions;

  // Circuit breaker for external API calls
  protected readonly claudeCircuitBreaker: CircuitBreaker;

  // ============================================================================
  // STATE (Task Execution Context)
  // ============================================================================
  protected currentTraceContext?: TraceContext;
  protected currentTaskId?: string;
  protected currentTaskStartTime?: number;

  constructor(
    capabilities: AgentCapabilities,
    messageBus: IMessageBus,
    taskRepository: ITaskRepository,
    idempotencyStore: IIdempotencyStore,
    options?: {
      retryPreset?: keyof typeof RetryPresets;
      customRetry?: RetryOptions;
      promptAuditStore?: IPromptAuditStore;
    }
  ) {
    this.capabilities = capabilities;
    this.messageBus = messageBus;
    this.taskRepository = taskRepository;
    this.idempotencyStore = idempotencyStore;
    this.promptAuditStore = options?.promptAuditStore;

    // Retry configuration
    this.retryOptions = options?.customRetry ||
                        RetryPresets[options?.retryPreset || 'standard'];

    // Agent ID generation
    this.agentId = `${capabilities.type}-${randomUUID().slice(0, 8)}`;

    // Logger setup
    this.logger = pino({ name: this.agentId, ... });

    // Anthropic client
    this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Circuit breaker
    this.claudeCircuitBreaker = new CircuitBreaker({...});
  }

  // ============================================================================
  // LIFECYCLE (Implemented in BaseAgent)
  // ============================================================================

  async initialize(): Promise<void> {
    // 1. Connect to message bus
    // 2. Subscribe to agent task channel
    // 3. Register with orchestrator
    // 4. Set up message handler → this.handleTaskMessage()
  }

  async cleanup(): Promise<void> {
    // 1. Deregister from orchestrator
    // 2. Unsubscribe from message bus
    // 3. Disconnect Redis clients
  }

  async healthCheck(): Promise<HealthStatus> {
    // Return agent health metrics
  }

  // ============================================================================
  // TASK INTAKE (Implemented in BaseAgent)
  // ============================================================================

  private async handleTaskMessage(envelope: ExecutionEnvelope<TPayload>): Promise<void> {
    const { message_id, task_id, trace_id, span_id, payload } = envelope;

    // Step 1: Idempotency Check
    const isDuplicate = await this.idempotencyStore.has(message_id);
    if (isDuplicate) {
      this.logger.debug('Duplicate message detected', { message_id, task_id });
      return; // Skip silently
    }

    // Step 2: Extract Trace Context
    this.currentTraceContext = extractTraceContext(envelope);
    this.currentTaskId = task_id;
    this.currentTaskStartTime = Date.now();

    // Step 3: Log Task Receipt
    this.logger.info('🔍 [AGENT-TRACE] Task received', {
      task_id,
      trace_id: this.currentTraceContext.trace_id,
      span_id: this.currentTraceContext.span_id,
      agent_type: this.capabilities.type
    });

    // Step 4: Update Task Status → RUNNING
    await this.taskRepository.updateTask(task_id, {
      status: 'running',
      started_at: new Date()
    });

    try {
      // Step 5: Validate Payload Schema
      const validatedPayload = await this.validatePayload(payload);

      // Step 6: Execute with Retry + Error Classification
      const rawResult = await retry(
        () => this.execute(validatedPayload),
        {
          ...this.retryOptions,
          shouldRetry: (error, attempt) => {
            const errorClass = this.classifyError(error);
            return errorClass === ErrorClass.TRANSIENT && attempt < this.retryOptions.maxAttempts!;
          },
          onRetry: (error, attempt, delayMs) => {
            this.logger.warn('Task execution failed, retrying', {
              task_id,
              attempt,
              delayMs,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      );

      // Step 7: Map Result to Standard Schema
      const mappedResult = await this.mapResult(rawResult, envelope);

      // Step 8: Report Success
      await this.reportSuccess(task_id, mappedResult);

      // Step 9: Update Task Status → COMPLETED
      await this.taskRepository.updateTask(task_id, {
        status: 'completed',
        completed_at: new Date()
      });

      // Step 10: Mark Message as Processed (Idempotency)
      await this.idempotencyStore.add(message_id, {
        task_id,
        trace_id: this.currentTraceContext.trace_id,
        processed_at: new Date().toISOString(),
        handler: `${this.capabilities.type}.handleTaskMessage`
      });

    } catch (error) {
      // Step 11: Classify Error
      const errorClass = this.classifyError(error);

      // Step 12: Update Task Status → FAILED
      await this.taskRepository.updateTask(task_id, {
        status: 'failed',
        completed_at: new Date()
      });

      // Step 13: Report Failure
      await this.reportFailure(task_id, error, errorClass);

      // Step 14: Mark as Processed (even on failure, to prevent retry loops)
      await this.idempotencyStore.add(message_id, {
        task_id,
        trace_id: this.currentTraceContext.trace_id,
        processed_at: new Date().toISOString(),
        handler: `${this.capabilities.type}.handleTaskMessage`,
        error_class: errorClass,
        error_message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // ============================================================================
  // ERROR CLASSIFICATION (Implemented in BaseAgent)
  // ============================================================================

  protected classifyError(error: unknown): ErrorClass {
    if (error instanceof NetworkError) return ErrorClass.TRANSIENT;
    if (error instanceof ValidationError) return ErrorClass.PERMANENT;
    if (error instanceof Anthropic.RateLimitError) return ErrorClass.UPSTREAM;
    if (error instanceof TimeoutError) return ErrorClass.TIMEOUT;

    // Check error message for common patterns
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('timeout') || msg.includes('econnrefused')) {
        return ErrorClass.TRANSIENT;
      }
      if (msg.includes('validation') || msg.includes('invalid')) {
        return ErrorClass.PERMANENT;
      }
    }

    return ErrorClass.TRANSIENT; // Conservative default
  }

  // ============================================================================
  // RESULT EMISSION (Implemented in BaseAgent)
  // ============================================================================

  private async reportSuccess(
    task_id: string,
    result: TResult
  ): Promise<void> {
    const duration_ms = Date.now() - this.currentTaskStartTime!;

    // Construct AgentResultSchema-compliant envelope
    const agentResult: AgentResult = {
      task_id,
      workflow_id: envelope.workflow_id,
      agent_id: this.agentId,
      agent_type: this.capabilities.type,
      success: true,
      status: 'success',
      action: envelope.stage || this.capabilities.type,
      result: result as any,
      metrics: {
        duration_ms,
        tokens_used: result.tokens_used,
        api_calls: result.api_calls
      },
      trace_id: this.currentTraceContext?.trace_id,
      span_id: this.currentTraceContext?.span_id,
      parent_span_id: this.currentTraceContext?.parent_span_id,
      timestamp: new Date().toISOString(),
      version: VERSION
    };

    // Validate schema compliance
    AgentResultSchema.parse(agentResult);

    // Publish via message bus
    await this.messageBus.publish(
      REDIS_CHANNELS.ORCHESTRATOR_RESULTS,
      agentResult,
      {
        key: envelope.workflow_id,
        mirrorToStream: `stream:${REDIS_CHANNELS.ORCHESTRATOR_RESULTS}`
      }
    );

    this.logger.info('🔍 [AGENT-TRACE] Result published', {
      task_id,
      status: 'success',
      duration_ms
    });
  }

  private async reportFailure(
    task_id: string,
    error: unknown,
    errorClass: ErrorClass
  ): Promise<void> {
    const duration_ms = Date.now() - this.currentTaskStartTime!;

    const agentResult: AgentResult = {
      task_id,
      workflow_id: envelope.workflow_id,
      agent_id: this.agentId,
      agent_type: this.capabilities.type,
      success: false,
      status: 'failed',
      action: envelope.stage || this.capabilities.type,
      result: {},
      error: {
        code: errorClass,
        message: error instanceof Error ? error.message : String(error),
        retryable: errorClass === ErrorClass.TRANSIENT
      },
      metrics: { duration_ms },
      trace_id: this.currentTraceContext?.trace_id,
      span_id: this.currentTraceContext?.span_id,
      parent_span_id: this.currentTraceContext?.parent_span_id,
      timestamp: new Date().toISOString(),
      version: VERSION
    };

    AgentResultSchema.parse(agentResult);

    await this.messageBus.publish(
      REDIS_CHANNELS.ORCHESTRATOR_RESULTS,
      agentResult,
      {
        key: envelope.workflow_id,
        mirrorToStream: `stream:${REDIS_CHANNELS.ORCHESTRATOR_RESULTS}`
      }
    );

    this.logger.error('🔍 [AGENT-TRACE] Failure published', {
      task_id,
      error_class: errorClass,
      duration_ms
    });
  }

  // ============================================================================
  // PROMPT AUDITING (Implemented in BaseAgent)
  // ============================================================================

  protected async callClaude(
    prompt: string,
    systemPrompt?: string,
    maxTokens: number = 4096
  ): Promise<string> {
    const startTime = Date.now();

    const response = await this.claudeCircuitBreaker.execute(async () => {
      return await this.anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: maxTokens,
        temperature: 0.3,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }]
      });
    });

    const latency_ms = Date.now() - startTime;

    // Audit if store is available
    if (this.promptAuditStore) {
      await this.promptAuditStore.record({
        agent_id: this.agentId,
        task_id: this.currentTaskId,
        trace_id: this.currentTraceContext?.trace_id,
        model: 'claude-3-haiku-20240307',
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens,
        latency_ms,
        cost_usd: calculateCost('claude-3-haiku-20240307', response.usage),
        timestamp: new Date().toISOString()
      });
    }

    // Extract text
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new AgentError('No text content in Claude response', 'API_ERROR');
    }

    return textContent.text;
  }

  // ============================================================================
  // ABSTRACT METHODS (Implemented by Concrete Agents)
  // ============================================================================

  /**
   * Validate task payload against agent-specific schema
   * @throws ValidationError if payload is invalid
   */
  protected abstract validatePayload(payload: unknown): Promise<TPayload>;

  /**
   * Execute agent-specific business logic
   * @throws AgentError on execution failure
   */
  protected abstract execute(payload: TPayload): Promise<TRawResult>;

  /**
   * Map agent-specific result to standard schema
   */
  protected abstract mapResult(
    rawResult: TRawResult,
    envelope: ExecutionEnvelope<TPayload>
  ): Promise<TResult>;
}
```

---

### 4.2 Concrete Agent Example: ScaffoldAgent

```typescript
/**
 * Scaffold Agent - Code Generation
 *
 * Payload: { project_type, name, description, tech_stack, requirements }
 * RawResult: { files_generated, structure, templates_used, analysis }
 * Result: TaskResult (standardized)
 */
export class ScaffoldAgent extends BaseAgent<
  ScaffoldPayload,
  ScaffoldRawResult,
  TaskResult
> {
  private readonly fileGenerator: FileGenerator;
  private readonly templateEngine: TemplateEngine;

  constructor(
    messageBus: IMessageBus,
    taskRepository: ITaskRepository,
    idempotencyStore: IIdempotencyStore,
    promptAuditStore?: IPromptAuditStore
  ) {
    super(
      {
        type: AGENT_TYPES.SCAFFOLD,
        version: '1.0.0',
        capabilities: ['analyze-requirements', 'generate-structure', 'create-boilerplate']
      },
      messageBus,
      taskRepository,
      idempotencyStore,
      {
        retryPreset: 'standard', // 3 attempts, 2s initial delay
        promptAuditStore
      }
    );

    this.fileGenerator = new FileGenerator(this.logger);
    this.templateEngine = new TemplateEngine(path.join(__dirname, '../templates'));
  }

  // ============================================================================
  // AGENT-SPECIFIC IMPLEMENTATION
  // ============================================================================

  protected async validatePayload(payload: unknown): Promise<ScaffoldPayload> {
    // Zod schema validation
    return ScaffoldPayloadSchema.parse(payload);
  }

  protected async execute(payload: ScaffoldPayload): Promise<ScaffoldRawResult> {
    // Step 1: Analyze requirements using Claude (callClaude() is in BaseAgent)
    const analysis = await this.analyzeRequirements(payload);

    // Step 2: Generate project structure
    const structure = await this.generateProjectStructure(payload, analysis);

    // Step 3: Create files from templates
    const createResult = await this.createFiles(structure, payload);

    return {
      files_generated: structure.files_generated,
      structure,
      templates_used: createResult.templatesUsed,
      analysis,
      generation_metrics: {
        total_files: createResult.filesCreated,
        total_directories: structure.directories.length,
        total_size_bytes: createResult.totalSize,
        generation_time_ms: createResult.templateTime,
        ai_analysis_ms: analysis.analysis_time_ms
      }
    };
  }

  protected async mapResult(
    rawResult: ScaffoldRawResult,
    envelope: ExecutionEnvelope<ScaffoldPayload>
  ): Promise<TaskResult> {
    return {
      task_id: envelope.task_id,
      workflow_id: envelope.workflow_id,
      status: 'success',
      output: {
        files_generated: rawResult.files_generated,
        structure: rawResult.structure,
        templates_used: rawResult.templates_used,
        analysis: rawResult.analysis,
        generation_metrics: rawResult.generation_metrics,
        next_steps: this.determineNextSteps(envelope.payload, rawResult.structure),
        summary: `Successfully scaffolded ${envelope.payload.project_type} project`
      },
      metrics: {
        duration_ms: rawResult.generation_metrics.generation_time_ms,
        tokens_used: rawResult.analysis.tokens_used,
        api_calls: rawResult.analysis.api_calls
      },
      next_stage: WORKFLOW_STAGES.VALIDATION
    };
  }

  // ============================================================================
  // PRIVATE UTILITIES (Agent-Specific)
  // ============================================================================

  private async analyzeRequirements(payload: ScaffoldPayload): Promise<RequirementsAnalysis> {
    const prompt = this.buildRequirementsPrompt(payload);

    // callClaude() is in BaseAgent, handles prompt auditing automatically
    const response = await this.callClaude(
      prompt,
      'You are a software architect analyzing project requirements. Return JSON only.'
    );

    return this.parseClaudeJsonResponse(response, payload.task_id);
  }

  private async generateProjectStructure(
    payload: ScaffoldPayload,
    analysis: RequirementsAnalysis
  ): Promise<ProjectStructure> {
    // ... scaffold-specific logic ...
  }

  private async createFiles(
    structure: ProjectStructure,
    payload: ScaffoldPayload
  ): Promise<FileCreationResult> {
    // ... scaffold-specific logic ...
  }

  private buildRequirementsPrompt(payload: ScaffoldPayload): string {
    // ... scaffold-specific logic ...
  }

  private parseClaudeJsonResponse(response: string, taskId: string): RequirementsAnalysis {
    // ... scaffold-specific logic ...
  }

  private determineNextSteps(
    payload: ScaffoldPayload,
    structure: ProjectStructure
  ): NextStep[] {
    // ... scaffold-specific logic ...
  }
}
```

**Key Observations:**
- ✅ No tracing boilerplate (handled by BaseAgent)
- ✅ No start time tracking (handled by BaseAgent)
- ✅ No error handling wrapper (handled by BaseAgent)
- ✅ No result publishing (handled by BaseAgent)
- ✅ Just pure business logic: requirements analysis → structure generation → file creation

---

### 4.3 Concrete Agent Example: ValidationAgent

```typescript
export class ValidationAgent extends BaseAgent<
  ValidationPayload,
  ValidationRawResult,
  TaskResult
> {
  private policy: PolicyConfig | null = null;

  constructor(
    messageBus: IMessageBus,
    taskRepository: ITaskRepository,
    idempotencyStore: IIdempotencyStore
  ) {
    super(
      {
        type: AGENT_TYPES.VALIDATION,
        version: '1.0.0',
        capabilities: ['typescript-compilation', 'eslint', 'test-coverage', 'security-audit']
      },
      messageBus,
      taskRepository,
      idempotencyStore,
      {
        retryPreset: 'quick' // Fast retry for validation (file system operations)
      }
    );
  }

  async initialize(): Promise<void> {
    await super.initialize();

    // Load policy configuration
    this.policy = await loadPolicyConfig();
  }

  protected async validatePayload(payload: unknown): Promise<ValidationPayload> {
    return ValidationPayloadSchema.parse(payload);
  }

  protected async execute(payload: ValidationPayload): Promise<ValidationRawResult> {
    // Check working directory exists
    const exists = await fs.pathExists(payload.working_directory);
    if (!exists) {
      throw new ValidationError(
        `Working directory does not exist: ${payload.working_directory}`,
        ['DIRECTORY_NOT_FOUND']
      );
    }

    // Run validation checks
    const checks = await this.runValidationChecks(payload);

    // Evaluate quality gates
    const qualityGates = evaluateQualityGates(checks, this.policy);

    // Generate report
    const report = generateValidationReport(
      payload.task_id,
      payload.workflow_id,
      payload.working_directory,
      checks,
      qualityGates
    );

    return {
      report,
      validation_checks: checks,
      quality_gates: qualityGates
    };
  }

  protected async mapResult(
    rawResult: ValidationRawResult,
    envelope: ExecutionEnvelope<ValidationPayload>
  ): Promise<TaskResult> {
    const taskStatus =
      rawResult.report.overall_status === 'passed' ? 'success' :
      rawResult.report.overall_status === 'warning' ? 'partial' : 'failure';

    const errors: string[] = [];
    if (rawResult.report.overall_status === 'failed') {
      errors.push(...rawResult.report.quality_gates.blocking_failures);
    }

    return {
      task_id: envelope.task_id,
      workflow_id: envelope.workflow_id,
      status: taskStatus,
      output: {
        report: rawResult.report,
        validation_checks: rawResult.validation_checks,
        quality_gates: rawResult.quality_gates
      },
      errors: errors.length > 0 ? errors : undefined,
      metrics: {
        duration_ms: rawResult.report.summary.total_duration_ms,
        api_calls: 0 // No Claude API calls
      },
      next_stage: taskStatus === 'success' ? WORKFLOW_STAGES.INTEGRATION : undefined
    };
  }

  private async runValidationChecks(
    payload: ValidationPayload
  ): Promise<ValidationCheckResult[]> {
    // ... validation-specific logic ...
  }
}
```

---

## 5. Common Utilities Needed

### 5.1 TestingAgentUtils (for unit tests)

**Purpose:** Common mocks and fixtures for testing concrete agents

**File:** `packages/agents/base-agent/src/testing/agent-utils.ts` (new)

```typescript
import { IMessageBus, ITaskRepository, IIdempotencyStore } from '../interfaces';

/**
 * Mock message bus for testing
 */
export class MockMessageBus implements IMessageBus {
  public publishedMessages: any[] = [];
  public subscriptions: Map<string, Function> = new Map();

  async publish(topic: string, message: any, options?: any): Promise<void> {
    this.publishedMessages.push({ topic, message, options });
  }

  async subscribe(topic: string, handler: Function, options?: any): Promise<() => Promise<void>> {
    this.subscriptions.set(topic, handler);
    return async () => { this.subscriptions.delete(topic); };
  }

  async health(): Promise<any> {
    return { ok: true };
  }

  async disconnect(): Promise<void> {}
}

/**
 * Mock task repository for testing
 */
export class MockTaskRepository implements ITaskRepository {
  public updatedTasks: Map<string, any> = new Map();

  async updateTask(task_id: string, updates: any): Promise<void> {
    this.updatedTasks.set(task_id, { ...this.updatedTasks.get(task_id), ...updates });
  }
}

/**
 * Mock idempotency store for testing
 */
export class MockIdempotencyStore implements IIdempotencyStore {
  private seen: Set<string> = new Set();

  async has(message_id: string): Promise<boolean> {
    return this.seen.has(message_id);
  }

  async add(message_id: string, metadata: any): Promise<void> {
    this.seen.add(message_id);
  }
}

/**
 * Create test envelope
 */
export function createTestEnvelope<TPayload>(
  payload: TPayload,
  overrides?: Partial<ExecutionEnvelope<TPayload>>
): ExecutionEnvelope<TPayload> {
  return {
    message_id: randomUUID(),
    task_id: randomUUID(),
    workflow_id: randomUUID(),
    trace_id: generateTraceId(),
    span_id: generateSpanId(),
    stage: 'initialization',
    agent_type: 'scaffold',
    created_at: new Date().toISOString(),
    payload,
    ...overrides
  };
}
```

**Usage in concrete agent tests:**
```typescript
describe('ScaffoldAgent', () => {
  let agent: ScaffoldAgent;
  let messageBus: MockMessageBus;
  let taskRepository: MockTaskRepository;
  let idempotencyStore: MockIdempotencyStore;

  beforeEach(() => {
    messageBus = new MockMessageBus();
    taskRepository = new MockTaskRepository();
    idempotencyStore = new MockIdempotencyStore();

    agent = new ScaffoldAgent(messageBus, taskRepository, idempotencyStore);
  });

  it('should generate project structure', async () => {
    const payload: ScaffoldPayload = {
      project_type: 'app',
      name: 'test-app',
      description: 'Test application',
      tech_stack: { language: 'typescript', runtime: 'node' },
      requirements: ['REST API', 'Database']
    };

    const envelope = createTestEnvelope(payload);
    const result = await agent.execute(payload);

    expect(result.files_generated).toHaveLength(10);
    expect(taskRepository.updatedTasks.get(envelope.task_id).status).toBe('completed');
  });
});
```

---

## 6. Risk Assessment

### 6.1 Breaking Changes

#### High Risk ⚠️
1. **BaseAgent Constructor Signature Change**
   - **Old:** `constructor(capabilities, messageBus)`
   - **New:** `constructor(capabilities, messageBus, taskRepository, idempotencyStore, options?)`
   - **Impact:** All 5 agents + 5 run-agent.ts files
   - **Mitigation:** Phase 1 keeps old signature, Phase 2 adds new parameters

2. **Integration/Deployment Agent Refactor**
   - **Issue:** executeTask() + execute() wrapper anti-pattern
   - **Impact:** Major refactor needed to align with BaseAgent contract
   - **Mitigation:** Keep wrapper initially, refactor in Phase 3

#### Medium Risk ⚠️
3. **Schema Changes**
   - **Issue:** ExecutionEnvelope replaces ad-hoc envelope formats
   - **Impact:** Orchestrator task dispatch logic (workflow.service.ts:456-465)
   - **Mitigation:** ExecutionEnvelope as superset of current envelope

4. **IMessageBus Interface Changes**
   - **Issue:** May need ExecutionEnvelope<T> parameter type
   - **Impact:** OrchestratorContainer wiring
   - **Mitigation:** Keep generic `any` type initially

#### Low Risk ✅
5. **Consolidation Changes (Phase 1)**
   - **Impact:** Code deletions, no functional change
   - **Mitigation:** Comprehensive tests before/after

6. **Additive Changes (Phase 3)**
   - **Impact:** New features (prompt auditing, child spans)
   - **Mitigation:** Optional parameters, backward compatible

---

### 6.2 Migration Complexity

#### Phase 1 (Consolidate) - Easy ✅
- **Complexity:** Low
- **Time:** 3-4 hours
- **Risk:** Low (mostly deletions)
- **Testing:** Existing E2E tests should pass unchanged

#### Phase 2 (Refactor) - Moderate ⚠️
- **Complexity:** Medium
- **Time:** 8-10 hours
- **Risk:** Medium (dependency injection changes)
- **Testing:** Need to update constructor calls in 10 files
- **Rollback:** Revert commits if E2E tests fail

#### Phase 3 (Enhance) - Easy ✅
- **Complexity:** Low-Medium
- **Time:** 4-6 hours
- **Risk:** Low (additive changes)
- **Testing:** Can deploy incrementally

**Total Migration Complexity:** Moderate (15-20 hours)

---

### 6.3 Testing Requirements

#### Unit Tests
- ✅ Mock dependencies (MockMessageBus, MockTaskRepository, MockIdempotencyStore)
- ✅ Test validatePayload() schema validation
- ✅ Test execute() business logic
- ✅ Test mapResult() transformations

#### Integration Tests
- ✅ Test BaseAgent.handleTaskMessage() end-to-end
- ✅ Test idempotency (duplicate message detection)
- ✅ Test task persistence (status updates)
- ✅ Test error classification and retry

#### E2E Tests
- ✅ Run existing workflow tests (./scripts/run-pipeline-test.sh)
- ✅ Verify zero regression in workflow completion
- ✅ Verify trace_id propagation (Session #60 tests)

**Testing Estimate:** 6-8 hours (write new tests for Phase 2 changes)

---

### 6.4 Rollback Strategy

#### Phase 1 Rollback - Easy ✅
- **Action:** Revert commits (git revert)
- **Impact:** Zero functional change, safe rollback
- **Time:** 5 minutes

#### Phase 2 Rollback - Moderate ⚠️
- **Action:** Revert commits + restore old constructor signatures
- **Impact:** May need to rebuild agents
- **Time:** 30 minutes

#### Phase 3 Rollback - Easy ✅
- **Action:** Disable new features (feature flags if available)
- **Impact:** No functional impact, additive changes
- **Time:** 5 minutes

**Overall Rollback Risk:** Low-Medium

---

## 7. Recommendations

### Immediate Action Items (Session #64)

1. **Fix Stream Consumer Issue First** (CRITICAL - 2-3 hours)
   - **Why:** Workflows stuck at 0%, agents not consuming messages
   - **Root Cause:** Stream consumer loop (redis-bus.adapter.ts:122-207) not invoking handlers
   - **Do this BEFORE BaseAgent refactor**

2. **Quick Win: Phase 1 Consolidation** (4 hours)
   - **Why:** Zero risk, reduces duplication immediately
   - **Impact:** Cleaner codebase, easier to maintain
   - **Do this AFTER stream consumer fix**

3. **Strategic: Message Bus Refactor** (STRATEGIC-BUS-REFACTOR.md)
   - **Why:** Fixes root cause of duplicate delivery (Session #63 bug)
   - **Impact:** Eliminates CAS failures, enables idempotency
   - **Do this BEFORE Phase 2 (BaseAgent needs idempotency store)**

### Long-Term Roadmap

**Week 1-2: Fix Critical Bugs**
- Stream consumer handler invocation fix
- Message bus dual delivery fix (ExecutionBus/NotificationBus split)
- Idempotency layer implementation (Postgres or Redis)

**Week 3: BaseAgent Refactor Phase 1**
- Consolidate duplicated code
- Standardize error handling
- Extract tracing boilerplate

**Week 4: BaseAgent Refactor Phase 2**
- Add task persistence
- Add idempotency checking
- Add error classification

**Week 5: BaseAgent Refactor Phase 3**
- Add child span creation
- Add prompt auditing
- Add retry configuration

**Week 6: Integration/Deployment Alignment**
- Refactor executeTask() → execute() alignment
- Standardize schemas
- Remove execute() wrapper anti-pattern

**Total Timeline:** 6 weeks (30 hours of implementation + 10 hours of testing)

---

## Conclusion

The current BaseAgent architecture is a **good foundation** but suffers from:
- **Pipeline logic scattered** across concrete agents (duplication)
- **Missing critical features** (idempotency, task persistence, error classification)
- **Inconsistent patterns** (Integration/Deployment divergence)

The strategic refactor will:
- ✅ **Consolidate** pipeline logic into BaseAgent
- ✅ **Add** missing features (idempotency, tracing, auditing)
- ✅ **Standardize** patterns across all agents
- ✅ **Enable** production-ready observability and reliability

**Estimated Effort:** 15-20 hours (3 phases)
**Risk Level:** Medium (manageable with incremental approach)
**Business Value:** High (eliminates duplicates, prevents CAS failures, enables cost tracking)

**Next Steps:**
1. Review and approve this exploration
2. Fix stream consumer bug (Session #64 Priority #1)
3. Implement message bus refactor (STRATEGIC-BUS-REFACTOR.md)
4. Execute Phase 1 (consolidate) in Session #65
5. Execute Phase 2 (refactor) in Session #66
6. Execute Phase 3 (enhance) in Session #67

---

**END OF EXPLORATION REPORT**
