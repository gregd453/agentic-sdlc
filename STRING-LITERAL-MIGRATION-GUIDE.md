# String Literal Migration Guide - Session #37

## Overview

This guide documents the standardization of all string literals across the pipeline using the new constants file: `packages/shared/types/src/constants/pipeline.constants.ts`.

## Status

✅ **Constants File Created** - All string literals catalogued and standardized
✅ **Build Verification** - Package compiles successfully with TypeScript strict mode
⏳ **Migration Pending** - String literals need to be replaced with constants

---

## Import Statement

All files that need to use constants should import them:

```typescript
import {
  REDIS_CHANNELS,
  AGENT_TYPES,
  WORKFLOW_STAGES,
  WORKFLOW_TYPES,
  TASK_STATUS,
  WORKFLOW_STATUS,
  PRIORITY_LEVELS,
  EVENT_TYPES,
  STAGE_TO_AGENT_MAP,
  getAgentTypeForStage,
  getStageSequence,
  getAgentTaskChannel,
  isSuccessStatus,
  isFailureStatus,
  isTerminalStatus,
} from '@agentic-sdlc/shared-types';
```

---

## Migration Checklist by Category

### 1. Redis Channels (HIGH PRIORITY - Message Delivery)

**Current Problem**: Hardcoded channel names in multiple locations cause mismatches

#### Files to Update:

**packages/agents/base-agent/src/base-agent.ts**
```typescript
// BEFORE (Line 113):
const taskChannel = `agent:${this.capabilities.type}:tasks`;

// AFTER:
import { getAgentTaskChannel } from '@agentic-sdlc/shared-types';
const taskChannel = getAgentTaskChannel(this.capabilities.type);

// BEFORE (Line 216):
const resultChannel = 'orchestrator:results';

// AFTER:
import { REDIS_CHANNELS } from '@agentic-sdlc/shared-types';
const resultChannel = REDIS_CHANNELS.ORCHESTRATOR_RESULTS;
```

**packages/orchestrator/src/services/agent-dispatcher.service.ts**
```typescript
// BEFORE (Line 81):
if (channel === 'orchestrator:results') {

// AFTER:
import { REDIS_CHANNELS } from '@agentic-sdlc/shared-types';
if (channel === REDIS_CHANNELS.ORCHESTRATOR_RESULTS) {

// BEFORE (Line 197):
const agentChannel = `agent:${agentType}:tasks`;

// AFTER:
import { getAgentTaskChannel } from '@agentic-sdlc/shared-types';
const agentChannel = getAgentTaskChannel(agentType);
```

**packages/agents/scaffold-agent/src/run-agent.ts**
```typescript
// BEFORE (Line 27):
console.log('\nAgent is ready to receive tasks on channel: agent:scaffold:tasks');

// AFTER:
import { AGENT_TYPES, getAgentTaskChannel } from '@agentic-sdlc/shared-types';
console.log(`\nAgent is ready to receive tasks on channel: ${getAgentTaskChannel(AGENT_TYPES.SCAFFOLD)}`);
```

---

### 2. Agent Types (MEDIUM PRIORITY)

#### Files to Update:

**packages/agents/scaffold-agent/src/scaffold-agent.ts**
```typescript
// BEFORE (Line 27):
type: 'scaffold',

// AFTER:
import { AGENT_TYPES } from '@agentic-sdlc/shared-types';
type: AGENT_TYPES.SCAFFOLD,

// BEFORE (Line 69):
agent_type: 'scaffold',

// AFTER:
agent_type: AGENT_TYPES.SCAFFOLD,
```

**packages/agents/validation-agent/src/validation-agent.ts**
```typescript
// BEFORE (Line 28):
type: 'validation',

// AFTER:
import { AGENT_TYPES } from '@agentic-sdlc/shared-types';
type: AGENT_TYPES.VALIDATION,

// BEFORE (Line 93):
expected: 'validation',

// AFTER:
expected: AGENT_TYPES.VALIDATION,
```

**packages/agents/e2e-agent/src/e2e-agent.ts**
```typescript
// BEFORE (Line 23):
type: 'e2e',

// AFTER:
import { AGENT_TYPES } from '@agentic-sdlc/shared-types';
type: AGENT_TYPES.E2E,
```

---

### 3. Workflow Stages (HIGH PRIORITY - State Machine)

#### Files to Update:

**packages/orchestrator/src/services/workflow.service.ts**
```typescript
// BEFORE (Line 1132-1143):
const stageToAgentMap: Record<string, string> = {
  initialization: 'scaffold',
  scaffolding: 'scaffold',
  implementation: 'scaffold',
  validation: 'validation',
  testing: 'e2e_test',
  e2e_testing: 'e2e_test',
  integration: 'integration',
  deployment: 'deployment',
  monitoring: 'monitoring',
  debugging: 'debug',
  fixing: 'debug'
};

// AFTER:
import { STAGE_TO_AGENT_MAP } from '@agentic-sdlc/shared-types';
// Delete the entire stageToAgentMap object and use STAGE_TO_AGENT_MAP directly

// BEFORE (Line 1145):
return stageToAgentMap[stage] || 'scaffold';

// AFTER:
import { getAgentTypeForStage } from '@agentic-sdlc/shared-types';
return getAgentTypeForStage(stage);
```

**packages/agents/scaffold-agent/src/scaffold-agent.ts**
```typescript
// BEFORE (Line 146):
next_stage: 'validation'

// AFTER:
import { WORKFLOW_STAGES } from '@agentic-sdlc/shared-types';
next_stage: WORKFLOW_STAGES.VALIDATION

// BEFORE (Lines 216, 247):
recommended_agents: ['validation', 'e2e', 'deployment'],

// AFTER:
import { AGENT_TYPES } from '@agentic-sdlc/shared-types';
recommended_agents: [AGENT_TYPES.VALIDATION, AGENT_TYPES.E2E, AGENT_TYPES.DEPLOYMENT],
```

---

### 4. Task & Workflow Status (MEDIUM PRIORITY)

#### Files to Update:

**packages/orchestrator/src/services/workflow.service.ts**
```typescript
// BEFORE (Line 382):
status: 'pending',

// AFTER:
import { TASK_STATUS } from '@agentic-sdlc/shared-types';
status: TASK_STATUS.PENDING,

// BEFORE (Line 439):
if (payload.status === 'success') {

// AFTER:
import { TASK_STATUS, isSuccessStatus } from '@agentic-sdlc/shared-types';
if (isSuccessStatus(payload.status)) {
// OR:
if (payload.status === TASK_STATUS.SUCCESS) {
```

**packages/orchestrator/src/state-machine/workflow-state-machine.ts**
```typescript
// BEFORE (Line 44):
initial: 'initiated',

// AFTER:
import { WORKFLOW_STATUS } from '@agentic-sdlc/shared-types';
initial: WORKFLOW_STATUS.INITIATED,

// BEFORE (Line 152):
target: 'completed',

// AFTER:
target: WORKFLOW_STATUS.COMPLETED,
```

**packages/orchestrator/src/repositories/workflow.repository.ts**
```typescript
// BEFORE (Line 19):
status: 'initiated',

// AFTER:
import { WORKFLOW_STATUS } from '@agentic-sdlc/shared-types';
status: WORKFLOW_STATUS.INITIATED,

// BEFORE (Line 41):
status: 'pending'

// AFTER:
import { TASK_STATUS } from '@agentic-sdlc/shared-types';
status: TASK_STATUS.PENDING
```

---

### 5. Event Types (LOW PRIORITY)

#### Files to Update:

**packages/orchestrator/src/services/event-bus.ts**
```typescript
// Update all event type strings to use EVENT_TYPES constants
import { EVENT_TYPES } from '@agentic-sdlc/shared-types';

// Example:
type: EVENT_TYPES.TASK_ASSIGNED,
type: EVENT_TYPES.STAGE_COMPLETE,
type: EVENT_TYPES.WORKFLOW_COMPLETED,
```

---

## Benefits of Using Constants

### 1. Type Safety
- TypeScript can catch typos at compile time
- Autocomplete works in IDEs
- Refactoring is safer with "Find All References"

### 2. Consistency
- Single source of truth prevents mismatches
- Redis channel names guaranteed to match
- Stage names always consistent across services

### 3. Maintainability
- Change value in one place, updates everywhere
- Easy to see all possible values
- Documentation is self-contained

### 4. Testing
- Easy to mock with constant values
- Can validate against known set of values
- Reduces test brittleness

---

## Priority Order for Migration

1. **CRITICAL**: Redis Channels
   - Fixes current message delivery issues
   - Only 3-4 files need updating
   - Estimated time: 30 minutes

2. **HIGH**: Workflow Stages & Agent Types
   - Prevents stage mismatch issues
   - Ensures state machine consistency
   - Estimated time: 1-2 hours

3. **MEDIUM**: Task & Workflow Status
   - Improves code clarity
   - Enables helper functions (isSuccessStatus, etc.)
   - Estimated time: 1-2 hours

4. **LOW**: Event Types & Others
   - Nice to have improvements
   - Can be done incrementally
   - Estimated time: 1-2 hours

**Total estimated migration time**: 3.5-6.5 hours

---

## Testing After Migration

After each category of replacements:

1. **Build Test**
   ```bash
   pnpm --filter @agentic-sdlc/shared-types build
   pnpm --filter @agentic-sdlc/orchestrator build
   pnpm --filter @agentic-sdlc/scaffold-agent build
   pnpm --filter @agentic-sdlc/validation-agent build
   ```

2. **Unit Test**
   ```bash
   pnpm --filter @agentic-sdlc/orchestrator test
   ```

3. **Integration Test**
   ```bash
   # Start infrastructure
   docker-compose up -d

   # Start services
   pnpm --filter @agentic-sdlc/orchestrator start &
   pnpm --filter @agentic-sdlc/scaffold-agent start &

   # Run a test workflow
   curl -X POST http://localhost:3000/api/v1/workflows \
     -H "Content-Type: application/json" \
     -d '{"type":"app","name":"test","description":"Test","priority":"high","requirements":"Create a React app"}'
   ```

---

## Constants File Reference

**Location**: `packages/shared/types/src/constants/pipeline.constants.ts`

**Key Exports**:
- `REDIS_CHANNELS` - All Redis pub/sub channels
- `AGENT_TYPES` - All agent type identifiers
- `WORKFLOW_STAGES` - All workflow stage identifiers
- `WORKFLOW_TYPES` - All workflow type identifiers
- `TASK_STATUS` - All task status values
- `WORKFLOW_STATUS` - All workflow status values
- `PRIORITY_LEVELS` - All priority level values
- `EVENT_TYPES` - All event type identifiers
- `STAGE_TO_AGENT_MAP` - Stage to agent mapping
- `STAGE_SEQUENCES` - Stage sequences by workflow type
- Helper functions for common operations

**Documentation**: See file header for complete API documentation

---

## Session #37 Summary

**What Was Done**:
- ✅ Audited 100+ string literals across the entire pipeline
- ✅ Created comprehensive constants file (380+ lines)
- ✅ Identified inconsistencies (e.g., 'e2e' vs 'e2e_test', 'failure' vs 'failed')
- ✅ Built type-safe helper functions
- ✅ Verified TypeScript compilation
- ✅ Documented migration path

**What Remains**:
- ⏳ Actual string literal replacements (3.5-6.5 hours estimated)
- ⏳ Integration testing after each batch
- ⏳ Update any tests that rely on hardcoded strings

**Expected Impact**:
- Fixes Redis message delivery issues
- Prevents future stage mismatch bugs
- Improves developer experience with autocomplete
- Makes refactoring safer
- Reduces testing brittleness

---

## Next Session Recommendation

Start with **CRITICAL priority** Redis channel updates first. This will likely fix the current E2E test timeout issue where agents aren't receiving tasks from the orchestrator.

Then proceed through HIGH and MEDIUM priorities as time allows.
