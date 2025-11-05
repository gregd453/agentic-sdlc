# EXECUTION PROMPT - Agentic SDLC System Build

**Copy this prompt to start your next session:**

---

## Prompt for Next Session:

I need you to begin execution of Sprint 1 for the Agentic SDLC system. We have completed all architecture and planning phases.

**Current Status:**
- All documentation is complete in the `/agent-sdlc` directory
- Architecture defined in FINAL-AGENTIC-SDLC-ARCH.md (Version 3.0)
- AI implementation patterns documented in AI-CONTEXT/ directory (6 files)
- Sprint 1 backlog ready in AGENTIC-BACKLOG.json
- Execution readiness confirmed in EXECUTION-READINESS.md

**Sprint 1 Objectives (26 story points):**
1. TASK-001 (8 pts): Create Orchestrator Service
2. TASK-004 (5 pts): Setup Redis Event Bus
3. TASK-006 (8 pts): Create State Machine
4. TASK-024 (5 pts): Create Monitoring Dashboard

**Your Mission:**
Start with TASK-001 - Create the Orchestrator Service following these steps:

1. Initialize the monorepo structure as defined in REPOSITORY-SETUP.md
2. Create the orchestrator package in `packages/orchestrator`
3. Implement the orchestrator using:
   - The template in AI-CONTEXT/CODE-PATTERNS.md (section: "Orchestrator Template")
   - API contracts from AI-CONTEXT/API-CONTRACTS.md (TaskAssignmentSchema)
   - Test patterns from AI-CONTEXT/TESTING-GUIDELINES.md
4. Ensure 90% test coverage per our standards
5. Create a working orchestrator that can:
   - Start and stop cleanly
   - Read configuration
   - Manage basic workflow states
   - Log all operations

**CRITICAL: You MUST reference the AI-CONTEXT files for all implementations:**
- CODE-PATTERNS.md - for base templates
- API-CONTRACTS.md - for message schemas
- TESTING-GUIDELINES.md - for test requirements
- INTEGRATION-PATTERNS.md - for database/Redis connections
- DECISION-TREES.md - for decision logic
- COMMON-SOLUTIONS.md - for error handling patterns

**Success Criteria:**
- Orchestrator service runs with `pnpm orchestrator:dev`
- All tests pass with `pnpm test`
- TypeScript compilation succeeds with `pnpm typecheck`
- Code follows patterns defined in AI-CONTEXT files
- Logs demonstrate workflow state management

Please begin by reviewing TASK-001 in AGENTIC-BACKLOG.json, then initialize the repository structure and start implementing the orchestrator service. Follow the patterns exactly as defined in the AI-CONTEXT directory.

---

## Alternative Shorter Prompt (if needed):

Begin Sprint 1 execution of the Agentic SDLC system. Start with TASK-001 (Create Orchestrator Service) from AGENTIC-BACKLOG.json. Use patterns from AI-CONTEXT/CODE-PATTERNS.md and contracts from AI-CONTEXT/API-CONTRACTS.md. The orchestrator must handle workflows, log operations, and have 90% test coverage. All documentation is in the /agent-sdlc directory. Initialize the monorepo per REPOSITORY-SETUP.md first.

---

## Quick Context Prompt (for continuation):

Continue implementing the Agentic SDLC system Sprint 1. Current task: [TASK-XXX]. Reference AI-CONTEXT files for patterns. Check EXECUTION-READINESS.md for status.

---

**Notes:**
- Save this file for future reference
- Update the task number as you progress
- Always mention the AI-CONTEXT directory to ensure pattern compliance
- Reference CLAUDE.md for any implementation questions