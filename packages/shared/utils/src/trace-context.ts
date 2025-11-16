/**
 * Trace Context Auto-Propagation
 * Handles automatic injection of distributed trace fields into log entries
 * and async boundary trace context preservation
 */

export interface TraceContext {
  trace_id: string;
  span_id?: string;
  parent_span_id?: string;
  [key: string]: any;
}

/**
 * AsyncLocal-like storage for trace context in Node.js
 * Provides per-request trace context without explicit passing
 */
export class TraceContextManager {
  private static contexts: Map<string, TraceContext> = new Map();
  private static currentContextId: string | null = null;

  /**
   * Set trace context for current execution context
   */
  static setContext(contextId: string, context: TraceContext): void {
    this.contexts.set(contextId, context);
    this.currentContextId = contextId;
  }

  /**
   * Get current trace context
   */
  static getContext(): TraceContext | null {
    if (!this.currentContextId) return null;
    return this.contexts.get(this.currentContextId) || null;
  }

  /**
   * Clear trace context
   */
  static clearContext(contextId?: string): void {
    if (contextId) {
      this.contexts.delete(contextId);
    } else if (this.currentContextId) {
      this.contexts.delete(this.currentContextId);
      this.currentContextId = null;
    }
  }

  /**
   * Run function with trace context
   */
  static async withContext<T>(
    contextId: string,
    context: TraceContext,
    fn: () => Promise<T>
  ): Promise<T> {
    const previousContextId = this.currentContextId;
    this.setContext(contextId, context);

    try {
      return await fn();
    } finally {
      this.clearContext(contextId);
      this.currentContextId = previousContextId;
    }
  }
}

/**
 * Middleware to inject trace context into log entries
 */
export function createTraceContextMiddleware() {
  return {
    /**
     * Enhance log entry with trace context
     */
    enhanceLogEntry(entry: any, context?: TraceContext): any {
      const traceContext = context || TraceContextManager.getContext();
      if (!traceContext) return entry;

      return {
        ...entry,
        trace_id: traceContext.trace_id,
        span_id: traceContext.span_id,
        parent_span_id: traceContext.parent_span_id
      };
    },

    /**
     * Extract trace context from message/request headers
     */
    extractFromHeaders(headers: Record<string, string>): TraceContext | null {
      const traceId = headers['x-trace-id'];
      if (!traceId) return null;

      return {
        trace_id: traceId,
        span_id: headers['x-span-id'],
        parent_span_id: headers['x-parent-span-id']
      };
    },

    /**
     * Inject trace context into response headers
     */
    injectToHeaders(context: TraceContext): Record<string, string> {
      return {
        'x-trace-id': context.trace_id,
        ...(context.span_id && { 'x-span-id': context.span_id }),
        ...(context.parent_span_id && { 'x-parent-span-id': context.parent_span_id })
      };
    }
  };
}

/**
 * Generate unique trace/span IDs
 */
export function generateTraceId(): string {
  return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function generateSpanId(): string {
  return `span_${Math.random().toString(36).substr(2, 16)}`;
}
