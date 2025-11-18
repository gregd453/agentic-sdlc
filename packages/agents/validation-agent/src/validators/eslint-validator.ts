import * as path from 'path';
import * as fs from 'fs-extra';
import { ESLint } from 'eslint';
import {
  ValidationCheckResult,
  ESLintValidationDetails
} from '../types';

/**
 * Validate code with ESLint
 */
export async function validateESLint(
  projectPath: string
): Promise<ValidationCheckResult> {
  const startTime = Date.now();

  try {
    // Check if ESLint config exists
    const possibleConfigs = [
      '.eslintrc',
      '.eslintrc.js',
      '.eslintrc.cjs',
      '.eslintrc.json',
      '.eslintrc.yml',
      '.eslintrc.yaml',
      'eslint.config.js'
    ];

    const hasEslintConfig = await Promise.any(
      possibleConfigs.map(config =>
        fs.pathExists(path.join(projectPath, config))
      )
    ).catch(() => false);

    if (!hasEslintConfig) {
      return {
        type: 'eslint',
        status: 'skipped',
        duration_ms: Date.now() - startTime,
        warnings: ['No ESLint configuration found, skipping ESLint validation']
      };
    }

    // Initialize ESLint
    const eslint = new ESLint({
      cwd: projectPath
    });

    // Lint source files (typically src/ or lib/)
    const srcPath = path.join(projectPath, 'src');
    const hasSrcDir = await fs.pathExists(srcPath);

    if (!hasSrcDir) {
      return {
        type: 'eslint',
        status: 'skipped',
        duration_ms: Date.now() - startTime,
        warnings: ['No src/ directory found, skipping ESLint validation']
      };
    }

    // Run ESLint
    const results = await eslint.lintFiles([`${srcPath}/**/*.{ts,tsx,js,jsx}`]);

    // Calculate totals
    let errorCount = 0;
    let warningCount = 0;
    let fixableErrorCount = 0;
    let fixableWarningCount = 0;
    const filesChecked = results.length;

    const issues: Array<{
      file: string;
      line: number;
      column: number;
      severity: 'error' | 'warning';
      message: string;
      rule_id?: string;
    }> = [];

    for (const result of results) {
      errorCount += result.errorCount;
      warningCount += result.warningCount;
      fixableErrorCount += result.fixableErrorCount;
      fixableWarningCount += result.fixableWarningCount;

      // Collect issues
      for (const message of result.messages) {
        issues.push({
          file: result.filePath,
          line: message.line,
          column: message.column,
          severity: message.severity === 2 ? 'error' : 'warning',
          message: message.message,
          rule_id: message.ruleId || undefined
        });
      }
    }

    const details: ESLintValidationDetails = {
      error_count: errorCount,
      warning_count: warningCount,
      files_checked: filesChecked,
      fixable_errors: fixableErrorCount,
      fixable_warnings: fixableWarningCount,
      issues: issues.slice(0, 50) // Limit to first 50 issues
    };

    // Determine status
    const status = errorCount > 0 ? 'failed' : warningCount > 0 ? 'warning' : 'passed';

    const errors = errorCount > 0
      ? [`Found ${errorCount} ESLint error(s) across ${filesChecked} file(s)`]
      : undefined;

    const warnings = warningCount > 0
      ? [`Found ${warningCount} ESLint warning(s) across ${filesChecked} file(s)`]
      : undefined;

    return {
      type: 'eslint',
      status,
      duration_ms: Date.now() - startTime,
      errors,
      warnings,
      details
    };
  } catch (error) {
    return {
      type: 'eslint',
      status: 'failed',
      duration_ms: Date.now() - startTime,
      errors: [`ESLint validation failed: ${error instanceof Error ? error.message : String(error)}`]
    };
  }
}
