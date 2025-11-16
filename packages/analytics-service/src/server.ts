import Fastify, { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import swagger from '@fastify/swagger'
import swaggerUI from '@fastify/swagger-ui'
import { getPrismaClient } from './db/client'
import { logger } from './utils/logger'
import { statsRoutes } from './api/routes/stats.routes'
import { traceRoutes } from './api/routes/trace.routes'
import { taskRoutes } from './api/routes/task.routes'
import { workflowReadRoutes } from './api/routes/workflow-read.routes'
import { StatsService } from './services/stats.service'
import { TraceService } from './services/trace.service'
import { StatsRepository } from './repositories/stats.repository'
import { TraceRepository } from './repositories/trace.repository'
import { WorkflowRepository } from './repositories/workflow.repository'

export async function createServer(): Promise<FastifyInstance> {
  // Initialize Prisma client only when server is created
  const prisma = getPrismaClient()

  const fastify = Fastify({
    logger: false,
    requestIdLogLabel: 'request_id',
    disableRequestLogging: false,
    requestIdHeader: 'x-request-id',
    trustProxy: true
  })

  // Initialize repositories
  const statsRepository = new StatsRepository(prisma)
  const traceRepository = new TraceRepository(prisma)
  const workflowRepository = new WorkflowRepository(prisma)

  // Initialize services
  const statsService = new StatsService(statsRepository)
  const traceService = new TraceService(traceRepository, workflowRepository)

  // Register plugins
  await fastify.register(cors, {
    origin: process.env.NODE_ENV === 'production'
      ? process.env.ALLOWED_ORIGINS?.split(',') || []
      : true,
    credentials: true
  })

  // Register Swagger
  await fastify.register(swagger, {
    mode: 'dynamic',
    openapi: {
      info: {
        title: 'Agentic SDLC Analytics Service API',
        description: 'Read-only analytics and reporting microservice',
        version: '1.0.0'
      },
      servers: [
        {
          url: process.env.NODE_ENV === 'production'
            ? 'https://api.agentic-sdlc.com'
            : 'http://localhost:3001'
        }
      ],
      tags: [
        { name: 'health', description: 'Health check endpoints' },
        { name: 'stats', description: 'Dashboard statistics and analytics' },
        { name: 'traces', description: 'Distributed tracing operations' },
        { name: 'tasks', description: 'Agent task operations' },
        { name: 'workflows', description: 'Workflow read operations' }
      ]
    }
  })

  await fastify.register(swaggerUI, {
    routePrefix: '/docs'
  })

  // Health check endpoint
  fastify.get('/health', async (_request, reply) => {
    return reply.code(200).send({
      status: 'healthy',
      service: 'analytics-service',
      timestamp: new Date().toISOString()
    })
  })

  // Ready probe
  fastify.get('/ready', async (_request, reply) => {
    try {
      // Add readiness checks here (DB, Redis, etc.) if needed
      return reply.code(200).send({
        status: 'ready',
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      logger.error('Readiness check failed', { error })
      return reply.code(503).send({
        status: 'not-ready',
        error: 'Service dependencies unhealthy'
      })
    }
  })

  // Register routes
  await fastify.register(statsRoutes, { statsService })
  await fastify.register(traceRoutes, { traceService })
  await fastify.register(taskRoutes, { workflowRepository })
  await fastify.register(workflowReadRoutes, { workflowRepository })

  // Error handling middleware
  fastify.setErrorHandler(async (error, request, reply) => {
    logger.error('Unhandled error', {
      error: error.message,
      stack: error.stack,
      path: request.url,
      method: request.method
    })

    if (error.statusCode && error.statusCode < 500) {
      return reply.code(error.statusCode).send({
        error: error.message,
        statusCode: error.statusCode
      })
    }

    return reply.code(500).send({
      error: 'Internal server error',
      statusCode: 500
    })
  })

  return fastify
}
