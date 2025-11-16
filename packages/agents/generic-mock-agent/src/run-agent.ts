#!/usr/bin/env node
import 'dotenv/config';
import { OrchestratorContainer } from '@agentic-sdlc/orchestrator/hexagonal/bootstrap';
import { GenericMockAgent } from './generic-mock-agent.js';
import { AGENT_TYPES } from '@agentic-sdlc/shared-types';

/**
 * Generic Mock Agent Runner
 *
 * Phase 4: Flexible runner supporting multiple registrations
 *
 * Environment variables:
 * - AGENT_TYPE: Agent type to emulate (scaffold, validation, e2e_test, integration, deployment)
 * - AGENT_PLATFORM_ID: Optional platform ID for platform-scoped registration
 * - MOCK_AGENT_DELAY: Delay in ms for task simulation (default: 100)
 * - MOCK_AGENT_DEBUG: Enable debug logging (default: false)
 *
 * Example:
 *   # Global scaffold agent
 *   AGENT_TYPE=scaffold node run-agent.ts
 *
 *   # Platform-scoped validation agent
 *   AGENT_TYPE=validation AGENT_PLATFORM_ID=web-app-platform node run-agent.ts
 *
 *   # Multiple registrations can run concurrently
 */

async function main() {
  // Determine agent type from environment
  const agentType = process.env.AGENT_TYPE || AGENT_TYPES.SCAFFOLD;
  const platformId = process.env.AGENT_PLATFORM_ID;
  const mockDelay = parseInt(process.env.MOCK_AGENT_DELAY || '100');
  const enableDebug = process.env.MOCK_AGENT_DEBUG === 'true';

  const scope = platformId ? ` [platform: ${platformId}]` : ' [global]';

  console.log(`🚀 Starting Generic Mock Agent${scope}...`);
  console.log(`   Agent Type: ${agentType}`);
  console.log(`   Mock Delay: ${mockDelay}ms`);
  console.log(`   Debug: ${enableDebug ? 'enabled' : 'disabled'}\n`);

  // Validate environment
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY not configured');
    process.exit(1);
  }

  // Phase 4: Create and initialize OrchestratorContainer
  console.log('[PHASE-4] Initializing OrchestratorContainer for mock agent...');
  const container = new OrchestratorContainer({
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6380',
    redisNamespace: `agent-mock-${agentType}${platformId ? `-${platformId}` : ''}`,
    coordinators: {} // No coordinators needed for agents
  });

  await container.initialize();
  console.log('[PHASE-4] OrchestratorContainer initialized successfully\n');

  const messageBus = container.getBus();
  const agent = new GenericMockAgent(
    messageBus,
    agentType,
    platformId,
    mockDelay,
    enableDebug
  );

  try {
    // Initialize agent (connects to Redis, registers with orchestrator)
    await agent.initialize();

    console.log(`✅ Generic Mock Agent${scope} running and listening for tasks`);
    console.log('📡 Connected to Redis:', process.env.REDIS_URL || 'redis://localhost:6379');
    console.log('🔑 Using Anthropic API key:', process.env.ANTHROPIC_API_KEY.substring(0, 20) + '...');
    console.log(`\nAgent is ready to simulate ${agentType} tasks${scope}`);
    console.log('Press Ctrl+C to stop\n');

    // Keep process alive
    process.on('SIGINT', async () => {
      console.log('\n\n🛑 Shutting down Generic Mock Agent...');
      await agent.cleanup();
      await container.shutdown();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n\n🛑 Shutting down Generic Mock Agent...');
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
