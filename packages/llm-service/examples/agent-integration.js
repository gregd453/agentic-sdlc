/**
 * Agent Integration Examples
 *
 * Shows how to integrate the local LLM service into existing agents
 */

const { LLMClient } = require('../src/llm-client');

/**
 * Example 1: Modify BaseAgent to use local LLM
 */
class EnhancedBaseAgent {
  constructor(messageBus, options = {}) {
    this.messageBus = messageBus;
    this.options = options;

    // Initialize LLM client
    this.llm = new LLMClient({
      gatewayUrl: options.llmGatewayUrl || process.env.LLM_GATEWAY_URL,
      preferLocal: true  // Prefer local Llama over external APIs
    });
  }

  async processTask(envelope) {
    const { task_id, payload } = envelope;

    try {
      // Use local LLM for processing
      const result = await this.llm.complete(
        this.buildPrompt(payload),
        {
          system: this.getSystemPrompt(),
          agent: this.agentType,
          temperature: 0.7,
          maxTokens: 2000,
          format: 'json'
        }
      );

      return {
        task_id,
        status: 'completed',
        result
      };
    } catch (error) {
      console.error('Task processing failed:', error);
      return {
        task_id,
        status: 'failed',
        error: error.message
      };
    }
  }

  buildPrompt(payload) {
    // Agent-specific prompt building
    return JSON.stringify(payload);
  }

  getSystemPrompt() {
    return 'You are an AI assistant helping with software development tasks.';
  }
}

/**
 * Example 2: Scaffold Agent using local LLM
 */
class LocalLLMScaffoldAgent {
  constructor() {
    this.llm = new LLMClient();
    this.agentType = 'scaffold';
  }

  async generateScaffold(requirements) {
    const prompt = `
Generate a project scaffold based on these requirements:
${JSON.stringify(requirements, null, 2)}

Provide a JSON response with:
1. Project structure (directories and files)
2. Package.json configuration
3. Main application files
4. Docker configuration
5. README content
    `;

    const system = `You are an expert software architect.
Generate clean, production-ready project scaffolds.
Follow best practices for the technology stack.
Include proper error handling and logging.`;

    const scaffold = await this.llm.complete(prompt, {
      system,
      agent: this.agentType,
      temperature: 0.3,  // Lower temperature for more consistent output
      maxTokens: 4000,
      format: 'json'
    });

    return scaffold;
  }
}

/**
 * Example 3: Product Owner Agent with local LLM fallback
 */
class HybridProductOwnerAgent {
  constructor() {
    this.llm = new LLMClient({
      preferLocal: false  // Try Anthropic first, fall back to local
    });
  }

  async generateRequirements(input) {
    const prompt = `
Generate detailed software requirements for:
Application Type: ${input.application_type}
Description: ${input.description}
Industry: ${input.industry}

Include domains, capabilities, features, and user stories.
    `;

    try {
      // This will try Anthropic first, then fall back to local Llama
      const requirements = await this.llm.complete(prompt, {
        system: 'You are an expert Product Owner using Domain-Driven Design.',
        agent: 'product-owner',
        temperature: 0.7,
        maxTokens: 4000,
        format: 'json'
      });

      return requirements;
    } catch (error) {
      // If both fail, use a template
      return this.generateTemplateRequirements(input);
    }
  }

  generateTemplateRequirements(input) {
    // Fallback template logic
    return {
      application: { name: input.application_type },
      domains: []
    };
  }
}

/**
 * Example 4: Test Agent with streaming responses
 */
class StreamingTestAgent {
  constructor() {
    this.llm = new LLMClient();
  }

  async *generateTests(code) {
    const prompt = `
Generate comprehensive unit tests for this code:
\`\`\`javascript
${code}
\`\`\`

Generate tests one by one, explaining each test.
    `;

    // Stream the response for real-time output
    for await (const chunk of this.llm.streamComplete(prompt, {
      agent: 'test',
      temperature: 0.2,
      maxTokens: 3000
    })) {
      yield chunk;
    }
  }
}

/**
 * Example 5: Multi-model agent that selects the best model
 */
class MultiModelAgent {
  constructor() {
    this.llm = new LLMClient();
  }

  async process(task) {
    const { complexity, urgency } = this.analyzeTask(task);

    let model;
    if (complexity === 'high' && urgency === 'low') {
      // Use the 70B model for complex tasks when we have time
      model = 'llama3.3:70b-instruct';
    } else if (urgency === 'high') {
      // Use smaller, faster model for urgent tasks
      model = 'llama3.3:8b-instruct';
    } else {
      // Let the gateway choose
      model = 'auto';
    }

    return await this.llm.complete(task.prompt, {
      model,
      agent: this.agentType,
      temperature: 0.5
    });
  }

  analyzeTask(task) {
    // Simple heuristic for task analysis
    const wordCount = task.prompt.split(' ').length;
    return {
      complexity: wordCount > 500 ? 'high' : 'low',
      urgency: task.priority === 'critical' ? 'high' : 'low'
    };
  }
}

/**
 * Example 6: Agent with health monitoring
 */
class ResilientAgent {
  constructor() {
    this.llm = new LLMClient();
    this.healthy = false;
    this.checkHealthPeriodically();
  }

  async checkHealthPeriodically() {
    setInterval(async () => {
      const health = await this.llm.checkHealth();
      this.healthy = health.available;

      if (!this.healthy) {
        console.warn('LLM service unavailable, agent operating in degraded mode');
      } else {
        console.log('LLM service healthy:', health);
      }
    }, 60000);  // Check every minute
  }

  async process(task) {
    if (!this.healthy) {
      // Use simplified logic when LLM is unavailable
      return this.fallbackProcess(task);
    }

    return await this.llm.complete(task.prompt, {
      agent: this.agentType
    });
  }

  fallbackProcess(task) {
    // Simplified processing without LLM
    return {
      status: 'degraded',
      result: 'Processed without LLM assistance'
    };
  }
}

/**
 * Usage examples
 */
async function demonstrateUsage() {
  // 1. Create scaffold with local LLM
  const scaffoldAgent = new LocalLLMScaffoldAgent();
  const scaffold = await scaffoldAgent.generateScaffold({
    type: 'microservice',
    language: 'nodejs',
    features: ['REST API', 'Database', 'Auth']
  });
  console.log('Generated scaffold:', scaffold);

  // 2. Generate requirements with hybrid approach
  const productOwner = new HybridProductOwnerAgent();
  const requirements = await productOwner.generateRequirements({
    application_type: 'e-commerce',
    description: 'Online marketplace',
    industry: 'Retail'
  });
  console.log('Generated requirements:', requirements);

  // 3. Stream test generation
  const testAgent = new StreamingTestAgent();
  console.log('Generating tests...');
  for await (const chunk of testAgent.generateTests('function add(a, b) { return a + b; }')) {
    process.stdout.write(chunk);
  }

  // 4. Check LLM health
  const llm = new LLMClient();
  const health = await llm.checkHealth();
  console.log('LLM Service Health:', health);
}

// Export for use in agents
module.exports = {
  EnhancedBaseAgent,
  LocalLLMScaffoldAgent,
  HybridProductOwnerAgent,
  StreamingTestAgent,
  MultiModelAgent,
  ResilientAgent,
  demonstrateUsage
};