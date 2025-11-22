# Logging Architecture Design - Proper Implementation

**Status:** Design Document | **Updated:** 2025-11-22 | **Version:** 1.0

## Executive Summary

The current logging implementation in `logger.ts` uses a basic approach with manual environment variable checks. This design proposes a proper, production-grade logging architecture using **Pino** (already a dependency) that:

1. ✅ Respects log levels hierarchically (TRACE < DEBUG < INFO < WARN < ERROR < FATAL)
2. ✅ Eliminates manual level checks throughout the codebase
3. ✅ Provides runtime log level configuration (global + module-specific)
4. ✅ Supports structured logging with correlation IDs
5. ✅ Integrates with LOG_LEVEL environment variable (as documented)
6. ✅ Maintains backward compatibility with existing logger interface

---

## Problem Statement

### Current Implementation Issues

```typescript
// Current approach - WRONG
export interface Logger {
  info: (msg: string, meta?: Record<string, any>) => void;
  debug: (msg: string, meta?: Record<string, any>) => void;
  trace: (msg: string, meta?: Record<string, any>) => void;
}

return {
  debug: (msg, meta) => {
    if (process.env.DEBUG) {  // Manual check in every logger instance
      log('DEBUG', msg, meta);
    }
  },
  trace: (msg, meta) => {
    if (process.env.TRACE) {  // Manual check in every logger instance
      log('TRACE', msg, meta);
    }
  },
};
```

**Problems:**
1. ❌ Log level filtering happens at call time (expensive)
2. ❌ Manual environment variable checks repeated in every logger
3. ❌ No hierarchical filtering (e.g., INFO level shows DEBUG too)
4. ❌ Cannot change log levels at runtime
5. ❌ Cannot set module-specific log levels
6. ❌ No optimization for disabled levels (Pino's "child logger" optimization lost)
7. ❌ String concatenation vs structured logging unclear

### Standard Practice

**Proper log level implementation:**
```typescript
// Proper approach - what Pino does
const logger = pino({ level: 'info' }); // Set once at init
logger.debug('msg'); // No-op if level > DEBUG (very fast, almost free)
logger.info('msg');  // Executed only if level >= INFO
logger.trace('msg'); // No-op if level > TRACE
```

**Key benefits:**
- ✅ Log level check happens once at logger creation, not on every call
- ✅ Disabled log levels are near-zero cost (Pino optimizes them away)
- ✅ No code-level environment variable checks needed
- ✅ Log level easily configurable at runtime
- ✅ Module-specific overrides supported

---

## Proposed Architecture

### 1. Core Logger Factory (Replaces `logger.ts`)

**File:** `packages/orchestrator/src/hexagonal/core/logger-factory.ts`

```typescript
import pino, { Logger as PinoLogger } from 'pino';

export interface Logger {
  trace: (msg: string, meta?: Record<string, any>) => void;
  debug: (msg: string, meta?: Record<string, any>) => void;
  info: (msg: string, meta?: Record<string, any>) => void;
  warn: (msg: string, meta?: Record<string, any>) => void;
  error: (msg: string, meta?: Record<string, any>) => void;
  fatal: (msg: string, meta?: Record<string, any>) => void;
  isLevelEnabled: (level: string) => boolean;
}

// Global Pino instance
let globalPinoLogger: PinoLogger;

export function initializeGlobalLogger(level?: string): void {
  const logLevel = level || process.env.LOG_LEVEL || 'info';

  globalPinoLogger = pino({
    level: logLevel,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: process.env.NODE_ENV === 'development',
        translateTime: 'SYS:standard',
        singleLine: false,
      },
    },
  });
}

export function createLogger(scope: string): Logger {
  if (!globalPinoLogger) {
    initializeGlobalLogger();
  }

  const pinoChild = globalPinoLogger.child({ scope });

  return {
    trace: (msg, meta) => pinoChild.trace(meta || {}, msg),
    debug: (msg, meta) => pinoChild.debug(meta || {}, msg),
    info: (msg, meta) => pinoChild.info(meta || {}, msg),
    warn: (msg, meta) => pinoChild.warn(meta || {}, msg),
    error: (msg, meta) => pinoChild.error(meta || {}, msg),
    fatal: (msg, meta) => pinoChild.fatal(meta || {}, msg),
    isLevelEnabled: (level: string) => {
      return pinoChild.isLevelEnabled(level);
    },
  };
}

export function setGlobalLogLevel(level: string): void {
  if (!globalPinoLogger) {
    initializeGlobalLogger(level);
  } else {
    globalPinoLogger.level = level;
  }
}

export function getGlobalLogLevel(): string {
  return globalPinoLogger?.level || 'info';
}
```

### 2. Usage Pattern (No Changes Required)

Existing code just works:
```typescript
const log = createLogger('redis-bus');

log.info('Message', { context: 'value' }); // Always runs if level >= INFO
log.trace('Diagnostic', { data: value }); // No-op if level > TRACE (near-zero cost)
```

**Key difference from current:**
- ✅ `log.trace()` is now a no-op if level > TRACE (not a code-level check)
- ✅ Log level set once at app initialization
- ✅ Can be changed at runtime via `setGlobalLogLevel()`

### 3. Configuration

**Environment variables:**
```bash
# Global level (default: 'info')
LOG_LEVEL=debug

# Pretty printing in dev
NODE_ENV=development

# Raw JSON in production
NODE_ENV=production
```

**Runtime API:**
```typescript
import { setGlobalLogLevel, getGlobalLogLevel } from '@agentic-sdlc/logger-factory';

// Change global level
setGlobalLogLevel('debug');

// Check current level
const level = getGlobalLogLevel(); // Returns 'debug'
```

### 4. Module-Specific Levels (Future Enhancement)

Once integrated, we can add module-specific overrides:

```typescript
// Future: Per-module configuration
const orchestratorLogger = createLogger('orchestrator', { level: 'debug' });
const redisBusLogger = createLogger('redis-bus', { level: 'warn' });
```

---

## Implementation Plan

### Phase 1: Create Logger Factory (1-2 hours)

1. Create `logger-factory.ts` with Pino initialization
2. Implement `createLogger()`, `setGlobalLogLevel()`, `getGlobalLogLevel()`
3. Test with existing logger interface

**Effort:** 1-2 hours | **Risk:** Low

### Phase 2: Update Orchestrator to Use Factory (1-2 hours)

1. Update server.ts initialization to call `initializeGlobalLogger()`
2. Replace all `createLogger()` imports from `logger.ts` → `logger-factory.ts`
3. Remove manual environment variable checks from code
4. Verify TRACE logs now properly conditional

**Effort:** 1-2 hours | **Risk:** Low

**Files to update:**
- `packages/orchestrator/src/index.ts` - Call `initializeGlobalLogger()`
- All `import { createLogger } from './core/logger'` → `from './core/logger-factory'`

### Phase 3: Deprecate Old Logger (30 mins)

1. Mark `logger.ts` as deprecated
2. Export factory from `logger.ts` for backwards compatibility
3. Update documentation

**Effort:** 30 mins | **Risk:** Very low

### Phase 4: Optional - Log Level Endpoint (1-2 hours)

Add REST endpoint for runtime log level changes:

```typescript
// PATCH /api/v1/admin/log-level
{
  "level": "debug"
}

// GET /api/v1/admin/log-level
{
  "level": "info"
}
```

**Effort:** 1-2 hours | **Risk:** Low

---

## Comparison: Before vs After

### Before (Current)
```typescript
// logger.ts
trace: (msg, meta) => {
  if (process.env.TRACE) {  // Manual check every call
    log('TRACE', msg, meta);
  }
}

// redis-bus.adapter.ts (line 139)
console.log('[DEBUG-STREAM-INIT] Stream consumer loop STARTED', {...});

// Manual checks everywhere
```

**Issues:**
- ❌ Manual level checks scattered in code
- ❌ No log level hierarchy
- ❌ Can't change levels at runtime
- ❌ Expensive - checks happen on every call

### After (Proposed)
```typescript
// logger-factory.ts
trace: (msg, meta) => pinoChild.trace(meta || {}, msg)
// Pino handles filtering internally - near-zero cost if disabled

// redis-bus.adapter.ts
log.trace('[DEBUG-STREAM-INIT] Stream consumer loop STARTED', {...});

// Set once at startup:
initializeGlobalLogger(); // Reads LOG_LEVEL env var
// Then all loggers automatically respect level
```

**Benefits:**
- ✅ Proper log level hierarchy (TRACE < DEBUG < INFO < WARN < ERROR)
- ✅ No manual environment checks needed
- ✅ Trace logs are near-zero cost when disabled
- ✅ Can change log levels at runtime
- ✅ Standard industry practice

---

## Log Level Hierarchy

Proper implementation respects this hierarchy:

```
TRACE (10)
  └─ DEBUG (20)
      └─ INFO (30)   ← DEFAULT
          └─ WARN (40)
              └─ ERROR (50)
                  └─ FATAL (60)
```

**If LOG_LEVEL=info, you see:**
- ✅ INFO, WARN, ERROR, FATAL
- ❌ TRACE, DEBUG

**If LOG_LEVEL=debug, you see:**
- ✅ DEBUG, INFO, WARN, ERROR, FATAL
- ❌ TRACE

**If LOG_LEVEL=trace, you see:**
- ✅ TRACE, DEBUG, INFO, WARN, ERROR, FATAL

---

## Current Implementation Gap

The current manual check approach:

```typescript
debug: (msg, meta) => {
  if (process.env.DEBUG) {  // ❌ Only checks DEBUG, not hierarchical
    log('DEBUG', msg, meta);
  }
}
```

Problems:
1. No INFO/WARN/ERROR filtering - only checks a single env var
2. When `LOG_LEVEL=info`, you'd still get DEBUG if DEBUG env var is set
3. Not hierarchical - TRACE and DEBUG are separate checks
4. Manual checks throughout codebase = easy to miss

---

## Quick Reference

### What Pino Does (That We Need)

| Feature | Benefit |
|---------|---------|
| Hierarchical levels | Set LOG_LEVEL=info, automatically hide DEBUG/TRACE |
| Runtime changes | Change log levels without restart |
| Child loggers | Per-module configuration |
| Structured output | JSON or pretty-printed automatically |
| Performance | Disabled levels are near-zero cost |

### Expected Outcomes

1. **Fewer lines of code:**
   - Remove all `if (process.env.DEBUG)` checks
   - Remove all manual level comparisons

2. **Better performance:**
   - TRACE logs when disabled: ~0 microseconds
   - Current implementation: always checks environment variable

3. **Better maintainability:**
   - Standard logging patterns (industry practice)
   - Single source of truth for log levels
   - Runtime configuration support

---

## Backward Compatibility

The new factory can export the same interface:

```typescript
// Existing code just works
const log = createLogger('my-service');
log.info('msg', { data });  // ✅ Works
log.debug('msg', { data }); // ✅ Works
log.trace('msg', { data });  // ✅ Now respects LOG_LEVEL
```

No changes needed in existing code if done carefully.

---

## Testing Strategy

### Unit Tests
```typescript
describe('Logger Factory', () => {
  test('respects LOG_LEVEL environment variable', () => {
    process.env.LOG_LEVEL = 'warn';
    const logger = createLogger('test');
    expect(logger.isLevelEnabled('debug')).toBe(false);
    expect(logger.isLevelEnabled('warn')).toBe(true);
  });

  test('runtime level changes affect all loggers', () => {
    setGlobalLogLevel('debug');
    const logger = createLogger('test');
    expect(logger.isLevelEnabled('trace')).toBe(false);
    expect(logger.isLevelEnabled('debug')).toBe(true);
  });

  test('respects hierarchical filtering', () => {
    setGlobalLogLevel('info');
    const logger = createLogger('test');
    expect(logger.isLevelEnabled('trace')).toBe(false);  // ✅
    expect(logger.isLevelEnabled('debug')).toBe(false);  // ✅
    expect(logger.isLevelEnabled('info')).toBe(true);    // ✅
    expect(logger.isLevelEnabled('warn')).toBe(true);    // ✅
  });
});
```

### Integration Test
```typescript
// Start app with LOG_LEVEL=trace
// Verify TRACE logs appear
// Change to LOG_LEVEL=info (via endpoint)
// Verify TRACE logs disappear
```

---

## Conclusion

The proposed architecture:
- ✅ Uses industry-standard approach (Pino)
- ✅ Respects hierarchical log levels
- ✅ Eliminates manual environment checks
- ✅ Supports runtime configuration
- ✅ Maintains backward compatibility
- ✅ Zero performance cost for disabled levels
- ✅ Documented and well-established library

**Recommendation:** Implement Phase 1-2 in next session for proper logging architecture.
