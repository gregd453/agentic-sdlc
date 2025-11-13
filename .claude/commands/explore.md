---
name: explore
description: Explore codebase for errors, issues, or architectural concerns
tags: [diagnosis, analysis, troubleshooting]
---

# Explore Command - Agentic SDLC Pipeline

## Critical Context

**CURRENT STATE:** Phase 1-6 is 67% complete with asymmetric message bus architecture.

**KNOWN ISSUES:**
- E2E workflows fail (stuck in initialization)
- Agents don't receive tasks from orchestrator
- Asymmetric architecture: Results path works ✅, Task dispatch path broken ❌

## Your Task

Investigate and analyze the following in the codebase:

**{{QUERY}}**

## Investigation Guidelines

### 1. Architecture Awareness

When exploring, understand the **asymmetric message bus**:

```
WORKS ✅ (Agent → Orchestrator):
- Agents publish via messageBus
- Orchestrator subscribes via messageBus
- Uses Redis Streams + Pub/Sub

BROKEN ❌ (Orchestrator → Agent):
- Orchestrator uses AgentDispatcherService (old)
- Agents don't use messageBus for task subscription
- Raw Redis pub/sub (no streams)
```

### 2. Critical Files

Focus your exploration on these key areas:

**Agents (Task Reception):**
- `packages/agents/base-agent/src/base-agent.ts`
- `packages/agents/*/src/run-agent.ts` (5 agents)

**Orchestrator (Task Dispatch):**
- `packages/orchestrator/src/services/workflow.service.ts`
- `packages/orchestrator/src/services/agent-dispatcher.service.ts` ⚠️ Should be removed
- `packages/orchestrator/src/server.ts`

**Message Bus:**
- `packages/shared/src/message-bus.ts`
- `packages/shared/src/container/orchestrator-container.ts`

### 3. What to Look For

**If exploring errors:**
- [ ] Check if agents are receiving tasks at all
- [ ] Verify messageBus subscription in agents
- [ ] Confirm task dispatch path in orchestrator
- [ ] Look for "Phase 3" markers in code
- [ ] Check for AgentDispatcherService usage (should be gone)

**If exploring architecture:**
- [ ] Verify symmetry: both paths use messageBus
- [ ] Check container DI wiring
- [ ] Validate stream consumer groups
- [ ] Look for raw redis.subscribe() calls (anti-pattern)

**If exploring test failures:**
- [ ] Distinguish unit tests (mocked, may pass) vs E2E tests (real system)
- [ ] Check for workflow state transitions
- [ ] Look for timeout/hanging patterns
- [ ] Verify agent initialization logs

### 4. E2E vs Unit Test Distinction

**CRITICAL:** Unit tests may pass while system is broken!

- Unit tests use mocks → hide integration issues
- E2E tests use real system → reveal truth
- Always validate findings with E2E tests

### 5. Required Documents

Before concluding exploration, reference:

1. **PHASE-1-6-IMPLEMENTATION-ANALYSIS.md** - Gap analysis
2. **STRATEGIC-IMPLEMENTATION-ROADMAP.md** - Original plan
3. **ARCHITECTURE-JOURNEY-MAP.md** - Design evolution

## Output Format

**REQUIRED:** Create a markdown file documenting your exploration.

**File naming convention:** `[topic]-explore.md`
- Example: `phase3-explore.md`, `message-bus-explore.md`, `e2e-failures-explore.md`

**File location:** Project root or `docs/` directory

**File contents:**

```markdown
# [Topic] Exploration Report

**Date:** [Current date]
**Investigator:** Claude Code (Session #X)
**Query:** [Original query from user]

---

## Executive Summary

[Brief 2-3 sentence summary of findings]

## Findings Summary

[Detailed findings organized by component/area]

## Root Cause Analysis

[Why the issue exists - reference asymmetry if relevant]

## Affected Components

[List of impacted files, services, tests]

## Evidence

[File paths with line numbers, log excerpts, code snippets]

## Impact Assessment

- **Severity:** [Critical/High/Medium/Low]
- **Scope:** [How many components affected]
- **User Impact:** [What doesn't work]

## Recommended Next Steps

[What should be done - reference `/plan` command]

---

**Completion Checklist:**
- [ ] Issue identified
- [ ] Root cause determined
- [ ] Files requiring changes listed
- [ ] Impact scope defined
- [ ] Related to Phase 3 incompleteness?
```

After creating the file, provide a concise summary to the user with:
1. What you discovered
2. Path to the detailed exploration report
3. Recommended next steps (use `/plan [topic]`)

## Anti-Patterns to Flag

- ❌ Raw `redis.subscribe()` calls in agents
- ❌ `AgentDispatcherService` still in use
- ❌ Agents not using `OrchestratorContainer`
- ❌ Task dispatch not using `messageBus.publish()`
- ❌ Missing stream consumer groups for tasks

## Success Criteria

Your exploration is complete when you can answer:

1. What is the specific issue?
2. Why does it happen (architectural cause)?
3. Which files need changes?
4. What is the impact scope?
5. Is this related to Phase 3 incompleteness?
