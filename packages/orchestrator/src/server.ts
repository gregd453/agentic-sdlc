import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { prisma } from './db/client';
import { EventBus } from './events/event-bus';
import { WorkflowRepository } from './repositories/workflow.repository';
import { WorkflowService } from './services/workflow.service';
import { WorkflowStateMachineService } from './state-machine/workflow-state-machine';
import { workflowRoutes } from './api/routes/workflow.routes';
import { logger } from './utils/logger';
import { metrics } from './utils/metrics';

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
        { name: 'health', description: 'Health check endpoints' }
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
      onRequest: function (request, reply, next) { next() },
      preHandler: function (request, reply, next) { next() }
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
    transformSpecification: (swaggerObject, request, reply) => { return swaggerObject },
    transformSpecificationClone: true
  });

  // Initialize services
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const eventBus = new EventBus(redisUrl);
  const workflowRepository = new WorkflowRepository(prisma);
  const stateMachineService = new WorkflowStateMachineService(workflowRepository, eventBus);
  const workflowService = new WorkflowService(
    workflowRepository,
    eventBus,
    stateMachineService
  );

  // Register routes
  await fastify.register(workflowRoutes, { workflowService });

  // Add hooks for logging
  fastify.addHook('onRequest', async (request, reply) => {
    logger.info('Incoming request', {
      method: request.method,
      url: request.url,
      headers: request.headers,
      request_id: request.id
    });
  });

  fastify.addHook('onResponse', async (request, reply) => {
    logger.info('Request completed', {
      method: request.method,
      url: request.url,
      status_code: reply.statusCode,
      request_id: request.id,
      duration_ms: reply.getResponseTime()
    });

    // Record metrics
    metrics.recordDuration('http.request.duration', reply.getResponseTime(), {
      method: request.method,
      path: request.routerPath || request.url,
      status_code: reply.statusCode.toString()
    });
  });

  // Error handler
  fastify.setErrorHandler((error, request, reply) => {
    logger.error('Request error', {
      error: error.message,
      stack: error.stack,
      request_id: request.id
    });

    metrics.increment('http.request.errors', {
      method: request.method,
      path: request.routerPath || request.url
    });

    const statusCode = error.statusCode || 500;
    reply.status(statusCode).send({
      error: statusCode < 500 ? error.message : 'Internal server error',
      request_id: request.id
    });
  });

  // Graceful shutdown
  const closeGracefully = async (signal: string) => {
    logger.info(`Received signal ${signal}, shutting down gracefully...`);

    await fastify.close();
    await eventBus.disconnect();
    await prisma.$disconnect();

    logger.info('Server shut down successfully');
    process.exit(0);
  };

  process.on('SIGINT', () => closeGracefully('SIGINT'));
  process.on('SIGTERM', () => closeGracefully('SIGTERM'));

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
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}