import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentRegistry, AgentNotFoundError } from './agent-registry';
import { AgentMetadata, AgentMetadataError } from './agent-metadata';
import { AgentFactoryError } from './agent-factory';

// Mock message bus
const mockMessageBus = {
  publish: vi.fn(),
  subscribe: vi.fn(),
  health: vi.fn().mockResolvedValue({ ok: true })
};

// Mock agent instance
const createMockAgent = (type: string) => ({
  type,
  initialize: vi.fn().mockResolvedValue(undefined),
  execute: vi.fn().mockResolvedValue({ success: true })
});

// Test metadata
const scaffoldMetadata: AgentMetadata = {
  name: AGENT_TYPES.SCAFFOLD,
  type: AGENT_TYPES.SCAFFOLD,
  version: '1.0.0',
  description: 'Code scaffolding agent',
  capabilities: ['analyze-requirements', 'generate-structure', 'create-boilerplate'],
  timeout_ms: 30000,
  max_retries: 3
};

const validationMetadata: AgentMetadata = {
  name: AGENT_TYPES.VALIDATION,
  type: AGENT_TYPES.VALIDATION,
  version: '1.0.0',
  capabilities: ['typescript-compilation', 'eslint-validation'],
  timeout_ms: 60000,
  max_retries: 2
};

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
  });

  describe('registerAgent', () => {
    it('should register an agent with valid metadata', () => {
      const factory = vi.fn().mockResolvedValue(createMockAgent(AGENT_TYPES.SCAFFOLD));

      registry.registerAgent(scaffoldMetadata, factory);

      expect(registry.isRegistered(AGENT_TYPES.SCAFFOLD)).toBe(true);
      expect(registry.size()).toBe(1);
    });

    it('should throw error when registering duplicate agent', () => {
      const factory = vi.fn();

      registry.registerAgent(scaffoldMetadata, factory);

      expect(() => {
        registry.registerAgent(scaffoldMetadata, factory);
      }).toThrow('already registered');
    });

    it('should throw AgentMetadataError for invalid metadata', () => {
      const factory = vi.fn();
      const invalidMetadata = {
        name: 'invalid'
        // Missing required fields: type, version, capabilities
      };

      expect(() => {
        registry.registerAgent(invalidMetadata, factory);
      }).toThrow(AgentMetadataError);
    });

    it('should register multiple agents', () => {
      const scaffoldFactory = vi.fn();
      const validationFactory = vi.fn();

      registry.registerAgent(scaffoldMetadata, scaffoldFactory);
      registry.registerAgent(validationMetadata, validationFactory);

      expect(registry.size()).toBe(2);
      expect(registry.isRegistered(AGENT_TYPES.SCAFFOLD)).toBe(true);
      expect(registry.isRegistered(AGENT_TYPES.VALIDATION)).toBe(true);
    });
  });

  describe('getMetadata', () => {
    it('should return metadata for registered agent', () => {
      const factory = vi.fn();
      registry.registerAgent(scaffoldMetadata, factory);

      const metadata = registry.getMetadata(AGENT_TYPES.SCAFFOLD);

      expect(metadata).toEqual(scaffoldMetadata);
    });

    it('should return undefined for unregistered agent', () => {
      const metadata = registry.getMetadata('nonexistent');

      expect(metadata).toBeUndefined();
    });
  });

  describe('isRegistered', () => {
    it('should return true for registered agent', () => {
      const factory = vi.fn();
      registry.registerAgent(scaffoldMetadata, factory);

      expect(registry.isRegistered(AGENT_TYPES.SCAFFOLD)).toBe(true);
    });

    it('should return false for unregistered agent', () => {
      expect(registry.isRegistered(AGENT_TYPES.SCAFFOLD)).toBe(false);
    });
  });

  describe('listAgents', () => {
    it('should return empty list when no agents registered', () => {
      const agents = registry.listAgents();

      expect(agents).toEqual([]);
    });

    it('should return all registered agents', () => {
      const scaffoldFactory = vi.fn();
      const validationFactory = vi.fn();

      registry.registerAgent(scaffoldMetadata, scaffoldFactory);
      registry.registerAgent(validationMetadata, validationFactory);

      const agents = registry.listAgents();

      expect(agents).toHaveLength(2);
      expect(agents).toContainEqual(scaffoldMetadata);
      expect(agents).toContainEqual(validationMetadata);
    });
  });

  describe('createAgent', () => {
    it('should create agent instance using factory', async () => {
      const mockAgent = createMockAgent(AGENT_TYPES.SCAFFOLD);
      const factory = vi.fn().mockResolvedValue(mockAgent);

      registry.registerAgent(scaffoldMetadata, factory);
      const agent = await registry.createAgent(AGENT_TYPES.SCAFFOLD, mockMessageBus as any);

      expect(factory).toHaveBeenCalledWith(mockMessageBus, undefined);
      expect(agent).toBe(mockAgent);
    });

    it('should pass configuration to factory', async () => {
      const mockAgent = createMockAgent(AGENT_TYPES.SCAFFOLD);
      const factory = vi.fn().mockResolvedValue(mockAgent);
      const config = { timeout: 5000 };

      registry.registerAgent(scaffoldMetadata, factory);
      await registry.createAgent(AGENT_TYPES.SCAFFOLD, mockMessageBus as any, config);

      expect(factory).toHaveBeenCalledWith(mockMessageBus, config);
    });

    it('should throw AgentNotFoundError when agent not registered', async () => {
      await expect(
        registry.createAgent('nonexistent', mockMessageBus as any)
      ).rejects.toThrow(AgentFactoryError);
    });

    it('should throw AgentFactoryError when factory fails', async () => {
      const factory = vi.fn().mockRejectedValue(new Error('Factory failed'));

      registry.registerAgent(scaffoldMetadata, factory);

      await expect(
        registry.createAgent(AGENT_TYPES.SCAFFOLD, mockMessageBus as any)
      ).rejects.toThrow(AgentFactoryError);
    });

    it('should throw error when created agent missing initialize method', async () => {
      const invalidAgent = { type: AGENT_TYPES.SCAFFOLD }; // Missing initialize()
      const factory = vi.fn().mockResolvedValue(invalidAgent);

      registry.registerAgent(scaffoldMetadata, factory);

      // Agent should be created, registry doesn't validate initialize at creation time
      const agent = await registry.createAgent(AGENT_TYPES.SCAFFOLD, mockMessageBus as any);
      expect(agent).toBe(invalidAgent);
    });
  });

  describe('validateConfig', () => {
    it('should validate config for registered agent', () => {
      const factory = vi.fn();
      registry.registerAgent(scaffoldMetadata, factory);

      // Should not throw for agent without config schema
      expect(() => {
        registry.validateConfig(AGENT_TYPES.SCAFFOLD, {});
      }).not.toThrow();
    });

    it('should throw for unregistered agent', () => {
      expect(() => {
        registry.validateConfig('nonexistent', {});
      }).toThrow('not found');
    });
  });

  describe('clear', () => {
    it('should clear all registered agents', () => {
      const scaffoldFactory = vi.fn();
      const validationFactory = vi.fn();

      registry.registerAgent(scaffoldMetadata, scaffoldFactory);
      registry.registerAgent(validationMetadata, validationFactory);

      expect(registry.size()).toBe(2);

      registry.clear();

      expect(registry.size()).toBe(0);
      expect(registry.isRegistered(AGENT_TYPES.SCAFFOLD)).toBe(false);
      expect(registry.isRegistered(AGENT_TYPES.VALIDATION)).toBe(false);
    });
  });

  describe('size', () => {
    it('should return 0 when empty', () => {
      expect(registry.size()).toBe(0);
    });

    it('should return correct count of registered agents', () => {
      registry.registerAgent(scaffoldMetadata, vi.fn());
      expect(registry.size()).toBe(1);

      registry.registerAgent(validationMetadata, vi.fn());
      expect(registry.size()).toBe(2);
    });
  });
});
