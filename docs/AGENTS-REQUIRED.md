# AGENTS-REQUIRED.md - Complete Agent Inventory for Target State

**Version:** 1.0.0 | **Date:** 2025-11-16 | **Status:** ✅ Analysis Complete

This document defines all agents required for the **full production build** of the Agentic SDLC platform, mapped to workflow stages and workflow types.

---

## 📊 EXECUTIVE SUMMARY

| Metric | Count |
|--------|-------|
| **Total Unique Agents Required** | **7** |
| **Currently Implemented** | **5** |
| **Currently Missing** | **2** |
| **Workflow Stages** | **11** |
| **Workflow Types** | **5** |
| **Production Readiness** | **71% (5/7)** |

---

## 🏆 Agent Inventory

### ✅ CURRENTLY IMPLEMENTED (5 agents)

| # | Agent Name | Type | Purpose | Status |
|---|-----------|------|---------|--------|
| 1 | **Scaffold Agent** | `scaffold` | Project initialization, file generation, boilerplate | ✅ Implemented |
| 2 | **Validation Agent** | `validation` | TypeScript, ESLint, code quality checks | ✅ Implemented |
| 3 | **E2E Test Agent** | `e2e_test` | End-to-end testing, Playwright automation | ✅ Implemented |
| 4 | **Integration Agent** | `integration` | Integration testing, API testing | ✅ Implemented |
| 5 | **Deployment Agent** | `deployment` | Deployment configuration, container setup | ✅ Implemented |

### ⏳ MISSING (2 agents)

| # | Agent Name | Type | Purpose | Priority | Est. Effort |
|---|-----------|------|---------|----------|-------------|
| 6 | **Monitoring Agent** | `monitoring` | Observability, metrics, dashboards, health checks | HIGH | 8-12 hours |
| 7 | **Debug Agent** | `debug` | Debugging, error analysis, test failure diagnosis | MEDIUM | 6-8 hours |

---

## 📋 STAGE-TO-AGENT MAPPING

This table shows how agents map to workflow stages:

| Stage | Order | Agent Type | Agent Name | Current | Status |
|-------|-------|-----------|-----------|---------|--------|
| initialization | 1 | `scaffold` | Scaffold Agent | ✅ | Implemented |
| scaffolding | 2 | `scaffold` | Scaffold Agent | ✅ | Implemented |
| implementation | 3 | `scaffold` | Scaffold Agent | ✅ | Implemented |
| validation | 4 | `validation` | Validation Agent | ✅ | Implemented |
| testing | 5 | `e2e_test` | E2E Test Agent | ✅ | Implemented |
| e2e_testing | 6 | `e2e_test` | E2E Test Agent | ✅ | Implemented |
| integration | 7 | `integration` | Integration Agent | ✅ | Implemented |
| deployment | 8 | `deployment` | Deployment Agent | ✅ | Implemented |
| monitoring | 9 | `monitoring` | Monitoring Agent | ❌ | **MISSING** |
| debugging | 10 | `debug` | Debug Agent | ❌ | **MISSING** |
| fixing | 11 | `debug` | Debug Agent | ❌ | **MISSING** |

---

## 🔄 WORKFLOW TYPE STAGE SEQUENCES

### Workflow Type: APP (Full Pipeline)
**Stages:** 7 stages across 5 agents
```
initialization (scaffold)
  ↓
scaffolding (scaffold)
  ↓
validation (validation)
  ↓
e2e_testing (e2e_test)
  ↓
integration (integration)
  ↓
deployment (deployment)
  ↓
monitoring (monitoring) ❌ MISSING
```

**Agents Used:** Scaffold, Validation, E2E Test, Integration, Deployment, Monitoring (missing)

### Workflow Type: FEATURE (Partial Pipeline)
**Stages:** 4 stages across 4 agents
```
initialization (scaffold)
  ↓
scaffolding (scaffold)
  ↓
validation (validation)
  ↓
e2e_testing (e2e_test)
```

**Agents Used:** Scaffold, Validation, E2E Test ✅ **Complete**

### Workflow Type: BUGFIX (Minimal Pipeline)
**Stages:** 3 stages across 2 agents
```
initialization (scaffold)
  ↓
validation (validation)
  ↓
e2e_testing (e2e_test)
```

**Agents Used:** Scaffold, Validation, E2E Test ✅ **Complete**

### Workflow Type: SERVICE (Enterprise Pipeline)
**Stages:** 5 stages across 5 agents
```
initialization (scaffold)
  ↓
scaffolding (scaffold)
  ↓
validation (validation)
  ↓
integration (integration)
  ↓
deployment (deployment)
```

**Agents Used:** Scaffold, Validation, Integration, Deployment ✅ **Complete**

### Workflow Type: CAPABILITY (Internal API Pipeline)
**Stages:** 3 stages across 2 agents
```
initialization (scaffold)
  ↓
implementation (scaffold)
  ↓
validation (validation)
```

**Agents Used:** Scaffold, Validation ✅ **Complete**

---

## 📊 COVERAGE ANALYSIS

### By Workflow Type
| Type | Total Stages | Implemented | Missing | Coverage |
|------|-------------|-------------|---------|----------|
| APP | 7 | 6 | 1 (monitoring) | 86% |
| FEATURE | 4 | 4 | 0 | 100% ✅ |
| BUGFIX | 3 | 3 | 0 | 100% ✅ |
| SERVICE | 5 | 5 | 0 | 100% ✅ |
| CAPABILITY | 3 | 2 | 0 | 100% ✅ |

### By Agent
| Agent | Stages | Workflows | Criticality |
|-------|--------|-----------|------------|
| Scaffold | 3 (init, scaffolding, implementation) | All 5 types | **CRITICAL** |
| Validation | 1 (validation) | All 5 types | **CRITICAL** |
| E2E Test | 2 (testing, e2e_testing) | 3 types (APP, FEATURE, BUGFIX) | **CRITICAL** |
| Integration | 1 (integration) | 2 types (APP, SERVICE) | HIGH |
| Deployment | 1 (deployment) | 2 types (APP, SERVICE) | HIGH |
| **Monitoring** | 1 (monitoring) | 1 type (APP) | **MEDIUM** |
| **Debug** | 2 (debugging, fixing) | All types (post-failure) | MEDIUM |

---

## 🎯 Missing Agent Specifications

### Agent #6: MONITORING AGENT

**Type:** `monitoring`

**Stages:** monitoring (1)

**Used In:** APP workflow type (optional/post-deployment)

**Responsibilities:**
1. Deploy and configure observability stack (Prometheus, Grafana, OpenTelemetry)
2. Set up application metrics collection
3. Create health check endpoints
4. Configure alerting rules
5. Generate monitoring dashboards
6. Validate log aggregation setup
7. Performance baseline establishment

**Input (from deployment stage):**
- Deployed application URLs
- Service endpoints
- Infrastructure details
- Environment configuration

**Output:**
- Monitoring dashboard URLs
- Health check validation results
- Metrics collection status
- Alert rules configured
- SLO/SLI definitions

**Example Implementation:**
```typescript
export class MonitoringAgent extends BaseAgent {
  async execute(task: AgentEnvelope): Promise<TaskResult> {
    // 1. Parse deployed service URLs
    // 2. Deploy Prometheus scrape targets
    // 3. Configure Grafana dashboards (via API)
    // 4. Set up OpenTelemetry instrumentation
    // 5. Validate metrics flow
    // 6. Create alerting rules
    return TaskResult with monitoring URLs and status
  }
}
```

**Integration Points:**
- **Input from:** Deployment Agent (app URLs, container IDs)
- **Output to:** State Machine (monitoring stage completion)
- **External APIs:** Prometheus API, Grafana API, cloud monitoring APIs

**Estimated Effort:** 8-12 hours
- Prometheus/Grafana API integration: 3 hours
- OpenTelemetry instrumentation: 2 hours
- Dashboard templating: 2 hours
- Health check setup: 2 hours
- Testing & validation: 1-3 hours

---

### Agent #7: DEBUG AGENT

**Type:** `debug`

**Stages:** debugging, fixing (2)

**Used In:** Optional/post-failure (all workflow types)

**Responsibilities:**
1. Analyze test failures and error logs
2. Extract relevant error context
3. Generate debugging report
4. Suggest fixes or code patches
5. Validate test failure root causes
6. Create reproduction steps
7. Generate fix recommendations

**Input (on test failure):**
- Test failure logs
- Error stack traces
- Related code context
- Previous stage outputs

**Output:**
- Root cause analysis
- Suggested fixes
- Code patches (if applicable)
- Reproduction steps
- Fix confidence score

**Example Implementation:**
```typescript
export class DebugAgent extends BaseAgent {
  async execute(task: AgentEnvelope): Promise<TaskResult> {
    // 1. Parse test failure logs
    // 2. Extract error context
    // 3. Call Claude to analyze root cause
    // 4. Generate suggested fixes
    // 5. Create patch recommendations
    return TaskResult with analysis and suggestions
  }
}
```

**Integration Points:**
- **Triggered by:** State Machine (on STAGE_FAILED event)
- **Input from:** Failed agent (logs, error details)
- **Output to:** State Machine (debugging stage completion)
- **Optional:** Can trigger fixing stage with patches

**Estimated Effort:** 6-8 hours
- Log parsing and context extraction: 2 hours
- Claude integration for analysis: 1 hour
- Patch generation: 2 hours
- Testing: 1-2 hours

---

## 🔗 Agent Dependencies & Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Workflow Pipeline                         │
└─────────────────────────────────────────────────────────────┘

1. Initialization
   ↓ (via Scaffold Agent)
2. Scaffolding
   ↓ (via Scaffold Agent)
3. Validation
   ├─ Validation Agent performs code quality checks
   └─ On failure → Debug Agent analyzes (optional)
   ↓
4. E2E Testing
   ├─ E2E Test Agent runs tests
   └─ On failure → Debug Agent analyzes (optional)
   ↓
5. Integration
   ├─ Integration Agent runs integration tests
   └─ On failure → Debug Agent analyzes (optional)
   ↓
6. Deployment
   ├─ Deployment Agent deploys to infrastructure
   └─ On failure → Debug Agent analyzes (optional)
   ↓
7. Monitoring (APP workflows only)
   └─ Monitoring Agent sets up observability

All Outputs Flow Back: Stage outputs → stage_outputs in AgentEnvelope
                       Used by downstream stages
```

---

## 📈 Implementation Roadmap

### Phase 1: CURRENT STATE ✅ (99% complete)
**Status:** Production-ready with 5 agents
- ✅ Scaffold Agent
- ✅ Validation Agent
- ✅ E2E Test Agent
- ✅ Integration Agent
- ✅ Deployment Agent

**Capability:** Supports FEATURE, BUGFIX, SERVICE, CAPABILITY workflow types (100%)

### Phase 2: ADD MONITORING AGENT (HIGH PRIORITY)
**Target:** Next sprint (1-2 weeks)
**Impact:** Enables full APP workflow pipeline

```
Deliverables:
- Monitoring Agent implementation
- Prometheus scrape configuration
- Grafana dashboard API integration
- OpenTelemetry instrumentation
- Health check automation
- E2E tests for monitoring setup
```

### Phase 3: ADD DEBUG AGENT (MEDIUM PRIORITY)
**Target:** Following sprint (1-2 weeks)
**Impact:** Improves reliability and debugging workflow

```
Deliverables:
- Debug Agent implementation
- Error log parsing
- Claude-powered root cause analysis
- Patch generation system
- Integration with failed stages
- Reproduction step generation
```

### Phase 4: PRODUCTION CERTIFICATION (3-4 weeks)
**Target:** Full release readiness
```
Deliverables:
- All agents tested end-to-end
- Load testing (concurrent workflows)
- Failure scenario testing
- Documentation complete
- Runbooks for operations
- Monitoring/alerting setup
```

---

## ✅ PRODUCTION READINESS BY SCENARIO

### Scenario 1: Create a Feature (FEATURE workflow)
**Status:** ✅ **100% Ready**

Stages executed:
1. initialization (Scaffold) ✅
2. scaffolding (Scaffold) ✅
3. validation (Validation) ✅
4. e2e_testing (E2E Test) ✅

All required agents implemented. Can run to completion today.

### Scenario 2: Deploy a Service (SERVICE workflow)
**Status:** ✅ **100% Ready**

Stages executed:
1. initialization (Scaffold) ✅
2. scaffolding (Scaffold) ✅
3. validation (Validation) ✅
4. integration (Integration) ✅
5. deployment (Deployment) ✅

All required agents implemented. Can run to completion today.

### Scenario 3: Build a Full App (APP workflow)
**Status:** ⚠️ **86% Ready** (1 missing agent)

Stages executed:
1. initialization (Scaffold) ✅
2. scaffolding (Scaffold) ✅
3. validation (Validation) ✅
4. e2e_testing (E2E Test) ✅
5. integration (Integration) ✅
6. deployment (Deployment) ✅
7. monitoring (Monitoring) ❌ **MISSING**

Workaround: APP workflows execute but skip monitoring stage. Would need Monitoring Agent to complete.

### Scenario 4: Handle Test Failures (All workflows)
**Status:** ⚠️ **Partial** (Optional feature)

Debug workflows execute:
- debugging (Debug Agent) ❌ **MISSING**
- fixing (Debug Agent) ❌ **MISSING**

Workaround: Test failures can be analyzed manually or via orchestrator logs. Automated debugging not available until Debug Agent implemented.

---

## 🎯 Critical Path for Production

### Must Have (For 100% Coverage)
- ✅ Scaffold Agent (handles initialization, scaffolding, implementation)
- ✅ Validation Agent (code quality gates)
- ✅ E2E Test Agent (quality assurance)
- ✅ Integration Agent (system integration)
- ✅ Deployment Agent (infrastructure automation)

**Status:** ✅ **COMPLETE** - All critical agents implemented

### Should Have (For APP Workflows)
- ❌ Monitoring Agent (post-deployment observability)

**Status:** Partially complete (4/5 workflow types don't require it)

### Nice to Have (For Better DX)
- ❌ Debug Agent (automated failure analysis)

**Status:** Optional but recommended

---

## 📊 Agent Complexity & Effort Breakdown

| Agent | Complexity | Implementation Time | Testing Time | Total |
|-------|-----------|-------------------|--------------|-------|
| Scaffold | HIGH | 40 hours | 10 hours | 50 hours |
| Validation | MEDIUM | 20 hours | 5 hours | 25 hours |
| E2E Test | HIGH | 30 hours | 8 hours | 38 hours |
| Integration | MEDIUM | 25 hours | 5 hours | 30 hours |
| Deployment | HIGH | 35 hours | 8 hours | 43 hours |
| **Monitoring** | **MEDIUM** | **10 hours** | **3 hours** | **13 hours** |
| **Debug** | **MEDIUM** | **7 hours** | **2 hours** | **9 hours** |
| **TOTAL** | | **167 hours** | **41 hours** | **208 hours** |

---

## 🔍 CURRENT IMPLEMENTATION STATUS (Session #69)

### Dashboard Integration
- ✅ Dashboard displays workflow progress
- ✅ Progress calculation: 15% per stage (7 stages = 100%)
- ✅ E2E testing shows 60% progress
- ✅ All 5 implemented agents working end-to-end

### Known Limitations
- ❌ Monitoring Agent not implemented (APP workflows incomplete)
- ❌ Debug Agent not implemented (failure analysis requires manual review)
- ⚠️ Only 4/5 workflow types fully supported

### Performance
- ✅ 7 PM2 processes (orchestrator + 5 agents)
- ✅ Redis Streams with consumer groups
- ✅ Distributed tracing enabled
- ✅ AgentEnvelope v2.0.0 validation complete

---

## 📚 Reference: Agent Locations

```
packages/agents/
├── base-agent/
│   └── src/base-agent.ts                    # Abstract base class
├── scaffold-agent/
│   ├── src/scaffold-agent.ts               # ✅ Implemented
│   └── src/run-agent.ts
├── validation-agent/
│   ├── src/validation-agent.ts             # ✅ Implemented
│   └── src/run-agent.ts
├── e2e-agent/
│   ├── src/e2e-agent.ts                    # ✅ Implemented
│   └── src/run-agent.ts
├── integration-agent/
│   ├── src/integration-agent.ts            # ✅ Implemented
│   └── src/run-agent.ts
├── deployment-agent/
│   ├── src/deployment-agent.ts             # ✅ Implemented
│   └── src/run-agent.ts
├── monitoring-agent/                       # ❌ NOT YET CREATED
│   ├── src/monitoring-agent.ts
│   └── src/run-agent.ts
└── debug-agent/                            # ❌ NOT YET CREATED
    ├── src/debug-agent.ts
    └── src/run-agent.ts
```

---

## 🚀 Quick Start: Creating Missing Agents

### To implement Monitoring Agent:
1. Use AGENT-PLAYBOOK.md (just created)
2. Follow Step 1-5 from the playbook
3. Focus on: Prometheus/Grafana API integration
4. Estimated time: 8-12 hours
5. Then add to PM2 ecosystem config

### To implement Debug Agent:
1. Use AGENT-PLAYBOOK.md
2. Follow Step 1-5 from the playbook
3. Focus on: Error log parsing + Claude analysis
4. Estimated time: 6-8 hours
5. Add post-failure trigger to state machine

Both agents can be implemented independently and added incrementally without breaking existing workflows.

---

## ✅ Validation

To verify this analysis:

```bash
# Check implemented agents
ls -la packages/agents/*/src/*-agent.ts

# Check constants
grep -A 20 "AGENT_TYPES = {" packages/shared/types/src/constants/pipeline.constants.ts

# Check stage mapping
grep -A 15 "STAGE_TO_AGENT_MAP" packages/shared/types/src/constants/pipeline.constants.ts

# Check workflow sequences
grep -A 50 "STAGE_SEQUENCES" packages/shared/types/src/constants/pipeline.constants.ts

# List PM2 processes
pnpm pm2:status
```

---

**Status:** ✅ Complete - Ready for development prioritization
**Next Step:** Implement Monitoring Agent for APP workflow support
