import {
  ServiceDefinition,
  ServiceLocatorConfig,
  ServiceImplementation,
  DEFAULT_SERVICE_LOCATOR_CONFIG,
  validateServiceDefinition,
  validateServiceLocatorConfig,
  ServiceSchemaError
} from './service-schema';

/**
 * Service Registry Entry (internal)
 */
interface RegistryEntry {
  definition: ServiceDefinition;
  factory: ServiceImplementation;
  singleton: boolean;
  instance?: any;
}

/**
 * Service Locator
 * Manages service registration, discovery, and instantiation
 * Implements service locator pattern with support for multiple implementations
 */
export class ServiceLocator {
  private registry: Map<string, RegistryEntry> = new Map();
  private typeIndex: Map<string, Set<string>> = new Map(); // type -> [service names]
  private tagIndex: Map<string, Set<string>> = new Map(); // tag -> [service names]
  private config: ServiceLocatorConfig;
  private readonly logger: any;

  /**
   * Constructor with optional logger injection
   * If no logger provided, uses console as fallback
   */
  constructor(config?: Partial<ServiceLocatorConfig>, injectedLogger?: any) {
    this.config = {
      ...DEFAULT_SERVICE_LOCATOR_CONFIG,
      ...(config || {})
    };
    this.logger = injectedLogger || console;
    this.validate();
  }

  /**
   * Validate configuration
   */
  private validate(): void {
    try {
      validateServiceLocatorConfig(this.config);
    } catch (error) {
      throw new ServiceLocatorError(
        `Invalid service locator configuration: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Register a service
   */
  registerService(
    definition: ServiceDefinition,
    factory: ServiceImplementation,
    singleton: boolean = false
  ): void {
    try {
      validateServiceDefinition(definition);

      const existing = this.registry.get(definition.name);
      if (existing) {
        this.logger.warn(`⚠️  [ServiceLocator] Overwriting existing service: ${definition.name}`);
      }

      this.registry.set(definition.name, {
        definition,
        factory,
        singleton,
        instance: undefined
      });

      // Update indices
      this.updateTypeIndex(definition.name, definition.type);
      this.updateTagIndex(definition.name, definition.tags || []);

      this.logger.log(`✅ [ServiceLocator] Registered service: ${definition.name} (type: ${definition.type})`);
    } catch (error) {
      throw new ServiceLocatorError(
        `Failed to register service: ${error instanceof Error ? error.message : String(error)}`,
        definition.name
      );
    }
  }

  /**
   * Update type index
   */
  private updateTypeIndex(serviceName: string, serviceType: string): void {
    if (!this.typeIndex.has(serviceType)) {
      this.typeIndex.set(serviceType, new Set());
    }
    this.typeIndex.get(serviceType)!.add(serviceName);
  }

  /**
   * Update tag index
   */
  private updateTagIndex(serviceName: string, tags: string[]): void {
    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(serviceName);
    }
  }

  /**
   * Create an instance of a registered service
   */
  async getService<T = any>(serviceName: string, config?: any): Promise<T> {
    const entry = this.registry.get(serviceName);
    if (!entry) {
      throw new ServiceLocatorError(
        `Service not found: ${serviceName}`,
        serviceName
      );
    }

    // Return cached singleton if available
    if (entry.singleton && entry.instance) {
      return entry.instance as T;
    }

    try {
      // Instantiate service
      const instance = await Promise.resolve(entry.factory(config));

      // Cache if singleton
      if (entry.singleton) {
        entry.instance = instance;
      }

      return instance as T;
    } catch (error) {
      throw new ServiceLocatorError(
        `Failed to instantiate service ${serviceName}: ${error instanceof Error ? error.message : String(error)}`,
        serviceName
      );
    }
  }

  /**
   * Check if service exists
   */
  hasService(serviceName: string): boolean {
    return this.registry.has(serviceName);
  }

  /**
   * Get service definition without instantiating
   */
  getDefinition(serviceName: string): ServiceDefinition {
    const entry = this.registry.get(serviceName);
    if (!entry) {
      throw new ServiceLocatorError(
        `Service not found: ${serviceName}`,
        serviceName
      );
    }
    return entry.definition;
  }

  /**
   * Find all services of a specific type
   */
  findByType(serviceType: string): ServiceDefinition[] {
    const serviceNames = this.typeIndex.get(serviceType) || new Set();
    return Array.from(serviceNames)
      .map(name => this.registry.get(name)!)
      .map(entry => entry.definition);
  }

  /**
   * Find all services with a specific tag
   */
  findByTag(tag: string): ServiceDefinition[] {
    const serviceNames = this.tagIndex.get(tag) || new Set();
    return Array.from(serviceNames)
      .map(name => this.registry.get(name)!)
      .map(entry => entry.definition);
  }

  /**
   * List all registered services
   */
  listServices(): ServiceDefinition[] {
    return Array.from(this.registry.values())
      .map(entry => entry.definition);
  }

  /**
   * List all service names
   */
  listServiceNames(): string[] {
    return Array.from(this.registry.keys());
  }

  /**
   * List all service types
   */
  listServiceTypes(): string[] {
    return Array.from(this.typeIndex.keys());
  }

  /**
   * List all service tags
   */
  listServiceTags(): string[] {
    return Array.from(this.tagIndex.keys());
  }

  /**
   * Clear a service's singleton cache
   */
  clearCache(serviceName: string): void {
    const entry = this.registry.get(serviceName);
    if (entry) {
      entry.instance = undefined;
      this.logger.log(`✅ [ServiceLocator] Cleared cache for: ${serviceName}`);
    }
  }

  /**
   * Clear all singleton caches
   */
  clearAllCaches(): void {
    this.registry.forEach(entry => {
      entry.instance = undefined;
    });
    this.logger.log('✅ [ServiceLocator] Cleared all caches');
  }

  /**
   * Unregister a service
   */
  unregisterService(serviceName: string): boolean {
    const entry = this.registry.get(serviceName);
    if (!entry) {
      return false;
    }

    // Remove from indices
    const serviceType = entry.definition.type;
    this.typeIndex.get(serviceType)?.delete(serviceName);

    entry.definition.tags?.forEach(tag => {
      this.tagIndex.get(tag)?.delete(serviceName);
    });

    // Remove from registry
    this.registry.delete(serviceName);
    this.logger.log(`✅ [ServiceLocator] Unregistered service: ${serviceName}`);
    return true;
  }

  /**
   * Get configuration
   */
  getConfig(): ServiceLocatorConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<ServiceLocatorConfig>): void {
    this.config = { ...this.config, ...config };
    validateServiceLocatorConfig(this.config);
    this.logger.log('✅ [ServiceLocator] Configuration updated');
  }
}

/**
 * Error thrown during service locator operations
 */
export class ServiceLocatorError extends Error {
  constructor(message: string, public readonly serviceName?: string) {
    super(message);
    this.name = 'ServiceLocatorError';
  }
}

/**
 * Service factory creator
 */
export function createServiceLocator(config?: Partial<ServiceLocatorConfig>): ServiceLocator {
  return new ServiceLocator(config);
}

/**
 * Singleton instance
 */
let instance: ServiceLocator | null = null;

/**
 * Get or create singleton service locator
 */
export function getServiceLocator(config?: Partial<ServiceLocatorConfig>): ServiceLocator {
  if (!instance) {
    instance = new ServiceLocator(config || DEFAULT_SERVICE_LOCATOR_CONFIG);
  }
  return instance;
}

/**
 * Reset singleton (useful for testing)
 */
export function resetServiceLocator(): void {
  instance = null;
}
