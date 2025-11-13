#!/usr/bin/env node
import 'dotenv/config';
import { AGENT_TYPES, REDIS_CHANNELS } from '@agentic-sdlc/shared-types';
import { OrchestratorContainer } from '@agentic-sdlc/orchestrator';
import { ScaffoldAgent } from './scaffold-agent';

/**
 * Standalone runner for Scaffold Agent
 * Phase 3: Initializes with OrchestratorContainer for message bus integration
 */
async function main() {
  console.log('🚀 Starting Scaffold Agent...');

  // Validate environment
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY not configured');
    process.exit(1);
  }

  // Phase 3: Create and initialize OrchestratorContainer
  console.log('[PHASE-3] Initializing OrchestratorContainer for scaffold agent...');
  const container = new OrchestratorContainer({
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6380',
    redisNamespace: 'agent-scaffold',
    coordinators: {} // No coordinators needed for agents
  });

  await container.initialize();
  console.log('[PHASE-3] OrchestratorContainer initialized successfully');

  const messageBus = container.getBus();
  const agent = new ScaffoldAgent(messageBus);

  try {
    // Initialize agent (connects to Redis, registers with orchestrator)
    await agent.initialize();

    console.log('✅ Scaffold Agent running and listening for tasks');
    console.log('📡 Connected to Redis:', process.env.REDIS_URL || 'redis://localhost:6379');
    console.log('🔑 Using Anthropic API key:', process.env.ANTHROPIC_API_KEY.substring(0, 20) + '...');
    // SESSION #37: Use constants for channel name
    console.log(`\nAgent is ready to receive tasks on channel: ${REDIS_CHANNELS.AGENT_TASKS(AGENT_TYPES.SCAFFOLD)}`);
    console.log('Press Ctrl+C to stop\n');

    // Keep process alive
    process.on('SIGINT', async () => {
      console.log('\n\n🛑 Shutting down Scaffold Agent...');
      await agent.cleanup();
      await container.shutdown(); // Phase 3: Shutdown container
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n\n🛑 Shutting down Scaffold Agent...');
      await agent.cleanup();
      await container.shutdown(); // Phase 3: Shutdown container
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start agent:', error);
    process.exit(1);
  }
}

main();
