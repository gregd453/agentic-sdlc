# Architecture Decisions - Agentic SDLC

**Last Updated:** 2025-11-07

---

## ADR-001: CLI-First, API-Deferred Architecture

**Status:** ✅ ACCEPTED
**Date:** 2025-11-07
**Context:** Phase 10 implementation complete

### Decision

The Agentic SDLC will be **CLI-driven** with REST APIs deferred for future implementation.

### Rationale

1. **Alignment with Original Design**
   - The "CLI-Invoked, No-Scheduler" design (Agentic_SDLC_CLI_Design.md) specifies operator-driven execution
   - All critical operations should be invokable via CLI commands
   - No background jobs or automated scheduling

2. **Simplicity First**
   - CLI provides direct, deterministic control
   - Easier to reason about and debug
   - Lower surface area for security concerns
   - Faster iteration during development

3. **Operator-Centric Workflow**
   - Operators are in control ("you are the clock")
   - Explicit approval/rejection via CLI
   - Clear audit trail in terminal output
   - Non-interactive mode for CI/CD

4. **API Can Come Later**
   - Once CLI workflows are proven
   - When UI/dashboard needs justify it
   - Minimal disruption to add later

### Implementation

**Primary Interface: CLI**
```bash
# Decision management
cc-agentic decisions evaluate --workflow-id WF-001 --category security_affecting ...
cc-agentic decisions show --id DEC-2025-00001
cc-agentic decisions policy

# Clarification management
cc-agentic clarify create --workflow-id WF-001 --requirements "..." --interactive
cc-agentic clarify answer --id CLR-2025-00001
cc-agentic clarify show --id CLR-2025-00001

# Workflow management (via orchestrator API - minimal)
curl http://localhost:3000/api/v1/workflows
curl http://localhost:3000/api/v1/workflows/:id
```

**Secondary Interface: Orchestrator REST API (Minimal)**
- Keep existing workflow CRUD endpoints
- Used for basic workflow lifecycle only
- NO decision/clarification endpoints (CLI handles this)

**Agent Communication: Redis Pub/Sub**
- Agents communicate via Redis channels (not HTTP)
- Event-driven, asynchronous
- Decoupled from operator interface

### Consequences

**Positive:**
- ✅ Simpler architecture
- ✅ Better developer experience (direct CLI control)
- ✅ Easier to test and debug
- ✅ Lower maintenance burden
- ✅ Clear separation: CLI (operator) vs Redis (agents)
- ✅ Aligned with original design philosophy

**Negative:**
- ❌ No web UI (yet)
- ❌ Requires terminal access
- ❌ Manual invocation (not auto-triggered)
- ❌ Less suitable for non-technical stakeholders

**Neutral:**
- Web UI can be added later when needed
- API endpoints can be added incrementally
- Current architecture supports both models

### Status

**Current State:**
- ✅ Phase 10 CLI commands implemented
- ✅ 42 tests passing for CLI decision/clarification
- ✅ Orchestrator has minimal REST API (6 endpoints)
- ✅ Agents use Redis pub/sub
- ✅ Full CLI workflow functional

**Deferred:**
- REST API endpoints for decisions/clarifications
- Web dashboard for decisions
- Webhook notifications (can use CLI + scripts instead)

### Future Considerations

When to add APIs:
1. When building a web UI dashboard
2. When external systems need to integrate
3. When mobile access is required
4. When non-CLI users become stakeholders

For now: **CLI is sufficient and preferred.**

---

## ADR-002: Event-Driven Agent Communication

**Status:** ✅ ACCEPTED
**Date:** 2025-11-05

### Decision

Agents communicate with the orchestrator via **Redis pub/sub**, not REST APIs.

### Rationale

1. **Asynchronous by Nature**
   - Agent tasks may take minutes/hours
   - HTTP timeout issues avoided
   - Natural fit for long-running operations

2. **Loose Coupling**
   - Agents can be added/removed dynamically
   - No direct dependencies
   - Easy to scale horizontally

3. **Event Sourcing**
   - Full audit trail in Redis
   - Easy to replay events
   - Supports event-driven architecture

### Implementation

**Channels:**
- `agent:{type}:tasks` - Orchestrator → Agent
- `orchestrator:results` - Agent → Orchestrator
- `agent:{type}:heartbeat` - Agent health checks

**Message Format:**
- Zod-validated schemas
- Trace IDs for observability
- Retry logic with exponential backoff

---

## ADR-003: Policy as Code (YAML)

**Status:** ✅ ACCEPTED
**Date:** 2025-11-07

### Decision

Decision thresholds, quality gates, and operational policies are defined in **YAML** configuration files.

### Rationale

1. **Version Control**
   - Policies tracked in git
   - Changes reviewable via PRs
   - Rollback capability

2. **Transparency**
   - Easy for humans to read
   - No code changes needed to adjust thresholds
   - Clear documentation of rules

3. **Flexibility**
   - Different policies per environment (dev/prod)
   - Team-specific configurations
   - Easy to experiment with thresholds

### Implementation

**File:** `ops/agentic/backlog/policy.yaml`

**Sections:**
- Decision thresholds by category
- Quality gates (coverage, security, contracts)
- Release strategies (dev, staging, prod)
- Cost controls and budgets
- Error handling policies

---

## ADR-004: Schema-First Development

**Status:** ✅ ACCEPTED
**Date:** 2025-11-05

### Decision

All data structures are defined as **Zod schemas** first, then TypeScript types are inferred.

### Rationale

1. **Runtime Validation**
   - Catch errors at boundaries
   - Type-safe + runtime-safe
   - Better error messages

2. **Single Source of Truth**
   - Types derived from schemas
   - No duplication
   - Consistency guaranteed

3. **API Documentation**
   - Schemas convert to OpenAPI/JSON Schema
   - Automatic Swagger docs
   - Contract testing

### Implementation

All schemas in:
- `packages/orchestrator/src/types/index.ts`
- `ops/agentic/core/*.ts`
- `ops/agentic/schema-registry/*.json`

---

## Summary of Architecture

```
┌─────────────────────────────────────────────────────┐
│                   OPERATOR (Human)                  │
│                                                     │
│  CLI Commands (cc-agentic decisions, clarify...)   │
└────────────────────┬────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────┐
│              Decision/Clarification Engine          │
│                (ops/agentic/core/)                  │
│                                                     │
│  • Policy evaluation (YAML)                        │
│  • Question generation                             │
│  • Persistence (runs/ directory)                   │
└────────────────────┬────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────┐
│              Orchestrator Service                   │
│         (packages/orchestrator/src/)                │
│                                                     │
│  • Minimal REST API (workflow CRUD)                │
│  • State machine (XState)                          │
│  • Decision gates integration                      │
└────────────────────┬────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────┐
│                Redis Event Bus                      │
│                                                     │
│  • agent:{type}:tasks                              │
│  • orchestrator:results                            │
└────────────────────┬────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────┐
│                    Agents                           │
│      (packages/agents/*/src/)                       │
│                                                     │
│  • Base Agent Framework                            │
│  • Scaffold Agent                                  │
│  • Future: Validation, E2E, Deployment...         │
└─────────────────────────────────────────────────────┘
```

**Key Points:**
- Operator → CLI → Decision Engine
- Orchestrator → Redis → Agents
- No HTTP between operator and agents
- Minimal REST API for workflow management only
- Policy-driven decision gates
- Event-sourced communication

---

**Status:** All architecture decisions implemented and operational.
