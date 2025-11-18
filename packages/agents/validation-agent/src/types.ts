import { z } from 'zod';

// Validation task context schema
export const ValidationTaskContextSchema = z.object({
  project_path: z.string(),
  package_manager: z.enum(['npm', 'pnpm', 'yarn']).default('pnpm'),
  validation_types: z.array(
    z.enum(['typescript', 'eslint', 'coverage', 'security'])
  ).default(['typescript', 'eslint', 'coverage', 'security']),
  policy_path: z.string().optional(),
  coverage_threshold: z.number().min(0).max(100).optional()
});

export type ValidationTaskContext = z.infer<typeof ValidationTaskContextSchema>;

// Individual validation result
export const ValidationCheckResultSchema = z.object({
  type: z.enum(['typescript', 'eslint', 'coverage', 'security']),
  status: z.enum(['passed', 'failed', 'warning', 'skipped']),
  duration_ms: z.number(),
  errors: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
  details: z.record(z.unknown()).optional()
});

export type ValidationCheckResult = z.infer<typeof ValidationCheckResultSchema>;

// TypeScript validation details
export const TypeScriptValidationDetailsSchema = z.object({
  compilation_errors: z.number(),
  type_errors: z.number(),
  files_checked: z.number(),
  error_list: z.array(z.object({
    file: z.string(),
    line: z.number().optional(),
    column: z.number().optional(),
    message: z.string(),
    code: z.string().optional()
  })).optional()
});

export type TypeScriptValidationDetails = z.infer<typeof TypeScriptValidationDetailsSchema>;

// ESLint validation details
export const ESLintValidationDetailsSchema = z.object({
  error_count: z.number(),
  warning_count: z.number(),
  files_checked: z.number(),
  fixable_errors: z.number(),
  fixable_warnings: z.number(),
  issues: z.array(z.object({
    file: z.string(),
    line: z.number(),
    column: z.number(),
    severity: z.enum(['error', 'warning']),
    message: z.string(),
    rule_id: z.string().optional()
  })).optional()
});

export type ESLintValidationDetails = z.infer<typeof ESLintValidationDetailsSchema>;

// Coverage validation details
export const CoverageValidationDetailsSchema = z.object({
  line_coverage: z.number().min(0).max(100),
  branch_coverage: z.number().min(0).max(100),
  function_coverage: z.number().min(0).max(100),
  statement_coverage: z.number().min(0).max(100),
  threshold: z.number().min(0).max(100),
  passed: z.boolean(),
  uncovered_files: z.array(z.object({
    file: z.string(),
    coverage: z.number()
  })).optional()
});

export type CoverageValidationDetails = z.infer<typeof CoverageValidationDetailsSchema>;

// Security validation details
export const SecurityValidationDetailsSchema = z.object({
  critical_vulnerabilities: z.number(),
  high_vulnerabilities: z.number(),
  medium_vulnerabilities: z.number(),
  low_vulnerabilities: z.number(),
  total_vulnerabilities: z.number(),
  vulnerabilities: z.array(z.object({
    id: z.string(),
    severity: z.enum(['critical', 'high', 'medium', 'low']),
    package: z.string(),
    title: z.string(),
    description: z.string().optional(),
    url: z.string().optional(),
    fixAvailable: z.boolean().optional()
  })).optional()
});

export type SecurityValidationDetails = z.infer<typeof SecurityValidationDetailsSchema>;

// Quality gate result
export const QualityGateResultSchema = z.object({
  passed: z.boolean(),
  gates_evaluated: z.number(),
  gates_passed: z.number(),
  gates_failed: z.number(),
  blocking_failures: z.array(z.string()),
  warnings: z.array(z.string()).optional(),
  details: z.array(z.object({
    gate_name: z.string(),
    metric: z.string(),
    threshold: z.union([z.number(), z.string()]),
    actual: z.union([z.number(), z.string()]),
    passed: z.boolean(),
    blocking: z.boolean(),
    operator: z.string()
  }))
});

export type QualityGateResult = z.infer<typeof QualityGateResultSchema>;

// Complete validation report
export const ValidationReportSchema = z.object({
  task_id: z.string().uuid(),
  workflow_id: z.string().uuid(),
  timestamp: z.string(),
  project_path: z.string(),
  overall_status: z.enum(['passed', 'failed', 'warning']),
  validation_checks: z.array(ValidationCheckResultSchema),
  quality_gates: QualityGateResultSchema,
  summary: z.object({
    total_checks: z.number(),
    passed_checks: z.number(),
    failed_checks: z.number(),
    warning_checks: z.number(),
    total_duration_ms: z.number()
  }),
  recommendations: z.array(z.string()).optional()
});

export type ValidationReport = z.infer<typeof ValidationReportSchema>;

// Policy configuration (loaded from policy.yaml)
export const PolicyConfigSchema = z.object({
  gates: z.record(z.object({
    metric: z.string(),
    operator: z.string(),
    threshold: z.union([z.number(), z.string()]),
    description: z.string(),
    blocking: z.boolean()
  })).optional(),
  observability: z.object({
    logging: z.object({
      level: z.string(),
      structured: z.boolean()
    }).optional()
  }).optional()
});

export type PolicyConfig = z.infer<typeof PolicyConfigSchema>;
