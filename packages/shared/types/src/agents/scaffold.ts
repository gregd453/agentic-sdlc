import { z } from 'zod';
import { AgentTaskSchema, AgentResultSchema } from '../core/schemas';

/**
 * Scaffold Agent specific schemas
 */

// ===== Enums =====
export const ScaffoldActionEnum = z.enum([
  'generate_structure',
  'analyze_requirements',
  'create_templates',
  'validate_structure',
  'generate_config'
]);

export const TemplateTypeEnum = z.enum([
  'app-ui',
  'service-bff',
  'capability',
  'feature',
  'microservice',
  'library',
  'cli-tool'
]);

export const FileTypeEnum = z.enum([
  'source',
  'config',
  'test',
  'doc',
  'template',
  'build',
  'deployment'
]);

export const ComplexityEnum = z.enum(['low', 'medium', 'high', 'very-high']);

// ===== Scaffold Task Schema =====
export const ScaffoldTaskSchema = AgentTaskSchema.extend({
  agent_type: z.literal('scaffold'),
  action: ScaffoldActionEnum,
  payload: z.object({
    // Project information
    project_type: z.enum(['app', 'service', 'feature', 'capability']),
    name: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, {
      message: 'Name must be lowercase alphanumeric with hyphens',
    }),
    description: z.string().max(500),

    // Technical stack
    tech_stack: z.object({
      framework: z.string().optional(),
      language: z.enum(['typescript', 'javascript']).default('typescript'),
      runtime: z.enum(['node', 'deno', 'bun']).default('node'),
      testing: z.enum(['vitest', 'jest', 'mocha']).default('vitest'),
      bundler: z.enum(['vite', 'webpack', 'rollup', 'esbuild']).optional(),
      package_manager: z.enum(['pnpm', 'npm', 'yarn']).default('pnpm'),
      styling: z.enum(['css', 'scss', 'css-in-js', 'tailwind']).optional(),
      ui_library: z.string().optional(), // React, Vue, etc.
    }).default({}),

    // Requirements and features
    requirements: z.array(z.string()).min(1),
    features: z.array(z.object({
      name: z.string(),
      description: z.string(),
      priority: z.enum(['must-have', 'should-have', 'nice-to-have']),
    })).optional(),

    // Template configuration
    template: z.object({
      type: TemplateTypeEnum.optional(),
      overrides: z.record(z.string()).optional(),
      include_examples: z.boolean().default(true),
      include_tests: z.boolean().default(true),
      include_docs: z.boolean().default(true),
    }).optional(),

    // Advanced options
    options: z.object({
      monorepo: z.boolean().default(false),
      workspace_path: z.string().optional(),
      dependencies: z.array(z.string()).optional(),
      dev_dependencies: z.array(z.string()).optional(),
      git_init: z.boolean().default(true),
      install_deps: z.boolean().default(true),
      prettier: z.boolean().default(true),
      eslint: z.boolean().default(true),
      husky: z.boolean().default(false),
    }).optional(),
  }),
});

// ===== Scaffold Result Schema =====
export const ScaffoldResultSchema = AgentResultSchema.extend({
  agent_type: z.literal('scaffold'),
  action: ScaffoldActionEnum,
  result: z.object({
    // Generated files
    files_generated: z.array(z.object({
      path: z.string(),
      type: FileTypeEnum,
      size_bytes: z.number().nonnegative(),
      checksum: z.string().optional(),
      template_source: z.string().optional(),
      content_preview: z.string().max(500).optional(),
    })),

    // Project structure
    structure: z.object({
      root_path: z.string(),
      directories: z.array(z.string()),
      entry_points: z.array(z.string()),
      config_files: z.array(z.string()),
      test_files: z.array(z.string()).optional(),
      total_lines_of_code: z.number().optional(),
    }),

    // Templates and patterns used
    templates_used: z.array(z.object({
      name: z.string(),
      version: z.string(),
      source: z.string(),
    })),

    // Analysis results
    analysis: z.object({
      estimated_complexity: ComplexityEnum,
      recommended_agents: z.array(z.enum([
        'validation',
        'e2e',
        'integration',
        'deployment',
      ])),
      dependencies_identified: z.array(z.object({
        name: z.string(),
        version: z.string(),
        reason: z.string(),
      })),
      potential_issues: z.array(z.object({
        type: z.enum(['warning', 'info', 'suggestion']),
        message: z.string(),
        file: z.string().optional(),
      })).optional(),
      ai_suggestions: z.array(z.string()).optional(),
    }).optional(),

    // Package configuration
    package_info: z.object({
      name: z.string(),
      version: z.string(),
      scripts: z.record(z.string()),
      dependencies: z.record(z.string()),
      dev_dependencies: z.record(z.string()),
    }).optional(),

    // Metrics
    generation_metrics: z.object({
      total_files: z.number(),
      total_directories: z.number(),
      total_size_bytes: z.number(),
      generation_time_ms: z.number(),
      template_processing_ms: z.number().optional(),
      ai_analysis_ms: z.number().optional(),
    }),

    // Next steps
    next_steps: z.array(z.object({
      agent: z.string(),
      action: z.string(),
      reason: z.string(),
      priority: z.number().min(1).max(10),
    })).optional(),
  }),
});

// ===== Requirements Analysis Schema =====
export const RequirementsAnalysisSchema = z.object({
  requirements: z.array(z.string()),
  analysis: z.object({
    functional: z.array(z.object({
      requirement: z.string(),
      category: z.string(),
      complexity: ComplexityEnum,
      dependencies: z.array(z.string()),
    })),
    non_functional: z.array(z.object({
      requirement: z.string(),
      type: z.enum(['performance', 'security', 'scalability', 'usability', 'reliability']),
      impact: z.enum(['low', 'medium', 'high']),
    })),
    technical: z.object({
      recommended_stack: z.record(z.string()),
      architecture_pattern: z.string(),
      estimated_effort_hours: z.number(),
    }),
  }),
});

// ===== Type Exports =====
export type ScaffoldTask = z.infer<typeof ScaffoldTaskSchema>;
export type ScaffoldResult = z.infer<typeof ScaffoldResultSchema>;
export type ScaffoldAction = z.infer<typeof ScaffoldActionEnum>;
export type TemplateType = z.infer<typeof TemplateTypeEnum>;
export type FileType = z.infer<typeof FileTypeEnum>;
export type Complexity = z.infer<typeof ComplexityEnum>;
export type RequirementsAnalysis = z.infer<typeof RequirementsAnalysisSchema>;

// ===== Type Guards =====
export function isScaffoldTask(task: unknown): task is ScaffoldTask {
  return ScaffoldTaskSchema.safeParse(task).success;
}

export function isScaffoldResult(result: unknown): result is ScaffoldResult {
  return ScaffoldResultSchema.safeParse(result).success;
}

// ===== Factory Functions =====
export function createScaffoldTask(
  workflowId: string,
  projectType: 'app' | 'service' | 'feature' | 'capability',
  name: string,
  requirements: string[]
): ScaffoldTask {
  const now = new Date().toISOString();
  return {
    task_id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` as any,
    workflow_id: workflowId as any,
    agent_type: 'scaffold',
    action: 'generate_structure',
    status: 'pending',
    priority: 50,
    payload: {
      project_type: projectType,
      name,
      description: `${projectType} ${name}`,
      tech_stack: {
        language: 'typescript',
        runtime: 'node',
        testing: 'vitest',
        package_manager: 'pnpm',
      },
      requirements,
    },
    version: '1.0.0',
    timeout_ms: 120000,
    retry_count: 0,
    max_retries: 3,
    created_at: now,
  };
}