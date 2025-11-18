import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthCheckService } from '../../services/health-check.service';
import http from 'http';

describe('HealthCheckService', () => {
  let service: HealthCheckService;

  beforeEach(() => {
    service = new HealthCheckService();
  });

  describe('checkEndpoint', () => {
    it('should return healthy for 200 status', async () => {
      const mockResponse = {
        statusCode: 200,
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            callback(Buffer.from('OK'));
          } else if (event === 'end') {
            callback();
          }
          return mockResponse;
        })
      };

      const mockRequest = {
        on: vi.fn((event, callback) => mockRequest),
        destroy: vi.fn()
      };

      vi.spyOn(http, 'get').mockImplementation((url: any, options: any, callback: any) => {
        callback(mockResponse);
        return mockRequest as any;
      });

      const result = await service.checkEndpoint('http://example.com/health');

      expect(result.healthy).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.responseTime).toBeGreaterThan(0);
    });

    it('should return unhealthy for non-200 status', async () => {
      const mockResponse = {
        statusCode: 500,
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            callback(Buffer.from('Error'));
          } else if (event === 'end') {
            callback();
          }
          return mockResponse;
        })
      };

      const mockRequest = {
        on: vi.fn((event, callback) => mockRequest),
        destroy: vi.fn()
      };

      vi.spyOn(http, 'get').mockImplementation((url: any, options: any, callback: any) => {
        callback(mockResponse);
        return mockRequest as any;
      });

      const result = await service.checkEndpoint('http://example.com/health');

      expect(result.healthy).toBe(false);
      expect(result.statusCode).toBe(500);
    });

    it('should retry on failure', async () => {
      let callCount = 0;
      const mockRequest = {
        on: vi.fn((event, callback) => {
          if (event === 'error') {
            callCount++;
            callback(new Error('Connection refused'));
          }
          return mockRequest;
        }),
        destroy: vi.fn()
      };

      vi.spyOn(http, 'get').mockImplementation(() => mockRequest as any);

      const result = await service.checkEndpoint('http://example.com/health', {
        retries: 3,
        retryDelay: 10
      });

      expect(result.healthy).toBe(false);
      expect(callCount).toBe(3);
    });
  });

  describe('waitForHealthy', () => {
    it('should return true when endpoint becomes healthy', async () => {
      vi.spyOn(service, 'checkEndpoint').mockResolvedValueOnce({
        healthy: false,
        statusCode: 503,
        responseTime: 100
      }).mockResolvedValueOnce({
        healthy: true,
        statusCode: 200,
        responseTime: 100
      });

      const result = await service.waitForHealthy('http://example.com/health', {
        maxWaitTime: 10000
      });

      expect(result).toBe(true);
    });

    it('should return false after timeout', async () => {
      vi.spyOn(service, 'checkEndpoint').mockResolvedValue({
        healthy: false,
        statusCode: 503,
        responseTime: 100
      });

      const result = await service.waitForHealthy('http://example.com/health', {
        maxWaitTime: 100
      });

      expect(result).toBe(false);
    });
  });
});
