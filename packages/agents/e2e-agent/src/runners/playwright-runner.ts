import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import pino from 'pino';
import { TestExecutionResult } from '../types';

const logger = pino({ name: 'playwright-runner' });

export interface PlaywrightRunOptions {
  project_path: string;
  test_path: string;
  browsers: string[];
  parallel?: boolean;
  headless?: boolean;
  screenshot_on_failure?: boolean;
  video_on_failure?: boolean;
  timeout_ms?: number;
  reporter?: string;
}

export interface PlaywrightRunResult {
  success: boolean;
  results: TestExecutionResult[];
  report_path?: string;
  duration_ms: number;
  stdout: string;
  stderr: string;
}

/**
 * Run Playwright tests
 */
export async function runPlaywrightTests(
  options: PlaywrightRunOptions
): Promise<PlaywrightRunResult> {
  const {
    project_path,
    test_path,
    browsers,
    parallel = true,
    headless = true,
    screenshot_on_failure = true,
    video_on_failure = false,
    timeout_ms = 30000,
    reporter = 'html'
  } = options;

  logger.info('Running Playwright tests', {
    project_path,
    test_path,
    browsers,
    parallel,
    headless
  });

  const startTime = Date.now();
  const results: TestExecutionResult[] = [];

  try {
    // Ensure Playwright config exists
    await ensurePlaywrightConfig(project_path, {
      browsers,
      headless,
      screenshot_on_failure,
      video_on_failure,
      timeout_ms,
      reporter
    });

    // Run tests for each browser
    for (const browser of browsers) {
      const result = await runTestsForBrowser(
        project_path,
        test_path,
        browser,
        headless,
        timeout_ms
      );
      results.push(result);
    }

    const duration_ms = Date.now() - startTime;
    const allPassed = results.every(r => r.failed === 0);
    const reportPath = path.join(project_path, 'playwright-report', 'index.html');

    logger.info('Playwright tests completed', {
      duration_ms,
      all_passed: allPassed,
      results_count: results.length
    });

    return {
      success: allPassed,
      results,
      report_path: await fs.pathExists(reportPath) ? reportPath : undefined,
      duration_ms,
      stdout: '',
      stderr: ''
    };
  } catch (error) {
    logger.error('Playwright test execution failed', { error });

    return {
      success: false,
      results,
      duration_ms: Date.now() - startTime,
      stdout: '',
      stderr: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Run tests for a specific browser
 */
async function runTestsForBrowser(
  projectPath: string,
  testPath: string,
  browser: string,
  headless: boolean,
  timeoutMs: number
): Promise<TestExecutionResult> {
  return new Promise((resolve, reject) => {
    const args = [
      'test',
      testPath,
      `--project=${browser}`,
      headless ? '--headed=false' : '--headed',
      `--timeout=${timeoutMs}`,
      '--reporter=json'
    ];

    const child = spawn('npx', ['playwright', ...args], {
      cwd: projectPath,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      try {
        // Parse Playwright JSON output
        const result = parsePlaywrightOutput(stdout, browser);
        resolve(result);
      } catch (error) {
        // Fallback result if parsing fails
        resolve({
          browser,
          total_tests: 0,
          passed: code === 0 ? 1 : 0,
          failed: code === 0 ? 0 : 1,
          skipped: 0,
          duration_ms: 0,
          failures: code !== 0 ? [{
            test_name: 'Unknown',
            error_message: stderr || 'Test execution failed'
          }] : []
        });
      }
    });

    child.on(LOG_LEVEL.ERROR, (error) => {
      reject(error);
    });
  });
}

/**
 * Parse Playwright JSON output
 */
function parsePlaywrightOutput(output: string, browser: string): TestExecutionResult {
  try {
    // Try to find JSON in the output
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in output');
    }

    const data = JSON.parse(jsonMatch[0]);

    const stats = data.stats || {};
    const failures = (data.failures || []).map((f: any) => ({
      test_name: f.test || f.title || 'Unknown',
      error_message: f.error || f.message || 'Test failed',
      screenshot_path: f.attachments?.find((a: any) => a.name === 'screenshot')?.path,
      video_path: f.attachments?.find((a: any) => a.name === 'video')?.path,
      trace_path: f.attachments?.find((a: any) => a.name === 'trace')?.path
    }));

    return {
      browser,
      total_tests: stats.total || stats.tests || 0,
      passed: stats.passed || stats.expected || 0,
      failed: stats.failed || stats.unexpected || 0,
      skipped: stats.skipped || 0,
      duration_ms: stats.duration || 0,
      failures: failures.length > 0 ? failures : undefined
    };
  } catch (error) {
    logger.warn('Failed to parse Playwright output, using defaults', { error });

    return {
      browser,
      total_tests: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration_ms: 0
    };
  }
}

/**
 * Ensure Playwright configuration exists
 */
async function ensurePlaywrightConfig(
  projectPath: string,
  config: {
    browsers: string[];
    headless: boolean;
    screenshot_on_failure: boolean;
    video_on_failure: boolean;
    timeout_ms: number;
    reporter: string;
  }
): Promise<void> {
  const configPath = path.join(projectPath, 'playwright.config.ts');

  // Check if config already exists
  if (await fs.pathExists(configPath)) {
    logger.info('Playwright config already exists', { config_path: configPath });
    return;
  }

  logger.info('Creating Playwright config', { config_path: configPath });

  const projects = config.browsers.map(browser => `
    {
      name: '${browser}',
      use: { ...devices['Desktop ${browser.charAt(0).toUpperCase() + browser.slice(1)}'] },
    }`).join(',');

  const configContent = `import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e-tests',
  timeout: ${config.timeout_ms},
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: '${config.reporter}',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: '${config.screenshot_on_failure ? 'only-on-failure' : 'off'}',
    video: '${config.video_on_failure ? 'retain-on-failure' : 'off'}',
    headless: ${config.headless},
  },
  projects: [${projects}
  ],
});
`;

  await fs.writeFile(configPath, configContent, 'utf-8');
  logger.info('Playwright config created successfully');
}
