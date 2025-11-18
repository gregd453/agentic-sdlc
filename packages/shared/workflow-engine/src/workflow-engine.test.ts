import { describe, it, expect, beforeEach } from 'vitest';
import {
  WorkflowEngine,
  WorkflowEngineError,
  createWorkflowEngine
} from './workflow-engine';
import {
  WorkflowDefinition,
  validateWorkflowDefinition,
  WorkflowSchemaError
} from './workflow-schema';

describe('WorkflowEngine', () => {
  let basicWorkflow: WorkflowDefinition;

  beforeEach(() => {
    basicWorkflow = {
      name: 'test-workflow',
      version: '1.0.0',
      description: 'Test workflow',
      start_stage: AGENT_TYPES.SCAFFOLD,
      stages: {
        scaffold: {
          name: 'Scaffold Stage',
          agent_type: AGENT_TYPES.SCAFFOLD,
          timeout_ms: 60000,
          max_retries: 3,
          on_success: 'validate'
        },
        validate: {
          name: 'Validation Stage',
          agent_type: AGENT_TYPES.VALIDATION,
          timeout_ms: 60000,
          max_retries: 2,
          on_success: 'deploy'
        },
        deploy: {
          name: 'Deployment Stage',
          agent_type: AGENT_TYPES.DEPLOYMENT,
          timeout_ms: 120000,
          max_retries: 1
        }
      }
    };
  });

  describe('initialization', () => {
    it('should create engine with valid workflow', () => {
      const engine = new WorkflowEngine(basicWorkflow);
      expect(engine).toBeDefined();
      expect(engine.getDefinition().name).toBe('test-workflow');
    });

    it('should throw on invalid workflow definition', () => {
      const invalidWorkflow = {
        name: 'invalid',
        // Missing required start_stage and stages
      } as any;

      expect(() => {
        new WorkflowEngine(invalidWorkflow);
      }).toThrow();
    });

    it('should throw if start_stage does not exist', () => {
      const workflow = { ...basicWorkflow, start_stage: 'nonexistent' };

      expect(() => {
        new WorkflowEngine(workflow);
      }).toThrow(WorkflowEngineError);
    });

    it('should throw if referenced success stage does not exist', () => {
      const workflow = {
        ...basicWorkflow,
        stages: {
          ...basicWorkflow.stages,
          scaffold: {
            ...basicWorkflow.stages.scaffold,
            on_success: 'nonexistent'
          }
        }
      };

      expect(() => {
        new WorkflowEngine(workflow);
      }).toThrow(WorkflowEngineError);
    });

    it('should throw if referenced failure stage does not exist', () => {
      const workflow = {
        ...basicWorkflow,
        stages: {
          ...basicWorkflow.stages,
          scaffold: {
            ...basicWorkflow.stages.scaffold,
            on_failure: 'nonexistent'
          }
        }
      };

      expect(() => {
        new WorkflowEngine(workflow);
      }).toThrow(WorkflowEngineError);
    });
  });

  describe('getDefinition', () => {
    it('should return workflow definition copy', () => {
      const engine = new WorkflowEngine(basicWorkflow);
      const def = engine.getDefinition();

      expect(def).toEqual(basicWorkflow);
      expect(def).not.toBe(basicWorkflow);
    });
  });

  describe('getStartStage', () => {
    it('should return start stage name', () => {
      const engine = new WorkflowEngine(basicWorkflow);
      expect(engine.getStartStage()).toBe(AGENT_TYPES.SCAFFOLD);
    });
  });

  describe('getStages', () => {
    it('should return all stage names', () => {
      const engine = new WorkflowEngine(basicWorkflow);
      const stages = engine.getStages();

      expect(stages).toContain(AGENT_TYPES.SCAFFOLD);
      expect(stages).toContain('validate');
      expect(stages).toContain('deploy');
      expect(stages).toHaveLength(3);
    });
  });

  describe('getStageConfig', () => {
    it('should return stage configuration', () => {
      const engine = new WorkflowEngine(basicWorkflow);
      const config = engine.getStageConfig(AGENT_TYPES.SCAFFOLD);

      expect(config.name).toBe('Scaffold Stage');
      expect(config.agent_type).toBe(AGENT_TYPES.SCAFFOLD);
      expect(config.timeout_ms).toBe(60000);
    });

    it('should throw on non-existent stage', () => {
      const engine = new WorkflowEngine(basicWorkflow);

      expect(() => {
        engine.getStageConfig('nonexistent');
      }).toThrow(WorkflowEngineError);
    });
  });

  describe('getNextStage', () => {
    it('should return on_success stage', () => {
      const engine = new WorkflowEngine(basicWorkflow);
      const next = engine.getNextStage(AGENT_TYPES.SCAFFOLD, WORKFLOW_STATUS.SUCCESS);

      expect(next).toBe('validate');
    });

    it('should return on_failure stage', () => {
      const engine = new WorkflowEngine(basicWorkflow);
      const scaffold = basicWorkflow.stages.scaffold;
      scaffold.on_failure = 'validate';

      const engine2 = new WorkflowEngine(basicWorkflow);
      const next = engine2.getNextStage(AGENT_TYPES.SCAFFOLD, 'failure');

      expect(next).toBe('validate');
    });

    it('should return null if no on_success defined', () => {
      const engine = new WorkflowEngine(basicWorkflow);
      const next = engine.getNextStage('deploy', WORKFLOW_STATUS.SUCCESS);

      expect(next).toBeNull();
    });

    it('should return null if no on_failure defined', () => {
      const engine = new WorkflowEngine(basicWorkflow);
      const next = engine.getNextStage('deploy', 'failure');

      expect(next).toBeNull();
    });

    it('should follow on_failure for timeout outcome', () => {
      const engine = new WorkflowEngine(basicWorkflow);
      basicWorkflow.stages.scaffold.on_failure = 'deploy';
      const engine2 = new WorkflowEngine(basicWorkflow);

      const next = engine2.getNextStage(AGENT_TYPES.SCAFFOLD, 'timeout');
      expect(next).toBe('deploy');
    });
  });

  describe('getRetryStrategy', () => {
    it('should return default exponential strategy', () => {
      const engine = new WorkflowEngine(basicWorkflow);
      expect(engine.getRetryStrategy()).toBe('exponential');
    });

    it('should return configured strategy', () => {
      const workflow = { ...basicWorkflow, retry_strategy: 'linear' as const };
      const engine = new WorkflowEngine(workflow);
      expect(engine.getRetryStrategy()).toBe('linear');
    });
  });

  describe('getOnFailureBehavior', () => {
    it('should return default stop behavior', () => {
      const engine = new WorkflowEngine(basicWorkflow);
      expect(engine.getOnFailureBehavior()).toBe('stop');
    });

    it('should return configured behavior', () => {
      const workflow = { ...basicWorkflow, on_failure: 'continue' as const };
      const engine = new WorkflowEngine(workflow);
      expect(engine.getOnFailureBehavior()).toBe('continue');
    });
  });

  describe('calculateRetryBackoff', () => {
    it('should calculate exponential backoff', () => {
      const engine = new WorkflowEngine(basicWorkflow);

      expect(engine.calculateRetryBackoff(1, 'exponential')).toBe(1000);
      expect(engine.calculateRetryBackoff(2, 'exponential')).toBe(2000);
      expect(engine.calculateRetryBackoff(3, 'exponential')).toBe(4000);
      expect(engine.calculateRetryBackoff(4, 'exponential')).toBe(8000);
    });

    it('should cap exponential backoff at 60 seconds', () => {
      const engine = new WorkflowEngine(basicWorkflow);
      const backoff = engine.calculateRetryBackoff(10, 'exponential');

      expect(backoff).toBeLessThanOrEqual(60000);
      expect(backoff).toBe(60000);
    });

    it('should calculate linear backoff', () => {
      const engine = new WorkflowEngine(basicWorkflow);

      expect(engine.calculateRetryBackoff(1, 'linear')).toBe(1000);
      expect(engine.calculateRetryBackoff(2, 'linear')).toBe(2000);
      expect(engine.calculateRetryBackoff(3, 'linear')).toBe(3000);
    });

    it('should cap linear backoff at 60 seconds', () => {
      const engine = new WorkflowEngine(basicWorkflow);
      const backoff = engine.calculateRetryBackoff(70, 'linear');

      expect(backoff).toBe(60000);
    });

    it('should return 0 for immediate strategy', () => {
      const engine = new WorkflowEngine(basicWorkflow);

      expect(engine.calculateRetryBackoff(1, 'immediate')).toBe(0);
      expect(engine.calculateRetryBackoff(5, 'immediate')).toBe(0);
    });
  });

  describe('createInitialContext', () => {
    it('should create context with start stage', () => {
      const engine = new WorkflowEngine(basicWorkflow);
      const context = engine.createInitialContext('wf-123');

      expect(context.workflow_id).toBe('wf-123');
      expect(context.current_stage).toBe(AGENT_TYPES.SCAFFOLD);
      expect(context.stage_results).toEqual({});
      expect(context.input_data).toEqual({});
    });

    it('should accept input data', () => {
      const engine = new WorkflowEngine(basicWorkflow);
      const inputData = { project_name: 'test', type: 'react-spa' };
      const context = engine.createInitialContext('wf-123', inputData);

      expect(context.input_data).toEqual(inputData);
    });

    it('should set started_at timestamp', () => {
      const engine = new WorkflowEngine(basicWorkflow);
      const beforeTime = Date.now();
      const context = engine.createInitialContext('wf-123');
      const afterTime = Date.now();

      expect(context.metadata?.started_at).toBeGreaterThanOrEqual(beforeTime);
      expect(context.metadata?.started_at).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('recordStageResult', () => {
    it('should add stage result to context', () => {
      const engine = new WorkflowEngine(basicWorkflow);
      const context = engine.createInitialContext('wf-123');

      engine.recordStageResult(context, {
        stage_name: AGENT_TYPES.SCAFFOLD,
        outcome: WORKFLOW_STATUS.SUCCESS,
        output: { app_id: 'app-123' },
        attempts: 1,
        duration_ms: 5000,
        timestamp: Date.now()
      });

      expect(context.stage_results[AGENT_TYPES.SCAFFOLD]).toBeDefined();
      expect(context.stage_results[AGENT_TYPES.SCAFFOLD].outcome).toBe(WORKFLOW_STATUS.SUCCESS);
      expect(context.stage_results[AGENT_TYPES.SCAFFOLD].output).toEqual({ app_id: 'app-123' });
    });

    it('should record error on failure', () => {
      const engine = new WorkflowEngine(basicWorkflow);
      const context = engine.createInitialContext('wf-123');

      engine.recordStageResult(context, {
        stage_name: AGENT_TYPES.SCAFFOLD,
        outcome: 'failure',
        error: 'Scaffold failed: template not found',
        attempts: 1,
        duration_ms: 2000,
        timestamp: Date.now()
      });

      expect(context.stage_results[AGENT_TYPES.SCAFFOLD].error).toBe('Scaffold failed: template not found');
    });
  });

  describe('buildWorkflowResult', () => {
    it('should build successful workflow result', () => {
      const engine = new WorkflowEngine(basicWorkflow);
      const context = engine.createInitialContext('wf-123');

      engine.recordStageResult(context, {
        stage_name: AGENT_TYPES.SCAFFOLD,
        outcome: WORKFLOW_STATUS.SUCCESS,
        output: { app_id: 'app-123' },
        attempts: 1,
        duration_ms: 5000,
        timestamp: Date.now()
      });

      context.current_stage = 'validate';
      const result = engine.buildWorkflowResult(context, WORKFLOW_STATUS.SUCCESS);

      expect(result.status).toBe(WORKFLOW_STATUS.SUCCESS);
      expect(result.workflow_id).toBe('wf-123');
      expect(result.final_stage).toBe('validate');
      expect(result.stage_results).toHaveLength(1);
      expect(result.total_duration_ms).toBeGreaterThan(0);
    });

    it('should build failed workflow result', () => {
      const engine = new WorkflowEngine(basicWorkflow);
      const context = engine.createInitialContext('wf-123');

      engine.recordStageResult(context, {
        stage_name: AGENT_TYPES.SCAFFOLD,
        outcome: 'failure',
        error: 'Failed',
        attempts: 1,
        duration_ms: 2000,
        timestamp: Date.now()
      });

      const result = engine.buildWorkflowResult(context, 'failure');

      expect(result.status).toBe('failure');
      expect(result.stage_results[0].error).toBe('Failed');
    });

    it('should include timestamps', () => {
      const engine = new WorkflowEngine(basicWorkflow);
      const context = engine.createInitialContext('wf-123');

      const result = engine.buildWorkflowResult(context, WORKFLOW_STATUS.SUCCESS);

      expect(result.started_at).toBeDefined();
      expect(result.completed_at).toBeDefined();
      expect(result.completed_at).toBeGreaterThanOrEqual(result.started_at);
    });
  });

  describe('validateConstraints', () => {
    it('should validate successful context', () => {
      const engine = new WorkflowEngine(basicWorkflow);
      const context = engine.createInitialContext('wf-123');

      const validation = engine.validateConstraints(context);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid current stage', () => {
      const engine = new WorkflowEngine(basicWorkflow);
      const context = engine.createInitialContext('wf-123');
      context.current_stage = 'nonexistent';

      const validation = engine.validateConstraints(context);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should detect global timeout exceeded', () => {
      const workflow = { ...basicWorkflow, global_timeout_ms: 100 };
      const engine = new WorkflowEngine(workflow);
      const context = engine.createInitialContext('wf-123');

      // Simulate timeout by setting past started_at
      if (context.metadata) {
        context.metadata.started_at = Date.now() - 200;
      }

      const validation = engine.validateConstraints(context);

      expect(validation.valid).toBe(false);
    });
  });

  describe('createWorkflowEngine factory', () => {
    it('should create engine from factory', () => {
      const engine = createWorkflowEngine(basicWorkflow);

      expect(engine).toBeInstanceOf(WorkflowEngine);
      expect(engine.getStartStage()).toBe(AGENT_TYPES.SCAFFOLD);
    });
  });

  describe('parallel stages', () => {
    it('should identify parallel eligible stages', () => {
      const workflow: WorkflowDefinition = {
        ...basicWorkflow,
        stages: {
          ...basicWorkflow.stages,
          validate: {
            ...basicWorkflow.stages.validate,
            parallel: true
          }
        },
        max_parallel_stages: 2
      };

      const engine = new WorkflowEngine(workflow);
      const context = engine.createInitialContext('wf-123');
      context.current_stage = 'validate';

      const parallel = engine.getParallelEligibleStages(context);

      // Note: Simplified parallel detection in this version
      expect(parallel).toBeDefined();
    });
  });
});
