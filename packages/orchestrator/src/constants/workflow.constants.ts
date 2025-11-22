/**
 * Workflow Constants
 * Session #88: Constants for workflow definition and execution
 */

// Default timeouts
export const WORKFLOW_TIMEOUTS = {
  DEFAULT_STAGE_MS: 300000, // 5 minutes
  DEFAULT_WORKFLOW_MS: 1800000 // 30 minutes
} as const;

// Cache configuration
export const WORKFLOW_CACHE = {
  KEY_SEPARATOR: ':',
  LEGACY_PLATFORM_ID: 'legacy',
  BUILD_CACHE_KEY: (platformId: string | undefined, workflowType: string): string => {
    return `${platformId || 'legacy'}:${workflowType}`;
  }
} as const;

// Logging context
export const LOG_CONTEXT_WORKFLOW = '[WorkflowDefinition]' as const;
export const LOG_CONTEXT_ENGINE = '[PlatformAwareWorkflowEngine]' as const;

// Stage mapping for legacy workflows
export const LEGACY_STAGE_AGENT_MAPPING = {
  'scaffold:started': 'scaffold',
  'scaffold:completed': 'scaffold',
  'validate:started': 'validation',
  'validate:completed': 'validation',
  'e2e:started': 'e2e_test',
  'e2e:completed': 'e2e_test',
  'integration:started': 'integration',
  'integration:completed': 'integration',
  'deployment:started': 'deployment',
  'deployment:completed': 'deployment',
  'monitoring:started': 'monitoring',
  'monitoring:completed': 'monitoring',
  'debug:started': 'debug',
  'debug:completed': 'debug',
  'recovery:started': 'recovery',
  'recovery:completed': 'recovery'
} as const;

// Workflow types
export const WORKFLOW_TYPES = {
  APP: 'app',
  FEATURE: 'feature',
  BUGFIX: 'bugfix'
} as const;
