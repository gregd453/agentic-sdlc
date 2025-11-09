import { BaseAgent, TaskAssignment, TaskResult } from '@agentic-sdlc/base-agent';
import path from 'path';
import {
  E2ETaskContext,
  E2ETaskContextSchema,
  E2ETestReport,
  TestExecutionResult
} from './types';
import { generateTestScenarios, generateTestFiles } from './generators/test-generator';
import { generatePageObjectFiles, generatePageObjectsIndex } from './generators/page-object-generator';
import { runPlaywrightTests } from './runners/playwright-runner';
import { ArtifactStorage } from './utils/artifact-storage';
import { generateE2EReport, formatE2EReportAsText } from './utils/report-generator';

/**
 * E2EAgent - Generates and executes end-to-end tests using Playwright
 */
export class E2EAgent extends BaseAgent {
  private anthropicApiKey: string;

  constructor() {
    super({
      type: 'e2e',
      version: '1.0.0',
      capabilities: [
        'test-generation',
        'playwright-integration',
        'page-object-model',
        'multi-browser',
        'screenshot-capture',
        'video-capture',
        'artifact-storage'
      ]
    });

    this.anthropicApiKey = process.env.ANTHROPIC_API_KEY || '';

    if (!this.anthropicApiKey) {
      this.logger.warn('ANTHROPIC_API_KEY not set, test generation will fail');
    }
  }

  /**
   * Execute E2E test task
   */
  async execute(task: TaskAssignment): Promise<TaskResult> {
    const startTime = Date.now();
    const traceId = this.generateTraceId();

    this.logger.info('Executing E2E test task', {
      task_id: task.task_id,
      workflow_id: task.workflow_id,
      trace_id: traceId
    });

    try {
      // Parse and validate task context
      const context = this.parseTaskContext(task);

      // Phase 1: Generate tests
      const generationStart = Date.now();
      const { testFiles, pageObjectFiles, scenariosGenerated, pageObjectsGenerated } =
        await this.generateTests(context);
      const generationTime = Date.now() - generationStart;

      // Phase 2: Store generated files
      const storage = new ArtifactStorage({
        storage_type: context.artifact_storage || 'local',
        local_path: context.test_output_path || path.join(context.project_path, 'e2e-tests'),
        s3_bucket: context.s3_bucket
      });

      const testOutputPath = context.test_output_path ||
        path.join(context.project_path, 'e2e-tests');

      const testArtifacts = await storage.storeTestFiles(testFiles, testOutputPath);
      const pageObjectArtifacts = await storage.storePageObjectFiles(
        pageObjectFiles,
        testOutputPath
      );

      // Store page objects index
      const indexContent = generatePageObjectsIndex(
        Array.from(pageObjectFiles.keys()).map(name => ({
          name: name.replace('.page.ts', ''),
          url: '/',
          selectors: {},
          methods: []
        }))
      );
      await storage.storeTestFiles(
        new Map([['pages/index.ts', indexContent]]),
        testOutputPath
      );

      this.logger.info('Test files generated and stored', {
        test_files: testArtifacts.length,
        page_objects: pageObjectArtifacts.length,
        output_path: testOutputPath
      });

      // Phase 3: Execute tests (optional - based on context)
      let execution: {
        browsers_tested: string[];
        results: TestExecutionResult[];
        total_duration_ms: number;
      } | undefined;

      let playwrightArtifacts: {
        screenshots: any[];
        videos: any[];
        traces: any[];
        reports: any[];
      } | undefined;

      if (context.base_url) {
        this.logger.info('Executing generated tests', { base_url: context.base_url });

        const executionStart = Date.now();
        const runResult = await runPlaywrightTests({
          project_path: context.project_path,
          test_path: testOutputPath,
          browsers: context.browsers || ['chromium'],
          parallel: context.parallel,
          headless: context.headless,
          screenshot_on_failure: context.screenshot_on_failure,
          video_on_failure: context.video_on_failure,
          timeout_ms: context.test_timeout_ms
        });

        execution = {
          browsers_tested: context.browsers || ['chromium'],
          results: runResult.results,
          total_duration_ms: Date.now() - executionStart
        };

        // Collect artifacts from test run
        playwrightArtifacts = await storage.collectPlaywrightArtifacts(context.project_path);

        this.logger.info('Tests executed', {
          success: runResult.success,
          duration_ms: execution.total_duration_ms
        });
      }

      // Generate comprehensive report
      const report = generateE2EReport(
        task.task_id,
        task.workflow_id,
        context.project_path,
        {
          scenarios_generated: scenariosGenerated,
          test_files_created: testFiles.size,
          page_objects_created: pageObjectFiles.size,
          generation_time_ms: generationTime
        },
        execution,
        {
          test_files: testArtifacts.map(a => a.path),
          screenshots: playwrightArtifacts?.screenshots.map(a => a.path),
          videos: playwrightArtifacts?.videos.map(a => a.path),
          traces: playwrightArtifacts?.traces.map(a => a.path),
          html_report: playwrightArtifacts?.reports[0]?.path
        }
      );

      // Log formatted report
      const formattedReport = formatE2EReportAsText(report);
      this.logger.info('E2E test report:\n' + formattedReport);

      // Determine next stage
      const nextStage = report.overall_status === 'passed'
        ? 'deployment'
        : 'validation';

      return {
        task_id: task.task_id,
        workflow_id: task.workflow_id,
        status: report.overall_status === 'failed' ? 'failure' : 'success',
        output: {
          report: formattedReport,
          scenarios_generated: scenariosGenerated,
          test_files_created: testFiles.size,
          page_objects_created: pageObjectFiles.size,
          artifacts: {
            test_files: testArtifacts.map(a => a.path),
            page_objects: pageObjectArtifacts.map(a => a.path),
            screenshots: playwrightArtifacts?.screenshots.map(a => a.path) || [],
            videos: playwrightArtifacts?.videos.map(a => a.path) || [],
            html_report: playwrightArtifacts?.reports[0]?.path
          }
        },
        metrics: {
          duration_ms: Date.now() - startTime,
          api_calls: 1  // Claude API call for test generation
        },
        next_stage: nextStage
      };
    } catch (error) {
      this.logger.error('E2E test task failed', { error, task_id: task.task_id });

      return {
        task_id: task.task_id,
        workflow_id: task.workflow_id,
        status: 'failure',
        output: {
          error: `E2E test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        },
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Parse and validate task context
   */
  private parseTaskContext(task: TaskAssignment): E2ETaskContext {
    try {
      const context = E2ETaskContextSchema.parse(task.context);
      return context;
    } catch (error) {
      this.logger.error('Invalid task context', { error, context: task.context });
      throw new Error(`Invalid task context: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate test files and page objects
   */
  private async generateTests(context: E2ETaskContext): Promise<{
    testFiles: Map<string, string>;
    pageObjectFiles: Map<string, string>;
    scenariosGenerated: number;
    pageObjectsGenerated: number;
  }> {
    this.logger.info('Generating E2E tests with Claude', {
      project_path: context.project_path,
      base_url: context.base_url
    });

    // Generate test scenarios using Claude
    const { scenarios, pageObjects } = await generateTestScenarios({
      requirements: context.requirements || 'Generate comprehensive E2E tests for the application',
      baseUrl: context.base_url || 'http://localhost:3000',
      anthropicApiKey: this.anthropicApiKey
    });

    this.logger.info('Test scenarios generated', {
      scenarios_count: scenarios.length,
      page_objects_count: pageObjects.length
    });

    // Generate test files
    const testFiles = generateTestFiles(scenarios, pageObjects);

    // Generate page object files
    const pageObjectFiles = await generatePageObjectFiles(
      pageObjects,
      this.anthropicApiKey,
      false // Use template-based generation for speed
    );

    return {
      testFiles,
      pageObjectFiles,
      scenariosGenerated: scenarios.length,
      pageObjectsGenerated: pageObjects.length
    };
  }
}

/**
 * Calculate overall pass rate from test results
 */
function calculatePassRate(results: TestExecutionResult[]): number {
  const totalTests = results.reduce((sum, r) => sum + r.total_tests, 0);
  const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);

  return totalTests > 0 ? (totalPassed / totalTests) * 100 : 0;
}
