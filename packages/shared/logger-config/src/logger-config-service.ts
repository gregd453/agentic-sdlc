import type pino from 'pino';
import { LogLevel, shouldLog, isValidLogLevel } from './log-level';

/**
 * Logger Configuration Service
 * Manages log levels at global and module levels
 * Supports runtime configuration updates and logger injection
 */

export interface LoggerConfig {
  global_level: LogLevel;
  modules?: Record<string, LogLevel>;
  trace_enabled: boolean;
  pretty_print: boolean;
}

export const DEFAULT_LOGGER_CONFIG: LoggerConfig = {
  global_level: 'info',
  modules: {},
  trace_enabled: true,
  pretty_print: true
};

export class LoggerConfigService {
  private config: LoggerConfig = { ...DEFAULT_LOGGER_CONFIG };
  private listeners: Set<(config: LoggerConfig) => void> = new Set();
  private readonly logger: pino.Logger | Console;

  /**
   * Constructor with optional logger injection
   * If no logger provided, uses console as fallback
   */
  constructor(initialConfig?: Partial<LoggerConfig>, injectedLogger?: pino.Logger | Console) {
    this.logger = injectedLogger || console;
    if (initialConfig) {
      this.setConfig(initialConfig);
    }
  }

  /**
   * Helper to log messages
   */
  private log(message: string): void {
    if ('log' in this.logger) {
      this.logger.log(message);
    } else if ('info' in this.logger) {
      this.logger.info(message);
    }
  }

  /**
   * Set complete configuration
   */
  setConfig(config: Partial<LoggerConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };

    this.validate();
    this.notifyListeners();
    this.log('✅ [LoggerConfigService] Configuration updated');
  }

  /**
   * Get current configuration
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  /**
   * Set global log level
   */
  setGlobalLevel(level: LogLevel): void {
    if (!isValidLogLevel(level)) {
      throw new Error(`Invalid log level: ${level}`);
    }
    this.config.global_level = level;
    this.notifyListeners();
    this.log(`✅ [LoggerConfigService] Global level set to: ${level}`);
  }

  /**
   * Set module-specific log level
   */
  setModuleLevel(module: string, level: LogLevel): void {
    if (!isValidLogLevel(level)) {
      throw new Error(`Invalid log level: ${level}`);
    }
    if (!this.config.modules) {
      this.config.modules = {};
    }
    this.config.modules[module] = level;
    this.notifyListeners();
    this.log(`✅ [LoggerConfigService] Module '${module}' level set to: ${level}`);
  }

  /**
   * Get module-specific log level (falls back to global)
   */
  getModuleLevel(module: string): LogLevel {
    if (this.config.modules && this.config.modules[module]) {
      return this.config.modules[module];
    }
    return this.config.global_level;
  }

  /**
   * Check if a message should be logged
   */
  shouldLog(module: string, messageLevel: LogLevel): boolean {
    const moduleLevel = this.getModuleLevel(module);
    return shouldLog(moduleLevel, messageLevel);
  }

  /**
   * Enable/disable trace logging
   */
  setTraceEnabled(enabled: boolean): void {
    this.config.trace_enabled = enabled;
    this.notifyListeners();
    this.log(`✅ [LoggerConfigService] Trace logging ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Subscribe to configuration changes
   */
  subscribe(listener: (config: LoggerConfig) => void): void {
    this.listeners.add(listener);
  }

  /**
   * Unsubscribe from configuration changes
   */
  unsubscribe(listener: (config: LoggerConfig) => void): void {
    this.listeners.delete(listener);
  }

  /**
   * Validate configuration
   */
  private validate(): void {
    // Validate global level
    if (!isValidLogLevel(this.config.global_level)) {
      throw new Error(`Invalid global log level: ${this.config.global_level}`);
    }

    // Validate module levels
    if (this.config.modules) {
      for (const [module, level] of Object.entries(this.config.modules)) {
        if (!isValidLogLevel(level)) {
          throw new Error(`Invalid log level for module '${module}': ${level}`);
        }
      }
    }
  }

  /**
   * Notify all listeners of configuration change
   */
  private notifyListeners(): void {
    const config = this.getConfig();
    this.listeners.forEach(listener => {
      try {
        listener(config);
      } catch (error) {
        if ('error' in this.logger) {
          this.logger.error('Error notifying listener:', error);
        } else {
          console.error('Error notifying listener:', error);
        }
      }
    });
  }

  /**
   * Clear all module-specific levels
   */
  clearModuleLevels(): void {
    this.config.modules = {};
    this.notifyListeners();
    this.log('✅ [LoggerConfigService] Module levels cleared');
  }

  /**
   * Get all module levels
   */
  getModuleLevels(): Record<string, LogLevel> {
    return { ...(this.config.modules || {}) };
  }
}

/**
 * Error thrown during logger configuration
 */
export class LoggerConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LoggerConfigError';
  }
}

/**
 * Singleton instance
 */
let instance: LoggerConfigService | null = null;

export function getLoggerConfigService(): LoggerConfigService {
  if (!instance) {
    instance = new LoggerConfigService();
  }
  return instance;
}

export function createLoggerConfigService(config?: Partial<LoggerConfig>): LoggerConfigService {
  return new LoggerConfigService(config);
}
