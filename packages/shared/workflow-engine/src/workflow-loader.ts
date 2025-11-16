import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { WorkflowDefinition, validateWorkflowDefinition, WorkflowSchemaError } from './workflow-schema';

/**
 * Workflow Loader
 * Loads and validates workflow definitions from YAML and JSON files
 */
export class WorkflowLoader {
  private readonly logger: any;

  /**
   * Constructor with optional logger injection
   * If no logger provided, uses console as fallback
   */
  constructor(injectedLogger?: any) {
    this.logger = injectedLogger || console;
  }

  /**
   * Load workflow definition from file
   */
  async loadWorkflow(filePath: string): Promise<WorkflowDefinition> {
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new WorkflowLoaderError(`Workflow file not found: ${filePath}`);
      }

      // Read file content
      const content = fs.readFileSync(filePath, 'utf-8');

      // Parse based on file extension
      const ext = path.extname(filePath).toLowerCase();
      let definition: unknown;

      switch (ext) {
        case '.yaml':
        case '.yml':
          definition = yaml.load(content);
          break;
        case '.json':
          definition = JSON.parse(content);
          break;
        default:
          throw new WorkflowLoaderError(`Unsupported workflow file format: ${ext}`);
      }

      // Validate against schema
      try {
        const validated = validateWorkflowDefinition(definition);
        this.logger.log(`✅ [WorkflowLoader] Loaded workflow: ${validated.name} v${validated.version}`);
        return validated;
      } catch (error) {
        throw new WorkflowLoaderError(
          `Invalid workflow definition in ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
          filePath
        );
      }
    } catch (error) {
      if (error instanceof WorkflowLoaderError) {
        throw error;
      }
      throw new WorkflowLoaderError(
        `Failed to load workflow from ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
        filePath
      );
    }
  }

  /**
   * Load workflow from JSON string
   */
  loadFromJsonString(json: string): WorkflowDefinition {
    try {
      const definition = JSON.parse(json);
      return validateWorkflowDefinition(definition);
    } catch (error) {
      throw new WorkflowLoaderError(
        `Failed to parse workflow JSON: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Load workflow from YAML string
   */
  loadFromYamlString(yamlContent: string): WorkflowDefinition {
    try {
      const definition = yaml.load(yamlContent);
      return validateWorkflowDefinition(definition);
    } catch (error) {
      throw new WorkflowLoaderError(
        `Failed to parse workflow YAML: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Load all workflows from a directory
   */
  async loadWorkflowsFromDirectory(dirPath: string): Promise<Map<string, WorkflowDefinition>> {
    const workflows = new Map<string, WorkflowDefinition>();

    try {
      if (!fs.existsSync(dirPath)) {
        throw new WorkflowLoaderError(`Workflow directory not found: ${dirPath}`);
      }

      const files = fs.readdirSync(dirPath);
      const workflowFiles = files.filter(f =>
        f.endsWith('.yaml') || f.endsWith('.yml') || f.endsWith('.json')
      );

      for (const file of workflowFiles) {
        try {
          const filePath = path.join(dirPath, file);
          const workflow = await this.loadWorkflow(filePath);
          workflows.set(workflow.name, workflow);
          this.logger.log(`✅ [WorkflowLoader] Loaded: ${workflow.name}`);
        } catch (error) {
          this.logger.error(`⚠️  [WorkflowLoader] Failed to load ${file}:`, error);
        }
      }

      this.logger.log(`✅ [WorkflowLoader] Loaded ${workflows.size} workflows from ${dirPath}`);
      return workflows;
    } catch (error) {
      throw new WorkflowLoaderError(
        `Failed to load workflows from directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`,
        dirPath
      );
    }
  }

  /**
   * Save workflow definition to file
   */
  async saveWorkflow(workflow: WorkflowDefinition, filePath: string, format: 'yaml' | 'json' = 'yaml'): Promise<void> {
    try {
      // Validate before saving
      validateWorkflowDefinition(workflow);

      const content = format === 'yaml'
        ? yaml.dump(workflow, { indent: 2 })
        : JSON.stringify(workflow, null, 2);

      fs.writeFileSync(filePath, content, 'utf-8');
      this.logger.log(`✅ [WorkflowLoader] Saved workflow to: ${filePath}`);
    } catch (error) {
      throw new WorkflowLoaderError(
        `Failed to save workflow to ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
        filePath
      );
    }
  }
}

/**
 * Error thrown during workflow loading
 */
export class WorkflowLoaderError extends Error {
  constructor(message: string, public readonly filePath?: string) {
    super(message);
    this.name = 'WorkflowLoaderError';
  }
}

/**
 * Create workflow loader instance
 */
export function createWorkflowLoader(): WorkflowLoader {
  return new WorkflowLoader();
}
