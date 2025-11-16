import { z } from 'zod';

/**
 * Service Definition Schemas
 * Zod-validated schemas for service registration, configuration, and instantiation
 */

/**
 * Service implementation (factory pattern)
 */
export type ServiceImplementation<T = any> = (config?: any) => Promise<T> | T;

/**
 * Service definition with metadata
 */
export const ServiceDefinitionSchema = z.object({
  name: z.string().min(1).describe('Unique service name'),
  type: z.string().min(1).describe('Service type identifier'),
  version: z.string().default('1.0.0').describe('Service version'),
  description: z.string().optional().describe('Service description'),
  config_schema: z.any().optional().describe('Zod schema for service configuration'),
  tags: z.array(z.string()).default([]).describe('Service tags for filtering'),
  metadata: z.record(z.unknown()).optional().describe('Custom service metadata')
});
export type ServiceDefinition = z.infer<typeof ServiceDefinitionSchema>;

/**
 * Service instance registration
 */
export const ServiceRegistryEntrySchema = z.object({
  definition: ServiceDefinitionSchema.describe('Service definition'),
  factory: z.any().describe('Service factory/constructor function'),
  singleton: z.boolean().default(false).describe('Cache single instance'),
  instance: z.any().optional().describe('Cached singleton instance')
});
export type ServiceRegistryEntry = z.infer<typeof ServiceRegistryEntrySchema>;

/**
 * Service locator configuration
 */
export const ServiceLocatorConfigSchema = z.object({
  auto_register: z.boolean().default(false).describe('Auto-register services from discovery'),
  default_timeout_ms: z.number().positive().default(10000).describe('Default service instantiation timeout'),
  enable_caching: z.boolean().default(true).describe('Enable singleton caching'),
  lazy_load: z.boolean().default(false).describe('Lazy load services on first use'),
  metadata: z.record(z.unknown()).optional().describe('Configuration metadata')
});
export type ServiceLocatorConfig = z.infer<typeof ServiceLocatorConfigSchema>;

/**
 * Service query result
 */
export const ServiceQueryResultSchema = z.object({
  found: z.boolean().describe('Whether service was found'),
  name: z.string().optional().describe('Service name if found'),
  type: z.string().optional().describe('Service type if found'),
  definition: ServiceDefinitionSchema.optional().describe('Service definition if found')
});
export type ServiceQueryResult = z.infer<typeof ServiceQueryResultSchema>;

/**
 * Multiple service implementation options
 */
export const ServiceImplementationsSchema = z.object({
  primary: z.string().describe('Primary implementation type'),
  fallbacks: z.array(z.string()).default([]).describe('Fallback implementation types'),
  selector: z.enum(['primary', 'random', 'round-robin']).default('primary').describe('Selection strategy')
});
export type ServiceImplementations = z.infer<typeof ServiceImplementationsSchema>;

/**
 * Validate service definition
 */
export function validateServiceDefinition(definition: unknown): ServiceDefinition {
  return ServiceDefinitionSchema.parse(definition);
}

/**
 * Validate service locator config
 */
export function validateServiceLocatorConfig(config: unknown): ServiceLocatorConfig {
  return ServiceLocatorConfigSchema.parse(config);
}

/**
 * Default service locator configuration
 */
export const DEFAULT_SERVICE_LOCATOR_CONFIG: ServiceLocatorConfig = {
  auto_register: false,
  default_timeout_ms: 10000,
  enable_caching: true,
  lazy_load: false
};

/**
 * Service schema error
 */
export class ServiceSchemaError extends Error {
  constructor(message: string, public readonly serviceName?: string) {
    super(message);
    this.name = 'ServiceSchemaError';
  }
}
