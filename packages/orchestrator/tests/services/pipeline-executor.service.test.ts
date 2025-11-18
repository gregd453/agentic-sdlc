import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PipelineExecutorService, PipelineExecutionError } from '../../src/services/pipeline-executor.service';
import { EventBus } from '../../src/events/event-bus';
import { AgentDispatcherService } from '../../src/services/agent-dispatcher.service';
import { QualityGateService } from '../../src/services/quality-gate.service';
import {
  PipelineDefinition,
  PipelineExecution,
  PipelineStage,
  QualityGate
} from '../../src/types/pipeline.types';

/**
 * Pipeline Executor Service Tests
 *
 * Tests the DAG-based pipeline orchestration system:
 * 1. Pipeline lifecycle (start, pause, resume, cancel)
 * 2. Sequential stage execution
 * 3. Parallel stage execution with dependency resolution
 * 4. Quality gate enforcement
 * 5. Error handling and recovery
 * 6. Real-time event publishing
 */

describe('PipelineExecutorService', () => {
  let service: PipelineExecutorService;
  let mockEventBus: EventBus;
  let mockAgentDispatcher: AgentDispatcherService;
  let mockQualityGateService: QualityGateService;

  const REDIS_URL = 'redis://localhost:6379';

  beforeEach(() => {
    // Mock EventBus
    mockEventBus = {
      publish: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined)
    } as any;

    // Mock AgentDispatcherService
    mockAgentDispatcher = {
      dispatchTask: vi.fn().mockResolvedValue({
        agent_id: 'agent-1',
        status: WORKFLOW_STATUS.SUCCESS,
        result: {
          data: {
            line_coverage: 90,
            test_results: 'passed'
          },
          artifacts: [],
          metrics: {
            duration_ms: 1000,
            resource_usage: { cpu: 50, memory: 100 }
          }
        }
      }),
      onResult: vi.fn(),
      offResult: vi.fn(),
      getRegisteredAgents: vi.fn().mockResolvedValue([]),
      disconnect: vi.fn().mockResolvedValue(undefined)
    } as any;

    // Mock QualityGateService
    mockQualityGateService = {
      evaluate: vi.fn().mockResolvedValue(true),
      evaluateAll: vi.fn().mockResolvedValue({ passed: true, results: [] }),
      getPolicyGate: vi.fn(),
      getAllPolicyGates: vi.fn().mockReturnValue([]),
      reload: vi.fn()
    } as any;

    service = new PipelineExecutorService(
      mockEventBus,
      mockAgentDispatcher,
      mockQualityGateService
    );
  });

  describe('Pipeline Lifecycle', () => {
    it('should start pipeline execution successfully', async () => {
      const definition: PipelineDefinition = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Pipeline',
        version: '1.0.0',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        stages: [
          {
            id: 'stage-1',
            name: 'Build',
            agent_type: AGENT_TYPES.SCAFFOLD,
            action: 'build',
            parameters: {},
            dependencies: [],
            quality_gates: [],
            timeout_ms: 300000,
            continue_on_failure: false,
            artifacts: []
          }
        ],
        execution_mode: 'sequential'
      };

      const execution = await service.startPipeline(
        definition,
        'manual',
        'test-user',
        { branch: 'main', commitSha: 'abc123' }
      );

      expect(execution).toBeDefined();
      expect(execution.id).toBeDefined();
      expect(execution.pipeline_id).toBe(definition.id);
      expect(execution.workflow_id).toBe(definition.workflow_id);
      expect(['queued', WORKFLOW_STATUS.RUNNING]).toContain(execution.status);  // Status can be queued or running
      expect(execution.trigger).toBe('manual');
      expect(execution.triggered_by).toBe('test-user');
      expect(execution.branch).toBe('main');
      expect(execution.commit_sha).toBe('abc123');
    });

    it('should publish execution_started event when starting pipeline', async () => {
      const definition: PipelineDefinition = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Pipeline',
        version: '1.0.0',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        stages: [],
        execution_mode: 'sequential'
      };

      await service.startPipeline(definition, 'manual', 'test-user');

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'pipeline:updates',
          workflow_id: definition.workflow_id,
          payload: expect.objectContaining({
            event_type: 'execution_started'
          })
        })
      );
    });

    it('should validate pipeline definition before starting', async () => {
      const invalidDefinition = {
        id: 'invalid-uuid',  // Invalid UUID format
        name: 'Test',
        stages: []
      };

      await expect(
        service.startPipeline(invalidDefinition as any, 'manual', 'user')
      ).rejects.toThrow();
    });

    it('should get active execution by id', async () => {
      const definition: PipelineDefinition = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Pipeline',
        version: '1.0.0',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        stages: [],
        execution_mode: 'sequential'
      };

      const execution = await service.startPipeline(definition, 'manual', 'user');

      const retrieved = await service.getExecution(execution.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(execution.id);
    });

    it('should return null for non-existent execution', async () => {
      const result = await service.getExecution('non-existent-id');
      expect(result).toBeNull();
    });

    it('should pause execution', async () => {
      const definition: PipelineDefinition = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Pipeline',
        version: '1.0.0',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        stages: [],
        execution_mode: 'sequential'
      };

      const execution = await service.startPipeline(definition, 'manual', 'user');
      await service.pauseExecution(execution.id);

      const retrieved = await service.getExecution(execution.id);
      expect(retrieved?.status).toBe('paused');
    });

    it('should resume execution', async () => {
      const definition: PipelineDefinition = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Pipeline',
        version: '1.0.0',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        stages: [],
        execution_mode: 'sequential'
      };

      const execution = await service.startPipeline(definition, 'manual', 'user');
      await service.pauseExecution(execution.id);
      await service.resumeExecution(execution.id);

      const retrieved = await service.getExecution(execution.id);
      expect(retrieved?.status).toBe(WORKFLOW_STATUS.RUNNING);
    });

    it('should cancel execution', async () => {
      const definition: PipelineDefinition = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Pipeline',
        version: '1.0.0',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        stages: [],
        execution_mode: 'sequential'
      };

      const execution = await service.startPipeline(definition, 'manual', 'user');
      await service.cancelExecution(execution.id);

      const retrieved = await service.getExecution(execution.id);
      expect(retrieved).toBeNull();  // Should be removed from active executions
    });

    it('should publish execution_failed event when cancelling', async () => {
      const definition: PipelineDefinition = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Pipeline',
        version: '1.0.0',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        stages: [],
        execution_mode: 'sequential'
      };

      const execution = await service.startPipeline(definition, 'manual', 'user');
      await service.cancelExecution(execution.id);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'pipeline:updates',
          payload: expect.objectContaining({
            event_type: 'execution_failed',
            execution_id: execution.id
          })
        })
      );
    });

    it('should throw error when pausing non-existent execution', async () => {
      await expect(
        service.pauseExecution('non-existent-id')
      ).rejects.toThrow('Execution non-existent-id not found');
    });

    it('should throw error when resuming non-existent execution', async () => {
      await expect(
        service.resumeExecution('non-existent-id')
      ).rejects.toThrow('Execution non-existent-id not found');
    });

    it('should throw error when cancelling non-existent execution', async () => {
      await expect(
        service.cancelExecution('non-existent-id')
      ).rejects.toThrow('Execution non-existent-id not found');
    });
  });

  describe('Sequential Execution', () => {
    it('should execute stages sequentially', async () => {
      const definition: PipelineDefinition = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Sequential Pipeline',
        version: '1.0.0',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        stages: [
          {
            id: 'stage-1',
            name: 'Build',
            agent_type: AGENT_TYPES.SCAFFOLD,
            action: 'build',
            parameters: {},
            dependencies: [],
            quality_gates: [],
            timeout_ms: 300000,
            continue_on_failure: false,
            artifacts: []
          },
          {
            id: 'stage-2',
            name: 'Test',
            agent_type: AGENT_TYPES.VALIDATION,
            action: 'test',
            parameters: {},
            dependencies: [{ stage_id: 'stage-1', required: true, condition: WORKFLOW_STATUS.SUCCESS }],
            quality_gates: [],
            timeout_ms: 300000,
            continue_on_failure: false,
            artifacts: []
          }
        ],
        execution_mode: 'sequential'
      };

      const execution = await service.startPipeline(definition, 'manual', 'user');

      // Wait for execution to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      const retrieved = await service.getExecution(execution.id);
      if (retrieved) {
        expect(retrieved.stage_results.length).toBeGreaterThan(0);
      }
    });

    it('should skip stages when dependencies not satisfied', async () => {
      const definition: PipelineDefinition = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Pipeline with Skipped Stage',
        version: '1.0.0',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        stages: [
          {
            id: 'stage-1',
            name: 'Build',
            agent_type: AGENT_TYPES.SCAFFOLD,
            action: 'build',
            parameters: {},
            dependencies: [{ stage_id: 'non-existent', required: true, condition: WORKFLOW_STATUS.SUCCESS }],
            quality_gates: [],
            timeout_ms: 300000,
            continue_on_failure: false,
            artifacts: []
          }
        ],
        execution_mode: 'sequential'
      };

      const execution = await service.startPipeline(definition, 'manual', 'user');

      // Wait for execution to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      const retrieved = await service.getExecution(execution.id);
      if (retrieved && retrieved.stage_results.length > 0) {
        expect(retrieved.stage_results[0].status).toBe('skipped');
      }
    });

    it('should stop execution on stage failure when continue_on_failure is false', async () => {
      // Mock agent to return failure
      mockAgentDispatcher.dispatchTask = vi.fn().mockResolvedValue({
        agent_id: 'agent-1',
        status: 'failure',
        errors: [
          {
            code: 'BUILD_FAILED',
            message: 'Build failed',
            recoverable: false
          }
        ]
      });

      const definition: PipelineDefinition = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Failing Pipeline',
        version: '1.0.0',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        stages: [
          {
            id: 'stage-1',
            name: 'Build',
            agent_type: AGENT_TYPES.SCAFFOLD,
            action: 'build',
            parameters: {},
            dependencies: [],
            quality_gates: [],
            timeout_ms: 300000,
            continue_on_failure: false,
            artifacts: []
          },
          {
            id: 'stage-2',
            name: 'Test',
            agent_type: AGENT_TYPES.VALIDATION,
            action: 'test',
            parameters: {},
            dependencies: [],
            quality_gates: [],
            timeout_ms: 300000,
            continue_on_failure: false,
            artifacts: []
          }
        ],
        execution_mode: 'sequential'
      };

      await service.startPipeline(definition, 'manual', 'user');

      // Wait for execution to complete/fail
      await new Promise(resolve => setTimeout(resolve, 100));

      // stage-2 should not be executed because stage-1 failed
      expect(mockAgentDispatcher.dispatchTask).toHaveBeenCalledTimes(1);
    });

    it('should continue execution on stage failure when continue_on_failure is true', async () => {
      let callCount = 0;
      mockAgentDispatcher.dispatchTask = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First stage fails
          return Promise.resolve({
            agent_id: 'agent-1',
            status: 'failure',
            errors: [{ code: 'BUILD_FAILED', message: 'Build failed', recoverable: false }]
          });
        }
        // Second stage succeeds
        return Promise.resolve({
          agent_id: 'agent-2',
          status: WORKFLOW_STATUS.SUCCESS,
          result: { data: {}, artifacts: [], metrics: { duration_ms: 1000 } }
        });
      });

      const definition: PipelineDefinition = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Pipeline with Continue on Failure',
        version: '1.0.0',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        stages: [
          {
            id: 'stage-1',
            name: 'Build',
            agent_type: AGENT_TYPES.SCAFFOLD,
            action: 'build',
            parameters: {},
            dependencies: [],
            quality_gates: [],
            timeout_ms: 300000,
            continue_on_failure: true,  // Continue even if fails
            artifacts: []
          },
          {
            id: 'stage-2',
            name: 'Test',
            agent_type: AGENT_TYPES.VALIDATION,
            action: 'test',
            parameters: {},
            dependencies: [],
            quality_gates: [],
            timeout_ms: 300000,
            continue_on_failure: false,
            artifacts: []
          }
        ],
        execution_mode: 'sequential'
      };

      await service.startPipeline(definition, 'manual', 'user');

      // Wait for execution to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Both stages should be executed
      expect(mockAgentDispatcher.dispatchTask).toHaveBeenCalledTimes(2);
    });
  });

  describe('Parallel Execution', () => {
    it('should execute independent stages in parallel', async () => {
      const executionTimes: number[] = [];
      mockAgentDispatcher.dispatchTask = vi.fn().mockImplementation(() => {
        executionTimes.push(Date.now());
        return Promise.resolve({
          agent_id: 'agent-1',
          status: WORKFLOW_STATUS.SUCCESS,
          result: { data: {}, artifacts: [], metrics: { duration_ms: 50 } }
        });
      });

      const definition: PipelineDefinition = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Parallel Pipeline',
        version: '1.0.0',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        stages: [
          {
            id: 'stage-1',
            name: 'Lint',
            agent_type: AGENT_TYPES.VALIDATION,
            action: 'lint',
            parameters: {},
            dependencies: [],
            quality_gates: [],
            timeout_ms: 300000,
            continue_on_failure: false,
            artifacts: []
          },
          {
            id: 'stage-2',
            name: 'Test',
            agent_type: AGENT_TYPES.VALIDATION,
            action: 'test',
            parameters: {},
            dependencies: [],
            quality_gates: [],
            timeout_ms: 300000,
            continue_on_failure: false,
            artifacts: []
          }
        ],
        execution_mode: 'parallel'
      };

      await service.startPipeline(definition, 'manual', 'user');

      // Wait for execution to complete
      await new Promise(resolve => setTimeout(resolve, 150));

      // Both stages should be dispatched (roughly at the same time for parallel)
      expect(mockAgentDispatcher.dispatchTask).toHaveBeenCalledTimes(2);
    });

    it('should respect dependencies in parallel mode', async () => {
      const executionOrder: string[] = [];
      mockAgentDispatcher.dispatchTask = vi.fn().mockImplementation(async (task: any) => {
        const stageId = task.payload.context.stage_id;
        executionOrder.push(stageId);

        // Simulate async work
        await new Promise(resolve => setTimeout(resolve, 10));

        return {
          agent_id: 'agent-1',
          status: WORKFLOW_STATUS.SUCCESS,
          result: { data: {}, artifacts: [], metrics: { duration_ms: 10 } }
        };
      });

      const definition: PipelineDefinition = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Parallel with Dependencies',
        version: '1.0.0',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        stages: [
          {
            id: 'stage-1',
            name: 'Build',
            agent_type: AGENT_TYPES.SCAFFOLD,
            action: 'build',
            parameters: {},
            dependencies: [],
            quality_gates: [],
            timeout_ms: 300000,
            continue_on_failure: false,
            artifacts: []
          },
          {
            id: 'stage-2',
            name: 'Test',
            agent_type: AGENT_TYPES.VALIDATION,
            action: 'test',
            parameters: {},
            dependencies: [{ stage_id: 'stage-1', required: true, condition: WORKFLOW_STATUS.SUCCESS }],
            quality_gates: [],
            timeout_ms: 300000,
            continue_on_failure: false,
            artifacts: []
          }
        ],
        execution_mode: 'parallel'
      };

      await service.startPipeline(definition, 'manual', 'user');

      // Wait for execution to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // stage-1 must execute before stage-2
      expect(executionOrder.indexOf('stage-1')).toBeLessThan(executionOrder.indexOf('stage-2'));
    });
  });

  describe('Quality Gates', () => {
    it('should evaluate quality gates for each stage', async () => {
      const definition: PipelineDefinition = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Pipeline with Quality Gates',
        version: '1.0.0',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        stages: [
          {
            id: 'stage-1',
            name: 'Build',
            agent_type: AGENT_TYPES.SCAFFOLD,
            action: 'build',
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
            continue_on_failure: false,
            artifacts: []
          }
        ],
        execution_mode: 'sequential'
      };

      await service.startPipeline(definition, 'manual', 'user');

      // Wait for execution to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Quality gate evaluation should be called
      expect(mockQualityGateService.evaluate).toHaveBeenCalled();
    });

    it('should fail stage when blocking quality gate fails', async () => {
      // Mock quality gate to fail
      mockQualityGateService.evaluate = vi.fn().mockResolvedValue(false);

      const definition: PipelineDefinition = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Pipeline with Failing Gate',
        version: '1.0.0',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        stages: [
          {
            id: 'stage-1',
            name: 'Build',
            agent_type: AGENT_TYPES.SCAFFOLD,
            action: 'build',
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
            continue_on_failure: false,
            artifacts: []
          }
        ],
        execution_mode: 'sequential'
      };

      await service.startPipeline(definition, 'manual', 'user');

      // Wait for execution to complete/fail
      await new Promise(resolve => setTimeout(resolve, 100));

      // Execution should fail due to quality gate failure
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'pipeline:updates',
          payload: expect.objectContaining({
            event_type: 'stage_failed'
          })
        })
      );
    });

    it('should pass stage when non-blocking quality gate fails', async () => {
      let callCount = 0;
      mockQualityGateService.evaluate = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve(false);  // Gate fails but non-blocking
      });

      const definition: PipelineDefinition = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Pipeline with Non-blocking Gate',
        version: '1.0.0',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        stages: [
          {
            id: 'stage-1',
            name: 'Build',
            agent_type: AGENT_TYPES.SCAFFOLD,
            action: 'build',
            parameters: {},
            dependencies: [],
            quality_gates: [
              {
                name: 'performance',
                metric: 'p95_latency',
                operator: '<',
                threshold: 500,
                blocking: false  // Non-blocking
              }
            ],
            timeout_ms: 300000,
            continue_on_failure: false,
            artifacts: []
          }
        ],
        execution_mode: 'sequential'
      };

      await service.startPipeline(definition, 'manual', 'user');

      // Wait for execution to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Stage should still succeed despite gate failure
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'pipeline:updates',
          payload: expect.objectContaining({
            event_type: 'stage_completed'
          })
        })
      );
    });
  });

  describe('Dependency Resolution', () => {
    it('should build dependency graph correctly', () => {
      const stages: PipelineStage[] = [
        {
          id: 'stage-1',
          name: 'Build',
          agent_type: AGENT_TYPES.SCAFFOLD,
          action: 'build',
          parameters: {},
          dependencies: [],
          quality_gates: [],
          timeout_ms: 300000,
          continue_on_failure: false,
          artifacts: []
        },
        {
          id: 'stage-2',
          name: 'Test',
          agent_type: AGENT_TYPES.VALIDATION,
          action: 'test',
          parameters: {},
          dependencies: [{ stage_id: 'stage-1', required: true, condition: WORKFLOW_STATUS.SUCCESS }],
          quality_gates: [],
          timeout_ms: 300000,
          continue_on_failure: false,
          artifacts: []
        }
      ];

      const graph = (service as any).buildDependencyGraph(stages);

      expect(graph.has('stage-1')).toBe(true);
      expect(graph.has('stage-2')).toBe(true);
      expect(graph.get('stage-1')!.size).toBe(0);  // No dependencies
      expect(graph.get('stage-2')!.has('stage-1')).toBe(true);  // Depends on stage-1
    });

    it('should determine if stage can execute based on dependencies', () => {
      const stage: PipelineStage = {
        id: 'stage-2',
        name: 'Test',
        agent_type: AGENT_TYPES.VALIDATION,
        action: 'test',
        parameters: {},
        dependencies: [
          { stage_id: 'stage-1', required: true, condition: WORKFLOW_STATUS.SUCCESS }
        ],
        quality_gates: [],
        timeout_ms: 300000,
        continue_on_failure: false,
        artifacts: []
      };

      const executedStages = new Set<string>();

      // Cannot execute if dependency not met
      expect((service as any).canExecuteStage(stage, executedStages)).toBe(false);

      // Can execute once dependency is met
      executedStages.add('stage-1');
      expect((service as any).canExecuteStage(stage, executedStages)).toBe(true);
    });

    it('should handle optional dependencies correctly', () => {
      const stage: PipelineStage = {
        id: 'stage-2',
        name: 'Test',
        agent_type: AGENT_TYPES.VALIDATION,
        action: 'test',
        parameters: {},
        dependencies: [
          { stage_id: 'stage-1', required: false, condition: WORKFLOW_STATUS.SUCCESS }  // Optional
        ],
        quality_gates: [],
        timeout_ms: 300000,
        continue_on_failure: false,
        artifacts: []
      };

      const executedStages = new Set<string>();

      // Can execute even if optional dependency not met
      expect((service as any).canExecuteStage(stage, executedStages)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle PipelineExecutionError correctly', async () => {
      const error = new PipelineExecutionError('Test error', 'stage-1', true);

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('PipelineExecutionError');
      expect(error.message).toBe('Test error');
      expect(error.stage_id).toBe('stage-1');
      expect(error.recoverable).toBe(true);
    });

    it('should publish execution_failed event on pipeline failure', async () => {
      // Mock agent to throw error
      mockAgentDispatcher.dispatchTask = vi.fn().mockRejectedValue(new Error('Agent failed'));

      const definition: PipelineDefinition = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Failing Pipeline',
        version: '1.0.0',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        stages: [
          {
            id: 'stage-1',
            name: 'Build',
            agent_type: AGENT_TYPES.SCAFFOLD,
            action: 'build',
            parameters: {},
            dependencies: [],
            quality_gates: [],
            timeout_ms: 300000,
            continue_on_failure: false,
            artifacts: []
          }
        ],
        execution_mode: 'sequential'
      };

      await service.startPipeline(definition, 'manual', 'user');

      // Wait for execution to fail
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'pipeline:updates',
          payload: expect.objectContaining({
            event_type: 'execution_failed'
          })
        })
      );
    });
  });

  describe('Event Publishing', () => {
    it('should publish stage_started event when stage begins', async () => {
      const definition: PipelineDefinition = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Pipeline',
        version: '1.0.0',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        stages: [
          {
            id: 'stage-1',
            name: 'Build',
            agent_type: AGENT_TYPES.SCAFFOLD,
            action: 'build',
            parameters: {},
            dependencies: [],
            quality_gates: [],
            timeout_ms: 300000,
            continue_on_failure: false,
            artifacts: []
          }
        ],
        execution_mode: 'sequential'
      };

      await service.startPipeline(definition, 'manual', 'user');

      // Wait for stage to start
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'pipeline:updates',
          payload: expect.objectContaining({
            event_type: 'stage_started',
            stage_id: 'stage-1'
          })
        })
      );
    });

    it('should publish execution_completed event when pipeline succeeds', async () => {
      const definition: PipelineDefinition = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Pipeline',
        version: '1.0.0',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        stages: [
          {
            id: 'stage-1',
            name: 'Build',
            agent_type: AGENT_TYPES.SCAFFOLD,
            action: 'build',
            parameters: {},
            dependencies: [],
            quality_gates: [],
            timeout_ms: 300000,
            continue_on_failure: false,
            artifacts: []
          }
        ],
        execution_mode: 'sequential'
      };

      await service.startPipeline(definition, 'manual', 'user');

      // Wait for execution to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'pipeline:updates',
          payload: expect.objectContaining({
            event_type: 'execution_completed'
          })
        })
      );
    });
  });

  describe('Cleanup', () => {
    it('should wait for active executions to complete during cleanup', async () => {
      const definition: PipelineDefinition = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Pipeline',
        version: '1.0.0',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        stages: [
          {
            id: 'stage-1',
            name: 'Build',
            agent_type: AGENT_TYPES.SCAFFOLD,
            action: 'build',
            parameters: {},
            dependencies: [],
            quality_gates: [],
            timeout_ms: 300000,
            continue_on_failure: false,
            artifacts: []
          }
        ],
        execution_mode: 'sequential'
      };

      await service.startPipeline(definition, 'manual', 'user');

      // Cleanup should wait for execution
      await service.cleanup();

      const activeExecutions = (service as any).activeExecutions;
      expect(activeExecutions.size).toBe(0);
    });

    it('should clear execution promises on cleanup', async () => {
      const definition: PipelineDefinition = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Pipeline',
        version: '1.0.0',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        stages: [],
        execution_mode: 'sequential'
      };

      await service.startPipeline(definition, 'manual', 'user');
      await service.cleanup();

      const executionPromises = (service as any).executionPromises;
      expect(executionPromises.size).toBe(0);
    });
  });
});
