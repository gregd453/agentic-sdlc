import { z } from 'zod';
import { AgentTaskSchema, AgentResultSchema } from '../core/schemas';

/**
 * Validation Agent specific schemas
 */

// ===== Enums =====
export const ValidationActionEnum = z.enum([
  'validate_code',
  'check_quality',
  'run_linter',
  'check_security',
  'measure_coverage',
  'run_all_checks'
]);

export const ValidationTypeEnum = z.enum([
  'typescript',
  'eslint',
  'security',
  'coverage',
  'complexity',
  'dependencies'
]);

export const ErrorSeverityEnum = z.enum(['error', 'warning', 'info']);

// ===== Validation Task Schema =====
export const ValidationTaskSchema = AgentTaskSchema.extend({
  agent_type: z.literal('validation'),
  action: ValidationActionEnum,
  payload: z.object({
    // Files to validate
    file_paths: z.array(z.string()).min(1),

    // Types of validation to perform
    validation_types: z.array(ValidationTypeEnum).default([
      'typescript',
      'eslint',
      'security',
      'coverage'
    ]),

    // Quality thresholds
    thresholds: z.object({
      coverage: z.number().min(0).max(100).default(80),
      complexity: z.number().min(1).max(100).default(10),
      errors: z.number().min(0).default(0),
      warnings: z.number().min(0).default(10),
      duplications: z.number().min(0).max(100).default(5),
    }).optional(),

    // Configuration overrides
    config: z.object({
      typescript_config_path: z.string().optional(),
      eslint_config_path: z.string().optional(),
      coverage_reporter: z.enum(['text', 'json', 'html', 'lcov']).default('json'),
      fail_on_warnings: z.boolean().default(false),
      include_suggestions: z.boolean().default(true),
    }).optional(),

    // Working directory
    working_directory: z.string().optional(),
  }),
});

// ===== Validation Error Schema =====
export const ValidationErrorSchema = z.object({
  file: z.string(),
  line: z.number().min(1),
  column: z.number().min(1),
  end_line: z.number().min(1).optional(),
  end_column: z.number().min(1).optional(),
  severity: ErrorSeverityEnum,
  message: z.string(),
  rule: z.string().optional(),
  rule_url: z.string().url().optional(),
  code: z.string().optional(),
  source: z.enum(['typescript', 'eslint', 'security', 'custom']),
  fix_available: z.boolean().default(false),
  fix_suggestion: z.string().optional(),
});

// ===== Validation Metrics Schema =====
export const ValidationMetricsSchema = z.object({
  total_files: z.number().min(0),
  files_with_errors: z.number().min(0),
  total_errors: z.number().min(0),
  total_warnings: z.number().min(0),
  total_info: z.number().min(0),
  coverage_percentage: z.number().min(0).max(100).optional(),
  complexity_score: z.number().min(0).optional(),
  max_complexity: z.number().min(0).optional(),
  duplication_percentage: z.number().min(0).max(100).optional(),
  lines_of_code: z.number().min(0).optional(),
  maintainability_index: z.number().min(0).max(100).optional(),
});

// ===== Quality Gate Result Schema =====
export const QualityGateResultSchema = z.object({
  gate_name: z.string(),
  metric: z.string(),
  expected: z.union([z.number(), z.string()]),
  actual: z.union([z.number(), z.string()]),
  operator: z.enum(['gt', 'gte', 'lt', 'lte', 'eq', 'neq']),
  passed: z.boolean(),
  blocking: z.boolean(),
  message: z.string().optional(),
});

// ===== Validation Result Schema =====
export const ValidationResultSchema = AgentResultSchema.extend({
  agent_type: z.literal('validation'),
  action: ValidationActionEnum,
  result: z.object({
    // Overall validation status
    valid: z.boolean(),
    passed_quality_gates: z.boolean(),

    // Errors and warnings
    errors: z.array(ValidationErrorSchema),

    // Metrics
    metrics: ValidationMetricsSchema,

    // Quality gates
    quality_gates: z.array(QualityGateResultSchema),

    // Detailed reports by type
    reports: z.object({
      typescript: z.object({
        errors: z.number(),
        files_checked: z.number(),
        compilation_success: z.boolean(),
        diagnostics: z.array(z.record(z.unknown())).optional(),
      }).optional(),

      eslint: z.object({
        errors: z.number(),
        warnings: z.number(),
        fixable_errors: z.number(),
        fixable_warnings: z.number(),
        files_checked: z.number(),
        rules_violated: z.array(z.string()).optional(),
      }).optional(),

      security: z.object({
        vulnerabilities_found: z.number(),
        severity_counts: z.object({
          critical: z.number(),
          high: z.number(),
          moderate: z.number(),
          low: z.number(),
        }),
        packages_audited: z.number(),
        recommendations: z.array(z.string()).optional(),
      }).optional(),

      coverage: z.object({
        lines: z.object({
          total: z.number(),
          covered: z.number(),
          percentage: z.number(),
        }),
        statements: z.object({
          total: z.number(),
          covered: z.number(),
          percentage: z.number(),
        }),
        functions: z.object({
          total: z.number(),
          covered: z.number(),
          percentage: z.number(),
        }),
        branches: z.object({
          total: z.number(),
          covered: z.number(),
          percentage: z.number(),
        }),
        uncovered_files: z.array(z.string()).optional(),
      }).optional(),
    }).optional(),

    // Recommendations
    recommendations: z.array(z.object({
      type: z.enum(['fix', 'refactor', 'optimize', 'security', 'best-practice']),
      priority: z.enum(['low', 'medium', 'high', 'critical']),
      message: z.string(),
      file: z.string().optional(),
      line: z.number().optional(),
      effort: z.enum(['quick', 'medium', 'complex']).optional(),
    })).optional(),

    // Summary
    summary: z.object({
      overall_status: z.enum(['pass', 'pass_with_warnings', 'fail']),
      total_issues: z.number(),
      critical_issues: z.number(),
      time_to_fix_estimate_minutes: z.number().optional(),
      next_actions: z.array(z.string()),
    }),
  }),
});

// ===== Type Exports =====
export type ValidationTask = z.infer<typeof ValidationTaskSchema>;
export type ValidationResult = z.infer<typeof ValidationResultSchema>;
export type ValidationAction = z.infer<typeof ValidationActionEnum>;
export type ValidationType = z.infer<typeof ValidationTypeEnum>;
export type ValidationError = z.infer<typeof ValidationErrorSchema>;
export type ValidationMetrics = z.infer<typeof ValidationMetricsSchema>;
export type QualityGateResult = z.infer<typeof QualityGateResultSchema>;
export type ErrorSeverity = z.infer<typeof ErrorSeverityEnum>;

// ===== Type Guards =====
export function isValidationTask(task: unknown): task is ValidationTask {
  return ValidationTaskSchema.safeParse(task).success;
}

export function isValidationResult(result: unknown): result is ValidationResult {
  return ValidationResultSchema.safeParse(result).success;
}

// ===== Factory Functions =====
export function createValidationTask(
  workflowId: string,
  filePaths: string[],
  validationTypes?: ValidationType[]
): ValidationTask {
  const now = new Date().toISOString();
  return {
    task_id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` as any,
    workflow_id: workflowId as any,
    agent_type: 'validation',
    action: 'validate_code',
    status: 'pending',
    priority: 50,
    payload: {
      file_paths: filePaths,
      validation_types: validationTypes || ['typescript', 'eslint', 'security', 'coverage'],
    },
    version: '1.0.0',
    timeout_ms: 300000, // 5 minutes for validation
    retry_count: 0,
    max_retries: 3,
    created_at: now,
  };
}
