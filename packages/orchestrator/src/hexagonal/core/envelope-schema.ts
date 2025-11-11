/**
 * Redis Envelope Contract
 *
 * Zod-based schema validation, type guards, and auto-generation for all envelopes.
 * Ensures type safety and consistency across all Redis pub/sub and stream operations.
 *
 * Session #39: Envelope validation and contract enforcement
 */

import { z } from 'zod';
import { randomUUID } from 'crypto';

// ============================================================================
// ZODE SCHEMAS
// ============================================================================

/**
 * Metadata that travels with every envelope
 */
export const EnvelopeMetaSchema = z.object({
  attempts: z.number().int().min(0).default(0),
  lastError: z.string().optional(),
  retryAfter: z.number().int().min(0).optional(),
  version: z.number().int().min(1).default(1),
  custom: z.record(z.unknown()).optional(),
}).strict();

export type EnvelopeMeta = z.infer<typeof EnvelopeMetaSchema>;

/**
 * Base envelope type - generic over payload type T
 */
export const EnvelopeBaseSchema = z.object({
  id: z.string().uuid('Envelope ID must be UUID'),
  type: z.string().min(1, 'Type is required').regex(/^[a-z0-9.]+$/, 'Type must be lowercase with dots'),
  ts: z.string().datetime('Timestamp must be ISO 8601'),
  corrId: z.string().optional().describe('Correlation ID for tracing'),
  tenantId: z.string().optional().describe('Multi-tenant awareness'),
  source: z.string().optional().describe('Origin: agent, orchestrator, etc'),
  meta: EnvelopeMetaSchema.optional(),
}).strict();

/**
 * Full envelope schema (with generic payload)
 * Use .extend({ payload: ... }) to specialize
 */
export const EnvelopeSchema = EnvelopeBaseSchema.extend({
  payload: z.unknown(),
});

export type Envelope<T = unknown> = z.infer<typeof EnvelopeBaseSchema> & {
  payload: T;
};

// ============================================================================
// EVENT TYPE REGISTRY (Discriminated Union)
// ============================================================================

/**
 * All valid event types in the system
 * Use for routing, validation, and type-safe handler dispatch
 */
export enum EventType {
  // Plan phase
  PLAN_REQUEST = 'phase.plan.request',
  PLAN_RESULT = 'phase.plan.result',
  PLAN_ERROR = 'phase.plan.error',

  // Code phase
  CODE_REQUEST = 'phase.code.request',
  CODE_RESULT = 'phase.code.result',
  CODE_ERROR = 'phase.code.error',

  // Certify (validation) phase
  CERTIFY_REQUEST = 'phase.certify.request',
  CERTIFY_RESULT = 'phase.certify.result',
  CERTIFY_ERROR = 'phase.certify.error',

  // Deploy phase
  DEPLOY_REQUEST = 'phase.deploy.request',
  DEPLOY_RESULT = 'phase.deploy.result',
  DEPLOY_ERROR = 'phase.deploy.error',

  // Monitoring phase
  MONITOR_REQUEST = 'phase.monitor.request',
  MONITOR_RESULT = 'phase.monitor.result',
  MONITOR_ERROR = 'phase.monitor.error',

  // System events
  HEALTH_CHECK = 'system.health_check',
  SHUTDOWN = 'system.shutdown',
  DEAD_LETTER = 'system.dead_letter',
}

/**
 * Type map: EventType → Payload type
 * Use this for type-safe handler registration
 */
export interface EventPayloadMap {
  [EventType.PLAN_REQUEST]: { projectId: string; requirements: string };
  [EventType.PLAN_RESULT]: { projectId: string; plan: Record<string, unknown> };
  [EventType.PLAN_ERROR]: { projectId: string; error: string };

  [EventType.CODE_REQUEST]: { projectId: string; plan: Record<string, unknown> };
  [EventType.CODE_RESULT]: { projectId: string; code: string };
  [EventType.CODE_ERROR]: { projectId: string; error: string };

  [EventType.CERTIFY_REQUEST]: { projectId: string; code: string };
  [EventType.CERTIFY_RESULT]: { projectId: string; report: Record<string, unknown> };
  [EventType.CERTIFY_ERROR]: { projectId: string; error: string };

  [EventType.DEPLOY_REQUEST]: { projectId: string; artifacts: Record<string, unknown> };
  [EventType.DEPLOY_RESULT]: { projectId: string; deploymentUrl: string };
  [EventType.DEPLOY_ERROR]: { projectId: string; error: string };

  [EventType.MONITOR_REQUEST]: { projectId: string; deploymentUrl: string };
  [EventType.MONITOR_RESULT]: { projectId: string; status: string };
  [EventType.MONITOR_ERROR]: { projectId: string; error: string };

  [EventType.HEALTH_CHECK]: { service: string };
  [EventType.SHUTDOWN]: { reason: string };
  [EventType.DEAD_LETTER]: { originalId: string; error: string };
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create an envelope with auto-generated ID and timestamp
 */
export function createEnvelope<T extends EventType>(
  type: T,
  payload: EventPayloadMap[T],
  corrId?: string,
  tenantId?: string,
  source?: string
): Envelope<EventPayloadMap[T]> {
  const envelope: Envelope<EventPayloadMap[T]> = {
    id: randomUUID(),
    type,
    ts: new Date().toISOString(),
    payload,
    corrId,
    tenantId,
    source,
    meta: {
      attempts: 0,
      version: 1,
    },
  };

  // Validate before returning
  validateEnvelope(envelope);
  return envelope;
}

/**
 * Create a retry envelope with incremented attempt count
 */
export function retryEnvelope<T extends EventType>(
  original: Envelope<EventPayloadMap[T]>,
  error?: string
): Envelope<EventPayloadMap[T]> {
  const attempts = (original.meta?.attempts ?? 0) + 1;
  const envelope: Envelope<EventPayloadMap[T]> = {
    ...original,
    ts: new Date().toISOString(),
    meta: {
      ...original.meta,
      attempts,
      lastError: error,
      version: (original.meta?.version ?? 1) + 1,
    },
  };

  validateEnvelope(envelope);
  return envelope;
}

/**
 * Create a dead-letter envelope for failed processing
 */
export function createDeadLetterEnvelope(
  originalId: string,
  error: string,
  corrId?: string
): Envelope<EventPayloadMap[EventType.DEAD_LETTER]> {
  return createEnvelope(
    EventType.DEAD_LETTER,
    { originalId, error },
    corrId,
    undefined,
    'system'
  );
}

// ============================================================================
// VALIDATION & TYPE GUARDS
// ============================================================================

/**
 * Validate envelope structure and throw on error
 */
export function validateEnvelope(value: unknown): asserts value is Envelope {
  try {
    EnvelopeSchema.parse(value);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid envelope: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Parse and validate JSON string as envelope
 */
export function parseEnvelope(json: string): Envelope {
  try {
    const value = JSON.parse(json);
    validateEnvelope(value);
    return value;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Safely parse envelope with fallback
 */
export function tryParseEnvelope(json: string): Envelope | null {
  try {
    return parseEnvelope(json);
  } catch {
    return null;
  }
}

/**
 * Type guard: Is this an envelope of a specific type?
 */
export function isEnvelopeOfType<T extends EventType>(
  value: unknown,
  type: T
): value is Envelope<EventPayloadMap[T]> {
  if (!isEnvelope(value)) return false;
  return value.type === type;
}

/**
 * Type guard: Is this a valid envelope?
 */
export function isEnvelope(value: unknown): value is Envelope {
  try {
    validateEnvelope(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Type guard: Is this a request type? (ends with .request)
 */
export function isRequestEnvelope(value: Envelope): boolean {
  return value.type.endsWith('.request');
}

/**
 * Type guard: Is this a result type? (ends with .result)
 */
export function isResultEnvelope(value: Envelope): boolean {
  return value.type.endsWith('.result');
}

/**
 * Type guard: Is this an error type? (ends with .error)
 */
export function isErrorEnvelope(value: Envelope): boolean {
  return value.type.endsWith('.error');
}

/**
 * Type guard: Is this a system event?
 */
export function isSystemEnvelope(value: Envelope): boolean {
  return value.type.startsWith('system.');
}

/**
 * Type guard: Has this envelope exhausted retries?
 */
export function hasExhaustedRetries(value: Envelope, maxRetries: number = 5): boolean {
  return (value.meta?.attempts ?? 0) >= maxRetries;
}

// ============================================================================
// TYPE-SAFE HANDLER REGISTRATION
// ============================================================================

/**
 * Type-safe handler function
 */
export type EnvelopeHandler<T extends EventType = EventType> = (
  env: Envelope<EventPayloadMap[T]>
) => Promise<void>;

/**
 * Type-safe handler registry
 */
export class EnvelopeHandlerRegistry {
  private handlers = new Map<EventType, Set<EnvelopeHandler>>();

  /**
   * Register handler for specific event type
   */
  register<T extends EventType>(
    type: T,
    handler: (env: Envelope<EventPayloadMap[T]>) => Promise<void>
  ): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler as EnvelopeHandler);
  }

  /**
   * Dispatch envelope to all registered handlers for its type
   */
  async dispatch(env: any): Promise<void> {
    const handlers = this.handlers.get(env.type as EventType);
    if (!handlers || handlers.size === 0) {
      throw new Error(`No handlers registered for event type: ${env.type}`);
    }

    await Promise.all(Array.from(handlers).map((h) => h(env)));
  }

  /**
   * Check if handlers exist for type
   */
  has(type: EventType): boolean {
    return (this.handlers.get(type)?.size ?? 0) > 0;
  }

  /**
   * Get handler count for type
   */
  count(type: EventType): number {
    return this.handlers.get(type)?.size ?? 0;
  }

  /**
   * Clear all handlers
   */
  clear(): void {
    this.handlers.clear();
  }
}

// ============================================================================
// SERIALIZATION HELPERS
// ============================================================================

/**
 * Serialize envelope to JSON string
 */
export function serializeEnvelope(env: Envelope): string {
  return JSON.stringify(env);
}

/**
 * Deserialize JSON string to envelope
 */
export function deserializeEnvelope(json: string): Envelope {
  return parseEnvelope(json);
}

/**
 * Create envelope snapshot (for logging, debugging)
 */
export function envelopeSnapshot(env: Envelope): Record<string, unknown> {
  return {
    id: env.id,
    type: env.type,
    ts: env.ts,
    corrId: env.corrId,
    tenantId: env.tenantId,
    source: env.source,
    attempts: env.meta?.attempts,
    payloadSize: JSON.stringify(env.payload).length,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Schemas
  EnvelopeSchema,
  EnvelopeMetaSchema,

  // Enums
  EventType,

  // Factory functions
  createEnvelope,
  retryEnvelope,
  createDeadLetterEnvelope,

  // Validation
  validateEnvelope,
  parseEnvelope,
  tryParseEnvelope,

  // Type guards
  isEnvelope,
  isEnvelopeOfType,
  isRequestEnvelope,
  isResultEnvelope,
  isErrorEnvelope,
  isSystemEnvelope,
  hasExhaustedRetries,

  // Handler registry
  EnvelopeHandlerRegistry,

  // Serialization
  serializeEnvelope,
  deserializeEnvelope,
  envelopeSnapshot,
};
