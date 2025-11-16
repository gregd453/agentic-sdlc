#!/usr/bin/env node

/**
 * Agentic SDLC CLI - Unified Command Center
 * Entry point for all operational commands
 */

import { Command } from 'commander'
import chalk from 'chalk'
import { logger } from './utils/index.js'
import { EXIT_CODES } from './config/defaults.js'

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
    .action(() => {
      console.log(chalk.blue('Command: start (will be implemented in Task 3)'))
      process.exit(EXIT_CODES.GENERIC_ERROR)
    })

  program
    .command('stop')
    .description('Stop the environment')
    .option('--force', 'Force stop without graceful shutdown')
    .option('--services <services>', 'Specific services to stop')
    .action(() => {
      console.log(chalk.blue('Command: stop (will be implemented in Task 4)'))
      process.exit(EXIT_CODES.GENERIC_ERROR)
    })

  program
    .command('restart [service]')
    .description('Restart services')
    .option('--wait <timeout>', 'Wait timeout in seconds', '120')
    .action(() => {
      console.log(chalk.blue('Command: restart (will be implemented in Task 4)'))
      process.exit(EXIT_CODES.GENERIC_ERROR)
    })

  program
    .command('status')
    .description('Show environment status')
    .option('--watch', 'Watch for changes')
    .option('--interval <ms>', 'Interval in milliseconds', '1000')
    .action(() => {
      console.log(chalk.blue('Command: status (will be implemented in Task 5)'))
      process.exit(EXIT_CODES.GENERIC_ERROR)
    })

  program
    .command('reset')
    .description('Reset environment (⚠️ data loss!)')
    .option('--confirm', 'Skip confirmation prompt')
    .action(() => {
      console.log(chalk.blue('Command: reset (will be implemented in Task 5)'))
      process.exit(EXIT_CODES.GENERIC_ERROR)
    })

  // ========================================
  // HEALTH & DIAGNOSTICS COMMANDS
  // ========================================

  program
    .command('health')
    .description('Check system health')
    .option('--verbose', 'Show detailed information')
    .option('--wait <timeout>', 'Wait for health check (seconds)', '60')
    .action(() => {
      console.log(chalk.blue('Command: health (will be implemented in Task 5)'))
      process.exit(EXIT_CODES.GENERIC_ERROR)
    })

  program
    .command('health:services')
    .description('Check service health only')
    .action(() => {
      console.log(chalk.blue('Command: health:services (will be implemented in Task 5)'))
      process.exit(EXIT_CODES.GENERIC_ERROR)
    })

  program
    .command('health:database')
    .description('Check database connectivity')
    .action(() => {
      console.log(chalk.blue('Command: health:database (will be implemented in Task 5)'))
      process.exit(EXIT_CODES.GENERIC_ERROR)
    })

  program
    .command('health:agents')
    .description('Check agent registration and health')
    .action(() => {
      console.log(chalk.blue('Command: health:agents (will be implemented in Task 5)'))
      process.exit(EXIT_CODES.GENERIC_ERROR)
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
    .action(() => {
      console.log(chalk.blue('Command: logs (will be implemented in Task 6)'))
      process.exit(EXIT_CODES.GENERIC_ERROR)
    })

  program
    .command('metrics')
    .description('Show system metrics')
    .option('--service <service>', 'Filter by service')
    .option('--period <period>', 'Time period (1h, 24h, 7d)', '1h')
    .action(() => {
      console.log(chalk.blue('Command: metrics (will be implemented in Task 14)'))
      process.exit(EXIT_CODES.GENERIC_ERROR)
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
  // ERROR HANDLING & PARSING
  // ========================================

  program.on('command:*', () => {
    console.error(chalk.red('❌ Invalid command'))
    console.log(chalk.gray('Run "agentic-sdlc --help" for usage information'))
    process.exit(EXIT_CODES.INVALID_USAGE)
  })

  program.on('--help', () => {
    console.log('')
    console.log(chalk.blue('Examples:'))
    console.log('  agentic-sdlc start                  Start all services')
    console.log('  agentic-sdlc status --json          Show status as JSON')
    console.log('  agentic-sdlc health --verbose       Detailed health check')
    console.log('  agentic-sdlc test --tier 1          Run Tier 1 tests')
    console.log('')
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
