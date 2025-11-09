import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import {
  createRequestContext,
  runWithContext,
  generateRequestId,
  generateTraceId,
  logger
} from '../utils/logger';
import { metrics } from '../utils/metrics';

/**
 * Observability Middleware
 *
 * Provides comprehensive observability features:
 * - Request/response logging with structured data
 * - Metrics collection (counters, gauges, histograms)
 * - Distributed tracing with trace ID propagation
 * - Performance monitoring
 */

/**
 * Register observability middleware
 */
export function registerObservabilityMiddleware(fastify: FastifyInstance): void {
  // Request ID and trace ID injection
  fastify.addHook('onRequest', async (request: FastifyRequest, _reply: FastifyReply) => {
    // Extract or generate request/trace IDs
    const requestId = (request.headers['x-request-id'] as string) || generateRequestId();
    const traceId = (request.headers['x-trace-id'] as string) || generateTraceId();
    const correlationId = (request.headers['x-correlation-id'] as string);
    const userId = (request.headers['x-user-id'] as string);
    const sessionId = (request.headers['x-session-id'] as string);

    // Create request context
    const context = createRequestContext({
      requestId,
      traceId,
      correlationId,
      userId,
      sessionId,
      startTime: Date.now()
    });

    // Store context for the request
    (request as any).context = context;

    // Run the rest of the request processing within this context
    // This ensures all logs from this request include the context
  });

  // Request logging
  fastify.addHook('onRequest', async (request: FastifyRequest, _reply: FastifyReply) => {
    const context = (request as any).context;

    runWithContext(context, () => {
      logger.info('Incoming request', {
        method: request.method,
        url: request.url,
        path: request.routerPath,
        query: request.query,
        headers: {
          'user-agent': request.headers['user-agent'],
          'content-type': request.headers['content-type'],
          'accept': request.headers['accept']
        },
        ip: request.ip,
        hostname: request.hostname
      });

      // Increment request counter
      metrics.increment('http_requests_total', {
        method: request.method,
        path: request.routerPath || request.url
      });
    });
  });

  // Response logging and metrics
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const context = (request as any).context;
    const duration = Date.now() - context.startTime;

    runWithContext(context, () => {
      // Log response
      const logLevel = reply.statusCode >= 500 ? 'error' : reply.statusCode >= 400 ? 'warn' : 'info';
      logger[logLevel]('Request completed', {
        method: request.method,
        url: request.url,
        path: request.routerPath,
        status_code: reply.statusCode,
        duration_ms: duration,
        response_time: reply.getResponseTime()
      });

      // Record request duration histogram
      metrics.histogram('http_request_duration_ms', duration, {
        method: request.method,
        path: request.routerPath || request.url,
        status_code: reply.statusCode.toString()
      });

      // Record response status counter
      metrics.increment('http_responses_total', {
        method: request.method,
        path: request.routerPath || request.url,
        status_code: reply.statusCode.toString()
      });

      // Track errors
      if (reply.statusCode >= 400) {
        metrics.increment('http_errors_total', {
          method: request.method,
          path: request.routerPath || request.url,
          status_code: reply.statusCode.toString(),
          error_type: reply.statusCode >= 500 ? 'server' : 'client'
        });
      }

      // Track response size
      const contentLength = reply.getHeader('content-length');
      if (contentLength) {
        metrics.histogram('http_response_size_bytes', Number(contentLength), {
          method: request.method,
          path: request.routerPath || request.url
        });
      }
    });
  });

  // Error logging
  fastify.setErrorHandler((error, request, reply) => {
    const context = (request as any).context;
    const duration = context ? Date.now() - context.startTime : 0;

    const logFn = context
      ? () => logger.error('Request error', error, {
          method: request.method,
          url: request.url,
          path: request.routerPath,
          duration_ms: duration,
          error_name: error.name,
          error_message: error.message,
          error_stack: error.stack
        })
      : () => logger.error('Request error (no context)', error, {
          method: request.method,
          url: request.url,
          error_name: error.name,
          error_message: error.message
        });

    if (context) {
      runWithContext(context, logFn);
    } else {
      logFn();
    }

    // Increment error metrics
    metrics.increment('http_request_errors', {
      method: request.method,
      path: request.routerPath || request.url,
      error_type: error.name || 'UnknownError'
    });

    // Send error response
    const statusCode = (error as any).statusCode || 500;
    reply.status(statusCode).send({
      error: statusCode < 500 ? error.message : 'Internal server error',
      request_id: context?.requestId
    });
  });

  // Add trace ID to response headers
  fastify.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply, _payload) => {
    const context = (request as any).context;
    if (context) {
      reply.header('x-request-id', context.requestId);
      reply.header('x-trace-id', context.traceId);
      if (context.correlationId) {
        reply.header('x-correlation-id', context.correlationId);
      }
    }
  });
}

/**
 * Create metrics endpoint handler
 */
export function createMetricsEndpoint() {
  return async (_request: FastifyRequest, reply: FastifyReply) => {
    // Export metrics in Prometheus format
    const prometheusMetrics = metrics.exportPrometheus();

    reply
      .type('text/plain; version=0.0.4')
      .send(prometheusMetrics);
  };
}

/**
 * Create metrics summary endpoint handler (JSON format)
 */
export function createMetricsSummaryEndpoint() {
  return async (_request: FastifyRequest, reply: FastifyReply) => {
    const allMetrics = metrics.getMetrics();

    const summary: any = {
      timestamp: new Date().toISOString(),
      metrics: {}
    };

    for (const metric of allMetrics) {
      summary.metrics[metric.name] = {
        type: metric.type,
        help: metric.help,
        values: {}
      };

      for (const [key, value] of metric.values.entries()) {
        if (metric.type === 'histogram') {
          const histogram = value as any;
          const labels = key ? JSON.parse(`{${key.replace(/=/g, '":"').replace(/,/g, '","')}}`) : {};
          const labelsKey = JSON.stringify(labels);

          summary.metrics[metric.name].values[labelsKey] = {
            count: histogram.count,
            sum: histogram.sum,
            average: histogram.count > 0 ? histogram.sum / histogram.count : 0,
            buckets: histogram.buckets
          };

          // Add percentiles
          const percentiles = metrics.getPercentiles(metric.name, labels);
          if (percentiles.size > 0) {
            summary.metrics[metric.name].values[labelsKey].percentiles = {
              p50: percentiles.get(0.5) || 0,
              p95: percentiles.get(0.95) || 0,
              p99: percentiles.get(0.99) || 0
            };
          }
        } else {
          const metricValue = value as any;
          const labelsKey = JSON.stringify(metricValue.labels);
          summary.metrics[metric.name].values[labelsKey] = metricValue.value;
        }
      }
    }

    reply.send(summary);
  };
}
