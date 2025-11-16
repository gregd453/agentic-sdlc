import { BaseAgent } from '@agentic-sdlc/base-agent';
import { LoggerConfigService } from '@agentic-sdlc/logger-config';
import { ConfigurationManager } from '@agentic-sdlc/config-manager';
import { ServiceLocator } from '@agentic-sdlc/service-locator';
import {
  DeploymentTask,
  DeploymentResultType,
  DeploymentTaskSchema,
  DeploymentResultSchemaExtended,
  BuildDockerImagePayload,
  PushToECRPayload,
  DeployToECSPayload,
  RollbackDeploymentPayload,
  HealthCheckPayload
} from '@agentic-sdlc/shared-types';
import { DockerService } from './services/docker.service';
import { ECRService } from './services/ecr.service';
import { ECSService } from './services/ecs.service';
import { DeploymentStrategyService } from './services/deployment-strategy.service';
import { HealthCheckService } from './services/health-check.service';

/**
 * Deployment Agent
 * Handles Docker image building, AWS ECR/ECS deployments, and health checks
 * Phase 2.2: Updated to accept DI services
 */
export class DeploymentAgent extends BaseAgent {
  private dockerService: DockerService;
  private ecrService: ECRService;
  private ecsService: ECSService;
  private deploymentStrategy: DeploymentStrategyService;
  private healthCheckService: HealthCheckService;

  constructor(
    messageBus: any,
    loggerConfigService?: LoggerConfigService,
    configurationManager?: ConfigurationManager,
    serviceLocator?: ServiceLocator,
    platformId?: string // Phase 4: Platform context for multi-platform SDLC system
  ) {
    super(
      {
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
      },
      messageBus,
      loggerConfigService,
      configurationManager,
      serviceLocator,
      platformId
    );

    this.dockerService = new DockerService();
    this.ecrService = new ECRService(
      process.env.AWS_REGION || 'us-east-1'
    );
    this.ecsService = new ECSService(
      process.env.AWS_REGION || 'us-east-1'
    );
    this.healthCheckService = new HealthCheckService();
    this.deploymentStrategy = new DeploymentStrategyService(
      this.ecsService,
      this.healthCheckService
    );
  }

  /**
   * Execute deployment agent task
   */
  async executeTask(task: DeploymentTask): Promise<DeploymentResultType> {
    const startTime = Date.now();
    const traceId = this.generateTraceId();

    // Validate task
    const validatedTask = DeploymentTaskSchema.parse(task);

    this.logger.info('Executing deployment task', {
      task_id: validatedTask.task_id,
      workflow_id: validatedTask.workflow_id,
      action: validatedTask.action,
      trace_id: traceId
    });

    try {
      let result;

      switch (validatedTask.action) {
        case 'build_docker_image':
          result = await this.handleBuildDockerImage(validatedTask.payload as BuildDockerImagePayload);
          break;

        case 'push_to_ecr':
          result = await this.handlePushToECR(validatedTask.payload as PushToECRPayload);
          break;

        case 'deploy_to_ecs':
          result = await this.handleDeployToECS(validatedTask.payload as DeployToECSPayload);
          break;

        case 'rollback_deployment':
          result = await this.handleRollbackDeployment(validatedTask.payload as RollbackDeploymentPayload);
          break;

        case 'health_check':
          result = await this.handleHealthCheck(validatedTask.payload as HealthCheckPayload);
          break;

        default:
          throw new Error(`Unknown action: ${(validatedTask as any).action}`);
      }

      const duration = Date.now() - startTime;

      this.logger.info('Deployment task completed', {
        task_id: validatedTask.task_id,
        workflow_id: validatedTask.workflow_id,
        action: validatedTask.action,
        duration_ms: duration,
        trace_id: traceId
      });

      return DeploymentResultSchemaExtended.parse({
        task_id: validatedTask.task_id,
        workflow_id: validatedTask.workflow_id,
        agent_type: 'deployment',
        action: validatedTask.action,
        status: 'success',
        result,
        timestamp: new Date().toISOString(),
        duration_ms: duration
      });

    } catch (error) {
      this.logger.error('Deployment task failed', {
        task_id: validatedTask.task_id,
        workflow_id: validatedTask.workflow_id,
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
  private async handleBuildDockerImage(payload: BuildDockerImagePayload) {
    this.logger.info('Building Docker image', {
      image_name: payload.image_name,
      image_tag: payload.image_tag,
      dockerfile: payload.dockerfile_path
    });

    const buildStartTime = Date.now();

    try {
      const imageInfo = await this.dockerService.buildImage({
        dockerfilePath: payload.dockerfile_path,
        contextPath: payload.context_path,
        imageName: payload.image_name,
        imageTag: payload.image_tag,
        buildArgs: payload.build_args,
        target: payload.target,
        cacheFrom: payload.cache_from,
        noCache: payload.no_cache
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
  private async handlePushToECR(payload: PushToECRPayload) {
    this.logger.info('Pushing image to ECR', {
      repository: payload.repository_name,
      image: `${payload.image_name}:${payload.image_tag}`,
      region: payload.aws_region
    });

    try {
      // Create repository if needed
      if (payload.create_repository) {
        await this.ecrService.createRepositoryIfNotExists(
          payload.repository_name
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
      const repositoryUri = await this.ecrService.getRepositoryUri(payload.repository_name);
      const imageUri = `${repositoryUri}:${payload.image_tag}`;

      await this.dockerService.tagImage(
        `${payload.image_name}:${payload.image_tag}`,
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
  private async handleDeployToECS(payload: DeployToECSPayload) {
    this.logger.info('Deploying to ECS', {
      cluster: payload.cluster_name,
      service: payload.service_name,
      strategy: payload.deployment_strategy
    });

    try {
      // Execute deployment based on strategy
      let result;

      switch (payload.deployment_strategy) {
        case 'blue-green':
          result = await this.deploymentStrategy.executeBlueGreen(payload);
          break;

        case 'rolling':
          result = await this.deploymentStrategy.executeRolling(payload);
          break;

        case 'canary':
          result = await this.deploymentStrategy.executeCanary(payload);
          break;

        case 'recreate':
          result = await this.deploymentStrategy.executeRecreate(payload);
          break;

        default:
          throw new Error(`Unknown deployment strategy: ${payload.deployment_strategy}`);
      }

      // Wait for stable if requested
      if (payload.wait_for_stable) {
        await this.ecsService.waitForServiceStable(
          payload.cluster_name,
          payload.service_name,
          payload.timeout_minutes || 30
        );
      }

      // Perform health check
      if (payload.load_balancer) {
        const healthCheck = await this.healthCheckService.checkEndpoint(
          `http://${payload.load_balancer.target_group_arn}`,
          {
            timeout: 30000,
            expectedStatus: 200
          }
        );

        if (!healthCheck.healthy) {
          // Rollback on health check failure
          this.logger.error('Health check failed, initiating rollback');

          await this.ecsService.rollbackDeployment(
            payload.cluster_name,
            payload.service_name
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
          payload.cluster_name,
          payload.service_name
        );
      } catch (rollbackError) {
        this.logger.error('Rollback also failed', {
          error: rollbackError instanceof Error ? rollbackError.message : 'Unknown error'
        });
      }

      return {
        success: false,
        desired_count: payload.desired_count,
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
  private async handleRollbackDeployment(payload: RollbackDeploymentPayload) {
    this.logger.info('Rolling back deployment', {
      cluster: payload.cluster_name,
      service: payload.service_name,
      reason: payload.reason
    });

    const startTime = Date.now();

    try {
      const result = await this.ecsService.rollbackDeployment(
        payload.cluster_name,
        payload.service_name,
        payload.target_deployment_id
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
  private async handleHealthCheck(payload: HealthCheckPayload) {
    this.logger.info('Performing health check', {
      cluster: payload.cluster_name,
      service: payload.service_name,
      endpoint: payload.endpoint
    });

    try {
      const result = await this.healthCheckService.checkEndpoint(
        payload.endpoint,
        {
          timeout: payload.timeout_seconds * 1000,
          expectedStatus: payload.expected_status
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
  protected generateTraceId(): string {
    return `dep-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Execute method required by BaseAgent
   * SESSION #67: Updated to handle AgentEnvelope v2.0.0
   */
  async execute(task: any): Promise<any> {
    // SESSION #67: Extract DeploymentTask from AgentEnvelope.payload
    const deploymentTask: DeploymentTask = {
      task_id: task.task_id,
      workflow_id: task.workflow_id,
      agent_type: 'deployment',
      action: task.payload.action,
      status: 'pending',
      priority: task.priority === 'critical' ? 90 :
                task.priority === 'high' ? 70 :
                task.priority === 'medium' ? 50 : 30,
      payload: task.payload,
      version: '1.0.0',
      timeout_ms: task.constraints?.timeout_ms || 120000,
      retry_count: task.retry_count || 0,
      max_retries: task.constraints?.max_retries || 3,
      created_at: task.metadata?.created_at || new Date().toISOString()
    };

    const result = await this.executeTask(deploymentTask);
    // Determine success based on result type
    const success = 'success' in result.result
      ? result.result.success
      : 'healthy' in result.result
        ? result.result.healthy
        : true;

    return {
      task_id: task.task_id,
      workflow_id: task.workflow_id,
      status: success ? 'success' : 'failure',
      output: result,
      errors: success ? [] : ['Task execution failed']
    };
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
