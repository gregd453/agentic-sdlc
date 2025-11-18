import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { ContractValidator, AgentContract } from '../contract-validator';

// Sample schemas for testing
const TestInputSchema = z.object({
  task_id: z.string().uuid(),
  workflow_id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional()
});

const TestOutputSchema = z.object({
  status: z.enum([WORKFLOW_STATUS.SUCCESS, 'failure']),
  result: z.string(),
  metadata: z.record(z.unknown()).optional()
});

type TestInput = z.infer<typeof TestInputSchema>;
type TestOutput = z.infer<typeof TestOutputSchema>;

describe('ContractValidator', () => {
  const validator = new ContractValidator();

  // Sample contract
  const sampleContract: AgentContract<TestInput, TestOutput> = {
    name: 'test-agent',
    version: '1.0.0',
    supported_versions: ['1.0.0'],
    input_schema: TestInputSchema,
    output_schema: TestOutputSchema
  };

  describe('validateInput', () => {
    it('should validate correct input data', () => {
      const validInput = {
        task_id: '123e4567-e89b-12d3-a456-426614174000',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Test Task',
        description: 'Test description'
      };

      const result = validator.validateInput(sampleContract, validInput);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid input data', () => {
      const invalidInput = {
        task_id: 'not-a-uuid',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Test Task'
      };

      const result = validator.validateInput(sampleContract, invalidInput);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].type).toBe('schema');
    });

    it('should validate with version compatibility check', () => {
      const validInput = {
        task_id: '123e4567-e89b-12d3-a456-426614174000',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Test Task'
      };

      const result = validator.validateInput(sampleContract, validInput, '1.0.0');
      expect(result.valid).toBe(true);
      expect(result.version_compatibility).toBeDefined();
      expect(result.version_compatibility?.compatible).toBe(true);
    });

    it('should reject incompatible versions', () => {
      const validInput = {
        task_id: '123e4567-e89b-12d3-a456-426614174000',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Test Task'
      };

      const result = validator.validateInput(sampleContract, validInput, '5.0.0');
      expect(result.valid).toBe(false);
      expect(result.errors[0].type).toBe('version');
    });
  });

  describe('validateOutput', () => {
    it('should validate correct output data', () => {
      const validOutput = {
        status: WORKFLOW_STATUS.SUCCESS as const,
        result: 'Task completed',
        metadata: { duration: 1000 }
      };

      const result = validator.validateOutput(sampleContract, validOutput);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid output data', () => {
      const invalidOutput = {
        status: 'invalid-status',
        result: 'Task completed'
      };

      const result = validator.validateOutput(sampleContract, invalidOutput);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('checkBackwardCompatibility', () => {
    it('should accept compatible versions', () => {
      const oldContract = {
        ...sampleContract,
        version: '1.0.0'
      };

      const newContract = {
        ...sampleContract,
        version: '1.1.0',
        supported_versions: ['1.0.0', '1.1.0']
      };

      const result = validator.checkBackwardCompatibility(oldContract, newContract);
      expect(result.valid).toBe(true);
    });

    it('should detect version incompatibility', () => {
      const oldContract = {
        ...sampleContract,
        version: '1.0.0'
      };

      const newContract = {
        ...sampleContract,
        version: '5.0.0',
        supported_versions: ['5.0.0']
      };

      const result = validator.checkBackwardCompatibility(oldContract, newContract);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'version')).toBe(true);
    });

    it('should warn about missing old version support', () => {
      const oldContract = {
        ...sampleContract,
        version: '1.0.0'
      };

      const newContract = {
        ...sampleContract,
        version: '2.0.0',
        supported_versions: ['2.0.0']  // Missing 1.0.0
      };

      const result = validator.checkBackwardCompatibility(oldContract, newContract);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should report breaking changes', () => {
      const oldContract = {
        ...sampleContract,
        version: '1.0.0'
      };

      const newContract = {
        ...sampleContract,
        version: '2.0.0',
        supported_versions: ['1.0.0', '2.0.0'],
        breaking_changes: new Map([
          ['1.0.0', ['Field renamed', 'Required field added']]
        ])
      };

      const result = validator.checkBackwardCompatibility(oldContract, newContract);
      expect(result.errors.some(e => e.type === 'breaking_change')).toBe(true);
    });
  });

  describe('validateContractDefinition', () => {
    it('should validate correct contract definition', () => {
      const result = validator.validateContractDefinition(sampleContract);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing contract name', () => {
      const invalidContract = {
        ...sampleContract,
        name: ''
      };

      const result = validator.validateContractDefinition(invalidContract);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'name')).toBe(true);
    });

    it('should detect invalid version format', () => {
      const invalidContract = {
        ...sampleContract,
        version: 'invalid-version'
      };

      const result = validator.validateContractDefinition(invalidContract);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'version')).toBe(true);
    });

    it('should warn about missing supported versions', () => {
      const contractWithoutVersions = {
        ...sampleContract,
        supported_versions: []
      };

      const result = validator.validateContractDefinition(contractWithoutVersions);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should warn when current version not in supported versions', () => {
      const contractWithMismatch = {
        ...sampleContract,
        version: '2.0.0',
        supported_versions: ['1.0.0'] // Missing 2.0.0
      };

      const result = validator.validateContractDefinition(contractWithMismatch);
      expect(result.warnings.some(w => w.includes('not in supported_versions'))).toBe(true);
    });
  });

  describe('testContract', () => {
    it('should test contract with valid sample data', () => {
      const sampleInput = {
        task_id: '123e4567-e89b-12d3-a456-426614174000',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Test Task'
      };

      const sampleOutput = {
        status: WORKFLOW_STATUS.SUCCESS as const,
        result: 'Completed'
      };

      const result = validator.testContract(sampleContract, sampleInput, sampleOutput);
      expect(result.input_valid).toBe(true);
      expect(result.output_valid).toBe(true);
    });

    it('should detect invalid sample data', () => {
      const invalidInput = {
        task_id: 'invalid',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Test'
      };

      const validOutput = {
        status: WORKFLOW_STATUS.SUCCESS as const,
        result: 'Completed'
      };

      const result = validator.testContract(sampleContract, invalidInput, validOutput);
      expect(result.input_valid).toBe(false);
      expect(result.output_valid).toBe(true);
    });
  });

  describe('migration support', () => {
    it('should apply migration when available', () => {
      const contractWithMigration: AgentContract = {
        name: 'test-agent',
        version: '2.0.0',
        supported_versions: ['1.0.0', '2.0.0'],
        input_schema: TestInputSchema,
        output_schema: TestOutputSchema,
        migrations: new Map([
          ['1.0.0->2.0.0', (data) => ({
            ...data,
            // Add new required field
            name: data.name || 'default'
          })]
        ])
      };

      const oldFormatData = {
        task_id: '123e4567-e89b-12d3-a456-426614174000',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001'
        // Missing 'name' field
      };

      const result = validator.validateInput(
        contractWithMigration,
        oldFormatData,
        '1.0.0'
      );

      // Should succeed because migration adds missing field
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes('migrated'))).toBe(true);
    });

    it('should handle missing migration gracefully', () => {
      const input = {
        task_id: '123e4567-e89b-12d3-a456-426614174000',
        workflow_id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Test'
      };

      const result = validator.validateInput(sampleContract, input, '0.9.0');
      // Should warn about missing migration but attempt validation
      expect(result.warnings.some(w => w.includes('No migration'))).toBe(true);
    });
  });
});
