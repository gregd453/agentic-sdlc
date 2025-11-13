# Logging Patterns Analysis - Agent SDLC Codebase

## Overview

This document provides a comprehensive analysis of logging implementations across the agent-sdlc codebase. Three distinct logging patterns were discovered, each with different architectural approaches, formatting conventions, and use cases.

---

## 1. STRUCTURED LOGGER (Pino-based) - Orchestrator Primary

**Location:** `/packages/orchestrator/src/utils/logger.ts`

**Library:** Pino v8 with optional pretty-printing

### Architecture

```typescript
// Pino-based structured logger with AsyncLocalStorage for request context
import pino from 'pino';
import { AsyncLocalStorage } from 'async_hooks';

// Distributed tracing via AsyncLocalStorage
const requestContext = new AsyncLocalStorage<RequestContext>();

export const logger = pino({
  name: 'orchestrator',
  level: process.env.LOG_LEVEL || 'info',
  transport: isDevelopment 
    ? { target: 'pino-pretty', ... }  // Pretty-printed in dev
    : undefined                         // JSON in production
});
```

### Key Features

- **Log Levels:** trace, debug, info, warn, error, fatal (6 levels)
- **Automatic Context:** Request ID, Trace ID, Correlation ID, User ID, Session ID
- **Log Format:**
  - Development: Pretty-printed with colors and timestamps
  - Production: JSON format with ISO timestamps
- **Duration Tracking:** Built-in operation timing via `logOperation()`
- **Error Context:** Stack traces included automatically
- **Child Loggers:** `logger.child(context)` for module-specific loggers

### Interface: StructuredLogger Class

```typescript
export class StructuredLogger {
  constructor(private component: string) { ... }
  
  // Main log method
  log(entry: LogEntry): void { ... }
  
  // Convenience methods
  trace(message, context?): void
  debug(message, context?): void
  info(message, context?): void
  warn(message, context?): void
  error(message, error?, context?): void
  fatal(message, error?, context?): void
  
  // Automatic duration tracking
  async logOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: Record<string, unknown>
  ): Promise<T> { ... }
}
```

### Usage Example (Orchestrator Services)

```typescript
// Import
import { logger, generateTraceId } from '../utils/logger';

// Simple info log with context
logger.info('[PHASE-3] WorkflowService received messageBus from container');

// Info log with rich context
logger.info('[WF:CONSTRUCTOR:START] WorkflowService instance created', {
  timestamp: new Date().toISOString(),
  messageBusAvailable: !!messageBus,
  stack: new Error().stack?.split('\n').slice(0, 5).join(' | ')
});

// Error logging
logger.error('[SESSION #25 HARDENING] Redis dedup check failed', {
  error: err,
  workflowId,
  stage
});

// Structured workflow event tracking
logger.info('[WF:TASK_COMPLETED:RECV] Task completed event received', {
  workflow_id: event.payload?.workflow_id,
  task_id: event.payload?.task_id,
  stage: event.payload?.stage,
  timestamp: new Date().toISOString()
});
```

### Files Using Pino Logger

**Orchestrator Services:**
- `/packages/orchestrator/src/services/workflow.service.ts`
- `/packages/orchestrator/src/services/health-check.service.ts`
- `/packages/orchestrator/src/utils/logger.ts`
- `/packages/orchestrator/src/middleware/observability.middleware.ts`

---

## 2. SCOPED JSON LOGGER - Hexagonal Core

**Location:** `/packages/orchestrator/src/hexagonal/core/logger.ts`

**Pattern:** JSON-serialized logs with scope metadata

### Architecture

```typescript
/**
 * Scoped JSON logger for hexagonal layer
 */
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
      ...meta
    };
    console.log(JSON.stringify(entry));
  };
  // ...
}
```

### Key Features

- **Log Levels:** INFO, WARN, ERROR, DEBUG (4 levels)
- **Scope-based Organization:** Each module/service registers a scope
- **JSON Output:** Always serializes to console.log() as JSON string
- **Timestamp Format:** ISO 8601 (same as Pino)
- **Correlation IDs:** Optional via `withCorrelation()` helper
- **Minimal Overhead:** Simple functions, no complex formatting

### LogEntry Structure

```typescript
interface LogEntry {
  ts: string;              // ISO 8601 timestamp
  scope: string;          // Module/service name
  msg: string;            // Log message
  level?: string;         // Log level
  corrId?: string;        // Optional correlation ID
  [key: string]: any;     // Additional metadata
}
```

### Usage Example (Redis Bus Adapter)

```typescript
// Import
import { createLogger } from '../core/logger';

const log = createLogger('redis-bus');

// Simple info log
log.info('Bus initialized with node-redis v4');

// Info with context
log.info('[PHASE-3] Created consumer group for stream', { 
  streamKey, 
  consumerGroup 
});

// Error with context
log.error('[PHASE-3] Stream handler error', { 
  error: String(e) 
});

// Debug (conditional)
log.debug('No handlers for channel', { channel });
```

### Output Format

```json
{"ts":"2025-11-13T10:30:45.123Z","scope":"redis-bus","msg":"Bus initialized","level":"INFO"}
{"ts":"2025-11-13T10:30:46.456Z","scope":"redis-bus","msg":"Published","level":"INFO","topic":"agent:scaffold:tasks","receivers":5}
```

### Files Using Scoped JSON Logger

**Hexagonal Architecture:**
- `/packages/orchestrator/src/hexagonal/core/logger.ts`
- `/packages/orchestrator/src/hexagonal/adapters/redis-bus.adapter.ts`

---

## 3. SIMPLE FUNCTIONAL LOGGER - Redis Core & Tests

**Location:** `/packages/shared/redis-core/src/core/logger.ts`

**Pattern:** Minimal functional API with custom output support

### Architecture

```typescript
export type Log = (msg: string, meta?: Record<string, any>) => void;

export const makeLogger = (scope: string): Log =>
  (msg, meta = {}) => {
    const entry = {
      ts: new Date().toISOString(),
      scope,
      msg,
      ...meta
    };
    console.log(JSON.stringify(entry));
  };

// Testing variant with custom output
export const makeLoggerWith = (scope: string, output: (msg: string) => void): Log =>
  (msg, meta = {}) => {
    const entry = { ts: new Date().toISOString(), scope, msg, ...meta };
    output(JSON.stringify(entry));
  };
```

### Key Features

- **Minimal API:** Single Log function type
- **Functional Style:** Factory pattern, no classes
- **Testing Support:** `makeLoggerWith()` for custom output
- **Simple Structure:** Timestamp + scope + message + metadata
- **No Log Levels:** Single output method (suitable for shared utilities)

### Usage Example (Shared Utilities)

```typescript
import { makeLogger } from '@agentic-sdlc/shared-redis-core/core/logger';

const log = makeLogger('subscription-handler');

log('Redis subscription initialized', { redisUrl });
log('Message received', { channel, messageType });
```

### Files Using Functional Logger

**Shared Libraries:**
- `/packages/shared/redis-core/src/core/logger.ts`
- Used in test fixtures and utilities

---

## 4. CONSOLE.LOG (Simple Direct) - Agent Startup

**Location:** Agent `run-agent.ts` files

**Pattern:** Direct console.log for startup phase diagnostics

### Architecture

```typescript
// Agent initialization uses direct console.log
console.log('🚀 Starting Scaffold Agent...');
console.log('[PHASE-3] Initializing OrchestratorContainer for scaffold agent...');
console.log('[PHASE-3] OrchestratorContainer initialized successfully');
console.log('✅ Scaffold Agent running and listening for tasks');
```

### Key Features

- **Quick Feedback:** Direct to stdout without parsing
- **Diagnostic Markers:** [PHASE-3] prefixes for operation tracking
- **Emoji Support:** For visual distinction during startup
- **No Formatting:** Raw console output

### Usage Pattern

```typescript
// Startup phase
console.log('[PHASE-3] Initializing OrchestratorContainer...');

// Error handling
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY not configured');
  process.exit(1);
}

// Success indicators
console.log('✅ Scaffold Agent running and listening for tasks');
```

### Files Using Direct Console Logging

- `/packages/agents/scaffold-agent/src/run-agent.ts`
- `/packages/agents/validation-agent/src/run-agent.ts`
- `/packages/agents/e2e-agent/src/run-agent.ts`

### Pino Logger (Agent Component)

Agents use Pino for actual execution logging:

```typescript
// BaseAgent initialization
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

---

## 5. DIAGNOSTIC MARKERS - [PHASE-3] Tags

**Purpose:** Tracking architectural implementation progress

### All [PHASE-3] Occurrences

**Orchestrator:**
```
workflow.service.ts:37    - WorkflowService receives messageBus
workflow.service.ts:39    - messageBus NOT available warning
workflow.service.ts:478   - Task dispatched via message bus
workflow.service.ts:487   - messageBus unavailable error
```

**Redis Bus Adapter:**
```
redis-bus.adapter.ts:111  - Consumer group created for stream
redis-bus.adapter.ts:114  - Failed to create consumer group
redis-bus.adapter.ts:123  - Starting stream consumer
redis-bus.adapter.ts:142  - Processing message from stream
redis-bus.adapter.ts:154  - Stream handler error
redis-bus.adapter.ts:163  - Failed to process stream message
redis-bus.adapter.ts:172  - Consumer group doesn't exist (retry)
redis-bus.adapter.ts:178  - Stream consumer error
redis-bus.adapter.ts:187  - Stream consumer stopped
redis-bus.adapter.ts:188  - Stream consumer crashed
```

**Agent Base:**
```
base-agent.ts:106         - Agent initialized with message bus
base-agent.ts:120         - Subscribing to message bus for tasks
base-agent.ts:134         - Agent received task from message bus
base-agent.ts:142         - Failed to process task from message bus
base-agent.ts:155         - Agent subscribed to message bus (success)
base-agent.ts:163         - Agent initialized successfully with message bus
base-agent.ts:354         - Result mirrored to stream for durability
base-agent.ts:361         - Failed to mirror result to stream
```

**Agent Startup:**
```
run-agent.ts:21/29        - OrchestratorContainer initializing/initialized (all 3 agents)
```

### Count Summary

- **Orchestrator:** 4 markers
- **Redis Bus Adapter:** 9 markers
- **Base Agent:** 8 markers
- **Agent Startup:** 6 markers (2 per agent × 3 agents)
- **Total:** 27 diagnostic markers for Phase 3 tracking

---

## 6. SESSION MARKERS - Implementation Tracking

**Purpose:** Historical session-based implementation references

### Pattern

```
[SESSION #<number>] <description>
[SESSION #<number> <PHASE>] <description>
```

### Examples from Codebase

**Session #25 Hardening:**
```
workflow.service.ts:173  - Redis dedup check failed
workflow.service.ts:190  - Event ID tracked for deduplication
workflow.service.ts:195  - Failed to track event ID in Redis
workflow.service.ts:216  - Distributed lock acquired
workflow.service.ts:224  - Failed to acquire distributed lock
workflow.service.ts:246  - Distributed lock released
workflow.service.ts:250  - Failed to release distributed lock
workflow.service.ts:601  - Collision-proof eventId generated
workflow.service.ts:612  - Event already processed (Redis dedup)
workflow.service.ts:626  - Failed to acquire lock (another worker processing)
workflow.service.ts:649  - Truth table entry for event/context state
workflow.service.ts:672  - Stage mismatch detected (defensive gate)
```

**Session #30:**
```
workflow.service.ts:873  - Stage output stored
```

**Session #32:**
```
workflow.service.ts:1103 - Building validation payload with file_paths
```

**Session #36:**
```
workflow.service.ts:446  - Agent envelope created
workflow.service.ts:974  - Building validation envelope
```

**Session #37:**
```
base-agent.ts:185  - Stage extraction debug logging
```

### Total Session Markers: 25+ historical references

---

## 7. ERROR HANDLING PATTERNS

### Pattern Variations Found

#### Pattern A: Structured Error Logging (Orchestrator)

```typescript
try {
  // Operation
} catch (error) {
  logger.error('Operation failed', {
    operation: 'name',
    error: error instanceof Error ? error.message : String(error),
    workflowId,
    additionalContext
  });
}
```

**Files:** workflow.service.ts, health-check.service.ts

#### Pattern B: Async Error Catching (Redis Bus)

```typescript
.catch(e => 
  log.error('[PHASE-3] Stream handler error', { 
    error: String(e) 
  })
)
```

**Files:** redis-bus.adapter.ts

#### Pattern C: Error Instance Detection (Base Agent)

```typescript
catch (error) {
  this.logger.error('[PHASE-3] Failed to process task', {
    error: error instanceof Error ? error.message : String(error),
    message
  });
}
```

**Files:** base-agent.ts

#### Pattern D: Conditional Error Handling (Async)

```typescript
this.setupMessageBusSubscription().catch(err => {
  logger.error('[PHASE-2] Failed to initialize message bus subscription', { 
    error: err 
  });
});
```

**Files:** workflow.service.ts

### Error Context Consistency

**Issue:** Multiple patterns for error handling:
- Pattern A: Checks `instanceof Error` before extracting message
- Pattern B: Always uses `String(e)` 
- Pattern C: Same as Pattern A
- Pattern D: Passes error directly

**Recommendation:** Standardize on Pattern A (instanceof check)

---

## 8. LOG LEVEL USAGE DISTRIBUTION

### Orchestrator (logger)

- **INFO:** ~65% (85+ instances)
  - Business logic flow
  - State transitions
  - Task dispatch/completion
  - Operation started/completed
  
- **WARN:** ~15% (20+ instances)
  - Missing resources
  - Retry attempts
  - Defensive gates triggered
  - Deprecated operations
  
- **ERROR:** ~20% (25+ instances)
  - Exceptions
  - Failed operations
  - Schema compliance breaches
  - Redis operations failures

### Redis Bus Adapter (scoped logger)

- **INFO:** ~60% (12+ instances)
  - Consumer group creation
  - Message processing
  - Stream operations
  
- **WARN:** ~15% (3 instances)
  - Failed consumer group creation
  - Consumer group doesn't exist
  
- **ERROR:** ~25% (5+ instances)
  - Parse errors
  - Handler errors
  - Consumer crashes

---

## 9. CONTEXT PROPAGATION METHODS

### Method 1: AsyncLocalStorage (Orchestrator)

```typescript
// Global request context
const requestContext = new AsyncLocalStorage<RequestContext>();

// Automatic propagation via mixin
export const logger = pino({
  mixin() {
    const context = requestContext.getStore();
    if (context) {
      return {
        request_id: context.requestId,
        trace_id: context.traceId,
        correlation_id: context.correlationId,
        user_id: context.userId,
        session_id: context.sessionId
      };
    }
    return {};
  }
});
```

**Benefit:** Automatic context injection in all logs within async call chain

### Method 2: Explicit Context Parameters

```typescript
// Passed manually in each log call
logger.info('Task received', {
  task_type: message.type,
  workflow_id: message.workflow_id,
  trace_id: traceId
});
```

**Benefit:** Flexible, explicit about what's logged

### Method 3: Child Loggers

```typescript
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}
```

**Benefit:** Scoped context for module/service

---

## 10. LOG FORMATTING DIFFERENCES

### Orchestrator (Pino) - Development

```
2025-11-13 10:30:45 +00:00 INFO [WF:CONSTRUCTOR:START] WorkflowService instance created
  timestamp: 2025-11-13T10:30:45.123Z
  messageBusAvailable: true
```

### Orchestrator (Pino) - Production

```json
{"level":"info","timestamp":"2025-11-13T10:30:45.123Z","component":"workflow-service","request_id":"uuid","trace_id":"trace-xxx","msg":"[WF:CONSTRUCTOR:START] WorkflowService instance created","messageBusAvailable":true}
```

### Hexagonal (Scoped JSON)

```json
{"ts":"2025-11-13T10:30:45.123Z","scope":"redis-bus","msg":"Published","level":"INFO","topic":"agent:scaffold:tasks","receivers":5}
```

### Simple Functional (Test)

```json
{"ts":"2025-11-13T10:30:45.123Z","scope":"subscription-handler","msg":"Redis subscription initialized","redisUrl":"redis://localhost:6380"}
```

---

## 11. KEY ISSUES & OPPORTUNITIES

### Issue 1: Three Different Logger Implementations

**Current State:**
- Pino (orchestrator/utils) - Full-featured, distributed tracing
- Scoped JSON (hexagonal/core) - Minimal, console.log based
- Functional (shared/redis-core) - Ultra-minimal, testing-friendly

**Impact:**
- Inconsistent log formatting across layers
- Duplicate serialization logic
- Different timestamp precisions (ISO string vs computed)
- Error handling varies by logger type

**Duplication Found:**
- LogEntry serialization: 3 implementations
- Scope/context tagging: 3 patterns
- Error handling: 4+ variations

### Issue 2: No Standardized Error Serialization

**Current Patterns:**
```typescript
// Pattern A: Checks instanceof
error: error instanceof Error ? error.message : String(error)

// Pattern B: Direct String()
error: String(e)

// Pattern C: Full error object
error: { message, stack, name }
```

**Missing:** Stack trace context in some error logs

### Issue 3: Inconsistent Message Structure

**Pino Example:**
```json
{"level":"info","timestamp":"...","msg":"[WF:TASK_COMPLETED] Task completed","workflow_id":"uuid"}
```

**Scoped Example:**
```json
{"ts":"...","scope":"redis-bus","msg":"Published","level":"INFO"}
```

**Differences:**
- Timestamp field name: "timestamp" vs "ts"
- Level format: "info" vs "INFO"
- Scope indicator: "component" vs "scope"

### Issue 4: Console.log in Production Startup

**Location:** Agent run-agent.ts files
**Issue:** Direct console.log output for startup phase
**Risk:** Unstructured logs during critical initialization period

### Issue 5: Missing Try-Catch in Message Bus Publish

**Location:** workflow.service.ts, task dispatch
**Pattern:**
```typescript
await this.messageBus.publish(...);  // No error handling wrapper
```

**Risk:** Task loss without error logging or retry

---

## 12. RECOMMENDED STANDARDIZATION (Future)

### Single Logger Interface Target

```typescript
interface UnifiedLogger {
  // Log levels
  trace(message: string, context?: Record<string, any>): void;
  debug(message: string, context?: Record<string, any>): void;
  info(message: string, context?: Record<string, any>): void;
  warn(message: string, context?: Record<string, any>): void;
  error(message: string, error?: Error, context?: Record<string, any>): void;
  fatal(message: string, error?: Error, context?: Record<string, any>): void;
  
  // With duration
  async logOperation<T>(
    name: string,
    fn: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<T>;
}
```

### Unified LogEntry Format

```typescript
{
  timestamp: ISO8601String,
  level: 'trace'|'debug'|'info'|'warn'|'error'|'fatal',
  message: string,
  scope: string,
  context?: Record<string, any>,
  error?: { message: string; stack?: string; name?: string },
  duration_ms?: number,
  tags?: string[],
  
  // Distributed tracing
  request_id?: string,
  trace_id?: string,
  correlation_id?: string
}
```

### Implementation Pattern

```typescript
// Single factory function
export function createLogger(scope: string, opts?: LoggerOptions): UnifiedLogger
```

**Benefits:**
- Consistent log format across all layers
- Standardized error handling
- Unified timestamp format
- Single error serialization strategy
- Simplified testing

---

## SUMMARY TABLE

| Aspect | Pino (Orchestrator) | Scoped (Hexagonal) | Functional (Shared) | Direct (Agent) |
|--------|---------------------|-------------------|-------------------|----------------|
| **Library** | pino v8 | Custom | Custom | console.log |
| **Log Levels** | 6 (trace-fatal) | 4 (INFO-DEBUG) | 1 (implicit) | N/A |
| **Output Format** | JSON (prod) or Pretty (dev) | JSON | JSON | Raw |
| **Timestamp** | "timestamp" ISO | "ts" ISO | "ts" ISO | N/A |
| **Context Type** | AsyncLocalStorage + explicit | Explicit + metadata | Explicit | N/A |
| **Error Handling** | Object with stack | String() conversion | String() conversion | N/A |
| **Use Cases** | Main orchestrator logic | Hexagonal ports/adapters | Shared utilities & tests | Startup diagnostics |
| **Files** | 25+ files | redis-bus.adapter | redis-core, tests | 3 run-agent files |
| **Total Logs** | ~130+ instances | ~20 instances | ~5 instances | ~10 instances |

---

## CONCLUSION

The codebase currently uses **three distinct logging implementations** optimized for different layers:

1. **Pino-based (Orchestrator)** - Production-ready with distributed tracing
2. **Scoped JSON (Hexagonal)** - Lightweight port/adapter logging
3. **Functional (Shared)** - Minimal, testing-friendly utilities

While this provides flexibility, it introduces:
- Duplication of serialization logic (~16+ hours to consolidate)
- Inconsistent error handling patterns (4+ variations)
- Different timestamp/level field naming
- Potential for message loss in task dispatch (no try-catch)

The [PHASE-3] diagnostic markers (27 total) successfully track message bus integration progress across all layers.

---

**Document Version:** 1.0
**Last Updated:** 2025-11-13
**Analysis Scope:** packages/orchestrator/src, packages/agents/*/src, packages/shared/*/src
