#!/usr/bin/env node

import 'dotenv/config';
import { E2EAgent } from './e2e-agent';

/**
 * Main entry point for running the E2E test agent
 */
async function main() {
  const agent = new E2EAgent();
  let isShuttingDown = false;

  // Handle graceful shutdown
  const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log('\nShutting down E2E test agent...');
    await agent.cleanup();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    // Initialize and start the agent
    await agent.initialize();

    console.log('✅ E2E test agent started successfully');
    console.log('📡 Listening for E2E test tasks...');

    // Keep process alive with a proper mechanism
    // Check for shutdown signal every second
    while (!isShuttingDown) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error('❌ Failed to start E2E test agent:', error);
    process.exit(1);
  }
}

main();
