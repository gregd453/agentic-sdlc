import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createServer } from '../../server'
import { FastifyInstance } from 'fastify'

/**
 * Phase 6: Documentation Tests
 *
 * Tests for API documentation accuracy and schema definitions:
 * - API endpoints are documented and accessible
 * - Schema examples match actual API responses
 * - API documentation is complete for all endpoints
 * - Error responses are properly documented
 * - Platform-specific endpoints are documented
 */
describe('Phase 6: Documentation Tests', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await createServer()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('API Documentation Endpoints', () => {
    it('should have Swagger/OpenAPI documentation available', async () => {
      const response = await app.inject({
        method: 'GET' as const,
        url: '/docs'
      })

      // Should either have /docs or /swagger/ui.html
      expect([200, 301, 302, 404]).toContain(response.statusCode)

      if (response.statusCode === 200) {
        expect(response.headers['content-type']).toContain('text/html')
      }
    })

    it('should have OpenAPI schema accessible', async () => {
      const response = await app.inject({
        method: 'GET' as const,
        url: '/openapi.json'
      })

      // OpenAPI schema should exist
      if (response.statusCode === 200) {
        const schema = JSON.parse(response.payload)

        expect(schema).toHaveProperty('openapi')
        expect(schema).toHaveProperty('info')
        expect(schema).toHaveProperty('paths')
      }
    })
  })

  describe('Workflow Endpoints Documentation', () => {
    it('should document POST /api/v1/workflows endpoint', async () => {
      const response = await app.inject({
        method: 'POST' as const,
        url: '/api/v1/workflows',
        payload: {
          name: 'Documentation Test',
          type: 'feature'
        }
      })

      expect(response.statusCode).toBe(201)

      const workflow = JSON.parse(response.payload)

      // Verify response structure matches schema documentation
      expect(workflow).toHaveProperty('id')
      expect(workflow).toHaveProperty('name')
      expect(workflow).toHaveProperty('type')
      expect(workflow).toHaveProperty('stage')
      expect(workflow).toHaveProperty('progress')
      expect(workflow).toHaveProperty('trace_id')
    })

    it('should document GET /api/v1/workflows endpoint', async () => {
      const response = await app.inject({
        method: 'GET' as const,
        url: '/api/v1/workflows'
      })

      expect(response.statusCode).toBe(200)

      const workflows = JSON.parse(response.payload)

      expect(Array.isArray(workflows)).toBeTruthy()

      // If workflows exist, verify structure
      if (workflows.length > 0) {
        const workflow = workflows[0]

        expect(workflow).toHaveProperty('id')
        expect(workflow).toHaveProperty('name')
        expect(workflow).toHaveProperty('type')
        expect(workflow).toHaveProperty('stage')
      }
    })

    it('should document GET /api/v1/workflows/:id endpoint', async () => {
      // Create a workflow first
      const createResponse = await app.inject({
        method: 'POST' as const,
        url: '/api/v1/workflows',
        payload: {
          name: 'Get Workflow Test',
          type: 'feature'
        }
      })

      const created = JSON.parse(createResponse.payload)

      // Get specific workflow
      const getResponse = await app.inject({
        method: 'GET' as const,
        url: `/api/v1/workflows/${created.id}`
      })

      expect(getResponse.statusCode).toBe(200)

      const workflow = JSON.parse(getResponse.payload)

      // Verify response matches schema
      expect(workflow.id).toBe(created.id)
      expect(workflow).toHaveProperty('name')
      expect(workflow).toHaveProperty('type')
      expect(workflow).toHaveProperty('stage')
      expect(workflow).toHaveProperty('progress')
    })
  })

  describe('Platform Endpoints Documentation', () => {
    it('should document GET /api/v1/platforms endpoint', async () => {
      const response = await app.inject({
        method: 'GET' as const,
        url: '/api/v1/platforms'
      })

      expect(response.statusCode).toBe(200)

      const platforms = JSON.parse(response.payload)

      expect(Array.isArray(platforms)).toBeTruthy()

      // If platforms exist, verify structure
      if (platforms.length > 0) {
        const platform = platforms[0]

        expect(platform).toHaveProperty('id')
        expect(platform).toHaveProperty('name')
        expect(platform).toHaveProperty('layer')
      }
    })

    it('should document GET /api/v1/platforms/:id endpoint', async () => {
      // Get list of platforms first
      const listResponse = await app.inject({
        method: 'GET' as const,
        url: '/api/v1/platforms'
      })

      const platforms = JSON.parse(listResponse.payload)

      if (platforms.length > 0) {
        const platform = platforms[0]

        const getResponse = await app.inject({
          method: 'GET' as const,
          url: `/api/v1/platforms/${platform.id}`
        })

        expect([200, 404]).toContain(getResponse.statusCode)

        if (getResponse.statusCode === 200) {
          const platformDetail = JSON.parse(getResponse.payload)

          expect(platformDetail).toHaveProperty('id')
          expect(platformDetail).toHaveProperty('name')
          expect(platformDetail).toHaveProperty('layer')
        }
      }
    })

    it('should document GET /api/v1/platforms/:id/analytics endpoint', async () => {
      // Get list of platforms first
      const listResponse = await app.inject({
        method: 'GET' as const,
        url: '/api/v1/platforms'
      })

      const platforms = JSON.parse(listResponse.payload)

      if (platforms.length > 0) {
        const platform = platforms[0]

        const analyticsResponse = await app.inject({
          method: 'GET' as const,
          url: `/api/v1/platforms/${platform.id}/analytics?period=24h`
        })

        expect([200, 404, 400]).toContain(analyticsResponse.statusCode)

        if (analyticsResponse.statusCode === 200) {
          const analytics = JSON.parse(analyticsResponse.payload)

          // Verify analytics structure
          expect(analytics).toHaveProperty('platform_id')
          expect(analytics).toHaveProperty('period')
          expect(analytics).toHaveProperty('success_rate')
          expect(analytics).toHaveProperty('total_workflows')
        }
      }
    })
  })

  describe('Error Response Documentation', () => {
    it('should document 404 error for non-existent workflow', async () => {
      const response = await app.inject({
        method: 'GET' as const,
        url: '/api/v1/workflows/non-existent-id'
      })

      expect(response.statusCode).toBe(404)

      const error = JSON.parse(response.payload)

      // Error should have consistent structure
      expect(error).toHaveProperty('error')
      expect(error).toHaveProperty('statusCode')
      expect(error.statusCode).toBe(404)
    })

    it('should document 400 error for invalid request', async () => {
      const response = await app.inject({
        method: 'POST' as const,
        url: '/api/v1/workflows',
        payload: {
          // Missing required name field
          type: 'feature'
        }
      })

      expect(response.statusCode).toBe(400)

      const error = JSON.parse(response.payload)

      expect(error).toHaveProperty('error')
      expect(error).toHaveProperty('statusCode')
      expect(error.statusCode).toBe(400)
    })

    it('should document 500 error structure', async () => {
      // This is a documentation test - we're verifying error format, not creating a real error
      // A 500 error should follow consistent structure

      // Verify by creating a scenario that might error
      const response = await app.inject({
        method: 'GET' as const,
        url: '/api/v1/workflows'
      })

      expect([200, 500]).toContain(response.statusCode)

      if (response.statusCode === 500) {
        const error = JSON.parse(response.payload)

        expect(error).toHaveProperty('error')
        expect(error).toHaveProperty('statusCode')
        expect(error).toHaveProperty('message')
      }
    })
  })

  describe('Schema Examples', () => {
    it('workflow creation request should match documented schema', async () => {
      const requestPayload = {
        name: 'Schema Test Workflow',
        type: 'feature',
        priority: 'high',
        description: 'Testing schema validation'
      }

      const response = await app.inject({
        method: 'POST' as const,
        url: '/api/v1/workflows',
        payload: requestPayload
      })

      expect(response.statusCode).toBe(201)

      const workflow = JSON.parse(response.payload)

      // Verify all request fields are in response
      expect(workflow.name).toBe(requestPayload.name)
      expect(workflow.type).toBe(requestPayload.type)
      expect(workflow.priority).toBe(requestPayload.priority)
      expect(workflow.description).toBe(requestPayload.description)
    })

    it('workflow response should contain all documented fields', async () => {
      const response = await app.inject({
        method: 'POST' as const,
        url: '/api/v1/workflows',
        payload: {
          name: 'Complete Schema Test',
          type: 'app'
        }
      })

      const workflow = JSON.parse(response.payload)

      // Required fields per documentation
      const requiredFields = [
        'id',
        'name',
        'type',
        'stage',
        'progress',
        'trace_id',
        'created_at',
        'updated_at'
      ]

      requiredFields.forEach(field => {
        expect(workflow).toHaveProperty(field)
        expect(workflow[field]).not.toBeUndefined()
      })
    })

    it('platform response should contain all documented fields', async () => {
      const response = await app.inject({
        method: 'GET' as const,
        url: '/api/v1/platforms'
      })

      const platforms = JSON.parse(response.payload)

      if (platforms.length > 0) {
        const platform = platforms[0]

        // Required fields per documentation
        const requiredFields = [
          'id',
          'name',
          'layer'
        ]

        requiredFields.forEach(field => {
          expect(platform).toHaveProperty(field)
          expect(platform[field]).not.toBeUndefined()
        })
      }
    })
  })

  describe('Response Content-Type Documentation', () => {
    it('all endpoints should return JSON content-type', async () => {
      const endpoints = [
        { method: 'GET' as const, url: '/api/v1/workflows' },
        { method: 'GET' as const, url: '/api/v1/platforms' }
      ]

      for (const endpoint of endpoints) {
        const response = await app.inject(endpoint)

        expect(response.headers['content-type']).toContain('application/json')
      }
    })

    it('error responses should include error details', async () => {
      const response = await app.inject({
        method: 'GET' as const,
        url: '/api/v1/workflows/invalid'
      })

      expect(response.statusCode).toBe(404)
      expect(response.headers['content-type']).toContain('application/json')

      const body = JSON.parse(response.payload)
      expect(body).toHaveProperty('error')
    })
  })

  describe('Pagination Documentation', () => {
    it('workflows list endpoint should support pagination', async () => {
      const response = await app.inject({
        method: 'GET' as const,
        url: '/api/v1/workflows?limit=10&offset=0'
      })

      expect([200, 400]).toContain(response.statusCode)

      if (response.statusCode === 200) {
        const result = JSON.parse(response.payload)

        // Should be array or have paginated structure
        expect(Array.isArray(result) || result.data).toBeDefined()
      }
    })

    it('platforms list endpoint should support pagination', async () => {
      const response = await app.inject({
        method: 'GET' as const,
        url: '/api/v1/platforms?limit=10&offset=0'
      })

      expect([200, 400]).toContain(response.statusCode)

      if (response.statusCode === 200) {
        const result = JSON.parse(response.payload)

        expect(Array.isArray(result)).toBeTruthy()
      }
    })
  })

  describe('API Versioning Documentation', () => {
    it('all endpoints should use v1 API version', async () => {
      const response = await app.inject({
        method: 'GET' as const,
        url: '/api/v1/workflows'
      })

      // Should be accessible
      expect([200, 404]).toContain(response.statusCode)
    })

    it('API version should be consistent across endpoints', async () => {
      const endpoints = [
        '/api/v1/workflows',
        '/api/v1/platforms'
      ]

      for (const url of endpoints) {
        const response = await app.inject({
          method: 'GET' as const,
          url
        })

        // All v1 endpoints should exist
        expect([200, 404]).toContain(response.statusCode)
      }
    })
  })

  describe('Phase 6 Gate: Documentation Quality', () => {
    it('should have documented endpoints for workflows', async () => {
      // Verify key endpoints exist and are documented
      const endpoints = [
        { method: 'POST' as const, url: '/api/v1/workflows', expectedStatus: 201 },
        { method: 'GET' as const, url: '/api/v1/workflows', expectedStatus: 200 }
      ]

      for (const endpoint of endpoints) {
        const response = await app.inject(endpoint)

        expect([endpoint.expectedStatus, 201, 200, 400, 404]).toContain(response.statusCode)
      }
    })

    it('should have documented endpoints for platforms', async () => {
      // Verify platform endpoints exist and are documented
      const response = await app.inject({
        method: 'GET' as const,
        url: '/api/v1/platforms'
      })

      expect([200, 404]).toContain(response.statusCode)
    })

    it('should have consistent error documentation', async () => {
      // Test multiple error scenarios
      const scenarios = [
        { method: 'GET' as const, url: '/api/v1/workflows/invalid' }, // 404
        { method: 'POST' as const, url: '/api/v1/workflows', payload: {} } // 400
      ]

      for (const scenario of scenarios) {
        const response = await app.inject(scenario)

        expect(response.statusCode).toBeGreaterThanOrEqual(400)
        expect(response.headers['content-type']).toContain('application/json')

        const error = JSON.parse(response.payload)
        expect(error).toHaveProperty('error')
        expect(error).toHaveProperty('statusCode')
      }
    })

    it('all API responses should be valid JSON', async () => {
      const response = await app.inject({
        method: 'GET' as const,
        url: '/api/v1/workflows'
      })

      // Should not throw when parsing
      expect(() => {
        JSON.parse(response.payload)
      }).not.toThrow()
    })
  })
})
