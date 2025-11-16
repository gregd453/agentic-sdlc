/**
 * @agentic-sdlc/config-manager
 * Configuration management with validation and override hierarchy
 */

export { ConfigurationManager, ConfigurationError, getConfigurationManager } from './configuration-manager';
export {
  AgentConfig,
  AppConfig,
  LoggingConfig,
  ServiceConfig,
  LogLevel,
  AgentConfigSchema,
  AppConfigSchema,
  LoggingConfigSchema,
  ServiceConfigSchema,
  DEFAULT_AGENT_CONFIG,
  DEFAULT_APP_CONFIG,
  DEFAULT_LOGGING_CONFIG
} from './config-schema';
