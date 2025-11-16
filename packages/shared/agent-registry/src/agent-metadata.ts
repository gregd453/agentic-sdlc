import { z } from 'zod';

/**
 * Agent Metadata - Describes a registered agent type
 * Used for dynamic agent discovery and instantiation
 */

export const AgentCapabilitiesSchema = z.array(z.string());

export const ServiceDefinitionSchema = z.object({
  name: z.string(),
  type: z.string(),
  config: z.record(z.unknown()).optional()
});

export const AgentMetadataSchema = z.object({
  name: z.string().describe('Agent identifier (e.g., "scaffold", "validation")'),
  type: z.string().describe('Agent type for routing'),
  version: z.string().describe('Agent version'),
  description: z.string().optional(),
  capabilities: AgentCapabilitiesSchema.describe('List of capabilities this agent provides'),
  configSchema: z.record(z.unknown()).optional().describe('Configuration schema for this agent'),
  services: z.array(ServiceDefinitionSchema).optional().describe('Service dependencies'),
  timeout_ms: z.number().optional().describe('Default timeout for agent operations'),
  max_retries: z.number().optional().describe('Default maximum retries')
});

export type AgentCapabilities = z.infer<typeof AgentCapabilitiesSchema>;
export type ServiceDefinition = z.infer<typeof ServiceDefinitionSchema>;
export type AgentMetadata = z.infer<typeof AgentMetadataSchema>;

/**
 * Validate agent metadata against schema
 */
export function validateAgentMetadata(metadata: unknown): AgentMetadata {
  return AgentMetadataSchema.parse(metadata);
}

/**
 * Error thrown when agent metadata is invalid
 */
export class AgentMetadataError extends Error {
  constructor(
    message: string,
    public readonly errors: any[] = []
  ) {
    super(message);
    this.name = 'AgentMetadataError';
  }
}
