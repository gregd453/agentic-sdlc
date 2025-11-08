import { E2ETestReport, TestExecutionResult } from '../types';

/**
 * Generate E2E test report
 */
export function generateE2EReport(
  taskId: string,
  workflowId: string,
  projectPath: string,
  generation: {
    scenarios_generated: number;
    test_files_created: number;
    page_objects_created: number;
    generation_time_ms: number;
  },
  execution: {
    browsers_tested: string[];
    results: TestExecutionResult[];
    total_duration_ms: number;
  } | undefined,
  artifacts: {
    test_files: string[];
    screenshots?: string[];
    videos?: string[];
    traces?: string[];
    html_report?: string;
  }
): E2ETestReport {
  // Calculate overall status
  let overall_status: 'passed' | 'failed' | 'partial' = 'passed';

  if (execution) {
    const totalTests = execution.results.reduce((sum, r) => sum + r.total_tests, 0);
    const totalPassed = execution.results.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = execution.results.reduce((sum, r) => sum + r.failed, 0);

    if (totalFailed > 0) {
      overall_status = totalPassed > 0 ? 'partial' : 'failed';
    }

    const overall_pass_rate = totalTests > 0 ? (totalPassed / totalTests) * 100 : 0;

    return {
      task_id: taskId,
      workflow_id: workflowId,
      project_path: projectPath,
      overall_status,
      generation,
      execution: {
        ...execution,
        overall_pass_rate
      },
      artifacts,
      recommendations: generateRecommendations(overall_status, execution.results, generation)
    };
  }

  // No execution phase (generation only)
  return {
    task_id: taskId,
    workflow_id: workflowId,
    project_path: projectPath,
    overall_status,
    generation,
    artifacts,
    recommendations: [
      'Tests generated successfully. Run tests to validate implementation.',
      `Generated ${generation.test_files_created} test file(s) and ${generation.page_objects_created} page object(s).`
    ]
  };
}

/**
 * Generate recommendations based on test results
 */
function generateRecommendations(
  status: string,
  results: TestExecutionResult[],
  generation: { scenarios_generated: number; test_files_created: number; page_objects_created: number }
): string[] {
  const recommendations: string[] = [];

  if (status === 'passed') {
    recommendations.push('✓ All tests passed successfully!');
    recommendations.push('Consider adding more edge case scenarios for better coverage.');
  } else if (status === 'failed') {
    recommendations.push('✗ Tests failed. Review failures and fix issues.');

    const failedTests = results.flatMap(r => r.failures || []);
    if (failedTests.length > 0) {
      recommendations.push(`Failed tests: ${failedTests.slice(0, 3).map(f => f.test_name).join(', ')}${failedTests.length > 3 ? '...' : ''}`);
    }

    recommendations.push('Check screenshots and videos for failure details.');
  } else if (status === 'partial') {
    recommendations.push('⚠ Some tests passed, some failed.');
    recommendations.push('Review failed tests and fix issues before deployment.');
  }

  // Browser-specific recommendations
  const browsersPassed = results.filter(r => r.failed === 0).map(r => r.browser);
  const browsersFailed = results.filter(r => r.failed > 0).map(r => r.browser);

  if (browsersFailed.length > 0) {
    recommendations.push(`Browsers with failures: ${browsersFailed.join(', ')}`);
  }

  if (browsersPassed.length > 0 && browsersFailed.length > 0) {
    recommendations.push('Cross-browser compatibility issues detected.');
  }

  // Generation recommendations
  if (generation.test_files_created > 0) {
    recommendations.push(`Generated ${generation.test_files_created} test file(s) with ${generation.scenarios_generated} scenario(s).`);
  }

  if (generation.page_objects_created > 0) {
    recommendations.push(`Created ${generation.page_objects_created} page object(s) for maintainable tests.`);
  }

  return recommendations;
}

/**
 * Format E2E report as text
 */
export function formatE2EReportAsText(report: E2ETestReport): string {
  const lines: string[] = [];

  lines.push('================================================================================');
  lines.push('E2E TEST REPORT');
  lines.push('================================================================================');
  lines.push('');
  lines.push(`Task ID:        ${report.task_id}`);
  lines.push(`Workflow ID:    ${report.workflow_id}`);
  lines.push(`Project Path:   ${report.project_path}`);
  lines.push(`Overall Status: ${report.overall_status.toUpperCase()}`);
  lines.push('');

  // Generation section
  lines.push('--------------------------------------------------------------------------------');
  lines.push('TEST GENERATION');
  lines.push('--------------------------------------------------------------------------------');
  lines.push(`Scenarios Generated:   ${report.generation.scenarios_generated}`);
  lines.push(`Test Files Created:    ${report.generation.test_files_created}`);
  lines.push(`Page Objects Created:  ${report.generation.page_objects_created}`);
  lines.push(`Generation Time:       ${report.generation.generation_time_ms}ms`);
  lines.push('');

  // Execution section
  if (report.execution) {
    lines.push('--------------------------------------------------------------------------------');
    lines.push('TEST EXECUTION');
    lines.push('--------------------------------------------------------------------------------');
    lines.push(`Browsers Tested: ${report.execution.browsers_tested.join(', ')}`);
    lines.push(`Pass Rate:       ${report.execution.overall_pass_rate.toFixed(2)}%`);
    lines.push(`Total Duration:  ${report.execution.total_duration_ms}ms`);
    lines.push('');

    lines.push('Results by Browser:');
    report.execution.results.forEach(result => {
      const status = result.failed === 0 ? '✓' : '✗';
      lines.push(`  ${status} ${result.browser.padEnd(10)} - ${result.passed}/${result.total_tests} passed (${result.failed} failed, ${result.skipped} skipped)`);

      if (result.failures && result.failures.length > 0) {
        result.failures.slice(0, 3).forEach(failure => {
          lines.push(`      - ${failure.test_name}: ${failure.error_message}`);
        });
        if (result.failures.length > 3) {
          lines.push(`      ... and ${result.failures.length - 3} more`);
        }
      }
    });
    lines.push('');
  }

  // Artifacts section
  lines.push('--------------------------------------------------------------------------------');
  lines.push('ARTIFACTS');
  lines.push('--------------------------------------------------------------------------------');
  lines.push(`Test Files:  ${report.artifacts.test_files.length}`);
  if (report.artifacts.screenshots) {
    lines.push(`Screenshots: ${report.artifacts.screenshots.length}`);
  }
  if (report.artifacts.videos) {
    lines.push(`Videos:      ${report.artifacts.videos.length}`);
  }
  if (report.artifacts.html_report) {
    lines.push(`HTML Report: ${report.artifacts.html_report}`);
  }
  lines.push('');

  // Recommendations
  lines.push('--------------------------------------------------------------------------------');
  lines.push('RECOMMENDATIONS');
  lines.push('--------------------------------------------------------------------------------');
  report.recommendations.forEach((rec, i) => {
    lines.push(`${i + 1}. ${rec}`);
  });

  lines.push('================================================================================');

  return lines.join('\n');
}
