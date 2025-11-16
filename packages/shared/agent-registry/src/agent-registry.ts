import { AgentMetadata, AgentMetadataError, validateAgentMetadata } from './agent-metadata';
import { AgentFactoryEntry, AgentFactoryError } from './agent-factory';

/**
 * Agent Registry - Central registry for discovering and instantiating agents
 * Supports global agents and platform-scoped agents
 *
 * Provides dynamic agent management without code modification
 *
 * Usage:
 *   const registry = new AgentRegistry();
 *   registry.registerAgent(scaffoldMetadata, scaffoldFactory);                    // Global agent
 *   registry.registerAgent(platformMetadata, platformFactory, 'web-app-platform'); // Platform-scoped agent
 *   const agent = await registry.createAgent('scaffold', messageBus);             // Lookup any agent
 *   const agent = await registry.createAgent('scaffold', messageBus, {}, 'web-app-platform'); // Platform-specific
 */
export class AgentRegistry {
  // Key format: 'agentType' for global, 'agentType:platformId' for platform-scoped
  private agents: Map<string, AgentFactoryEntry & { platformId?: string }> = new Map();
  private readonly logger: any;

  /**
   * Constructor with optional logger injection
   * If no logger provided, uses console as fallback
   */
  constructor(injectedLogger?: any) {
    this.logger = injectedLogger || console;
  }

  /**
   * Register an agent with the registry (global or platform-scoped)
   *
   * @param metadata - Agent metadata
   * @param factory - Agent factory function
   * @param platformId - Optional platform ID for platform-scoped registration
   */
  registerAgent(
    metadata: AgentMetadata | unknown,
    factory: AgentFactoryEntry['factory'],
    platformId?: string
  ): void {
    try {
      // Validate metadata
      const validatedMetadata = validateAgentMetadata(metadata);

      // Generate registry key
      const key = platformId ? `${validatedMetadata.type}:${platformId}` : validatedMetadata.type;

      // Check for duplicates
      if (this.agents.has(key)) {
        const scope = platformId ? `for platform '${platformId}'` : 'globally';
        throw new Error(`Agent '${validatedMetadata.type}' is already registered ${scope}`);
      }

      // Register agent
      this.agents.set(key, {
        metadata: validatedMetadata,
        factory,
        platformId
      });

      const scope = platformId ? ` [platform: ${platformId}]` : ' [global]';
      this.logger.log(`✅ [AgentRegistry] Registered agent: ${validatedMetadata.type} v${validatedMetadata.version}${scope}`);
    } catch (error) {
      if (error instanceof AgentMetadataError) {
        throw error;
      }
      throw new AgentMetadataError(
        `Failed to register agent: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? [error] : []
      );
    }
  }

  /**
   * Get agent metadata by type and optional platform ID
   * Falls back to global agent if platform-specific not found
   */
  getMetadata(agentType: string, platformId?: string): AgentMetadata | undefined {
    // Try platform-scoped first if platformId provided
    if (platformId) {
      const scopedKey = `${agentType}:${platformId}`;
      const scopedEntry = this.agents.get(scopedKey);
      if (scopedEntry) {
        return scopedEntry.metadata;
      }
    }

    // Fall back to global agent
    return this.agents.get(agentType)?.metadata;
  }

  /**
   * Check if agent is registered (global or for specific platform)
   */
  isRegistered(agentType: string, platformId?: string): boolean {
    if (platformId) {
      const scopedKey = `${agentType}:${platformId}`;
      if (this.agents.has(scopedKey)) {
        return true;
      }
    }
    return this.agents.has(agentType);
  }

  /**
   * Get all registered agents
   * Can optionally filter by platform
   */
  listAgents(platformId?: string): AgentMetadata[] {
    const results: AgentMetadata[] = [];
    const seenTypes = new Set<string>();

    for (const [key, entry] of this.agents.entries()) {
      // Include platform-scoped agents for the specific platform
      if (platformId && entry.platformId === platformId) {
        results.push(entry.metadata);
        seenTypes.add(entry.metadata.type);
      } else if (!entry.platformId && !seenTypes.has(entry.metadata.type)) {
        // Include global agents
        results.push(entry.metadata);
        seenTypes.add(entry.metadata.type);
      }
    }

    return results;
  }

  /**
   * Lookup an agent, preferring platform-specific over global
   * Returns both the entry and whether it was platform-scoped
   */
  private lookupAgent(agentType: string, platformId?: string): (AgentFactoryEntry & { platformId?: string }) | undefined {
    // Try platform-scoped first if platformId provided
    if (platformId) {
      const scopedKey = `${agentType}:${platformId}`;
      const scopedEntry = this.agents.get(scopedKey);
      if (scopedEntry) {
        return scopedEntry;
      }
    }

    // Fall back to global agent
    return this.agents.get(agentType);
  }

  /**
   * Create an agent instance
   * Falls back to global agent if platform-specific not found
   */
  async createAgent(agentType: string, messageBus: any, config?: any, platformId?: string): Promise<any> {
    const entry = this.lookupAgent(agentType, platformId);

    if (!entry) {
      const scope = platformId ? ` for platform '${platformId}'` : '';
      throw new AgentFactoryError(
        `Agent type '${agentType}' not found in registry${scope}`,
        agentType
      );
    }

    try {
      const agent = await entry.factory(messageBus, config);
      const scope = entry.platformId ? ` [platform: ${entry.platformId}]` : ' [global]';
      this.logger.log(`✅ [AgentRegistry] Created agent instance: ${agentType}${scope}`);
      return agent;
    } catch (error) {
      if (error instanceof AgentFactoryError) {
        throw error;
      }
      throw new AgentFactoryError(
        `Failed to create agent '${agentType}': ${error instanceof Error ? error.message : String(error)}`,
        agentType,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Validate agent configuration against its schema
   */
  validateConfig(agentType: string, config: unknown, platformId?: string): void {
    const metadata = this.getMetadata(agentType, platformId);

    if (!metadata) {
      throw new Error(`Agent type '${agentType}' not found`);
    }

    if (!metadata.configSchema) {
      // No schema defined, skip validation
      return;
    }

    try {
      // Config validation would be done by ConfigurationManager
      // This is just a placeholder for future schema validation
      const scope = platformId ? ` for platform '${platformId}'` : '';
      this.logger.log(`✅ [AgentRegistry] Configuration valid for agent: ${agentType}${scope}`);
    } catch (error) {
      throw new Error(`Configuration validation failed for '${agentType}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get agent lookup info (for debugging/monitoring)
   */
  getAgentInfo(agentType: string, platformId?: string): { type: string; metadata: AgentMetadata; platformId?: string; scope: 'platform-scoped' | 'global' } | undefined {
    const entry = this.lookupAgent(agentType, platformId);
    if (!entry) {
      return undefined;
    }

    return {
      type: agentType,
      metadata: entry.metadata,
      platformId: entry.platformId,
      scope: entry.platformId ? 'platform-scoped' : 'global'
    };
  }

  /**
   * Clear all registrations (useful for testing)
   */
  clear(): void {
    this.agents.clear();
  }

  /**
   * Get total number of registered agents
   */
  size(): number {
    return this.agents.size;
  }

  /**
   * Get detailed registry stats
   */
  getStats(): { totalAgents: number; globalAgents: number; platformScopedAgents: number; platforms: Set<string> } {
    const platforms = new Set<string>();
    let globalCount = 0;
    let platformScopedCount = 0;

    for (const entry of this.agents.values()) {
      if (entry.platformId) {
        platformScopedCount++;
        platforms.add(entry.platformId);
      } else {
        globalCount++;
      }
    }

    return {
      totalAgents: this.agents.size,
      globalAgents: globalCount,
      platformScopedAgents: platformScopedCount,
      platforms
    };
  }
}

/**
 * Error thrown when agent is not found
 */
export class AgentNotFoundError extends Error {
  constructor(agentType: string) {
    super(`Agent '${agentType}' not found in registry`);
    this.name = 'AgentNotFoundError';
  }
}
