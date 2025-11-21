# Llama 3.3 Local LLM Service Integration

A comprehensive solution for deploying Llama 3.3 (70B and 8B models) locally via Docker and making it available to all agents in the Agentic SDLC platform.

## 🎯 Overview

This integration provides:
- **Local Llama 3.3 deployment** using Ollama or vLLM
- **Unified LLM Gateway** with OpenAI-compatible API
- **Automatic failover** between local and cloud LLMs
- **Response caching** for improved performance
- **Agent-specific optimizations**
- **Multi-model support** (70B for complex tasks, 8B for speed)

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                     Agents                          │
│  (Scaffold, Validation, Product Owner, Test, etc.)  │
└────────────────────┬────────────────────────────────┘
                     │ HTTP/REST
                     ▼
┌─────────────────────────────────────────────────────┐
│              LLM Gateway (Port 3458)                │
│  - Request routing                                  │
│  - Caching layer                                    │
│  - Load balancing                                   │
│  - Fallback logic                                   │
└────────────┬───────────────┬───────────────────────┘
             │               │
    ┌────────▼─────┐   ┌────▼─────┐   ┌─────────────┐
    │   Ollama     │   │   vLLM   │   │  Anthropic  │
    │  (Primary)   │   │ (Option) │   │  (Fallback) │
    │              │   │          │   │             │
    │ Llama 3.3    │   │ Llama    │   │  Claude     │
    │  - 70B       │   │  3.3     │   │   3.5       │
    │  - 8B        │   │          │   │             │
    └──────────────┘   └──────────┘   └─────────────┘
```

## 🚀 Quick Start

### 1. System Requirements

**For 70B Model:**
- GPU: NVIDIA with 80GB+ VRAM (A100, H100) or
- RAM: 140GB+ for CPU inference (slower)
- Disk: 150GB+ free space

**For 8B Model:**
- GPU: NVIDIA with 16GB+ VRAM (RTX 4080, A4000) or
- RAM: 32GB+ for CPU inference
- Disk: 20GB+ free space

### 2. Deploy with Docker

```bash
# Create network if not exists
docker network create agentic-network

# Deploy Llama 3.3 with Ollama (Recommended)
docker-compose -f docker-compose.llama.yml up -d llama-ollama llm-gateway

# Pull Llama models (one-time setup)
docker exec agentic-sdlc-llama-ollama ollama pull llama3.3:70b-instruct
docker exec agentic-sdlc-llama-ollama ollama pull llama3.3:8b-instruct

# Verify deployment
curl http://localhost:3458/health
```

### 3. Alternative: Deploy with vLLM (Production)

```bash
# For better performance with multiple GPUs
docker-compose -f docker-compose.llama.yml up -d llama-vllm llm-gateway

# vLLM auto-downloads models on first request
```

## 📡 API Endpoints

### LLM Gateway (Port 3458)

#### Health Check
```bash
GET /health
```

#### List Available Models
```bash
GET /models
```

#### OpenAI-Compatible Completion
```bash
POST /v1/chat/completions
{
  "model": "llama3.3:70b-instruct",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant"},
    {"role": "user", "content": "Write a hello world in Python"}
  ],
  "temperature": 0.7,
  "max_tokens": 1000
}
```

#### Agent-Specific Completion
```bash
POST /agent/scaffold/complete
{
  "messages": [{"role": "user", "content": "Generate a REST API"}]
}
```

## 🔧 Agent Integration

### Method 1: Using LLMClient (Recommended)

```javascript
const { getLLMClient } = require('@agentic-sdlc/llm-service');

class MyAgent extends BaseAgent {
  constructor() {
    super();
    this.llm = getLLMClient();
  }

  async processTask(envelope) {
    const result = await this.llm.complete(
      'Process this task: ' + JSON.stringify(envelope.payload),
      {
        system: 'You are an expert software engineer',
        agent: 'my-agent',
        temperature: 0.5,
        format: 'json'
      }
    );

    return result;
  }
}
```

### Method 2: Direct HTTP Calls

```javascript
const axios = require('axios');

async function callLocalLLM(prompt) {
  const response = await axios.post('http://localhost:3458/v1/chat/completions', {
    model: 'llama3.3:70b-instruct',
    messages: [
      { role: 'user', content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 2000
  });

  return response.data.choices[0].message.content;
}
```

### Method 3: Streaming Responses

```javascript
const { LLMClient } = require('@agentic-sdlc/llm-service');
const llm = new LLMClient();

async function* streamResponse(prompt) {
  for await (const chunk of llm.streamComplete(prompt)) {
    yield chunk;
  }
}
```

## ⚙️ Configuration

### Environment Variables

```bash
# LLM Gateway Configuration
LLM_GATEWAY_URL=http://localhost:3458
OLLAMA_URL=http://localhost:11434
VLLM_URL=http://localhost:8000
ANTHROPIC_API_KEY=your-key  # Optional fallback
REDIS_URL=redis://localhost:6379  # For caching

# Model Selection
DEFAULT_MODEL=llama3.3:70b-instruct
DEFAULT_TEMPERATURE=0.7
DEFAULT_MAX_TOKENS=4096

# Performance
ENABLE_CACHING=true
CACHE_TTL=3600
MAX_CONCURRENT_REQUESTS=10
```

### Agent-Specific Optimizations

The gateway automatically optimizes for different agent types:

| Agent Type | Temperature | Max Tokens | Model Preference |
|------------|------------|------------|------------------|
| scaffold | 0.3 | 2000 | 70B for accuracy |
| validation | 0.1 | 1000 | 8B for speed |
| product-owner | 0.7 | 4000 | 70B for creativity |
| test | 0.2 | 2000 | 70B for thoroughness |
| architect | 0.5 | 3000 | 70B for complexity |

## 🎮 Usage Examples

### Generate Code with Scaffold Agent

```javascript
const scaffoldAgent = new LocalLLMScaffoldAgent();

const scaffold = await scaffoldAgent.generateScaffold({
  type: 'microservice',
  language: 'nodejs',
  features: ['REST API', 'Database', 'Auth']
});
```

### Generate Requirements

```javascript
const productOwner = new HybridProductOwnerAgent();

const requirements = await productOwner.generateRequirements({
  application_type: 'e-commerce',
  description: 'Sustainable marketplace',
  industry: 'Retail'
});
```

### Health Monitoring

```javascript
const llm = new LLMClient();
const health = await llm.checkHealth();

console.log('LLM Service Status:', health);
// {
//   local: true,
//   anthropic: true,
//   available: true,
//   localBackends: [...]
// }
```

## 🚄 Performance Optimization

### 1. Model Selection Strategy

- **70B Model**: Use for complex reasoning, code generation, requirements
- **8B Model**: Use for validation, simple queries, quick responses

### 2. Caching

Results are cached based on prompt hash:
- Default TTL: 1 hour
- Max cache size: 1000 entries
- Redis-backed for persistence

### 3. Load Balancing

The gateway automatically balances between:
1. Ollama (primary)
2. vLLM (if available)
3. Anthropic (fallback)

### 4. GPU Optimization

For best performance:
```bash
# Use tensor parallelism with vLLM
TENSOR_PARALLEL_SIZE=2  # For 2 GPUs
GPU_MEMORY_UTILIZATION=0.95
```

## 📊 Monitoring

### Metrics Available

- Request count
- Cache hit/miss ratio
- Average latency
- Error rate
- Model usage distribution

### Prometheus Metrics

```bash
# Enable Prometheus metrics
ENABLE_METRICS=true
METRICS_PORT=9090

# Scrape from Prometheus
curl http://localhost:9090/metrics
```

## 🐛 Troubleshooting

### Issue: Out of Memory

```bash
# Reduce batch size
OLLAMA_NUM_PARALLEL=2

# Use smaller model
DEFAULT_MODEL=llama3.3:8b-instruct

# Enable model offloading
OLLAMA_GPU_LAYERS=40  # Partial GPU offload
```

### Issue: Slow Inference

```bash
# Check GPU usage
nvidia-smi

# Use vLLM for better performance
docker-compose up -d llama-vllm

# Enable response streaming
stream: true
```

### Issue: Connection Refused

```bash
# Check services
docker ps | grep llama
docker logs agentic-sdlc-llama-ollama

# Test Ollama directly
curl http://localhost:11434/api/tags
```

## 🔐 Security Considerations

1. **Network Isolation**: LLM services run in Docker network
2. **No External Access**: Models run fully offline
3. **API Authentication**: Add API keys for production:
   ```javascript
   headers: {
     'X-API-Key': process.env.LLM_API_KEY
   }
   ```
4. **Rate Limiting**: Built-in request queuing

## 🎯 Benefits of Local LLM

1. **Data Privacy**: No data leaves your infrastructure
2. **Cost Savings**: No per-token API costs
3. **Latency**: Lower latency for local requests
4. **Availability**: Works offline
5. **Customization**: Fine-tune models for your domain

## 🔄 Migration Path

### Phase 1: Hybrid Mode (Current)
- Local LLM as primary
- Anthropic as fallback
- Gradual migration

### Phase 2: Local-First
- All agents use local LLM
- External APIs for special cases

### Phase 3: Full Local
- Completely offline operation
- Fine-tuned models
- Custom model deployment

## 📚 Additional Resources

- [Ollama Documentation](https://ollama.ai/docs)
- [vLLM Documentation](https://vllm.ai)
- [Llama 3.3 Model Card](https://ai.meta.com/llama)
- [Agent Creation Guide](../AGENT_CREATION_GUIDE.md)

## 🤝 Contributing

To add support for new models:

1. Update `docker-compose.llama.yml`
2. Add model config to `llm-gateway.js`
3. Test with example agents
4. Update documentation

## 📄 License

Part of the Agentic SDLC platform