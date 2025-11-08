import {
  ValidationCheckResult,
  QualityGateResult,
  CoverageValidationDetails,
  SecurityValidationDetails,
  PolicyConfig
} from '../types';

/**
 * Evaluate quality gates based on policy and validation results
 */
export function evaluateQualityGates(
  validationChecks: ValidationCheckResult[],
  policy: PolicyConfig
): QualityGateResult {
  const gateDetails: Array<{
    gate_name: string;
    metric: string;
    threshold: number | string;
    actual: number | string;
    passed: boolean;
    blocking: boolean;
    operator: string;
  }> = [];

  const blockingFailures: string[] = [];
  const warnings: string[] = [];

  // If no gates configured, return basic result
  if (!policy.gates || Object.keys(policy.gates).length === 0) {
    return {
      passed: true,
      gates_evaluated: 0,
      gates_passed: 0,
      gates_failed: 0,
      blocking_failures: [],
      details: []
    };
  }

  // Evaluate each gate
  for (const [gateName, gateConfig] of Object.entries(policy.gates)) {
    const evaluation = evaluateGate(gateName, gateConfig, validationChecks);

    // Skip gates that don't have corresponding validation data
    if (evaluation === null) {
      continue;
    }

    gateDetails.push(evaluation);

    if (!evaluation.passed) {
      const message = `${gateName}: ${evaluation.metric} ${evaluation.operator} ${evaluation.threshold} (actual: ${evaluation.actual})`;

      if (evaluation.blocking) {
        blockingFailures.push(message);
      } else {
        warnings.push(message);
      }
    }
  }

  const gatesPassed = gateDetails.filter(d => d.passed).length;
  const gatesFailed = gateDetails.filter(d => !d.passed).length;

  return {
    passed: blockingFailures.length === 0,
    gates_evaluated: gateDetails.length,
    gates_passed: gatesPassed,
    gates_failed: gatesFailed,
    blocking_failures: blockingFailures,
    warnings: warnings.length > 0 ? warnings : undefined,
    details: gateDetails
  };
}

/**
 * Evaluate a single quality gate
 */
function evaluateGate(
  gateName: string,
  gateConfig: {
    metric: string;
    operator: string;
    threshold: number | string;
    description: string;
    blocking: boolean;
  },
  validationChecks: ValidationCheckResult[]
): {
  gate_name: string;
  metric: string;
  threshold: number | string;
  actual: number | string;
  passed: boolean;
  blocking: boolean;
  operator: string;
} | null {
  const { metric, operator, threshold, blocking } = gateConfig;

  // Extract actual value based on metric
  let actual: number | string | null = 0;

  switch (metric) {
    case 'line_coverage':
    case 'coverage':
      actual = extractCoverageMetric(validationChecks, 'line_coverage');
      break;

    case 'branch_coverage':
      actual = extractCoverageMetric(validationChecks, 'branch_coverage');
      break;

    case 'function_coverage':
      actual = extractCoverageMetric(validationChecks, 'function_coverage');
      break;

    case 'statement_coverage':
      actual = extractCoverageMetric(validationChecks, 'statement_coverage');
      break;

    case 'critical_vulns':
      actual = extractSecurityMetric(validationChecks, 'critical_vulnerabilities');
      break;

    case 'high_vulns':
      actual = extractSecurityMetric(validationChecks, 'high_vulnerabilities');
      break;

    case 'total_vulns':
      actual = extractSecurityMetric(validationChecks, 'total_vulnerabilities');
      break;

    default:
      // Unknown metric, skip
      return null;
  }

  // If validation data is not available, skip this gate
  if (actual === null) {
    return null;
  }

  // Evaluate based on operator
  const passed = evaluateOperator(actual, operator, threshold);

  return {
    gate_name: gateName,
    metric,
    threshold,
    actual,
    passed,
    blocking,
    operator
  };
}

/**
 * Extract coverage metric from validation checks
 * Returns null if coverage check was not run
 */
function extractCoverageMetric(
  checks: ValidationCheckResult[],
  metricName: keyof CoverageValidationDetails
): number | null {
  const coverageCheck = checks.find(c => c.type === 'coverage');

  // If coverage check was not run, return null to skip gate
  if (!coverageCheck || coverageCheck.status === 'skipped') {
    return null;
  }

  if (!coverageCheck.details) {
    return 0;
  }

  const details = coverageCheck.details as CoverageValidationDetails;
  return details[metricName] as number || 0;
}

/**
 * Extract security metric from validation checks
 * Returns null if security check was not run
 */
function extractSecurityMetric(
  checks: ValidationCheckResult[],
  metricName: keyof SecurityValidationDetails
): number | null {
  const securityCheck = checks.find(c => c.type === 'security');

  // If security check was not run, return null to skip gate
  if (!securityCheck || securityCheck.status === 'skipped') {
    return null;
  }

  if (!securityCheck.details) {
    return 0;
  }

  const details = securityCheck.details as SecurityValidationDetails;
  return details[metricName] as number || 0;
}

/**
 * Evaluate comparison operator
 */
function evaluateOperator(
  actual: number | string,
  operator: string,
  threshold: number | string
): boolean {
  // Convert to numbers if possible
  const actualNum = typeof actual === 'number' ? actual : parseFloat(String(actual));
  const thresholdNum = typeof threshold === 'number' ? threshold : parseFloat(String(threshold));

  if (isNaN(actualNum) || isNaN(thresholdNum)) {
    // String comparison
    switch (operator) {
      case '==':
      case '===':
        return actual === threshold;
      case '!=':
      case '!==':
        return actual !== threshold;
      default:
        return false;
    }
  }

  // Numeric comparison
  switch (operator) {
    case '>':
      return actualNum > thresholdNum;
    case '>=':
      return actualNum >= thresholdNum;
    case '<':
      return actualNum < thresholdNum;
    case '<=':
      return actualNum <= thresholdNum;
    case '==':
    case '===':
      return actualNum === thresholdNum;
    case '!=':
    case '!==':
      return actualNum !== thresholdNum;
    default:
      return false;
  }
}
