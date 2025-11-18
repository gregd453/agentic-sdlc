import { WORKFLOW_TYPES } from '@agentic-sdlc/shared-types';
/**
 * PlatformLoader Service - Loads and caches platform definitions
 *
 * Responsibilities:
 * - Load platforms from database with optional caching
 * - Handle platform not found errors gracefully
 * - Support platform cache invalidation for testing
 * - Maintain backward compatibility with legacy platform
 */

import { PrismaClient, PlatformLayer } from '@prisma/client'

export interface PlatformData {
  id: string
  name: string
  layer: PlatformLayer
  description?: string | null
  config?: any
  enabled: boolean
  created_at: Date
  updated_at: Date
}

export class PlatformLoaderService {
  private platformCache: Map<string, PlatformData> = new Map()
  private cacheEnabled: boolean = true
  private cacheTTL: number = 5 * 60 * 1000 // 5 minutes
  private cacheTimestamps: Map<string, number> = new Map()

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Load a platform by ID with caching
   */
  async loadPlatformById(platformId: string): Promise<PlatformData | null> {
    if (this.cacheEnabled && this.isCacheValid(platformId)) {
      return this.platformCache.get(platformId) || null
    }

    const platform = await this.prisma.platform.findUnique({
      where: { id: platformId }
    })

    if (platform) {
      this.setCache(platformId, platform)
    }

    return platform || null
  }

  /**
   * Load a platform by name with caching
   */
  async loadPlatformByName(name: string): Promise<PlatformData | null> {
    // Check cache by name
    const cached = Array.from(this.platformCache.values()).find(
      p => p.name === name && this.isCacheValid(p.id)
    )
    if (cached) {
      return cached
    }

    const platform = await this.prisma.platform.findUnique({
      where: { name }
    })

    if (platform) {
      this.setCache(platform.id, platform)
    }

    return platform || null
  }

  /**
   * Load all platforms with optional filtering
   */
  async loadAllPlatforms(enabled?: boolean): Promise<PlatformData[]> {
    const platforms = await this.prisma.platform.findMany({
      where: enabled !== undefined ? { enabled } : undefined,
      orderBy: { created_at: 'desc' }
    })

    // Cache all loaded platforms
    platforms.forEach(p => this.setCache(p.id, p))

    return platforms
  }

  /**
   * Load platforms by layer
   */
  async loadPlatformsByLayer(layer: PlatformLayer): Promise<PlatformData[]> {
    const platforms = await this.prisma.platform.findMany({
      where: { layer, enabled: true },
      orderBy: { created_at: 'desc' }
    })

    platforms.forEach(p => this.setCache(p.id, p))
    return platforms
  }

  /**
   * Get legacy platform (creates it if doesn't exist)
   */
  async getLegacyPlatform(): Promise<PlatformData> {
    const name = 'legacy'
    let platform = await this.loadPlatformByName(name)

    if (!platform) {
      platform = await this.prisma.platform.create({
        data: {
          name,
          layer: PlatformLayer.APPLICATION,
          description: 'Legacy platform for backward compatibility',
          config: {
            legacyWorkflowTypes: [WORKFLOW_TYPES.APP, WORKFLOW_TYPES.FEATURE, WORKFLOW_TYPES.BUGFIX],
            legacyStages: [AGENT_TYPES.SCAFFOLD, AGENT_TYPES.VALIDATION, 'e2e_testing', AGENT_TYPES.INTEGRATION]
          },
          enabled: true
        }
      })

      this.setCache(platform.id, platform)
    }

    return platform
  }

  /**
   * Invalidate cache for a platform
   */
  invalidateCache(platformId?: string): void {
    if (platformId) {
      this.platformCache.delete(platformId)
      this.cacheTimestamps.delete(platformId)
    } else {
      this.platformCache.clear()
      this.cacheTimestamps.clear()
    }
  }

  /**
   * Enable/disable caching
   */
  setCachingEnabled(enabled: boolean): void {
    this.cacheEnabled = enabled
    if (!enabled) {
      this.invalidateCache()
    }
  }

  /**
   * Set cache TTL in milliseconds
   */
  setCacheTTL(ttl: number): void {
    this.cacheTTL = ttl
  }

  // Private helper methods

  private setCache(id: string, platform: PlatformData): void {
    if (!this.cacheEnabled) return

    this.platformCache.set(id, platform)
    this.cacheTimestamps.set(id, Date.now())
  }

  private isCacheValid(id: string): boolean {
    if (!this.cacheEnabled || !this.platformCache.has(id)) {
      return false
    }

    const timestamp = this.cacheTimestamps.get(id)
    if (!timestamp) return false

    return Date.now() - timestamp < this.cacheTTL
  }
}
