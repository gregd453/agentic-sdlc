# Deployment Agent - Implementation Plan

**Status:** Architecture Defined, Ready for Implementation
**Story Points:** 8
**Estimated LOC:** ~2,000

## 🏗️ Architecture Overview

```
DeploymentAgent (extends BaseAgent)
├── DockerService            # Docker image building
├── ECRService               # AWS ECR operations
├── ECSService               # AWS ECS/Fargate deployments
├── DeploymentStrategy       # Blue-green, canary, rolling
└── HealthCheckService       # Service health validation
```

## 📦 Core Components

### 1. DockerService (`src/services/docker.service.ts`)
**Purpose:** Build and manage Docker images using Dockerode

**Methods:**
- `buildImage(config)` - Build Docker image from Dockerfile
- `tagImage(imageId, tag)` - Tag image for registry
- `getImageInfo(imageId)` - Get image metadata
- `removeImage(imageId)` - Clean up old images

**Build Process:**
```typescript
const stream = await docker.buildImage({
  context: contextPath,
  src: ['Dockerfile', ...files],
}, {
  t: `${imageName}:${imageTag}`,
  buildargs: buildArgs,
  target: targetStage,
  cachefrom: cacheImages
});

// Stream build output with progress
await new Promise((resolve, reject) => {
  docker.modem.followProgress(stream,
    (err, res) => err ? reject(err) : resolve(res),
    (event) => logger.info('Build progress', event)
  );
});
```

### 2. ECRService (`src/services/ecr.service.ts`)
**Purpose:** AWS ECR repository and image management

**Methods:**
- `getAuthorizationToken()` - Get ECR login credentials
- `createRepository(name)` - Create ECR repository
- `setLifecyclePolicy(policy)` - Configure image retention
- `pushImage(imageUri)` - Push image to ECR
- `getImageDigest(imageUri)` - Get pushed image digest

**Push Flow:**
```typescript
// 1. Get ECR auth token
const authToken = await ecr.getAuthorizationToken();
const [user, password] = Buffer.from(authToken, 'base64')
  .toString().split(':');

// 2. Docker login to ECR
await docker.login({ username: user, password, serveraddress: ecrUri });

// 3. Tag image for ECR
await docker.getImage(localImageId).tag({
  repo: repositoryUri,
  tag: imageTag
});

// 4. Push to ECR
const stream = await docker.getImage(repositoryUri).push();
await streamToPromise(stream);
```

### 3. ECSService (`src/services/ecs.service.ts`)
**Purpose:** ECS task definitions and service deployments

**Methods:**
- `registerTaskDefinition(config)` - Create/update task definition
- `updateService(config)` - Deploy new task definition
- `waitForStableService(cluster, service)` - Wait for deployment completion
- `getServiceStatus(cluster, service)` - Check service health
- `describeTasksFailures()` - Diagnose failed tasks

**Task Definition Creation:**
```typescript
const taskDefArn = await ecs.registerTaskDefinition({
  family: taskDef.family,
  cpu: taskDef.cpu,
  memory: taskDef.memory,
  networkMode: 'awsvpc',
  requiresCompatibilities: ['FARGATE'],
  executionRoleArn: taskDef.executionRoleArn,
  containerDefinitions: taskDef.containerDefinitions.map(container => ({
    name: container.name,
    image: `${ecrUri}:${imageTag}`,  // Updated image
    cpu: container.cpu,
    memory: container.memory,
    portMappings: container.portMappings,
    environment: container.environment,
    secrets: container.secrets,
    logConfiguration: {
      logDriver: 'awslogs',
      options: {
        'awslogs-group': `/ecs/${taskDef.family}`,
        'awslogs-region': region,
        'awslogs-stream-prefix': 'ecs'
      }
    }
  }))
});
```

### 4. DeploymentStrategy (`src/services/deployment-strategy.service.ts`)
**Purpose:** Implement deployment strategies

**Blue-Green Deployment:**
```typescript
async deployBlueGreen(config: DeployToECSTask): Promise<DeploymentResult> {
  // 1. Get current service (Blue)
  const currentService = await ecs.describeServices(config.serviceName);
  const currentTaskDef = currentService.taskDefinition;

  // 2. Register new task definition (Green)
  const newTaskDefArn = await ecs.registerTaskDefinition(config.taskDefinition);

  // 3. Create temporary service with new task definition
  const greenServiceName = `${config.serviceName}-green`;
  await ecs.createService({
    serviceName: greenServiceName,
    taskDefinition: newTaskDefArn,
    desiredCount: config.desiredCount,
    // ... same network config
  });

  // 4. Wait for green service to be healthy
  await ecs.waitForStableService(config.clusterName, greenServiceName);
  await healthCheck.validateService(greenServiceName);

  // 5. Update load balancer to point to green
  await elb.updateTargetGroup(config.loadBalancer.targetGroupArn, greenTasks);

  // 6. Drain blue service
  await ecs.updateService(config.serviceName, { desiredCount: 0 });

  // 7. Wait for blue tasks to drain
  await ecs.waitForTasksToStop(config.serviceName);

  // 8. Update original service with new task definition
  await ecs.updateService(config.serviceName, {
    taskDefinition: newTaskDefArn,
    desiredCount: config.desiredCount
  });

  // 9. Delete green service
  await ecs.deleteService(greenServiceName);

  return { success: true, deployment_id: newTaskDefArn };
}
```

**Rolling Update:**
```typescript
async deployRolling(config: DeployToECSTask): Promise<DeploymentResult> {
  // 1. Register new task definition
  const newTaskDefArn = await ecs.registerTaskDefinition(config.taskDefinition);

  // 2. Update service with deployment configuration
  await ecs.updateService({
    service: config.serviceName,
    taskDefinition: newTaskDefArn,
    desiredCount: config.desiredCount,
    deploymentConfiguration: {
      maximumPercent: config.deploymentConfiguration.maximumPercent,
      minimumHealthyPercent: config.deploymentConfiguration.minimumHealthyPercent,
      deploymentCircuitBreaker: {
        enable: true,
        rollback: true  // Auto-rollback on failure
      }
    }
  });

  // 3. Monitor deployment progress
  return await this.waitAndMonitorDeployment(config);
}
```

### 5. HealthCheckService (`src/services/health-check.service.ts`)
**Purpose:** Validate service health post-deployment

**Methods:**
- `checkEndpoint(url)` - HTTP health check
- `validateTaskHealth(tasks)` - Check ECS task health
- `waitForHealthy(service, timeout)` - Poll until healthy

## 🔄 Complete Deployment Workflow

```typescript
// Full deployment pipeline
async executeDeploy

ment(task: DeployToECSTask): Promise<DeploymentResult> {
  try {
    // 1. Build Docker image
    const buildResult = await dockerService.buildImage({
      dockerfile: './Dockerfile',
      imageName: 'my-app',
      imageTag: 'v1.2.3'
    });

    // 2. Push to ECR
    const pushResult = await ecrService.pushImage({
      imageId: buildResult.imageId,
      repositoryName: 'my-app',
      region: 'us-east-1'
    });

    // 3. Execute deployment strategy
    const deployResult = await deploymentStrategy.execute(task, {
      imageUri: pushResult.imageUri
    });

    // 4. Wait for stable
    await ecsService.waitForStableService(
      task.clusterName,
      task.serviceName
    );

    // 5. Health check
    const healthResult = await healthCheckService.checkEndpoint(
      task.healthCheckEndpoint
    );

    if (!healthResult.healthy) {
      // 6. Auto-rollback on health check failure
      await this.rollbackDeployment(task.clusterName, task.serviceName);
      throw new Error('Health check failed, rolled back');
    }

    return { success: true, deploymentId: deployResult.deploymentId };

  } catch (error) {
    logger.error('Deployment failed', { error });
    await this.rollbackDeployment(task.clusterName, task.serviceName);
    throw error;
  }
}
```

## 🧪 Test Coverage Plan

### Unit Tests (~30 tests)

**DockerService Tests:**
- ✅ Image building with various configs
- ✅ Multi-stage builds
- ✅ Build arg injection
- ✅ Image tagging
- ✅ Cleanup operations

**ECRService Tests:**
- ✅ Auth token retrieval
- ✅ Repository creation
- ✅ Lifecycle policy configuration
- ✅ Image push operations
- ✅ Digest retrieval

**ECSService Tests:**
- ✅ Task definition registration
- ✅ Service updates
- ✅ Deployment monitoring
- ✅ Task failure diagnosis
- ✅ Service scaling

**DeploymentStrategy Tests:**
- ✅ Blue-green deployment flow
- ✅ Rolling update flow
- ✅ Rollback mechanism
- ✅ Health check integration

**HealthCheckService Tests:**
- ✅ HTTP endpoint checks
- ✅ Task health validation
- ✅ Timeout handling

### Integration Tests (~5 tests)
- ✅ Full deployment pipeline (local Docker)
- ✅ Blue-green deployment simulation
- ✅ Rollback on failure
- ✅ Multi-container deployments

## 📊 Key Metrics

- **Deployment Duration:** Time from build to healthy service
- **Rollback Rate:** % of deployments requiring rollback
- **Zero-Downtime Success:** % of blue-green deployments with no downtime
- **Build Time:** Docker image build duration
- **Health Check Response Time:** Service availability post-deploy

## 🔐 Safety Measures

1. **Circuit Breaker:** Auto-rollback on deployment failure
2. **Health Checks:** Validate service before declaring success
3. **Gradual Rollout:** Rolling updates maintain minimum healthy %
4. **Immediate Rollback:** One-command rollback to previous version
5. **Task Failure Detection:** Monitor and diagnose failed tasks
6. **Resource Limits:** Enforce CPU/memory limits
7. **Secret Management:** Use AWS Secrets Manager for sensitive data

## 📝 Files to Create

1. `src/deployment-agent.ts` - Main agent class
2. `src/services/docker.service.ts` - Docker operations
3. `src/services/ecr.service.ts` - AWS ECR management
4. `src/services/ecs.service.ts` - AWS ECS operations
5. `src/services/deployment-strategy.service.ts` - Deployment patterns
6. `src/services/health-check.service.ts` - Health validation
7. `src/index.ts` - Entry point
8. `src/__tests__/*.test.ts` - 30+ unit tests

**Estimated Total:** ~2,000 LOC + 30 tests

---

**Next Steps:** Implement core agent and services following this architecture.
