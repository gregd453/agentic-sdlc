import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ECSService } from '../../services/ecs.service';
import { ECSClient } from '@aws-sdk/client-ecs';

vi.mock('@aws-sdk/client-ecs');

describe('ECSService', () => {
  let service: ECSService;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      send: vi.fn()
    };

    (ECSClient as any).mockImplementation(() => mockClient);
    service = new ECSService('us-east-1');
  });

  describe('updateService', () => {
    it('should update ECS service successfully', async () => {
      mockClient.send.mockResolvedValue({
        service: {
          deployments: [{
            id: 'deploy-123',
            taskDefinition: 'arn:aws:ecs:us-east-1:123456:task-definition/my-app:1',
            desiredCount: 2,
            runningCount: 2,
            pendingCount: 0
          }]
        }
      });

      const result = await service.updateService(
        'my-cluster',
        'my-service',
        'arn:aws:ecs:us-east-1:123456:task-definition/my-app:1',
        2
      );

      expect(result.deploymentId).toBe('deploy-123');
      expect(result.desiredCount).toBe(2);
      expect(mockClient.send).toHaveBeenCalled();
    });
  });

  describe('describeService', () => {
    it('should get service details', async () => {
      const mockService = {
        serviceName: 'my-service',
        taskDefinition: 'arn:aws:ecs:us-east-1:123456:task-definition/my-app:1',
        desiredCount: 2,
        runningCount: 2
      };

      mockClient.send.mockResolvedValue({
        services: [mockService]
      });

      const result = await service.describeService('my-cluster', 'my-service');

      expect(result.serviceName).toBe('my-service');
      expect(result.desiredCount).toBe(2);
    });

    it('should throw error if service not found', async () => {
      mockClient.send.mockResolvedValue({
        services: []
      });

      await expect(service.describeService('my-cluster', 'my-service'))
        .rejects.toThrow('Service my-service not found');
    });
  });

  describe('rollbackDeployment', () => {
    it('should rollback to previous task definition', async () => {
      // Mock describe service
      mockClient.send.mockResolvedValueOnce({
        services: [{
          deployments: [{
            id: 'deploy-123',
            status: 'PRIMARY',
            taskDefinition: 'arn:aws:ecs:us-east-1:123456:task-definition/my-app:2'
          }],
          desiredCount: 2
        }]
      });

      // Mock describe task definition
      mockClient.send.mockResolvedValueOnce({
        taskDefinition: {
          family: 'my-app',
          revision: '2'
        }
      });

      // Mock update service
      mockClient.send.mockResolvedValueOnce({
        service: {
          deployments: [{
            id: 'deploy-124',
            taskDefinition: 'arn:aws:ecs:us-east-1:123456:task-definition/my-app:1'
          }]
        }
      });

      const result = await service.rollbackDeployment('my-cluster', 'my-service');

      expect(result.previousDeploymentId).toBe('deploy-123');
      expect(mockClient.send).toHaveBeenCalledTimes(3);
    });
  });

  describe('waitForServiceStable', () => {
    it('should return true when service is stable', async () => {
      mockClient.send.mockResolvedValue({
        services: [{
          deployments: [{
            id: 'deploy-123',
            status: 'PRIMARY',
            desiredCount: 2,
            runningCount: 2
          }]
        }]
      });

      const result = await service.waitForServiceStable('my-cluster', 'my-service', 0.1);

      expect(result).toBe(true);
    });

    it('should throw error on timeout', async () => {
      mockClient.send.mockResolvedValue({
        services: [{
          deployments: [
            {
              id: 'deploy-123',
              status: 'PRIMARY',
              desiredCount: 2,
              runningCount: 0
            },
            {
              id: 'deploy-122',
              status: 'ACTIVE',
              desiredCount: 2,
              runningCount: 2
            }
          ]
        }]
      });

      await expect(service.waitForServiceStable('my-cluster', 'my-service', 0.01))
        .rejects.toThrow('did not stabilize');
    }, 10000);
  });

  describe('scaleService', () => {
    it('should scale service to desired count', async () => {
      mockClient.send.mockResolvedValueOnce({
        services: [{
          taskDefinition: 'arn:aws:ecs:us-east-1:123456:task-definition/my-app:1'
        }]
      });

      mockClient.send.mockResolvedValueOnce({
        service: {
          deployments: [{
            id: 'deploy-123',
            desiredCount: 5
          }]
        }
      });

      await service.scaleService('my-cluster', 'my-service', 5);

      expect(mockClient.send).toHaveBeenCalledTimes(2);
    });
  });
});
