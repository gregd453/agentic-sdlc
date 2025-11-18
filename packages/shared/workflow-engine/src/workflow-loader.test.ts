import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  WorkflowLoader,
  WorkflowLoaderError,
  createWorkflowLoader
} from './workflow-loader';
import { WorkflowDefinition } from './workflow-schema';

const testDir = './test-workflows';

describe('WorkflowLoader', () => {
  let loader: WorkflowLoader;
  let workflowYaml: string;
  let workflowJson: string;

  const sampleWorkflow: WorkflowDefinition = {
    name: 'test-workflow',
    version: '1.0.0',
    description: 'Sample test workflow',
    start_stage: AGENT_TYPES.SCAFFOLD,
    stages: {
      scaffold: {
        name: 'Scaffold',
        agent_type: AGENT_TYPES.SCAFFOLD,
        timeout_ms: 60000,
        max_retries: 3,
        on_success: 'validate'
      },
      validate: {
        name: 'Validate',
        agent_type: AGENT_TYPES.VALIDATION,
        timeout_ms: 30000,
        max_retries: 2
      }
    }
  };

  beforeEach(() => {
    loader = new WorkflowLoader();

    // Create test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Create YAML workflow file
    workflowYaml = path.join(testDir, 'test-workflow.yaml');
    const yamlContent = `name: test-workflow
version: '1.0.0'
description: Sample test workflow
start_stage: scaffold
stages:
  scaffold:
    name: Scaffold
    agent_type: scaffold
    timeout_ms: 60000
    max_retries: 3
    on_success: validate
  validate:
    name: Validate
    agent_type: validation
    timeout_ms: 30000
    max_retries: 2
`;
    fs.writeFileSync(workflowYaml, yamlContent, 'utf-8');

    // Create JSON workflow file
    workflowJson = path.join(testDir, 'test-workflow.json');
    fs.writeFileSync(workflowJson, JSON.stringify(sampleWorkflow, null, 2), 'utf-8');
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testDir)) {
      const files = fs.readdirSync(testDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(testDir, file));
      });
      fs.rmdirSync(testDir);
    }
  });

  describe('loadWorkflow from YAML', () => {
    it('should load valid YAML workflow', async () => {
      const workflow = await loader.loadWorkflow(workflowYaml);

      expect(workflow.name).toBe('test-workflow');
      expect(workflow.version).toBe('1.0.0');
      expect(workflow.start_stage).toBe(AGENT_TYPES.SCAFFOLD);
      expect(workflow.stages.scaffold).toBeDefined();
    });

    it('should throw on non-existent file', async () => {
      await expect(
        loader.loadWorkflow('./nonexistent.yaml')
      ).rejects.toThrow(WorkflowLoaderError);
    });

    it('should throw on unsupported format', async () => {
      const txtFile = path.join(testDir, 'workflow.txt');
      fs.writeFileSync(txtFile, 'invalid content');

      await expect(
        loader.loadWorkflow(txtFile)
      ).rejects.toThrow(WorkflowLoaderError);
    });
  });

  describe('loadWorkflow from JSON', () => {
    it('should load valid JSON workflow', async () => {
      const workflow = await loader.loadWorkflow(workflowJson);

      expect(workflow.name).toBe('test-workflow');
      expect(workflow.version).toBe('1.0.0');
      expect(workflow.stages.scaffold).toBeDefined();
    });

    it('should throw on invalid JSON', async () => {
      const badJsonFile = path.join(testDir, 'bad.json');
      fs.writeFileSync(badJsonFile, '{invalid json}');

      await expect(
        loader.loadWorkflow(badJsonFile)
      ).rejects.toThrow(WorkflowLoaderError);
    });
  });

  describe('loadFromJsonString', () => {
    it('should parse valid JSON string', () => {
      const json = JSON.stringify(sampleWorkflow);
      const workflow = loader.loadFromJsonString(json);

      expect(workflow.name).toBe('test-workflow');
      expect(workflow.stages).toBeDefined();
    });

    it('should throw on invalid JSON', () => {
      expect(() => {
        loader.loadFromJsonString('{invalid}');
      }).toThrow(WorkflowLoaderError);
    });

    it('should throw on invalid workflow schema', () => {
      const invalid = JSON.stringify({
        name: 'test',
        // Missing required fields
      });

      expect(() => {
        loader.loadFromJsonString(invalid);
      }).toThrow(WorkflowLoaderError);
    });
  });

  describe('loadFromYamlString', () => {
    it('should parse valid YAML string', () => {
      const yaml = `
name: test-workflow
version: '1.0.0'
start_stage: scaffold
stages:
  scaffold:
    name: Scaffold
    agent_type: scaffold
    timeout_ms: 60000
    max_retries: 3
`;
      const workflow = loader.loadFromYamlString(yaml);

      expect(workflow.name).toBe('test-workflow');
      expect(workflow.start_stage).toBe(AGENT_TYPES.SCAFFOLD);
    });

    it('should throw on invalid YAML', () => {
      expect(() => {
        loader.loadFromYamlString('{ invalid: [yaml');
      }).toThrow();
    });
  });

  describe('loadWorkflowsFromDirectory', () => {
    it('should load all workflows from directory', async () => {
      // Create additional workflow
      const workflow2 = {
        ...sampleWorkflow,
        name: 'another-workflow'
      };
      const workflow2Path = path.join(testDir, 'another-workflow.json');
      fs.writeFileSync(workflow2Path, JSON.stringify(workflow2, null, 2));

      const workflows = await loader.loadWorkflowsFromDirectory(testDir);

      expect(workflows.size).toBe(2);
      expect(workflows.has('test-workflow')).toBe(true);
      expect(workflows.has('another-workflow')).toBe(true);
    });

    it('should use workflow name as key', async () => {
      const workflows = await loader.loadWorkflowsFromDirectory(testDir);
      const workflow = workflows.get('test-workflow');

      expect(workflow).toBeDefined();
      expect(workflow?.name).toBe('test-workflow');
    });

    it('should throw if directory does not exist', async () => {
      await expect(
        loader.loadWorkflowsFromDirectory('./nonexistent-dir')
      ).rejects.toThrow(WorkflowLoaderError);
    });

    it('should skip invalid files', async () => {
      // Create invalid file
      const invalidFile = path.join(testDir, 'invalid.json');
      fs.writeFileSync(invalidFile, '{invalid}');

      // Should still work and load valid files
      const workflows = await loader.loadWorkflowsFromDirectory(testDir);

      expect(workflows.size).toBeGreaterThan(0);
      expect(workflows.has('test-workflow')).toBe(true);
    });

    it('should ignore non-workflow files', async () => {
      const txtFile = path.join(testDir, 'readme.txt');
      fs.writeFileSync(txtFile, 'some text');

      const workflows = await loader.loadWorkflowsFromDirectory(testDir);

      // Should only load .yaml, .yml, .json files
      expect(workflows.size).toBe(1);
      expect(workflows.has('test-workflow')).toBe(true);
    });
  });

  describe('saveWorkflow', () => {
    it('should save workflow as YAML', async () => {
      const outputPath = path.join(testDir, 'saved.yaml');

      await loader.saveWorkflow(sampleWorkflow, outputPath, 'yaml');

      expect(fs.existsSync(outputPath)).toBe(true);

      // Verify by reloading
      const loaded = await loader.loadWorkflow(outputPath);
      expect(loaded.name).toBe(sampleWorkflow.name);
    });

    it('should save workflow as JSON', async () => {
      const outputPath = path.join(testDir, 'saved.json');

      await loader.saveWorkflow(sampleWorkflow, outputPath, 'json');

      expect(fs.existsSync(outputPath)).toBe(true);

      // Verify by reloading
      const loaded = await loader.loadWorkflow(outputPath);
      expect(loaded.name).toBe(sampleWorkflow.name);
    });

    it('should default to YAML format', async () => {
      const outputPath = path.join(testDir, 'default-format');

      await loader.saveWorkflow(sampleWorkflow, outputPath);

      expect(fs.existsSync(outputPath)).toBe(true);

      // Should be valid YAML
      const loaded = await loader.loadWorkflow(outputPath);
      expect(loaded.name).toBe(sampleWorkflow.name);
    });

    it('should throw on invalid workflow', async () => {
      const invalidWorkflow = {
        name: 'invalid'
        // Missing required fields
      } as any;

      await expect(
        loader.saveWorkflow(invalidWorkflow, './test.yaml')
      ).rejects.toThrow(WorkflowLoaderError);
    });
  });

  describe('createWorkflowLoader factory', () => {
    it('should create loader instance', () => {
      const newLoader = createWorkflowLoader();

      expect(newLoader).toBeInstanceOf(WorkflowLoader);
    });
  });

  describe('round-trip loading', () => {
    it('should preserve data through save and load cycle', async () => {
      const outputPath = path.join(testDir, 'roundtrip.yaml');

      // Save
      await loader.saveWorkflow(sampleWorkflow, outputPath, 'yaml');

      // Load
      const loaded = await loader.loadWorkflow(outputPath);

      // Verify
      expect(loaded.name).toBe(sampleWorkflow.name);
      expect(loaded.version).toBe(sampleWorkflow.version);
      expect(loaded.start_stage).toBe(sampleWorkflow.start_stage);
      expect(loaded.stages).toEqual(sampleWorkflow.stages);
    });
  });
});
