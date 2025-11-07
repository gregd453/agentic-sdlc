/**
 * Main CLI Entry Point for Agentic SDLC
 * Usage: cc-agentic <command> [options]
 */

import { runDecisionsCLI } from './decisions';
import { runClarifyCLI } from './clarify';

const COMMANDS = {
  decisions: 'Decision evaluation and management',
  clarify: 'Clarification requests and answers',
  help: 'Show this help message',
};

function showHelp(): void {
  console.log(`
Agentic SDLC CLI - Decision & Clarification System
${'='.repeat(60)}

Usage: cc-agentic <command> [subcommand] [options]

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

  if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    process.exit(0);
  }

  const command = args[0];
  const subcommand = args[1];

  // Parse arguments into object
  const argsObj: Record<string, string> = {};
  for (let i = 2; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : 'true';
      argsObj[key] = value;
      if (value !== 'true') i++; // Skip next arg if it was a value
    }
  }

  let exitCode = 0;

  try {
    switch (command) {
      case 'decisions':
        if (!subcommand) {
          console.error('Missing subcommand for decisions');
          console.log('Available subcommands: evaluate, show, policy');
          exitCode = 1;
        } else {
          exitCode = await runDecisionsCLI(subcommand, argsObj);
        }
        break;

      case 'clarify':
        if (!subcommand) {
          console.error('Missing subcommand for clarify');
          console.log('Available subcommands: evaluate, create, answer, show');
          exitCode = 1;
        } else {
          exitCode = await runClarifyCLI(subcommand, argsObj);
        }
        break;

      default:
        console.error(`Unknown command: ${command}`);
        showHelp();
        exitCode = 1;
    }
  } catch (error) {
    console.error('Fatal error:', error);
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
