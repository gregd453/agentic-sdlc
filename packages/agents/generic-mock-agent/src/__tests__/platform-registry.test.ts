/**
 * Phase 4: Platform Registry Scoping Tests
 *
 * Tests AgentRegistry platform scoping functionality
 * without requiring agent instantiation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AgentRegistry } from '@agentic-sdlc/agent-registry';
import { AGENT_TYPES } from '@agentic-sdlc/shared-types';

describe('Phase 4: Platform Registry Scoping', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
  });

  afterEach(() => {
    registry.clear();
  });

  describe('Global Agent Registration', () => {
    it('should register global scaffold agent', () => {
      const metadata = {
        name: 'global-scaffold',
        type: AGENT_TYPES.SCAFFOLD,
        version: '1.0.0',
        capabilities: [AGENT_TYPES.SCAFFOLD]
      };

      registry.registerAgent(metadata, async () => ({}));

      expect(registry.isRegistered(AGENT_TYPES.SCAFFOLD)).toBe(true);
      expect(registry.getMetadata(AGENT_TYPES.SCAFFOLD)).toBeDefined();
      expect(registry.size()).toBe(1);
    });

    it('should register multiple global agents', () => {
      const agents = [
        AGENT_TYPES.SCAFFOLD,
        AGENT_TYPES.VALIDATION,
        AGENT_TYPES.E2E,
        AGENT_TYPES.INTEGRATION,
        AGENT_TYPES.DEPLOYMENT
      ];

      for (const agentType of agents) {
        registry.registerAgent(
          {
            name: `global-${agentType}`,
            type: agentType,
            version: '1.0.0',
            capabilities: [agentType]
          },
          async () => ({})
        );
      }

      expect(registry.size()).toBe(agents.length);
      for (const agentType of agents) {
        expect(registry.isRegistered(agentType)).toBe(true);
      }
    });
  });

  describe('Platform-Scoped Agent Registration', () => {
    it('should register platform-scoped agent', () => {
      const metadata = {
        name: 'web-app-scaffold',
        type: AGENT_TYPES.SCAFFOLD,
        version: '1.0.0',
        capabilities: [AGENT_TYPES.SCAFFOLD]
      };

      registry.registerAgent(metadata, async () => ({}), 'web-app-platform');

      expect(registry.isRegistered(AGENT_TYPES.SCAFFOLD, 'web-app-platform')).toBe(true);
      expect(registry.getMetadata(AGENT_TYPES.SCAFFOLD, 'web-app-platform')).toBeDefined();
    });

    it('should register same agent type for multiple platforms', () => {
      const platforms = ['web-app-platform', 'data-pipeline-platform', 'infrastructure-platform'];
      const metadata = {
        name: AGENT_TYPES.SCAFFOLD,
        type: AGENT_TYPES.SCAFFOLD,
        version: '1.0.0',
        capabilities: [AGENT_TYPES.SCAFFOLD]
      };

      for (const platform of platforms) {
        registry.registerAgent(metadata, async () => ({}), platform);
      }

      expect(registry.size()).toBe(3);

      for (const platform of platforms) {
        expect(registry.isRegistered(AGENT_TYPES.SCAFFOLD, platform)).toBe(true);
      }
    });

    it('should register different agents for the same platform', () => {
      const agentTypes = [AGENT_TYPES.SCAFFOLD, AGENT_TYPES.VALIDATION];

      for (const agentType of agentTypes) {
        registry.registerAgent(
          {
            name: `web-app-${agentType}`,
            type: agentType,
            version: '1.0.0',
            capabilities: [agentType]
          },
          async () => ({}),
          'web-app-platform'
        );
      }

      expect(registry.size()).toBe(2);
      expect(registry.isRegistered(AGENT_TYPES.SCAFFOLD, 'web-app-platform')).toBe(true);
      expect(registry.isRegistered(AGENT_TYPES.VALIDATION, 'web-app-platform')).toBe(true);
    });

    it('should prevent duplicate platform-scoped registrations', () => {
      const metadata = {
        name: 'web-app-scaffold',
        type: AGENT_TYPES.SCAFFOLD,
        version: '1.0.0',
        capabilities: [AGENT_TYPES.SCAFFOLD]
      };

      registry.registerAgent(metadata, async () => ({}), 'web-app-platform');

      expect(() => {
        registry.registerAgent(metadata, async () => ({}), 'web-app-platform');
      }).toThrow();
    });
  });

  describe('Platform Preference Logic', () => {
    it('should prefer platform-scoped over global agent', () => {
      // Register global agent
      registry.registerAgent(
        {
          name: 'global-scaffold',
          type: AGENT_TYPES.SCAFFOLD,
          version: '1.0.0',
          capabilities: [AGENT_TYPES.SCAFFOLD]
        },
        async () => ({})
      );

      // Register platform-scoped agent with different version
      registry.registerAgent(
        {
          name: 'web-app-scaffold',
          type: AGENT_TYPES.SCAFFOLD,
          version: '2.0.0',
          capabilities: [AGENT_TYPES.SCAFFOLD]
        },
        async () => ({}),
        'web-app-platform'
      );

      // Without platform, should get global (v1.0.0)
      const globalMeta = registry.getMetadata(AGENT_TYPES.SCAFFOLD);
      expect(globalMeta?.version).toBe('1.0.0');

      // With platform, should get platform-scoped (v2.0.0)
      const platformMeta = registry.getMetadata(AGENT_TYPES.SCAFFOLD, 'web-app-platform');
      expect(platformMeta?.version).toBe('2.0.0');
    });

    it('should fallback to global agent if platform-scoped not found', () => {
      // Register global agent
      registry.registerAgent(
        {
          name: 'global-scaffold',
          type: AGENT_TYPES.SCAFFOLD,
          version: '1.0.0',
          capabilities: [AGENT_TYPES.SCAFFOLD]
        },
        async () => ({})
      );

      // Request with non-existent platform should return global
      const meta = registry.getMetadata(AGENT_TYPES.SCAFFOLD, 'non-existent-platform');
      expect(meta?.version).toBe('1.0.0');
    });
  });

  describe('Agent Listing', () => {
    it('should list only global agents when no platform specified', () => {
      // Register global agents
      for (const agentType of [AGENT_TYPES.SCAFFOLD, AGENT_TYPES.VALIDATION]) {
        registry.registerAgent(
          {
            name: `global-${agentType}`,
            type: agentType,
            version: '1.0.0',
            capabilities: [agentType]
          },
          async () => ({})
        );
      }

      // Register platform-scoped agents
      for (const agentType of [AGENT_TYPES.E2E, AGENT_TYPES.INTEGRATION]) {
        registry.registerAgent(
          {
            name: `web-app-${agentType}`,
            type: agentType,
            version: '1.0.0',
            capabilities: [agentType]
          },
          async () => ({}),
          'web-app-platform'
        );
      }

      const globalAgents = registry.listAgents();
      expect(globalAgents).toHaveLength(2);
      expect(globalAgents.map(a => a.type)).toContain(AGENT_TYPES.SCAFFOLD);
      expect(globalAgents.map(a => a.type)).toContain(AGENT_TYPES.VALIDATION);
    });

    it('should list platform-scoped agents plus global fallbacks', () => {
      // Register global scaffold
      registry.registerAgent(
        {
          name: 'global-scaffold',
          type: AGENT_TYPES.SCAFFOLD,
          version: '1.0.0',
          capabilities: [AGENT_TYPES.SCAFFOLD]
        },
        async () => ({})
      );

      // Register platform-scoped validation
      registry.registerAgent(
        {
          name: 'web-app-validation',
          type: AGENT_TYPES.VALIDATION,
          version: '1.0.0',
          capabilities: [AGENT_TYPES.VALIDATION]
        },
        async () => ({}),
        'web-app-platform'
      );

      const platformAgents = registry.listAgents('web-app-platform');

      // Should have validation (platform-scoped) + scaffold (global fallback)
      expect(platformAgents).toHaveLength(2);
      expect(platformAgents.map(a => a.type)).toContain(AGENT_TYPES.VALIDATION);
      expect(platformAgents.map(a => a.type)).toContain(AGENT_TYPES.SCAFFOLD);
    });
  });

  describe('Registry Statistics', () => {
    it('should provide accurate registry statistics', () => {
      // Register global agents
      for (const agentType of [AGENT_TYPES.SCAFFOLD, AGENT_TYPES.VALIDATION]) {
        registry.registerAgent(
          {
            name: `global-${agentType}`,
            type: agentType,
            version: '1.0.0',
            capabilities: [agentType]
          },
          async () => ({})
        );
      }

      // Register platform-scoped agents for web-app
      for (const agentType of [AGENT_TYPES.E2E, AGENT_TYPES.INTEGRATION]) {
        registry.registerAgent(
          {
            name: `web-app-${agentType}`,
            type: agentType,
            version: '1.0.0',
            capabilities: [agentType]
          },
          async () => ({}),
          'web-app-platform'
        );
      }

      // Register platform-scoped agent for data-pipeline
      registry.registerAgent(
        {
          name: 'data-pipeline-deployment',
          type: AGENT_TYPES.DEPLOYMENT,
          version: '1.0.0',
          capabilities: [AGENT_TYPES.DEPLOYMENT]
        },
        async () => ({}),
        'data-pipeline-platform'
      );

      const stats = registry.getStats();

      expect(stats.totalAgents).toBe(5);
      expect(stats.globalAgents).toBe(2);
      expect(stats.platformScopedAgents).toBe(3);
      expect(stats.platforms.size).toBe(2);
      expect(stats.platforms.has('web-app-platform')).toBe(true);
      expect(stats.platforms.has('data-pipeline-platform')).toBe(true);
    });
  });

  describe('Agent Lookup Info', () => {
    it('should provide agent lookup information for global agent', () => {
      registry.registerAgent(
        {
          name: 'global-scaffold',
          type: AGENT_TYPES.SCAFFOLD,
          version: '1.0.0',
          capabilities: [AGENT_TYPES.SCAFFOLD]
        },
        async () => ({})
      );

      const info = registry.getAgentInfo(AGENT_TYPES.SCAFFOLD);

      expect(info).toBeDefined();
      expect(info?.type).toBe(AGENT_TYPES.SCAFFOLD);
      expect(info?.scope).toBe('global');
      expect(info?.platformId).toBeUndefined();
    });

    it('should provide agent lookup information for platform-scoped agent', () => {
      registry.registerAgent(
        {
          name: 'web-app-scaffold',
          type: AGENT_TYPES.SCAFFOLD,
          version: '1.0.0',
          capabilities: [AGENT_TYPES.SCAFFOLD]
        },
        async () => ({}),
        'web-app-platform'
      );

      const info = registry.getAgentInfo(AGENT_TYPES.SCAFFOLD, 'web-app-platform');

      expect(info).toBeDefined();
      expect(info?.type).toBe(AGENT_TYPES.SCAFFOLD);
      expect(info?.scope).toBe('platform-scoped');
      expect(info?.platformId).toBe('web-app-platform');
    });

    it('should return undefined for non-existent agent', () => {
      const info = registry.getAgentInfo('non-existent-type');
      expect(info).toBeUndefined();
    });
  });
});
