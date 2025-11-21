/**
 * LLM Gateway Service with Distributed Tracing
 *
 * Enhanced version with full trace propagation and envelope awareness
 */

const express = require('express');
const Redis = require('ioredis');
const axios = require('axios');
const crypto = require('crypto');
const { logger } = require('@agentic-sdlc/logger-config');
const { v4: uuidv4 } = require('uuid');

class TracedLLMGateway {
  constructor(config = {}) {
    this.config = {
      port: config.port || process.env.PORT || 3458,
      redisUrl: config.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379',
      serviceName: 'llm-gateway',
      // ... rest of config same as before
    };

    this.redis = null;
    this.eventPublisher = null;
  }

  async initialize() {
    // Initialize Redis for caching and event publishing
    if (this.config.redisUrl) {
      this.redis = new Redis(this.config.redisUrl);
      this.eventPublisher = new Redis(this.config.redisUrl);
      logger.info({
        service: this.config.serviceName,
        msg: 'Connected to Redis for caching and events'
      });
    }

    await this.testBackends();
    this.setupServer();
  }

  setupServer() {
    const app = express();
    app.use(express.json({ limit: '10mb' }));

    // Trace middleware
    app.use((req, res, next) => {
      // Extract trace context from headers
      req.traceContext = {
        trace_id: req.headers['x-trace-id'] || uuidv4(),
        parent_span_id: req.headers['x-span-id'],
        span_id: this.generateSpanId(),
        task_id: req.headers['x-task-id'],
        workflow_id: req.headers['x-workflow-id'],
        agent_type: req.headers['x-agent-type']
      };

      req.startTime = Date.now();

      // Log request with trace
      logger.info({
        service: this.config.serviceName,
        trace_id: req.traceContext.trace_id,
        span_id: req.traceContext.span_id,
        parent_span_id: req.traceContext.parent_span_id,
        task_id: req.traceContext.task_id,
        workflow_id: req.traceContext.workflow_id,
        agent_type: req.traceContext.agent_type,
        method: req.method,
        path: req.path,
        msg: 'LLM Gateway request received'
      });

      // Publish trace event
      this.publishTraceEvent('llm_request_start', req.traceContext, {
        method: req.method,
        path: req.path
      });

      next();
    });

    // Response logging middleware
    app.use((req, res, next) => {
      const originalSend = res.send;
      res.send = function(data) {
        const duration = Date.now() - req.startTime;

        // Log response with trace
        logger.info({
          service: 'llm-gateway',
          trace_id: req.traceContext.trace_id,
          span_id: req.traceContext.span_id,
          task_id: req.traceContext.task_id,
          workflow_id: req.traceContext.workflow_id,
          status_code: res.statusCode,
          duration_ms: duration,
          msg: 'LLM Gateway request completed'
        });

        // Publish trace event
        this.publishTraceEvent('llm_request_complete', req.traceContext, {
          status_code: res.statusCode,
          duration_ms: duration
        });

        originalSend.call(this, data);
      };
      next();
    });

    // OpenAI-compatible completion endpoint with tracing
    app.post('/v1/chat/completions', async (req, res) => {
      const { trace_id, span_id, task_id, workflow_id, agent_type } = req.traceContext;

      try {
        // Create child span for LLM processing
        const llmSpanId = this.generateSpanId();

        logger.debug({
          service: this.config.serviceName,
          trace_id,
          parent_span_id: span_id,
          span_id: llmSpanId,
          task_id,
          model: req.body.model,
          msg: 'Processing LLM completion request'
        });

        // Process with tracing
        const result = await this.handleCompletionWithTracing(req.body, {
          ...req.traceContext,
          llm_span_id: llmSpanId
        });

        // Add trace headers to response
        res.set({
          'X-Trace-Id': trace_id,
          'X-Span-Id': span_id,
          'X-LLM-Model': result.model,
          'X-Cache-Hit': result.fromCache ? 'true' : 'false'
        });

        res.json(result);
      } catch (error) {
        logger.error({
          service: this.config.serviceName,
          trace_id,
          span_id,
          task_id,
          error: error.message,
          stack: error.stack,
          msg: 'LLM completion failed'
        });

        this.publishTraceEvent('llm_request_error', req.traceContext, {
          error: error.message
        });

        res.status(500).json({ error: error.message });
      }
    });

    // Agent-specific endpoint with enhanced tracing
    app.post('/agent/:agentType/complete', async (req, res) => {
      const agentType = req.params.agentType;
      const enhancedContext = {
        ...req.traceContext,
        agent_type: agentType // Override with URL param
      };

      try {
        const result = await this.handleAgentCompletionWithTracing(
          agentType,
          req.body,
          enhancedContext
        );

        res.json(result);
      } catch (error) {
        logger.error({
          service: this.config.serviceName,
          trace_id: enhancedContext.trace_id,
          span_id: enhancedContext.span_id,
          agent_type: agentType,
          error: error.message,
          msg: 'Agent-specific completion failed'
        });

        res.status(500).json({ error: error.message });
      }
    });

    // Health endpoint
    app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: this.config.serviceName,
        trace_enabled: true,
        backends: this.getBackendStatus()
      });
    });

    app.listen(this.config.port, () => {
      logger.info({
        service: this.config.serviceName,
        port: this.config.port,
        msg: 'LLM Gateway with tracing started'
      });
    });

    this.app = app;
  }

  async handleCompletionWithTracing(request, traceContext) {
    const {
      trace_id,
      span_id,
      llm_span_id,
      task_id,
      workflow_id,
      agent_type
    } = traceContext;

    const startTime = Date.now();

    // Check cache with trace logging
    if (this.config.caching.enabled) {
      const cacheKey = this.getCacheKey(request);
      const cached = await this.getFromCache(cacheKey);

      if (cached) {
        logger.debug({
          service: this.config.serviceName,
          trace_id,
          span_id: llm_span_id,
          task_id,
          cache_hit: true,
          msg: 'Returning cached LLM response'
        });

        this.publishTraceEvent('llm_cache_hit', traceContext, {
          cache_key: cacheKey
        });

        return { ...cached, fromCache: true };
      }
    }

    // Call LLM backend with tracing
    let result = null;
    let backendUsed = null;

    for (const [backendName, backend] of this.getSortedBackends()) {
      if (!backend.enabled || !backend.available) continue;

      try {
        logger.debug({
          service: this.config.serviceName,
          trace_id,
          span_id: llm_span_id,
          backend: backendName,
          msg: 'Calling LLM backend'
        });

        const backendStartTime = Date.now();

        result = await this.callBackendWithTracing(backendName, request, traceContext);

        const backendDuration = Date.now() - backendStartTime;

        logger.info({
          service: this.config.serviceName,
          trace_id,
          span_id: llm_span_id,
          task_id,
          backend: backendName,
          duration_ms: backendDuration,
          tokens_used: result.usage?.total_tokens,
          msg: 'LLM backend call successful'
        });

        this.publishTraceEvent('llm_backend_success', traceContext, {
          backend: backendName,
          duration_ms: backendDuration,
          tokens: result.usage
        });

        backendUsed = backendName;
        break;
      } catch (error) {
        logger.warn({
          service: this.config.serviceName,
          trace_id,
          span_id: llm_span_id,
          backend: backendName,
          error: error.message,
          msg: 'LLM backend failed, trying next'
        });

        this.publishTraceEvent('llm_backend_failure', traceContext, {
          backend: backendName,
          error: error.message
        });
      }
    }

    if (!result) {
      throw new Error('No LLM backends available');
    }

    // Cache result
    if (this.config.caching.enabled && !request.stream) {
      const cacheKey = this.getCacheKey(request);
      await this.saveToCache(cacheKey, result);

      logger.debug({
        service: this.config.serviceName,
        trace_id,
        span_id: llm_span_id,
        cache_key: cacheKey,
        msg: 'Cached LLM response'
      });
    }

    // Log completion metrics
    const totalDuration = Date.now() - startTime;

    logger.info({
      service: this.config.serviceName,
      trace_id,
      span_id,
      task_id,
      workflow_id,
      agent_type,
      backend_used: backendUsed,
      total_duration_ms: totalDuration,
      tokens_used: result.usage?.total_tokens,
      msg: 'LLM completion processed successfully'
    });

    this.publishTraceEvent('llm_completion_success', traceContext, {
      backend: backendUsed,
      duration_ms: totalDuration,
      tokens: result.usage
    });

    return result;
  }

  async callBackendWithTracing(backendName, request, traceContext) {
    // Add trace headers to backend calls
    const headers = {
      'X-Trace-Id': traceContext.trace_id,
      'X-Span-Id': traceContext.llm_span_id || traceContext.span_id,
      'X-Task-Id': traceContext.task_id,
      'X-Workflow-Id': traceContext.workflow_id
    };

    switch (backendName) {
      case 'ollama':
        return this.callOllama(request, headers);
      case 'vllm':
        return this.callVLLM(request, headers);
      case 'anthropic':
        return this.callAnthropic(request, headers);
      default:
        throw new Error(`Unknown backend: ${backendName}`);
    }
  }

  async handleAgentCompletionWithTracing(agentType, request, traceContext) {
    // Log agent-specific request
    logger.info({
      service: this.config.serviceName,
      trace_id: traceContext.trace_id,
      span_id: traceContext.span_id,
      agent_type: agentType,
      task_id: traceContext.task_id,
      workflow_id: traceContext.workflow_id,
      msg: 'Processing agent-specific LLM request'
    });

    // Get agent-specific configuration
    const agentConfigs = {
      'scaffold': { temperature: 0.3, max_tokens: 2000 },
      'validation': { temperature: 0.1, max_tokens: 1000 },
      'product-owner': { temperature: 0.7, max_tokens: 4000 },
      'architect': { temperature: 0.5, max_tokens: 3000 },
      'test': { temperature: 0.2, max_tokens: 2000 }
    };

    const config = agentConfigs[agentType] || {};
    const mergedRequest = { ...request, ...config };

    // Process with enhanced context
    return this.handleCompletionWithTracing(mergedRequest, {
      ...traceContext,
      agent_type: agentType
    });
  }

  /**
   * Publish trace event to Redis for aggregation
   */
  async publishTraceEvent(eventType, traceContext, metadata = {}) {
    if (!this.eventPublisher) return;

    const event = {
      event_type: eventType,
      service: this.config.serviceName,
      timestamp: new Date().toISOString(),
      trace: {
        trace_id: traceContext.trace_id,
        span_id: traceContext.span_id || traceContext.llm_span_id,
        parent_span_id: traceContext.parent_span_id
      },
      task_id: traceContext.task_id,
      workflow_id: traceContext.workflow_id,
      agent_type: traceContext.agent_type,
      metadata
    };

    const channel = `traces:${traceContext.trace_id}:events`;

    try {
      await this.eventPublisher.publish(channel, JSON.stringify(event));
      await this.eventPublisher.lpush(`trace:events:${traceContext.trace_id}`, JSON.stringify(event));
      await this.eventPublisher.expire(`trace:events:${traceContext.trace_id}`, 86400); // 24 hours
    } catch (error) {
      logger.error({
        service: this.config.serviceName,
        error: error.message,
        msg: 'Failed to publish trace event'
      });
    }
  }

  generateSpanId() {
    return `llm-span-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Rest of the methods remain similar but with trace logging added...
}

// Start the traced gateway
if (require.main === module) {
  const gateway = new TracedLLMGateway();
  gateway.initialize().catch(console.error);
}

module.exports = { TracedLLMGateway };