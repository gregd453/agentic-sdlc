#!/usr/bin/env node
import 'dotenv/config';
import { AGENT_TYPES, REDIS_CHANNELS } from '@agentic-sdlc/shared-types';
import { OrchestratorContainer } from '@agentic-sdlc/orchestrator/hexagonal/bootstrap';
import { IntegrationAgent } from './integration-agent';

/**
 * Standalone runner for Integration Agent
 * Handles branch merging, AI-powered conflict resolution, dependency updates, and integration testing
 */
async function main() {
  console.log('🚀 Starting Integration Agent...');

  // Validate environment
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY not configured');
    process.exit(1);
  }

  // Create and initialize OrchestratorContainer
  console.log('[INTEGRATION] Initializing OrchestratorContainer for integration agent...');
  const container = new OrchestratorContainer({
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6380',
    redisNamespace: 'agent-integration',
    coordinators: {} // No coordinators needed for agents
  });

  await container.initialize();
  console.log('[INTEGRATION] OrchestratorContainer initialized successfully');

  const messageBus = container.getBus();
  const platformId = process.env.AGENT_PLATFORM_ID;
  const agent = new IntegrationAgent(messageBus, undefined, undefined, undefined, undefined, platformId);

  try {
    // Initialize agent (connects to Redis, registers with orchestrator)
    await agent.initialize();

    const scope = platformId ? `[platform: ${platformId}]` : '[global]';
    console.log(`✅ Integration Agent running and listening for tasks ${scope}`);
    console.log('📡 Connected to Redis:', process.env.REDIS_URL || 'redis://localhost:6380');
    console.log('🔑 Using Anthropic API key:', process.env.ANTHROPIC_API_KEY.substring(0, 20) + '...');
    console.log(`\nAgent is ready to receive tasks on channel: ${REDIS_CHANNELS.AGENT_TASKS(AGENT_TYPES.INTEGRATION)}`);
    console.log('Press Ctrl+C to stop\n');

    // Keep process alive
    process.on('SIGINT', async () => {
      console.log('\n\n🛑 Shutting down Integration Agent...');
      await agent.cleanup();
      await container.shutdown();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n\n🛑 Shutting down Integration Agent...');
      await agent.cleanup();
      await container.shutdown();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start agent:', error);
    process.exit(1);
  }
}

main();
