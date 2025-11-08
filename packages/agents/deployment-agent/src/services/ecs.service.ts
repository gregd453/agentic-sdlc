import {
  ECSClient,
  UpdateServiceCommand,
  DescribeServicesCommand,
  DescribeTaskDefinitionCommand,
  RegisterTaskDefinitionCommand,
  ListTasksCommand,
  DescribeTasksCommand,
  Service,
  TaskDefinition
} from '@aws-sdk/client-ecs';

/**
 * ECS deployment result
 */
export interface ECSDeploymentResult {
  deploymentId: string;
  taskDefinitionArn: string;
  desiredCount: number;
  runningCount: number;
  pendingCount: number;
}

/**
 * Rollback result
 */
export interface RollbackResult {
  previousDeploymentId: string;
  rolledBackToDeploymentId: string;
}

/**
 * ECSService - AWS Elastic Container Service operations
 * Handles service updates, task definitions, and deployment management
 */
export class ECSService {
  private client: ECSClient;

  constructor(region: string = 'us-east-1') {
    this.client = new ECSClient({ region });
  }

  /**
   * Update ECS service with new task definition
   */
  async updateService(
    clusterName: string,
    serviceName: string,
    taskDefinitionArn: string,
    desiredCount?: number
  ): Promise<ECSDeploymentResult> {
    try {
      const command = new UpdateServiceCommand({
        cluster: clusterName,
        service: serviceName,
        taskDefinition: taskDefinitionArn,
        desiredCount,
        forceNewDeployment: true
      });

      const response = await this.client.send(command);
      const service = response.service!;
      const deployment = service.deployments?.[0];

      return {
        deploymentId: deployment?.id || '',
        taskDefinitionArn: deployment?.taskDefinition || '',
        desiredCount: deployment?.desiredCount || 0,
        runningCount: deployment?.runningCount || 0,
        pendingCount: deployment?.pendingCount || 0
      };

    } catch (error) {
      throw new Error(`Failed to update service: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get service details
   */
  async describeService(
    clusterName: string,
    serviceName: string
  ): Promise<Service> {
    try {
      const command = new DescribeServicesCommand({
        cluster: clusterName,
        services: [serviceName]
      });

      const response = await this.client.send(command);
      const service = response.services?.[0];

      if (!service) {
        throw new Error(`Service ${serviceName} not found in cluster ${clusterName}`);
      }

      return service;

    } catch (error) {
      throw new Error(`Failed to describe service: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get task definition details
   */
  async describeTaskDefinition(taskDefinitionArn: string): Promise<TaskDefinition> {
    try {
      const command = new DescribeTaskDefinitionCommand({
        taskDefinition: taskDefinitionArn
      });

      const response = await this.client.send(command);
      const taskDefinition = response.taskDefinition;

      if (!taskDefinition) {
        throw new Error(`Task definition ${taskDefinitionArn} not found`);
      }

      return taskDefinition;

    } catch (error) {
      throw new Error(`Failed to describe task definition: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Register new task definition with updated image
   */
  async registerTaskDefinition(
    baseTaskDefinitionArn: string,
    imageUri: string,
    containerName?: string
  ): Promise<string> {
    try {
      // Get base task definition
      const baseTaskDef = await this.describeTaskDefinition(baseTaskDefinitionArn);

      // Update container image
      const containerDefinitions = baseTaskDef.containerDefinitions!.map(container => {
        if (!containerName || container.name === containerName) {
          return {
            ...container,
            image: imageUri
          };
        }
        return container;
      });

      // Register new task definition
      const command = new RegisterTaskDefinitionCommand({
        family: baseTaskDef.family!,
        taskRoleArn: baseTaskDef.taskRoleArn,
        executionRoleArn: baseTaskDef.executionRoleArn,
        networkMode: baseTaskDef.networkMode,
        containerDefinitions,
        volumes: baseTaskDef.volumes,
        placementConstraints: baseTaskDef.placementConstraints,
        requiresCompatibilities: baseTaskDef.requiresCompatibilities,
        cpu: baseTaskDef.cpu,
        memory: baseTaskDef.memory,
        runtimePlatform: baseTaskDef.runtimePlatform
      });

      const response = await this.client.send(command);
      return response.taskDefinition!.taskDefinitionArn!;

    } catch (error) {
      throw new Error(`Failed to register task definition: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Wait for service to become stable
   */
  async waitForServiceStable(
    clusterName: string,
    serviceName: string,
    timeoutMinutes: number = 30
  ): Promise<boolean> {
    const timeoutMs = timeoutMinutes * 60 * 1000;
    const startTime = Date.now();
    const pollInterval = 15000; // 15 seconds

    while (Date.now() - startTime < timeoutMs) {
      try {
        const service = await this.describeService(clusterName, serviceName);

        // Check if deployment is stable
        const primaryDeployment = service.deployments?.find(d => d.status === 'PRIMARY');

        if (
          primaryDeployment &&
          primaryDeployment.runningCount === primaryDeployment.desiredCount &&
          service.deployments?.length === 1
        ) {
          return true;
        }

        // Wait before next poll
        await this.sleep(pollInterval);

      } catch (error) {
        throw new Error(`Error while waiting for service: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    throw new Error(`Service did not stabilize within ${timeoutMinutes} minutes`);
  }

  /**
   * Rollback deployment to previous task definition
   */
  async rollbackDeployment(
    clusterName: string,
    serviceName: string,
    targetDeploymentId?: string
  ): Promise<RollbackResult> {
    try {
      const service = await this.describeService(clusterName, serviceName);

      // Get current deployment
      const currentDeployment = service.deployments?.find(d => d.status === 'PRIMARY');

      if (!currentDeployment) {
        throw new Error('No active deployment found');
      }

      // Determine target task definition
      let targetTaskDefinition: string;

      if (targetDeploymentId) {
        // Find specific deployment
        const targetDeployment = service.deployments?.find(d => d.id === targetDeploymentId);
        if (!targetDeployment) {
          throw new Error(`Deployment ${targetDeploymentId} not found`);
        }
        targetTaskDefinition = targetDeployment.taskDefinition!;
      } else {
        // Use previous task definition (simple rollback)
        const currentTaskDef = await this.describeTaskDefinition(currentDeployment.taskDefinition!);
        const revisionStr = String(currentTaskDef.revision || '1');
        const currentRevision = parseInt(revisionStr, 10);

        if (currentRevision <= 1) {
          throw new Error('No previous revision to rollback to');
        }

        targetTaskDefinition = `${currentTaskDef.family}:${currentRevision - 1}`;
      }

      // Update service to previous task definition
      const result = await this.updateService(
        clusterName,
        serviceName,
        targetTaskDefinition,
        service.desiredCount
      );

      return {
        previousDeploymentId: currentDeployment.id!,
        rolledBackToDeploymentId: result.deploymentId
      };

    } catch (error) {
      throw new Error(`Failed to rollback deployment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get running tasks for a service
   */
  async getRunningTasks(
    clusterName: string,
    serviceName: string
  ): Promise<Array<{
    taskArn: string;
    status: string;
    healthStatus: string;
    startedAt?: Date;
  }>> {
    try {
      // List tasks
      const listCommand = new ListTasksCommand({
        cluster: clusterName,
        serviceName,
        desiredStatus: 'RUNNING'
      });

      const listResponse = await this.client.send(listCommand);

      if (!listResponse.taskArns || listResponse.taskArns.length === 0) {
        return [];
      }

      // Describe tasks
      const describeCommand = new DescribeTasksCommand({
        cluster: clusterName,
        tasks: listResponse.taskArns
      });

      const describeResponse = await this.client.send(describeCommand);

      return (describeResponse.tasks || []).map(task => ({
        taskArn: task.taskArn || '',
        status: task.lastStatus || '',
        healthStatus: task.healthStatus || 'UNKNOWN',
        startedAt: task.startedAt
      }));

    } catch (error) {
      throw new Error(`Failed to get running tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get deployment status
   */
  async getDeploymentStatus(
    clusterName: string,
    serviceName: string
  ): Promise<{
    deployments: Array<{
      id: string;
      status: string;
      taskDefinition: string;
      desiredCount: number;
      runningCount: number;
      pendingCount: number;
      rolloutState?: string;
    }>;
  }> {
    try {
      const service = await this.describeService(clusterName, serviceName);

      return {
        deployments: (service.deployments || []).map(d => ({
          id: d.id || '',
          status: d.status || '',
          taskDefinition: d.taskDefinition || '',
          desiredCount: d.desiredCount || 0,
          runningCount: d.runningCount || 0,
          pendingCount: d.pendingCount || 0,
          rolloutState: d.rolloutState
        }))
      };

    } catch (error) {
      throw new Error(`Failed to get deployment status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Scale service
   */
  async scaleService(
    clusterName: string,
    serviceName: string,
    desiredCount: number
  ): Promise<void> {
    try {
      const service = await this.describeService(clusterName, serviceName);

      await this.updateService(
        clusterName,
        serviceName,
        service.taskDefinition!,
        Number(desiredCount)
      );

    } catch (error) {
      throw new Error(`Failed to scale service: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
