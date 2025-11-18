import { spawn } from 'child_process';
import { join } from 'path';
import { promises as fs } from 'fs';
import { IntegrationTestResult } from '../types';

/**
 * Test execution options
 */
export interface TestOptions {
  timeout?: number;
  failFast?: boolean;
  coverage?: boolean;
  verbose?: boolean;
}

/**
 * IntegrationTestRunnerService - Executes integration tests
 * Supports multiple test runners and environments
 */
export class IntegrationTestRunnerService {
  private repoPath: string;

  constructor(repoPath: string = process.cwd()) {
    this.repoPath = repoPath;
  }

  /**
   * Run integration tests
   */
  async runTests(
    testSuite?: string,
    environment: 'local' | 'staging' | 'ci' = 'local',
    options: TestOptions = {}
  ): Promise<IntegrationTestResult> {
    const startTime = Date.now();

    try {
      // Determine test command based on package.json
      const testCommand = await this.getTestCommand(testSuite);

      // Set environment variables
      const env = this.buildEnvironment(environment);

      // Run tests
      const result = await this.executeTests(testCommand, env, options);

      const duration = Date.now() - startTime;

      return {
        success: result.exitCode === 0,
        total_tests: result.total,
        passed: result.passed,
        failed: result.failed,
        skipped: result.skipped,
        duration_ms: duration,
        failed_tests: result.failedTests
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        total_tests: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration_ms: duration,
        failed_tests: [{
          name: 'Test execution failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        }]
      };
    }
  }

  /**
   * Get test command from package.json
   */
  private async getTestCommand(testSuite?: string): Promise<string[]> {
    try {
      const packageJsonPath = join(this.repoPath, 'package.json');
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);

      // Check for specific test suite
      if (testSuite && packageJson.scripts?.[testSuite]) {
        return this.parseCommand(packageJson.scripts[testSuite]);
      }

      // Default to test script
      if (packageJson.scripts?.test) {
        return this.parseCommand(packageJson.scripts.test);
      }

      // Fallback to common test runners
      if (await this.fileExists(join(this.repoPath, 'vitest.config.ts'))) {
        return ['npx', 'vitest', 'run'];
      }

      if (await this.fileExists(join(this.repoPath, 'jest.config.js'))) {
        return ['npx', 'jest'];
      }

      throw new Error('No test command found in package.json');

    } catch (error) {
      throw new Error(`Failed to determine test command: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse command string into array
   */
  private parseCommand(command: string): string[] {
    // Simple command parsing (handles basic cases)
    return command.split(/\s+/);
  }

  /**
   * Build environment variables for test execution
   */
  private buildEnvironment(environment: 'local' | 'staging' | 'ci'): Record<string, string> {
    const env = { ...process.env } as Record<string, string>;

    // Set NODE_ENV
    env.NODE_ENV = 'test';

    // Set environment-specific variables
    switch (environment) {
      case 'staging':
        env.TEST_ENV = 'staging';
        break;
      case 'ci':
        env.CI = 'true';
        env.TEST_ENV = 'ci';
        break;
      case 'local':
      default:
        env.TEST_ENV = 'local';
        break;
    }

    return env;
  }

  /**
   * Execute tests and capture results
   */
  private async executeTests(
    command: string[],
    env: Record<string, string>,
    options: TestOptions
  ): Promise<{
    exitCode: number;
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    failedTests: Array<{ name: string; error: string }>;
  }> {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command;

      // Add options to args
      if (options.failFast) {
        args.push('--bail');
      }
      if (options.coverage) {
        args.push('--coverage');
      }
      if (options.verbose) {
        args.push('--verbose');
      }

      const child = spawn(cmd, args, {
        cwd: this.repoPath,
        env,
        shell: true
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      // Handle timeout
      let timeoutId: NodeJS.Timeout | undefined;
      if (options.timeout) {
        timeoutId = setTimeout(() => {
          child.kill('SIGTERM');
          reject(new Error(`Tests timed out after ${options.timeout}ms`));
        }, options.timeout);
      }

      child.on('close', (code) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        const result = this.parseTestOutput(stdout, stderr);
        result.exitCode = code || 0;

        resolve(result);
      });

      child.on(LOG_LEVEL.ERROR, (error) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        reject(error);
      });
    });
  }

  /**
   * Parse test output to extract results
   */
  private parseTestOutput(stdout: string, stderr: string): {
    exitCode: number;
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    failedTests: Array<{ name: string; error: string }>;
  } {
    const result = {
      exitCode: 0,
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      failedTests: [] as Array<{ name: string; error: string }>
    };

    const output = stdout + stderr;

    // Try to parse Vitest output
    const vitestMatch = output.match(/Test Files\s+(\d+)\s+passed.*?Tests\s+(\d+)\s+passed/s);
    if (vitestMatch) {
      result.passed = parseInt(vitestMatch[2], 10);
      result.total = result.passed;
    }

    // Try to parse Jest output
    const jestMatch = output.match(/Tests:\s+(\d+)\s+passed,\s+(\d+)\s+total/);
    if (jestMatch) {
      result.passed = parseInt(jestMatch[1], 10);
      result.total = parseInt(jestMatch[2], 10);
    }

    // Parse failed tests
    const failedMatch = output.match(/(\d+)\s+failed/i);
    if (failedMatch) {
      result.failed = parseInt(failedMatch[1], 10);
    }

    // Parse skipped tests
    const skippedMatch = output.match(/(\d+)\s+skipped/i);
    if (skippedMatch) {
      result.skipped = parseInt(skippedMatch[1], 10);
    }

    // Calculate total if not already set
    if (result.total === 0) {
      result.total = result.passed + result.failed + result.skipped;
    }

    // Extract failed test names (basic pattern matching)
    const failedTestPattern = /✗\s+(.+?)(?:\n|$)/g;
    let match;
    while ((match = failedTestPattern.exec(output)) !== null) {
      result.failedTests.push({
        name: match[1].trim(),
        error: 'Test failed (see logs for details)'
      });
    }

    return result;
  }

  /**
   * Check if file exists
   */
  private async fileExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get test coverage report
   */
  async getCoverageReport(): Promise<{
    overall: number;
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  }> {
    try {
      const coveragePath = join(this.repoPath, 'coverage', 'coverage-summary.json');
      const content = await fs.readFile(coveragePath, 'utf-8');
      const coverage = JSON.parse(content);

      const total = coverage.total;

      return {
        overall: total.statements.pct,
        statements: total.statements.pct,
        branches: total.branches.pct,
        functions: total.functions.pct,
        lines: total.lines.pct
      };
    } catch (error) {
      throw new Error(`Failed to read coverage report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Run specific test file
   */
  async runTestFile(filePath: string, options: TestOptions = {}): Promise<IntegrationTestResult> {
    const startTime = Date.now();

    try {
      // Determine test runner
      const hasVitest = await this.fileExists(join(this.repoPath, 'vitest.config.ts'));
      const command = hasVitest
        ? ['npx', 'vitest', 'run', filePath]
        : ['npx', 'jest', filePath];

      const env = this.buildEnvironment('local');
      const result = await this.executeTests(command, env, options);

      const duration = Date.now() - startTime;

      return {
        success: result.exitCode === 0,
        total_tests: result.total,
        passed: result.passed,
        failed: result.failed,
        skipped: result.skipped,
        duration_ms: duration,
        failed_tests: result.failedTests
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        total_tests: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration_ms: duration,
        failed_tests: [{
          name: filePath,
          error: error instanceof Error ? error.message : 'Unknown error'
        }]
      };
    }
  }
}
