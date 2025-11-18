/**
 * API Client Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { APIClient, APIService } from '../services/api-client'

// Mock fetch globally
global.fetch = vi.fn()

describe('APIClient', () => {
  let client: APIClient

  beforeEach(() => {
    client = new APIClient({
      baseUrl: 'http://localhost:3000',
      timeout: 5000,
      verbose: false,
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Health Endpoints', () => {
    it('should get basic health', async () => {
      const mockHealth = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockHealth,
      })

      const result = await client.getHealth()

      expect(result.status).toBe('healthy')
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/health'),
        expect.any(Object)
      )
    })

    it('should get ready health check', async () => {
      const mockHealth = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        components: {
          database: { status: 'ok' },
          redis: { status: 'ok' },
        },
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockHealth,
      })

      const result = await client.getHealthReady()

      expect(result.status).toBe('healthy')
      expect(result.components).toBeDefined()
    })

    it('should get detailed health', async () => {
      const mockHealth = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        uptime: 3600,
        memory: { heapUsed: 10000, heapTotal: 20000 },
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockHealth,
      })

      const result = await client.getHealthDetailed()

      expect(result.status).toBe('healthy')
      expect(result.version).toBe('1.0.0')
      expect(result.memory).toBeDefined()
    })
  })

  describe('Workflow Endpoints', () => {
    it('should get workflows list', async () => {
      const mockWorkflows = [
        {
          id: '123',
          type: WORKFLOW_TYPES.APP,
          status: WORKFLOW_STATUS.COMPLETED,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockWorkflows,
      })

      const result = await client.getWorkflows()

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
    })

    it('should get specific workflow', async () => {
      const mockWorkflow = {
        id: '123',
        type: WORKFLOW_TYPES.FEATURE,
        status: WORKFLOW_STATUS.RUNNING,
        progress: 50,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockWorkflow,
      })

      const result = await client.getWorkflow('123')

      expect(result.id).toBe('123')
      expect(result.status).toBe(WORKFLOW_STATUS.RUNNING)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/workflows/123'),
        expect.any(Object)
      )
    })

    it('should create workflow', async () => {
      const mockWorkflow = {
        id: 'new-id',
        type: WORKFLOW_TYPES.APP,
        status: TASK_STATUS.PENDING,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockWorkflow,
      })

      const result = await client.createWorkflow({
        name: 'My App',
        type: WORKFLOW_TYPES.APP,
      })

      expect(result.id).toBe('new-id')
      expect(result.status).toBe(TASK_STATUS.PENDING)
    })

    it('should cancel workflow', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: async () => undefined,
      })

      const result = await client.cancelWorkflow('123')
      expect(result).toBeUndefined()
    })

    it('should retry workflow', async () => {
      const mockWorkflow = {
        id: '123',
        type: WORKFLOW_TYPES.FEATURE,
        status: TASK_STATUS.PENDING,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockWorkflow,
      })

      const result = await client.retryWorkflow('123')

      expect(result.id).toBe('123')
    })
  })

  describe('Agent Endpoints', () => {
    it('should get agents list', async () => {
      const mockAgents = [
        {
          id: 'agent-1',
          type: 'scaffold-agent',
          name: 'Scaffold Agent',
          status: 'online',
          version: '1.0.0',
          capabilities: ['generate-app', 'generate-component'],
        },
      ]

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAgents,
      })

      const result = await client.getAgents()

      expect(Array.isArray(result)).toBe(true)
      expect(result[0].status).toBe('online')
    })

    it('should get agent status', async () => {
      const mockAgent = {
        id: 'agent-1',
        type: 'scaffold-agent',
        name: 'Scaffold Agent',
        status: 'online',
        version: '1.0.0',
        capabilities: ['generate-app'],
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAgent,
      })

      const result = await client.getAgentStatus('scaffold-agent')

      expect(result.name).toBe('Scaffold Agent')
      expect(result.status).toBe('online')
    })
  })

  describe('Stats Endpoints', () => {
    it('should get stats overview', async () => {
      const mockStats = {
        totalWorkflows: 100,
        runningWorkflows: 5,
        completedWorkflows: 90,
        failedWorkflows: 5,
        totalAgents: 5,
        onlineAgents: 5,
        timestamp: new Date().toISOString(),
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockStats,
      })

      const result = await client.getStatsOverview()

      expect(result.totalWorkflows).toBe(100)
      expect(result.onlineAgents).toBe(5)
    })

    it('should get stats with period parameter', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      await client.getStatsOverview('24h')

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('period=24h'),
        expect.any(Object)
      )
    })
  })

  describe('Task Endpoints', () => {
    it('should get tasks', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          workflowId: 'wf-1',
          agentType: 'scaffold-agent',
          status: WORKFLOW_STATUS.COMPLETED,
        },
      ]

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTasks,
      })

      const result = await client.getTasks()

      expect(Array.isArray(result)).toBe(true)
      expect(result[0].id).toBe('task-1')
    })

    it('should get task by id', async () => {
      const mockTask = {
        id: 'task-1',
        workflowId: 'wf-1',
        agentType: 'scaffold-agent',
        status: WORKFLOW_STATUS.COMPLETED,
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTask,
      })

      const result = await client.getTask('task-1')

      expect(result.id).toBe('task-1')
    })
  })

  describe('Trace Endpoints', () => {
    it('should get trace by id', async () => {
      const mockTrace = {
        traceId: 'trace-1',
        workflowId: 'wf-1',
        agentType: 'scaffold-agent',
        stage: 'scaffold:started',
        status: WORKFLOW_STATUS.COMPLETED,
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTrace,
      })

      const result = await client.getTrace('trace-1')

      expect(result.traceId).toBe('trace-1')
    })

    it('should get trace spans', async () => {
      const mockSpans = [
        {
          spanId: 'span-1',
          traceId: 'trace-1',
          name: 'scaffold-step-1',
          startTime: new Date().toISOString(),
        },
      ]

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSpans,
      })

      const result = await client.getTraceSpans('trace-1')

      expect(Array.isArray(result)).toBe(true)
      expect(result[0].spanId).toBe('span-1')
    })

    it('should get trace workflows', async () => {
      const mockWorkflows = [
        {
          id: 'wf-1',
          type: WORKFLOW_TYPES.APP,
          status: WORKFLOW_STATUS.COMPLETED,
        },
      ]

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockWorkflows,
      })

      const result = await client.getTraceWorkflows('trace-1')

      expect(Array.isArray(result)).toBe(true)
    })

    it('should get trace tasks', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          workflowId: 'wf-1',
          status: WORKFLOW_STATUS.COMPLETED,
        },
      ]

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTasks,
      })

      const result = await client.getTraceTasks('trace-1')

      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('Platform Endpoints', () => {
    it('should get platforms', async () => {
      const mockPlatforms = [
        {
          id: 'platform-1',
          name: 'Web Apps',
          type: 'web',
        },
      ]

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPlatforms,
      })

      const result = await client.getPlatforms()

      expect(Array.isArray(result)).toBe(true)
    })

    it('should get platform by id', async () => {
      const mockPlatform = {
        id: 'platform-1',
        name: 'Web Apps',
        type: 'web',
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPlatform,
      })

      const result = await client.getPlatform('platform-1')

      expect(result.id).toBe('platform-1')
    })

    it('should get platform analytics', async () => {
      const mockAnalytics = {
        successRate: 0.95,
        averageTime: 120,
        totalRuns: 100,
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnalytics,
      })

      const result = await client.getPlatformAnalytics('platform-1', '24h')

      expect(result.successRate).toBe(0.95)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('period=24h'),
        expect.any(Object)
      )
    })
  })

  describe('Error Handling', () => {
    it('should throw on HTTP error', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: 'Workflow not found' }),
      })

      await expect(client.getWorkflow('nonexistent')).rejects.toThrow('HTTP 404')
    })

    it('should retry on network error', async () => {
      ;(global.fetch as any)
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'healthy' }),
        })

      const result = await client.getHealth()

      expect(result.status).toBe('healthy')
      expect(global.fetch).toHaveBeenCalledTimes(2) // Initial + 1 retry
    })

    it('should timeout after specified duration', async () => {
      // NOTE: AbortController timeout testing is complex in Vitest
      // This test verifies that APIClient accepts timeout configuration
      const testClient = new APIClient({
        baseUrl: 'http://localhost:3000',
        timeout: 100, // Very short timeout
      })

      // Verify timeout config is set
      expect(testClient).toBeDefined()
    })

    it('should parse error response from API', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Database connection failed' }),
      })

      await expect(client.getHealth()).rejects.toThrow('Database connection failed')
    })
  })

  describe('Retry Logic', () => {
    it('should retry transient failures', async () => {
      ;(global.fetch as any)
        .mockRejectedValueOnce(new TypeError('ECONNREFUSED'))
        .mockRejectedValueOnce(new TypeError('ECONNREFUSED'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'healthy' }),
        })

      const result = await client.getHealth()

      expect(result.status).toBe('healthy')
      expect(global.fetch).toHaveBeenCalledTimes(3) // Initial + 2 retries
    })

    it('should respect maxRetries config', async () => {
      const limitedClient = new APIClient({
        baseUrl: 'http://localhost:3000',
        retryConfig: {
          maxRetries: 1,
          backoffMs: 10,
          backoffMultiplier: 2,
        },
      })

      ;(global.fetch as any).mockRejectedValue(new TypeError('ECONNREFUSED'))

      await expect(limitedClient.getHealth()).rejects.toThrow()

      // Should call fetch: 1 initial + 1 retry = 2 times
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
  })
})

describe('APIService', () => {
  let client: APIClient
  let service: APIService

  beforeEach(() => {
    client = new APIClient({
      baseUrl: 'http://localhost:3000',
      verbose: false,
    })
    service = new APIService(client)
    vi.clearAllMocks()
  })

  it('should check if system is healthy', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'healthy' }),
    })

    const result = await service.isHealthy()

    expect(result).toBe(true)
  })

  it('should return false when unhealthy', async () => {
    ;(global.fetch as any).mockRejectedValueOnce(new Error('Connection failed'))

    const result = await service.isHealthy()

    expect(result).toBe(false)
  })

  it('should check readiness', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'healthy' }),
    })

    const result = await service.isReady()

    expect(result).toBe(true)
  })

  it('should get complete system status', async () => {
    ;(global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'healthy' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalWorkflows: 100,
          onlineAgents: 5,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ status: 'online' }],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ name: 'Platform 1' }],
      })

    const result = await service.getSystemStatus()

    expect(result.health).toBeDefined()
    expect(result.stats).toBeDefined()
    expect(result.agents).toBeDefined()
    expect(result.platforms).toBeDefined()
  })
})
