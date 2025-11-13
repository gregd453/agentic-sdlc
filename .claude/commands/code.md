---
name: code.md
description: Implement planned changes with build and comprehensive test validation
tags: [implementation, testing, validation]
---

# Code Command - Agentic SDLC Pipeline

## Critical Context

**DANGER ZONE:** This system has 86/86 unit tests passing while E2E workflows are completely broken.

**VALIDATION REQUIREMENT:** You MUST run E2E tests, not just unit tests.

## Your Task

Implement the planned changes and validate thoroughly:

**{{IMPLEMENTATION_DETAILS}}**

## Implementation Protocol

### Phase 1: Pre-Flight Checks (5 min)

Before writing ANY code:

```bash
# 1. Verify clean build
npm run build

# 2. Verify unit test baseline
npm test

# 3. Check git status
git status

# 4. Verify infrastructure is running
docker ps | grep -E "(postgres|redis)"
```

All must pass before proceeding.

### Phase 2: Implementation (Time from Plan)

#### Critical Implementation Rules

1. **Follow the approved plan exactly**
   - No deviations without re-planning
   - Complete each step before moving to next
   - Check off each item as you go

2. **Maintain architectural symmetry**
   - If you change agent code, verify orchestrator matches
   - If you change task dispatch, verify result path consistency
   - Both message bus directions must be identical

3. **Use existing patterns**
   - Look at result path (Agent → Orchestrator) as reference
   - Copy the pattern for task path (Orchestrator → Agent)
   - Don't invent new patterns

4. **Preserve type safety**
   - All TypeScript strict mode enabled
   - No `any` types
   - No `@ts-ignore` comments
   - Maintain schema validation

#### File Implementation Checklist

For each file modified:
- [ ] Read entire file first
- [ ] Understand existing patterns
- [ ] Make changes incrementally
- [ ] Verify TypeScript compilation
- [ ] Add/update diagnostic logs
- [ ] Document changes inline if complex

### Phase 3: Build Verification (10 min)

After implementation, verify build:

```bash
# Clean build
npm run clean
npm run build

# Must succeed with ZERO errors
# Zero TypeScript errors
# Zero compilation errors
```

**If build fails:** Fix immediately before testing.

### Phase 4: Unit Test Validation (10 min)

Run affected unit tests:

```bash
# Full test suite
npm test

# Specific package tests
npm test -w @agent-orchestrator/workflow-service
npm test -w @agent-orchestrator/base-agent
npm test -w @agent-orchestrator/orchestrator

# Expected: ALL tests pass (maintain 100%)
```

**IMPORTANT:** Passing unit tests DO NOT mean the system works!

### Phase 5: E2E Test Validation (15 min) ⚠️ CRITICAL

**THIS IS THE REAL VALIDATION:**

```bash
# Start infrastructure if not running
docker-compose up -d postgres redis

# Wait for services
sleep 5

# Run the REAL pipeline test
./scripts/run-pipeline-test.sh "Hello World API"
```

#### E2E Success Criteria

The workflow must:
- ✅ Start and transition through states
- ✅ NOT hang at "initialization"
- ✅ Reach all 5 agents
- ✅ Complete all stages
- ✅ Return final result
- ✅ Complete within reasonable time (~2-3 min)

#### E2E Output Interpretation

**GOOD (Fixed):**
```
Creating workflow...
Workflow created: wf-xxx
Status: initialization
Status: executing
Status: executing (scaffold-agent)
Status: executing (validation-agent)
...
Status: completed
Final output: [result]
```

**BAD (Still Broken):**
```
Creating workflow...
Workflow created: wf-xxx
Status: initialization
Status: initialization
Status: initialization
[hangs forever]
```

### Phase 6: Integration Test Suite (10 min)

Run additional integration tests:

```bash
# Three-agent pipeline test
npm test -w @agent-orchestrator/orchestrator -- three-agent

# Five-agent pipeline test
npm test -w @agent-orchestrator/orchestrator -- five-agent

# Agent-specific tests
npm test -w @agent-orchestrator/scaffold-agent
npm test -w @agent-orchestrator/validation-agent
npm test -w @agent-orchestrator/e2e-agent
npm test -w @agent-orchestrator/integration-agent
npm test -w @agent-orchestrator/deployment-agent
```

All should pass.

### Phase 7: Diagnostic Log Analysis (5 min)

Check logs for Phase 3 markers:

```bash
# Search for diagnostic logs
grep -r "Phase 3" packages/agents/*/src/
grep -r "messageBus" packages/agents/*/src/
grep -r "AgentDispatcherService" packages/orchestrator/src/
```

**Expected:**
- ✅ "Phase 3" log markers present
- ✅ "messageBus.subscribe" in agents
- ✅ "messageBus.publish" in orchestrator
- ❌ NO "AgentDispatcherService" references

### Phase 8: Manual Validation (Optional, 5 min)

If E2E script test passes, optionally test via REST API:

```bash
# Start orchestrator
npm run dev -w @agent-orchestrator/orchestrator

# In another terminal, create workflow
curl -X POST http://localhost:3000/api/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "initialPrompt": "Create a simple Hello World API",
    "targetStage": "deployment"
  }'

# Check status
curl http://localhost:3000/api/workflows/{workflow-id}
```

Should complete successfully.

## Test Suite Reference

### Unit Tests (Expected: 86/86 pass)

| Package | Tests | Status |
|---------|-------|--------|
| workflow-service | 11 | ✅ Should pass |
| agent-dispatcher | 32 | ✅ Should pass |
| three-agent-pipeline | 21 | ✅ Should pass |
| five-agent-pipeline | 22 | ✅ Should pass |

### E2E Tests (Currently failing, must fix)

| Test | Command | Expected |
|------|---------|----------|
| Real Pipeline | `./scripts/run-pipeline-test.sh "prompt"` | ✅ Complete |
| REST API | Manual curl test | ✅ Complete |

### Critical Test Distinctions

**Unit Tests:**
- Use mocks and stubs
- Test individual components
- Pass even when system is broken ⚠️
- Fast (<1 min total)

**E2E Tests:**
- Use real infrastructure
- Test complete workflows
- Reveal integration issues ✅
- Slower (~3-5 min)

**YOU MUST RUN BOTH**, but E2E tests are the real validation.

## Validation Checklist

Before considering implementation complete:

- [ ] Code follows approved plan
- [ ] Build succeeds with zero errors
- [ ] All unit tests pass (86/86)
- [ ] **E2E pipeline test completes successfully** ⚠️
- [ ] Integration tests pass
- [ ] No AgentDispatcherService references remain
- [ ] Diagnostic logs show Phase 3 markers
- [ ] Message bus is symmetric (both directions)
- [ ] No workflow hangs at initialization
- [ ] All 5 agents receive tasks

## Output Format

**REQUIRED:** Create a markdown file documenting your implementation.

**File naming convention:** `[topic]-code.md`
- Example: `phase3-code.md`, `message-bus-code.md`, `e2e-fix-code.md`

**File location:** Project root or `docs/` directory

**File contents:**

```markdown
# Implementation Report: [TOPIC]

**Date:** [Current date]
**Implementer:** Claude Code (Session #X)
**Plan Reference:** [Link to plan file]

---

## Executive Summary

[Brief summary of what was implemented]

## Implementation Results

### Files Modified

| File | Changes | Status |
|------|---------|--------|
| path/to/file1.ts | Description | ✅ Complete |
| path/to/file2.ts | Description | ✅ Complete |

### Changes Details

#### File: `path/to/file1.ts`

**Changes made:**
- Change 1 at line X
- Change 2 at line Y

**Rationale:** Why these changes were necessary

---

#### File: `path/to/file2.ts`

[Repeat pattern]

---

## Validation Results

### Phase 1: Pre-Flight Checks ✅

```bash
npm run build    # ✅ Success
npm test         # ✅ Success
git status       # ✅ Clean
docker ps        # ✅ Services running
```

### Phase 2: Build Verification ✅

```bash
npm run clean && npm run build
# Result: [Success/Errors]
```

### Phase 3: Unit Test Results ✅

```
Total: 86/86 passing (100%)
- Workflow Service: 11/11 ✅
- Agent Dispatcher: 32/32 ✅
- Three-Agent Pipeline: 21/21 ✅
- Five-Agent Pipeline: 22/22 ✅
```

### Phase 4: E2E Test Results ⚠️ CRITICAL

```bash
./scripts/run-pipeline-test.sh "Hello World API"
```

**Result:** [✅ Success / ❌ Failed]

**Output:**
```
[Paste actual output]
```

**Analysis:** [What this tells us]

### Phase 5: Integration Test Results

```
[Test results]
```

### Phase 6: Diagnostic Log Analysis

**Phase 3 Markers Found:**
- [ ] messageBus.subscribe in agents
- [ ] messageBus.publish in orchestrator
- [ ] No AgentDispatcherService references

### Phase 7: Manual Validation (if performed)

[Optional manual test results]

## Issues Encountered

### Issue 1: [Description]
- **Problem:** [What went wrong]
- **Solution:** [How it was fixed]
- **Time Impact:** [Extra time required]

## Success Criteria Checklist

- [ ] All planned changes implemented
- [ ] Build passes cleanly
- [ ] Unit tests: 86/86 pass
- [ ] **E2E test: Workflow completes** ⚠️
- [ ] No regressions introduced
- [ ] Logs show correct behavior
- [ ] Code follows project patterns

## Next Steps

[If all validation passed, proceed to `/commit`]
[If issues remain, describe what needs fixing]

---

**Ready for Commit:** [Yes/No]
**Blockers:** [None / List blockers]
```

After creating the file, provide a concise summary to the user with:
1. Implementation status (complete/blocked)
2. Validation results (especially E2E test)
3. Path to detailed implementation report
4. Next steps (proceed to `/commit` or fix issues)

## Success Criteria

Implementation is complete when:

1. ✅ All planned changes implemented
2. ✅ Build passes cleanly
3. ✅ Unit tests: 86/86 pass
4. ✅ **E2E test: Workflow completes** (THIS IS KEY)
5. ✅ No regressions introduced
6. ✅ Logs show correct behavior
7. ✅ Code follows project patterns
8. ✅ Implementation report created

## Failure Modes & Recovery

### If Build Fails
- Review TypeScript errors
- Check for missing imports
- Verify schema compliance
- Fix before proceeding

### If Unit Tests Fail
- Identify broken tests
- Update test expectations if behavior changed correctly
- Fix implementation if logic is wrong
- Don't proceed until 100% pass

### If E2E Test Fails ⚠️
- **This is the critical test**
- Check orchestrator logs for task dispatch
- Check agent logs for task reception
- Verify messageBus connections
- Review implementation against plan
- May need to rollback and re-plan

### If E2E Test Hangs
- System is still broken
- Likely agents not receiving tasks
- Review Phase 3 completion checklist
- Check for missing container wiring
- Verify messageBus subscriptions

## Documentation Requirements

After successful validation:

```bash
# Update CLAUDE.md
# Mark Phase 3 as complete
# Update system status
# Document completion

# Create session summary
# Note what was implemented
# Record test results
# Document lessons learned
```

## Next Step

After successful validation with E2E tests passing, use `/commit` command.

**DO NOT COMMIT** if E2E tests are not passing.
