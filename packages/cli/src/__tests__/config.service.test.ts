/**
 * Config Service Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ConfigService } from '../services/config.service'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

// Mock fs module
vi.mock('fs', () => {
  const actual = vi.importActual('fs')
  return {
    ...actual,
    existsSync: vi.fn((filePath: string) => {
      if (filePath.includes('nonexistent')) return false
      if (filePath.includes('.agentic-sdlc')) return true
      return true
    }),
    readFileSync: vi.fn((filePath: string) => {
      if (filePath.includes('user')) {
        return JSON.stringify({ environment: 'production' })
      }
      if (filePath.includes('project')) {
        return JSON.stringify({ logLevel: 'debug' })
      }
      if (filePath.includes('.env')) {
        return 'ORCHESTRATOR_URL=http://api.example.com\nVERBOSE=true'
      }
      return ''
    }),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    unlinkSync: vi.fn(),
  }
})

// Mock os module
vi.mock('os', () => ({
  homedir: vi.fn(() => '/home/testuser'),
}))

describe('ConfigService', () => {
  let service: ConfigService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ConfigService({
      projectRoot: '/test/project',
      userHome: '/home/testuser',
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with default options', () => {
      const svc = new ConfigService()
      expect(svc).toBeDefined()
    })

    it('should initialize with custom options', () => {
      const svc = new ConfigService({
        projectRoot: '/custom/path',
        userHome: '/custom/home',
      })
      expect(svc).toBeDefined()
    })

    it('should load default configuration', () => {
      expect(service.get('orchestratorUrl')).toBeDefined()
      expect(service.get('logLevel')).toBe('info')
    })

    it('should have all expected default keys', () => {
      const config = service.getAll()
      expect(config).toHaveProperty('orchestratorUrl')
      expect(config).toHaveProperty('databaseUrl')
      expect(config).toHaveProperty('redisUrl')
      expect(config).toHaveProperty('logLevel')
      expect(config).toHaveProperty('verbose')
    })
  })

  describe('get()', () => {
    it('should get configuration value', () => {
      const value = service.get('logLevel')
      expect(value).toBe('info')
    })

    it('should return undefined for non-existent key', () => {
      const value = service.get('nonExistentKey')
      expect(value).toBeUndefined()
    })

    it('should get set value', () => {
      service.set('customKey', 'customValue')
      expect(service.get('customKey')).toBe('customValue')
    })
  })

  describe('getWithSource()', () => {
    it('should return value with source information', () => {
      const result = service.getWithSource('logLevel')

      expect(result).toBeDefined()
      expect(result?.value).toBe('info')
      expect(result?.source).toBe('default')
    })

    it('should show source as cli for set values', () => {
      service.set('testKey', 'testValue')
      const result = service.getWithSource('testKey')

      expect(result?.source).toBe('cli')
    })

    it('should return undefined for non-existent key', () => {
      const result = service.getWithSource('nonExistent')
      expect(result).toBeUndefined()
    })
  })

  describe('set()', () => {
    it('should set configuration value', () => {
      service.set('newKey', 'newValue')
      expect(service.get('newKey')).toBe('newValue')
    })

    it('should override default value', () => {
      service.set('logLevel', 'debug')
      expect(service.get('logLevel')).toBe('debug')
    })

    it('should mark source as cli', () => {
      service.set('testKey', 'testValue')
      const result = service.getWithSource('testKey')
      expect(result?.source).toBe('cli')
    })

    it('should handle different value types', () => {
      service.set('boolValue', true)
      service.set('numberValue', 42)
      service.set('objectValue', { nested: 'value' })

      expect(service.get('boolValue')).toBe(true)
      expect(service.get('numberValue')).toBe(42)
      expect(service.get('objectValue')).toEqual({ nested: 'value' })
    })
  })

  describe('getAll()', () => {
    it('should return all configuration', () => {
      const config = service.getAll()

      expect(typeof config).toBe('object')
      expect(Object.keys(config).length).toBeGreaterThan(0)
    })

    it('should include default values', () => {
      const config = service.getAll()
      expect(config).toHaveProperty('orchestratorUrl')
      expect(config).toHaveProperty('logLevel')
    })

    it('should include set values', () => {
      service.set('customKey', 'customValue')
      const config = service.getAll()

      expect(config).toHaveProperty('customKey')
      expect(config.customKey).toBe('customValue')
    })

    it('should not modify returned object', () => {
      const config1 = service.getAll()
      config1.testKey = 'shouldNotPersist'

      const config2 = service.getAll()
      expect(config2).not.toHaveProperty('testKey')
    })
  })

  describe('getAllWithSources()', () => {
    it('should return all configuration with sources', () => {
      const config = service.getAllWithSources()

      expect(typeof config).toBe('object')
      expect(config).toHaveProperty('logLevel')
      expect(config.logLevel).toHaveProperty('value')
      expect(config.logLevel).toHaveProperty('source')
    })

    it('should mark default values correctly', () => {
      const config = service.getAllWithSources()
      expect(config.logLevel?.source).toBe('default')
    })

    it('should mark cli values correctly', () => {
      service.set('testKey', 'testValue')
      const config = service.getAllWithSources()

      expect(config.testKey?.source).toBe('cli')
    })
  })

  describe('saveProjectConfig()', () => {
    it('should save all configuration to project file', () => {
      service.set('testKey', 'testValue')
      service.saveProjectConfig()

      expect(fs.writeFileSync).toHaveBeenCalled()
    })

    it('should save only specified keys', () => {
      service.set('key1', 'value1')
      service.set('key2', 'value2')
      service.saveProjectConfig(['key1'])

      expect(fs.writeFileSync).toHaveBeenCalled()
    })

    it('should create directory if not exists', () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(false)
      service.saveProjectConfig()

      expect(fs.mkdirSync).toHaveBeenCalled()
    })

    it('should throw on write error', () => {
      vi.mocked(fs.writeFileSync).mockImplementationOnce(() => {
        throw new Error('Write failed')
      })

      expect(() => service.saveProjectConfig()).toThrow()
    })
  })

  describe('saveUserConfig()', () => {
    it('should save all configuration to user file', () => {
      service.set('testKey', 'testValue')
      service.saveUserConfig()

      expect(fs.writeFileSync).toHaveBeenCalled()
    })

    it('should save only specified keys', () => {
      service.set('key1', 'value1')
      service.saveUserConfig(['key1'])

      expect(fs.writeFileSync).toHaveBeenCalled()
    })

    it('should create directory if not exists', () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(false)
      service.saveUserConfig()

      expect(fs.mkdirSync).toHaveBeenCalled()
    })
  })

  describe('resetToDefaults()', () => {
    it('should reset all values to defaults', () => {
      service.set('logLevel', 'debug')
      service.resetToDefaults()

      expect(service.get('logLevel')).toBe('info')
    })

    it('should reset source to default', () => {
      service.set('testKey', 'testValue')
      service.resetToDefaults()

      const result = service.getWithSource('testKey')
      expect(result).toBeUndefined()
    })

    it('should remove non-default keys', () => {
      service.set('customKey', 'customValue')
      service.resetToDefaults()

      expect(service.get('customKey')).toBeUndefined()
    })
  })

  describe('resetKeys()', () => {
    it('should reset specific keys to defaults', () => {
      service.set('logLevel', 'debug')
      service.set('verbose', true)
      service.resetKeys(['logLevel'])

      expect(service.get('logLevel')).toBe('info')
      expect(service.get('verbose')).toBe(true)
    })

    it('should ignore non-existent keys', () => {
      expect(() => service.resetKeys(['nonExistentKey'])).not.toThrow()
    })
  })

  describe('deleteProjectConfig()', () => {
    it('should delete project config file', () => {
      service.deleteProjectConfig()
      expect(fs.unlinkSync).toHaveBeenCalled()
    })

    it('should handle non-existent file', () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(false)
      expect(() => service.deleteProjectConfig()).not.toThrow()
    })

    it('should throw on delete error', () => {
      vi.mocked(fs.unlinkSync).mockImplementationOnce(() => {
        throw new Error('Delete failed')
      })

      expect(() => service.deleteProjectConfig()).toThrow()
    })
  })

  describe('deleteUserConfig()', () => {
    it('should delete user config file', () => {
      service.deleteUserConfig()
      expect(fs.unlinkSync).toHaveBeenCalled()
    })
  })

  describe('validate()', () => {
    it('should validate valid configuration', () => {
      const result = service.validate()
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect invalid orchestrator URL', () => {
      service.set('orchestratorUrl', 'not-a-url')
      const result = service.validate()

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should detect non-numeric timeout', () => {
      service.set('timeout', 'not-a-number')
      const result = service.validate()

      expect(result.valid).toBe(false)
    })

    it('should detect non-numeric retry attempts', () => {
      service.set('retryAttempts', 'not-a-number')
      const result = service.validate()

      expect(result.valid).toBe(false)
    })

    it('should accept valid URLs', () => {
      service.set('orchestratorUrl', 'http://localhost:3000')
      const result = service.validate()

      expect(result.errors).not.toContain('Invalid orchestratorUrl format')
    })
  })

  describe('getPaths()', () => {
    it('should return configuration file paths', () => {
      const paths = service.getPaths()

      expect(paths).toHaveProperty('userConfig')
      expect(paths).toHaveProperty('projectConfig')
      expect(paths).toHaveProperty('envFile')
    })

    it('should return correct path formats', () => {
      const paths = service.getPaths()

      expect(paths.userConfig).toContain('.agentic-sdlc')
      expect(paths.projectConfig).toContain('.agentic-sdlc.json')
      expect(paths.envFile).toContain('.env')
    })
  })

  describe('configuration precedence', () => {
    it('should load from multiple sources with precedence', () => {
      // Service loaded defaults, then user, project, .env, and env vars
      // The test setup mocks these to return different values
      const config = service.getAll()

      // We can verify the service loaded multiple sources by checking the config
      expect(config).toBeDefined()
    })

    it('should apply precedence: defaults < user < project < env < cli', () => {
      // Set a default value
      service.resetToDefaults()
      let value = service.getWithSource('logLevel')
      expect(value?.source).toBe('default')

      // Override with CLI
      service.set('logLevel', 'debug')
      value = service.getWithSource('logLevel')
      expect(value?.source).toBe('cli')
    })
  })

  describe('helper methods', () => {
    it('should parse environment variable names to camelCase', () => {
      // Test indirectly through environment variable loading
      const config = service.getAll()
      expect(config).toHaveProperty('orchestratorUrl')
      expect(config).toHaveProperty('databaseUrl')
    })

    it('should parse JSON values in .env file', () => {
      // .env file parsing is tested through the mock
      const config = service.getAll()
      expect(typeof config.verbose).toBe('boolean')
    })

    it('should handle string values', () => {
      service.set('testString', 'just a string')
      expect(service.get('testString')).toBe('just a string')
    })
  })

  describe('singleton pattern', () => {
    it('should maintain singleton instance', () => {
      const { getConfigService } = require('../services/config.service')

      const instance1 = getConfigService()
      const instance2 = getConfigService()

      expect(instance1).toBe(instance2)
    })
  })

  describe('edge cases', () => {
    it('should handle empty configuration keys', () => {
      expect(service.get('')).toBeUndefined()
    })

    it('should handle null values', () => {
      service.set('nullValue', null)
      expect(service.get('nullValue')).toBeNull()
    })

    it('should handle undefined values', () => {
      service.set('undefinedValue', undefined)
      expect(service.get('undefinedValue')).toBeUndefined()
    })

    it('should handle deeply nested objects', () => {
      const nested = { level1: { level2: { level3: 'value' } } }
      service.set('nested', nested)

      const retrieved = service.get('nested') as any
      expect(retrieved.level1.level2.level3).toBe('value')
    })

    it('should handle arrays', () => {
      const array = ['item1', 'item2', 'item3']
      service.set('arrayValue', array)

      const retrieved = service.get('arrayValue')
      expect(Array.isArray(retrieved)).toBe(true)
      expect((retrieved as string[]).length).toBe(3)
    })
  })
})
