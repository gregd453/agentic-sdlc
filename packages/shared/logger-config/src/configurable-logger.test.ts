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
        level: LOG_LEVEL.DEBUG
      });

      expect(logger).toBeDefined();
      expect(logger.level).toBe(20); // debug level
    });

    it('should respect different log levels', () => {
      const infoLogger = createConfigurableLogger({
        name: 'info-logger',
        level: LOG_LEVEL.INFO
      });

      const errorLogger = createConfigurableLogger({
        name: 'error-logger',
        level: LOG_LEVEL.ERROR
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
        level: LOG_LEVEL.INFO,
        prettyPrint: true
      });

      expect(logger).toBeDefined();
    });

    it('should accept module level option', () => {
      const logger = createConfigurableLogger({
        name: 'module-logger',
        level: LOG_LEVEL.INFO,
        moduleLevel: AGENT_TYPES.SCAFFOLD
      });

      expect(logger).toBeDefined();
    });
  });

  describe('createLoggerWithTraceContext', () => {
    it('should create logger with trace context', () => {
      const logger = createLoggerWithTraceContext(
        {
          name: 'trace-context-logger',
          level: LOG_LEVEL.INFO
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
          level: LOG_LEVEL.DEBUG
        }
      );

      expect(logger).toBeDefined();
      expect(logger.level).toBe(20);
    });

    it('should include parent span id in trace context', () => {
      const logger = createLoggerWithTraceContext(
        {
          name: 'parent-span-logger',
          level: LOG_LEVEL.INFO
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
        { name: 'logger1', level: LOG_LEVEL.INFO },
        { trace_id: 'trace-only' }
      );

      const logger2 = createLoggerWithTraceContext(
        { name: 'logger2', level: LOG_LEVEL.INFO },
        { span_id: 'span-only' }
      );

      expect(logger1).toBeDefined();
      expect(logger2).toBeDefined();
    });
  });

  describe('createModuleLevelLogger', () => {
    it('should create logger that respects module level', () => {
      const getModuleLevel = (moduleName: string) => {
        if (moduleName === AGENT_TYPES.SCAFFOLD) return LOG_LEVEL.DEBUG;
        return LOG_LEVEL.INFO;
      };

      const logger = createModuleLevelLogger(
        {
          name: 'scaffold-logger',
          level: LOG_LEVEL.INFO,
          moduleLevel: AGENT_TYPES.SCAFFOLD
        },
        getModuleLevel
      );

      expect(logger).toBeDefined();
      expect(logger.level).toBe(20); // debug for scaffold module
    });

    it('should use global level when module level not defined', () => {
      const getModuleLevel = () => LOG_LEVEL.INFO;

      const logger = createModuleLevelLogger(
        {
          name: 'default-logger',
          level: LOG_LEVEL.WARN
        },
        getModuleLevel
      );

      expect(logger).toBeDefined();
    });

    it('should override with module-specific level', () => {
      const getModuleLevel = (moduleName: string) => {
        const levels: Record<string, any> = {
          AGENT_TYPES.VALIDATION: 'trace',
          AGENT_TYPES.DEPLOYMENT: LOG_LEVEL.ERROR,
          AGENT_TYPES.INTEGRATION: LOG_LEVEL.DEBUG
        };
        return levels[moduleName] || LOG_LEVEL.INFO;
      };

      const validationLogger = createModuleLevelLogger(
        {
          name: 'validation-logger',
          level: LOG_LEVEL.INFO,
          moduleLevel: AGENT_TYPES.VALIDATION
        },
        getModuleLevel
      );

      const deploymentLogger = createModuleLevelLogger(
        {
          name: 'deployment-logger',
          level: LOG_LEVEL.INFO,
          moduleLevel: AGENT_TYPES.DEPLOYMENT
        },
        getModuleLevel
      );

      expect(validationLogger.level).toBe(10); // trace
      expect(deploymentLogger.level).toBe(50); // error
    });

    it('should handle dynamic level changes', () => {
      let currentLevel = LOG_LEVEL.INFO;

      const getModuleLevel = () => currentLevel as any;

      const logger = createModuleLevelLogger(
        {
          name: 'dynamic-logger',
          level: LOG_LEVEL.INFO
        },
        getModuleLevel
      );

      expect(logger.level).toBe(30); // info

      // Simulate level change
      currentLevel = LOG_LEVEL.DEBUG;
      const updatedLogger = createModuleLevelLogger(
        {
          name: 'dynamic-logger',
          level: LOG_LEVEL.INFO
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
        level: LOG_LEVEL.INFO
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
        level: LOG_LEVEL.DEBUG
      });

      const deploymentLogger = createConfigurableLogger({
        name: 'deployment-service',
        level: LOG_LEVEL.ERROR
      });

      expect(scaffoldLogger.level).toBe(20); // debug
      expect(deploymentLogger.level).toBe(50); // error
    });

    it('should allow logger configuration per service', () => {
      const config = {
        scaffold: { level: LOG_LEVEL.DEBUG as const },
        validation: { level: 'trace' as const },
        deployment: { level: LOG_LEVEL.ERROR as const }
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
