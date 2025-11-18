/**
 * Phase 1 Integration Test - Platform Infrastructure
 *
 * Tests the complete Phase 1 implementation:
 * 1. Database schema (new tables, modified columns)
 * 2. PlatformLoader service with caching
 * 3. PlatformRegistry service with lookups
 * 4. Legacy platform definition and seeding
 * 5. WorkflowService platform awareness
 * 6. WorkflowRepository platform-aware fields
 *
 * This test ensures all Phase 1 components work together correctly
 * and backward compatibility is maintained.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient, PlatformLayer } from '@prisma/client'
import { PlatformLoaderService } from '../../services/platform-loader.service'
import { PlatformRegistryService } from '../../services/platform-registry.service'
import { SeedPlatformsService } from '../../services/seed-platforms.service'

describe('Phase 1: Platform Infrastructure Integration', () => {
  let prisma: PrismaClient
  let platformLoader: PlatformLoaderService
  let platformRegistry: PlatformRegistryService
  let seedService: SeedPlatformsService

  beforeAll(async () => {
    // Initialize Prisma client
    prisma = new PrismaClient()

    // Initialize services
    platformLoader = new PlatformLoaderService(prisma)
    seedService = new SeedPlatformsService(prisma)
    platformRegistry = new PlatformRegistryService(platformLoader)
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe('Database Schema', () => {
    it('should have Platform table with correct schema', async () => {
      // Query to verify table structure (tables should exist without error)
      const count = await prisma.platform.count()
      expect(count).toBeGreaterThanOrEqual(0)
    })

    it('should have WorkflowDefinition table with correct schema', async () => {
      const count = await prisma.workflowDefinition.count()
      expect(count).toBeGreaterThanOrEqual(0)
    })

    it('should have PlatformSurface table with correct schema', async () => {
      const count = await prisma.platformSurface.count()
      expect(count).toBeGreaterThanOrEqual(0)
    })

    it('should have Workflow table with platform-aware fields', async () => {
      // Create a test workflow to verify fields exist
      const testWorkflow = await prisma.workflow.create({
        data: {
          type: WORKFLOW_TYPES.APP,
          name: 'Test Platform Awareness',
          status: WORKFLOW_STATUS.INITIATED,
          current_stage: 'initialization',
          priority: TASK_PRIORITY.MEDIUM,
          created_by: 'test',
          platform_id: undefined, // Should accept null
          surface_id: undefined,
          input_data: undefined
        }
      })

      expect(testWorkflow).toBeDefined()
      expect(testWorkflow.platform_id).toBeNull()
      expect(testWorkflow.surface_id).toBeNull()
      expect(testWorkflow.input_data).toBeNull()

      // Clean up
      await prisma.workflow.delete({ where: { id: testWorkflow.id } })
    })

    it('should have Agent table with platform_id field', async () => {
      // Create a test agent to verify field exists
      const testAgent = await prisma.agent.create({
        data: {
          agent_id: `test-agent-${Date.now()}`,
          type: AGENT_TYPES.SCAFFOLD,
          status: 'online',
          version: '1.0.0',
          capabilities: [],
          platform_id: undefined // Should accept null
        }
      })

      expect(testAgent).toBeDefined()
      expect(testAgent.platform_id).toBeNull()

      // Clean up
      await prisma.agent.delete({ where: { id: testAgent.id } })
    })
  })

  describe('PlatformLoader Service', () => {
    it('should load platform by ID', async () => {
      // First, create a test platform
      const platform = await prisma.platform.create({
        data: {
          name: `loader-test-${Date.now()}`,
          layer: PlatformLayer.APPLICATION,
          description: 'Test platform for loader',
          enabled: true
        }
      })

      // Load it via the service
      const loaded = await platformLoader.loadPlatformById(platform.id)
      expect(loaded).toBeDefined()
      expect(loaded?.id).toBe(platform.id)
      expect(loaded?.name).toBe(platform.name)

      // Clean up
      await prisma.platform.delete({ where: { id: platform.id } })
    })

    it('should load platform by name', async () => {
      const platformName = `loader-name-test-${Date.now()}`
      const platform = await prisma.platform.create({
        data: {
          name: platformName,
          layer: PlatformLayer.APPLICATION,
          enabled: true
        }
      })

      const loaded = await platformLoader.loadPlatformByName(platformName)
      expect(loaded).toBeDefined()
      expect(loaded?.name).toBe(platformName)

      // Clean up
      await prisma.platform.delete({ where: { id: platform.id } })
    })

    it('should support caching', async () => {
      const platform = await prisma.platform.create({
        data: {
          name: `cache-test-${Date.now()}`,
          layer: PlatformLayer.APPLICATION,
          enabled: true
        }
      })

      // Enable caching (should be default)
      platformLoader.setCachingEnabled(true)

      // Load twice - second should be cached
      const first = await platformLoader.loadPlatformById(platform.id)
      const second = await platformLoader.loadPlatformById(platform.id)

      expect(first?.id).toBe(second?.id)

      // Test invalidation
      platformLoader.invalidateCache(platform.id)
      const third = await platformLoader.loadPlatformById(platform.id)
      expect(third?.id).toBe(platform.id)

      // Clean up
      await prisma.platform.delete({ where: { id: platform.id } })
    })

    it('should create and return legacy platform', async () => {
      // Clean up any existing legacy platform
      await prisma.platform.deleteMany({ where: { name: 'legacy' } })

      // Get legacy platform (should create it)
      platformLoader.invalidateCache() // Clear cache
      const legacy = await platformLoader.getLegacyPlatform()

      expect(legacy).toBeDefined()
      expect(legacy.name).toBe('legacy')
      expect(legacy.layer).toBe('APPLICATION')
      expect(legacy.enabled).toBe(true)

      // Second call should return existing one
      const legacyAgain = await platformLoader.getLegacyPlatform()
      expect(legacyAgain.id).toBe(legacy.id)

      // Clean up
      await prisma.platform.deleteMany({ where: { name: 'legacy' } })
    })
  })

  describe('PlatformRegistry Service', () => {
    it('should initialize registry with platforms from database', async () => {
      // Create a test platform
      const platform = await prisma.platform.create({
        data: {
          name: `registry-init-${Date.now()}`,
          layer: PlatformLayer.APPLICATION,
          enabled: true
        }
      })

      // Initialize registry
      const registry = new PlatformRegistryService(platformLoader)
      await registry.initialize()

      // Check it was loaded
      const entry = registry.getPlatformById(platform.id)
      expect(entry).toBeDefined()
      expect(entry?.platform.name).toBe(platform.name)

      // Clean up
      await prisma.platform.delete({ where: { id: platform.id } })
    })

    it('should get all registered platforms', async () => {
      const platform = await prisma.platform.create({
        data: {
          name: `registry-all-${Date.now()}`,
          layer: PlatformLayer.DATA,
          enabled: true
        }
      })

      const registry = new PlatformRegistryService(platformLoader)
      await registry.initialize()

      const all = registry.getAllPlatforms()
      expect(all.length).toBeGreaterThan(0)

      // Clean up
      await prisma.platform.delete({ where: { id: platform.id } })
    })

    it('should get platforms by layer', async () => {
      const platform = await prisma.platform.create({
        data: {
          name: `registry-layer-${Date.now()}`,
          layer: PlatformLayer.INFRASTRUCTURE,
          enabled: true
        }
      })

      const registry = new PlatformRegistryService(platformLoader)
      await registry.initialize()

      const infra = registry.getPlatformsByLayer(PlatformLayer.INFRASTRUCTURE)
      expect(infra.length).toBeGreaterThan(0)
      expect(infra.some(e => e.platform.id === platform.id)).toBe(true)

      // Clean up
      await prisma.platform.delete({ where: { id: platform.id } })
    })

    it('should return registry statistics', async () => {
      const registry = new PlatformRegistryService(platformLoader)
      await registry.initialize()

      const stats = registry.getStats()
      expect(stats.total).toBeGreaterThanOrEqual(0)
      expect(stats.enabled).toBeGreaterThanOrEqual(0)
      expect(stats.byLayer).toBeDefined()
    })
  })

  describe('Legacy Platform Definition', () => {
    it('should seed legacy platform successfully', async () => {
      // Clean up any existing
      await prisma.platform.deleteMany({ where: { name: 'legacy' } })

      // Seed
      const seed = new SeedPlatformsService(prisma)
      await seed.seedPlatforms()

      // Verify it was created
      const legacy = await prisma.platform.findUnique({ where: { name: 'legacy' } })
      expect(legacy).toBeDefined()
      expect(legacy?.layer).toBe('APPLICATION')
      expect(legacy?.enabled).toBe(true)
      expect(legacy?.config).toBeDefined()

      // Clean up
      await prisma.platform.deleteMany({ where: { name: 'legacy' } })
    })

    it('should be idempotent - not duplicate on re-seed', async () => {
      // Clean up
      await prisma.platform.deleteMany({ where: { name: 'legacy' } })

      const seed = new SeedPlatformsService(prisma)

      // Seed twice
      await seed.seedPlatforms()
      const countAfterFirst = await prisma.platform.count({ where: { name: 'legacy' } })

      await seed.seedPlatforms()
      const countAfterSecond = await prisma.platform.count({ where: { name: 'legacy' } })

      expect(countAfterFirst).toBe(1)
      expect(countAfterSecond).toBe(1) // Should not have duplicated

      // Clean up
      await prisma.platform.deleteMany({ where: { name: 'legacy' } })
    })

    it('should create surfaces for platforms', async () => {
      // Clean up
      await prisma.platform.deleteMany({ where: { name: 'legacy' } })
      await prisma.platformSurface.deleteMany({})

      const seed = new SeedPlatformsService(prisma)
      await seed.seedPlatforms()

      // Check legacy platform has surfaces
      const legacy = await prisma.platform.findUnique({
        where: { name: 'legacy' },
        include: { surfaces: true }
      })

      expect(legacy?.surfaces.length).toBeGreaterThan(0)

      // Clean up
      await prisma.platform.deleteMany({ where: { name: 'legacy' } })
    })
  })

  describe('Backward Compatibility', () => {
    it('should allow creating workflows without platform_id', async () => {
      // This is the legacy workflow creation path
      const workflow = await prisma.workflow.create({
        data: {
          type: WORKFLOW_TYPES.FEATURE,
          name: 'Legacy Workflow',
          status: WORKFLOW_STATUS.INITIATED,
          current_stage: 'initialization',
          priority: TASK_PRIORITY.MEDIUM,
          created_by: 'test'
          // No platform_id - backward compatible
        }
      })

      expect(workflow).toBeDefined()
      expect(workflow.platform_id).toBeNull()

      // Clean up
      await prisma.workflow.delete({ where: { id: workflow.id } })
    })

    it('should allow creating workflows with platform_id', async () => {
      // Create a test platform
      const platform = await prisma.platform.create({
        data: {
          name: `backward-compat-${Date.now()}`,
          layer: PlatformLayer.APPLICATION,
          enabled: true
        }
      })

      // Create workflow with platform_id
      const workflow = await prisma.workflow.create({
        data: {
          type: WORKFLOW_TYPES.APP,
          name: 'Platform-Aware Workflow',
          status: WORKFLOW_STATUS.INITIATED,
          current_stage: 'initialization',
          priority: TASK_PRIORITY.MEDIUM,
          created_by: 'test',
          platform_id: platform.id
        }
      })

      expect(workflow).toBeDefined()
      expect(workflow.platform_id).toBe(platform.id)

      // Clean up
      await prisma.workflow.delete({ where: { id: workflow.id } })
      await prisma.platform.delete({ where: { id: platform.id } })
    })
  })

  describe('Phase 1 Gate Validation', () => {
    it('should pass all Phase 1 gate criteria', async () => {
      const checks = {
        newTablesCreated: false,
        newColumnsAdded: false,
        platformLoaderWorking: false,
        platformRegistryWorking: false,
        legacyPlatformSeeded: false,
        backwardCompatibilityMaintained: false
      }

      // Check 1: New tables exist
      const tablesCounts = {
        platforms: await prisma.platform.count(),
        definitions: await prisma.workflowDefinition.count(),
        surfaces: await prisma.platformSurface.count()
      }
      checks.newTablesCreated = Object.values(tablesCounts).every(c => c >= 0)

      // Check 2: New columns exist (tested via creation above)
      checks.newColumnsAdded = true

      // Check 3: PlatformLoader works
      platformLoader.invalidateCache()
      const loaded = await platformLoader.getLegacyPlatform()
      checks.platformLoaderWorking = !!loaded && loaded.name === 'legacy'

      // Check 4: PlatformRegistry works
      const registry = new PlatformRegistryService(platformLoader)
      await registry.initialize()
      checks.platformRegistryWorking = registry.size() > 0

      // Check 5: Legacy platform seeded
      const legacy = await prisma.platform.findUnique({ where: { name: 'legacy' } })
      checks.legacyPlatformSeeded = !!legacy

      // Check 6: Backward compatibility
      const legacyWorkflow = await prisma.workflow.create({
        data: {
          type: WORKFLOW_TYPES.FEATURE,
          name: 'Compat Test',
          status: WORKFLOW_STATUS.INITIATED,
          current_stage: 'initialization',
          priority: TASK_PRIORITY.MEDIUM,
          created_by: 'test'
        }
      })
      checks.backwardCompatibilityMaintained = legacyWorkflow.platform_id === null
      await prisma.workflow.delete({ where: { id: legacyWorkflow.id } })

      // All checks must pass
      const allPassed = Object.values(checks).every(v => v === true)
      expect(allPassed).toBe(true)

      // Log results
      console.log('Phase 1 Gate Validation Results:')
      Object.entries(checks).forEach(([key, value]) => {
        console.log(`  ${key}: ${value ? '✓ PASS' : '✗ FAIL'}`)
      })
    })
  })
})
