import { z } from 'zod';
import { AgentTaskSchema, AgentResultSchema } from '../core/schemas';

/**
 * E2E Test Agent specific schemas
 */

// ===== Enums =====
export const E2EActionEnum = z.enum([
  'generate_tests',
  'execute_tests',
  'generate_page_objects',
  'update_tests',
  'analyze_test_results'
]);

export const TestTypeEnum = z.enum([
  'ui',
  'api',
  AGENT_TYPES.INTEGRATION,
  'smoke',
  'regression',
  'accessibility'
]);

export const BrowserEnum = z.enum([
  'chromium',
  'firefox',
  'webkit',
  'chrome',
  'edge'
]);

export const TestStatusEnum = z.enum([
  'passed',
  WORKFLOW_STATUS.FAILED,
  'skipped',
  TASK_STATUS.PENDING,
  'flaky'
]);

// ===== E2E Task Schema =====
export const E2ETaskSchema = AgentTaskSchema.extend({
  agent_type: z.literal('e2e'),
  action: E2EActionEnum,
  payload: z.object({
    // Test requirements
    requirements: z.array(z.string()).min(1),

    // Test configuration
    test_type: TestTypeEnum.default('ui'),

    // Browser configuration
    browsers: z.array(BrowserEnum).default(['chromium']),

    // Page Objects configuration
    page_objects_needed: z.boolean().default(true),
    page_object_pattern: z.enum(['classic', 'screenplay', 'component']).default('classic'),

    // Test generation options
    generation_options: z.object({
      include_setup: z.boolean().default(true),
      include_teardown: z.boolean().default(true),
      include_assertions: z.boolean().default(true),
      include_screenshots: z.boolean().default(true),
      include_video: z.boolean().default(false),
      use_data_test_ids: z.boolean().default(true),
      parallel_execution: z.boolean().default(true),
      max_parallel: z.number().min(1).max(10).default(3),
    }).optional(),

    // Existing test information (for updates)
    existing_tests: z.array(z.object({
      file_path: z.string(),
      test_names: z.array(z.string()),
    })).optional(),

    // Application under test
    app_info: z.object({
      base_url: z.string().url().optional(),
      api_base_url: z.string().url().optional(),
      auth_required: z.boolean().default(false),
      test_user: z.object({
        username: z.string(),
        password: z.string(),
      }).optional(),
    }).optional(),

    // Working directory
    working_directory: z.string().optional(),
    test_output_directory: z.string().default('test-results'),
  }),
});

// ===== Page Object Schema =====
export const PageObjectSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  url: z.string(),
  selectors: z.record(z.string()),
  methods: z.array(z.object({
    name: z.string(),
    description: z.string(),
    parameters: z.array(z.object({
      name: z.string(),
      type: z.string(),
      optional: z.boolean().default(false),
    })).optional(),
    return_type: z.string().optional(),
    implementation: z.string().optional(),
  })),
  file_path: z.string().optional(),
});

// ===== Test Scenario Schema =====
export const TestScenarioSchema = z.object({
  name: z.string(),
  description: z.string(),
  type: TestTypeEnum,
  priority: z.enum([TASK_PRIORITY.LOW, TASK_PRIORITY.MEDIUM, TASK_PRIORITY.HIGH, TASK_PRIORITY.CRITICAL]).default(TASK_PRIORITY.MEDIUM),
  steps: z.array(z.object({
    step_number: z.number(),
    action: z.string(),
    target: z.string().optional(),
    expected: z.string().optional(),
    data: z.record(z.unknown()).optional(),
  })),
  assertions: z.array(z.object({
    description: z.string(),
    type: z.enum(['equals', 'contains', 'visible', 'enabled', 'count', 'custom']),
    target: z.string().optional(),
    expected: z.unknown().optional(),
  })),
  prerequisites: z.array(z.string()).optional(),
  test_data: z.record(z.unknown()).optional(),
});

// ===== Test Execution Result Schema =====
export const TestExecutionResultSchema = z.object({
  test_name: z.string(),
  file_path: z.string(),
  status: TestStatusEnum,
  duration_ms: z.number(),
  browser: BrowserEnum.optional(),
  error: z.object({
    message: z.string(),
    stack: z.string().optional(),
    screenshot_path: z.string().optional(),
  }).optional(),
  steps_completed: z.number().optional(),
  total_steps: z.number().optional(),
  retry_count: z.number().default(0),
});

// ===== E2E Result Schema =====
export const E2EResultSchema = AgentResultSchema.extend({
  agent_type: z.literal('e2e'),
  action: E2EActionEnum,
  result: z.object({
    // Generated tests
    tests_generated: z.array(z.object({
      name: z.string(),
      type: TestTypeEnum,
      file_path: z.string(),
      scenario: TestScenarioSchema.optional(),
      lines_of_code: z.number().optional(),
    })),

    // Page objects
    page_objects: z.array(PageObjectSchema).optional(),

    // Test execution results (if tests were executed)
    execution_results: z.object({
      total_tests: z.number(),
      passed: z.number(),
      failed: z.number(),
      skipped: z.number(),
      flaky: z.number().default(0),
      duration_ms: z.number(),
      started_at: z.string().datetime(),
      completed_at: z.string().datetime(),
      test_results: z.array(TestExecutionResultSchema),
    }).optional(),

    // Test artifacts
    artifacts: z.object({
      screenshots: z.array(z.object({
        test_name: z.string(),
        path: z.string(),
        timestamp: z.string().datetime(),
      })).optional(),
      videos: z.array(z.object({
        test_name: z.string(),
        path: z.string(),
        duration_ms: z.number(),
      })).optional(),
      traces: z.array(z.object({
        test_name: z.string(),
        path: z.string(),
      })).optional(),
      reports: z.array(z.object({
        type: z.enum(['html', 'json', 'junit', 'allure']),
        path: z.string(),
      })).optional(),
    }).optional(),

    // Coverage (if applicable for UI tests)
    coverage: z.object({
      scenarios_covered: z.number(),
      total_scenarios: z.number(),
      coverage_percentage: z.number().min(0).max(100),
      uncovered_scenarios: z.array(z.string()).optional(),
    }).optional(),

    // AI Analysis
    analysis: z.object({
      test_quality_score: z.number().min(0).max(100),
      completeness: z.number().min(0).max(100),
      maintainability: z.number().min(0).max(100),
      suggestions: z.array(z.object({
        type: z.enum(['missing-test', 'improve-assertion', 'add-wait', 'refactor', 'data-driven']),
        priority: z.enum([TASK_PRIORITY.LOW, TASK_PRIORITY.MEDIUM, TASK_PRIORITY.HIGH]),
        message: z.string(),
        target_test: z.string().optional(),
      })),
      flaky_test_analysis: z.array(z.object({
        test_name: z.string(),
        failure_rate: z.number(),
        suspected_reason: z.string(),
        recommendation: z.string(),
      })).optional(),
    }).optional(),

    // Summary
    summary: z.object({
      total_files_generated: z.number(),
      total_page_objects: z.number(),
      total_test_scenarios: z.number(),
      estimated_execution_time_minutes: z.number().optional(),
      next_steps: z.array(z.string()),
    }),
  }),
});

// ===== Type Exports =====
export type E2ETask = z.infer<typeof E2ETaskSchema>;
export type E2EResult = z.infer<typeof E2EResultSchema>;
export type E2EAction = z.infer<typeof E2EActionEnum>;
export type TestType = z.infer<typeof TestTypeEnum>;
export type Browser = z.infer<typeof BrowserEnum>;
export type TestStatus = z.infer<typeof TestStatusEnum>;
export type PageObject = z.infer<typeof PageObjectSchema>;
export type TestScenario = z.infer<typeof TestScenarioSchema>;
export type TestExecutionResult = z.infer<typeof TestExecutionResultSchema>;

// ===== Type Guards =====
export function isE2ETask(task: unknown): task is E2ETask {
  return E2ETaskSchema.safeParse(task).success;
}

export function isE2EResult(result: unknown): result is E2EResult {
  return E2EResultSchema.safeParse(result).success;
}

export function isPageObject(obj: unknown): obj is PageObject {
  return PageObjectSchema.safeParse(obj).success;
}

// ===== Factory Functions =====
export function createE2ETask(
  workflowId: string,
  requirements: string[],
  testType: TestType = 'ui',
  browsers: Browser[] = ['chromium']
): E2ETask {
  const now = new Date().toISOString();
  return {
    task_id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` as any,
    workflow_id: workflowId as any,
    agent_type: 'e2e',
    action: 'generate_tests',
    status: TASK_STATUS.PENDING,
    priority: 50,
    payload: {
      requirements,
      test_type: testType,
      browsers,
      page_objects_needed: true,
      page_object_pattern: 'classic' as const,
      test_output_directory: 'test-results',
    },
    version: '1.0.0',
    timeout_ms: 600000, // 10 minutes for E2E generation and execution
    retry_count: 0,
    max_retries: 3,
    created_at: now,
  };
}

export function createPageObject(
  name: string,
  url: string,
  selectors: Record<string, string>,
  methods: Array<{ name: string; description: string; parameters?: any[] }>
): PageObject {
  return {
    name,
    url,
    selectors,
    methods: methods.map((m) => ({
      name: m.name,
      description: m.description,
      parameters: m.parameters?.map((p) => ({
        name: p.name || '',
        type: p.type || 'any',
        optional: p.optional || false,
      })),
    })),
  };
}
