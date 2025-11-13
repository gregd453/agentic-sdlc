import { BaseAgent, TaskAssignment, TaskResult, AgentError } from '@agentic-sdlc/base-agent';
import {
  isValidationEnvelope,
  validateEnvelope
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
 * Phase 3: Updated to accept messageBus parameter
 */
export class ValidationAgent extends BaseAgent {
  private policy: PolicyConfig | null = null;

  constructor(messageBus: any) {
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
      messageBus
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
   * SESSION #36: Updated to use AgentEnvelope instead of adapter
   * SESSION #47: Enhanced debugging for envelope extraction
   */
  async execute(task: TaskAssignment): Promise<TaskResult> {
    const startTime = Date.now();
    const traceId = this.generateTraceId();

    this.logger.info('[SESSION #36] Executing validation task', {
      task_id: task.task_id,
      workflow_id: task.workflow_id,
      trace_id: traceId
    });

    try {
      // SESSION #47: Enhanced envelope extraction debugging
      const taskObj = task as any;
      this.logger.info('[SESSION #38] Task structure debug', {
        has_context: !!taskObj.context,
        context_keys: taskObj.context ? Object.keys(taskObj.context).slice(0, 10) : [],
        context_type: typeof taskObj.context,
        has_payload: !!taskObj.payload,
        payload_keys: taskObj.payload ? Object.keys(taskObj.payload).slice(0, 10) : [],
        task_keys: Object.keys(taskObj).slice(0, 15),
        context_agent_type: taskObj.context?.agent_type,
        context_envelope_version: taskObj.context?.envelope_version
      });

      // SESSION #47: The envelope is at taskObj.context (from agent-dispatcher wrapper)
      // Agent dispatcher sends: { payload: { context: envelope } }
      // Base agent validates payload and passes to execute, so envelope is in task.context
      const envelopeData = taskObj.context;

      if (!envelopeData) {
        this.logger.error('[SESSION #47] No context found in task', {
          task_keys: Object.keys(taskObj),
          task_id: task.task_id
        });
        throw new AgentError('No context envelope found in task', 'ENVELOPE_MISSING_ERROR');
      }

      this.logger.info('[SESSION #47] Attempting to validate envelope', {
        envelope_agent_type: envelopeData.agent_type,
        envelope_version: envelopeData.envelope_version,
        has_payload: !!envelopeData.payload,
        has_workflow_context: !!envelopeData.workflow_context
      });

      // Session #47: Log full envelope structure for debugging
      console.log('[SESSION #47] Full envelope data:', JSON.stringify(envelopeData, null, 2));
      console.log('[SESSION #47] Envelope keys:', Object.keys(envelopeData).join(', '));
      console.log('[SESSION #47] Agent type:', envelopeData.agent_type);
      console.log('[SESSION #47] Envelope version:', envelopeData.envelope_version);
      console.log('[SESSION #47] Payload keys:', Object.keys(envelopeData.payload || {}).join(', '));

      const validation = validateEnvelope(envelopeData);

      if (!validation.success) {
        console.log('[SESSION #47] Validation failed with error:', validation.error);
        this.logger.error('[SESSION #37] Invalid envelope format', {
          error: validation.error,
          error_details: validation.error?.toString(),
          task_id: task.task_id,
          envelope_keys: Object.keys(envelopeData),
          envelope_agent_type: envelopeData.agent_type,
          envelope_str: JSON.stringify(envelopeData).substring(0, 200)
        });

        throw new AgentError(
          `Invalid envelope: ${validation.error}`,
          'ENVELOPE_VALIDATION_ERROR'
        );
      }

      const envelope = validation.envelope!;

      // Type guard to ensure this is a validation envelope
      if (!isValidationEnvelope(envelope)) {
        this.logger.warn('[SESSION #36] Wrong agent type routed to validation agent', {
          expected: 'validation',
          actual: envelope.agent_type,
          task_id: task.task_id
        });

        throw new AgentError(
          `Wrong agent type: expected validation, got ${envelope.agent_type}`,
          'WRONG_AGENT_TYPE'
        );
      }

      this.logger.info('[SESSION #36] Envelope validated successfully', {
        task_id: envelope.task_id,
        workflow_id: envelope.workflow_id,
        file_paths_count: envelope.payload.file_paths.length,
        working_directory: envelope.payload.working_directory,
        validation_types: envelope.payload.validation_types,
        has_workflow_context: !!envelope.workflow_context
      });

      // Extract context from envelope (type-safe!)
      const context = {
        project_path: envelope.payload.working_directory,
        validation_types: envelope.payload.validation_types.filter((v): v is 'typescript' | 'eslint' | 'coverage' | 'security' =>
          ['typescript', 'eslint', 'coverage', 'security'].includes(v)
        ),
        coverage_threshold: envelope.payload.thresholds?.coverage,
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
