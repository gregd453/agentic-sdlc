# Agent Result Schema & Flow Mapping - Complete Index

## Overview

This is a comprehensive mapping of the agent result schema system in the Agentic SDLC project. It documents:
1. Where schemas are defined
2. How agents construct results
3. How results flow through the system
4. What mismatches exist
5. Architecture and implementation details

Generated: November 12, 2025

## Documents Included

### 1. AGENT-RESULT-SCHEMA-MAP.md (19 KB) - Comprehensive Reference

**Purpose:** Complete technical reference for all schema definitions and implementations

**Contents:**
- Section 1: Authoritative Schema Definitions
  - AgentResultSchema (base, 13 fields)
  - Agent-specific schemas (Scaffold, Validation, Deployment, Integration)
  - Complete Zod schema definitions with all fields

- Section 2: Agent Result Construction
  - BaseAgent implementation (reportResult method)
  - TaskResult type definition
  - Agent-specific implementations (Scaffold, Validation)
  - Result publishing flow

- Section 3: Redis Message Bus Pattern
  - Channel names (AGENT_TASKS, ORCHESTRATOR_RESULTS)
  - Message flow diagram
  - Pub/Sub patterns

- Section 4: Orchestrator Result Consumption
  - AgentDispatcherService subscription setup
  - Result handler implementation
  - State machine integration
  - Event handling

- Section 5: Schema Mismatch Analysis
  - Comparison table (TaskResult vs AgentResultSchema)
  - Gap analysis (38.5% overlap, 60% mismatch)
  - Enumeration mismatches
  - Missing fields (8 total)

- Section 6: Message Publication Wrapper
  - Layer structure (Agent → TaskResult → AgentMessage → Redis)
  - Field access paths
  - Field transformations

- Section 7: Contracts Layer
  - Contract definitions
  - Validation status

- Section 8: Summary Flow
  - Complete data flow from task creation to completion
  - Timeline view

- Section 9: Key Files Reference
  - File locations and purposes
  - Line numbers

- Section 10: Recommendations
  - Schema alignment recommendations
  - Contract improvements
  - Observability enhancements

**Who should read:** Developers implementing schema changes, debugging result flow issues

### 2. AGENT-RESULT-ARCHITECTURE.md (31 KB) - Visual Architecture & Diagrams

**Purpose:** Visual representation of system architecture and data flow

**Contents:**
- Section 1: Schema Hierarchy
  - ASCII tree showing AgentResultSchema and agent-specific extensions
  - TaskResult comparison showing gaps

- Section 2: Message Flow Architecture
  - 3-phase complete flow (Task Dispatch → Agent Execution → Result Publication)
  - Detailed at each stage with actual JSON structures
  - Shows field additions at each layer

- Section 3: Schema Field Mapping
  - Transformation from agent output to orchestrator receipt
  - Field path tracking through layers
  - State machine event firing

- Section 4: Data Structure Comparison
  - AgentResultSchema vs TaskResult detailed comparison
  - Field-by-field breakdown
  - Summary statistics

- Section 5: Wrapper Layers
  - 4-layer visualization
  - Layer 1: Core Result
  - Layer 2: Published Message (AgentMessage wrapper)
  - Layer 3: Redis Transport
  - Layer 4: Received & Parsed
  - Access patterns for each layer

- Section 6: Data Flow Timing
  - Timeline from T0 to T5
  - What happens at each time point
  - Which systems are involved

- Section 7: Error Propagation
  - 3 error scenarios with flow diagrams
  - Agent execution failure
  - Schema validation failure
  - Task validation failure

- Section 8: Implementation Status Matrix
  - Feature checklist across multiple areas
  - Schema definitions (all complete)
  - Agent implementations (operational)
  - Message bus (working)
  - State machine (operational)
  - Validation (gaps)
  - Database (partial)
  - Observability (limited)
  - Schema alignment (incomplete)

**Who should read:** Architects planning improvements, visual learners, system reviewers

### 3. AGENT-RESULT-MAPPING-SUMMARY.txt (15 KB) - Executive Summary

**Purpose:** High-level overview and quick reference for busy decision-makers

**Contents:**
- Key Findings (5 main findings)
  1. Dual schema problem with impact analysis
  2. Message wrapping architecture verification
  3. Result flow confirmation
  4. Schema mismatches with examples
  5. Actual vs declared data flow

- Redis Channel Map
  - All channels documented
  - Protocol format

- Schema Location Index
  - All schema files organized by category
  - Line numbers for quick navigation

- File Inventory
  - Core schema files
  - Agent implementation files
  - Orchestrator files
  - Documentation files

- Critical Insights (6 insights)
  - Schema hierarchy unused
  - Transparent payload transformation
  - Type safety boundaries
  - Traceability gaps
  - State machine coupling
  - Envelope system behavior

- Recommendations (3 levels)
  - Short-term fixes
  - Mid-term alignment
  - Long-term observability

- Quick Reference
  - Common tasks and where to implement them
  - Document cross-references

- Verification Checklist
  - All items completed

**Who should read:** Project leads, decision-makers, anyone needing overview

## How to Use This Mapping

### I need to understand how results flow through the system
1. Start with: AGENT-RESULT-MAPPING-SUMMARY.txt → Section "ACTUAL DATA FLOW"
2. Then read: AGENT-RESULT-ARCHITECTURE.md → Section 2 "Message Flow Architecture"
3. Deep dive: AGENT-RESULT-SCHEMA-MAP.md → Section 8 "Summary of Current Flow"

### I need to add a new field to results
1. Start with: AGENT-RESULT-SCHEMA-MAP.md → Section 5 "Schema Mismatch Analysis"
2. Find: AGENT-RESULT-SCHEMA-MAP.md → Section 9 "Key Files Reference"
3. Locations: AGENT-RESULT-MAPPING-SUMMARY.txt → Section "SCHEMA LOCATION INDEX"
4. Implementation: All three files have recommendations

### I'm debugging a result not being received
1. Check: AGENT-RESULT-ARCHITECTURE.md → Section 7 "Error Propagation"
2. Verify: AGENT-RESULT-SCHEMA-MAP.md → Section 3 "Redis Message Bus Pattern"
3. Inspect: BaseAgent.reportResult() code (linked in all docs)
4. Trace: AgentDispatcherService.handleAgentResult() (linked in all docs)

### I need to implement result validation
1. Read: AGENT-RESULT-SCHEMA-MAP.md → Section 5 "Schema Mismatch Analysis"
2. See: AGENT-RESULT-MAPPING-SUMMARY.txt → Section "IF YOU WANT TO: Enforce result contracts"
3. Reference: AGENT-RESULT-SCHEMA-MAP.md → Section 7 "Contracts Layer"
4. Code: packages/shared/contracts/src/contracts/*.ts

### I need to add result metrics collection
1. See: AGENT-RESULT-ARCHITECTURE.md → Section 4 "Data Structure Comparison"
2. Reference: AGENT-RESULT-MAPPING-SUMMARY.txt → Section "IF YOU WANT TO: Capture execution metrics"
3. Details: AGENT-RESULT-SCHEMA-MAP.md → Section 2 "Agent Result Construction"

## Key Findings Summary

### The System Works But Has Gaps

**What's Working:**
- Redis pub/sub for task dispatch and result collection
- Agent execution and result publishing
- State machine event processing
- Workflow progression through stages
- Event deduplication

**What's Missing:**
- Result schema enforcement (AgentResultSchema never used)
- Metrics collection (no duration, tokens, API calls)
- Artifact tracking (no generated files tracked)
- Structured error handling (only string array)
- Result audit trail (no history stored)
- Result versioning (no contract versioning)

### The Dual Schema Problem

Two incompatible result schemas:
- **AgentResultSchema**: 13 fields, comprehensive, defined in shared types, NOT USED
- **TaskResult**: 5 fields, minimal, used by agents, insufficient

Overlap: 38.5%, Mismatch: 60%, Missing: 8 fields

### The Message Wrapping Adds Fields

Agents return TaskResult (5 fields)
→ BaseAgent wraps in AgentMessage (adds id, agent_id, stage, timestamp, trace_id)
→ Orchestrator receives enriched message

This transparent wrapping makes the system work despite schema gap.

## File Locations Quick Reference

| What | Where | Lines |
|------|-------|-------|
| AgentResultSchema | packages/shared/types/src/core/schemas.ts | 97-129 |
| ScaffoldResultSchema | packages/shared/types/src/agents/scaffold.ts | 95-176 |
| ValidationResultSchema | packages/shared/types/src/agents/validation.ts | 112-204 |
| DeploymentResultSchema | packages/shared/types/src/agents/deployment.ts | 320-336 |
| IntegrationResultSchema | packages/shared/types/src/agents/integration.ts | 218-233 |
| TaskResult | packages/agents/base-agent/src/types.ts | - |
| BaseAgent.reportResult() | packages/agents/base-agent/src/base-agent.ts | 212-242 |
| handleAgentResult() | packages/orchestrator/src/services/agent-dispatcher.service.ts | 150-220 |
| STAGE_COMPLETE | packages/orchestrator/src/state-machine/workflow-state-machine.ts | 58-77 |
| REDIS_CHANNELS | packages/shared/types/src/constants/pipeline.constants.ts | - |

## Next Steps

1. Review AGENT-RESULT-MAPPING-SUMMARY.txt for high-level understanding
2. Use AGENT-RESULT-ARCHITECTURE.md for visual learning
3. Reference AGENT-RESULT-SCHEMA-MAP.md for detailed technical work
4. Use file locations to navigate to implementation code
5. Follow recommendations to address schema gaps

## Mapping Metadata

- **Created**: November 12, 2025
- **Duration**: ~2 hours of deep codebase analysis
- **Files Analyzed**: 30+
- **Schema Definitions**: 5
- **Implementation Files**: 20+
- **Total Documentation**: 65 KB across 3 documents
- **Completeness**: 100% (all components mapped)

## Questions Answered

This mapping answers:

1. Where is the authoritative agent result schema defined?
   → packages/shared/types/src/core/schemas.ts:97-129

2. How do agents construct results?
   → BaseAgent.execute() returns TaskResult, reportResult() wraps it

3. How do results flow to the orchestrator?
   → JSON serialized and published to "orchestrator:results" Redis channel

4. What information is lost in the current flow?
   → Metrics, artifacts, structured errors, timestamp, version, action

5. Why doesn't the system use AgentResultSchema?
   → Historical - TaskResult was defined first, agents built around it

6. What's the complete message structure on Redis?
   → AgentMessage wrapper with id, type, agent_id, workflow_id, stage, payload, timestamp, trace_id

7. How does deduplication work?
   → State machine tracks eventId (from trace_id) in _seenEventIds Set

8. What happens if a result doesn't conform to schema?
   → Currently no validation - any object works if it has task_id, workflow_id, status

## Related Documentation

- CLAUDE.md - Project status and session history
- DELIVERABLES-SUMMARY.txt - System overview
- ENVELOPE-MIGRATION-GUIDE.md - Agent envelope system
- SESSION-43-COMPLETION.md - Integration test report

---

**Last Updated:** November 12, 2025
**Status:** Complete and current
