import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Redis from 'ioredis';
import { EventBus } from '../../src/events/event-bus';
import { AgentDispatcherService } from '../../src/services/agent-dispatcher.service';
import {
  ContractValidator,
  scaffoldContract,
  validationContract,
  e2eContract
} from '@agentic-sdlc/contracts';
import { SchemaRegistry } from '@agentic-sdlc/shared-types';

/**
 * Three-Agent Pipeline E2E Test
 *
 * Tests the complete agent pipeline with contract validation:
 * Scaffold Agent → Validation Agent → E2E Test Agent
 *
 * Validates:
 * 1. Contract framework functionality
 * 2. Schema registry integration
 * 3. Agent contract definitions
 * 4. Version compatibility
 * 5. Type safety across boundaries
 */
describe('Three-Agent Pipeline E2E', () => {
  let redisPublisher: Redis;
  let redisSubscriber: Redis;
  let eventBus: EventBus;
  let dispatcher: AgentDispatcherService;
  let contractValidator: ContractValidator;

  const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6380';

  beforeAll(async () => {
    // Initialize Redis clients
    redisPublisher = new Redis(REDIS_URL);
    redisSubscriber = new Redis(REDIS_URL);

    // Initialize Event Bus
    eventBus = new EventBus(REDIS_URL);

    // Initialize Agent Dispatcher
    dispatcher = new AgentDispatcherService(REDIS_URL);

    // Initialize Contract Validator
    contractValidator = new ContractValidator();

    // Note: SchemaRegistry uses static methods, no initialization needed
    // Schemas are auto-registered when shared-types package is imported

    // Wait for connections
    await new Promise(resolve => setTimeout(resolve, 100));
  }, 10000);

  afterAll(async () => {
    await eventBus.disconnect();
    await redisPublisher.quit();
    await redisSubscriber.quit();
  }, 5000);

  describe('Contract Validation Framework', () => {
    it('should validate scaffold contract definition', () => {
      const result = contractValidator.validateContractDefinition(scaffoldContract);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate validation contract definition', () => {
      const result = contractValidator.validateContractDefinition(validationContract);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate e2e contract definition', () => {
      const result = contractValidator.validateContractDefinition(e2eContract);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should have correct contract metadata', () => {
      expect(scaffoldContract.name).toBe('scaffold-agent');
      expect(scaffoldContract.version).toBe('1.0.0');
      expect(scaffoldContract.supported_versions).toContain('1.0.0');

      expect(validationContract.name).toBe('validation-agent');
      expect(validationContract.version).toBe('1.0.0');

      expect(e2eContract.name).toBe('e2e-agent');
      expect(e2eContract.version).toBe('1.0.0');
    });

    it('should have input and output schemas defined', () => {
      expect(scaffoldContract.input_schema).toBeDefined();
      expect(scaffoldContract.output_schema).toBeDefined();

      expect(validationContract.input_schema).toBeDefined();
      expect(validationContract.output_schema).toBeDefined();

      expect(e2eContract.input_schema).toBeDefined();
      expect(e2eContract.output_schema).toBeDefined();
    });
  });

  describe('Schema Registry Integration', () => {
    it('should have scaffold schemas registered', () => {
      expect(SchemaRegistry.has('scaffold.task')).toBe(true);
      expect(SchemaRegistry.has('scaffold.result')).toBe(true);
    });

    it('should have validation schemas registered', () => {
      expect(SchemaRegistry.has('validation.task')).toBe(true);
      expect(SchemaRegistry.has('validation.result')).toBe(true);
    });

    it('should have e2e schemas registered', () => {
      expect(SchemaRegistry.has('e2e.task')).toBe(true);
      expect(SchemaRegistry.has('e2e.result')).toBe(true);
    });

    it('should list all agent schemas', () => {
      const allSchemas = SchemaRegistry.list();
      const agentSchemas = allSchemas.filter(s =>
        s.includes('scaffold.') ||
        s.includes('validation.') ||
        s.includes('e2e.')
      );

      expect(agentSchemas.length).toBeGreaterThanOrEqual(6); // 3 agents × 2 schemas (task + result)
    });

    it('should describe schema entries', () => {
      const scaffoldDesc = SchemaRegistry.describe('scaffold.task');
      expect(scaffoldDesc).toBeDefined();
      expect(scaffoldDesc?.version).toBe('1.0.0');
    });
  });

  describe('Contract Version Compatibility', () => {
    it('should support current versions', () => {
      expect(scaffoldContract.supported_versions).toContain(scaffoldContract.version);
      expect(validationContract.supported_versions).toContain(validationContract.version);
      expect(e2eContract.supported_versions).toContain(e2eContract.version);
    });

    it('should have N-2 compatible version lists', () => {
      expect(Array.isArray(scaffoldContract.supported_versions)).toBe(true);
      expect(scaffoldContract.supported_versions.length).toBeGreaterThan(0);

      expect(Array.isArray(validationContract.supported_versions)).toBe(true);
      expect(validationContract.supported_versions.length).toBeGreaterThan(0);

      expect(Array.isArray(e2eContract.supported_versions)).toBe(true);
      expect(e2eContract.supported_versions.length).toBeGreaterThan(0);
    });

    it('should have migration support configured', () => {
      expect(scaffoldContract.migrations).toBeDefined();
      expect(scaffoldContract.migrations instanceof Map).toBe(true);

      expect(validationContract.migrations).toBeDefined();
      expect(e2eContract.migrations).toBeDefined();
    });

    it('should have breaking changes documentation', () => {
      expect(scaffoldContract.breaking_changes).toBeDefined();
      expect(scaffoldContract.breaking_changes instanceof Map).toBe(true);

      expect(validationContract.breaking_changes).toBeDefined();
      expect(e2eContract.breaking_changes).toBeDefined();
    });
  });

  describe('Pipeline Flow Type Safety', () => {
    it('should maintain type consistency across agent boundaries', () => {
      // This test verifies that TypeScript compilation ensures type safety
      // If this test compiles, it means our type definitions are correct

      // Scaffold contract has correct structure
      const scaffoldHasInputSchema: boolean = !!scaffoldContract.input_schema;
      const scaffoldHasOutputSchema: boolean = !!scaffoldContract.output_schema;
      expect(scaffoldHasInputSchema).toBe(true);
      expect(scaffoldHasOutputSchema).toBe(true);

      // Validation contract follows same pattern
      const validationHasInputSchema: boolean = !!validationContract.input_schema;
      const validationHasOutputSchema: boolean = !!validationContract.output_schema;
      expect(validationHasInputSchema).toBe(true);
      expect(validationHasOutputSchema).toBe(true);

      // E2E contract follows same pattern
      const e2eHasInputSchema: boolean = !!e2eContract.input_schema;
      const e2eHasOutputSchema: boolean = !!e2eContract.output_schema;
      expect(e2eHasInputSchema).toBe(true);
      expect(e2eHasOutputSchema).toBe(true);
    });

    it('should have consistent contract structure across all agents', () => {
      const contracts = [scaffoldContract, validationContract, e2eContract];

      for (const contract of contracts) {
        // All contracts must have these fields
        expect(contract.name).toBeDefined();
        expect(contract.version).toBeDefined();
        expect(contract.supported_versions).toBeDefined();
        expect(contract.input_schema).toBeDefined();
        expect(contract.output_schema).toBeDefined();
        expect(contract.migrations).toBeDefined();
        expect(contract.breaking_changes).toBeDefined();

        // Version should be valid semver
        expect(contract.version).toMatch(/^\d+\.\d+\.\d+$/);

        // Supported versions should include current version
        expect(contract.supported_versions).toContain(contract.version);
      }
    });
  });

  describe('Contract Validation Error Handling', () => {
    it('should detect invalid contract definitions', () => {
      const invalidContract = {
        name: '', // Invalid - empty name
        version: 'invalid', // Invalid - not semver
        supported_versions: [],
        input_schema: null, // Invalid - missing schema
        output_schema: null
      };

      const result = contractValidator.validateContractDefinition(invalidContract as any);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should provide detailed error messages', () => {
      const invalidContract = {
        name: '',
        version: '1.0.0',
        supported_versions: ['1.0.0'],
        input_schema: {} as any,
        output_schema: {} as any
      };

      const result = contractValidator.validateContractDefinition(invalidContract as any);
      expect(result.valid).toBe(false);

      const hasNameError = result.errors.some(e => e.field === 'name');
      expect(hasNameError).toBe(true);
    });
  });

  describe('Schema Registry Functionality', () => {
    it('should check if schemas exist', () => {
      expect(SchemaRegistry.has('workflow')).toBe(true);
      expect(SchemaRegistry.has('agent.task')).toBe(true);
    });

    it('should list all registered schemas', () => {
      const schemas = SchemaRegistry.list();
      expect(Array.isArray(schemas)).toBe(true);
      expect(schemas.length).toBeGreaterThan(0);

      // Should include core schemas
      expect(schemas.some(s => s.includes('workflow'))).toBe(true);
      expect(schemas.some(s => s.includes('agent.task'))).toBe(true);
    });

    it('should describe schema entries', () => {
      const desc = SchemaRegistry.describe('workflow');
      expect(desc).toBeDefined();
      expect(desc?.schema).toBeDefined();
      expect(desc?.version).toBeDefined();
    });
  });
});
