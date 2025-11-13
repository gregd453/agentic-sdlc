import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { prisma } from './db/client';
import { EventBus } from './events/event-bus';
import { WorkflowRepository } from './repositories/workflow.repository';
import { WorkflowService } from './services/workflow.service';
import { WorkflowStateMachineService } from './state-machine/workflow-state-machine';
import { PipelineExecutorService } from './services/pipeline-executor.service';
import { QualityGateService } from './services/quality-gate.service';
import { HealthCheckService } from './services/health-check.service';
import { GracefulShutdownService } from './services/graceful-shutdown.service';
import { workflowRoutes } from './api/routes/workflow.routes';
import { pipelineRoutes } from './api/routes/pipeline.routes';
import { healthRoutes } from './api/routes/health.routes';
import { PipelineWebSocketHandler } from './websocket/pipeline-websocket.handler';
import { logger } from './utils/logger';
import { metrics } from './utils/metrics';
import {
  registerObservabilityMiddleware,
  createMetricsEndpoint,
  createMetricsSummaryEndpoint
} from './middleware/observability.middleware';
import { OrchestratorContainer } from './hexagonal/bootstrap';
import { IMessageBus } from './hexagonal/ports/message-bus.port';
import { WorkflowStateManager } from './hexagonal/persistence/workflow-state-manager';

export async function createServer() {
  // Initialize Fastify
  const fastify = Fastify({
    logger: false, // We use our own logger
    requestIdLogLabel: 'request_id',
    disableRequestLogging: false,
    requestIdHeader: 'x-request-id',
    trustProxy: true
  });

  // Register plugins
  await fastify.register(cors, {
    origin: process.env.NODE_ENV === 'production'
      ? process.env.ALLOWED_ORIGINS?.split(',') || []
      : true,
    credentials: true
  });

  // Register Swagger
  await fastify.register(swagger, {
    mode: 'dynamic',
    openapi: {
      info: {
        title: 'Agentic SDLC Orchestrator API',
        description: 'API for managing autonomous software development workflows',
        version: '0.1.0'
      },
      servers: [
        {
          url: process.env.NODE_ENV === 'production'
            ? 'https://api.agentic-sdlc.com'
            : 'http://localhost:3000'
        }
      ],
      tags: [
        { name: 'workflows', description: 'Workflow management operations' },
        { name: 'pipelines', description: 'Pipeline execution and control operations' },
        { name: 'health', description: 'Health check endpoints' },
        { name: 'metrics', description: 'Metrics and observability endpoints' }
      ]
    }
  });

  await fastify.register(swaggerUI, {
    routePrefix: '/documentation',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false
    },
    uiHooks: {
      onRequest: function (_request, _reply, next) { next() },
      preHandler: function (_request, _reply, next) { next() }
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
    transformSpecification: (swaggerObject, _request, _reply) => { return swaggerObject },
    transformSpecificationClone: true
  });

  // Phase 3: Initialize hexagonal container
  logger.info('[PHASE-3] Initializing OrchestratorContainer');
  const container = new OrchestratorContainer({
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6380',
    redisNamespace: 'agentic-sdlc',
    redisDefaultTtl: 3600, // 1 hour
    coordinators: {} // No coordinators needed for workflow orchestration
  });

  await container.initialize();
  logger.info('[PHASE-3] OrchestratorContainer initialized successfully');

  // Initialize services
  // Use same Redis URL as container for consistency
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6380';
  const eventBus = new EventBus(redisUrl);
  const workflowRepository = new WorkflowRepository(prisma);

  // Phase 3: Extract dependencies from container
  logger.info('[PHASE-3] Extracting dependencies from container');
  const messageBus = container.getBus();
  const kv = container.getKV();
  logger.info('[PHASE-3] Extracted dependencies from container', {
    messageBusAvailable: !!messageBus,
    kvStoreAvailable: !!kv
  });

  // Phase 3: Initialize WorkflowStateManager with KV store
  const stateManager = new WorkflowStateManager(kv, messageBus);
  logger.info('[PHASE-3] WorkflowStateManager initialized');

  // Phase 4 & 6: Pass messageBus and stateManager to state machine
  const stateMachineService = new WorkflowStateMachineService(
    workflowRepository,
    eventBus,
    messageBus, // Phase 4: State machine receives events autonomously
    stateManager // Phase 6: State machine persists to KV store
  );

  // Phase 3: Create WorkflowService with messageBus from container
  logger.info('[PHASE-3] WorkflowService created with messageBus');
  const workflowService = new WorkflowService(
    workflowRepository,
    eventBus,
    stateMachineService,
    redisUrl,
    messageBus // Phase 3: messageBus always available from container
  );

  // Initialize pipeline services
  const qualityGateService = new QualityGateService();
  const pipelineExecutor = new PipelineExecutorService(
    eventBus,
    // Phase 2: AgentDispatcherService removed (2 args now)
    qualityGateService
  );

  // Initialize WebSocket handler
  const pipelineWebSocketHandler = new PipelineWebSocketHandler(eventBus);

  // Initialize health check service
  const healthCheckService = new HealthCheckService(prisma, eventBus); // Phase 2: AgentDispatcherService removed (2 args now)

  // Register WebSocket support
  await fastify.register(require('@fastify/websocket'));

  // Register WebSocket handler
  await pipelineWebSocketHandler.register(fastify);

  // Register observability middleware (logging, metrics, tracing)
  registerObservabilityMiddleware(fastify);

  // Register routes
  await fastify.register(healthRoutes, { healthCheckService });
  await fastify.register(workflowRoutes, { workflowService });
  await fastify.register(pipelineRoutes, { pipelineExecutor });

  // Phase 3: scaffold.routes removed (depended on AgentDispatcherService which is now removed)

  // Metrics endpoints
  fastify.get('/metrics', {
    schema: {
      tags: ['metrics'],
      summary: 'Prometheus metrics endpoint',
      description: 'Returns metrics in Prometheus exposition format for scraping',
      response: {
        200: {
          type: 'string',
          description: 'Prometheus metrics in text format'
        }
      }
    }
  }, createMetricsEndpoint());

  fastify.get('/metrics/summary', {
    schema: {
      tags: ['metrics'],
      summary: 'Metrics summary (JSON)',
      description: 'Returns metrics summary in JSON format with percentiles',
      response: {
        200: {
          type: 'object',
          properties: {
            timestamp: { type: 'string', format: 'date-time' },
            metrics: { type: 'object' }
          }
        }
      }
    }
  }, createMetricsSummaryEndpoint());

  // Initialize graceful shutdown service
  const gracefulShutdown = new GracefulShutdownService(
    fastify,
    prisma,
    eventBus,
    // Phase 2: AgentDispatcherService removed (6 args now)
    pipelineExecutor,
    pipelineWebSocketHandler,
    workflowService
  );

  // Initialize shutdown handlers
  gracefulShutdown.initialize();

  // Phase 3: Add shutdown hook for OrchestratorContainer
  fastify.addHook('onClose', async () => {
    logger.info('[PHASE-3] Shutting down OrchestratorContainer');
    await container.shutdown();
    logger.info('[PHASE-3] Container shutdown complete');
  });

  // Phase 3: Add health check endpoint for hexagonal components
  fastify.get('/health/hexagonal', {
    schema: {
      tags: ['health'],
      summary: 'Hexagonal architecture health check',
      description: 'Returns health status of hexagonal components (message bus, KV store)',
      response: {
        200: {
          type: 'object',
          properties: {
            timestamp: { type: 'string', format: 'date-time' },
            hexagonal: {
              type: 'object',
              properties: {
                ok: { type: 'boolean' },
                bus: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' }
                  }
                },
                kv: { type: 'boolean' }
              }
            }
          }
        }
      }
    }
  }, async (_request, reply) => {
    const health = await container.health();
    return reply.send({
      timestamp: new Date().toISOString(),
      hexagonal: health
    });
  });

  return fastify;
}

export async function startServer() {
  const port = parseInt(process.env.ORCHESTRATOR_PORT || '3000', 10);
  const host = process.env.HOST || '0.0.0.0';

  try {
    const server = await createServer();

    await server.listen({ port, host });

    logger.info(`Orchestrator server listening on ${host}:${port}`);
    logger.info(`API documentation available at http://${host}:${port}/documentation`);

    // Record startup metric
    metrics.increment('server.started');

    return server;
  } catch (error) {
    console.error('=================== SERVER START ERROR ===================');
    console.error('Error:', error);
    console.error('Message:', error instanceof Error ? error.message : String(error));
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('==========================================================');
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}