#!/usr/bin/env node

import 'dotenv/config';
import { OrchestratorContainer } from '@agentic-sdlc/orchestrator';
import { ValidationAgent } from './validation-agent';

/**
 * Main entry point for running the validation agent
 * Phase 3: Initializes with OrchestratorContainer for message bus integration
 */
async function main() {
  // Phase 3: Create and initialize OrchestratorContainer
  console.log('[PHASE-3] Initializing OrchestratorContainer for validation agent...');
  const container = new OrchestratorContainer({
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6380',
    redisNamespace: 'agent-validation',
    coordinators: {} // No coordinators needed for agents
  });

  await container.initialize();
  console.log('[PHASE-3] OrchestratorContainer initialized successfully');

  const messageBus = container.getBus();
  const agent = new ValidationAgent(messageBus);
  let isShuttingDown = false;

  // Handle graceful shutdown
  const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log('\nShutting down validation agent...');
    await agent.cleanup();
    await container.shutdown(); // Phase 3: Shutdown container
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
