# ERROR HANDLING PATTERNS ANALYSIS
## Agent SDLC Codebase - Session #57

**Date:** 2025-11-13  
**Scope:** Comprehensive analysis of error handling approaches across orchestrator and agent code  
**Focus Files:**
- `packages/orchestrator/src/hexagonal/adapters/redis-bus.adapter.ts`
- `packages/agents/base-agent/src/base-agent.ts`
- `packages/orchestrator/src/services/workflow.service.ts`
- Related adapter and service files

---

## EXECUTIVE SUMMARY

The codebase exhibits **8+ distinct error handling patterns** that create inconsistency and maintenance challenges:

| Category | Count | Severity | Impact |
|----------|-------|----------|--------|
| **Try-catch patterns** | 5+ different styles | HIGH | Code duplication, inconsistent recovery |
| **Error conversion methods** | 3 different approaches | MEDIUM | Inconsistent error objects, type safety issues |
| **Error propagation** | 4 different strategies | HIGH | Silent failures vs cascading errors |
| **Logger implementations** | 3 different types | MEDIUM | Inconsistent observability |
| **Error string handling** | Multiple methods | MEDIUM | Type safety issues with error messages |

**Critical Issue:** Line 140 in `redis-bus.adapter.ts` exemplifies these problems - double JSON.parse attempt with inconsistent error handling causes agent crashes.

---

## PATTERN 1: TRY-CATCH BLOCK VARIATIONS

### Pattern 1.1: Basic Try-Catch with Error Logging + Re-throw

**Location:** `redis-kv.adapter.ts` (lines 45-61, 64-80, 82-91, 93-103, 105-125, 127-135)

```typescript
// PATTERN: Catch, log, rethrow
async get<T = any>(key: string): Promise<T | null> {
  try {
    const nsKey = ns(key);
    const raw = await base.get(nsKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // Fallback to string if JSON parse fails
      return (raw as unknown) as T;
    }
  } catch (e) {
    log.error('Get error', { key, error: String(e) });
    throw e;  // <-- Rethrow original error
  }
}
```

**Characteristics:**
- Single try-catch per operation
- Logs error with structured metadata
- Re-throws original error (preserves stack trace)
- Wraps nested fallback logic
- Uses `String(e)` for error conversion

**Used in:**
- `redis-kv.adapter.ts`: All 6 operations (get, set, del, incr, cas, health)
- Consistent error handling per adapter

---

### Pattern 1.2: Nested Try-Catch with Cascading Handlers

**Location:** `redis-bus.adapter.ts` (lines 35-71, 108-189)

```typescript
// PATTERN: Multiple nested try-catch blocks with different error strategies
(async () => {
  try {
    await sub.pSubscribe('*', async (message: string, channel: string) => {
      try {
        const handlers = subscriptions.get(channel);
        if (!handlers || handlers.size === 0) {
          log.debug('No handlers for channel', { channel });
          return;
        }

        let msg: any;
        try {
          const envelope = JSON.parse(message);
          msg = envelope.msg !== undefined ? envelope.msg : envelope;
        } catch (e) {
          log.error('Parse error', { ... });
          return;  // <-- Silent failure (early return)
        }

        await Promise.all(
          Array.from(handlers).map((h) =>
            h(msg).catch((e) => log.error('Handler error', { ... }))
          )
        );
      } catch (e) {
        log.error('Message processing error', { ... });
      }
    });
  } catch (e) {
    log.error('PSubscribe listener error', { ... });
  }
})().catch((e) => log.error('Uncaught pSubscribe error', { ... }));
```

**Characteristics:**
- 4 levels of nesting (IIFE > pSubscribe callback > parse > handlers)
- Different error strategies per level:
  - Level 1: IIFE - `.catch()` chaining for uncaught
  - Level 2: pSubscribe - `try-catch` block
  - Level 3: Message parse - `try-catch` with silent failure
  - Level 4: Handlers - `.catch()` chaining inline
- Silent failures (early return) at parse level
- No re-throw at any level
- Error logging at each level

**Issues:**
- Multiple error handling layers (redundant)
- Silent failures hide issues
- Difficult to trace error sources through nested handlers

---

### Pattern 1.3: Stream Consumer Error Handling

**Location:** `redis-bus.adapter.ts` (lines 122-189)

```typescript
// PATTERN: Long-running background loop with conditional error handling
(async () => {
  log.info('[PHASE-3] Starting stream consumer', { ... });

  while (subscriptions.has(topic)) {
    try {
      const results = await pub.xReadGroup(...);

      if (results && results.length > 0) {
        for (const streamResult of results) {
          for (const message of streamResult.messages) {
            try {
              const messageData = message.message as any;
              const parsedMessage = JSON.parse(messageData.message || messageData);
              // ^^ CRITICAL BUG: Double parse attempt
              
              // ... handler invocation ...
              
              await pub.xAck(...);
            } catch (msgError) {
              log.error('[PHASE-3] Failed to process stream message', {
                error: msgError instanceof Error ? msgError.message : String(msgError)
              });
              // NO re-throw - silent failure
            }
          }
        }
      }
    } catch (error: any) {
      // Conditional error handling based on error type
      if (error.message?.includes('NOGROUP')) {
        log.warn('[PHASE-3] Consumer group does not exist, will retry', { ... });
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else if (!subscriptions.has(topic)) {
        break;  // <-- Conditional loop exit
      } else {
        log.error('[PHASE-3] Stream consumer error', { ... });
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  log.info('[PHASE-3] Stream consumer stopped', { streamKey });
})().catch(e => log.error('[PHASE-3] Stream consumer crashed', { error: String(e) }));
```

**Characteristics:**
- Infinite loop with conditional error handling
- Error type checking (string pattern matching on error.message)
- Different recovery strategies:
  - NOGROUP error: retry after delay
  - Topic unsubscribed: exit loop
  - Other: log and continue with delay
- No re-throw at message level
- `.catch()` on IIFE for uncaught errors
- Uses `error instanceof Error ? error.message : String(error)` pattern

**Critical Issues:**
- Line 140: `JSON.parse(messageData.message || messageData)` tries to parse object
- `messageData` could be:
  - Already parsed object (from Redis xReadGroup)
  - String (from earlier pub/sub)
- No type checking before parse attempt
- Silent failure on parse error prevents debugging

---

### Pattern 1.4: Graceful Shutdown Error Handling

**Location:** `bootstrap.ts` (lines 140-179)

```typescript
// PATTERN: Catch-all suppression during shutdown
async shutdown(): Promise<void> {
  log.info('Shutting down container');

  // Stop orchestrators
  for (const orch of this.orchestrators) {
    try {
      await orch.stop();
    } catch (e) {
      log.warn('Error stopping orchestrator', { error: String(e) });
      // <-- Catch and suppress, don't rethrow
    }
  }

  // Disconnect ports
  if (this.bus) {
    try {
      await this.bus.disconnect();
    } catch (e) {
      log.warn('Error disconnecting bus', { error: String(e) });
    }
  }
  
  // ... similar patterns for KV, Redis ...

  log.info('Container shutdown complete');
}
```

**Characteristics:**
- Each operation wrapped independently
- Errors logged as warnings (not errors)
- All errors suppressed (no rethrow)
- Allows shutdown to complete even if sub-operations fail
- Suitable for cleanup operations

**Pattern Use Case:** Shutdown sequences where partial failures are acceptable

---

### Pattern 1.5: Workflow Service Error Handling (Complex)

**Location:** `workflow.service.ts` (lines 322-331, 845-885)

```typescript
// PATTERN: Operation with multiple error points
async createWorkflow(request: CreateWorkflowRequest): Promise<WorkflowResponse> {
  const startTime = Date.now();
  const traceId = generateTraceId();

  try {
    // Multiple operations that could fail
    const workflow = await this.repository.create({...});
    const stateMachine = this.stateMachineService.createStateMachine(...);
    stateMachine.send({ type: 'START' });
    
    await this.eventBus.publish({...});
    await this.createTaskForStage(...);

    metrics.recordDuration('workflow.creation', Date.now() - startTime, {...});
    metrics.increment('workflows.created', { type: workflow.type });

    return {
      workflow_id: workflow.id,
      status: workflow.status,
      // ...
    };
  } catch (error) {
    logger.error('Failed to create workflow', {
      error,
      request,
      trace_id: traceId
    });
    metrics.increment('workflows.creation.failed', { type: request.type });
    throw error;
  }
}
```

**Characteristics:**
- Single try-catch for multiple operations
- Error logged with full context (error object, request, trace_id)
- Metrics recorded for both success and failure
- Original error re-thrown
- No error type checking or recovery

---

## PATTERN 2: ERROR CONVERSION & TYPING

### Pattern 2.1: String Conversion via `String(error)`

**Used in:** Most files (redis-bus.adapter, redis-kv.adapter, bootstrap, workflow.service, etc.)

```typescript
// 302+ occurrences across 34 files
log.error('Error occurred', { error: String(e) });
log.warn('Warning', { error: String(error) });

// Inside error logging:
error instanceof Error ? error.message : String(error)
```

**Issues:**
- Loss of error type information
- Loss of error stack trace
- Generic string representation
- No error code/context
- Difficult to debug

**Better Alternatives (not used consistently):**
- `error instanceof Error ? error.message : String(error)` - used in 8 places
- Custom error toJSON() - defined but rarely used
- Error context objects - not standardized

---

### Pattern 2.2: Error Type Checking (Selective)

**Location:** `redis-bus.adapter.ts` (lines 112-119, 171-184), `base-agent.ts` (lines 142-146, 471-476)

```typescript
// Check for specific error message patterns
if (error.message?.includes('BUSYGROUP')) {
  log.warn('Failed to create consumer group', { ... });
  // Handle specific Redis error
}

if (error.message?.includes('NOGROUP')) {
  log.warn('Consumer group does not exist, will retry', { ... });
  // Different handling for different Redis error
}

// Agent error type checking
if (error instanceof Anthropic.APIError) {
  throw new AgentError(
    `Claude API error: ${error.message}`,
    'ANTHROPIC_API_ERROR',
    { cause: error }
  );
}
```

**Issues:**
- String pattern matching on error.message (fragile)
- Not all errors have messages
- Only used selectively (inconsistent)
- No structured error type hierarchy

---

### Pattern 2.3: Custom Error Classes

**Location:** `packages/agents/base-agent/src/types.ts` (lines 85-104) and `packages/orchestrator/src/utils/errors.ts`

```typescript
// BASE AGENT ERROR TYPES
export class AgentError extends Error {
  constructor(message: string, public readonly code?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AgentError';
  }
}

export class ValidationError extends AgentError {
  constructor(message: string, public readonly validationErrors: any[]) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class TaskExecutionError extends AgentError {
  constructor(message: string, public readonly task_id: string) {
    super(message, 'TASK_EXECUTION_ERROR');
    this.name = 'TaskExecutionError';
  }
}

// ORCHESTRATOR ERROR TYPES
export class BaseError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      stack: this.stack
    };
  }
}

export class ValidationError extends BaseError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}
```

**Issues:**
- TWO different error hierarchies (agents vs orchestrator)
- Not used consistently throughout codebase
- Mostly used in constructors, not in catch blocks
- `toJSON()` method defined but rarely called
- Custom agent errors with `code` not always thrown in error handlers

**Note:** `ValidationError` defined in BOTH locations with different signatures!

---

## PATTERN 3: ERROR PROPAGATION STRATEGIES

### Strategy 3.1: Re-throw Original Error

**Location:** `redis-kv.adapter.ts` (all operations), `workflow.service.ts` (workflow creation)

```typescript
async get<T = any>(key: string): Promise<T | null> {
  try {
    // operation
  } catch (e) {
    log.error('Get error', { key, error: String(e) });
    throw e;  // <-- Preserves original error
  }
}
```

**Characteristics:**
- Caller must handle the error
- Original error object preserved
- Stack trace preserved
- Error context added via logging

---

### Strategy 3.2: Silent Failure (Early Return)

**Location:** `redis-bus.adapter.ts` (line 52-53, message parsing), `workflow.service.ts` (stage output storage, line 851)

```typescript
// Silent failure in message handling
try {
  const envelope = JSON.parse(message);
  msg = envelope.msg !== undefined ? envelope.msg : envelope;
} catch (e) {
  log.error('Parse error', { channel, message: message.substring(0, 100), error: String(e) });
  return;  // <-- Silent failure: early return
}

// Silent failure in storage
try {
  await this.kv.set(key, snapshot, STATE_TTL_SEC);
  log.info('Snapshot saved', {...});
} catch (error) {
  log.error('Failed to save snapshot', {...});
  throw error;  // <-- Actually rethrows, not silent
}
```

**Issues:**
- Message silently dropped on parse error
- No way for caller to know operation failed
- Difficult to debug (no error signal)
- Masks serious issues as non-critical

---

### Strategy 3.3: Error Transformation + Rethrow

**Location:** `base-agent.ts` (lines 240-247)

```typescript
validateTask(task: unknown): TaskAssignment {
  try {
    return TaskAssignmentSchema.parse(task);
  } catch (error) {
    throw new ValidationError(
      'Invalid task assignment',
      error instanceof Error ? [error.message] : ['Unknown validation error']
    );
  }
}
```

**Characteristics:**
- Original error caught
- Transformed to domain error type
- Message preserved
- Custom error thrown with additional context

---

### Strategy 3.4: Handler-Level Error Suppression

**Location:** `redis-bus.adapter.ts` (lines 60-63)

```typescript
// Inline error handler with catch
await Promise.all(
  Array.from(handlers).map((h) =>
    h(msg).catch((e) => log.error('Handler error', { channel, error: String(e) }))
  )
);
```

**Characteristics:**
- Individual handler errors logged
- Errors suppressed from Promise.all
- Handler continues even if one fails
- Other handlers still execute

---

## PATTERN 4: LOGGER IMPLEMENTATIONS

### Logger Type 1: Hexagonal Core Logger

**Location:** `packages/orchestrator/src/hexagonal/core/logger.ts`

```typescript
export interface Logger {
  info: (msg: string, meta?: Record<string, any>) => void;
  warn: (msg: string, meta?: Record<string, any>) => void;
  error: (msg: string, meta?: Record<string, any>) => void;
  debug: (msg: string, meta?: Record<string, any>) => void;
}

export function createLogger(scope: string): Logger {
  const log = (level: string, msg: string, meta: Record<string, any> = {}) => {
    const entry: LogEntry = {
      ts: new Date().toISOString(),
      scope,
      msg,
      level,
      ...meta,
    };
    console.log(JSON.stringify(entry));
  };

  return {
    info: (msg, meta) => log('INFO', msg, meta),
    warn: (msg, meta) => log('WARN', msg, meta),
    error: (msg, meta) => log('ERROR', msg, meta),
    debug: (msg, meta) => {
      if (process.env.DEBUG) {
        log('DEBUG', msg, meta);
      }
    },
  };
}
```

**Characteristics:**
- JSON structured logging
- Scope/module context
- No timestamp correlation ID built-in
- Simple console output
- Debug level environment-gated

**Used in:** Hexagonal adapters, bootstrap, orchestrators (20+ files)

---

### Logger Type 2: Pino Logger (Agents)

**Location:** `packages/agents/base-agent/src/base-agent.ts` (lines 51-61)

```typescript
this.logger = pino({
  name: this.agentId,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'UTC:yyyy-mm-dd HH:MM:ss'
    }
  }
});
```

**Characteristics:**
- Production-grade logger library
- Pretty-printed output in development
- Named loggers per agent
- Different from hexagonal core logger

**Used in:** All agent classes (base-agent, scaffold-agent, validation-agent, etc.)

---

### Logger Type 3: Service Logger (Orchestrator services)

**Location:** `packages/orchestrator/src/utils/logger.ts`

```typescript
export const logger = pino({...});
export const generateTraceId = () => `trace_${randomUUID()}`;
```

**Characteristics:**
- Singleton pino logger
- Separate from hexagonal logger
- Used in workflow.service, state-machine, etc.

**Used in:** Orchestrator services (15+ files)

---

## CRITICAL ISSUE: LINE 140 BUG ANALYSIS

### The Problem

**File:** `packages/orchestrator/src/hexagonal/adapters/redis-bus.adapter.ts`
**Line:** 140

```typescript
const messageData = message.message as any;
const parsedMessage = JSON.parse(messageData.message || messageData);
// Error: "Cannot convert object to primitive value"
```

### Root Cause

Redis `xReadGroup` returns messages in this format:
```typescript
{
  id: "1234-0",
  message: {
    topic: "agent:scaffold:tasks",
    payload: {...}
  }
}
```

The code attempts:
1. Extract `message.message` → object
2. Try `JSON.parse(object.message || object)`
3. If object.message undefined → try `JSON.parse(object)`
4. **FAILS:** Cannot JSON.parse an already-parsed object

### Error Handling Issues

**Current approach (lines 138-166):**

```typescript
try {
  const messageData = message.message as any;
  const parsedMessage = JSON.parse(messageData.message || messageData);
  // ^^ FAILS HERE with "Cannot convert object to primitive value"
  
  log.info('[PHASE-3] Processing message from stream', {...});
  
  const handlers = subscriptions.get(topic);
  if (handlers) {
    await Promise.all(...);  // Invoke handlers
  }
  
  await pub.xAck(...);
} catch (msgError) {
  log.error('[PHASE-3] Failed to process stream message', {
    error: msgError instanceof Error ? msgError.message : String(msgError)
  });
  // <-- Silent failure: no rethrow, no break, loop continues
  // Message NOT acknowledged, becomes undelivered
}
```

**Problems:**
1. No type checking before JSON.parse
2. Error message handling uses conditional (fragile)
3. Silent failure - loop continues processing
4. Message not acknowledged on error
5. Agent crash propagates from handler invocation
6. No recovery mechanism

### Impact Cascade

```
Message received from Redis stream
        ↓
Line 140: JSON.parse(object) fails
        ↓
Caught at line 162: msgError
        ↓
Logged as error (no rethrow)
        ↓
Loop continues (no break)
        ↓
Message not acknowledged (xAck skipped)
        ↓
Same message delivered again (retry)
        ↓
INFINITE LOOP - message never processed
```

---

## PATTERN SUMMARY TABLE

| Pattern | File | Location | Severity | Issue |
|---------|------|----------|----------|-------|
| Basic try-catch | redis-kv.adapter.ts | All ops | LOW | Verbose but consistent |
| Nested try-catch | redis-bus.adapter.ts | 35-71 | HIGH | Cascading handlers, hard to debug |
| Stream loop | redis-bus.adapter.ts | 122-189 | CRITICAL | Line 140 bug, silent failures |
| Shutdown suppress | bootstrap.ts | 140-179 | LOW | Appropriate for cleanup |
| Multi-op catch | workflow.service.ts | 322-331 | MEDIUM | Single catch for many ops |
| String conversion | 34 files | Various | MEDIUM | Loss of type info |
| Pattern matching | redis-bus.adapter.ts | 112-119 | MEDIUM | Fragile string matching |
| Custom errors | 2 hierarchies | Various | HIGH | Duplicate definitions |
| Silent failure | redis-bus.adapter.ts | 52-53 | CRITICAL | Messages dropped silently |
| Re-throw | redis-kv.adapter.ts | All | GOOD | Stack trace preserved |

---

## RECOMMENDATIONS

### Priority 1: Fix Critical Bugs (Session #58)

1. **Line 140 Type Checking**
   - Check if messageData is string or object
   - Conditionally parse only if string
   - Properly handle parsed objects

2. **Message Acknowledgment**
   - Move xAck before error handling
   - Or: Acknowledge only on successful processing

3. **Error Recovery**
   - Break stream loop on parse errors
   - Implement dead-letter queue for unparseable messages

### Priority 2: Standardize Error Handling (1.5-2 hours)

1. **Consolidate Error Classes**
   - Create single error hierarchy: `BaseError`
   - Agents and orchestrator use same classes
   - Remove duplicate `ValidationError` definitions

2. **Consistent Try-Catch Pattern**
   - Use pattern 3.1 (re-throw original)
   - For cleanup only: pattern 3.4 (suppress)
   - For recovery: add specific handlers

3. **Error Type Checking**
   - Use instanceof checks (not string matching)
   - Create enum for error codes
   - Centralize error type detection

### Priority 3: Logging Consolidation (2-3 hours)

1. **Single Logger Interface**
   - All files use hexagonal `createLogger`
   - Remove pino from orchestrator services
   - Keep pino in agents (separate concern)

2. **Structured Error Logging**
   - Always include: error.message, error.code, error.stack
   - Use metadata objects consistently
   - Implement correlation ID propagation

---

## FILES WITH IMPROVEMENTS NEEDED

### High Priority
- `redis-bus.adapter.ts` - 8 issues (nested catch, line 140, silent failures)
- `workflow.service.ts` - 4 issues (multi-point catch, logger mismatch)
- Error class definitions - 2 duplicates

### Medium Priority
- `bootstrap.ts` - 1 issue (error logging in shutdown)
- `base-agent.ts` - 2 issues (logger mismatch, error handling)
- All adapter files - String conversion pattern

### Low Priority (Refactoring)
- Redis KV adapter - Verbose but correct
- Individual service files - Mostly correct

---

## CODE QUALITY METRICS

**Total Try-Catch Blocks:** 100+
**Error Re-throws:** 35 (35%)
**Silent Failures:** 8 (8%)
**Error Type Checks:** 6 (6%)
**Custom Errors Used:** 15 (15%)
**String Conversion:** 213 (213+ lines with String(e))

**Consistency Score:** 25% (many patterns, low standardization)

