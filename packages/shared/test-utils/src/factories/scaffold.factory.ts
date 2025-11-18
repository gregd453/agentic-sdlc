import {
  ScaffoldTask,
  ScaffoldResult,
  toWorkflowId,
  toTaskId,
  toAgentId,
  VERSION
} from '@agentic-sdlc/shared-types';

/**
 * Test data factories for scaffold agent
 */

export const ScaffoldFactory = {
  /**
   * Create a valid scaffold task
   */
  task: (overrides: Partial<ScaffoldTask> = {}): ScaffoldTask => {
    const now = new Date().toISOString();

    return {
      task_id: toTaskId(`task_test_${Date.now()}`),
      workflow_id: toWorkflowId(`wf_test_${Date.now()}`),
      agent_type: AGENT_TYPES.SCAFFOLD,
      action: 'generate_structure',
      status: TASK_STATUS.PENDING,
      priority: 50,
      payload: {
        project_type: WORKFLOW_TYPES.APP,
        name: 'test-app',
        description: 'Test application for unit tests',
        tech_stack: {
          language: 'typescript',
          runtime: 'node',
          testing: 'vitest',
          package_manager: 'pnpm',
          framework: 'fastify'
        },
        requirements: [
          'User authentication',
          'RESTful API',
          'Database integration',
          'Unit tests'
        ],
        features: [
          {
            name: 'Authentication',
            description: 'JWT-based authentication',
            priority: 'must-have'
          },
          {
            name: 'Logging',
            description: 'Structured logging with correlation IDs',
            priority: 'should-have'
          }
        ],
        template: {
          type: 'app-ui',
          include_examples: true,
          include_tests: true,
          include_docs: true
        }
      },
      version: VERSION,
      timeout_ms: 120000,
      retry_count: 0,
      max_retries: 3,
      created_at: now,
      ...overrides
    };
  },

  /**
   * Create a valid scaffold result
   */
  result: (overrides: Partial<ScaffoldResult> = {}): ScaffoldResult => {
    const now = new Date().toISOString();

    return {
      task_id: toTaskId(`task_test_${Date.now()}`),
      workflow_id: toWorkflowId(`wf_test_${Date.now()}`),
      agent_id: toAgentId(`scaffold_agent_test_${Date.now()}`),
      agent_type: AGENT_TYPES.SCAFFOLD,
      success: true,
      status: WORKFLOW_STATUS.SUCCESS,
      action: 'generate_structure',
      result: {
        files_generated: [
          {
            path: 'src/index.ts',
            type: 'source',
            size_bytes: 1024,
            checksum: 'abc123',
            template_source: 'app-template',
            content_preview: 'import { createApp } from "./app";'
          },
          {
            path: 'package.json',
            type: 'config',
            size_bytes: 512,
            checksum: 'def456',
            template_source: 'package-template'
          },
          {
            path: 'tests/index.test.ts',
            type: 'test',
            size_bytes: 768,
            checksum: 'ghi789',
            template_source: 'test-template'
          },
          {
            path: 'README.md',
            type: 'doc',
            size_bytes: 2048,
            checksum: 'jkl012',
            template_source: 'readme-template'
          }
        ],
        structure: {
          root_path: './test-app',
          directories: ['src', 'tests', 'docs', 'config'],
          entry_points: ['src/index.ts'],
          config_files: ['package.json', 'tsconfig.json', '.eslintrc.js'],
          test_files: ['tests/index.test.ts'],
          total_lines_of_code: 250
        },
        templates_used: [
          {
            name: 'app-template-v2',
            version: '2.1.0',
            source: 'internal'
          }
        ],
        analysis: {
          estimated_complexity: TASK_PRIORITY.MEDIUM,
          recommended_agents: [AGENT_TYPES.VALIDATION, 'e2e', AGENT_TYPES.DEPLOYMENT],
          dependencies_identified: [
            {
              name: 'fastify',
              version: '^4.0.0',
              reason: 'Web framework'
            },
            {
              name: 'zod',
              version: '^3.22.0',
              reason: 'Schema validation'
            }
          ],
          potential_issues: [
            {
              type: LOG_LEVEL.INFO,
              message: 'Consider adding rate limiting for API endpoints'
            }
          ],
          ai_suggestions: [
            'Add OpenAPI documentation',
            'Implement health check endpoint'
          ]
        },
        package_info: {
          name: 'test-app',
          version: '1.0.0',
          scripts: {
            dev: 'tsx watch src/index.ts',
            build: 'tsc',
            test: 'vitest',
            lint: 'eslint .'
          },
          dependencies: {
            fastify: '^4.0.0',
            zod: '^3.22.0'
          },
          dev_dependencies: {
            typescript: '^5.0.0',
            vitest: '^1.0.0',
            '@types/node': '^20.0.0'
          }
        },
        generation_metrics: {
          total_files: 12,
          total_directories: 4,
          total_size_bytes: 15360,
          generation_time_ms: 1500,
          template_processing_ms: 800,
          ai_analysis_ms: 400
        },
        next_steps: [
          {
            agent: AGENT_TYPES.VALIDATION,
            action: 'validate_code',
            reason: 'Verify TypeScript compilation and linting',
            priority: 1
          },
          {
            agent: 'e2e',
            action: 'generate_tests',
            reason: 'Create end-to-end test suite',
            priority: 2
          }
        ]
      },
      artifacts: [
        {
          name: 'source-code',
          path: './test-app',
          type: 'directory',
          size_bytes: 15360
        }
      ],
      metrics: {
        duration_ms: 1500,
        tokens_used: 2500,
        api_calls: 1,
        memory_used_bytes: 10485760 // 10MB
      },
      warnings: [],
      timestamp: now,
      version: VERSION,
      ...overrides
    };
  },

  /**
   * Create a failed scaffold result
   */
  failedResult: (error: string = 'Template not found'): ScaffoldResult => {
    return ScaffoldFactory.result({
      success: false,
      status: WORKFLOW_STATUS.FAILED,
      error: {
        code: 'SCAFFOLD_ERROR',
        message: error,
        details: { template: 'app-template-v2' },
        retryable: true
      },
      result: {
        files_generated: [],
        structure: {
          root_path: '',
          directories: [],
          entry_points: [],
          config_files: [],
          test_files: [],
          total_lines_of_code: 0
        },
        templates_used: [],
        generation_metrics: {
          total_files: 0,
          total_directories: 0,
          total_size_bytes: 0,
          generation_time_ms: 0
        }
      }
    });
  },

  /**
   * Create a minimal task (only required fields)
   */
  minimalTask: (): ScaffoldTask => {
    return ScaffoldFactory.task({
      payload: {
        project_type: 'service',
        name: 'minimal-service',
        description: 'Minimal service',
        tech_stack: {
          language: 'typescript',
          runtime: 'node',
          testing: 'vitest',
          package_manager: 'pnpm'
        },
        requirements: ['Basic functionality']
      }
    });
  },

  /**
   * Create a complex app task
   */
  complexAppTask: (): ScaffoldTask => {
    return ScaffoldFactory.task({
      payload: {
        project_type: WORKFLOW_TYPES.APP,
        name: 'complex-app',
        description: 'Complex application with multiple features',
        tech_stack: {
          language: 'typescript',
          runtime: 'node',
          framework: 'next',
          testing: 'vitest',
          bundler: 'vite',
          package_manager: 'pnpm',
          styling: 'tailwind',
          ui_library: 'react'
        },
        requirements: [
          'Multi-tenant support',
          'Real-time collaboration',
          'Advanced authentication (OAuth, SAML)',
          'File upload/download',
          'Webhooks',
          'GraphQL API',
          'WebSocket support',
          'Background job processing',
          'Email notifications',
          'Audit logging'
        ],
        features: Array.from({ length: 10 }, (_, i) => ({
          name: `Feature ${i + 1}`,
          description: `Complex feature ${i + 1} with multiple components`,
          priority: i < 3 ? 'must-have' : i < 7 ? 'should-have' : 'nice-to-have'
        })),
        options: {
          monorepo: true,
          workspace_path: 'apps/complex-app',
          dependencies: ['axios', 'lodash', 'date-fns'],
          dev_dependencies: ['prettier', 'husky', 'lint-staged'],
          git_init: true,
          install_deps: true,
          prettier: true,
          eslint: true,
          husky: true
        }
      }
    });
  }
};