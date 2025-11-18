# Mock Agent Behavior Metadata Guide

## Overview

The GenericMockAgent now supports **metadata-driven behavior** that allows you to control its execution for any given stage without modifying code. This enables:

- ✅ **Failure Injection** - Make agents fail at specific stages
- ✅ **Timeout Simulation** - Test timeout handling
- ✅ **Partial Success** - Test incomplete/partial results
- ✅ **Custom Output** - Override generated outputs
- ✅ **Custom Metrics** - Override execution metrics
- ✅ **Timing Control** - Simulate fast/slow/variable execution

## Quick Start

### Pass metadata in task payload

```typescript
const task = {
  payload: {
    name: 'my-project',
    behavior_metadata: {
      mode: 'failure',
      error: {
        code: 'VALIDATION_ERROR',
        message: 'TypeScript compilation failed',
        retryable: true
      }
    }
  }
};

const result = await agent.execute(task);
// result.status === 'failed'
// result.errors[0].code === 'VALIDATION_ERROR'
```

## Behavior Modes

### 1. Success Mode (Default)

Normal successful completion.

```typescript
{
  mode: 'success',
  label: 'Normal successful completion'
}
```

### 2. Failure Mode

Agent reports failure with error details.

```typescript
{
  mode: 'failure',
  error: {
    code: 'VALIDATION_ERROR',
    message: 'TypeScript errors detected',
    details: { file: 'src/index.ts', line: 45 },
    retryable: true,
    recovery_suggestion: 'Fix type errors and retry'
  }
}
```

**Common error codes:**
- `VALIDATION_ERROR` - Type checking or linting failed
- `DEPLOYMENT_FAILED` - Deployment to environment failed
- `FATAL_ERROR` - Unrecoverable error
- `AGENT_CRASH` - Agent process crashed

### 3. Timeout Mode

Simulates stage exceeding timeout.

```typescript
{
  mode: 'timeout',
  timing: { timeout_at_ms: 5000 },
  error: {
    code: 'TIMEOUT',
    message: 'Stage execution exceeded timeout',
    retryable: true
  }
}
```

### 4. Partial Mode

Some items succeeded, some failed (e.g., 8/10 tests passed).

```typescript
{
  mode: 'partial',
  partial: {
    total_items: 10,
    successful_items: 8,
    failed_items: 2,
    failure_rate: 0.2,
    first_failure_at: 3
  },
  output: {
    tests_run: 10,
    tests_passed: 8,
    tests_failed: 2
  }
}
```

### 5. Crash Mode

Unexpected agent crash.

```typescript
{
  mode: 'crash',
  error: {
    code: 'AGENT_CRASH',
    message: 'Agent process crashed unexpectedly',
    retryable: true
  }
}
```

## Metadata Fields

### Mode (Required)

Execution behavior: `'success' | 'failure' | 'timeout' | 'partial' | 'crash'`

```typescript
behavior_metadata: {
  mode: 'failure'
}
```

### Error (Required for failure/timeout/crash)

Error details when mode is failure, timeout, or crash.

```typescript
error: {
  code: 'VALIDATION_ERROR',                    // Error code (required)
  message: 'TypeScript compilation errors',    // Human message (required)
  details: { ... },                            // Custom context (optional)
  retryable: true,                             // Can workflow retry? (default: true)
  recovery_suggestion: 'Fix types and retry'  // Recovery hint (optional)
}
```

### Partial (Required for partial mode)

Partial success details.

```typescript
partial: {
  total_items: 10,              // Total items processed (required)
  successful_items: 8,          // Items that succeeded (required)
  failed_items: 2,              // Items that failed (required)
  failure_rate: 0.2,            // Failure ratio 0-1 (optional, calculated if omitted)
  first_failure_at: 3           // Index of first failure (optional)
}
```

### Output (Optional)

Override generated output. Agent-type specific.

```typescript
output: {
  // For SCAFFOLD agent
  project_name: 'custom-name',
  files_generated: 50,
  bytes_written: 1024000,

  // For VALIDATION agent
  validation_result: 'passed',
  errors: [],
  warnings: [],

  // For E2E agent
  tests_run: 25,
  tests_passed: 25,
  tests_failed: 0,
  coverage: 92,

  // Custom data
  custom_data: { any: 'value' }
}
```

### Timing (Optional)

Control execution timing. **Note: All agents default to a 10-second delay unless overridden.**

```typescript
timing: {
  execution_delay_ms: 10000,   // Add delay in ms (default: 10000 / 10 seconds)
  variance_ms: 500,            // Random variance +/- (optional)
  timeout_at_ms: 5000         // Trigger timeout after N ms (optional)
}
```

**Delay Behavior:**
- If `timing` object is not provided: **10-second default delay is applied**
- If `timing` object is provided: Uses specified `execution_delay_ms` value
- Set `execution_delay_ms: 0` to run instantly with no delay

### Metrics (Optional)

Override execution metrics.

```typescript
metrics: {
  duration_ms: 8500,
  memory_mb: 256,
  cpu_percent: 75,
  custom_metrics: {
    files_created: 127,
    directories_created: 45
  }
}
```

### Label (Optional)

Human-readable label for debugging.

```typescript
label: 'Validation fails with type errors'
```

## Preset Behaviors

Use predefined presets for common scenarios:

### Available Presets

```typescript
agent.getAvailableBehaviors()
// Returns: [
//   // Success scenarios
//   'success', 'fast_success', 'slow_success',
//
//   // Failure scenarios
//   'validation_error', 'deployment_failed', 'unrecoverable_error',
//
//   // Timeout & partial
//   'timeout',
//   'tests_partial_pass',
//
//   // Metrics
//   'high_resource_usage',
//
//   // Crash scenario
//   'crash',
//
//   // Delay configurations (NEW)
//   'default_delay',          // 10-second delay (default)
//   'no_delay',               // Instant (0ms)
//   'custom_delay_3s',        // 3-second delay
//   'custom_delay_5s',        // 5-second delay
//   'custom_delay_30s',       // 30-second delay
//   'delay_with_variance'     // 10s ± 2s random variance
// ]
```

### Using Presets

```typescript
// Option 1: Pass preset name as string
{
  behavior_metadata: 'validation_error'
}

// Option 2: Pass preset object
{
  behavior_metadata: agent.getBehaviorPreset('validation_error')
}

// Option 3: Access preset directly
import { BEHAVIOR_SAMPLES } from '@agentic-sdlc/shared-types'
{
  behavior_metadata: BEHAVIOR_SAMPLES.validation_error
}
```

## Real-World Examples

### Example 1: Test Happy Path

```typescript
// Create workflow with all stages succeeding
const stages = ['initialization', 'scaffolding', 'validation', 'e2e_testing'];

for (const stage of stages) {
  const task = createTaskForStage(stage, {
    behavior_metadata: { mode: 'success' }
  });
  const result = await agent.execute(task);
  expect(result.status).toBe('success');
}
```

### Example 2: Test Failure Injection at Specific Stage

```typescript
// Stages 1-3 succeed, stage 4 fails
const results = [];

// Success path
for (let i = 0; i < 3; i++) {
  const task = createTaskForStage(stages[i], {
    behavior_metadata: { mode: 'success' }
  });
  results.push(await agent.execute(task));
}

// Failure at stage 4
const failTask = createTaskForStage('validation', {
  behavior_metadata: 'validation_error'  // Use preset
});
const failResult = await agent.execute(failTask);
expect(failResult.status).toBe('failed');
expect(failResult.errors[0].code).toBe('VALIDATION_ERROR');

// Retry succeeds
const retryTask = createTaskForStage('validation', {
  behavior_metadata: { mode: 'success' }
});
const retryResult = await agent.execute(retryTask);
expect(retryResult.status).toBe('success');
```

### Example 3: Test Partial Success

```typescript
const task = createTaskForStage('e2e_testing', {
  behavior_metadata: {
    mode: 'partial',
    partial: {
      total_items: 50,
      successful_items: 45,
      failed_items: 5
    },
    output: {
      tests_run: 50,
      tests_passed: 45,
      tests_failed: 5,
      failed_tests: [
        { name: 'test-1', error: 'Timeout' },
        // ... more failures
      ]
    }
  }
});

const result = await agent.execute(task);
expect(result.status).toBe('failed');  // Partial is still failure
expect(result.result.data.tests_passed).toBe(45);
expect(result.metadata.confidence_score).toBe(90);  // 45/50 = 90%
```

### Example 4: Test Timeout Handling

```typescript
const task = createTaskForStage('deployment', {
  behavior_metadata: {
    mode: 'timeout',
    timing: { timeout_at_ms: 3000 },
    error: {
      code: 'DEPLOYMENT_TIMEOUT',
      message: 'Deployment did not complete within 3 seconds',
      retryable: true
    }
  }
});

const result = await agent.execute(task);
expect(result.status).toBe('failed');
expect(result.errors[0].code).toBe('DEPLOYMENT_TIMEOUT');
```

### Example 5: Test Custom Metrics

```typescript
const task = createTaskForStage('scaffolding', {
  behavior_metadata: {
    mode: 'success',
    output: {
      files_generated: 127,
      bytes_written: 2048000
    },
    metrics: {
      duration_ms: 8500,
      memory_mb: 512,
      cpu_percent: 85,
      custom_metrics: {
        templates_applied: 12,
        files_created: 127
      }
    }
  }
});

const result = await agent.execute(task);
expect(result.result.metrics.duration_ms).toBe(8500);
expect(result.result.metrics.custom_metrics.files_created).toBe(127);
```

## Testing Patterns

### Pattern 1: Test State Machine Transitions

```typescript
describe('State Machine Transitions', () => {
  it('should progress through stages on success', async () => {
    // Each stage succeeds -> state machine should transition to next

    const stageSequence = ['initialization', 'scaffolding', 'validation'];
    const workflow = await createWorkflow();

    for (const stage of stageSequence) {
      const task = await workflowService.createTaskForStage(workflow.id, stage, {
        behavior_metadata: { mode: 'success' }
      });

      const result = await agent.execute(task);
      expect(result.status).toBe('success');

      // State machine should have transitioned
      const updatedWorkflow = await workflowService.getWorkflow(workflow.id);
      expect(updatedWorkflow.current_stage).not.toBe(stage);
    }
  });

  it('should NOT transition on failure', async () => {
    const workflow = await createWorkflow();

    const task = await workflowService.createTaskForStage(workflow.id, 'validation', {
      behavior_metadata: 'validation_error'
    });

    const result = await agent.execute(task);
    expect(result.status).toBe('failed');

    // State machine should NOT have transitioned
    const updatedWorkflow = await workflowService.getWorkflow(workflow.id);
    expect(updatedWorkflow.current_stage).toBe('validation');
  });
});
```

### Pattern 2: Test Retry Logic

```typescript
describe('Retry Logic', () => {
  it('should retry failed stage with metadata override', async () => {
    // Stage 1: Fails
    let task = await createTaskForStage('validation', {
      behavior_metadata: 'validation_error'
    });
    let result = await agent.execute(task);
    expect(result.status).toBe('failed');

    // Stage 1 Retry: Succeeds
    task = await createTaskForStage('validation', {
      behavior_metadata: { mode: 'success' }  // Override to succeed
    });
    result = await agent.execute(task);
    expect(result.status).toBe('success');
  });
});
```

### Pattern 3: Test Timeout and Recovery

```typescript
describe('Timeout and Recovery', () => {
  it('should timeout then recover on retry', async () => {
    // Attempt 1: Timeout
    let task = await createTaskForStage('deployment', {
      behavior_metadata: 'timeout'
    });
    let result = await agent.execute(task);
    expect(result.status).toBe('failed');

    // Attempt 2: Success
    task = await createTaskForStage('deployment', {
      behavior_metadata: { mode: 'success', timing: { execution_delay_ms: 500 } }
    });
    result = await agent.execute(task);
    expect(result.status).toBe('success');
  });
});
```

## Configuration Precedence

Behavior metadata is applied in this order:

1. **Task behavior_metadata** (highest priority) - Specified in task payload
2. **Preset name** - String reference like 'validation_error'
3. **Default success** (lowest priority) - If no metadata specified

```typescript
// These are equivalent:
{ behavior_metadata: 'success' }
{ behavior_metadata: { mode: 'success' } }
{ }  // Defaults to success
```

## Debugging

### See what behaviors are available

```typescript
console.log(agent.getAvailableBehaviors());
// ['success', 'fast_success', 'slow_success', 'validation_error', ...]
```

### Get preset details

```typescript
const preset = agent.getBehaviorPreset('validation_error');
console.log(preset);
// { mode: 'failure', error: { code: 'VALIDATION_ERROR', ... } }
```

### Enable debug logging

```typescript
const agent = new GenericMockAgent(messageBus, 'scaffold', undefined, 0, true);
// Will log all behavior decisions
```

### Check agent capabilities

```typescript
const info = agent.getAgentInfo();
console.log(info.capabilities);
// ['mock-task-completion', 'test-stage-progression', 'platform-aware-execution', 'metadata-driven-behavior', 'failure-injection']
```

## Schema Reference

See `packages/shared/types/src/messages/agent-behavior.ts` for:
- Complete Zod schemas
- TypeScript types
- Validation functions
- Sample presets

## Best Practices

1. **Use presets for common scenarios** - More readable and maintainable
2. **Name your behaviors** - Use `label` field for debugging
3. **Test happy path first** - Then add failure scenarios
4. **Keep behavior metadata in test files** - Don't hardcode in production
5. **Use retryable flag correctly** - Set to false for unrecoverable errors
6. **Provide recovery suggestions** - Help operators fix issues
7. **Match error codes to reality** - Use codes from actual agents

## Troubleshooting

**Q: Behavior metadata not being applied?**
A: Ensure it's in task.payload.behavior_metadata (not task.behavior_metadata)

**Q: Preset name not working?**
A: Check spelling and use `agent.getAvailableBehaviors()` to see valid names

**Q: Metrics not overriding?**
A: Metrics are merged with baseline, ensure you're setting the field names correctly

**Q: Timing not working?**
A: Check `execution_delay_ms` vs `timeout_at_ms` - they have different effects

**Q: Why is my agent taking 10 seconds to complete?**
A: By default, all mock agents apply a 10-second delay to simulate realistic execution. To override:
- Use `timing: { execution_delay_ms: 0 }` for instant execution
- Use `'no_delay'` preset for instant success
- Use `'custom_delay_3s'`, `'custom_delay_5s'`, etc. for specific durations

**Q: How do I disable the default delay?**
A: Set `execution_delay_ms: 0` in the timing object:
```typescript
{
  behavior_metadata: {
    mode: 'success',
    timing: { execution_delay_ms: 0 }
  }
}
```

**Q: Can I add random variance to the delay?**
A: Yes! Use the `variance_ms` field:
```typescript
{
  behavior_metadata: {
    mode: 'success',
    timing: { execution_delay_ms: 10000, variance_ms: 2000 }  // 10s ± 2s
  }
}
```
Or use the `'delay_with_variance'` preset.
