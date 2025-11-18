import { vi } from 'vitest';

/**
 * Redis mock for testing agent communication
 */

type MessageHandler = (message: string) => void;
type GlobalMessageHandler = (channel: string, message: string) => void;

export interface RedisMock {
  subscribe: any;
  unsubscribe: any;
  publish: any;
  on: any;
  off: any;
  disconnect: any;
  quit: any;
  get: any;
  set: any;
  del: any;
  exists: any;
  expire: any;
  ttl: any;
  // Test helpers
  simulateMessage: (channel: string, message: string) => void;
  simulateError: (error: Error) => void;
  getSubscriptions: () => string[];
  getPublishedMessages: () => Array<{ channel: string; message: string }>;
  clearAll: () => void;
  isConnected: () => boolean;
}

export function createRedisMock(): RedisMock {
  const subscribedChannels = new Map<string, Set<MessageHandler>>();
  const messageHandlers = new Set<GlobalMessageHandler>();
  const errorHandlers = new Set<(error: Error) => void>();
  const publishedMessages: Array<{ channel: string; message: string }> = [];
  const storage = new Map<string, string>();
  const expirations = new Map<string, number>();
  let connected = true;

  const mock: RedisMock = {
    subscribe: vi.fn(async (channels: string | string[]) => {
      if (!connected) throw new Error('Redis connection closed');

      const channelArray = Array.isArray(channels) ? channels : [channels];
      channelArray.forEach(channel => {
        if (!subscribedChannels.has(channel)) {
          subscribedChannels.set(channel, new Set());
        }
      });
      return channelArray.length;
    }),

    unsubscribe: vi.fn(async (channels?: string | string[]) => {
      if (!connected) throw new Error('Redis connection closed');

      if (!channels) {
        subscribedChannels.clear();
        return 0;
      }

      const channelArray = Array.isArray(channels) ? channels : [channels];
      channelArray.forEach(channel => {
        subscribedChannels.delete(channel);
      });
      return channelArray.length;
    }),

    publish: vi.fn(async (channel: string, message: string) => {
      if (!connected) throw new Error('Redis connection closed');

      publishedMessages.push({ channel, message });

      // Simulate message delivery to subscribers
      const handlers = subscribedChannels.get(channel);
      if (handlers) {
        handlers.forEach(handler => {
          // Simulate async delivery
          setTimeout(() => handler(message), 0);
        });
      }

      // Also notify global message handlers
      messageHandlers.forEach(handler => {
        setTimeout(() => handler(channel, message), 0);
      });

      return handlers ? handlers.size : 0;
    }),

    on: vi.fn((event: string, handler: any) => {
      if (event === 'message') {
        messageHandlers.add(handler);
      } else if (event === LOG_LEVEL.ERROR) {
        errorHandlers.add(handler);
      } else if (event === 'messageBuffer') {
        // For compatibility with real Redis client
        messageHandlers.add((channel: string, message: string) => {
          handler(Buffer.from(channel), Buffer.from(message));
        });
      }
      return mock;
    }),

    off: vi.fn((event: string, handler: any) => {
      if (event === 'message') {
        messageHandlers.delete(handler);
      } else if (event === LOG_LEVEL.ERROR) {
        errorHandlers.delete(handler);
      }
      return mock;
    }),

    disconnect: vi.fn(async () => {
      connected = false;
      subscribedChannels.clear();
      messageHandlers.clear();
      errorHandlers.clear();
    }),

    quit: vi.fn(async () => {
      connected = false;
      subscribedChannels.clear();
      messageHandlers.clear();
      errorHandlers.clear();
      storage.clear();
      expirations.clear();
    }),

    get: vi.fn(async (key: string) => {
      if (!connected) throw new Error('Redis connection closed');

      // Check expiration
      const expiry = expirations.get(key);
      if (expiry && Date.now() > expiry) {
        storage.delete(key);
        expirations.delete(key);
        return null;
      }

      return storage.get(key) ?? null;
    }),

    set: vi.fn(async (key: string, value: string, options?: any) => {
      if (!connected) throw new Error('Redis connection closed');

      storage.set(key, value);

      // Handle expiration options
      if (options?.EX) {
        expirations.set(key, Date.now() + options.EX * 1000);
      } else if (options?.PX) {
        expirations.set(key, Date.now() + options.PX);
      }

      return 'OK';
    }),

    del: vi.fn(async (...keys: string[]) => {
      if (!connected) throw new Error('Redis connection closed');

      let deleted = 0;
      keys.forEach(key => {
        if (storage.has(key)) {
          storage.delete(key);
          expirations.delete(key);
          deleted++;
        }
      });
      return deleted;
    }),

    exists: vi.fn(async (...keys: string[]) => {
      if (!connected) throw new Error('Redis connection closed');

      return keys.filter(key => storage.has(key)).length;
    }),

    expire: vi.fn(async (key: string, seconds: number) => {
      if (!connected) throw new Error('Redis connection closed');

      if (storage.has(key)) {
        expirations.set(key, Date.now() + seconds * 1000);
        return 1;
      }
      return 0;
    }),

    ttl: vi.fn(async (key: string) => {
      if (!connected) throw new Error('Redis connection closed');

      const expiry = expirations.get(key);
      if (!expiry) return -1;

      const ttl = Math.floor((expiry - Date.now()) / 1000);
      return ttl > 0 ? ttl : -2;
    }),

    // Test helper methods
    simulateMessage: (channel: string, message: string) => {
      const handlers = subscribedChannels.get(channel);
      if (handlers) {
        handlers.forEach(handler => handler(message));
      }
      messageHandlers.forEach(handler => handler(channel, message));
    },

    simulateError: (error: Error) => {
      errorHandlers.forEach(handler => handler(error));
    },

    getSubscriptions: () => Array.from(subscribedChannels.keys()),

    getPublishedMessages: () => [...publishedMessages],

    clearAll: () => {
      subscribedChannels.clear();
      messageHandlers.clear();
      errorHandlers.clear();
      publishedMessages.length = 0;
      storage.clear();
      expirations.clear();
    },

    isConnected: () => connected,
  };

  return mock;
}

// Helper to create a mock Redis instance that can be used with vi.mock
export function createRedisConstructorMock() {
  return vi.fn(() => createRedisMock());
}