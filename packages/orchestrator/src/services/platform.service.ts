/**
 * Platform Service - Handles platform CRUD operations
 *
 * Responsibilities:
 * - Create new platforms
 * - Update existing platforms
 * - Delete platforms (with cascade handling)
 * - Validate platform data
 * - Update platform registry after database changes
 * - Manage platform surface bindings (Phase 4)
 */

import { PrismaClient, PlatformLayer, SurfaceType } from '@prisma/client'
import { randomUUID } from 'crypto'
import { logger } from '../utils/logger'

export interface CreatePlatformInput {
  name: string
  layer: PlatformLayer
  description?: string
  config?: Record<string, any>
  enabled?: boolean
}

export interface UpdatePlatformInput {
  name?: string
  layer?: PlatformLayer
  description?: string | null
  config?: Record<string, any>
  enabled?: boolean
}

export interface PlatformResponse {
  id: string
  name: string
  layer: string
  description?: string | null
  config?: Record<string, any>
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface PlatformSurfaceResponse {
  id: string
  platform_id: string
  surface_type: SurfaceType
  config?: Record<string, any>
  enabled: boolean
  created_at: string
  updated_at: string
}

export class PlatformService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new platform
   */
  async createPlatform(input: CreatePlatformInput): Promise<PlatformResponse> {
    // Validate input
    if (!input.name || !input.name.trim()) {
      throw new Error('Platform name is required')
    }

    if (!input.layer) {
      throw new Error('Platform layer is required')
    }

    // Check for duplicate name
    const existingPlatform = await this.prisma.platform.findUnique({
      where: { name: input.name }
    })

    if (existingPlatform) {
      throw new Error(`Platform with name "${input.name}" already exists`)
    }

    const platform = await this.prisma.platform.create({
      data: {
        id: randomUUID(),
        name: input.name.trim(),
        layer: input.layer,
        description: input.description?.trim() || null,
        config: input.config || {},
        enabled: input.enabled !== false
      }
    })

    logger.info('[PlatformService] Created platform', {
      platformId: platform.id,
      name: platform.name,
      layer: platform.layer
    })

    return this.formatResponse(platform)
  }

  /**
   * Update an existing platform
   */
  async updatePlatform(id: string, input: UpdatePlatformInput): Promise<PlatformResponse> {
    // Verify platform exists
    const existingPlatform = await this.prisma.platform.findUnique({
      where: { id }
    })

    if (!existingPlatform) {
      throw new Error(`Platform not found: ${id}`)
    }

    // Check for duplicate name if updating name
    if (input.name && input.name !== existingPlatform.name) {
      const duplicatePlatform = await this.prisma.platform.findUnique({
        where: { name: input.name }
      })

      if (duplicatePlatform) {
        throw new Error(`Platform with name "${input.name}" already exists`)
      }
    }

    const platform = await this.prisma.platform.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name.trim() }),
        ...(input.layer !== undefined && { layer: input.layer }),
        ...(input.description !== undefined && { description: input.description ? input.description.trim() : null }),
        ...(input.config !== undefined && { config: input.config }),
        ...(input.enabled !== undefined && { enabled: input.enabled })
      }
    })

    logger.info('[PlatformService] Updated platform', {
      platformId: platform.id,
      name: platform.name,
      updates: Object.keys(input)
    })

    return this.formatResponse(platform)
  }

  /**
   * Delete a platform
   * Note: Cascade behavior is handled by Prisma schema foreign key constraints
   */
  async deletePlatform(id: string): Promise<void> {
    // Verify platform exists
    const existingPlatform = await this.prisma.platform.findUnique({
      where: { id }
    })

    if (!existingPlatform) {
      throw new Error(`Platform not found: ${id}`)
    }

    // Check if platform has related workflows
    const workflowCount = await this.prisma.workflow.count({
      where: { platform_id: id }
    })

    const definitionCount = await this.prisma.workflowDefinition.count({
      where: { platform_id: id }
    })

    logger.info('[PlatformService] Deleting platform', {
      platformId: id,
      name: existingPlatform.name,
      relatedWorkflows: workflowCount,
      relatedDefinitions: definitionCount
    })

    // Delete the platform (cascading deletes handled by Prisma schema)
    await this.prisma.platform.delete({
      where: { id }
    })

    logger.info('[PlatformService] Deleted platform', {
      platformId: id,
      name: existingPlatform.name
    })
  }

  /**
   * Get platform with validation
   */
  async getPlatform(id: string): Promise<PlatformResponse | null> {
    const platform = await this.prisma.platform.findUnique({
      where: { id }
    })

    return platform ? this.formatResponse(platform) : null
  }

  /**
   * Format platform response
   */
  private formatResponse(platform: any): PlatformResponse {
    return {
      id: platform.id,
      name: platform.name,
      layer: platform.layer,
      description: platform.description,
      config: platform.config,
      enabled: platform.enabled,
      created_at: platform.created_at.toISOString(),
      updated_at: platform.updated_at.toISOString()
    }
  }

  // ==========================================
  // PHASE 4: SURFACE MANAGEMENT METHODS
  // ==========================================

  /**
   * Get all surfaces for a platform
   */
  async getPlatformSurfaces(platformId: string): Promise<PlatformSurfaceResponse[]> {
    const surfaces = await this.prisma.platformSurface.findMany({
      where: { platform_id: platformId }
    })

    return surfaces.map(surface => this.formatSurfaceResponse(surface))
  }

  /**
   * Enable/create a platform surface
   *
   * @param platformId - UUID of the platform
   * @param surfaceType - Type of surface to enable
   * @param config - Surface configuration
   * @param enabled - Whether the surface should be enabled (default: true)
   * @returns Created or updated surface
   */
  async enablePlatformSurface(
    platformId: string,
    surfaceType: SurfaceType,
    config: Record<string, any> = {},
    enabled: boolean = true
  ): Promise<PlatformSurfaceResponse> {
    // Verify platform exists
    const platform = await this.prisma.platform.findUnique({
      where: { id: platformId }
    })

    if (!platform) {
      throw new Error(`Platform not found: ${platformId}`)
    }

    // Upsert surface (create or update if exists)
    const surface = await this.prisma.platformSurface.upsert({
      where: {
        platform_id_surface_type: {
          platform_id: platformId,
          surface_type: surfaceType
        }
      },
      create: {
        id: randomUUID(),
        platform_id: platformId,
        surface_type: surfaceType,
        config,
        enabled
      },
      update: {
        config,
        enabled
      }
    })

    logger.info('[PlatformService] Enabled platform surface', {
      platformId,
      surfaceType,
      surfaceId: surface.id,
      enabled
    })

    return this.formatSurfaceResponse(surface)
  }

  /**
   * Update a platform surface
   *
   * @param platformId - UUID of the platform
   * @param surfaceType - Type of surface to update
   * @param updates - Partial updates to apply
   * @returns Updated surface
   */
  async updatePlatformSurface(
    platformId: string,
    surfaceType: SurfaceType,
    updates: { config?: Record<string, any>; enabled?: boolean }
  ): Promise<PlatformSurfaceResponse> {
    // Verify platform surface exists
    const existingSurface = await this.prisma.platformSurface.findUnique({
      where: {
        platform_id_surface_type: {
          platform_id: platformId,
          surface_type: surfaceType
        }
      }
    })

    if (!existingSurface) {
      throw new Error(
        `Surface ${surfaceType} not found for platform ${platformId}. Create it first.`
      )
    }

    const surface = await this.prisma.platformSurface.update({
      where: {
        platform_id_surface_type: {
          platform_id: platformId,
          surface_type: surfaceType
        }
      },
      data: {
        ...(updates.config !== undefined && { config: updates.config }),
        ...(updates.enabled !== undefined && { enabled: updates.enabled })
      }
    })

    logger.info('[PlatformService] Updated platform surface', {
      platformId,
      surfaceType,
      surfaceId: surface.id,
      updates: Object.keys(updates)
    })

    return this.formatSurfaceResponse(surface)
  }

  /**
   * Disable a platform surface
   *
   * @param platformId - UUID of the platform
   * @param surfaceType - Type of surface to disable
   */
  async disablePlatformSurface(
    platformId: string,
    surfaceType: SurfaceType
  ): Promise<void> {
    // Verify surface exists
    const existingSurface = await this.prisma.platformSurface.findUnique({
      where: {
        platform_id_surface_type: {
          platform_id: platformId,
          surface_type: surfaceType
        }
      }
    })

    if (!existingSurface) {
      throw new Error(
        `Surface ${surfaceType} not found for platform ${platformId}`
      )
    }

    // Set enabled to false (soft delete)
    await this.prisma.platformSurface.update({
      where: {
        platform_id_surface_type: {
          platform_id: platformId,
          surface_type: surfaceType
        }
      },
      data: {
        enabled: false
      }
    })

    logger.info('[PlatformService] Disabled platform surface', {
      platformId,
      surfaceType,
      surfaceId: existingSurface.id
    })
  }

  /**
   * Format platform surface response
   */
  private formatSurfaceResponse(surface: any): PlatformSurfaceResponse {
    return {
      id: surface.id,
      platform_id: surface.platform_id,
      surface_type: surface.surface_type,
      config: surface.config,
      enabled: surface.enabled,
      created_at: surface.created_at.toISOString(),
      updated_at: surface.updated_at.toISOString()
    }
  }
}
