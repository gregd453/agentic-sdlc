/**
 * Deployment Agent Types
 * Re-exported from @agentic-sdlc/shared-types for backward compatibility
 *
 * @deprecated Import directly from '@agentic-sdlc/shared-types' instead
 */

export {
  // Enums
  DeploymentStrategyEnum,
  DeploymentActionEnum,
  NetworkProtocolEnum,
  NetworkModeEnum,
  ECSCompatibilityEnum,
  DeploymentStatusEnum,

  // Supporting Schemas
  PortMappingSchema,
  EnvironmentVariableSchema,
  SecretSchema,
  ContainerHealthCheckSchema,
  ContainerDefinitionSchema,
  TaskDefinitionSchema,
  CircuitBreakerSchema,
  DeploymentConfigurationSchema,
  NetworkConfigurationSchema,
  LoadBalancerSchema,
  LifecyclePolicySchema,
  TaskInfoSchema,
  RollbackInfoSchema,

  // Payload Schemas
  BuildDockerImagePayloadSchema,
  PushToECRPayloadSchema,
  DeployToECSPayloadSchema,
  RollbackDeploymentPayloadSchema,
  HealthCheckPayloadSchema,

  // Task and Result Schemas
  DeploymentTaskSchema,
  BuildResultSchema,
  PushResultSchema,
  DeploymentResultSchema as ECSDeploymentResultSchema,
  RollbackResultSchema,
  HealthCheckResultSchema,
  DeploymentResultSchemaExtended,

  // Types
  type DeploymentStrategy,
  type DeploymentAction,
  type NetworkProtocol,
  type NetworkMode,
  type ECSCompatibility,
  type DeploymentStatus,
  type PortMapping,
  type EnvironmentVariable,
  type Secret,
  type ContainerHealthCheck,
  type ContainerDefinition,
  type TaskDefinition,
  type CircuitBreaker,
  type DeploymentConfiguration,
  type NetworkConfiguration,
  type LoadBalancer,
  type LifecyclePolicy,
  type TaskInfo,
  type RollbackInfo,
  type BuildDockerImagePayload,
  type PushToECRPayload,
  type DeployToECSPayload,
  type RollbackDeploymentPayload,
  type HealthCheckPayload,
  type DeploymentTask,
  type BuildResult,
  type PushResult,
  type DeploymentResult,
  type RollbackResult,
  type HealthCheckResult,
  type DeploymentResultType,

  // Type Guards
  isDeploymentTask,
  isDeploymentResult,

  // Factory Functions
  createBuildDockerImageTask,
  createPushToECRTask,
  createHealthCheckTask,
} from '@agentic-sdlc/shared-types';

import {
  DeploymentTaskSchema,
  DeploymentResultSchemaExtended,
  BuildDockerImagePayload,
  PushToECRPayload,
  DeployToECSPayload,
  RollbackDeploymentPayload,
  HealthCheckPayload
} from '@agentic-sdlc/shared-types';

// Legacy type aliases for backward compatibility
export type DeploymentAgentTask = import('@agentic-sdlc/shared-types').DeploymentTask;
export type DeploymentAgentResult = import('@agentic-sdlc/shared-types').DeploymentResultType;
export const DeploymentAgentTaskSchema = DeploymentTaskSchema;
export const DeploymentAgentResultSchema = DeploymentResultSchemaExtended;

// Legacy task type aliases
export type BuildDockerImageTask = BuildDockerImagePayload;
export type PushToECRTask = PushToECRPayload;
export type DeployToECSTask = DeployToECSPayload;
export type RollbackDeploymentTask = RollbackDeploymentPayload;
export type HealthCheckTask = HealthCheckPayload;
