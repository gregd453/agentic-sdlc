import { z } from 'zod';
import { AgentTaskSchema, AgentResultSchema } from '../core/schemas';

/**
 * Deployment Agent specific schemas
 * Handles Docker builds, ECR pushes, ECS deployments, rollbacks, and health checks
 */

// ===== Enums =====

/**
 * Deployment strategy types
 */
export const DeploymentStrategyEnum = z.enum([
  'blue-green',      // Zero-downtime blue-green deployment
  'rolling',         // Rolling update
  'canary',          // Canary deployment
  'recreate'         // Stop old, start new
]);

/**
 * Deployment action types
 */
export const DeploymentActionEnum = z.enum([
  'build_docker_image',
  'push_to_ecr',
  'deploy_to_ecs',
  'rollback_deployment',
  'health_check'
]);

/**
 * Network protocol types
 */
export const NetworkProtocolEnum = z.enum(['tcp', 'udp']);

/**
 * Network mode types
 */
export const NetworkModeEnum = z.enum(['awsvpc', 'bridge', 'host', 'none']);

/**
 * ECS compatibility types
 */
export const ECSCompatibilityEnum = z.enum(['EC2', 'FARGATE']);

/**
 * Deployment status types
 */
export const DeploymentStatusEnum = z.enum(['PRIMARY', 'ACTIVE', 'DRAINING', 'INACTIVE']);

// ===== Supporting Schemas =====

/**
 * Port mapping configuration
 */
export const PortMappingSchema = z.object({
  container_port: z.number(),
  host_port: z.number().optional(),
  protocol: NetworkProtocolEnum.default('tcp')
});

/**
 * Environment variable configuration
 */
export const EnvironmentVariableSchema = z.object({
  name: z.string(),
  value: z.string()
});

/**
 * Secret configuration
 */
export const SecretSchema = z.object({
  name: z.string(),
  value_from: z.string() // ARN to secret
});

/**
 * Container health check configuration
 */
export const ContainerHealthCheckSchema = z.object({
  command: z.array(z.string()),
  interval: z.number().default(30),
  timeout: z.number().default(5),
  retries: z.number().default(3)
});

/**
 * Container definition
 */
export const ContainerDefinitionSchema = z.object({
  name: z.string(),
  image: z.string(),
  cpu: z.number(),
  memory: z.number(),
  port_mappings: z.array(PortMappingSchema).optional(),
  environment: z.array(EnvironmentVariableSchema).optional(),
  secrets: z.array(SecretSchema).optional(),
  health_check: ContainerHealthCheckSchema.optional()
});

/**
 * ECS Task Definition
 */
export const TaskDefinitionSchema = z.object({
  family: z.string(),
  container_definitions: z.array(ContainerDefinitionSchema),
  cpu: z.string(), // e.g., "256", "512"
  memory: z.string(), // e.g., "512", "1024"
  network_mode: NetworkModeEnum.default('awsvpc'),
  requires_compatibilities: z.array(ECSCompatibilityEnum).default(['FARGATE']),
  execution_role_arn: z.string().optional(),
  task_role_arn: z.string().optional()
});

/**
 * Deployment circuit breaker configuration
 */
export const CircuitBreakerSchema = z.object({
  enable: z.boolean().default(true),
  rollback: z.boolean().default(true)
});

/**
 * Deployment configuration
 */
export const DeploymentConfigurationSchema = z.object({
  maximum_percent: z.number().default(200),
  minimum_healthy_percent: z.number().default(100),
  deployment_circuit_breaker: CircuitBreakerSchema.optional()
});

/**
 * Network configuration
 */
export const NetworkConfigurationSchema = z.object({
  subnets: z.array(z.string()),
  security_groups: z.array(z.string()),
  assign_public_ip: z.boolean().default(false)
});

/**
 * Load balancer configuration
 */
export const LoadBalancerSchema = z.object({
  target_group_arn: z.string(),
  container_name: z.string(),
  container_port: z.number()
});

/**
 * ECR lifecycle policy
 */
export const LifecyclePolicySchema = z.object({
  max_image_count: z.number().optional(),
  max_age_days: z.number().optional()
});

/**
 * Task information
 */
export const TaskInfoSchema = z.object({
  task_arn: z.string(),
  status: z.string(),
  health_status: z.string().optional()
});

/**
 * Rollback information
 */
export const RollbackInfoSchema = z.object({
  rollback_triggered: z.boolean(),
  reason: z.string().optional()
});

// ===== Task Payload Schemas =====

/**
 * Docker build task payload
 */
export const BuildDockerImagePayloadSchema = z.object({
  dockerfile_path: z.string().default('./Dockerfile'),
  context_path: z.string().default('.'),
  image_name: z.string(),
  image_tag: z.string(),
  build_args: z.record(z.string()).optional(),
  target: z.string().optional(), // Multi-stage build target
  cache_from: z.array(z.string()).optional(),
  no_cache: z.boolean().default(false)
});

/**
 * ECR push task payload
 */
export const PushToECRPayloadSchema = z.object({
  image_name: z.string(),
  image_tag: z.string(),
  repository_name: z.string(),
  aws_region: z.string().default('us-east-1'),
  create_repository: z.boolean().default(true),
  lifecycle_policy: LifecyclePolicySchema.optional()
});

/**
 * ECS deployment task payload
 */
export const DeployToECSPayloadSchema = z.object({
  cluster_name: z.string(),
  service_name: z.string(),
  task_definition: TaskDefinitionSchema,
  deployment_strategy: DeploymentStrategyEnum.default('blue-green'),
  desired_count: z.number().default(2),
  deployment_configuration: DeploymentConfigurationSchema.optional(),
  network_configuration: NetworkConfigurationSchema,
  load_balancer: LoadBalancerSchema.optional(),
  wait_for_stable: z.boolean().default(true),
  timeout_minutes: z.number().default(30)
});

/**
 * Rollback deployment task payload
 */
export const RollbackDeploymentPayloadSchema = z.object({
  cluster_name: z.string(),
  service_name: z.string(),
  target_deployment_id: z.string().optional(), // Specific deployment to roll back to
  reason: z.string()
});

/**
 * Health check task payload
 */
export const HealthCheckPayloadSchema = z.object({
  cluster_name: z.string(),
  service_name: z.string(),
  endpoint: z.string(), // Health check endpoint
  expected_status: z.number().default(200),
  timeout_seconds: z.number().default(30)
});

// ===== Deployment Task Schema =====

/**
 * Main Deployment Agent Task Schema
 * Extends the base AgentTaskSchema with deployment-specific fields
 */
export const DeploymentTaskSchema = AgentTaskSchema.extend({
  agent_type: z.literal(AGENT_TYPES.DEPLOYMENT),
  action: DeploymentActionEnum,
  payload: z.union([
    BuildDockerImagePayloadSchema,
    PushToECRPayloadSchema,
    DeployToECSPayloadSchema,
    RollbackDeploymentPayloadSchema,
    HealthCheckPayloadSchema
  ])
});

// ===== Result Schemas =====

/**
 * Docker build result
 */
export const BuildResultSchema = z.object({
  success: z.boolean(),
  image_id: z.string().optional(),
  image_size_bytes: z.number().optional(),
  build_duration_ms: z.number(),
  layers: z.number().optional(),
  warnings: z.array(z.string()).optional()
});

/**
 * ECR push result
 */
export const PushResultSchema = z.object({
  success: z.boolean(),
  repository_uri: z.string().optional(),
  image_digest: z.string().optional(),
  image_uri: z.string().optional(),
  pushed_at: z.string().datetime().optional()
});

/**
 * ECS deployment result
 */
export const DeploymentResultSchema = z.object({
  success: z.boolean(),
  deployment_id: z.string().optional(),
  task_definition_arn: z.string().optional(),
  service_arn: z.string().optional(),
  desired_count: z.number(),
  running_count: z.number(),
  deployment_status: DeploymentStatusEnum.optional(),
  tasks: z.array(TaskInfoSchema).optional(),
  rollback_info: RollbackInfoSchema.optional()
});

/**
 * Rollback result
 */
export const RollbackResultSchema = z.object({
  success: z.boolean(),
  previous_deployment_id: z.string().optional(),
  rolled_back_to_deployment_id: z.string().optional(),
  rollback_duration_ms: z.number()
});

/**
 * Health check result
 */
export const HealthCheckResultSchema = z.object({
  healthy: z.boolean(),
  status_code: z.number().optional(),
  response_time_ms: z.number(),
  error: z.string().optional()
});

// ===== Deployment Result Schema =====

/**
 * Main Deployment Agent Result Schema
 * Extends the base AgentResultSchema with deployment-specific results
 */
export const DeploymentResultSchemaExtended = AgentResultSchema.extend({
  agent_type: z.literal(AGENT_TYPES.DEPLOYMENT),
  action: DeploymentActionEnum,
  result: z.union([
    BuildResultSchema,
    PushResultSchema,
    DeploymentResultSchema,
    RollbackResultSchema,
    HealthCheckResultSchema
  ])
});

// ===== Type Exports =====
export type DeploymentStrategy = z.infer<typeof DeploymentStrategyEnum>;
export type DeploymentAction = z.infer<typeof DeploymentActionEnum>;
export type NetworkProtocol = z.infer<typeof NetworkProtocolEnum>;
export type NetworkMode = z.infer<typeof NetworkModeEnum>;
export type ECSCompatibility = z.infer<typeof ECSCompatibilityEnum>;
export type DeploymentStatus = z.infer<typeof DeploymentStatusEnum>;

export type PortMapping = z.infer<typeof PortMappingSchema>;
export type EnvironmentVariable = z.infer<typeof EnvironmentVariableSchema>;
export type Secret = z.infer<typeof SecretSchema>;
export type ContainerHealthCheck = z.infer<typeof ContainerHealthCheckSchema>;
export type ContainerDefinition = z.infer<typeof ContainerDefinitionSchema>;
export type TaskDefinition = z.infer<typeof TaskDefinitionSchema>;
export type CircuitBreaker = z.infer<typeof CircuitBreakerSchema>;
export type DeploymentConfiguration = z.infer<typeof DeploymentConfigurationSchema>;
export type NetworkConfiguration = z.infer<typeof NetworkConfigurationSchema>;
export type LoadBalancer = z.infer<typeof LoadBalancerSchema>;
export type LifecyclePolicy = z.infer<typeof LifecyclePolicySchema>;
export type TaskInfo = z.infer<typeof TaskInfoSchema>;
export type RollbackInfo = z.infer<typeof RollbackInfoSchema>;

export type BuildDockerImagePayload = z.infer<typeof BuildDockerImagePayloadSchema>;
export type PushToECRPayload = z.infer<typeof PushToECRPayloadSchema>;
export type DeployToECSPayload = z.infer<typeof DeployToECSPayloadSchema>;
export type RollbackDeploymentPayload = z.infer<typeof RollbackDeploymentPayloadSchema>;
export type HealthCheckPayload = z.infer<typeof HealthCheckPayloadSchema>;

export type DeploymentTask = z.infer<typeof DeploymentTaskSchema>;
export type BuildResult = z.infer<typeof BuildResultSchema>;
export type PushResult = z.infer<typeof PushResultSchema>;
export type DeploymentResult = z.infer<typeof DeploymentResultSchema>;
export type RollbackResult = z.infer<typeof RollbackResultSchema>;
export type HealthCheckResult = z.infer<typeof HealthCheckResultSchema>;
export type DeploymentResultType = z.infer<typeof DeploymentResultSchemaExtended>;

// ===== Type Guards =====
export function isDeploymentTask(task: unknown): task is DeploymentTask {
  return DeploymentTaskSchema.safeParse(task).success;
}

export function isDeploymentResult(result: unknown): result is DeploymentResultType {
  return DeploymentResultSchemaExtended.safeParse(result).success;
}

// ===== Factory Functions =====

/**
 * Create a build Docker image task
 */
export function createBuildDockerImageTask(
  workflowId: string,
  imageName: string,
  imageTag: string,
  options?: Partial<BuildDockerImagePayload>
): DeploymentTask {
  const now = new Date().toISOString();
  return {
    task_id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` as any,
    workflow_id: workflowId as any,
    agent_type: AGENT_TYPES.DEPLOYMENT,
    action: 'build_docker_image',
    status: TASK_STATUS.PENDING,
    priority: 50,
    payload: {
      dockerfile_path: './Dockerfile',
      context_path: '.',
      image_name: imageName,
      image_tag: imageTag,
      no_cache: false,
      ...options
    },
    version: '1.0.0',
    timeout_ms: 600000,
    retry_count: 0,
    max_retries: 3,
    created_at: now,
  };
}

/**
 * Create a push to ECR task
 */
export function createPushToECRTask(
  workflowId: string,
  imageName: string,
  imageTag: string,
  repositoryName: string,
  options?: Partial<PushToECRPayload>
): DeploymentTask {
  const now = new Date().toISOString();
  return {
    task_id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` as any,
    workflow_id: workflowId as any,
    agent_type: AGENT_TYPES.DEPLOYMENT,
    action: 'push_to_ecr',
    status: TASK_STATUS.PENDING,
    priority: 50,
    payload: {
      image_name: imageName,
      image_tag: imageTag,
      repository_name: repositoryName,
      aws_region: 'us-east-1',
      create_repository: true,
      ...options
    },
    version: '1.0.0',
    timeout_ms: 600000,
    retry_count: 0,
    max_retries: 3,
    created_at: now,
  };
}

/**
 * Create a health check task
 */
export function createHealthCheckTask(
  workflowId: string,
  clusterName: string,
  serviceName: string,
  endpoint: string,
  options?: Partial<HealthCheckPayload>
): DeploymentTask {
  const now = new Date().toISOString();
  return {
    task_id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` as any,
    workflow_id: workflowId as any,
    agent_type: AGENT_TYPES.DEPLOYMENT,
    action: 'health_check',
    status: TASK_STATUS.PENDING,
    priority: 50,
    payload: {
      cluster_name: clusterName,
      service_name: serviceName,
      endpoint,
      expected_status: 200,
      timeout_seconds: 30,
      ...options
    },
    version: '1.0.0',
    timeout_ms: 30000,
    retry_count: 0,
    max_retries: 3,
    created_at: now,
  };
}
