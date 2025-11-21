/**
 * Hello World Lambda Agent
 * Demonstrates how to create a Lambda-based agent for the Agentic SDLC platform
 */

const Redis = require('ioredis');

// Lambda handler - this is what AWS Lambda calls
exports.handler = async (event, context) => {
  console.log('Hello World Lambda Agent received event:', JSON.stringify(event, null, 2));

  // Parse the AgentEnvelope from the event
  const envelope = typeof event.body === 'string' ? JSON.parse(event.body) : event;

  // Extract task details
  const { task_id, workflow_id, payload, workflow_context } = envelope;

  // Simulate processing (you can add real logic here)
  const result = {
    task_id,
    workflow_id,
    status: 'completed',
    result: {
      message: `Hello from Lambda! Processed task ${task_id}`,
      timestamp: new Date().toISOString(),
      input_received: payload,
      context: workflow_context,
      processed_by: 'hello-world-lambda',
      lambda_request_id: context?.requestId || 'local-test'
    }
  };

  // If we have Redis configuration, publish the result back
  if (process.env.REDIS_URL) {
    try {
      const redis = new Redis(process.env.REDIS_URL);

      // Publish result to the workflow result channel
      await redis.publish(`workflow:${workflow_id}:results`, JSON.stringify(result));

      // Also publish to task completion channel
      await redis.publish(`task:${task_id}:complete`, JSON.stringify(result));

      await redis.quit();
      console.log('Published result to Redis');
    } catch (error) {
      console.error('Redis publish failed:', error);
      // Continue anyway - Lambda can also return results via HTTP response
    }
  }

  // Return HTTP response for API Gateway or direct invocation
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(result)
  };
};

// Local testing server - run this file directly for local development
if (require.main === module) {
  const express = require('express');
  const app = express();
  app.use(express.json());

  // Simulate Lambda invocation endpoint
  app.post('/invoke', async (req, res) => {
    console.log('Local invocation received:', req.body);

    const mockContext = {
      requestId: 'local-' + Date.now(),
      functionName: 'hello-world-lambda',
      getRemainingTimeInMillis: () => 300000
    };

    try {
      const result = await exports.handler(req.body, mockContext);
      res.status(result.statusCode).json(JSON.parse(result.body));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  const PORT = process.env.PORT || 3456;
  app.listen(PORT, () => {
    console.log(`Hello World Lambda Agent running locally on port ${PORT}`);
    console.log(`Test with: curl -X POST http://localhost:${PORT}/invoke -H "Content-Type: application/json" -d '{"task_id":"test-123","agent_type":"hello-world"}'`);
  });
}