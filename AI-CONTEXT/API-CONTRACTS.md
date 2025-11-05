# API CONTRACTS AND SCHEMAS

**Purpose:** Complete API specifications and message contracts for agent communication

---

## Core Message Contracts

### Task Assignment Message

```typescript
// Agent receives this when assigned a task
export const TaskAssignmentSchema = z.object({
  message_id: z.string().uuid(),
  task_id: z.string().uuid(),
  workflow_id: z.string().uuid(),
  agent_type: z.enum([
    'scaffold',
    'validation',
    'e2e-test',
    'integration',
    'deployment',
    'monitoring',
    'debug',
    'recovery'
  ]),
  priority: z.enum(['low', 'normal', 'high', 'critical']),
  payload: z.object({
    action: z.string(),
    target: z.string().optional(),
    parameters: z.record(z.unknown()),
    context: z.record(z.unknown()).optional()
  }),
  constraints: z.object({
    timeout_ms: z.number().default(300000),
    max_retries: z.number().default(3),
    required_confidence: z.number().min(0).max(100).default(80)
  }),
  metadata: z.object({
    created_at: z.string().datetime(),
    created_by: z.string(),
    trace_id: z.string(),
    parent_task_id: z.string().optional()
  })
});
```

### Task Result Message

```typescript
// Agent returns this after completing task
export const TaskResultSchema = z.object({
  message_id: z.string().uuid(),
  task_id: z.string().uuid(),
  workflow_id: z.string().uuid(),
  agent_id: z.string(),
  status: z.enum(['success', 'failure', 'partial', 'blocked']),
  result: z.object({
    data: z.record(z.unknown()),
    artifacts: z.array(z.object({
      type: z.string(),
      path: z.string(),
      size_bytes: z.number()
    })).optional(),
    metrics: z.object({
      duration_ms: z.number(),
      resource_usage: z.record(z.number()).optional(),
      operations_count: z.number().optional()
    })
  }),
  errors: z.array(z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
    recoverable: z.boolean()
  })).optional(),
  next_actions: z.array(z.object({
    action: z.string(),
    agent_type: z.string(),
    priority: z.string()
  })).optional(),
  metadata: z.object({
    completed_at: z.string().datetime(),
    trace_id: z.string(),
    confidence_score: z.number().min(0).max(100).optional()
  })
});
```

---

## REST API Endpoints

### Orchestrator API

```typescript
// Base URL: http://localhost:3000/api/v1

interface OrchestratorAPI {
  // Workflow Management
  'POST /workflows': {
    body: {
      type: 'app' | 'feature' | 'bugfix';
      name: string;
      description: string;
      requirements?: string;
      priority: 'low' | 'medium' | 'high' | 'critical';
    };
    response: {
      workflow_id: string;
      status: string;
      estimated_duration_ms: number;
      created_at: string;
    };
  };

  'GET /workflows/:id': {
    params: { id: string };
    response: {
      workflow_id: string;
      status: string;
      current_stage: string;
      progress_percentage: number;
      stages: Array<{
        name: string;
        status: string;
        started_at?: string;
        completed_at?: string;
        agent_id?: string;
      }>;
      created_at: string;
      updated_at: string;
    };
  };

  'POST /workflows/:id/cancel': {
    params: { id: string };
    response: {
      workflow_id: string;
      status: 'cancelled';
      cancelled_at: string;
    };
  };

  'POST /workflows/:id/retry': {
    params: { id: string };
    body: { stage?: string };
    response: {
      workflow_id: string;
      status: string;
      retry_count: number;
    };
  };

  // Agent Management
  'GET /agents': {
    response: Array<{
      agent_id: string;
      type: string;
      status: 'idle' | 'busy' | 'offline';
      current_task?: string;
      capabilities: string[];
      health: {
        status: 'healthy' | 'degraded' | 'unhealthy';
        last_check: string;
      };
    }>;
  };

  'POST /agents/:id/invoke': {
    params: { id: string };
    body: TaskAssignmentSchema;
    response: {
      invocation_id: string;
      agent_id: string;
      status: 'queued' | 'processing';
      estimated_completion: string;
    };
  };

  // Sprint Management
  'GET /sprints/current': {
    response: {
      sprint_id: string;
      sprint_number: number;
      start_date: string;
      end_date: string;
      status: string;
      progress: {
        planned_points: number;
        completed_points: number;
        velocity: number;
      };
      items: Array<{
        id: string;
        title: string;
        status: string;
        points: number;
      }>;
    };
  };

  'POST /sprints/complete': {
    response: {
      sprint_id: string;
      status: 'completed';
      metrics: {
        total_points: number;
        completed_points: number;
        test_pass_rate: number;
        velocity: number;
      };
      next_sprint_id: string;
    };
  };
}
```

### Pipeline API

```typescript
interface PipelineAPI {
  'POST /pipeline/trigger': {
    body: {
      pipeline_id: string;
      application: string;
      stages: string[];
      parameters?: Record<string, any>;
    };
    response: {
      execution_id: string;
      status: 'started';
      stages: Array<{
        name: string;
        status: 'pending';
      }>;
    };
  };

  'GET /pipeline/status/:id': {
    params: { id: string };
    response: {
      execution_id: string;
      status: 'running' | 'success' | 'failed' | 'cancelled';
      current_stage: string;
      stages: Array<{
        name: string;
        status: string;
        started_at?: string;
        completed_at?: string;
        logs_url?: string;
      }>;
      artifacts?: Array<{
        name: string;
        type: string;
        url: string;
      }>;
    };
  };

  'POST /pipeline/webhook': {
    headers: {
      'X-Pipeline-Secret': string;
    };
    body: {
      event_type: 'stage_complete' | 'pipeline_complete' | 'pipeline_failed';
      execution_id: string;
      stage?: string;
      status: string;
      data: any;
    };
    response: {
      acknowledged: true;
    };
  };
}
```

---

## Event Bus Messages

### Event Types and Payloads

```typescript
export enum EventType {
  // Workflow Events
  WORKFLOW_CREATED = 'workflow.created',
  WORKFLOW_STARTED = 'workflow.started',
  WORKFLOW_STAGE_COMPLETE = 'workflow.stage.complete',
  WORKFLOW_COMPLETED = 'workflow.completed',
  WORKFLOW_FAILED = 'workflow.failed',

  // Agent Events
  AGENT_TASK_RECEIVED = 'agent.task.received',
  AGENT_TASK_STARTED = 'agent.task.started',
  AGENT_TASK_COMPLETED = 'agent.task.completed',
  AGENT_TASK_FAILED = 'agent.task.failed',
  AGENT_HEALTH_CHECK = 'agent.health.check',

  // Pipeline Events
  PIPELINE_TRIGGERED = 'pipeline.triggered',
  PIPELINE_STAGE_STARTED = 'pipeline.stage.started',
  PIPELINE_STAGE_COMPLETED = 'pipeline.stage.completed',
  PIPELINE_QUALITY_GATE_PASSED = 'pipeline.quality_gate.passed',
  PIPELINE_QUALITY_GATE_FAILED = 'pipeline.quality_gate.failed',
  PIPELINE_COMPLETED = 'pipeline.completed',

  // Sprint Events
  SPRINT_STARTED = 'sprint.started',
  SPRINT_DAY_COMPLETE = 'sprint.day.complete',
  SPRINT_REVIEW_STARTED = 'sprint.review.started',
  SPRINT_COMPLETED = 'sprint.completed',

  // System Events
  SYSTEM_ERROR = 'system.error',
  SYSTEM_ALERT = 'system.alert',
  SYSTEM_METRIC = 'system.metric'
}

// Generic Event Structure
export const EventSchema = z.object({
  id: z.string().uuid(),
  type: z.nativeEnum(EventType),
  source: z.string(),
  timestamp: z.string().datetime(),
  data: z.record(z.unknown()),
  metadata: z.object({
    trace_id: z.string(),
    correlation_id: z.string().optional(),
    user_id: z.string().optional()
  })
});
```

---

## Agent-to-Agent Communication

### Direct Agent Messages

```typescript
// When one agent needs to communicate with another
export const AgentMessageSchema = z.object({
  from_agent: z.string(),
  to_agent: z.string(),
  message_type: z.enum([
    'request',
    'response',
    'notification',
    'query'
  ]),
  subject: z.string(),
  body: z.record(z.unknown()),
  requires_response: z.boolean(),
  timeout_ms: z.number().optional(),
  priority: z.enum(['low', 'normal', 'high']).default('normal')
});

// Example: Debug Agent asking Validation Agent for test results
const message: AgentMessage = {
  from_agent: 'debug-agent-01',
  to_agent: 'validation-agent-01',
  message_type: 'query',
  subject: 'get_test_results',
  body: {
    workflow_id: 'wf-123',
    test_suite: 'unit',
    include_coverage: true
  },
  requires_response: true,
  timeout_ms: 5000,
  priority: 'high'
};
```

---

## Decision Request/Response

### Decision Request Format

```typescript
export const DecisionRequestSchema = z.object({
  decision_id: z.string().uuid(),
  context: z.object({
    workflow_id: z.string(),
    stage: z.string(),
    agent_id: z.string()
  }),
  question: z.string(),
  options: z.array(z.object({
    id: z.string(),
    description: z.string(),
    pros: z.array(z.string()),
    cons: z.array(z.string()),
    confidence: z.number().min(0).max(100),
    estimated_impact: z.enum(['low', 'medium', 'high'])
  })),
  constraints: z.object({
    max_cost: z.number().optional(),
    max_time_ms: z.number().optional(),
    required_confidence: z.number().min(0).max(100),
    compliance_requirements: z.array(z.string()).optional()
  }),
  deadline: z.string().datetime().optional()
});

export const DecisionResponseSchema = z.object({
  decision_id: z.string().uuid(),
  selected_option: z.string(),
  reasoning: z.string(),
  confidence: z.number().min(0).max(100),
  decided_by: z.enum(['ai', 'human', 'policy']),
  decided_at: z.string().datetime(),
  override_reason: z.string().optional()
});
```

---

## Quality Gate Definitions

```typescript
export const QualityGateSchema = z.object({
  gate_id: z.string(),
  name: z.string(),
  stage: z.string(),
  rules: z.array(z.object({
    metric: z.string(),
    operator: z.enum(['>', '<', '>=', '<=', '==', '!=']),
    threshold: z.number(),
    unit: z.string()
  })),
  enforcement: z.enum(['mandatory', 'advisory', 'optional']),
  auto_remediation: z.boolean(),
  failure_action: z.enum(['block', 'warn', 'continue'])
});

// Standard Quality Gates
export const STANDARD_GATES = {
  coverage: {
    gate_id: 'coverage-gate',
    name: 'Code Coverage Gate',
    stage: 'validation',
    rules: [{
      metric: 'line_coverage',
      operator: '>=',
      threshold: 80,
      unit: 'percent'
    }],
    enforcement: 'mandatory',
    auto_remediation: false,
    failure_action: 'block'
  },

  security: {
    gate_id: 'security-gate',
    name: 'Security Scan Gate',
    stage: 'validation',
    rules: [
      {
        metric: 'critical_vulnerabilities',
        operator: '==',
        threshold: 0,
        unit: 'count'
      },
      {
        metric: 'high_vulnerabilities',
        operator: '<=',
        threshold: 2,
        unit: 'count'
      }
    ],
    enforcement: 'mandatory',
    auto_remediation: true,
    failure_action: 'block'
  },

  performance: {
    gate_id: 'performance-gate',
    name: 'Performance Gate',
    stage: 'testing',
    rules: [
      {
        metric: 'p95_response_time',
        operator: '<',
        threshold: 500,
        unit: 'ms'
      },
      {
        metric: 'error_rate',
        operator: '<',
        threshold: 1,
        unit: 'percent'
      }
    ],
    enforcement: 'mandatory',
    auto_remediation: false,
    failure_action: 'warn'
  },

  e2e: {
    gate_id: 'e2e-gate',
    name: 'E2E Test Gate',
    stage: 'testing',
    rules: [{
      metric: 'test_pass_rate',
      operator: '==',
      threshold: 100,
      unit: 'percent'
    }],
    enforcement: 'mandatory',
    auto_remediation: false,
    failure_action: 'block'
  }
};
```

---

## Backlog Item Schema

```typescript
export const BacklogItemSchema = z.object({
  id: z.string(),
  epic_id: z.string().optional(),
  type: z.enum(['feature', 'bug', 'tech_debt', 'enhancement', 'documentation']),
  title: z.string().min(1).max(200),
  description: z.string(),
  acceptance_criteria: z.array(z.string()),
  story_points: z.number().min(1).max(21),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum([
    'unrefined',
    'refined',
    'ready',
    'in_progress',
    'in_review',
    'testing',
    'done',
    'blocked'
  ]),
  assigned_to: z.string().optional(),
  sprint_id: z.string().optional(),
  dependencies: z.array(z.string()),
  tags: z.array(z.string()).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  completed_at: z.string().datetime().optional()
});
```

---

## WebSocket Protocol

### Real-time Updates

```typescript
// WebSocket connection for real-time updates
interface WebSocketProtocol {
  // Client -> Server
  subscribe: {
    type: 'subscribe';
    channels: Array<'workflows' | 'agents' | 'pipeline' | 'metrics'>;
    filters?: {
      workflow_id?: string;
      agent_type?: string;
    };
  };

  unsubscribe: {
    type: 'unsubscribe';
    channels: string[];
  };

  ping: {
    type: 'ping';
    timestamp: number;
  };

  // Server -> Client
  update: {
    type: 'update';
    channel: string;
    data: any;
    timestamp: string;
  };

  error: {
    type: 'error';
    code: string;
    message: string;
  };

  pong: {
    type: 'pong';
    timestamp: number;
  };
}

// Example WebSocket client
const ws = new WebSocket('ws://localhost:3000/ws');

ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    channels: ['workflows', 'agents'],
    filters: {
      workflow_id: 'wf-123'
    }
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  if (message.type === 'update') {
    console.log(`Update from ${message.channel}:`, message.data);
  }
});
```

---

## Contract Validation Rules

### Important Notes for AI Agents:

1. **ALWAYS validate against schema before sending**
   ```typescript
   const validated = TaskResultSchema.parse(result);
   await send(validated);
   ```

2. **ALWAYS include required metadata**
   - trace_id for distributed tracing
   - timestamp for ordering
   - agent_id for identification

3. **NEVER send partial schemas**
   - Fill optional fields with null/undefined if not applicable
   - Include empty arrays [] not missing fields

4. **ALWAYS use enum values exactly**
   - Case sensitive
   - No variations or abbreviations

5. **For errors, ALWAYS include**
   - Error code
   - Human-readable message
   - Whether it's recoverable
   - Stack trace in details if available