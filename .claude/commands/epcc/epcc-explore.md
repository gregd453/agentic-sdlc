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

All implementation will happen in the CODE phase. Use the following subagents in parallel for this explore phase:

## Parallel Exploration Subagents

IMPORTANT: Use the following subagents in parallel for this explore phase:
@code-archaeologist @system-designer @business-analyst @test-generator @documentation-agent

**Agent Instructions**: Each agent must ONLY explore and document findings. Save all implementation ideas for the CODE phase:
- @code-archaeologist: Analyze legacy code structure and uncover hidden patterns (NO CODING - only analysis)
- @system-designer: Identify design patterns and architectural conventions (NO IMPLEMENTATION - only observation)  
- @business-analyst: Map dependencies and process flows (NO CHANGES - only documentation)
- @test-generator: Explore existing tests and coverage gaps (NO TEST WRITING - only assessment)
- @documentation-agent: Review and analyze all documentation (NO NEW DOCS - only review)

Note: This is the first phase - findings will be documented in EPCC_EXPLORE.md for use in subsequent phases. Always check for CLAUDE.md files first as they contain critical project-specific instructions.


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

# Check individual package configurations
find packages -name "package.json" -exec echo {} \; -exec cat {} \;

# Document findings in EPCC_EXPLORE.md, do not create new files
```

### Step 4: Pattern Recognition
```bash
# This project uses Hexagonal Architecture (Ports & Adapters)
# Look for hexagonal architecture patterns
find packages/orchestrator/src/hexagonal -type f -name "*.ts"

# Check for architectural layers
ls -la packages/orchestrator/src/hexagonal/core/      # Domain logic
ls -la packages/orchestrator/src/hexagonal/ports/     # Interfaces
ls -la packages/orchestrator/src/hexagonal/adapters/  # Implementations
ls -la packages/orchestrator/src/hexagonal/orchestration/ # Orchestration

# Look for Service pattern (*.service.ts files)
find packages -name "*.service.ts" | head -20

# Check for message bus and pub/sub patterns
grep -r "messageBus" packages/orchestrator/src/ --include="*.ts" | head -10
grep -r "publish\|subscribe" packages/orchestrator/src/hexagonal/ --include="*.ts" | head -10

# Look for Agent patterns
find packages/agents -name "base-agent.ts" -o -name "*-agent.ts"

# Document patterns found in EPCC_EXPLORE.md
# DO NOT create new pattern implementations
```

### Step 5: Constraint Identification
- Performance requirements (latency, throughput)
- Security requirements (authentication, encryption)
- Compatibility requirements (browsers, platforms)
- Regulatory requirements (GDPR, HIPAA)
- Technical debt and limitations

### Step 6: Similar Implementation Search
```bash
# Find similar features or patterns in TypeScript
grep -r "authentication" packages/ --include="*.ts"
grep -r "similar_feature_name" packages/ --include="*.ts"

# Look for existing test patterns
find packages -name "*.test.ts" -o -name "*.spec.ts" | head -10

# Check environment setup scripts
ls -la scripts/env/
cat scripts/env/start-dev.sh  # How to start dev environment
cat scripts/env/stop-dev.sh   # How to stop dev environment

# Review E2E test patterns
cat scripts/run-pipeline-test.sh  # How E2E tests are run
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

- [ ] CLAUDE.md files reviewed and understood
- [ ] Project structure fully mapped
- [ ] All dependencies identified
- [ ] Coding patterns documented
- [ ] Similar implementations reviewed
- [ ] Constraints clearly understood
- [ ] Risks and challenges assessed
- [ ] Testing approach understood
- [ ] Deployment process reviewed
- [ ] Documentation reviewed
- [ ] Team conventions identified (including CLAUDE.md instructions)

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