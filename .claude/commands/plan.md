---
name: plan
description: Plan comprehensive fixes for identified issues
tags: [planning, architecture, strategy]
---

# Plan Command - Agentic SDLC Pipeline

## Critical Context

**INCOMPLETE IMPLEMENTATION:** Phase 3 is only 33% complete, causing asymmetric message bus architecture.

**STRATEGIC PRIORITY:** Complete Phase 3 before other work (2.5 hour effort).

## Your Task

Create a detailed implementation plan for:

**{{OBJECTIVE}}**

## Planning Constraints

### 1. Phase 3 Completion Priority

If your objective relates to:
- Agent task reception
- Orchestrator task dispatch
- Message bus issues
- E2E workflow failures
- AgentDispatcherService

**YOU MUST** prioritize Phase 3 completion first:

```
Phase 3 Checklist (2.5 hours):
□ Agent Container Integration (30 min)
  - Wire OrchestratorContainer into each agent
  - Inject messageBus via constructor

□ Agent Task Subscription (45 min)
  - Subscribe via messageBus.subscribe()
  - Add stream consumer groups
  - Remove raw redis.subscribe()

□ Orchestrator Task Publishing (30 min)
  - Publish via messageBus.publish()
  - Add stream mirroring for tasks
  - Remove AgentDispatcherService calls

□ AgentDispatcherService Removal (15 min)
  - Delete from server.ts
  - Remove from WorkflowService

□ Diagnostic Logging (15 min)
  - Add Phase 3 log markers
  - Track message flow
```

### 2. Architectural Principles

Your plan MUST:
- ✅ Create symmetric message bus (both directions identical)
- ✅ Use dependency injection via containers
- ✅ Follow existing patterns in result path
- ✅ Remove all AgentDispatcherService references
- ✅ Use Redis Streams + Pub/Sub for all messaging
- ❌ NOT create temporary workarounds
- ❌ NOT skip E2E validation
- ❌ NOT implement phases partially

### 3. Required Plan Structure

Your plan must include:

#### Part 1: Gap Analysis
- Current state vs. target state
- Which Phase 3 items are incomplete
- Impact on system functionality

#### Part 2: File-by-File Changes

For each file:
```
File: path/to/file.ts
Purpose: What this change achieves
Changes:
  1. Specific change with line numbers if known
  2. Next specific change
Dependencies: What must be done first
Test Impact: Which tests verify this change
```

**Critical Files:**
- `packages/agents/base-agent/src/base-agent.ts`
- `packages/agents/scaffold-agent/src/run-agent.ts`
- `packages/agents/validation-agent/src/run-agent.ts`
- `packages/agents/e2e-agent/src/run-agent.ts`
- `packages/agents/integration-agent/src/run-agent.ts`
- `packages/agents/deployment-agent/src/run-agent.ts`
- `packages/orchestrator/src/services/workflow.service.ts`
- `packages/orchestrator/src/server.ts`

#### Part 3: Implementation Sequence

Number the steps with time estimates:
```
1. [30min] Agent container integration
2. [45min] Agent task subscription
3. [30min] Orchestrator task publishing
4. [15min] AgentDispatcherService removal
5. [15min] Diagnostic logging
6. [30min] Testing and validation
```

#### Part 4: Validation Strategy

**CRITICAL:** Define both unit AND E2E validation:

```
Unit Tests:
- Which test files to run
- Expected changes to test results

E2E Tests:
- Real workflow test command
- Success criteria
- How to detect the fix worked
```

#### Part 5: Rollback Plan

What to do if implementation fails:
- Safe rollback points
- How to detect failure early
- Recovery strategy

### 4. Test Strategy Requirements

Your plan MUST include E2E validation:

```bash
# Real pipeline test (REQUIRED)
./scripts/run-pipeline-test.sh "Hello World API"

# Expected outcome:
✅ Workflow completes all stages
✅ No hangs at initialization
✅ All agents receive and process tasks
✅ Results flow back to orchestrator
```

**Unit tests alone are NOT sufficient** - they pass even when system is broken.

### 5. Anti-Patterns to Avoid

Your plan must NOT include:
- ❌ Keeping AgentDispatcherService "for now"
- ❌ "Temporary" dual-path solutions
- ❌ Skipping E2E tests until "later"
- ❌ Implementing only one direction of message flow
- ❌ Relying solely on mocked unit tests

### 6. Documentation Requirements

Plan must include updates to:
- [ ] CLAUDE.md (mark Phase 3 complete)
- [ ] PHASE-1-6-IMPLEMENTATION-ANALYSIS.md (update status)
- [ ] Session notes documenting completion

## Reference Documents

Review before planning:
1. **PHASE-1-6-IMPLEMENTATION-ANALYSIS.md** - What's missing
2. **STRATEGIC-IMPLEMENTATION-ROADMAP.md** - Original Phase 3 spec
3. **CODE-CHANGES-DETAILED.md** - What was already done

## Output Format

**REQUIRED:** Create a markdown file documenting your implementation plan.

**File naming convention:** `[topic]-plan.md`
- Example: `phase3-plan.md`, `message-bus-plan.md`, `e2e-fix-plan.md`

**File location:** Project root or `docs/` directory

**File contents:**

```markdown
# Implementation Plan: [OBJECTIVE]

**Date:** [Current date]
**Planner:** Claude Code (Session #X)
**Estimated Time:** [Total hours]
**Risk Level:** [Critical/High/Medium/Low]

---

## Executive Summary

- **Current State:** [Brief description]
- **Target State:** [What we want to achieve]
- **Key Changes:** [Major modifications required]
- **Dependencies:** [What must be in place first]

## Gap Analysis

[Detailed current vs target state with specifics]

### What's Missing
- [ ] Item 1
- [ ] Item 2
- [ ] Item 3

### What's Incomplete
- [ ] Item 1
- [ ] Item 2

## Implementation Steps

### Step 1: [Name] (Time estimate)

**File:** `path/to/file.ts`

**Purpose:** What this achieves

**Changes:**
1. Specific change at line X
2. Next specific change

**Dependencies:** What must be done first

**Test Impact:** Which tests verify this

---

### Step 2: [Name] (Time estimate)

[Repeat pattern]

---

## Implementation Sequence

1. **[30min]** Step 1 description
2. **[45min]** Step 2 description
3. **[30min]** Step 3 description
4. **[15min]** Step 4 description
5. **[30min]** Testing and validation

**Total Time:** [Sum] hours

## Test Strategy

### Unit Tests
- Test files to run: [List]
- Expected changes: [What should change]

### E2E Tests
```bash
# Critical validation
./scripts/run-pipeline-test.sh "Test prompt"

# Success criteria:
✅ Workflow completes all stages
✅ No hangs at initialization
✅ All agents receive tasks
```

### Integration Tests
- [Which integration tests to run]

## Success Criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] E2E pipeline test passes
- [ ] Unit tests remain 100%
- [ ] No regressions

## Rollback Plan

**If implementation fails:**
1. Rollback point: [Git commit or step]
2. Detection method: [How to know it failed]
3. Recovery steps: [What to do]

## Documentation Updates

- [ ] Update CLAUDE.md
- [ ] Update [relevant doc]
- [ ] Add session notes

---

**Plan Approval Required:** User must approve before proceeding to `/code`
```

After creating the file, provide a concise summary to the user with:
1. Link to the detailed plan file
2. Time estimate and risk level
3. Request for approval before proceeding to `/code`

## Success Criteria

Your plan is complete when:
1. ✅ All Phase 3 gaps are addressed
2. ✅ File-by-file changes are specified
3. ✅ E2E test validation is included
4. ✅ Time estimates are realistic
5. ✅ No temporary workarounds
6. ✅ Symmetric architecture achieved
7. ✅ Rollback strategy defined

## Next Step

After plan approval, use `/code` command to implement.
