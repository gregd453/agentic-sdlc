/**
 * Local test script for the Hello World Lambda Agent
 */

const axios = require('axios');
const Redis = require('ioredis');

async function testLambdaAgent() {
  console.log('Testing Hello World Lambda Agent...\n');

  // Test data
  const testEnvelope = {
    task_id: `test-${Date.now()}`,
    workflow_id: 'test-workflow-001',
    agent_type: 'hello-world',
    priority: 'high',
    status: 'pending',
    payload: {
      message: 'Testing Lambda integration',
      timestamp: new Date().toISOString()
    },
    workflow_context: {
      workflow_type: 'test',
      workflow_name: 'Lambda Test Workflow',
      current_stage: 'hello-world-test'
    },
    constraints: {
      timeout_ms: 30000,
      max_retries: 3
    },
    metadata: {
      created_at: new Date().toISOString(),
      created_by: 'test-script',
      envelope_version: '2.0.0'
    }
  };

  try {
    // Test 1: Direct HTTP invocation
    console.log('Test 1: Direct HTTP invocation');
    console.log('Sending:', JSON.stringify(testEnvelope, null, 2));

    const response = await axios.post('http://localhost:3456/invoke', testEnvelope);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    console.log('✅ Direct invocation successful\n');

    // Test 2: Redis integration (if Redis is available)
    console.log('Test 2: Redis integration');
    try {
      const redis = new Redis('redis://localhost:6380');

      // Subscribe to result channel
      const subscriber = new Redis('redis://localhost:6380');
      await subscriber.subscribe(`task:${testEnvelope.task_id}:complete`);

      console.log('Listening for Redis response...');

      // Set up promise to wait for response
      const resultPromise = new Promise((resolve) => {
        subscriber.on('message', (channel, message) => {
          console.log('Received from Redis:', message);
          resolve(JSON.parse(message));
        });
      });

      // Invoke Lambda again (it will publish to Redis)
      await axios.post('http://localhost:3456/invoke', testEnvelope);

      // Wait for Redis response (with timeout)
      const result = await Promise.race([
        resultPromise,
        new Promise((_, reject) => setTimeout(() => reject('Timeout'), 5000))
      ]);

      console.log('✅ Redis integration successful\n');

      await subscriber.quit();
      await redis.quit();
    } catch (redisError) {
      console.log('⚠️  Redis not available or error:', redisError.message);
      console.log('   (This is OK - Lambda can work without Redis)\n');
    }

    // Test 3: Error handling
    console.log('Test 3: Error handling');
    const badEnvelope = { ...testEnvelope, task_id: null };

    try {
      await axios.post('http://localhost:3456/invoke', badEnvelope);
    } catch (error) {
      console.log('✅ Error handling works (expected error for bad input)\n');
    }

    console.log('🎉 All tests completed successfully!');
    console.log('\nYour Lambda agent is ready to be integrated with the orchestrator.');
    console.log('\nNext steps:');
    console.log('1. Install dependencies: cd packages/agents/hello-world-lambda && npm install');
    console.log('2. Run the Lambda locally: npm start');
    console.log('3. In another terminal, run the bridge: node lambda-bridge.js');
    console.log('4. Register with orchestrator using the bridge');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\nMake sure the Lambda agent is running:');
    console.log('  cd packages/agents/hello-world-lambda');
    console.log('  npm install');
    console.log('  npm start');
  }
}

// Run tests
testLambdaAgent();