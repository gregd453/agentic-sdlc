# Logging Implementation Guide

**Quick reference for implementing structured logging in the Agentic SDLC platform**

---

## Quick Start

### 1. Import Logger (TypeScript)

```typescript
import { createLogger } from '@agentic-sdlc/logger-config';

// Create logger with module scope
const logger = createLogger({ component: 'my-service' });
```

### 2. Use Logger (5 Levels)

```typescript
// INFO - General information (most common)
logger.info('Workflow started', { workflowId, type });

// DEBUG - Development/troubleshooting
logger.debug('Processing item', { index, total, itemId });

// WARN - Warning conditions
logger.warn('Slow operation detected', { duration_ms: 2500 });

// ERROR - Errors occurred
logger.error('Operation failed', { error: e.message, code: 'DB_ERROR' });

// FATAL - System cannot continue
logger.fatal('Service crashed', { error: e.message });
```

### 3. Set Log Level

```bash
# Via environment
export LOG_LEVEL=debug

# Or in code (runtime)
import { LoggerConfigService } from '@agentic-sdlc/logger-config';
LoggerConfigService.getInstance().setGlobalLevel('debug');
```

---

## Common Patterns

### Pattern 1: Operation Logging

```typescript
const logger = createLogger({ component: 'workflow-executor' });

async function executeWorkflow(workflowId: string) {
  logger.info('Workflow execution started', { workflowId });

  try {
    const workflow = await loadWorkflow(workflowId);
    logger.debug('Workflow loaded', { stages: workflow.stages.length });

    for (const stage of workflow.stages) {
      logger.info('Executing stage', { stage: stage.name, workflowId });
      const result = await executeStage(stage);
      logger.debug('Stage result', { stage: stage.name, status: result.status });
    }

    logger.info('Workflow execution completed', {
      workflowId,
      duration_ms: Date.now() - startTime,
      status: 'success'
    });
  } catch (error) {
    logger.error('Workflow execution failed', {
      workflowId,
      error: error.message,
      stack: error.stack,
      recoverable: true
    });
    throw error;
  }
}
```

### Pattern 2: Agent Task Execution

```typescript
const logger = createLogger({ component: 'scaffold-agent' });

async function executeTask(task: AgentEnvelope) {
  const { taskId, workflowId } = task;

  logger.info('Task received', { taskId, workflowId });

  try {
    // Step 1: Validate
    logger.debug('Validating task', { taskId });
    await validateTask(task);
    logger.debug('Task validation successful', { taskId });

    // Step 2: Execute
    logger.debug('Starting execution', { taskId });
    const output = await generateScaffold(task.payload);

    // Step 3: Report
    logger.info('Task execution completed', {
      taskId,
      workflowId,
      files_generated: output.files.length,
      duration_ms: Date.now() - startTime
    });

    return { status: 'success', result: output };
  } catch (error) {
    logger.error('Task execution failed', {
      taskId,
      workflowId,
      error_code: error.code,
      error_message: error.message,
      retryable: error.recoverable
    });
    throw error;
  }
}
```

### Pattern 3: Service Initialization

```typescript
const logger = createLogger({ component: 'database-service' });

async function initialize() {
  logger.info('Initializing database service', {
    host: config.db.host,
    port: config.db.port
  });

  try {
    await pool.connect();
    logger.info('Database connection established', {
      connected: true,
      timeout_ms: config.db.timeout
    });

    const migrationVersion = await runMigrations();
    logger.debug('Migrations completed', { version: migrationVersion });

    logger.info('Database service initialization complete');
  } catch (error) {
    logger.fatal('Database initialization failed', {
      error: error.message,
      recovery: 'Check database credentials and connectivity'
    });
    process.exit(1);
  }
}
```

### Pattern 4: Conditional Logging

```typescript
const logger = createLogger({ component: 'api-client' });

async function makeRequest(url: string, options: any) {
  const startTime = Date.now();

  logger.debug('Making request', { url, method: options.method });

  try {
    const response = await fetch(url, options);
    const duration_ms = Date.now() - startTime;

    logger.debug('Request completed', {
      url,
      status: response.status,
      duration_ms
    });

    // Warn if slow
    if (duration_ms > 5000) {
      logger.warn('Slow API request', {
        url,
        duration_ms,
        threshold_ms: 5000
      });
    }

    return response;
  } catch (error) {
    const duration_ms = Date.now() - startTime;
    logger.error('Request failed', {
      url,
      error: error.message,
      duration_ms,
      retryable: error.code !== 'ENOTFOUND'
    });
    throw error;
  }
}
```

### Pattern 5: Structured Logging with Context

```typescript
const logger = createLogger({ component: 'validation-agent' });

async function validateFiles(files: string[], workflowId: string) {
  const validationStartTime = Date.now();
  const results = { passed: 0, failed: 0, errors: [] };

  logger.info('Starting validation', {
    workflowId,
    file_count: files.length
  });

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    logger.debug('Validating file', {
      workflowId,
      file,
      progress: `${i + 1}/${files.length}`
    });

    try {
      await validateFile(file);
      results.passed++;
    } catch (error) {
      results.failed++;
      results.errors.push({ file, error: error.message });
      logger.warn('File validation failed', {
        workflowId,
        file,
        error: error.message
      });
    }
  }

  const duration_ms = Date.now() - validationStartTime;
  logger.info('Validation complete', {
    workflowId,
    passed: results.passed,
    failed: results.failed,
    success_rate: (results.passed / files.length * 100).toFixed(1) + '%',
    duration_ms
  });

  return results;
}
```

---

## Log Level Decision Tree

```
Does this message show what the user sees?
  YES → INFO (default for user-facing operations)
  NO  → Continue

Is this a development/debug message?
  YES → DEBUG (for troubleshooting)
  NO  → Continue

Is this something unexpected but handled?
  YES → WARN (something odd but system continues)
  NO  → Continue

Did an operation fail?
  YES → ERROR (operation failed, system continues)
  NO  → Continue

Is this system-critical?
  YES → FATAL (system cannot continue)
  NO  → Continue

Is this deep diagnostic detail?
  YES → TRACE (deepest level, rarely used)
  NO  → Shouldn't reach here - default to INFO
```

---

## Debugging Checklist

When you can't see expected logs:

```
[ ] Check LOG_LEVEL environment variable
    export LOG_LEVEL=debug

[ ] Check NODE_ENV for pretty-printing
    export NODE_ENV=development

[ ] Check logger module scope
    createLogger({ component: 'my-service' })

[ ] Check log level matches expectations
    INFO shows info + warn + error + fatal
    DEBUG shows debug + info + warn + error + fatal

[ ] Check logger is actually called
    console.log() doesn't use logger config!

[ ] Check for module-level overrides
    LoggerConfigService.getModuleLevel('my-module')

[ ] Check for VERBOSE flag (CLI)
    export VERBOSE=true
```

---

## Performance Tips

1. **Use DEBUG, not INFO, for frequent messages:**
   ```typescript
   // Bad - clutters INFO level
   logger.info('Processing item', { index, total });

   // Good - can be hidden by setting LOG_LEVEL=info
   logger.debug('Processing item', { index, total });
   ```

2. **Avoid string concatenation in log objects:**
   ```typescript
   // Slower
   logger.info(`User ${userId} logged in at ${timestamp}`);

   // Faster
   logger.info('User logged in', { userId, timestamp });
   ```

3. **Use DEBUG for loop iterations:**
   ```typescript
   // Bad - logs 1000x
   for (item of items) {
     logger.info('Processing', { item });
   }

   // Good - only if DEBUG enabled
   for (item of items) {
     logger.debug('Processing', { item });
   }
   ```

4. **Lazy evaluate expensive operations:**
   ```typescript
   // Only compute if actually logging
   if (logger.isLevelEnabled('debug')) {
     logger.debug('Expensive data', { computed: expensiveOperation() });
   }
   ```

---

## Module-Specific Logging

### Scaffold Agent
```typescript
const logger = createLogger({ component: 'scaffold-agent' });

logger.info('Project scaffold started', { name, type });
logger.debug('Creating directory structure', { dirCount });
logger.debug('Generating files', { fileCount });
logger.info('Project scaffold completed', { duration_ms });
```

### Validation Agent
```typescript
const logger = createLogger({ component: 'validation-agent' });

logger.info('Validation started', { fileCount });
logger.debug('Checking TypeScript', { files: [/*...*/] });
logger.warn('Type error found', { file, line, message });
logger.info('Validation completed', { errors, warnings });
```

### Deployment Agent
```typescript
const logger = createLogger({ component: 'deployment-agent' });

logger.info('Deployment started', { target, version });
logger.debug('Building Docker image', { dockerfile });
logger.debug('Pushing to registry', { registry });
logger.info('Deployment completed', { endpoint, duration_ms });
```

### Orchestrator
```typescript
const logger = createLogger({ component: 'orchestrator' });

logger.info('Workflow started', { workflowId, type });
logger.debug('Routing to scaffold stage', { stageType });
logger.debug('Task created', { taskId });
logger.info('Workflow progressed', { currentStage });
logger.error('Workflow failed', { stage, error, retryable });
```

---

## Testing with Logs

### Capturing Logs in Tests

```typescript
import { LoggerConfigService } from '@agentic-sdlc/logger-config';

describe('MyService', () => {
  let logSpy: jest.Mock;

  beforeEach(() => {
    // Capture logs during test
    logSpy = jest.spyOn(console, 'log');
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('should log on success', async () => {
    await myService.execute();

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('execution started')
    );
  });
});
```

### Suppressing Logs in Tests

```typescript
beforeEach(() => {
  // Suppress all logs during tests
  LoggerConfigService.getInstance().setGlobalLevel('fatal');
});

afterEach(() => {
  // Restore to original level
  LoggerConfigService.getInstance().setGlobalLevel(process.env.LOG_LEVEL || 'info');
});
```

---

## Common Mistakes

### ❌ Using console.log
```typescript
console.log('Debug info');  // ❌ Ignores LOG_LEVEL!
logger.debug('Debug info'); // ✅ Respects LOG_LEVEL
```

### ❌ String concatenation
```typescript
logger.info('User ' + userId + ' logged in');  // ❌ Hard to parse
logger.info('User logged in', { userId });     // ✅ Structured
```

### ❌ Logging sensitive data
```typescript
logger.info('User details', { email, password, token });  // ❌ Security risk!
logger.info('User logged in', { userId });                // ✅ Safe
```

### ❌ Too much DEBUG logging
```typescript
for (item of items) {
  logger.debug('Item', { item });  // ❌ Too verbose
}
logger.debug('Processing items', { count: items.length });  // ✅ Summary
```

### ❌ Ignoring errors
```typescript
try {
  await operation();
} catch (e) {
  // ❌ Error silently ignored
}

try {
  await operation();
} catch (e) {
  logger.error('Operation failed', { error: e.message });  // ✅ Logged
}
```

---

## Environment-Specific Settings

### Development
```bash
NODE_ENV=development
LOG_LEVEL=debug
VERBOSE=true

# Result: All logs visible, pretty-printed with colors
```

### Staging
```bash
NODE_ENV=staging
LOG_LEVEL=debug

# Result: All logs visible, pretty-printed
```

### Production
```bash
NODE_ENV=production
LOG_LEVEL=info

# Result: Only important logs, JSON format
```

### Testing
```bash
NODE_ENV=test
LOG_LEVEL=warn

# Result: Only warnings/errors, minimal noise
```

---

## References

- [Logging Levels Configuration](./LOGGING_LEVELS.md)
- [Logger Config Service Docs](./packages/shared/logger-config/README.md)
- [Pino Documentation](https://getpino.io/)
- [Structured Logging Best Practices](./LOGGING_PATTERNS.md)

---

## Quick Command Reference

```bash
# View logs in development
NODE_ENV=development LOG_LEVEL=debug npm start

# View only errors
LOG_LEVEL=error npm start

# Debug specific issue
LOG_LEVEL=trace npm start

# Production-like logging
NODE_ENV=production LOG_LEVEL=info npm start

# Suppress logs
LOG_LEVEL=fatal npm start
```

---

**Last Updated:** 2025-11-17 | **Status:** Production Ready
