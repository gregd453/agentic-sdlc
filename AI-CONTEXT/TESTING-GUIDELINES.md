# TESTING GUIDELINES FOR AI AGENTS

**Purpose:** Comprehensive testing requirements and patterns for all code

---

## Testing Requirements by Component

### Coverage Requirements

| Component Type | Unit Test | Integration | E2E | Coverage |
|---------------|-----------|-------------|-----|----------|
| Agents | Required | Required | Required | 90% |
| API Endpoints | Required | Required | Optional | 85% |
| Services | Required | Required | N/A | 90% |
| Utilities | Required | N/A | N/A | 95% |
| Database | Required | Required | N/A | 80% |
| Pipeline | Required | Required | Required | 85% |

---

## Unit Test Patterns

### Agent Unit Tests

```typescript
// Test file: packages/agents/scaffold-agent/tests/scaffold.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ScaffoldAgent } from '../src/scaffold-agent';
import { mockTask, mockLLMResponse } from './fixtures';

describe('ScaffoldAgent', () => {
  let agent: ScaffoldAgent;
  let mockFileSystem: any;
  let mockLLM: any;

  beforeEach(() => {
    // Setup mocks
    mockFileSystem = {
      mkdir: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
      readFile: vi.fn().mockResolvedValue('{}')
    };

    mockLLM = {
      complete: vi.fn().mockResolvedValue(mockLLMResponse)
    };

    agent = new ScaffoldAgent({
      fileSystem: mockFileSystem,
      llm: mockLLM
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('execute', () => {
    it('should create project structure for valid task', async () => {
      // Arrange
      const task = mockTask({
        type: 'scaffold',
        payload: {
          action: 'create_app',
          parameters: {
            name: 'test-app',
            template: 'react'
          }
        }
      });

      // Act
      const result = await agent.execute(task);

      // Assert
      expect(result.status).toBe('success');
      expect(mockFileSystem.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('test-app'),
        expect.any(Object)
      );
      expect(mockFileSystem.writeFile).toHaveBeenCalledTimes(5); // package.json, index, etc
      expect(result.result.artifacts).toHaveLength(5);
    });

    it('should handle missing template gracefully', async () => {
      // Arrange
      const task = mockTask({
        payload: {
          parameters: { template: 'non-existent' }
        }
      });

      // Act
      const result = await agent.execute(task);

      // Assert
      expect(result.status).toBe('failure');
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'TEMPLATE_NOT_FOUND'
        })
      );
    });

    it('should validate input parameters', async () => {
      // Arrange
      const task = mockTask({
        payload: {} // Missing required fields
      });

      // Act & Assert
      await expect(agent.execute(task)).rejects.toThrow('Validation failed');
    });

    it('should timeout long-running operations', async () => {
      // Arrange
      mockLLM.complete.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 10000))
      );

      const task = mockTask({
        constraints: { timeout_ms: 100 }
      });

      // Act & Assert
      await expect(agent.execute(task)).rejects.toThrow('Operation timeout');
    });
  });

  describe('generateProjectStructure', () => {
    it('should use LLM to generate intelligent structure', async () => {
      // Arrange
      const requirements = 'E-commerce platform with user auth';

      // Act
      await agent.generateProjectStructure(requirements);

      // Assert
      expect(mockLLM.complete).toHaveBeenCalledWith(
        expect.stringContaining('Generate project structure')
      );
    });
  });
});
```

### Service Unit Tests

```typescript
describe('WorkflowService', () => {
  let service: WorkflowService;
  let mockRepository: any;
  let mockEventBus: any;

  beforeEach(() => {
    mockRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      update: vi.fn()
    };

    mockEventBus = {
      publish: vi.fn()
    };

    service = new WorkflowService(mockRepository, mockEventBus);
  });

  describe('createWorkflow', () => {
    it('should create workflow and emit event', async () => {
      // Arrange
      const input = {
        type: 'app',
        name: 'test-app',
        description: 'Test application'
      };

      const expectedWorkflow = {
        id: 'wf-123',
        ...input,
        status: 'initiated'
      };

      mockRepository.create.mockResolvedValue(expectedWorkflow);

      // Act
      const result = await service.createWorkflow(input);

      // Assert
      expect(result).toEqual(expectedWorkflow);
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'workflow.created',
          data: expectedWorkflow
        })
      );
    });

    it('should handle database errors', async () => {
      // Arrange
      mockRepository.create.mockRejectedValue(new Error('DB Error'));

      // Act & Assert
      await expect(service.createWorkflow({})).rejects.toThrow('DB Error');
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });
});
```

---

## Integration Test Patterns

### Agent Integration Tests

```typescript
// Test file: tests/integration/scaffold-integration.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ScaffoldAgent } from '@agents/scaffold-agent';
import { Orchestrator } from '@orchestrator';
import { startTestDatabase, stopTestDatabase } from '../helpers/database';
import { startTestRedis, stopTestRedis } from '../helpers/redis';

describe('Scaffold Agent Integration', () => {
  let orchestrator: Orchestrator;
  let agent: ScaffoldAgent;

  beforeAll(async () => {
    // Start test infrastructure
    await startTestDatabase();
    await startTestRedis();

    // Initialize components
    orchestrator = new Orchestrator({
      database: process.env.TEST_DATABASE_URL,
      redis: process.env.TEST_REDIS_URL
    });

    agent = new ScaffoldAgent();
    await orchestrator.registerAgent(agent);
  });

  afterAll(async () => {
    await stopTestDatabase();
    await stopTestRedis();
  });

  it('should complete scaffold workflow end-to-end', async () => {
    // Arrange
    const workflow = await orchestrator.createWorkflow({
      type: 'app',
      name: 'integration-test-app'
    });

    // Act
    await orchestrator.startWorkflow(workflow.id);

    // Wait for completion
    const result = await orchestrator.waitForCompletion(workflow.id, {
      timeout: 30000
    });

    // Assert
    expect(result.status).toBe('completed');
    expect(result.stages.scaffold.status).toBe('success');

    // Verify files were created
    const projectPath = `./output/${workflow.name}`;
    expect(fs.existsSync(projectPath)).toBe(true);
    expect(fs.existsSync(`${projectPath}/package.json`)).toBe(true);
  });

  it('should handle agent failures gracefully', async () => {
    // Arrange - create workflow with invalid parameters
    const workflow = await orchestrator.createWorkflow({
      type: 'app',
      name: '' // Invalid name
    });

    // Act
    await orchestrator.startWorkflow(workflow.id);
    const result = await orchestrator.waitForCompletion(workflow.id);

    // Assert
    expect(result.status).toBe('failed');
    expect(result.stages.scaffold.error).toBeDefined();
  });
});
```

### API Integration Tests

```typescript
describe('API Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({
      database: process.env.TEST_DATABASE_URL
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/workflows', () => {
    it('should create workflow and return 201', async () => {
      // Arrange
      const payload = {
        type: 'app',
        name: 'api-test-app',
        description: 'Test via API'
      };

      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/workflows',
        payload
      });

      // Assert
      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.workflow_id).toBeDefined();
      expect(body.status).toBe('initiated');
    });

    it('should validate input and return 400', async () => {
      // Arrange
      const payload = {
        type: 'invalid-type',
        name: ''
      };

      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/workflows',
        payload
      });

      // Assert
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Validation failed');
      expect(body.details).toBeInstanceOf(Array);
    });
  });
});
```

---

## E2E Test Patterns

### Full Workflow E2E Test

```typescript
// Test file: tests/e2e/full-workflow.e2e.ts

import { test, expect } from '@playwright/test';
import { createTestWorkflow, waitForWorkflow } from './helpers';

test.describe('Complete Workflow E2E', () => {
  test('should complete app creation from UI to deployment', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('http://localhost:3000');

    // Create new workflow
    await page.click('button:text("New Workflow")');
    await page.selectOption('#workflow-type', 'app');
    await page.fill('#app-name', 'e2e-test-app');
    await page.fill('#description', 'E2E test application');
    await page.click('button:text("Create")');

    // Wait for workflow to start
    await expect(page.locator('.workflow-status')).toContainText('Started', {
      timeout: 10000
    });

    // Monitor progress
    await expect(page.locator('.stage-scaffold')).toHaveClass(/completed/, {
      timeout: 60000
    });

    await expect(page.locator('.stage-validation')).toHaveClass(/completed/, {
      timeout: 30000
    });

    await expect(page.locator('.stage-testing')).toHaveClass(/completed/, {
      timeout: 30000
    });

    // Verify deployment
    await expect(page.locator('.deployment-url')).toBeVisible({
      timeout: 120000
    });

    const deploymentUrl = await page.locator('.deployment-url').textContent();
    expect(deploymentUrl).toMatch(/^https:\/\//);

    // Test deployed app
    const appPage = await context.newPage();
    await appPage.goto(deploymentUrl!);
    await expect(appPage.locator('h1')).toContainText('e2e-test-app');
  });

  test('should handle errors and allow retry', async ({ page }) => {
    // Create workflow with intentional failure
    const workflow = await createTestWorkflow({
      fail_at_stage: 'validation'
    });

    await page.goto(`http://localhost:3000/workflows/${workflow.id}`);

    // Wait for failure
    await expect(page.locator('.stage-validation')).toHaveClass(/failed/, {
      timeout: 30000
    });

    // Retry failed stage
    await page.click('button:text("Retry Stage")');

    // Should succeed on retry
    await expect(page.locator('.stage-validation')).toHaveClass(/completed/, {
      timeout: 30000
    });
  });
});
```

### Sprint E2E Test

```typescript
test.describe('Sprint Automation E2E', () => {
  test('sprint should complete with 100% tests passing', async ({ page }) => {
    // Start sprint
    await page.goto('http://localhost:3000/sprints');
    await page.click('button:text("Start Sprint")');

    // Select backlog items
    await page.check('#item-TASK-001');
    await page.check('#item-TASK-002');
    await page.check('#item-TASK-003');
    await page.click('button:text("Confirm Sprint")');

    // Monitor daily progress
    for (let day = 1; day <= 10; day++) {
      await page.goto(`http://localhost:3000/sprints/current/day/${day}`);

      // Verify daily standup
      await expect(page.locator('.standup-complete')).toBeVisible({
        timeout: 10000
      });

      // Verify daily build
      if (day > 1) {
        await expect(page.locator('.daily-build-status')).toContainText('Success');
      }
    }

    // Verify sprint completion
    await page.goto('http://localhost:3000/sprints/current');
    await expect(page.locator('.sprint-status')).toContainText('Ready for Review');

    // Verify 100% test pass rate
    await expect(page.locator('.test-pass-rate')).toContainText('100%');
    await expect(page.locator('.e2e-pass-rate')).toContainText('100%');
  });
});
```

---

## Test Data Management

### Fixtures

```typescript
// tests/fixtures/tasks.ts
export const mockTask = (overrides = {}) => ({
  task_id: 'task-123',
  workflow_id: 'wf-123',
  agent_type: 'scaffold',
  priority: 'normal',
  payload: {
    action: 'create',
    parameters: {}
  },
  constraints: {
    timeout_ms: 300000
  },
  metadata: {
    created_at: new Date().toISOString(),
    created_by: 'test',
    trace_id: 'trace-123'
  },
  ...overrides
});

// tests/fixtures/workflows.ts
export const mockWorkflow = (overrides = {}) => ({
  id: 'wf-123',
  type: 'app',
  name: 'test-app',
  status: 'initiated',
  created_at: new Date().toISOString(),
  ...overrides
});
```

### Test Helpers

```typescript
// tests/helpers/database.ts
import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;

export async function startTestDatabase() {
  // Use test database
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5433/test_db';

  prisma = new PrismaClient();

  // Run migrations
  await prisma.$executeRaw`DROP SCHEMA IF EXISTS public CASCADE`;
  await prisma.$executeRaw`CREATE SCHEMA public`;

  // Apply migrations
  const { exec } = require('child_process');
  await new Promise((resolve, reject) => {
    exec('npx prisma migrate deploy', (error: any) => {
      if (error) reject(error);
      else resolve(true);
    });
  });
}

export async function cleanDatabase() {
  // Clean all tables
  await prisma.workflow.deleteMany();
  await prisma.task.deleteMany();
  await prisma.event.deleteMany();
}

export async function stopTestDatabase() {
  await prisma.$disconnect();
}
```

---

## Performance Testing

### Load Test Example

```typescript
// tests/performance/load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up
    { duration: '1m', target: 10 },   // Stay at 10 users
    { duration: '30s', target: 50 },  // Ramp to 50
    { duration: '2m', target: 50 },   // Stay at 50
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.1'],    // Error rate under 10%
  },
};

export default function () {
  // Create workflow
  const createResponse = http.post(
    'http://localhost:3000/api/v1/workflows',
    JSON.stringify({
      type: 'app',
      name: `load-test-${Date.now()}`,
      description: 'Load test workflow'
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  check(createResponse, {
    'workflow created': (r) => r.status === 201,
    'has workflow_id': (r) => JSON.parse(r.body).workflow_id !== undefined,
  });

  if (createResponse.status === 201) {
    const workflowId = JSON.parse(createResponse.body).workflow_id;

    // Check status
    const statusResponse = http.get(
      `http://localhost:3000/api/v1/workflows/${workflowId}`
    );

    check(statusResponse, {
      'status retrieved': (r) => r.status === 200,
    });
  }

  sleep(1);
}
```

---

## Test Execution Commands

```bash
# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# All tests with coverage
npm run test:all

# Watch mode for development
npm run test:watch

# Performance tests
npm run test:perf

# Specific test file
npm run test -- scaffold.test.ts

# With coverage report
npm run test:coverage
```

---

## Test Configuration

### Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '*.config.ts',
        '**/types.ts'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    },
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000
  }
});
```

---

## Important Testing Rules for AI Agents

### MUST DO:
1. ✅ Write tests BEFORE implementation (TDD)
2. ✅ Test both success AND failure paths
3. ✅ Mock external dependencies
4. ✅ Clean up after tests (databases, files)
5. ✅ Use descriptive test names
6. ✅ Group related tests with describe blocks
7. ✅ Assert on specific values, not just existence
8. ✅ Test edge cases and boundaries

### MUST NOT DO:
1. ❌ Use real API keys in tests
2. ❌ Depend on test execution order
3. ❌ Leave console.log in tests
4. ❌ Use arbitrary timeouts (use proper waits)
5. ❌ Test implementation details
6. ❌ Skip error case testing
7. ❌ Hardcode test data
8. ❌ Share state between tests