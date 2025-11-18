/**
 * Configuration Service - Manage CLI configuration
 * Supports multiple config sources with precedence
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { logger } from '../utils/logger.js'

export interface ConfigValue {
  value: unknown
  source: 'default' | 'user' | 'project' | 'env' | 'cli'
}

export interface ConfigOptions {
  projectRoot?: string
  userHome?: string
  verbose?: boolean
}

export class ConfigService {
  private projectRoot: string
  private userHome: string
  private userConfigPath: string
  private projectConfigPath: string
  private envConfigPath: string
  private config: Record<string, unknown> = {}
  private configSources: Record<string, 'default' | 'user' | 'project' | 'env' | 'cli'> = {}
  private defaults: Record<string, unknown>

  constructor(options: ConfigOptions = {}) {
    this.projectRoot = options.projectRoot || process.cwd()
    this.userHome = options.userHome || os.homedir()

    this.userConfigPath = path.join(this.userHome, '.agentic-sdlc', 'config.json')
    this.projectConfigPath = path.join(this.projectRoot, '.agentic-sdlc.json')
    this.envConfigPath = path.join(this.projectRoot, '.env')

    // Default configuration
    this.defaults = {
      orchestratorUrl: 'http://localhost:3000',
      databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost/agentic-sdlc',
      redisUrl: 'redis://localhost:6380',
      logLevel: LOG_LEVEL.INFO,
      verbose: false,
      timeout: 30000,
      retryAttempts: 3,
      retryBackoff: 1000,
      environment: 'development',
      apiKey: '',
      region: 'us-east-1',
      outputFormat: 'text',
      colorOutput: true,
      dashboardUrl: 'http://localhost:3001',
      analyticsUrl: 'http://localhost:3002',
    }

    this.loadConfiguration()

    logger.debug('ConfigService initialized', {
      projectRoot: this.projectRoot,
      userHome: this.userHome,
      loadedKeys: Object.keys(this.config).length,
    })
  }

  /**
   * Load configuration from all sources with precedence
   * Precedence (highest to lowest):
   * 1. Environment variables
   * 2. .env file
   * 3. Project config (.agentic-sdlc.json)
   * 4. User config (~/.agentic-sdlc/config.json)
   * 5. Default values
   */
  private loadConfiguration(): void {
    // Start with defaults
    this.config = { ...this.defaults }
    Object.keys(this.defaults).forEach(key => {
      this.configSources[key] = 'default'
    })

    // Load user config
    this.loadConfigFile(this.userConfigPath, 'user')

    // Load project config
    this.loadConfigFile(this.projectConfigPath, 'project')

    // Load .env file
    this.loadEnvFile()

    // Load environment variables (highest precedence)
    this.loadEnvironmentVariables()
  }

  /**
   * Load configuration from JSON file
   */
  private loadConfigFile(
    filePath: string,
    source: 'user' | 'project'
  ): void {
    try {
      if (!fs.existsSync(filePath)) {
        logger.debug(`Config file not found: ${filePath}`)
        return
      }

      const content = fs.readFileSync(filePath, 'utf-8')
      const config = JSON.parse(content)

      Object.entries(config).forEach(([key, value]) => {
        this.config[key] = value
        this.configSources[key] = source
      })

      logger.debug(`Loaded config from ${source}: ${filePath}`, {
        keys: Object.keys(config).length,
      })
    } catch (error) {
      logger.warn(`Failed to load config file: ${filePath}`, {
        error: (error as Error).message,
      })
    }
  }

  /**
   * Load configuration from .env file
   */
  private loadEnvFile(): void {
    try {
      if (!fs.existsSync(this.envConfigPath)) {
        return
      }

      const content = fs.readFileSync(this.envConfigPath, 'utf-8')
      const lines = content.split('\n')

      for (const line of lines) {
        if (!line.trim() || line.startsWith('#')) {
          continue
        }

        const [key, ...valueParts] = line.split('=')
        const envKey = key.trim()
        const value = valueParts.join('=').trim()

        if (!envKey) {
          continue
        }

        // Map .env key to config key (e.g., ORCHESTRATOR_URL -> orchestratorUrl)
        const configKey = this.camelCaseFromEnv(envKey)

        if (configKey in this.defaults || configKey in this.config) {
          this.config[configKey] = this.parseValue(value)
          this.configSources[configKey] = 'env'
        }
      }

      logger.debug('Loaded configuration from .env file')
    } catch (error) {
      logger.warn('Failed to load .env file', {
        error: (error as Error).message,
      })
    }
  }

  /**
   * Load configuration from environment variables
   */
  private loadEnvironmentVariables(): void {
    const envKeyMap: Record<string, string> = {
      ORCHESTRATOR_URL: 'orchestratorUrl',
      DATABASE_URL: 'databaseUrl',
      REDIS_URL: 'redisUrl',
      LOG_LEVEL: 'logLevel',
      VERBOSE: 'verbose',
      TIMEOUT: 'timeout',
      ENVIRONMENT: 'environment',
      API_KEY: 'apiKey',
      REGION: 'region',
      OUTPUT_FORMAT: 'outputFormat',
      DASHBOARD_URL: 'dashboardUrl',
      ANALYTICS_URL: 'analyticsUrl',
    }

    Object.entries(envKeyMap).forEach(([envKey, configKey]) => {
      const value = process.env[envKey]
      if (value !== undefined) {
        this.config[configKey] = this.parseValue(value)
        this.configSources[configKey] = 'cli'
      }
    })

    logger.debug('Loaded configuration from environment variables')
  }

  /**
   * Get configuration value
   */
  get(key: string): unknown {
    if (key in this.config) {
      return this.config[key]
    }
    return undefined
  }

  /**
   * Get configuration value with source information
   */
  getWithSource(key: string): ConfigValue | undefined {
    if (key in this.config) {
      return {
        value: this.config[key],
        source: this.configSources[key] || 'default',
      }
    }
    return undefined
  }

  /**
   * Set configuration value
   */
  set(key: string, value: unknown): void {
    this.config[key] = value
    this.configSources[key] = 'cli'
    logger.debug(`Set configuration: ${key} = ${JSON.stringify(value)}`)
  }

  /**
   * Get all configuration
   */
  getAll(): Record<string, unknown> {
    return { ...this.config }
  }

  /**
   * Get all configuration with sources
   */
  getAllWithSources(): Record<string, ConfigValue> {
    const result: Record<string, ConfigValue> = {}
    Object.entries(this.config).forEach(([key, value]) => {
      result[key] = {
        value,
        source: this.configSources[key] || 'default',
      }
    })
    return result
  }

  /**
   * Save configuration to project config file
   */
  saveProjectConfig(keys?: string[]): void {
    try {
      const configDir = path.dirname(this.projectConfigPath)
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true })
      }

      const configToSave: Record<string, unknown> = {}

      if (keys) {
        // Save only specified keys
        keys.forEach(key => {
          if (key in this.config) {
            configToSave[key] = this.config[key]
          }
        })
      } else {
        // Save all non-default values
        Object.entries(this.config).forEach(([key, value]) => {
          if (JSON.stringify(value) !== JSON.stringify(this.defaults[key])) {
            configToSave[key] = value
          }
        })
      }

      fs.writeFileSync(this.projectConfigPath, JSON.stringify(configToSave, null, 2))
      logger.info(`Saved project configuration to ${this.projectConfigPath}`)
    } catch (error) {
      logger.error('Failed to save project configuration', (error as Error).message)
      throw error
    }
  }

  /**
   * Save configuration to user config file
   */
  saveUserConfig(keys?: string[]): void {
    try {
      const configDir = path.dirname(this.userConfigPath)
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true })
      }

      const configToSave: Record<string, unknown> = {}

      if (keys) {
        // Save only specified keys
        keys.forEach(key => {
          if (key in this.config) {
            configToSave[key] = this.config[key]
          }
        })
      } else {
        // Save all non-default values
        Object.entries(this.config).forEach(([key, value]) => {
          if (JSON.stringify(value) !== JSON.stringify(this.defaults[key])) {
            configToSave[key] = value
          }
        })
      }

      fs.writeFileSync(this.userConfigPath, JSON.stringify(configToSave, null, 2))
      logger.info(`Saved user configuration to ${this.userConfigPath}`)
    } catch (error) {
      logger.error('Failed to save user configuration', (error as Error).message)
      throw error
    }
  }

  /**
   * Reset configuration to defaults
   */
  resetToDefaults(): void {
    this.config = { ...this.defaults }
    Object.keys(this.defaults).forEach(key => {
      this.configSources[key] = 'default'
    })
    logger.info('Configuration reset to defaults')
  }

  /**
   * Reset specific configuration keys to defaults
   */
  resetKeys(keys: string[]): void {
    keys.forEach(key => {
      if (key in this.defaults) {
        this.config[key] = this.defaults[key]
        this.configSources[key] = 'default'
      }
    })
    logger.info(`Reset configuration keys: ${keys.join(', ')}`)
  }

  /**
   * Delete configuration file
   */
  deleteProjectConfig(): void {
    try {
      if (fs.existsSync(this.projectConfigPath)) {
        fs.unlinkSync(this.projectConfigPath)
        logger.info(`Deleted project configuration: ${this.projectConfigPath}`)
      }
    } catch (error) {
      logger.error('Failed to delete project configuration', (error as Error).message)
      throw error
    }
  }

  /**
   * Delete user configuration file
   */
  deleteUserConfig(): void {
    try {
      if (fs.existsSync(this.userConfigPath)) {
        fs.unlinkSync(this.userConfigPath)
        logger.info(`Deleted user configuration: ${this.userConfigPath}`)
      }
    } catch (error) {
      logger.error('Failed to delete user configuration', (error as Error).message)
      throw error
    }
  }

  /**
   * Validate configuration
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // Validate orchestrator URL
    if (this.config.orchestratorUrl) {
      try {
        new URL(this.config.orchestratorUrl as string)
      } catch {
        errors.push('Invalid orchestratorUrl format')
      }
    }

    // Validate timeout
    if (this.config.timeout && typeof this.config.timeout !== 'number') {
      errors.push('timeout must be a number')
    }

    // Validate retry attempts
    if (this.config.retryAttempts && typeof this.config.retryAttempts !== 'number') {
      errors.push('retryAttempts must be a number')
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Private helper methods
   */

  private camelCaseFromEnv(envKey: string): string {
    // Convert ORCHESTRATOR_URL to orchestratorUrl
    return envKey
      .toLowerCase()
      .split('_')
      .map((word, index) => {
        if (index === 0) return word
        return word.charAt(0).toUpperCase() + word.slice(1)
      })
      .join('')
  }

  private parseValue(value: string): unknown {
    // Try to parse as JSON first
    if (value === 'true') return true
    if (value === 'false') return false
    if (value === 'null') return null
    if (!isNaN(Number(value))) return Number(value)

    // Try JSON parsing
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }

  /**
   * Get configuration file paths
   */
  getPaths(): {
    userConfig: string
    projectConfig: string
    envFile: string
  } {
    return {
      userConfig: this.userConfigPath,
      projectConfig: this.projectConfigPath,
      envFile: this.envConfigPath,
    }
  }
}

/**
 * Singleton instance
 */
let configServiceInstance: ConfigService | null = null

export function initializeConfigService(options: ConfigOptions = {}): ConfigService {
  configServiceInstance = new ConfigService(options)
  return configServiceInstance
}

export function getConfigService(): ConfigService {
  if (!configServiceInstance) {
    configServiceInstance = new ConfigService()
  }
  return configServiceInstance
}

export const configService = getConfigService()
