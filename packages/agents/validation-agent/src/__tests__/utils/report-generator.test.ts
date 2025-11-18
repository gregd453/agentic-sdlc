import { describe, it, expect } from 'vitest';
import { randomUUID } from 'crypto';
import { generateValidationReport, formatReportAsText } from '../../utils/report-generator';
import {
  ValidationCheckResult,
  QualityGateResult
} from '../../types';

describe('report-generator', () => {
  const taskId = randomUUID();
  const workflowId = randomUUID();
  const projectPath = '/test/project';

  describe('generateValidationReport', () => {
    it('should generate report with all checks passed', () => {
      const checks: ValidationCheckResult[] = [
        {
          type: 'typescript',
          status: 'passed',
          duration_ms: 1000
        },
        {
          type: 'eslint',
          status: 'passed',
          duration_ms: 500
        }
      ];

      const gates: QualityGateResult = {
        passed: true,
        gates_evaluated: 2,
        gates_passed: 2,
        gates_failed: 0,
        blocking_failures: [],
        details: []
      };

      const startTime = Date.now() - 2000;
      const report = generateValidationReport(
        taskId,
        workflowId,
        projectPath,
        checks,
        gates,
        startTime
      );

      expect(report.task_id).toBe(taskId);
      expect(report.workflow_id).toBe(workflowId);
      expect(report.project_path).toBe(projectPath);
      expect(report.overall_status).toBe('passed');
      expect(report.summary.total_checks).toBe(2);
      expect(report.summary.passed_checks).toBe(2);
      expect(report.summary.failed_checks).toBe(0);
    });

    it('should generate report with failed checks', () => {
      const checks: ValidationCheckResult[] = [
        {
          type: 'typescript',
          status: WORKFLOW_STATUS.FAILED,
          duration_ms: 1000,
          errors: ['Type error in file.ts']
        },
        {
          type: 'eslint',
          status: 'passed',
          duration_ms: 500
        }
      ];

      const gates: QualityGateResult = {
        passed: false,
        gates_evaluated: 2,
        gates_passed: 1,
        gates_failed: 1,
        blocking_failures: ['Coverage below threshold'],
        details: []
      };

      const startTime = Date.now() - 2000;
      const report = generateValidationReport(
        taskId,
        workflowId,
        projectPath,
        checks,
        gates,
        startTime
      );

      expect(report.overall_status).toBe(WORKFLOW_STATUS.FAILED);
      expect(report.summary.failed_checks).toBe(1);
      expect(report.recommendations).toBeDefined();
      expect(report.recommendations!.length).toBeGreaterThan(0);
    });

    it('should generate report with warnings', () => {
      const checks: ValidationCheckResult[] = [
        {
          type: 'typescript',
          status: 'passed',
          duration_ms: 1000
        },
        {
          type: 'eslint',
          status: 'warning',
          duration_ms: 500,
          warnings: ['Deprecated API usage']
        }
      ];

      const gates: QualityGateResult = {
        passed: true,
        gates_evaluated: 2,
        gates_passed: 2,
        gates_failed: 0,
        blocking_failures: [],
        details: []
      };

      const startTime = Date.now() - 2000;
      const report = generateValidationReport(
        taskId,
        workflowId,
        projectPath,
        checks,
        gates,
        startTime
      );

      expect(report.overall_status).toBe('warning');
      expect(report.summary.warning_checks).toBe(1);
    });

    it('should include recommendations for failed checks', () => {
      const checks: ValidationCheckResult[] = [
        {
          type: 'typescript',
          status: WORKFLOW_STATUS.FAILED,
          duration_ms: 1000,
          errors: ['Type error']
        },
        {
          type: 'coverage',
          status: WORKFLOW_STATUS.FAILED,
          duration_ms: 500,
          errors: ['Coverage too low']
        }
      ];

      const gates: QualityGateResult = {
        passed: false,
        gates_evaluated: 2,
        gates_passed: 0,
        gates_failed: 2,
        blocking_failures: ['Coverage', 'TypeScript'],
        details: []
      };

      const startTime = Date.now() - 2000;
      const report = generateValidationReport(
        taskId,
        workflowId,
        projectPath,
        checks,
        gates,
        startTime
      );

      expect(report.recommendations).toBeDefined();
      expect(report.recommendations!.length).toBeGreaterThan(0);
      expect(report.recommendations!.some(r => r.includes('TypeScript'))).toBe(true);
      expect(report.recommendations!.some(r => r.includes('coverage'))).toBe(true);
    });
  });

  describe('formatReportAsText', () => {
    it('should format report as readable text', () => {
      const checks: ValidationCheckResult[] = [
        {
          type: 'typescript',
          status: 'passed',
          duration_ms: 1000
        }
      ];

      const gates: QualityGateResult = {
        passed: true,
        gates_evaluated: 1,
        gates_passed: 1,
        gates_failed: 0,
        blocking_failures: [],
        details: []
      };

      const startTime = Date.now() - 1000;
      const report = generateValidationReport(
        taskId,
        workflowId,
        projectPath,
        checks,
        gates,
        startTime
      );

      const formatted = formatReportAsText(report);

      expect(formatted).toContain('VALIDATION REPORT');
      expect(formatted).toContain('SUMMARY');
      expect(formatted).toContain('VALIDATION CHECKS');
      expect(formatted).toContain('QUALITY GATES');
      expect(formatted).toContain('TYPESCRIPT');
    });

    it('should include errors in formatted output', () => {
      const checks: ValidationCheckResult[] = [
        {
          type: 'typescript',
          status: WORKFLOW_STATUS.FAILED,
          duration_ms: 1000,
          errors: ['Type error in file.ts']
        }
      ];

      const gates: QualityGateResult = {
        passed: false,
        gates_evaluated: 1,
        gates_passed: 0,
        gates_failed: 1,
        blocking_failures: ['TypeScript failed'],
        details: []
      };

      const startTime = Date.now() - 1000;
      const report = generateValidationReport(
        taskId,
        workflowId,
        projectPath,
        checks,
        gates,
        startTime
      );

      const formatted = formatReportAsText(report);

      expect(formatted).toContain('Type error in file.ts');
      expect(formatted).toContain('TypeScript failed');
    });
  });
});
