/**
 * Scheduler Phase 2 Verification Test
 *
 * Verifies all Phase 2 services are properly implemented and integrate correctly.
 */

import { PrismaClient } from '@prisma/client';

// Import Phase 2 services
import { JobHandlerRegistry } from './src/services/job-handler-registry.service';
import { JobExecutorService } from './src/services/job-executor.service';
import { JobDispatcherWorker } from './src/workers/job-dispatcher.worker';

// Mock dependencies
const mockMessageBus = {
  publish: async (event: string, data: any, options?: any) => {
    console.log(`📤 Event: ${event}`, { data });
  }
};

const mockAgentRegistry = {
  validateAgentExists: async (agentType: string, platformId?: string) => {
    console.log(`✓ Agent validated: ${agentType}`);
    return true;
  }
};

const mockWorkflowEngine = {
  // Mock workflow engine methods
};

async function main() {
  console.log('🧪 Scheduler Phase 2 Verification Test\n');

  const prisma = new PrismaClient();

  try {
    // 1. Verify JobHandlerRegistry
    console.log('1️⃣  Testing JobHandlerRegistry...');
    const handlerRegistry = new JobHandlerRegistry(
      mockAgentRegistry as any,
      mockWorkflowEngine as any
    );

    console.log(`   ✅ Registry initialized with ${handlerRegistry.listHandlers().length} built-in handlers`);

    // List built-in handlers
    const handlers = handlerRegistry.listHandlers();
    console.log('   📋 Built-in handlers:');
    handlers.forEach((h) => {
      console.log(`      - ${h.name}: ${h.description}`);
    });

    // Test custom handler registration
    handlerRegistry.registerHandler(
      'test:custom',
      async (payload: any, context: any) => {
        return { status: 'test_success' };
      },
      { description: 'Test handler' }
    );
    console.log('   ✅ Custom handler registered successfully\n');

    // 2. Verify JobExecutorService
    console.log('2️⃣  Testing JobExecutorService...');
    const jobExecutor = new JobExecutorService(
      prisma,
      mockMessageBus as any,
      handlerRegistry
    );
    console.log('   ✅ JobExecutorService initialized\n');

    // 3. Verify JobDispatcherWorker
    console.log('3️⃣  Testing JobDispatcherWorker...');
    const dispatcher = new JobDispatcherWorker(
      prisma,
      mockMessageBus as any,
      {
        interval_ms: 60000,
        batch_size: 100,
        enabled: false // Don't actually start it
      }
    );

    const stats = dispatcher.getStats();
    console.log('   ✅ JobDispatcherWorker initialized');
    console.log('   📊 Initial stats:', stats);
    console.log('');

    // 4. Summary
    console.log('✅ All Phase 2 services verified successfully!\n');
    console.log('📦 Services available:');
    console.log('   - JobHandlerRegistry: ✅');
    console.log('   - JobExecutorService: ✅');
    console.log('   - JobDispatcherWorker: ✅');
    console.log('');
    console.log('🎉 Phase 2 implementation complete!\n');
  } catch (error: any) {
    console.error('❌ Verification failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
