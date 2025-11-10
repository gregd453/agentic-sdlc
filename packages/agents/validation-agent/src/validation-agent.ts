import { BaseAgent, TaskAssignment, TaskResult, AgentError } from '@agentic-sdlc/base-agent';
import {
  ValidationTask,
  SchemaRegistry
} from '@agentic-sdlc/shared-types';
import {
  ValidationCheckResult,
  PolicyConfig,
  ValidationTaskContext
} from './types';
import { loadPolicyConfig, getDefaultPolicy } from './utils/policy-loader';
import { generateValidationReport, formatReportAsText } from './utils/report-generator';
import { validateTypeScript } from './validators/typescript-validator';
import { validateESLint } from './validators/eslint-validator';
import { validateCoverage } from './validators/coverage-validator';
import { validateSecurity } from './validators/security-validator';
import { evaluateQualityGates } from './validators/quality-gates';
import * as fs from 'fs-extra';

/**
 * ValidationAgent - Performs code validation with quality gate enforcement
 */
export class ValidationAgent extends BaseAgent {
  private policy: PolicyConfig | null = null;

  constructor() {
    super({
      type: 'validation',
      version: '1.0.0',
      capabilities: [
        'typescript-compilation',
        'eslint-validation',
        'test-coverage',
        'security-audit',
        'quality-gates'
      ]
    });
  }

  /**
   * Initialize agent and load policy configuration
   */
  async initialize(): Promise<void> {
    await super.initialize();

    // Load policy configuration
    try {
      this.policy = await loadPolicyConfig();
      this.logger.info('Policy configuration loaded', {
        gates: Object.keys(this.policy.gates || {})
      });
    } catch (error) {
      this.logger.warn('Failed to load policy, using defaults', { error });
      this.policy = getDefaultPolicy();
    }
  }

  /**
   * Execute validation task
   */
  async execute(task: TaskAssignment): Promise<TaskResult> {
    const startTime = Date.now();
    const traceId = this.generateTraceId();

    this.logger.info('Executing validation task', {
      task_id: task.task_id,
      workflow_id: task.workflow_id,
      trace_id: traceId
    });

    try {
      // Validate and parse the task using schema registry
      const validationTask = SchemaRegistry.validate<ValidationTask>(
        'validation.task',
        task
      );

      // Extract context from validated task
      const context = {
        project_path: validationTask.payload.working_directory || process.cwd(),
        validation_types: validationTask.payload.validation_types.map(v => v as 'typescript' | 'eslint' | 'coverage' | 'security'),
        coverage_threshold: validationTask.payload.thresholds?.coverage,
        package_manager: 'pnpm' as const,
      };

      // SESSION #32: Check if working directory exists before validation
      this.logger.info('[SESSION #32] Checking working directory existence', {
        working_directory: context.project_path,
        task_id: task.task_id
      });

      const workingDirExists = await fs.pathExists(context.project_path);

      if (!workingDirExists) {
        const errorMsg = `Working directory does not exist: ${context.project_path}`;
        this.logger.error('[SESSION #32] Working directory not found', {
          working_directory: context.project_path,
          task_id: task.task_id,
          workflow_id: task.workflow_id,
          error: errorMsg
        });

        throw new AgentError(
          errorMsg,
          'WORKSPACE_ERROR',
          { cause: new Error(`Path does not exist: ${context.project_path}`) }
        );
      }

      this.logger.info('[SESSION #32] Working directory exists, proceeding with validation', {
        working_directory: context.project_path
      });

      // Run validation checks
      const validationChecks = await this.runValidationChecks(context);

      // Evaluate quality gates
      const qualityGates = evaluateQualityGates(
        validationChecks,
        this.policy || getDefaultPolicy()
      );

      // Generate comprehensive report
      const report = generateValidationReport(
        task.task_id,
        task.workflow_id,
        context.project_path,
        validationChecks,
        qualityGates,
        startTime
      );

      // Log report summary
      this.logger.info('Validation completed', {
        task_id: task.task_id,
        overall_status: report.overall_status,
        duration_ms: report.summary.total_duration_ms,
        passed_checks: report.summary.passed_checks,
        failed_checks: report.summary.failed_checks
      });

      // Log formatted report
      const formattedReport = formatReportAsText(report);
      this.logger.info('Validation Report:\n' + formattedReport);

      // Determine task status
      const taskStatus = report.overall_status === 'passed' ? 'success' :
                         report.overall_status === 'warning' ? 'partial' : 'failure';

      // Prepare output
      const output = {
        report,
        validation_checks: validationChecks,
        quality_gates: qualityGates
      };

      // Collect errors if any
      const errors: string[] = [];
      if (report.overall_status === 'failed') {
        if (report.quality_gates.blocking_failures.length > 0) {
          errors.push(...report.quality_gates.blocking_failures);
        }

        validationChecks
          .filter(c => c.status === 'failed' && c.errors)
          .forEach(c => errors.push(...(c.errors || [])));
      }

      return {
        task_id: task.task_id,
        workflow_id: task.workflow_id,
        status: taskStatus,
        output,
        errors: errors.length > 0 ? errors : undefined,
        metrics: {
          duration_ms: Date.now() - startTime,
          api_calls: 0 // No Claude API calls in validation
        },
        next_stage: taskStatus === 'success' ? 'integration' : undefined
      };
    } catch (error) {
      // SESSION #32: Enhanced error logging with detailed diagnostics
      const errorDetails = {
        task_id: task.task_id,
        workflow_id: task.workflow_id,
        trace_id: traceId,
        error_message: error instanceof Error ? error.message : String(error),
        error_code: error instanceof AgentError ? error.code : 'UNKNOWN',
        error_stack: error instanceof Error ? error.stack : undefined,
        error_type: error instanceof Error ? error.constructor.name : typeof error
      };

      this.logger.error('[SESSION #32] Validation task failed with detailed diagnostics', errorDetails);

      // If this is already an AgentError, re-throw it
      if (error instanceof AgentError) {
        throw error;
      }

      // Otherwise wrap in AgentError with context
      throw new AgentError(
        `Validation task failed: ${error instanceof Error ? error.message : String(error)}`,
        'VALIDATION_FAILED',
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }


  /**
   * Run all validation checks based on context
   */
  private async runValidationChecks(
    context: ValidationTaskContext
  ): Promise<ValidationCheckResult[]> {
    const checks: ValidationCheckResult[] = [];
    const validationTypes = context.validation_types || [
      'typescript',
      'eslint',
      'coverage',
      'security'
    ];

    this.logger.info('[SESSION #32] Running validation checks', {
      project_path: context.project_path,
      validation_types: validationTypes
    });

    // Run TypeScript validation
    if (validationTypes.includes('typescript')) {
      this.logger.info('[SESSION #32] Running TypeScript validation', {
        project_path: context.project_path
      });
      try {
        const tsResult = await validateTypeScript(context.project_path);
        this.logger.info('[SESSION #32] TypeScript validation completed', {
          status: tsResult.status,
          duration_ms: tsResult.duration_ms,
          error_count: tsResult.errors?.length || 0
        });
        checks.push(tsResult);
      } catch (error) {
        this.logger.error('[SESSION #32] TypeScript validation threw exception', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
        throw error;
      }
    }

    // Run ESLint validation
    if (validationTypes.includes('eslint')) {
      this.logger.info('[SESSION #32] Running ESLint validation', {
        project_path: context.project_path
      });
      try {
        const eslintResult = await validateESLint(context.project_path);
        this.logger.info('[SESSION #32] ESLint validation completed', {
          status: eslintResult.status,
          duration_ms: eslintResult.duration_ms,
          error_count: eslintResult.errors?.length || 0
        });
        checks.push(eslintResult);
      } catch (error) {
        this.logger.error('[SESSION #32] ESLint validation threw exception', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
        throw error;
      }
    }

    // Run coverage validation
    if (validationTypes.includes('coverage')) {
      this.logger.info('[SESSION #32] Running coverage validation', {
        project_path: context.project_path
      });
      try {
        const coverageThreshold = context.coverage_threshold ||
                                  this.getCoverageThresholdFromPolicy();
        const coverageResult = await validateCoverage(
          context.project_path,
          coverageThreshold
        );
        this.logger.info('[SESSION #32] Coverage validation completed', {
          status: coverageResult.status,
          duration_ms: coverageResult.duration_ms
        });
        checks.push(coverageResult);
      } catch (error) {
        this.logger.error('[SESSION #32] Coverage validation threw exception', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
        throw error;
      }
    }

    // Run security validation
    if (validationTypes.includes('security')) {
      this.logger.info('[SESSION #32] Running security validation', {
        project_path: context.project_path
      });
      try {
        const securityResult = await validateSecurity(context.project_path);
        this.logger.info('[SESSION #32] Security validation completed', {
          status: securityResult.status,
          duration_ms: securityResult.duration_ms
        });
        checks.push(securityResult);
      } catch (error) {
        this.logger.error('[SESSION #32] Security validation threw exception', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
        throw error;
      }
    }

    this.logger.info('[SESSION #32] All validation checks completed', {
      total_checks: checks.length,
      passed: checks.filter(c => c.status === 'passed').length,
      failed: checks.filter(c => c.status === 'failed').length,
      skipped: checks.filter(c => c.status === 'skipped').length
    });

    return checks;
  }

  /**
   * Extract coverage threshold from policy
   */
  private getCoverageThresholdFromPolicy(): number {
    if (!this.policy || !this.policy.gates || !this.policy.gates.coverage) {
      return 80; // Default threshold
    }

    const threshold = this.policy.gates.coverage.threshold;
    return typeof threshold === 'number' ? threshold : 80;
  }
}
