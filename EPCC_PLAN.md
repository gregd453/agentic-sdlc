# Implementation Plan: Dashboard Agent Extensibility Integration

**Phase:** PLAN (EPCC Workflow)
**Feature:** Dashboard integration with Session #85 unbounded agent extensibility
**Status:** Complete planning documentation ✅
**Date:** 2025-11-19

---

## Executive Overview

### Objective
Enable dashboard users to discover, configure, and validate custom agents without code changes. Transform the dashboard from hardcoded agent lists to a dynamic, metadata-driven agent management UI that fully leverages Session #85's unbounded agent extensibility.

### Business Value
- 🔓 **Unlock Extensibility:** Users can now use ANY custom agent (ml-training, data-validator, etc.)
- 💡 **Self-Service:** No code changes needed to use new agents
- 🛡️ **Fail-Fast:** Validate workflows in UI before orchestrator (better UX, fewer orphaned tasks)
- 📊 **Transparency:** Users see exactly what each agent does (metadata, capabilities, constraints)
- 🧪 **Testability:** Configure and test custom agents with their actual inputs

### Success Criteria
- ✅ Users can browse available agents by platform (P0)
- ✅ Custom agents appear in dropdown without code changes (P0)
- ✅ Users can configure agent-specific inputs via dynamic forms (P1)
- ✅ Workflows validate before submission with helpful error messages (P4)
- ✅ Traces show which custom agent ran each task (P3)
- ✅ Dashboard displays agent capabilities and platform relationships (P2)

### Timeline & Effort
**Total:** 8-13 hours across 5 priority levels
- **P0:** Agent Discovery (2-3 hours) — FOUNDATIONAL
- **P1:** Dynamic Configuration (2-3 hours) — CORE FEATURE
- **P2:** Platform Visualization (2-3 hours) — UX IMPROVEMENT
- **P3:** Trace Context (1-2 hours) — DEBUGGING AID
- **P4:** Client Validation (1-2 hours) — QUALITY ASSURANCE

---

## Technical Approach

### Architecture Overview (High-Level)

**Data Flow:**
1. Dashboard queries `/api/v1/agents?platform=web-app`
2. Orchestrator AgentRegistryService returns agent list
3. Dashboard populates dropdown with agent names + metadata
4. User selects agent, dashboard fetches full metadata (configSchema)
5. Dashboard renders dynamic form from configSchema
6. User submits workflow, validates client-side first
7. POST `/api/v1/workflows` to orchestrator
8. Orchestrator validates agent exists (safety net)
9. Task created in Redis → Agent picks up → Executes

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Agent Registry Access** | HTTP endpoints | Separate process; registry in orchestrator only |
| **Caching Strategy** | React Query by platform+type | Minimize API calls; leverage existing patterns |
| **Schema Form Generation** | JSON Schema standard | Start simple (string/number/boolean/enum) |
| **Validation Layers** | Client + Server | Fail-fast in UI; prevent orphaned tasks |
| **API Proxy** | Dashboard server to orchestrator | Keep concerns separate |
| **Platform Scope Display** | Clear badges [platform-scoped] vs [global] | Users understand which agent applies |

---

## Task Breakdown by Priority
