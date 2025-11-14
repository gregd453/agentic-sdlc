// Base Agent Framework
export { BaseAgent } from './base-agent';
export { ExampleAgent } from './example-agent';

// Types and schemas
export {
  // Core types
  type AgentMessage,
  type AgentEnvelope,
  type TaskResult,
  type AgentCapabilities,
  type HealthStatus,
  type Result,
  type AgentLifecycle,

  // Schemas for validation
  AgentMessageSchema,
  AgentEnvelopeSchema,
  validateAgentEnvelope,
  TaskResultSchema,

  // Error types
  AgentError,
  ValidationError,
  TaskExecutionError
} from './types';