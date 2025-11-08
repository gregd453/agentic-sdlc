#!/usr/bin/env node

import 'dotenv/config';
import { ValidationAgent } from './validation-agent';

/**
 * Main entry point for running the validation agent
 */
async function main() {
  const agent = new ValidationAgent();
  let isShuttingDown = false;

  // Handle graceful shutdown
  const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log('\nShutting down validation agent...');
    await agent.cleanup();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    // Initialize and start the agent
    await agent.initialize();

    console.log('✅ Validation agent started successfully');
    console.log('📡 Listening for validation tasks...');

    // Keep process alive with a proper mechanism
    // Check for shutdown signal every second
    while (!isShuttingDown) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error('❌ Failed to start validation agent:', error);
    process.exit(1);
  }
}

main();
