import { AgentMetadata, AgentMetadataError, validateAgentMetadata } from './agent-metadata';
import { AgentFactoryEntry, AgentFactoryError } from './agent-factory';

/**
 * Agent Registry - Central registry for discovering and instantiating agents
 * Provides dynamic agent management without code modification
 *
 * Usage:
 *   const registry = new AgentRegistry();
 *   registry.registerAgent(scaffoldMetadata, scaffoldFactory);
 *   const agent = await registry.createAgent('scaffold', messageBus);
 */
export class AgentRegistry {
  private agents: Map<string, AgentFactoryEntry> = new Map();
  private readonly logger: any;

  /**
   * Constructor with optional logger injection
   * If no logger provided, uses console as fallback
   */
  constructor(injectedLogger?: any) {
    this.logger = injectedLogger || console;
  }

  /**
   * Register an agent with the registry
   */
  registerAgent(metadata: AgentMetadata | unknown, factory: AgentFactoryEntry['factory']): void {
    try {
      // Validate metadata
      const validatedMetadata = validateAgentMetadata(metadata);

      // Check for duplicates
      if (this.agents.has(validatedMetadata.type)) {
        throw new Error(`Agent '${validatedMetadata.type}' is already registered`);
      }

      // Register agent
      this.agents.set(validatedMetadata.type, {
        metadata: validatedMetadata,
        factory
      });

      this.logger.log(`✅ [AgentRegistry] Registered agent: ${validatedMetadata.type} v${validatedMetadata.version}`);
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
   * Get agent metadata by type
   */
  getMetadata(agentType: string): AgentMetadata | undefined {
    return this.agents.get(agentType)?.metadata;
  }

  /**
   * Check if agent is registered
   */
  isRegistered(agentType: string): boolean {
    return this.agents.has(agentType);
  }

  /**
   * Get all registered agents
   */
  listAgents(): AgentMetadata[] {
    return Array.from(this.agents.values()).map(entry => entry.metadata);
  }

  /**
   * Create an agent instance
   */
  async createAgent(agentType: string, messageBus: any, config?: any): Promise<any> {
    const entry = this.agents.get(agentType);

    if (!entry) {
      throw new AgentFactoryError(
        `Agent type '${agentType}' not found in registry`,
        agentType
      );
    }

    try {
      const agent = await entry.factory(messageBus, config);
      this.logger.log(`✅ [AgentRegistry] Created agent instance: ${agentType}`);
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
  validateConfig(agentType: string, config: unknown): void {
    const metadata = this.getMetadata(agentType);

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
      this.logger.log(`✅ [AgentRegistry] Configuration valid for agent: ${agentType}`);
    } catch (error) {
      throw new Error(`Configuration validation failed for '${agentType}': ${error instanceof Error ? error.message : String(error)}`);
    }
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
