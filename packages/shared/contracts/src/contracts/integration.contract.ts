import { AgentContract } from '../contract-validator';
import {
  IntegrationTaskSchema,
  IntegrationResultSchema,
  IntegrationTask,
  IntegrationResult
} from '@agentic-sdlc/shared-types';

/**
 * Integration Agent Contract
 *
 * Defines the communication contract for the integration agent
 * with version compatibility and migration support.
 */
export const integrationContract: AgentContract<IntegrationTask, IntegrationResult> = {
  name: 'integration-agent',
  version: '1.0.0',

  /**
   * Supported versions for backward compatibility (N-2 policy)
   * Current: 1.0.0
   * Supported: 1.0.0 (no older versions yet)
   */
  supported_versions: ['1.0.0'],

  /**
   * Input schema - Integration task format
   */
  input_schema: IntegrationTaskSchema as any,

  /**
   * Output schema - Integration result format
   */
  output_schema: IntegrationResultSchema as any,

  /**
   * Migration functions for version upgrades
   * Key format: "fromVersion->toVersion"
   */
  migrations: new Map([
    // Example: Migration from 0.9.0 to 1.0.0 (when needed)
    // ['0.9.0->1.0.0', (data) => {
    //   return {
    //     ...data,
    //     // Add new required fields
    //     // Transform changed fields
    //   };
    // }]
  ]),

  /**
   * Breaking changes documentation
   * Key: version where breaking changes were introduced
   * Value: list of breaking changes
   */
  breaking_changes: new Map([
    // Example: Breaking changes in 1.0.0
    // ['1.0.0', [
    //   'Renamed field `merge_type` to `merge_strategy`',
    //   'Added required field `conflict_strategy`'
    // ]]
  ])
};

/**
 * Version history and changelog
 */
export const INTEGRATION_CONTRACT_CHANGELOG = {
  '1.0.0': {
    released: '2025-11-08',
    changes: [
      'Initial contract definition',
      'Defined IntegrationTask input schema',
      'Defined IntegrationResult output schema',
      'Supports merge_branch, resolve_conflict, update_dependencies, run_integration_tests actions',
      'AI-powered conflict resolution support',
      'Multiple merge strategies (merge, squash, rebase, fast-forward)',
      'Automatic dependency updates with test validation'
    ],
    breaking_changes: []
  }
};

/**
 * Example usage:
 *
 * import { ContractValidator } from '../contract-validator';
 * import { integrationContract } from './integration.contract';
 *
 * const validator = new ContractValidator();
 *
 * // Validate task input
 * const taskData = {
 *   task_id: 'task_123',
 *   workflow_id: 'workflow_456',
 *   agent_type: AGENT_TYPES.INTEGRATION,
 *   action: 'merge_branch',
 *   status: TASK_STATUS.PENDING,
 *   priority: 50,
 *   payload: {
 *     source_branch: 'feature/new-feature',
 *     target_branch: 'main',
 *     strategy: 'merge',
 *     auto_resolve_conflicts: true,
 *     conflict_strategy: 'ai'
 *   },
 *   version: '1.0.0',
 *   timeout_ms: 300000,
 *   retry_count: 0,
 *   max_retries: 3,
 *   created_at: '2025-11-08T00:00:00.000Z'
 * };
 *
 * const result = validator.validateInput(integrationContract, taskData);
 * if (!result.valid) {
 *   console.error('Validation failed:', result.errors);
 * }
 */
