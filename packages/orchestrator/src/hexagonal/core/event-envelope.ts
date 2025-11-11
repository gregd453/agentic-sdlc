/**
 * Event Envelope
 *
 * Stable, idempotent envelope for all messages flowing through the system.
 * Supports correlation tracking, deduplication, and multi-tenant isolation.
 *
 * Session #37+: Replaces ad-hoc TaskAssignment wrappers with standardized envelope.
 */

import { randomUUID } from 'crypto';

/**
 * Universal envelope for all events/messages
 */
export type Envelope<T = any> = {
  /** Unique message ID for deduplication */
  id: string;

  /** Message type (e.g., "phase.plan.in", "task.scaffold") */
  type: string;

  /** ISO 8601 timestamp */
  ts: string;

  /** Correlation ID for tracing across phases */
  corrId?: string;

  /** Tenant ID for multi-tenancy */
  tenantId?: string;

  /** Actual message payload */
  payload: T;

  /** Optional retry count */
  attempts?: number;

  /** Optional error from previous attempt */
  lastError?: string;
};

/**
 * Create a new envelope
 * @param type - Message type identifier
 * @param payload - Message data
 * @param corrId - Optional correlation ID (defaults to new UUID)
 * @param tenantId - Optional tenant ID
 * @returns Envelope ready for transmission
 */
export function createEnvelope<T = any>(
  type: string,
  payload: T,
  corrId?: string,
  tenantId?: string
): Envelope<T> {
  return {
    id: randomUUID(),
    type,
    ts: new Date().toISOString(),
    corrId: corrId ?? randomUUID(),
    tenantId,
    payload,
    attempts: 0,
  };
}

/**
 * Create a retry envelope (preserves corrId, increments attempts)
 */
export function retryEnvelope<T = any>(
  env: Envelope<T>,
  lastError?: string
): Envelope<T> {
  return {
    ...env,
    id: randomUUID(), // New ID for new attempt
    ts: new Date().toISOString(),
    attempts: (env.attempts ?? 0) + 1,
    lastError,
  };
}

/**
 * Type guard for envelope
 */
export function isEnvelope(obj: any): obj is Envelope {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.type === 'string' &&
    typeof obj.ts === 'string' &&
    obj.payload !== undefined
  );
}
