import { AgentContract } from '../contract-validator';
import {
  ScaffoldTaskSchema,
  ScaffoldResultSchema,
  ScaffoldTask,
  ScaffoldResult
} from '@agentic-sdlc/shared-types';

/**
 * Scaffold Agent Contract
 *
 * Defines the communication contract for the scaffold agent
 * with version compatibility and migration support.
 */
export const scaffoldContract: AgentContract<ScaffoldTask, ScaffoldResult> = {
  name: 'scaffold-agent',
  version: '1.0.0',

  /**
   * Supported versions for backward compatibility (N-2 policy)
   * Current: 1.0.0
   * Supported: 1.0.0 (no older versions yet)
   */
  supported_versions: ['1.0.0'],

  /**
   * Input schema - Scaffold task format
   */
  input_schema: ScaffoldTaskSchema as any,

  /**
   * Output schema - Scaffold result format
   */
  output_schema: ScaffoldResultSchema as any,

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
    //   'Renamed field `template_type` to `scaffold_type`',
    //   'Added required field `target_framework`'
    // ]]
  ])
};

/**
 * Version history and changelog
 */
export const SCAFFOLD_CONTRACT_CHANGELOG = {
  '1.0.0': {
    released: '2025-11-08',
    changes: [
      'Initial contract definition',
      'Defined ScaffoldTask input schema',
      'Defined ScaffoldResult output schema',
      'Supports app, service, feature, capability scaffolding'
    ],
    breaking_changes: []
  }
};

/**
 * Example usage:
 *
 * import { ContractValidator } from '../contract-validator';
 * import { scaffoldContract } from './scaffold.contract';
 *
 * const validator = new ContractValidator();
 *
 * // Validate task input
 * const taskData = {
 *   task_id: '...',
 *   workflow_id: '...',
 *   type: 'app',
 *   name: 'my-app',
 *   description: 'My application',
 *   requirements: 'Build a web app'
 * };
 *
 * const result = validator.validateInput(scaffoldContract, taskData);
 * if (!result.valid) {
 *   console.error('Validation errors:', result.errors);
 * }
 */
