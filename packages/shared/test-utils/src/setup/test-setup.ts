import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { createRedisMock, type RedisMock } from '../mocks/redis.mock';
import { createAnthropicMock, type AnthropicMock } from '../mocks/anthropic.mock';

/**
 * Test setup utilities for agent testing
 */

export interface TestContext {
  redis: RedisMock;
  anthropic: AnthropicMock;
  cleanup: () => Promise<void>;
}

export interface SetupOptions {
  mockRedis?: boolean;
  mockAnthropic?: boolean;
  clearMocks?: boolean;
  useFakeTimers?: boolean;
  timeout?: number;
}

/**
 * Setup test environment for agent testing
 */
export function setupAgentTests(options: SetupOptions = {}): TestContext {
  const {
    mockRedis = true,
    mockAnthropic = true,
    clearMocks = true,
    useFakeTimers = true,
    timeout = 10000
  } = options;

  let redis: RedisMock;
  let anthropic: AnthropicMock;

  // Setup before all tests
  beforeAll(() => {
    if (useFakeTimers) {
      vi.useFakeTimers();
    }

    // Set test timeout
    vi.setConfig({ testTimeout: timeout });
  });

  // Setup before each test
  beforeEach(() => {
    if (mockRedis) {
      redis = createRedisMock();
    }

    if (mockAnthropic) {
      anthropic = createAnthropicMock();
    }

    if (clearMocks) {
      vi.clearAllMocks();
    }
  });

  // Cleanup after each test
  afterEach(() => {
    if (clearMocks) {
      vi.clearAllMocks();
      vi.clearAllTimers();
    }

    if (redis) {
      redis.clearAll();
    }

    if (anthropic) {
      anthropic.reset();
    }
  });

  // Cleanup after all tests
  afterAll(() => {
    if (useFakeTimers) {
      vi.useRealTimers();
    }

    vi.restoreAllMocks();
  });

  const cleanup = async () => {
    if (redis) {
      await redis.quit();
    }
    vi.clearAllMocks();
    vi.clearAllTimers();
  };

  return {
    get redis() {
      if (!redis) {
        throw new Error('Redis mock not initialized. Ensure mockRedis is true.');
      }
      return redis;
    },
    get anthropic() {
      if (!anthropic) {
        throw new Error('Anthropic mock not initialized. Ensure mockAnthropic is true.');
      }
      return anthropic;
    },
    cleanup
  };
}

/**
 * Error boundary for test execution with guaranteed cleanup
 */
export async function withTestContext<T>(
  fn: (ctx: TestContext) => Promise<T>,
  options: SetupOptions = {}
): Promise<T> {
  const redis = createRedisMock();
  const anthropic = createAnthropicMock();

  const ctx: TestContext = {
    redis,
    anthropic,
    cleanup: async () => {
      await redis.quit();
      anthropic.reset();
    }
  };

  try {
    return await fn(ctx);
  } finally {
    await ctx.cleanup();
  }
}

/**
 * Helper to wait for async operations
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number; message?: string } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100, message = 'Condition not met' } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const result = await condition();
    if (result) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for condition: ${message}`);
}

/**
 * Helper to advance timers and flush promises
 */
export async function advanceTimersAndFlush(ms: number): Promise<void> {
  vi.advanceTimersByTime(ms);
  await flushPromises();
}

/**
 * Helper to flush all pending promises
 */
export async function flushPromises(): Promise<void> {
  await new Promise(resolve => setImmediate(resolve));
}

/**
 * Mock environment variables for testing
 */
export function mockEnvironment(vars: Record<string, string>): () => void {
  const original = { ...process.env };

  Object.assign(process.env, vars);

  return () => {
    process.env = original;
  };
}

/**
 * Create a test logger that captures log output
 */
export function createTestLogger() {
  const logs: Array<{ level: string; message: string; meta?: any }> = [];

  return {
    info: vi.fn((message: string, meta?: any) => {
      logs.push({ level: 'info', message, meta });
    }),
    error: vi.fn((message: string, meta?: any) => {
      logs.push({ level: 'error', message, meta });
    }),
    warn: vi.fn((message: string, meta?: any) => {
      logs.push({ level: 'warn', message, meta });
    }),
    debug: vi.fn((message: string, meta?: any) => {
      logs.push({ level: 'debug', message, meta });
    }),
    getLogs: () => [...logs],
    clearLogs: () => {
      logs.length = 0;
    },
    hasLog: (level: string, message: string) => {
      return logs.some(log => log.level === level && log.message.includes(message));
    }
  };
}