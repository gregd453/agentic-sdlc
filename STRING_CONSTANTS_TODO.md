# String Constants Cleanup - Technical Debt

## Status: DOCUMENTED (Not Blocking)

While investigating Session #67 E2E test failures, we discovered hardcoded status strings throughout the codebase despite having well-defined constants in `pipeline.constants.ts`.

## Good News

✅ Database enum values MATCH hardcoded strings (lowercase)
✅ Not causing the current workflow stuck issue
✅ Constants and helper functions already exist

## Technical Debt

### Priority 1 - Consistency (Session #68+)

Replace hardcoded strings with constants:

1. **workflow-state-machine.ts:848**
   ```typescript
   // Current
   const isTerminal = ['completed', 'failed', 'cancelled'].includes(workflow.status);
   // Should be  
   const isTerminal = isTerminalStatus(workflow.status);
   ```

2. **workflow-state-machine.ts** - XState machine (lines 46-187)
   - Import WORKFLOW_STATUS constants
   - Replace all hardcoded state names

3. **workflow.repository.ts** - Task status
   - Import TASK_STATUS
   - Replace `'pending'` with `TASK_STATUS.PENDING`

### Benefits

- Type safety
- Autocomplete
- Refactoring safety
- Single source of truth

### Non-Urgent

This is code quality improvement, not a bug fix. Current system works because DB enum matches strings.

**Estimated effort:** 1-2 hours
**Recommended:** Next cleanup session
