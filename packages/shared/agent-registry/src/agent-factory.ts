import type { AgentMetadata } from './agent-metadata';

/**
 * Agent Factory - Creates agent instances
 * Decouples agent construction from registry
 */

export type AgentFactory = (messageBus: any, config?: any) => Promise<any>;

export interface AgentFactoryEntry {
  metadata: AgentMetadata;
  factory: AgentFactory;
}

/**
 * Error thrown when factory creation fails
 */
export class AgentFactoryError extends Error {
  constructor(
    message: string,
    public readonly agentType: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'AgentFactoryError';
  }
}

/**
 * Default factory creator - wraps agent class constructors
 * Usage: createAgentFactory(ScaffoldAgent, scaffoldMetadata)
 */
export function createAgentFactory(
  AgentClass: new (messageBus: any, config?: any) => any,
  metadata: AgentMetadata
): AgentFactoryEntry {
  return {
    metadata,
    factory: async (messageBus: any, config?: any) => {
      try {
        const instance = new AgentClass(messageBus, config);

        // Ensure agent has initialize method
        if (typeof instance.initialize !== 'function') {
          throw new Error('Agent must implement initialize() method');
        }

        return instance;
      } catch (error) {
        throw new AgentFactoryError(
          `Failed to create agent instance: ${error instanceof Error ? error.message : String(error)}`,
          metadata.type,
          error instanceof Error ? error : undefined
        );
      }
    }
  };
}
