import {
  BuildResult,
  PushResult,
  DeploymentResult,
  RollbackResult,
  HealthCheckResult
} from '../types';

/**
 * Mock factory for BuildResult
 */
export function createMockBuildResult(overrides?: Partial<BuildResult>): BuildResult {
  return {
    success: true,
    image_id: 'sha256:abc123',
    image_size_bytes: 1000000,
    build_duration_ms: 30000,
    layers: 5,
    warnings: [],
    ...overrides
  };
}

/**
 * Mock factory for PushResult
 */
export function createMockPushResult(overrides?: Partial<PushResult>): PushResult {
  return {
    success: true,
    repository_uri: '123456.dkr.ecr.us-east-1.amazonaws.com/my-repo',
    image_digest: 'sha256:def456',
    image_uri: '123456.dkr.ecr.us-east-1.amazonaws.com/my-repo:v1.0.0',
    pushed_at: new Date().toISOString(),
    ...overrides
  };
}

/**
 * Mock factory for DeploymentResult
 */
export function createMockDeploymentResult(overrides?: Partial<DeploymentResult>): DeploymentResult {
  return {
    success: true,
    deployment_id: 'ecs-svc/1234567890',
    task_definition_arn: 'arn:aws:ecs:us-east-1:123456:task-definition/my-app:1',
    service_arn: 'arn:aws:ecs:us-east-1:123456:service/my-cluster/my-service',
    desired_count: 2,
    running_count: 2,
    deployment_status: 'PRIMARY',
    tasks: [],
    rollback_info: undefined,
    ...overrides
  };
}

/**
 * Mock factory for RollbackResult
 */
export function createMockRollbackResult(overrides?: Partial<RollbackResult>): RollbackResult {
  return {
    success: true,
    previous_deployment_id: 'deploy-123',
    rolled_back_to_deployment_id: 'deploy-122',
    rollback_duration_ms: 60000,
    ...overrides
  };
}

/**
 * Mock factory for HealthCheckResult
 */
export function createMockHealthCheckResult(overrides?: Partial<HealthCheckResult>): HealthCheckResult {
  return {
    healthy: true,
    status_code: 200,
    response_time_ms: 150,
    error: undefined,
    ...overrides
  };
}
