import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { workflowRoutes } from '../../src/api/routes/workflow.routes';
import { WorkflowService } from '../../src/services/workflow.service';

describe('Workflow API Routes', () => {
  let app: FastifyInstance;
  let mockWorkflowService: any;

  beforeEach(async () => {
    app = Fastify({ logger: false });

    // Create mock workflow service
    mockWorkflowService = {
      createWorkflow: vi.fn().mockResolvedValue({
        workflow_id: 'test-workflow-id',
        status: 'initiated',
        current_stage: 'initialization',
        progress_percentage: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }),
      getWorkflow: vi.fn().mockResolvedValue(null),
      listWorkflows: vi.fn().mockResolvedValue([]),
      cancelWorkflow: vi.fn().mockResolvedValue(undefined),
      retryWorkflow: vi.fn().mockResolvedValue(undefined)
    };

    // Register routes with mock service
    await app.register(workflowRoutes, { workflowService: mockWorkflowService });
    await app.ready();
  });

  describe('POST /api/v1/workflows', () => {
    it('should create a new workflow', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/workflows',
        payload: {
          type: 'app',
          name: 'Test App',
          description: 'Test Description',
          priority: 'normal'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.workflow_id).toBe('test-workflow-id');
      expect(body.status).toBe('initiated');

      expect(mockWorkflowService.createWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'app',
          name: 'Test App'
        })
      );
    });

    it('should return 400 for invalid request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/workflows',
        payload: {
          // Missing required fields
          name: 'Test App'
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();  // Fastify returns "Bad Request" for schema validation errors
    });

    it('should handle service errors', async () => {
      mockWorkflowService.createWorkflow.mockRejectedValue(new Error('Service error'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/workflows',
        payload: {
          type: 'app',
          name: 'Test App',
          priority: 'normal'
        }
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Internal server error');
    });
  });

  describe('GET /api/v1/workflows/:id', () => {
    it('should return workflow when found', async () => {
      mockWorkflowService.getWorkflow.mockResolvedValue({
        workflow_id: 'test-id',
        status: 'running',
        current_stage: 'validation',
        progress_percentage: 50,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/workflows/123e4567-e89b-12d3-a456-426614174000'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.workflow_id).toBe('test-id');
      expect(body.status).toBe('running');
    });

    it('should return 404 when workflow not found', async () => {
      mockWorkflowService.getWorkflow.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/workflows/123e4567-e89b-12d3-a456-426614174000'
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Workflow not found');
    });

    it('should return 400 for invalid UUID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/workflows/invalid-uuid'
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/workflows', () => {
    it('should list all workflows', async () => {
      mockWorkflowService.listWorkflows.mockResolvedValue([
        {
          workflow_id: 'workflow-1',
          status: 'running',
          current_stage: 'validation',
          progress_percentage: 50,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          workflow_id: 'workflow-2',
          status: 'completed',
          current_stage: 'deployment',
          progress_percentage: 100,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/workflows'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(2);
      expect(body[0].workflow_id).toBe('workflow-1');
      expect(body[1].workflow_id).toBe('workflow-2');
    });

    it('should filter workflows by status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/workflows?status=running'
      });

      expect(response.statusCode).toBe(200);
      expect(mockWorkflowService.listWorkflows).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'running' })
      );
    });
  });

  describe('POST /api/v1/workflows/:id/cancel', () => {
    it('should cancel a workflow', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/workflows/123e4567-e89b-12d3-a456-426614174000/cancel'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('Workflow cancelled successfully');

      expect(mockWorkflowService.cancelWorkflow).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000'
      );
    });

    it('should return 404 when workflow not found', async () => {
      const error = new Error('Workflow not found');
      (error as any).code = 'NOT_FOUND';
      mockWorkflowService.cancelWorkflow.mockRejectedValue(error);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/workflows/123e4567-e89b-12d3-a456-426614174000/cancel'
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/v1/workflows/:id/retry', () => {
    it('should retry a workflow', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/workflows/123e4567-e89b-12d3-a456-426614174000/retry',
        payload: {
          from_stage: 'validation'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('Workflow retry initiated successfully');

      expect(mockWorkflowService.retryWorkflow).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000',
        'validation'
      );
    });

    it('should retry without specific stage', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/workflows/123e4567-e89b-12d3-a456-426614174000/retry',
        payload: {}
      });

      expect(response.statusCode).toBe(200);
      expect(mockWorkflowService.retryWorkflow).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000',
        undefined
      );
    });
  });

  describe('GET /api/v1/health', () => {
    it('should return health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/health'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('healthy');
      expect(body.timestamp).toBeDefined();
    });
  });
});