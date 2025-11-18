import { describe, it, expect } from 'vitest';
import { evaluateQualityGates } from '../../validators/quality-gates';
import {
  ValidationCheckResult,
  PolicyConfig,
  CoverageValidationDetails,
  SecurityValidationDetails
} from '../../types';

describe('quality-gates', () => {
  describe('evaluateQualityGates', () => {
    it('should pass when all gates meet thresholds', () => {
      const checks: ValidationCheckResult[] = [
        {
          type: 'coverage',
          status: 'passed',
          duration_ms: 1000,
          details: {
            line_coverage: 85,
            branch_coverage: 80,
            function_coverage: 90,
            statement_coverage: 85,
            threshold: 80,
            passed: true
          } as CoverageValidationDetails
        },
        {
          type: 'security',
          status: 'passed',
          duration_ms: 500,
          details: {
            critical_vulnerabilities: 0,
            high_vulnerabilities: 0,
            medium_vulnerabilities: 0,
            low_vulnerabilities: 0,
            total_vulnerabilities: 0
          } as SecurityValidationDetails
        }
      ];

      const policy: PolicyConfig = {
        gates: {
          coverage: {
            metric: 'line_coverage',
            operator: '>=',
            threshold: 80,
            description: 'Min coverage',
            blocking: true
          },
          security: {
            metric: 'critical_vulns',
            operator: '==',
            threshold: 0,
            description: 'No critical vulns',
            blocking: true
          }
        }
      };

      const result = evaluateQualityGates(checks, policy);

      expect(result.passed).toBe(true);
      expect(result.gates_evaluated).toBe(2);
      expect(result.gates_passed).toBe(2);
      expect(result.gates_failed).toBe(0);
      expect(result.blocking_failures).toHaveLength(0);
    });

    it('should fail when coverage below threshold', () => {
      const checks: ValidationCheckResult[] = [
        {
          type: 'coverage',
          status: WORKFLOW_STATUS.FAILED,
          duration_ms: 1000,
          details: {
            line_coverage: 75,
            branch_coverage: 70,
            function_coverage: 80,
            statement_coverage: 75,
            threshold: 80,
            passed: false
          } as CoverageValidationDetails
        }
      ];

      const policy: PolicyConfig = {
        gates: {
          coverage: {
            metric: 'line_coverage',
            operator: '>=',
            threshold: 80,
            description: 'Min coverage',
            blocking: true
          }
        }
      };

      const result = evaluateQualityGates(checks, policy);

      expect(result.passed).toBe(false);
      expect(result.gates_failed).toBe(1);
      expect(result.blocking_failures).toHaveLength(1);
      expect(result.blocking_failures[0]).toContain('coverage');
    });

    it('should fail when critical vulnerabilities found', () => {
      const checks: ValidationCheckResult[] = [
        {
          type: 'security',
          status: WORKFLOW_STATUS.FAILED,
          duration_ms: 500,
          details: {
            critical_vulnerabilities: 2,
            high_vulnerabilities: 3,
            medium_vulnerabilities: 5,
            low_vulnerabilities: 10,
            total_vulnerabilities: 20
          } as SecurityValidationDetails
        }
      ];

      const policy: PolicyConfig = {
        gates: {
          security: {
            metric: 'critical_vulns',
            operator: '==',
            threshold: 0,
            description: 'No critical vulns',
            blocking: true
          }
        }
      };

      const result = evaluateQualityGates(checks, policy);

      expect(result.passed).toBe(false);
      expect(result.gates_failed).toBe(1);
      expect(result.blocking_failures[0]).toContain('security');
    });

    it('should handle non-blocking gates as warnings', () => {
      const checks: ValidationCheckResult[] = [
        {
          type: 'coverage',
          status: 'passed',
          duration_ms: 1000,
          details: {
            line_coverage: 70,
            branch_coverage: 65,
            function_coverage: 75,
            statement_coverage: 70,
            threshold: 80,
            passed: false
          } as CoverageValidationDetails
        }
      ];

      const policy: PolicyConfig = {
        gates: {
          coverage: {
            metric: 'line_coverage',
            operator: '>=',
            threshold: 80,
            description: 'Min coverage',
            blocking: false // Non-blocking
          }
        }
      };

      const result = evaluateQualityGates(checks, policy);

      expect(result.passed).toBe(true); // Still passes overall
      expect(result.gates_failed).toBe(1);
      expect(result.blocking_failures).toHaveLength(0);
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.length).toBeGreaterThan(0);
    });

    it('should handle empty policy', () => {
      const checks: ValidationCheckResult[] = [
        {
          type: 'typescript',
          status: 'passed',
          duration_ms: 1000
        }
      ];

      const policy: PolicyConfig = {};

      const result = evaluateQualityGates(checks, policy);

      expect(result.passed).toBe(true);
      expect(result.gates_evaluated).toBe(0);
    });

    it('should evaluate multiple gate types', () => {
      const checks: ValidationCheckResult[] = [
        {
          type: 'coverage',
          status: 'passed',
          duration_ms: 1000,
          details: {
            line_coverage: 85,
            branch_coverage: 80,
            function_coverage: 90,
            statement_coverage: 85,
            threshold: 80,
            passed: true
          } as CoverageValidationDetails
        },
        {
          type: 'security',
          status: 'passed',
          duration_ms: 500,
          details: {
            critical_vulnerabilities: 0,
            high_vulnerabilities: 1,
            medium_vulnerabilities: 2,
            low_vulnerabilities: 5,
            total_vulnerabilities: 8
          } as SecurityValidationDetails
        }
      ];

      const policy: PolicyConfig = {
        gates: {
          coverage: {
            metric: 'line_coverage',
            operator: '>=',
            threshold: 80,
            description: 'Min coverage',
            blocking: true
          },
          critical_security: {
            metric: 'critical_vulns',
            operator: '==',
            threshold: 0,
            description: 'No critical vulns',
            blocking: true
          },
          high_security: {
            metric: 'high_vulns',
            operator: '<=',
            threshold: 2,
            description: 'Max 2 high vulns',
            blocking: false
          }
        }
      };

      const result = evaluateQualityGates(checks, policy);

      expect(result.passed).toBe(true);
      expect(result.gates_evaluated).toBe(3);
      expect(result.gates_passed).toBe(3);
    });
  });
});
