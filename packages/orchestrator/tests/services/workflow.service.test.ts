import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkflowService } from '../../src/services/workflow.service';
import { WorkflowRepository } from '../../src/repositories/workflow.repository';
import { EventBus } from '../../src/events/event-bus';
import { WorkflowStateMachineService } from '../../src/state-machine/workflow-state-machine';
import { CreateWorkflowRequest } from '../../src/types';

describe('WorkflowService', () => {
  let workflowService: WorkflowService;
  let mockRepository: any;
  let mockEventBus: any;
  let mockStateMachineService: any;

  beforeEach(() => {
    // Create mocks
    mockRepository = {
      create: vi.fn().mockResolvedValue({
        id: 'test-workflow-id',
        type: WORKFLOW_TYPES.APP,
        name: 'Test Workflow',
        description: 'Test Description',
        status: WORKFLOW_STATUS.INITIATED,
        current_stage: 'initialization',
        progress: 0,
        priority: 'normal',
        created_at: new Date(),
        updated_at: new Date()
      }),
      findById: vi.fn().mockResolvedValue(null),
      findAll: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
      updateStage: vi.fn().mockResolvedValue({}),
      createTask: vi.fn().mockResolvedValue({}),
      updateTask: vi.fn().mockResolvedValue({}),
      getPendingTasks: vi.fn().mockResolvedValue([])
    };

    mockEventBus = {
      publish: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined)
    };

    mockStateMachineService = {
      createStateMachine: vi.fn().mockReturnValue({
        send: vi.fn(),
        stop: vi.fn()
      }),
      getStateMachine: vi.fn().mockReturnValue({
        send: vi.fn(),
        stop: vi.fn()
      }),
      removeStateMachine: vi.fn()
    };

    workflowService = new WorkflowService(
      mockRepository as any,
      mockEventBus as any,
      mockStateMachineService as any
    );
  });

  describe('createWorkflow', () => {
    it('should successfully create a workflow', async () => {
      const request: CreateWorkflowRequest = {
        type: WORKFLOW_TYPES.APP,
        name: 'Test App',
        description: 'Test Description',
        requirements: 'Test Requirements',
        priority: 'normal'
      };

      const result = await workflowService.createWorkflow(request);

      expect(result).toBeDefined();
      expect(result.workflow_id).toBe('test-workflow-id');
      expect(result.status).toBe(WORKFLOW_STATUS.INITIATED);
      expect(result.current_stage).toBe('initialization');
      expect(result.progress_percentage).toBe(0);

      // Verify repository was called
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WORKFLOW_TYPES.APP,
          name: 'Test App',
          created_by: 'system'
        })
      );

      // Verify state machine was created
      expect(mockStateMachineService.createStateMachine).toHaveBeenCalledWith(
        'test-workflow-id',
        WORKFLOW_TYPES.APP
      );

      // Verify event was published
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it('should handle errors during workflow creation', async () => {
      mockRepository.create.mockRejectedValue(new Error('Database error'));

      const request: CreateWorkflowRequest = {
        type: WORKFLOW_TYPES.APP,
        name: 'Test App',
        priority: 'normal'
      };

      await expect(workflowService.createWorkflow(request)).rejects.toThrow('Database error');
    });
  });

  describe('getWorkflow', () => {
    it('should return workflow when found', async () => {
      const mockWorkflow = {
        id: 'test-id',
        status: WORKFLOW_STATUS.RUNNING,
        current_stage: AGENT_TYPES.VALIDATION,
        progress: 50,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockRepository.findById.mockResolvedValue(mockWorkflow);

      const result = await workflowService.getWorkflow('test-id');

      expect(result).toBeDefined();
      expect(result?.workflow_id).toBe('test-id');
      expect(result?.status).toBe(WORKFLOW_STATUS.RUNNING);
      expect(result?.progress_percentage).toBe(50);
    });

    it('should return null when workflow not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const result = await workflowService.getWorkflow('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('listWorkflows', () => {
    it('should return list of workflows', async () => {
      const mockWorkflows = [
        {
          id: 'workflow-1',
          status: WORKFLOW_STATUS.RUNNING,
          current_stage: AGENT_TYPES.VALIDATION,
          progress: 50,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: 'workflow-2',
          status: WORKFLOW_STATUS.COMPLETED,
          current_stage: AGENT_TYPES.DEPLOYMENT,
          progress: 100,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      mockRepository.findAll.mockResolvedValue(mockWorkflows);

      const result = await workflowService.listWorkflows();

      expect(result).toHaveLength(2);
      expect(result[0].workflow_id).toBe('workflow-1');
      expect(result[1].workflow_id).toBe('workflow-2');
    });

    it('should filter workflows by status', async () => {
      await workflowService.listWorkflows({ status: WORKFLOW_STATUS.RUNNING });

      expect(mockRepository.findAll).toHaveBeenCalledWith({
        status: WORKFLOW_STATUS.RUNNING
      });
    });
  });

  describe('cancelWorkflow', () => {
    it('should cancel an existing workflow', async () => {
      mockRepository.findById.mockResolvedValue({
        id: 'test-id',
        status: WORKFLOW_STATUS.RUNNING
      });

      await workflowService.cancelWorkflow('test-id');

      expect(mockStateMachineService.getStateMachine).toHaveBeenCalledWith('test-id');
      expect(mockRepository.update).toHaveBeenCalledWith('test-id', {
        status: WORKFLOW_STATUS.CANCELLED
      });
    });

    it('should throw error when workflow not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(workflowService.cancelWorkflow('non-existent'))
        .rejects.toThrow('Workflow non-existent not found');
    });
  });

  describe('retryWorkflow', () => {
    it('should retry a failed workflow', async () => {
      mockRepository.findById.mockResolvedValue({
        id: 'test-id',
        status: WORKFLOW_STATUS.FAILED,
        current_stage: AGENT_TYPES.VALIDATION
      });

      await workflowService.retryWorkflow('test-id');

      expect(mockStateMachineService.getStateMachine).toHaveBeenCalledWith('test-id');
      expect(mockRepository.createTask).toHaveBeenCalled();
    });

    it('should retry from specific stage', async () => {
      mockRepository.findById.mockResolvedValue({
        id: 'test-id',
        status: WORKFLOW_STATUS.FAILED,
        current_stage: AGENT_TYPES.DEPLOYMENT
      });

      await workflowService.retryWorkflow('test-id', AGENT_TYPES.VALIDATION);

      expect(mockRepository.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          workflow_id: 'test-id'
        })
      );
    });
  });
});