/**
 * Pipeline-specific error classes
 */

import { BaseError, ErrorCategory, ErrorSeverity, ErrorMetadata, RecoveryStrategy } from './base.error';

/**
 * Pipeline error codes
 */
export enum PipelineErrorCode {
  // Pipeline lifecycle errors
  PIPELINE_NOT_FOUND = 'PIPELINE_NOT_FOUND',
  PIPELINE_ALREADY_RUNNING = 'PIPELINE_ALREADY_RUNNING',
  PIPELINE_INIT_FAILED = 'PIPELINE_INIT_FAILED',
  PIPELINE_CANCELLED = 'PIPELINE_CANCELLED',

  // Stage errors
  STAGE_NOT_FOUND = 'STAGE_NOT_FOUND',
  STAGE_EXECUTION_FAILED = 'STAGE_EXECUTION_FAILED',
  STAGE_TIMEOUT = 'STAGE_TIMEOUT',
  STAGE_DEPENDENCY_FAILED = 'STAGE_DEPENDENCY_FAILED',

  // Quality gate errors
  QUALITY_GATE_FAILED = 'QUALITY_GATE_FAILED',
  QUALITY_GATE_TIMEOUT = 'QUALITY_GATE_TIMEOUT',

  // DAG errors
  CIRCULAR_DEPENDENCY = 'CIRCULAR_DEPENDENCY',
  INVALID_DEPENDENCY = 'INVALID_DEPENDENCY',
  DEPENDENCY_RESOLUTION_FAILED = 'DEPENDENCY_RESOLUTION_FAILED',

  // Workflow errors
  WORKFLOW_NOT_FOUND = 'WORKFLOW_NOT_FOUND',
  WORKFLOW_STATE_INVALID = 'WORKFLOW_STATE_INVALID',

  // Execution errors
  EXECUTION_FAILED = 'EXECUTION_FAILED',
  EXECUTION_TIMEOUT = 'EXECUTION_TIMEOUT',
  PARALLEL_EXECUTION_FAILED = 'PARALLEL_EXECUTION_FAILED'
}

/**
 * Base pipeline error
 */
export class PipelineError extends BaseError {
  public readonly pipelineId?: string;
  public readonly workflowId?: string;
  public readonly executionId?: string;

  constructor(
    message: string,
    code: PipelineErrorCode,
    options: {
      pipelineId?: string;
      workflowId?: string;
      executionId?: string;
      category?: ErrorCategory;
      severity?: ErrorSeverity;
      retryable?: boolean;
      recoveryStrategy?: RecoveryStrategy;
      metadata?: Partial<ErrorMetadata>;
      cause?: Error;
    } = {}
  ) {
    super(message, {
      code,
      category: options.category || ErrorCategory.INTERNAL,
      severity: options.severity || ErrorSeverity.HIGH,
      retryable: options.retryable !== undefined ? options.retryable : false,
      recoveryStrategy: options.recoveryStrategy || RecoveryStrategy.ABORT,
      metadata: {
        ...options.metadata,
        workflowId: options.workflowId,
        context: {
          pipelineId: options.pipelineId,
          workflowId: options.workflowId,
          executionId: options.executionId,
          ...options.metadata?.context
        }
      },
      cause: options.cause
    });

    this.pipelineId = options.pipelineId;
    this.workflowId = options.workflowId;
    this.executionId = options.executionId;
  }
}

/**
 * Stage execution error
 */
export class StageExecutionError extends PipelineError {
  public readonly stageId: string;
  public readonly stageName?: string;

  constructor(
    stageId: string,
    message: string,
    options: {
      stageName?: string;
      pipelineId?: string;
      workflowId?: string;
      executionId?: string;
      retryable?: boolean;
      metadata?: Partial<ErrorMetadata>;
      cause?: Error;
    } = {}
  ) {
    super(message, PipelineErrorCode.STAGE_EXECUTION_FAILED, {
      ...options,
      category: ErrorCategory.INTERNAL,
      severity: ErrorSeverity.HIGH,
      retryable: options.retryable !== undefined ? options.retryable : true,
      recoveryStrategy: options.retryable ? RecoveryStrategy.RETRY : RecoveryStrategy.ABORT,
      metadata: {
        ...options.metadata,
        context: {
          stageId,
          stageName: options.stageName,
          ...options.metadata?.context
        }
      }
    });

    this.stageId = stageId;
    this.stageName = options.stageName;
  }
}

/**
 * Quality gate failure error
 */
export class QualityGateError extends PipelineError {
  public readonly gateName: string;
  public readonly actualValue: number | string;
  public readonly threshold: number | string;
  public readonly blocking: boolean;

  constructor(
    gateName: string,
    actualValue: number | string,
    threshold: number | string,
    options: {
      blocking?: boolean;
      stageId?: string;
      pipelineId?: string;
      workflowId?: string;
      metadata?: Partial<ErrorMetadata>;
      cause?: Error;
    } = {}
  ) {
    const blocking = options.blocking !== undefined ? options.blocking : true;
    super(
      `Quality gate failed: ${gateName} (actual: ${actualValue}, threshold: ${threshold})`,
      PipelineErrorCode.QUALITY_GATE_FAILED,
      {
        ...options,
        category: ErrorCategory.VALIDATION,
        severity: blocking ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM,
        retryable: false,
        recoveryStrategy: blocking ? RecoveryStrategy.ABORT : RecoveryStrategy.IGNORE,
        metadata: {
          ...options.metadata,
          context: {
            gateName,
            actualValue,
            threshold,
            blocking,
            stageId: options.stageId,
            ...options.metadata?.context
          }
        }
      }
    );

    this.gateName = gateName;
    this.actualValue = actualValue;
    this.threshold = threshold;
    this.blocking = blocking;
  }
}

/**
 * Circular dependency error
 */
export class CircularDependencyError extends PipelineError {
  public readonly dependencyChain: string[];

  constructor(
    dependencyChain: string[],
    options: {
      pipelineId?: string;
      workflowId?: string;
      metadata?: Partial<ErrorMetadata>;
      cause?: Error;
    } = {}
  ) {
    super(
      `Circular dependency detected: ${dependencyChain.join(' -> ')}`,
      PipelineErrorCode.CIRCULAR_DEPENDENCY,
      {
        ...options,
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.CRITICAL,
        retryable: false,
        recoveryStrategy: RecoveryStrategy.ABORT,
        metadata: {
          ...options.metadata,
          context: {
            dependencyChain,
            ...options.metadata?.context
          }
        }
      }
    );

    this.dependencyChain = dependencyChain;
  }
}

/**
 * Stage dependency failure error
 */
export class StageDependencyError extends PipelineError {
  public readonly stageId: string;
  public readonly dependencyId: string;

  constructor(
    stageId: string,
    dependencyId: string,
    options: {
      pipelineId?: string;
      workflowId?: string;
      executionId?: string;
      metadata?: Partial<ErrorMetadata>;
      cause?: Error;
    } = {}
  ) {
    super(
      `Stage ${stageId} dependency failed: ${dependencyId}`,
      PipelineErrorCode.STAGE_DEPENDENCY_FAILED,
      {
        ...options,
        category: ErrorCategory.INTERNAL,
        severity: ErrorSeverity.HIGH,
        retryable: false,
        recoveryStrategy: RecoveryStrategy.ABORT,
        metadata: {
          ...options.metadata,
          context: {
            stageId,
            dependencyId,
            ...options.metadata?.context
          }
        }
      }
    );

    this.stageId = stageId;
    this.dependencyId = dependencyId;
  }
}

/**
 * Pipeline execution timeout error
 */
export class PipelineTimeoutError extends PipelineError {
  constructor(
    pipelineId: string,
    timeoutMs: number,
    options: {
      workflowId?: string;
      executionId?: string;
      metadata?: Partial<ErrorMetadata>;
      cause?: Error;
    } = {}
  ) {
    super(
      `Pipeline execution timed out: ${pipelineId} (${timeoutMs}ms)`,
      PipelineErrorCode.EXECUTION_TIMEOUT,
      {
        ...options,
        pipelineId,
        category: ErrorCategory.TIMEOUT,
        severity: ErrorSeverity.HIGH,
        retryable: true,
        recoveryStrategy: RecoveryStrategy.RETRY,
        metadata: {
          ...options.metadata,
          context: {
            timeoutMs,
            ...options.metadata?.context
          }
        }
      }
    );
  }
}
