/**
 * Logs Service - Log aggregation and streaming
 * Handles reading, filtering, and streaming logs from all services
 */

import path from 'path'
import { shell } from '../utils/shell.js'
import { logger } from '../utils/logger.js'
import { ILogsService, TailOptions, StreamOptions, GrepOptions } from '../types/index.js'

const PROJECT_ROOT = process.cwd()
const LOGS_DIR = path.join(PROJECT_ROOT, 'scripts/logs')

export class LogsService implements ILogsService {
  /**
   * Tail logs (show last N lines)
   */
  async tail(options: TailOptions): Promise<string[]> {
    const lines = options.lines || 100
    const service = options.service

    try {
      let logPath: string
      if (service) {
        logPath = path.join(LOGS_DIR, `${service}.log`)
      } else {
        // Aggregate from all services
        return await this.tailAll(lines)
      }

      const result = await shell.exec(`tail -n ${lines} "${logPath}" 2>/dev/null || echo "No logs found"`, {
        ignoreErrors: true,
      })

      return result.stdout.split('\n').filter(line => line.trim())
    } catch (error) {
      logger.error(`Failed to tail logs: ${error}`)
      return []
    }
  }

  /**
   * Stream logs in real-time (--follow equivalent)
   */
  async stream(options: StreamOptions): Promise<NodeJS.ReadableStream> {
    // This is a simplified implementation that returns a readable stream
    // In production, you'd want to use proper streaming
    const { Readable } = await import('stream')
    const service = this

    return new Readable({
      async read() {
        try {
          const lines = await service.tail({
            service: options.service,
            lines: 10,
          })

          for (const line of lines) {
            this.push(line + '\n')
          }

          // In follow mode, keep reading
          if (options.follow) {
            await new Promise(resolve => setTimeout(resolve, 1000))
          } else {
            this.push(null) // End stream
          }
        } catch (error) {
          this.destroy(error as Error)
        }
      },
    })
  }

  /**
   * Search logs with grep pattern
   */
  async grep(pattern: string, options?: GrepOptions): Promise<string[]> {
    const lines = options?.lines || 1000
    const service = options?.service

    try {
      let logPath: string
      if (service) {
        logPath = path.join(LOGS_DIR, `${service}.log`)
      } else {
        // Search all logs
        logPath = path.join(LOGS_DIR, '*.log')
      }

      const result = await shell.exec(
        `grep -i "${pattern}" "${logPath}" 2>/dev/null | tail -n ${lines} || echo "No matches found"`,
        { ignoreErrors: true }
      )

      return result.stdout.split('\n').filter(line => line.trim())
    } catch (error) {
      logger.error(`Failed to grep logs: ${error}`)
      return []
    }
  }

  /**
   * Get PM2 logs via PM2 command
   */
  async getPM2Logs(options: TailOptions): Promise<string[]> {
    try {
      const lines = options.lines || 100
      const service = options.service

      let cmd = `pnpm pm2:logs`
      if (service) {
        cmd = `pnpm pm2 logs ${service} --lines ${lines}`
      }

      const result = await shell.exec(cmd, {
        cwd: PROJECT_ROOT,
        ignoreErrors: true,
      })

      return result.stdout.split('\n').filter(line => line.trim())
    } catch (error) {
      logger.error(`Failed to get PM2 logs: ${error}`)
      return []
    }
  }

  /**
   * Get Docker container logs
   */
  async getDockerLogs(service: string, lines = 100): Promise<string[]> {
    try {
      const containerName = `agentic-sdlc-${service}`
      const result = await shell.exec(
        `docker logs --tail ${lines} "${containerName}" 2>&1 || echo "Container not found"`,
        { ignoreErrors: true }
      )

      return result.stdout.split('\n').filter(line => line.trim())
    } catch (error) {
      logger.error(`Failed to get Docker logs: ${error}`)
      return []
    }
  }

  /**
   * List available log files
   */
  async listLogFiles(): Promise<string[]> {
    try {
      const result = await shell.exec(`find "${LOGS_DIR}" -name "*.log" 2>/dev/null || echo ""`, {
        ignoreErrors: true,
      })

      return result.stdout
        .split('\n')
        .filter(line => line.trim())
        .map(line => path.basename(line))
    } catch (error) {
      logger.error(`Failed to list log files: ${error}`)
      return []
    }
  }

  // ========================================
  // PRIVATE HELPER METHODS
  // ========================================

  private async tailAll(lines: number): Promise<string[]> {
    try {
      const result = await shell.exec(
        `find "${LOGS_DIR}" -name "*.log" -exec tail -n ${lines} {} + 2>/dev/null | tail -n ${lines} || echo "No logs found"`,
        { ignoreErrors: true }
      )

      return result.stdout.split('\n').filter(line => line.trim())
    } catch (error) {
      logger.error(`Failed to tail all logs: ${error}`)
      return []
    }
  }
}

// Export singleton instance
export const logsService = new LogsService()
