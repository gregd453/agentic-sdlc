# Logging Patterns Quick Reference

## File Locations

### Logger Implementations

| File | Pattern | Type | LOC | Purpose |
|------|---------|------|-----|---------|
| `/packages/orchestrator/src/utils/logger.ts` | Pino + AsyncLocalStorage | Production | 229 | Main orchestrator logger with distributed tracing |
| `/packages/orchestrator/src/hexagonal/core/logger.ts` | Scoped JSON | Adapter | 67 | Hexagonal layer lightweight logger |
| `/packages/shared/redis-core/src/core/logger.ts` | Functional | Utility | 39 | Minimal shared utility logger |
| `/packages/orchestrator/src/middleware/observability.middleware.ts` | Pino consumer | Middleware | 255 | Request/response observability middleware |

### Usage Distribution

| Component | Logger Type | File Count | Log Instances | Markers |
|-----------|-------------|-----------|----------------|---------|
| Orchestrator Services | Pino | 15+ | ~130+ | [SESSION #*], [PHASE-3] |
| Hexagonal Adapter | Scoped JSON | 1 | ~20 | [PHASE-3] |
| Agent (Base) | Pino | 1 | ~50 | [PHASE-3] |
| Agent (Startup) | console.log | 3 | ~10 | [PHASE-3] |
| Shared Utilities | Functional | 2 | ~5 | None |

---

## Logger Comparison Matrix

```
                  Pino         Scoped JSON    Functional     console.log
                  (Orch)       (Hex)          (Shared)       (Agent Init)
─────────────────────────────────────────────────────────────────────────
Library:          pino v8      Custom         Custom         Built-in
Log Levels:       6            4              1              N/A
Async Context:    YES          NO             NO             NO
Error Stack:      YES          String         String         NO
Formatters:       YES          Custom         Custom         NO
Pretty-print:     YES (dev)    NO             NO             NO
JSON (prod):      YES          YES            YES            NO
Timestamp Field:  "timestamp"  "ts"           "ts"           N/A
Level Format:     lowercase    UPPERCASE      N/A            N/A

Primary Use:      Main app     Adapters       Tests          Startup
Files:            25+          1              2              3
Total Logs:       ~130         ~20            ~5             ~10
```

---

## [PHASE-3] Diagnostic Markers Distribution

### By Component

**Orchestrator Services (4 markers)**
- workflow.service.ts:37 - messageBus received
- workflow.service.ts:39 - messageBus NOT available
- workflow.service.ts:478 - task dispatched via message bus
- workflow.service.ts:487 - messageBus not available for dispatch

**Redis Bus Adapter (9 markers)**
- Line 111, 114 - Consumer group creation
- Line 123 - Stream consumer starting
- Line 142 - Message processing
- Line 154, 163 - Error handling
- Line 172, 178 - Retry/error states
- Line 187, 188 - Consumer stopped/crashed

**Base Agent (8 markers)**
- base-agent.ts:106 - Agent initialized
- base-agent.ts:120 - Subscribing to tasks
- base-agent.ts:134 - Task received
- base-agent.ts:142 - Task processing failed
- base-agent.ts:155 - Subscribed success
- base-agent.ts:163 - Initialization complete
- base-agent.ts:354 - Result mirrored
- base-agent.ts:361 - Mirror failed

**Agent Startup (6 markers)**
- scaffold-agent/run-agent.ts:21, 29
- validation-agent/run-agent.ts:13, 21
- e2e-agent/run-agent.ts:13, 21

**Total: 27 Phase-3 Markers**

---

## [SESSION #*] Historical Markers

**Session #25 Hardening (12 references)**
- Redis deduplication logic
- Distributed lock acquire/release
- Event deduplication
- Stage mismatch detection
- Truth table validation

**Session #30 (1 reference)**
- Stage output storage

**Session #32 (1 reference)**
- Validation payload building

**Session #36 (2 references)**
- Agent envelope creation

**Session #37 (1 reference)**
- Stage extraction debug

**Total: 17+ Session Markers**

---

## Error Handling Patterns Found

### Pattern Distribution

```
Pattern A (instanceof check):      12+ instances
  - workflow.service.ts
  - health-check.service.ts
  - base-agent.ts

Pattern B (String() conversion):   8+ instances
  - redis-bus.adapter.ts

Pattern C (Direct pass-through):   5+ instances
  - workflow.service.ts (.catch)

Pattern D (Full error object):     3+ instances
  - middleware/observability.ts
```

### Error Context Fields Used

```
Most Common:
- error.message          (100%)
- error.stack            (60%)
- Additional context     (70%)

Inconsistent:
- Stack trace presence   (40-60%)
- Error name field       (30%)
- Error serialization    (3 patterns)
```

---

## Log Level Usage

### Orchestrator (Pino)

```
INFO  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ~65% (85+)
      - State transitions
      - Task dispatch/completion
      - Business logic flow

WARN  ▓▓▓▓                ~15% (20+)
      - Missing resources
      - Retry attempts
      - Defensive gates

ERROR ▓▓▓▓▓              ~20% (25+)
      - Exceptions
      - Failed operations
      - Schema breaches
```

### Hexagonal Adapter (Scoped JSON)

```
INFO  ▓▓▓▓▓▓▓▓▓▓▓        ~60% (12+)
WARN  ▓▓▓                ~15% (3)
ERROR ▓▓▓▓▓              ~25% (5+)
```

---

## Critical Code Locations

### Logger Definition Files

```bash
# Pino-based logger (Orchestrator)
/packages/orchestrator/src/utils/logger.ts
  Lines: 1-229
  Exports: logger, StructuredLogger, requestContext

# Scoped JSON logger (Hexagonal)
/packages/orchestrator/src/hexagonal/core/logger.ts
  Lines: 1-67
  Exports: createLogger, Logger, LogEntry

# Functional logger (Shared)
/packages/shared/redis-core/src/core/logger.ts
  Lines: 1-39
  Exports: makeLogger, makeLoggerWith, Log type
```

### High-Volume Usage Files

```bash
# Orchestrator workflow service (main business logic)
/packages/orchestrator/src/services/workflow.service.ts
  Logger calls: ~100+ instances
  Markers: [PHASE-3] (4), [SESSION #*] (12+)
  Patterns: All error handling patterns A-D

# Base agent (task execution)
/packages/agents/base-agent/src/base-agent.ts
  Logger calls: ~50+ instances
  Markers: [PHASE-3] (8), [SESSION #37] (1)
  Pattern: Pino + try-catch

# Redis bus adapter (message handling)
/packages/orchestrator/src/hexagonal/adapters/redis-bus.adapter.ts
  Logger calls: ~20 instances
  Markers: [PHASE-3] (9)
  Pattern: Scoped JSON, Promise.catch()
```

---

## Consolidation Opportunities

### Low-Hanging Fruit (1-2 hours each)

1. **Add Try-Catch to Message Bus Publish**
   - Location: workflow.service.ts:478
   - Risk: Task loss on publish failure
   - Fix: Wrap publish in try-catch with error logging

2. **Standardize Error Serialization**
   - Use Pattern A (instanceof Error check) everywhere
   - Add stack traces consistently
   - Replace Pattern B & D with Pattern A

3. **Agent Startup Console.log → Structured Logger**
   - Replace direct console.log in run-agent.ts
   - Use StructuredLogger for startup diagnostics
   - Preserve [PHASE-3] markers

### Medium-Effort Consolidation (4-8 hours)

4. **Create Single Logger Interface**
   - Unified interface across all packages
   - Single error serialization strategy
   - Consistent timestamp/level fields

5. **Migrate Scoped JSON → Pino**
   - Convert redis-bus.adapter.ts
   - Use logger.child() for scoping
   - Maintain [PHASE-3] markers

### Full Consolidation (16+ hours)

6. **Replace All Three Implementations**
   - Create @agentic-sdlc/shared-logger package
   - Unify to single Pino-based logger
   - Add testing support (makeLoggerWith equivalent)

---

## Files Modified by Each Pattern

### Pino-based Logger Used In:

```
Services:
  - services/workflow.service.ts
  - services/health-check.service.ts
  - services/scaffold-workflow.service.ts
  - services/pipeline-executor.service.ts
  - services/graceful-shutdown.service.ts
  - services/decision-gate.service.ts
  - services/quality-gate.service.ts

Routes:
  - api/routes/pipeline.routes.ts
  - api/routes/workflow.routes.ts

Utilities:
  - utils/logger.ts
  - utils/metrics.ts

Middleware:
  - middleware/observability.middleware.ts

Other:
  - server.ts
  - repositories/workflow.repository.ts
  - state-machine/workflow-state-machine.ts
  - events/event-bus.ts
  - websocket/pipeline-websocket.handler.ts
  - integrations/github-actions.integration.ts
```

### Scoped JSON Logger Used In:

```
Core:
  - hexagonal/core/logger.ts

Adapters:
  - hexagonal/adapters/redis-bus.adapter.ts
```

### Functional Logger Used In:

```
Core:
  - shared/redis-core/src/core/logger.ts

Utilities:
  - shared/utils/src/redis-subscription.ts (potential)
```

### console.log Used In:

```
Startup:
  - agents/scaffold-agent/src/run-agent.ts
  - agents/validation-agent/src/run-agent.ts
  - agents/e2e-agent/src/run-agent.ts
```

---

## Key Statistics

| Metric | Count |
|--------|-------|
| Total Logger Files | 4 |
| Total Logger Implementations | 3 |
| Files Using Loggers | 25+ |
| Log Instances (Total) | ~165+ |
| [PHASE-3] Markers | 27 |
| [SESSION #*] Markers | 17+ |
| Error Handling Patterns | 4 |
| Timestamp Field Names | 2 ("timestamp", "ts") |
| Log Level Sets | 2 (6 levels, 4 levels) |
| Scope Indicators | 2 ("component", "scope") |
| Level Format Variations | 2 (lowercase, UPPERCASE) |

---

## Audit Checklist

- [x] Identified 3 distinct logger implementations
- [x] Catalogued 27 [PHASE-3] diagnostic markers
- [x] Found 4+ error handling patterns
- [x] Mapped 25+ files using loggers
- [x] Calculated log level distribution
- [x] Identified consolidation opportunities
- [x] Documented context propagation methods
- [x] Analyzed timestamp/format inconsistencies
- [x] Found missing error handling (task dispatch)
- [x] Identified unstructured startup logging

---

**Quick Reference Version:** 1.0
**Generated:** 2025-11-13
**Scope:** Complete codebase logging analysis
