/**
 * Adapter: Maps base TaskAssignment envelope to ValidationTask
 *
 * SESSION #34 HOTFIX: The orchestrator currently sends base-agent TaskAssignment
 * format, but validation agent expects shared-types ValidationTask format.
 *
 * This adapter bridges the gap without changing orchestrator mid-session.
 */

import { TaskAssignment } from '@agentic-sdlc/base-agent';

export interface AdapterResult {
  success: boolean;
  task?: any; // SESSION #34: Use any to bypass TypeScript strictness in hotfix
  error?: string;
}

/**
 * Adapts TaskAssignment envelope to ValidationTask
 */
export function adaptToValidationTask(input: TaskAssignment): AdapterResult {
  try {
    // Extract context fields that should be in ValidationTask payload
    const ctx = input.context || {};

    // Extract required fields from context
    const file_paths = ctx['file_paths'] as string[] | undefined;
    const working_directory = ctx['working_directory'] as string | undefined;
    const validation_types = (ctx['validation_types'] as string[] | undefined) || [
      'typescript',
      'eslint',
      'security',
      'coverage'
    ];

    // Validate required fields
    if (!file_paths || file_paths.length === 0) {
      return {
        success: false,
        error: 'Missing required field: context.file_paths (must be non-empty array)'
      };
    }

    if (!working_directory) {
      return {
        success: false,
        error: 'Missing required field: context.working_directory'
      };
    }

    // Build ValidationTask (cast as any for hotfix - bypasses strict typing)
    const validationTask = {
      task_id: input.task_id,
      workflow_id: input.workflow_id,
      agent_type: 'validation',
      action: 'run_all_checks',
      payload: {
        file_paths,
        working_directory,
        validation_types,
        thresholds: ctx['thresholds']
      }
    } as any;

    return {
      success: true,
      task: validationTask
    };

  } catch (error) {
    return {
      success: false,
      error: `Adapter error: ${(error as Error).message}`
    };
  }
}

/**
 * Validates that the input type matches expected agent type
 */
export function validateAgentType(input: TaskAssignment, logger: any): boolean {
  if (input.type !== 'validation') {
    logger.warn({
      task_id: input.task_id,
      expected_type: 'validation',
      actual_type: input.type
    }, 'Non-validation task routed to validation agent');
    return false;
  }
  return true;
}
