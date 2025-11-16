import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import {
  AgentConfig,
  AppConfig,
  AppConfigSchema,
  DEFAULT_AGENT_CONFIG,
  DEFAULT_APP_CONFIG,
  DEFAULT_LOGGING_CONFIG,
  LoggingConfig
} from './config-schema';

/**
 * Configuration Manager
 * Handles configuration loading with override hierarchy:
 * 1. Defaults (hardcoded)
 * 2. Configuration file (YAML/JSON)
 * 3. Environment variables
 * 4. Runtime overrides (future)
 */
export class ConfigurationManager {
  private config: AppConfig = { ...DEFAULT_APP_CONFIG };
  private readonly logger: any;

  /**
   * Constructor with optional logger injection
   * If no logger provided, uses console as fallback
   */
  constructor(injectedLogger?: any) {
    this.logger = injectedLogger || console;
  }

  /**
   * Initialize configuration from file and environment
   */
  async initialize(configPath?: string): Promise<void> {
    try {
      // Start with defaults
      this.config = { ...DEFAULT_APP_CONFIG };

      // Load from file if provided
      if (configPath) {
        await this.loadFromFile(configPath);
      }

      // Apply environment variable overrides
      this.applyEnvOverrides();

      // Validate final configuration
      this.validate();

      this.logger.log('✅ [ConfigurationManager] Configuration loaded and validated');
    } catch (error) {
      throw new ConfigurationError(
        `Failed to initialize configuration: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Load configuration from YAML/JSON file
   */
  private async loadFromFile(filePath: string): Promise<void> {
    try {
      if (!fs.existsSync(filePath)) {
        this.logger.warn(`Configuration file not found: ${filePath}, using defaults`);
        return;
      }

      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const ext = path.extname(filePath).toLowerCase();

      let parsedConfig: any;
      if (ext === '.json') {
        parsedConfig = JSON.parse(fileContent);
      } else if (ext === '.yaml' || ext === '.yml') {
        parsedConfig = yaml.load(fileContent);
      } else {
        throw new Error(`Unsupported config file format: ${ext}`);
      }

      // Merge with defaults
      this.config = this.deepMerge(DEFAULT_APP_CONFIG, parsedConfig);

      this.logger.log(`✅ [ConfigurationManager] Loaded configuration from: ${filePath}`);
    } catch (error) {
      throw new ConfigurationError(
        `Failed to load configuration file ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Apply environment variable overrides
   * Environment variables follow pattern: AGENT_{AGENTTYPE}_{PROPERTY}
   * Example: AGENT_SCAFFOLD_TIMEOUT_MS=60000
   */
  private applyEnvOverrides(): void {
    const env = process.env;

    // Apply agent-specific overrides
    for (const [key, value] of Object.entries(env)) {
      if (key.startsWith('AGENT_')) {
        const parts = key.split('_');
        if (parts.length >= 3) {
          const agentType = parts[1].toLowerCase();
          const property = parts.slice(2).join('_').toLowerCase();

          if (!this.config.agents) {
            this.config.agents = {};
          }

          if (!this.config.agents[agentType]) {
            this.config.agents[agentType] = { ...DEFAULT_AGENT_CONFIG };
          }

          // Parse value based on property type
          const parsedValue = this.parseEnvValue(value!);
          (this.config.agents[agentType] as any)[property] = parsedValue;

          this.logger.debug(`✅ Applied env override: ${key}=${value}`);
        }
      }
    }

    // Apply logging overrides
    if (env.LOG_LEVEL) {
      if (!this.config.logging) {
        this.config.logging = { ...DEFAULT_LOGGING_CONFIG };
      }
      this.config.logging.global_level = env.LOG_LEVEL as any;
    }

    if (env.TRACE_ENABLED) {
      if (!this.config.logging) {
        this.config.logging = { ...DEFAULT_LOGGING_CONFIG };
      }
      this.config.logging.trace_enabled = env.TRACE_ENABLED === 'true';
    }
  }

  /**
   * Parse environment variable value
   */
  private parseEnvValue(value: string): any {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (!isNaN(Number(value))) return Number(value);
    return value;
  }

  /**
   * Get agent configuration
   */
  getAgentConfig(agentType: string): AgentConfig {
    const agentConfig = this.config.agents?.[agentType];

    if (!agentConfig) {
      return { ...DEFAULT_AGENT_CONFIG };
    }

    return {
      ...DEFAULT_AGENT_CONFIG,
      ...agentConfig
    };
  }

  /**
   * Get logging configuration
   */
  getLoggingConfig(): LoggingConfig {
    return this.config.logging || { ...DEFAULT_LOGGING_CONFIG };
  }

  /**
   * Get complete configuration
   */
  getConfig(): AppConfig {
    return JSON.parse(JSON.stringify(this.config)); // Deep clone
  }

  /**
   * Set agent configuration (runtime override)
   */
  setAgentConfig(agentType: string, config: Partial<AgentConfig>): void {
    if (!this.config.agents) {
      this.config.agents = {};
    }

    this.config.agents[agentType] = {
      ...this.getAgentConfig(agentType),
      ...config
    };

    this.logger.log(`✅ [ConfigurationManager] Updated config for agent: ${agentType}`);
  }

  /**
   * Validate configuration
   */
  private validate(): void {
    try {
      AppConfigSchema.parse(this.config);
      this.logger.log('✅ [ConfigurationManager] Configuration validation passed');
    } catch (error) {
      throw new ConfigurationError(
        `Configuration validation failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Deep merge objects
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
          result[key] = this.deepMerge(result[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }
}

/**
 * Error thrown during configuration operations
 */
export class ConfigurationError extends Error {
  constructor(
    message: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * Singleton instance (optional, for convenience)
 */
let instance: ConfigurationManager | null = null;

export function getConfigurationManager(): ConfigurationManager {
  if (!instance) {
    instance = new ConfigurationManager();
  }
  return instance;
}
