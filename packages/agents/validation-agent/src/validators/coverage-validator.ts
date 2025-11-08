import * as path from 'path';
import * as fs from 'fs-extra';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  ValidationCheckResult,
  CoverageValidationDetails
} from '../types';

const execAsync = promisify(exec);

/**
 * Validate test coverage with Vitest
 */
export async function validateCoverage(
  projectPath: string,
  threshold: number = 80
): Promise<ValidationCheckResult> {
  const startTime = Date.now();

  try {
    // Check if vitest config exists
    const possibleConfigs = [
      'vitest.config.ts',
      'vitest.config.js',
      'vite.config.ts',
      'vite.config.js'
    ];

    const hasVitestConfig = await Promise.any(
      possibleConfigs.map(config =>
        fs.pathExists(path.join(projectPath, config))
      )
    ).catch(() => false);

    if (!hasVitestConfig) {
      return {
        type: 'coverage',
        status: 'skipped',
        duration_ms: Date.now() - startTime,
        warnings: ['No Vitest configuration found, skipping coverage validation']
      };
    }

    // Check if coverage directory exists (from previous test runs)
    const coveragePath = path.join(projectPath, 'coverage');
    const coverageJsonPath = path.join(coveragePath, 'coverage-summary.json');

    // Try to run tests with coverage
    try {
      await execAsync(
        'npx vitest run --coverage --silent',
        {
          cwd: projectPath,
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
          timeout: 120000 // 2 minute timeout
        }
      );
    } catch (error) {
      // Tests might fail, but we still want to check coverage if available
      // Continue to coverage parsing
    }

    // Check if coverage report exists
    const hasCoverageReport = await fs.pathExists(coverageJsonPath);

    if (!hasCoverageReport) {
      return {
        type: 'coverage',
        status: 'failed',
        duration_ms: Date.now() - startTime,
        errors: ['No coverage report generated. Ensure tests run successfully.']
      };
    }

    // Read coverage summary
    const coverageSummary = await fs.readJSON(coverageJsonPath);

    // Extract total coverage
    const total = coverageSummary.total;

    if (!total) {
      return {
        type: 'coverage',
        status: 'failed',
        duration_ms: Date.now() - startTime,
        errors: ['Invalid coverage report format']
      };
    }

    const lineCoverage = total.lines?.pct || 0;
    const branchCoverage = total.branches?.pct || 0;
    const functionCoverage = total.functions?.pct || 0;
    const statementCoverage = total.statements?.pct || 0;

    // Find files with low coverage
    const uncoveredFiles: Array<{ file: string; coverage: number }> = [];
    for (const [file, fileCoverage] of Object.entries(coverageSummary)) {
      if (file === 'total') continue;

      const coverage: any = fileCoverage;
      const fileLineCoverage = coverage.lines?.pct || 0;

      if (fileLineCoverage < threshold) {
        uncoveredFiles.push({
          file: file.replace(projectPath, ''),
          coverage: fileLineCoverage
        });
      }
    }

    const passed = lineCoverage >= threshold;

    const details: CoverageValidationDetails = {
      line_coverage: lineCoverage,
      branch_coverage: branchCoverage,
      function_coverage: functionCoverage,
      statement_coverage: statementCoverage,
      threshold,
      passed,
      uncovered_files: uncoveredFiles.slice(0, 20) // Limit to 20 files
    };

    const status = passed ? 'passed' : 'failed';

    const errors = !passed
      ? [`Coverage ${lineCoverage.toFixed(2)}% is below threshold ${threshold}%`]
      : undefined;

    const warnings = uncoveredFiles.length > 0 && passed
      ? [`${uncoveredFiles.length} file(s) below coverage threshold`]
      : undefined;

    return {
      type: 'coverage',
      status,
      duration_ms: Date.now() - startTime,
      errors,
      warnings,
      details
    };
  } catch (error) {
    return {
      type: 'coverage',
      status: 'failed',
      duration_ms: Date.now() - startTime,
      errors: [`Coverage validation failed: ${error instanceof Error ? error.message : String(error)}`]
    };
  }
}
