import { BaseAgent, AgentEnvelope, TaskResult, AgentError } from '@agentic-sdlc/base-agent';
import { LoggerConfigService } from '@agentic-sdlc/logger-config';
import { ConfigurationManager } from '@agentic-sdlc/config-manager';
import { ServiceLocator } from '@agentic-sdlc/service-locator';
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
 * Phase 3: Updated to accept messageBus parameter
 * Phase 2.2: Updated to accept DI services
 */
export class ValidationAgent extends BaseAgent {
  private policy: PolicyConfig | null = null;

  constructor(
    messageBus: any,
    loggerConfigService?: LoggerConfigService,
    configurationManager?: ConfigurationManager,
    serviceLocator?: ServiceLocator,
    platformId?: string // Phase 4: Platform context for multi-platform SDLC system
  ) {
    super(
      {
        type: 'validation',
        version: '1.0.0',
        capabilities: [
          'typescript-compilation',
          'eslint-validation',
          'test-coverage',
          'security-audit',
          'quality-gates'
        ]
      },
      messageBus,
      loggerConfigService,
      configurationManager,
      serviceLocator,
      platformId
    );
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
   * SESSION #65: Updated to use AgentEnvelope v2.0.0
   */
  async execute(task: AgentEnvelope): Promise<TaskResult> {
    const startTime = Date.now();
    const traceId = task.trace.trace_id;

    this.logger.info('[SESSION #65] Executing validation task', {
      task_id: task.task_id,
      workflow_id: task.workflow_id,
      trace_id: traceId
    });

    try {
      // SESSION #67: AgentEnvelope v2.0.0 - task IS the envelope, payload contains validation data
      this.logger.info('[SESSION #67] Extracting validation data from task.payload', {
        task_id: task.task_id,
        workflow_id: task.workflow_id,
        agent_type: task.agent_type,
        has_payload: !!task.payload,
        payload_keys: Object.keys(task.payload).join(', ')
      });

      // Validate agent type routing
      if (task.agent_type !== 'validation') {
        this.logger.warn('[SESSION #67] Wrong agent type routed to validation agent', {
          expected: 'validation',
          actual: task.agent_type,
          task_id: task.task_id
        });

        throw new AgentError(
          `Wrong agent type: expected validation, got ${task.agent_type}`,
          'WRONG_AGENT_TYPE'
        );
      }

      // Extract validation payload from task.payload
      const payload = task.payload as any;

      // Validate required fields are present
      if (!payload.file_paths || !Array.isArray(payload.file_paths)) {
        this.logger.error('[SESSION #67] Missing or invalid file_paths in payload', {
          has_file_paths: !!payload.file_paths,
          file_paths_type: typeof payload.file_paths,
          payload_keys: Object.keys(payload)
        });
        throw new AgentError('Missing file_paths in validation payload', 'INVALID_PAYLOAD');
      }

      if (!payload.working_directory) {
        this.logger.error('[SESSION #67] Missing working_directory in payload', {
          payload_keys: Object.keys(payload)
        });
        throw new AgentError('Missing working_directory in validation payload', 'INVALID_PAYLOAD');
      }

      this.logger.info('[SESSION #67] Validation payload extracted successfully', {
        task_id: task.task_id,
        workflow_id: task.workflow_id,
        file_paths_count: payload.file_paths.length,
        working_directory: payload.working_directory,
        validation_types: payload.validation_types || ['typescript', 'eslint'],
        has_workflow_context: !!task.workflow_context
      });

      // Extract context from payload (matching orchestrator's buildAgentEnvelope)
      const context = {
        project_path: payload.working_directory,
        validation_types: (payload.validation_types || ['typescript', 'eslint']).filter((v: string): v is 'typescript' | 'eslint' | 'coverage' | 'security' =>
          ['typescript', 'eslint', 'coverage', 'security'].includes(v)
        ),
        coverage_threshold: payload.thresholds?.coverage,
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

      // SESSION #65: Collect errors in proper format (TaskResult schema)
      const errorList: Array<{code: string; message: string; recoverable: boolean; details?: Record<string, unknown>}> = [];
      if (report.overall_status === 'failed') {
        if (report.quality_gates.blocking_failures.length > 0) {
          report.quality_gates.blocking_failures.forEach(failure => {
            errorList.push({
              code: 'QUALITY_GATE_FAILURE',
              message: failure,
              recoverable: false
            });
          });
        }

        validationChecks
          .filter(c => c.status === 'failed' && c.errors)
          .forEach(c => {
            (c.errors || []).forEach(error => {
              errorList.push({
                code: 'VALIDATION_ERROR',
                message: error,
                recoverable: true
              });
            });
          });
      }

      // SESSION #65: Return TaskResult conforming to canonical schema
      const result: TaskResult = {
        message_id: task.message_id,
        task_id: task.task_id,
        workflow_id: task.workflow_id,
        agent_id: this.agentId,
        status: taskStatus,
        result: {
          data: output,
          metrics: {
            duration_ms: Date.now() - startTime,
            resource_usage: {
              api_calls: 0 // No Claude API calls in validation
            }
          }
        },
        errors: errorList.length > 0 ? errorList : undefined,
        next_actions: taskStatus === 'success' ? [{
          action: 'test',
          agent_type: 'e2e_test',
          priority: 'high'
        }] : undefined,
        metadata: {
          completed_at: new Date().toISOString(),
          trace_id: task.trace.trace_id
        }
      };

      return result;
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
