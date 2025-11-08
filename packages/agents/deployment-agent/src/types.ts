import { z } from 'zod';

// ============================================================================
// DEPLOYMENT AGENT TASK SCHEMAS
// ============================================================================

/**
 * Deployment strategy
 */
export const DeploymentStrategySchema = z.enum([
  'blue-green',      // Zero-downtime blue-green deployment
  'rolling',         // Rolling update
  'canary',          // Canary deployment
  'recreate'         // Stop old, start new
]);

/**
 * Docker build task
 */
export const BuildDockerImageTaskSchema = z.object({
  action: z.literal('build_docker_image'),
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
 * ECR push task
 */
export const PushToECRTaskSchema = z.object({
  action: z.literal('push_to_ecr'),
  image_name: z.string(),
  image_tag: z.string(),
  repository_name: z.string(),
  aws_region: z.string().default('us-east-1'),
  create_repository: z.boolean().default(true),
  lifecycle_policy: z.object({
    max_image_count: z.number().optional(),
    max_age_days: z.number().optional()
  }).optional()
});

/**
 * ECS service deployment task
 */
export const DeployToECSTaskSchema = z.object({
  action: z.literal('deploy_to_ecs'),
  cluster_name: z.string(),
  service_name: z.string(),
  task_definition: z.object({
    family: z.string(),
    container_definitions: z.array(z.object({
      name: z.string(),
      image: z.string(),
      cpu: z.number(),
      memory: z.number(),
      port_mappings: z.array(z.object({
        container_port: z.number(),
        host_port: z.number().optional(),
        protocol: z.enum(['tcp', 'udp']).default('tcp')
      })).optional(),
      environment: z.array(z.object({
        name: z.string(),
        value: z.string()
      })).optional(),
      secrets: z.array(z.object({
        name: z.string(),
        value_from: z.string() // ARN to secret
      })).optional(),
      health_check: z.object({
        command: z.array(z.string()),
        interval: z.number().default(30),
        timeout: z.number().default(5),
        retries: z.number().default(3)
      }).optional()
    })),
    cpu: z.string(), // e.g., "256", "512"
    memory: z.string(), // e.g., "512", "1024"
    network_mode: z.enum(['awsvpc', 'bridge', 'host', 'none']).default('awsvpc'),
    requires_compatibilities: z.array(z.enum(['EC2', 'FARGATE'])).default(['FARGATE']),
    execution_role_arn: z.string().optional(),
    task_role_arn: z.string().optional()
  }),
  deployment_strategy: DeploymentStrategySchema.default('blue-green'),
  desired_count: z.number().default(2),
  deployment_configuration: z.object({
    maximum_percent: z.number().default(200),
    minimum_healthy_percent: z.number().default(100),
    deployment_circuit_breaker: z.object({
      enable: z.boolean().default(true),
      rollback: z.boolean().default(true)
    }).optional()
  }).optional(),
  network_configuration: z.object({
    subnets: z.array(z.string()),
    security_groups: z.array(z.string()),
    assign_public_ip: z.boolean().default(false)
  }),
  load_balancer: z.object({
    target_group_arn: z.string(),
    container_name: z.string(),
    container_port: z.number()
  }).optional(),
  wait_for_stable: z.boolean().default(true),
  timeout_minutes: z.number().default(30)
});

/**
 * Deployment rollback task
 */
export const RollbackDeploymentTaskSchema = z.object({
  action: z.literal('rollback_deployment'),
  cluster_name: z.string(),
  service_name: z.string(),
  target_deployment_id: z.string().optional(), // Specific deployment to roll back to
  reason: z.string()
});

/**
 * Health check task
 */
export const HealthCheckTaskSchema = z.object({
  action: z.literal('health_check'),
  cluster_name: z.string(),
  service_name: z.string(),
  endpoint: z.string(), // Health check endpoint
  expected_status: z.number().default(200),
  timeout_seconds: z.number().default(30)
});

/**
 * Combined deployment agent task
 */
export const DeploymentAgentTaskSchema = z.discriminatedUnion('action', [
  BuildDockerImageTaskSchema,
  PushToECRTaskSchema,
  DeployToECSTaskSchema,
  RollbackDeploymentTaskSchema,
  HealthCheckTaskSchema
]);

// ============================================================================
// RESULT SCHEMAS
// ============================================================================

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
  deployment_status: z.enum(['PRIMARY', 'ACTIVE', 'DRAINING', 'INACTIVE']).optional(),
  tasks: z.array(z.object({
    task_arn: z.string(),
    status: z.string(),
    health_status: z.string().optional()
  })).optional(),
  rollback_info: z.object({
    rollback_triggered: z.boolean(),
    reason: z.string().optional()
  }).optional()
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

/**
 * Combined deployment agent result
 */
export const DeploymentAgentResultSchema = z.object({
  action: z.string(),
  result: z.union([
    BuildResultSchema,
    PushResultSchema,
    DeploymentResultSchema,
    RollbackResultSchema,
    HealthCheckResultSchema
  ])
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type DeploymentStrategy = z.infer<typeof DeploymentStrategySchema>;
export type BuildDockerImageTask = z.infer<typeof BuildDockerImageTaskSchema>;
export type PushToECRTask = z.infer<typeof PushToECRTaskSchema>;
export type DeployToECSTask = z.infer<typeof DeployToECSTaskSchema>;
export type RollbackDeploymentTask = z.infer<typeof RollbackDeploymentTaskSchema>;
export type HealthCheckTask = z.infer<typeof HealthCheckTaskSchema>;
export type DeploymentAgentTask = z.infer<typeof DeploymentAgentTaskSchema>;
export type BuildResult = z.infer<typeof BuildResultSchema>;
export type PushResult = z.infer<typeof PushResultSchema>;
export type DeploymentResult = z.infer<typeof DeploymentResultSchema>;
export type RollbackResult = z.infer<typeof RollbackResultSchema>;
export type HealthCheckResult = z.infer<typeof HealthCheckResultSchema>;
export type DeploymentAgentResult = z.infer<typeof DeploymentAgentResultSchema>;
