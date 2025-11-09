import { AgentContract } from '../contract-validator';
import {
  E2ETaskSchema,
  E2EResultSchema,
  E2ETask,
  E2EResult
} from '@agentic-sdlc/shared-types';

/**
 * E2E Test Agent Contract
 *
 * Defines the communication contract for the E2E test agent
 * with version compatibility and migration support.
 */
export const e2eContract: AgentContract<E2ETask, E2EResult> = {
  name: 'e2e-agent',
  version: '1.0.0',

  /**
   * Supported versions for backward compatibility (N-2 policy)
   * Current: 1.0.0
   * Supported: 1.0.0 (no older versions yet)
   */
  supported_versions: ['1.0.0'],

  /**
   * Input schema - E2E test task format
   */
  input_schema: E2ETaskSchema as any,

  /**
   * Output schema - E2E test result format
   */
  output_schema: E2EResultSchema as any,

  /**
   * Migration functions for version upgrades
   * Key format: "fromVersion->toVersion"
   */
  migrations: new Map([
    // Example: Migration from 0.9.0 to 1.0.0 (when needed)
    // ['0.9.0->1.0.0', (data) => {
    //   return {
    //     ...data,
    //     // Add browsers field if missing
    //     browsers: data.browsers || ['chromium'],
    //     // Transform old test_config to new format
    //     test_config: {
    //       ...data.config,
    //       timeout: data.config?.timeout || 30000
    //     }
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
    //   'Renamed field `test_scenarios` to `test_suites`',
    //   'Added required field `browsers` for multi-browser testing',
    //   'Changed artifact format to include screenshots and videos'
    // ]]
  ])
};

/**
 * Version history and changelog
 */
export const E2E_CONTRACT_CHANGELOG = {
  '1.0.0': {
    released: '2025-11-08',
    changes: [
      'Initial contract definition',
      'Defined E2ETask input schema',
      'Defined E2EResult output schema',
      'Supports Playwright multi-browser testing',
      'Automatic Page Object Model generation',
      'Screenshot and video capture on failures',
      'Artifact storage (local and S3)'
    ],
    breaking_changes: []
  }
};

/**
 * Example usage:
 *
 * import { ContractValidator } from '../contract-validator';
 * import { e2eContract } from './e2e.contract';
 *
 * const validator = new ContractValidator();
 *
 * // Validate task input
 * const taskData = {
 *   task_id: '...',
 *   workflow_id: '...',
 *   app_url: 'http://localhost:3000',
 *   test_scenarios: 'Login flow, checkout flow',
 *   browsers: ['chromium', 'firefox'],
 *   capture_screenshots: true
 * };
 *
 * const result = validator.validateInput(e2eContract, taskData);
 * if (!result.valid) {
 *   console.error('Validation errors:', result.errors);
 * }
 */
