import { describe, it, expect, beforeEach } from 'vitest'
import { PlatformRegistryService } from '../../services/platform-registry.service'
import { PlatformLoaderService } from '../../services/platform-loader.service'

/**
 * Unit Tests for Platform Services
 *
 * Tests platform registry and loader functionality in isolation.
 * These tests focus on:
 * - Registry operations (register, get, update, unregister)
 * - Platform lookup by ID and name
 * - Caching behavior
 * - Layer-based filtering
 */
describe('Platform Services Unit Tests', () => {
  describe('PlatformRegistryService', () => {
    let registry: PlatformRegistryService
    let platformLoader: PlatformLoaderService

    beforeEach(() => {
      // Mock platform loader
      const mockLoader = {
        loadAllPlatforms: async () => [
          {
            id: 'platform-1',
            name: 'web-apps',
            layer: 'APPLICATION',
            description: 'Web application platform',
            enabled: true,
            created_at: new Date(),
            updated_at: new Date(),
            config: {}
          },
          {
            id: 'platform-2',
            name: 'data-pipelines',
            layer: 'DATA',
            description: 'Data pipeline platform',
            enabled: true,
            created_at: new Date(),
            updated_at: new Date(),
            config: {}
          },
          {
            id: 'platform-3',
            name: 'infrastructure',
            layer: 'INFRASTRUCTURE',
            description: 'Infrastructure platform',
            enabled: true,
            created_at: new Date(),
            updated_at: new Date(),
            config: {}
          }
        ]
      } as any

      platformLoader = mockLoader
      registry = new PlatformRegistryService(platformLoader)
    })

    it('should register platforms on initialization', async () => {
      await registry.initialize()

      const platforms = registry.getAllPlatforms()
      expect(platforms.length).toBe(3)
      expect(platforms[0].platform.name).toBe('web-apps')
    })

    it('should look up platform by ID', async () => {
      await registry.initialize()

      const platform = registry.getPlatformById('platform-1')
      expect(platform).toBeDefined()
      expect(platform?.platform.name).toBe('web-apps')
    })

    it('should look up platform by name', async () => {
      await registry.initialize()

      const platform = registry.getPlatformByName('data-pipelines')
      expect(platform).toBeDefined()
      expect(platform?.platform.id).toBe('platform-2')
    })

    it('should return undefined for non-existent platform', async () => {
      await registry.initialize()

      const platform = registry.getPlatformById('non-existent')
      expect(platform).toBeUndefined()
    })

    it('should filter platforms by layer', async () => {
      await registry.initialize()

      const appPlatforms = registry.getPlatformsByLayer('APPLICATION')
      expect(appPlatforms.length).toBe(1)
      expect(appPlatforms[0].platform.name).toBe('web-apps')

      const dataPlatforms = registry.getPlatformsByLayer('DATA')
      expect(dataPlatforms.length).toBe(1)
      expect(dataPlatforms[0].platform.name).toBe('data-pipelines')
    })

    it('should check if platform is registered', async () => {
      await registry.initialize()

      expect(registry.hasPlatform('platform-1')).toBe(true)
      expect(registry.hasPlatform('non-existent')).toBe(false)
    })

    it('should register new platform dynamically', async () => {
      await registry.initialize()

      registry.registerPlatform(
        {
          id: 'platform-4',
          name: 'mobile-apps',
          layer: 'APPLICATION',
          description: 'Mobile app platform',
          enabled: true,
          created_at: new Date(),
          updated_at: new Date(),
          config: {}
        },
        { custom: 'metadata' }
      )

      const platform = registry.getPlatformById('platform-4')
      expect(platform).toBeDefined()
      expect(platform?.platform.name).toBe('mobile-apps')
      expect(platform?.metadata?.custom).toBe('metadata')
    })

    it('should update existing platform', async () => {
      await registry.initialize()

      registry.updatePlatform('platform-1', {
        description: 'Updated description'
      })

      const platform = registry.getPlatformById('platform-1')
      expect(platform?.platform.description).toBe('Updated description')
    })

    it('should unregister platform', async () => {
      await registry.initialize()

      const removed = registry.unregisterPlatform('platform-1')
      expect(removed).toBe(true)
      expect(registry.hasPlatform('platform-1')).toBe(false)

      const platform = registry.getPlatformById('platform-1')
      expect(platform).toBeUndefined()
    })

    it('should return false when unregistering non-existent platform', async () => {
      await registry.initialize()

      const removed = registry.unregisterPlatform('non-existent')
      expect(removed).toBe(false)
    })

    it('should return registry statistics', async () => {
      await registry.initialize()

      const stats = registry.getStats()
      expect(stats.total).toBe(3)
      expect(stats.enabled).toBe(3)
      expect(stats.byLayer).toEqual({
        APPLICATION: 1,
        DATA: 1,
        INFRASTRUCTURE: 1
      })
    })

    it('should support refresh from database', async () => {
      await registry.initialize()
      expect(registry.size()).toBe(3)

      await registry.refresh()
      expect(registry.size()).toBe(3)
    })
  })

  describe('Platform Registry - Name Indexing', () => {
    let registry: PlatformRegistryService

    beforeEach(async () => {
      const mockLoader = {
        loadAllPlatforms: async () => [
          {
            id: 'platform-1',
            name: 'web-apps',
            layer: 'APPLICATION',
            description: 'Web application platform',
            enabled: true,
            created_at: new Date(),
            updated_at: new Date(),
            config: {}
          }
        ]
      } as any

      registry = new PlatformRegistryService(mockLoader)
      await registry.initialize()
    })

    it('should maintain name-to-ID index', () => {
      const platform = registry.getPlatformByName('web-apps')
      expect(platform?.platform.id).toBe('platform-1')
    })

    it('should update name index when platform name changes', () => {
      registry.updatePlatform('platform-1', { name: 'web-applications' })

      const oldName = registry.getPlatformByName('web-apps')
      expect(oldName).toBeUndefined()

      const newName = registry.getPlatformByName('web-applications')
      expect(newName?.platform.id).toBe('platform-1')
    })
  })

  describe('Platform Registry - Size and Stats', () => {
    let registry: PlatformRegistryService

    beforeEach(async () => {
      const mockLoader = {
        loadAllPlatforms: async () => [
          {
            id: 'platform-1',
            name: 'platform-1',
            layer: 'APPLICATION',
            enabled: true,
            created_at: new Date(),
            updated_at: new Date()
          },
          {
            id: 'platform-2',
            name: 'platform-2',
            layer: 'DATA',
            enabled: false,
            created_at: new Date(),
            updated_at: new Date()
          }
        ]
      } as any

      registry = new PlatformRegistryService(mockLoader)
      await registry.initialize()
    })

    it('should report correct registry size', () => {
      expect(registry.size()).toBe(2)
    })

    it('should count only enabled platforms in stats', () => {
      const stats = registry.getStats()
      expect(stats.enabled).toBe(1)
      expect(stats.total).toBe(2)
    })

    it('should provide layer distribution in stats', () => {
      const stats = registry.getStats()
      expect(stats.byLayer.APPLICATION).toBe(1)
      expect(stats.byLayer.DATA).toBe(1)
    })
  })

  describe('Platform Registry - Error Handling', () => {
    let registry: PlatformRegistryService

    beforeEach(async () => {
      const mockLoader = {
        loadAllPlatforms: async () => [
          {
            id: 'platform-1',
            name: 'platform-1',
            layer: 'APPLICATION',
            enabled: true,
            created_at: new Date(),
            updated_at: new Date()
          }
        ]
      } as any

      registry = new PlatformRegistryService(mockLoader)
      await registry.initialize()
    })

    it('should throw error when updating non-existent platform', () => {
      expect(() => {
        registry.updatePlatform('non-existent', { description: 'new' })
      }).toThrow('Platform not found')
    })
  })
})
