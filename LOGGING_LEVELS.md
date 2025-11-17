# Application Logging Levels Configuration

**Version:** 1.0 | **Updated:** 2025-11-17 | **Status:** Production Ready

---

## Overview

The Agentic SDLC platform uses **structured logging** with **6 log levels** and **module-specific configuration** for fine-grained control over application visibility.

### Log Levels (Hierarchical)

| Level | Value | Use Case | Visibility | Performance |
|-------|-------|----------|------------|-------------|
| **TRACE** | 10 | Deep diagnostics, variable traces | Max verbosity | Lowest priority |
| **DEBUG** | 20 | Development, debugging issues | High verbosity | Low priority |
| **INFO** | 30 | General information (DEFAULT) | Normal | Standard |
| **WARN** | 40 | Warning conditions | Important messages | Standard |
| **ERROR** | 50 | Error conditions | Failures only | Standard |
| **FATAL** | 60 | System failures | Critical errors | Highest priority |

---

## Environment-Based Configuration

### Development Environment

```bash
NODE_ENV=development
LOG_LEVEL=debug              # Default to debug in dev
VERBOSE=true                 # Enable verbose CLI output
```

**Behavior:**
- Log level: DEBUG (shows debug + info + warn + error + fatal)
- Output: Pretty-printed JSON with colors and timestamps
- Modules: Standard configuration with some overrides

**When to use:**
- Local development
- Debugging issues
- Integration testing
- Feature development

### Production Environment

```bash
NODE_ENV=production
LOG_LEVEL=info               # Default to info in production
DOCKER_ENV=true              # If containerized
```

**Behavior:**
- Log level: INFO (shows info + warn + error + fatal)
- Output: Raw JSON format for log aggregation
- Modules: Standard configuration
- No pretty-printing (performance)

**When to use:**
- Live environments
- Customer deployments
- Performance-critical systems

### Staging Environment

```bash
NODE_ENV=staging
LOG_LEVEL=debug              # Slightly more verbose for troubleshooting
VERBOSE=true
```

**Behavior:**
- Log level: DEBUG (for problem diagnosis)
- Output: Pretty-printed for readability
- Modules: Standard configuration

**When to use:**
- Pre-production testing
- Quality assurance
- Load testing

### Testing Environment

```bash
NODE_ENV=test
LOG_LEVEL=warn               # Minimal output during tests
```

**Behavior:**
- Log level: WARN (suppresses info/debug noise)
- Output: JSON format
- Modules: Overridden to minimize noise

**When to use:**
- Unit tests
- Integration tests
- CI/CD pipelines

---

## Module-Specific Log Levels

### Core Services

#### Orchestrator Service
```
orchestrator: info
- Responsible for workflow coordination
- Critical for system visibility
- Default INFO level appropriate
- Switch to DEBUG when investigating workflow issues
```

#### API Client Service
```
api-client: info
- Handles external API calls
- Normal INFO level for request tracking
- Switch to DEBUG for detailed request/response logging
```

#### Database Service
```
database: info
- Database operations and queries
- INFO level for connection state
- DEBUG for query details
```

#### Config Service
```
config: debug
- Configuration loading and validation
- DEBUG level for precedence tracking
- Helpful during setup and troubleshooting
```

### Agent Services

#### Scaffold Agent
```
scaffold-agent: info
- Project scaffolding operations
- INFO for major steps (initialization, generation, completion)
- DEBUG for file-by-file tracking
```

#### Validation Agent
```
validation-agent: info
- Code validation and linting
- INFO for validation results summary
- DEBUG for detailed error analysis
```

#### E2E Test Agent
```
e2e-test-agent: info
- End-to-end test execution
- INFO for test counts and results
- DEBUG for individual test details
```

#### Integration Agent
```
integration-agent: info
- Integration test execution
- INFO for test summary
- DEBUG for failure analysis
```

#### Deployment Agent
```
deployment-agent: info
- Deployment operations
- INFO for deployment steps
- DEBUG for infrastructure details
```

#### Generic Mock Agent
```
generic-mock-agent: debug
- Test/mock agent for development
- DEBUG by default for testing visibility
- TRACE for behavior executor details
```

### Infrastructure Services

#### Redis/Message Bus
```
redis-bus: info
- Message delivery and acknowledgment
- INFO for message tracking
- DEBUG for stream operations
```

#### Workflow Engine
```
workflow-engine: info
- Workflow definition and routing
- INFO for stage transitions
- DEBUG for routing logic
```

#### Health Check Service
```
health-check: info
- System health monitoring
- INFO for status checks
- DEBUG for detailed metrics
```

#### Analytics Service
```
analytics-service: info
- Metrics and analytics collection
- INFO for event collection
- DEBUG for aggregation details
```

### CLI Services

#### Command Execution
```
cli-commands: info
- User-facing command output
- INFO for normal operation
- DEBUG for command details
```

#### Database CLI
```
cli-database: info
- Database management commands
- INFO for operation status
- DEBUG for query details
```

#### Environment Management
```
cli-environment: info
- Service start/stop operations
- INFO for service status
- DEBUG for process details
```

---

## Log Level Decision Matrix

Use this matrix to determine appropriate log levels for your module:

```
┌─────────────────────────────┬──────────────────┬──────────────┐
│ Message Type                │ Log Level        │ Example      │
├─────────────────────────────┼──────────────────┼──────────────┤
│ Startup messages            │ INFO             │ "Agent started" │
│ Shutdown messages           │ INFO             │ "Shutting down" │
│ Major operations            │ INFO             │ "Workflow executing stage X" │
│ Operation completion        │ INFO             │ "Stage completed: 5.2s" │
│                             │                  │              │
│ Function entry/exit         │ DEBUG            │ "Entering validate()" │
│ Variable values             │ DEBUG            │ "config: {...}" │
│ Decision points             │ DEBUG            │ "Using fallback config" │
│ Loop iterations             │ DEBUG            │ "Processing item 5/100" │
│ Detailed traces             │ TRACE            │ "Stack trace" │
│ Condition evaluation        │ TRACE            │ "if (x > 5): true" │
│                             │                  │              │
│ Deprecation warnings        │ WARN             │ "Deprecated API used" │
│ Performance concerns        │ WARN             │ "Query took 2s (slow)" │
│ Recoverable errors          │ WARN             │ "Retrying request" │
│ Temporary conditions        │ WARN             │ "Cache miss (expected)" │
│                             │                  │              │
│ Failed operations           │ ERROR            │ "Query failed" │
│ Exceptions/crashes          │ ERROR            │ "Caught exception" │
│ Resource exhaustion         │ ERROR            │ "Out of memory" │
│ Connection failures         │ ERROR            │ "DB connection lost" │
│                             │                  │              │
│ System shutdown required    │ FATAL            │ "Critical error" │
│ Unrecoverable state         │ FATAL            │ "State machine corruption" │
│ Total service failure       │ FATAL            │ "Service crashed" │
└─────────────────────────────┴──────────────────┴──────────────┘
```

---

## Runtime Configuration

### Global Level Control

Change global log level at runtime:

```typescript
import { LoggerConfigService } from '@agentic-sdlc/logger-config';

const configService = LoggerConfigService.getInstance();

// Set global level
configService.setGlobalLevel('debug');  // Affects all modules

// Check current level
const level = configService.getGlobalLevel();  // Returns 'debug'
```

### Module-Specific Level Control

Override log level for specific module:

```typescript
const configService = LoggerConfigService.getInstance();

// Override single module
configService.setModuleLevel('deployment-agent', 'trace');

// Override multiple modules
configService.setModuleLevel('scaffold-agent', 'debug');
configService.setModuleLevel('validation-agent', 'info');

// Clear override (back to global)
configService.clearModuleLevel('deployment-agent');
```

### Listening for Changes

Subscribe to log level changes:

```typescript
const listener = (event: LogLevelChangeEvent) => {
  console.log(`Log level changed: ${event.oldLevel} → ${event.newLevel}`);
  console.log(`Affected: ${event.scope}`);  // 'global' or module name
};

configService.subscribe(listener);
```

---

## Configuration Examples

### Debugging Workflow Issues

```bash
# Enable detailed workflow tracing
LOG_LEVEL=debug

# OR target specific agents
# (via runtime API):
configService.setModuleLevel('scaffold-agent', 'trace');
configService.setModuleLevel('validation-agent', 'trace');
configService.setModuleLevel('orchestrator', 'debug');
```

**Expected output:**
- All workflow steps
- Agent execution details
- State transitions
- File operations (scaffold)
- Validation details (validation)

### Debugging Deployment Issues

```bash
LOG_LEVEL=debug
# OR:
configService.setModuleLevel('deployment-agent', 'trace');
configService.setModuleLevel('redis-bus', 'debug');
```

**Expected output:**
- Deployment step-by-step progress
- Infrastructure interactions
- Message bus operations
- Status updates

### Production Issue Investigation

```bash
# Keep info by default but enable debug for problematic service
# (via runtime API during incident):
configService.setGlobalLevel('debug');

# Once fixed:
configService.setGlobalLevel('info');
```

### Performance Profiling

```bash
LOG_LEVEL=warn  # Minimal logging for baseline performance
# Compare against:
LOG_LEVEL=info
# And:
LOG_LEVEL=debug
```

---

## Structured Log Output Format

### Development Output (Pretty-printed)

```
[17:30:45.123] INFO  orchestrator: Workflow execution started
  workflow_id: "wf-123abc"
  workflow_type: "app"
  stage: "initialization"
  trace_id: "trace-456def"
  span_id: "span-789ghi"

[17:30:46.456] DEBUG scaffold-agent: Generating project structure
  files: 127
  size_mb: 2.1
  duration_ms: 1333

[17:30:50.789] WARN  validation-agent: Type errors detected
  errors: 3
  warnings: 5
  files_checked: 45

[17:31:15.012] ERROR deployment-agent: Deployment failed
  error_code: "DEPLOYMENT_TIMEOUT"
  duration_ms: 25000
  retry_available: true
```

### Production Output (JSON)

```json
{"level":"info","time":"2025-11-17T17:30:45.123Z","module":"orchestrator","msg":"Workflow execution started","workflow_id":"wf-123abc","workflow_type":"app","stage":"initialization","trace_id":"trace-456def","span_id":"span-789ghi"}
{"level":"debug","time":"2025-11-17T17:30:46.456Z","module":"scaffold-agent","msg":"Generating project structure","files":127,"size_mb":2.1,"duration_ms":1333}
{"level":"warn","time":"2025-11-17T17:30:50.789Z","module":"validation-agent","msg":"Type errors detected","errors":3,"warnings":5,"files_checked":45}
{"level":"error","time":"2025-11-17T17:31:15.012Z","module":"deployment-agent","msg":"Deployment failed","error_code":"DEPLOYMENT_TIMEOUT","duration_ms":25000,"retry_available":true}
```

### Always Included Fields

Every log entry includes:

```typescript
{
  level: 'info' | 'debug' | 'warn' | 'error' | 'fatal' | 'trace',
  time: '2025-11-17T17:30:45.123Z',      // ISO timestamp
  module: 'service-name',                 // Logger scope
  msg: 'Human readable message',          // Primary message

  // Distributed tracing (auto-injected)
  trace_id: 'uuid',                       // Workflow trace
  span_id: 'uuid',                        // Operation span
  parent_span_id: 'uuid',                 // Parent span reference

  // Optional context
  correlation_id: 'corr-uuid',            // Request correlation
  user_id: 'user-uuid',                   // User context
  session_id: 'session-uuid',             // Session context

  // Custom fields (per operation)
  workflow_id: 'uuid',
  stage: 'string',
  duration_ms: 1234,
  error_code: 'ERROR_CODE',
  // ... any other relevant data
}
```

---

## Best Practices

### ✅ DO

- **Use structured logging:** Always log with context objects, not string concatenation
  ```typescript
  logger.info('Workflow started', { workflowId, type, stage });  // ✅
  ```

- **Include operation context:** trace_id, span_id for correlation
  ```typescript
  logger.info('Operation completed', {
    duration_ms: 1234,
    trace_id: context.trace_id,
    span_id: context.span_id
  });  // ✅
  ```

- **Use appropriate levels:** Not everything is INFO
  ```typescript
  logger.debug('Processing item 45/100');  // ✅ (DEBUG, not INFO)
  logger.warn('Slow query: 2.5s');         // ✅ (WARN, not INFO)
  ```

- **Include error details:** When logging errors
  ```typescript
  logger.error('Operation failed', {
    error_code: 'DB_CONNECTION_FAILED',
    message: error.message,
    stack: error.stack,
    recoverable: true
  });  // ✅
  ```

- **Log entry and exit:** For complex operations
  ```typescript
  logger.debug('Entering workflow execution', { workflowId });
  try {
    // ... operation
  } finally {
    logger.debug('Exiting workflow execution', { duration_ms });
  }  // ✅
  ```

### ❌ DON'T

- **Don't concatenate strings:**
  ```typescript
  logger.info('Workflow ' + workflowId + ' started');  // ❌
  ```

- **Don't use console.log:**
  ```typescript
  console.log('Debug info');  // ❌ (should use logger.debug)
  ```

- **Don't log sensitive data:**
  ```typescript
  logger.info('User data', { password, token });  // ❌
  ```

- **Don't overuse DEBUG level:**
  ```typescript
  logger.debug('Starting');  // ❌ (too frequent)
  ```

- **Don't ignore errors:**
  ```typescript
  try { ... } catch (e) { }  // ❌ (should log error)
  ```

---

## Quick Reference

### Setting Log Level via Environment

```bash
# Global level
export LOG_LEVEL=info

# With verbosity (CLI only)
export VERBOSE=true

# Development with debug
NODE_ENV=development LOG_LEVEL=debug npm start

# Production
NODE_ENV=production LOG_LEVEL=info npm start

# Testing
NODE_ENV=test LOG_LEVEL=warn npm test
```

### Log Level Meanings (Quick)

| Level | Means | Use When |
|-------|-------|----------|
| TRACE | Deepest detail | Debugging specific logic flow |
| DEBUG | Development info | Investigating issues |
| INFO | General info | Normal operations (DEFAULT) |
| WARN | Warning condition | Something unexpected but handled |
| ERROR | Error occurred | Operation failed but system continues |
| FATAL | System failure | Service cannot continue |

### Recommended Production Setup

```yaml
# .env.production
NODE_ENV=production
LOG_LEVEL=info              # Default to INFO
DOCKER_ENV=true             # If containerized

# Module overrides (via API if needed):
# orchestrator: info        # System coordinator - important
# api-client: info          # API interactions
# deployment-agent: info    # Deployments are important
# redis-bus: warn           # Infrastructure - less verbose
# database: info            # DB ops
```

---

## Troubleshooting

### "Not seeing debug logs"

1. Check LOG_LEVEL is set correctly:
   ```bash
   echo $LOG_LEVEL  # Should show debug, trace, or info
   ```

2. Check module-specific overrides aren't preventing output:
   ```typescript
   configService.getModuleLevel('my-module')  // Check override
   ```

3. Check NODE_ENV for pretty-printing:
   ```bash
   echo $NODE_ENV  # development for pretty-print
   ```

### "Too much output in production"

1. Lower log level:
   ```bash
   LOG_LEVEL=warn  # Show only warnings and errors
   ```

2. Override specific modules:
   ```typescript
   configService.setModuleLevel('verbose-module', 'warn');
   ```

3. Check for unintended console.log statements (should be using logger)

### "Missing trace correlation"

1. Ensure LoggerConfigService is initialized:
   ```typescript
   const service = LoggerConfigService.getInstance();
   // Should have trace context injection enabled
   ```

2. Check trace context is being passed through async operations:
   ```typescript
   // In AsyncLocalStorage wrapper
   ```

---

## Configuration Files

### Environment Files

#### `.env` (Development)
```
NODE_ENV=development
LOG_LEVEL=debug
VERBOSE=true
```

#### `.env.production` (Production)
```
NODE_ENV=production
LOG_LEVEL=info
DOCKER_ENV=true
```

#### `.env.test` (Testing)
```
NODE_ENV=test
LOG_LEVEL=warn
```

### Code Configuration

#### Global Default
```typescript
// In packages/shared/logger-config/src/logger-config-service.ts
const DEFAULT_GLOBAL_LEVEL = 'info';
```

#### Module Defaults
```typescript
// Configured per service based on importance
'orchestrator': 'info'           // Critical
'deployment-agent': 'info'       // Important
'redis-bus': 'info'              // Infrastructure
'generic-mock-agent': 'debug'    // Testing
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-11-17 | Initial configuration document |

---

## Related Documentation

- [Logger Config Service](./packages/shared/logger-config/README.md)
- [Structured Logging Guide](./LOGGING_PATTERNS.md)
- [Observability Strategy](./OBSERVABILITY.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
