/**
 * Envelope-Aware LLM Agent Base Class
 *
 * Properly integrates with AgentEnvelope v2.0 schema and distributed tracing
 */

const { BaseAgent } = require('@agentic-sdlc/base-agent');
const { AgentEnvelopeSchema } = require('@agentic-sdlc/shared-types');
const { LLMClient } = require('./llm-client');
const { logger } = require('@agentic-sdlc/logger-config');
const { v4: uuidv4 } = require('uuid');

class EnvelopeAwareLLMAgent extends BaseAgent {
  constructor(messageBus, options = {}) {
    super(messageBus, options);

    this.llm = new LLMClient({
      gatewayUrl: options.llmGatewayUrl || process.env.LLM_GATEWAY_URL,
      preferLocal: options.preferLocal !== false
    });

    this.agentType = options.agentType || 'llm-agent';
    this.agentId = `${this.agentType}-${uuidv4()}`;
  }

  /**
   * Process task with full envelope support and tracing
   */
  async processTask(envelope) {
    // Validate incoming envelope
    const validationResult = AgentEnvelopeSchema.safeParse(envelope);
    if (!validationResult.success) {
      logger.error({
        agent_id: this.agentId,
        task_id: envelope?.task_id,
        errors: validationResult.error.errors,
        msg: 'Invalid envelope received'
      });
      throw new Error('Invalid envelope format');
    }

    const {
      message_id,
      task_id,
      workflow_id,
      agent_type,
      priority,
      status,
      payload,
      workflow_context,
      constraints,
      metadata,
      trace
    } = validationResult.data;

    // Start span for this task
    const spanId = this.generateSpanId();
    const startTime = Date.now();

    // Log task start with trace context
    logger.info({
      agent_id: this.agentId,
      agent_type: this.agentType,
      task_id,
      workflow_id,
      trace_id: trace?.trace_id,
      parent_span_id: trace?.span_id,
      span_id: spanId,
      priority,
      msg: 'Starting LLM task processing'
    });

    try {
      // Process with LLM
      const llmResult = await this.processWithLLM(payload, {
        task_id,
        workflow_id,
        workflow_context,
        constraints,
        trace: {
          ...trace,
          parent_span_id: trace?.span_id,
          span_id: spanId
        }
      });

      // Build result maintaining envelope structure
      const result = {
        message_id: uuidv4(),
        task_id,
        workflow_id,
        agent_type: this.agentType,
        status: 'completed',
        result: llmResult,
        metadata: {
          ...metadata,
          completed_at: new Date().toISOString(),
          completed_by: this.agentId,
          processing_time_ms: Date.now() - startTime,
          llm_model_used: llmResult.model || 'unknown'
        },
        trace: {
          trace_id: trace?.trace_id,
          span_id: spanId,
          parent_span_id: trace?.span_id
        }
      };

      // Log success with trace
      logger.info({
        agent_id: this.agentId,
        task_id,
        workflow_id,
        trace_id: trace?.trace_id,
        span_id: spanId,
        duration_ms: Date.now() - startTime,
        msg: 'LLM task completed successfully'
      });

      // Publish result with full envelope
      await this.publishResult(result);

      return result;

    } catch (error) {
      // Log error with trace context
      logger.error({
        agent_id: this.agentId,
        task_id,
        workflow_id,
        trace_id: trace?.trace_id,
        span_id: spanId,
        error: error.message,
        stack: error.stack,
        duration_ms: Date.now() - startTime,
        msg: 'LLM task processing failed'
      });

      // Build error result
      const errorResult = {
        message_id: uuidv4(),
        task_id,
        workflow_id,
        agent_type: this.agentType,
        status: 'failed',
        error: {
          code: error.code || 'LLM_PROCESSING_ERROR',
          message: error.message,
          details: error.details,
          retryable: this.isRetryableError(error)
        },
        metadata: {
          ...metadata,
          failed_at: new Date().toISOString(),
          failed_by: this.agentId,
          processing_time_ms: Date.now() - startTime
        },
        trace: {
          trace_id: trace?.trace_id,
          span_id: spanId,
          parent_span_id: trace?.span_id
        }
      };

      await this.publishError(errorResult);
      throw error;
    }
  }

  /**
   * Process with LLM while maintaining trace context
   */
  async processWithLLM(payload, context) {
    const { task_id, workflow_id, workflow_context, constraints, trace } = context;

    // Build prompt with context
    const prompt = this.buildPromptWithContext(payload, workflow_context);

    // Get system prompt based on agent type
    const systemPrompt = this.getSystemPrompt();

    // Add trace headers for LLM gateway
    const headers = {
      'X-Trace-Id': trace?.trace_id,
      'X-Span-Id': trace?.span_id,
      'X-Task-Id': task_id,
      'X-Workflow-Id': workflow_id,
      'X-Agent-Type': this.agentType
    };

    // Call LLM with constraints
    const llmResponse = await this.llm.complete(prompt, {
      system: systemPrompt,
      agent: this.agentType,
      temperature: constraints?.llm_temperature || 0.7,
      maxTokens: constraints?.max_tokens || 2000,
      timeout: constraints?.timeout_ms,
      format: 'json',
      headers,
      useCache: constraints?.enable_cache !== false
    });

    return llmResponse;
  }

  /**
   * Build prompt with workflow context
   */
  buildPromptWithContext(payload, workflowContext) {
    let prompt = `Process this task:\n${JSON.stringify(payload, null, 2)}`;

    if (workflowContext?.stage_outputs) {
      prompt += `\n\nPrevious stage outputs:\n${JSON.stringify(workflowContext.stage_outputs, null, 2)}`;
    }

    if (workflowContext?.workflow_type) {
      prompt += `\n\nWorkflow type: ${workflowContext.workflow_type}`;
    }

    return prompt;
  }

  /**
   * Get system prompt for agent type
   */
  getSystemPrompt() {
    const prompts = {
      'scaffold': 'You are an expert software architect. Generate clean, production-ready code scaffolds.',
      'validation': 'You are a code quality expert. Validate code for errors, best practices, and security issues.',
      'product-owner': 'You are an expert Product Owner. Generate detailed requirements using Domain-Driven Design.',
      'test': 'You are a test automation expert. Generate comprehensive test cases and test code.',
      'architect': 'You are a solution architect. Design scalable, maintainable system architectures.'
    };

    return prompts[this.agentType] || 'You are an AI assistant helping with software development tasks.';
  }

  /**
   * Publish result maintaining envelope structure
   */
  async publishResult(result) {
    const channel = `workflow:${result.workflow_id}:task:${result.task_id}:complete`;

    logger.debug({
      agent_id: this.agentId,
      channel,
      task_id: result.task_id,
      trace_id: result.trace?.trace_id,
      msg: 'Publishing task result'
    });

    await this.messageBus.publish(channel, JSON.stringify(result));
  }

  /**
   * Publish error with envelope structure
   */
  async publishError(errorResult) {
    const channel = `workflow:${errorResult.workflow_id}:task:${errorResult.task_id}:error`;

    logger.debug({
      agent_id: this.agentId,
      channel,
      task_id: errorResult.task_id,
      trace_id: errorResult.trace?.trace_id,
      msg: 'Publishing task error'
    });

    await this.messageBus.publish(channel, JSON.stringify(errorResult));
  }

  /**
   * Generate span ID for tracing
   */
  generateSpanId() {
    return `span-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Determine if error is retryable
   */
  isRetryableError(error) {
    const retryableCodes = [
      'TIMEOUT',
      'RATE_LIMIT',
      'SERVICE_UNAVAILABLE',
      'GATEWAY_TIMEOUT'
    ];

    return retryableCodes.includes(error.code) || error.status === 503 || error.status === 504;
  }
}

/**
 * Example: Scaffold Agent with full envelope support
 */
class LLMScaffoldAgent extends EnvelopeAwareLLMAgent {
  constructor(messageBus, options = {}) {
    super(messageBus, {
      ...options,
      agentType: 'scaffold'
    });
  }

  buildPromptWithContext(payload, workflowContext) {
    const { project_type, language, features, requirements } = payload;

    let prompt = `Generate a complete project scaffold with the following specifications:

Project Type: ${project_type}
Language: ${language}
Features: ${features?.join(', ')}

Requirements:
${JSON.stringify(requirements, null, 2)}

Generate a comprehensive scaffold including:
1. Complete directory structure
2. All necessary configuration files
3. Main application files with boilerplate code
4. Docker configuration
5. README with setup instructions
6. Package dependencies

Return as JSON with structure:
{
  "directories": [...],
  "files": {
    "path/to/file": "file content",
    ...
  },
  "dependencies": {...},
  "devDependencies": {...},
  "dockerConfig": {...},
  "readme": "..."
}`;

    // Add context from previous stages if available
    if (workflowContext?.stage_outputs?.requirements) {
      prompt += `\n\nBased on these requirements from previous stage:\n${JSON.stringify(workflowContext.stage_outputs.requirements, null, 2)}`;
    }

    return prompt;
  }
}

/**
 * Example: Product Owner Agent with envelope support
 */
class LLMProductOwnerAgent extends EnvelopeAwareLLMAgent {
  constructor(messageBus, options = {}) {
    super(messageBus, {
      ...options,
      agentType: 'product-owner'
    });
  }

  buildPromptWithContext(payload, workflowContext) {
    const { application_type, description, industry, target_market, key_features } = payload;

    return `Generate comprehensive software requirements for:

Application Type: ${application_type}
Description: ${description}
Industry: ${industry}
Target Market: ${target_market}
Key Features: ${key_features}

Use Domain-Driven Design principles to structure the requirements with:
- Bounded contexts (domains)
- Business capabilities
- Features with user stories
- Acceptance criteria
- Non-functional requirements
- MVP scope

Return as structured JSON following the requirements schema.`;
  }
}

module.exports = {
  EnvelopeAwareLLMAgent,
  LLMScaffoldAgent,
  LLMProductOwnerAgent
};