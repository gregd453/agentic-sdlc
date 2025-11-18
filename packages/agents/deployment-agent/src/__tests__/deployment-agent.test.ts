import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeploymentAgent } from '../deployment-agent';
import { DockerService } from '../services/docker.service';
import { ECRService } from '../services/ecr.service';
import { ECSService } from '../services/ecs.service';
import { HealthCheckService } from '../services/health-check.service';
import {
  createMockBuildResult,
  createMockHealthCheckResult,
  createMockRollbackResult
} from './mock-factories';

// Mock services
vi.mock('../services/docker.service');
vi.mock('../services/ecr.service');
vi.mock('../services/ecs.service');
vi.mock('../services/deployment-strategy.service');
vi.mock('../services/health-check.service');

describe('DeploymentAgent', () => {
  let agent: DeploymentAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new DeploymentAgent();
  });

  describe('executeTask', () => {
    it('should handle build_docker_image task successfully', async () => {
      const mockTask = {
        task_id: 'task_test-123',
        workflow_id: 'wf_test-123',
        agent_type: AGENT_TYPES.DEPLOYMENT as const,
        action: 'build_docker_image' as const,
        status: TASK_STATUS.PENDING as const,
        priority: 50,
        payload: {
          dockerfile_path: './Dockerfile',
          context_path: '.',
          image_name: 'test-app',
          image_tag: 'v1.0.0',
          no_cache: false
        },
        version: '1.0.0',
        timeout_ms: 120000,
        retry_count: 0,
        max_retries: 3,
        created_at: new Date().toISOString()
      };

      vi.spyOn(DockerService.prototype, 'buildImage').mockResolvedValue(
        createMockBuildResult({ image_id: 'sha256:abc123' })
      );

      const result = await agent.executeTask(mockTask);

      expect(result.action).toBe('build_docker_image');
      expect(result.result.success).toBe(true);
      expect(result.result.image_id).toBe('sha256:abc123');
    });

    it('should handle push_to_ecr task successfully', async () => {
      const mockTask = {
        task_id: 'task_test-456',
        workflow_id: 'wf_test-123',
        agent_type: AGENT_TYPES.DEPLOYMENT as const,
        action: 'push_to_ecr' as const,
        status: TASK_STATUS.PENDING as const,
        priority: 50,
        payload: {
          image_name: 'test-app',
          image_tag: 'v1.0.0',
          repository_name: 'my-repo',
          aws_region: 'us-east-1',
          create_repository: true
        },
        version: '1.0.0',
        timeout_ms: 120000,
        retry_count: 0,
        max_retries: 3,
        created_at: new Date().toISOString()
      };

      vi.spyOn(ECRService.prototype, 'createRepositoryIfNotExists').mockResolvedValue('123456.dkr.ecr.us-east-1.amazonaws.com/my-repo');
      vi.spyOn(ECRService.prototype, 'getAuthorizationToken').mockResolvedValue({
        username: 'AWS',
        password: 'token123',
        endpoint: 'https://123456.dkr.ecr.us-east-1.amazonaws.com',
        expiresAt: new Date()
      });
      vi.spyOn(ECRService.prototype, 'getRepositoryUri').mockResolvedValue('123456.dkr.ecr.us-east-1.amazonaws.com/my-repo');
      vi.spyOn(DockerService.prototype, 'loginToRegistry').mockResolvedValue(undefined);
      vi.spyOn(DockerService.prototype, 'tagImage').mockResolvedValue(undefined);
      vi.spyOn(DockerService.prototype, 'pushImage').mockResolvedValue({ digest: 'sha256:def456' });

      const result = await agent.executeTask(mockTask);

      expect(result.action).toBe('push_to_ecr');
      expect(result.result.success).toBe(true);
      expect(result.result.image_digest).toBe('sha256:def456');
    });

    it('should handle health_check task successfully', async () => {
      const mockTask = {
        task_id: 'task_test-789',
        workflow_id: 'wf_test-123',
        agent_type: AGENT_TYPES.DEPLOYMENT as const,
        action: 'health_check' as const,
        status: TASK_STATUS.PENDING as const,
        priority: 50,
        payload: {
          cluster_name: 'my-cluster',
          service_name: 'my-service',
          endpoint: 'http://example.com/health',
          timeout_seconds: 30,
          expected_status: 200
        },
        version: '1.0.0',
        timeout_ms: 120000,
        retry_count: 0,
        max_retries: 3,
        created_at: new Date().toISOString()
      };

      vi.spyOn(HealthCheckService.prototype, 'checkEndpoint').mockResolvedValue(
        createMockHealthCheckResult({ status_code: 200, response_time_ms: 150 })
      );

      const result = await agent.executeTask(mockTask);

      expect(result.action).toBe('health_check');
      expect(result.result.healthy).toBe(true);
      expect(result.result.status_code).toBe(200);
    });

    it('should handle rollback_deployment task successfully', async () => {
      const mockTask = {
        task_id: 'task_test-101',
        workflow_id: 'wf_test-123',
        agent_type: AGENT_TYPES.DEPLOYMENT as const,
        action: 'rollback_deployment' as const,
        status: TASK_STATUS.PENDING as const,
        priority: 50,
        payload: {
          cluster_name: 'my-cluster',
          service_name: 'my-service',
          reason: 'Health check failed'
        },
        version: '1.0.0',
        timeout_ms: 120000,
        retry_count: 0,
        max_retries: 3,
        created_at: new Date().toISOString()
      };

      vi.spyOn(ECSService.prototype, 'rollbackDeployment').mockResolvedValue(
        createMockRollbackResult({
          previous_deployment_id: 'deploy-123',
          rolled_back_to_deployment_id: 'deploy-122'
        })
      );

      const result = await agent.executeTask(mockTask);

      expect(result.action).toBe('rollback_deployment');
      expect(result.result.success).toBe(true);
      expect(result.result.previous_deployment_id).toBe('deploy-123');
    });

    it('should throw error for unknown action', async () => {
      const mockTask = {
        task_id: 'task_test-202',
        workflow_id: 'wf_test-123',
        agent_type: AGENT_TYPES.DEPLOYMENT as const,
        action: 'unknown_action' as any,
        status: TASK_STATUS.PENDING as const,
        priority: 50,
        payload: {},
        version: '1.0.0',
        timeout_ms: 120000,
        retry_count: 0,
        max_retries: 3,
        created_at: new Date().toISOString()
      };

      await expect(agent.executeTask(mockTask)).rejects.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', async () => {
      vi.spyOn(DockerService.prototype, 'cleanup').mockResolvedValue(undefined);

      await expect(agent.cleanup()).resolves.not.toThrow();
    });
  });
});
