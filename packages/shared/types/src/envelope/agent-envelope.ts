import { z } from 'zod';
import { WorkflowId, TaskId, toWorkflowId, toTaskId } from '../core/brands';

/**
 * Session #36: Standardized Agent Envelope
 *
 * Unified message format for all agent communication that replaces
 * the adapter pattern with a discriminated union approach.
 *
 * Benefits:
 * - Type-safe at compile time
 * - Single source of truth for agent payloads
 * - No runtime adaptation needed
 * - Clear separation between envelope metadata and agent-specific payload
 * - Enhanced error handling and tracing
 */

// ===== Priority Enum =====
export const TaskPriorityEnum = z.enum(['critical', 'high', 'medium', 'low']);

// ===== Status Enum (use different name to avoid conflict with core/schemas) =====
export const EnvelopeTaskStatusEnum = z.enum([
  'pending',
  'queued',
  'running',
  'success',
  'failure',
  'partial',
  'timeout',
  'cancelled',
  'retrying'
]);

// ===== Envelope Metadata (common to all agent tasks) =====
export const EnvelopeMetadataSchema = z.object({
  // Identifiers
  task_id: z.string().uuid().transform(toTaskId),
  workflow_id: z.string().uuid().transform(toWorkflowId),

  // Routing
  agent_type: z.enum(['scaffold', 'validation', 'e2e', 'integration', 'deployment']),

  // Priority and scheduling
  priority: TaskPriorityEnum.default('medium'),
  status: EnvelopeTaskStatusEnum.default('pending'),

  // Retry policy
  retry_count: z.number().int().min(0).default(0),
  max_retries: z.number().int().min(0).max(10).default(3),

  // Timing
  timeout_ms: z.number().int().min(1000).default(300000), // 5 minutes
  created_at: z.string().datetime(),
  scheduled_at: z.string().datetime().optional(),
  deadline: z.string().datetime().optional(),

  // Tracing and debugging
  trace_id: z.string().uuid().optional(),
  parent_task_id: z.string().uuid().transform(toTaskId).optional(),
  correlation_id: z.string().uuid().optional(),

  // Version and compatibility
  envelope_version: z.literal('1.0.0'),

  // Workflow context (passed between stages)
  workflow_context: z.object({
    workflow_type: z.enum(['app', 'service', 'feature', 'capability']),
    workflow_name: z.string(),
    current_stage: z.string(),
    previous_stage: z.string().optional(),
    stage_outputs: z.record(z.unknown()).optional(), // Outputs from previous stages
  }).optional(),
});

// ===== Agent-Specific Task Payloads (discriminated union) =====

/**
 * Scaffold Agent Envelope
 */
export const ScaffoldEnvelopeSchema = EnvelopeMetadataSchema.extend({
  agent_type: z.literal('scaffold'),
  payload: z.object({
    project_type: z.enum(['app', 'service', 'feature', 'capability']),
    name: z.string().min(1).max(100),
    description: z.string().max(500),
    requirements: z.array(z.string()),
    tech_stack: z.object({
      language: z.string(),
      runtime: z.string(),
      testing: z.string(),
      package_manager: z.string(),
      bundler: z.string().optional(),
      ui_library: z.string().optional(),
    }).optional(),
    template: z.object({
      name: z.string(),
      version: z.string().optional(),
      include_tests: z.boolean().default(true),
      include_docs: z.boolean().default(true),
    }).optional(),
  }),
});

/**
 * Validation Agent Envelope
 */
export const ValidationEnvelopeSchema = EnvelopeMetadataSchema.extend({
  agent_type: z.literal('validation'),
  payload: z.object({
    // Required: files and directory to validate
    file_paths: z.array(z.string()).min(1),
    working_directory: z.string(),

    // Types of validation to perform
    validation_types: z.array(
      z.enum(['typescript', 'eslint', 'security', 'coverage', 'complexity', 'dependencies'])
    ).default(['typescript', 'eslint']),

    // Quality thresholds
    thresholds: z.object({
      coverage: z.number().min(0).max(100).default(80),
      complexity: z.number().min(1).max(100).default(10),
      errors: z.number().min(0).default(0),
      warnings: z.number().min(0).default(10),
      duplications: z.number().min(0).max(100).default(5),
    }).optional(),

    // Configuration
    config: z.object({
      typescript_config_path: z.string().optional(),
      eslint_config_path: z.string().optional(),
      coverage_reporter: z.enum(['text', 'json', 'html', 'lcov']).default('json'),
      fail_on_warnings: z.boolean().default(false),
      include_suggestions: z.boolean().default(true),
    }).optional(),
  }),
});

/**
 * E2E Testing Agent Envelope
 */
export const E2EEnvelopeSchema = EnvelopeMetadataSchema.extend({
  agent_type: z.literal('e2e'),
  payload: z.object({
    working_directory: z.string(),
    entry_points: z.array(z.string()),
    test_scenarios: z.array(z.object({
      name: z.string(),
      description: z.string(),
      steps: z.array(z.string()),
    })).optional(),
    browser: z.enum(['chromium', 'firefox', 'webkit']).default('chromium'),
    headless: z.boolean().default(true),
    screenshot_on_failure: z.boolean().default(true),
    video: z.boolean().default(false),
  }),
});

/**
 * Integration Testing Agent Envelope
 */
export const IntegrationEnvelopeSchema = EnvelopeMetadataSchema.extend({
  agent_type: z.literal('integration'),
  payload: z.object({
    working_directory: z.string(),
    api_endpoints: z.array(z.object({
      method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
      path: z.string(),
      description: z.string().optional(),
    })),
    test_database: z.boolean().default(true),
    test_external_services: z.boolean().default(false),
  }),
});

/**
 * Deployment Agent Envelope
 */
export const DeploymentEnvelopeSchema = EnvelopeMetadataSchema.extend({
  agent_type: z.literal('deployment'),
  payload: z.object({
    working_directory: z.string(),
    deployment_target: z.enum(['docker', 'kubernetes', 'vercel', 'netlify', 'aws']),
    environment: z.enum(['development', 'staging', 'production']).default('development'),
    config: z.record(z.unknown()).optional(),
  }),
});

// ===== Discriminated Union: AgentEnvelope =====
export const AgentEnvelopeSchema = z.discriminatedUnion('agent_type', [
  ScaffoldEnvelopeSchema,
  ValidationEnvelopeSchema,
  E2EEnvelopeSchema,
  IntegrationEnvelopeSchema,
  DeploymentEnvelopeSchema,
]);

// ===== Enhanced Error Reporting Schema =====
export const TaskErrorSchema = z.object({
  // Error identification
  code: z.string(),
  message: z.string(),

  // Error classification
  severity: z.enum(['fatal', 'error', 'warning', 'info']),
  category: z.enum([
    'validation',
    'execution',
    'timeout',
    'resource',
    'dependency',
    'configuration',
    'network',
    'unknown'
  ]),

  // Detailed error information
  details: z.object({
    file_path: z.string().optional(),
    line_number: z.number().optional(),
    column_number: z.number().optional(),
    stack_trace: z.string().optional(),
    context: z.record(z.unknown()).optional(),
  }).optional(),

  // Recovery information
  retryable: z.boolean().default(false),
  retry_after_ms: z.number().optional(),
  suggested_action: z.string().optional(),

  // Debugging
  timestamp: z.string().datetime(),
  trace_id: z.string().uuid().optional(),
});

// ===== Agent Result Envelope =====
export const AgentResultEnvelopeSchema = z.object({
  // Identifiers (same as task)
  task_id: z.string().uuid().transform(toTaskId),
  workflow_id: z.string().uuid().transform(toWorkflowId),
  agent_type: z.enum(['scaffold', 'validation', 'e2e', 'integration', 'deployment']),

  // Result status
  status: EnvelopeTaskStatusEnum,
  success: z.boolean(),

  // Agent-specific result data
  result: z.record(z.unknown()),

  // Error reporting (enhanced)
  errors: z.array(TaskErrorSchema).optional(),
  warnings: z.array(z.string()).optional(),

  // Artifacts produced
  artifacts: z.array(z.object({
    name: z.string(),
    path: z.string(),
    type: z.string(),
    size_bytes: z.number().optional(),
    checksum: z.string().optional(),
  })).optional(),

  // Performance metrics
  metrics: z.object({
    duration_ms: z.number(),
    tokens_used: z.number().optional(),
    api_calls: z.number().optional(),
    memory_used_bytes: z.number().optional(),
    cpu_time_ms: z.number().optional(),
  }),

  // Next stage information
  next_stage: z.string().optional(),
  next_stage_payload: z.record(z.unknown()).optional(),

  // Timestamps
  started_at: z.string().datetime().optional(),
  completed_at: z.string().datetime(),

  // Tracing
  trace_id: z.string().uuid().optional(),

  // Version
  envelope_version: z.literal('1.0.0'),
});

// ===== Type Exports =====
export type EnvelopeMetadata = z.infer<typeof EnvelopeMetadataSchema>;
export type ScaffoldEnvelope = z.infer<typeof ScaffoldEnvelopeSchema>;
export type ValidationEnvelope = z.infer<typeof ValidationEnvelopeSchema>;
export type E2EEnvelope = z.infer<typeof E2EEnvelopeSchema>;
export type IntegrationEnvelope = z.infer<typeof IntegrationEnvelopeSchema>;
export type DeploymentEnvelope = z.infer<typeof DeploymentEnvelopeSchema>;
export type AgentEnvelope = z.infer<typeof AgentEnvelopeSchema>;
export type TaskPriority = z.infer<typeof TaskPriorityEnum>;
export type TaskError = z.infer<typeof TaskErrorSchema>;
export type AgentResultEnvelope = z.infer<typeof AgentResultEnvelopeSchema>;

// ===== Type Guards =====
export function isScaffoldEnvelope(envelope: AgentEnvelope): envelope is ScaffoldEnvelope {
  return envelope.agent_type === 'scaffold';
}

export function isValidationEnvelope(envelope: AgentEnvelope): envelope is ValidationEnvelope {
  return envelope.agent_type === 'validation';
}

export function isE2EEnvelope(envelope: AgentEnvelope): envelope is E2EEnvelope {
  return envelope.agent_type === 'e2e';
}

export function isIntegrationEnvelope(envelope: AgentEnvelope): envelope is IntegrationEnvelope {
  return envelope.agent_type === 'integration';
}

export function isDeploymentEnvelope(envelope: AgentEnvelope): envelope is DeploymentEnvelope {
  return envelope.agent_type === 'deployment';
}

// ===== Validation Helpers =====
export function validateEnvelope(data: unknown): {
  success: boolean;
  envelope?: AgentEnvelope;
  error?: string;
} {
  const result = AgentEnvelopeSchema.safeParse(data);

  if (result.success) {
    return {
      success: true,
      envelope: result.data,
    };
  }

  return {
    success: false,
    error: result.error.message,
  };
}

// ===== Factory Functions =====

/**
 * Creates a validation envelope with workflow context
 */
export function createValidationEnvelope(params: {
  task_id: string;
  workflow_id: string;
  file_paths: string[];
  working_directory: string;
  validation_types?: Array<'typescript' | 'eslint' | 'security' | 'coverage' | 'complexity' | 'dependencies'>;
  thresholds?: {
    coverage?: number;
    complexity?: number;
    errors?: number;
    warnings?: number;
    duplications?: number;
  };
  workflow_context?: {
    workflow_type: 'app' | 'service' | 'feature' | 'capability';
    workflow_name: string;
    current_stage: string;
    previous_stage?: string;
    stage_outputs?: Record<string, unknown>;
  };
  priority?: 'critical' | 'high' | 'medium' | 'low';
  trace_id?: string;
}): ValidationEnvelope {
  const now = new Date().toISOString();

  return {
    // Envelope metadata
    task_id: params.task_id as TaskId,
    workflow_id: params.workflow_id as WorkflowId,
    agent_type: 'validation',
    priority: params.priority || 'medium',
    status: 'pending',
    retry_count: 0,
    max_retries: 3,
    timeout_ms: 300000,
    created_at: now,
    trace_id: params.trace_id,
    envelope_version: '1.0.0',
    workflow_context: params.workflow_context,

    // Validation-specific payload
    payload: {
      file_paths: params.file_paths,
      working_directory: params.working_directory,
      validation_types: params.validation_types || ['typescript', 'eslint'],
      thresholds: params.thresholds ? {
        coverage: params.thresholds.coverage ?? 80,
        complexity: params.thresholds.complexity ?? 10,
        errors: params.thresholds.errors ?? 0,
        warnings: params.thresholds.warnings ?? 10,
        duplications: params.thresholds.duplications ?? 5,
      } : undefined,
    },
  };
}

/**
 * Creates an enhanced task error
 */
export function createTaskError(params: {
  code: string;
  message: string;
  severity: 'fatal' | 'error' | 'warning' | 'info';
  category: 'validation' | 'execution' | 'timeout' | 'resource' | 'dependency' | 'configuration' | 'network' | 'unknown';
  details?: {
    file_path?: string;
    line_number?: number;
    column_number?: number;
    stack_trace?: string;
    context?: Record<string, unknown>;
  };
  retryable?: boolean;
  retry_after_ms?: number;
  suggested_action?: string;
  trace_id?: string;
}): TaskError {
  return {
    code: params.code,
    message: params.message,
    severity: params.severity,
    category: params.category,
    details: params.details,
    retryable: params.retryable || false,
    retry_after_ms: params.retry_after_ms,
    suggested_action: params.suggested_action,
    timestamp: new Date().toISOString(),
    trace_id: params.trace_id,
  };
}
