import { AgentRegistry } from '@agentic-sdlc/agent-registry';
import { AGENT_TYPES, BuiltInAgentTypes } from '@agentic-sdlc/shared-types';
import { logger } from '../utils/logger';

/**
 * AgentRegistryService - HTTP-accessible wrapper for agent discovery
 * Exposes the AgentRegistry for dashboard and client queries
 *
 * Enables:
 * - Dynamic agent discovery (no hardcoded lists)
 * - Agent metadata retrieval (version, capabilities, configSchema)
 * - Validation before workflow creation
 * - Platform-scoped agent filtering
 */
export class AgentRegistryService {
  private registry: AgentRegistry;
  private initialized = false;

  constructor(injectedRegistry?: AgentRegistry) {
    this.registry = injectedRegistry || new AgentRegistry(logger);
  }

  /**
   * Initialize the service with predefined agents
   * In production, agents would register themselves via API or message bus
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Register built-in agents with their metadata
    // These represent the known agents in the platform
    const builtInAgents = [
      {
        type: AGENT_TYPES.SCAFFOLD,
        name: 'Scaffold Agent',
        version: '1.0.0',
        description: 'Intelligent code generation agent for project scaffolding',
        capabilities: ['analyze-requirements', 'generate-structure', 'create-boilerplate', 'generate-schemas', 'create-tests'],
        timeout_ms: 30000,
        max_retries: 3,
        configSchema: {
          scaffold_type: {
            type: 'string',
            enum: ['app', 'service', 'feature', 'capability'],
            default: 'app',
            description: 'Type of structure to scaffold'
          },
          language: {
            type: 'string',
            enum: ['typescript', 'python', 'go'],
            default: 'typescript',
            description: 'Programming language'
          }
        }
      },
      {
        type: AGENT_TYPES.VALIDATION,
        name: 'Validation Agent',
        version: '1.5.0',
        description: 'Code quality and type validation agent',
        capabilities: ['lint', 'type-check', 'security-scan', 'test-validation'],
        timeout_ms: 30000,
        max_retries: 3,
        configSchema: {
          strict_mode: {
            type: 'boolean',
            default: true,
            description: 'Enable strict validation mode'
          },
          check_security: {
            type: 'boolean',
            default: true,
            description: 'Run security checks'
          }
        }
      },
      {
        type: AGENT_TYPES.E2E_TEST,
        name: 'E2E Test Agent',
        version: '1.0.0',
        description: 'End-to-end testing and integration testing agent',
        capabilities: ['run-tests', 'collect-results', 'generate-reports'],
        timeout_ms: 60000,
        max_retries: 2,
        configSchema: {
          test_suite: {
            type: 'string',
            enum: ['unit', 'integration', 'e2e', 'all'],
            default: 'all',
            description: 'Which test suite to run'
          }
        }
      },
      {
        type: AGENT_TYPES.INTEGRATION,
        name: 'Integration Agent',
        version: '1.2.0',
        description: 'Service integration and orchestration agent',
        capabilities: ['integrate-services', 'configure-apis', 'test-integration'],
        timeout_ms: 45000,
        max_retries: 3,
        configSchema: {
          services: {
            type: 'array',
            description: 'List of services to integrate'
          }
        }
      },
      {
        type: AGENT_TYPES.DEPLOYMENT,
        name: 'Deployment Agent',
        version: '1.2.0',
        description: 'Infrastructure deployment and release management',
        capabilities: ['build-image', 'push-registry', 'deploy-ecs', 'health-check'],
        timeout_ms: 120000,
        max_retries: 2,
        configSchema: {
          environment: {
            type: 'string',
            enum: ['staging', 'production'],
            default: 'staging',
            description: 'Target environment'
          },
          auto_rollback: {
            type: 'boolean',
            default: true,
            description: 'Automatically rollback on failure'
          }
        }
      },
      {
        type: AGENT_TYPES.MONITORING,
        name: 'Monitoring Agent',
        version: '1.0.0',
        description: 'System monitoring and observability agent',
        capabilities: ['collect-metrics', 'analyze-logs', 'alert'],
        timeout_ms: 30000,
        max_retries: 3
      },
      {
        type: AGENT_TYPES.DEBUG,
        name: 'Debug Agent',
        version: '1.0.0',
        description: 'Debugging and troubleshooting agent',
        capabilities: ['analyze-logs', 'trace-execution', 'suggest-fixes'],
        timeout_ms: 45000,
        max_retries: 2
      },
      {
        type: BuiltInAgentTypes.RECOVERY,
        name: 'Recovery Agent',
        version: '1.0.0',
        description: 'System recovery and rollback agent',
        capabilities: ['rollback-deployment', 'restore-database', 'health-check'],
        timeout_ms: 60000,
        max_retries: 2
      }
    ];

    // Register each built-in agent
    for (const agentMetadata of builtInAgents) {
      try {
        // Create a factory function for the agent
        // For now, this just returns metadata (agents don't need to be created via HTTP)
        const factory = async () => ({
          metadata: agentMetadata,
          initialized: true
        });

        this.registry.registerAgent(agentMetadata, factory);
        logger.info(`[AgentRegistryService] Registered built-in agent: ${agentMetadata.type} v${agentMetadata.version}`);
      } catch (error) {
        logger.warn(`[AgentRegistryService] Failed to register agent ${agentMetadata.type}:`, error);
      }
    }

    this.initialized = true;
    logger.info('[AgentRegistryService] Initialized with built-in agents');
  }

  /**
   * Register a custom agent (called by agent processes or platform code)
   */
  registerCustomAgent(metadata: any, factory?: any, platformId?: string): void {
    try {
      const wrappedFactory = factory || (async () => ({ metadata, initialized: true }));
      this.registry.registerAgent(metadata, wrappedFactory, platformId);
      logger.info(`[AgentRegistryService] Registered custom agent: ${metadata.type}`, { platformId });
    } catch (error) {
      logger.error(`[AgentRegistryService] Failed to register custom agent:`, { error, metadata });
      throw error;
    }
  }

  /**
   * List all agents, optionally filtered by platform
   */
  listAgents(platformId?: string): any[] {
    const agents = this.registry.listAgents(platformId);
    return agents.map((agent: any) => this.formatAgentMetadata(agent));
  }

  /**
   * Get metadata for a specific agent
   */
  getAgentMetadata(agentType: string, platformId?: string): any {
    const metadata = this.registry.getMetadata(agentType, platformId);
    if (!metadata) {
      throw new Error(`Agent '${agentType}' not found${platformId ? ` for platform '${platformId}'` : ''}`);
    }
    return this.formatAgentMetadata(metadata);
  }

  /**
   * Validate that an agent exists
   */
  validateAgentExists(agentType: string, platformId?: string): boolean {
    try {
      this.registry.validateAgentExists(agentType, platformId);
      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check if agent is registered
   */
  isAgentRegistered(agentType: string, platformId?: string): boolean {
    return this.registry.isRegistered(agentType, platformId);
  }

  /**
   * Format agent metadata for HTTP responses
   */
  private formatAgentMetadata(metadata: any): any {
    return {
      type: metadata.type,
      name: metadata.name || metadata.type,
      version: metadata.version,
      description: metadata.description || '',
      capabilities: metadata.capabilities || [],
      timeout_ms: metadata.timeout_ms || 30000,
      max_retries: metadata.max_retries !== undefined ? metadata.max_retries : 3,
      configSchema: metadata.configSchema || null,
      scope: this.getAgentScope(metadata),
      platformId: metadata.platformId || undefined
    };
  }

  /**
   * Determine agent scope (global vs platform-scoped)
   */
  private getAgentScope(metadata: any): 'global' | 'platform' {
    return metadata.platformId ? 'platform' : 'global';
  }

  /**
   * Get the underlying registry (for advanced usage)
   */
  getRegistry(): AgentRegistry {
    return this.registry;
  }
}

// Singleton instance
let serviceInstance: AgentRegistryService | null = null;

/**
 * Get or create the singleton AgentRegistryService
 */
export function getAgentRegistryService(): AgentRegistryService {
  if (!serviceInstance) {
    serviceInstance = new AgentRegistryService();
  }
  return serviceInstance;
}
