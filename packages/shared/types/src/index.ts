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

// ===== Phase 5: Schema Registry & Contract Validator =====
export * from './core/schema-registry';
export * from './core/contract-validator';

// ===== Agent Type Exports =====
export * from './agents/scaffold';
export * from './agents/validation';
export * from './agents/e2e';
export * from './agents/integration';
export * from './agents/deployment';

// ===== Envelope Exports (Session #36) =====
export * from './envelope/agent-envelope';

// ===== Constants Exports (Session #37) =====
export * from './constants/pipeline.constants';

// Phase 5: SchemaRegistry and ContractValidator are auto-initialized on import
// No additional registration needed - schemas are registered in schema-registry.ts

// ===== Convenience Re-exports =====
export const SCHEMA_VERSION = VERSION;

// Type validation helpers
export { z } from 'zod';

// ===== Schema Name Constants (Phase 5) =====
export const SCHEMA_NAMES = {
  // Core
  WORKFLOW: 'Workflow',
  AGENT_TASK: 'AgentTask',
  AGENT_RESULT: 'AgentResult',
  PIPELINE_STAGE: 'PipelineStage',
  EVENT: 'Event',
} as const;

// ===== Development Helpers =====
if (process.env.NODE_ENV === 'development') {
  console.log('📦 @agentic-sdlc/shared-types loaded (Phase 5)');
  console.log(`🔖 Version: ${VERSION}`);
}