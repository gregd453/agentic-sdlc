import { AgentContract } from '../contract-validator';
import {
  ValidationTaskSchema,
  ValidationResultSchema,
  ValidationTask,
  ValidationResult
} from '@agentic-sdlc/shared-types';

/**
 * Validation Agent Contract
 *
 * Defines the communication contract for the validation agent
 * with version compatibility and migration support.
 */
export const validationContract: AgentContract<ValidationTask, ValidationResult> = {
  name: 'validation-agent',
  version: '1.0.0',

  /**
   * Supported versions for backward compatibility (N-2 policy)
   * Current: 1.0.0
   * Supported: 1.0.0 (no older versions yet)
   */
  supported_versions: ['1.0.0'],

  /**
   * Input schema - Validation task format
   */
  input_schema: ValidationTaskSchema as any,

  /**
   * Output schema - Validation result format
   */
  output_schema: ValidationResultSchema as any,

  /**
   * Migration functions for version upgrades
   * Key format: "fromVersion->toVersion"
   */
  migrations: new Map([
    // Example: Migration from 0.9.0 to 1.0.0 (when needed)
    // ['0.9.0->1.0.0', (data) => {
    //   return {
    //     ...data,
    //     // Add validation_types field if missing
    //     validation_types: data.validation_types || ['typescript', 'lint', 'test']
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
    //   'Changed validation result format to include detailed metrics',
    //   'Added required field `coverage_threshold`'
    // ]]
  ])
};

/**
 * Version history and changelog
 */
export const VALIDATION_CONTRACT_CHANGELOG = {
  '1.0.0': {
    released: '2025-11-08',
    changes: [
      'Initial contract definition',
      'Defined ValidationTask input schema',
      'Defined ValidationResult output schema',
      'Supports TypeScript compilation, ESLint, test coverage, security scanning'
    ],
    breaking_changes: []
  }
};

/**
 * Example usage:
 *
 * import { ContractValidator } from '../contract-validator';
 * import { validationContract } from './validation.contract';
 *
 * const validator = new ContractValidator();
 *
 * // Validate task input
 * const taskData = {
 *   task_id: '...',
 *   workflow_id: '...',
 *   target_path: '/path/to/code',
 *   validation_types: ['typescript', 'lint', 'test'],
 *   quality_gates: { coverage_threshold: 80 }
 * };
 *
 * const result = validator.validateInput(validationContract, taskData);
 * if (!result.valid) {
 *   console.error('Validation errors:', result.errors);
 * }
 */
