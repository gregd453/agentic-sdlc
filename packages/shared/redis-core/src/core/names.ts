/**
 * Consistent Redis Key Naming
 *
 * Provides single-source-of-truth for Redis key patterns across modules.
 * Supports tenancy for multi-tenant deployments.
 */

/**
 * Create namespaced Redis key
 * @param base - Base key name (e.g., "tasks:pending")
 * @param tenant - Optional tenant ID for multi-tenancy
 * @returns Namespaced key (e.g., "tenant-123:tasks:pending")
 */
export const ns = (base: string, tenant?: string): string =>
  tenant ? `${tenant}:${base}` : base;

/**
 * Common Redis key patterns
 */
export const Keys = {
  // Streams
  stream: (name: string, tenant?: string) => ns(`stream:${name}`, tenant),
  streamDLQ: (name: string, tenant?: string) => ns(`stream:${name}:dlq`, tenant),

  // Consumer groups
  group: (stream: string, group: string, tenant?: string) =>
    ns(`group:${stream}:${group}`, tenant),

  // Locks
  lock: (resource: string, tenant?: string) => ns(`lock:${resource}:holder`, tenant),
  lockToken: (resource: string, tenant?: string) => ns(`lock:${resource}:token`, tenant),

  // KV / idempotency
  kv: (key: string, tenant?: string) => ns(`kv:${key}`, tenant),
  once: (key: string, tenant?: string) => ns(`once:${key}`, tenant),

  // Health / tracking
  health: (component: string, tenant?: string) => ns(`health:${component}`, tenant),
  seen: (eventId: string, tenant?: string) => ns(`seen:${eventId}`, tenant),

  // Pub/Sub topics
  topic: (name: string, tenant?: string) => ns(`topic:${name}`, tenant),
};
