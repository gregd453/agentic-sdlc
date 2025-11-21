# Redis & OrchestratorContainer - Complete Explanation

## Table of Contents
1. [What is Redis?](#what-is-redis)
2. [Why 3 Redis Clients?](#why-3-redis-clients)
3. [What is OrchestratorContainer?](#what-is-orchestratorcontainer)
4. [How They Work Together](#how-they-work-together)
5. [Message Flow Example](#message-flow-example)
6. [Real-World Analogy](#real-world-analogy)

---

## What is Redis?

**Redis** is an in-memory data structure store used as:
- **Database** (key-value store)
- **Message broker** (pub/sub)
- **Cache**
- **Stream processing** (durable message queues)

### Redis Features Used in This System

```
┌─────────────────────────────────────────┐
│           Redis (Port 6380)             │
├─────────────────────────────────────────┤
│                                         │
│  1. Key-Value Store (KV)                │
│     redis.set('key', 'value')           │
│     redis.get('key')                    │
│                                         │
│  2. Pub/Sub (Real-time messaging)       │
│     redis.publish('channel', 'msg')     │
│     redis.subscribe('channel')          │
│                                         │
│  3. Streams (Durable queues)            │
│     redis.xAdd('stream', data)          │
│     redis.xReadGroup('group', ...)      │
│                                         │
└─────────────────────────────────────────┘
```

---

## Why 3 Redis Clients?

### The Problem

Redis has a **critical limitation**: When a client enters `SUBSCRIBE` mode (to listen for messages), it **CANNOT** run other Redis commands like `GET`, `SET`, `XADD`, etc.

### The Solution

Create **3 separate connections** to Redis:

```typescript
const redisSuite = {
  base: RedisClient,  // For KV ops (GET, SET, XADD)
  pub: RedisClient,   // For publishing messages
  sub: RedisClient    // For subscribing (blocked in SUBSCRIBE mode)
}
```

### Detailed Breakdown

| Client | Purpose | Example Operations | Can It Do Other Commands? |
|--------|---------|-------------------|---------------------------|
| **base** | General operations | `GET key`, `SET key value`, `XADD stream`, `HSET hash` | ✅ Yes |
| **pub** | Publishing messages | `PUBLISH channel message`, `XADD stream data` | ✅ Yes |
| **sub** | Subscribing to channels | `SUBSCRIBE channel`, `PSUBSCRIBE pattern` | ❌ **NO** - blocked! |

**Why separate pub/sub?**
- Even though both CAN publish, separating them makes the code cleaner
- Prevents accidental blocking of the publisher
- Better error isolation

---

## What is OrchestratorContainer?

**OrchestratorContainer** is a **Dependency Injection Container** - it creates and manages all the infrastructure components the system needs.

### Think of it Like a Factory

```
OrchestratorContainer
    │
    ├─ Creates Redis Connections (3 clients)
    ├─ Creates Message Bus (uses pub/sub clients)
    ├─ Creates KV Store (uses base client)
    ├─ Creates Orchestrators (phase coordinators)
    └─ Manages Lifecycle (startup, health, shutdown)
```

### Container Initialization Flow

```typescript
// 1. CREATE Container
const container = new OrchestratorContainer({
  redisUrl: 'redis://localhost:6380',
  redisNamespace: 'agentic-sdlc',
  coordinators: { plan: true }
});

// 2. INITIALIZE (connects to Redis, creates services)
await container.initialize();
/*
   ├─ makeRedisSuite() → creates base/pub/sub clients
   ├─ makeRedisBus(pub, sub) → creates message bus
   └─ makeRedisKV(base) → creates KV store
*/

// 3. START orchestrators (optional - only needed for orchestrator service)
await container.startOrchestrators();

// 4. USE the services
const bus = container.getBus();
await bus.publish('topic', { data: 'hello' });

// 5. SHUTDOWN gracefully
await container.shutdown();
```

---

## How They Work Together

### Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                   OrchestratorContainer                       │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              RedisSuite (3 connections)                │  │
│  │                                                        │  │
│  │    base ──┐                                           │  │
│  │    pub ───┼──→ Redis Server (localhost:6380)         │  │
│  │    sub ───┘                                           │  │
│  └────────────────────────────────────────────────────────┘  │
│          │                    │                              │
│          ↓                    ↓                              │
│  ┌──────────────┐     ┌──────────────┐                      │
│  │   KV Store   │     │  Message Bus │                      │
│  │              │     │              │                      │
│  │ uses: base   │     │ uses: pub    │                      │
│  │              │     │       sub    │                      │
│  └──────────────┘     └──────────────┘                      │
│                               │                              │
│                               ↓                              │
│                       ┌───────────────┐                      │
│                       │ Orchestrators │                      │
│                       │  (optional)   │                      │
│                       └───────────────┘                      │
└──────────────────────────────────────────────────────────────┘
```

### Who Uses the Container?

1. **Orchestrator Service** (main service)
   ```typescript
   // packages/orchestrator/src/server.ts
   const container = await bootstrapOrchestrator();
   // Gets bus + KV + starts coordinators
   ```

2. **Agents** (scaffold, validation, e2e, integration, deployment)
   ```typescript
   // packages/agents/scaffold-agent/src/run-agent.ts
   const container = new OrchestratorContainer({
     redisUrl: 'redis://localhost:6380',
     redisNamespace: 'agent-scaffold',
     coordinators: {}  // Agents don't need orchestrators
   });
   await container.initialize();
   const bus = container.getBus();
   // Use bus to receive tasks
   ```

---

## Message Flow Example

### Scenario: Orchestrator sends task to Scaffold Agent

```
1. ORCHESTRATOR
   ├─ container.getBus().publish('agent:scaffold:tasks', envelope)
   │
   ↓  Uses pub client

2. REDIS
   ├─ Stores in stream: "stream:agent:scaffold:tasks"
   ├─ Publishes to channel: "agent:scaffold:tasks" (if pub/sub enabled)
   │
   ↓

3. SCAFFOLD AGENT
   ├─ container.getBus().subscribe('agent:scaffold:tasks', handler)
   │  Uses sub client (in SUBSCRIBE mode)
   │
   ├─ Stream consumer reads from "stream:agent:scaffold:tasks"
   │  Uses base client (can still do other operations)
   │
   └─ handler(message) is called with the AgentEnvelope
```

### The Unwrapping Process

```typescript
// In Redis stream
{
  topic: "agent:scaffold:tasks",
  payload: '{"key":"workflow-id","msg":{...AgentEnvelope...}}'
}

// 1. Stream consumer reads this
const messageData = streamMessage.message;
// messageData = { topic: "...", payload: "..." }

// 2. Parse payload
const payloadData = JSON.parse(messageData.payload);
// payloadData = { key: "workflow-id", msg: {...AgentEnvelope...} }

// 3. Unwrap to get actual message
const parsedMessage = payloadData.msg || payloadData;
// parsedMessage = {...AgentEnvelope...}

// 4. Pass to handler
handler(parsedMessage);
```

---

## Real-World Analogy

### OrchestratorContainer = Office Building Manager

Imagine an office building that needs:
- **Mail system** (message bus)
- **Filing cabinets** (KV store)
- **Phone lines** (Redis connections)

The **Building Manager (OrchestratorContainer)**:
1. **Sets up infrastructure**
   - Installs 3 phone lines (base, pub, sub)
   - Creates mail system using 2 of the phone lines
   - Sets up filing cabinets using 1 phone line

2. **Provides services to tenants**
   - Orchestrator tenant: "I need mail system + filing + coordinators"
   - Agent tenant: "I just need mail system"

3. **Manages lifecycle**
   - Opens building (initialize)
   - Monitors health (health checks)
   - Closes building (shutdown)

### Why 3 Phone Lines?

- **Phone Line 1 (base)**: For general calls - can call anyone, anytime
- **Phone Line 2 (pub)**: For outgoing announcements only
- **Phone Line 3 (sub)**: For listening to announcements - **can't make other calls while listening!**

If you only had 1 phone line and it was busy listening to announcements, you couldn't make any other calls!

---

## Key Takeaways

### Redis
- In-memory database + message broker + cache
- **3 separate clients** needed because subscribers get blocked
- Provides pub/sub (real-time) + streams (durable) messaging

### OrchestratorContainer
- **Dependency injection container** for infrastructure
- Creates and wires up all Redis-based services
- Used by **both orchestrator and agents**
- Manages lifecycle (init, health, shutdown)

### Why This Design?
- **Hexagonal Architecture**: Business logic doesn't know about Redis
- **Port/Adapter Pattern**: Easy to swap Redis for RabbitMQ or Kafka
- **Dependency Injection**: Services receive what they need, don't create it
- **Separation of Concerns**: Container handles infrastructure, services handle logic

---

## Common Questions

**Q: Why does each agent create its own container?**
**A:** Each agent is a separate Node.js process and needs its own Redis connections. They can't share connections across processes.

**Q: What happens if Redis goes down?**
**A:** Container health checks will fail, services will reconnect automatically (node-redis has built-in reconnect logic), and PM2 will restart failed processes.

**Q: Why not just use one Redis client?**
**A:** Because `SUBSCRIBE` mode blocks the client from running other commands. You'd have to unsubscribe every time you needed to do a `GET` or `SET`, which would miss messages.

**Q: What's the difference between pub/sub and streams?**
**A:**
- **Pub/Sub**: Fire-and-forget, real-time, no history. If no one is listening, message is lost.
- **Streams**: Durable queue, messages persist, consumers can catch up, supports consumer groups.

**Q: Why do we use BOTH pub/sub and streams?**
**A:** Currently pub/sub is disabled (Session #63 fix) to prevent duplicate delivery. We only use streams for durability and at-least-once delivery semantics.

---

**Last Updated:** 2025-11-14
**Session:** Testing Session
**Document Purpose:** Educational reference for Redis & OrchestratorContainer
