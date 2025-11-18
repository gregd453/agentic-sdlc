import { z } from 'zod';

/**
 * Task context schema for E2E test generation
 */
export const E2ETaskContextSchema = z.object({
  project_path: z.string().describe('Path to the project to test'),
  base_url: z.string().url().optional().describe('Base URL for the application'),
  test_output_path: z.string().optional().describe('Output path for generated tests'),
  browsers: z.array(z.enum(['chromium', 'firefox', 'webkit'])).optional().default(['chromium']),
  parallel: z.boolean().optional().default(true).describe('Run tests in parallel'),
  headless: z.boolean().optional().default(true).describe('Run tests in headless mode'),
  screenshot_on_failure: z.boolean().optional().default(true),
  video_on_failure: z.boolean().optional().default(false),
  artifact_storage: z.enum(['local', 's3']).optional().default('local'),
  s3_bucket: z.string().optional().describe('S3 bucket for artifact storage'),
  test_timeout_ms: z.number().optional().default(30000),
  requirements: z.string().optional().describe('Test requirements/scenarios to generate')
});

export type E2ETaskContext = z.infer<typeof E2ETaskContextSchema>;

/**
 * Test scenario schema
 */
export const TestScenarioSchema = z.object({
  name: z.string(),
  description: z.string(),
  steps: z.array(z.object({
    action: z.string(),
    selector: z.string().optional(),
    value: z.string().optional(),
    assertion: z.string().optional()
  })),
  priority: z.enum([TASK_PRIORITY.CRITICAL, TASK_PRIORITY.HIGH, TASK_PRIORITY.MEDIUM, TASK_PRIORITY.LOW]).default(TASK_PRIORITY.MEDIUM)
});

export type TestScenario = z.infer<typeof TestScenarioSchema>;

/**
 * Page object model schema
 */
export const PageObjectSchema = z.object({
  name: z.string(),
  url: z.string(),
  selectors: z.record(z.string()),
  methods: z.array(z.object({
    name: z.string(),
    description: z.string(),
    parameters: z.array(z.string()).optional()
  }))
});

export type PageObject = z.infer<typeof PageObjectSchema>;

/**
 * Generated test file schema
 */
export const GeneratedTestFileSchema = z.object({
  file_path: z.string(),
  content: z.string(),
  page_objects: z.array(PageObjectSchema).optional(),
  scenarios_covered: z.array(z.string())
});

export type GeneratedTestFile = z.infer<typeof GeneratedTestFileSchema>;

/**
 * Test execution result schema
 */
export const TestExecutionResultSchema = z.object({
  browser: z.string(),
  total_tests: z.number(),
  passed: z.number(),
  failed: z.number(),
  skipped: z.number(),
  duration_ms: z.number(),
  failures: z.array(z.object({
    test_name: z.string(),
    error_message: z.string(),
    screenshot_path: z.string().optional(),
    video_path: z.string().optional(),
    trace_path: z.string().optional()
  })).optional()
});

export type TestExecutionResult = z.infer<typeof TestExecutionResultSchema>;

/**
 * E2E test report schema
 */
export const E2ETestReportSchema = z.object({
  task_id: z.string(),
  workflow_id: z.string(),
  project_path: z.string(),
  overall_status: z.enum(['passed', WORKFLOW_STATUS.FAILED, 'partial']),
  generation: z.object({
    scenarios_generated: z.number(),
    test_files_created: z.number(),
    page_objects_created: z.number(),
    generation_time_ms: z.number()
  }),
  execution: z.object({
    browsers_tested: z.array(z.string()),
    results: z.array(TestExecutionResultSchema),
    total_duration_ms: z.number(),
    overall_pass_rate: z.number()
  }).optional(),
  artifacts: z.object({
    test_files: z.array(z.string()),
    screenshots: z.array(z.string()).optional(),
    videos: z.array(z.string()).optional(),
    traces: z.array(z.string()).optional(),
    html_report: z.string().optional()
  }),
  recommendations: z.array(z.string())
});

export type E2ETestReport = z.infer<typeof E2ETestReportSchema>;

/**
 * Claude prompt templates for test generation
 */
export const TEST_GENERATION_PROMPT = `You are an expert E2E test engineer. Generate comprehensive Playwright test scenarios based on the following requirements:

Requirements:
{requirements}

Application Type: {app_type}
Base URL: {base_url}

Generate test scenarios that:
1. Cover critical user flows
2. Include positive and negative test cases
3. Use the Page Object Model pattern
4. Include proper assertions and error handling
5. Are maintainable and readable

Return a JSON array of test scenarios with the following structure:
{
  "scenarios": [
    {
      "name": "Test scenario name",
      "description": "What this test validates",
      "steps": [
        {
          "action": "navigate|click|fill|expect",
          "selector": "CSS selector or test-id",
          "value": "value to input (for fill action)",
          "assertion": "expected result (for expect action)"
        }
      ],
      "priority": "critical|high|medium|low"
    }
  ],
  "page_objects": [
    {
      "name": "PageName",
      "url": "/page-path",
      "selectors": {
        "elementName": "selector"
      },
      "methods": [
        {
          "name": "methodName",
          "description": "What this method does",
          "parameters": ["param1", "param2"]
        }
      ]
    }
  ]
}`;

export const PAGE_OBJECT_GENERATION_PROMPT = `Generate a Playwright Page Object Model class for the following page:

Page Name: {page_name}
URL: {url}
Selectors: {selectors}

Generate a TypeScript class that:
1. Extends the Playwright Page class
2. Includes locators for all selectors
3. Includes methods for common actions
4. Uses best practices for POM pattern
5. Includes JSDoc comments

Return only the TypeScript code.`;
