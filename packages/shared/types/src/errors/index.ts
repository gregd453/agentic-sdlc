/**
 * Centralized error exports for Agentic SDLC
 *
 * Usage:
 * ```typescript
 * import { AgentError, AgentErrorCode, PipelineError } from '@agentic-sdlc/shared-types';
 *
 * throw new AgentError('Task execution failed', AgentErrorCode.TASK_EXECUTION_FAILED, {
 *   agentId: 'agent-123',
 *   agentType: AGENT_TYPES.SCAFFOLD,
 *   retryable: true
 * });
 * ```
 */

import { BaseError as Base } from './base.error';
import { AgentError as Agent } from './agent.error';
import { PipelineError as Pipeline } from './pipeline.error';

// Base error classes
export {
  BaseError,
  ValidationError,
  NotFoundError,
  TimeoutError,
  NetworkError,
  DatabaseError,
  RateLimitError,
  ErrorCategory,
  ErrorSeverity,
  RecoveryStrategy,
  ErrorMetadata
} from './base.error';

// Agent errors
export {
  AgentError,
  TaskValidationError,
  TaskExecutionError,
  LLMError,
  AgentCommunicationError,
  ContractValidationError,
  AgentErrorCode
} from './agent.error';

// Pipeline errors
export {
  PipelineError,
  StageExecutionError,
  QualityGateError,
  CircularDependencyError,
  StageDependencyError,
  PipelineTimeoutError,
  PipelineErrorCode
} from './pipeline.error';

/**
 * Type guard to check if error is a BaseError
 */
export function isBaseError(error: unknown): error is Base {
  return error instanceof Base;
}

/**
 * Type guard to check if error is an AgentError
 */
export function isAgentError(error: unknown): error is Agent {
  return error instanceof Agent;
}

/**
 * Type guard to check if error is a PipelineError
 */
export function isPipelineError(error: unknown): error is Pipeline {
  return error instanceof Pipeline;
}

/**
 * Helper to safely extract error message
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}

/**
 * Helper to safely extract error stack trace
 */
export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }
  return undefined;
}

/**
 * Convert any error to BaseError
 */
export function toBaseError(error: unknown, code = 'UNKNOWN_ERROR'): Base {
  if (error instanceof Base) {
    return error;
  }

  let message: string;
  let cause: Error | undefined;

  if (error instanceof Error) {
    message = error.message;
    cause = error;
  } else {
    message = String(error);
  }

  return new Base(message, { code, cause });
}
