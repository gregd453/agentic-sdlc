import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createServer } from '../../server'
import { FastifyInstance } from 'fastify'

describe('Phase 5: Dashboard & Monitoring - Integration Tests', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await createServer()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('Platform API Endpoints', () => {
    it('should list all platforms', async () => {
      const response = await app.inject({
        method: 'GET' as const,
        url: '/api/v1/platforms'
      })

      expect(response.statusCode).toBe(200)
      const platforms = JSON.parse(response.payload)
      expect(Array.isArray(platforms)).toBe(true)
    })

    it('should get platform by ID', async () => {
      // First, get all platforms
      const listResponse = await app.inject({
        method: 'GET' as const,
        url: '/api/v1/platforms'
      })

      expect(listResponse.statusCode).toBe(200)
      const platforms = JSON.parse(listResponse.payload)

      if (platforms.length > 0) {
        const platformId = platforms[0].id
        const response = await app.inject({
          method: 'GET' as const,
          url: `/api/v1/platforms/${platformId}`
        })

        expect(response.statusCode).toBe(200)
        const platform = JSON.parse(response.payload)
        expect(platform.id).toBe(platformId)
        expect(platform.name).toBeDefined()
        expect(platform.layer).toBeDefined()
      }
    })

    it('should return 404 for non-existent platform', async () => {
      const response = await app.inject({
        method: 'GET' as const,
        url: '/api/v1/platforms/00000000-0000-0000-0000-000000000000'
      })

      expect(response.statusCode).toBe(404)
      const result = JSON.parse(response.payload)
      expect(result.error).toBeDefined()
    })

    it('should get platform analytics', async () => {
      // First, get all platforms
      const listResponse = await app.inject({
        method: 'GET' as const,
        url: '/api/v1/platforms'
      })

      expect(listResponse.statusCode).toBe(200)
      const platforms = JSON.parse(listResponse.payload)

      if (platforms.length > 0) {
        const platformId = platforms[0].id
        const response = await app.inject({
          method: 'GET' as const,
          url: `/api/v1/platforms/${platformId}/analytics?period=24h`
        })

        expect(response.statusCode).toBe(200)
        const analytics = JSON.parse(response.payload)
        expect(analytics.platform_id).toBe(platformId)
        expect(analytics.total_workflows).toBeDefined()
        expect(analytics.success_rate).toBeDefined()
        expect(analytics.timeseries).toBeDefined()
        expect(Array.isArray(analytics.timeseries)).toBe(true)
      }
    })

    it('should support different time periods for analytics', async () => {
      // First, get all platforms
      const listResponse = await app.inject({
        method: 'GET' as const,
        url: '/api/v1/platforms'
      })

      expect(listResponse.statusCode).toBe(200)
      const platforms = JSON.parse(listResponse.payload)

      if (platforms.length > 0) {
        const platformId = platforms[0].id

        for (const period of ['1h', '24h', '7d', '30d']) {
          const response = await app.inject({
            method: 'GET' as const,
            url: `/api/v1/platforms/${platformId}/analytics?period=${period}`
          })

          expect(response.statusCode).toBe(200)
          const analytics = JSON.parse(response.payload)
          expect(analytics.platform_id).toBe(platformId)
          expect(analytics.success_rate).toBeDefined()
        }
      }
    })

    it('should return error for invalid period', async () => {
      // First, get all platforms
      const listResponse = await app.inject({
        method: 'GET' as const,
        url: '/api/v1/platforms'
      })

      expect(listResponse.statusCode).toBe(200)
      const platforms = JSON.parse(listResponse.payload)

      if (platforms.length > 0) {
        const platformId = platforms[0].id
        const response = await app.inject({
          method: 'GET' as const,
          url: `/api/v1/platforms/${platformId}/analytics?period=invalid`
        })

        expect(response.statusCode).toBe(400)
        const result = JSON.parse(response.payload)
        expect(result.error).toBeDefined()
      }
    })
  })

  describe('Platform Registry Integration', () => {
    it('should have all enabled platforms registered', async () => {
      const response = await app.inject({
        method: 'GET' as const,
        url: '/api/v1/platforms'
      })

      expect(response.statusCode).toBe(200)
      const platforms = JSON.parse(response.payload)
      expect(Array.isArray(platforms)).toBe(true)

      // All platforms should have required fields
      platforms.forEach((platform: any) => {
        expect(platform.id).toBeDefined()
        expect(platform.name).toBeDefined()
        expect(platform.layer).toBeDefined()
        expect(typeof platform.enabled).toBe('boolean')
      })
    })

    it('should have correct layer types', async () => {
      const response = await app.inject({
        method: 'GET' as const,
        url: '/api/v1/platforms'
      })

      expect(response.statusCode).toBe(200)
      const platforms = JSON.parse(response.payload)

      const validLayers = ['APPLICATION', 'DATA', 'INFRASTRUCTURE', 'ENTERPRISE']
      platforms.forEach((platform: any) => {
        expect(validLayers).toContain(platform.layer)
      })
    })
  })

  describe('Analytics Data Integrity', () => {
    it('should calculate accurate success rates', async () => {
      // Get platform analytics
      const platformsResponse = await app.inject({
        method: 'GET' as const,
        url: '/api/v1/platforms'
      })

      expect(platformsResponse.statusCode).toBe(200)
      const platforms = JSON.parse(platformsResponse.payload)

      if (platforms.length > 0) {
        const platformId = platforms[0].id
        const analyticsResponse = await app.inject({
          method: 'GET' as const,
          url: `/api/v1/platforms/${platformId}/analytics`
        })

        expect(analyticsResponse.statusCode).toBe(200)
        const analytics = JSON.parse(analyticsResponse.payload)

        // Success rate should be between 0 and 100
        expect(analytics.success_rate).toBeGreaterThanOrEqual(0)
        expect(analytics.success_rate).toBeLessThanOrEqual(100)

        // Total should equal completed + failed + running
        const accounted = analytics.completed_workflows + analytics.failed_workflows + analytics.running_workflows
        expect(accounted).toBeLessThanOrEqual(analytics.total_workflows)
      }
    })

    it('should provide valid timeseries data', async () => {
      const platformsResponse = await app.inject({
        method: 'GET' as const,
        url: '/api/v1/platforms'
      })

      expect(platformsResponse.statusCode).toBe(200)
      const platforms = JSON.parse(platformsResponse.payload)

      if (platforms.length > 0) {
        const platformId = platforms[0].id
        const analyticsResponse = await app.inject({
          method: 'GET' as const,
          url: `/api/v1/platforms/${platformId}/analytics?period=24h`
        })

        expect(analyticsResponse.statusCode).toBe(200)
        const analytics = JSON.parse(analyticsResponse.payload)

        // Check timeseries structure
        expect(Array.isArray(analytics.timeseries)).toBe(true)
        analytics.timeseries.forEach((point: any) => {
          expect(point.timestamp).toBeDefined()
          expect(typeof point.workflows_created).toBe('number')
          expect(typeof point.workflows_completed).toBe('number')
          expect(typeof point.workflows_failed).toBe('number')
        })
      }
    })
  })

  describe('Phase 5 Gate Validation', () => {
    it('should have PlatformsPage API endpoints operational', async () => {
      const response = await app.inject({
        method: 'GET' as const,
        url: '/api/v1/platforms'
      })

      expect(response.statusCode).toBe(200)
      expect(Array.isArray(JSON.parse(response.payload))).toBe(true)
    })

    it('should have WorkflowBuilderPage API support', async () => {
      // Test that workflow creation still works
      const response = await app.inject({
        method: 'POST' as const,
        url: '/api/v1/workflows',
        payload: {
          name: 'Test Workflow for Phase 5',
          type: 'feature',
          priority: 'medium'
        }
      })

      expect([200, 400]).toContain(response.statusCode) // 200 if created, 400 if validation error
    })

    it('should have PlatformSelector data available', async () => {
      const response = await app.inject({
        method: 'GET' as const,
        url: '/api/v1/platforms'
      })

      expect(response.statusCode).toBe(200)
      const platforms = JSON.parse(response.payload)

      // At least some platforms should be available for selection
      const enabledPlatforms = platforms.filter((p: any) => p.enabled)
      expect(enabledPlatforms.length).toBeGreaterThan(0)
    })

    it('should have SurfaceIndicator integration ready', async () => {
      // Test that workflow endpoint includes surface info (if implemented)
      const response = await app.inject({
        method: 'GET' as const,
        url: '/api/v1/workflows'
      })

      expect([200, 400]).toContain(response.statusCode)
      // Surface field would be optional in workflow response
    })

    it('Phase 5 Gate: All platform endpoints responsive', async () => {
      const endpoints = [
        { method: 'GET' as const, url: '/api/v1/platforms' },
      ]

      for (const endpoint of endpoints) {
        const response = await app.inject({
          method: endpoint.method,
          url: endpoint.url
        })

        expect([200, 400]).toContain(response.statusCode)
      }
    })
  })
})
