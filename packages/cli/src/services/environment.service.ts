/**
 * Environment Service - Manages Docker + PM2 services
 * Handles startup, shutdown, and status of all development services
 */

import path from 'path'
import chalk from 'chalk'
import { shell } from '../utils/shell.js'
import { logger } from '../utils/logger.js'
import { Spinner } from '../utils/spinner.js'
import { IEnvironmentService } from '../types/index.js'

const PROJECT_ROOT = process.cwd()
const DOCKER_COMPOSE_FILE = path.join(PROJECT_ROOT, 'docker-compose.yml')
const LOGS_DIR = path.join(PROJECT_ROOT, 'scripts/logs')

const DOCKER_SERVICES = {
  database: 'postgres',
  cache: 'redis',
  ui: 'dashboard',
  analytics: 'analytics-service',
}

export class EnvironmentService implements IEnvironmentService {
  private skipBuild: boolean
  private forceBuild: boolean
  private waitTimeout: number

  constructor(_verbose = false, skipBuild = false, forceBuild = false, waitTimeout = 120) {
    this.skipBuild = skipBuild
    this.forceBuild = forceBuild
    this.waitTimeout = waitTimeout
  }

  /**
   * Start the complete development environment
   */
  async start(): Promise<void> {
    try {
      logger.info('Starting Agentic SDLC development environment')

      // Step 1: Create logs directory
      await this.ensureLogsDirectory()

      // Step 2: Start Docker containers
      await this.startDockerContainers()

      // Step 3: Build packages (unless skipped)
      if (!this.skipBuild) {
        await this.buildPackages()
      } else {
        logger.info('Skipping build step (--skip-build flag)')
      }

      // Step 4: Validate build artifacts
      await this.validateBuildArtifacts()

      // Step 5: Start PM2 processes
      await this.startPM2Processes()

      // Step 6: Wait for services to be healthy
      await this.waitForServices()

      // Step 7: Start analytics service (non-critical)
      await this.startAnalyticsService()

      console.log(chalk.green('✓ Development environment ready!'))
      this.printServiceStatus()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error(`Failed to start environment: ${message}`)
      throw error
    }
  }

  /**
   * Stop the environment
   */
  async stop(force = false): Promise<void> {
    try {
      logger.info('Stopping development environment')

      // Stop PM2 processes
      const pmCmd = force ? 'pnpm pm2:kill' : 'pnpm pm2:stop'
      await shell.exec(pmCmd, { cwd: PROJECT_ROOT })

      // Stop Docker containers
      await shell.exec(`docker-compose -f "${DOCKER_COMPOSE_FILE}" down`, {
        cwd: PROJECT_ROOT,
        ignoreErrors: true,
      })

      console.log(chalk.green('✓ Environment stopped'))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error(`Failed to stop environment: ${message}`)
      throw error
    }
  }

  /**
   * Restart services
   */
  async restart(service?: string): Promise<void> {
    try {
      if (service) {
        logger.info(`Restarting service: ${service}`)
        await shell.exec(`pnpm pm2:restart ${service}`, { cwd: PROJECT_ROOT })
      } else {
        logger.info('Restarting all services')
        await this.stop()
        await this.start()
      }
      console.log(chalk.green('✓ Services restarted'))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error(`Failed to restart services: ${message}`)
      throw error
    }
  }

  /**
   * Get environment status
   */
  async status(): Promise<Record<string, unknown>> {
    const services: Record<string, string> = {}

    // Check Docker containers
    for (const [name, service] of Object.entries(DOCKER_SERVICES)) {
      const result = await shell.exec(
        `docker ps --filter "name=${service}" --format "{{.Status}}"`,
        { ignoreErrors: true }
      )
      services[name] = result.stdout ? 'running' : 'stopped'
    }

    // Check PM2 processes
    const pmResult = await shell.exec('pnpm pm2:status', {
      cwd: PROJECT_ROOT,
      ignoreErrors: true,
    })

    return {
      services,
      pm2_status: pmResult.stdout,
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Reset environment (data loss!)
   */
  async reset(): Promise<void> {
    try {
      logger.warn('⚠️ Resetting environment will delete all data!')
      logger.info('Stopping all services...')

      await this.stop(true)

      logger.info('Removing Docker volumes...')
      await shell.exec(
        `docker-compose -f "${DOCKER_COMPOSE_FILE}" down -v`,
        { cwd: PROJECT_ROOT, ignoreErrors: true }
      )

      logger.info('Clearing logs...')
      await shell.exec(`rm -rf "${LOGS_DIR}"/*`, { ignoreErrors: true })

      console.log(chalk.green('✓ Environment reset'))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error(`Failed to reset environment: ${message}`)
      throw error
    }
  }

  // ========================================
  // PRIVATE HELPER METHODS
  // ========================================

  private async ensureLogsDirectory(): Promise<void> {
    const result = await shell.exec(`mkdir -p "${LOGS_DIR}"`, { cwd: PROJECT_ROOT })
    if (!result.success) {
      throw new Error(`Failed to create logs directory: ${result.stderr}`)
    }
  }

  private async startDockerContainers(): Promise<void> {
    const spin = new Spinner()
    spin.start('Starting Docker containers (PostgreSQL, Redis, Dashboard)')

    try {
      // Start containers
      const result = await shell.exec(
        `docker-compose -f "${DOCKER_COMPOSE_FILE}" up -d postgres redis dashboard 2>/dev/null || docker-compose -f "${DOCKER_COMPOSE_FILE}" up -d 2>/dev/null`,
        { cwd: PROJECT_ROOT }
      )

      if (!result.success) {
        throw new Error(`Docker startup failed: ${result.stderr}`)
      }

      // Wait for containers to be healthy
      await this.sleep(5000)

      // Check PostgreSQL
      let healthy = false
      for (let i = 0; i < 10; i++) {
        const pgResult = await shell.exec(
          'docker exec agentic-sdlc-postgres pg_isready -U agentic',
          { ignoreErrors: true }
        )
        if (pgResult.stdout.includes('accepting')) {
          healthy = true
          break
        }
        await this.sleep(1000)
      }

      if (!healthy) {
        throw new Error('PostgreSQL failed to become ready')
      }

      // Check Redis
      healthy = false
      for (let i = 0; i < 10; i++) {
        const redisResult = await shell.exec(
          'docker exec agentic-sdlc-redis redis-cli ping',
          { ignoreErrors: true }
        )
        if (redisResult.stdout.includes('PONG')) {
          healthy = true
          break
        }
        await this.sleep(1000)
      }

      if (!healthy) {
        throw new Error('Redis failed to become ready')
      }

      spin.succeed(chalk.green('✓ Docker containers started'))
    } catch (error) {
      spin.fail(chalk.red('✗ Docker startup failed'))
      throw error
    }
  }

  private async buildPackages(): Promise<void> {
    const spin = new Spinner()
    spin.start(
      this.forceBuild ? 'Force rebuilding all packages' : 'Ensuring latest builds'
    )

    try {
      const buildCmd = this.forceBuild ? 'pnpm build --force' : 'pnpm build'
      const result = await shell.exec(buildCmd, {
        cwd: PROJECT_ROOT,
        timeout: 300000, // 5 minutes
      })

      if (!result.success) {
        throw new Error(`Build failed: ${result.stderr}`)
      }

      spin.succeed(
        this.forceBuild ? chalk.green('✓ All packages rebuilt') : chalk.green('✓ Packages built (or cached)')
      )
    } catch (error) {
      spin.fail(chalk.red('✗ Build failed'))
      throw error
    }
  }

  private async validateBuildArtifacts(): Promise<void> {
    const spin = new Spinner()
    spin.start('Validating build artifacts')

    try {
      const result = await shell.exec(
        `bash "${PROJECT_ROOT}/scripts/pm2-preflight.sh"`,
        { cwd: PROJECT_ROOT }
      )

      if (!result.success) {
        throw new Error('Build artifacts validation failed')
      }

      spin.succeed(chalk.green('✓ Build artifacts validated'))
    } catch (error) {
      spin.fail(chalk.red('✗ Build validation failed'))
      throw error
    }
  }

  private async startPM2Processes(): Promise<void> {
    const spin = new Spinner()
    spin.start('Starting PM2 processes (orchestrator + agents)')

    try {
      const result = await shell.exec('pnpm pm2:start', {
        cwd: PROJECT_ROOT,
      })

      if (!result.success) {
        throw new Error(`PM2 startup failed: ${result.stderr}`)
      }

      spin.succeed(chalk.green('✓ PM2 processes started'))
    } catch (error) {
      spin.fail(chalk.red('✗ PM2 startup failed'))
      throw error
    }
  }

  private async waitForServices(): Promise<void> {
    const criticalServices: Array<{ name: string; url?: string | null; port: number; cmd?: string }> = [
      { name: 'PostgreSQL', url: null, port: 5433, cmd: 'docker exec agentic-sdlc-postgres pg_isready -U agentic' },
      { name: 'Redis', url: null, port: 6380, cmd: 'docker exec agentic-sdlc-redis redis-cli ping' },
      { name: 'Orchestrator', url: 'http://localhost:3000/api/v1/health', port: 3000 },
      { name: 'Dashboard', url: 'http://localhost:3001', port: 3001 },
    ]

    const spin = new Spinner()
    spin.start('Waiting for services to be ready')

    try {
      for (const service of criticalServices) {
        let ready = false

        for (let i = 0; i < this.waitTimeout; i++) {
          if (service.url) {
            const healthResult = await shell.exec(`curl -s ${service.url} 2>/dev/null`, {
              ignoreErrors: true,
            })
            if (healthResult.success && healthResult.stdout) {
              ready = true
              break
            }
          } else if (service.cmd) {
            const healthResult = await shell.exec(service.cmd, {
              ignoreErrors: true,
            })
            if (healthResult.success && (healthResult.stdout.includes('accepting') || healthResult.stdout.includes('PONG'))) {
              ready = true
              break
            }
          }

          await this.sleep(1000)
        }

        if (!ready) {
          throw new Error(`${service.name} failed to become ready on port ${service.port}`)
        }
      }

      spin.succeed(chalk.green('✓ All critical services ready'))
    } catch (error) {
      spin.fail(chalk.red('✗ Service startup failed'))
      throw error
    }
  }

  private async startAnalyticsService(): Promise<void> {
    const spin = new Spinner()
    spin.start('Starting Analytics Service (non-critical)')

    try {
      // Check if already running
      const psResult = await shell.exec('docker ps --filter "name=agentic-sdlc-analytics" --format "{{.Status}}"', {
        ignoreErrors: true,
      })

      if (psResult.stdout) {
        // Already running, stop it first
        await shell.exec(
          `docker-compose -f "${DOCKER_COMPOSE_FILE}" down analytics-service 2>/dev/null`,
          { cwd: PROJECT_ROOT, ignoreErrors: true }
        )
        await this.sleep(2000)
      }

      // Start analytics service
      const result = await shell.exec(
        `docker-compose -f "${DOCKER_COMPOSE_FILE}" up -d analytics-service`,
        { cwd: PROJECT_ROOT }
      )

      if (!result.success) {
        spin.warn(chalk.yellow('! Analytics Service startup non-critical'))
        return
      }

      // Wait for it to be ready
      for (let i = 0; i < 30; i++) {
        const healthResult = await shell.exec(
          'curl -s http://localhost:3002/health 2>/dev/null',
          { ignoreErrors: true }
        )

        if (healthResult.success && healthResult.stdout.includes('healthy')) {
          spin.succeed(chalk.green('✓ Analytics Service ready'))
          return
        }

        await this.sleep(1000)
      }

      spin.warn(chalk.yellow('! Analytics Service may not be ready (non-critical)'))
    } catch (error) {
      spin.warn(chalk.yellow('! Analytics Service startup non-critical'))
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private printServiceStatus(): void {
    console.log('')
    console.log('Services running:')
    console.log('  PostgreSQL       → localhost:5433')
    console.log('  Redis            → localhost:6380')
    console.log('  Orchestrator     → http://localhost:3000')
    console.log('  Dashboard        → http://localhost:3001')
    console.log('  Analytics Service → http://localhost:3002')
    console.log('')
    console.log('PM2 Management:')
    console.log('  pnpm pm2:status  → Show process status')
    console.log('  pnpm pm2:logs    → Tail all logs')
    console.log('  pnpm pm2:monit   → Live monitoring dashboard')
    console.log('')
    console.log('Quick Links:')
    console.log('  Orchestrator API → http://localhost:3000/api/v1/health')
    console.log('  Dashboard UI     → http://localhost:3001')
    console.log('  Analytics API    → http://localhost:3002/health')
    console.log('')
    console.log(`Logs directory: ${LOGS_DIR}`)
    console.log('')
  }
}

// Export singleton instance
export const environmentService = new EnvironmentService()
