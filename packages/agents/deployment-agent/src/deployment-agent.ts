import { BaseAgent } from '@agentic-sdlc/base-agent';
import {
  DeploymentAgentTask,
  DeploymentAgentResult,
  DeploymentAgentTaskSchema,
  DeploymentAgentResultSchema,
  BuildDockerImageTask,
  PushToECRTask,
  DeployToECSTask,
  RollbackDeploymentTask,
  HealthCheckTask
} from './types';
import { DockerService } from './services/docker.service';
import { ECRService } from './services/ecr.service';
import { ECSService } from './services/ecs.service';
import { DeploymentStrategyService } from './services/deployment-strategy.service';
import { HealthCheckService } from './services/health-check.service';

/**
 * Deployment Agent
 * Handles Docker image building, AWS ECR/ECS deployments, and health checks
 */
export class DeploymentAgent extends BaseAgent {
  private dockerService: DockerService;
  private ecrService: ECRService;
  private ecsService: ECSService;
  private deploymentStrategy: DeploymentStrategyService;
  private healthCheckService: HealthCheckService;

  constructor() {
    super({
      type: 'deployment',
      version: '1.0.0',
      capabilities: [
        'docker_build',
        'ecr_push',
        'ecs_deployment',
        'blue_green_deployment',
        'rollback',
        'health_check'
      ]
    });

    this.dockerService = new DockerService();
    this.ecrService = new ECRService(
      process.env.AWS_REGION || 'us-east-1'
    );
    this.ecsService = new ECSService(
      process.env.AWS_REGION || 'us-east-1'
    );
    this.deploymentStrategy = new DeploymentStrategyService(
      this.ecsService,
      this.healthCheckService
    );
    this.healthCheckService = new HealthCheckService();
  }

  /**
   * Execute deployment agent task
   */
  async executeTask(task: DeploymentAgentTask): Promise<DeploymentAgentResult> {
    const startTime = Date.now();
    const traceId = this.generateTraceId();

    // Validate task
    const validatedTask = DeploymentAgentTaskSchema.parse(task);

    this.logger.info('Executing deployment task', {
      action: validatedTask.action,
      trace_id: traceId
    });

    try {
      let result;

      switch (validatedTask.action) {
        case 'build_docker_image':
          result = await this.handleBuildDockerImage(validatedTask);
          break;

        case 'push_to_ecr':
          result = await this.handlePushToECR(validatedTask);
          break;

        case 'deploy_to_ecs':
          result = await this.handleDeployToECS(validatedTask);
          break;

        case 'rollback_deployment':
          result = await this.handleRollbackDeployment(validatedTask);
          break;

        case 'health_check':
          result = await this.handleHealthCheck(validatedTask);
          break;

        default:
          throw new Error(`Unknown action: ${(validatedTask as any).action}`);
      }

      const duration = Date.now() - startTime;

      this.logger.info('Deployment task completed', {
        action: validatedTask.action,
        duration_ms: duration,
        trace_id: traceId
      });

      return DeploymentAgentResultSchema.parse({
        action: validatedTask.action,
        result
      });

    } catch (error) {
      this.logger.error('Deployment task failed', {
        action: validatedTask.action,
        error: error instanceof Error ? error.message : 'Unknown error',
        trace_id: traceId
      });

      throw error;
    }
  }

  /**
   * Handle Docker image build
   */
  private async handleBuildDockerImage(task: BuildDockerImageTask) {
    this.logger.info('Building Docker image', {
      image_name: task.image_name,
      image_tag: task.image_tag,
      dockerfile: task.dockerfile_path
    });

    const buildStartTime = Date.now();

    try {
      const imageInfo = await this.dockerService.buildImage({
        dockerfilePath: task.dockerfile_path,
        contextPath: task.context_path,
        imageName: task.image_name,
        imageTag: task.image_tag,
        buildArgs: task.build_args,
        target: task.target,
        cacheFrom: task.cache_from,
        noCache: task.no_cache
      });

      const buildDuration = Date.now() - buildStartTime;

      this.logger.info('Docker image built successfully', {
        image_id: imageInfo.imageId,
        size_bytes: imageInfo.size,
        duration_ms: buildDuration
      });

      return {
        success: true,
        image_id: imageInfo.imageId,
        image_size_bytes: imageInfo.size,
        build_duration_ms: buildDuration,
        layers: imageInfo.layers,
        warnings: imageInfo.warnings
      };

    } catch (error) {
      this.logger.error('Docker build failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        build_duration_ms: Date.now() - buildStartTime,
        warnings: [error instanceof Error ? error.message : 'Build failed']
      };
    }
  }

  /**
   * Handle ECR push
   */
  private async handlePushToECR(task: PushToECRTask) {
    this.logger.info('Pushing image to ECR', {
      repository: task.repository_name,
      image: `${task.image_name}:${task.image_tag}`,
      region: task.aws_region
    });

    try {
      // Create repository if needed
      if (task.create_repository) {
        await this.ecrService.createRepositoryIfNotExists(
          task.repository_name,
          task.lifecycle_policy
        );
      }

      // Get ECR authorization
      const authToken = await this.ecrService.getAuthorizationToken();

      // Login to ECR
      await this.dockerService.loginToRegistry(
        authToken.endpoint,
        authToken.username,
        authToken.password
      );

      // Tag image for ECR
      const repositoryUri = await this.ecrService.getRepositoryUri(task.repository_name);
      const imageUri = `${repositoryUri}:${task.image_tag}`;

      await this.dockerService.tagImage(
        `${task.image_name}:${task.image_tag}`,
        imageUri
      );

      // Push image
      const pushResult = await this.dockerService.pushImage(imageUri);

      this.logger.info('Image pushed to ECR successfully', {
        repository_uri: repositoryUri,
        image_digest: pushResult.digest
      });

      return {
        success: true,
        repository_uri: repositoryUri,
        image_digest: pushResult.digest,
        image_uri: imageUri,
        pushed_at: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('ECR push failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false
      };
    }
  }

  /**
   * Handle ECS deployment
   */
  private async handleDeployToECS(task: DeployToECSTask) {
    this.logger.info('Deploying to ECS', {
      cluster: task.cluster_name,
      service: task.service_name,
      strategy: task.deployment_strategy
    });

    try {
      // Execute deployment based on strategy
      let result;

      switch (task.deployment_strategy) {
        case 'blue-green':
          result = await this.deploymentStrategy.executeBlueGreen(task);
          break;

        case 'rolling':
          result = await this.deploymentStrategy.executeRolling(task);
          break;

        case 'canary':
          result = await this.deploymentStrategy.executeCanary(task);
          break;

        case 'recreate':
          result = await this.deploymentStrategy.executeRecreate(task);
          break;

        default:
          throw new Error(`Unknown deployment strategy: ${task.deployment_strategy}`);
      }

      // Wait for stable if requested
      if (task.wait_for_stable) {
        await this.ecsService.waitForServiceStable(
          task.cluster_name,
          task.service_name,
          task.timeout_minutes || 30
        );
      }

      // Perform health check
      if (task.load_balancer) {
        const healthCheck = await this.healthCheckService.checkEndpoint(
          `http://${task.load_balancer.target_group_arn}`,
          {
            timeout: 30000,
            expectedStatus: 200
          }
        );

        if (!healthCheck.healthy) {
          // Rollback on health check failure
          this.logger.error('Health check failed, initiating rollback');

          await this.ecsService.rollbackDeployment(
            task.cluster_name,
            task.service_name
          );

          return {
            success: false,
            ...result,
            rollback_info: {
              rollback_triggered: true,
              reason: 'Health check failed'
            }
          };
        }
      }

      return {
        success: true,
        ...result
      };

    } catch (error) {
      this.logger.error('ECS deployment failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Attempt rollback
      try {
        await this.ecsService.rollbackDeployment(
          task.cluster_name,
          task.service_name
        );
      } catch (rollbackError) {
        this.logger.error('Rollback also failed', {
          error: rollbackError instanceof Error ? rollbackError.message : 'Unknown error'
        });
      }

      return {
        success: false,
        desired_count: task.desired_count,
        running_count: 0,
        rollback_info: {
          rollback_triggered: true,
          reason: error instanceof Error ? error.message : 'Deployment failed'
        }
      };
    }
  }

  /**
   * Handle deployment rollback
   */
  private async handleRollbackDeployment(task: RollbackDeploymentTask) {
    this.logger.info('Rolling back deployment', {
      cluster: task.cluster_name,
      service: task.service_name,
      reason: task.reason
    });

    const startTime = Date.now();

    try {
      const result = await this.ecsService.rollbackDeployment(
        task.cluster_name,
        task.service_name,
        task.target_deployment_id
      );

      const duration = Date.now() - startTime;

      this.logger.info('Rollback completed', {
        duration_ms: duration
      });

      return {
        success: true,
        previous_deployment_id: result.previousDeploymentId,
        rolled_back_to_deployment_id: result.rolledBackToDeploymentId,
        rollback_duration_ms: duration
      };

    } catch (error) {
      this.logger.error('Rollback failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        rollback_duration_ms: Date.now() - startTime
      };
    }
  }

  /**
   * Handle health check
   */
  private async handleHealthCheck(task: HealthCheckTask) {
    this.logger.info('Performing health check', {
      cluster: task.cluster_name,
      service: task.service_name,
      endpoint: task.endpoint
    });

    try {
      const result = await this.healthCheckService.checkEndpoint(
        task.endpoint,
        {
          timeout: task.timeout_seconds * 1000,
          expectedStatus: task.expected_status
        }
      );

      return {
        healthy: result.healthy,
        status_code: result.statusCode,
        response_time_ms: result.responseTime,
        error: result.error
      };

    } catch (error) {
      return {
        healthy: false,
        response_time_ms: 0,
        error: error instanceof Error ? error.message : 'Health check failed'
      };
    }
  }

  /**
   * Generate trace ID for request tracking
   */
  private generateTraceId(): string {
    return `dep-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up DeploymentAgent');
    await this.dockerService.cleanup();
    await super.cleanup();
  }
}
