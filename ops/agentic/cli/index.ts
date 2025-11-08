/**
 * Main CLI Entry Point for Agentic SDLC
 * Usage: cc-agentic <command> [options]
 */

import { runDecisionsCLI } from './decisions';
import { runClarifyCLI } from './clarify';

const VERSION = '1.0.0';

const COMMANDS = {
  decisions: 'Decision evaluation and management',
  clarify: 'Clarification requests and answers',
  help: 'Show this help message',
};

// Global CLI options
export interface GlobalOptions {
  quiet?: boolean;
  verbose?: boolean;
}

// Logger utility that respects quiet/verbose flags
export const logger = {
  log: (message: string, options: GlobalOptions = {}) => {
    if (!options.quiet) {
      console.log(message);
    }
  },
  error: (message: string, options: GlobalOptions = {}) => {
    // Always show errors unless explicitly quiet
    if (!options.quiet) {
      console.error(message);
    }
  },
  verbose: (message: string, options: GlobalOptions = {}) => {
    if (options.verbose && !options.quiet) {
      console.log(`[VERBOSE] ${message}`);
    }
  },
  debug: (message: string, data: any, options: GlobalOptions = {}) => {
    if (options.verbose && !options.quiet) {
      console.log(`[DEBUG] ${message}`, data);
    }
  }
};

function showVersion(): void {
  console.log(`cc-agentic version ${VERSION}`);
}

function showHelp(): void {
  console.log(`
Agentic SDLC CLI - Decision & Clarification System
${'='.repeat(60)}

Usage: cc-agentic <command> [subcommand] [options]

Global Options:
  -v, --version      Show version number
  -q, --quiet        Suppress output (errors only)
  -V, --verbose      Show verbose output
  -h, --help         Show this help message

Commands:
${Object.entries(COMMANDS)
  .map(([cmd, desc]) => `  ${cmd.padEnd(15)} ${desc}`)
  .join('\n')}

Examples:
  # Evaluate a decision
  cc-agentic decisions evaluate \\
    --workflow-id WF-2025-1107-001 \\
    --item-id BI-2025-00123 \\
    --category security_affecting \\
    --action "Deploy new authentication system" \\
    --confidence 0.88

  # Show decision policy
  cc-agentic decisions policy

  # Create clarification request
  cc-agentic clarify create \\
    --workflow-id WF-2025-1107-001 \\
    --item-id BI-2025-00123 \\
    --requirements "Build a dashboard" \\
    --confidence 0.65 \\
    --interactive

  # Answer clarification
  cc-agentic clarify answer --id CLR-2025-00001

For more information, visit: https://docs.agentic-sdlc.local
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Handle version flag
  if (args.includes('--version') || args.includes('-v')) {
    showVersion();
    process.exit(0);
  }

  // Handle help flag
  if (args.length === 0 || args[0] === 'help' || args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  // Extract global options
  const globalOptions: GlobalOptions = {
    quiet: args.includes('--quiet') || args.includes('-q'),
    verbose: args.includes('--verbose') || args.includes('-V')
  };

  // Remove global flags from args
  const filteredArgs = args.filter(arg =>
    !['-q', '--quiet', '-V', '--verbose', '-v', '--version', '-h', '--help'].includes(arg)
  );

  const command = filteredArgs[0];
  const subcommand = filteredArgs[1];

  // Parse arguments into object
  const argsObj: Record<string, string> = {};
  for (let i = 2; i < filteredArgs.length; i++) {
    if (filteredArgs[i].startsWith('--')) {
      const key = filteredArgs[i].slice(2);
      const value = filteredArgs[i + 1] && !filteredArgs[i + 1].startsWith('--') ? filteredArgs[i + 1] : 'true';
      argsObj[key] = value;
      if (value !== 'true') i++; // Skip next arg if it was a value
    }
  }

  // Add global options to argsObj
  argsObj._quiet = globalOptions.quiet ? 'true' : 'false';
  argsObj._verbose = globalOptions.verbose ? 'true' : 'false';

  logger.verbose(`CLI started with options: quiet=${globalOptions.quiet}, verbose=${globalOptions.verbose}`, globalOptions);
  logger.verbose(`Command: ${command}, Subcommand: ${subcommand}`, globalOptions);

  let exitCode = 0;

  try {
    switch (command) {
      case 'decisions':
        if (!subcommand) {
          logger.error('Missing subcommand for decisions', globalOptions);
          logger.log('Available subcommands: evaluate, show, policy', globalOptions);
          exitCode = 1;
        } else {
          logger.verbose(`Running decisions command: ${subcommand}`, globalOptions);
          exitCode = await runDecisionsCLI(subcommand, argsObj);
        }
        break;

      case 'clarify':
        if (!subcommand) {
          logger.error('Missing subcommand for clarify', globalOptions);
          logger.log('Available subcommands: evaluate, create, answer, show', globalOptions);
          exitCode = 1;
        } else {
          logger.verbose(`Running clarify command: ${subcommand}`, globalOptions);
          exitCode = await runClarifyCLI(subcommand, argsObj);
        }
        break;

      default:
        logger.error(`Unknown command: ${command}`, globalOptions);
        if (!globalOptions.quiet) {
          showHelp();
        }
        exitCode = 1;
    }
  } catch (error) {
    logger.error(`Fatal error: ${error}`, globalOptions);
    logger.debug('Error details', error, globalOptions);
    exitCode = 1;
  }

  process.exit(exitCode);
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main };
