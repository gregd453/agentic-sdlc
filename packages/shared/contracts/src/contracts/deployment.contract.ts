import { AgentContract } from '../contract-validator';
import {
  DeploymentTaskSchema,
  DeploymentResultSchemaExtended,
  DeploymentTask,
  DeploymentResultType
} from '@agentic-sdlc/shared-types';

/**
 * Deployment Agent Contract
 *
 * Defines the communication contract for the deployment agent
 * with version compatibility and migration support.
 */
export const deploymentContract: AgentContract<DeploymentTask, DeploymentResultType> = {
  name: 'deployment-agent',
  version: '1.0.0',

  /**
   * Supported versions for backward compatibility (N-2 policy)
   * Current: 1.0.0
   * Supported: 1.0.0 (no older versions yet)
   */
  supported_versions: ['1.0.0'],

  /**
   * Input schema - Deployment task format
   */
  input_schema: DeploymentTaskSchema as any,

  /**
   * Output schema - Deployment result format
   */
  output_schema: DeploymentResultSchemaExtended as any,

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
    //   'Renamed field `container_config` to `task_definition`',
    //   'Added required field `deployment_strategy`'
    // ]]
  ])
};

/**
 * Version history and changelog
 */
export const DEPLOYMENT_CONTRACT_CHANGELOG = {
  '1.0.0': {
    released: '2025-11-08',
    changes: [
      'Initial contract definition',
      'Defined DeploymentTask input schema',
      'Defined DeploymentResult output schema',
      'Supports build_docker_image, push_to_ecr, deploy_to_ecs, rollback_deployment, health_check actions',
      'Multi-strategy deployments (blue-green, rolling, canary, recreate)',
      'AWS ECS/Fargate integration',
      'Docker image building and ECR push',
      'Automated health checks and rollback support',
      'Circuit breaker configuration for deployment safety'
    ],
    breaking_changes: []
  }
};

/**
 * Example usage:
 *
 * import { ContractValidator } from '../contract-validator';
 * import { deploymentContract } from './deployment.contract';
 *
 * const validator = new ContractValidator();
 *
 * // Validate task input
 * const taskData = {
 *   task_id: 'task_123',
 *   workflow_id: 'workflow_456',
 *   agent_type: 'deployment',
 *   action: 'build_docker_image',
 *   status: 'pending',
 *   priority: 50,
 *   payload: {
 *     dockerfile_path: './Dockerfile',
 *     context_path: '.',
 *     image_name: 'my-app',
 *     image_tag: 'v1.0.0',
 *     no_cache: false
 *   },
 *   version: '1.0.0',
 *   timeout_ms: 600000,
 *   retry_count: 0,
 *   max_retries: 3,
 *   created_at: '2025-11-08T00:00:00.000Z'
 * };
 *
 * const result = validator.validateInput(deploymentContract, taskData);
 * if (!result.valid) {
 *   console.error('Validation failed:', result.errors);
 * }
 */
