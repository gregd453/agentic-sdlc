/**
 * LLM Gateway Service
 *
 * Provides a unified API for all agents to access local LLM capabilities
 * Supports multiple backends: Ollama, vLLM, and external APIs
 * Includes caching, load balancing, and fallback mechanisms
 */

const express = require('express');
const Redis = require('ioredis');
const axios = require('axios');
const crypto = require('crypto');

class LLMGateway {
  constructor(config = {}) {
    this.config = {
      port: config.port || process.env.PORT || 3458,
      redisUrl: config.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379',
      backends: {
        ollama: {
          url: config.ollamaUrl || process.env.OLLAMA_URL || 'http://localhost:11434',
          models: ['llama3.3:70b-instruct', 'llama3.3:8b-instruct'],
          enabled: true,
          priority: 1
        },
        vllm: {
          url: config.vllmUrl || process.env.VLLM_URL || 'http://localhost:8000',
          models: ['meta-llama/Llama-3.3-70B-Instruct'],
          enabled: false,  // Enable if vLLM is running
          priority: 2
        },
        anthropic: {
          apiKey: process.env.ANTHROPIC_API_KEY,
          models: ['claude-3-5-sonnet-20241022'],
          enabled: !!process.env.ANTHROPIC_API_KEY,
          priority: 3,
          fallbackOnly: true  // Use only if local models fail
        }
      },
      caching: {
        enabled: config.enableCaching !== false,
        ttl: config.cacheTTL || 3600,  // 1 hour
        maxSize: config.cacheMaxSize || 1000
      },
      defaults: {
        model: 'llama3.3:70b-instruct',
        temperature: 0.7,
        maxTokens: 4096,
        topP: 0.9,
        topK: 40,
        stream: false
      }
    };

    this.redis = null;
    this.cache = new Map();
    this.requestQueue = [];
    this.activeRequests = 0;
    this.maxConcurrent = 10;
    this.metrics = {
      requests: 0,
      hits: 0,
      misses: 0,
      errors: 0,
      latency: []
    };
  }

  async initialize() {
    // Initialize Redis for caching
    if (this.config.caching.enabled) {
      this.redis = new Redis(this.config.redisUrl);
      console.log('Connected to Redis for caching');
    }

    // Test backend connections
    await this.testBackends();

    // Start Express server
    this.setupServer();
  }

  async testBackends() {
    console.log('Testing LLM backends...');

    // Test Ollama
    if (this.config.backends.ollama.enabled) {
      try {
        const response = await axios.get(`${this.config.backends.ollama.url}/api/tags`);
        console.log('✅ Ollama backend available');
        this.config.backends.ollama.available = true;
      } catch (error) {
        console.log('❌ Ollama backend unavailable');
        this.config.backends.ollama.available = false;
      }
    }

    // Test vLLM
    if (this.config.backends.vllm.enabled) {
      try {
        const response = await axios.get(`${this.config.backends.vllm.url}/health`);
        console.log('✅ vLLM backend available');
        this.config.backends.vllm.available = true;
      } catch (error) {
        console.log('❌ vLLM backend unavailable');
        this.config.backends.vllm.available = false;
      }
    }

    // Test Anthropic
    if (this.config.backends.anthropic.enabled) {
      console.log('✅ Anthropic API configured as fallback');
      this.config.backends.anthropic.available = true;
    }
  }

  setupServer() {
    const app = express();
    app.use(express.json({ limit: '10mb' }));

    // Middleware for request tracking
    app.use((req, res, next) => {
      req.startTime = Date.now();
      this.metrics.requests++;
      next();
    });

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        backends: Object.entries(this.config.backends).map(([name, config]) => ({
          name,
          enabled: config.enabled,
          available: config.available || false
        })),
        metrics: this.metrics,
        cache: {
          enabled: this.config.caching.enabled,
          size: this.cache.size
        }
      });
    });

    // List available models
    app.get('/models', (req, res) => {
      const models = [];
      for (const [backend, config] of Object.entries(this.config.backends)) {
        if (config.enabled && config.available) {
          models.push(...config.models.map(model => ({
            id: model,
            backend,
            priority: config.priority
          })));
        }
      }
      res.json({ models });
    });

    // Main completion endpoint (OpenAI-compatible)
    app.post('/v1/chat/completions', async (req, res) => {
      try {
        const result = await this.handleCompletion(req.body);
        const latency = Date.now() - req.startTime;
        this.metrics.latency.push(latency);
        res.json(result);
      } catch (error) {
        this.metrics.errors++;
        res.status(500).json({ error: error.message });
      }
    });

    // Legacy completion endpoint
    app.post('/complete', async (req, res) => {
      try {
        const result = await this.handleCompletion(req.body);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Agent-specific endpoint
    app.post('/agent/:agentType/complete', async (req, res) => {
      try {
        const agentType = req.params.agentType;
        const result = await this.handleAgentCompletion(agentType, req.body);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Start server
    app.listen(this.config.port, () => {
      console.log(`LLM Gateway running on port ${this.config.port}`);
      console.log(`Available endpoints:`);
      console.log(`  GET  /health - Health check`);
      console.log(`  GET  /models - List available models`);
      console.log(`  POST /v1/chat/completions - OpenAI-compatible completion`);
      console.log(`  POST /complete - Simple completion`);
      console.log(`  POST /agent/:type/complete - Agent-specific completion`);
    });

    this.app = app;
  }

  async handleCompletion(request) {
    const {
      model = this.config.defaults.model,
      messages,
      prompt,  // Support both messages and prompt formats
      temperature = this.config.defaults.temperature,
      max_tokens = this.config.defaults.maxTokens,
      stream = this.config.defaults.stream,
      top_p = this.config.defaults.topP,
      top_k = this.config.defaults.topK
    } = request;

    // Convert to standard format
    const normalizedMessages = messages || [{ role: 'user', content: prompt }];

    // Check cache
    if (this.config.caching.enabled) {
      const cacheKey = this.getCacheKey(request);
      const cached = await this.getFromCache(cacheKey);
      if (cached) {
        this.metrics.hits++;
        return cached;
      }
      this.metrics.misses++;
    }

    // Rate limiting
    if (this.activeRequests >= this.maxConcurrent) {
      await this.waitForSlot();
    }

    this.activeRequests++;

    try {
      // Try backends in priority order
      let result = null;
      let lastError = null;

      for (const [backendName, backend] of this.getSortedBackends()) {
        if (!backend.enabled || !backend.available) continue;
        if (backend.fallbackOnly && !lastError) continue;

        try {
          result = await this.callBackend(backendName, {
            model,
            messages: normalizedMessages,
            temperature,
            max_tokens,
            stream,
            top_p,
            top_k
          });
          break;
        } catch (error) {
          console.error(`Backend ${backendName} failed:`, error.message);
          lastError = error;
        }
      }

      if (!result) {
        throw lastError || new Error('No backends available');
      }

      // Cache result
      if (this.config.caching.enabled && !stream) {
        const cacheKey = this.getCacheKey(request);
        await this.saveToCache(cacheKey, result);
      }

      return result;
    } finally {
      this.activeRequests--;
    }
  }

  async callBackend(backendName, request) {
    switch (backendName) {
      case 'ollama':
        return this.callOllama(request);
      case 'vllm':
        return this.callVLLM(request);
      case 'anthropic':
        return this.callAnthropic(request);
      default:
        throw new Error(`Unknown backend: ${backendName}`);
    }
  }

  async callOllama(request) {
    const { model, messages, temperature, max_tokens } = request;

    // Convert messages to Ollama format
    const prompt = messages.map(m => {
      if (m.role === 'system') return `System: ${m.content}`;
      if (m.role === 'user') return `User: ${m.content}`;
      if (m.role === 'assistant') return `Assistant: ${m.content}`;
      return m.content;
    }).join('\n');

    const response = await axios.post(`${this.config.backends.ollama.url}/api/generate`, {
      model: model.includes(':') ? model : `${model}:latest`,
      prompt,
      temperature,
      num_predict: max_tokens,
      stream: false
    });

    return {
      id: `ollama-${Date.now()}`,
      object: 'chat.completion',
      created: Date.now(),
      model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: response.data.response
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: response.data.prompt_eval_count || 0,
        completion_tokens: response.data.eval_count || 0,
        total_tokens: (response.data.prompt_eval_count || 0) + (response.data.eval_count || 0)
      }
    };
  }

  async callVLLM(request) {
    const { model, messages, temperature, max_tokens, top_p } = request;

    const response = await axios.post(`${this.config.backends.vllm.url}/v1/chat/completions`, {
      model,
      messages,
      temperature,
      max_tokens,
      top_p
    });

    return response.data;
  }

  async callAnthropic(request) {
    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({
      apiKey: this.config.backends.anthropic.apiKey
    });

    const { messages, temperature, max_tokens } = request;

    // Convert to Anthropic format
    const systemMessage = messages.find(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system');

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens,
      temperature,
      system: systemMessage ? systemMessage.content : undefined,
      messages: userMessages
    });

    return {
      id: `anthropic-${Date.now()}`,
      object: 'chat.completion',
      created: Date.now(),
      model: 'claude-3-5-sonnet-20241022',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: response.content[0].text
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: response.usage?.input_tokens || 0,
        completion_tokens: response.usage?.output_tokens || 0,
        total_tokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
      }
    };
  }

  async handleAgentCompletion(agentType, request) {
    // Agent-specific optimizations
    const agentConfigs = {
      'scaffold': { temperature: 0.3, max_tokens: 2000 },
      'validation': { temperature: 0.1, max_tokens: 1000 },
      'product-owner': { temperature: 0.7, max_tokens: 4000 },
      'architect': { temperature: 0.5, max_tokens: 3000 },
      'test': { temperature: 0.2, max_tokens: 2000 }
    };

    const config = agentConfigs[agentType] || {};
    const mergedRequest = { ...request, ...config };

    return this.handleCompletion(mergedRequest);
  }

  getSortedBackends() {
    return Object.entries(this.config.backends)
      .filter(([_, config]) => config.enabled && config.available)
      .sort((a, b) => a[1].priority - b[1].priority);
  }

  getCacheKey(request) {
    const key = JSON.stringify({
      model: request.model,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.max_tokens
    });
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  async getFromCache(key) {
    if (this.redis) {
      const cached = await this.redis.get(`llm:${key}`);
      return cached ? JSON.parse(cached) : null;
    }
    return this.cache.get(key);
  }

  async saveToCache(key, value) {
    if (this.redis) {
      await this.redis.setex(`llm:${key}`, this.config.caching.ttl, JSON.stringify(value));
    } else {
      this.cache.set(key, value);
      if (this.cache.size > this.config.caching.maxSize) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
    }
  }

  async waitForSlot() {
    return new Promise(resolve => {
      const check = setInterval(() => {
        if (this.activeRequests < this.maxConcurrent) {
          clearInterval(check);
          resolve();
        }
      }, 100);
    });
  }
}

// Start the gateway
if (require.main === module) {
  const gateway = new LLMGateway();
  gateway.initialize().catch(console.error);
}

module.exports = { LLMGateway };