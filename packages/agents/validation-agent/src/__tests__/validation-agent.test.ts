import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { ValidationAgent } from '../validation-agent';
import { TaskAssignment } from '@agentic-sdlc/base-agent';
import * as tsValidator from '../validators/typescript-validator';
import * as eslintValidator from '../validators/eslint-validator';
import * as coverageValidator from '../validators/coverage-validator';
import * as securityValidator from '../validators/security-validator';
import { ValidationCheckResult } from '../types';

// Mock Redis
vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      quit: vi.fn(),
      ping: vi.fn(),
      publish: vi.fn(),
      hset: vi.fn(),
      hdel: vi.fn()
    }))
  };
});

// Mock validators
vi.mock('../validators/typescript-validator');
vi.mock('../validators/eslint-validator');
vi.mock('../validators/coverage-validator');
vi.mock('../validators/security-validator');

describe('ValidationAgent', () => {
  let agent: ValidationAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new ValidationAgent();

    // Mock validator responses
    vi.mocked(tsValidator.validateTypeScript).mockResolvedValue({
      type: 'typescript',
      status: 'passed',
      duration_ms: 1000
    } as ValidationCheckResult);

    vi.mocked(eslintValidator.validateESLint).mockResolvedValue({
      type: 'eslint',
      status: 'passed',
      duration_ms: 500
    } as ValidationCheckResult);

    vi.mocked(coverageValidator.validateCoverage).mockResolvedValue({
      type: 'coverage',
      status: 'passed',
      duration_ms: 2000,
      details: {
        line_coverage: 85,
        branch_coverage: 80,
        function_coverage: 90,
        statement_coverage: 85,
        threshold: 80,
        passed: true
      }
    } as ValidationCheckResult);

    vi.mocked(securityValidator.validateSecurity).mockResolvedValue({
      type: 'security',
      status: 'passed',
      duration_ms: 1500,
      details: {
        critical_vulnerabilities: 0,
        high_vulnerabilities: 0,
        medium_vulnerabilities: 0,
        low_vulnerabilities: 0,
        total_vulnerabilities: 0
      }
    } as ValidationCheckResult);
  });

  describe('constructor', () => {
    it('should initialize with correct capabilities', () => {
      expect(agent).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should execute validation task successfully', async () => {
      const task: TaskAssignment = {
        task_id: randomUUID(),
        workflow_id: randomUUID(),
        type: 'validation',
        name: 'Validate code',
        description: 'Run validation checks',
        requirements: 'Validate TypeScript, ESLint, coverage, security',
        priority: 'high',
        context: {
          project_path: '/test/project',
          package_manager: 'pnpm',
          validation_types: ['typescript', 'eslint', 'coverage', 'security']
        }
      };

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.task_id).toBe(task.task_id);
      expect(result.workflow_id).toBe(task.workflow_id);
      expect(result.output).toBeDefined();
      expect(result.output.report).toBeDefined();
      expect(result.output.validation_checks).toBeDefined();
      expect(result.output.quality_gates).toBeDefined();
    });

    it('should run only specified validation types', async () => {
      const task: TaskAssignment = {
        task_id: randomUUID(),
        workflow_id: randomUUID(),
        type: 'validation',
        name: 'Validate TypeScript only',
        description: 'Run TypeScript validation',
        requirements: 'Validate TypeScript',
        priority: 'high',
        context: {
          project_path: '/test/project',
          validation_types: ['typescript']
        }
      };

      await agent.execute(task);

      expect(tsValidator.validateTypeScript).toHaveBeenCalledWith('/test/project');
      expect(eslintValidator.validateESLint).not.toHaveBeenCalled();
      expect(coverageValidator.validateCoverage).not.toHaveBeenCalled();
      expect(securityValidator.validateSecurity).not.toHaveBeenCalled();
    });

    it('should return failure status when validation fails', async () => {
      vi.mocked(tsValidator.validateTypeScript).mockResolvedValue({
        type: 'typescript',
        status: 'failed',
        duration_ms: 1000,
        errors: ['Type error in file.ts']
      } as ValidationCheckResult);

      const task: TaskAssignment = {
        task_id: randomUUID(),
        workflow_id: randomUUID(),
        type: 'validation',
        name: 'Validate code',
        description: 'Run validation checks',
        requirements: 'Validate code',
        priority: 'high',
        context: {
          project_path: '/test/project',
          validation_types: ['typescript']
        }
      };

      const result = await agent.execute(task);

      expect(result.status).toBe('failure');
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should return partial status when warnings present', async () => {
      vi.mocked(eslintValidator.validateESLint).mockResolvedValue({
        type: 'eslint',
        status: 'warning',
        duration_ms: 500,
        warnings: ['Deprecated API usage']
      } as ValidationCheckResult);

      const task: TaskAssignment = {
        task_id: randomUUID(),
        workflow_id: randomUUID(),
        type: 'validation',
        name: 'Validate code',
        description: 'Run validation checks',
        requirements: 'Validate code',
        priority: 'high',
        context: {
          project_path: '/test/project',
          validation_types: ['typescript', 'eslint']
        }
      };

      const result = await agent.execute(task);

      expect(result.status).toBe('partial');
    });

    it('should throw error for invalid context', async () => {
      const task: TaskAssignment = {
        task_id: randomUUID(),
        workflow_id: randomUUID(),
        type: 'validation',
        name: 'Validate code',
        description: 'Run validation checks',
        requirements: 'Validate code',
        priority: 'high',
        context: {
          // Missing project_path
        }
      };

      await expect(agent.execute(task)).rejects.toThrow();
    });

    it('should use custom coverage threshold from context', async () => {
      const task: TaskAssignment = {
        task_id: randomUUID(),
        workflow_id: randomUUID(),
        type: 'validation',
        name: 'Validate coverage',
        description: 'Check test coverage',
        requirements: 'Coverage >= 90%',
        priority: 'high',
        context: {
          project_path: '/test/project',
          validation_types: ['coverage'],
          coverage_threshold: 90
        }
      };

      await agent.execute(task);

      expect(coverageValidator.validateCoverage).toHaveBeenCalledWith(
        '/test/project',
        90
      );
    });

    it('should include next_stage in successful results', async () => {
      const task: TaskAssignment = {
        task_id: randomUUID(),
        workflow_id: randomUUID(),
        type: 'validation',
        name: 'Validate code',
        description: 'Run validation checks',
        requirements: 'Validate code',
        priority: 'high',
        context: {
          project_path: '/test/project',
          validation_types: ['typescript']
        }
      };

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.next_stage).toBe('integration');
    });

    it('should not include next_stage in failed results', async () => {
      vi.mocked(tsValidator.validateTypeScript).mockResolvedValue({
        type: 'typescript',
        status: 'failed',
        duration_ms: 1000,
        errors: ['Type error']
      } as ValidationCheckResult);

      const task: TaskAssignment = {
        task_id: randomUUID(),
        workflow_id: randomUUID(),
        type: 'validation',
        name: 'Validate code',
        description: 'Run validation checks',
        requirements: 'Validate code',
        priority: 'high',
        context: {
          project_path: '/test/project',
          validation_types: ['typescript']
        }
      };

      const result = await agent.execute(task);

      expect(result.status).toBe('failure');
      expect(result.next_stage).toBeUndefined();
    });
  });
});
