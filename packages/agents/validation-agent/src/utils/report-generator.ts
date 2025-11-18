import {
  ValidationReport,
  ValidationCheckResult,
  QualityGateResult
} from '../types';

/**
 * Generate a comprehensive validation report
 */
export function generateValidationReport(
  taskId: string,
  workflowId: string,
  projectPath: string,
  validationChecks: ValidationCheckResult[],
  qualityGates: QualityGateResult,
  startTime: number
): ValidationReport {
  const totalDuration = Date.now() - startTime;

  // Calculate summary
  const passedChecks = validationChecks.filter(c => c.status === 'passed').length;
  const failedChecks = validationChecks.filter(c => c.status === WORKFLOW_STATUS.FAILED).length;
  const warningChecks = validationChecks.filter(c => c.status === 'warning').length;

  // Determine overall status
  let overallStatus: 'passed' | WORKFLOW_STATUS.FAILED | 'warning';
  if (failedChecks > 0 || !qualityGates.passed) {
    overallStatus = WORKFLOW_STATUS.FAILED;
  } else if (warningChecks > 0) {
    overallStatus = 'warning';
  } else {
    overallStatus = 'passed';
  }

  // Generate recommendations
  const recommendations = generateRecommendations(validationChecks, qualityGates);

  return {
    task_id: taskId,
    workflow_id: workflowId,
    timestamp: new Date().toISOString(),
    project_path: projectPath,
    overall_status: overallStatus,
    validation_checks: validationChecks,
    quality_gates: qualityGates,
    summary: {
      total_checks: validationChecks.length,
      passed_checks: passedChecks,
      failed_checks: failedChecks,
      warning_checks: warningChecks,
      total_duration_ms: totalDuration
    },
    recommendations
  };
}

/**
 * Generate actionable recommendations based on validation results
 */
function generateRecommendations(
  checks: ValidationCheckResult[],
  gates: QualityGateResult
): string[] {
  const recommendations: string[] = [];

  // Check for TypeScript errors
  const tsCheck = checks.find(c => c.type === 'typescript' && c.status === WORKFLOW_STATUS.FAILED);
  if (tsCheck) {
    recommendations.push(
      'Fix TypeScript compilation errors before proceeding. Run `pnpm typecheck` for details.'
    );
  }

  // Check for ESLint errors
  const lintCheck = checks.find(c => c.type === 'eslint' && c.status === WORKFLOW_STATUS.FAILED);
  if (lintCheck) {
    recommendations.push(
      'Address ESLint errors. Run `pnpm lint --fix` to auto-fix some issues.'
    );
  }

  // Check for coverage issues
  const coverageCheck = checks.find(c => c.type === 'coverage' && c.status === WORKFLOW_STATUS.FAILED);
  if (coverageCheck) {
    recommendations.push(
      'Increase test coverage. Add unit tests for uncovered code paths.'
    );
  }

  // Check for security issues
  const securityCheck = checks.find(c => c.type === 'security' && c.status === WORKFLOW_STATUS.FAILED);
  if (securityCheck) {
    recommendations.push(
      'Fix security vulnerabilities. Run `npm audit fix` or update vulnerable packages.'
    );
  }

  // Check quality gates
  if (!gates.passed && gates.blocking_failures.length > 0) {
    recommendations.push(
      `Quality gates failed: ${gates.blocking_failures.join(', ')}. Review policy.yaml for thresholds.`
    );
  }

  // If no specific recommendations, provide general guidance
  if (recommendations.length === 0) {
    recommendations.push('All validation checks passed. Ready for next stage.');
  }

  return recommendations;
}

/**
 * Format validation report as human-readable text
 */
export function formatReportAsText(report: ValidationReport): string {
  const lines: string[] = [];

  lines.push('='.repeat(80));
  lines.push(`VALIDATION REPORT`);
  lines.push('='.repeat(80));
  lines.push('');
  lines.push(`Task ID:       ${report.task_id}`);
  lines.push(`Workflow ID:   ${report.workflow_id}`);
  lines.push(`Timestamp:     ${report.timestamp}`);
  lines.push(`Project Path:  ${report.project_path}`);
  lines.push(`Overall Status: ${report.overall_status.toUpperCase()}`);
  lines.push('');

  // Summary
  lines.push('-'.repeat(80));
  lines.push('SUMMARY');
  lines.push('-'.repeat(80));
  lines.push(`Total Checks:   ${report.summary.total_checks}`);
  lines.push(`Passed:         ${report.summary.passed_checks}`);
  lines.push(`Failed:         ${report.summary.failed_checks}`);
  lines.push(`Warnings:       ${report.summary.warning_checks}`);
  lines.push(`Duration:       ${report.summary.total_duration_ms}ms`);
  lines.push('');

  // Validation Checks
  lines.push('-'.repeat(80));
  lines.push('VALIDATION CHECKS');
  lines.push('-'.repeat(80));
  for (const check of report.validation_checks) {
    const statusSymbol = check.status === 'passed' ? '✓' :
                         check.status === WORKFLOW_STATUS.FAILED ? '✗' : '⚠';
    lines.push(`${statusSymbol} ${check.type.toUpperCase()}: ${check.status} (${check.duration_ms}ms)`);

    if (check.errors && check.errors.length > 0) {
      check.errors.forEach(err => lines.push(`  ERROR: ${err}`));
    }
    if (check.warnings && check.warnings.length > 0) {
      check.warnings.forEach(warn => lines.push(`  WARNING: ${warn}`));
    }
  }
  lines.push('');

  // Quality Gates
  lines.push('-'.repeat(80));
  lines.push('QUALITY GATES');
  lines.push('-'.repeat(80));
  lines.push(`Overall: ${report.quality_gates.passed ? 'PASSED ✓' : 'FAILED ✗'}`);
  lines.push(`Evaluated: ${report.quality_gates.gates_evaluated}`);
  lines.push(`Passed:    ${report.quality_gates.gates_passed}`);
  lines.push(`Failed:    ${report.quality_gates.gates_failed}`);

  if (report.quality_gates.blocking_failures.length > 0) {
    lines.push('');
    lines.push('Blocking Failures:');
    report.quality_gates.blocking_failures.forEach(failure =>
      lines.push(`  - ${failure}`)
    );
  }
  lines.push('');

  // Recommendations
  if (report.recommendations && report.recommendations.length > 0) {
    lines.push('-'.repeat(80));
    lines.push('RECOMMENDATIONS');
    lines.push('-'.repeat(80));
    report.recommendations.forEach((rec, idx) =>
      lines.push(`${idx + 1}. ${rec}`)
    );
    lines.push('');
  }

  lines.push('='.repeat(80));

  return lines.join('\n');
}
