---
name: epcc-explore
description: Explore phase of EPCC workflow - understand thoroughly before acting
version: 1.0.0
argument-hint: "[area-to-explore] [--deep|--quick]"
---

# EPCC Explore Command

You are in the **EXPLORE** phase of the Explore-Plan-Code-Commit workflow. Your mission is to understand thoroughly before taking any action.

⚠️ **IMPORTANT**: This phase is for EXPLORATION ONLY. Do NOT write any implementation code. Focus exclusively on:
- Reading and understanding existing code
- Analyzing patterns and architecture
- Identifying constraints and dependencies
- Documenting everything in EPCC_EXPLORE.md

All implementation will happen in the CODE phase.

## Exploration Strategy

This is an autonomous AI-driven SDLC platform built with TypeScript/Node.js. Focus your exploration on:
1. **CLAUDE.md first** - Contains critical platform state, architecture rules, and session history
2. **Monorepo structure** - pnpm workspaces with Turbo for build orchestration
3. **Hexagonal Architecture** - Core domain, Ports (interfaces), Adapters (implementations), Orchestration
4. **Message Bus** - Redis Streams for pub/sub and task distribution (packages/orchestrator/src/hexagonal/adapters/redis-bus.adapter.ts)
5. **AgentEnvelopeSchema v2.0.0** - All messages validated against this canonical schema
6. **Agent Pattern** - All agents extend BaseAgent from @agentic-sdlc/base-agent
7. **Platform Services** - 7 PM2 processes: orchestrator, scaffold/validation/integration/e2e/deployment agents, dashboard

Note: CLAUDE.md (Session #68) documents platform state at 98% production readiness.


## Exploration Focus
$ARGUMENTS

If no specific area was provided above, perform a general exploration of the entire codebase. If an area was specified, focus your exploration on that specific component, feature, or file.

## 🔍 Exploration Objectives

1. **Review Project Instructions**: Check for CLAUDE.md files with project-specific guidance
2. **Map the Territory**: Understand project structure and architecture
3. **Identify Patterns**: Find coding conventions and design patterns
4. **Discover Constraints**: Technical, business, and operational limitations
5. **Review Similar Code**: Find existing implementations to learn from
6. **Assess Complexity**: Understand the scope and difficulty

## Extended Thinking Strategy

- **Quick exploration**: Basic project overview
- **Deep dive**: Think about architectural decisions and patterns
- **Complex systems**: Think hard about interdependencies and side effects
- **Legacy code**: Ultrathink about historical context and migration paths


## Exploration Methodology

### Step 1: Review Project Instructions (CLAUDE.md)
```bash
# Check for CLAUDE.md files with project-specific instructions
# These files contain critical project conventions and requirements

# Check for project-level CLAUDE.md
if [ -f "CLAUDE.md" ]; then
    echo "Found project CLAUDE.md - reviewing project-specific instructions"
    cat CLAUDE.md
fi

# Check for .claude/CLAUDE.md
if [ -f ".claude/CLAUDE.md" ]; then
    echo "Found .claude/CLAUDE.md - reviewing additional instructions"
    cat .claude/CLAUDE.md
fi

# Check for user's global CLAUDE.md
if [ -f "~/.claude/CLAUDE.md" ]; then
    echo "Found global CLAUDE.md - reviewing user preferences"
    cat ~/.claude/CLAUDE.md
fi
```

### Step 2: Project Structure Analysis
```bash
# Get high-level overview
tree -L 3 -I 'node_modules|__pycache__|.git|dist|build'

# Identify key directories
ls -la src/ tests/ docs/ config/

# Find main entry points
grep -r "if __name__ == '__main__'" . --include="*.py"
grep -r "export default" . --include="*.js" --include="*.ts"
```

### Step 3: Technology Stack Discovery
```bash
# This is a TypeScript monorepo using pnpm workspaces and turbo
# Check for package files and workspace structure
cat package.json  # Root workspace config
cat turbo.json    # Turbo pipeline configuration
cat pnpm-workspace.yaml  # Workspace packages

# List all packages in monorepo
ls -la packages/

# Check PM2 ecosystem configuration
cat ecosystem.config.js  # PM2 process definitions for 7 services

# Review environment startup
cat scripts/env/start-dev.sh  # How to start all services
cat scripts/env/check-health.sh  # Health check endpoint

# Document findings in EPCC_EXPLORE.md, do not create new files
```

### Step 4: Pattern Recognition - Canonical Patterns
```bash
# This project uses Hexagonal Architecture (Ports & Adapters)
find packages/orchestrator/src/hexagonal -type f -name "*.ts"

# Check for architectural layers
ls -la packages/orchestrator/src/hexagonal/core/      # Domain logic
ls -la packages/orchestrator/src/hexagonal/ports/     # Interfaces
ls -la packages/orchestrator/src/hexagonal/adapters/  # Implementations
ls -la packages/orchestrator/src/hexagonal/orchestration/ # Orchestration

# CRITICAL: Message Bus Pattern (Redis Streams)
# This is THE canonical message bus - do NOT duplicate
cat packages/orchestrator/src/hexagonal/adapters/redis-bus.adapter.ts

# CRITICAL: Schema Validation (AgentEnvelopeSchema v2.0.0)
# This is THE canonical schema - imported from packages/shared/types
cat packages/shared/types/src/messages/agent-envelope.ts
grep -r "AgentEnvelopeSchema" packages/ --include="*.ts" | head -5

# Look for Service pattern (*.service.ts files)
find packages -name "*.service.ts" | head -10

# Look for Agent patterns - all extend BaseAgent
find packages/agents -name "*-agent.ts" -exec head -20 {} \;

# Check for dependency injection via OrchestratorContainer
grep -r "OrchestratorContainer" packages/ --include="*.ts" | head -5

# Document patterns found in EPCC_EXPLORE.md
# DO NOT create new pattern implementations or duplicate canonical files
```

### Step 5: Constraint Identification
- Performance requirements (latency, throughput)
- Security requirements (authentication, encryption)
- Compatibility requirements (browsers, platforms)
- Regulatory requirements (GDPR, HIPAA)
- Technical debt and limitations

### Step 6: Similar Implementation Search
```bash
# Find workflow examples in orchestrator
grep -r "WorkflowStateMachine\|buildAgentEnvelope\|publishWorkflow" packages/orchestrator/ --include="*.ts" | head -10

# Look for existing test patterns (Vitest)
find packages -name "*.test.ts" -o -name "*.spec.ts" | head -10

# Check agent implementations - these are the canonical examples
ls packages/agents/*/src/*-agent.ts
head -50 packages/agents/scaffold-agent/src/scaffold-agent.ts  # Template agent implementation

# Review E2E test execution
cat scripts/run-pipeline-test.sh  # How E2E tests validate workflows

# Check workflow state machine - critical for understanding flow
cat packages/orchestrator/src/state-machine/workflow-state-machine.ts

# Review distributed tracing patterns (session #60)
grep -r "trace_id\|WORKFLOW-TRACE\|AGENT-TRACE" packages/ --include="*.ts" | head -5
```

## Exploration Deliverables

### Output File: EPCC_EXPLORE.md

All exploration findings will be documented in `EPCC_EXPLORE.md` in the project root.

### 1. Exploration Report Structure
```markdown
# Exploration Report: [Feature/Area]

## Executive Summary
- Project type: Autonomous AI-driven SDLC System
- Primary language: TypeScript
- Architecture: Hexagonal (Ports & Adapters) + Message Bus + Agent-based
- Monorepo: pnpm workspaces with Turbo build system
- Current state: Active Development (Phase 3 complete, E2E validation in progress)

## Project Structure
```
agent-sdlc/
├── packages/
│   ├── orchestrator/          # Central orchestration service
│   │   └── src/
│   │       ├── hexagonal/     # Hexagonal architecture
│   │       │   ├── core/      # Domain logic
│   │       │   ├── ports/     # Interfaces
│   │       │   ├── adapters/  # Implementations
│   │       │   ├── orchestration/  # Orchestrators
│   │       │   └── persistence/    # State management
│   │       └── services/      # Application services
│   ├── agents/                # Agent packages
│   │   ├── base-agent/        # Base agent implementation
│   │   ├── scaffold-agent/    # Scaffolding agent
│   │   ├── validation-agent/  # Validation agent
│   │   └── e2e-agent/         # E2E testing agent
│   └── shared/                # Shared packages
│       ├── types/             # Shared TypeScript types
│       └── utils/             # Shared utilities
├── scripts/                   # Build, test, deployment scripts
│   ├── env/                   # Environment management
│   └── tests/                 # Test execution scripts
└── .claude/                   # Claude Code configuration
    └── commands/              # Custom slash commands
```

## Project Instructions (from CLAUDE.md)
- Key conventions: [Summarize from CLAUDE.md]
- Required practices: [List from CLAUDE.md]
- Specific tools: [Tools specified in CLAUDE.md]
- Custom workflows: [Any custom workflows defined]

## Key Components
1. **Component A**: Description and purpose
2. **Component B**: Description and purpose

## Patterns & Conventions
- Language: TypeScript with strict mode
- Architecture: Hexagonal (Ports & Adapters)
- Design patterns:
  - Dependency Injection via Container
  - Message Bus (pub/sub + streams)
  - Service layer pattern (*.service.ts)
  - Agent pattern (BaseAgent extended by specific agents)
- Testing: Vitest for unit/integration tests
- Build: Turbo for monorepo build orchestration
- Package manager: pnpm workspaces
- Naming: kebab-case for packages, PascalCase for classes, camelCase for functions

## Dependencies
### External
- Framework: version
- Library: version

### Internal
- Module A depends on Module B
- Service X requires Service Y

## Constraints & Limitations
- Technical: [List technical constraints]
- Business: [List business rules]
- Performance: [List performance requirements]

## Risks & Challenges
1. **Risk**: Description (Impact: High/Medium/Low)
2. **Challenge**: Description (Complexity: High/Medium/Low)

## Recommendations
- Suggested approach for implementation
- Areas requiring special attention
- Potential improvements identified
```

### 2. Codebase Map (included in EPCC_EXPLORE.md)
```json
{
  "structure": {
    "entry_points": ["src/main.py", "src/app.js"],
    "core_modules": ["auth", "database", "api"],
    "utilities": ["helpers", "validators", "formatters"],
    "tests": {
      "unit": "tests/unit",
      "integration": "tests/integration",
      "e2e": "tests/e2e"
    }
  },
  "metrics": {
    "total_files": 150,
    "lines_of_code": 10000,
    "test_coverage": "75%",
    "complexity": "moderate"
  },
  "dependencies": {
    "production": ["framework v1.0", "library v2.3"],
    "development": ["testing-lib v3.0", "linter v1.5"]
  }
}
```

## Exploration Checklist

Before proceeding to PLAN phase, ensure all findings are documented in `EPCC_EXPLORE.md`.

**REMINDER**: No code should be written during this phase. If you discover issues or have implementation ideas, document them in EPCC_EXPLORE.md for later phases:

- [ ] CLAUDE.md reviewed - current platform state at Session #68 (98% production ready)
- [ ] Architecture rules understood (Schema, Imports, Message Bus, DI)
- [ ] Monorepo structure mapped (orchestrator + 5 agents + shared packages)
- [ ] Hexagonal architecture layers identified (core/ports/adapters/orchestration)
- [ ] Redis Streams message bus pattern understood
- [ ] AgentEnvelopeSchema v2.0.0 canonical location verified
- [ ] BaseAgent pattern reviewed across all agent implementations
- [ ] PM2 process management understood (7 services)
- [ ] Workflow state machine logic reviewed
- [ ] Distributed tracing patterns (trace_id propagation) understood
- [ ] Testing approach with Vitest + E2E scripts understood
- [ ] Build process with Turbo and pnpm understood
- [ ] Constraints and risks from recent sessions identified

## Interactive Exploration Mode

```bash
# Start interactive exploration
/epcc-explore --interactive

# This will prompt:
1. What aspect to explore? [structure/patterns/dependencies/tests]
2. How deep? [quick/thorough/exhaustive]
3. Focus area? [backend/frontend/database/all]
```

## Common Exploration Patterns

### For New Features
1. Find similar existing features
2. Understand the current architecture
3. Identify integration points
4. Review relevant tests

### For Bug Fixes
1. Locate the problematic code
2. Understand the surrounding context
3. Find related code that might be affected
4. Review existing tests for the area

### For Refactoring
1. Map current implementation
2. Identify all dependencies
3. Find all usages
4. Understand test coverage

## Usage Examples

```bash
# Basic exploration
/epcc-explore

# Focused exploration
/epcc-explore --focus authentication
/epcc-explore --focus database --deep

# Specific file exploration
/epcc-explore --file src/auth/login.py

# Pattern search
/epcc-explore --patterns MVC,REST

# Dependency analysis
/epcc-explore --dependencies
```

## Integration with Next Phases

The exploration phase outputs in `EPCC_EXPLORE.md` feed directly into:
- **PLAN**: Use findings from EPCC_EXPLORE.md to create realistic plans
- **CODE**: Reference patterns and conventions documented in EPCC_EXPLORE.md
- **COMMIT**: Ensure consistency with project standards identified in EPCC_EXPLORE.md

## Final Output

Upon completion, generate `EPCC_EXPLORE.md` containing:
- Executive summary
- Project structure analysis
- Key components and patterns
- Dependencies and constraints
- Risks and recommendations
- Complete exploration checklist

Remember: **Time spent exploring saves time coding!**

🚫 **DO NOT**: Write code, create files, implement features, fix bugs, or modify anything
✅ **DO**: Read, analyze, understand, document findings, and save everything to EPCC_EXPLORE.md