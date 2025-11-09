/**
 * @agentic-sdlc/shared-types
 * Centralized type system for the Agentic SDLC platform
 */

// ===== Error Exports (available via '@agentic-sdlc/shared-types/errors') =====
// Note: Not re-exported from main index to avoid naming conflicts with agent schemas
// Use: import { AgentError, PipelineError } from '@agentic-sdlc/shared-types/errors'

// ===== Core Exports =====
export * from './core/brands';
export * from './core/schemas';

// ===== Registry Export =====
export { SchemaRegistry } from './registry/schema-registry';

// ===== Agent Type Exports =====
export * from './agents/scaffold';
export * from './agents/validation';
export * from './agents/e2e';
export * from './agents/integration';
export * from './agents/deployment';

// ===== Schema Registration =====
import { SchemaRegistry } from './registry/schema-registry';
import {
  WorkflowSchema,
  AgentTaskSchema,
  AgentResultSchema,
  PipelineStageSchema,
  EventSchema,
  VERSION
} from './core/schemas';
import {
  ScaffoldTaskSchema,
  ScaffoldResultSchema,
  RequirementsAnalysisSchema
} from './agents/scaffold';
import {
  ValidationTaskSchema,
  ValidationResultSchema
} from './agents/validation';
import {
  E2ETaskSchema,
  E2EResultSchema,
  PageObjectSchema
} from './agents/e2e';
import {
  IntegrationTaskSchema,
  IntegrationResultSchema
} from './agents/integration';
import {
  DeploymentTaskSchema,
  DeploymentResultSchemaExtended
} from './agents/deployment';

/**
 * Auto-register all schemas on module import
 * This ensures schemas are available whenever the package is used
 */
function registerCoreSchemas(): void {
  // Core schemas
  SchemaRegistry.register(
    'workflow',
    WorkflowSchema,
    VERSION,
    'Core workflow schema for managing SDLC processes'
  );

  SchemaRegistry.register(
    'agent.task',
    AgentTaskSchema,
    VERSION,
    'Base schema for all agent tasks'
  );

  SchemaRegistry.register(
    'agent.result',
    AgentResultSchema,
    VERSION,
    'Base schema for all agent results'
  );

  SchemaRegistry.register(
    'pipeline.stage',
    PipelineStageSchema,
    VERSION,
    'Pipeline stage configuration schema'
  );

  SchemaRegistry.register(
    'event',
    EventSchema,
    VERSION,
    'System event schema for audit and tracking'
  );

  // Scaffold agent schemas
  SchemaRegistry.register(
    'scaffold.task',
    ScaffoldTaskSchema,
    VERSION,
    'Scaffold agent task schema for code generation'
  );

  SchemaRegistry.register(
    'scaffold.result',
    ScaffoldResultSchema,
    VERSION,
    'Scaffold agent result schema with generated artifacts'
  );

  SchemaRegistry.register(
    'scaffold.requirements',
    RequirementsAnalysisSchema,
    VERSION,
    'Requirements analysis schema for scaffold planning'
  );

  // Validation agent schemas
  SchemaRegistry.register(
    'validation.task',
    ValidationTaskSchema,
    VERSION,
    'Validation agent task schema for code quality checks'
  );

  SchemaRegistry.register(
    'validation.result',
    ValidationResultSchema,
    VERSION,
    'Validation agent result schema with quality metrics'
  );

  // E2E agent schemas
  SchemaRegistry.register(
    'e2e.task',
    E2ETaskSchema,
    VERSION,
    'E2E agent task schema for test generation and execution'
  );

  SchemaRegistry.register(
    'e2e.result',
    E2EResultSchema,
    VERSION,
    'E2E agent result schema with test execution results'
  );

  SchemaRegistry.register(
    'e2e.page_object',
    PageObjectSchema,
    VERSION,
    'Page Object Model schema for UI test organization'
  );

  // Integration agent schemas
  SchemaRegistry.register(
    'integration.task',
    IntegrationTaskSchema,
    VERSION,
    'Integration agent task schema for merging, conflicts, and integration tests'
  );

  SchemaRegistry.register(
    'integration.result',
    IntegrationResultSchema,
    VERSION,
    'Integration agent result schema with merge and test results'
  );

  // Deployment agent schemas
  SchemaRegistry.register(
    'deployment.task',
    DeploymentTaskSchema,
    VERSION,
    'Deployment agent task schema for Docker, ECR, ECS, and rollbacks'
  );

  SchemaRegistry.register(
    'deployment.result',
    DeploymentResultSchemaExtended,
    VERSION,
    'Deployment agent result schema with deployment status'
  );
}

// Register schemas on import
registerCoreSchemas();

// ===== Convenience Re-exports =====
export const SCHEMA_VERSION = VERSION;

// Type validation helpers
export { z } from 'zod';

// ===== Schema List Export =====
export const REGISTERED_SCHEMAS = {
  // Core
  WORKFLOW: 'workflow',
  AGENT_TASK: 'agent.task',
  AGENT_RESULT: 'agent.result',
  PIPELINE_STAGE: 'pipeline.stage',
  EVENT: 'event',

  // Scaffold
  SCAFFOLD_TASK: 'scaffold.task',
  SCAFFOLD_RESULT: 'scaffold.result',
  SCAFFOLD_REQUIREMENTS: 'scaffold.requirements',

  // Validation
  VALIDATION_TASK: 'validation.task',
  VALIDATION_RESULT: 'validation.result',

  // E2E
  E2E_TASK: 'e2e.task',
  E2E_RESULT: 'e2e.result',
  E2E_PAGE_OBJECT: 'e2e.page_object',

  // Integration
  INTEGRATION_TASK: 'integration.task',
  INTEGRATION_RESULT: 'integration.result',

  // Deployment
  DEPLOYMENT_TASK: 'deployment.task',
  DEPLOYMENT_RESULT: 'deployment.result',
} as const;

// ===== Utility Type Exports =====
export type SchemaName = typeof REGISTERED_SCHEMAS[keyof typeof REGISTERED_SCHEMAS];

// ===== Migration Support =====
// Future: Register migrations between versions here
// SchemaRegistry.registerMigration('workflow', '1.0.0', '1.1.0', (data) => {...});

// ===== Schema Validation Utilities =====
export const validateWorkflow = (data: unknown) =>
  SchemaRegistry.validate<ReturnType<typeof WorkflowSchema.parse>>('workflow', data);

export const validateScaffoldTask = (data: unknown) =>
  SchemaRegistry.validate<ReturnType<typeof ScaffoldTaskSchema.parse>>('scaffold.task', data);

export const validateScaffoldResult = (data: unknown) =>
  SchemaRegistry.validate<ReturnType<typeof ScaffoldResultSchema.parse>>('scaffold.result', data);

export const validateValidationTask = (data: unknown) =>
  SchemaRegistry.validate<ReturnType<typeof ValidationTaskSchema.parse>>('validation.task', data);

export const validateValidationResult = (data: unknown) =>
  SchemaRegistry.validate<ReturnType<typeof ValidationResultSchema.parse>>('validation.result', data);

export const validateE2ETask = (data: unknown) =>
  SchemaRegistry.validate<ReturnType<typeof E2ETaskSchema.parse>>('e2e.task', data);

export const validateE2EResult = (data: unknown) =>
  SchemaRegistry.validate<ReturnType<typeof E2EResultSchema.parse>>('e2e.result', data);

export const validateIntegrationTask = (data: unknown) =>
  SchemaRegistry.validate<ReturnType<typeof IntegrationTaskSchema.parse>>('integration.task', data);

export const validateIntegrationResult = (data: unknown) =>
  SchemaRegistry.validate<ReturnType<typeof IntegrationResultSchema.parse>>('integration.result', data);

export const validateDeploymentTask = (data: unknown) =>
  SchemaRegistry.validate<ReturnType<typeof DeploymentTaskSchema.parse>>('deployment.task', data);

export const validateDeploymentResult = (data: unknown) =>
  SchemaRegistry.validate<ReturnType<typeof DeploymentResultSchemaExtended.parse>>('deployment.result', data);

// ===== Development Helpers =====
if (process.env.NODE_ENV === 'development') {
  console.log('📦 @agentic-sdlc/shared-types loaded');
  console.log(`📝 Registered schemas: ${SchemaRegistry.list().join(', ')}`);
  console.log(`🔖 Version: ${VERSION}`);
}