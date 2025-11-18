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

      expect(config.global_level).toBe('info');
      expect(config.trace_enabled).toBe(true);
      expect(config.pretty_print).toBe(true);
    });

    it('should initialize with custom config', () => {
      const customService = new LoggerConfigService({
        global_level: 'debug',
        trace_enabled: false
      });

      const config = customService.getConfig();
      expect(config.global_level).toBe('debug');
      expect(config.trace_enabled).toBe(false);
    });
  });

  describe('setGlobalLevel', () => {
    it('should set global log level', () => {
      service.setGlobalLevel('debug');

      expect(service.getConfig().global_level).toBe('debug');
    });

    it('should throw on invalid log level', () => {
      expect(() => {
        service.setGlobalLevel('invalid' as any);
      }).toThrow();
    });

    it('should support all valid log levels', () => {
      const levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;

      levels.forEach(level => {
        service.setGlobalLevel(level);
        expect(service.getConfig().global_level).toBe(level);
      });
    });

    it('should notify listeners on level change', () => {
      const listener = vi.fn();
      service.subscribe(listener);

      service.setGlobalLevel('debug');

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        global_level: 'debug'
      }));
    });
  });

  describe('setModuleLevel', () => {
    it('should set module-specific log level', () => {
      service.setModuleLevel('orchestrator', 'debug');

      expect(service.getModuleLevel('orchestrator')).toBe('debug');
    });

    it('should fall back to global level for unset modules', () => {
      service.setGlobalLevel('warn');

      expect(service.getModuleLevel('unknown')).toBe('warn');
    });

    it('should override global level for configured module', () => {
      service.setGlobalLevel('info');
      service.setModuleLevel('scaffold', 'debug');

      expect(service.getModuleLevel('scaffold')).toBe('debug');
      expect(service.getModuleLevel('other')).toBe('info');
    });

    it('should throw on invalid log level', () => {
      expect(() => {
        service.setModuleLevel('module', 'invalid' as any);
      }).toThrow();
    });
  });

  describe('shouldLog', () => {
    beforeEach(() => {
      service.setGlobalLevel('info');
    });

    it('should return true for messages at or above configured level', () => {
      expect(service.shouldLog('test', 'info')).toBe(true);
      expect(service.shouldLog('test', 'warn')).toBe(true);
      expect(service.shouldLog('test', 'error')).toBe(true);
    });

    it('should return false for messages below configured level', () => {
      expect(service.shouldLog('test', 'debug')).toBe(false);
      expect(service.shouldLog('test', 'trace')).toBe(false);
    });

    it('should use module-specific level when set', () => {
      service.setModuleLevel('debug-module', 'debug');

      expect(service.shouldLog('debug-module', 'debug')).toBe(true);
      expect(service.shouldLog('debug-module', 'info')).toBe(true);

      expect(service.shouldLog('other-module', 'debug')).toBe(false);
      expect(service.shouldLog('other-module', 'info')).toBe(true);
    });
  });

  describe('getModuleLevels', () => {
    it('should return all module-specific levels', () => {
      service.setModuleLevel('module1', 'debug');
      service.setModuleLevel('module2', 'warn');

      const levels = service.getModuleLevels();

      expect(levels.module1).toBe('debug');
      expect(levels.module2).toBe('warn');
    });

    it('should return empty object when no module levels set', () => {
      const levels = service.getModuleLevels();

      expect(Object.keys(levels)).toHaveLength(0);
    });

    it('should return copy, not reference', () => {
      service.setModuleLevel('module1', 'debug');

      const levels1 = service.getModuleLevels();
      levels1.module1 = 'error';

      const levels2 = service.getModuleLevels();
      expect(levels2.module1).toBe('debug');
    });
  });

  describe('clearModuleLevels', () => {
    it('should clear all module-specific levels', () => {
      service.setModuleLevel('module1', 'debug');
      service.setModuleLevel('module2', 'warn');

      service.clearModuleLevels();

      const levels = service.getModuleLevels();
      expect(Object.keys(levels)).toHaveLength(0);
    });

    it('should notify listeners when clearing', () => {
      service.setModuleLevel('module1', 'debug');
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

      service.setGlobalLevel('debug');

      expect(listener).toHaveBeenCalled();
    });

    it('should support multiple subscribers', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      service.subscribe(listener1);
      service.subscribe(listener2);

      service.setGlobalLevel('debug');

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('should unsubscribe listener', () => {
      const listener = vi.fn();
      service.subscribe(listener);

      service.unsubscribe(listener);
      service.setGlobalLevel('debug');

      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', () => {
      const listener = vi.fn(() => {
        throw new Error('Listener error');
      });
      service.subscribe(listener);

      // Should not throw
      expect(() => {
        service.setGlobalLevel('debug');
      }).not.toThrow();
    });
  });

  describe('setConfig', () => {
    it('should merge partial config with existing', () => {
      service.setGlobalLevel('warn');

      service.setConfig({ trace_enabled: false });

      const config = service.getConfig();
      expect(config.global_level).toBe('warn');
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
      service.setModuleLevel('module1', 'debug');

      const config1 = service.getConfig();
      config1.modules!.module1 = 'error';

      const config2 = service.getConfig();
      expect(config2.modules!.module1).toBe('debug');
    });
  });
});

describe('Log Level Utilities', () => {
  describe('shouldLog', () => {
    it('should return true for same level', () => {
      expect(shouldLog('info', 'info')).toBe(true);
    });

    it('should return true for higher level', () => {
      expect(shouldLog('info', 'warn')).toBe(true);
      expect(shouldLog('debug', 'error')).toBe(true);
    });

    it('should return false for lower level', () => {
      expect(shouldLog('warn', 'info')).toBe(false);
      expect(shouldLog('error', 'debug')).toBe(false);
    });
  });

  describe('isValidLogLevel', () => {
    it('should validate known log levels', () => {
      expect(isValidLogLevel('trace')).toBe(true);
      expect(isValidLogLevel('debug')).toBe(true);
      expect(isValidLogLevel('info')).toBe(true);
    });

    it('should reject unknown log levels', () => {
      expect(isValidLogLevel('invalid')).toBe(false);
      expect(isValidLogLevel('verbose')).toBe(false);
    });
  });

  describe('getNextLevel', () => {
    it('should get next level going down (more verbose)', () => {
      expect(getNextLevel('info', 'down')).toBe('debug');
      expect(getNextLevel('debug', 'down')).toBe('trace');
    });

    it('should get next level going up (less verbose)', () => {
      expect(getNextLevel('debug', 'up')).toBe('info');
      expect(getNextLevel('info', 'up')).toBe('warn');
    });

    it('should stay at extreme levels', () => {
      expect(getNextLevel('trace', 'down')).toBe('trace');
      expect(getNextLevel('fatal', 'up')).toBe('fatal');
    });
  });
});
