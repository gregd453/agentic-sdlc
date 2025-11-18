/**
 * Adapter: Maps base AgentEnvelope to ValidationTask
 *
 * SESSION #65: Updated to use AgentEnvelope v2.0.0
 */

import { AgentEnvelope } from '@agentic-sdlc/base-agent';

export interface AdapterResult {
  success: boolean;
  task?: any; // SESSION #34: Use any to bypass TypeScript strictness in hotfix
  error?: string;
}

/**
 * Adapts AgentEnvelope to ValidationTask
 * SESSION #65: Updated for AgentEnvelope v2.0.0
 */
export function adaptToValidationTask(input: AgentEnvelope): AdapterResult {
  try {
    // SESSION #65: Extract from payload
    const payload = input.payload as any;

    // Extract required fields from payload
    const file_paths = payload.file_paths as string[] | undefined;
    const working_directory = payload.working_directory as string | undefined;
    const validation_types = (payload.validation_types as string[] | undefined) || [
      'typescript',
      'eslint',
      'security',
      'coverage'
    ];

    // Validate required fields
    if (!file_paths || file_paths.length === 0) {
      return {
        success: false,
        error: 'Missing required field: payload.file_paths (must be non-empty array)'
      };
    }

    if (!working_directory) {
      return {
        success: false,
        error: 'Missing required field: payload.working_directory'
      };
    }

    // Build ValidationTask
    const validationTask = {
      task_id: input.task_id,
      workflow_id: input.workflow_id,
      agent_type: 'validation',
      action: 'run_all_checks',
      payload: {
        file_paths,
        working_directory,
        validation_types,
        thresholds: payload.thresholds
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
 * SESSION #65: Updated for AgentEnvelope v2.0.0
 */
export function validateAgentType(input: AgentEnvelope, logger: any): boolean {
  if (input.agent_type !== 'validation') {
    logger.warn({
      task_id: input.task_id,
      expected_type: 'validation',
      actual_type: input.agent_type
    }, 'Non-validation task routed to validation agent');
    return false;
  }
  return true;
}
