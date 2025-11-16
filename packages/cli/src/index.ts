#!/usr/bin/env node

/**
 * Agentic SDLC CLI - Unified Command Center
 * Entry point for all operational commands
 */

import { Command } from 'commander'
import chalk from 'chalk'
import { logger, shell } from './utils/index.js'
import { EXIT_CODES } from './config/defaults.js'
import { EnvironmentService, HealthService, LogsService } from './services/index.js'

const PROJECT_ROOT = process.cwd()

/**
 * Main CLI application
 */
async function main() {
  const program = new Command()

  program
    .name('agentic-sdlc')
    .description('Unified Command Center for Agentic SDLC Platform')
    .version('1.0.0')

  // Global options
  program
    .option('-v, --verbose', 'Enable verbose output')
    .option('-j, --json', 'Output as JSON')
    .option('-y, --yaml', 'Output as YAML')

  // Initialize logger with global verbose flag
  program.hook('preAction', () => {
    const opts = program.opts()
    if (opts.verbose) {
      logger.getLogs() // Note: logger already checks VERBOSE env var
    }
  })

  // ========================================
  // ENVIRONMENT COMMANDS
  // ========================================

  program
    .command('start')
    .description('Start the environment')
    .option('--services <services>', 'Specific services to start (comma-separated)')
    .option('--skip-build', 'Skip build step')
    .option('--wait <timeout>', 'Wait timeout in seconds', '120')
    .action(async options => {
      try {
        const waitTimeout = parseInt(options.wait, 10)
        const service = new EnvironmentService(
          program.opts().verbose || false,
          options.skipBuild || false,
          false,
          waitTimeout
        )
        await service.start()
        process.exit(EXIT_CODES.SUCCESS)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error(`Start failed: ${message}`)
        process.exit(EXIT_CODES.GENERIC_ERROR)
      }
    })

  program
    .command('stop')
    .description('Stop the environment')
    .option('--force', 'Force stop without graceful shutdown')
    .option('--services <services>', 'Specific services to stop')
    .action(async options => {
      try {
        const service = new EnvironmentService(program.opts().verbose || false)
        await service.stop(options.force || false)
        process.exit(EXIT_CODES.SUCCESS)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error(`Stop failed: ${message}`)
        process.exit(EXIT_CODES.GENERIC_ERROR)
      }
    })

  program
    .command('restart [service]')
    .description('Restart services')
    .option('--wait <timeout>', 'Wait timeout in seconds', '120')
    .action(async (service, options) => {
      try {
        const waitTimeout = parseInt(options.wait, 10)
        const envService = new EnvironmentService(program.opts().verbose || false, false, false, waitTimeout)
        await envService.restart(service || undefined)
        process.exit(EXIT_CODES.SUCCESS)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error(`Restart failed: ${message}`)
        process.exit(EXIT_CODES.GENERIC_ERROR)
      }
    })

  program
    .command('status')
    .description('Show environment status')
    .option('--watch', 'Watch for changes')
    .option('--interval <ms>', 'Interval in milliseconds', '1000')
    .action(async options => {
      try {
        const service = new EnvironmentService(program.opts().verbose || false)
        const status = await service.status()

        if (program.opts().json) {
          console.log(JSON.stringify(status, null, 2))
        } else {
          console.log(chalk.blue('\n📊 Environment Status:\n'))
          console.log(JSON.stringify(status, null, 2))
        }

        if (options.watch) {
          const interval = parseInt(options.interval, 10)
          setInterval(async () => {
            const newStatus = await service.status()
            console.clear()
            console.log(chalk.blue('\n📊 Environment Status (auto-refreshing):\n'))
            console.log(JSON.stringify(newStatus, null, 2))
          }, interval)
        }

        process.exit(EXIT_CODES.SUCCESS)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error(`Status check failed: ${message}`)
        process.exit(EXIT_CODES.GENERIC_ERROR)
      }
    })

  program
    .command('reset')
    .description('Reset environment (⚠️ data loss!)')
    .option('--confirm', 'Skip confirmation prompt')
    .action(async options => {
      try {
        if (!options.confirm) {
          console.log(chalk.red('⚠️  WARNING: This will DELETE all data in the environment!'))
          console.log(chalk.red('⚠️  Databases will be reset, all workflows will be lost.'))
          console.log('')
          console.log('Run with --confirm to proceed')
          process.exit(EXIT_CODES.GENERIC_ERROR)
        }

        const service = new EnvironmentService(program.opts().verbose || false)
        await service.reset()
        process.exit(EXIT_CODES.SUCCESS)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error(`Reset failed: ${message}`)
        process.exit(EXIT_CODES.GENERIC_ERROR)
      }
    })

  // ========================================
  // HEALTH & DIAGNOSTICS COMMANDS
  // ========================================

  program
    .command('health')
    .description('Check system health')
    .option('--verbose', 'Show detailed information')
    .option('--wait <timeout>', 'Wait for health check (seconds)', '60')
    .action(async () => {
      try {
        const service = new HealthService()
        const result = await service.check()

        if (program.opts().json) {
          console.log(JSON.stringify(result, null, 2))
        } else {
          console.log('')
          console.log(chalk.blue('📋 System Health Report'))
          console.log(chalk.gray(`Overall Status: ${result.summary === 'healthy' ? chalk.green('✓ HEALTHY') : chalk.yellow('⚠ DEGRADED')}`))
          console.log('')
          console.log(JSON.stringify(result, null, 2))
        }

        const exitCode = result.summary === 'healthy' ? EXIT_CODES.SUCCESS : 1
        process.exit(exitCode)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error(`Health check failed: ${message}`)
        process.exit(EXIT_CODES.GENERIC_ERROR)
      }
    })

  program
    .command('health:services')
    .description('Check service health only')
    .action(async () => {
      try {
        const service = new HealthService()
        const result = await service.checkServices()

        if (program.opts().json) {
          console.log(JSON.stringify(result, null, 2))
        } else {
          console.log(chalk.blue('\n🔧 Service Health:\n'))
          console.log(JSON.stringify(result, null, 2))
        }

        process.exit(EXIT_CODES.SUCCESS)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error(`Service health check failed: ${message}`)
        process.exit(EXIT_CODES.GENERIC_ERROR)
      }
    })

  program
    .command('health:database')
    .description('Check database connectivity')
    .action(async () => {
      try {
        const service = new HealthService()
        const result = await service.checkDatabase()

        if (program.opts().json) {
          console.log(JSON.stringify(result, null, 2))
        } else {
          console.log(chalk.blue('\n💾 Database Health:\n'))
          console.log(JSON.stringify(result, null, 2))
        }

        const healthy = (result as any).healthy
        process.exit(healthy ? EXIT_CODES.SUCCESS : 1)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error(`Database health check failed: ${message}`)
        process.exit(EXIT_CODES.GENERIC_ERROR)
      }
    })

  program
    .command('health:agents')
    .description('Check agent registration and health')
    .action(async () => {
      try {
        const service = new HealthService()
        const result = await service.checkAgents()

        if (program.opts().json) {
          console.log(JSON.stringify(result, null, 2))
        } else {
          console.log(chalk.blue('\n🤖 Agent Health:\n'))
          console.log(JSON.stringify(result, null, 2))
        }

        const healthy = (result as any).healthy
        process.exit(healthy ? EXIT_CODES.SUCCESS : 1)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error(`Agent health check failed: ${message}`)
        process.exit(EXIT_CODES.GENERIC_ERROR)
      }
    })

  // ========================================
  // LOGS & MONITORING COMMANDS
  // ========================================

  program
    .command('logs')
    .description('View logs')
    .option('--service <service>', 'Filter by service')
    .option('--follow', 'Stream logs continuously')
    .option('--lines <number>', 'Number of lines to show', '100')
    .option('--grep <pattern>', 'Filter by pattern')
    .action(async options => {
      try {
        const service = new LogsService()
        const lines = parseInt(options.lines, 10)

        let result: string[]

        if (options.grep) {
          result = await service.grep(options.grep, {
            service: options.service,
            lines,
          })
        } else {
          result = await service.tail({
            service: options.service,
            lines,
          })
        }

        if (program.opts().json) {
          console.log(JSON.stringify({ logs: result }, null, 2))
        } else {
          console.log(chalk.blue(`\n📋 Logs${options.service ? ` (${options.service})` : ' (all services)'}:\n`))
          result.forEach(line => console.log(line))
        }

        process.exit(EXIT_CODES.SUCCESS)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error(`Failed to retrieve logs: ${message}`)
        process.exit(EXIT_CODES.GENERIC_ERROR)
      }
    })

  program
    .command('metrics')
    .description('Show system metrics')
    .option('--service <service>', 'Filter by service')
    .option('--period <period>', 'Time period (1h, 24h, 7d)', '1h')
    .action(async options => {
      try {
        const result = await shell.exec('pnpm pm2:monit', {
          cwd: PROJECT_ROOT,
          ignoreErrors: true,
        })

        if (program.opts().json) {
          console.log(JSON.stringify({ metrics: result.stdout }, null, 2))
        } else {
          console.log(chalk.blue(`\n📊 System Metrics (${options.period}):\n`))
          console.log(result.stdout)
        }

        process.exit(EXIT_CODES.SUCCESS)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error(`Failed to retrieve metrics: ${message}`)
        process.exit(EXIT_CODES.GENERIC_ERROR)
      }
    })

  // ========================================
  // TESTING COMMANDS
  // ========================================

  program
    .command('test')
    .description('Run tests')
    .option('--tier <number>', 'Run specific tier (1-4)')
    .option('--match <pattern>', 'Run tests matching pattern')
    .option('--parallel', 'Run tests in parallel')
    .option('--timeout <ms>', 'Test timeout in milliseconds', '120000')
    .action(() => {
      console.log(chalk.blue('Command: test (will be implemented in Task 9)'))
      process.exit(EXIT_CODES.GENERIC_ERROR)
    })

  program
    .command('test:units')
    .description('Run unit tests only')
    .action(() => {
      console.log(chalk.blue('Command: test:units (will be implemented in Task 9)'))
      process.exit(EXIT_CODES.GENERIC_ERROR)
    })

  program
    .command('test:integration')
    .description('Run integration tests only')
    .action(() => {
      console.log(chalk.blue('Command: test:integration (will be implemented in Task 9)'))
      process.exit(EXIT_CODES.GENERIC_ERROR)
    })

  program
    .command('test:e2e')
    .description('Run E2E tests')
    .action(() => {
      console.log(chalk.blue('Command: test:e2e (will be implemented in Task 9)'))
      process.exit(EXIT_CODES.GENERIC_ERROR)
    })

  program
    .command('validate:ci')
    .description('Validate before commit')
    .option('--local', 'Test locally before push')
    .action(() => {
      console.log(chalk.blue('Command: validate:ci (will be implemented in Task 16)'))
      process.exit(EXIT_CODES.GENERIC_ERROR)
    })

  // ========================================
  // DEPLOYMENT & DATABASE COMMANDS
  // ========================================

  program
    .command('deploy')
    .description('Deploy to environment')
    .option('--env <environment>', 'Target environment (staging|production)')
    .option('--dry-run', 'Show what would deploy')
    .option('--approve', 'Auto-approve deployment')
    .action(() => {
      console.log(chalk.blue('Command: deploy (will be implemented in Task 10)'))
      process.exit(EXIT_CODES.GENERIC_ERROR)
    })

  program
    .command('db:setup')
    .description('Setup database')
    .action(() => {
      console.log(chalk.blue('Command: db:setup (will be implemented in Task 11)'))
      process.exit(EXIT_CODES.GENERIC_ERROR)
    })

  program
    .command('db:migrate')
    .description('Run database migrations')
    .action(() => {
      console.log(chalk.blue('Command: db:migrate (will be implemented in Task 11)'))
      process.exit(EXIT_CODES.GENERIC_ERROR)
    })

  program
    .command('db:reset')
    .description('Reset database (⚠️ data loss!)')
    .option('--confirm', 'Skip confirmation')
    .action(() => {
      console.log(chalk.blue('Command: db:reset (will be implemented in Task 11)'))
      process.exit(EXIT_CODES.GENERIC_ERROR)
    })

  // ========================================
  // WORKFLOW & AGENT COMMANDS
  // ========================================

  program
    .command('workflows:list')
    .description('List all workflows')
    .option('--status <status>', 'Filter by status')
    .action(() => {
      console.log(chalk.blue('Command: workflows:list (will be implemented in Task 12)'))
      process.exit(EXIT_CODES.GENERIC_ERROR)
    })

  program
    .command('agents:list')
    .description('List all agents')
    .action(() => {
      console.log(chalk.blue('Command: agents:list (will be implemented in Task 12)'))
      process.exit(EXIT_CODES.GENERIC_ERROR)
    })

  program
    .command('agents:status')
    .description('Check agent status')
    .option('--platform <platform>', 'Filter by platform')
    .action(() => {
      console.log(chalk.blue('Command: agents:status (will be implemented in Task 12)'))
      process.exit(EXIT_CODES.GENERIC_ERROR)
    })

  // ========================================
  // CONFIGURATION COMMANDS
  // ========================================

  program
    .command('config')
    .description('Show configuration')
    .option('--key <key>', 'Get specific config key')
    .action(() => {
      console.log(chalk.blue('Command: config (will be implemented in Task 13)'))
      process.exit(EXIT_CODES.GENERIC_ERROR)
    })

  // ========================================
  // COMMAND ALIASES (user-friendly shortcuts)
  // ========================================

  // Register command aliases (note: aliases defined in package.json bin scripts)
  // Users can use: agentic-sdlc-up, agentic-sdlc-down, agentic-sdlc-reload
  // Or use: agentic-sdlc start, agentic-sdlc stop, agentic-sdlc restart

  // ========================================
  // HELP COMMANDS
  // ========================================

  program
    .command('help')
    .description('Show help information')
    .action(() => {
      program.outputHelp()
    })

  program.on('--help', () => {
    console.log('')
    console.log(chalk.blue('📚 Examples:'))
    console.log('')
    console.log(chalk.green('  Environment Management:'))
    console.log('    agentic-sdlc start                Start all services')
    console.log('    agentic-sdlc stop                 Stop services gracefully')
    console.log('    agentic-sdlc status --watch       Watch status in real-time')
    console.log('    agentic-sdlc reset --confirm      Reset environment')
    console.log('')
    console.log(chalk.green('  Health & Diagnostics:'))
    console.log('    agentic-sdlc health               Full system health check')
    console.log('    agentic-sdlc health:services      Check services only')
    console.log('    agentic-sdlc health --json        JSON output for automation')
    console.log('')
    console.log(chalk.green('  Logs & Monitoring:'))
    console.log('    agentic-sdlc logs --grep ERROR    Search logs for errors')
    console.log('    agentic-sdlc logs --follow        Stream logs in real-time')
    console.log('    agentic-sdlc metrics --period 24h Show 24-hour metrics')
    console.log('')
    console.log(chalk.green('  Global Options:'))
    console.log('    -v, --verbose                     Enable verbose output')
    console.log('    -j, --json                        Output as JSON')
    console.log('    -y, --yaml                        Output as YAML')
    console.log('    -h, --help                        Show this help')
    console.log('')
    console.log(chalk.gray('  For help on a specific command:'))
    console.log('    agentic-sdlc <command> --help')
    console.log('')
  })

  // ========================================
  // ERROR HANDLING & PARSING
  // ========================================

  program.on('command:*', () => {
    console.error(chalk.red('❌ Invalid command'))
    console.log(chalk.gray('Run "agentic-sdlc --help" for usage information'))
    process.exit(EXIT_CODES.INVALID_USAGE)
  })

  // ========================================
  // PARSE AND RUN
  // ========================================

  try {
    await program.parseAsync(process.argv)

    if (!process.argv.slice(2).length) {
      program.outputHelp()
    }
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : String(error))
    process.exit(EXIT_CODES.GENERIC_ERROR)
  }
}

// Run main
main().catch(error => {
  console.error(chalk.red('Fatal error:'), error)
  process.exit(EXIT_CODES.GENERIC_ERROR)
})

export default main
