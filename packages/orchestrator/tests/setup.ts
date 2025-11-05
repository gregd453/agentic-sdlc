import { vi } from 'vitest';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.LOG_LEVEL = 'error'; // Reduce noise during tests

// Mock external dependencies
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    $transaction: vi.fn().mockImplementation((cb) => cb({
      workflow: {
        create: vi.fn().mockResolvedValue({
          id: 'test-workflow-id',
          type: 'app',
          name: 'Test Workflow',
          status: 'initiated',
          current_stage: 'initialization',
          progress: 0,
          created_at: new Date(),
          updated_at: new Date()
        }),
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue({}),
        delete: vi.fn().mockResolvedValue({})
      },
      workflowEvent: {
        create: vi.fn().mockResolvedValue({})
      },
      workflowStage: {
        createMany: vi.fn().mockResolvedValue({})
      }
    })),
    workflow: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    workflowEvent: {
      create: vi.fn()
    },
    workflowStage: {
      createMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn()
    },
    agentTask: {
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn()
    },
    $on: vi.fn()
  }))
}));

// Mock Redis
vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => ({
    xadd: vi.fn().mockResolvedValue('1-0'),
    publish: vi.fn().mockResolvedValue(1),
    subscribe: vi.fn().mockResolvedValue('OK'),
    unsubscribe: vi.fn().mockResolvedValue('OK'),
    xgroup: vi.fn().mockResolvedValue('OK'),
    xreadgroup: vi.fn().mockResolvedValue(null),
    xack: vi.fn().mockResolvedValue(1),
    quit: vi.fn().mockResolvedValue('OK'),
    on: vi.fn()
  }))
}));

// Suppress console output during tests
global.console = {
  ...console,
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn()
};