#!/usr/bin/env node
import 'dotenv/config';
import { ScaffoldAgent } from './scaffold-agent';

/**
 * Standalone runner for Scaffold Agent
 * This allows the agent to run as a service and listen for tasks
 */
async function main() {
  console.log('🚀 Starting Scaffold Agent...');

  // Validate environment
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY not configured');
    process.exit(1);
  }

  const agent = new ScaffoldAgent();

  try {
    // Initialize agent (connects to Redis, registers with orchestrator)
    await agent.initialize();

    console.log('✅ Scaffold Agent running and listening for tasks');
    console.log('📡 Connected to Redis:', process.env.REDIS_URL || 'redis://localhost:6379');
    console.log('🔑 Using Anthropic API key:', process.env.ANTHROPIC_API_KEY.substring(0, 20) + '...');
    console.log('\nAgent is ready to receive tasks on channel: agent:scaffold:tasks');
    console.log('Press Ctrl+C to stop\n');

    // Keep process alive
    process.on('SIGINT', async () => {
      console.log('\n\n🛑 Shutting down Scaffold Agent...');
      await agent.cleanup();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n\n🛑 Shutting down Scaffold Agent...');
      await agent.cleanup();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start agent:', error);
    process.exit(1);
  }
}

main();
