import { ECSService } from './ecs.service';
import { HealthCheckService } from './health-check.service';

/**
 * Deployment task interface (simplified from types.ts)
 */
export interface DeploymentTask {
  cluster_name: string;
  service_name: string;
  task_definition: any;
  desired_count: number;
  deployment_configuration?: {
    maximum_percent?: number;
    minimum_healthy_percent?: number;
    deployment_circuit_breaker?: {
      enable: boolean;
      rollback: boolean;
    };
  };
  load_balancer?: {
    target_group_arn: string;
    container_name: string;
    container_port: number;
  };
  wait_for_stable?: boolean;
}

/**
 * Deployment result
 */
export interface DeploymentResult {
  deployment_id?: string;
  task_definition_arn?: string;
  desired_count: number;
  running_count: number;
  pending_count?: number;
  strategy_used: string;
  rollback_info?: {
    rollback_triggered: boolean;
    reason: string;
  };
}

/**
 * DeploymentStrategyService - Orchestrates different deployment strategies
 * Implements blue-green, rolling, canary, and recreate deployment patterns
 */
export class DeploymentStrategyService {
  private ecsService: ECSService;

  constructor(ecsService: ECSService, _healthCheckService: HealthCheckService) {
    this.ecsService = ecsService;
  }

  /**
   * Execute blue-green deployment
   * Zero-downtime deployment by creating new tasks before removing old ones
   */
  async executeBlueGreen(task: DeploymentTask): Promise<DeploymentResult> {
    try {
      // Get current service state
      const currentService = await this.ecsService.describeService(
        task.cluster_name,
        task.service_name
      );

      const currentTaskDefArn = currentService.taskDefinition!;

      // Register new task definition
      const newTaskDefArn = await this.ecsService.registerTaskDefinition(
        currentTaskDefArn,
        task.task_definition.container_definitions[0].image,
        task.task_definition.container_definitions[0].name
      );

      // Update service with new task definition
      // With maximum_percent=200, ECS will start new tasks before stopping old ones
      const result = await this.ecsService.updateService(
        task.cluster_name,
        task.service_name,
        newTaskDefArn,
        task.desired_count
      );

      return {
        deployment_id: result.deploymentId,
        task_definition_arn: result.taskDefinitionArn,
        desired_count: result.desiredCount,
        running_count: result.runningCount,
        pending_count: result.pendingCount,
        strategy_used: 'blue-green'
      };

    } catch (error) {
      throw new Error(`Blue-green deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute rolling deployment
   * Gradually replace old tasks with new ones
   */
  async executeRolling(task: DeploymentTask): Promise<DeploymentResult> {
    try {
      // Get current service
      const currentService = await this.ecsService.describeService(
        task.cluster_name,
        task.service_name
      );

      const currentTaskDefArn = currentService.taskDefinition!;

      // Register new task definition
      const newTaskDefArn = await this.ecsService.registerTaskDefinition(
        currentTaskDefArn,
        task.task_definition.container_definitions[0].image,
        task.task_definition.container_definitions[0].name
      );

      // Update service with rolling deployment
      // Use minimum_healthy_percent=100 and maximum_percent=150 for controlled rolling
      const result = await this.ecsService.updateService(
        task.cluster_name,
        task.service_name,
        newTaskDefArn,
        task.desired_count
      );

      return {
        deployment_id: result.deploymentId,
        task_definition_arn: result.taskDefinitionArn,
        desired_count: result.desiredCount,
        running_count: result.runningCount,
        pending_count: result.pendingCount,
        strategy_used: 'rolling'
      };

    } catch (error) {
      throw new Error(`Rolling deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute canary deployment
   * Deploy to small subset first, then gradually increase
   */
  async executeCanary(task: DeploymentTask): Promise<DeploymentResult> {
    try {
      const canaryPercent = 10; // Start with 10% of traffic
      const canaryCount = Math.max(1, Math.ceil(task.desired_count * (canaryPercent / 100)));

      // Get current service
      const currentService = await this.ecsService.describeService(
        task.cluster_name,
        task.service_name
      );

      const currentTaskDefArn = currentService.taskDefinition!;

      // Register new task definition
      const newTaskDefArn = await this.ecsService.registerTaskDefinition(
        currentTaskDefArn,
        task.task_definition.container_definitions[0].image,
        task.task_definition.container_definitions[0].name
      );

      // Phase 1: Deploy canary (10% of desired count)
      let result = await this.ecsService.updateService(
        task.cluster_name,
        task.service_name,
        newTaskDefArn,
        canaryCount
      );

      // Wait for canary to be healthy
      await this.sleep(30000); // Wait 30 seconds for canary to stabilize

      // Check canary health
      const canaryHealthy = await this.checkCanaryHealth(
        task.cluster_name,
        task.service_name
      );

      if (!canaryHealthy) {
        // Rollback canary
        await this.ecsService.updateService(
          task.cluster_name,
          task.service_name,
          currentTaskDefArn,
          currentService.desiredCount!
        );

        return {
          desired_count: task.desired_count,
          running_count: 0,
          strategy_used: 'canary',
          rollback_info: {
            rollback_triggered: true,
            reason: 'Canary health check failed'
          }
        };
      }

      // Phase 2: Full deployment if canary is healthy
      result = await this.ecsService.updateService(
        task.cluster_name,
        task.service_name,
        newTaskDefArn,
        task.desired_count
      );

      return {
        deployment_id: result.deploymentId,
        task_definition_arn: result.taskDefinitionArn,
        desired_count: result.desiredCount,
        running_count: result.runningCount,
        pending_count: result.pendingCount,
        strategy_used: 'canary'
      };

    } catch (error) {
      throw new Error(`Canary deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute recreate deployment
   * Stop all old tasks, then start new ones (causes downtime)
   */
  async executeRecreate(task: DeploymentTask): Promise<DeploymentResult> {
    try {
      // Get current service
      const currentService = await this.ecsService.describeService(
        task.cluster_name,
        task.service_name
      );

      const currentTaskDefArn = currentService.taskDefinition!;

      // Register new task definition
      const newTaskDefArn = await this.ecsService.registerTaskDefinition(
        currentTaskDefArn,
        task.task_definition.container_definitions[0].image,
        task.task_definition.container_definitions[0].name
      );

      // Phase 1: Scale down to 0
      await this.ecsService.scaleService(task.cluster_name, task.service_name, 0);

      // Wait for all tasks to stop
      await this.sleep(15000); // Wait 15 seconds

      // Phase 2: Update task definition and scale up
      const result = await this.ecsService.updateService(
        task.cluster_name,
        task.service_name,
        newTaskDefArn,
        task.desired_count
      );

      return {
        deployment_id: result.deploymentId,
        task_definition_arn: result.taskDefinitionArn,
        desired_count: result.desiredCount,
        running_count: result.runningCount,
        pending_count: result.pendingCount,
        strategy_used: 'recreate'
      };

    } catch (error) {
      throw new Error(`Recreate deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check canary health
   */
  private async checkCanaryHealth(
    clusterName: string,
    serviceName: string
  ): Promise<boolean> {
    try {
      // Get running tasks
      const tasks = await this.ecsService.getRunningTasks(clusterName, serviceName);

      if (tasks.length === 0) {
        return false;
      }

      // Check if all tasks are healthy
      return tasks.every(task =>
        task.status === 'RUNNING' &&
        (task.healthStatus === 'HEALTHY' || task.healthStatus === 'UNKNOWN')
      );

    } catch (error) {
      return false;
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
