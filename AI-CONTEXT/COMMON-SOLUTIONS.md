# COMMON SOLUTIONS FOR AI AGENTS

**Purpose:** Pre-solved problems and their implementations

---

## Common Problems and Solutions

### Problem: Task Timeout

**Symptoms:**
- Task exceeds timeout limit
- No response from external service
- Long-running operations

**Solutions:**

```typescript
// Solution 1: Implement proper timeout handling
async function executeWithTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Operation timeout')), timeoutMs);
  });

  try {
    return await Promise.race([operation(), timeout]);
  } catch (error) {
    if (error.message === 'Operation timeout') {
      // Try to cancel the operation if possible
      await cleanupOperation();
      throw new TimeoutError(`Operation exceeded ${timeoutMs}ms`);
    }
    throw error;
  }
}

// Solution 2: Break into smaller chunks
async function processLargeDataset(data: any[]): Promise<void> {
  const CHUNK_SIZE = 100;
  const CHUNK_TIMEOUT = 30000;

  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    const chunk = data.slice(i, i + CHUNK_SIZE);

    await executeWithTimeout(
      () => processChunk(chunk),
      CHUNK_TIMEOUT
    );

    // Allow other operations
    await new Promise(resolve => setImmediate(resolve));
  }
}

// Solution 3: Use background jobs
async function handleLongOperation(task: Task): Promise<void> {
  // Queue for background processing
  await taskQueue.add('long-operations', task, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 }
  });

  // Return immediately
  return { status: 'queued', jobId: job.id };
}
```

---

### Problem: Memory Leak

**Symptoms:**
- Increasing memory usage over time
- Application crashes with OOM
- Slow performance

**Solutions:**

```typescript
// Solution 1: Proper cleanup
class AgentWithCleanup {
  private intervals: NodeJS.Timeout[] = [];
  private listeners: Array<{ target: any; event: string; handler: any }> = [];

  async initialize(): Promise<void> {
    // Track intervals
    const interval = setInterval(() => this.poll(), 5000);
    this.intervals.push(interval);

    // Track event listeners
    const handler = (event: any) => this.handleEvent(event);
    eventBus.on('task', handler);
    this.listeners.push({ target: eventBus, event: 'task', handler });
  }

  async cleanup(): Promise<void> {
    // Clear all intervals
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];

    // Remove all listeners
    this.listeners.forEach(({ target, event, handler }) => {
      target.removeListener(event, handler);
    });
    this.listeners = [];

    // Close connections
    await this.closeConnections();
  }
}

// Solution 2: Stream processing for large files
async function processLargeFile(filePath: string): Promise<void> {
  const readStream = fs.createReadStream(filePath, {
    encoding: 'utf8',
    highWaterMark: 16 * 1024 // 16KB chunks
  });

  const rl = readline.createInterface({
    input: readStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    await processLine(line);
  }

  // Stream automatically closed
}

// Solution 3: WeakMap for caching
class CacheWithWeakMap {
  private cache = new WeakMap<object, any>();

  set(key: object, value: any): void {
    this.cache.set(key, value);
  }

  get(key: object): any {
    return this.cache.get(key);
  }

  // No need to manually clear - garbage collected automatically
}
```

---

### Problem: Database Connection Pool Exhaustion

**Symptoms:**
- "Too many connections" errors
- Slow database queries
- Connection timeouts

**Solutions:**

```typescript
// Solution 1: Connection pool with limits
const poolConfig = {
  max: 20, // Maximum connections
  min: 5,  // Minimum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Solution 2: Connection lifecycle management
class DatabaseManager {
  private pool: Pool;

  async query<T>(sql: string, params?: any[]): Promise<T> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(sql, params);
      return result.rows;
    } finally {
      // ALWAYS release connection
      client.release();
    }
  }

  async transaction<T>(
    operation: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

// Solution 3: Query optimization
async function getWorkflowsEfficiently(userId: string): Promise<Workflow[]> {
  // Use single query with JOIN instead of N+1
  const query = `
    SELECT w.*,
           json_agg(t.*) as tasks
    FROM workflows w
    LEFT JOIN tasks t ON t.workflow_id = w.id
    WHERE w.user_id = $1
    GROUP BY w.id
    LIMIT 100
  `;

  return await db.query(query, [userId]);
}
```

---

### Problem: Race Conditions

**Symptoms:**
- Inconsistent state
- Duplicate operations
- Data corruption

**Solutions:**

```typescript
// Solution 1: Distributed locks
class DistributedLock {
  private redis: Redis;

  async acquire(
    key: string,
    ttl: number = 30000
  ): Promise<boolean> {
    const lockKey = `lock:${key}`;
    const lockId = uuid();

    const result = await this.redis.set(
      lockKey,
      lockId,
      'PX', ttl,
      'NX'
    );

    return result === 'OK';
  }

  async release(key: string): Promise<void> {
    await this.redis.del(`lock:${key}`);
  }

  async withLock<T>(
    key: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const acquired = await this.acquire(key);

    if (!acquired) {
      throw new Error('Could not acquire lock');
    }

    try {
      return await operation();
    } finally {
      await this.release(key);
    }
  }
}

// Solution 2: Idempotency keys
async function createWorkflowIdempotent(
  data: CreateWorkflowData,
  idempotencyKey: string
): Promise<Workflow> {
  // Check if already processed
  const existing = await db.idempotencyKeys.findUnique({
    where: { key: idempotencyKey }
  });

  if (existing) {
    return existing.result;
  }

  // Process with transaction
  return await db.$transaction(async (tx) => {
    // Double-check in transaction
    const check = await tx.idempotencyKeys.findUnique({
      where: { key: idempotencyKey }
    });

    if (check) {
      return check.result;
    }

    // Create workflow
    const workflow = await tx.workflow.create({ data });

    // Store idempotency key
    await tx.idempotencyKeys.create({
      data: {
        key: idempotencyKey,
        result: workflow,
        expires_at: new Date(Date.now() + 86400000) // 24 hours
      }
    });

    return workflow;
  });
}

// Solution 3: Optimistic locking
async function updateWithOptimisticLock(
  id: string,
  updates: any,
  expectedVersion: number
): Promise<void> {
  const result = await db.workflow.updateMany({
    where: {
      id,
      version: expectedVersion
    },
    data: {
      ...updates,
      version: { increment: 1 }
    }
  });

  if (result.count === 0) {
    throw new Error('Concurrent modification detected');
  }
}
```

---

### Problem: External API Rate Limiting

**Symptoms:**
- 429 Too Many Requests errors
- Throttling by external service
- Quota exceeded

**Solutions:**

```typescript
// Solution 1: Rate limiter
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;

  constructor(requestsPerSecond: number) {
    this.maxTokens = requestsPerSecond;
    this.tokens = requestsPerSecond;
    this.refillRate = requestsPerSecond;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens < 1) {
      const waitTime = (1 - this.tokens) * (1000 / this.refillRate);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.refill();
    }

    this.tokens--;
  }

  private refill(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000;
    const tokensToAdd = timePassed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}

// Solution 2: Exponential backoff with jitter
async function callAPIWithBackoff<T>(
  apiCall: () => Promise<T>,
  maxRetries: number = 5
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      if (error.response?.status === 429) {
        const baseDelay = Math.pow(2, i) * 1000;
        const jitter = Math.random() * 1000;
        const delay = baseDelay + jitter;

        logger.warn(`Rate limited, waiting ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }

  throw new Error('Max retries exceeded');
}

// Solution 3: Request batching
class BatchProcessor {
  private queue: Array<{ request: any; resolve: Function; reject: Function }> = [];
  private timer?: NodeJS.Timeout;

  async add<T>(request: any): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ request, resolve, reject });

      if (!this.timer) {
        this.timer = setTimeout(() => this.flush(), 100);
      }
    });
  }

  private async flush(): Promise<void> {
    const batch = this.queue.splice(0, 100); // Max batch size
    this.timer = undefined;

    if (batch.length === 0) return;

    try {
      const results = await this.processBatch(
        batch.map(item => item.request)
      );

      batch.forEach((item, index) => {
        item.resolve(results[index]);
      });
    } catch (error) {
      batch.forEach(item => item.reject(error));
    }
  }

  private async processBatch(requests: any[]): Promise<any[]> {
    // Send as single batch request
    return await api.batchProcess(requests);
  }
}
```

---

### Problem: Circular Dependencies

**Symptoms:**
- Stack overflow errors
- Infinite loops
- Deadlocks

**Solutions:**

```typescript
// Solution 1: Dependency graph validation
class DependencyResolver {
  private graph = new Map<string, Set<string>>();

  addDependency(item: string, dependsOn: string): void {
    if (!this.graph.has(item)) {
      this.graph.set(item, new Set());
    }
    this.graph.get(item)!.add(dependsOn);

    // Check for cycles
    if (this.hasCycle()) {
      this.graph.get(item)!.delete(dependsOn);
      throw new Error(`Circular dependency detected: ${item} -> ${dependsOn}`);
    }
  }

  private hasCycle(): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    for (const node of this.graph.keys()) {
      if (this.detectCycle(node, visited, recursionStack)) {
        return true;
      }
    }

    return false;
  }

  private detectCycle(
    node: string,
    visited: Set<string>,
    recursionStack: Set<string>
  ): boolean {
    visited.add(node);
    recursionStack.add(node);

    const dependencies = this.graph.get(node) || new Set();

    for (const dep of dependencies) {
      if (!visited.has(dep)) {
        if (this.detectCycle(dep, visited, recursionStack)) {
          return true;
        }
      } else if (recursionStack.has(dep)) {
        return true;
      }
    }

    recursionStack.delete(node);
    return false;
  }

  getExecutionOrder(): string[] {
    const result: string[] = [];
    const visited = new Set<string>();

    const visit = (node: string) => {
      if (visited.has(node)) return;
      visited.add(node);

      const deps = this.graph.get(node) || new Set();
      for (const dep of deps) {
        visit(dep);
      }

      result.push(node);
    };

    for (const node of this.graph.keys()) {
      visit(node);
    }

    return result;
  }
}
```

---

### Problem: Flaky Tests

**Symptoms:**
- Tests pass/fail randomly
- Different results in CI vs local
- Timing-dependent failures

**Solutions:**

```typescript
// Solution 1: Proper async waiting
// BAD: Arbitrary timeout
await new Promise(resolve => setTimeout(resolve, 1000));

// GOOD: Wait for condition
async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error('Condition not met within timeout');
}

// Usage
await waitForCondition(
  () => document.querySelector('.loaded') !== null
);

// Solution 2: Mock time-dependent code
class TestableService {
  constructor(private clock: Clock = new SystemClock()) {}

  async processWithDelay(): Promise<void> {
    const startTime = this.clock.now();
    await this.clock.sleep(1000);
    // Process...
  }
}

// In tests
const mockClock = new MockClock();
const service = new TestableService(mockClock);
mockClock.advance(1000); // Instant advance

// Solution 3: Isolate test data
beforeEach(async () => {
  // Create unique test data for each test
  const testId = uuid();
  const testData = {
    workflow_id: `test-workflow-${testId}`,
    user_id: `test-user-${testId}`
  };

  // Clean up after test
  afterEach(async () => {
    await db.workflow.deleteMany({
      where: { workflow_id: testData.workflow_id }
    });
  });
});
```

---

### Problem: LLM Response Parsing

**Symptoms:**
- Invalid JSON from LLM
- Unexpected response format
- Missing required fields

**Solutions:**

```typescript
// Solution 1: Robust parsing with fallbacks
async function parseLLMResponse(response: string): Promise<any> {
  // Try JSON first
  try {
    return JSON.parse(response);
  } catch {}

  // Try to extract JSON from markdown
  const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch {}
  }

  // Try to extract JSON from anywhere in text
  const jsonRegex = /\{[\s\S]*\}/;
  const match = response.match(jsonRegex);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {}
  }

  // Fallback: parse as structured text
  return parseStructuredText(response);
}

// Solution 2: Retry with clarification
async function getLLMStructuredResponse<T>(
  prompt: string,
  schema: z.ZodSchema<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    const response = await llm.complete(prompt);

    try {
      const parsed = parseLLMResponse(response);
      return schema.parse(parsed);
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      // Add clarification to prompt
      prompt = `
        ${prompt}

        Previous response was invalid: ${error.message}
        Please respond with valid JSON matching this structure:
        ${JSON.stringify(schema._def, null, 2)}
      `;
    }
  }

  throw new Error('Failed to get valid response from LLM');
}

// Solution 3: Use structured output format
const STRUCTURED_PROMPT = `
  Respond in the following JSON format only:
  {
    "action": "create" | "update" | "delete",
    "target": string,
    "parameters": object,
    "reasoning": string
  }

  Do not include any other text or formatting.
`;
```

---

### Problem: Git Merge Conflicts

**Symptoms:**
- Merge conflicts during integration
- Conflicting changes from multiple agents
- Lost changes

**Solutions:**

```typescript
// Solution 1: Automatic conflict resolution
async function autoResolveConflicts(
  baseBranch: string,
  featureBranch: string
): Promise<void> {
  try {
    await git.merge([baseBranch]);
  } catch (error) {
    if (error.message.includes('CONFLICT')) {
      const conflicts = await git.diff(['--name-only', '--diff-filter=U']);

      for (const file of conflicts.split('\n')) {
        if (file) {
          // Strategy: prefer feature branch for app code
          if (file.startsWith('src/')) {
            await git.checkout(['--ours', file]);
          }
          // Strategy: prefer base branch for config
          else if (file.includes('config')) {
            await git.checkout(['--theirs', file]);
          }
          // Strategy: manual merge for critical files
          else {
            await manualMerge(file);
          }

          await git.add([file]);
        }
      }

      await git.commit(['Resolved conflicts automatically']);
    } else {
      throw error;
    }
  }
}

// Solution 2: Branch isolation strategy
class BranchManager {
  async createFeatureBranch(feature: string): Promise<string> {
    const timestamp = Date.now();
    const branchName = `feature/${feature}-${timestamp}`;

    await git.checkoutBranch(branchName, 'main');
    return branchName;
  }

  async integrateBranch(branchName: string): Promise<void> {
    // Create integration branch
    const integrationBranch = `integration/${Date.now()}`;
    await git.checkoutBranch(integrationBranch, 'main');

    // Merge feature
    await git.merge([branchName, '--no-ff']);

    // Run tests
    const testsPass = await this.runTests();

    if (testsPass) {
      // Merge to main
      await git.checkout('main');
      await git.merge([integrationBranch, '--no-ff']);
    } else {
      // Cleanup
      await git.checkout('main');
      await git.branch(['-D', integrationBranch]);
      throw new Error('Tests failed after merge');
    }
  }
}
```

---

## Quick Reference Solutions

| Problem | Quick Solution |
|---------|---------------|
| Undefined variable | Check null/undefined before use |
| Type error | Add type guards and validation |
| Async not awaited | Use ESLint rule `require-await` |
| Memory leak | Clear intervals/listeners in cleanup |
| Slow queries | Add indexes, use pagination |
| Docker build fails | Check .dockerignore, multi-stage builds |
| CORS errors | Configure proper CORS headers |
| WebSocket disconnects | Implement reconnection logic |
| File not found | Use absolute paths, check permissions |
| Port already in use | Use dynamic ports, check for zombies |
| SSL certificate errors | Update CA certificates, allow in dev |
| JSON parse errors | Wrap in try-catch, validate schema |

---

## Important Notes for AI Agents

### When encountering problems:

1. **Check this document first** - Many problems are already solved
2. **Use the provided solutions** - Don't reinvent the wheel
3. **Adapt solutions to context** - Modify as needed for specific case
4. **Test solutions thoroughly** - Ensure they work in your scenario
5. **Document new solutions** - Add to this document for future use
6. **Share learnings** - Update patterns when you find better ways