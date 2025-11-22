/**
 * Phase 4: Surface Binding Integration Tests
 *
 * Validates that:
 * 1. Platform surface bindings are properly enforced
 * 2. Workflows cannot be created on unconfigured surfaces
 * 3. Enabling/disabling surfaces works correctly
 * 4. Backward compatibility with workflows without platform_id
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient, SurfaceType } from '@prisma/client'
import { SurfaceRouterService } from '../../services/surface-router.service'
import { PlatformService } from '../../services/platform.service'
import { randomUUID } from 'crypto'

describe('Surface Binding Integration Tests', () => {
  let prisma: PrismaClient
  let surfaceRouter: SurfaceRouterService
  let platformService: PlatformService
  let testPlatformId: string

  beforeAll(async () => {
    // Initialize services
    prisma = new PrismaClient()
    surfaceRouter = new SurfaceRouterService(prisma)
    platformService = new PlatformService(prisma)

    // Create test platform
    const platform = await platformService.createPlatform({
      name: `test-platform-${randomUUID()}`,
      layer: 'APPLICATION',
      description: 'Test platform for surface binding tests',
      enabled: true
    })
    testPlatformId = platform.id
  })

  afterAll(async () => {
    // Cleanup: Delete test platform (cascade deletes surfaces)
    try {
      await platformService.deletePlatform(testPlatformId)
    } catch (error) {
      // Platform may already be deleted in some tests
    }

    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // Clean up any surfaces from previous tests
    await prisma.platformSurface.deleteMany({
      where: { platform_id: testPlatformId }
    })
  })

  describe('Surface Binding Enforcement', () => {
    it('should reject request when surface is not configured for platform', async () => {
      // Attempt to route REST request without enabling REST surface
      const request = {
        surface_type: 'REST' as SurfaceType,
        platform_id: testPlatformId,
        payload: {
          type: 'app',
          name: 'Test Workflow',
          description: 'Test workflow description'
        }
      }

      await expect(surfaceRouter.routeRequest(request)).rejects.toThrow(
        /Surface REST not configured for platform/
      )
    })

    it('should allow request after enabling surface for platform', async () => {
      // Enable REST surface
      await platformService.enablePlatformSurface(testPlatformId, 'REST', {})

      // Now the request should succeed
      const request = {
        surface_type: 'REST' as SurfaceType,
        platform_id: testPlatformId,
        payload: {
          type: 'app',
          name: 'Test Workflow',
          description: 'Test workflow description'
        }
      }

      const context = await surfaceRouter.routeRequest(request)

      expect(context).toBeDefined()
      expect(context.surface_type).toBe('REST')
      expect(context.platform_id).toBe(testPlatformId)
      expect(context.validated_payload.name).toBe('Test Workflow')
    })

    it('should reject request when surface is disabled', async () => {
      // Enable REST surface initially
      await platformService.enablePlatformSurface(testPlatformId, 'REST', {}, true)

      // Now disable it
      await platformService.disablePlatformSurface(testPlatformId, 'REST')

      // Request should fail
      const request = {
        surface_type: 'REST' as SurfaceType,
        platform_id: testPlatformId,
        payload: {
          type: 'app',
          name: 'Test Workflow',
          description: 'Test workflow description'
        }
      }

      await expect(surfaceRouter.routeRequest(request)).rejects.toThrow(
        /Surface REST is disabled for platform/
      )
    })

    it('should allow re-enabling a disabled surface', async () => {
      // Enable, then disable, then re-enable
      await platformService.enablePlatformSurface(testPlatformId, 'WEBHOOK', {}, true)
      await platformService.disablePlatformSurface(testPlatformId, 'WEBHOOK')
      await platformService.updatePlatformSurface(testPlatformId, 'WEBHOOK', {
        enabled: true
      })

      // Request should succeed
      const request = {
        surface_type: 'WEBHOOK' as SurfaceType,
        platform_id: testPlatformId,
        payload: {
          type: 'feature',
          name: 'Webhook Test Workflow',
          webhook_metadata: {
            event: 'push',
            delivery_id: 'test-123',
            repository: 'test/repo',
            branch: 'main'
          }
        }
      }

      const context = await surfaceRouter.routeRequest(request)

      expect(context).toBeDefined()
      expect(context.surface_type).toBe('WEBHOOK')
      expect(context.platform_id).toBe(testPlatformId)
    })
  })

  describe('Backward Compatibility', () => {
    it('should allow workflow creation without platform_id (legacy behavior)', async () => {
      // Request without platform_id should bypass surface validation
      const request = {
        surface_type: 'CLI' as SurfaceType,
        payload: {
          type: 'bugfix',
          name: 'Legacy Workflow',
          description: 'Workflow created without platform_id'
        }
      }

      const context = await surfaceRouter.routeRequest(request)

      expect(context).toBeDefined()
      expect(context.surface_type).toBe('CLI')
      expect(context.platform_id).toBeUndefined()
      expect(context.validated_payload.name).toBe('Legacy Workflow')
    })
  })

  describe('Surface Management API', () => {
    it('should create a new platform surface', async () => {
      const surface = await platformService.enablePlatformSurface(
        testPlatformId,
        'DASHBOARD',
        { theme: 'dark' },
        true
      )

      expect(surface.platform_id).toBe(testPlatformId)
      expect(surface.surface_type).toBe('DASHBOARD')
      expect(surface.config).toEqual({ theme: 'dark' })
      expect(surface.enabled).toBe(true)
    })

    it('should list all surfaces for a platform', async () => {
      // Create multiple surfaces
      await platformService.enablePlatformSurface(testPlatformId, 'REST', {})
      await platformService.enablePlatformSurface(testPlatformId, 'WEBHOOK', {})
      await platformService.enablePlatformSurface(testPlatformId, 'CLI', {})

      const surfaces = await platformService.getPlatformSurfaces(testPlatformId)

      expect(surfaces).toHaveLength(3)
      expect(surfaces.map(s => s.surface_type)).toContain('REST')
      expect(surfaces.map(s => s.surface_type)).toContain('WEBHOOK')
      expect(surfaces.map(s => s.surface_type)).toContain('CLI')
    })

    it('should update surface configuration', async () => {
      // Create surface with initial config
      await platformService.enablePlatformSurface(testPlatformId, 'MOBILE_API', {
        version: '1.0.0'
      })

      // Update config
      const updated = await platformService.updatePlatformSurface(
        testPlatformId,
        'MOBILE_API',
        { config: { version: '2.0.0', features: ['offline_sync'] } }
      )

      expect(updated.config).toEqual({
        version: '2.0.0',
        features: ['offline_sync']
      })
    })

    it('should handle duplicate surface creation gracefully (upsert)', async () => {
      // Create surface twice (should upsert)
      const surface1 = await platformService.enablePlatformSurface(
        testPlatformId,
        'REST',
        { rateLimit: 100 }
      )

      const surface2 = await platformService.enablePlatformSurface(
        testPlatformId,
        'REST',
        { rateLimit: 200 }
      )

      // Should be the same surface (same ID)
      expect(surface1.id).toBe(surface2.id)
      expect(surface2.config).toEqual({ rateLimit: 200 })
    })

    it('should throw error when updating non-existent surface', async () => {
      await expect(
        platformService.updatePlatformSurface(testPlatformId, 'WEBHOOK', {
          enabled: false
        })
      ).rejects.toThrow(/Surface WEBHOOK not found/)
    })

    it('should throw error when disabling non-existent surface', async () => {
      await expect(
        platformService.disablePlatformSurface(testPlatformId, 'DASHBOARD')
      ).rejects.toThrow(/Surface DASHBOARD not found/)
    })
  })

  describe('Multiple Surface Types', () => {
    it('should handle REST surface routing correctly', async () => {
      await platformService.enablePlatformSurface(testPlatformId, 'REST', {})

      const request = {
        surface_type: 'REST' as SurfaceType,
        platform_id: testPlatformId,
        payload: {
          type: 'app',
          name: 'REST Workflow'
        },
        metadata: {
          source_ip: '192.168.1.1',
          user_agent: 'test-client/1.0'
        }
      }

      const context = await surfaceRouter.routeRequest(request)

      expect(context.surface_type).toBe('REST')
      expect(context.entry_metadata.source).toBe('rest_api')
      expect(context.entry_metadata.source_ip).toBe('192.168.1.1')
    })

    it('should handle WEBHOOK surface routing correctly', async () => {
      await platformService.enablePlatformSurface(testPlatformId, 'WEBHOOK', {})

      const request = {
        surface_type: 'WEBHOOK' as SurfaceType,
        platform_id: testPlatformId,
        payload: {
          type: 'feature',
          name: 'Webhook Workflow',
          webhook_metadata: {
            event: 'pull_request',
            delivery_id: 'webhook-456',
            repository: 'org/repo',
            branch: 'feature/test'
          }
        }
      }

      const context = await surfaceRouter.routeRequest(request)

      expect(context.surface_type).toBe('WEBHOOK')
      expect(context.entry_metadata.source).toBe('webhook')
      expect(context.entry_metadata.webhook_event).toBe('pull_request')
      expect(context.entry_metadata.source_branch).toBe('feature/test')
    })

    it('should handle CLI surface routing correctly', async () => {
      await platformService.enablePlatformSurface(testPlatformId, 'CLI', {})

      const request = {
        surface_type: 'CLI' as SurfaceType,
        platform_id: testPlatformId,
        payload: {
          type: 'bugfix',
          name: 'CLI Workflow',
          cli_command: 'workflow create',
          cli_flags: { verbose: true }
        }
      }

      const context = await surfaceRouter.routeRequest(request)

      expect(context.surface_type).toBe('CLI')
      expect(context.entry_metadata.source).toBe('cli')
      expect(context.entry_metadata.cli_command).toBe('workflow create')
    })

    it('should handle DASHBOARD surface routing correctly', async () => {
      await platformService.enablePlatformSurface(testPlatformId, 'DASHBOARD', {})

      const request = {
        surface_type: 'DASHBOARD' as SurfaceType,
        platform_id: testPlatformId,
        payload: {
          type: 'app',
          name: 'Dashboard Workflow',
          user_id: 'user-123',
          session_id: 'session-456'
        }
      }

      const context = await surfaceRouter.routeRequest(request)

      expect(context.surface_type).toBe('DASHBOARD')
      expect(context.entry_metadata.source).toBe('dashboard')
      expect(context.entry_metadata.user_id).toBe('user-123')
    })

    it('should handle MOBILE_API surface routing correctly', async () => {
      await platformService.enablePlatformSurface(testPlatformId, 'MOBILE_API', {})

      const request = {
        surface_type: 'MOBILE_API' as SurfaceType,
        platform_id: testPlatformId,
        payload: {
          type: 'feature',
          name: 'Mobile Workflow',
          device_type: 'iOS',
          app_version: '3.2.1',
          offline_sync: true
        }
      }

      const context = await surfaceRouter.routeRequest(request)

      expect(context.surface_type).toBe('MOBILE_API')
      expect(context.entry_metadata.source).toBe('mobile_app')
      expect(context.entry_metadata.device_type).toBe('iOS')
      expect(context.entry_metadata.offline_sync).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should provide clear error message when surface not configured', async () => {
      const request = {
        surface_type: 'WEBHOOK' as SurfaceType,
        platform_id: testPlatformId,
        payload: {
          type: 'app',
          name: 'Test'
        }
      }

      try {
        await surfaceRouter.routeRequest(request)
        expect.fail('Should have thrown error')
      } catch (error: any) {
        expect(error.message).toContain('Surface WEBHOOK not configured')
        expect(error.message).toContain('Enable this surface in platform settings')
      }
    })

    it('should provide clear error message when surface is disabled', async () => {
      // Enable and then disable
      await platformService.enablePlatformSurface(testPlatformId, 'CLI', {})
      await platformService.disablePlatformSurface(testPlatformId, 'CLI')

      const request = {
        surface_type: 'CLI' as SurfaceType,
        platform_id: testPlatformId,
        payload: {
          type: 'app',
          name: 'Test'
        }
      }

      try {
        await surfaceRouter.routeRequest(request)
        expect.fail('Should have thrown error')
      } catch (error: any) {
        expect(error.message).toContain('Surface CLI is disabled')
      }
    })
  })
})
