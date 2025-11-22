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
import { VERSION } from './core/schemas';

// ===== SESSION #65: AgentEnvelope - THE Canonical Task Format =====
// AgentEnvelope v2.0.0 is the ONLY valid schema for task assignments
// All agents MUST import and use AgentEnvelope
export {
  AgentEnvelopeSchema,
  AgentEnvelope,
  PriorityEnum,
  Priority,
  TaskStatusEnum as AgentTaskStatusEnum,  // Rename to avoid conflict with core/schemas
  TaskStatus as AgentTaskStatus,          // Rename to avoid conflict with core/schemas
  AgentTypeSchema as AgentEnvelopeTypeSchema, // Updated: Now a string schema that accepts arbitrary agent types
  AgentType as AgentEnvelopeType,         // Still exports AgentType string
  ExecutionConstraintsSchema,
  ExecutionConstraints,
  EnvelopeMetadataSchema as AgentEnvelopeMetadataSchema,  // Rename to avoid conflict with envelope/
  EnvelopeMetadata as AgentEnvelopeMetadata,              // Rename to avoid conflict with envelope/
  TraceContextSchema,
  TraceContext,
  WorkflowContextSchema,
  WorkflowContext,
  isAgentEnvelope,
  validateAgentEnvelope
} from './messages/agent-envelope';

// Keep TaskResult schema (unchanged, working correctly)
export { TaskResultSchema, TaskResult } from './messages/task-contracts';

// ===== Agent Behavior Metadata (Metadata-driven test scenarios) =====
export {
  AgentBehaviorModeEnum,
  AgentBehaviorMetadataSchema,
  AgentErrorMetadataSchema,
  PartialResultMetadataSchema,
  CustomOutputMetadataSchema,
  TimingMetadataSchema,
  MetricsMetadataSchema,
  BEHAVIOR_SAMPLES,
  validateAgentBehaviorMetadata
} from './messages/agent-behavior';
export type {
  AgentBehaviorMode,
  AgentBehaviorMetadata,
  AgentErrorMetadata,
  PartialResultMetadata,
  CustomOutputMetadata,
  TimingMetadata,
  MetricsMetadata
} from './messages/agent-behavior';

// ===== Phase 5: Schema Registry & Contract Validator =====
// Note: Explicitly export to avoid naming conflicts
export { SchemaRegistry } from './core/schema-registry';
export type { ValidationResult, ValidationError } from './core/schema-registry';
export { ContractValidator } from './core/contract-validator';

// ===== Agent Type Exports =====
export * from './agents/scaffold';
export * from './agents/validation';
export * from './agents/e2e';
export * from './agents/integration';
export * from './agents/deployment';

// ===== Monitoring System Exports (Session #88) =====
export * from './monitoring';

// ===== Surface Context Exports (Session #88 Phase 3) =====
export * from './surface/surface-context';

// ===== Envelope Exports (Session #36 - OLD, keep for backward compat) =====
export * from './envelope/agent-envelope';

// ===== Constants Exports (Session #37 + Session #85: Agent Types) =====
export * from './constants/pipeline.constants';
export * from './constants/agent-types.constants';

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