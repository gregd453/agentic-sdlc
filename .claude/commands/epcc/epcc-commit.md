---
name: epcc-commit
description: Commit phase of EPCC workflow - finalize with confidence
version: 1.0.0
argument-hint: "[commit-message] [--amend|--squash]"
---

# EPCC Commit Command

You are in the **COMMIT** phase of the Explore-Plan-Code-Commit workflow. Finalize your work with a professional commit.

## Commit Context
$ARGUMENTS

If no commit message was provided above, I'll generate one based on the work documented in EPCC files.

## 📝 Commit Objectives

1. **Clear History**: Create meaningful commit messages
2. **Complete Documentation**: Ensure all docs are updated
3. **Clean Code**: No debug statements or TODOs
4. **Pass Checks**: All tests and linters passing
5. **Professional PR**: Ready for review

## Pre-Commit Verification for Agentic SDLC Platform

Before committing, you need to:
1. **Verify all tests pass** - Unit, integration, and E2E
2. **Build the platform** - Turbo build all packages
3. **Validate schema** - No /src/ imports, AgentEnvelopeSchema compliance
4. **Check PM2 services** - All 7 running, no errors
5. **Review CLAUDE.md** - Update with session accomplishments
6. **Write EPCC_COMMIT.md** - Document what was done

Reference:
- EPCC_PLAN.md - Original requirements
- EPCC_CODE.md - Implementation details
- EPCC_EXPLORE.md - Architecture findings

## Pre-Commit Checklist

### Code Quality
```bash
# Run all tests across monorepo
turbo run test

# Check code coverage (target: 85%+)
turbo run test:coverage

# Type checking (TypeScript)
turbo run typecheck

# Run linters
turbo run lint

# Build all packages (Shared → Orchestrator → Agents)
turbo run build

# Verify NO /src/ imports in compiled code
grep -r "from '@agentic-sdlc.*\/src\/" packages/*/dist/ && echo "ERROR: /src/ imports found" || echo "OK: No /src/ imports"

# Security scan for vulnerabilities
pnpm audit

# Remove debug code (keep trace logging, remove DEBUG-*)
grep -r "DEBUG-\|console\.log\|debugger" packages/ --include="*.ts" | grep -v WORKFLOW-TRACE | grep -v AGENT-TRACE

# Verify no build artifacts in git
git status --ignored
```

### Documentation Check
```bash
# Ensure EPCC files are complete and committed
ls -la EPCC_*.md  # Should have EXPLORE, PLAN, CODE, COMMIT

# CRITICAL: Update CLAUDE.md with session summary
# Include: what fixed, files changed, new platform state
cat CLAUDE.md

# Verify code has appropriate comments
grep -r "@param\|@returns\|@throws\|🔍 \[WORKFLOW-TRACE\]\|🔍 \[AGENT-TRACE\]" packages/orchestrator/src/ --include="*.ts" | head -10

# Check package.json exports correct (never expose /src/)
cat packages/shared/types/package.json | grep -A 5 '"exports"'

# Verify .claude/commands are current (update if platform changed significantly)
ls -la .claude/commands/
```

## Output File: EPCC_COMMIT.md

Generate `EPCC_COMMIT.md` to document the complete change:

```markdown
# Commit Summary

## Feature: [Feature Name]
## Date: [Current Date]
## Author: [Your Name]

## Changes Overview

### What Changed
- Brief description of changes
- Key files modified
- New functionality added

### Why It Changed
- Business requirement addressed
- Problem solved
- Value delivered

### How It Changed
- Technical approach taken
- Patterns applied
- Technologies used

## Files Changed
```
Modified:
  packages/orchestrator/src/hexagonal/ports/INewPort.ts          # New interface
  packages/orchestrator/src/hexagonal/adapters/NewAdapter.ts     # Implementation
  packages/orchestrator/src/services/new-feature.service.ts      # Service layer
  packages/orchestrator/src/state-machine/workflow-state-machine.ts # Routing if needed

Added:
  packages/orchestrator/src/hexagonal/__tests__/new-feature.test.ts  # Unit tests
  packages/agents/[agent-name]/src/[agent-name]-agent.ts            # If agent change

Updated:
  packages/orchestrator/package.json           # If dependencies added
  packages/agents/[agent-name]/package.json    # If agent dependencies changed
  packages/shared/types/src/messages/agent-envelope.ts  # ONLY if schema changed
  CLAUDE.md                                   # Session summary (CRITICAL)
  .claude/commands/                           # If platform patterns changed
```

Example CLAUDE.md update:
```markdown
### Session #XX: [Feature Name] ✅
**Problem:** [What was broken or missing]
**Root Cause:** [Why it happened]
**Fix:** [What was changed]
- Modified X files in hexagonal/{core/ports/adapters}
- Added message pattern for {topic}
- Updated {agent-name} to subscribe to {topic}
**Result:** {outcome} - E2E validated
**Files Modified:** {count} files across {package-count} packages
```
```

## Testing Summary
- Unit Tests (Vitest): ✅ All passing (X tests)
- Integration Tests (Vitest): ✅ All passing (X tests)
- E2E Tests (Pipeline): ✅ All passing (./scripts/run-pipeline-test.sh)
- TypeScript: ✅ No compilation errors (turbo run typecheck)
- Build: ✅ All packages built successfully (turbo run build)
- Linting: ✅ No issues (turbo run lint)
- Coverage: X% (target: 85%+)
- Health Checks: ✅ All 7 PM2 services healthy
- Schema Validation: ✅ AgentEnvelopeSchema v2.0.0 compliant

## Performance Impact
- Baseline: Xms
- After Change: Xms
- Impact: +/- X%

## Security Considerations
- [ ] Input validation implemented
- [ ] Authentication checked
- [ ] Authorization verified
- [ ] No sensitive data exposed
- [ ] Security scan passed

## Documentation Updates
- [x] Code comments added
- [x] API documentation updated
- [x] README.md updated
- [x] CHANGELOG.md entry added
- [x] EPCC documents completed

## Commit Message Template

```
[type]([package]): [brief description of change]

[Detailed explanation of what changed and why]

Hexagonal Architecture:
- Layer: [core/ports/adapters/orchestration]
- Files: [number affected]
- Impact: [what this changes about system behavior]

Message Bus Integration (if applicable):
- Topic: [publish/subscribe topic names]
- Schema: AgentEnvelopeSchema v2.0.0
- Pattern: [request-response, pub-sub, streaming]

Affected Packages:
- @agentic-sdlc/orchestrator (Y files changed)
- @agentic-sdlc/[agent-name] (Y files changed)
- @agentic-sdlc/shared-types (N files changed)

Testing:
- Unit tests: X added/modified
- Integration tests: Y added/modified
- E2E validation: ./scripts/run-pipeline-test.sh [scenario]

Validation:
- turbo run build ✅
- turbo run test ✅
- turbo run typecheck ✅
- Health checks: 7/7 services ✅
- ./scripts/env/check-health.sh ✅

Documentation:
- CLAUDE.md updated with session #XX summary
- EPCC_EXPLORE.md | EPCC_PLAN.md | EPCC_CODE.md | EPCC_COMMIT.md

Based on EPCC workflow:
- Exploration findings in EPCC_EXPLORE.md
- Plan details in EPCC_PLAN.md
- Implementation in EPCC_CODE.md

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>
```

Example for this platform:
```
feat(orchestrator): Add workflow state machine message routing

Routes workflow envelopes through agent pipeline based on stage metadata.
Implements pub/sub pattern for orchestrator→agent→orchestrator coordination.

Hexagonal Architecture:
- Layer: orchestration
- Files: workflow-state-machine.ts updated
- Impact: Central routing logic for all workflow messages

Message Bus Integration:
- Topics: workflow:*, agent:*:tasks, agent:*:results
- Schema: AgentEnvelopeSchema v2.0.0 with metadata.stage
- Pattern: Request-response with state transitions

Affected Packages:
- @agentic-sdlc/orchestrator (2 files changed)

Testing:
- Unit tests: 8 added
- Integration tests: 4 added
- E2E validation: ./scripts/run-pipeline-test.sh "Workflow Routing"

Validation:
- turbo run build ✅
- turbo run test ✅ (99% coverage)
- Health checks: 7/7 services ✅
```

## Pull Request Description

### Summary
[Brief description of changes]

### Changes Made
- Change 1
- Change 2
- Change 3

### Testing
- How to test the changes
- What to look for
- Edge cases covered

### Screenshots (if UI changes)
[Before/After screenshots]

### Related Issues
- Fixes #[issue]
- Relates to #[issue]

### Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No breaking changes
- [ ] Follows code style
- [ ] Security reviewed
```

## Commit Best Practices

### Commit Message Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation only
- **style**: Formatting, no code change
- **refactor**: Code change that neither fixes a bug nor adds a feature
- **perf**: Performance improvement
- **test**: Adding missing tests
- **chore**: Maintenance

### Good Commit Messages
```bash
# Good
git commit -m "feat: Add user authentication with JWT tokens

- Implement login/logout endpoints
- Add JWT token generation and validation
- Include refresh token mechanism
- Add comprehensive test coverage

Closes #123"

# Bad
git commit -m "Fixed stuff"
git commit -m "WIP"
git commit -m "Update code"
```

## Git Commands

### Stage Changes
```bash
# Review changes
git status
git diff

# Stage specific files
git add src/feature.js src/feature.test.js

# Or stage all
git add .

# Unstage if needed
git reset HEAD file.js
```

### Create Commit
```bash
# Commit with message
git commit -m "feat: Implement feature X"

# Commit with detailed message
git commit  # Opens editor for detailed message

# Amend last commit
git commit --amend

# Squash commits
git rebase -i HEAD~3
```

### Push Changes
```bash
# Push to feature branch
git push origin feature/branch-name

# Force push after rebase (careful!)
git push --force-with-lease origin feature/branch-name
```

## Creating the Pull Request

### PR Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## How Has This Been Tested?
- [ ] Unit tests
- [ ] Integration tests
- [ ] Manual testing

## Checklist
- [ ] My code follows the style guidelines
- [ ] I have performed a self-review
- [ ] I have commented my code where needed
- [ ] I have updated the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix/feature works
- [ ] New and existing unit tests pass locally
- [ ] Any dependent changes have been merged

## EPCC Documentation
- Exploration: [EPCC_EXPLORE.md](./EPCC_EXPLORE.md)
- Plan: [EPCC_PLAN.md](./EPCC_PLAN.md)
- Code: [EPCC_CODE.md](./EPCC_CODE.md)
- Commit: [EPCC_COMMIT.md](./EPCC_COMMIT.md)
```

## Post-Commit Actions

### After Committing
1. Push feature branch to remote
2. Create Pull Request with EPCC_COMMIT.md content as description
3. Request code review
4. Address review feedback
5. Merge to main when approved
6. Delete feature branch

### EPCC File Management
```bash
# IMPORTANT: Commit all EPCC files - they document the session
git add EPCC_*.md

# Commit with session documentation
git commit -m "docs(session-#XX): Add EPCC workflow documentation"

# Update CLAUDE.md before committing
# This is CRITICAL for tracking platform state across sessions
# Include: Problem → Root Cause → Fix → Result → Files Changed

# Example CLAUDE.md commit
git add CLAUDE.md
git commit -m "docs(session-#XX): Update CLAUDE.md with [feature] completion"

# Verify documentation is in history
git log --oneline | head -10  # Should show your commits
```

## Integration with CI/CD

### Automated Checks
```yaml
# .github/workflows/ci.yml (example for this monorepo)
- name: Install pnpm
  uses: pnpm/action-setup@v2
  with:
    version: 8

- name: Install dependencies
  run: pnpm install

- name: Type check
  run: turbo run typecheck

- name: Run tests
  run: turbo run test

- name: Check coverage
  run: turbo run test:coverage

- name: Lint code
  run: turbo run lint

- name: Build all packages
  run: turbo run build

- name: Security scan
  run: pnpm audit

- name: E2E tests
  run: |
    ./scripts/env/start-dev.sh
    ./scripts/run-pipeline-test.sh "CI Test"
    ./scripts/env/stop-dev.sh
```

## Final Output

Upon completion, ensure `EPCC_COMMIT.md` contains:
- Complete change summary
- All test results
- Performance metrics
- Security validations
- Final commit message
- PR description

Remember: **A good commit tells a story of why, what, and how!**