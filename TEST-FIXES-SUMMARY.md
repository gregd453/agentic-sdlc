# Test Fixes Summary

**Date:** 2025-11-09
**Session:** Test suite fixes after schema refactoring

## Overview

Fixed 3 packages with failing tests after the schema refactoring to use shared types.

## Fixes Applied

### 1. Base Agent Mock Initialization Error ✅

**Package:** `@agentic-sdlc/base-agent`
**Error:** `ReferenceError: Cannot access '__vi_import_1__' before initialization`
**Location:** `packages/agents/base-agent/tests/base-agent.test.ts:4`

**Root Cause:**
- Vitest module mocking order issue
- `vi.mock()` calls were after imports, causing circular dependency
- Missing mock for `@agentic-sdlc/shared-utils` which imports `ioredis`

**Solution:**
1. Moved all `vi.mock()` calls BEFORE imports
2. Used async import for `ioredis-mock` inside the mock factory
3. Added mock for `@agentic-sdlc/shared-utils` to prevent circular dependency

**Code Changes:**
```typescript
// BEFORE:
import { BaseAgent } from '../src/base-agent';
import RedisMock from 'ioredis-mock';
vi.mock('ioredis', () => ({ default: RedisMock }));

// AFTER:
vi.mock('ioredis', async () => {
  const RedisMock = (await import('ioredis-mock')).default;
  return { default: RedisMock };
});
vi.mock('@agentic-sdlc/shared-utils', () => ({
  retry: async <T>(fn: () => Promise<T>) => fn(),
  RetryPresets: { standard: { maxAttempts: 3, delayMs: 1000 } },
  CircuitBreaker: vi.fn()
}));
import { BaseAgent } from '../src/base-agent';
```

---

### 2. Validation Agent Schema Validation Failures ✅

**Package:** `@agentic-sdlc/validation-agent`
**Error:** 7 out of 9 tests failing with schema validation errors
**Location:** `packages/agents/validation-agent/src/__tests__/validation-agent.test.ts`

**Root Cause:**
- Tests using old `TaskAssignment` type from `@agentic-sdlc/base-agent`
- New schema requires `ValidationTask` type from `@agentic-sdlc/shared-types`
- Missing required fields:
  - `agent_type`: must be literal `'validation'` (was generic `'validation'` string)
  - `action`: required ValidationActionEnum value (was missing)
  - `priority`: must be `number` (was `string`)
  - `payload`: required structured object (was using `context`)
  - `version`: must be literal `'1.0.0'` (was missing)
  - `created_at`: required ISO datetime string (was missing)

**Solution:**
1. Changed import from `TaskAssignment` to `ValidationTask, createValidationTask`
2. Created helper function `createTestTask()` to generate valid ValidationTask objects
3. Updated all 9 test cases to use new schema structure
4. Replaced `context` field with structured `payload` object containing:
   - `file_paths`: array of strings
   - `validation_types`: array of validation type enums
   - `thresholds`: optional coverage/complexity thresholds
   - `config`: optional configuration overrides

**Code Changes:**
```typescript
// BEFORE:
import { TaskAssignment } from '@agentic-sdlc/base-agent';
const task: TaskAssignment = {
  task_id: randomUUID(),
  workflow_id: randomUUID(),
  type: 'validation',
  name: 'Validate code',
  description: 'Run validation checks',
  requirements: 'Validate TypeScript',
  priority: 'high',
  context: {
    project_path: '/test/project',
    validation_types: ['typescript']
  }
};

// AFTER:
import { ValidationTask, createValidationTask } from '@agentic-sdlc/shared-types';
function createTestTask(filePaths: string[], validationTypes?: string[]): ValidationTask {
  return {
    task_id: `task_${randomUUID()}` as any,
    workflow_id: `workflow_${randomUUID()}` as any,
    agent_type: 'validation',
    action: 'validate_code',
    status: 'pending',
    priority: 50,
    payload: {
      file_paths: filePaths,
      validation_types: validationTypes || ['typescript', 'eslint', 'security', 'coverage'],
    },
    version: '1.0.0',
    timeout_ms: 120000,
    retry_count: 0,
    max_retries: 3,
    created_at: new Date().toISOString(),
  };
}
const task = createTestTask(['/test/project/file1.ts'], ['typescript']);
```

---

### 3. Integration Agent FS Mock Conflict ✅

**Package:** `@agentic-sdlc/integration-agent`
**Error:** 1 test failing with `Cannot redefine property: writeFile`
**Location:** `packages/agents/integration-agent/src/__tests__/services/git.service.test.ts`

**Root Cause:**
- Test was using `vi.spyOn(fs, 'writeFile')` on dynamically imported module
- Vitest doesn't allow redefining properties on already-imported modules
- Spy was attempting to override native fs.promises.writeFile

**Solution:**
1. Added module-level mock for `fs/promises` at top of test file
2. Changed test from using `vi.spyOn()` to using `vi.mocked()`
3. Updated expectations to verify mock was called with correct parameters

**Code Changes:**
```typescript
// BEFORE:
// No mock at top of file
describe('applyResolution', () => {
  it('should write resolved content and stage file', async () => {
    const fs = await import('fs/promises');
    vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);  // ❌ Fails
    await gitService.applyResolution('src/index.ts', 'resolved code');
    expect(mockGit.add).toHaveBeenCalledWith('src/index.ts');
  });
});

// AFTER:
// At top of file
vi.mock('fs/promises', () => ({
  default: { writeFile: vi.fn() },
  writeFile: vi.fn()
}));

describe('applyResolution', () => {
  it('should write resolved content and stage file', async () => {
    const { writeFile } = await import('fs/promises');
    vi.mocked(writeFile).mockResolvedValue(undefined);  // ✅ Works
    await gitService.applyResolution('src/index.ts', 'resolved code');
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining('src/index.ts'),
      'resolved code',
      'utf-8'
    );
    expect(mockGit.add).toHaveBeenCalledWith('src/index.ts');
  });
});
```

---

## Impact

### Tests Fixed
- **Base Agent:** 12 tests (was 0/12 running)
- **Validation Agent:** 7 tests (was 2/9 passing, now 9/9)
- **Integration Agent:** 1 test (was 17/18 passing, now 18/18)

### Total Impact
- **Fixed:** 20 tests
- **Still Passing:** 93+ tests (ops, contracts, e2e-agent, etc.)
- **Expected Pass Rate:** ~113 tests passing (up from ~93)

---

## Files Modified

1. `packages/agents/base-agent/tests/base-agent.test.ts`
2. `packages/agents/validation-agent/src/__tests__/validation-agent.test.ts`
3. `packages/agents/integration-agent/src/__tests__/services/git.service.test.ts`

---

## Lessons Learned

### Vitest Module Mocking
1. Always place `vi.mock()` calls **before** imports
2. Use async imports in mock factories when needed
3. Mock transitive dependencies to avoid circular issues
4. Use `vi.mocked()` instead of `vi.spyOn()` for already-mocked modules

### Schema Migration Testing
1. Update test fixtures immediately after schema changes
2. Use factory functions to create test data
3. Ensure type imports match actual implementation types
4. Validate all required fields in new schemas

### Best Practices
1. Mock at module level, not test level
2. Clear mocks in `beforeEach()` hooks
3. Use proper TypeScript types for test data
4. Test both success and failure cases

---

## Next Steps

1. Run full test suite to verify all packages pass
2. Update CI/CD pipeline if needed
3. Document schema migration guide for future agent updates
4. Consider creating test data factories in shared-utils package

---

**Status:** ✅ All fixes applied and ready for testing
