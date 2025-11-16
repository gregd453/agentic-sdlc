/**
 * Seed Platforms Service - Initializes platform and surface data
 *
 * Responsibilities:
 * - Seed platform definitions into the database
 * - Create surfaces for each platform
 * - Handle idempotent seeding (don't duplicate on re-runs)
 */

import { PrismaClient } from '@prisma/client'
import { logger } from '../utils/logger'
import { platformDefinitions, surfaceDefinitions } from '../data/platform-definitions'

export class SeedPlatformsService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Seed all platforms and their surfaces
   */
  async seedPlatforms(): Promise<void> {
    logger.info('[SeedPlatforms] Starting platform seeding...')

    try {
      // Seed legacy platform first (most important for backward compatibility)
      await this.seedPlatform('legacy', platformDefinitions.legacy)

      // Seed other platforms (currently disabled, but definitions ready)
      await this.seedPlatform('webApps', platformDefinitions.webApps)
      await this.seedPlatform('dataPipelines', platformDefinitions.dataPipelines)
      await this.seedPlatform('infrastructure', platformDefinitions.infrastructure)

      logger.info('[SeedPlatforms] Platform seeding complete')
    } catch (error) {
      logger.error('[SeedPlatforms] Seeding failed', error)
      throw error
    }
  }

  /**
   * Seed a single platform with its surfaces
   */
  private async seedPlatform(key: string, definition: any): Promise<void> {
    try {
      // Check if platform already exists
      let platform = await this.prisma.platform.findUnique({
        where: { name: definition.name }
      })

      if (platform) {
        logger.info(`[SeedPlatforms] Platform '${definition.name}' already exists, skipping`)
        return
      }

      // Create the platform
      platform = await this.prisma.platform.create({
        data: {
          name: definition.name,
          layer: definition.layer,
          description: definition.description,
          config: definition.config,
          enabled: definition.enabled
        }
      })

      logger.info(`[SeedPlatforms] Created platform: ${platform.name}`)

      // Seed surfaces for this platform
      await this.seedSurfacesForPlatform(platform.id, definition.config?.supportedSurfaces || [])
    } catch (error) {
      logger.error(`[SeedPlatforms] Failed to seed platform '${definition.name}'`, error)
      throw error
    }
  }

  /**
   * Seed surfaces for a platform
   */
  private async seedSurfacesForPlatform(platformId: string, surfaceTypes: string[]): Promise<void> {
    for (const surfaceType of surfaceTypes) {
      try {
        // Check if surface already exists for this platform
        const existing = await this.prisma.platformSurface.findUnique({
          where: {
            platform_id_surface_type: {
              platform_id: platformId,
              surface_type: surfaceType as any
            }
          }
        })

        if (existing) {
          logger.info(`[SeedPlatforms] Surface '${surfaceType}' already exists for platform`)
          continue
        }

        // Get surface definition
        const surfaceKey = Object.keys(surfaceDefinitions).find(
          key => (surfaceDefinitions as any)[key].surfaceType === surfaceType
        )

        const surfaceConfig = surfaceKey ? (surfaceDefinitions as any)[surfaceKey] : {}

        // Create the surface
        await this.prisma.platformSurface.create({
          data: {
            platform_id: platformId,
            surface_type: surfaceType as any,
            config: surfaceConfig.config || {},
            enabled: surfaceConfig.enabled ?? true
          }
        })

        logger.info(`[SeedPlatforms] Created surface '${surfaceType}' for platform`)
      } catch (error) {
        logger.error(`[SeedPlatforms] Failed to seed surface '${surfaceType}'`, error)
        throw error
      }
    }
  }

  /**
   * Clean and re-seed platforms (for testing/development)
   */
  async resetAndSeed(): Promise<void> {
    logger.info('[SeedPlatforms] Resetting platforms for testing...')

    try {
      // Delete all platforms (cascades to surfaces and workflows)
      await this.prisma.platform.deleteMany({})

      logger.info('[SeedPlatforms] Deleted all platforms')

      // Re-seed
      await this.seedPlatforms()
    } catch (error) {
      logger.error('[SeedPlatforms] Reset and seed failed', error)
      throw error
    }
  }

  /**
   * Get seeding statistics
   */
  async getStats(): Promise<{
    platformsCount: number
    surfacesCount: number
    enabledPlatforms: number
  }> {
    const [platformsCount, surfacesCount, enabledCount] = await Promise.all([
      this.prisma.platform.count(),
      this.prisma.platformSurface.count(),
      this.prisma.platform.count({ where: { enabled: true } })
    ])

    return {
      platformsCount,
      surfacesCount,
      enabledPlatforms: enabledCount
    }
  }
}
