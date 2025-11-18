/**
 * Health Service - System health checks
 * Monitors infrastructure, database, services, and application health
 */

import chalk from 'chalk'
import { shell } from '../utils/shell.js'
import { Spinner } from '../utils/spinner.js'
import { IHealthService, HealthCheckResult } from '../types/index.js'

export class HealthService implements IHealthService {
  /**
   * Run full health check
   */
  async check(): Promise<HealthCheckResult> {
    const spin = new Spinner()
    spin.start('Running comprehensive health check')

    try {
      const infrastructureInfo = await this.checkInfrastructure()
      const dbInfo = await this.checkDatabase()
      const servicesInfo = await this.checkServices()
      const agentsInfo = await this.checkAgents()

      const infrastructure = (infrastructureInfo as any).checks || {}
      const database = (dbInfo as any).postgres || {}
      const services = (servicesInfo as any).checks || {}
      const agents = (agentsInfo as any).agents || {}

      // Determine overall health
      const allHealthy = [
        (infrastructureInfo as any).healthy,
        (dbInfo as any).healthy,
        (servicesInfo as any).healthy,
        (agentsInfo as any).healthy,
      ].every(h => h === true)

      const results: HealthCheckResult = {
        infrastructure: {
          docker: !!(infrastructure.docker?.status === 'ok'),
          memory: { used: 0, total: 0 },
          disk: { free: 0, total: 0 },
          ports: infrastructure.ports || {},
        },
        database: {
          connected: !!(database.status === 'ok'),
          latency: undefined,
          migrations: undefined,
        },
        messageBus: {
          connected: true,
          latency: undefined,
        },
        services: Object.entries(services).map(([name, info]) => ({
          name,
          status: ((info as any).status === 'ok' ? 'running' : 'stopped') as 'running' | 'stopped' | 'error',
          healthy: (info as any).status === 'ok',
          port: (info as any).port,
        })),
        agents: {
          total: (agents.count as number) || 0,
          healthy: (agents.count as number) || 0,
          unhealthy: [],
        },
        summary: allHealthy ? 'healthy' : 'degraded',
      }

      spin.succeed('✓ Health check completed')
      return results
    } catch (error) {
      spin.fail('✗ Health check failed')
      throw error
    }
  }

  /**
   * Check infrastructure health
   */
  async checkInfrastructure() {
    const checks = {
      docker: await this.checkDocker(),
      ports: await this.checkPorts(),
      disk: await this.checkDisk(),
    }

    const healthy = Object.values(checks).every(c => c.status === 'ok')
    return { healthy, checks }
  }

  /**
   * Check database connectivity
   */
  async checkDatabase() {
    const spin = new Spinner()
    spin.start('Checking database...')

    try {
      const result = await shell.exec(
        'docker exec agentic-sdlc-postgres pg_isready -U agentic',
        { ignoreErrors: true }
      )

      const status = result.stdout.includes('accepting') ? 'ok' : 'error'
      spin.succeed(chalk.green(`✓ PostgreSQL: ${status}`))

      return {
        healthy: status === 'ok',
        postgres: { status, port: 5433 },
      }
    } catch (error) {
      spin.fail('PostgreSQL check failed')
      return {
        healthy: false,
        postgres: { status: 'error', port: 5433, error: String(error) },
      }
    }
  }

  /**
   * Check cache (Redis) health
   */
  async checkCache() {
    const spin = new Spinner()
    spin.start('Checking cache...')

    try {
      const result = await shell.exec(
        'docker exec agentic-sdlc-redis redis-cli ping',
        { ignoreErrors: true }
      )

      const status = result.stdout.includes('PONG') ? 'ok' : 'error'
      spin.succeed(chalk.green(`✓ Redis: ${status}`))

      return {
        healthy: status === 'ok',
        redis: { status, port: 6380 },
      }
    } catch (error) {
      spin.fail('Redis check failed')
      return {
        healthy: false,
        redis: { status: 'error', port: 6380, error: String(error) },
      }
    }
  }

  /**
   * Check services health
   */
  async checkServices() {
    const services = {
      orchestrator: { port: 3000, url: 'http://localhost:3000/api/v1/health' },
      dashboard: { port: 3001, url: 'http://localhost:3001' },
      analytics: { port: 3002, url: 'http://localhost:3002/health' },
    }

    const checks: Record<string, any> = {}

    for (const [name, config] of Object.entries(services)) {
      const result = await shell.exec(`curl -s ${config.url} 2>/dev/null`, {
        ignoreErrors: true,
      })

      checks[name] = {
        status: result.success && result.stdout ? 'ok' : 'error',
        port: config.port,
        url: config.url,
      }
    }

    const healthy = Object.values(checks).every((c: any) => c.status === 'ok')
    return { healthy, checks }
  }

  /**
   * Check agent registration and health
   */
  async checkAgents() {
    try {
      const result = await shell.exec(
        'curl -s http://localhost:3000/api/v1/agents 2>/dev/null',
        { ignoreErrors: true }
      )

      if (!result.success || !result.stdout) {
        return {
          healthy: false,
          agents: { status: 'error', count: 0 },
        }
      }

      try {
        const agentsData = JSON.parse(result.stdout)
        const count = Array.isArray(agentsData) ? agentsData.length : 0
        return {
          healthy: count > 0,
          agents: { status: 'ok', count },
        }
      } catch {
        return {
          healthy: false,
          agents: { status: 'error', count: 0 },
        }
      }
    } catch (error) {
      return {
        healthy: false,
        agents: { status: 'error', count: 0, error: String(error) },
      }
    }
  }

  // ========================================
  // PRIVATE HELPER METHODS
  // ========================================

  private async checkDocker() {
    const result = await shell.exec('docker --version', { ignoreErrors: true })
    return {
      status: result.success ? 'ok' : 'error',
      version: result.stdout.trim(),
    }
  }

  private async checkPorts() {
    const ports = [3000, 3001, 3002, 5433, 6380]
    const available: Record<number, boolean> = {}

    for (const port of ports) {
      const result = await shell.exec(
        `lsof -i :${port} 2>/dev/null || netstat -an 2>/dev/null | grep ${port}`,
        { ignoreErrors: true }
      )
      available[port] = result.success
    }

    return {
      status: 'ok',
      ports: available,
    }
  }

  private async checkDisk() {
    const result = await shell.exec('df -h / | tail -1', { ignoreErrors: true })
    return {
      status: result.success ? 'ok' : 'error',
      usage: result.stdout.trim(),
    }
  }
}

// Export singleton instance
export const healthService = new HealthService()
