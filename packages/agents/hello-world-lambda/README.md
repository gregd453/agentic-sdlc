# Hello World Lambda Agent

A demonstration of how to create Lambda-based agents for the Agentic SDLC platform.

## Quick Start (Run Locally Now)

```bash
# 1. Install dependencies
cd packages/agents/hello-world-lambda
npm install

# 2. Start the Lambda agent locally
npm start
# This starts a local server on port 3456 simulating Lambda

# 3. In another terminal, test it
node test-local.js
```

## Files Overview

- `index.js` - The Lambda function handler
- `lambda-bridge.js` - Bridge between Lambda and the orchestrator's Redis bus
- `template.yaml` - SAM template for AWS deployment
- `test-event.json` - Sample event for testing
- `test-local.js` - Local testing script

## Integration with Orchestrator

### Method 1: Lambda Bridge (Recommended)
The Lambda bridge polls Redis for tasks and invokes the Lambda:

```bash
# Start the bridge
node lambda-bridge.js

# The bridge will:
# 1. Register the agent with the orchestrator
# 2. Subscribe to task channel: agent:hello-world:tasks
# 3. Invoke Lambda when tasks arrive
# 4. Publish results back to Redis
```

### Method 2: Direct Registration
Register the Lambda endpoint directly with the orchestrator:

```javascript
// In your orchestrator code
const agentRegistry = require('@agentic-sdlc/agent-registry');

// Register Lambda-based agent
agentRegistry.registerAgent({
  type: 'hello-world',
  handler: async (envelope) => {
    // Call Lambda via AWS SDK or HTTP
    const response = await axios.post('https://your-lambda-url.amazonaws.com/invoke', envelope);
    return response.data;
  },
  platform: 'your-platform'
});
```

## Deploy to AWS Lambda

### Using SAM CLI
```bash
# Install SAM CLI
pip install aws-sam-cli

# Build and deploy
sam build
sam deploy --guided

# Get the endpoint URL
sam list endpoints --output json
```

### Using AWS CLI
```bash
# Package the function
zip -r function.zip index.js node_modules package.json

# Create Lambda function
aws lambda create-function \
  --function-name hello-world-agent \
  --runtime nodejs18.x \
  --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-execution-role \
  --handler index.handler \
  --zip-file fileb://function.zip \
  --environment Variables="{REDIS_URL=redis://your-redis:6379}"

# Create API Gateway trigger (optional)
aws apigatewayv2 create-api \
  --name hello-world-agent-api \
  --protocol-type HTTP \
  --target arn:aws:lambda:REGION:ACCOUNT:function:hello-world-agent
```

## Use in Workflows

Once registered, you can use this agent in workflows:

```javascript
// In WorkflowDefinition
{
  stages: [
    {
      name: 'greeting',
      agent_type: 'hello-world',  // Your Lambda agent
      required: true,
      timeout_ms: 30000
    },
    // ... other stages
  ]
}
```

Or via the Dashboard:
1. Go to Workflow Builder
2. Add a new stage
3. Select agent type: "hello-world"
4. Configure and save

## Testing

### Local Testing
```bash
# Direct test
curl -X POST http://localhost:3456/invoke \
  -H "Content-Type: application/json" \
  -d @test-event.json

# Full integration test
npm test
```

### Lambda Testing (SAM Local)
```bash
# Start API locally
sam local start-api --port 3456

# Invoke directly
sam local invoke HelloWorldAgent --event test-event.json

# With Docker
docker run -p 9000:8080 \
  -e REDIS_URL=redis://host.docker.internal:6380 \
  hello-world-lambda:latest
```

## Environment Variables

- `REDIS_URL` - Redis connection string (default: redis://localhost:6380)
- `AGENT_TYPE` - Agent type identifier (default: hello-world)
- `PORT` - Local server port (default: 3456)
- `USE_AWS_LAMBDA` - Use real AWS Lambda vs local (default: false)

## Production Considerations

1. **Cold Starts**: First invocation takes 1-3 seconds
2. **Timeout**: Configure based on task complexity (max 15 minutes)
3. **Memory**: Start with 512MB, adjust based on usage
4. **Concurrency**: Set reserved concurrency for predictable performance
5. **VPC**: Only use if you need access to private resources
6. **Monitoring**: Use CloudWatch Logs and X-Ray for tracing

## Extending the Agent

To add real functionality:

1. Modify `index.js` handler to process tasks
2. Add any required npm packages
3. Update the Lambda configuration (memory, timeout)
4. Add error handling and retries
5. Implement proper logging

## Troubleshooting

- **Lambda not receiving tasks**: Check Redis connection and channel subscription
- **Timeouts**: Increase timeout_ms in constraints
- **Cold starts slow**: Use provisioned concurrency or keep-warm events
- **Redis connection fails**: Ensure Lambda has network access to Redis

## Cost Estimation

- Lambda: $0.20 per 1M requests + $0.00001667 per GB-second
- API Gateway: $1.00 per million requests
- For 1000 tasks/day with 512MB and 2-second average:
  - Lambda: ~$0.03/day
  - API Gateway: ~$0.001/day
  - Total: ~$1/month