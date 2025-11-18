import { describe, it, expect } from 'vitest';
import { AGENT_TYPES, WORKFLOW_TYPES } from '@agentic-sdlc/shared-types';
import {
  StageEnum,
  validateStage,
  getStagesForType,
  getNextStage,
  getStageAtIndex,
  getStageIndex,
  type Stage
} from './stages';

describe('Stage Management - Phase 2 Unit Tests', () => {
  describe('validateStage - Zod validation for stage values', () => {
    it('should accept valid stages', () => {
      const validStages = ['initialization', 'scaffolding', AGENT_TYPES.VALIDATION, 'e2e_testing', AGENT_TYPES.INTEGRATION, AGENT_TYPES.DEPLOYMENT, 'monitoring'];

      for (const stage of validStages) {
        expect(() => validateStage(stage)).not.toThrow();
        expect(validateStage(stage)).toBe(stage);
      }
    });

    it('should reject invalid stages', () => {
      const invalidStages = ['unknown_stage', 'testing', 'build', '', null, undefined, 123];

      for (const stage of invalidStages) {
        expect(() => validateStage(stage)).toThrow();
      }
    });

    it('should enforce enum validation via Zod', () => {
      const result = StageEnum.safeParse('initialization');
      expect(result.success).toBe(true);

      const badResult = StageEnum.safeParse('unknown');
      expect(badResult.success).toBe(false);
    });
  });

  describe('getStagesForType - Return correct stage array per type', () => {
    // Table-driven test approach
    const typeTests: Array<{ type: string; expectedStages: Stage[] }> = [
      {
        type: WORKFLOW_TYPES.APP,
        expectedStages: ['initialization', 'scaffolding', AGENT_TYPES.VALIDATION, 'e2e_testing', AGENT_TYPES.INTEGRATION, AGENT_TYPES.DEPLOYMENT, 'monitoring']
      },
      {
        type: WORKFLOW_TYPES.FEATURE,
        expectedStages: ['initialization', 'scaffolding', AGENT_TYPES.VALIDATION, 'e2e_testing']
      },
      {
        type: WORKFLOW_TYPES.BUGFIX,
        expectedStages: ['initialization', AGENT_TYPES.VALIDATION, 'e2e_testing']
      },
      {
        type: 'unknown_type',
        expectedStages: ['initialization', 'scaffolding', AGENT_TYPES.VALIDATION, 'e2e_testing', AGENT_TYPES.INTEGRATION, AGENT_TYPES.DEPLOYMENT, 'monitoring']
      }
    ];

    typeTests.forEach(({ type, expectedStages }) => {
      it(`should return correct stages for type: ${type}`, () => {
        const stages = getStagesForType(type);
        expect(stages).toEqual(expectedStages);
        expect(stages.length).toBe(expectedStages.length);
      });
    });
  });

  describe('getNextStage - Compute next stage correctly', () => {
    // Table-driven tests for all stage transitions
    const transitionTests: Array<{
      currentStage: Stage;
      workflowType: string;
      expectedNext: Stage | null;
    }> = [
      // App type transitions
      { currentStage: 'initialization', workflowType: WORKFLOW_TYPES.APP, expectedNext: 'scaffolding' },
      { currentStage: 'scaffolding', workflowType: WORKFLOW_TYPES.APP, expectedNext: AGENT_TYPES.VALIDATION },
      { currentStage: AGENT_TYPES.VALIDATION, workflowType: WORKFLOW_TYPES.APP, expectedNext: 'e2e_testing' },
      { currentStage: 'e2e_testing', workflowType: WORKFLOW_TYPES.APP, expectedNext: AGENT_TYPES.INTEGRATION },
      { currentStage: AGENT_TYPES.INTEGRATION, workflowType: WORKFLOW_TYPES.APP, expectedNext: AGENT_TYPES.DEPLOYMENT },
      { currentStage: AGENT_TYPES.DEPLOYMENT, workflowType: WORKFLOW_TYPES.APP, expectedNext: 'monitoring' },
      { currentStage: 'monitoring', workflowType: WORKFLOW_TYPES.APP, expectedNext: null }, // Terminal

      // Feature type transitions (shorter sequence)
      { currentStage: 'initialization', workflowType: WORKFLOW_TYPES.FEATURE, expectedNext: 'scaffolding' },
      { currentStage: 'scaffolding', workflowType: WORKFLOW_TYPES.FEATURE, expectedNext: AGENT_TYPES.VALIDATION },
      { currentStage: AGENT_TYPES.VALIDATION, workflowType: WORKFLOW_TYPES.FEATURE, expectedNext: 'e2e_testing' },
      { currentStage: 'e2e_testing', workflowType: WORKFLOW_TYPES.FEATURE, expectedNext: null }, // Terminal

      // Bugfix type transitions (shortest sequence)
      { currentStage: 'initialization', workflowType: WORKFLOW_TYPES.BUGFIX, expectedNext: AGENT_TYPES.VALIDATION },
      { currentStage: AGENT_TYPES.VALIDATION, workflowType: WORKFLOW_TYPES.BUGFIX, expectedNext: 'e2e_testing' },
      { currentStage: 'e2e_testing', workflowType: WORKFLOW_TYPES.BUGFIX, expectedNext: null }, // Terminal
    ];

    transitionTests.forEach(({ currentStage, workflowType, expectedNext }) => {
      it(`should return correct next stage: ${currentStage} -> ${expectedNext} for ${workflowType}`, () => {
        const nextStage = getNextStage(currentStage, workflowType);
        expect(nextStage).toBe(expectedNext);
      });
    });

    it('should throw on unknown stage', () => {
      expect(() => getNextStage('unknown_stage' as Stage, WORKFLOW_TYPES.APP)).toThrow();
    });
  });

  describe('getStageAtIndex - Retrieve stage by index', () => {
    it('should return correct stage at each index for app type', () => {
      const appStages = getStagesForType(WORKFLOW_TYPES.APP);
      appStages.forEach((stage, index) => {
        const retrieved = getStageAtIndex(index, WORKFLOW_TYPES.APP);
        expect(retrieved).toBe(stage);
      });
    });

    it('should return undefined for out-of-bounds index', () => {
      const result = getStageAtIndex(100, WORKFLOW_TYPES.APP);
      expect(result).toBeUndefined();
    });

    it('should handle negative indices gracefully', () => {
      const result = getStageAtIndex(-1, WORKFLOW_TYPES.APP);
      expect(result).toBeUndefined();
    });
  });

  describe('getStageIndex - Get index of stage', () => {
    it('should return correct indices for all stages', () => {
      const appStages = getStagesForType(WORKFLOW_TYPES.APP);

      appStages.forEach((stage, expectedIndex) => {
        const index = getStageIndex(stage, WORKFLOW_TYPES.APP);
        expect(index).toBe(expectedIndex);
      });
    });

    it('should return -1 for unknown stage', () => {
      const index = getStageIndex('unknown_stage' as Stage, WORKFLOW_TYPES.APP);
      expect(index).toBe(-1);
    });

    it('should distinguish stages across different types', () => {
      // 'scaffolding' is at index 1 in app type
      expect(getStageIndex('scaffolding', WORKFLOW_TYPES.APP)).toBe(1);

      // 'scaffolding' is at index 1 in feature type
      expect(getStageIndex('scaffolding', WORKFLOW_TYPES.FEATURE)).toBe(1);

      // 'scaffolding' is NOT in bugfix (returns -1)
      expect(getStageIndex('scaffolding', WORKFLOW_TYPES.BUGFIX)).toBe(-1);
    });
  });

  describe('Integration - Stage progression sequences', () => {
    it('should allow complete progression through app workflow', () => {
      const appStages = getStagesForType(WORKFLOW_TYPES.APP);
      let currentStage: Stage | null = appStages[0];

      for (let i = 0; i < appStages.length; i++) {
        expect(currentStage).toBe(appStages[i]);
        currentStage = currentStage ? getNextStage(currentStage, WORKFLOW_TYPES.APP) : null;
      }

      // Last stage should have no next
      expect(currentStage).toBeNull();
    });

    it('should enforce valid stage sequence only', () => {
      const invalidTransitions = [
        { from: 'initialization' as Stage, to: 'e2e_testing' as Stage },
        { from: 'scaffolding' as Stage, to: 'monitoring' as Stage },
        { from: AGENT_TYPES.VALIDATION as Stage, to: 'initialization' as Stage }, // Backwards
      ];

      // These should NOT be the next stages
      for (const { from, to } of invalidTransitions) {
        const nextStage = getNextStage(from, WORKFLOW_TYPES.APP);
        expect(nextStage).not.toBe(to);
      }
    });
  });
});
