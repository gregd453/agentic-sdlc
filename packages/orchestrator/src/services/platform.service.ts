/**
 * Platform Service - Handles platform CRUD operations
 *
 * Responsibilities:
 * - Create new platforms
 * - Update existing platforms
 * - Delete platforms (with cascade handling)
 * - Validate platform data
 * - Update platform registry after database changes
 */

import { PrismaClient, PlatformLayer } from '@prisma/client'
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
}
