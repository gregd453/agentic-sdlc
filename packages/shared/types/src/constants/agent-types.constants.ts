/**
 * Agent Type Constants & Naming Conventions
 * Reference for built-in agent types and guidelines for custom agents
 *
 * Session: Unbounded Agent Extensibility (Task 1.3)
 * Allows any custom agent that extends BaseAgent with arbitrary agent_type values
 */

/**
 * Built-in Agent Types (for reference)
 * These are predefined agents that ship with the Agentic SDLC platform
 *
 * Custom agents can use ANY string identifier following the naming conventions below
 */
export const BuiltInAgentTypes = {
  // Core infrastructure agents
  SCAFFOLD: 'scaffold',
  VALIDATION: 'validation',
  E2E_TEST: 'e2e_test',
  INTEGRATION: 'integration',
  DEPLOYMENT: 'deployment'
} as const;

/**
 * Custom Agent Naming Convention
 *
 * Pattern: kebab-case (lowercase alphanumeric + hyphens)
 * Examples:
 *   - ml-training
 *   - data-validation
 *   - compliance-checker
 *   - performance-analyzer
 *   - security-scanner
 *   - custom-report-generator
 *
 * Rules:
 *   - Must be lowercase
 *   - Use hyphens to separate words (not underscores)
 *   - Alphanumeric characters only plus hyphens
 *   - Start and end with alphanumeric (not hyphen)
 *   - Recommended: domain-specific naming (e.g., ml-, data-, sec-)
 *   - Avoid names conflicting with built-in types
 */
export const CUSTOM_AGENT_NAMING_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Validation helper for agent type names
 * Checks if a custom agent type follows naming conventions
 *
 * @param agentType - Agent type identifier to validate
 * @param allowBuiltIn - Whether to allow built-in type names (default: true)
 * @returns true if valid, false otherwise
 */
export function isValidAgentTypeName(
  agentType: string,
  allowBuiltIn: boolean = true
): boolean {
  // Check basic pattern
  if (!CUSTOM_AGENT_NAMING_PATTERN.test(agentType)) {
    return false;
  }

  // Reject built-in names if not allowed
  if (!allowBuiltIn) {
    const builtInValues = Object.values(BuiltInAgentTypes) as string[];
    if (builtInValues.includes(agentType)) {
      return false;
    }
  }

  return true;
}

/**
 * Get description of valid naming format for error messages
 */
export function getAgentTypeNamingDescription(): string {
  return `Agent type must be kebab-case (lowercase alphanumeric + hyphens), e.g., 'ml-training', 'data-validation'`;
}

/**
 * List all built-in agent types
 */
export function listBuiltInAgentTypes(): string[] {
  return Object.values(BuiltInAgentTypes);
}

/**
 * Check if a type is a built-in agent
 */
export function isBuiltInAgentType(agentType: string): boolean {
  const builtInValues = Object.values(BuiltInAgentTypes) as string[];
  return builtInValues.includes(agentType);
}

/**
 * Agent type metadata for documentation and discovery
 */
export const AgentTypeMetadata: Record<string, { description: string; builtIn: boolean; version: string }> = {
  scaffold: {
    description: 'Creates project structure and scaffolding',
    builtIn: true,
    version: '1.0.0'
  },
  validation: {
    description: 'Validates code quality, style, and correctness',
    builtIn: true,
    version: '1.0.0'
  },
  e2e_test: {
    description: 'Executes end-to-end tests',
    builtIn: true,
    version: '1.0.0'
  },
  integration: {
    description: 'Handles integration with external systems',
    builtIn: true,
    version: '1.0.0'
  },
  deployment: {
    description: 'Manages deployment and release',
    builtIn: true,
    version: '1.0.0'
  },
  monitoring: {
    description: 'Monitors system health and performance',
    builtIn: true,
    version: '1.0.0'
  },
  debug: {
    description: 'Debugging and troubleshooting agent',
    builtIn: true,
    version: '1.0.0'
  },
  recovery: {
    description: 'Error recovery and rollback',
    builtIn: true,
    version: '1.0.0'
  }
};
