# Implementation Plan: Unbounded Agent Extensibility (Any BaseAgent Subclass)

**Status:** PLAN PHASE COMPLETE
**Updated:** 2025-11-19
**Priority:** HIGH (Enables core architecture goal)
**Owner:** AI Agent

---

## 📋 Overview

### Objective
Enable platforms to use **any custom agent that extends BaseAgent**, not limited to a predefined enum of agent types. This implements the core goal: "Platforms can have one or more workflows with any agent that extends BaseAgent."

### Why It's Needed
1. **Core Architecture Goal**: Must support arbitrary custom agents
2. **Extensibility**: Teams build domain-specific agents without core code changes
3. **Multi-Platform Support**: Different platforms use different implementations
4. **Future-Proof**: New agent types don't require schema migrations

### Success Criteria
- [ ] `agent_type` accepts arbitrary strings in WorkflowStageDefinition
- [ ] Agent registry resolves unknown types with clear error messages
- [ ] Stage execution validates agent exists BEFORE task assignment
- [ ] Backward compatible with existing enum-based agents
- [ ] Complete documentation + working examples
- [ ] Zero TypeScript errors across all packages
- [ ] E2E test validates custom agent in pipeline
- [ ] CLAUDE.md updated with agent creation guide

---

## 🏗️ Technical Approach

### Current State vs Target

```
BEFORE (Restricted):
  agent_type: 'scaffold' | 'validation' | 'e2e_test'  (ENUM only)
  ✗ Can't use custom agents without modifying core types
  ✗ Type validation fails at compile-time

AFTER (Unbounded):
  agent_type: string (ANY value allowed)
  ✓ Any custom agent can be registered immediately
  ✓ Validation happens at execution time (fail-early)
  ✓ Clear error messages guide user
```

### Component Changes

```
SHARED TYPES (@agentic-sdlc/shared-types):
  - Remove AgentType enum
  - Change agent_type: AgentType → agent_type: string
  - Add AgentTypeSchema for validation

AGENT REGISTRY (@agentic-sdlc/shared-agent-registry):
  - Add validateAgentExists(type, platformId) method
  - Improve getAgent() error messages with suggestions

ORCHESTRATOR (@agentic-sdlc/orchestrator):
  - Validate agent exists BEFORE creating AgentTask (Task 2.1)
  - Add CLI commands: validate-workflow, list-agents
  - Update WorkflowDefinition queries (already string-based)

DOCUMENTATION:
  - Create AGENT_CREATION_GUIDE.md
  - Update CLAUDE.md with agent section
  - Create example custom agent (MLTrainingAgent)

BACKWARD COMPATIBLE:
  ✓ No database migrations (Agent.type already string)
  ✓ Existing enum values work as strings
  ✓ No code changes needed for existing workflows
```

---

## 🎯 Task Breakdown (32 hours total)

### Phase 1: Type System Updates (6 hours)

**Task 1.1:** Update Type Definitions (1.5h)
- File: `packages/shared/types/src/agents/agent-types.ts`
- Change: `agent_type: AgentType` → `agent_type: z.string().min(1)`
- Tests: String validation, backward compat with enum values

**Task 1.2:** Update Agent Registry Types (1.5h)
- File: `packages/shared/agent-registry/src/agent-registry.ts`
- Add: `validateAgentExists(type: string, platformId?): boolean`
- Tests: Platform-scoped lookup, global fallback, error messages

**Task 1.3:** Create Agent Type Constants (1h)
- File: `packages/shared/types/src/constants/agent-types.constants.ts` (NEW)
- Content: Built-in types reference + naming conventions
- Tests: Constants match implementations

---

### Phase 2: Orchestrator Validation (8 hours)

**Task 2.1:** Add Agent Validation in WorkflowService (2h) **[CRITICAL]**
- File: `packages/orchestrator/src/services/workflow.service.ts`
- Change: In `createTaskForStage()`, add validation BEFORE AgentTask creation
- Effect: Prevents orphaned tasks in queue
- Tests: Valid/invalid agent_type, workflow status updates, logging

**Task 2.2:** Update WorkflowDefinition Queries (1.5h)
- File: `packages/orchestrator/src/repositories/workflow-definition.repository.ts`
- Change: Remove enum validations, verify Prisma handles strings
- Tests: Arbitrary agent_type strings work in queries

**Task 2.3:** Add CLI Validation Commands (2h)
- New Files:
  - `validate-workflow.command.ts` - Check definition for missing agents
  - `list-agents.command.ts` - Show available agents per platform
- Commands:
  ```bash
  agentic validate-workflow <file>
  agentic list-agents [--platform <id>]
  ```

**Task 2.4:** Error Recovery & Logging (1.5h)
- File: `packages/orchestrator/src/services/workflow.service.ts`
- Add: Typo detection with string similarity
- Improve: Error messages with suggestions ("Did you mean...")
- Add: Structured logging for debugging

**Task 2.5:** Validation Before Task Creation (1h)
- Ensure validation happens in right place in flow
- Verify error prevents AgentTask persistence

---

### Phase 3: Documentation (6 hours)

**Task 3.1:** Create Agent Creation Guide (2h)
- File: `AGENT_CREATION_GUIDE.md` (NEW)
- Content:
  - Quick start (5 steps)
  - Complete working example
  - Registration patterns (global + platform-scoped)
  - Testing custom agents
  - Common patterns & best practices
  - Naming conventions
  - Troubleshooting guide

**Task 3.2:** Update CLAUDE.md (1.5h)
- Add "Custom Agents" section to quick start
- Update architecture section with agent flexibility
- Add CLI commands reference
- Link to AGENT_CREATION_GUIDE.md

**Task 3.3:** Create Example Custom Agent (2.5h)
- Package: `@agentic-sdlc/example-agents` (NEW)
- Agent: `MLTrainingAgent extends BaseAgent`
- Content:
  - Complete implementation with comments
  - Unit tests (testing patterns)
  - Integration tests (envelope structure)
  - Documentation

---

### Phase 4: Testing & Validation (8 hours)

**Task 4.1:** Unit Tests - Type System (1.5h)
- Package: `@agentic-sdlc/shared-types`
- Coverage:
  - AgentTypeSchema accepts arbitrary strings
  - Existing enum values still work
  - WorkflowStageDefinition validates correctly

**Task 4.2:** Unit Tests - Agent Registry (1.5h)
- Package: `@agentic-sdlc/shared-agent-registry`
- Coverage:
  - validateAgentExists with various scenarios
  - Platform-scoped vs global lookup
  - Error messages helpful

**Task 4.3:** Integration Tests - WorkflowService (2h)
- Package: `@agentic-sdlc/orchestrator`
- Coverage:
  - Valid agent_type creates task ✓
  - Invalid agent_type fails BEFORE persistence ✓
  - Workflow status updated to 'failed' ✓
  - Platform-scoped validation works ✓

**Task 4.4:** E2E Pipeline Test - Custom Agent (2h) **[CRITICAL]**
- Test: Full workflow with custom agent
- Steps:
  1. Register MLTrainingAgent
  2. Create workflow definition with custom agent_type
  3. Execute workflow through all stages
  4. Verify custom agent executed
  5. Check results in stage_outputs

**Task 4.5:** Build Validation (1h)
- Run: `turbo run build && turbo run typecheck && turbo run test && turbo run lint`
- Result: Zero errors, all tests pass

---

### Phase 5: Final Documentation (4 hours)

**Task 5.1:** Update Architecture Docs (1.5h)
- Files: `STRATEGIC-ARCHITECTURE.md`, `AGENTIC_SDLC_RUNBOOK.md`
- Add: Agent extensibility section, troubleshooting, monitoring

**Task 5.2:** CLAUDE.md Final Update (1.5h)
- Verify all sections accurate
- Ensure all examples work
- Final review

**Task 5.3:** API Documentation (1h)
- File: `packages/orchestrator/API.md`
- Add: Error codes, examples, custom agent scenarios

---

## ⚠️ Risk Assessment

| Risk | Prob | Impact | Mitigation |
|------|------|--------|-----------|
| Type safety loss | LOW | MED | Unit tests, strict mode, linter |
| Backward compat breaks | VERY LOW | HIGH | Enum values ARE strings, no migration |
| Agent not found at runtime | MED | MED | **Validate BEFORE task creation (2.1)** |
| Custom agents misbehave | MED | MED | BaseAgent contract, envelope validation |
| Documentation unclear | MED | MED | Comprehensive guide + examples |
| Performance impact | LOW | LOW | Registry is O(1) in-memory |

### Critical Mitigations
1. **Task 2.1** - Validation BEFORE persistence prevents orphaned tasks
2. **Task 4.3** - Integration tests verify behavior
3. **Task 4.4** - E2E test validates full custom agent flow
4. **Task 3.1** - Documentation prevents confusion

---

## ✅ Testing Strategy

### Unit Tests (Vitest)
```bash
turbo run test --filter='@agentic-sdlc/shared-types'
turbo run test --filter='@agentic-sdlc/shared-agent-registry'
turbo run test --filter='@agentic-sdlc/orchestrator'
```
- Target Coverage: 85%+ | Effort: 2h

### Integration Tests
```bash
turbo run test  # All integration tests
```
- Target Coverage: 80%+ | Effort: 3.5h

### E2E Pipeline Test
```bash
./dev start
./scripts/run-pipeline-test.sh "Custom Agent E2E"
./dev stop
```
- Validates: Custom agent registration & execution | Effort: 2h

### Build Validation
```bash
turbo run build && turbo run typecheck && turbo run lint
```
- Result: Zero errors, all tests pass | Effort: 1h

---

## 📊 Dependencies

**Critical Path:** 1.1 → 1.2 → 2.1 → 4.3 → 4.4 → 4.5 (24 hours)

**Parallel Opportunities:**
- Phase 1 tasks (all parallel)
- Phase 2 tasks (after Phase 1)
- Phase 3 tasks (can overlap Phase 2)
- Phase 4 tasks (staggered by dependencies)

**Build Order:** shared-types → agent-registry → orchestrator → agents

---

## 📝 Implementation Sequence

**Week 1 - Foundation:**
- Day 1-2: Phase 1 (Type system) - 6 hours
- Day 2-3: Phase 2.1-2.2 (Validation & queries) - 3.5 hours
- Day 3-4: Phase 2.3-2.4 (CLI & logging) - 3.5 hours
- Day 4-5: Phase 4.1-4.2 (Unit tests) - 3 hours

**Week 2 - Documentation & Validation:**
- Day 1-2: Phase 3.1-3.2 (Guides) - 3.5 hours
- Day 2-3: Phase 3.3 (Example agent) - 2.5 hours
- Day 3-4: Phase 4.3-4.4 (Integration & E2E) - 4 hours
- Day 4-5: Phase 4.5, 5.1-5.3 (Build & final docs) - 4 hours

**Total: 32 hours (4 working days)**

---

## 🎯 Success Criteria (Checklist)

### Code Changes
- [ ] All type definitions updated (Phase 1)
- [ ] Validation logic in place (Task 2.1)
- [ ] CLI commands working (Task 2.3)
- [ ] Zero TypeScript errors
- [ ] Full build succeeds

### Testing
- [ ] All unit tests pass (85%+ coverage)
- [ ] All integration tests pass (80%+ coverage)
- [ ] E2E pipeline test passes with custom agent
- [ ] No regressions in existing workflows

### Documentation
- [ ] AGENT_CREATION_GUIDE.md complete
- [ ] CLAUDE.md updated with agent section
- [ ] Example agent (MLTrainingAgent) working
- [ ] API documentation updated
- [ ] All examples compile and run

### Backward Compatibility
- [ ] Existing enum-based agents work
- [ ] Existing workflow definitions unchanged
- [ ] No database migrations needed
- [ ] No breaking API changes

### User Experience
- [ ] Helpful error messages for missing agents
- [ ] CLI commands guide users effectively
- [ ] Documentation clear and comprehensive
- [ ] Examples show patterns clearly

---

## 📋 Files Affected Summary

```
SHARED TYPES (5 files):
  agent-types.ts (MODIFY)
  workflow-definition-schema.ts (MODIFY)
  agent-metadata.ts (MODIFY)
  agent-types.constants.ts (NEW)
  agent-envelope.ts (NO CHANGE - already flexible)

AGENT REGISTRY (2 files):
  agent-registry.ts (MODIFY)
  agent-metadata.ts (MODIFY)

ORCHESTRATOR (5 files):
  workflow.service.ts (MODIFY - ADD VALIDATION)
  workflow-definition.repository.ts (VERIFY)
  validate-workflow.command.ts (NEW)
  list-agents.command.ts (NEW)
  workflow-state-machine.ts (NO CHANGE)

DOCUMENTATION (5 files):
  AGENT_CREATION_GUIDE.md (NEW)
  CLAUDE.md (UPDATE)
  STRATEGIC-ARCHITECTURE.md (UPDATE)
  AGENTIC_SDLC_RUNBOOK.md (UPDATE)
  API.md (UPDATE)

EXAMPLES (NEW PACKAGE):
  @agentic-sdlc/example-agents/
    ml-training.agent.ts
    ml-training.test.ts
    README.md

TESTS (Multiple new test files):
  agent-types.test.ts
  workflow-definition-schema.test.ts
  agent-registry.test.ts
  workflow.service.test.ts (update)
  e2e-custom-agent.test.ts (NEW)
```

---

## ✨ Conclusion

This plan implements the core goal: **"Platforms can have one or more workflows with any agent that extends BaseAgent."**

**Approach:**
- Low Risk: Backward compatible, no database changes
- Well-Tested: Comprehensive unit, integration, E2E tests
- Well-Documented: Complete guide + working examples
- User-Friendly: Clear error messages + helpful CLI

**Estimated Effort:** 32 hours (4 working days)

---

**Status:** ✅ PLAN PHASE COMPLETE - READY FOR CODE PHASE

**Next Step:** `/epcc:epcc-code "Implement unbounded agent extensibility"`
