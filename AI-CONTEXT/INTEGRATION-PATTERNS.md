# INTEGRATION PATTERNS FOR AI AGENTS

**Purpose:** How components connect and communicate within the system

---

## Component Integration Map

```
┌─────────────────────────────────────────────────────────┐
│                  Integration Overview                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Orchestrator ←──→ Event Bus ←──→ Agents                │
│       ↕              ↕              ↕                   │
│    Database      Message Queue   File System            │
│       ↕              ↕              ↕                   │
│     API  ←────→  Pipeline  ←────→  Git                 │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Database Integration

### Connection Pool Pattern

```typescript
// packages/shared/src/database.ts
import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

class DatabaseConnection {
  private static instance: PrismaClient;
  private static isConnected = false;

  static async getInstance(): Promise<PrismaClient> {
    if (!this.instance) {
      this.instance = new PrismaClient({
        datasources: {
          db: {
            url: process.env.DATABASE_URL
          }
        },
        log: [
          { emit: 'event', level: 'error' },
          { emit: 'event', level: 'warn' }
        ]
      });

      // Setup event listeners
      this.instance.$on('error', (e) => {
        logger.error('Database error', { error: e });
      });

      // Test connection
      await this.instance.$connect();
      this.isConnected = true;

      logger.info('Database connected');
    }

    return this.instance;
  }

  static async disconnect(): Promise<void> {
    if (this.instance && this.isConnected) {
      await this.instance.$disconnect();
      this.isConnected = false;
      logger.info('Database disconnected');
    }
  }
}

// Usage in agents
export async function withDatabase<T>(
  operation: (db: PrismaClient) => Promise<T>
): Promise<T> {
  const db = await DatabaseConnection.getInstance();

  try {
    return await operation(db);
  } catch (error) {
    logger.error('Database operation failed', { error });
    throw error;
  }
}
```

### Transaction Pattern

```typescript
// Complex operations requiring transactions
export async function createWorkflowWithTasks(
  workflowData: CreateWorkflowInput,
  tasks: CreateTaskInput[]
): Promise<Workflow> {
  return await withDatabase(async (db) => {
    return await db.$transaction(async (tx) => {
      // Create workflow
      const workflow = await tx.workflow.create({
        data: workflowData
      });

      // Create tasks
      await tx.task.createMany({
        data: tasks.map(task => ({
          ...task,
          workflow_id: workflow.id
        }))
      });

      // Create initial event
      await tx.event.create({
        data: {
          type: 'WORKFLOW_CREATED',
          workflow_id: workflow.id,
          data: { tasks: tasks.length }
        }
      });

      return workflow;
    });
  });
}
```

---

## Redis Integration

### Redis Client Setup

```typescript
// packages/shared/src/redis.ts
import { Redis } from 'ioredis';
import { logger } from './logger';

class RedisConnection {
  private static instance: Redis;
  private static subscriber: Redis;
  private static publisher: Redis;

  static getInstance(): Redis {
    if (!this.instance) {
      this.instance = new Redis(process.env.REDIS_URL!, {
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        reconnectOnError: (err) => {
          const targetError = 'READONLY';
          if (err.message.includes(targetError)) {
            return true;
          }
          return false;
        }
      });

      this.instance.on('connect', () => {
        logger.info('Redis connected');
      });

      this.instance.on('error', (error) => {
        logger.error('Redis error', { error });
      });
    }

    return this.instance;
  }

  static getPublisher(): Redis {
    if (!this.publisher) {
      this.publisher = new Redis(process.env.REDIS_URL!);
    }
    return this.publisher;
  }

  static getSubscriber(): Redis {
    if (!this.subscriber) {
      this.subscriber = new Redis(process.env.REDIS_URL!);
    }
    return this.subscriber;
  }
}

export const redis = RedisConnection.getInstance();
export const publisher = RedisConnection.getPublisher();
export const subscriber = RedisConnection.getSubscriber();
```

### Caching Pattern

```typescript
// Caching with automatic expiry
export class CacheManager {
  private redis: Redis;
  private defaultTTL = 3600; // 1 hour

  constructor() {
    this.redis = RedisConnection.getInstance();
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data) as T;
    } catch {
      return data as unknown as T;
    }
  }

  async set<T>(
    key: string,
    value: T,
    ttl: number = this.defaultTTL
  ): Promise<void> {
    const serialized = typeof value === 'string'
      ? value
      : JSON.stringify(value);

    await this.redis.setex(key, ttl, serialized);
  }

  async invalidate(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);

    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  // Cache-aside pattern
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Try cache first
    const cached = await this.get<T>(key);

    if (cached !== null) {
      return cached;
    }

    // Fetch and cache
    const fresh = await fetcher();
    await this.set(key, fresh, ttl);

    return fresh;
  }
}
```

---

## Event Bus Integration

### Pub/Sub Pattern

```typescript
// packages/shared/src/event-bus.ts
import { EventEmitter } from 'events';
import { publisher, subscriber } from './redis';
import { logger } from './logger';

export class EventBus extends EventEmitter {
  private static instance: EventBus;

  private constructor() {
    super();
    this.setupRedisSubscriptions();
  }

  static getInstance(): EventBus {
    if (!this.instance) {
      this.instance = new EventBus();
    }
    return this.instance;
  }

  private setupRedisSubscriptions(): void {
    subscriber.on('message', (channel, message) => {
      try {
        const event = JSON.parse(message);
        this.emit(channel, event);
      } catch (error) {
        logger.error('Failed to parse event', { channel, message, error });
      }
    });
  }

  async publish(channel: string, event: any): Promise<void> {
    // Local emit
    this.emit(channel, event);

    // Redis publish for distributed
    await publisher.publish(channel, JSON.stringify(event));

    logger.debug('Event published', { channel, event });
  }

  async subscribe(
    channel: string,
    handler: (event: any) => Promise<void>
  ): Promise<void> {
    // Local subscription
    this.on(channel, handler);

    // Redis subscription
    await subscriber.subscribe(channel);

    logger.debug('Subscribed to channel', { channel });
  }

  async unsubscribe(channel: string): Promise<void> {
    this.removeAllListeners(channel);
    await subscriber.unsubscribe(channel);
  }
}

// Usage in agents
const eventBus = EventBus.getInstance();

// Subscribe to events
await eventBus.subscribe('workflow.created', async (event) => {
  console.log('New workflow:', event);
});

// Publish events
await eventBus.publish('agent.task.completed', {
  agent_id: 'agent-123',
  task_id: 'task-456',
  status: 'success'
});
```

---

## Message Queue Integration

### Task Queue Pattern

```typescript
// packages/shared/src/task-queue.ts
import Bull from 'bull';
import { logger } from './logger';

export class TaskQueue {
  private queues: Map<string, Bull.Queue> = new Map();

  getQueue(name: string): Bull.Queue {
    if (!this.queues.has(name)) {
      const queue = new Bull(name, process.env.REDIS_URL!, {
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          }
        }
      });

      this.queues.set(name, queue);

      // Setup event listeners
      queue.on('completed', (job) => {
        logger.info('Job completed', {
          queue: name,
          jobId: job.id,
          data: job.data
        });
      });

      queue.on('failed', (job, err) => {
        logger.error('Job failed', {
          queue: name,
          jobId: job.id,
          error: err.message
        });
      });
    }

    return this.queues.get(name)!;
  }

  async addTask(
    queueName: string,
    data: any,
    options?: Bull.JobOptions
  ): Promise<Bull.Job> {
    const queue = this.getQueue(queueName);
    return await queue.add(data, options);
  }

  async processQueue(
    queueName: string,
    processor: (job: Bull.Job) => Promise<any>,
    concurrency: number = 5
  ): Promise<void> {
    const queue = this.getQueue(queueName);

    queue.process(concurrency, async (job) => {
      logger.info('Processing job', {
        queue: queueName,
        jobId: job.id
      });

      try {
        return await processor(job);
      } catch (error) {
        logger.error('Job processing failed', {
          queue: queueName,
          jobId: job.id,
          error
        });
        throw error;
      }
    });
  }
}

// Agent using task queue
const taskQueue = new TaskQueue();

// Add task
await taskQueue.addTask('scaffold-tasks', {
  type: 'create-app',
  name: 'my-app'
}, {
  priority: 1,
  delay: 5000 // Start after 5 seconds
});

// Process tasks
await taskQueue.processQueue('scaffold-tasks', async (job) => {
  const agent = new ScaffoldAgent();
  return await agent.execute(job.data);
});
```

---

## File System Integration

### Safe File Operations

```typescript
// packages/shared/src/file-system.ts
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from './logger';

export class FileSystemManager {
  private basePath: string;

  constructor(basePath: string = './workspace') {
    this.basePath = basePath;
  }

  private resolvePath(relativePath: string): string {
    // Prevent path traversal
    const normalized = path.normalize(relativePath);

    if (normalized.includes('..')) {
      throw new Error('Path traversal not allowed');
    }

    return path.join(this.basePath, normalized);
  }

  async ensureDirectory(dirPath: string): Promise<void> {
    const fullPath = this.resolvePath(dirPath);

    try {
      await fs.mkdir(fullPath, { recursive: true });
      logger.debug('Directory created', { path: fullPath });
    } catch (error) {
      logger.error('Failed to create directory', { path: fullPath, error });
      throw error;
    }
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const fullPath = this.resolvePath(filePath);
    const dir = path.dirname(fullPath);

    // Ensure directory exists
    await this.ensureDirectory(dir);

    try {
      await fs.writeFile(fullPath, content, 'utf-8');
      logger.debug('File written', { path: fullPath });
    } catch (error) {
      logger.error('Failed to write file', { path: fullPath, error });
      throw error;
    }
  }

  async readFile(filePath: string): Promise<string> {
    const fullPath = this.resolvePath(filePath);

    try {
      return await fs.readFile(fullPath, 'utf-8');
    } catch (error) {
      logger.error('Failed to read file', { path: fullPath, error });
      throw error;
    }
  }

  async exists(filePath: string): Promise<boolean> {
    const fullPath = this.resolvePath(filePath);

    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async copyDirectory(source: string, destination: string): Promise<void> {
    const srcPath = this.resolvePath(source);
    const destPath = this.resolvePath(destination);

    await this.ensureDirectory(destination);

    const entries = await fs.readdir(srcPath, { withFileTypes: true });

    for (const entry of entries) {
      const srcEntry = path.join(srcPath, entry.name);
      const destEntry = path.join(destPath, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(
          path.join(source, entry.name),
          path.join(destination, entry.name)
        );
      } else {
        await fs.copyFile(srcEntry, destEntry);
      }
    }
  }
}
```

---

## Git Integration

### Git Operations

```typescript
// packages/shared/src/git.ts
import simpleGit, { SimpleGit } from 'simple-git';
import { logger } from './logger';

export class GitManager {
  private git: SimpleGit;

  constructor(workingDirectory: string) {
    this.git = simpleGit(workingDirectory);
  }

  async initialize(): Promise<void> {
    await this.git.init();
    logger.info('Git repository initialized');
  }

  async clone(repoUrl: string, directory: string): Promise<void> {
    await this.git.clone(repoUrl, directory);
    logger.info('Repository cloned', { url: repoUrl, directory });
  }

  async addFiles(files: string[] = ['.']): Promise<void> {
    await this.git.add(files);
  }

  async commit(message: string): Promise<string> {
    const result = await this.git.commit(message);
    logger.info('Changes committed', { sha: result.commit });
    return result.commit;
  }

  async push(remote: string = 'origin', branch: string = 'main'): Promise<void> {
    await this.git.push(remote, branch);
    logger.info('Changes pushed', { remote, branch });
  }

  async createBranch(branchName: string): Promise<void> {
    await this.git.checkoutLocalBranch(branchName);
    logger.info('Branch created', { branch: branchName });
  }

  async getCurrentBranch(): Promise<string> {
    const result = await this.git.branch();
    return result.current;
  }

  async getStatus(): Promise<any> {
    return await this.git.status();
  }

  async getDiff(cached: boolean = false): Promise<string> {
    if (cached) {
      return await this.git.diff(['--cached']);
    }
    return await this.git.diff();
  }
}

// Usage in agents
const gitManager = new GitManager('./workspace/my-app');
await gitManager.initialize();
await gitManager.addFiles();
await gitManager.commit('Initial commit');
```

---

## API Integration

### External API Client

```typescript
// packages/shared/src/api-client.ts
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import pRetry from 'p-retry';
import { logger } from './logger';

export class APIClient {
  private client: AxiosInstance;

  constructor(baseURL: string, config?: AxiosRequestConfig) {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      },
      ...config
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('API request', {
          method: config.method,
          url: config.url,
          data: config.data
        });
        return config;
      },
      (error) => {
        logger.error('API request error', { error });
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('API response', {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        logger.error('API response error', {
          status: error.response?.status,
          url: error.config?.url,
          error: error.message
        });
        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return await pRetry(
      async () => {
        const response = await this.client.get<T>(url, config);
        return response.data;
      },
      {
        retries: 3,
        onFailedAttempt: (error) => {
          logger.warn('API request retry', {
            attempt: error.attemptNumber,
            retriesLeft: error.retriesLeft
          });
        }
      }
    );
  }

  async post<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  async put<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }
}

// GitHub API integration
const githubClient = new APIClient('https://api.github.com', {
  headers: {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`
  }
});

// Create PR
await githubClient.post('/repos/owner/repo/pulls', {
  title: 'New feature',
  head: 'feature-branch',
  base: 'main',
  body: 'PR description'
});
```

---

## Docker Integration

### Container Management

```typescript
// packages/shared/src/docker.ts
import Docker from 'dockerode';
import { logger } from './logger';

export class DockerManager {
  private docker: Docker;

  constructor() {
    this.docker = new Docker();
  }

  async buildImage(
    dockerfilePath: string,
    tag: string
  ): Promise<void> {
    const stream = await this.docker.buildImage({
      context: dockerfilePath,
      src: ['Dockerfile', '.']
    }, {
      t: tag
    });

    await new Promise((resolve, reject) => {
      this.docker.modem.followProgress(stream, (err, res) => {
        if (err) {
          logger.error('Docker build failed', { error: err });
          reject(err);
        } else {
          logger.info('Docker build completed', { tag });
          resolve(res);
        }
      });
    });
  }

  async runContainer(
    image: string,
    options: Docker.ContainerCreateOptions = {}
  ): Promise<Docker.Container> {
    const container = await this.docker.createContainer({
      Image: image,
      AttachStdout: true,
      AttachStderr: true,
      ...options
    });

    await container.start();
    logger.info('Container started', { image, id: container.id });

    return container;
  }

  async stopContainer(containerId: string): Promise<void> {
    const container = this.docker.getContainer(containerId);
    await container.stop();
    await container.remove();
    logger.info('Container stopped', { id: containerId });
  }

  async getContainerLogs(containerId: string): Promise<string> {
    const container = this.docker.getContainer(containerId);
    const stream = await container.logs({
      stdout: true,
      stderr: true,
      follow: false
    });

    return stream.toString();
  }
}
```

---

## WebSocket Integration

### Real-time Communication

```typescript
// packages/shared/src/websocket.ts
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { logger } from './logger';

export class WebSocketClient extends EventEmitter {
  private ws?: WebSocket;
  private url: string;
  private reconnectInterval: number = 5000;
  private shouldReconnect: boolean = true;

  constructor(url: string) {
    super();
    this.url = url;
  }

  connect(): void {
    this.ws = new WebSocket(this.url);

    this.ws.on('open', () => {
      logger.info('WebSocket connected', { url: this.url });
      this.emit('connected');
    });

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.emit('message', message);
      } catch (error) {
        logger.error('Failed to parse WebSocket message', { error });
      }
    });

    this.ws.on('close', () => {
      logger.info('WebSocket disconnected');
      this.emit('disconnected');

      if (this.shouldReconnect) {
        setTimeout(() => this.connect(), this.reconnectInterval);
      }
    });

    this.ws.on('error', (error) => {
      logger.error('WebSocket error', { error });
      this.emit('error', error);
    });
  }

  send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      logger.warn('WebSocket not connected, message not sent');
    }
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Usage
const wsClient = new WebSocketClient('ws://localhost:3000/ws');

wsClient.on('connected', () => {
  wsClient.send({
    type: 'subscribe',
    channels: ['workflows']
  });
});

wsClient.on('message', (message) => {
  console.log('Received:', message);
});

wsClient.connect();
```

---

## Integration Best Practices

### For AI Agents:

1. **ALWAYS use connection pooling**
   - Don't create new connections for each operation
   - Reuse existing connections

2. **ALWAYS handle connection failures**
   - Implement retry logic
   - Use circuit breakers for external services

3. **ALWAYS validate data at boundaries**
   - Check data coming from external systems
   - Validate before sending to external systems

4. **NEVER hardcode connection strings**
   - Use environment variables
   - Use configuration management

5. **ALWAYS implement timeouts**
   - Set reasonable timeouts for all operations
   - Handle timeout errors gracefully

6. **ALWAYS log integration points**
   - Log requests and responses
   - Include correlation IDs for tracing

7. **NEVER ignore errors**
   - Catch and handle all errors
   - Propagate or transform as needed

8. **ALWAYS clean up resources**
   - Close connections when done
   - Remove temporary files
   - Cancel subscriptions