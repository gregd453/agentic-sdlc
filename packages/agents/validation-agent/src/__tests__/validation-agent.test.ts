import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { ValidationAgent } from '../validation-agent';
import { ValidationTask, createValidationTask } from '@agentic-sdlc/shared-types';
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

// Helper to create test validation tasks
function createTestTask(filePaths: string[], validationTypes?: string[], overrides?: Partial<ValidationTask>): ValidationTask {
  const now = new Date().toISOString();
  const workflowId = `workflow_${randomUUID()}` as any;
  const taskId = `task_${randomUUID()}` as any;

  return {
    task_id: taskId,
    workflow_id: workflowId,
    agent_type: 'validation',
    action: 'validate_code',
    status: 'pending',
    priority: 50,
    payload: {
      file_paths: filePaths,
      validation_types: (validationTypes as any) || ['typescript', 'eslint', 'security', 'coverage'],
    },
    version: '1.0.0',
    timeout_ms: 120000,
    retry_count: 0,
    max_retries: 3,
    created_at: now,
    ...overrides
  } as ValidationTask;
}

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
      const task = createTestTask(
        ['/test/project/file1.ts', '/test/project/file2.ts'],
        ['typescript', 'eslint', 'coverage', 'security']
      );

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.task_id).toBe(task.task_id);
      expect(result.workflow_id).toBe(task.workflow_id);
      expect(result.result).toBeDefined();
      expect(result.result.metrics).toBeDefined();
      expect(result.result.quality_gates).toBeDefined();
    });

    it('should run only specified validation types', async () => {
      const task = createTestTask(['/test/project/file1.ts'], ['typescript']);

      await agent.execute(task);

      expect(tsValidator.validateTypeScript).toHaveBeenCalled();
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

      const task = createTestTask(['/test/project/file1.ts'], ['typescript']);

      const result = await agent.execute(task);

      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
    });

    it('should return partial status when warnings present', async () => {
      vi.mocked(eslintValidator.validateESLint).mockResolvedValue({
        type: 'eslint',
        status: 'warning',
        duration_ms: 500,
        warnings: ['Deprecated API usage']
      } as ValidationCheckResult);

      const task = createTestTask(['/test/project/file1.ts'], ['typescript', 'eslint']);

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
    });

    it('should throw error for invalid context', async () => {
      const task = createTestTask([], ['typescript']);  // Empty file_paths

      await expect(agent.execute(task)).rejects.toThrow();
    });

    it('should use custom coverage threshold from context', async () => {
      const task = createTestTask(['/test/project/file1.ts'], ['coverage'], {
        payload: {
          file_paths: ['/test/project/file1.ts'],
          validation_types: ['coverage'] as any,
          thresholds: {
            coverage: 90,
            complexity: 10,
            errors: 0,
            warnings: 10,
            duplications: 5
          }
        }
      });

      await agent.execute(task);

      expect(coverageValidator.validateCoverage).toHaveBeenCalled();
    });

    it('should include next_stage in successful results', async () => {
      const task = createTestTask(['/test/project/file1.ts'], ['typescript']);

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      // next_stage is determined by orchestrator, not agent
    });

    it('should not include next_stage in failed results', async () => {
      vi.mocked(tsValidator.validateTypeScript).mockResolvedValue({
        type: 'typescript',
        status: 'failed',
        duration_ms: 1000,
        errors: ['Type error']
      } as ValidationCheckResult);

      const task = createTestTask(['/test/project/file1.ts'], ['typescript']);

      const result = await agent.execute(task);

      expect(result.status).toBe('failed');
    });
  });
});
