# CORE-AGENTS-V1.md - Reusable Core Agent Architecture

**Status:** 📋 Design Phase | **Created:** 2025-11-22 | **Version:** 1.0.0

**Purpose:** Define a catalog of reusable core agents and capabilities that can be composed into multiple products (chatbot, email automation, scheduling, ticketing, etc.)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Principles](#architecture-principles)
3. [Core Agent Catalog](#core-agent-catalog)
4. [Agent Categories](#agent-categories)
5. [Multi-Product Composition](#multi-product-composition)
6. [Implementation Guide](#implementation-guide)
7. [Code Examples](#code-examples)

---

## Executive Summary

### The Vision: Build Once, Compose Many

Your existing Agentic SDLC platform already demonstrates the power of reusable components with:
- ✅ **Base Agent Pattern** - All agents extend `BaseAgent` with message bus integration
- ✅ **Platform-Aware Registry** - Agents can be scoped globally or per-platform
- ✅ **Unbounded Extensibility** - Any custom `agent_type` string is supported
- ✅ **Definition-Driven Workflows** - Workflows are database-defined, not hard-coded

**This document extends that foundation with 40+ reusable agent types** organized into 8 categories that can power dozens of different products.

### Current State vs. Future State

**Current (SDLC-focused):**
```
Platform: Software Development
Agents: scaffold, validation, e2e_test, integration, deployment
Products: 1 (SDLC automation)
```

**Future (Multi-Product Platform):**
```
Platforms: Communication, Email, Scheduling, Support, Marketing, Data, ML, Enterprise
Agents: 40+ reusable types
Products: 10+ (Chatbot, Email, Scheduling, Ticketing, SMS Marketing, Data Pipelines, etc.)
```

### Key Insight: Same Infrastructure, Different Agents

Your platform's **8 core components** are product-agnostic:
1. ✅ Message Bus (Redis Streams)
2. ✅ State Machine (Workflow Engine)
3. ✅ Agent Registry (Platform-scoped)
4. ✅ Knowledge Base (can be added)
5. ✅ Channel Adapters (can be added)
6. ✅ Scheduler (can be added)
7. ✅ Analytics Engine (monitoring exists)
8. ✅ Multi-Tenancy (platform model exists)

**To build new products, you just need to:**
1. Create new `Platform` records (e.g., "communication", "email", "scheduling")
2. Implement new agents for each platform (e.g., `speech-to-text`, `email-parser`, `calendar-checker`)
3. Define workflows that chain those agents together
4. Deploy and profit! 🚀

---

## Architecture Principles

### 1. Agent Design Patterns (Already Established)

All agents in your system follow these patterns from `BaseAgent`:

```typescript
// Your existing BaseAgent pattern (packages/agents/base-agent/src/base-agent.ts)
export abstract class BaseAgent implements AgentLifecycle {
  protected readonly agentId: string;
  protected readonly capabilities: AgentCapabilities;
  protected readonly messageBus: IMessageBus;
  protected readonly platformId?: string; // Platform scoping

  // All agents implement this lifecycle
  async initialize(): Promise<void>
  async receiveTask(message: AgentMessage): Promise<void>
  abstract execute(task: AgentEnvelope): Promise<TaskResult>
  async reportResult(result: TaskResult, workflowStage?: string): Promise<void>
  async cleanup(): Promise<void>
  async healthCheck(): Promise<HealthStatus>
}
```

**Key Features:**
- ✅ **Message Bus Integration** - Subscribe to `agent:tasks:{agent_type}` via Redis Streams
- ✅ **AgentEnvelope v2.0.0 Validation** - All tasks validated against canonical schema
- ✅ **Distributed Tracing** - Trace context propagation via `trace_id`, `span_id`, `parent_span_id`
- ✅ **Platform Scoping** - Agents can be global or platform-specific
- ✅ **Circuit Breaker** - Built-in resilience for external API calls
- ✅ **Structured Logging** - Pino logger with trace correlation

### 2. Agent Capabilities Schema

Each agent declares its capabilities (from your existing pattern):

```typescript
interface AgentCapabilities {
  type: string;              // Agent type (kebab-case: "speech-to-text")
  version: string;           // Semantic version (e.g., "1.0.0")
  capabilities: string[];    // What it can do (e.g., ["transcription", "voice_recognition"])
  timeout_ms?: number;       // Execution timeout (default: 300000)
  max_retries?: number;      // Retry attempts (default: 3)
  priority?: Priority;       // Task priority (low/medium/high/critical)
}
```

### 3. Agent Categories (New)

We organize the 40+ agent types into 8 categories:

| Category | Purpose | Example Agents | Products Using |
|----------|---------|----------------|----------------|
| **Communication** | Voice, SMS, messaging | `speech-to-text`, `text-to-speech`, `sms-sender` | Chatbot, Call Center |
| **Content Processing** | Text, images, documents | `email-parser`, `pdf-extractor`, `image-analyzer` | Email, Document Management |
| **Knowledge & Search** | RAG, indexing, search | `website-crawler`, `vector-indexer`, `semantic-search` | Chatbot, Support, Documentation |
| **Integration** | External APIs, webhooks | `calendar-connector`, `crm-sync`, `payment-processor` | Scheduling, CRM, E-commerce |
| **Decision & Routing** | Classification, routing | `intent-classifier`, `priority-scorer`, `load-balancer` | Support, Email, Chatbot |
| **Generation** | AI content creation | `llm-generator`, `template-renderer`, `summary-generator` | Email, Chatbot, Marketing |
| **Validation & Analysis** | Data validation, sentiment | `schema-validator`, `sentiment-analyzer`, `spam-detector` | Email, Support, Data Quality |
| **Orchestration** | Workflow control | `workflow-coordinator`, `error-handler`, `escalator` | All Products |

---

## Core Agent Catalog

### Category 1: Communication Agents

These agents handle voice, messaging, and real-time communication channels.

#### 1.1 Speech-to-Text Agent (`speech-to-text`)

**Purpose:** Transcribe audio to text for call processing

**Capabilities:**
```typescript
{
  type: "speech-to-text",
  version: "1.0.0",
  capabilities: ["transcription", "voice_recognition", "language_detection"],
  timeout_ms: 5000,
  max_retries: 2
}
```

**Input Schema:**
```typescript
{
  audio_url: string;          // URL to audio file (MP3, WAV, etc.)
  language?: string;          // ISO 639-1 code (default: "en-US")
  speaker_count?: number;     // For diarization
  vocabulary?: string[];      // Custom vocabulary hints
}
```

**Output Schema:**
```typescript
{
  transcript: string;         // Full transcription
  confidence: number;         // 0-1 confidence score
  language_detected: string;  // Detected language
  duration_ms: number;        // Audio duration
  speakers?: Array<{          // Speaker diarization
    speaker_id: string;
    segments: Array<{
      start_ms: number;
      end_ms: number;
      text: string;
    }>;
  }>;
  words?: Array<{             // Word-level timestamps
    word: string;
    start_ms: number;
    end_ms: number;
    confidence: number;
  }>;
}
```

**Implementation Notes:**
- Use Deepgram API or OpenAI Whisper
- Store audio files in S3/CloudStorage temporarily
- Support streaming transcription for long calls
- Handle multiple languages and accents

**Metrics to Track:**
- `speech_to_text.duration_ms` - Processing time
- `speech_to_text.confidence` - Average confidence
- `speech_to_text.errors` - Transcription failures
- `speech_to_text.language_detected` - Language distribution

---

#### 1.2 Text-to-Speech Agent (`text-to-speech`)

**Purpose:** Convert text responses to audio for voice replies

**Capabilities:**
```typescript
{
  type: "text-to-speech",
  version: "1.0.0",
  capabilities: ["synthesis", "voice_cloning", "emotion"],
  timeout_ms: 3000,
  max_retries: 2
}
```

**Input Schema:**
```typescript
{
  text: string;               // Text to synthesize
  voice_id?: string;          // Voice identifier
  language?: string;          // ISO 639-1 code
  speed?: number;             // 0.5-2.0 playback speed
  pitch?: number;             // -10 to +10 pitch adjustment
  emotion?: "neutral" | "happy" | "sad" | "urgent";
  output_format?: "mp3" | "wav" | "ogg";
}
```

**Output Schema:**
```typescript
{
  audio_url: string;          // URL to generated audio
  duration_ms: number;        // Audio duration
  format: string;             // Audio format
  voice_used: string;         // Voice ID used
  byte_size: number;          // File size in bytes
}
```

**Implementation Notes:**
- Use ElevenLabs API or Google TTS
- Cache generated audio for repeated phrases
- Support SSML for prosody control
- Store audio in CDN for fast playback

---

#### 1.3 SMS Sender Agent (`sms-sender`)

**Purpose:** Send SMS messages via Twilio/carrier APIs

**Capabilities:**
```typescript
{
  type: "sms-sender",
  version: "1.0.0",
  capabilities: ["send_sms", "mms", "link_shortening"],
  timeout_ms: 10000,
  max_retries: 3
}
```

**Input Schema:**
```typescript
{
  to: string;                 // E.164 phone number (+15551234567)
  from: string;               // Sender phone number
  message: string;            // Message body (max 1600 chars)
  media_urls?: string[];      // MMS images/videos
  shorten_links?: boolean;    // Auto-shorten URLs
  schedule_at?: string;       // ISO 8601 timestamp for delayed send
}
```

**Output Schema:**
```typescript
{
  message_id: string;         // Carrier message ID
  status: "sent" | "queued" | "failed";
  to: string;
  segments: number;           // Number of SMS segments
  cost: number;               // Cost in USD
  delivered_at?: string;      // Delivery timestamp
  error?: {
    code: string;
    message: string;
  };
}
```

**Implementation Notes:**
- Use Twilio SMS API
- Handle rate limiting (100 SMS/sec)
- Track delivery status via webhooks
- Support international numbers
- Auto-segment long messages

**Metrics to Track:**
- `sms_sender.sent` - Messages sent
- `sms_sender.delivered` - Delivery rate
- `sms_sender.cost` - Total cost
- `sms_sender.segments` - Average segments per message

---

#### 1.4 WhatsApp Message Agent (`whatsapp-sender`)

**Purpose:** Send WhatsApp messages via Business API

**Capabilities:**
```typescript
{
  type: "whatsapp-sender",
  version: "1.0.0",
  capabilities: ["send_message", "send_template", "send_media"],
  timeout_ms: 10000
}
```

**Input Schema:**
```typescript
{
  to: string;                 // WhatsApp phone number
  type: "text" | "template" | "media";
  content: {
    text?: string;
    template_name?: string;
    template_params?: string[];
    media_url?: string;
    media_type?: "image" | "video" | "document";
  };
}
```

**Output Schema:**
```typescript
{
  message_id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
}
```

---

### Category 2: Content Processing Agents

These agents extract, parse, and transform content from various sources.

#### 2.1 Email Parser Agent (`email-parser`)

**Purpose:** Parse and extract structured data from emails

**Capabilities:**
```typescript
{
  type: "email-parser",
  version: "1.0.0",
  capabilities: ["parse_email", "extract_attachments", "detect_replies"],
  timeout_ms: 5000
}
```

**Input Schema:**
```typescript
{
  raw_email: string;          // RFC 822 email format
  include_attachments?: boolean;
  extract_signatures?: boolean;
}
```

**Output Schema:**
```typescript
{
  from: {
    email: string;
    name?: string;
  };
  to: Array<{ email: string; name?: string; }>;
  cc?: Array<{ email: string; name?: string; }>;
  subject: string;
  body_text: string;          // Plain text body
  body_html?: string;         // HTML body
  headers: Record<string, string>;
  attachments: Array<{
    filename: string;
    content_type: string;
    size_bytes: number;
    url: string;              // S3/storage URL
  }>;
  thread_id?: string;         // Email thread identifier
  in_reply_to?: string;       // Message-ID of parent
  is_reply: boolean;
  signature?: string;         // Extracted signature
  received_at: string;        // ISO 8601 timestamp
}
```

**Implementation Notes:**
- Use `mailparser` npm library
- Extract plain text from HTML
- Detect and remove email signatures
- Handle multipart MIME messages
- Store attachments in S3
- Detect email threads via References header

**Metrics to Track:**
- `email_parser.parse_time_ms` - Parsing duration
- `email_parser.attachment_count` - Attachments per email
- `email_parser.is_reply_rate` - Percentage of replies

---

#### 2.2 PDF Extractor Agent (`pdf-extractor`)

**Purpose:** Extract text and metadata from PDF documents

**Capabilities:**
```typescript
{
  type: "pdf-extractor",
  version: "1.0.0",
  capabilities: ["extract_text", "extract_metadata", "ocr"],
  timeout_ms: 30000
}
```

**Input Schema:**
```typescript
{
  pdf_url: string;            // URL to PDF file
  ocr_enabled?: boolean;      // Use OCR for scanned PDFs
  extract_images?: boolean;   // Extract embedded images
  page_range?: {
    start: number;
    end: number;
  };
}
```

**Output Schema:**
```typescript
{
  text: string;               // Extracted text
  page_count: number;
  metadata: {
    title?: string;
    author?: string;
    created_at?: string;
    modified_at?: string;
  };
  pages: Array<{
    page_number: number;
    text: string;
    images?: Array<{
      url: string;
      width: number;
      height: number;
    }>;
  }>;
  word_count: number;
  language?: string;
}
```

**Implementation Notes:**
- Use `pdf-parse` or `pdfjs-dist`
- Use Tesseract OCR for scanned PDFs
- Handle password-protected PDFs
- Extract tables and forms

---

#### 2.3 Web Scraper Agent (`web-scraper`)

**Purpose:** Extract content from web pages

**Capabilities:**
```typescript
{
  type: "web-scraper",
  version: "1.0.0",
  capabilities: ["scrape_html", "extract_metadata", "follow_links"],
  timeout_ms: 15000
}
```

**Input Schema:**
```typescript
{
  url: string;
  selectors?: {               // CSS selectors for specific content
    title?: string;
    content?: string;
    author?: string;
  };
  follow_links?: boolean;
  max_depth?: number;
  user_agent?: string;
  cookies?: Record<string, string>;
}
```

**Output Schema:**
```typescript
{
  url: string;
  title: string;
  content: string;            // Main content (cleaned HTML → text)
  html: string;               // Raw HTML
  metadata: {
    description?: string;
    author?: string;
    published_at?: string;
    og_image?: string;
  };
  links: Array<{
    url: string;
    text: string;
    type: "internal" | "external";
  }>;
  images: Array<{
    url: string;
    alt?: string;
  }>;
  scraped_at: string;
}
```

**Implementation Notes:**
- Use Puppeteer for dynamic content
- Use Cheerio for static HTML
- Respect robots.txt
- Handle JavaScript-heavy sites
- Clean HTML → readable text

---

### Category 3: Knowledge & Search Agents

These agents build and query knowledge bases for RAG (Retrieval-Augmented Generation).

#### 3.1 Website Crawler Agent (`website-crawler`)

**Purpose:** Crawl and index entire websites for knowledge base

**Capabilities:**
```typescript
{
  type: "website-crawler",
  version: "1.0.0",
  capabilities: ["crawl_website", "sitemap_parsing", "incremental_updates"],
  timeout_ms: 300000  // 5 minutes for full crawl
}
```

**Input Schema:**
```typescript
{
  base_url: string;           // Starting URL
  max_pages?: number;         // Max pages to crawl (default: 1000)
  max_depth?: number;         // Max link depth (default: 5)
  include_patterns?: string[]; // URL patterns to include
  exclude_patterns?: string[]; // URL patterns to exclude
  respect_robots_txt?: boolean;
  rate_limit_ms?: number;     // Delay between requests
  collection_id: string;      // Target knowledge base collection
}
```

**Output Schema:**
```typescript
{
  pages_crawled: number;
  pages_indexed: number;
  pages_failed: number;
  duration_ms: number;
  sitemap: Array<{
    url: string;
    title: string;
    last_modified?: string;
    status: "indexed" | "skipped" | "failed";
  }>;
  errors: Array<{
    url: string;
    error: string;
  }>;
}
```

**Implementation Notes:**
- Use Puppeteer for crawling
- Parse sitemap.xml if available
- Detect duplicate pages via content hash
- Store page content in PostgreSQL + vector DB
- Support incremental updates (re-crawl changed pages)

**Workflow Example:**
```typescript
// 1. Crawl website
// 2. For each page → Extract content (web-scraper)
// 3. For each page → Chunk content (text-chunker)
// 4. For each chunk → Generate embedding (embedder)
// 5. Store chunks + embeddings in vector DB (vector-indexer)
```

---

#### 3.2 Vector Indexer Agent (`vector-indexer`)

**Purpose:** Store document chunks with embeddings in vector database

**Capabilities:**
```typescript
{
  type: "vector-indexer",
  version: "1.0.0",
  capabilities: ["index_vectors", "update_vectors", "delete_vectors"],
  timeout_ms: 10000
}
```

**Input Schema:**
```typescript
{
  collection_id: string;      // Vector collection name
  documents: Array<{
    id: string;               // Document ID
    content: string;          // Text content
    embedding: number[];      // Vector embedding (1536 dimensions)
    metadata: {
      source_url?: string;
      chunk_index?: number;
      document_title?: string;
      [key: string]: any;
    };
  }>;
  operation: "upsert" | "delete";
}
```

**Output Schema:**
```typescript
{
  indexed_count: number;
  failed_count: number;
  collection_id: string;
  collection_size: number;    // Total vectors in collection
}
```

**Implementation Notes:**
- Use Qdrant or Pinecone vector DB
- Support batch upserts (100-1000 vectors at once)
- Handle collection creation automatically
- Support metadata filtering

---

#### 3.3 Semantic Search Agent (`semantic-search`)

**Purpose:** Query vector database for relevant content

**Capabilities:**
```typescript
{
  type: "semantic-search",
  version: "1.0.0",
  capabilities: ["vector_search", "hybrid_search", "reranking"],
  timeout_ms: 3000
}
```

**Input Schema:**
```typescript
{
  collection_id: string;      // Vector collection to search
  query: string;              // Search query
  query_embedding: number[];  // Pre-computed query embedding
  limit?: number;             // Max results (default: 5)
  min_score?: number;         // Min similarity score (default: 0.7)
  filters?: Record<string, any>; // Metadata filters
  rerank?: boolean;           // Use reranking model
}
```

**Output Schema:**
```typescript
{
  results: Array<{
    id: string;
    content: string;
    score: number;            // Similarity score (0-1)
    metadata: Record<string, any>;
  }>;
  query: string;
  total_results: number;
  search_time_ms: number;
}
```

**Implementation Notes:**
- Use cosine similarity for vector search
- Support hybrid search (vector + keyword)
- Use Cohere Rerank API for reranking top results
- Cache frequent queries

---

#### 3.4 Embedder Agent (`embedder`)

**Purpose:** Generate vector embeddings for text

**Capabilities:**
```typescript
{
  type: "embedder",
  version: "1.0.0",
  capabilities: ["generate_embeddings", "batch_embedding"],
  timeout_ms: 5000
}
```

**Input Schema:**
```typescript
{
  texts: string[];            // Array of texts to embed
  model?: "text-embedding-3-small" | "text-embedding-3-large";
  dimensions?: number;        // Embedding dimensions (default: 1536)
}
```

**Output Schema:**
```typescript
{
  embeddings: number[][];     // Array of embeddings
  model: string;
  dimensions: number;
  token_count: number;        // Total tokens processed
}
```

**Implementation Notes:**
- Use OpenAI Embeddings API
- Support batch embedding (up to 2048 texts)
- Cache embeddings for repeated texts
- Handle rate limiting

---

### Category 4: Integration Agents

These agents connect to external services and APIs.

#### 4.1 Calendar Connector Agent (`calendar-connector`)

**Purpose:** Read/write to Google Calendar, Outlook, iCal

**Capabilities:**
```typescript
{
  type: "calendar-connector",
  version: "1.0.0",
  capabilities: ["read_events", "create_events", "check_availability"],
  timeout_ms: 10000
}
```

**Input Schema:**
```typescript
{
  action: "list_events" | "create_event" | "check_availability";
  calendar_id: string;        // Google Calendar ID or Outlook calendar
  params: {
    // For list_events
    start_date?: string;      // ISO 8601
    end_date?: string;        // ISO 8601

    // For create_event
    title?: string;
    description?: string;
    start_time?: string;      // ISO 8601
    end_time?: string;        // ISO 8601
    attendees?: string[];     // Email addresses
    location?: string;
    video_conference?: boolean;

    // For check_availability
    duration_minutes?: number;
    preferred_times?: Array<{
      start: string;
      end: string;
    }>;
  };
}
```

**Output Schema:**
```typescript
{
  action: string;

  // For list_events
  events?: Array<{
    id: string;
    title: string;
    start: string;
    end: string;
    attendees: string[];
    status: "confirmed" | "tentative" | "cancelled";
  }>;

  // For create_event
  event_id?: string;
  event_url?: string;
  video_link?: string;        // Zoom/Meet link

  // For check_availability
  available_slots?: Array<{
    start: string;
    end: string;
    duration_minutes: number;
  }>;
}
```

**Implementation Notes:**
- Use Google Calendar API
- Use Microsoft Graph API for Outlook
- Handle OAuth2 authentication
- Support recurring events
- Detect timezone conflicts

---

#### 4.2 CRM Sync Agent (`crm-sync`)

**Purpose:** Sync contacts and activities to Salesforce, HubSpot, etc.

**Capabilities:**
```typescript
{
  type: "crm-sync",
  version: "1.0.0",
  capabilities: ["sync_contacts", "sync_activities", "query_crm"],
  timeout_ms: 15000
}
```

**Input Schema:**
```typescript
{
  crm_provider: "salesforce" | "hubspot" | "pipedrive";
  action: "create_contact" | "update_contact" | "create_activity";
  data: {
    // For contacts
    email?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    company?: string;

    // For activities
    contact_id?: string;
    activity_type?: "call" | "email" | "meeting";
    subject?: string;
    notes?: string;
    timestamp?: string;
  };
}
```

**Output Schema:**
```typescript
{
  crm_provider: string;
  action: string;
  record_id: string;          // CRM record ID
  record_url: string;         // Link to CRM record
  status: "success" | "partial" | "failed";
  warnings?: string[];
}
```

**Implementation Notes:**
- Use Salesforce REST API
- Use HubSpot API
- Handle rate limiting
- Support custom fields
- Deduplicate contacts

---

#### 4.3 Payment Processor Agent (`payment-processor`)

**Purpose:** Process payments via Stripe, PayPal, etc.

**Capabilities:**
```typescript
{
  type: "payment-processor",
  version: "1.0.0",
  capabilities: ["create_charge", "create_subscription", "refund"],
  timeout_ms: 15000
}
```

**Input Schema:**
```typescript
{
  provider: "stripe" | "paypal" | "square";
  action: "charge" | "subscribe" | "refund";
  params: {
    amount_cents?: number;
    currency?: string;
    customer_id?: string;
    payment_method_id?: string;
    description?: string;

    // For subscriptions
    plan_id?: string;

    // For refunds
    charge_id?: string;
    refund_amount_cents?: number;
  };
}
```

**Output Schema:**
```typescript
{
  transaction_id: string;
  status: "succeeded" | "pending" | "failed";
  amount_cents: number;
  currency: string;
  receipt_url?: string;
  error?: {
    code: string;
    message: string;
  };
}
```

---

### Category 5: Decision & Routing Agents

These agents classify, score, and route tasks to appropriate handlers.

#### 5.1 Intent Classifier Agent (`intent-classifier`)

**Purpose:** Classify user intent from text input

**Capabilities:**
```typescript
{
  type: "intent-classifier",
  version: "1.0.0",
  capabilities: ["classify_intent", "extract_entities"],
  timeout_ms: 3000
}
```

**Input Schema:**
```typescript
{
  text: string;               // User message
  context?: {                 // Conversation context
    previous_intent?: string;
    user_id?: string;
  };
  intent_candidates?: string[]; // Possible intents to consider
}
```

**Output Schema:**
```typescript
{
  intent: string;             // Classified intent (e.g., "book_meeting")
  confidence: number;         // 0-1 confidence score
  alternative_intents: Array<{
    intent: string;
    confidence: number;
  }>;
  entities: Array<{           // Extracted entities
    type: string;             // "date", "time", "person", etc.
    value: string;
    confidence: number;
  }>;
}
```

**Implementation Notes:**
- Use OpenAI GPT-4 for zero-shot classification
- Train custom model for high-volume use cases
- Support multi-intent detection
- Extract entities (dates, times, names, etc.)

**Example Use Cases:**
- Chatbot: Route to FAQ vs. human handoff
- Email: Route to sales vs. support vs. billing
- Support: Classify as bug vs. feature request

---

#### 5.2 Priority Scorer Agent (`priority-scorer`)

**Purpose:** Score and prioritize tasks, tickets, or emails

**Capabilities:**
```typescript
{
  type: "priority-scorer",
  version: "1.0.0",
  capabilities: ["score_priority", "detect_urgency"],
  timeout_ms: 2000
}
```

**Input Schema:**
```typescript
{
  item_type: "ticket" | "email" | "task";
  content: string;            // Item description
  metadata: {
    sender?: string;
    created_at?: string;
    customer_tier?: "free" | "paid" | "enterprise";
    sla_hours?: number;
  };
}
```

**Output Schema:**
```typescript
{
  priority: "low" | "medium" | "high" | "critical";
  urgency_score: number;      // 0-100
  factors: Array<{            // Why this priority?
    factor: string;           // "contains_angry_language"
    weight: number;
    description: string;
  }>;
  recommended_sla_hours: number;
}
```

**Implementation Notes:**
- Use sentiment analysis for urgency
- Detect keywords (e.g., "urgent", "ASAP", "broken")
- Consider customer tier and SLA
- Use LLM for nuanced scoring

---

#### 5.3 Load Balancer Agent (`load-balancer`)

**Purpose:** Distribute tasks across available agents or teams

**Capabilities:**
```typescript
{
  type: "load-balancer",
  version: "1.0.0",
  capabilities: ["route_task", "health_check", "failover"],
  timeout_ms: 1000
}
```

**Input Schema:**
```typescript
{
  task_type: string;
  routing_strategy: "round_robin" | "least_busy" | "skill_based";
  agents: Array<{
    agent_id: string;
    current_load: number;
    max_capacity: number;
    skills?: string[];
  }>;
}
```

**Output Schema:**
```typescript
{
  assigned_agent_id: string;
  routing_strategy: string;
  agent_load: number;         // Current load after assignment
  estimated_wait_time_ms: number;
}
```

**Implementation Notes:**
- Track agent availability in Redis
- Use consistent hashing for sticky routing
- Support failover to backup agents
- Monitor agent health

---

### Category 6: Generation Agents

These agents create content using LLMs and templates.

#### 6.1 LLM Generator Agent (`llm-generator`)

**Purpose:** Generate text responses using Claude or GPT

**Capabilities:**
```typescript
{
  type: "llm-generator",
  version: "1.0.0",
  capabilities: ["generate_text", "summarize", "translate"],
  timeout_ms: 30000
}
```

**Input Schema:**
```typescript
{
  prompt: string;
  system_prompt?: string;
  model?: "claude-haiku-4-5" | "claude-sonnet-4-5" | "gpt-4o";
  max_tokens?: number;
  temperature?: number;
  context?: {                 // RAG context
    documents: Array<{
      content: string;
      source: string;
    }>;
  };
  output_format?: "text" | "json" | "markdown";
}
```

**Output Schema:**
```typescript
{
  generated_text: string;
  model_used: string;
  token_count: {
    input: number;
    output: number;
    total: number;
  };
  finish_reason: "stop" | "length" | "content_filter";
  cost_usd: number;
}
```

**Implementation Notes:**
- Use circuit breaker for API calls (already in BaseAgent)
- Support streaming responses for long outputs
- Cache responses for repeated prompts
- Handle rate limiting and retries

**Example Use Cases:**
- Chatbot: Generate conversational response
- Email: Draft reply to customer inquiry
- Support: Generate troubleshooting steps

---

#### 6.2 Template Renderer Agent (`template-renderer`)

**Purpose:** Render email/message templates with dynamic data

**Capabilities:**
```typescript
{
  type: "template-renderer",
  version: "1.0.0",
  capabilities: ["render_template", "personalize"],
  timeout_ms: 2000
}
```

**Input Schema:**
```typescript
{
  template_id: string;        // Template identifier
  template_source?: string;   // Handlebars/Liquid template
  variables: Record<string, any>; // Template variables
  output_format: "html" | "text" | "markdown";
}
```

**Output Schema:**
```typescript
{
  rendered: string;           // Rendered output
  format: string;
  variables_used: string[];   // Which variables were interpolated
}
```

**Implementation Notes:**
- Use Handlebars.js or Liquid templating
- Support conditionals and loops
- Validate required variables
- Sanitize HTML output

**Example Templates:**
```handlebars
<!-- Email confirmation template -->
<h1>Hi {{first_name}},</h1>
<p>Your order #{{order_id}} has been confirmed!</p>
{{#if shipping_address}}
  <p>Shipping to: {{shipping_address.street}}, {{shipping_address.city}}</p>
{{/if}}
<p>Estimated delivery: {{delivery_date}}</p>
```

---

#### 6.3 Summary Generator Agent (`summary-generator`)

**Purpose:** Generate summaries of long documents or conversations

**Capabilities:**
```typescript
{
  type: "summary-generator",
  version: "1.0.0",
  capabilities: ["summarize_text", "extract_key_points"],
  timeout_ms: 15000
}
```

**Input Schema:**
```typescript
{
  text: string;               // Text to summarize
  max_length?: number;        // Max summary length (words)
  style?: "bullet_points" | "paragraph" | "executive";
  focus?: string[];           // Topics to emphasize
}
```

**Output Schema:**
```typescript
{
  summary: string;
  key_points: string[];       // Bullet point extraction
  original_length: number;    // Words in original
  summary_length: number;     // Words in summary
  compression_ratio: number;  // Original / summary
}
```

**Implementation Notes:**
- Use Claude for long-context summarization
- Support extractive and abstractive summarization
- Preserve important details (dates, names, numbers)

**Example Use Cases:**
- Email: Summarize long email threads
- Support: Summarize customer conversation history
- Call Center: Summarize call transcripts

---

### Category 7: Validation & Analysis Agents

These agents validate data, detect spam, analyze sentiment, etc.

#### 7.1 Schema Validator Agent (`schema-validator`)

**Purpose:** Validate data against JSON schemas

**Capabilities:**
```typescript
{
  type: "schema-validator",
  version: "1.0.0",
  capabilities: ["validate_json", "validate_csv", "validate_api_response"],
  timeout_ms: 2000
}
```

**Input Schema:**
```typescript
{
  data: any;                  // Data to validate
  schema: JSONSchema;         // JSON Schema definition
  strict?: boolean;           // Fail on extra properties
}
```

**Output Schema:**
```typescript
{
  valid: boolean;
  errors: Array<{
    path: string;             // JSONPath to error
    message: string;
    expected: string;
    received: string;
  }>;
  warnings: Array<{
    path: string;
    message: string;
  }>;
}
```

**Implementation Notes:**
- Use AJV library for JSON Schema validation
- Support JSON Schema draft-07
- Provide helpful error messages
- Suggest fixes for common errors

---

#### 7.2 Sentiment Analyzer Agent (`sentiment-analyzer`)

**Purpose:** Analyze sentiment and emotion in text

**Capabilities:**
```typescript
{
  type: "sentiment-analyzer",
  version: "1.0.0",
  capabilities: ["analyze_sentiment", "detect_emotion", "detect_toxicity"],
  timeout_ms: 3000
}
```

**Input Schema:**
```typescript
{
  text: string;               // Text to analyze
  language?: string;          // ISO 639-1 code
  detect_emotions?: boolean;  // Detect specific emotions
}
```

**Output Schema:**
```typescript
{
  sentiment: "positive" | "negative" | "neutral";
  sentiment_score: number;    // -1 to +1
  confidence: number;         // 0-1
  emotions?: {                // If detect_emotions=true
    joy: number;              // 0-1
    anger: number;
    sadness: number;
    fear: number;
    surprise: number;
  };
  toxicity_score?: number;    // 0-1 (0=safe, 1=toxic)
}
```

**Implementation Notes:**
- Use Hugging Face Sentiment Analysis
- Use OpenAI Moderation API for toxicity
- Support multiple languages
- Cache results for repeated texts

**Example Use Cases:**
- Email: Detect angry customers → escalate
- Support: Prioritize frustrated users
- Chatbot: Adjust tone based on user sentiment

---

#### 7.3 Spam Detector Agent (`spam-detector`)

**Purpose:** Detect spam in emails, messages, or content

**Capabilities:**
```typescript
{
  type: "spam-detector",
  version: "1.0.0",
  capabilities: ["detect_spam", "detect_phishing"],
  timeout_ms: 2000
}
```

**Input Schema:**
```typescript
{
  content: string;            // Message content
  sender?: string;            // Sender email/phone
  headers?: Record<string, string>; // Email headers
}
```

**Output Schema:**
```typescript
{
  is_spam: boolean;
  confidence: number;         // 0-1
  spam_score: number;         // 0-100
  reasons: string[];          // Why classified as spam
  is_phishing: boolean;
}
```

**Implementation Notes:**
- Use SpamAssassin or ML model
- Check sender reputation
- Detect phishing patterns
- Support custom blocklists

---

### Category 8: Orchestration Agents

These agents manage workflow execution and error handling.

#### 8.1 Workflow Coordinator Agent (`workflow-coordinator`)

**Purpose:** Coordinate multi-step workflows

**Capabilities:**
```typescript
{
  type: "workflow-coordinator",
  version: "1.0.0",
  capabilities: ["route_stage", "aggregate_results", "parallel_execution"],
  timeout_ms: 5000
}
```

**Input Schema:**
```typescript
{
  workflow_id: string;
  action: "next_stage" | "aggregate" | "fork";
  current_stage: string;
  stage_results: Record<string, any>;
}
```

**Output Schema:**
```typescript
{
  next_stage?: string;
  parallel_stages?: string[];
  aggregated_result?: any;
  workflow_complete: boolean;
}
```

**Implementation Notes:**
- Read workflow definitions from database
- Support parallel stage execution
- Aggregate results from multiple stages
- Handle stage failures with fallback logic

---

#### 8.2 Error Handler Agent (`error-handler`)

**Purpose:** Handle and recover from workflow errors

**Capabilities:**
```typescript
{
  type: "error-handler",
  version: "1.0.0",
  capabilities: ["retry_strategy", "fallback_execution", "error_notification"],
  timeout_ms: 3000
}
```

**Input Schema:**
```typescript
{
  workflow_id: string;
  failed_stage: string;
  error: {
    code: string;
    message: string;
    recoverable: boolean;
  };
  retry_count: number;
}
```

**Output Schema:**
```typescript
{
  action: "retry" | "fallback" | "fail";
  retry_delay_ms?: number;
  fallback_stage?: string;
  notification_sent: boolean;
}
```

**Implementation Notes:**
- Implement exponential backoff for retries
- Define fallback stages per workflow
- Send notifications for critical failures
- Track error patterns for debugging

---

#### 8.3 Escalator Agent (`escalator`)

**Purpose:** Escalate tasks when SLA or conditions are breached

**Capabilities:**
```typescript
{
  type: "escalator",
  version: "1.0.0",
  capabilities: ["check_sla", "escalate_task", "notify_stakeholders"],
  timeout_ms: 3000
}
```

**Input Schema:**
```typescript
{
  task_id: string;
  task_type: "ticket" | "email" | "issue";
  created_at: string;         // ISO 8601
  sla_hours: number;
  current_assignee?: string;
  escalation_path: string[];  // ["team_lead", "manager", "vp"]
}
```

**Output Schema:**
```typescript
{
  escalated: boolean;
  escalated_to?: string;
  escalation_reason: string;
  notifications_sent: Array<{
    recipient: string;
    channel: "email" | "slack" | "sms";
    sent_at: string;
  }>;
}
```

**Implementation Notes:**
- Check elapsed time vs. SLA
- Support multi-tier escalation
- Send notifications via multiple channels
- Track escalation history

---

## Multi-Product Composition

### How to Build Products from Core Agents

Your platform's **workflow definition system** allows you to compose agents into products without changing code.

#### Example 1: Chatbot Product

**Platform:** `communication`

**Workflow Definition:**
```yaml
name: inbound-call
version: 1.0.0
platform_id: communication
stages:
  - name: receive-call
    agent_type: twilio-receiver
    transitions:
      - event: call_answered
        target: transcribe-audio

  - name: transcribe-audio
    agent_type: speech-to-text
    timeout_ms: 5000
    transitions:
      - event: success
        target: classify-intent

  - name: classify-intent
    agent_type: intent-classifier
    transitions:
      - event: faq_question
        target: search-knowledge
        condition: "intent === 'faq'"
      - event: complex_query
        target: generate-response
        condition: "confidence < 0.7"
      - event: transfer_request
        target: human-handoff
        condition: "intent === 'speak_to_human'"

  - name: search-knowledge
    agent_type: semantic-search
    transitions:
      - event: success
        target: generate-response

  - name: generate-response
    agent_type: llm-generator
    transitions:
      - event: success
        target: speak-response

  - name: speak-response
    agent_type: text-to-speech
    transitions:
      - event: success
        target: end

  - name: human-handoff
    agent_type: load-balancer
    transitions:
      - event: success
        target: end

  - name: end
    agent_type: workflow-coordinator
```

**Agents Used:**
1. `twilio-receiver` - Receive inbound call
2. `speech-to-text` - Transcribe caller's question
3. `intent-classifier` - Understand what they want
4. `semantic-search` - Find relevant knowledge
5. `llm-generator` - Generate natural response
6. `text-to-speech` - Speak response to caller
7. `load-balancer` - Route to human agent if needed

**Total Agents:** 7 agents → Complete chatbot product

---

#### Example 2: Email Automation Product

**Platform:** `email`

**Workflow Definition:**
```yaml
name: inbound-email
version: 1.0.0
platform_id: email
stages:
  - name: receive-email
    agent_type: email-receiver
    transitions:
      - event: email_received
        target: parse-email

  - name: parse-email
    agent_type: email-parser
    transitions:
      - event: success
        target: check-spam

  - name: check-spam
    agent_type: spam-detector
    transitions:
      - event: is_spam
        target: archive-spam
      - event: not_spam
        target: classify-intent

  - name: classify-intent
    agent_type: intent-classifier
    transitions:
      - event: support_request
        target: search-solutions
      - event: sales_inquiry
        target: route-to-sales
      - event: billing_question
        target: route-to-billing

  - name: search-solutions
    agent_type: semantic-search
    transitions:
      - event: solution_found
        target: generate-reply
        condition: "score > 0.8"
      - event: no_solution
        target: create-ticket

  - name: generate-reply
    agent_type: llm-generator
    transitions:
      - event: success
        target: send-reply

  - name: send-reply
    agent_type: email-sender
    transitions:
      - event: success
        target: end

  - name: create-ticket
    agent_type: ticket-creator
    transitions:
      - event: success
        target: notify-team
```

**Agents Used:**
1. `email-receiver` - Poll inbox via Gmail API
2. `email-parser` - Extract sender, subject, body
3. `spam-detector` - Filter spam
4. `intent-classifier` - Route to support/sales/billing
5. `semantic-search` - Find relevant solutions
6. `llm-generator` - Draft personalized reply
7. `email-sender` - Send reply via SMTP
8. `ticket-creator` - Create ticket if needed

**Total Agents:** 8 agents → Complete email automation product

---

#### Example 3: AI Scheduling Assistant

**Platform:** `scheduling`

**Workflow Definition:**
```yaml
name: booking-request
version: 1.0.0
platform_id: scheduling
stages:
  - name: receive-request
    agent_type: request-parser
    transitions:
      - event: parsed
        target: extract-preferences

  - name: extract-preferences
    agent_type: intent-classifier
    transitions:
      - event: success
        target: check-calendar

  - name: check-calendar
    agent_type: calendar-connector
    transitions:
      - event: success
        target: find-slots

  - name: find-slots
    agent_type: availability-finder
    transitions:
      - event: slots_found
        target: propose-times
      - event: no_slots
        target: suggest-alternatives

  - name: propose-times
    agent_type: template-renderer
    transitions:
      - event: success
        target: send-proposal

  - name: send-proposal
    agent_type: email-sender
    transitions:
      - event: success
        target: wait-for-confirmation

  - name: wait-for-confirmation
    agent_type: workflow-coordinator
    transitions:
      - event: confirmed
        target: book-meeting

  - name: book-meeting
    agent_type: calendar-connector
    transitions:
      - event: success
        target: send-confirmation

  - name: send-confirmation
    agent_type: email-sender
    transitions:
      - event: success
        target: schedule-reminders

  - name: schedule-reminders
    agent_type: reminder-scheduler
    transitions:
      - event: success
        target: end
```

**Agents Used:**
1. `request-parser` - Parse natural language request
2. `intent-classifier` - Extract date/time/duration
3. `calendar-connector` - Read Google Calendar
4. `availability-finder` - Find open slots
5. `template-renderer` - Format time options
6. `email-sender` - Send proposal
7. `calendar-connector` - Book meeting
8. `reminder-scheduler` - Schedule reminders

**Total Agents:** 8 agents → Complete scheduling assistant

---

## Implementation Guide

### Step 1: Choose Your First Product

**Recommendation:** Start with **Chatbot** (Communication Platform)

**Why?**
- High market demand
- Clear value proposition
- Reuses existing SDLC infrastructure
- Can be monetized quickly

**Estimated Timeline:**
- Week 1-2: Implement core agents (speech-to-text, text-to-speech, semantic-search, llm-generator)
- Week 3: Implement workflow definition for chatbot
- Week 4: Test with beta customer (e.g., Mario's Pizza)
- Week 5: Deploy to production

### Step 2: Create Platform Record

```typescript
// Create communication platform in database
await prisma.platform.create({
  data: {
    id: 'communication',
    name: 'Communication Platform',
    layer: 'APPLICATION',
    description: 'Voice, SMS, and messaging automation',
    config: {
      twilio_account_sid: process.env.TWILIO_ACCOUNT_SID,
      twilio_auth_token: process.env.TWILIO_AUTH_TOKEN,
      default_language: 'en-US',
      default_voice: 'en-US-Neural2-J'
    },
    enabled: true
  }
});
```

### Step 3: Implement Core Agents

Each agent follows the `BaseAgent` pattern:

```typescript
// packages/agents/speech-to-text/src/speech-to-text.agent.ts
import { BaseAgent, AgentEnvelope, TaskResult } from '@agentic-sdlc/base-agent';
import { IMessageBus } from '@agentic-sdlc/orchestrator';
import Deepgram from '@deepgram/sdk';

export class SpeechToTextAgent extends BaseAgent {
  private deepgram: Deepgram;

  constructor(messageBus: IMessageBus, platformId: string = 'communication') {
    super(
      {
        type: 'speech-to-text',
        version: '1.0.0',
        capabilities: ['transcription', 'voice_recognition', 'language_detection'],
        timeout_ms: 5000,
        max_retries: 2
      },
      messageBus,
      undefined,
      undefined,
      undefined,
      platformId
    );

    this.deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY);
  }

  async execute(task: AgentEnvelope): Promise<TaskResult> {
    const { audio_url, language = 'en-US' } = task.payload;

    try {
      // Call Deepgram API
      const response = await this.deepgram.transcription.preRecorded(
        { url: audio_url },
        { language, punctuate: true, diarize: false }
      );

      const transcript = response.results.channels[0].alternatives[0].transcript;
      const confidence = response.results.channels[0].alternatives[0].confidence;

      return {
        message_id: task.message_id,
        task_id: task.task_id,
        workflow_id: task.workflow_id,
        agent_id: this.agentId,
        status: 'success',
        result: {
          data: {
            transcript,
            confidence,
            language_detected: language,
            duration_ms: response.results.channels[0].duration * 1000
          },
          metrics: {
            duration_ms: Date.now() - Date.parse(task.created_at)
          }
        },
        metadata: {
          completed_at: new Date().toISOString(),
          trace_id: task.trace.trace_id
        }
      };
    } catch (error) {
      return {
        message_id: task.message_id,
        task_id: task.task_id,
        workflow_id: task.workflow_id,
        agent_id: this.agentId,
        status: 'failure',
        result: {
          data: {},
          metrics: { duration_ms: 0 }
        },
        errors: [{
          code: 'TRANSCRIPTION_FAILED',
          message: error instanceof Error ? error.message : String(error),
          recoverable: true
        }],
        metadata: {
          completed_at: new Date().toISOString(),
          trace_id: task.trace.trace_id
        }
      };
    }
  }
}

// Start agent
const messageBus = getMessageBus(); // From DI container
const agent = new SpeechToTextAgent(messageBus, 'communication');
await agent.initialize();
```

### Step 4: Register Agents

```bash
# PM2 process file for communication agents
# ecosystem.config.js

module.exports = {
  apps: [
    {
      name: 'speech-to-text',
      script: 'packages/agents/speech-to-text/dist/index.js',
      env: {
        NODE_ENV: 'production',
        AGENT_TYPE: 'speech-to-text',
        PLATFORM_ID: 'communication'
      }
    },
    {
      name: 'text-to-speech',
      script: 'packages/agents/text-to-speech/dist/index.js',
      env: {
        AGENT_TYPE: 'text-to-speech',
        PLATFORM_ID: 'communication'
      }
    },
    {
      name: 'semantic-search',
      script: 'packages/agents/semantic-search/dist/index.js',
      env: {
        AGENT_TYPE: 'semantic-search',
        PLATFORM_ID: 'communication'
      }
    },
    {
      name: 'llm-generator',
      script: 'packages/agents/llm-generator/dist/index.js',
      env: {
        AGENT_TYPE: 'llm-generator',
        PLATFORM_ID: 'communication'
      }
    }
  ]
};
```

### Step 5: Define Workflow

```typescript
// Create workflow definition via API
POST /api/v1/platforms/communication/workflow-definitions
{
  "name": "inbound-call",
  "version": "1.0.0",
  "description": "Handle inbound phone calls with AI",
  "definition": {
    "stages": [
      {
        "name": "transcribe",
        "agent_type": "speech-to-text",
        "timeout_ms": 5000,
        "transitions": [
          { "event": "success", "target": "search-knowledge" }
        ]
      },
      {
        "name": "search-knowledge",
        "agent_type": "semantic-search",
        "timeout_ms": 3000,
        "transitions": [
          { "event": "success", "target": "generate-response" }
        ]
      },
      {
        "name": "generate-response",
        "agent_type": "llm-generator",
        "timeout_ms": 10000,
        "transitions": [
          { "event": "success", "target": "speak-response" }
        ]
      },
      {
        "name": "speak-response",
        "agent_type": "text-to-speech",
        "timeout_ms": 3000,
        "transitions": [
          { "event": "success", "target": "end" }
        ]
      }
    ],
    "initial_stage": "transcribe"
  }
}
```

### Step 6: Launch Product

```bash
# Start all services
./dev start

# Deploy agents
pm2 start ecosystem.config.js

# Monitor
./dev logs
```

---

## Code Examples

### Example: LLM Generator Agent (Full Implementation)

```typescript
// packages/agents/llm-generator/src/llm-generator.agent.ts
import { BaseAgent, AgentEnvelope, TaskResult } from '@agentic-sdlc/base-agent';
import { IMessageBus } from '@agentic-sdlc/orchestrator';
import Anthropic from '@anthropic-ai/sdk';

interface LLMGeneratorPayload {
  prompt: string;
  system_prompt?: string;
  model?: 'claude-haiku-4-5' | 'claude-sonnet-4-5' | 'gpt-4o';
  max_tokens?: number;
  temperature?: number;
  context?: {
    documents: Array<{
      content: string;
      source: string;
    }>;
  };
  output_format?: 'text' | 'json' | 'markdown';
}

export class LLMGeneratorAgent extends BaseAgent {
  private anthropic: Anthropic;

  constructor(messageBus: IMessageBus, platformId?: string) {
    super(
      {
        type: 'llm-generator',
        version: '1.0.0',
        capabilities: ['generate_text', 'summarize', 'translate'],
        timeout_ms: 30000,
        max_retries: 2
      },
      messageBus,
      undefined,
      undefined,
      undefined,
      platformId
    );

    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }

  async execute(task: AgentEnvelope): Promise<TaskResult> {
    const payload = task.payload as LLMGeneratorPayload;
    const startTime = Date.now();

    try {
      // Build prompt with RAG context if provided
      let finalPrompt = payload.prompt;
      if (payload.context?.documents) {
        const contextText = payload.context.documents
          .map((doc, i) => `[Document ${i + 1} from ${doc.source}]\n${doc.content}`)
          .join('\n\n');

        finalPrompt = `${contextText}\n\n---\n\nUser Question: ${payload.prompt}`;
      }

      // Call Claude API (using circuit breaker from BaseAgent)
      const response = await this.callClaude(
        finalPrompt,
        payload.system_prompt,
        payload.max_tokens || 4096
      );

      const duration_ms = Date.now() - startTime;

      // Calculate token count (approximate)
      const inputTokens = Math.ceil((finalPrompt.length + (payload.system_prompt?.length || 0)) / 4);
      const outputTokens = Math.ceil(response.length / 4);
      const totalTokens = inputTokens + outputTokens;

      // Calculate cost (Claude Haiku 4.5 pricing)
      const costPer1MInput = 0.80;
      const costPer1MOutput = 4.00;
      const costUsd = (inputTokens / 1_000_000 * costPer1MInput) + (outputTokens / 1_000_000 * costPer1MOutput);

      return {
        message_id: task.message_id,
        task_id: task.task_id,
        workflow_id: task.workflow_id,
        agent_id: this.agentId,
        status: 'success',
        result: {
          data: {
            generated_text: response,
            model_used: payload.model || 'claude-haiku-4-5',
            token_count: {
              input: inputTokens,
              output: outputTokens,
              total: totalTokens
            },
            finish_reason: 'stop',
            cost_usd: costUsd
          },
          metrics: {
            duration_ms,
            tokens_per_second: outputTokens / (duration_ms / 1000)
          }
        },
        metadata: {
          completed_at: new Date().toISOString(),
          trace_id: task.trace.trace_id
        }
      };
    } catch (error) {
      const duration_ms = Date.now() - startTime;

      return {
        message_id: task.message_id,
        task_id: task.task_id,
        workflow_id: task.workflow_id,
        agent_id: this.agentId,
        status: 'failure',
        result: {
          data: {},
          metrics: { duration_ms }
        },
        errors: [{
          code: 'LLM_GENERATION_FAILED',
          message: error instanceof Error ? error.message : String(error),
          recoverable: true
        }],
        metadata: {
          completed_at: new Date().toISOString(),
          trace_id: task.trace.trace_id
        }
      };
    }
  }
}

// Start agent
const messageBus = getMessageBus();
const agent = new LLMGeneratorAgent(messageBus, 'communication');
await agent.initialize();
```

---

## Next Steps

### Immediate Action Items

1. **Choose First Product** - Chatbot recommended (communication platform)
2. **Implement 4 Core Agents:**
   - `speech-to-text`
   - `text-to-speech`
   - `semantic-search`
   - `llm-generator`
3. **Create Workflow Definition** - Inbound call workflow
4. **Deploy Beta** - Test with 1 customer (e.g., local restaurant)
5. **Iterate** - Gather feedback, improve agents

### Long-Term Roadmap

**Month 1-2:** Build communication platform (chatbot)
- 4 core agents
- 1 workflow definition
- 1 beta customer
- Revenue: $0-500/month

**Month 3:** Build email automation platform
- Reuse 60% of agents (llm-generator, semantic-search)
- Add 5 new agents (email-parser, spam-detector, email-sender, etc.)
- 2 workflow definitions
- 3 customers
- Revenue: $500-2000/month

**Month 4:** Build scheduling platform
- Reuse 70% of agents
- Add 3 new agents (calendar-connector, availability-finder, reminder-scheduler)
- 2 workflow definitions
- 5 customers
- Revenue: $2000-5000/month

**Month 5-6:** Build support ticketing platform
- Reuse 80% of agents
- Add 4 new agents (ticket-creator, priority-scorer, escalator, crm-sync)
- 3 workflow definitions
- 10 customers
- Revenue: $5000-15000/month

**Month 7+:** Scale and expand
- SMS marketing platform
- Data pipeline platform
- ML training platform
- Revenue: $15000-50000+/month

---

## Summary

### What You Already Have ✅

1. **Message Bus** - Redis Streams with AgentEnvelope v2.0.0
2. **State Machine** - Workflow definitions in database
3. **Agent Registry** - Platform-scoped agent discovery
4. **Base Agent Pattern** - All agents extend BaseAgent
5. **Monitoring** - Alert system, health checks
6. **Multi-Tenancy** - Platform model supports isolation
7. **Dashboard** - Platform visualization, workflow builder

### What You Need to Add 🚀

1. **New Platforms** - Communication, Email, Scheduling, etc.
2. **40+ Reusable Agents** - Categories 1-8 from this document
3. **Workflow Definitions** - Per-product workflows
4. **External Integrations** - Twilio, Deepgram, Google Calendar, etc.

### The Business Model 💰

**Same infrastructure, multiple products:**
- Chatbot: $29-149/month per customer
- Email: $49-199/month per customer
- Scheduling: $39-99/month per customer
- Enterprise: $500-5000/month (custom workflows)

**10 customers across 3 products = $5000-15000/month MRR**

---

**Ready to build your first product?** Start with the Chatbot (Communication Platform) using the implementation guide above! 🚀
