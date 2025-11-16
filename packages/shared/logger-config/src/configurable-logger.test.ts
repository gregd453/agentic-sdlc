import { describe, it, expect, beforeEach } from 'vitest';
import {
  createConfigurableLogger,
  createLoggerWithTraceContext,
  createModuleLevelLogger
} from './configurable-logger';

describe('Configurable Logger Factory', () => {
  describe('createConfigurableLogger', () => {
    it('should create a pino logger with configured level', () => {
      const logger = createConfigurableLogger({
        name: 'test-logger',
        level: 'debug'
      });

      expect(logger).toBeDefined();
      expect(logger.level).toBe(20); // debug level
    });

    it('should respect different log levels', () => {
      const infoLogger = createConfigurableLogger({
        name: 'info-logger',
        level: 'info'
      });

      const errorLogger = createConfigurableLogger({
        name: 'error-logger',
        level: 'error'
      });

      expect(infoLogger.level).toBe(30); // info
      expect(errorLogger.level).toBe(50); // error
    });

    it('should support trace level', () => {
      const traceLogger = createConfigurableLogger({
        name: 'trace-logger',
        level: 'trace'
      });

      expect(traceLogger.level).toBe(10);
    });

    it('should support fatal level', () => {
      const fatalLogger = createConfigurableLogger({
        name: 'fatal-logger',
        level: 'fatal'
      });

      expect(fatalLogger.level).toBe(60);
    });

    it('should accept pretty print option', () => {
      const logger = createConfigurableLogger({
        name: 'pretty-logger',
        level: 'info',
        prettyPrint: true
      });

      expect(logger).toBeDefined();
    });

    it('should accept module level option', () => {
      const logger = createConfigurableLogger({
        name: 'module-logger',
        level: 'info',
        moduleLevel: 'scaffold'
      });

      expect(logger).toBeDefined();
    });
  });

  describe('createLoggerWithTraceContext', () => {
    it('should create logger with trace context', () => {
      const logger = createLoggerWithTraceContext(
        {
          name: 'trace-context-logger',
          level: 'info'
        },
        {
          trace_id: 'trace-123',
          span_id: 'span-456'
        }
      );

      expect(logger).toBeDefined();
    });

    it('should handle missing trace context gracefully', () => {
      const logger = createLoggerWithTraceContext(
        {
          name: 'no-trace-logger',
          level: 'debug'
        }
      );

      expect(logger).toBeDefined();
      expect(logger.level).toBe(20);
    });

    it('should include parent span id in trace context', () => {
      const logger = createLoggerWithTraceContext(
        {
          name: 'parent-span-logger',
          level: 'info'
        },
        {
          trace_id: 'trace-789',
          span_id: 'span-101',
          parent_span_id: 'parent-112'
        }
      );

      expect(logger).toBeDefined();
    });

    it('should support partial trace context', () => {
      const logger1 = createLoggerWithTraceContext(
        { name: 'logger1', level: 'info' },
        { trace_id: 'trace-only' }
      );

      const logger2 = createLoggerWithTraceContext(
        { name: 'logger2', level: 'info' },
        { span_id: 'span-only' }
      );

      expect(logger1).toBeDefined();
      expect(logger2).toBeDefined();
    });
  });

  describe('createModuleLevelLogger', () => {
    it('should create logger that respects module level', () => {
      const getModuleLevel = (moduleName: string) => {
        if (moduleName === 'scaffold') return 'debug';
        return 'info';
      };

      const logger = createModuleLevelLogger(
        {
          name: 'scaffold-logger',
          level: 'info',
          moduleLevel: 'scaffold'
        },
        getModuleLevel
      );

      expect(logger).toBeDefined();
      expect(logger.level).toBe(20); // debug for scaffold module
    });

    it('should use global level when module level not defined', () => {
      const getModuleLevel = () => 'info';

      const logger = createModuleLevelLogger(
        {
          name: 'default-logger',
          level: 'warn'
        },
        getModuleLevel
      );

      expect(logger).toBeDefined();
    });

    it('should override with module-specific level', () => {
      const getModuleLevel = (moduleName: string) => {
        const levels: Record<string, any> = {
          'validation': 'trace',
          'deployment': 'error',
          'integration': 'debug'
        };
        return levels[moduleName] || 'info';
      };

      const validationLogger = createModuleLevelLogger(
        {
          name: 'validation-logger',
          level: 'info',
          moduleLevel: 'validation'
        },
        getModuleLevel
      );

      const deploymentLogger = createModuleLevelLogger(
        {
          name: 'deployment-logger',
          level: 'info',
          moduleLevel: 'deployment'
        },
        getModuleLevel
      );

      expect(validationLogger.level).toBe(10); // trace
      expect(deploymentLogger.level).toBe(50); // error
    });

    it('should handle dynamic level changes', () => {
      let currentLevel = 'info';

      const getModuleLevel = () => currentLevel as any;

      const logger = createModuleLevelLogger(
        {
          name: 'dynamic-logger',
          level: 'info'
        },
        getModuleLevel
      );

      expect(logger.level).toBe(30); // info

      // Simulate level change
      currentLevel = 'debug';
      const updatedLogger = createModuleLevelLogger(
        {
          name: 'dynamic-logger',
          level: 'info'
        },
        getModuleLevel
      );

      expect(updatedLogger.level).toBe(20); // debug
    });
  });

  describe('Logger injection pattern', () => {
    it('should be injectable into services', () => {
      const logger = createConfigurableLogger({
        name: 'service-logger',
        level: 'info'
      });

      // Simulate service receiving logger
      class TestService {
        constructor(private logger: any) {}

        doWork() {
          this.logger.info('Test work');
        }
      }

      const service = new TestService(logger);
      expect(() => service.doWork()).not.toThrow();
    });

    it('should support multiple loggers with different configurations', () => {
      const scaffoldLogger = createConfigurableLogger({
        name: 'scaffold-service',
        level: 'debug'
      });

      const deploymentLogger = createConfigurableLogger({
        name: 'deployment-service',
        level: 'error'
      });

      expect(scaffoldLogger.level).toBe(20); // debug
      expect(deploymentLogger.level).toBe(50); // error
    });

    it('should allow logger configuration per service', () => {
      const config = {
        scaffold: { level: 'debug' as const },
        validation: { level: 'trace' as const },
        deployment: { level: 'error' as const }
      };

      const loggers: Record<string, any> = {};
      for (const [service, cfg] of Object.entries(config)) {
        loggers[service] = createConfigurableLogger({
          name: `${service}-service`,
          level: cfg.level
        });
      }

      expect(loggers.scaffold.level).toBe(20);
      expect(loggers.validation.level).toBe(10);
      expect(loggers.deployment.level).toBe(50);
    });
  });
});
