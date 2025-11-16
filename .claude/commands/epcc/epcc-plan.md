---
name: epcc-plan
description: Plan phase of EPCC workflow - strategic design before implementation
version: 1.0.0
argument-hint: "[feature-or-task-to-plan]"
---

# EPCC Plan Command

You are in the **PLAN** phase of the Explore-Plan-Code-Commit workflow. Transform exploration insights into actionable strategy.

⚠️ **IMPORTANT**: This phase is for PLANNING ONLY. Do NOT write any implementation code. Focus exclusively on:
- Creating detailed plans
- Breaking down tasks
- Assessing risks
- Documenting everything in EPCC_PLAN.md

All implementation will happen in the CODE phase.

## Planning Target
$ARGUMENTS

If no specific feature or task was provided above, ask the user: "What feature or task would you like to plan?"

## 📋 Planning Objectives

1. **Define Clear Goals**: What exactly are we building?
2. **Design the Approach**: How will we build it?
3. **Break Down Work**: What are the specific tasks?
4. **Assess Risks**: What could go wrong?
5. **Set Success Criteria**: How do we know we're done?

## Extended Thinking Strategy

- **Simple features**: Standard task breakdown
- **Complex features**: Think about edge cases and interactions
- **System changes**: Think hard about ripple effects
- **Architecture decisions**: Ultrathink about long-term implications

## Planning Context for This Platform

This is an autonomous AI-driven SDLC platform. Before planning, review:
- **EPCC_EXPLORE.md** - If exploration phase was completed, reference findings here
- **CLAUDE.md** - Current platform state and architecture rules (Session #68: 98% production ready)
- **Recent commits** - See git log for Session #67-68 patterns

Key platform facts:
- **Architecture**: Hexagonal (core/ports/adapters) + Message Bus (Redis Streams) + Agent-based
- **Canonical Files**: Never duplicate `agent-envelope.ts`, `redis-bus.adapter.ts`, `base-agent.ts`
- **Message Pattern**: All messages wrapped in AgentEnvelopeSchema v2.0.0
- **Build System**: Turbo monorepo with pnpm workspaces
- **Testing**: Vitest for unit/integration, E2E via `./scripts/run-pipeline-test.sh`
- **Deployment**: PM2 manages 7 services (orchestrator + agents + dashboard)

Note: Reference EPCC_EXPLORE.md findings if exploration was completed.

## Planning Framework

### Step 1: Define Objectives

```markdown
## Feature Objective

### What We're Building
[Clear, concise description]

### Why It's Needed
[Business value and user benefit]

### Success Criteria
- [ ] Criterion 1: Measurable outcome
- [ ] Criterion 2: Measurable outcome
- [ ] Criterion 3: Measurable outcome

### Non-Goals (What We're NOT Doing)
- Not implementing X (will be done later)
- Not changing Y (out of scope)
- Not optimizing Z (separate task)
```

### Step 2: Design the Approach

```markdown
## Technical Approach

### High-Level Architecture
```
[Component A] --> [Component B] --> [Component C]
     |                |                  |
     v                v                  v
[Database]      [Cache Layer]      [External API]
```

### Design Decisions
| Decision | Option Chosen | Rationale |
|----------|--------------|-----------|
| Database | PostgreSQL | Need ACID compliance |
| Caching | Redis | Fast, supports our data types |
| Auth | JWT | Stateless, scalable |

### Data Flow
1. User initiates request
2. System validates input
3. Process business logic
4. Update database
5. Return response
```

### Step 3: Task Breakdown for Agentic SDLC Platform

Break down tasks by these dimensions:

1. **Hexagonal layer**: Core domain, ports (interfaces), adapters (implementations), orchestration
2. **Package scope**: Which @agentic-sdlc/* package (orchestrator, base-agent, shared-types, specific agent)
3. **Message bus integration**: If task touches messaging, define publish/subscribe patterns
4. **Schema validation**: If task adds fields, verify AgentEnvelopeSchema v2.0.0 updates
5. **Agent coordination**: If multi-agent, define task routing and result aggregation
6. **Build dependencies**: Shared → Orchestrator → Agents (turbo execution order)
7. **Test coverage**: Unit (Vitest), Integration (Vitest with mocks), E2E (pipeline test)

Example task breakdown for this platform:
```typescript
// Document in EPCC_PLAN.md with platform-specific structure
const tasks = [
    {
        "id": "1",
        "content": "Define new port interface in hexagonal/ports/",
        "package": "@agentic-sdlc/orchestrator",
        "layer": "ports",
        "estimate": "1.5 hours",
        "dependencies": [],
        "testing": ["unit test for interface contract"],
        "priority": "high"
    },
    {
        "id": "2",
        "content": "Implement adapter in hexagonal/adapters/",
        "package": "@agentic-sdlc/orchestrator",
        "layer": "adapters",
        "estimate": "2.5 hours",
        "dependencies": ["1"],
        "testing": ["unit test with mock dependencies"],
        "priority": "high"
    },
    {
        "id": "3",
        "content": "Create service layer for orchestration",
        "package": "@agentic-sdlc/orchestrator",
        "layer": "services",
        "estimate": "2 hours",
        "dependencies": ["1", "2"],
        "messaging": "publishWorkflow('workflow:new', envelope) with Redis Streams",
        "testing": ["integration test with message bus mock"],
        "priority": "high"
    },
    {
        "id": "4",
        "content": "Update agent to subscribe and process",
        "package": "@agentic-sdlc/[agent-name]",
        "base_class": "extends BaseAgent from @agentic-sdlc/base-agent",
        "estimate": "2 hours",
        "dependencies": ["3"],
        "messaging": "subscribe('workflow:new') via messageBus.subscribe()",
        "testing": ["agent unit test + E2E via ./scripts/run-pipeline-test.sh"],
        "priority": "high"
    },
    {
        "id": "5",
        "content": "Validate schema and run full pipeline test",
        "package": "all",
        "estimate": "1.5 hours",
        "dependencies": ["4"],
        "validation": "AgentEnvelopeSchema v2.0.0, no /src/ imports, Turbo build successful",
        "testing": ["turbo run build && turbo run test && ./scripts/run-pipeline-test.sh"],
        "priority": "high"
    }
]
```

### Step 4: Risk Assessment

```markdown
## Risk Matrix

| Risk | Probability | Impact | Mitigation Strategy |
|------|------------|--------|-------------------|
| Database migration fails | Low | High | Create rollback script, test in staging |
| API rate limits exceeded | Medium | Medium | Implement caching, request batching |
| Performance degradation | Low | High | Load testing, monitoring, optimization plan |
| Security vulnerability | Low | Critical | Security review, penetration testing |
```

### Step 5: Test Strategy for Agentic SDLC Platform

```markdown
## Testing Plan

### Unit Tests (Vitest)
- [ ] Hexagonal layer tests (core/ports/adapters)
  - Core domain logic (hexagonal/core/)
  - Port interface contracts (hexagonal/ports/ - interface definitions)
  - Adapter implementations (hexagonal/adapters/ with mocked ports)
- [ ] Service layer tests (*.service.test.ts)
- [ ] Agent logic tests (agents/[name]/src/[name].test.ts)
- [ ] Utility and validator tests
- Run: `pnpm test` or `turbo run test`
- Command: `turbo run test --filter=@agentic-sdlc/[package]`
- Coverage target: 85%+

### Integration Tests (Vitest with Real Components)
- [ ] Message bus pub/sub tests (redis-bus.adapter behavior)
- [ ] Redis Streams tests (ACK timing, consumer groups)
- [ ] Workflow state machine tests (stage transitions)
- [ ] AgentEnvelopeSchema v2.0.0 validation tests
- [ ] Multi-agent communication tests (agent→orchestrator→agent)
- [ ] Trace ID propagation tests (distributed tracing)
- Run: `pnpm test` (integration tests in __tests__ directories)
- Coverage target: 80%

### End-to-End Pipeline Tests
- [ ] Full workflow lifecycle (scaffold → validate → integration → e2e)
- [ ] Multi-agent coordination (workflow creation through completion)
- [ ] Error handling and recovery
- [ ] React SPA code generation validation
- [ ] Message envelope integrity across services
- Run: `./scripts/run-pipeline-test.sh "Test Description"`
- Setup: `./scripts/env/start-dev.sh` (starts all 7 PM2 services)
- Teardown: `./scripts/env/stop-dev.sh`
- Coverage: All critical paths, ~30 min execution time

### Build Validation
- [ ] TypeScript compilation: `turbo run build`
- [ ] Type checking: `turbo run typecheck`
- [ ] Linting: `turbo run lint`
- [ ] All packages build in dependency order (Shared → Orchestrator → Agents)
- [ ] No /src/ imports in dist files (schema validation)
- [ ] Package index exports correct (from @agentic-sdlc/shared-types, etc.)

### Deployment Validation
- [ ] Health checks pass: `./scripts/env/check-health.sh`
- [ ] Dashboard accessible on port 3001
- [ ] All 7 PM2 processes running (pnpm pm2:status)
- [ ] No ERROR or CRITICAL logs (pnpm pm2:logs)

### Security Tests
- [ ] Message envelope validation (AgentEnvelopeSchema)
- [ ] No sensitive data in logs
- [ ] Input sanitization in orchestrator handlers
- [ ] Dependency audit: `pnpm audit`
```

## Planning Deliverables

### Output File: EPCC_PLAN.md

All planning documentation will be generated in `EPCC_PLAN.md` in the project root.

### 1. Implementation Plan Structure

```markdown
# Implementation Plan: [Feature Name]

## Overview
- **Objective**: [What we're building]
- **Timeline**: [Estimated duration]
- **Priority**: [High/Medium/Low]
- **Owner**: [Responsible party]

## Approach
[Detailed technical approach]

## Task Breakdown
1. [ ] Task 1 (2h) - Description
2. [ ] Task 2 (3h) - Description
3. [ ] Task 3 (4h) - Description

## Dependencies
- External: [List external dependencies]
- Internal: [List internal dependencies]
- Blockers: [List any blockers]

## Risks & Mitigations
[Risk assessment table]

## Success Metrics
- Performance: [Metrics]
- Quality: [Metrics]
- User satisfaction: [Metrics]

## Testing Strategy
[Test plan summary]

## Rollout Plan
- Phase 1: [Description]
- Phase 2: [Description]
- Rollback procedure: [Description]
```

### 2. Task List (included in EPCC_PLAN.md)

Tasks will be documented in EPCC_PLAN.md and can also be tracked via TodoWrite:

```bash
# Create task list
TodoWrite.create([
    "Database schema design",
    "API endpoint implementation",
    "Authentication setup",
    "Frontend integration",
    "Testing",
    "Documentation"
])
```

### 3. Technical Design  (included in EPCC_PLAN.md)

```markdown
# Technical Design: [Feature Name]

## Architecture
[Detailed architecture diagram and explanation]

## API Design
### Endpoints
- `POST /api/resource` - Create resource
- `GET /api/resource/:id` - Get resource
- `PUT /api/resource/:id` - Update resource
- `DELETE /api/resource/:id` - Delete resource

### Data Models
```json
{
  "resource": {
    "id": "uuid",
    "name": "string",
    "created_at": "timestamp",
    "updated_at": "timestamp"
  }
}
```

## Database Schema
```sql
CREATE TABLE resources (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

## Security Considerations
- Authentication: [Method]
- Authorization: [Method]
- Data validation: [Method]
- Encryption: [Method]
```

## Planning Best Practices

### DO:
- ✅ Break tasks into < 4 hour chunks
- ✅ Include testing in every task
- ✅ Consider which hexagonal layer (core/ports/adapters/orchestration)
- ✅ Specify affected packages (@agentic-sdlc/*)
- ✅ Plan for monorepo build order (shared → orchestrator → agents)
- ✅ Document design decisions
- ✅ Plan for message bus integration patterns
- ✅ Consider agent coordination requirements
- ✅ Include E2E validation step

### DON'T:
- ❌ Skip risk assessment
- ❌ Underestimate complexity
- ❌ Ignore package dependencies
- ❌ Plan without exploration
- ❌ Forget to update package.json dependencies
- ❌ Mix concerns across hexagonal layers
- ❌ Skip build validation steps

## Planning Checklist

Before proceeding to CODE phase, ensure all plans are documented in `EPCC_PLAN.md`.

**REMINDER**: No code should be written during this phase. If you're tempted to implement something, document it as a task instead:

- [ ] Objectives clearly defined (business value + success criteria)
- [ ] Approach thoroughly designed (hexagonal layers + message flow)
- [ ] Tasks broken down and estimated (platform-specific structure)
- [ ] Dependencies identified (package build order: shared → orchestrator → agents)
- [ ] Risks assessed and mitigated (especially schema/message bus impacts)
- [ ] Test strategy defined (unit + integration + E2E pipeline)
- [ ] Success criteria established (measurable outcomes)
- [ ] Message bus impact analyzed (publish/subscribe patterns if applicable)
- [ ] Schema changes planned (AgentEnvelopeSchema v2.0.0 updates if needed)
- [ ] Build validation planned (turbo build, no /src/ imports, all tests pass)
- [ ] E2E validation planned (./scripts/run-pipeline-test.sh scenarios)
- [ ] Documentation planned (CLAUDE.md updates, code comments)
- [ ] Deployment plan clear (PM2 process restart, health checks)
- [ ] Timeline realistic (include Turbo build + test execution time)

## Usage Examples

```bash
# Basic planning
/epcc-plan "Plan user authentication feature"

# Detailed planning with risk assessment
/epcc-plan --detailed --with-risks "Plan payment processing"

# Quick planning for small feature
/epcc-plan --quick "Plan UI tooltip addition"

# Planning with specific focus
/epcc-plan --focus backend "Plan API refactoring"
/epcc-plan --focus security "Plan security improvements"
```

## Integration with Other Phases

### From EXPLORE:
- Use exploration findings from `EPCC_EXPLORE.md`
- Reference identified patterns from exploration
- Consider discovered constraints

### To CODE:
- Provide clear task list in `EPCC_PLAN.md`
- Define acceptance criteria in plan document
- Specify test requirements

### To COMMIT:
- Reference `EPCC_PLAN.md` in commit message
- Update documentation
- Include plan details in PR description

## Final Output

Upon completion, generate `EPCC_PLAN.md` containing:
- Implementation overview and objectives
- Technical approach and architecture
- Complete task breakdown with estimates
- Risk assessment and mitigation strategies
- Testing strategy and success criteria
- Dependencies and timeline

Remember: **A good plan is half the implementation!**

🚫 **DO NOT**: Write code, create files, implement features, or fix bugs
✅ **DO**: Plan, document, design, assess risks, break down tasks, and save everything to EPCC_PLAN.md