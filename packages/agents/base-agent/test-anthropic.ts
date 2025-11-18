#!/usr/bin/env tsx
import 'dotenv/config';
import { ExampleAgent } from './src/example-agent';
import { TaskAssignment } from './src/types';

async function testAnthropicIntegration() {
  console.log('Testing Anthropic Claude Integration...\n');

  // Check if API key is configured
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY not found in environment');
    process.exit(1);
  }

  console.log('✅ Anthropic API key configured');

  // Create an instance of the example agent
  const agent = new ExampleAgent();
  console.log('✅ Agent instance created\n');

  // Create a test task
  const testTask: TaskAssignment = {
    task_id: '123e4567-e89b-12d3-a456-426614174000',
    workflow_id: '123e4567-e89b-12d3-a456-426614174001',
    type: 'analysis',
    name: 'Analyze User Management System',
    description: 'Analyze requirements for a user management system',
    requirements: `
      We need a user management system that supports:
      1. User registration with email verification
      2. Role-based access control (Admin, Manager, User)
      3. Password reset functionality
      4. OAuth integration (Google, GitHub)
      5. User profile management
      6. Activity logging and audit trail
    `,
    priority: TASK_PRIORITY.HIGH
  };

  console.log('📋 Test Task:', {
    name: testTask.name,
    type: testTask.type,
    priority: testTask.priority
  });
  console.log('\n🤖 Calling Claude API...\n');

  try {
    // Execute the task
    const result = await agent.execute(testTask);

    if (result.status === WORKFLOW_STATUS.SUCCESS) {
      console.log('✅ Claude API call successful!\n');
      console.log('📊 Analysis Result:');
      console.log(JSON.stringify(result.output, null, 2));

      if (result.metrics) {
        console.log('\n📈 Metrics:');
        console.log(`  Duration: ${result.metrics.duration_ms}ms`);
        console.log(`  Estimated tokens: ${result.metrics.tokens_used}`);
        console.log(`  API calls: ${result.metrics.api_calls}`);
      }

      console.log('\n✅ Anthropic integration test passed!');
    } else {
      console.error('❌ Task execution failed:', result.errors);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error during test:', error);
    process.exit(1);
  }

  // Note: We're not calling initialize() or cleanup() to avoid Redis dependency
  // In production, the agent would be properly initialized with Redis connection
  console.log('\n🎉 Integration test complete!');
  process.exit(0);
}

// Run the test
testAnthropicIntegration().catch(console.error);