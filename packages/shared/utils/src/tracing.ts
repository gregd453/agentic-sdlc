import { randomBytes, randomUUID } from 'crypto';

/**
 * Distributed Tracing Utilities
 *
 * Provides standardized ID generation for distributed tracing across
 * HTTP, workflows, tasks, and agent executions.
 *
 * ID Formats:
 * - trace_id: UUID v4 (36 chars, e.g., "550e8400-e29b-41d4-a716-446655440000")
 * - span_id: 16-char hex (e.g., "a1b2c3d4e5f6g7h8")
 * - request_id: UUID v4 (same as trace_id format)
 *
 * @module tracing
 */

export type TraceId = string;  // UUID v4 format
export type SpanId = string;   // 16-char hex format
export type RequestId = string; // UUID v4 format

/**
 * Generate a new trace ID (UUID v4 format).
 * Use this for the root trace of a new workflow or HTTP request.
 *
 * @returns UUID v4 string (36 chars with dashes)
 * @example
 * const traceId = generateTraceId();
 * // => "550e8400-e29b-41d4-a716-446655440000"
 */
export function generateTraceId(): TraceId {
  return randomUUID();
}

/**
 * Generate a new span ID (16-char hex format).
 * Use this for each operation within a trace (e.g., task dispatch, result publish).
 *
 * @returns 16-character hexadecimal string
 * @example
 * const spanId = generateSpanId();
 * // => "a1b2c3d4e5f6g7h8"
 */
export function generateSpanId(): SpanId {
  return randomBytes(8).toString('hex');
}

/**
 * Generate a new request ID (UUID v4 format).
 * Use this for HTTP request correlation.
 *
 * @returns UUID v4 string (36 chars with dashes)
 * @example
 * const requestId = generateRequestId();
 * // => "660e8400-e29b-41d4-a716-446655440001"
 */
export function generateRequestId(): RequestId {
  return randomUUID();
}

/**
 * Trace context for propagation across async boundaries.
 */
export interface TraceContext {
  trace_id: TraceId;
  span_id?: SpanId;
  parent_span_id?: SpanId;
  request_id?: RequestId;
}

/**
 * Create a child trace context with a new span ID.
 * Use this when starting a new operation within an existing trace.
 *
 * @param parent Parent trace context
 * @returns New trace context with updated span IDs
 * @example
 * const parent = { trace_id: generateTraceId(), span_id: generateSpanId() };
 * const child = createChildContext(parent);
 * // child.trace_id === parent.trace_id (inherited)
 * // child.span_id !== parent.span_id (new span)
 * // child.parent_span_id === parent.span_id (linked)
 */
export function createChildContext(parent: TraceContext): TraceContext {
  return {
    trace_id: parent.trace_id,
    span_id: generateSpanId(),
    parent_span_id: parent.span_id,
    request_id: parent.request_id
  };
}

/**
 * Extract trace context from an envelope or message.
 *
 * @param envelope Message envelope with optional trace fields
 * @returns Trace context or undefined if no trace information
 * @example
 * const context = extractTraceContext(taskEnvelope);
 * if (context) {
 *   console.log('Trace ID:', context.trace_id);
 * }
 */
export function extractTraceContext(envelope: any): TraceContext | undefined {
  if (!envelope) return undefined;

  const trace_id = envelope.trace_id;
  if (!trace_id) return undefined;

  return {
    trace_id,
    span_id: envelope.span_id,
    parent_span_id: envelope.parent_span_id,
    request_id: envelope.request_id
  };
}
