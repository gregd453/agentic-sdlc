import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkflowRepository } from '../../src/repositories/workflow.repository';
import { NotFoundError } from '../../src/utils/errors';

describe('WorkflowRepository', () => {
  let repository: WorkflowRepository;
  let mockPrisma: any;

  beforeEach(() => {
    // Create mock Prisma client
    mockPrisma = {
      $transaction: vi.fn().mockImplementation((cb) => cb(mockPrisma)),
      workflow: {
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
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue({}),
        delete: vi.fn().mockResolvedValue({})
      },
      workflowEvent: {
        create: vi.fn().mockResolvedValue({
          id: 'event-id',
          workflow_id: 'test-workflow-id',
          event_type: 'WORKFLOW_CREATED',
          timestamp: new Date()
        })
      },
      workflowStage: {
        createMany: vi.fn().mockResolvedValue({ count: 7 }),
        findFirst: vi.fn().mockResolvedValue({
          id: 'stage-id',
          workflow_id: 'test-workflow-id',
          name: 'initialization',
          status: TASK_STATUS.PENDING
        }),
        update: vi.fn().mockResolvedValue({})
      },
      agentTask: {
        create: vi.fn().mockResolvedValue({
          id: 'task-id',
          task_id: 'test-task-id',
          workflow_id: 'test-workflow-id',
          status: TASK_STATUS.PENDING
        }),
        update: vi.fn().mockResolvedValue({}),
        findMany: vi.fn().mockResolvedValue([])
      }
    };

    repository = new WorkflowRepository(mockPrisma);
  });

  describe('create', () => {
    it('should create workflow with stages and event', async () => {
      const data = {
        type: WORKFLOW_TYPES.APP as const,
        name: 'Test App',
        description: 'Test Description',
        requirements: 'Test Requirements',
        priority: 'normal' as const,
        created_by: 'test-user'
      };

      const result = await repository.create(data);

      expect(result).toBeDefined();
      expect(result.id).toBe('test-workflow-id');

      // Verify workflow was created
      expect(mockPrisma.workflow.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: WORKFLOW_TYPES.APP,
          name: 'Test App',
          status: WORKFLOW_STATUS.INITIATED,
          current_stage: 'initialization'
        })
      });

      // Verify event was created
      expect(mockPrisma.workflowEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workflow_id: 'test-workflow-id',
          event_type: 'WORKFLOW_CREATED'
        })
      });

      // Verify stages were created
      expect(mockPrisma.workflowStage.createMany).toHaveBeenCalled();
    });

    it('should create appropriate stages for workflow type', async () => {
      const data = {
        type: WORKFLOW_TYPES.FEATURE as const,
        name: 'Test Feature',
        priority: TASK_PRIORITY.HIGH as const,
        created_by: 'test-user'
      };

      await repository.create(data);

      expect(mockPrisma.workflowStage.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ name: 'initialization' }),
          expect.objectContaining({ name: 'implementation' }),
          expect.objectContaining({ name: AGENT_TYPES.VALIDATION }),
          expect.objectContaining({ name: 'testing' }),
          expect.objectContaining({ name: AGENT_TYPES.INTEGRATION }),
          expect.objectContaining({ name: AGENT_TYPES.DEPLOYMENT })
        ])
      });
    });
  });

  describe('findById', () => {
    it('should find workflow by ID with relations', async () => {
      const mockWorkflow = {
        id: 'test-id',
        status: WORKFLOW_STATUS.RUNNING,
        stages: [],
        events: [],
        tasks: []
      };

      mockPrisma.workflow.findUnique.mockResolvedValue(mockWorkflow);

      const result = await repository.findById('test-id');

      expect(result).toBe(mockWorkflow);
      expect(mockPrisma.workflow.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        include: {
          stages: expect.any(Object),
          events: expect.any(Object),
          tasks: expect.any(Object)
        }
      });
    });

    it('should return null when workflow not found', async () => {
      mockPrisma.workflow.findUnique.mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should find all workflows', async () => {
      const mockWorkflows = [
        { id: 'workflow-1', status: WORKFLOW_STATUS.RUNNING },
        { id: 'workflow-2', status: WORKFLOW_STATUS.COMPLETED }
      ];

      mockPrisma.workflow.findMany.mockResolvedValue(mockWorkflows);

      const result = await repository.findAll();

      expect(result).toEqual(mockWorkflows);
      expect(mockPrisma.workflow.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { created_at: 'desc' },
        include: { stages: true }
      });
    });

    it('should filter workflows by status', async () => {
      await repository.findAll({ status: WORKFLOW_STATUS.RUNNING });

      expect(mockPrisma.workflow.findMany).toHaveBeenCalledWith({
        where: { status: WORKFLOW_STATUS.RUNNING },
        orderBy: { created_at: 'desc' },
        include: { stages: true }
      });
    });

    it('should filter workflows by multiple criteria', async () => {
      await repository.findAll({
        status: WORKFLOW_STATUS.RUNNING,
        type: WORKFLOW_TYPES.APP,
        priority: TASK_PRIORITY.HIGH
      });

      expect(mockPrisma.workflow.findMany).toHaveBeenCalledWith({
        where: {
          status: WORKFLOW_STATUS.RUNNING,
          type: WORKFLOW_TYPES.APP,
          priority: TASK_PRIORITY.HIGH
        },
        orderBy: { created_at: 'desc' },
        include: { stages: true }
      });
    });
  });

  describe('update', () => {
    it('should update workflow when it exists', async () => {
      mockPrisma.workflow.findUnique.mockResolvedValue({
        id: 'test-id',
        status: WORKFLOW_STATUS.RUNNING,
        version: 1
      });

      const updates = {
        status: WORKFLOW_STATUS.COMPLETED,
        progress: 100,
        completed_at: new Date()
      };

      await repository.update('test-id', updates);

      expect(mockPrisma.workflow.update).toHaveBeenCalledWith({
        where: { id: 'test-id', version: 1 },
        data: {
          ...updates,
          version: { increment: 1 }
        }
      });
    });

    it('should throw NotFoundError when workflow does not exist', async () => {
      mockPrisma.workflow.findUnique.mockResolvedValue(null);

      await expect(repository.update('non-existent', {}))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('createTask', () => {
    it('should create an agent task', async () => {
      const task = {
        task_id: 'test-task-id',
        workflow_id: 'test-workflow-id',
        agent_type: AGENT_TYPES.SCAFFOLD as const,
        status: TASK_STATUS.PENDING as const,
        priority: 'normal' as const,
        payload: { test: 'data' },
        retry_count: 0,
        max_retries: 3,
        timeout_ms: 300000
      };

      const result = await repository.createTask(task);

      expect(result).toBeDefined();
      expect(mockPrisma.agentTask.create).toHaveBeenCalledWith({
        data: task
      });
    });
  });

  describe('updateTask', () => {
    it('should update an agent task', async () => {
      const updates = {
        status: WORKFLOW_STATUS.COMPLETED as const,
        completed_at: new Date()
      };

      await repository.updateTask('test-task-id', updates);

      expect(mockPrisma.agentTask.update).toHaveBeenCalledWith({
        where: { task_id: 'test-task-id' },
        data: updates
      });
    });
  });

  describe('getPendingTasks', () => {
    it('should get all pending tasks ordered by priority', async () => {
      const mockTasks = [
        { task_id: 'task-1', priority: TASK_PRIORITY.HIGH },
        { task_id: 'task-2', priority: 'normal' }
      ];

      mockPrisma.agentTask.findMany.mockResolvedValue(mockTasks);

      const result = await repository.getPendingTasks();

      expect(result).toEqual(mockTasks);
      expect(mockPrisma.agentTask.findMany).toHaveBeenCalledWith({
        where: { status: TASK_STATUS.PENDING },
        orderBy: [
          { priority: 'desc' },
          { assigned_at: 'asc' }
        ]
      });
    });

    it('should filter by agent type when specified', async () => {
      await repository.getPendingTasks(AGENT_TYPES.SCAFFOLD);

      expect(mockPrisma.agentTask.findMany).toHaveBeenCalledWith({
        where: {
          status: TASK_STATUS.PENDING,
          agent_type: AGENT_TYPES.SCAFFOLD
        },
        orderBy: [
          { priority: 'desc' },
          { assigned_at: 'asc' }
        ]
      });
    });
  });
});