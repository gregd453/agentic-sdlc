/**
 * @agentic-sdlc/logger-config
 * Logger configuration service with runtime log level management
 */

export { LoggerConfigService, LoggerConfigError, getLoggerConfigService, createLoggerConfigService } from './logger-config-service';
export type { LoggerConfig } from './logger-config-service';
export { LogLevel, shouldLog, isValidLogLevel, getNextLevel, LogLevelValue, PinoLevelMap } from './log-level';
export { DEFAULT_LOGGER_CONFIG } from './logger-config-service';
export {
  createConfigurableLogger,
  createLoggerWithTraceContext,
  createModuleLevelLogger,
  PinoLevelMap as PinoLevelMapFromConfigurable
} from './configurable-logger';
export type { ConfigurableLoggerOptions } from './configurable-logger';
