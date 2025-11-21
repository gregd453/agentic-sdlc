/**
 * LLM Client for Agents
 *
 * Provides a simple interface for agents to use the local LLM service
 * Automatically handles failover between local and external services
 */

const axios = require('axios');

class LLMClient {
  constructor(config = {}) {
    this.gatewayUrl = config.gatewayUrl || process.env.LLM_GATEWAY_URL || 'http://localhost:3458';
    this.anthropicKey = config.anthropicKey || process.env.ANTHROPIC_API_KEY;
    this.preferLocal = config.preferLocal !== false;  // Default to local
    this.timeout = config.timeout || 30000;
    this.retries = config.retries || 3;
    this.cache = new Map();
  }

  /**
   * Generate a completion using the best available LLM
   */
  async complete(prompt, options = {}) {
    const {
      system,
      model = 'auto',  // 'auto' selects best available
      temperature = 0.7,
      maxTokens = 2000,
      format = 'json',  // 'json' or 'text'
      agent,  // Agent type for optimizations
      useCache = true
    } = options;

    // Check cache
    if (useCache) {
      const cacheKey = this.getCacheKey(prompt, options);
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }
    }

    // Build messages array
    const messages = [];
    if (system) {
      messages.push({ role: 'system', content: system });
    }
    messages.push({ role: 'user', content: prompt });

    try {
      // Try local LLM gateway first
      if (this.preferLocal) {
        try {
          const result = await this.callLocalLLM(messages, {
            model: model === 'auto' ? undefined : model,
            temperature,
            max_tokens: maxTokens,
            agent
          });

          const response = this.parseResponse(result, format);
          if (useCache) {
            this.cache.set(this.getCacheKey(prompt, options), response);
          }
          return response;
        } catch (localError) {
          console.warn('Local LLM failed, trying fallback:', localError.message);
        }
      }

      // Fallback to Anthropic if available
      if (this.anthropicKey) {
        const result = await this.callAnthropic(messages, {
          temperature,
          maxTokens
        });

        const response = this.parseResponse(result, format);
        if (useCache) {
          this.cache.set(this.getCacheKey(prompt, options), response);
        }
        return response;
      }

      throw new Error('No LLM service available');
    } catch (error) {
      console.error('LLM completion failed:', error);
      throw error;
    }
  }

  async callLocalLLM(messages, options) {
    const endpoint = options.agent
      ? `/agent/${options.agent}/complete`
      : '/v1/chat/completions';

    const response = await axios.post(
      `${this.gatewayUrl}${endpoint}`,
      {
        messages,
        ...options
      },
      {
        timeout: this.timeout,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  }

  async callAnthropic(messages, options) {
    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({
      apiKey: this.anthropicKey
    });

    const systemMessage = messages.find(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system');

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      system: systemMessage ? systemMessage.content : undefined,
      messages: userMessages
    });

    return {
      choices: [{
        message: {
          content: response.content[0].text
        }
      }]
    };
  }

  parseResponse(result, format) {
    const content = result.choices[0].message.content;

    if (format === 'json') {
      try {
        // Try to extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        // If no JSON found, try parsing the whole content
        return JSON.parse(content);
      } catch (error) {
        console.warn('Failed to parse JSON, returning text:', error.message);
        return { text: content };
      }
    }

    return content;
  }

  getCacheKey(prompt, options) {
    return `${prompt.substring(0, 50)}-${JSON.stringify(options)}`;
  }

  /**
   * Stream a completion (for long responses)
   */
  async *streamComplete(prompt, options = {}) {
    const response = await axios.post(
      `${this.gatewayUrl}/v1/chat/completions`,
      {
        messages: [{ role: 'user', content: prompt }],
        stream: true,
        ...options
      },
      {
        responseType: 'stream'
      }
    );

    for await (const chunk of response.data) {
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.substring(6);
          if (data === '[DONE]') return;
          try {
            const json = JSON.parse(data);
            yield json.choices[0].delta.content || '';
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }
  }

  /**
   * Check health of LLM services
   */
  async checkHealth() {
    const health = {
      local: false,
      anthropic: false,
      available: false
    };

    // Check local gateway
    try {
      const response = await axios.get(`${this.gatewayUrl}/health`, {
        timeout: 5000
      });
      health.local = response.data.status === 'healthy';
      health.localBackends = response.data.backends;
    } catch (error) {
      console.warn('Local LLM gateway not available');
    }

    // Check Anthropic
    if (this.anthropicKey) {
      health.anthropic = true;
    }

    health.available = health.local || health.anthropic;
    return health;
  }
}

/**
 * Singleton instance for agents
 */
let sharedClient = null;

function getLLMClient(config) {
  if (!sharedClient) {
    sharedClient = new LLMClient(config);
  }
  return sharedClient;
}

module.exports = {
  LLMClient,
  getLLMClient
};