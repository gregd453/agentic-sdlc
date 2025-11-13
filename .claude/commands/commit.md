---
name: commit
description: Run final pipeline validation, commit changes, and push to repository
tags: [commit, validation, git]
---

# Commit Command - Agentic SDLC Pipeline

## Critical Context

**VALIDATION REQUIREMENT:** You must have successfully run E2E pipeline tests BEFORE committing.

**NO COMMIT** if E2E tests are failing or workflows hang.

## Pre-Commit Requirements

### 1. Validation Status Check

Verify ALL of these are true:

```bash
# 1. Build succeeds
npm run build
# ✅ Must complete with zero errors

# 2. Unit tests pass
npm test
# ✅ Must show 86/86 (or more) passing

# 3. E2E pipeline test passes ⚠️ CRITICAL
./scripts/run-pipeline-test.sh "Hello World API"
# ✅ Must complete all stages
# ✅ Must NOT hang at initialization
# ✅ Must return final result

# 4. No hanging workflows
# Check that test didn't timeout or stall
```

**If ANY of these fail, DO NOT PROCEED with commit.**

### 2. Implementation Completeness

Verify your implementation:

- [ ] All planned changes are complete
- [ ] No TODO comments left unresolved
- [ ] No debugging console.logs left in code
- [ ] Phase 3 completion markers in place (if applicable)
- [ ] No AgentDispatcherService references (if Phase 3)
- [ ] Symmetric message bus architecture (if Phase 3)

### 3. Code Quality Check

```bash
# Check for common issues
grep -r "console.log" packages/*/src/ | grep -v "logger"
# ✅ Should be minimal or none (except logger calls)

grep -r "TODO" packages/*/src/
# ✅ Verify all TODOs are intentional/documented

grep -r "@ts-ignore" packages/*/src/
# ✅ Should be zero

grep -r "any" packages/*/src/*.ts | grep -v "any[]"
# ✅ Should be minimal (check each)
```

### 4. Documentation Updated

Verify docs are current:

- [ ] CLAUDE.md updated with completion status
- [ ] Session summary added (if major changes)
- [ ] Phase completion marked (if applicable)
- [ ] Known issues documented (if any remain)

## Commit Process

### Step 1: Review Changes

```bash
# See what changed
git status

# Review diffs
git diff

# Check for unintended changes
# Verify no sensitive data
# Confirm all changes are intentional
```

### Step 2: Stage Changes

```bash
# Stage all changes (if all are intended)
git add .

# OR stage selectively
git add packages/agents/base-agent/src/
git add packages/orchestrator/src/
git add CLAUDE.md

# Verify staged changes
git status
```

### Step 3: Commit with Descriptive Message

**For Phase 3 Completion:**
```bash
git commit -m "feat: Complete Phase 3 - Symmetric Message Bus Architecture

- Agent container integration: All agents use OrchestratorContainer
- Agent task subscription: messageBus.subscribe() with stream consumer groups
- Orchestrator task publishing: messageBus.publish() with stream mirroring
- AgentDispatcherService removal: Fully removed from orchestrator
- Diagnostic logging: Phase 3 markers for debugging

This completes the symmetric message bus architecture where both
task dispatch (Orchestrator → Agent) and result reporting (Agent →
Orchestrator) use identical patterns via the message bus.

E2E Tests: ✅ Pipeline test completes successfully
Unit Tests: ✅ 86/86 passing (100%)
Build: ✅ All packages compile cleanly

Closes the critical gap identified in PHASE-1-6-IMPLEMENTATION-ANALYSIS.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

**For Other Features:**
```bash
git commit -m "feat: [Brief description]

[Detailed explanation of changes]
[What problem this solves]
[Any important implementation notes]

Tests: [Test status]
Build: [Build status]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

**For Bug Fixes:**
```bash
git commit -m "fix: [Brief description of bug fixed]

[What was broken]
[Root cause]
[How this fixes it]

Tests: [Test status]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Step 4: Final Validation (One More Time)

After commit, run validation again:

```bash
# Build from clean state
npm run clean && npm run build

# Run unit tests
npm test

# Run E2E test ONE MORE TIME
./scripts/run-pipeline-test.sh "Final validation test"
```

**If ANY test fails after commit:**
```bash
# Amend the commit with fix
git add .
git commit --amend --no-edit
```

### Step 5: Push to Remote

```bash
# Push to main (or feature branch)
git push origin main

# If pushing for first time on branch
git push -u origin feature-branch-name
```

## Post-Commit Verification

### 1. Verify Push Succeeded

```bash
# Check remote status
git status

# Should show: "Your branch is up to date with 'origin/main'"
```

### 2. GitHub Checks (if configured)

- [ ] CI/CD pipeline passes (if configured)
- [ ] No linting errors reported
- [ ] Build succeeds on CI

### 3. Documentation Sync

Ensure these are updated and committed:

```
✅ CLAUDE.md - Current status and session notes
✅ PHASE-1-6-IMPLEMENTATION-ANALYSIS.md - If Phase 3 related
✅ Session summary - In docs/ if major changes
```

## Success Criteria

Commit is successful when:

1. ✅ All pre-commit validations passed
2. ✅ E2E pipeline test completed successfully
3. ✅ Changes committed with clear message
4. ✅ Final validation passed
5. ✅ Pushed to remote repository
6. ✅ Documentation is current
7. ✅ No regressions introduced

## Commit Message Templates

### Template 1: Phase Completion
```
feat: Complete Phase N - [Phase Name]

[Detailed list of what was implemented]

Key Changes:
- Change 1
- Change 2
- Change 3

Tests: ✅ E2E pipeline test passes
Build: ✅ All packages compile
Unit Tests: ✅ X/X passing

[Any important notes]

🤖 Generated with [Claude Code](https://claude.com/claude-code)
Co-Authored-By: Claude <noreply@anthropic.com>
```

### Template 2: Bug Fix
```
fix: [Specific bug description]

Problem: [What was broken]
Cause: [Why it was broken]
Solution: [How this fixes it]

Affected Components:
- Component 1
- Component 2

Tests: ✅ Validation status
Build: ✅ Build status

🤖 Generated with [Claude Code](https://claude.com/claude-code)
Co-Authored-By: Claude <noreply@anthropic.com>
```

### Template 3: Feature Addition
```
feat: [Feature name]

Adds [what functionality]

Implementation:
- Detail 1
- Detail 2
- Detail 3

Tests: ✅ Test status
Build: ✅ Build status
E2E: ✅ Pipeline validation

🤖 Generated with [Claude Code](https://claude.com/claude-code)
Co-Authored-By: Claude <noreply@anthropic.com>
```

## Pipeline Test Commands Reference

### Full E2E Pipeline Test
```bash
./scripts/run-pipeline-test.sh "Test prompt"

# Expected output:
Creating workflow...
Workflow created: wf-xxx
Status: initialization
Status: executing
Status: executing (scaffold-agent)
Status: executing (validation-agent)
Status: executing (e2e-agent)
Status: executing (integration-agent)
Status: executing (deployment-agent)
Status: completed
Final output: [result]
```

### Individual Agent Tests
```bash
# Scaffold agent
npm test -w @agent-orchestrator/scaffold-agent

# Validation agent
npm test -w @agent-orchestrator/validation-agent

# E2E agent
npm test -w @agent-orchestrator/e2e-agent

# Integration agent
npm test -w @agent-orchestrator/integration-agent

# Deployment agent
npm test -w @agent-orchestrator/deployment-agent
```

### Integration Tests
```bash
# Three-agent pipeline
npm test -w @agent-orchestrator/orchestrator -- three-agent

# Five-agent pipeline
npm test -w @agent-orchestrator/orchestrator -- five-agent

# Workflow service
npm test -w @agent-orchestrator/workflow-service
```

### Full Test Suite
```bash
# All tests
npm test

# Specific package
npm test -w @agent-orchestrator/orchestrator

# With coverage
npm test -- --coverage
```

## What NOT to Commit

Prevent these from being committed:

- ❌ `.env` files with secrets
- ❌ `node_modules/`
- ❌ Build artifacts in `dist/`
- ❌ Log files
- ❌ IDE-specific files (`.vscode/`, `.idea/`)
- ❌ Temporary test data
- ❌ Debug console.logs
- ❌ Commented-out code blocks
- ❌ TODO comments without context

## Rollback Plan

If you discover issues after commit:

```bash
# Soft reset (keeps changes, uncommits)
git reset --soft HEAD~1

# Make fixes
# Re-run validation
# Commit again

# If already pushed, create fix commit
git commit -m "fix: Address issue in previous commit"
git push origin main
```

## Output Format

**REQUIRED:** Create a markdown file documenting your commit.

**File naming convention:** `[topic]-commit.md`
- Example: `phase3-commit.md`, `message-bus-commit.md`, `e2e-fix-commit.md`

**File location:** Project root or `docs/` directory

**File contents:**

```markdown
# Commit Report: [TOPIC]

**Date:** [Current date]
**Committer:** Claude Code (Session #X)
**Implementation Reference:** [Link to code file]

---

## Commit Details

**Commit Hash:** `[git hash]`
**Branch:** `[branch name]`
**Message:**
```
[Full commit message]
```

## Pre-Commit Validation ✅

### 1. Build Status
```bash
npm run build
# Result: ✅ Success
```

### 2. Unit Tests
```bash
npm test
# Result: ✅ 86/86 passing (100%)
```

### 3. E2E Pipeline Test ⚠️ CRITICAL
```bash
./scripts/run-pipeline-test.sh "Hello World API"
# Result: ✅ Workflow completed successfully
```

**Output:**
```
[Paste test output showing success]
```

### 4. Code Quality Checks

```bash
grep -r "console.log" packages/*/src/    # ✅ Clean
grep -r "TODO" packages/*/src/           # ✅ Documented
grep -r "@ts-ignore" packages/*/src/     # ✅ None
```

## Files Changed

| File | Type | Description |
|------|------|-------------|
| path/to/file1.ts | Modified | [Description] |
| path/to/file2.ts | Modified | [Description] |
| CLAUDE.md | Updated | Session #X notes |

**Total files changed:** [count]
**Insertions:** [+count]
**Deletions:** [-count]

## Post-Commit Validation ✅

### Final E2E Test
```bash
./scripts/run-pipeline-test.sh "Final validation"
# Result: ✅ Success
```

### Push Status
```bash
git push origin main
# Result: ✅ Pushed successfully
```

## Documentation Updates

- [x] CLAUDE.md updated with session notes
- [x] [Other doc] updated
- [x] Commit report created

## What Was Accomplished

### Summary
[Brief description of what was completed]

### Key Changes
- Change 1: [Description]
- Change 2: [Description]
- Change 3: [Description]

### Impact
- **Components affected:** [List]
- **Tests updated:** [Count]
- **Phase completion:** [If applicable]

## Lessons Learned

### What Went Well
- [Item 1]
- [Item 2]

### Challenges Faced
- [Challenge 1 and how it was overcome]

### For Future Sessions
- [Advice or notes]

## Next Steps

[What should happen next, if anything]

---

**Status:** ✅ Complete and Pushed
**E2E Validation:** ✅ Passing
**Production Ready:** [Yes/No]
```

After creating the file, provide a concise summary to the user with:
1. Commit hash and status
2. E2E test confirmation (passed/failed)
3. Path to detailed commit report
4. What was accomplished
5. Any next steps

## Next Steps After Commit

1. **Update Project Board** (if applicable)
   - Mark tasks as complete
   - Update phase status
   - Add session notes

2. **Communication** (if team project)
   - Notify team of completion
   - Share test results
   - Document any caveats

3. **Monitor** (if production)
   - Watch for issues
   - Check logs
   - Validate in staging/prod

## Critical Reminders

1. **E2E TEST MUST PASS** - This is non-negotiable
2. **No partial commits** - Complete the plan fully
3. **Documentation is part of the commit** - Update CLAUDE.md
4. **Test after commit** - Validate one more time
5. **Clear commit messages** - Future you will thank you

---

**Remember:** A commit is a promise that the code works. Make sure it does.
