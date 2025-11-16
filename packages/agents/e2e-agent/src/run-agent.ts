#!/usr/bin/env node

import 'dotenv/config';
import { OrchestratorContainer } from '@agentic-sdlc/orchestrator/hexagonal/bootstrap';
import { E2EAgent } from './e2e-agent';

/**
 * Main entry point for running the E2E test agent
 * Phase 3: Initializes with OrchestratorContainer for message bus integration
 */
async function main() {
  // Phase 3: Create and initialize OrchestratorContainer
  console.log('[PHASE-3] Initializing OrchestratorContainer for e2e agent...');
  const container = new OrchestratorContainer({
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6380',
    redisNamespace: 'agent-e2e',
    coordinators: {} // No coordinators needed for agents
  });

  await container.initialize();
  console.log('[PHASE-3] OrchestratorContainer initialized successfully');

  const messageBus = container.getBus();
  const platformId = process.env.AGENT_PLATFORM_ID;
  const agent = new E2EAgent(messageBus, undefined, undefined, undefined, platformId);
  let isShuttingDown = false;

  // Handle graceful shutdown
  const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log('\nShutting down E2E test agent...');
    await agent.cleanup();
    await container.shutdown(); // Phase 3: Shutdown container
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    // Initialize and start the agent
    await agent.initialize();

    const scope = platformId ? `[platform: ${platformId}]` : '[global]';
    console.log(`✅ E2E test agent started successfully ${scope}`);
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
