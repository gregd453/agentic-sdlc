# SESSION #31 ARCHITECTURE MAP

**Visual Reference for Multi-Agent System State**

---

## 🏗️ SYSTEM ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────────┐
│                        ORCHESTRATOR                              │
│  ┌────────────────────┐  ┌──────────────────┐  ┌──────────────┐│
│  │ Workflow Service   │  │ State Machine    │  │ Event Bus    ││
│  │ - Creates tasks    │  │ - Stage tracking │  │ - Redis      ││
│  │ - Stores context   │  │ - Transitions    │  │ - Pub/Sub    ││
│  │ - Builds payloads  │  │ - CAS updates    │  │ - Dedup      ││
│  └────────────────────┘  └──────────────────┘  └──────────────┘│
└─────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
         ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
         │   SCAFFOLD   │  │  VALIDATION  │  │     E2E      │
         │    AGENT     │  │    AGENT     │  │    AGENT     │
         └──────────────┘  └──────────────┘  └──────────────┘
                    │               │               │
                    ▼               ▼               ▼
         ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
         │  INTEGRATION │  │  DEPLOYMENT  │  │  MONITORING  │
         │    AGENT     │  │    AGENT     │  │    AGENT     │
         └──────────────┘  └──────────────┘  └──────────────┘
                                    │
                                    ▼
              ┌──────────────────────────────────┐
              │        POSTGRESQL DATABASE       │
              │  - Workflows                     │
              │  - Tasks                         │
              │  - Agents                        │
              │  - stage_outputs (JSONB)         │
              └──────────────────────────────────┘
```

---

## 🔄 WORKFLOW PROGRESSION (Session #30 Verified)

```
INITIALIZATION (Stage 0)
    ├─ Task Created: initialization
    ├─ Agent: scaffold-agent (initializes project)
    ├─ Output Stored: output_path, project_name
    └─ Transition: → SCAFFOLDING
         │
         ▼
SCAFFOLDING (Stage 1)
    ├─ Task Created: scaffolding
    ├─ Context Passed: output_path (from initialization)
    ├─ Agent: scaffold-agent (generates code)
    ├─ Output Stored: files_generated, structure, entry_points
    └─ Transition: → VALIDATION
         │
         ▼
VALIDATION (Stage 2) ⬅ SESSION #31 FOCUS
    ├─ Task Created: validation
    ├─ Context Passed: working_directory, validation_types
    ├─ Agent: validation-agent (checks code quality)
    ├─ Expected Output: overall_status, passed_checks, failed_checks
    └─ Transition: → E2E_TESTING (if passed)
         │
         ▼
E2E_TESTING (Stage 3) ⬅ SESSION #31 FOCUS
    ├─ Task Created: e2e_testing
    ├─ Context Passed: working_directory, entry_points, validation_passed
    ├─ Agent: e2e-agent (generates & runs tests)
    ├─ Expected Output: tests_generated, test_results, screenshots
    └─ Transition: → INTEGRATION
         │
         ▼
INTEGRATION (Stage 4) ⬅ SESSION #31 STRETCH GOAL
    ├─ Task Created: integration
    ├─ Context Passed: working_directory, test_results, all previous outputs
    ├─ Agent: integration-agent (API/integration tests)
    ├─ Expected Output: integration_results, api_tests
    └─ Transition: → DEPLOYMENT
         │
         ▼
DEPLOYMENT (Stage 5) ⬅ SESSION #31 STRETCH GOAL
    ├─ Task Created: deployment
    ├─ Context Passed: working_directory, deployment_target, all outputs
    ├─ Agent: deployment-agent (containerize & deploy)
    ├─ Expected Output: deployment_url, container_id, deployment_status
    └─ Transition: → MONITORING (or COMPLETE)
```

---

## 💾 DATABASE SCHEMA (Context Passing)

### Workflow Table (Key Fields)
```sql
CREATE TABLE "Workflow" (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  type                  TEXT NOT NULL,           -- 'app' | 'feature' | 'bugfix'
  current_stage         TEXT NOT NULL,           -- Current pipeline stage
  status                TEXT NOT NULL,           -- 'processing' | 'completed' | 'failed'
  progress_percentage   INTEGER DEFAULT 0,

  -- SESSION #30 ADDITION: Context storage
  stage_outputs         JSONB DEFAULT '{}'::JSONB,

  -- SESSION #26 ADDITION: CAS support
  version               INTEGER DEFAULT 1,

  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);
```

### stage_outputs Structure (Session #30)
```json
{
  "initialization": {
    "output_path": "/path/to/ai.output/{workflow_id}/{project_name}",
    "project_name": "my-app",
    "completed_at": "2025-11-10T19:57:49.442Z"
  },
  "scaffolding": {
    "output_path": "/path/to/ai.output/{workflow_id}/{project_name}",
    "files_generated": [
      "src/index.ts",
      "src/App.tsx",
      "package.json",
      "tsconfig.json"
    ],
    "structure": {
      "src/": ["index.ts", "App.tsx", "components/"],
      "public/": ["index.html"]
    },
    "entry_points": ["src/index.ts"],
    "completed_at": "2025-11-10T19:57:52.627Z"
  },
  "validation": {
    "overall_status": "passed",
    "passed_checks": ["typescript", "eslint", "prettier"],
    "failed_checks": [],
    "quality_gates": {
      "type_coverage": 95,
      "eslint_errors": 0,
      "eslint_warnings": 2
    },
    "completed_at": "2025-11-10T19:58:10.123Z"
  }
}
```

---

## 📡 MESSAGE FLOW (Redis Pub/Sub)

### Task Dispatch Flow
```
Orchestrator                     Redis                      Agent
    │                              │                          │
    │──[createTaskForStage()]───→  │                          │
    │                              │                          │
    │──[buildStagePayload()]─────→ │                          │
    │   (reads stage_outputs)      │                          │
    │                              │                          │
    │──[PUBLISH task]────────────→ │                          │
    │   channel: agent:{type}      │                          │
    │                              │                          │
    │                              │──[SUBSCRIBE]───────────→ │
    │                              │   channel: agent:{type}  │
    │                              │                          │
    │                              │──[MESSAGE task]────────→ │
    │                              │                          │
    │                              │                          │──[execute()]
    │                              │                          │
    │                              │                          │──[reportResult()]
    │                              │                          │
    │                              │←─[PUBLISH result]──────  │
    │                              │   channel: orchestrator:results
    │                              │                          │
    │←─[SUBSCRIBE]─────────────────│                          │
    │   channel: orchestrator:results                         │
    │                              │                          │
    │──[handleAgentResult()]────→  │                          │
    │                              │                          │
    │──[storeStageOutput()]──────→ DB                         │
    │   (writes stage_outputs)     │                          │
    │                              │                          │
    │──[STAGE_COMPLETE event]────→ State Machine             │
    │                              │                          │
    │──[createTaskForStage()]───→  │ (next stage)            │
```

### Event Deduplication (Session #24)
```
Redis delivers message 3x (at-least-once semantics)
    │
    ├─ Delivery 1 → eventId: task-{taskId}
    ├─ Delivery 2 → eventId: task-{taskId} (DUPLICATE)
    └─ Delivery 3 → eventId: task-{taskId} (DUPLICATE)
         │
         ▼
State Machine Guard
    │
    ├─ Check: context._seenEventIds.has(eventId)
    ├─ Delivery 1: NOT SEEN → Process transition
    ├─ Delivery 2: SEEN → Drop event (log duplicate)
    └─ Delivery 3: SEEN → Drop event (log duplicate)
         │
         ▼
Result: Exactly 1 state transition per task completion
```

---

## 🔧 CONTEXT PASSING MECHANISM (Session #30)

### buildStagePayload() Logic
```typescript
// packages/orchestrator/src/services/workflow.service.ts

private buildStagePayload(
  stage: string,
  stageOutputs: Record<string, any>,
  workflowData: any,
  workflow: any
): Record<string, any> {

  switch (stage) {
    case 'validation':
      const scaffoldOutput = stageOutputs.scaffolding || {};
      return {
        working_directory: scaffoldOutput.output_path || workflowData.output_path,
        validation_types: ['typescript', 'eslint', 'prettier'],
        thresholds: { coverage: 80 },
        previous_outputs: scaffoldOutput
      };

    case 'e2e_testing':
      const validationOutput = stageOutputs.validation || {};
      return {
        working_directory: stageOutputs.scaffolding?.output_path,
        entry_points: stageOutputs.scaffolding?.entry_points || [],
        validation_passed: validationOutput.overall_status === 'passed',
        test_types: ['unit', 'integration', 'e2e'],
        previous_outputs: { ...stageOutputs }
      };

    case 'integration':
      return {
        working_directory: stageOutputs.scaffolding?.output_path,
        test_results: stageOutputs.e2e_testing?.test_results,
        previous_outputs: { ...stageOutputs }
      };

    case 'deployment':
      return {
        working_directory: stageOutputs.scaffolding?.output_path,
        deployment_target: 'docker',
        previous_outputs: { ...stageOutputs }
      };

    default:
      return { stage, workflow_id: workflow.id };
  }
}
```

---

## 🎯 AGENT CAPABILITIES (Session #29)

### Scaffold Agent (✅ BUILT & TESTED)
**Purpose:** Generate project structure and boilerplate code
**Input:**
- requirements (string)
- workflow_type (app/feature/bugfix)
**Output:**
- output_path (filesystem location)
- files_generated (array of file paths)
- structure (directory tree)
- entry_points (array of main files)
**Status:** Fully operational, generates code successfully

### Validation Agent (✅ BUILT, NEEDS TESTING)
**Purpose:** Validate generated code quality
**Input:**
- working_directory (from scaffolding output)
- validation_types (typescript, eslint, prettier)
- thresholds (coverage percentage, error limits)
**Output:**
- overall_status (passed/failed)
- passed_checks (array of successful checks)
- failed_checks (array of failed checks)
- quality_gates (metrics)
**Status:** Agent built (4000+ lines), not yet tested in pipeline

### E2E Agent (✅ BUILT, NEEDS TESTING)
**Purpose:** Generate and run end-to-end tests
**Input:**
- working_directory (from scaffolding output)
- entry_points (from scaffolding output)
- validation_passed (from validation output)
**Output:**
- tests_generated (array of test file paths)
- test_results (pass/fail counts)
- screenshots (array of screenshot paths)
- videos (array of video recording paths)
**Status:** Agent built with Playwright integration, not yet tested

### Integration Agent (✅ BUILT, NOT TESTED)
**Purpose:** Run API and integration tests
**Input:**
- working_directory
- test_results (from e2e output)
**Output:**
- integration_results (pass/fail status)
- api_tests (test results for API endpoints)
**Status:** Built but not yet integrated into pipeline

### Deployment Agent (✅ BUILT, NOT TESTED)
**Purpose:** Containerize and deploy application
**Input:**
- working_directory
- deployment_target (docker/kubernetes/etc)
**Output:**
- deployment_url (deployed application URL)
- container_id (Docker container ID)
- deployment_status (success/failure)
**Status:** Built but not yet integrated into pipeline

---

## 📊 SESSION #30 ACHIEVEMENTS (Context Foundation)

### What Was Implemented
1. **Database Schema Enhancement**
   - Added `stage_outputs` JSONB field to Workflow model
   - Migration: 20251110195428_add_stage_outputs_to_workflow

2. **Output Storage Methods**
   - `storeStageOutput()` - Stores stage results after completion
   - `extractStageOutput()` - Extracts relevant fields per stage type
   - Integration in `handleAgentResult()` - Called after each stage

3. **Context Retrieval & Payload Building**
   - `buildStagePayload()` - Creates stage-specific task payloads
   - Modified `createTaskForStage()` - Reads stage_outputs and builds context
   - Stage-specific payload structures for validation, e2e, integration, deployment

### What Was Verified
- ✅ Workflows progress: initialization → scaffolding → validation
- ✅ stage_outputs populated in database after each stage
- ✅ working_directory passed to validation agent task
- ✅ No TypeScript compilation errors
- ✅ Database migration successful

### What Needs Testing (Session #31)
- ❓ Does validation agent actually find files at working_directory?
- ❓ Do validation checks execute correctly?
- ❓ Does workflow progress to e2e_testing after validation?
- ❓ Does e2e agent receive correct context?
- ❓ Do tests get generated and executed?

---

## 🔍 KEY FILES REFERENCE

### Orchestrator
```
packages/orchestrator/
├── src/
│   ├── services/
│   │   └── workflow.service.ts         ← Context passing logic (Session #30)
│   ├── state-machine/
│   │   └── workflow-state-machine.ts   ← Stage transitions
│   ├── repositories/
│   │   └── workflow.repository.ts      ← Database operations
│   └── prisma/
│       └── schema.prisma               ← stage_outputs field
```

### Agents
```
packages/agents/
├── scaffold-agent/
│   └── src/scaffold-agent.ts           ← Generates code (Session #28 fix)
├── validation-agent/
│   └── src/validation-agent.ts         ← Validates code (Session #29 build)
├── e2e-agent/
│   └── src/e2e-agent.ts                ← Tests code (Session #29 build)
├── integration-agent/
│   └── src/integration-agent.ts        ← Integration tests (built)
└── deployment-agent/
    └── src/deployment-agent.ts         ← Deploys code (built)
```

### Testing Infrastructure
```
scripts/
├── env/
│   ├── start-dev.sh                    ← Start postgres + redis
│   ├── stop-dev.sh                     ← Stop infrastructure
│   └── health-check.sh                 ← Verify services
└── logs/
    ├── orchestrator.log                ← Orchestrator debug logs
    ├── scaffold-agent.log              ← Scaffold agent logs
    ├── validation-agent.log            ← Validation agent logs
    └── e2e-agent.log                   ← E2E agent logs
```

---

## 🚦 SESSION #31 TEST PROGRESSION

### Phase 1: Validation Agent (Target: 60 mins)
```
Start: Create "validation-test" workflow
  ↓
Wait: initialization → scaffolding transition
  ↓
Check: Scaffold agent generates files
  ↓
Wait: scaffolding → validation transition
  ↓
Verify: Validation task created with working_directory
  ↓
Monitor: Validation agent receives task
  ↓
Check: Validation agent logs show file discovery
  ↓
Verify: Validation checks execute (typescript, eslint)
  ↓
Confirm: Validation result stored in stage_outputs
  ↓
Success: Workflow transitions validation → e2e_testing
```

### Phase 2: E2E Agent (Target: 90 mins)
```
Start: Create "e2e-pipeline-test" workflow
  ↓
Wait: Progression through initialization, scaffolding, validation
  ↓
Wait: validation → e2e_testing transition
  ↓
Verify: E2E task created with working_directory + entry_points
  ↓
Monitor: E2E agent receives task
  ↓
Check: E2E agent generates Playwright tests
  ↓
Wait: Test execution (may take several minutes)
  ↓
Verify: Test results captured (pass/fail counts)
  ↓
Confirm: E2E result stored in stage_outputs
  ↓
Success: Workflow transitions e2e_testing → integration (or completes)
```

### Phase 3: Gap Analysis (Target: 60 mins)
```
Review: All agent logs for errors
  ↓
Document: Missing context fields
  ↓
Identify: Error handling gaps
  ↓
Assess: State consistency issues
  ↓
Create: Session #32 recommendations
  ↓
Update: CLAUDE.md with findings
  ↓
Commit: Any fixes made during testing
```

---

## ✅ READY FOR SESSION #31

**All documentation complete:**
- ✅ Architecture map created
- ✅ Context passing flow documented
- ✅ Database schema reference provided
- ✅ Agent capabilities summarized
- ✅ Test progression defined
- ✅ Key files identified

**Next steps:**
1. Review SESSION-31-QUICK-START.md for commands
2. Start infrastructure and agents
3. Create test workflows
4. Monitor progression and document results

---

**END OF SESSION #31 ARCHITECTURE MAP**
