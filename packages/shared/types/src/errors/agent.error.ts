/**
 * Agent-specific error classes
 */

import { BaseError, ErrorCategory, ErrorSeverity, ErrorMetadata, RecoveryStrategy } from './base.error';

/**
 * Agent error codes
 */
export enum AgentErrorCode {
  // Initialization errors
  AGENT_INIT_FAILED = 'AGENT_INIT_FAILED',
  AGENT_NOT_REGISTERED = 'AGENT_NOT_REGISTERED',

  // Task execution errors
  TASK_VALIDATION_FAILED = 'TASK_VALIDATION_FAILED',
  TASK_EXECUTION_FAILED = 'TASK_EXECUTION_FAILED',
  TASK_TIMEOUT = 'TASK_TIMEOUT',
  TASK_CANCELLED = 'TASK_CANCELLED',

  // Communication errors
  MESSAGE_PUBLISH_FAILED = 'MESSAGE_PUBLISH_FAILED',
  MESSAGE_PARSE_FAILED = 'MESSAGE_PARSE_FAILED',
  CHANNEL_SUBSCRIBE_FAILED = 'CHANNEL_SUBSCRIBE_FAILED',

  // Result errors
  RESULT_VALIDATION_FAILED = 'RESULT_VALIDATION_FAILED',
  RESULT_PUBLISH_FAILED = 'RESULT_PUBLISH_FAILED',

  // LLM errors
  LLM_API_ERROR = 'LLM_API_ERROR',
  LLM_RATE_LIMIT = 'LLM_RATE_LIMIT',
  LLM_QUOTA_EXCEEDED = 'LLM_QUOTA_EXCEEDED',
  LLM_INVALID_RESPONSE = 'LLM_INVALID_RESPONSE',

  // Resource errors
  INSUFFICIENT_RESOURCES = 'INSUFFICIENT_RESOURCES',
  WORKSPACE_ERROR = 'WORKSPACE_ERROR',

  // Contract errors
  CONTRACT_VALIDATION_FAILED = 'CONTRACT_VALIDATION_FAILED',
  UNSUPPORTED_VERSION = 'UNSUPPORTED_VERSION'
}

/**
 * Base agent error
 */
export class AgentError extends BaseError {
  public readonly agentId?: string;
  public readonly agentType?: string;
  public readonly taskId?: string;

  constructor(
    message: string,
    code: AgentErrorCode,
    options: {
      agentId?: string;
      agentType?: string;
      taskId?: string;
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
        agentType: options.agentType,
        context: {
          agentId: options.agentId,
          agentType: options.agentType,
          taskId: options.taskId,
          ...options.metadata?.context
        }
      },
      cause: options.cause
    });

    this.agentId = options.agentId;
    this.agentType = options.agentType;
    this.taskId = options.taskId;
  }
}

/**
 * Task validation error
 */
export class TaskValidationError extends AgentError {
  constructor(
    message: string,
    options: {
      agentType?: string;
      taskId?: string;
      validationErrors?: unknown[];
      metadata?: Partial<ErrorMetadata>;
      cause?: Error;
    } = {}
  ) {
    super(message, AgentErrorCode.TASK_VALIDATION_FAILED, {
      ...options,
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.MEDIUM,
      retryable: false,
      recoveryStrategy: RecoveryStrategy.ABORT,
      metadata: {
        ...options.metadata,
        context: {
          validationErrors: options.validationErrors,
          ...options.metadata?.context
        }
      }
    });
  }
}

/**
 * Task execution error
 */
export class TaskExecutionError extends AgentError {
  constructor(
    message: string,
    options: {
      agentId?: string;
      agentType?: string;
      taskId?: string;
      action?: string;
      retryable?: boolean;
      metadata?: Partial<ErrorMetadata>;
      cause?: Error;
    } = {}
  ) {
    super(message, AgentErrorCode.TASK_EXECUTION_FAILED, {
      ...options,
      category: ErrorCategory.INTERNAL,
      severity: ErrorSeverity.HIGH,
      retryable: options.retryable !== undefined ? options.retryable : true,
      recoveryStrategy: options.retryable ? RecoveryStrategy.RETRY : RecoveryStrategy.ABORT,
      metadata: {
        ...options.metadata,
        context: {
          action: options.action,
          ...options.metadata?.context
        }
      }
    });
  }
}

/**
 * LLM API error
 */
export class LLMError extends AgentError {
  constructor(
    message: string,
    code: AgentErrorCode,
    options: {
      agentId?: string;
      agentType?: string;
      model?: string;
      retryable?: boolean;
      metadata?: Partial<ErrorMetadata>;
      cause?: Error;
    } = {}
  ) {
    super(message, code, {
      ...options,
      category: ErrorCategory.EXTERNAL_SERVICE,
      severity: ErrorSeverity.HIGH,
      retryable: options.retryable !== undefined ? options.retryable : true,
      recoveryStrategy: options.retryable ? RecoveryStrategy.RETRY : RecoveryStrategy.FALLBACK,
      metadata: {
        ...options.metadata,
        context: {
          model: options.model,
          ...options.metadata?.context
        }
      }
    });
  }
}

/**
 * Agent communication error
 */
export class AgentCommunicationError extends AgentError {
  constructor(
    message: string,
    code: AgentErrorCode,
    options: {
      agentId?: string;
      agentType?: string;
      channel?: string;
      metadata?: Partial<ErrorMetadata>;
      cause?: Error;
    } = {}
  ) {
    super(message, code, {
      ...options,
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.HIGH,
      retryable: true,
      recoveryStrategy: RecoveryStrategy.RETRY,
      metadata: {
        ...options.metadata,
        context: {
          channel: options.channel,
          ...options.metadata?.context
        }
      }
    });
  }
}

/**
 * Contract validation error
 */
export class ContractValidationError extends AgentError {
  constructor(
    message: string,
    options: {
      agentType?: string;
      contractVersion?: string;
      validationErrors?: unknown[];
      metadata?: Partial<ErrorMetadata>;
      cause?: Error;
    } = {}
  ) {
    super(message, AgentErrorCode.CONTRACT_VALIDATION_FAILED, {
      ...options,
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.HIGH,
      retryable: false,
      recoveryStrategy: RecoveryStrategy.ABORT,
      metadata: {
        ...options.metadata,
        context: {
          contractVersion: options.contractVersion,
          validationErrors: options.validationErrors,
          ...options.metadata?.context
        }
      }
    });
  }
}
