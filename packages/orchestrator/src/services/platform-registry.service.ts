/**
 * PlatformRegistry Service - Maintains registry of available platforms
 *
 * Responsibilities:
 * - Maintain in-memory registry of platforms
 * - Support platform lookup by ID and name
 * - Manage platform registration and deregistration
 * - Provide fast lookups without database hits
 */

import { PlatformLoaderService, type PlatformData } from './platform-loader.service'
import { PlatformLayer } from '@prisma/client'

export interface PlatformRegistryEntry {
  platform: PlatformData
  registeredAt: Date
  metadata?: Record<string, any>
}

export class PlatformRegistryService {
  private registry: Map<string, PlatformRegistryEntry> = new Map()
  private nameIndex: Map<string, string> = new Map() // name -> id mapping

  constructor(private readonly platformLoader: PlatformLoaderService) {}

  /**
   * Initialize registry by loading all platforms
   */
  async initialize(): Promise<void> {
    console.log('[PlatformRegistryService] Starting initialization...');
    const startTime = Date.now();

    try {
      console.log('[PlatformRegistryService] Calling platformLoader.loadAllPlatforms()...');
      const platforms = await this.platformLoader.loadAllPlatforms();

      console.log(`[PlatformRegistryService] Received ${platforms.length} platforms from loader`);

      for (const platform of platforms) {
        console.log(`[PlatformRegistryService] Registering platform: ${platform.name} (${platform.id})`);
        this.registerPlatform(platform);
      }

      const elapsed = Date.now() - startTime;
      console.log(`[PlatformRegistryService] Initialization complete in ${elapsed}ms with ${this.registry.size} platforms`);
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      console.error(`[PlatformRegistryService] Initialization failed after ${elapsed}ms:`, error);
      throw error;
    }
  }

  /**
   * Get a platform by ID
   */
  getPlatformById(id: string): PlatformRegistryEntry | undefined {
    return this.registry.get(id)
  }

  /**
   * Get a platform by name
   */
  getPlatformByName(name: string): PlatformRegistryEntry | undefined {
    const id = this.nameIndex.get(name)
    return id ? this.registry.get(id) : undefined
  }

  /**
   * Get all registered platforms
   */
  getAllPlatforms(): PlatformRegistryEntry[] {
    return Array.from(this.registry.values())
  }

  /**
   * Get platforms by layer
   */
  getPlatformsByLayer(layer: PlatformLayer): PlatformRegistryEntry[] {
    return Array.from(this.registry.values())
      .filter(entry => entry.platform.layer === layer)
  }

  /**
   * Check if a platform is registered
   */
  hasPlatform(id: string): boolean {
    return this.registry.has(id)
  }

  /**
   * Register a platform
   */
  registerPlatform(platform: PlatformData, metadata?: Record<string, any>): void {
    const entry: PlatformRegistryEntry = {
      platform,
      registeredAt: new Date(),
      metadata
    }

    this.registry.set(platform.id, entry)
    this.nameIndex.set(platform.name, platform.id)
  }

  /**
   * Update a platform registration
   */
  updatePlatform(id: string, updates: Partial<PlatformData>): void {
    const entry = this.registry.get(id)
    if (!entry) {
      throw new Error(`Platform not found: ${id}`)
    }

    // Update old name index
    const oldName = entry.platform.name
    if (updates.name && updates.name !== oldName) {
      this.nameIndex.delete(oldName)
      this.nameIndex.set(updates.name, id)
    }

    // Update platform data
    entry.platform = {
      ...entry.platform,
      ...updates,
      updated_at: new Date()
    }
  }

  /**
   * Unregister a platform
   */
  unregisterPlatform(id: string): boolean {
    const entry = this.registry.get(id)
    if (!entry) {
      return false
    }

    this.nameIndex.delete(entry.platform.name)
    this.registry.delete(id)
    return true
  }

  /**
   * Refresh registry from database
   */
  async refresh(): Promise<void> {
    this.registry.clear()
    this.nameIndex.clear()
    await this.initialize()
  }

  /**
   * Get registry size
   */
  size(): number {
    return this.registry.size
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    total: number
    byLayer: Record<string, number>
    enabled: number
  } {
    const entries = Array.from(this.registry.values())
    const byLayer: Record<string, number> = {}
    let enabledCount = 0

    for (const entry of entries) {
      const layer = entry.platform.layer
      byLayer[layer] = (byLayer[layer] || 0) + 1

      if (entry.platform.enabled) {
        enabledCount++
      }
    }

    return {
      total: entries.length,
      byLayer,
      enabled: enabledCount
    }
  }
}
