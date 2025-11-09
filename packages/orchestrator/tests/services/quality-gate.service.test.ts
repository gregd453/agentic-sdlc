import { describe, it, expect, beforeEach } from 'vitest';
import { QualityGateService } from '../../src/services/quality-gate.service';
import { QualityGate } from '../../src/types/pipeline.types';

/**
 * Quality Gate Service Tests
 *
 * Tests the policy-based quality gate enforcement system:
 * 1. Gate evaluation with different operators
 * 2. Multiple gate evaluation (blocking/non-blocking)
 * 3. Metric extraction (nested paths)
 * 4. Default gates loading
 * 5. Policy file loading
 */
describe('QualityGateService', () => {
  let service: QualityGateService;

  beforeEach(() => {
    // Initialize with default gates (no policy file)
    service = new QualityGateService('non-existent-path.yaml');
  });

  describe('Default Gates', () => {
    it('should load default quality gates when policy file not found', () => {
      const gates = service.getAllPolicyGates();
      expect(gates.length).toBeGreaterThan(0);
    });

    it('should have coverage gate configured', () => {
      const coverageGate = service.getPolicyGate('coverage');
      expect(coverageGate).toBeDefined();
      expect(coverageGate?.metric).toBe('line_coverage');
      expect(coverageGate?.operator).toBe('>=');
      expect(coverageGate?.threshold).toBe(80);
      expect(coverageGate?.blocking).toBe(true);
    });

    it('should have security gate configured', () => {
      const securityGate = service.getPolicyGate('security');
      expect(securityGate).toBeDefined();
      expect(securityGate?.metric).toBe('critical_vulns');
      expect(securityGate?.operator).toBe('==');
      expect(securityGate?.threshold).toBe(0);
      expect(securityGate?.blocking).toBe(true);
    });

    it('should have contracts gate configured', () => {
      const contractsGate = service.getPolicyGate('contracts');
      expect(contractsGate).toBeDefined();
      expect(contractsGate?.metric).toBe('api_breaking_changes');
      expect(contractsGate?.blocking).toBe(true);
    });

    it('should have performance gate configured', () => {
      const perfGate = service.getPolicyGate('performance');
      expect(perfGate).toBeDefined();
      expect(perfGate?.metric).toBe('p95_latency_ms');
      expect(perfGate?.operator).toBe('<');
      expect(perfGate?.threshold).toBe(500);
      expect(perfGate?.blocking).toBe(false); // Non-blocking
    });
  });

  describe('Gate Evaluation - Equality Operators', () => {
    it('should pass when value equals threshold (==)', async () => {
      const gate: QualityGate = {
        name: 'test_gate',
        metric: 'count',
        operator: '==',
        threshold: 10,
        blocking: true
      };

      const data = { count: 10 };
      const result = await service.evaluate(gate, data);
      expect(result).toBe(true);
    });

    it('should fail when value does not equal threshold (==)', async () => {
      const gate: QualityGate = {
        name: 'test_gate',
        metric: 'count',
        operator: '==',
        threshold: 10,
        blocking: true
      };

      const data = { count: 5 };
      const result = await service.evaluate(gate, data);
      expect(result).toBe(false);
    });

    it('should pass when value not equals threshold (!=)', async () => {
      const gate: QualityGate = {
        name: 'test_gate',
        metric: 'errors',
        operator: '!=',
        threshold: 0,
        blocking: true
      };

      const data = { errors: 5 };
      const result = await service.evaluate(gate, data);
      expect(result).toBe(true);
    });

    it('should work with string values (==)', async () => {
      const gate: QualityGate = {
        name: 'test_gate',
        metric: 'status',
        operator: '==',
        threshold: 'passed',
        blocking: true
      };

      const data = { status: 'passed' };
      const result = await service.evaluate(gate, data);
      expect(result).toBe(true);
    });
  });

  describe('Gate Evaluation - Comparison Operators', () => {
    it('should pass when value is less than threshold (<)', async () => {
      const gate: QualityGate = {
        name: 'test_gate',
        metric: 'latency',
        operator: '<',
        threshold: 500,
        blocking: true
      };

      const data = { latency: 400 };
      const result = await service.evaluate(gate, data);
      expect(result).toBe(true);
    });

    it('should fail when value equals threshold (<)', async () => {
      const gate: QualityGate = {
        name: 'test_gate',
        metric: 'latency',
        operator: '<',
        threshold: 500,
        blocking: true
      };

      const data = { latency: 500 };
      const result = await service.evaluate(gate, data);
      expect(result).toBe(false);
    });

    it('should pass when value is less than or equal to threshold (<=)', async () => {
      const gate: QualityGate = {
        name: 'test_gate',
        metric: 'errors',
        operator: '<=',
        threshold: 5,
        blocking: true
      };

      const data = { errors: 5 };
      const result = await service.evaluate(gate, data);
      expect(result).toBe(true);
    });

    it('should pass when value is greater than threshold (>)', async () => {
      const gate: QualityGate = {
        name: 'test_gate',
        metric: 'coverage',
        operator: '>',
        threshold: 80,
        blocking: true
      };

      const data = { coverage: 90 };
      const result = await service.evaluate(gate, data);
      expect(result).toBe(true);
    });

    it('should pass when value is greater than or equal to threshold (>=)', async () => {
      const gate: QualityGate = {
        name: 'test_gate',
        metric: 'coverage',
        operator: '>=',
        threshold: 80,
        blocking: true
      };

      const data = { coverage: 80 };
      const result = await service.evaluate(gate, data);
      expect(result).toBe(true);
    });

    it('should fail when value is less than threshold (>=)', async () => {
      const gate: QualityGate = {
        name: 'test_gate',
        metric: 'coverage',
        operator: '>=',
        threshold: 80,
        blocking: true
      };

      const data = { coverage: 75 };
      const result = await service.evaluate(gate, data);
      expect(result).toBe(false);
    });
  });

  describe('Nested Metric Extraction', () => {
    it('should extract nested metric values', async () => {
      const gate: QualityGate = {
        name: 'test_gate',
        metric: 'coverage.line_coverage',
        operator: '>=',
        threshold: 80,
        blocking: true
      };

      const data = {
        coverage: {
          line_coverage: 85,
          branch_coverage: 75
        }
      };

      const result = await service.evaluate(gate, data);
      expect(result).toBe(true);
    });

    it('should extract deeply nested values', async () => {
      const gate: QualityGate = {
        name: 'test_gate',
        metric: 'metrics.performance.p95',
        operator: '<',
        threshold: 500,
        blocking: true
      };

      const data = {
        metrics: {
          performance: {
            p95: 450,
            p99: 600
          }
        }
      };

      const result = await service.evaluate(gate, data);
      expect(result).toBe(true);
    });

    it('should return false when nested metric not found', async () => {
      const gate: QualityGate = {
        name: 'test_gate',
        metric: 'missing.nested.path',
        operator: '==',
        threshold: 10,
        blocking: true
      };

      const data = { other: 'value' };
      const result = await service.evaluate(gate, data);
      expect(result).toBe(false);
    });
  });

  describe('Multiple Gate Evaluation', () => {
    it('should pass when all blocking gates pass', async () => {
      const gates: QualityGate[] = [
        {
          name: 'coverage',
          metric: 'line_coverage',
          operator: '>=',
          threshold: 80,
          blocking: true
        },
        {
          name: 'security',
          metric: 'critical_vulns',
          operator: '==',
          threshold: 0,
          blocking: true
        }
      ];

      const data = {
        line_coverage: 85,
        critical_vulns: 0
      };

      const result = await service.evaluateAll(gates, data);
      expect(result.passed).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results.every(r => r.passed)).toBe(true);
    });

    it('should fail when any blocking gate fails', async () => {
      const gates: QualityGate[] = [
        {
          name: 'coverage',
          metric: 'line_coverage',
          operator: '>=',
          threshold: 80,
          blocking: true
        },
        {
          name: 'security',
          metric: 'critical_vulns',
          operator: '==',
          threshold: 0,
          blocking: true
        }
      ];

      const data = {
        line_coverage: 85,
        critical_vulns: 2 // Fails security gate
      };

      const result = await service.evaluateAll(gates, data);
      expect(result.passed).toBe(false);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].passed).toBe(true);  // coverage passed
      expect(result.results[1].passed).toBe(false); // security failed
    });

    it('should pass when non-blocking gate fails', async () => {
      const gates: QualityGate[] = [
        {
          name: 'coverage',
          metric: 'line_coverage',
          operator: '>=',
          threshold: 80,
          blocking: true
        },
        {
          name: 'performance',
          metric: 'p95_latency',
          operator: '<',
          threshold: 500,
          blocking: false // Non-blocking
        }
      ];

      const data = {
        line_coverage: 85,
        p95_latency: 600 // Fails performance gate but non-blocking
      };

      const result = await service.evaluateAll(gates, data);
      expect(result.passed).toBe(true); // Overall passed because failing gate is non-blocking
      expect(result.results).toHaveLength(2);
      expect(result.results[0].passed).toBe(true);  // coverage passed
      expect(result.results[1].passed).toBe(false); // performance failed (but non-blocking)
      expect(result.results[1].blocking).toBe(false);
    });

    it('should return detailed results for all gates', async () => {
      const gates: QualityGate[] = [
        {
          name: 'coverage',
          metric: 'line_coverage',
          operator: '>=',
          threshold: 80,
          blocking: true
        }
      ];

      const data = { line_coverage: 90 };

      const result = await service.evaluateAll(gates, data);
      expect(result.results[0]).toEqual({
        gate_name: 'coverage',
        passed: true,
        actual_value: 90,
        threshold: 80,
        blocking: true
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle numeric strings', async () => {
      const gate: QualityGate = {
        name: 'test_gate',
        metric: 'count',
        operator: '>=',
        threshold: 80,
        blocking: true
      };

      const data = { count: '90' }; // String value
      const result = await service.evaluate(gate, data);
      expect(result).toBe(true);
    });

    it('should handle zero values', async () => {
      const gate: QualityGate = {
        name: 'test_gate',
        metric: 'errors',
        operator: '==',
        threshold: 0,
        blocking: true
      };

      const data = { errors: 0 };
      const result = await service.evaluate(gate, data);
      expect(result).toBe(true);
    });

    it('should handle null values gracefully', async () => {
      const gate: QualityGate = {
        name: 'test_gate',
        metric: 'value',
        operator: '==',
        threshold: 10,
        blocking: true
      };

      const data = { value: null };
      const result = await service.evaluate(gate, data);
      expect(result).toBe(false);
    });

    it('should handle undefined values gracefully', async () => {
      const gate: QualityGate = {
        name: 'test_gate',
        metric: 'missing',
        operator: '==',
        threshold: 10,
        blocking: true
      };

      const data = {};
      const result = await service.evaluate(gate, data);
      expect(result).toBe(false);
    });
  });

  describe('Policy Gate Management', () => {
    it('should retrieve specific policy gate', () => {
      const gate = service.getPolicyGate('coverage');
      expect(gate).toBeDefined();
      expect(gate?.name).toBe('coverage');
    });

    it('should return undefined for non-existent gate', () => {
      const gate = service.getPolicyGate('non-existent');
      expect(gate).toBeUndefined();
    });

    it('should retrieve all policy gates', () => {
      const gates = service.getAllPolicyGates();
      expect(Array.isArray(gates)).toBe(true);
      expect(gates.length).toBeGreaterThan(0);
    });

    it('should reload policy gates', async () => {
      const initialGates = service.getAllPolicyGates();
      const initialCount = initialGates.length;

      await service.reload('non-existent-path.yaml');

      const reloadedGates = service.getAllPolicyGates();
      expect(reloadedGates.length).toBe(initialCount);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should enforce code coverage policy', async () => {
      const coverageGate = service.getPolicyGate('coverage');
      expect(coverageGate).toBeDefined();

      const passingData = { line_coverage: 85 };
      const failingData = { line_coverage: 70 };

      const passResult = await service.evaluate(coverageGate!, passingData);
      const failResult = await service.evaluate(coverageGate!, failingData);

      expect(passResult).toBe(true);
      expect(failResult).toBe(false);
    });

    it('should enforce security policy (zero critical vulnerabilities)', async () => {
      const securityGate = service.getPolicyGate('security');
      expect(securityGate).toBeDefined();

      const secureData = { critical_vulns: 0 };
      const vulnerableData = { critical_vulns: 1 };

      const secureResult = await service.evaluate(securityGate!, secureData);
      const vulnerableResult = await service.evaluate(securityGate!, vulnerableData);

      expect(secureResult).toBe(true);
      expect(vulnerableResult).toBe(false);
    });

    it('should evaluate complete validation result', async () => {
      const gates = [
        service.getPolicyGate('coverage')!,
        service.getPolicyGate('security')!
      ];

      const validationData = {
        line_coverage: 90,
        critical_vulns: 0
      };

      const result = await service.evaluateAll(gates, validationData);
      expect(result.passed).toBe(true);
      expect(result.results.every(r => r.passed)).toBe(true);
    });
  });
});
