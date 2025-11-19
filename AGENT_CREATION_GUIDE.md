# Creating Custom Agents for Agentic SDLC

**Status:** Complete Guide v1.0  
**Last Updated:** 2025-11-19  
**Session:** #85 - Unbounded Agent Extensibility

---

## Quick Start (5 Minutes)

### Step 1: Create Agent Class

```typescript
// File: packages/agents/my-agent/src/my-agent.ts
import { BaseAgent } from '@agentic-sdlc/base-agent';
import { AgentEnvelope, TaskResult } from '@agentic-sdlc/shared-types';

export class MyCustomAgent extends BaseAgent {
  async execute(envelope: AgentEnvelope): Promise<TaskResult> {
    console.log(`[MyAgent] Processing task: ${envelope.task_id}`);
    
    const { payload, workflow_context } = envelope;
    
    try {
      // Do your work here
      const result = await this.doWork(payload);
      
      return {
        status: 'success',
        output: result,
        duration_ms: 100
      };
    } catch (error) {
      return {
        status: 'failed',
        output: null,
        errors: [error instanceof Error ? error.message : String(error)],
        duration_ms: 100
      };
    }
  }

  private async doWork(payload: any): Promise<any> {
    // Your custom logic here
    return { success: true, data: payload };
  }
}
```

### Step 2: Register Agent

```typescript
// File: packages/agents/my-agent/src/run-agent.ts
import { OrchestratorContainer } from '@agentic-sdlc/orchestrator';
import { MyCustomAgent } from './my-agent';

async function main() {
  const container = new OrchestratorContainer({
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6380',
    redisNamespace: 'my-agent',
    dbUrl: process.env.DATABASE_URL
  });

  await container.initialize();
  const messageBus = container.getBus();

  // Create and register agent
  const agent = new MyCustomAgent(messageBus, {
    type: 'my-custom-agent',           // Your agent type (kebab-case)
    version: '1.0.0',
    capabilities: ['custom-capability'],
    description: 'My custom agent'
  });

  // Start listening for tasks
  await agent.start();
  console.log('[MyAgent] Started successfully');
}

main().catch(console.error);
```

### Step 3: Add to Workflow Definition

```json
{
  "name": "app",
  "platform_id": "my-platform",
  "stages": [
    {
      "name": "initialization",
      "agent_type": "scaffold",
      "progress_weight": 20
    },
    {
      "name": "custom-processing",
      "agent_type": "my-custom-agent",    // Your custom agent!
      "progress_weight": 30
    },
    {
      "name": "validation",
      "agent_type": "validation",
      "progress_weight": 50
    }
  ]
}
```

---

## Complete Example: ML Training Agent

### Architecture

```
MyMLTrainingAgent extends BaseAgent
├── Constructor: Register as 'ml-training' agent
├── execute(): Main work (receive envelope, do ML training)
└── Helper methods: Data prep, model training, result format
```

### Full Implementation

```typescript
// packages/agents/ml-training-agent/src/ml-training.agent.ts
import { BaseAgent } from '@agentic-sdlc/base-agent';
import { AgentEnvelope, TaskResult } from '@agentic-sdlc/shared-types';

export class MLTrainingAgent extends BaseAgent {
  async execute(envelope: AgentEnvelope): Promise<TaskResult> {
    const { payload, workflow_context, trace } = envelope;
    
    console.log(`[MLTraining] Task: ${trace.trace_id} | Stage: ${workflow_context.current_stage}`);
    
    try {
      // Access previous stage outputs (important for multi-stage workflows)
      const prevOutputs = workflow_context.stage_outputs;
      const datasetPath = prevOutputs?.data_preparation?.output_path;
      
      // Access platform context for platform-specific behavior
      const platformId = workflow_context.platform_id;
      
      // Do ML training
      const trainingResult = await this.trainModel({
        datasetPath,
        platformId,
        ...payload
      });
      
      return {
        status: 'success',
        output: {
          model_path: trainingResult.modelPath,
          accuracy: trainingResult.accuracy,
          training_time_ms: trainingResult.duration,
          platform: platformId
        },
        duration_ms: trainingResult.duration
      };
    } catch (error) {
      return {
        status: 'failed',
        output: null,
        errors: [error instanceof Error ? error.message : String(error)],
        duration_ms: 0
      };
    }
  }

  private async trainModel(config: any): Promise<any> {
    // Simulate ML training
    const startTime = Date.now();
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      modelPath: `/models/model-${Date.now()}.pkl`,
      accuracy: 0.95,
      duration: Date.now() - startTime
    };
  }
}
```

### Register and Run

```typescript
// packages/agents/ml-training-agent/src/run-agent.ts
import { OrchestratorContainer } from '@agentic-sdlc/orchestrator';
import { MLTrainingAgent } from './ml-training.agent';

async function main() {
  const container = new OrchestratorContainer({
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6380',
    redisNamespace: 'ml-training-agent',
    dbUrl: process.env.DATABASE_URL
  });

  await container.initialize();
  const messageBus = container.getBus();

  const agent = new MLTrainingAgent(messageBus, {
    type: 'ml-training',
    version: '1.0.0',
    capabilities: ['model-training', 'ml-validation'],
    description: 'ML model training agent',
    configSchema: {
      type: 'object',
      properties: {
        algorithm: { type: 'string' },
        epochs: { type: 'number' },
        batch_size: { type: 'number' }
      }
    }
  });

  await agent.start();
  console.log('[MLTrainingAgent] Started and listening for tasks');
}

main().catch(console.error);
```

---

## Agent Structure & Patterns

### Envelope Structure (What You Receive)

```typescript
{
  // Identification
  message_id: 'uuid',
  task_id: 'uuid',
  workflow_id: 'uuid',
  
  // Routing
  agent_type: 'your-agent-type',  // Your custom type
  
  // Constraints
  priority: 'high',
  constraints: {
    timeout_ms: 300000,
    max_retries: 3,
    required_confidence: 80
  },
  
  // Your Data
  payload: {
    // Custom fields specific to your stage
    input_data: '...',
    config: {...}
  },
  
  // Context from Previous Stages
  workflow_context: {
    workflow_type: 'app',
    workflow_name: 'MyApp',
    current_stage: 'your-stage',
    stage_outputs: {
      // Results from previous stages
      initialization: {...},
      scaffolding: {...}
    },
    platform_id: 'my-platform'  // Which platform is running this
  },
  
  // Distributed Tracing
  trace: {
    trace_id: 'uuid',      // Full workflow trace
    span_id: 'hex16',      // This task's span
    parent_span_id: 'hex16' // Previous task's span
  }
}
```

### Result Format (What You Return)

```typescript
{
  status: 'success' | 'failed',
  output: {
    // Your stage-specific results
    key1: 'value1',
    key2: 'value2'
  },
  errors?: [
    'Error message 1',
    'Error message 2'
  ],
  duration_ms: 1234
}
```

### Common Patterns

**Pattern 1: Use Previous Stage Output**
```typescript
const datasetPath = workflow_context.stage_outputs.data_prep?.output_path;
if (!datasetPath) {
  throw new Error('Previous stage did not provide dataset path');
}
// Use datasetPath...
```

**Pattern 2: Platform-Specific Logic**
```typescript
const platformId = workflow_context.platform_id;
if (platformId === 'web-apps') {
  // Web-specific logic
} else if (platformId === 'data-pipelines') {
  // Data-specific logic
}
```

**Pattern 3: Timeout Handling**
```typescript
const timeoutMs = envelope.constraints.timeout_ms;
const promise = this.doWork(timeout);
const result = await Promise.race([
  promise,
  new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Timeout')), timeoutMs)
  )
]);
```

**Pattern 4: Error Recovery**
```typescript
async execute(envelope: AgentEnvelope): Promise<TaskResult> {
  for (let attempt = 0; attempt < envelope.constraints.max_retries; attempt++) {
    try {
      return await this.attemptWork(envelope);
    } catch (error) {
      if (attempt === envelope.constraints.max_retries - 1) {
        throw error;
      }
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
}
```

---

## Agent Registration

### Global Registration (Available to All Platforms)

```typescript
const agent = new MyAgent(messageBus, metadata);
await agent.start();  // Registers globally
```

### Platform-Scoped Registration

```typescript
// Only available to specific platform
const agent = new MyAgent(messageBus, metadata, platformId);
await agent.start(platformId);
```

---

## Naming Conventions

**Agent Type Naming:**
- Pattern: kebab-case (lowercase alphanumeric + hyphens)
- Examples:
  - ✅ `ml-training`
  - ✅ `data-validation`
  - ✅ `compliance-checker`
  - ✅ `performance-analyzer`
  - ❌ `ML_Training` (not snake_case)
  - ❌ `mlTraining` (not camelCase)
  - ❌ `ml training` (no spaces)

**Built-in Types (Reference):**
- `scaffold` - Project structure creation
- `validation` - Code quality validation
- `e2e_test` - End-to-end testing
- `integration` - External system integration
- `deployment` - Release management
- `monitoring` - Health monitoring
- `debug` - Debugging/troubleshooting
- `recovery` - Error recovery

---

## Testing Custom Agents

### Unit Test Example

```typescript
// packages/agents/my-agent/src/__tests__/my-agent.test.ts
import { describe, it, expect, vi } from 'vitest';
import { MyCustomAgent } from '../my-agent';
import { AgentEnvelope } from '@agentic-sdlc/shared-types';

describe('MyCustomAgent', () => {
  it('should process envelope successfully', async () => {
    const mockBus = { subscribe: vi.fn(), publish: vi.fn() };
    const agent = new MyCustomAgent(mockBus, {
      type: 'my-custom-agent',
      version: '1.0.0',
      capabilities: []
    });

    const envelope: AgentEnvelope = {
      message_id: 'msg-1',
      task_id: 'task-1',
      workflow_id: 'wf-1',
      agent_type: 'my-custom-agent',
      priority: 'high',
      status: 'running',
      constraints: {
        timeout_ms: 5000,
        max_retries: 3,
        required_confidence: 80
      },
      payload: { input: 'test' },
      metadata: {
        created_at: new Date().toISOString(),
        created_by: 'test',
        envelope_version: '2.0.0'
      },
      trace: {
        trace_id: 'trace-1',
        span_id: 'span-1'
      },
      workflow_context: {
        workflow_type: 'app',
        workflow_name: 'TestApp',
        current_stage: 'test',
        stage_outputs: {}
      }
    };

    const result = await agent.execute(envelope);
    expect(result.status).toBe('success');
    expect(result.output).toBeDefined();
  });
});
```

### E2E Test (Full Pipeline)

```bash
# Start services
./dev start

# Create workflow with custom agent in definition
# Run workflow
./scripts/run-pipeline-test.sh "Custom Agent Integration Test"

# Verify results
# - Agent received task
# - Agent executed successfully
# - Results stored in stage_outputs
# - Next stage received output
```

---

## Troubleshooting

### Agent Not Found Error

**Error:** `Agent type 'my-custom-agent' not found`

**Solutions:**
1. Check agent is registered: `agentic list-agents`
2. Verify agent type matches: Use exact kebab-case name
3. Check platform: Is it registered for the right platform?
4. Verify Redis: Is agent instance running and connected?

### Task Timeout

**Error:** Task takes longer than `constraints.timeout_ms`

**Solutions:**
1. Increase timeout in workflow definition
2. Optimize agent work to complete faster
3. Break work into multiple stages
4. Implement incremental progress reporting

### Previous Stage Output Not Available

**Error:** `stage_outputs[previous_stage]` is undefined

**Solutions:**
1. Check stage name matches exactly
2. Verify previous stage completed successfully
3. Check stage_outputs in workflow record
4. Print envelope for debugging

---

## Deployment Checklist

- [ ] Agent extends BaseAgent
- [ ] Agent type follows kebab-case naming
- [ ] `execute()` method implemented
- [ ] Error handling in place
- [ ] TaskResult returned with proper status
- [ ] Unit tests written
- [ ] Workflow definition includes custom agent_type
- [ ] Agent registered in environment
- [ ] E2E test runs successfully
- [ ] Agent logs key operations
- [ ] Documentation updated

---

## Quick Reference Commands

```bash
# List all available agents
agentic list-agents

# List agents for specific platform
agentic list-agents --platform my-platform

# Validate workflow definition
agentic validate-workflow workflow-definition.json

# Create agent package (template)
npm init -y packages/agents/my-new-agent

# Test custom agent
cd packages/agents/my-new-agent && npm test

# Run full pipeline with custom agent
./dev start
./scripts/run-pipeline-test.sh "Test My Agent"
./dev stop
```

---

## Summary

Creating a custom agent is as simple as:

1. **Extend BaseAgent** - Inherit from the base class
2. **Implement execute()** - Do your work in this method
3. **Register agent** - Start the agent instance
4. **Add to workflow** - Include agent_type in stage definition
5. **Test** - Run unit + E2E tests
6. **Deploy** - Start agent in production environment

The Agentic SDLC platform handles:
- Task routing and distribution
- Envelope validation and serialization
- Trace context propagation
- Retry logic and timeout enforcement
- Result storage and state management

You focus on implementing your custom business logic!

---

**Questions?** Check CLAUDE.md or the runbook for more details.
