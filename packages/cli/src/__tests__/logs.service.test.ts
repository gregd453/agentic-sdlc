/**
 * LogsService Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LogsService } from '../services/logs.service.js'

// Mock shell
vi.mock('../utils/shell.js', () => ({
  shell: {
    exec: vi.fn(),
  },
}))

// Mock logger
vi.mock('../utils/logger.js', () => ({
  logger: {
    error: vi.fn(),
  },
}))

import { shell } from '../utils/shell.js'

describe('LogsService', () => {
  let service: LogsService

  beforeEach(() => {
    service = new LogsService()
    vi.clearAllMocks()
  })

  describe('tail()', () => {
    it('should tail last N lines from logs', async () => {
      const mockLogs = '2025-11-16 10:00:00 INFO Message 1\n2025-11-16 10:00:01 INFO Message 2'
      ;(shell.exec as any).mockResolvedValue({
        stdout: mockLogs,
        success: true,
      })

      const result = await service.tail({ lines: 100 })

      expect(result).toEqual(expect.arrayContaining(['2025-11-16 10:00:00 INFO Message 1']))
      expect(result.length).toBeGreaterThan(0)
    })

    it('should filter logs by service', async () => {
      ;(shell.exec as any).mockResolvedValue({
        stdout: 'orchestrator log line',
        success: true,
      })

      const result = await service.tail({ service: 'orchestrator', lines: 50 })

      expect(result).toBeDefined()
      expect(shell.exec).toHaveBeenCalled()
    })

    it('should handle missing logs gracefully', async () => {
      ;(shell.exec as any).mockResolvedValue({
        stdout: '',
        success: false,
      })

      const result = await service.tail({ lines: 100 })

      expect(result).toEqual([])
    })

    it('should use default line count', async () => {
      ;(shell.exec as any).mockResolvedValue({
        stdout: 'log line',
        success: true,
      })

      const result = await service.tail({})

      expect(result).toBeDefined()
      expect(shell.exec).toHaveBeenCalled()
    })
  })

  describe('grep()', () => {
    it('should search logs for pattern', async () => {
      const matchingLogs = '2025-11-16 ERROR Something failed'
      ;(shell.exec as any).mockResolvedValue({
        stdout: matchingLogs,
        success: true,
      })

      const result = await service.grep('ERROR')

      expect(result).toEqual(expect.arrayContaining([expect.stringContaining('ERROR')]))
    })

    it('should filter grep results by service', async () => {
      ;(shell.exec as any).mockResolvedValue({
        stdout: 'ERROR in service',
        success: true,
      })

      const result = await service.grep('ERROR', { service: 'orchestrator' })

      expect(result).toBeDefined()
    })

    it('should handle no matches', async () => {
      ;(shell.exec as any).mockResolvedValue({
        stdout: '',
        success: true,
      })

      const result = await service.grep('NONEXISTENT')

      expect(result).toEqual([])
    })

    it('should handle grep errors gracefully', async () => {
      ;(shell.exec as any).mockResolvedValue({
        stdout: '',
        success: false,
      })

      const result = await service.grep('ERROR')

      expect(result).toEqual([])
    })
  })

  describe('stream()', () => {
    it('should return readable stream', async () => {
      ;(shell.exec as any).mockResolvedValue({
        stdout: 'log line',
        success: true,
      })

      const stream = await service.stream({})

      expect(stream).toBeDefined()
      expect(stream).toHaveProperty('read')
    })

    it('should support follow mode', async () => {
      ;(shell.exec as any).mockResolvedValue({
        stdout: 'log line',
        success: true,
      })

      const stream = await service.stream({ follow: true })

      expect(stream).toBeDefined()
    })
  })

  describe('getPM2Logs()', () => {
    it('should fetch PM2 logs', async () => {
      ;(shell.exec as any).mockResolvedValue({
        stdout: 'PM2 logs output',
        success: true,
      })

      const result = await service.getPM2Logs({ lines: 100 })

      expect(result).toBeDefined()
    })

    it('should filter PM2 logs by service', async () => {
      ;(shell.exec as any).mockResolvedValue({
        stdout: 'orchestrator logs',
        success: true,
      })

      const result = await service.getPM2Logs({ service: 'orchestrator' })

      expect(result).toBeDefined()
    })

    it('should handle PM2 errors', async () => {
      ;(shell.exec as any).mockResolvedValue({
        stdout: '',
        success: false,
      })

      const result = await service.getPM2Logs({})

      expect(result).toEqual([])
    })
  })

  describe('getDockerLogs()', () => {
    it('should fetch Docker container logs', async () => {
      ;(shell.exec as any).mockResolvedValue({
        stdout: 'Docker logs',
        success: true,
      })

      const result = await service.getDockerLogs('postgres', 50)

      expect(result).toBeDefined()
    })

    it('should handle missing container', async () => {
      ;(shell.exec as any).mockResolvedValue({
        stdout: 'Container not found',
        success: false,
      })

      const result = await service.getDockerLogs('nonexistent')

      expect(result).toEqual([])
    })
  })

  describe('listLogFiles()', () => {
    it('should list available log files', async () => {
      ;(shell.exec as any).mockResolvedValue({
        stdout: '/logs/orchestrator.log\n/logs/dashboard.log',
        success: true,
      })

      const result = await service.listLogFiles()

      expect(result).toEqual(['orchestrator.log', 'dashboard.log'])
    })

    it('should handle missing logs directory', async () => {
      ;(shell.exec as any).mockResolvedValue({
        stdout: '',
        success: false,
      })

      const result = await service.listLogFiles()

      expect(result).toEqual([])
    })
  })
})
