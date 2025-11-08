import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PipelineExecutorService } from '../../services/pipeline-executor.service';
import { EventBus } from '../../events/event-bus';
import { AgentDispatcherService } from '../../services/agent-dispatcher.service';
import { QualityGateService } from '../../services/quality-gate.service';
import { PipelineDefinition } from '../../types/pipeline.types';

describe('PipelineExecutorService', () => {
  let executor: PipelineExecutorService;
  let eventBus: EventBus;
  let agentDispatcher: AgentDispatcherService;
  let qualityGateService: QualityGateService;

  beforeEach(() => {
    // Create mocks
    eventBus = {
      publish: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn()
    } as any;

    agentDispatcher = {
      dispatchTask: vi.fn().mockResolvedValue({
        agent_id: 'agent-1',
        status: 'success',
        result: {
          data: {
            line_coverage: 90,
            critical_vulns: 0
          },
          artifacts: [],
          metrics: {
            duration_ms: 1000
          }
        },
        errors: []
      })
    } as any;

    qualityGateService = new QualityGateService();

    executor = new PipelineExecutorService(
      eventBus,
      agentDispatcher,
      qualityGateService
    );
  });

  afterEach(async () => {
    await executor.cleanup();
  });

  describe('startPipeline', () => {
    it('should start pipeline execution successfully', async () => {
      const definition: PipelineDefinition = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Pipeline',
        version: '1.0.0',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        stages: [
          {
            id: 'build',
            name: 'Build',
            agent_type: 'scaffold',
            action: 'build',
            parameters: {},
            dependencies: [],
            quality_gates: [],
            timeout_ms: 300000,
            artifacts: [],
            continue_on_failure: false
          }
        ],
        execution_mode: 'sequential'
      };

      const execution = await executor.startPipeline(
        definition,
        'manual',
        'test-user'
      );

      expect(execution.id).toBeDefined();
      expect(execution.pipeline_id).toBe(definition.id);
      expect(execution.workflow_id).toBe(definition.workflow_id);
      expect(execution.status).toBe('queued');
      expect(execution.trigger).toBe('manual');
      expect(execution.triggered_by).toBe('test-user');

      // Wait a bit for async execution to start
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify event was published
      expect(eventBus.publish).toHaveBeenCalledWith(
        'pipeline:updates',
        expect.objectContaining({
          type: 'execution_started',
          execution_id: execution.id
        })
      );
    });

    it('should include commit info when provided', async () => {
      const definition: PipelineDefinition = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Pipeline',
        version: '1.0.0',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        stages: [],
        execution_mode: 'sequential'
      };

      const execution = await executor.startPipeline(
        definition,
        'webhook',
        'github',
        {
          commitSha: 'abc123',
          branch: 'main',
          metadata: { repository: 'test/repo' }
        }
      );

      expect(execution.commit_sha).toBe('abc123');
      expect(execution.branch).toBe('main');
      expect(execution.metadata).toEqual({ repository: 'test/repo' });
    });

    it('should handle invalid pipeline definition', async () => {
      const invalidDefinition = {
        name: 'Invalid',
        stages: []
      } as any;

      await expect(
        executor.startPipeline(invalidDefinition, 'manual', 'test-user')
      ).rejects.toThrow();
    });
  });

  describe('stage execution', () => {
    it('should execute single stage successfully', async () => {
      const definition: PipelineDefinition = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Pipeline',
        version: '1.0.0',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        stages: [
          {
            id: 'test-stage',
            name: 'Test Stage',
            agent_type: 'validation',
            action: 'test',
            parameters: { test_type: 'unit' },
            dependencies: [],
            quality_gates: [],
            timeout_ms: 300000,
            artifacts: [],
            continue_on_failure: false
          }
        ],
        execution_mode: 'sequential'
      };

      await executor.startPipeline(
        definition,
        'manual',
        'test-user'
      );

      // Wait for execution to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify agent was called
      expect(agentDispatcher.dispatchTask).toHaveBeenCalledWith(
        expect.objectContaining({
          agent_type: 'validation',
          payload: expect.objectContaining({
            action: 'test',
            parameters: { test_type: 'unit' }
          })
        })
      );
    });

    it('should enforce quality gates', async () => {
      const definition: PipelineDefinition = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Pipeline',
        version: '1.0.0',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        stages: [
          {
            id: 'test-stage',
            name: 'Test Stage',
            agent_type: 'validation',
            action: 'test',
            parameters: {},
            dependencies: [],
            quality_gates: [
              {
                name: 'coverage',
                metric: 'line_coverage',
                operator: '>=',
                threshold: 80,
                blocking: true
              }
            ],
            timeout_ms: 300000,
            artifacts: [],
            continue_on_failure: false
          }
        ],
        execution_mode: 'sequential'
      };

      const execution = await executor.startPipeline(
        definition,
        'manual',
        'test-user'
      );

      // Wait for execution to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      const currentExecution = await executor.getExecution(execution.id);

      // Stage should pass since mock returns 90% coverage
      expect(currentExecution?.stage_results).toHaveLength(1);
      expect(currentExecution?.stage_results[0].status).toBe('success');
      expect(currentExecution?.stage_results[0].quality_gate_results).toHaveLength(1);
      expect(currentExecution?.stage_results[0].quality_gate_results[0].passed).toBe(true);
    });

    it('should fail stage when blocking quality gate fails', async () => {
      // Mock agent to return low coverage
      vi.mocked(agentDispatcher.dispatchTask).mockResolvedValueOnce({
        agent_id: 'agent-1',
        status: 'success',
        result: {
          data: {
            line_coverage: 50 // Below threshold
          },
          artifacts: [],
          metrics: {
            duration_ms: 1000
          }
        },
        errors: []
      } as any);

      const definition: PipelineDefinition = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Pipeline',
        version: '1.0.0',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        stages: [
          {
            id: 'test-stage',
            name: 'Test Stage',
            agent_type: 'validation',
            action: 'test',
            parameters: {},
            dependencies: [],
            quality_gates: [
              {
                name: 'coverage',
                metric: 'line_coverage',
                operator: '>=',
                threshold: 80,
                blocking: true
              }
            ],
            timeout_ms: 300000,
            artifacts: [],
            continue_on_failure: false
          }
        ],
        execution_mode: 'sequential'
      };

      const execution = await executor.startPipeline(
        definition,
        'manual',
        'test-user'
      );

      // Wait for execution to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      const currentExecution = await executor.getExecution(execution.id);

      // Stage should fail
      expect(currentExecution?.stage_results[0].status).toBe('failed');
      expect(currentExecution?.stage_results[0].error?.code).toBe('QUALITY_GATE_FAILED');
    });

    it('should execute stages with dependencies in order', async () => {
      const definition: PipelineDefinition = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Pipeline',
        version: '1.0.0',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        stages: [
          {
            id: 'build',
            name: 'Build',
            agent_type: 'scaffold',
            action: 'build',
            parameters: {},
            dependencies: [],
            quality_gates: [],
            timeout_ms: 300000,
            artifacts: [],
            continue_on_failure: false
          },
          {
            id: 'test',
            name: 'Test',
            agent_type: 'validation',
            action: 'test',
            parameters: {},
            dependencies: [
              { stage_id: 'build', required: true, condition: 'success' }
            ],
            quality_gates: [],
            timeout_ms: 300000,
            artifacts: [],
            continue_on_failure: false
          }
        ],
        execution_mode: 'sequential'
      };

      await executor.startPipeline(
        definition,
        'manual',
        'test-user'
      );

      // Wait for execution to complete
      await new Promise(resolve => setTimeout(resolve, 300));

      // Both stages should execute
      expect(agentDispatcher.dispatchTask).toHaveBeenCalledTimes(2);
    });
  });

  describe('getExecution', () => {
    it('should return execution by ID', async () => {
      const definition: PipelineDefinition = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Pipeline',
        version: '1.0.0',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        stages: [],
        execution_mode: 'sequential'
      };

      const execution = await executor.startPipeline(
        definition,
        'manual',
        'test-user'
      );

      const retrieved = await executor.getExecution(execution.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(execution.id);
    });

    it('should return null for unknown execution', async () => {
      const retrieved = await executor.getExecution('unknown-id');

      expect(retrieved).toBeNull();
    });
  });

  describe('pipeline control', () => {
    it('should pause pipeline execution', async () => {
      const definition: PipelineDefinition = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Pipeline',
        version: '1.0.0',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        stages: [],
        execution_mode: 'sequential'
      };

      const execution = await executor.startPipeline(
        definition,
        'manual',
        'test-user'
      );

      await executor.pauseExecution(execution.id);

      const retrieved = await executor.getExecution(execution.id);
      expect(retrieved?.status).toBe('paused');
    });

    it('should resume pipeline execution', async () => {
      const definition: PipelineDefinition = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Pipeline',
        version: '1.0.0',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        stages: [],
        execution_mode: 'sequential'
      };

      const execution = await executor.startPipeline(
        definition,
        'manual',
        'test-user'
      );

      await executor.pauseExecution(execution.id);
      await executor.resumeExecution(execution.id);

      const retrieved = await executor.getExecution(execution.id);
      expect(retrieved?.status).toBe('running');
    });

    it('should cancel pipeline execution', async () => {
      const definition: PipelineDefinition = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Pipeline',
        version: '1.0.0',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        stages: [],
        execution_mode: 'sequential'
      };

      const execution = await executor.startPipeline(
        definition,
        'manual',
        'test-user'
      );

      await executor.cancelExecution(execution.id);

      const retrieved = await executor.getExecution(execution.id);
      expect(retrieved).toBeNull(); // Removed after cancellation
    });

    it('should throw error for unknown execution', async () => {
      await expect(
        executor.pauseExecution('unknown-id')
      ).rejects.toThrow('Execution unknown-id not found');
    });
  });
});
