/**
 * @agentic-sdlc/service-locator
 * Service locator pattern implementation with plugin service management
 */

export {
  ServiceLocator,
  ServiceLocatorError,
  createServiceLocator,
  getServiceLocator,
  resetServiceLocator
} from './service-locator';

export type {
  ServiceDefinition,
  ServiceLocatorConfig,
  ServiceImplementation
} from './service-schema';

export {
  validateServiceDefinition,
  validateServiceLocatorConfig,
  DEFAULT_SERVICE_LOCATOR_CONFIG,
  ServiceSchemaError,
  ServiceDefinitionSchema,
  ServiceLocatorConfigSchema
} from './service-schema';
