import { z } from 'zod';

/**
 * Configuration Schemas - Defines valid configuration structures
 * Used for runtime validation of agent and system configurations
 */

export type LogLevel = 'trace' | LOG_LEVEL.DEBUG | LOG_LEVEL.INFO | LOG_LEVEL.WARN | LOG_LEVEL.ERROR | 'fatal';

/**
 * Base configuration schema for agents
 */
export const AgentConfigSchema = z.object({
  enabled: z.boolean().default(true).describe('Whether agent is enabled'),
  timeout_ms: z.number().positive().describe('Task timeout in milliseconds'),
  max_retries: z.number().nonnegative().describe('Maximum retry attempts'),
  metadata: z.record(z.unknown()).optional().describe('Custom metadata')
});

/**
 * Logging configuration schema
 */
export const LoggingConfigSchema = z.object({
  global_level: z.enum(['trace', LOG_LEVEL.DEBUG, LOG_LEVEL.INFO, LOG_LEVEL.WARN, LOG_LEVEL.ERROR, 'fatal']).default(LOG_LEVEL.INFO),
  modules: z.record(z.enum(['trace', LOG_LEVEL.DEBUG, LOG_LEVEL.INFO, LOG_LEVEL.WARN, LOG_LEVEL.ERROR, 'fatal'])).optional().describe('Per-module log levels'),
  trace_enabled: z.boolean().default(true),
  pretty_print: z.boolean().default(true).describe('Pretty-print vs JSON output')
});

/**
 * Service configuration schema
 */
export const ServiceConfigSchema = z.object({
  enabled: z.boolean().default(true),
  type: z.string().describe('Service type identifier'),
  config: z.record(z.unknown()).optional().describe('Service-specific configuration')
});

/**
 * Complete application configuration
 */
export const AppConfigSchema = z.object({
  agents: z.record(AgentConfigSchema).describe('Agent configurations by type'),
  logging: LoggingConfigSchema.optional(),
  services: z.record(ServiceConfigSchema).optional().describe('Service configurations'),
  metadata: z.record(z.unknown()).optional().describe('Application metadata')
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
export type ServiceConfig = z.infer<typeof ServiceConfigSchema>;
export type AppConfig = z.infer<typeof AppConfigSchema>;

/**
 * Default configurations
 */
export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  enabled: true,
  timeout_ms: 30000,
  max_retries: 3
};

export const DEFAULT_LOGGING_CONFIG: LoggingConfig = {
  global_level: LOG_LEVEL.INFO,
  trace_enabled: true,
  pretty_print: true,
  modules: {}
};

export const DEFAULT_APP_CONFIG: AppConfig = {
  agents: {},
  logging: DEFAULT_LOGGING_CONFIG,
  services: {},
  metadata: {}
};
