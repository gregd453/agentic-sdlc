# ERROR HANDLING PATTERNS - QUICK REFERENCE
## Agent SDLC Codebase (Session #57)

---

## 5 TRY-CATCH PATTERNS IDENTIFIED

### Pattern 1: Basic Try-Catch + Re-throw (BEST PRACTICE)
```typescript
try {
  // operation
} catch (e) {
  log.error('Operation failed', { error: String(e) });
  throw e;  // Preserves stack trace
}
```
**Used in:** redis-kv.adapter.ts (all operations)  
**Verdict:** Clean, consistent, error preserved

---

### Pattern 2: Nested Try-Catch (PROBLEMATIC)
```typescript
try {
  await sub.pSubscribe('*', async (message) => {
    try {
      // ... multiple nested levels ...
    } catch (e) {
      log.error('Error', { error: String(e) });
      return;  // Silent failure
    }
  });
} catch (e) {
  log.error('Error', { error: String(e) });
}
```
**Used in:** redis-bus.adapter.ts (lines 35-71)  
**Verdict:** Hard to debug, cascading handlers

---

### Pattern 3: Stream Loop + Conditional Handling (CRITICAL BUG)
```typescript
while (subscriptions.has(topic)) {
  try {
    const results = await pub.xReadGroup(...);
    for (const message of results) {
      try {
        const parsedMessage = JSON.parse(messageData.message || messageData);
        // ^^ Line 140: BUG - Double parse attempt
        await pub.xAck(...);
      } catch (msgError) {
        log.error('Failed to process', { error: String(msgError) });
        // Silent failure - loop continues
      }
    }
  } catch (error: any) {
    if (error.message?.includes('NOGROUP')) {
      // Retry logic
    } else if (!subscriptions.has(topic)) {
      break;
    } else {
      // Continue with delay
    }
  }
}
```
**Used in:** redis-bus.adapter.ts (lines 122-189)  
**Verdict:** Line 140 causes crashes, silent failures

---

### Pattern 4: Shutdown Error Suppression (APPROPRIATE)
```typescript
async shutdown(): Promise<void> {
  for (const orch of this.orchestrators) {
    try {
      await orch.stop();
    } catch (e) {
      log.warn('Error stopping', { error: String(e) });
      // Suppress error - cleanup continues
    }
  }
}
```
**Used in:** bootstrap.ts (lines 140-179)  
**Verdict:** Correct for cleanup operations

---

### Pattern 5: Multi-Operation Catch (SINGLE POINT OF FAILURE)
```typescript
async createWorkflow(request): Promise<WorkflowResponse> {
  try {
    const workflow = await this.repository.create({...});
    const stateMachine = this.stateMachineService.createStateMachine(...);
    await this.eventBus.publish({...});
    // Multiple failure points in single catch
  } catch (error) {
    logger.error('Failed to create workflow', { error, request });
    throw error;
  }
}
```
**Used in:** workflow.service.ts  
**Verdict:** Works but hard to isolate failure point

---

## ERROR CONVERSION METHODS

### Method 1: String Conversion (213+ occurrences)
```typescript
log.error('Error', { error: String(e) });
```
**Issue:** Loses type info, stack trace, error code

### Method 2: Conditional Error Message
```typescript
error instanceof Error ? error.message : String(error)
```
**Used in:** 8 places (redis-bus.adapter.ts, base-agent.ts)  
**Issue:** Still loses stack trace and code

### Method 3: Custom Error Classes
```typescript
export class AgentError extends Error {
  constructor(message: string, code?: string, options?: ErrorOptions) {
    super(message, options);
  }
}
```
**Issue:** Defined in 2 places with different signatures (duplication)

---

## ERROR PROPAGATION STRATEGIES

| Strategy | Approach | Best For | Issues |
|----------|----------|----------|--------|
| **Re-throw** | `throw e;` | Normal ops | Caller must handle |
| **Silent failure** | `return;` | (Avoid) | Messages lost, hard to debug |
| **Error transform** | `throw new AgentError(...)` | Domain errors | Loss of original stack |
| **Suppress** | `catch(e) { log.warn(...) }` | Cleanup | Errors hidden |

---

## 3 LOGGER IMPLEMENTATIONS

### Logger 1: Hexagonal Core Logger (20+ files)
```typescript
import { createLogger } from '../hexagonal/core/logger';
const log = createLogger('module-name');
log.error('Error', { key: 'value' });
```
**Output:** JSON structured logging  
**Scope:** Adapters, bootstrap, orchestrators

### Logger 2: Pino Logger (Agents)
```typescript
import pino from 'pino';
this.logger = pino({ name: 'agent-name' });
this.logger.error('Error', { key: 'value' });
```
**Output:** Pretty-printed (dev) or JSON (prod)  
**Scope:** All agent classes

### Logger 3: Singleton Pino (Services)
```typescript
import { logger } from '../utils/logger';
logger.error('Error', { key: 'value' });
```
**Output:** Pino format  
**Scope:** Orchestrator services

**Problem:** 3 different implementations, inconsistent observability

---

## CRITICAL BUG: Line 140 Breakdown

**File:** `redis-bus.adapter.ts`  
**Line:** 140

```typescript
const messageData = message.message as any;  // Already parsed object from Redis
const parsedMessage = JSON.parse(messageData.message || messageData);
// ❌ FAILS: Cannot convert object to primitive value
```

### Root Cause
Redis `xReadGroup` returns:
```typescript
{
  id: "1234-0",
  message: {
    topic: "agent:scaffold:tasks",
    payload: {...}
  }
}
```

Code tries:
1. Get `message.message` → object
2. Try `JSON.parse(object.message)` → undefined
3. Fallback: `JSON.parse(object)` → **FAILS**

### Error Handling Issues
1. ❌ No type check before parse
2. ❌ Silent failure (early return)
3. ❌ Message not acknowledged
4. ❌ Infinite loop of undelivered messages
5. ❌ Agent crashes when processing handler

### Impact
```
Message received
    ↓
Parse fails (Line 140)
    ↓
Silent failure (return on line 166)
    ↓
Message NOT acknowledged
    ↓
Same message redelivered
    ↓
INFINITE LOOP - E2E tests hang forever
```

---

## RECOMMENDATIONS BY PRIORITY

### Priority 1: Fix Critical Bug (30 minutes)
1. **Type check before JSON.parse**
   ```typescript
   if (typeof messageData === 'string') {
     const parsed = JSON.parse(messageData);
   } else {
     const parsed = messageData;  // Already parsed
   }
   ```

2. **Ensure message acknowledgment**
   ```typescript
   try {
     // ... process ...
     await pub.xAck(streamKey, consumerGroup, message.id);
   } catch (error) {
     log.error('Failed', { error: ... });
     // Still acknowledge or move to DLQ
   }
   ```

3. **Break on parse errors**
   ```typescript
   if (parseError) {
     log.error('Unparseable message', { id: message.id });
     await pub.xAck(...);  // Acknowledge to remove from stream
     continue;  // Skip to next message
   }
   ```

---

### Priority 2: Standardize Error Handling (1-2 hours)

**Goal:** Consistency across codebase

1. **Single error class hierarchy**
   - Consolidate `AgentError` and `BaseError`
   - Remove duplicate `ValidationError`
   - Use enum for error codes

2. **Standardize try-catch pattern**
   - Use Pattern 1 (catch, log, re-throw)
   - Exception: Pattern 4 for cleanup only

3. **Error type checking**
   - Use `instanceof` (not string matching)
   - Create error code enum
   - Centralize error type detection

---

### Priority 3: Logging Consolidation (2-3 hours)

**Goal:** Single logger interface across system

1. **All modules use hexagonal logger**
   ```typescript
   import { createLogger } from '@agentic-sdlc/orchestrator/hexagonal/core/logger';
   const log = createLogger('module-name');
   ```

2. **Structured error logging**
   - Always include: message, code, stack
   - Use metadata objects
   - Implement correlation ID

---

## METRICS

| Metric | Value | Status |
|--------|-------|--------|
| Total try-catch blocks | 100+ | Need standardization |
| Error re-throws | 35 (35%) | LOW - should be 80%+ |
| Silent failures | 8 (8%) | HIGH - should be 0% |
| Error type checks | 6 (6%) | LOW - should be 30%+ |
| Custom errors used | 15 (15%) | LOW - should be 50%+ |
| Logger consistency | 25% | CRITICAL - 3 different implementations |

---

## FILES REQUIRING CHANGES

### High Priority (Critical/Blocking)
- `redis-bus.adapter.ts` - Line 140 bug + 7 other issues
- Error class definitions - Duplicate ValidationError

### Medium Priority (Code Quality)
- `workflow.service.ts` - Multi-point error handling
- `bootstrap.ts` - Error logging in shutdown
- `base-agent.ts` - Logger mismatch

### Low Priority (Refactoring)
- All adapters - String conversion pattern
- Services - Logger mismatch
- Repositories - Try-catch standardization

---

## DOCUMENT REFERENCE

Full analysis: `/Users/Greg/Projects/apps/zyp/agent-sdlc/ERROR_HANDLING_ANALYSIS.md` (804 lines)

Sections:
1. Executive Summary
2. Pattern 1: Try-Catch Block Variations (5 patterns)
3. Pattern 2: Error Conversion & Typing (3 approaches)
4. Pattern 3: Error Propagation Strategies (4 strategies)
5. Pattern 4: Logger Implementations (3 types)
6. Critical Issue: Line 140 Bug Analysis
7. Pattern Summary Table
8. Recommendations & Priority
9. Code Quality Metrics

