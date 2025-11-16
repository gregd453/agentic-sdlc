import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ServiceLocator,
  ServiceLocatorError,
  createServiceLocator,
  getServiceLocator,
  resetServiceLocator
} from './service-locator';
import { ServiceDefinition } from './service-schema';

describe('ServiceLocator', () => {
  let locator: ServiceLocator;

  const mockDatabaseService: ServiceDefinition = {
    name: 'database',
    type: 'database',
    version: '1.0.0',
    description: 'SQL database connection',
    tags: ['persistence', 'sql']
  };

  const mockRedisService: ServiceDefinition = {
    name: 'redis',
    type: 'cache',
    version: '2.0.0',
    description: 'Redis caching service',
    tags: ['persistence', 'cache', 'fast']
  };

  const mockLoggerService: ServiceDefinition = {
    name: 'logger',
    type: 'logging',
    version: '1.5.0',
    description: 'Structured logger',
    tags: ['logging', 'observability']
  };

  beforeEach(() => {
    resetServiceLocator();
    locator = new ServiceLocator();
  });

  afterEach(() => {
    resetServiceLocator();
  });

  describe('initialization', () => {
    it('should create service locator with default config', () => {
      expect(locator).toBeDefined();
      const config = locator.getConfig();
      expect(config.enable_caching).toBe(true);
      expect(config.auto_register).toBe(false);
    });

    it('should accept custom configuration', () => {
      const customLocator = new ServiceLocator({
        enable_caching: false,
        auto_register: true
      });

      const config = customLocator.getConfig();
      expect(config.enable_caching).toBe(false);
      expect(config.auto_register).toBe(true);
    });

    it('should throw on invalid configuration', () => {
      expect(() => {
        new ServiceLocator({ default_timeout_ms: -1000 } as any);
      }).toThrow();
    });
  });

  describe('registerService', () => {
    it('should register a service', () => {
      const factory = async () => ({ connected: true });

      locator.registerService(mockDatabaseService, factory);

      expect(locator.hasService('database')).toBe(true);
    });

    it('should register multiple services', () => {
      locator.registerService(mockDatabaseService, async () => ({}));
      locator.registerService(mockRedisService, async () => ({}));
      locator.registerService(mockLoggerService, async () => ({}));

      expect(locator.listServiceNames()).toHaveLength(3);
    });

    it('should support synchronous factories', () => {
      const factory = () => ({ sync: true });

      locator.registerService(mockLoggerService, factory as any);

      expect(locator.hasService('logger')).toBe(true);
    });

    it('should register with singleton mode', () => {
      let callCount = 0;
      const factory = async () => {
        callCount++;
        return { instance: callCount };
      };

      locator.registerService(mockDatabaseService, factory, true);

      expect(locator.hasService('database')).toBe(true);
    });

    it('should warn on service override', () => {
      locator.registerService(mockDatabaseService, async () => ({}));
      locator.registerService(mockDatabaseService, async () => ({ v2: true }));

      // Should still be registered
      expect(locator.hasService('database')).toBe(true);
    });

    it('should throw on invalid service definition', () => {
      const invalid = { name: '' } as any; // Invalid: empty name

      expect(() => {
        locator.registerService(invalid, async () => ({}));
      }).toThrow();
    });
  });

  describe('getService', () => {
    it('should instantiate registered service', async () => {
      const factory = async () => ({ connected: true });
      locator.registerService(mockDatabaseService, factory);

      const service = await locator.getService('database');

      expect(service).toEqual({ connected: true });
    });

    it('should pass configuration to factory', async () => {
      const factory = async (config: any) => ({ config });
      locator.registerService(mockDatabaseService, factory);

      const service = await locator.getService('database', { host: 'localhost' });

      expect(service.config).toEqual({ host: 'localhost' });
    });

    it('should cache singleton instances', async () => {
      let callCount = 0;
      const factory = async () => {
        callCount++;
        return { instance: callCount };
      };

      locator.registerService(mockDatabaseService, factory, true);

      const service1 = await locator.getService('database');
      const service2 = await locator.getService('database');

      expect(service1).toEqual(service2);
      expect(callCount).toBe(1);
    });

    it('should create new instances for non-singleton', async () => {
      let callCount = 0;
      const factory = async () => {
        callCount++;
        return { instance: callCount };
      };

      locator.registerService(mockDatabaseService, factory, false);

      const service1 = await locator.getService('database');
      const service2 = await locator.getService('database');

      expect(service1.instance).not.toEqual(service2.instance);
      expect(callCount).toBe(2);
    });

    it('should throw on unregistered service', async () => {
      await expect(
        locator.getService('nonexistent')
      ).rejects.toThrow(ServiceLocatorError);
    });

    it('should throw on factory error', async () => {
      const failingFactory = async () => {
        throw new Error('Factory failed');
      };

      locator.registerService(mockDatabaseService, failingFactory);

      await expect(
        locator.getService('database')
      ).rejects.toThrow(ServiceLocatorError);
    });
  });

  describe('hasService', () => {
    it('should return true for registered service', () => {
      locator.registerService(mockDatabaseService, async () => ({}));

      expect(locator.hasService('database')).toBe(true);
    });

    it('should return false for unregistered service', () => {
      expect(locator.hasService('nonexistent')).toBe(false);
    });
  });

  describe('getDefinition', () => {
    it('should return service definition', () => {
      locator.registerService(mockDatabaseService, async () => ({}));

      const def = locator.getDefinition('database');

      expect(def.name).toBe('database');
      expect(def.type).toBe('database');
      expect(def.tags).toContain('sql');
    });

    it('should throw for unregistered service', () => {
      expect(() => {
        locator.getDefinition('nonexistent');
      }).toThrow(ServiceLocatorError);
    });
  });

  describe('findByType', () => {
    it('should find services by type', () => {
      locator.registerService(mockDatabaseService, async () => ({}));
      locator.registerService(mockRedisService, async () => ({}));
      locator.registerService(mockLoggerService, async () => ({}));

      const databases = locator.findByType('database');
      const caches = locator.findByType('cache');
      const logging = locator.findByType('logging');

      expect(databases).toHaveLength(1);
      expect(databases[0].name).toBe('database');

      expect(caches).toHaveLength(1);
      expect(logging).toHaveLength(1);
    });

    it('should return empty array for unknown type', () => {
      const unknown = locator.findByType('unknown-type');

      expect(unknown).toEqual([]);
    });
  });

  describe('findByTag', () => {
    it('should find services by tag', () => {
      locator.registerService(mockDatabaseService, async () => ({}));
      locator.registerService(mockRedisService, async () => ({}));
      locator.registerService(mockLoggerService, async () => ({}));

      const persistenceServices = locator.findByTag('persistence');
      const logging = locator.findByTag('logging');
      const observability = locator.findByTag('observability');

      expect(persistenceServices).toHaveLength(2); // database + redis
      expect(logging).toHaveLength(1);
      expect(observability).toHaveLength(1);
    });

    it('should return empty array for unknown tag', () => {
      const unknown = locator.findByTag('unknown-tag');

      expect(unknown).toEqual([]);
    });
  });

  describe('listServices', () => {
    it('should list all registered services', () => {
      locator.registerService(mockDatabaseService, async () => ({}));
      locator.registerService(mockRedisService, async () => ({}));

      const services = locator.listServices();

      expect(services).toHaveLength(2);
      expect(services.map(s => s.name)).toContain('database');
      expect(services.map(s => s.name)).toContain('redis');
    });

    it('should return empty array when no services registered', () => {
      const services = locator.listServices();

      expect(services).toEqual([]);
    });
  });

  describe('listServiceNames', () => {
    it('should list all service names', () => {
      locator.registerService(mockDatabaseService, async () => ({}));
      locator.registerService(mockRedisService, async () => ({}));

      const names = locator.listServiceNames();

      expect(names).toContain('database');
      expect(names).toContain('redis');
      expect(names).toHaveLength(2);
    });
  });

  describe('listServiceTypes', () => {
    it('should list all service types', () => {
      locator.registerService(mockDatabaseService, async () => ({}));
      locator.registerService(mockRedisService, async () => ({}));
      locator.registerService(mockLoggerService, async () => ({}));

      const types = locator.listServiceTypes();

      expect(types).toContain('database');
      expect(types).toContain('cache');
      expect(types).toContain('logging');
    });
  });

  describe('listServiceTags', () => {
    it('should list all service tags', () => {
      locator.registerService(mockDatabaseService, async () => ({}));
      locator.registerService(mockRedisService, async () => ({}));

      const tags = locator.listServiceTags();

      expect(tags).toContain('persistence');
      expect(tags).toContain('sql');
      expect(tags).toContain('cache');
    });
  });

  describe('clearCache', () => {
    it('should clear singleton cache for service', async () => {
      let callCount = 0;
      const factory = async () => {
        callCount++;
        return { instance: callCount };
      };

      locator.registerService(mockDatabaseService, factory, true);

      const service1 = await locator.getService('database');
      locator.clearCache('database');
      const service2 = await locator.getService('database');

      expect(service1.instance).not.toEqual(service2.instance);
      expect(callCount).toBe(2);
    });

    it('should handle non-existent service gracefully', () => {
      expect(() => {
        locator.clearCache('nonexistent');
      }).not.toThrow();
    });
  });

  describe('clearAllCaches', () => {
    it('should clear all singleton caches', async () => {
      let dbCalls = 0;
      let redisCalls = 0;

      locator.registerService(mockDatabaseService, async () => {
        dbCalls++;
        return { instance: dbCalls };
      }, true);

      locator.registerService(mockRedisService, async () => {
        redisCalls++;
        return { instance: redisCalls };
      }, true);

      await locator.getService('database');
      await locator.getService('redis');

      locator.clearAllCaches();

      await locator.getService('database');
      await locator.getService('redis');

      expect(dbCalls).toBe(2);
      expect(redisCalls).toBe(2);
    });
  });

  describe('unregisterService', () => {
    it('should unregister a service', () => {
      locator.registerService(mockDatabaseService, async () => ({}));

      expect(locator.hasService('database')).toBe(true);

      locator.unregisterService('database');

      expect(locator.hasService('database')).toBe(false);
    });

    it('should return false for non-existent service', () => {
      const result = locator.unregisterService('nonexistent');

      expect(result).toBe(false);
    });

    it('should update indices on unregister', () => {
      locator.registerService(mockDatabaseService, async () => ({}));

      expect(locator.findByType('database')).toHaveLength(1);

      locator.unregisterService('database');

      expect(locator.findByType('database')).toHaveLength(0);
    });
  });

  describe('configuration management', () => {
    it('should get current configuration', () => {
      const config = locator.getConfig();

      expect(config).toHaveProperty('enable_caching');
      expect(config).toHaveProperty('auto_register');
    });

    it('should update configuration', () => {
      locator.setConfig({ enable_caching: false });

      const config = locator.getConfig();

      expect(config.enable_caching).toBe(false);
    });

    it('should validate on config update', () => {
      expect(() => {
        locator.setConfig({ default_timeout_ms: -1000 } as any);
      }).toThrow();
    });
  });

  describe('factory functions', () => {
    it('should create locator instance via factory', () => {
      const newLocator = createServiceLocator();

      expect(newLocator).toBeInstanceOf(ServiceLocator);
    });

    it('should get or create singleton', () => {
      resetServiceLocator();

      const locator1 = getServiceLocator();
      const locator2 = getServiceLocator();

      expect(locator1).toBe(locator2);
    });

    it('should allow custom config for singleton', () => {
      resetServiceLocator();

      const locator = getServiceLocator({ enable_caching: false });

      expect(locator.getConfig().enable_caching).toBe(false);
    });
  });
});
