# Exploration Report: Leveraging Agent Extensibility in Dashboard

**Phase:** EXPLORE (EPCC Workflow)
**Focus Area:** Dashboard integration with Session #85 Agent Extensibility
**Date:** 2025-11-19
**Status:** Complete Discovery & Analysis ✅

---

## Executive Summary

The Agentic SDLC platform has achieved **Session #85: Unbounded Agent Extensibility**, enabling ANY custom agent with string-based `agent_type` identifiers. The agent registry, platform-scoped routing, and fail-fast validation are fully implemented in the orchestrator.

**CRITICAL FINDING:** The dashboard has NOT yet been integrated to leverage this extensibility. The dashboard currently shows:
- ❌ Hardcoded behavior presets (10 fixed modes)
- ❌ Hardcoded agent types (scaffold, validation, e2e, integration, deployment)
- ❌ No agent discovery mechanism
- ❌ No agent metadata visibility (configSchema, timeout, capabilities)
- ❌ No platform-scoped agent filtering
- ❌ No workflow validation before submission

**Integration Opportunity:** Dashboard can become the primary UI for agent management, enabling users to:
1. 🔍 Discover available agents by platform
2. ⚙️ Configure custom agent inputs/outputs
3. ✅ Validate workflows before creation (fail-fast)
4. 📊 Understand agent capabilities and constraints
5. 🧪 Create test scenarios for any agent (mock mode)

**Estimated Integration Effort:** 8-13 hours across 5 priority levels (P0-P4)

---

## CRITICAL Architecture Points

### 1. Unbounded Agent Type System (Session #85)

```typescript
// BEFORE: Restricted enum
type AgentType = 'scaffold' | 'validation' | 'e2e_test' | ...

// AFTER: Any string supported!
type AgentType = string  // Can be 'ml-training', 'data-validator', 'compliance-checker', etc.
```

**Key Implication:** Users can now create agents without modifying dashboard code!

### 2. Agent Registry Location

**File:** `packages/shared/agent-registry/src/agent-registry.ts`

**Composite Key Pattern:**
```
Global agents:        'scaffold'
Platform-scoped:      'scaffold:web-app-platform'
                      'scaffold:data-pipeline-platform'
```

**Critical Methods:**
- `listAgents(platformId?)` - Get available agents
- `validateAgentExists(type, platformId?)` - Fail-fast with helpful errors
- `getMetadata(type, platformId?)` - Get full agent metadata

**Metadata Includes:**
```typescript
{
  name: string,                           // Display name
  type: string,                           // Routing key (ANY string!)
  version: string,                        // e.g., "2.0.0"
  capabilities: string[],                 // Feature list
  configSchema?: Record<string, unknown>, // CUSTOM FIELDS!
  timeout_ms?: number,                    // Default timeout
  max_retries?: number                    // Default retries
}
```

### 3. Validation Point (CRITICAL)

**File:** `packages/orchestrator/src/services/workflow.service.ts:514-515`

```typescript
agentRegistry.validateAgentExists(agentType, workflow.platform_id)
```

**When:** BEFORE task creation in Redis
**Result:** Fail-fast with intelligent error messages
**Prevents:** Orphaned tasks, silent failures, user confusion

---

## Current Dashboard Integration Gaps

### Gap 1: Hardcoded Agent List ⚠️ CRITICAL

**File:** `StageEditorModal.tsx:82-94`

```typescript
<option value="scaffold-agent">Scaffold Agent</option>
<option value="validation-agent">Validation Agent</option>
<option value="e2e-agent">E2E Agent</option>
<option value="integration-agent">Integration Agent</option>
<option value="deployment-agent">Deployment Agent</option>
```

**Problem:** Can't see registered agents, can't use custom agents
**Impact:** Users have to guess agent names, silent failures possible
**Solution:** Query `/api/v1/agents?platform=web-app` dynamically

### Gap 2: Hardcoded Behavior Modes ⚠️ CRITICAL

**File:** `BehaviorMetadataEditor.tsx`

```typescript
// 10 hardcoded modes:
success, fast_success, slow_success, validation_error, deployment_failed,
unrecoverable_error, timeout, tests_partial_pass, high_resource_usage, crash
```

**Problem:** Can't configure custom agent fields (configSchema)
**Impact:** Custom agents can't be tested properly
**Solution:** Generate form from agent.configSchema dynamically

### Gap 3: No Agent Metadata Visibility ⚠️ CRITICAL

**Missing Information:**
- ❌ Agent version (shows only name)
- ❌ Agent capabilities (shows nothing)
- ❌ Custom config fields (shows only mock behaviors)
- ❌ Timeout defaults (hardcoded 30s everywhere)
- ❌ Max retry defaults (hardcoded 0 everywhere)
- ❌ Platform scope indicator (global vs platform-specific)

### Gap 4: No Discovery Flow ⚠️ HIGH

**Current:**
```
User → Manual guess of agent_type → Hardcoded dropdown
                                         ↓
                                    Create workflow
                                         ↓
                                    Orchestrator validates
                                         ↓
                                   If invalid → FAILED
```

**Needed:**
```
User → Browse available agents → Select with confidence
                                        ↓
                                 View full metadata
                                        ↓
                                  Configure inputs
                                        ↓
                                 Validate before submit
```

### Gap 5: No Platform-Scoped Filtering ⚠️ MEDIUM

**Problem:** Can't differentiate `scaffold` vs `scaffold:web-app-platform`
**Impact:** Can't show which agent version applies to current platform
**Solution:** Accept `platformId` param, pass to registry queries

### Gap 6: No Trace Agent Context ⚠️ MEDIUM

**Problem:** Traces show task but not which agent ran it
**Impact:** Debugging "which custom agent failed?" is hard
**Solution:** Add agent_type column to trace task table

---

## Integration Design: Five Priority Levels

### P0: Agent Discovery API & UI (Foundational - 2-3 hrs)

**Creates the foundation for all other integrations**

**Orchestrator Changes:**
- NEW: `AgentRegistryService` exposes registry to HTTP
- NEW: `/api/v1/agents?platform=:platformId` endpoint
- NEW: `/api/v1/agents/:type?platform=:platformId` endpoint
- NEW: `/api/v1/agents/validate` endpoint (client-side pre-check)

**Dashboard Changes:**
- MODIFY: `StageEditorModal.tsx` - Replace hardcoded dropdown with dynamic list
- NEW: `AgentSelector.tsx` - Component that queries and displays agents
- MODIFY: `client.ts` - Add `getAgents(platformId)` method

**User Experience:**
```
1. User selects platform
2. Agents dropdown auto-populates from registry
3. Shows: "Scaffold v2.0.0 (platform-scoped)" vs "Validation v1.5.0 (global)"
4. User picks agent_type with full information
```

---

### P1: Dynamic Agent Configuration (Core - 2-3 hrs)

**Unlocks real power of extensibility**

**Dashboard Changes:**
- NEW: `SchemaFormBuilder.tsx` - Renders form from agent.configSchema
- NEW: `useAgentMetadata.ts` - Hook to fetch agent details
- MODIFY: `StageEditorModal.tsx` - Show agent metadata panel
- MODIFY: `BehaviorMetadataEditor.tsx` - Support agent-specific config

**Example Flow:**
```
User selects agent_type: "ml-training"
                          ↓
GET /api/v1/agents/ml-training?platform=web-app
                          ↓
Response metadata with configSchema:
{
  name: "ML Training",
  configSchema: {
    model_type: { type: "string", default: "neural-network" },
    epochs: { type: "number", default: 100 },
    learning_rate: { type: "number", default: 0.001 }
  },
  timeout_ms: 300000,
  max_retries: 3
}
                          ↓
Dashboard shows:
[ model_type: [neural-network dropdown] ]
[ epochs: 100 (number input) ]
[ learning_rate: 0.001 (number input) ]
[ timeout: 300000ms (inherited from agent) ]
[ retries: 3 (inherited from agent) ]
```

---

### P2: Platform-Agent Visualization (UX - 2-3 hrs)

**Helps users understand platform architecture**

**Dashboard Changes:**
- NEW: `PlatformDetailsPage.tsx` - Shows platform + available agents
- NEW: `PlatformCard.tsx` - Visual platform card
- NEW: `AgentMatrixTable.tsx` - Agent capabilities table
- MODIFY: `client.ts` - Add `getPlatforms()`, `getPlatformDetails()`

**User Navigation:**
```
Dashboard → "Platforms" tab → Select "web-app-platform"
                                    ↓
                        Shows platform details:
                        ├── Available Agents
                        │   ├── Scaffold v2.0.0 [platform-scoped]
                        │   ├── Validation v1.5 [platform-scoped]
                        │   ├── E2E v1.0 [global]
                        │   └── Deployment v1.2 [platform-scoped]
                        ├── Configuration
                        │   ├── Default Timeout: 30s
                        │   ├── Default Retries: 3
                        │   └── Supports Streaming: ✓
                        └── Usage
                            ├── Active Workflows: 23
                            └── Recent Executions: Last 1h
```

---

### P3: Trace Agent Context (Debugging - 1-2 hrs)

**Essential for debugging custom agent failures**

**Dashboard Changes:**
- MODIFY: `TraceDetailPage.tsx` - Add agent_type column
- NEW: `TaskDetailsModal.tsx` - Show agent metadata in task detail
- MODIFY: API client - Ensure agent_type in responses

**Before & After:**

**Before:**
```
Task ID         | Status   | Duration
task-123        | failed   | 2500ms
task-124        | success  | 1200ms
```

**After:**
```
Task ID   | Agent Type      | Version  | Status   | Duration
task-123  | ml-training     | 1.0.0    | failed   | 2500ms   [Details ▼]
task-124  | validation      | 1.5.0    | success  | 1200ms   [Details ▼]

[Details Modal for task-123]
├── Agent: ml-training v1.0.0 [platform-scoped]
├── Status: failed
├── Error Code: TIMEOUT
├── Message: "Training exceeded 5min timeout"
├── Input: { epochs: 50, learning_rate: 0.001 }
└── Capabilities: ["model-training", "evaluation"]
```

---

### P4: Client-Side Validation (Quality - 1-2 hrs)

**Fail-fast in UI instead of waiting for orchestrator**

**Dashboard Changes:**
- NEW: `useWorkflowValidation.ts` - Validate workflow stages
- MODIFY: `WorkflowPipelineBuilder.tsx` - Show validation errors, disable submit

**Validation Flow:**
```
User fills workflow stages → Clicks Submit
                                ↓
Client validates:
├─ Stage 1: agent_type "scaffold" exists? ✓
├─ Stage 2: agent_type "unknown-agent" exists? ✗ [RED ERROR]
│                     "Did you mean: validation?"
└─ Stage 3: agent_type "validation" exists? ✓
                                ↓
Submit button: DISABLED (fix errors first)
                                ↓
User clicks "unknown-agent" error → Suggestion opens
User selects "validation"
                                ↓
All stages valid → Submit button: ENABLED
                                ↓
POST /api/v1/workflows
                                ↓
Orchestrator ALSO validates (safety net)
                                ↓
Task created if both check pass
```

---

## API Endpoints Required

### Endpoint 1: List Agents for Platform

```
GET /api/v1/agents?platform=web-app&scope=all|platform|global

Response:
[
  {
    type: "scaffold",
    name: "Global Scaffold",
    version: "1.0.0",
    capabilities: ["analyze", "generate", "create-tests"],
    timeout_ms: 30000,
    max_retries: 3,
    scope: "global"
  },
  {
    type: "scaffold",
    name: "Web App Scaffold",
    version: "2.0.0",
    description: "Web framework optimized version",
    capabilities: ["analyze", "generate", "create-tests", "generate-schema"],
    configSchema: { /* ... */ },
    timeout_ms: 30000,
    max_retries: 3,
    scope: "platform",
    platformId: "web-app-platform"
  }
]
```

### Endpoint 2: Get Agent Details

```
GET /api/v1/agents/ml-training?platform=web-app

Response:
{
  type: "ml-training",
  name: "ML Training",
  version: "1.0.0",
  description: "Machine learning model training",
  capabilities: ["train", "evaluate", "save-model"],
  configSchema: {
    model_type: {
      type: "string",
      default: "neural-network",
      enum: ["neural-network", "decision-tree", "svm"]
    },
    epochs: {
      type: "number",
      default: 100,
      minimum: 1,
      maximum: 10000
    },
    learning_rate: {
      type: "number",
      default: 0.001,
      minimum: 0.00001
    }
  },
  timeout_ms: 300000,
  max_retries: 3
}
```

### Endpoint 3: Validate Agent Exists

```
POST /api/v1/agents/validate

Request:
{
  agent_type: "ml-training",
  platform_id: "web-app-platform"
}

Response:
{
  valid: true,
  agent: { /* full metadata */ },
  suggestions: []
}

OR:

Response:
{
  valid: false,
  error: "Agent 'ml-tranin' not found for platform 'web-app-platform'",
  suggestions: ["ml-training", "validation"]
}
```

### Endpoint 4: List Platforms

```
GET /api/v1/platforms

Response:
[
  {
    id: "web-app-platform",
    name: "Web Application",
    type: "web-application",
    agents: [ /* agent metadata array */ ],
    timeout_default: 30000,
    max_retries_default: 3
  },
  {
    id: "data-pipeline-platform",
    name: "Data Pipeline",
    type: "data-processing",
    agents: [ /* agent metadata array */ ],
    timeout_default: 60000,
    max_retries_default: 5
  }
]
```

---

## File Mapping

### Orchestrator (Backend)

| File | Change | Purpose |
|------|--------|---------|
| `packages/orchestrator/src/services/agent-registry.service.ts` | NEW | Wrap AgentRegistry for HTTP access |
| `packages/orchestrator/src/api/routes/agents.router.ts` | NEW | Handle agent discovery endpoints |
| `packages/orchestrator/src/server.ts` | MODIFY | Register agents router |

### Dashboard Client

| File | Change | Purpose |
|------|--------|---------|
| `packages/dashboard/src/api/client.ts` | MODIFY | Add getAgents, getPlatforms, validateAgent |
| `packages/dashboard/src/hooks/useAgentMetadata.ts` | NEW (P1) | Hook for fetching agent metadata |
| `packages/dashboard/src/hooks/useWorkflowValidation.ts` | NEW (P4) | Hook for validating workflows |

### Dashboard UI Components

| File | Change | Purpose |
|------|--------|---------|
| `packages/dashboard/src/components/Workflows/AgentSelector.tsx` | NEW (P0) | Dynamic agent dropdown |
| `packages/dashboard/src/components/Workflows/SchemaFormBuilder.tsx` | NEW (P1) | Dynamic form from configSchema |
| `packages/dashboard/src/components/Workflows/StageEditorModal.tsx` | MODIFY | Use dynamic agent selector |
| `packages/dashboard/src/components/Workflows/BehaviorMetadataEditor.tsx` | MODIFY (P1) | Support agent-specific config |
| `packages/dashboard/src/pages/PlatformDetailsPage.tsx` | NEW (P2) | Platform visualization |
| `packages/dashboard/src/components/Platforms/PlatformCard.tsx` | NEW (P2) | Platform card component |
| `packages/dashboard/src/components/Platforms/AgentMatrixTable.tsx` | NEW (P2) | Agent matrix table |
| `packages/dashboard/src/pages/TraceDetailPage.tsx` | MODIFY (P3) | Add agent_type column |
| `packages/dashboard/src/components/Traces/TaskDetailsModal.tsx` | NEW (P3) | Task detail with agent context |

---

## Key Insights & Constraints

### 1. Registry is in Orchestrator, Not Dashboard

**Why:** Multiple agent processes may be running. Registry reflects all running agents.

**Pattern:**
```
Orchestrator knows about:
├── Global agents (all platforms can use)
├── Platform A agents (only platform A can use)
└── Platform B agents (only platform B can use)

Dashboard queries Orchestrator for:
├── agents for this platform
├── details about agent X
└── whether agent Y is valid
```

### 2. Metadata Includes configSchema (User-Defined)

**Example:**

```typescript
// Agent defines its configuration schema
const agent = new MLTrainingAgent({
  type: 'ml-training',
  configSchema: {
    model_type: { type: 'string', enum: ['neural-network', 'svm'] },
    epochs: { type: 'number', default: 100 }
  }
})

// Dashboard discovers schema and generates form
// User fills: model_type = "neural-network", epochs = 50
// Dashboard passes to agent in envelope.payload
// Agent receives in execute() method
```

### 3. Platform Scope Matters

**Scenario:**

```
Two platforms: web-app, data-pipeline

Platform web-app registers:
├── scaffold v2.0.0 [platform-scoped]
├── validation v1.5.0 [platform-scoped]
└── e2e_test v1.0.0 [global]

Platform data-pipeline registers:
├── scaffold v1.0.0 [global, already registered]
├── data-validator v1.0.0 [platform-scoped]
└── quality-check v1.0.0 [platform-scoped]

When user in web-app creates workflow:
├── Lists: scaffold (v2.0.0 platform), validation (v1.5), e2e_test (v1.0 global)
└── Not available: data-validator, quality-check

When user in data-pipeline creates workflow:
├── Lists: scaffold (v1.0.0 global), data-validator (v1.0), quality-check (v1.0)
└── Not available: validation (web-app only)
```

### 4. Validation Happens Twice

**For Robustness:**

```
Layer 1 (Dashboard - Optional but recommended):
└─ Client-side validation before submit
   └─ Prevents user submitting invalid workflow
   └─ Reduces server load, better UX

Layer 2 (Orchestrator - Always Required):
└─ Server-side validation before task creation
   └─ Prevents orphaned tasks even if Layer 1 skipped
   └─ Provides detailed error messages
```

---

## Testing Strategy

### Unit Tests to Add

```typescript
// Agent discovery
- getAgents(platformId) returns correct list
- getAgent(type, platform) prefers platform-scoped
- validateAgent() returns suggestions on typo

// Dashboard client
- Client.getAgents parses response correctly
- Client handles agent not found error
- Client caches agents per platform

// Components
- SchemaFormBuilder renders string/number/boolean/enum fields
- AgentSelector populates from agents list
- TaskDetailsModal shows agent metadata
```

### Integration Tests to Add

```typescript
// End-to-end
1. Fetch platforms
2. Select platform
3. Fetch agents for platform
4. Fetch agent metadata
5. Fill in configSchema fields
6. Validate workflow
7. Create workflow
8. Verify task has correct agent_type + payload
9. Execute and trace
10. Verify trace shows agent metadata
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| Complex configSchema types | Medium | Low | Start with string/number/boolean, extend later |
| Registry not exposed via API | Low | High | Straightforward HTTP endpoint, already has all methods |
| Custom agents don't have configSchema | Medium | Low | Make optional, show "No custom config" message |
| Platform scope confusion | Medium | Medium | Show clear badges [platform-scoped] vs [global] |
| Performance: many agents | Low | Low | React Query caching by platform + agent_type |
| Backward compatibility | Low | Low | Existing workflows continue working, new feature additive |

---

## Success Criteria

### P0 Complete When:
- ✅ Users can see available agents in dropdown
- ✅ Agent list populated from registry dynamically
- ✅ Agent metadata (version, capabilities) visible
- ✅ No hardcoded agent lists remain

### P1 Complete When:
- ✅ Users can configure custom agent fields
- ✅ Form generated from agent.configSchema
- ✅ Agent timeout/retry defaults shown
- ✅ Configuration saved to workflow

### P2 Complete When:
- ✅ Platform page shows all agents
- ✅ Clear indication of platform vs global agents
- ✅ Capabilities visible for each agent
- ✅ Workflows using each agent linked

### P3 Complete When:
- ✅ Traces show agent_type for each task
- ✅ Task detail shows agent metadata
- ✅ Agent version visible in trace
- ✅ Error codes traceable to agent

### P4 Complete When:
- ✅ Workflow validates before submit
- ✅ Invalid stages shown with red error
- ✅ Suggestions provided for typos
- ✅ Submit button disabled if invalid

---

## Exploration Completion Checklist

- ✅ CLAUDE.md reviewed (Session #85 complete, context understood)
- ✅ Agent registry source code analyzed (agent-registry.ts studied)
- ✅ Platform-scoped routing pattern identified (composite keys: type:platform)
- ✅ Orchestrator validation point located (workflow.service.ts:514)
- ✅ Dashboard hardcoded lists identified (StageEditorModal.tsx:82-94)
- ✅ Hardcoded behavior modes found (BehaviorMetadataEditor.tsx)
- ✅ Current API gaps documented (no agent discovery endpoints)
- ✅ Agent metadata schema mapped (configSchema, timeout, capabilities)
- ✅ Message bus pattern understood (Redis Streams, AgentEnvelope)
- ✅ BaseAgent pattern reviewed (all agents extend, metadata required)
- ✅ Data flow diagrams created (user → UI → API → registry → agent)
- ✅ API endpoints designed (4 required endpoints specified)
- ✅ Component sketches provided (P0-P4 UI changes mapped)
- ✅ File change list created (all files that need modification)
- ✅ Risk analysis completed (6 risks assessed)
- ✅ Integration path mapped (8-13 hours across 5 priorities)

**Status: READY FOR PLAN PHASE** ✅

---

## Summary

This exploration identified a **complete integration opportunity** to leverage Session #85's unbounded agent extensibility in the dashboard. The platform has all necessary infrastructure (agent registry, fail-fast validation, metadata system), but the dashboard UI doesn't expose it yet.

The exploration maps:
1. **5 Priority Levels (P0-P4)** with concrete implementations
2. **6 Critical Gaps** preventing users from using custom agents
3. **4 Required API Endpoints** to expose registry to frontend
4. **Complete File Mapping** showing every file to create/modify
5. **8-13 Hour Implementation Path** for full integration

The dashboard can become the primary agent management UI, enabling users to leverage custom agents without code changes, making the platform significantly more extensible and user-friendly.

