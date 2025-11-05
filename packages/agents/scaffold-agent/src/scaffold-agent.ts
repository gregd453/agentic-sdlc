import { BaseAgent } from '@agentic-sdlc/base-agent';
import { TaskAssignment, TaskResult } from '@agentic-sdlc/base-agent';
import path from 'path';
import {
  ScaffoldTask,
  ScaffoldTaskSchema,
  ScaffoldResult,
  RequirementsAnalysis,
  RequirementsAnalysisSchema,
  ProjectStructure,
  GeneratedFile,
  ProjectType,
  ScaffoldError,
  TemplateContext
} from './types';
import { TemplateEngine } from './template-engine';
import { FileGenerator } from './file-generator';

/**
 * Scaffold Agent - Intelligent code generation agent
 *
 * Capabilities:
 * - Analyzes requirements using Claude
 * - Generates project structure based on type
 * - Creates boilerplate code with proper patterns
 * - Generates Zod schemas for contracts
 * - Creates initial test files
 * - Supports app, service, feature, capability types
 */
export class ScaffoldAgent extends BaseAgent {
  private readonly templateEngine: TemplateEngine;
  private readonly fileGenerator: FileGenerator;

  constructor() {
    super({
      type: 'scaffold',
      version: '1.0.0',
      capabilities: [
        'analyze-requirements',
        'generate-structure',
        'create-boilerplate',
        'generate-schemas',
        'create-tests'
      ]
    });

    this.templateEngine = new TemplateEngine();
    this.fileGenerator = new FileGenerator(this.logger);
  }

  async execute(task: TaskAssignment): Promise<TaskResult> {
    const startTime = Date.now();
    const traceId = this.generateTraceId();

    this.logger.info('Executing scaffold task', {
      task_id: task.task_id,
      workflow_id: task.workflow_id,
      trace_id: traceId
    });

    try {
      // Parse scaffold-specific task data
      const scaffoldTask = this.parseScaffoldTask(task);

      // Step 1: Analyze requirements using Claude
      this.logger.info('Analyzing requirements', { task_id: task.task_id });
      const analysis = await this.analyzeRequirements(scaffoldTask);

      // Step 2: Generate project structure
      this.logger.info('Generating project structure', { task_id: task.task_id });
      const structure = await this.generateProjectStructure(scaffoldTask, analysis);

      // Step 3: Create files from templates
      this.logger.info('Creating files', {
        task_id: task.task_id,
        file_count: structure.files.length
      });

      const createResult = await this.createFiles(structure, scaffoldTask);

      const duration = Date.now() - startTime;

      this.logger.info('Scaffold task completed successfully', {
        task_id: task.task_id,
        files_created: createResult.filesCreated,
        duration_ms: duration
      });

      const result: ScaffoldResult = {
        task_id: task.task_id,
        workflow_id: task.workflow_id,
        status: 'success',
        output: {
          analysis,
          structure,
          files_generated: createResult.filesCreated,
          output_path: scaffoldTask.context?.output_path,
          summary: `Successfully scaffolded ${scaffoldTask.project_type} project: ${scaffoldTask.name}`
        },
        metrics: {
          duration_ms: duration,
          api_calls: 1,
          files_created: createResult.filesCreated,
          directories_created: createResult.directoriesCreated
        },
        next_stage: 'validation'
      };

      return result as unknown as TaskResult;

    } catch (error) {
      this.logger.error('Scaffold task failed', {
        task_id: task.task_id,
        error: error instanceof Error ? error.message : String(error),
        trace_id: traceId
      });

      const result: ScaffoldResult = {
        task_id: task.task_id,
        workflow_id: task.workflow_id,
        status: 'failure',
        output: {
          files_generated: 0,
          summary: 'Scaffold task failed'
        },
        errors: [error instanceof Error ? error.message : 'Unknown error occurred'],
        metrics: {
          duration_ms: Date.now() - startTime,
          api_calls: 0,
          files_created: 0,
          directories_created: 0
        }
      };

      return result as unknown as TaskResult;
    }
  }

  /**
   * Parse and validate scaffold-specific task data
   */
  private parseScaffoldTask(task: TaskAssignment): ScaffoldTask {
    try {
      // Map generic TaskAssignment to ScaffoldTask
      const scaffoldTask: ScaffoldTask = {
        task_id: task.task_id,
        workflow_id: task.workflow_id,
        type: 'scaffold',
        name: task.name,
        description: task.description,
        requirements: task.requirements,
        project_type: (task.context?.project_type as ProjectType) || 'service',
        context: task.context as any
      };

      return ScaffoldTaskSchema.parse(scaffoldTask);
    } catch (error) {
      throw new ScaffoldError(
        'Invalid scaffold task data',
        'VALIDATION_ERROR',
        { cause: error }
      );
    }
  }

  /**
   * Analyze requirements using Claude to extract structure and components
   */
  private async analyzeRequirements(task: ScaffoldTask): Promise<RequirementsAnalysis> {
    const systemPrompt = `You are an expert software architect analyzing requirements for code generation.
Your task is to analyze project requirements and extract:
1. Key components and their relationships
2. Data contracts (schemas/types) needed
3. Technical decisions and patterns to apply
4. Dependencies required

You must respond with valid JSON matching this structure:
{
  "project_name": "string",
  "project_type": "app|service|feature|capability",
  "summary": "string",
  "components": [
    {
      "name": "ComponentName",
      "type": "controller|service|repository|model|handler",
      "description": "what it does",
      "dependencies": ["optional array of other components"]
    }
  ],
  "contracts": [
    {
      "name": "ContractName",
      "fields": [
        {
          "name": "fieldName",
          "type": "string|number|boolean|object|array",
          "required": true,
          "description": "optional description"
        }
      ]
    }
  ],
  "technical_decisions": {
    "key": "value"
  },
  "considerations": ["array of strings"]
}`;

    const prompt = `Project Name: ${task.name}
Project Type: ${task.project_type}
Description: ${task.description}

Requirements:
${task.requirements}

${task.context?.tech_stack ? `Tech Stack: ${task.context.tech_stack.join(', ')}` : ''}
${task.context?.features ? `Features: ${task.context.features.join(', ')}` : ''}
${task.context?.patterns ? `Patterns: ${task.context.patterns.join(', ')}` : ''}

Analyze the requirements above and provide a structured analysis in JSON format.`;

    const response = await this.callClaude(prompt, systemPrompt, 4096);

    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = response.trim();

      // Remove markdown code block if present
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/\n?```$/g, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```\n?/g, '').replace(/\n?```$/g, '');
      }

      const parsed = JSON.parse(jsonStr);
      return RequirementsAnalysisSchema.parse(parsed);
    } catch (error) {
      this.logger.error('Failed to parse requirements analysis', {
        error,
        response: response.substring(0, 500)
      });
      throw new ScaffoldError(
        'Failed to parse requirements analysis from Claude',
        'PARSE_ERROR',
        { cause: error }
      );
    }
  }

  /**
   * Generate project structure based on analysis
   */
  private async generateProjectStructure(
    task: ScaffoldTask,
    analysis: RequirementsAnalysis
  ): Promise<ProjectStructure> {
    const rootPath = task.context?.output_path || `./${task.name}`;

    // Determine directory structure based on project type
    const directories = this.getDirectoriesForProjectType(task.project_type, rootPath);

    // Generate files from templates and analysis
    const files = await this.generateFiles(task, analysis, rootPath);

    // Determine dependencies based on project type and tech stack
    const dependencies = this.getDependencies(task.project_type, task.context?.tech_stack);
    const devDependencies = this.getDevDependencies(task.project_type);
    const scripts = this.getScripts(task.project_type);

    return {
      root_path: rootPath,
      directories,
      files,
      dependencies,
      dev_dependencies: devDependencies,
      scripts
    };
  }

  /**
   * Get directory structure for project type
   */
  private getDirectoriesForProjectType(projectType: ProjectType, rootPath: string): string[] {
    const baseStructure = [
      path.join(rootPath, 'src'),
      path.join(rootPath, 'tests'),
    ];

    const typeSpecific: Record<ProjectType, string[]> = {
      app: [
        ...baseStructure,
        path.join(rootPath, 'src', 'components'),
        path.join(rootPath, 'src', 'pages'),
        path.join(rootPath, 'src', 'lib'),
        path.join(rootPath, 'public')
      ],
      service: [
        ...baseStructure,
        path.join(rootPath, 'src', 'controllers'),
        path.join(rootPath, 'src', 'services'),
        path.join(rootPath, 'src', 'models'),
        path.join(rootPath, 'src', 'types')
      ],
      feature: [
        ...baseStructure,
        path.join(rootPath, 'src', 'components'),
        path.join(rootPath, 'src', 'hooks'),
        path.join(rootPath, 'src', 'types')
      ],
      capability: [
        ...baseStructure,
        path.join(rootPath, 'src', 'lib'),
        path.join(rootPath, 'src', 'types'),
        path.join(rootPath, 'src', 'utils')
      ]
    };

    return typeSpecific[projectType] || baseStructure;
  }

  /**
   * Generate files from templates and analysis
   */
  private async generateFiles(
    task: ScaffoldTask,
    analysis: RequirementsAnalysis,
    rootPath: string
  ): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    const context: TemplateContext = {
      project_name: task.name,
      project_type: task.project_type,
      description: task.description,
      components: analysis.components,
      contracts: analysis.contracts,
      timestamp: new Date().toISOString(),
      generated_by: 'scaffold-agent'
    };

    // Generate package.json
    files.push({
      path: path.join(rootPath, 'package.json'),
      content: this.templateEngine.render('package', context),
      description: 'Package manifest',
      type: 'config'
    });

    // Generate tsconfig.json
    files.push({
      path: path.join(rootPath, 'tsconfig.json'),
      content: this.templateEngine.render('tsconfig', context),
      description: 'TypeScript configuration',
      type: 'config'
    });

    // Generate README.md
    files.push({
      path: path.join(rootPath, 'README.md'),
      content: this.templateEngine.render('readme', context),
      description: 'Project documentation',
      type: 'documentation'
    });

    // Generate type definitions from contracts
    if (analysis.contracts && analysis.contracts.length > 0) {
      files.push({
        path: path.join(rootPath, 'src', 'types', 'index.ts'),
        content: this.templateEngine.render('types', context),
        description: 'Type definitions and Zod schemas',
        type: 'source'
      });
    }

    // Generate components based on analysis
    for (const component of analysis.components) {
      const componentFile = this.generateComponentFile(component, task.project_type, rootPath);
      if (componentFile) {
        files.push(componentFile);
      }

      // Generate test file if requested
      if (task.context?.generate_tests !== false) {
        const testFile = this.generateTestFile(component, task.project_type, rootPath);
        if (testFile) {
          files.push(testFile);
        }
      }
    }

    // Generate index file
    files.push({
      path: path.join(rootPath, 'src', 'index.ts'),
      content: this.templateEngine.render('index', context),
      description: 'Main entry point',
      type: 'source'
    });

    return files;
  }

  /**
   * Generate component file
   */
  private generateComponentFile(
    component: any,
    projectType: ProjectType,
    rootPath: string
  ): GeneratedFile | null {
    const componentDir = this.getComponentDirectory(component.type, projectType);
    if (!componentDir) return null;

    const context = {
      component_name: component.name,
      component_type: component.type,
      description: component.description,
      dependencies: component.dependencies || []
    };

    // Try to render specific component type template, fall back to generic
    let templateName = `component-${component.type}`;
    try {
      // Check if specific template exists by trying to render
      const content = this.templateEngine.render(templateName, context);
      return {
        path: path.join(rootPath, 'src', componentDir, `${this.toKebabCase(component.name)}.ts`),
        content,
        description: `${component.name} ${component.type}`,
        type: 'source'
      };
    } catch (error) {
      // Fall back to service template for unknown component types
      const fallbackContent = this.templateEngine.render('component-service', context);
      return {
        path: path.join(rootPath, 'src', componentDir, `${this.toKebabCase(component.name)}.ts`),
        content: fallbackContent,
        description: `${component.name} ${component.type}`,
        type: 'source'
      };
    }
  }

  /**
   * Generate test file for component
   */
  private generateTestFile(
    component: any,
    projectType: ProjectType,
    rootPath: string
  ): GeneratedFile | null {
    const componentDir = this.getComponentDirectory(component.type, projectType);
    if (!componentDir) return null;

    const context = {
      component_name: component.name,
      component_type: component.type,
      description: component.description
    };

    return {
      path: path.join(rootPath, 'tests', `${this.toKebabCase(component.name)}.test.ts`),
      content: this.templateEngine.render('test', context),
      description: `Tests for ${component.name}`,
      type: 'test'
    };
  }

  /**
   * Get component directory based on type
   */
  private getComponentDirectory(componentType: string, projectType: ProjectType): string | null {
    const mapping: Record<string, string> = {
      controller: 'controllers',
      service: 'services',
      repository: 'repositories',
      model: 'models',
      handler: 'handlers',
      component: 'components',
      hook: 'hooks',
      util: 'utils',
      lib: 'lib'
    };

    return mapping[componentType.toLowerCase()] || null;
  }

  /**
   * Create files on filesystem
   */
  private async createFiles(
    structure: ProjectStructure,
    task: ScaffoldTask
  ): Promise<{ filesCreated: number; directoriesCreated: number }> {
    // Create directories
    await this.fileGenerator.createDirectories(structure.directories);

    // Create files
    await this.fileGenerator.createFiles(structure.files);

    return {
      filesCreated: structure.files.length,
      directoriesCreated: structure.directories.length
    };
  }

  /**
   * Get dependencies for project type
   */
  private getDependencies(projectType: ProjectType, techStack?: string[]): Record<string, string> {
    const common = {
      zod: '^3.22.4'
    };

    const typeDeps: Record<ProjectType, Record<string, string>> = {
      app: {
        ...common,
        react: '^18.2.0',
        'next': '^14.0.0'
      },
      service: {
        ...common,
        fastify: '^4.26.0',
        prisma: '^5.0.0'
      },
      feature: {
        ...common,
        react: '^18.2.0'
      },
      capability: {
        ...common
      }
    };

    return typeDeps[projectType] || common;
  }

  /**
   * Get dev dependencies for project type
   */
  private getDevDependencies(projectType: ProjectType): Record<string, string> {
    return {
      typescript: '^5.4.0',
      vitest: '^1.4.0',
      '@types/node': '^20.11.0'
    };
  }

  /**
   * Get scripts for project type
   */
  private getScripts(projectType: ProjectType): Record<string, string> {
    return {
      build: 'tsc',
      dev: 'tsx watch src/index.ts',
      test: 'vitest',
      'test:coverage': 'vitest run --coverage',
      typecheck: 'tsc --noEmit'
    };
  }

  /**
   * Convert string to kebab-case
   */
  private toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }
}
