# Product Owner Agent

An AI-powered agent that generates comprehensive application requirements using Domain-Driven Design (DDD) principles. This agent acts as an automated Product Owner, creating structured requirements with domains, capabilities, and features.

**Architecture:** Extends `BaseAgent` and uses the shared LLM functionality (`callClaude()`) with built-in circuit breaker and retry logic.

## 🎯 Features

- **Domain-Driven Design**: Automatically identifies bounded contexts and domain boundaries
- **Hierarchical Requirements**: Domains → Capabilities → Features structure
- **User Stories**: Generates user stories with acceptance criteria
- **Technical Considerations**: Includes technical constraints and dependencies
- **MVP Scoping**: Defines what's in and out of MVP scope
- **Non-Functional Requirements**: Performance, security, scalability, usability
- **JSON Output**: Structured, validated JSON output ready for downstream processing

## 📊 Output Structure

```json
{
  "requirements": {
    "application": {
      "name": "Application Name",
      "type": "web|mobile|api",
      "industry": "Industry",
      "target_users": ["User Personas"]
    },
    "domains": [
      {
        "name": "Domain Name",
        "bounded_context": "ContextName",
        "capabilities": [
          {
            "name": "Capability",
            "priority": "critical|high|medium|low",
            "features": [
              {
                "name": "Feature Name",
                "user_story": "As a...",
                "acceptance_criteria": ["..."],
                "effort_estimate": "small|medium|large|x-large"
              }
            ]
          }
        ],
        "entities": ["Entity1", "Entity2"],
        "aggregates": ["Aggregate1"]
      }
    ],
    "non_functional_requirements": {
      "performance": ["..."],
      "security": ["..."],
      "scalability": ["..."]
    },
    "mvp_scope": {
      "included_features": ["..."],
      "timeline": "3 months"
    }
  }
}
```

## 🚀 Quick Start

### Install Dependencies
```bash
cd packages/agents/product-owner-lambda
pnpm install
```

### Environment Configuration

The agent automatically loads configuration from `.env.development` in the project root:

```bash
# Already configured in .env.development:
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}  # Loaded from your shell environment
REDIS_HOST=localhost
REDIS_PORT=6380

# Optional: Platform scoping (add to .env.development if needed)
PLATFORM_ID=requirements-platform
```

**Note:** Ensure your `ANTHROPIC_API_KEY` is set in your shell environment:
```bash
export ANTHROPIC_API_KEY=sk-ant-...  # Your actual key
```

### Build and Run
```bash
# Build TypeScript
pnpm build

# Run the agent
pnpm start

# Or run in development mode (with tsx)
pnpm dev
```

### Test the Agent
```bash
# Run all test scenarios
npm test

# Or test manually
curl -X POST http://localhost:3457/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "test-123",
    "workflow_id": "test-workflow",
    "payload": {
      "application_type": "e-commerce",
      "description": "Online marketplace for handmade crafts",
      "industry": "Retail",
      "target_market": "Craft enthusiasts",
      "key_features": "Product catalog, shopping cart, payments",
      "constraints": "Mobile-first, multi-currency support"
    }
  }'
```

## 📝 Input Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `application_type` | string | Yes | Type of application (e-commerce, healthcare, saas, etc.) |
| `description` | string | Yes | Brief description of the application |
| `industry` | string | No | Target industry (Retail, Healthcare, Finance, etc.) |
| `target_market` | string | No | Target user demographic |
| `key_features` | string | No | Comma-separated list of desired features |
| `constraints` | string | No | Technical or business constraints |

## 🧪 Test Scenarios

The agent includes pre-built test scenarios for:

1. **E-Commerce Platform** - Online marketplace
2. **Healthcare Portal** - Patient management system
3. **SaaS Project Management** - Team collaboration tool
4. **FinTech Mobile Banking** - Digital banking app
5. **Educational Platform** - Online learning system

Run tests with:
```bash
npm test
```

## 🏗️ Architecture Integration

### With Orchestrator

Register the agent with your orchestrator:

```javascript
// In your orchestrator
const registry = require('@agentic-sdlc/agent-registry');

registry.registerAgent({
  type: 'product-owner',
  handler: 'https://your-lambda-url/invoke',
  platform: 'requirements-platform'
});
```

### In Workflows

Use in workflow definitions:

```javascript
{
  stages: [
    {
      name: 'requirements-generation',
      agent_type: 'product-owner',
      required: true,
      timeout_ms: 60000,
      input: {
        application_type: 'saas',
        description: 'Project management tool'
      }
    },
    {
      name: 'architecture-design',
      agent_type: 'architect',
      depends_on: ['requirements-generation']
    }
  ]
}
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Claude API key for AI generation | None (uses templates) |
| `REDIS_URL` | Redis connection for publishing results | redis://localhost:6380 |
| `PORT` | Server port | 3457 |

### AI Models

- **With API Key**: Uses Claude 3 Sonnet for intelligent generation
- **Without API Key**: Falls back to template-based generation

## 📦 AWS Deployment

### Using SAM CLI

```bash
# Build and deploy
sam build
sam deploy --guided

# Configuration prompts:
# Stack Name: product-owner-agent
# Region: us-east-1
# Parameter AnthropicApiKey: your-key
```

### Using Terraform

```hcl
resource "aws_lambda_function" "product_owner" {
  function_name = "product-owner-agent"
  runtime       = "nodejs18.x"
  handler       = "index.handler"
  timeout       = 60
  memory_size   = 512

  environment {
    variables = {
      ANTHROPIC_API_KEY = var.anthropic_api_key
      REDIS_URL        = var.redis_url
    }
  }
}
```

## 🎨 Customization

### Adding New Domains

Modify the fallback template in `index.js`:

```javascript
function generateFallbackRequirements(input) {
  // Add your domain-specific logic
  const customDomain = {
    name: 'Custom Domain',
    bounded_context: 'CustomContext',
    capabilities: [...]
  };

  return {
    domains: [customDomain, ...defaultDomains]
  };
}
```

### Custom Prompts

Adjust the AI prompts for specific industries:

```javascript
const industryPrompts = {
  healthcare: 'Include HIPAA compliance...',
  finance: 'Include PCI DSS requirements...',
  education: 'Include FERPA compliance...'
};
```

## 📊 Validation

The agent includes Zod schema validation:

```javascript
const { validateRequirements } = require('./requirements-schema');

const result = generateRequirements(input);
const validation = validateRequirements(result);

if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}
```

## 🔍 Output Examples

### E-Commerce Domain
```json
{
  "name": "Product Catalog",
  "bounded_context": "CatalogContext",
  "capabilities": [
    {
      "name": "Product Management",
      "priority": "critical",
      "features": [
        {
          "name": "Product Creation",
          "user_story": "As a seller, I want to create product listings",
          "acceptance_criteria": [
            "Product must have title, description, price",
            "Support multiple images",
            "SEO-friendly URLs"
          ],
          "effort_estimate": "large"
        }
      ]
    }
  ],
  "entities": ["Product", "Category", "Inventory"],
  "aggregates": ["ProductAggregate"]
}
```

### Healthcare Domain
```json
{
  "name": "Patient Management",
  "bounded_context": "PatientContext",
  "capabilities": [
    {
      "name": "Appointment Scheduling",
      "priority": "high",
      "features": [
        {
          "name": "Book Appointment",
          "user_story": "As a patient, I want to schedule appointments online",
          "acceptance_criteria": [
            "View available time slots",
            "Select provider and service",
            "Receive confirmation email"
          ],
          "effort_estimate": "medium"
        }
      ]
    }
  ],
  "entities": ["Patient", "Appointment", "Provider"],
  "aggregates": ["AppointmentAggregate"]
}
```

## 🐛 Troubleshooting

### No Output Generated
- Check API key is set correctly
- Verify input parameters are valid
- Check server logs for errors

### Validation Errors
- Review schema in `requirements-schema.js`
- Ensure all required fields are present
- Check data types match schema

### Timeout Issues
- Increase Lambda timeout (default 60s)
- Simplify input for faster generation
- Use template mode for testing

## 📈 Performance

- **With AI**: 5-15 seconds generation time
- **Template Mode**: < 100ms generation time
- **Memory Usage**: ~256MB typical, 512MB recommended
- **Cold Start**: 1-2 seconds

## 🤝 Contributing

To extend this agent:

1. Add new test scenarios in `test-scenarios.js`
2. Enhance schema in `requirements-schema.js`
3. Improve prompts in `index.js`
4. Add industry-specific templates

## 📄 License

Part of the Agentic SDLC platform