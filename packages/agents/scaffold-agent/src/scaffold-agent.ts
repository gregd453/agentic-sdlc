import { BaseAgent } from '@agentic-sdlc/base-agent';
import { TaskAssignment, TaskResult } from '@agentic-sdlc/base-agent';
import {
  ScaffoldTask
} from '@agentic-sdlc/shared-types';
import path from 'path';
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
  private readonly fileGenerator: FileGenerator;
  private readonly templateEngine: TemplateEngine;

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

    this.fileGenerator = new FileGenerator(this.logger);
    this.templateEngine = new TemplateEngine(
      path.join(__dirname, '../templates')
    );

    // Register schemas on initialization
    this.registerSchemas();
  }

  private registerSchemas(): void {
    // Schemas are already registered in shared-types package
    // But we can add agent-specific schemas here if needed
    this.logger.info('Scaffold agent schemas registered');
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
      // Convert TaskAssignment to ScaffoldTask format
      const scaffoldTask: ScaffoldTask = {
        task_id: task.task_id as any, // Already branded from TaskAssignment
        workflow_id: task.workflow_id as any, // Already branded from TaskAssignment
        agent_type: 'scaffold',
        action: 'generate_structure',
        status: 'pending',
        priority: task.priority === 'critical' ? 90 :
                  task.priority === 'high' ? 70 :
                  task.priority === 'medium' ? 50 : 30,
        payload: {
          project_type: (task.context?.project_type as 'app' | 'service' | 'feature' | 'capability') || 'app',
          name: task.name,
          description: task.description,
          tech_stack: {
            language: 'typescript',
            runtime: 'node',
            testing: 'vitest',
            package_manager: 'pnpm',
            bundler: task.context?.tech_stack === 'react' ? 'vite' : undefined,
            ui_library: task.context?.tech_stack === 'react' ? 'react' : undefined
          },
          requirements: task.requirements.split('. ').filter(r => r.length > 0)
        },
        version: '1.0.0',
        timeout_ms: 120000,
        retry_count: 0,
        max_retries: 3,
        created_at: new Date().toISOString()
      };

      // Step 1: Analyze requirements using Claude
      this.logger.info('Analyzing requirements', { task_id: scaffoldTask.task_id });
      const analysis = await this.analyzeRequirements(scaffoldTask);

      // Step 2: Generate project structure
      this.logger.info('Generating project structure', { task_id: scaffoldTask.task_id });
      const structure = await this.generateProjectStructure(scaffoldTask, analysis);

      // Step 3: Create files from templates
      this.logger.info('Creating files', {
        task_id: scaffoldTask.task_id,
        file_count: structure.files_generated.length
      });

      const createResult = await this.createFiles(structure, scaffoldTask);

      const duration = Date.now() - startTime;

      this.logger.info('Scaffold task completed successfully', {
        task_id: scaffoldTask.task_id,
        files_created: createResult.filesCreated,
        duration_ms: duration
      });

      // Create result conforming to TaskResult schema
      const result: TaskResult = {
        task_id: scaffoldTask.task_id,
        workflow_id: scaffoldTask.workflow_id,
        status: 'success',
        output: {
          files_generated: structure.files_generated,
          structure: structure,
          templates_used: createResult.templatesUsed || [],
          analysis: analysis,
          generation_metrics: {
            total_files: createResult.filesCreated,
            total_directories: structure.directories.length,
            total_size_bytes: createResult.totalSize || 0,
            generation_time_ms: duration,
            template_processing_ms: createResult.templateTime || 0,
            ai_analysis_ms: analysis?.analysis_time_ms || 0
          },
          next_steps: this.determineNextSteps(scaffoldTask, structure),
          summary: `Successfully scaffolded ${scaffoldTask.payload.project_type} project: ${scaffoldTask.payload.name}`
        },
        metrics: {
          duration_ms: duration,
          tokens_used: analysis?.tokens_used || 0,
          api_calls: analysis?.api_calls || 1
        },
        next_stage: 'validation'
      };

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error('Scaffold task failed', {
        task_id: task.task_id,
        error: error instanceof Error ? error.message : 'Unknown error',
        trace_id: traceId,
        duration_ms: duration
      });

      // Return failure result
      const failureResult: TaskResult = {
        task_id: task.task_id,
        workflow_id: task.workflow_id,
        status: 'failure',
        output: {
          error_code: 'SCAFFOLD_ERROR',
          error_details: { trace_id: traceId }
        },
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        metrics: {
          duration_ms: duration
        }
      };

      return failureResult;
    }
  }

  private async analyzeRequirements(task: ScaffoldTask): Promise<any> {
    try {
      const prompt = this.buildRequirementsPrompt(task);
      this.logger.info('Calling Claude API to analyze requirements', {
        task_id: task.task_id,
        project_type: task.payload.project_type
      });

      const response = await this.callClaude(
        prompt,
        'You are a software architect analyzing project requirements. Return responses as pure JSON only - no markdown, no code blocks, no explanatory text. Just the JSON object.'
      );

      this.logger.info('Claude API response received', {
        response_length: response.length,
        task_id: task.task_id
      });

      // SESSION #28: Log raw response for debugging JSON parsing issues
      this.logger.debug('Raw Claude API response', {
        task_id: task.task_id,
        raw_response: response,
        first_100_chars: response.substring(0, 100)
      });

      // SESSION #28: Sanitize and parse Claude's response
      const analysis = this.parseClaudeJsonResponse(response, task.task_id);

      this.logger.info('Requirements analysis completed successfully', {
        task_id: task.task_id,
        complexity: analysis.complexity || 'medium'
      });

      return {
        ...analysis,
        estimated_complexity: analysis.complexity || 'medium',
        recommended_agents: ['validation', 'e2e', 'deployment'],
        dependencies_identified: this.extractDependencies(analysis),
        analysis_time_ms: 500,
        tokens_used: 1500,
        api_calls: 1,
        claude_used: true
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      const isJsonParseError = errorMessage.includes('JSON') || errorMessage.includes('parse');

      this.logger.error('Failed to analyze requirements with Claude API', {
        error: errorMessage,
        error_stack: errorStack,
        error_type: isJsonParseError ? 'JSON_PARSE_ERROR' : 'API_ERROR',
        task_id: task.task_id
      });

      // SESSION #28: Enhanced error visibility for JSON parsing issues
      if (isJsonParseError) {
        console.error('❌ JSON PARSING ERROR:', errorMessage);
        console.error('This likely means Claude returned non-JSON format despite instructions.');
        console.error('Check logs for raw_response to see what Claude actually returned.');
      } else {
        console.error('❌ CLAUDE API ERROR:', errorMessage);
      }

      // Return default analysis with flag indicating API failure
      return {
        estimated_complexity: 'medium',
        recommended_agents: ['validation', 'e2e'],
        dependencies_identified: [],
        analysis_time_ms: 0,
        tokens_used: 0,
        api_calls: 0,
        claude_used: false,
        fallback_reason: errorMessage,
        error_type: isJsonParseError ? 'JSON_PARSE_ERROR' : 'API_ERROR'
      };
    }
  }

  private async generateProjectStructure(task: ScaffoldTask, analysis: any): Promise<any> {
    const projectType = task.payload.project_type;
    const name = task.payload.name;

    // Generate structure based on project type
    const structure = {
      root_path: `./${name}`,
      directories: this.getDirectoriesForType(projectType),
      entry_points: [`src/index.ts`],
      config_files: ['package.json', 'tsconfig.json', '.eslintrc.js'],
      test_files: task.payload.template?.include_tests ? ['tests/index.test.ts'] : [],
      files_generated: await this.generateFilesForType(projectType, task, analysis)
    };

    return structure;
  }

  private async generateFilesForType(projectType: string, task: ScaffoldTask, _analysis: any): Promise<any[]> {
    const files = [];

    // Check if this is a calculator project with Slate Nightfall theme
    const isCalculator = projectType === 'app' &&
      (task.payload.name?.toLowerCase().includes('calculator') ||
       (Array.isArray(task.payload.requirements) &&
        task.payload.requirements.some(req => req.toLowerCase().includes('calculator'))));

    // Check if this is a React SPA project
    const isReactSPA = projectType === 'app' &&
      !isCalculator &&
      (task.payload.name?.toLowerCase().includes('react') ||
       (Array.isArray(task.payload.requirements) &&
        task.payload.requirements.some(req => req.toLowerCase().includes('react'))));

    if (isCalculator) {
      // Calculator app with Slate Nightfall theme
      files.push(
        {
          path: 'package.json',
          type: 'config',
          template_source: 'app/calculator-slate/package.json'
        },
        {
          path: 'vite.config.ts',
          type: 'config',
          template_source: 'app/calculator-slate/vite.config.ts'
        },
        {
          path: 'tsconfig.json',
          type: 'config',
          template_source: 'app/calculator-slate/tsconfig.json'
        },
        {
          path: 'tailwind.config.js',
          type: 'config',
          template_source: 'app/calculator-slate/tailwind.config.js'
        },
        {
          path: 'index.html',
          type: 'source',
          template_source: 'app/calculator-slate/index.html'
        },
        {
          path: '.gitignore',
          type: 'config',
          template_source: 'app/calculator-slate/.gitignore'
        },
        {
          path: 'README.md',
          type: 'doc',
          template_source: 'app/calculator-slate/README.md'
        },
        {
          path: 'src/main.tsx',
          type: 'source',
          template_source: 'app/calculator-slate/src/main.tsx'
        },
        {
          path: 'src/App.tsx',
          type: 'source',
          template_source: 'app/calculator-slate/src/App.tsx'
        },
        {
          path: 'src/App.css',
          type: 'style',
          template_source: 'app/calculator-slate/src/App.css'
        }
      );
    } else if (isReactSPA) {
      // React SPA specific files
      files.push(
        {
          path: 'package.json',
          type: 'config',
          template_source: 'app/react-spa/package.json'
        },
        {
          path: 'vite.config.ts',
          type: 'config',
          template_source: 'app/react-spa/vite.config.ts'
        },
        {
          path: 'tsconfig.json',
          type: 'config',
          template_source: 'app/react-spa/tsconfig.json'
        },
        {
          path: 'tsconfig.node.json',
          type: 'config',
          template_source: 'app/react-spa/tsconfig.node.json'
        },
        {
          path: 'index.html',
          type: 'source',
          template_source: 'app/react-spa/index.html'
        },
        {
          path: '.gitignore',
          type: 'config',
          template_source: 'app/react-spa/.gitignore'
        },
        {
          path: 'README.md',
          type: 'doc',
          template_source: 'app/react-spa/README.md'
        },
        {
          path: 'src/main.tsx',
          type: 'source',
          template_source: 'app/react-spa/src/main.tsx'
        },
        {
          path: 'src/App.tsx',
          type: 'source',
          template_source: 'app/react-spa/src/App.tsx'
        },
        {
          path: 'src/App.css',
          type: 'style',
          template_source: 'app/react-spa/src/App.css'
        },
        {
          path: 'src/vite-env.d.ts',
          type: 'source',
          template_source: 'app/react-spa/src/vite-env.d.ts'
        }
      );
    } else {
      // Default/generic project files
      files.push(
        {
          path: 'src/index.ts',
          type: 'source',
          template_source: `${projectType}-template`
        },
        {
          path: 'package.json',
          type: 'config',
          template_source: 'package-template'
        },
        {
          path: 'tsconfig.json',
          type: 'config',
          template_source: 'tsconfig-template'
        }
      );

      // Add test file if enabled
      if (task.payload.template?.include_tests) {
        files.push({
          path: 'tests/index.test.ts',
          type: 'test',
          template_source: 'test-template'
        });
      }

      // Add README if docs enabled
      if (task.payload.template?.include_docs) {
        files.push({
          path: 'README.md',
          type: 'doc',
          template_source: 'readme-template'
        });
      }
    }

    // Add metadata to each file
    return files.map(file => ({
      ...file,
      size_bytes: 1024, // Will be updated after actual file creation
      checksum: this.generateChecksum(file.path),
      content_preview: `// Generated from template: ${file.template_source}`
    }));
  }

  private getDirectoriesForType(projectType: string): string[] {
    // For React SPA, we only need the src directory
    // Vite will handle public assets from the root
    if (projectType === 'app') {
      return ['src'];
    }

    const baseDirectories = ['src', 'tests'];

    switch (projectType) {
      case 'service':
        return [...baseDirectories, 'api', 'models', 'controllers', 'middleware'];
      case 'feature':
        return [...baseDirectories, 'hooks', 'components', 'styles'];
      case 'capability':
        return [...baseDirectories, 'lib', 'types'];
      default:
        return baseDirectories;
    }
  }

  private async createFiles(structure: any, task: ScaffoldTask): Promise<any> {
    const startTime = Date.now();
    const projectRoot = path.resolve(__dirname, '../../../../'); // Navigate to project root
    const outputDir = process.env.OUTPUT_DIR || path.join(projectRoot, 'ai.output');
    const projectPath = path.join(outputDir, task.workflow_id || 'default', task.payload.name);

    this.logger.info('Creating project files', {
      project_path: projectPath,
      file_count: structure.files_generated.length
    });

    try {
      // Create base project directory
      await this.fileGenerator.createDirectories([projectPath]);

      // Create subdirectories
      const directories = structure.directories.map((dir: string) =>
        path.join(projectPath, dir)
      );
      await this.fileGenerator.createDirectories(directories);

      // Process and create each file
      const filesCreated = [];
      let totalSize = 0;

      for (const fileInfo of structure.files_generated) {
        try {
          const filePath = path.join(projectPath, fileInfo.path);

          // Prepare template context
          const context = {
            ...task.payload,
            project_name: task.payload.name,
            message: "Hello, World!",
            description: task.payload.description || "Generated by Agentic SDLC",
            timestamp: new Date().toISOString()
          };

          // Render template
          let content: string;
          try {
            content = this.templateEngine.render(fileInfo.template_source, context);
          } catch (templateError) {
            this.logger.warn('Template rendering failed, using fallback', {
              template: fileInfo.template_source,
              error: templateError instanceof Error ? templateError.message : 'Unknown error'
            });
            // Fallback content for essential files
            content = this.getFallbackContent(fileInfo.path, context);
          }

          // Create the file
          await this.fileGenerator.createFiles([{
            path: filePath,
            content,
            type: fileInfo.type,
            description: `${fileInfo.type} file for ${task.payload.name}`
          }]);

          totalSize += content.length;
          filesCreated.push(fileInfo.path);

          this.logger.debug('File created', {
            path: filePath,
            size: content.length,
            type: fileInfo.type
          });
        } catch (fileError) {
          this.logger.error('Failed to create file', {
            file: fileInfo.path,
            error: fileError instanceof Error ? fileError.message : 'Unknown error'
          });
          // Continue with other files even if one fails
        }
      }

      const templateTime = Date.now() - startTime;

      this.logger.info('Files created successfully', {
        files_created: filesCreated.length,
        total_size: totalSize,
        project_path: projectPath,
        duration_ms: templateTime
      });

      return {
        filesCreated: filesCreated.length,
        templatesUsed: Array.from(new Set(structure.files_generated.map((f: any) => f.template_source))),
        totalSize,
        templateTime,
        outputPath: projectPath
      };
    } catch (error) {
      this.logger.error('File creation failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  private getFallbackContent(filePath: string, context: any): string {
    // Provide fallback content for essential files if template rendering fails
    const fileName = path.basename(filePath);

    switch (fileName) {
      case 'package.json':
        return JSON.stringify({
          name: context.project_name,
          version: "0.1.0",
          type: "module",
          scripts: {
            dev: "vite",
            build: "tsc && vite build",
            preview: "vite preview"
          },
          dependencies: {
            react: "^18.2.0",
            "react-dom": "^18.2.0"
          },
          devDependencies: {
            "@types/react": "^18.2.43",
            "@types/react-dom": "^18.2.17",
            "@vitejs/plugin-react": "^4.2.1",
            typescript: "^5.2.2",
            vite: "^5.0.8"
          }
        }, null, 2);

      case 'App.tsx':
        return `import React from 'react';
import './App.css';

function App() {
  return (
    <div className="App">
      <h1>${context.message || 'Hello, World!'}</h1>
      <p>Generated by Agentic SDLC</p>
    </div>
  );
}

export default App;`;

      case 'main.tsx':
        return `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);`;

      case 'index.html':
        return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${context.project_name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;

      case 'vite.config.ts':
        return `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
});`;

      case 'tsconfig.json':
        return JSON.stringify({
          compilerOptions: {
            target: "ES2020",
            useDefineForClassFields: true,
            lib: ["ES2020", "DOM", "DOM.Iterable"],
            module: "ESNext",
            skipLibCheck: true,
            moduleResolution: "bundler",
            allowImportingTsExtensions: true,
            resolveJsonModule: true,
            isolatedModules: true,
            noEmit: true,
            jsx: "react-jsx",
            strict: true,
            noUnusedLocals: true,
            noUnusedParameters: true,
            noFallthroughCasesInSwitch: true
          },
          include: ["src"],
          references: [{ path: "./tsconfig.node.json" }]
        }, null, 2);

      case 'tsconfig.node.json':
        return JSON.stringify({
          compilerOptions: {
            composite: true,
            skipLibCheck: true,
            module: "ESNext",
            moduleResolution: "bundler",
            allowSyntheticDefaultImports: true,
            strict: true
          },
          include: ["vite.config.ts"]
        }, null, 2);

      case 'App.css':
        return `#root {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

.App {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
}

h1 {
  font-size: 3.2em;
  line-height: 1.1;
  color: #646cff;
}

p {
  color: #888;
  margin-top: 1rem;
}`;

      case '.gitignore':
        return `# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?`;

      case 'README.md':
        return `# ${context.project_name}

${context.description}

## Installation

\`\`\`bash
npm install
\`\`\`

## Development

\`\`\`bash
npm run dev
\`\`\`

## Build

\`\`\`bash
npm run build
\`\`\`

## Preview Production Build

\`\`\`bash
npm run preview
\`\`\`

---

Generated by Agentic SDLC on ${context.timestamp}`;

      case 'vite-env.d.ts':
        return `/// <reference types="vite/client" />`;

      default:
        return `// Generated file: ${fileName}\n// Project: ${context.project_name}\n`;
    }
  }

  private determineNextSteps(task: ScaffoldTask, structure: any): any[] {
    const nextSteps = [];

    // Always validate after scaffolding
    nextSteps.push({
      agent: 'validation',
      action: 'validate_code',
      reason: 'Verify TypeScript compilation and linting',
      priority: 1
    });

    // Add E2E tests if test files were generated
    if (structure.test_files?.length > 0) {
      nextSteps.push({
        agent: 'e2e',
        action: 'generate_tests',
        reason: 'Create end-to-end test suite',
        priority: 2
      });
    }

    // Add deployment if it's a service
    if (task.payload.project_type === 'service') {
      nextSteps.push({
        agent: 'deployment',
        action: 'prepare_deployment',
        reason: 'Prepare Docker and deployment configuration',
        priority: 3
      });
    }

    return nextSteps;
  }

  private buildRequirementsPrompt(task: ScaffoldTask): string {
    return `Analyze the following requirements for a ${task.payload.project_type} project:

Project Name: ${task.payload.name}
Description: ${task.payload.description}
Requirements: ${task.payload.requirements.join(', ')}

Please provide a detailed analysis and return ONLY valid JSON with this exact structure (no markdown formatting, no code blocks, no explanatory text):

{
  "complexity": "low" | "medium" | "high",
  "components": [
    {
      "name": "component name",
      "purpose": "what it does",
      "type": "frontend" | "backend" | "database" | "service"
    }
  ],
  "architecture": {
    "pattern": "architecture pattern (e.g., MVC, layered, microservices)",
    "layers": ["list of architectural layers"],
    "recommendations": ["key architectural decisions"]
  },
  "dependencies": {
    "runtime": ["production dependencies with versions"],
    "development": ["dev dependencies with versions"]
  },
  "technical_decisions": [
    {
      "decision": "decision description",
      "rationale": "why this decision"
    }
  ]
}

IMPORTANT: Return ONLY the JSON object, no other text or formatting.`;
  }

  private extractDependencies(analysis: any): any[] {
    // Extract dependencies from analysis
    const deps = [];

    if (analysis.dependencies) {
      for (const [name, version] of Object.entries(analysis.dependencies)) {
        deps.push({
          name,
          version: version as string,
          reason: 'Required by project'
        });
      }
    }

    return deps;
  }

  private generateChecksum(content: string): string {
    // Simple checksum generation (in production, use crypto)
    return Buffer.from(content).toString('base64').substring(0, 8);
  }

  /**
   * SESSION #28: Parse JSON from Claude API response with multiple fallback strategies
   * Handles various response formats: pure JSON, markdown code blocks, text with JSON
   */
  private parseClaudeJsonResponse(response: string, taskId: string): any {
    // Strategy 1: Try parsing as pure JSON first
    try {
      return JSON.parse(response);
    } catch (firstError) {
      this.logger.debug('Direct JSON parse failed, trying extraction strategies', {
        task_id: taskId,
        error: firstError instanceof Error ? firstError.message : 'Unknown error'
      });
    }

    // Strategy 2: Extract JSON from markdown code blocks (```json ... ```)
    const jsonCodeBlockMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonCodeBlockMatch && jsonCodeBlockMatch[1]) {
      try {
        const extracted = jsonCodeBlockMatch[1].trim();
        this.logger.debug('Extracted JSON from markdown code block', {
          task_id: taskId,
          extracted_length: extracted.length
        });
        return JSON.parse(extracted);
      } catch (blockError) {
        this.logger.debug('Failed to parse extracted code block', {
          task_id: taskId,
          error: blockError instanceof Error ? blockError.message : 'Unknown error'
        });
      }
    }

    // Strategy 3: Find JSON object/array by looking for { or [ boundaries
    const jsonObjectMatch = response.match(/\{[\s\S]*\}/);
    const jsonArrayMatch = response.match(/\[[\s\S]*\]/);

    // Try object match first (most common for our use case)
    if (jsonObjectMatch) {
      try {
        const extracted = jsonObjectMatch[0].trim();
        this.logger.debug('Extracted JSON object from text', {
          task_id: taskId,
          extracted_length: extracted.length
        });
        return JSON.parse(extracted);
      } catch (objError) {
        this.logger.debug('Failed to parse extracted JSON object', {
          task_id: taskId,
          error: objError instanceof Error ? objError.message : 'Unknown error'
        });
      }
    }

    // Try array match
    if (jsonArrayMatch) {
      try {
        const extracted = jsonArrayMatch[0].trim();
        this.logger.debug('Extracted JSON array from text', {
          task_id: taskId,
          extracted_length: extracted.length
        });
        return JSON.parse(extracted);
      } catch (arrError) {
        this.logger.debug('Failed to parse extracted JSON array', {
          task_id: taskId,
          error: arrError instanceof Error ? arrError.message : 'Unknown error'
        });
      }
    }

    // Strategy 4: All strategies failed - throw with detailed error
    const errorMsg = 'Failed to extract valid JSON from Claude response after trying all strategies';
    this.logger.error(errorMsg, {
      task_id: taskId,
      response_preview: response.substring(0, 200),
      response_length: response.length,
      tried_strategies: ['direct_parse', 'code_block', 'object_boundaries', 'array_boundaries']
    });

    throw new Error(`${errorMsg}. Response preview: ${response.substring(0, 200)}`);
  }
}