CLI-NODE-REQUIREMENTS

# Code Review Checklist

**Generated:** 2025-11-07
**Context:** Resource Leak Prevention & Best Practices

---

## AI Agent Rules (Policy-Ready)

### **ALWAYS**

- **ALWAYS** clean up child processes with SIGTERM → wait → SIGKILL in `finally` blocks
- **ALWAYS** remove event listeners when streams/emitters are no longer needed
- **ALWAYS** clear timeouts/intervals in `finally` blocks or cleanup handlers
- **ALWAYS** use isolated state directories in tests (never share state across test runs)
- **ALWAYS** implement TTL (time-to-live) for persistent files that accumulate over time
- **ALWAYS** provide cleanup commands/methods for long-running systems that create files
- **ALWAYS** use AbortController/signal for cancellable async operations
- **ALWAYS** add `end`, `error`, `close` handlers to streams
- **ALWAYS** track active resources (streams, processes, connections) in collections for cleanup
- **ALWAYS** close file descriptors, database connections, and network sockets in `finally`
- **ALWAYS** validate cleanup in tests with `beforeEach`/`afterEach` hooks
- **ALWAYS** implement exponential backoff with maximum retry limits
- **ALWAYS** log resource allocation AND deallocation events
- **ALWAYS** use explicit types (avoid `any` unless justified with comment)
- **ALWAYS** handle both success and failure paths in async operations
- **ALWAYS** provide dry-run mode for destructive operations
- **ALWAYS** gracefully handle SIGINT/SIGTERM with cleanup before exit
- **ALWAYS** test timeout behavior explicitly

### **NEVER**

- **NEVER** spawn processes without storing references for cleanup
- **NEVER** create streams without attaching error handlers
- **NEVER** use `setInterval`/`setTimeout` without storing handle for `clearInterval`/`clearTimeout`
- **NEVER** leave event listeners attached after resource disposal
- **NEVER** share state directories between production and test environments
- **NEVER** accumulate files indefinitely without cleanup policies
- **NEVER** ignore errors from child processes or streams
- **NEVER** use `process.exit()` without cleanup handlers
- **NEVER** create recursive operations without depth/iteration limits
- **NEVER** use infinite retries (always have max retry count)
- **NEVER** block event loop with synchronous operations in hot paths
- **NEVER** trust external processes to clean up after themselves
- **NEVER** use `any` type without explicit type narrowing before operations
- **NEVER** assume processes will die when parent dies (orphan risk)
- **NEVER** use `null` when TypeScript expects `undefined` (prefer `undefined`)
- **NEVER** skip `finally` blocks for critical cleanup operations

---

## Comprehensive Code Review Checklist

### 1. Process Management

#### Child Process Spawning
- [ ] **Reference Storage**: All `spawn()`, `exec()`, `fork()` calls store process reference in variable
- [ ] **Cleanup Pattern**: Process cleanup uses graceful → force kill pattern:
  ```typescript
  proc.kill('SIGTERM');
  await delay(1000);
  if (!proc.killed) proc.kill('SIGKILL');
  ```
- [ ] **Finally Blocks**: Process cleanup in `finally` block even on early return/throw
- [ ] **Error Handlers**: `error`, `exit`, `close` event handlers attached to all child processes
- [ ] **Timeout Management**: Timeouts kill processes, not just reject promises
- [ ] **AbortController**: Long-running processes use AbortController for cancellation
- [ ] **Orphan Prevention**: Detached processes only when explicitly required with `unref()`
- [ ] **Zombie Prevention**: Parent waits for child or explicitly handles exit codes

#### Process Lifecycle
- [ ] **Startup Validation**: Verify process actually started (not just spawned)
- [ ] **Exit Code Handling**: All non-zero exit codes logged and handled
- [ ] **STDIO Management**: stdin/stdout/stderr properly configured (ignore/pipe/inherit)
- [ ] **Working Directory**: `cwd` option validated to exist before spawn
- [ ] **Environment Variables**: Inherited env merged safely (not replaced unless intentional)
- [ ] **Signal Handling**: Parent handles SIGINT/SIGTERM and cleans child processes

---

### 2. Stream & Event Management

#### Stream Creation
- [ ] **Event Handlers**: All streams have `error`, `end`, `close` handlers
- [ ] **Reference Tracking**: Active streams tracked in Set/Map for bulk cleanup
- [ ] **Cleanup on End**: Streams removed from tracking on `end`/`close`
- [ ] **Destroy on Error**: Streams explicitly destroyed on error
- [ ] **Backpressure**: `pipe()` or manual `pause()`/`resume()` for large data
- [ ] **Encoding**: Explicit encoding set for text streams (`utf8`, etc.)
- [ ] **File Descriptor Leaks**: Verify streams closed in all code paths

#### EventEmitter Usage
- [ ] **Listener Limits**: Check for potential listener leaks (`setMaxListeners` warnings)
- [ ] **Removal Pattern**: Every `on()`/`once()` has corresponding `removeListener()`
- [ ] **Cleanup Methods**: Classes with emitters implement `dispose()`/`close()` methods
- [ ] **Memory Leaks**: No lambdas in `on()` that capture large contexts
- [ ] **Wildcard Subscriptions**: Event bus wildcards (`*`) properly scoped and cleaned up

---

### 3. File System Operations

#### State Persistence
- [ ] **Directory Isolation**: Production and test use different state directories
- [ ] **TTL Implementation**: Old files have expiration/cleanup mechanism
- [ ] **Cleanup Commands**: CLI/API provides cleanup for accumulated state
- [ ] **Disk Usage Monitoring**: Method to query disk usage (file count, total size)
- [ ] **Backup Before Delete**: Destructive operations create backups first
- [ ] **Atomic Writes**: Use temp file → rename for critical data
- [ ] **Error Handling**: File operations wrapped in try/catch with logging

#### File Accumulation Prevention
- [ ] **Rotation Policy**: Log/state files rotate by size or time
- [ ] **Max File Count**: Hard limits on files in directory
- [ ] **Archive Strategy**: Old files compressed or moved to archive dir
- [ ] **Dry-Run Mode**: Preview file deletions before execution
- [ ] **Audit Trail**: Log all file creation/deletion with timestamps

---

### 4. Async Operations & Timing

#### Timeouts & Intervals
- [ ] **Handle Storage**: All `setTimeout`/`setInterval` stored in variables
- [ ] **Clearance**: Corresponding `clearTimeout`/`clearInterval` in all paths
- [ ] **Finally Cleanup**: Timeout handles cleared in `finally` blocks
- [ ] **AbortController**: Async operations support cancellation via signal
- [ ] **Race Conditions**: Concurrent operations properly synchronized
- [ ] **Promise Leaks**: All promises have error handlers (no unhandled rejections)

#### Retry & Backoff
- [ ] **Max Retries**: Retry logic has hard upper limit (never infinite)
- [ ] **Exponential Backoff**: Delays increase exponentially (not linearly)
- [ ] **Jitter**: Backoff includes randomization to prevent thundering herd
- [ ] **Timeout Scaling**: Timeouts increase with retry attempts
- [ ] **Circuit Breaker**: Failing operations eventually stop retrying
- [ ] **Logging**: Each retry logged with attempt number and reason

---

### 5. Testing Practices

#### Test Isolation
- [ ] **State Cleanup**: `beforeEach`/`afterEach` create/destroy test state
- [ ] **Unique Directories**: Each test run uses timestamp-based unique directory
- [ ] **No Shared State**: Tests don't rely on global/shared state files
- [ ] **Resource Cleanup**: Tests clean up processes, streams, connections
- [ ] **Timeout Limits**: Long-running tests have explicit timeout values
- [ ] **Mock Mode**: Integration tests provide mock mode to avoid real I/O
- [ ] **Parallel Safety**: Tests safe to run in parallel (no race conditions)

#### Test Coverage
- [ ] **Timeout Testing**: Tests verify timeout behavior explicitly
- [ ] **Error Path Testing**: Tests cover failure scenarios (not just happy path)
- [ ] **Cleanup Verification**: Tests verify resources actually cleaned up
- [ ] **Leak Detection**: Tests check for file/process/handle leaks
- [ ] **Signal Handling**: Tests verify SIGINT/SIGTERM cleanup

---

### 6. TypeScript & Type Safety

#### Type Definitions
- [ ] **No Any**: Avoid `any` type; use `unknown` with narrowing if necessary
- [ ] **Explicit Return Types**: Public methods have explicit return type annotations
- [ ] **Null vs Undefined**: Use `undefined` consistently (not `null`)
- [ ] **Union Types**: Narrowed before use (type guards, `instanceof`, `in` operator)
- [ ] **Strict Null Checks**: Code compiles with `strictNullChecks: true`
- [ ] **Type Assertions**: Cast only when necessary with explanatory comment
- [ ] **Generic Constraints**: Generic types have appropriate constraints

#### Error Handling
- [ ] **Typed Errors**: Custom error classes for different failure modes
- [ ] **Error Context**: Errors include correlation IDs and context data
- [ ] **Never Silent**: All errors logged (never silently caught without action)
- [ ] **Result Pattern**: Consider `Result<T, E>` for expected errors
- [ ] **Async Errors**: All async functions have error handling

---

### 7. Resource Management Patterns

#### Lifecycle Management
- [ ] **Constructor/Dispose**: Resources have clear initialization and disposal
- [ ] **Reference Counting**: Shared resources use reference counting if needed
- [ ] **Singleton Safety**: Singletons properly clean up on app shutdown
- [ ] **Dependency Injection**: Resources injected (not created) for testability
- [ ] **Graceful Shutdown**: App handles shutdown signals with cleanup sequence

#### Memory Management
- [ ] **Large Data**: Streams used for large data (not loading entire files)
- [ ] **Circular References**: No circular object references without WeakMap
- [ ] **Cache Limits**: In-memory caches have max size limits
- [ ] **Buffer Pooling**: Reuse buffers for high-frequency operations
- [ ] **Event Loop**: No blocking synchronous operations in hot paths

---

### 8. Observability & Debugging

#### Logging
- [ ] **Correlation IDs**: All operations tagged with correlation/trace ID
- [ ] **Structured Logging**: Logs use structured format (JSON) not strings
- [ ] **Resource Events**: Log resource allocation AND deallocation
- [ ] **Error Context**: Errors logged with full stack trace and context
- [ ] **Performance Metrics**: Duration logged for long operations
- [ ] **Log Levels**: Appropriate levels (error/warn/info/debug) used

#### Monitoring
- [ ] **Health Checks**: Endpoints/commands to check system health
- [ ] **Metrics Collection**: Track process count, file count, memory usage
- [ ] **Leak Detection**: Monitoring for gradual resource accumulation
- [ ] **Alerts**: Critical resource thresholds trigger alerts

---

### 9. CLI & User Interface

#### Command Design
- [ ] **Dry-Run Mode**: Destructive operations support `--dry-run` flag
- [ ] **Confirmation**: Dangerous operations require confirmation or `--force`
- [ ] **Progress Indicators**: Long operations show progress
- [ ] **Error Messages**: User-friendly error messages (not stack traces)
- [ ] **Help Text**: All commands have clear `--help` documentation
- [ ] **Exit Codes**: Proper exit codes (0 success, 1 error, etc.)

#### Safety Features
- [ ] **Backup First**: Destructive operations create backups
- [ ] **Preview Changes**: Show what will change before execution
- [ ] **Undo Capability**: Provide rollback for critical operations
- [ ] **Rate Limiting**: Bulk operations process in batches with delays

---

### 10. Security & Safety

#### Input Validation
- [ ] **Command Injection**: Shell commands properly escaped/parameterized
- [ ] **Path Traversal**: File paths validated to prevent directory traversal
- [ ] **Input Sanitization**: User input sanitized before use in commands
- [ ] **Size Limits**: File uploads/inputs have size limits
- [ ] **Type Validation**: Runtime validation of external data (not just TypeScript)

#### Secrets Management
- [ ] **No Hardcoded Secrets**: No API keys, passwords in code
- [ ] **Environment Variables**: Secrets from env vars or secret store
- [ ] **Logging**: Secrets not logged (even in error messages)
- [ ] **File Permissions**: State files have appropriate permissions (0600/0700)

---

### 11. Configuration & Dependencies

#### Configuration
- [ ] **Defaults**: Sensible defaults for all configuration options
- [ ] **Validation**: Config validated on load (fail fast if invalid)
- [ ] **Environment Overrides**: Allow env var overrides for testing
- [ ] **Documentation**: All config options documented

#### Dependencies
- [ ] **Pinned Versions**: Package versions pinned (not `^` or `~`)
- [ ] **Security Audit**: Run `npm audit` and address high/critical issues
- [ ] **Minimal Dependencies**: Only necessary dependencies included
- [ ] **License Check**: Dependency licenses compatible with project

---

### 12. Documentation

#### Code Documentation
- [ ] **JSDoc Comments**: Public APIs have JSDoc with `@param`, `@returns`, `@throws`
- [ ] **Rationale**: Non-obvious code has comments explaining "why"
- [ ] **TODOs**: All TODOs tracked in issue tracker (not just code comments)
- [ ] **Examples**: Complex functions have usage examples

#### External Documentation
- [ ] **README**: Clear setup and usage instructions
- [ ] **Changelog**: Changes documented for each version
- [ ] **Migration Guides**: Breaking changes have migration documentation
- [ ] **Architecture Docs**: System architecture documented

---

## Review Severity Levels

### 🔴 **CRITICAL** (Must Fix Before Merge)
- Process/stream/connection leaks
- Security vulnerabilities
- Data loss scenarios
- Crashes or unhandled exceptions
- TypeScript compilation errors

### 🟠 **HIGH** (Should Fix Before Merge)
- Missing error handlers
- Inadequate test coverage for new code
- Resource cleanup missing
- Timeout/retry logic issues
- Type safety violations

### 🟡 **MEDIUM** (Fix Soon)
- Missing logging
- Suboptimal performance
- Code duplication
- Missing documentation
- Test isolation issues

### 🟢 **LOW** (Nice to Have)
- Code style inconsistencies
- Minor refactoring opportunities
- Additional test cases
- Documentation improvements

---

## Quick Audit Commands

```bash
# Find processes without cleanup
rg "spawn\(|exec\(|fork\(" --type ts | grep -v "killed\|SIGTERM"

# Find streams without error handlers
rg "createReadStream\(|createWriteStream\(" --type ts | grep -v "\.on\('error'"

# Find timeouts without clear
rg "setTimeout\(|setInterval\(" --type ts | grep -v "clearTimeout\|clearInterval"

# Find event listeners without removal
rg "\.on\(|\.addListener\(" --type ts | grep -v "removeListener\|off\("

# Find shared state directories in tests
rg "stateDir.*:" --type ts -A 2 -B 2 ops/agentic/test/

# Check for unbounded retries
rg "while.*true|for.*;;|retry" --type ts | grep -v "maxRetries\|maxAttempts"

# Find any types
rg ": any\b" --type ts

# Check test cleanup
rg "beforeEach\|afterEach" --type ts -A 5 -B 5 | grep -E "rm|unlink|cleanup|clear"
```

---

## Common Anti-Patterns to Avoid

### ❌ **Pattern: Process Leak**
```typescript
// BAD: No cleanup
const proc = spawn('long-running-command');
await waitForOutput(proc);
```

### ✅ **Pattern: Proper Process Management**
```typescript
// GOOD: Cleanup in finally
let proc: ChildProcess | undefined;
try {
  proc = spawn('long-running-command');
  await waitForOutput(proc);
} finally {
  if (proc && !proc.killed) {
    proc.kill('SIGTERM');
    await delay(1000);
    if (!proc.killed) proc.kill('SIGKILL');
  }
}
```

---

### ❌ **Pattern: Stream Leak**
```typescript
// BAD: No event handlers
setInterval(() => {
  const stream = fs.createReadStream(file, { start: offset });
  stream.on('data', processData);
}, 500);
```

### ✅ **Pattern: Tracked Stream Management**
```typescript
// GOOD: Track and clean up streams
const activeStreams = new Set<fs.ReadStream>();

setInterval(() => {
  const stream = fs.createReadStream(file, { start: offset });
  activeStreams.add(stream);

  stream.on('data', processData);
  stream.on('end', () => activeStreams.delete(stream));
  stream.on('error', (err) => {
    console.error('Stream error:', err);
    activeStreams.delete(stream);
  });
  stream.on('close', () => activeStreams.delete(stream));
}, 500);

// Cleanup all on exit
process.on('SIGINT', () => {
  for (const stream of activeStreams) {
    stream.destroy();
  }
  activeStreams.clear();
});
```

---

### ❌ **Pattern: Unbounded File Accumulation**
```typescript
// BAD: No cleanup
function saveState(state: State) {
  const filename = `state-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(state));
}
```

### ✅ **Pattern: TTL-Based State Management**
```typescript
// GOOD: Cleanup old files
function saveState(state: State) {
  const filename = `state-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(state));

  // Clean up files older than 7 days
  cleanupOldStates(7 * 24 * 60 * 60 * 1000);
}

function cleanupOldStates(ttlMs: number) {
  const cutoff = Date.now() - ttlMs;
  const files = fs.readdirSync(stateDir);

  for (const file of files) {
    const stats = fs.statSync(path.join(stateDir, file));
    if (stats.mtimeMs < cutoff) {
      fs.unlinkSync(path.join(stateDir, file));
    }
  }
}
```

---

### ❌ **Pattern: Timeout Without Cleanup**
```typescript
// BAD: Timeout handle lost
async function fetchWithTimeout(url: string) {
  const timeout = setTimeout(() => controller.abort(), 5000);
  return fetch(url);
}
```

### ✅ **Pattern: Proper Timeout Management**
```typescript
// GOOD: Cleanup in all paths
async function fetchWithTimeout(url: string) {
  let timeout: NodeJS.Timeout | undefined;
  try {
    timeout = setTimeout(() => controller.abort(), 5000);
    return await fetch(url);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
```

---

## Checklist Usage

### For Code Authors
1. Self-review using this checklist before creating PR
2. Run audit commands to catch common issues
3. Add tests that verify cleanup behavior
4. Document any intentional deviations with rationale

### For Code Reviewers
1. Start with CRITICAL and HIGH severity items
2. Use audit commands to verify patterns
3. Check test coverage for new resource management
4. Verify documentation updated for new features

### For CI/CD Integration
1. Automate audit commands in pre-commit hooks
2. Run leak detection tests in CI pipeline
3. Track resource metrics over time
4. Alert on TypeScript errors, security issues

---

**Last Updated:** 2025-11-07
**Next Review:** After each major incident or quarterly

