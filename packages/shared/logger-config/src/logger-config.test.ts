import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  LoggerConfigService,
  DEFAULT_LOGGER_CONFIG,
  LoggerConfigError
} from './logger-config-service';
import { shouldLog, isValidLogLevel, getNextLevel } from './log-level';

describe('LoggerConfigService', () => {
  let service: LoggerConfigService;

  beforeEach(() => {
    service = new LoggerConfigService();
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      const config = service.getConfig();

      expect(config.global_level).toBe(LOG_LEVEL.INFO);
      expect(config.trace_enabled).toBe(true);
      expect(config.pretty_print).toBe(true);
    });

    it('should initialize with custom config', () => {
      const customService = new LoggerConfigService({
        global_level: LOG_LEVEL.DEBUG,
        trace_enabled: false
      });

      const config = customService.getConfig();
      expect(config.global_level).toBe(LOG_LEVEL.DEBUG);
      expect(config.trace_enabled).toBe(false);
    });
  });

  describe('setGlobalLevel', () => {
    it('should set global log level', () => {
      service.setGlobalLevel(LOG_LEVEL.DEBUG);

      expect(service.getConfig().global_level).toBe(LOG_LEVEL.DEBUG);
    });

    it('should throw on invalid log level', () => {
      expect(() => {
        service.setGlobalLevel('invalid' as any);
      }).toThrow();
    });

    it('should support all valid log levels', () => {
      const levels = ['trace', LOG_LEVEL.DEBUG, LOG_LEVEL.INFO, LOG_LEVEL.WARN, LOG_LEVEL.ERROR, 'fatal'] as const;

      levels.forEach(level => {
        service.setGlobalLevel(level);
        expect(service.getConfig().global_level).toBe(level);
      });
    });

    it('should notify listeners on level change', () => {
      const listener = vi.fn();
      service.subscribe(listener);

      service.setGlobalLevel(LOG_LEVEL.DEBUG);

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        global_level: LOG_LEVEL.DEBUG
      }));
    });
  });

  describe('setModuleLevel', () => {
    it('should set module-specific log level', () => {
      service.setModuleLevel('orchestrator', LOG_LEVEL.DEBUG);

      expect(service.getModuleLevel('orchestrator')).toBe(LOG_LEVEL.DEBUG);
    });

    it('should fall back to global level for unset modules', () => {
      service.setGlobalLevel(LOG_LEVEL.WARN);

      expect(service.getModuleLevel('unknown')).toBe(LOG_LEVEL.WARN);
    });

    it('should override global level for configured module', () => {
      service.setGlobalLevel(LOG_LEVEL.INFO);
      service.setModuleLevel(AGENT_TYPES.SCAFFOLD, LOG_LEVEL.DEBUG);

      expect(service.getModuleLevel(AGENT_TYPES.SCAFFOLD)).toBe(LOG_LEVEL.DEBUG);
      expect(service.getModuleLevel('other')).toBe(LOG_LEVEL.INFO);
    });

    it('should throw on invalid log level', () => {
      expect(() => {
        service.setModuleLevel('module', 'invalid' as any);
      }).toThrow();
    });
  });

  describe('shouldLog', () => {
    beforeEach(() => {
      service.setGlobalLevel(LOG_LEVEL.INFO);
    });

    it('should return true for messages at or above configured level', () => {
      expect(service.shouldLog('test', LOG_LEVEL.INFO)).toBe(true);
      expect(service.shouldLog('test', LOG_LEVEL.WARN)).toBe(true);
      expect(service.shouldLog('test', LOG_LEVEL.ERROR)).toBe(true);
    });

    it('should return false for messages below configured level', () => {
      expect(service.shouldLog('test', LOG_LEVEL.DEBUG)).toBe(false);
      expect(service.shouldLog('test', 'trace')).toBe(false);
    });

    it('should use module-specific level when set', () => {
      service.setModuleLevel('debug-module', LOG_LEVEL.DEBUG);

      expect(service.shouldLog('debug-module', LOG_LEVEL.DEBUG)).toBe(true);
      expect(service.shouldLog('debug-module', LOG_LEVEL.INFO)).toBe(true);

      expect(service.shouldLog('other-module', LOG_LEVEL.DEBUG)).toBe(false);
      expect(service.shouldLog('other-module', LOG_LEVEL.INFO)).toBe(true);
    });
  });

  describe('getModuleLevels', () => {
    it('should return all module-specific levels', () => {
      service.setModuleLevel('module1', LOG_LEVEL.DEBUG);
      service.setModuleLevel('module2', LOG_LEVEL.WARN);

      const levels = service.getModuleLevels();

      expect(levels.module1).toBe(LOG_LEVEL.DEBUG);
      expect(levels.module2).toBe(LOG_LEVEL.WARN);
    });

    it('should return empty object when no module levels set', () => {
      const levels = service.getModuleLevels();

      expect(Object.keys(levels)).toHaveLength(0);
    });

    it('should return copy, not reference', () => {
      service.setModuleLevel('module1', LOG_LEVEL.DEBUG);

      const levels1 = service.getModuleLevels();
      levels1.module1 = LOG_LEVEL.ERROR;

      const levels2 = service.getModuleLevels();
      expect(levels2.module1).toBe(LOG_LEVEL.DEBUG);
    });
  });

  describe('clearModuleLevels', () => {
    it('should clear all module-specific levels', () => {
      service.setModuleLevel('module1', LOG_LEVEL.DEBUG);
      service.setModuleLevel('module2', LOG_LEVEL.WARN);

      service.clearModuleLevels();

      const levels = service.getModuleLevels();
      expect(Object.keys(levels)).toHaveLength(0);
    });

    it('should notify listeners when clearing', () => {
      service.setModuleLevel('module1', LOG_LEVEL.DEBUG);
      const listener = vi.fn();
      service.subscribe(listener);

      service.clearModuleLevels();

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('trace enable/disable', () => {
    it('should enable trace logging', () => {
      service.setTraceEnabled(true);

      expect(service.getConfig().trace_enabled).toBe(true);
    });

    it('should disable trace logging', () => {
      service.setTraceEnabled(false);

      expect(service.getConfig().trace_enabled).toBe(false);
    });

    it('should notify listeners on trace change', () => {
      const listener = vi.fn();
      service.subscribe(listener);

      service.setTraceEnabled(false);

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        trace_enabled: false
      }));
    });
  });

  describe('subscriptions', () => {
    it('should notify subscriber on config change', () => {
      const listener = vi.fn();
      service.subscribe(listener);

      service.setGlobalLevel(LOG_LEVEL.DEBUG);

      expect(listener).toHaveBeenCalled();
    });

    it('should support multiple subscribers', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      service.subscribe(listener1);
      service.subscribe(listener2);

      service.setGlobalLevel(LOG_LEVEL.DEBUG);

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('should unsubscribe listener', () => {
      const listener = vi.fn();
      service.subscribe(listener);

      service.unsubscribe(listener);
      service.setGlobalLevel(LOG_LEVEL.DEBUG);

      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', () => {
      const listener = vi.fn(() => {
        throw new Error('Listener error');
      });
      service.subscribe(listener);

      // Should not throw
      expect(() => {
        service.setGlobalLevel(LOG_LEVEL.DEBUG);
      }).not.toThrow();
    });
  });

  describe('setConfig', () => {
    it('should merge partial config with existing', () => {
      service.setGlobalLevel(LOG_LEVEL.WARN);

      service.setConfig({ trace_enabled: false });

      const config = service.getConfig();
      expect(config.global_level).toBe(LOG_LEVEL.WARN);
      expect(config.trace_enabled).toBe(false);
    });

    it('should validate complete config', () => {
      expect(() => {
        service.setConfig({
          global_level: 'invalid' as any
        });
      }).toThrow();
    });
  });

  describe('getConfig', () => {
    it('should return deep copy of configuration', () => {
      service.setModuleLevel('module1', LOG_LEVEL.DEBUG);

      const config1 = service.getConfig();
      config1.modules!.module1 = LOG_LEVEL.ERROR;

      const config2 = service.getConfig();
      expect(config2.modules!.module1).toBe(LOG_LEVEL.DEBUG);
    });
  });
});

describe('Log Level Utilities', () => {
  describe('shouldLog', () => {
    it('should return true for same level', () => {
      expect(shouldLog(LOG_LEVEL.INFO, LOG_LEVEL.INFO)).toBe(true);
    });

    it('should return true for higher level', () => {
      expect(shouldLog(LOG_LEVEL.INFO, LOG_LEVEL.WARN)).toBe(true);
      expect(shouldLog(LOG_LEVEL.DEBUG, LOG_LEVEL.ERROR)).toBe(true);
    });

    it('should return false for lower level', () => {
      expect(shouldLog(LOG_LEVEL.WARN, LOG_LEVEL.INFO)).toBe(false);
      expect(shouldLog(LOG_LEVEL.ERROR, LOG_LEVEL.DEBUG)).toBe(false);
    });
  });

  describe('isValidLogLevel', () => {
    it('should validate known log levels', () => {
      expect(isValidLogLevel('trace')).toBe(true);
      expect(isValidLogLevel(LOG_LEVEL.DEBUG)).toBe(true);
      expect(isValidLogLevel(LOG_LEVEL.INFO)).toBe(true);
    });

    it('should reject unknown log levels', () => {
      expect(isValidLogLevel('invalid')).toBe(false);
      expect(isValidLogLevel('verbose')).toBe(false);
    });
  });

  describe('getNextLevel', () => {
    it('should get next level going down (more verbose)', () => {
      expect(getNextLevel(LOG_LEVEL.INFO, 'down')).toBe(LOG_LEVEL.DEBUG);
      expect(getNextLevel(LOG_LEVEL.DEBUG, 'down')).toBe('trace');
    });

    it('should get next level going up (less verbose)', () => {
      expect(getNextLevel(LOG_LEVEL.DEBUG, 'up')).toBe(LOG_LEVEL.INFO);
      expect(getNextLevel(LOG_LEVEL.INFO, 'up')).toBe(LOG_LEVEL.WARN);
    });

    it('should stay at extreme levels', () => {
      expect(getNextLevel('trace', 'down')).toBe('trace');
      expect(getNextLevel('fatal', 'up')).toBe('fatal');
    });
  });
});
