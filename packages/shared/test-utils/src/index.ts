/**
 * @agentic-sdlc/test-utils
 * Shared testing utilities for the Agentic SDLC platform
 */

// ===== Mock Exports =====
export { createRedisMock, createRedisConstructorMock, type RedisMock } from './mocks/redis.mock';
export {
  createAnthropicMock,
  createAnthropicConstructorMock,
  AnthropicMocks,
  type AnthropicMock,
  type AnthropicMockOptions,
  type AnthropicMessage
} from './mocks/anthropic.mock';

// ===== Factory Exports =====
export { ScaffoldFactory } from './factories/scaffold.factory';

// ===== Setup Utilities =====
export {
  setupAgentTests,
  withTestContext,
  waitFor,
  advanceTimersAndFlush,
  flushPromises,
  mockEnvironment,
  createTestLogger,
  type TestContext,
  type SetupOptions
} from './setup/test-setup';

// ===== Test Helpers =====
import { vi } from 'vitest';
import { createRedisMock } from './mocks/redis.mock';
import { createAnthropicMock } from './mocks/anthropic.mock';

/**
 * Quick setup for Redis mock in vi.mock
 */
export const mockRedisSetup = () => ({
  default: vi.fn(() => createRedisMock())
});

/**
 * Quick setup for Anthropic mock in vi.mock
 */
export const mockAnthropicSetup = () => ({
  default: vi.fn(() => createAnthropicMock())
});

/**
 * Standard mock setup for agent tests
 */
export function setupStandardMocks() {
  vi.mock('ioredis', () => mockRedisSetup());
  vi.mock('@anthropic-ai/sdk', () => mockAnthropicSetup());
}

// ===== Assertion Helpers =====

/**
 * Assert that a value matches a schema (using shared-types)
 */
export async function assertSchema(schema: any, value: unknown): Promise<void> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(`Schema validation failed: ${JSON.stringify(result.error.errors, null, 2)}`);
  }
}

/**
 * Assert that an async function throws
 */
export async function assertThrowsAsync(
  fn: () => Promise<any>,
  expectedError?: string | RegExp | Error
): Promise<void> {
  let thrownError: Error | null = null;

  try {
    await fn();
  } catch (error) {
    thrownError = error as Error;
  }

  if (!thrownError) {
    throw new Error('Expected function to throw, but it did not');
  }

  if (expectedError) {
    if (typeof expectedError === 'string') {
      if (!thrownError.message.includes(expectedError)) {
        throw new Error(
          `Expected error message to include "${expectedError}", but got: ${thrownError.message}`
        );
      }
    } else if (expectedError instanceof RegExp) {
      if (!expectedError.test(thrownError.message)) {
        throw new Error(
          `Expected error message to match ${expectedError}, but got: ${thrownError.message}`
        );
      }
    } else if (expectedError instanceof Error) {
      if (thrownError.message !== expectedError.message) {
        throw new Error(
          `Expected error message "${expectedError.message}", but got: ${thrownError.message}`
        );
      }
    }
  }
}

/**
 * Create a deferred promise for testing async flows
 */
export function createDeferred<T>() {
  let resolve: (value: T) => void;
  let reject: (reason?: any) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    resolve: resolve!,
    reject: reject!
  };
}

/**
 * Mock timer that can be manually advanced
 */
export class MockTimer {
  private time = 0;
  private timers: Array<{ time: number; callback: () => void }> = [];

  setTimeout(callback: () => void, delay: number): number {
    const id = this.timers.length;
    this.timers.push({ time: this.time + delay, callback });
    return id;
  }

  clearTimeout(id: number): void {
    delete this.timers[id];
  }

  advance(ms: number): void {
    this.time += ms;
    const toExecute = this.timers.filter(t => t && t.time <= this.time);
    toExecute.forEach(t => t.callback());
  }

  getTime(): number {
    return this.time;
  }

  reset(): void {
    this.time = 0;
    this.timers = [];
  }
}

// ===== Development Helpers =====
if (process.env.NODE_ENV === 'development') {
  console.log('🧪 @agentic-sdlc/test-utils loaded');
  console.log('📦 Available mocks: Redis, Anthropic');
  console.log('🏭 Available factories: Scaffold');
}