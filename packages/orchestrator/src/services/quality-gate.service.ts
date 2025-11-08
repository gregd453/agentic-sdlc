import { QualityGate, QualityGateSchema } from '../types/pipeline.types';
import { logger } from '../utils/logger';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as yaml from 'yaml';

/**
 * Quality gate evaluation service
 * Enforces policy-based quality gates from policy.yaml
 */
export class QualityGateService {
  private policyGates: Map<string, QualityGate> = new Map();

  constructor(policyPath?: string) {
    this.loadPolicyGates(policyPath);
  }

  /**
   * Load quality gates from policy.yaml
   */
  private loadPolicyGates(policyPath?: string): void {
    try {
      const defaultPath = join(process.cwd(), 'ops', 'agentic', 'backlog', 'policy.yaml');
      const path = policyPath || defaultPath;

      const policyContent = readFileSync(path, 'utf-8');
      const policy = yaml.parse(policyContent);

      if (policy?.gates) {
        for (const [name, config] of Object.entries(policy.gates)) {
          const gate = config as any;
          this.policyGates.set(name, {
            name,
            metric: gate.metric,
            operator: gate.operator,
            threshold: gate.threshold,
            blocking: gate.blocking ?? true,
            description: gate.description
          });
        }

        logger.info('Loaded quality gates from policy', {
          count: this.policyGates.size,
          path
        });
      }
    } catch (error) {
      logger.warn('Failed to load policy gates, using defaults', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Load default gates
      this.loadDefaultGates();
    }
  }

  /**
   * Load default quality gates
   */
  private loadDefaultGates(): void {
    const defaults: QualityGate[] = [
      {
        name: 'coverage',
        metric: 'line_coverage',
        operator: '>=',
        threshold: 80,
        blocking: true,
        description: 'Minimum code coverage percentage'
      },
      {
        name: 'security',
        metric: 'critical_vulns',
        operator: '==',
        threshold: 0,
        blocking: true,
        description: 'Zero critical vulnerabilities allowed'
      },
      {
        name: 'contracts',
        metric: 'api_breaking_changes',
        operator: '==',
        threshold: 0,
        blocking: true,
        description: 'No breaking API changes without versioning'
      },
      {
        name: 'performance',
        metric: 'p95_latency_ms',
        operator: '<',
        threshold: 500,
        blocking: false,
        description: '95th percentile latency under 500ms'
      }
    ];

    for (const gate of defaults) {
      this.policyGates.set(gate.name, gate);
    }

    logger.info('Loaded default quality gates', { count: defaults.length });
  }

  /**
   * Evaluate a quality gate
   */
  async evaluate(
    gate: QualityGate,
    data: Record<string, unknown>
  ): Promise<boolean> {
    // Validate gate schema
    const validatedGate = QualityGateSchema.parse(gate);

    // Extract actual value from data
    const actualValue = this.extractMetricValue(data, validatedGate.metric);

    if (actualValue === undefined || actualValue === null) {
      logger.warn('Quality gate metric not found in data', {
        gate_name: validatedGate.name,
        metric: validatedGate.metric
      });
      return false;
    }

    // Perform comparison
    const passed = this.compareValues(
      actualValue,
      validatedGate.threshold,
      validatedGate.operator
    );

    logger.debug('Quality gate evaluated', {
      gate_name: validatedGate.name,
      metric: validatedGate.metric,
      actual_value: actualValue,
      threshold: validatedGate.threshold,
      operator: validatedGate.operator,
      passed
    });

    return passed;
  }

  /**
   * Evaluate all gates for a stage
   */
  async evaluateAll(
    gates: QualityGate[],
    data: Record<string, unknown>
  ): Promise<{
    passed: boolean;
    results: Array<{
      gate_name: string;
      passed: boolean;
      actual_value: number | string;
      threshold: number | string;
      blocking: boolean;
    }>;
  }> {
    const results = [];
    let allPassed = true;

    for (const gate of gates) {
      const passed = await this.evaluate(gate, data);
      const actualValue = this.extractMetricValue(data, gate.metric);

      results.push({
        gate_name: gate.name,
        passed,
        actual_value: actualValue as number | string,
        threshold: gate.threshold,
        blocking: gate.blocking
      });

      if (!passed && gate.blocking) {
        allPassed = false;
      }
    }

    return { passed: allPassed, results };
  }

  /**
   * Get policy gate by name
   */
  getPolicyGate(name: string): QualityGate | undefined {
    return this.policyGates.get(name);
  }

  /**
   * Get all policy gates
   */
  getAllPolicyGates(): QualityGate[] {
    return Array.from(this.policyGates.values());
  }

  /**
   * Extract metric value from data
   * Supports nested paths like 'coverage.line_coverage'
   */
  private extractMetricValue(
    data: Record<string, unknown>,
    metric: string
  ): number | string | undefined {
    const parts = metric.split('.');
    let current: any = data;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }

    return current as number | string | undefined;
  }

  /**
   * Compare values based on operator
   */
  private compareValues(
    actual: number | string,
    threshold: number | string,
    operator: '==' | '!=' | '<' | '<=' | '>' | '>='
  ): boolean {
    // Convert to numbers if possible
    const actualNum = typeof actual === 'number' ? actual : parseFloat(actual as string);
    const thresholdNum = typeof threshold === 'number' ? threshold : parseFloat(threshold as string);

    const useNumeric = !isNaN(actualNum) && !isNaN(thresholdNum);

    switch (operator) {
      case '==':
        return useNumeric ? actualNum === thresholdNum : actual === threshold;

      case '!=':
        return useNumeric ? actualNum !== thresholdNum : actual !== threshold;

      case '<':
        if (!useNumeric) {
          throw new Error(`Cannot use operator '${operator}' with non-numeric values`);
        }
        return actualNum < thresholdNum;

      case '<=':
        if (!useNumeric) {
          throw new Error(`Cannot use operator '${operator}' with non-numeric values`);
        }
        return actualNum <= thresholdNum;

      case '>':
        if (!useNumeric) {
          throw new Error(`Cannot use operator '${operator}' with non-numeric values`);
        }
        return actualNum > thresholdNum;

      case '>=':
        if (!useNumeric) {
          throw new Error(`Cannot use operator '${operator}' with non-numeric values`);
        }
        return actualNum >= thresholdNum;

      default:
        throw new Error(`Unknown operator: ${operator}`);
    }
  }

  /**
   * Reload policy gates from file
   */
  async reload(policyPath?: string): Promise<void> {
    this.policyGates.clear();
    this.loadPolicyGates(policyPath);
  }
}
