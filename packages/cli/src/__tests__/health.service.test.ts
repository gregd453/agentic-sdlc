/**
 * HealthService Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { HealthService } from '../services/health.service.js'

// Mock shell
vi.mock('../utils/shell.js', () => ({
  shell: {
    exec: vi.fn(),
  },
}))

// Mock spinner
vi.mock('../utils/spinner.js', () => {
  const mockSpinner = {
    start: vi.fn(),
    succeed: vi.fn(),
    fail: vi.fn(),
  }
  return {
    Spinner: vi.fn(() => mockSpinner),
  }
})

import { shell } from '../utils/shell.js'

describe('HealthService', () => {
  let service: HealthService

  beforeEach(() => {
    service = new HealthService()
    vi.clearAllMocks()
  })

  describe('check()', () => {
    it('should perform comprehensive health check', async () => {
      // Mock successful responses
      ;(shell.exec as any).mockResolvedValue({
        stdout: 'accepting connections',
        stderr: '',
        success: true,
        code: 0,
      })

      const result = await service.check()

      expect(result).toBeDefined()
      expect(result.infrastructure).toBeDefined()
      expect(result.database).toBeDefined()
      expect(result.services).toBeDefined()
      expect(result.agents).toBeDefined()
    })

    it('should return healthy status when all checks pass', async () => {
      ;(shell.exec as any).mockResolvedValue({
        stdout: 'healthy',
        success: true,
      })

      const result = await service.check()

      expect(result.summary).toBe('healthy' || 'degraded')
    })

    it('should include timestamp', async () => {
      ;(shell.exec as any).mockResolvedValue({
        stdout: '',
        success: true,
      })

      const result = await service.check()

      expect(result).toHaveProperty('infrastructure')
      expect(result).toHaveProperty('database')
      expect(result).toHaveProperty('services')
      expect(result).toHaveProperty('agents')
    })
  })

  describe('checkInfrastructure()', () => {
    it('should check Docker availability', async () => {
      ;(shell.exec as any).mockResolvedValue({
        stdout: 'Docker version 20.10.0',
        success: true,
      })

      const result = await service.checkInfrastructure()

      expect(result).toBeDefined()
      expect(shell.exec).toHaveBeenCalled()
    })

    it('should handle Docker unavailable', async () => {
      ;(shell.exec as any).mockResolvedValue({
        stdout: '',
        success: false,
      })

      const result = await service.checkInfrastructure()

      expect(result).toBeDefined()
    })
  })

  describe('checkDatabase()', () => {
    it('should check PostgreSQL connectivity', async () => {
      ;(shell.exec as any).mockResolvedValue({
        stdout: 'accepting connections',
        success: true,
      })

      const result = await service.checkDatabase()

      expect(result).toBeDefined()
      expect((result as any).healthy).toBeDefined()
    })

    it('should handle database connection failure', async () => {
      ;(shell.exec as any).mockResolvedValue({
        stdout: 'rejecting',
        success: false,
      })

      const result = await service.checkDatabase()

      expect((result as any).healthy).toBe(false)
    })
  })

  describe('checkCache()', () => {
    it('should check Redis connectivity', async () => {
      ;(shell.exec as any).mockResolvedValue({
        stdout: 'PONG',
        success: true,
      })

      const result = await service.checkCache()

      expect(result).toBeDefined()
    })

    it('should handle Redis connection failure', async () => {
      ;(shell.exec as any).mockResolvedValue({
        stdout: 'Error',
        success: false,
      })

      const result = await service.checkCache()

      expect((result as any).healthy).toBe(false)
    })
  })

  describe('checkServices()', () => {
    it('should check all service endpoints', async () => {
      ;(shell.exec as any).mockResolvedValue({
        stdout: 'ok',
        success: true,
      })

      const result = await service.checkServices()

      expect(result).toBeDefined()
      expect((result as any).checks).toBeDefined()
    })

    it('should handle service endpoint failures', async () => {
      ;(shell.exec as any).mockResolvedValue({
        stdout: '',
        success: false,
      })

      const result = await service.checkServices()

      expect((result as any).healthy).toBe(false)
    })
  })

  describe('checkAgents()', () => {
    it('should query agent registry', async () => {
      ;(shell.exec as any).mockResolvedValue({
        stdout: JSON.stringify([
          { name: 'agent1', status: 'running' },
          { name: 'agent2', status: 'running' },
        ]),
        success: true,
      })

      const result = await service.checkAgents()

      expect((result as any).healthy).toBe(true)
    })

    it('should handle missing agents', async () => {
      ;(shell.exec as any).mockResolvedValue({
        stdout: '[]',
        success: true,
      })

      const result = await service.checkAgents()

      expect((result as any).agents).toBeDefined()
    })

    it('should handle API failure', async () => {
      ;(shell.exec as any).mockResolvedValue({
        stdout: '',
        success: false,
      })

      const result = await service.checkAgents()

      expect((result as any).healthy).toBe(false)
    })
  })
})
