/**
 * Lambda Bridge - Connects Lambda agents to the Agentic SDLC orchestrator
 *
 * This bridge allows Lambda functions to participate in the agent ecosystem
 * by polling Redis for tasks and invoking Lambda functions
 */

const Redis = require('ioredis');
const axios = require('axios');

class LambdaBridge {
  constructor(config = {}) {
    this.agentType = config.agentType || 'hello-world';
    this.redisUrl = config.redisUrl || process.env.REDIS_URL || 'redis://localhost:6380';
    this.lambdaEndpoint = config.lambdaEndpoint || 'http://localhost:3456/invoke';
    this.isLambda = config.isLambda || false; // Set to true for real Lambda
    this.redis = null;
    this.subscriber = null;
    this.isRunning = false;
  }

  async initialize() {
    console.log(`Initializing Lambda Bridge for ${this.agentType}...`);

    // Connect to Redis
    this.redis = new Redis(this.redisUrl);
    this.subscriber = new Redis(this.redisUrl);

    // Subscribe to agent task channel
    const channel = `agent:${this.agentType}:tasks`;
    await this.subscriber.subscribe(channel);
    console.log(`Subscribed to channel: ${channel}`);

    // Register agent with orchestrator
    await this.registerAgent();

    // Start listening for tasks
    this.subscriber.on('message', async (channel, message) => {
      await this.handleTask(message);
    });

    this.isRunning = true;
    console.log('Lambda Bridge initialized and listening for tasks');
  }

  async registerAgent() {
    const registration = {
      agent_id: `${this.agentType}-lambda-${Date.now()}`,
      agent_type: this.agentType,
      status: 'online',
      capabilities: ['hello-world', 'lambda-based'],
      host: this.isLambda ? 'aws-lambda' : 'localhost',
      metadata: {
        bridge_type: 'lambda',
        endpoint: this.lambdaEndpoint,
        registered_at: new Date().toISOString()
      }
    };

    // Publish registration to orchestrator
    await this.redis.publish('agent:registration', JSON.stringify(registration));
    console.log('Agent registered with orchestrator');
  }

  async handleTask(message) {
    try {
      const envelope = JSON.parse(message);
      console.log(`Received task ${envelope.task_id}`);

      // Invoke Lambda function
      const response = await this.invokeLambda(envelope);
      console.log(`Lambda response:`, response.data);

      // The Lambda function already publishes results to Redis,
      // but we can also handle the response here if needed
      if (response.data && response.data.status === 'completed') {
        console.log(`Task ${envelope.task_id} completed successfully`);
      }
    } catch (error) {
      console.error('Error handling task:', error);
      // Publish error back to orchestrator
      await this.publishError(envelope.task_id, error);
    }
  }

  async invokeLambda(envelope) {
    if (this.isLambda) {
      // Real AWS Lambda invocation
      const AWS = require('aws-sdk');
      const lambda = new AWS.Lambda();

      const params = {
        FunctionName: 'hello-world-agent',
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify(envelope)
      };

      const result = await lambda.invoke(params).promise();
      return { data: JSON.parse(result.Payload) };
    } else {
      // Local Lambda simulation
      return axios.post(this.lambdaEndpoint, envelope);
    }
  }

  async publishError(taskId, error) {
    const errorResult = {
      task_id: taskId,
      status: 'failed',
      error: {
        message: error.message,
        stack: error.stack
      },
      timestamp: new Date().toISOString()
    };

    await this.redis.publish(`task:${taskId}:error`, JSON.stringify(errorResult));
  }

  async shutdown() {
    console.log('Shutting down Lambda Bridge...');
    this.isRunning = false;

    if (this.subscriber) {
      await this.subscriber.unsubscribe();
      await this.subscriber.quit();
    }

    if (this.redis) {
      await this.redis.quit();
    }

    console.log('Lambda Bridge shut down');
  }
}

// Run the bridge if this file is executed directly
if (require.main === module) {
  const bridge = new LambdaBridge({
    agentType: process.env.AGENT_TYPE || 'hello-world',
    lambdaEndpoint: process.env.LAMBDA_ENDPOINT || 'http://localhost:3456/invoke',
    isLambda: process.env.USE_AWS_LAMBDA === 'true'
  });

  bridge.initialize().catch(console.error);

  // Graceful shutdown
  process.on('SIGINT', async () => {
    await bridge.shutdown();
    process.exit(0);
  });
}

module.exports = { LambdaBridge };