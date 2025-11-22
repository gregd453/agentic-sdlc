/**
 * Product Owner Lambda Agent - Entry Point
 *
 * This agent can run as:
 * 1. A PM2-managed service (like other agents)
 * 2. An AWS Lambda function
 * 3. A standalone process
 */

import dotenv from 'dotenv';
import path from 'path';

// Load .env.development from project root
// From dist/index.js: dist -> product-owner-lambda -> agents -> packages -> root
dotenv.config({ path: path.resolve(__dirname, '../../../../.env.development') });

import { ProductOwnerAgent } from './product-owner-agent';
import { makeRedisBus, makeRedisSuite } from '@agentic-sdlc/orchestrator';

export { ProductOwnerAgent };

/**
 * Start the agent as a standalone process
 */
async function startAgent() {
  console.log('Starting Product Owner Agent...');

  // Validate environment variables
  const redisHost = process.env.REDIS_HOST;
  const redisPort = process.env.REDIS_PORT;

  if (!redisHost || !redisPort) {
    console.error('❌ REDIS_HOST and REDIS_PORT must be set');
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY must be set');
    process.exit(1);
  }

  try {
    // Create Redis URL
    const redisUrl = `redis://${redisHost}:${redisPort}`;

    // Create Redis suite for the message bus
    const redisSuite = await makeRedisSuite(redisUrl);

    // Create message bus adapter
    const messageBus = makeRedisBus(redisSuite.pub, redisSuite.sub);

    // Create and initialize the agent
    const platformId = process.env.PLATFORM_ID; // Optional platform scoping
    const agent = new ProductOwnerAgent(messageBus, platformId);

    await agent.initialize();

    console.log('✅ Product Owner Agent started successfully');
    console.log(`   Agent ID: ${(agent as any).agentId}`);
    console.log(`   Platform: ${platformId || 'global'}`);
    console.log(`   Capabilities: requirements-generation, ddd-design, user-story-creation, mvp-scoping`);

    // Graceful shutdown
    const shutdown = async () => {
      console.log('\n⏹️  Shutting down Product Owner Agent...');
      await agent.cleanup();
      await redisSuite.pub.quit();
      await redisSuite.sub.quit();
      console.log('✅ Agent shut down successfully');
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Keep process alive
    process.stdin.resume();

  } catch (error) {
    console.error('❌ Failed to start Product Owner Agent:', error);
    process.exit(1);
  }
}

// Start agent if this file is run directly
if (require.main === module) {
  startAgent().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
