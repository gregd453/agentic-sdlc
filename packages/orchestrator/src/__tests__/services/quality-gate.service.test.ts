import { describe, it, expect, beforeEach } from 'vitest';
import { QualityGateService } from '../../services/quality-gate.service';
import { QualityGate } from '../../types/pipeline.types';

describe('QualityGateService', () => {
  let service: QualityGateService;

  beforeEach(() => {
    service = new QualityGateService();
  });

  describe('evaluate', () => {
    it('should pass coverage gate when threshold is met', async () => {
      const gate: QualityGate = {
        name: 'coverage',
        metric: 'line_coverage',
        operator: '>=',
        threshold: 80,
        blocking: true
      };

      const data = {
        line_coverage: 85
      };

      const result = await service.evaluate(gate, data);

      expect(result).toBe(true);
    });

    it('should fail coverage gate when threshold is not met', async () => {
      const gate: QualityGate = {
        name: 'coverage',
        metric: 'line_coverage',
        operator: '>=',
        threshold: 80,
        blocking: true
      };

      const data = {
        line_coverage: 75
      };

      const result = await service.evaluate(gate, data);

      expect(result).toBe(false);
    });

    it('should pass security gate with zero critical vulns', async () => {
      const gate: QualityGate = {
        name: 'security',
        metric: 'critical_vulns',
        operator: '==',
        threshold: 0,
        blocking: true
      };

      const data = {
        critical_vulns: 0
      };

      const result = await service.evaluate(gate, data);

      expect(result).toBe(true);
    });

    it('should fail security gate with critical vulns', async () => {
      const gate: QualityGate = {
        name: 'security',
        metric: 'critical_vulns',
        operator: '==',
        threshold: 0,
        blocking: true
      };

      const data = {
        critical_vulns: 2
      };

      const result = await service.evaluate(gate, data);

      expect(result).toBe(false);
    });

    it('should handle nested metric paths', async () => {
      const gate: QualityGate = {
        name: 'coverage',
        metric: 'coverage.line_coverage',
        operator: '>=',
        threshold: 80,
        blocking: true
      };

      const data = {
        coverage: {
          line_coverage: 90
        }
      };

      const result = await service.evaluate(gate, data);

      expect(result).toBe(true);
    });

    it('should return false when metric not found', async () => {
      const gate: QualityGate = {
        name: 'coverage',
        metric: 'missing_metric',
        operator: '>=',
        threshold: 80,
        blocking: true
      };

      const data = {
        line_coverage: 90
      };

      const result = await service.evaluate(gate, data);

      expect(result).toBe(false);
    });

    it('should handle string comparison with equality', async () => {
      const gate: QualityGate = {
        name: 'status',
        metric: 'build_status',
        operator: '==',
        threshold: 'success',
        blocking: true
      };

      const data = {
        build_status: 'success'
      };

      const result = await service.evaluate(gate, data);

      expect(result).toBe(true);
    });

    it('should handle all comparison operators', async () => {
      const testCases = [
        { operator: '==', actual: 80, threshold: 80, expected: true },
        { operator: '==', actual: 80, threshold: 90, expected: false },
        { operator: '!=', actual: 80, threshold: 90, expected: true },
        { operator: '!=', actual: 80, threshold: 80, expected: false },
        { operator: '<', actual: 70, threshold: 80, expected: true },
        { operator: '<', actual: 80, threshold: 80, expected: false },
        { operator: '<=', actual: 80, threshold: 80, expected: true },
        { operator: '<=', actual: 90, threshold: 80, expected: false },
        { operator: '>', actual: 90, threshold: 80, expected: true },
        { operator: '>', actual: 80, threshold: 80, expected: false },
        { operator: '>=', actual: 80, threshold: 80, expected: true },
        { operator: '>=', actual: 70, threshold: 80, expected: false }
      ];

      for (const testCase of testCases) {
        const gate: QualityGate = {
          name: 'test',
          metric: 'value',
          operator: testCase.operator as any,
          threshold: testCase.threshold,
          blocking: true
        };

        const data = { value: testCase.actual };
        const result = await service.evaluate(gate, data);

        expect(result).toBe(testCase.expected);
      }
    });
  });

  describe('evaluateAll', () => {
    it('should evaluate all gates and return results', async () => {
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
        line_coverage: 90,
        critical_vulns: 0
      };

      const result = await service.evaluateAll(gates, data);

      expect(result.passed).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].passed).toBe(true);
      expect(result.results[1].passed).toBe(true);
    });

    it('should fail when one blocking gate fails', async () => {
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
        line_coverage: 90,
        critical_vulns: 2 // Fails
      };

      const result = await service.evaluateAll(gates, data);

      expect(result.passed).toBe(false);
      expect(result.results[0].passed).toBe(true);
      expect(result.results[1].passed).toBe(false);
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
          metric: 'p95_latency_ms',
          operator: '<',
          threshold: 500,
          blocking: false // Non-blocking
        }
      ];

      const data = {
        line_coverage: 90,
        p95_latency_ms: 600 // Fails but non-blocking
      };

      const result = await service.evaluateAll(gates, data);

      expect(result.passed).toBe(true); // Overall passes
      expect(result.results[0].passed).toBe(true);
      expect(result.results[1].passed).toBe(false);
    });
  });

  describe('getPolicyGate', () => {
    it('should return policy gate by name', () => {
      const gate = service.getPolicyGate('coverage');

      expect(gate).toBeDefined();
      expect(gate?.name).toBe('coverage');
      expect(gate?.metric).toBe('line_coverage');
    });

    it('should return undefined for unknown gate', () => {
      const gate = service.getPolicyGate('unknown');

      expect(gate).toBeUndefined();
    });
  });

  describe('getAllPolicyGates', () => {
    it('should return all loaded policy gates', () => {
      const gates = service.getAllPolicyGates();

      expect(gates.length).toBeGreaterThan(0);
      expect(gates.some(g => g.name === 'coverage')).toBe(true);
      expect(gates.some(g => g.name === 'security')).toBe(true);
    });
  });
});
