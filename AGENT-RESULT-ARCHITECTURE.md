# Agent Result System - Architecture Diagrams

## 1. Schema Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTHORITATIVE SCHEMAS                         │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  AgentResultSchema (packages/shared/types/src/core/schemas.ts)   │
│  ─────────────────────────────────────────────────────────────    │
│  • task_id: TaskId                                               │
│  • workflow_id: WorkflowId                                       │
│  • agent_id: AgentId                                             │
│  • agent_type: 'scaffold'|'validation'|'integration'|...         │
│  • success: boolean                                              │
│  • status: TaskStatusEnum                                        │
│  • action: string                                                │
│  • result: Record<string, unknown>                               │
│  • metrics: { duration_ms, tokens_used, api_calls, ... }        │
│  • error?: { code, message, details, stack, retryable }         │
│  • artifacts?: Array<{ name, path, type, size_bytes }>          │
│  • warnings?: string[]                                           │
│  • timestamp: ISO datetime                                       │
│  • version: '1.0.0'                                              │
└──────────────────────────────────────────────────────────────────┘
                              ▲
                              │
                 ┌────────────┼────────────┐
                 │            │            │
        ┌────────▼────┐ ┌─────▼────┐ ┌───▼─────────┐
        │ScaffoldResult│ │Validation │ │ Deployment  │
        │Schema        │ │ResultSchema│ │ResultSchema │
        ├──────────────┤ ├───────────┤ ├─────────────┤
        │files_generated
        │structure
        │templates_used
        │analysis
        │package_info
        │generation_metrics
        │next_steps
        └──────────────┘ │valid
                         │passed_quality_gates
                         │errors
                         │metrics
                         │quality_gates
                         │reports
                         │recommendations
                         │summary
                         └───────────┘ │BuildResult
                                      │PushResult
                                      │DeploymentResult
                                      │RollbackResult
                                      │HealthCheckResult
                                      └─────────────┘


┌──────────────────────────────────────────────────────────────────┐
│  TaskResult (packages/agents/base-agent/src/types.ts) [CURRENT]  │
│  ────────────────────────────────────────────────────────────     │
│  ⚠️ SIMPLIFIED - MISSING FIELDS                                  │
│  • task_id: string                                               │
│  • workflow_id: string                                           │
│  • status: 'success' | 'failure'  ⚠️ ENUM MISMATCH              │
│  • output: Record<string, unknown>  ⚠️ FIELD NAME MISMATCH      │
│  • errors?: string[]                                             │
│                                                                   │
│  ❌ MISSING: agent_id, agent_type, action, metrics, artifacts,  │
│             warnings, timestamp, version, success                │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Message Flow Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                         TASK EXECUTION FLOW                         │
└────────────────────────────────────────────────────────────────────┘

PHASE 1: TASK DISPATCH
┌─────────────────────┐
│  WorkflowService    │
│  createTaskForStage │
└──────────┬──────────┘
           │
           │ creates AgentTask + wraps in envelope
           ▼
┌──────────────────────────────────────────────────────────┐
│ AgentDispatcherService.dispatchTask()                    │
│                                                           │
│  AgentTask → AgentMessage wrapper                        │
│  {                                                        │
│    id: UUID                                              │
│    type: 'task'                                          │
│    workflow_id: workflow_id                              │
│    stage: current_stage                                  │
│    payload: {                                            │
│      task_id                                             │
│      workflow_id                                         │
│      context: envelope  ← FULL AGENT ENVELOPE           │
│    }                                                      │
│  }                                                        │
└──────────────┬───────────────────────────────────────────┘
               │
               │ JSON.stringify
               │
               ▼
     ╔═════════════════════════════════════════╗
     ║   REDIS CHANNEL: agents:{agent}:tasks   ║
     ║   (e.g., agents:scaffold:tasks)         ║
     ╚═════════════════════════════════════════╝
               │
               │ subscribe + listen
               │
               ▼
┌──────────────────────────────────────────────────────────┐
│  BaseAgent.receiveTask()                                 │
│  • Parse message.payload.context → envelope             │
│  • Extract workflowStage from envelope                  │
│  • Validate with TaskAssignmentSchema                   │
│  • Call agent.execute(task)                             │
└──────────────┬───────────────────────────────────────────┘
               │
               ▼
          ┌─────────────────────┐
          │  ScaffoldAgent      │
          │  .execute(task)     │
          │                     │
          │  Returns:           │
          │  TaskResult {       │
          │    task_id          │
          │    workflow_id      │
          │    status: 'success'│
          │    output: {        │
          │      ...scaffold    │
          │      specific data  │
          │    }                │
          │  }                  │
          └──────────┬──────────┘
                     │
PHASE 2: RESULT PUBLICATION
                     │
                     ▼
     ┌───────────────────────────────────────────┐
     │ BaseAgent.reportResult()                  │
     │                                            │
     │ TaskResult → AgentMessage wrapper         │
     │ {                                         │
     │   id: UUID                                │
     │   type: 'result'                          │
     │   agent_id: agent_id                      │
     │   workflow_id: workflow_id                │
     │   stage: workflowStage || agent.type     │
     │   payload: TaskResult {                   │
     │     task_id                               │
     │     workflow_id                           │
     │     status: 'success'|'failure'           │
     │     output: {...}                         │
     │   }                                       │
     │   timestamp: ISO string                   │
     │   trace_id: UUID                          │
     │ }                                         │
     └────────────┬────────────────────────────┘
                  │
                  │ JSON.stringify
                  │
                  ▼
     ╔══════════════════════════════════════╗
     ║ REDIS CHANNEL: orchestrator:results  ║
     ║ (Single channel for ALL agent results)
     ╚══════════════════════════════════════╝
                  │
                  │ subscribe + listen
                  │
                  ▼
PHASE 3: RESULT CONSUMPTION
     
┌─────────────────────────────────────────────────────┐
│ AgentDispatcherService.setupResultListener()        │
│                                                      │
│ Subscribes to orchestrator:results                  │
│ Registers handleAgentResult callback                │
└──────────────┬──────────────────────────────────────┘
               │
               ├─→ JSON.parse() → AgentMessage
               │
               ├─→ resultHandlers.get(workflow_id)
               │
               ▼
     ┌─────────────────────────────────────┐
     │ Registered Result Handler           │
     │ (from WorkflowService)              │
     │                                      │
     │ Receives: AgentMessage with         │
     │ payload: TaskResult                 │
     │                                      │
     │ Extracts:                           │
     │ • workflow_id                       │
     │ • status: payload.status            │
     │ • output: payload.output            │
     └──────────────┬──────────────────────┘
                    │
                    ▼
     ┌──────────────────────────────────────────┐
     │ WorkflowService.handleStageComplete()    │
     │                                           │
     │ • Store stage_outputs in database       │
     │ • Fire STAGE_COMPLETE event to state    │
     │   machine                                │
     └────────────┬─────────────────────────────┘
                  │
                  ▼
     ┌──────────────────────────────────────────┐
     │ WorkflowStateMachine                     │
     │                                           │
     │ Event: STAGE_COMPLETE {                  │
     │   stage: event.stage                     │
     │   eventId?: event.eventId (dedup)        │
     │ }                                        │
     │                                           │
     │ Actions:                                 │
     │ • updateProgress()                       │
     │ • logStageComplete()                     │
     │ • computeNextStageOnEvent()              │
     │ • trackEventId()                         │
     │                                           │
     │ Target: 'evaluating' state               │
     └────────────┬─────────────────────────────┘
                  │
                  ▼
     ┌──────────────────────────────────────────┐
     │ Evaluating State                         │
     │                                           │
     │ invoke: advanceStage service             │
     │ input: {                                 │
     │   workflow_id,                           │
     │   nextStage: computed from stage         │
     │ }                                        │
     │                                           │
     │ onDone:                                  │
     │ • If nextStage === undefined             │
     │   → target: 'completed'                  │
     │ • Else                                   │
     │   → target: 'running'                    │
     │   → create new task for next stage       │
     └──────────────────────────────────────────┘
```

---

## 3. Schema Field Mapping

```
┌─────────────────────────────────────────────────────────────────┐
│              RESULT FLOW FIELD TRANSFORMATIONS                  │
└─────────────────────────────────────────────────────────────────┘

Agent Execution Output (from execute method)
└─→ TaskResult {
    task_id: string
    workflow_id: string
    status: 'success' | 'failure'
    output: Record<string, unknown>
    errors?: string[]
}

    ↓ reportResult() wraps in AgentMessage

AgentMessage {
    id: UUID
    type: 'result'
    agent_id: string          ← ADDED by BaseAgent
    workflow_id: string       ← FROM TaskResult
    stage: string             ← EXTRACTED from envelope
    payload: TaskResult       ← ORIGINAL
    timestamp: ISO string     ← ADDED by BaseAgent
    trace_id: UUID           ← ADDED by BaseAgent
}

    ↓ Published to Redis

    ↓ handleAgentResult parses JSON

    ↓ Accessed by handler:

    Handler receives: AgentMessage
    
    Uses:
    • result.workflow_id                 ← Top level
    • result.agent_id                    ← Top level
    • result.payload.task_id             ← Nested
    • result.payload.status              ← Nested
    • result.payload.output              ← Nested
    • result.payload.errors              ← Nested

    ↓ Fires STAGE_COMPLETE event:

    Event: {
      type: 'STAGE_COMPLETE',
      stage: result.stage,
      eventId: result.trace_id
    }
```

---

## 4. Data Structure Comparison

```
┌────────────────────────────────────────────────────────────────────┐
│                   AgentResultSchema vs TaskResult                  │
└────────────────────────────────────────────────────────────────────┘

CORE FIELDS
└─ task_id
   ├─ AgentResultSchema: TaskId (branded string)  ✅
   └─ TaskResult: string                          ✅
   
└─ workflow_id
   ├─ AgentResultSchema: WorkflowId (branded)     ✅
   └─ TaskResult: string                          ✅

STATUS FIELDS - ⚠️ MISMATCH
└─ success
   ├─ AgentResultSchema: boolean                  ✅ Present
   └─ TaskResult: MISSING                         ❌
   
└─ status
   ├─ AgentResultSchema: TaskStatusEnum           ⚠️ 'success'|'failed'|...
   │  (values: pending|queued|running|success|
   │           failed|timeout|cancelled|retrying)
   └─ TaskResult: 'success'|'failure'             ⚠️ Uses 'failure' not 'failed'

RESULT DATA - ⚠️ FIELD NAME MISMATCH
└─ output (TaskResult)
   └─ Maps to: result (AgentResultSchema)
   
METRICS - ⚠️ MISSING IN TaskResult
└─ metrics
   ├─ AgentResultSchema: {
   │    duration_ms: number,
   │    tokens_used?: number,
   │    api_calls?: number,
   │    memory_used_bytes?: number
   │  }                                           ✅ Present
   └─ TaskResult: MISSING                         ❌

ERROR HANDLING - ⚠️ DIFFERENT STRUCTURE
└─ error
   ├─ AgentResultSchema: {
   │    code: string,
   │    message: string,
   │    details?: Record,
   │    stack?: string,
   │    retryable?: boolean
   │  }                                           ✅ Structured
   └─ TaskResult: errors?: string[]               ⚠️ Simple array

METADATA - ⚠️ MISSING IN TaskResult
└─ agent_id
   ├─ AgentResultSchema: AgentId (branded)        ✅ Present
   └─ TaskResult: MISSING                         ❌
   
└─ agent_type
   ├─ AgentResultSchema: Enum                     ✅ Present
   └─ TaskResult: MISSING                         ❌
   
└─ action
   ├─ AgentResultSchema: string                   ✅ Present
   └─ TaskResult: MISSING                         ❌

ARTIFACTS - ⚠️ MISSING IN TaskResult
└─ artifacts
   ├─ AgentResultSchema: [{
   │    name: string,
   │    path: string,
   │    type: string,
   │    size_bytes?: number
   │  }]                                          ✅ Present
   └─ TaskResult: MISSING                         ❌

OBSERVABILITY - ⚠️ MISSING IN TaskResult
└─ warnings
   ├─ AgentResultSchema: string[]                 ✅ Present
   └─ TaskResult: MISSING                         ❌
   
└─ timestamp
   ├─ AgentResultSchema: ISO datetime             ✅ Present
   └─ TaskResult: MISSING                         ❌
   
└─ version
   ├─ AgentResultSchema: '1.0.0'                  ✅ Present
   └─ TaskResult: MISSING                         ❌

SUMMARY
┌─────────────────────────────────────────┐
│ AgentResultSchema: 13 fields            │
│ TaskResult:        5 fields             │
│ Match:             2 fields (38.5%)     │
│ Mismatch:          3 fields (60%)       │
│ Missing in TR:     8 fields             │
└─────────────────────────────────────────┘
```

---

## 5. Wrapper Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                       LAYER VISUALIZATION                        │
└─────────────────────────────────────────────────────────────────┘

LAYER 1: Core Result
────────────────────
  {
    task_id: "task_123",
    workflow_id: "wf_456",
    status: "success",
    output: { /* action-specific data */ },
    errors: undefined
  }


LAYER 2: Published Message (AgentMessage wrapper)
──────────────────────────────────────────────
  {
    id: "abc123def456",
    type: "result",
    agent_id: "scaffold-xyz789",
    workflow_id: "wf_456",
    stage: "scaffolding",
    payload: {           ← ↓ TaskResult wrapped here
      task_id: "task_123",
      workflow_id: "wf_456",
      status: "success",
      output: { /* ... */ },
      errors: undefined
    },
    timestamp: "2025-11-12T10:30:00Z",
    trace_id: "uuid"
  }


LAYER 3: Redis Transport
───────────────────────
  STRING: '{"id":"abc123def456","type":"result",...}'
  CHANNEL: "orchestrator:results"


LAYER 4: Received & Parsed
──────────────────────────
  AgentMessage {
    id: string
    type: string
    agent_id: string
    workflow_id: string
    stage: string
    payload: TaskResult
    timestamp: string
    trace_id: string
  }


ACCESS PATTERNS
───────────────
  result.workflow_id                  ✅ Top-level field
  result.agent_id                     ✅ Top-level field
  result.payload.task_id              ✅ Nested in payload
  result.payload.status               ✅ Nested in payload
  result.payload.output               ✅ Nested in payload
  result.payload.errors               ✅ Nested in payload

  ❌ result.agent_type                Missing (needed in payload)
  ❌ result.payload.action            Missing (needed in payload)
  ❌ result.payload.metrics           Missing (needed in payload)
```

---

## 6. Data Flow Timing

```
┌─────────────────────────────────────────────────────────────────┐
│                      TIMELINE VIEW                               │
└─────────────────────────────────────────────────────────────────┘

T0: Task Created
│
├─ WorkflowService.createTaskForStage()
│  └─ AgentTask { task_id, workflow_id, agent_type, action, payload }
│
├─ AgentDispatcherService.registerResultHandler(workflow_id, handler)
│  └─ Prepares to receive results for this workflow
│
└─ AgentDispatcherService.dispatchTask()
   └─ Publishes to REDIS: agents:{agent_type}:tasks

T1: Agent Receives Task
│
├─ BaseAgent.receiveTask()
│  ├─ Validates with TaskAssignmentSchema
│  ├─ Extracts envelope from message.payload.context
│  └─ Extracts workflowStage from envelope.workflow_context
│
└─ Agent-Specific.execute(task)
   └─ Returns TaskResult

T2: Result Published
│
├─ BaseAgent.reportResult(result, workflowStage)
│  ├─ Validates TaskResult with TaskResultSchema
│  ├─ Wraps in AgentMessage with:
│  │  ├─ agent_id (from BaseAgent)
│  │  ├─ stage (from envelope or agent.type)
│  │  ├─ payload (TaskResult)
│  │  ├─ timestamp
│  │  └─ trace_id
│  │
│  └─ Publishes to REDIS: orchestrator:results
│
└─ AgentDispatcherService listens on orchestrator:results

T3: Result Received
│
├─ AgentDispatcherService.handleAgentResult()
│  ├─ JSON.parse() message
│  ├─ Finds handler: this.resultHandlers.get(workflow_id)
│  │
│  └─ Executes handler(result)
│     │
│     └─ WorkflowService.handleStageComplete()
│        ├─ Extracts: workflow_id, status, output from result.payload
│        ├─ Stores: stage_outputs in database
│        │
│        └─ state_machine.send(STAGE_COMPLETE)

T4: State Machine Updates
│
├─ WorkflowStateMachine.on(STAGE_COMPLETE)
│  ├─ Guard: deduplication check with eventId
│  ├─ Action: updateProgress()
│  ├─ Action: logStageComplete()
│  ├─ Action: computeNextStageOnEvent()
│  ├─ Action: trackEventId()
│  │
│  └─ Target: 'evaluating' state

T5: Evaluating Stage
│
├─ invoke: advanceStage service
│  └─ input: { workflow_id, nextStage }
│
└─ onDone:
   ├─ If nextStage === undefined
   │  └─ Target: 'completed' (final)
   │
   └─ Else
      ├─ Target: 'running'
      └─ WorkflowService.createTaskForStage(nextStage)
         └─ LOOP BACK TO T0 for next stage
```

---

## 7. Error Propagation

```
┌─────────────────────────────────────────────────────────────────┐
│                   ERROR HANDLING PATHS                           │
└─────────────────────────────────────────────────────────────────┘

SCENARIO 1: Agent Execution Fails
──────────────────────────────────

BaseAgent.receiveTask()
  │
  ├─ try: execute(task)
  │  └─ Throws error
  │
  └─ catch: 
     ├─ Construct ErrorResult:
     │  {
     │    task_id,
     │    workflow_id,
     │    status: 'failure',
     │    output: {},
     │    errors: [error.message]
     │  }
     │
     └─ reportResult(errorResult, workflowStage)
        └─ AgentMessage published with status='failure'

Handler receives: result.payload.status = 'failure'
  │
  └─ state_machine.send(STAGE_FAILED) [might be handled elsewhere]


SCENARIO 2: Schema Validation Fails
────────────────────────────────────

TaskResultSchema.parse(result)
  │
  └─ Throws ZodError
     │
     └─ reportResult() may not execute
        └─ No result published
           └─ Handler never fires
              └─ State machine hangs waiting for STAGE_COMPLETE


SCENARIO 3: Task Validation Fails
──────────────────────────────────

BaseAgent.validateTask()
  │
  └─ TaskAssignmentSchema.safeParse(task)
     │
     └─ Fails
        └─ Throws ValidationError
           └─ receiveTask() catch block
              └─ ErrorResult published


CURRENT STATE
─────────────
✅ Agents publish results with status='success'|'failure'
✅ Errors are caught and reported
⚠️ But TaskResult doesn't have structured error field
⚠️ Error details are lost in simple errors: string[]
❌ No status='failed'|'timeout'|'retrying' values used
```

---

## 8. Implementation Status Matrix

```
┌──────────────────────────────────────────────────────────────────┐
│                   FEATURE IMPLEMENTATION STATUS                   │
└──────────────────────────────────────────────────────────────────┘

SCHEMA DEFINITIONS
├─ AgentResultSchema              ✅ Defined (core/schemas.ts:97-129)
├─ ScaffoldResultSchema           ✅ Defined (agents/scaffold.ts:95-176)
├─ ValidationResultSchema         ✅ Defined (agents/validation.ts:112-204)
├─ DeploymentResultSchema         ✅ Defined (agents/deployment.ts:320-336)
├─ IntegrationResultSchema        ✅ Defined (agents/integration.ts:218-233)
└─ E2EResultSchema                ✅ Defined (agents/e2e.ts)

AGENT IMPLEMENTATIONS
├─ BaseAgent.reportResult()       ✅ Publishes AgentMessage wrapper
├─ ScaffoldAgent.execute()        ✅ Returns TaskResult
├─ ValidationAgent.execute()      ✅ Returns TaskResult
├─ DeploymentAgent.execute()      ✅ Returns TaskResult
├─ IntegrationAgent.execute()     ✅ Returns TaskResult
└─ E2EAgent.execute()             ✅ Returns TaskResult

MESSAGE BUS
├─ Redis Channels defined         ✅ (pipeline.constants.ts)
├─ Task dispatch                  ✅ (agent-dispatcher.service.ts)
├─ Result subscription            ✅ (agent-dispatcher.service.ts)
├─ Handler registration           ✅ (agent-dispatcher.service.ts)
└─ Message parsing                ✅ (agent-dispatcher.service.ts:150-220)

STATE MACHINE
├─ STAGE_COMPLETE event           ✅ Defined
├─ Event deduplication            ✅ Implemented with eventId tracking
├─ Stage computation              ✅ Implemented
├─ Evaluating state               ✅ Implemented
└─ Progress tracking              ✅ Implemented

VALIDATION
├─ TaskResultSchema               ✅ (base-agent/src/types.ts)
├─ TaskAssignmentSchema           ✅ (base-agent/src/types.ts)
├─ AgentResult type guard         ✅ (core/schemas.ts)
├─ Contracts defined              ✅ (shared/contracts/src/)
├─ Active result validation       ❌ NOT ENFORCED

DATABASE
├─ Workflow persistence           ✅ (repository)
├─ stage_outputs storage          ✅ (storeStageOutput)
├─ Result history                 ❌ NOT STORED
└─ Metrics tracking               ❌ NOT STORED

OBSERVABILITY
├─ Result logging                 ✅ (agent-dispatcher.service.ts)
├─ Trace ID propagation           ✅ (in AgentMessage)
├─ Metrics collection             ⚠️ Not captured in TaskResult
├─ Error tracking                 ⚠️ Simple string array
└─ Audit trail                    ❌ NOT IMPLEMENTED

SCHEMA ALIGNMENT
├─ AgentResultSchema used         ❌ Not by agents
├─ TaskResult matches schema      ❌ Significant gaps
├─ status enum consistency        ❌ 'success'|'failure' vs full enum
├─ field naming consistency       ❌ 'output' vs 'result'
└─ Agent-specific schemas used    ❌ Not by agents
```

