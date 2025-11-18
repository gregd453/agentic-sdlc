import { z } from 'zod';

// Project types supported by scaffold agent
export const ProjectTypeSchema = z.enum(['app', 'service', 'feature', 'capability']);
export type ProjectType = z.infer<typeof ProjectTypeSchema>;

// Scaffold task input schema
export const ScaffoldTaskSchema = z.object({
  task_id: z.string().uuid(),
  workflow_id: z.string().uuid(),
  type: z.literal('scaffold'),
  name: z.string().min(1).max(100),
  description: z.string(),
  requirements: z.string(),
  project_type: ProjectTypeSchema,
  context: z.object({
    output_path: z.string(),
    tech_stack: z.array(z.string()).optional(),
    features: z.array(z.string()).optional(),
    patterns: z.array(z.string()).optional(),
    generate_tests: z.boolean().default(true),
    generate_docs: z.boolean().default(true)
  }).optional()
});

export type ScaffoldTask = z.infer<typeof ScaffoldTaskSchema>;

// File to be generated
export const GeneratedFileSchema = z.object({
  path: z.string(),
  content: z.string(),
  description: z.string(),
  type: z.enum(['source', 'test', 'config', 'documentation'])
});

export type GeneratedFile = z.infer<typeof GeneratedFileSchema>;

// Project structure
export const ProjectStructureSchema = z.object({
  root_path: z.string(),
  directories: z.array(z.string()),
  files: z.array(GeneratedFileSchema),
  dependencies: z.record(z.string()).optional(),
  dev_dependencies: z.record(z.string()).optional(),
  scripts: z.record(z.string()).optional()
});

export type ProjectStructure = z.infer<typeof ProjectStructureSchema>;

// Analysis result from Claude
export const RequirementsAnalysisSchema = z.object({
  project_name: z.string(),
  project_type: ProjectTypeSchema,
  summary: z.string(),
  components: z.array(z.object({
    name: z.string(),
    type: z.string(),
    description: z.string(),
    dependencies: z.array(z.string()).optional()
  })),
  contracts: z.array(z.object({
    name: z.string(),
    fields: z.array(z.object({
      name: z.string(),
      type: z.string(),
      required: z.boolean(),
      description: z.string().optional()
    }))
  })).optional(),
  technical_decisions: z.record(z.string()).optional(),
  considerations: z.array(z.string()).optional()
});

export type RequirementsAnalysis = z.infer<typeof RequirementsAnalysisSchema>;

// Scaffold result schema
export const ScaffoldResultSchema = z.object({
  task_id: z.string().uuid(),
  workflow_id: z.string().uuid(),
  status: z.enum(['success', 'failure', 'partial']),
  output: z.object({
    analysis: RequirementsAnalysisSchema.optional(),
    structure: ProjectStructureSchema.optional(),
    files_generated: z.number(),
    output_path: z.string().optional(),
    summary: z.string()
  }),
  errors: z.array(z.string()).optional(),
  metrics: z.object({
    duration_ms: z.number(),
    tokens_used: z.number().optional(),
    api_calls: z.number().optional(),
    files_created: z.number(),
    directories_created: z.number()
  }).optional(),
  next_stage: z.string().optional()
});

export type ScaffoldResult = z.infer<typeof ScaffoldResultSchema>;

// Template context for Handlebars
export interface TemplateContext {
  project_name: string;
  project_type: ProjectType;
  description: string;
  components: Array<{
    name: string;
    type: string;
    description: string;
  }>;
  contracts?: Array<{
    name: string;
    fields: Array<{
      name: string;
      type: string;
      required: boolean;
      description?: string;
    }>;
  }>;
  dependencies?: Record<string, string>;
  dev_dependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  timestamp: string;
  generated_by: string;
}

// Template metadata
export interface TemplateMetadata {
  name: string;
  description: string;
  project_type: ProjectType;
  output_path: string;
  template_file: string;
}

// Errors
export class ScaffoldError extends Error {
  constructor(message: string, public readonly code?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ScaffoldError';
  }
}

export class TemplateError extends ScaffoldError {
  constructor(message: string, public readonly template_name: string) {
    super(message, 'TEMPLATE_ERROR');
    this.name = 'TemplateError';
  }
}

export class FileGenerationError extends ScaffoldError {
  constructor(message: string, public readonly file_path: string) {
    super(message, 'FILE_GENERATION_ERROR');
    this.name = 'FileGenerationError';
  }
}
