import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { prisma } from './db/client';
import { EventBus } from './events/event-bus';
import { WorkflowRepository } from './repositories/workflow.repository';
import { StatsRepository } from './repositories/stats.repository';
import { TraceRepository } from './repositories/trace.repository';
import { WorkflowService } from './services/workflow.service';
import { StatsService } from './services/stats.service';
import { TraceService } from './services/trace.service';
import { WorkflowStateMachineService } from './state-machine/workflow-state-machine';
import { PipelineExecutorService } from './services/pipeline-executor.service';
import { QualityGateService } from './services/quality-gate.service';
import { HealthCheckService } from './services/health-check.service';
import { GracefulShutdownService } from './services/graceful-shutdown.service';
import { workflowRoutes } from './api/routes/workflow.routes';
import { pipelineRoutes } from './api/routes/pipeline.routes';
import { healthRoutes } from './api/routes/health.routes';
import { statsRoutes } from './api/routes/stats.routes';
import { traceRoutes } from './api/routes/trace.routes';
import { taskRoutes } from './api/routes/task.routes';
import { platformRoutes } from './api/routes/platform.routes';
import { agentsRoutes } from './api/routes/agents.routes';
import { workflowDefinitionRoutes } from './api/routes/workflow-definition.routes';
import { WorkflowDefinitionRepository } from './repositories/workflow-definition.repository';
import { PlatformAwareWorkflowEngine } from './services/platform-aware-workflow-engine.service';
import { WorkflowDefinitionAdapter } from './services/workflow-definition-adapter.service';
import { PipelineWebSocketHandler } from './websocket/pipeline-websocket.handler';
import { MonitoringWebSocketHandler } from './websocket/monitoring-websocket.handler';
import { EventAggregatorService } from './services/event-aggregator.service';
import { monitoringRoutes } from './api/routes/monitoring.routes';
import { schedulerRoutes } from './api/routes/scheduler.routes';
import { logger } from './utils/logger';
import { PlatformLoaderService } from './services/platform-loader.service';
import { PlatformRegistryService } from './services/platform-registry.service';
import { PlatformService } from './services/platform.service';
import { AgentRegistryService } from './services/agent-registry.service';
import { SchedulerService } from './services/scheduler.service';
import { JobHandlerRegistry } from './services/job-handler-registry.service';
import { JobExecutorService } from './services/job-executor.service';
import { EventSchedulerService } from './services/event-scheduler.service';
import { JobDispatcherWorker } from './workers/job-dispatcher.worker';
import { JobConsumerWorker } from './workers/job-consumer.worker';
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
        { name: 'metrics', description: 'Metrics and observability endpoints' },
        { name: 'stats', description: 'Dashboard statistics and analytics' },
        { name: 'traces', description: 'Distributed tracing operations' },
        { name: 'tasks', description: 'Agent task operations' }
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
  const statsRepository = new StatsRepository(prisma);
  const traceRepository = new TraceRepository(prisma);
  const workflowDefinitionRepository = new WorkflowDefinitionRepository(prisma);

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

  // SESSION #88: Phase 3 - Initialize definition-driven workflow engine
  logger.info('[SESSION #88] Initializing PlatformAwareWorkflowEngine');
  const platformAwareWorkflowEngine = new PlatformAwareWorkflowEngine(prisma);
  logger.info('[SESSION #88] PlatformAwareWorkflowEngine initialized');

  // SESSION #88: Phase 3 - Initialize workflow definition adapter
  logger.info('[SESSION #88] Initializing WorkflowDefinitionAdapter');
  const workflowDefinitionAdapter = new WorkflowDefinitionAdapter(platformAwareWorkflowEngine);
  logger.info('[SESSION #88] WorkflowDefinitionAdapter initialized');

  // Phase 4 & 6: Pass messageBus and stateManager to state machine
  // SESSION #88: Phase 3 - Also pass workflowDefinitionAdapter for definition-driven routing
  const stateMachineService = new WorkflowStateMachineService(
    workflowRepository,
    eventBus,
    messageBus, // Phase 4: State machine receives events autonomously
    stateManager, // Phase 6: State machine persists to KV store
    workflowDefinitionAdapter // SESSION #88: Phase 3 - Enable definition-driven workflow routing
  );
  logger.info('[SESSION #88] WorkflowStateMachineService initialized with definition adapter');

  // Phase 3: Create WorkflowService with messageBus from container
  logger.info('[PHASE-3] WorkflowService created with messageBus');
  const workflowService = new WorkflowService(
    workflowRepository,
    eventBus,
    stateMachineService,
    redisUrl,
    messageBus // Phase 3: messageBus always available from container
  );

  // SESSION #66: Register task creator callback with state machine
  // This enables the state machine to create tasks for the next stage after transitions
  stateMachineService.setTaskCreator(workflowService.createTaskForStage.bind(workflowService));
  logger.info('[SESSION #66] Task creator registered with state machine');

  // Initialize dashboard services
  const statsService = new StatsService(statsRepository);
  const traceService = new TraceService(traceRepository, workflowRepository);
  logger.info('Dashboard services initialized (StatsService, TraceService)');

  // Session #88: Initialize EventAggregatorService for real-time monitoring
  // Pass EventBus for workflow events, messageBus/kv from container for Redis access
  const eventAggregator = new EventAggregatorService(messageBus, kv, statsService, eventBus);
  await eventAggregator.start();
  logger.info('[Session #88] EventAggregatorService initialized for real-time monitoring');

  // Initialize platform services
  const platformLoader = new PlatformLoaderService(prisma);
  const platformRegistry = new PlatformRegistryService(platformLoader);
  await platformRegistry.initialize();
  const platformService = new PlatformService(prisma);
  logger.info('Platform services initialized (PlatformRegistry with %d platforms)', platformRegistry.size());

  // Initialize agent discovery service (Session #85 - Dashboard Agent Extensibility)
  const agentRegistry = new AgentRegistryService();
  await agentRegistry.initialize();
  logger.info('Agent discovery service initialized');

  // Session #89: Initialize scheduler services
  logger.info('[Session #89] Initializing scheduler services');
  const jobHandlerRegistry = new JobHandlerRegistry(agentRegistry, platformAwareWorkflowEngine);
  const jobExecutor = new JobExecutorService(prisma, messageBus, jobHandlerRegistry);
  const schedulerService = new SchedulerService(prisma, messageBus);
  const eventScheduler = new EventSchedulerService(prisma, messageBus, schedulerService);

  // Initialize event scheduler (load event handlers from database) - non-blocking
  eventScheduler.initialize().catch((error) => {
    logger.warn({ error }, '[Session #89] EventScheduler initialization failed, continuing without event handlers');
  });
  logger.info('[Session #89] Scheduler services initialized');

  // Session #89: Initialize scheduler workers
  const jobDispatcher = new JobDispatcherWorker(prisma, messageBus, {
    interval_ms: parseInt(process.env.SCHEDULER_INTERVAL_MS || '60000', 10),
    batch_size: parseInt(process.env.SCHEDULER_BATCH_SIZE || '100', 10),
    enabled: (process.env.ENABLE_JOB_DISPATCHER ?? 'true') === 'true'
  });

  const jobConsumer = new JobConsumerWorker(messageBus, jobExecutor, {
    stream_name: 'stream:scheduler:job.dispatch',
    consumer_group: 'scheduler-workers',
    consumer_name: `consumer-${process.env.HOSTNAME || 'local'}`,
    batch_size: 10,
    enabled: (process.env.ENABLE_JOB_CONSUMER ?? 'true') === 'true'
  });

  // Start scheduler workers
  jobDispatcher.start();
  await jobConsumer.start();
  logger.info('[Session #89] Scheduler workers started (dispatcher + consumer)');

  // Initialize pipeline services
  const qualityGateService = new QualityGateService();
  // Session #79: Create repository for pipeline execution persistence
  const { PipelineExecutionRepository } = await import('./repositories/pipeline-execution.repository');
  const pipelineExecutionRepository = new PipelineExecutionRepository(prisma);
  const pipelineExecutor = new PipelineExecutorService(
    eventBus,
    // Phase 2: AgentDispatcherService removed (2 args now)
    qualityGateService,
    // Session #79: Pass repository for pause/resume persistence
    pipelineExecutionRepository
  );

  // Session #79: Recover paused executions on startup
  await pipelineExecutor.recoverPausedExecutions();
  logger.info('Pipeline service initialized with pause/resume persistence (Session #79)');

  // Initialize WebSocket handlers
  const pipelineWebSocketHandler = new PipelineWebSocketHandler(eventBus);

  // Session #88: Initialize MonitoringWebSocketHandler for real-time metrics
  const monitoringWebSocketHandler = new MonitoringWebSocketHandler(eventAggregator);

  // Initialize health check service
  const healthCheckService = new HealthCheckService(prisma, eventBus); // Phase 2: AgentDispatcherService removed (2 args now)

  // Register WebSocket support
  await fastify.register(require('@fastify/websocket'));

  // Register WebSocket handlers
  await pipelineWebSocketHandler.register(fastify);

  // Session #88: Register MonitoringWebSocket handler for real-time metrics
  await monitoringWebSocketHandler.register(fastify);
  logger.info('[Session #88] MonitoringWebSocket handler registered at /ws/monitoring');

  // Register observability middleware (logging, metrics, tracing)
  registerObservabilityMiddleware(fastify);

  // Register routes
  await fastify.register(healthRoutes, { healthCheckService });
  await fastify.register(workflowRoutes, { workflowService, workflowRepository });
  await fastify.register(pipelineRoutes, { pipelineExecutor });
  await fastify.register(statsRoutes, { statsService });
  await fastify.register(traceRoutes, { traceService });
  await fastify.register(taskRoutes, { workflowRepository });
  await fastify.register(platformRoutes, { platformRegistry, platformService, platformLoader, statsService, agentRegistry });
  // Session #85: Agent discovery routes for dashboard agent extensibility
  await fastify.register(agentsRoutes, { agentRegistry });
  // Workflow definition CRUD routes for platform-scoped workflow management
  await fastify.register(workflowDefinitionRoutes, { workflowDefinitionRepository });

  // Session #88: Monitoring routes for real-time metrics
  await fastify.register(monitoringRoutes, { eventAggregator });
  logger.info('[Session #88] Monitoring routes registered at /api/v1/monitoring');

  // Session #89: Scheduler routes for job management
  await fastify.register(schedulerRoutes, { schedulerService, jobExecutor, eventScheduler });
  logger.info('[Session #89] Scheduler routes registered at /api/v1/scheduler');

  // Phase 3: scaffold.routes removed (depended on AgentDispatcherService which is now removed)

  // Root endpoint
  fastify.get('/', {
    schema: {
      tags: ['info'],
      summary: 'API Information',
      description: 'Returns API information and available endpoints',
      response: {
        200: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            version: { type: 'string' },
            description: { type: 'string' },
            documentation: { type: 'string' }
          }
        }
      }
    }
  }, (request, reply) => {
    return reply.send({
      name: 'Agentic SDLC Orchestrator',
      version: '0.1.0',
      description: 'API for managing autonomous software development workflows',
      documentation: '/documentation'
    });
  });

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

    // Session #89: Stop scheduler workers
    logger.info('[Session #89] Stopping scheduler workers');
    jobDispatcher.stop();
    await jobConsumer.stop();
    logger.info('[Session #89] Scheduler workers stopped');

    // Session #88: Stop monitoring services
    logger.info('[Session #88] Stopping monitoring services');
    await monitoringWebSocketHandler.stop();
    await eventAggregator.stop();
    logger.info('[Session #88] Monitoring services stopped');

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
  // Validate ORCHESTRATOR_PORT is set (required, no default)
  const orchestratorPortEnv = process.env.ORCHESTRATOR_PORT;
  if (!orchestratorPortEnv) {
    console.error('❌ ERROR: ORCHESTRATOR_PORT environment variable is not set');
    console.error('');
    console.error('Usage:');
    console.error('  export ORCHESTRATOR_PORT=3051');
    console.error('  npm start');
    console.error('');
    console.error('Or in .env file:');
    console.error('  ORCHESTRATOR_PORT=3051');
    console.error('');
    process.exit(1);
  }

  const port = parseInt(orchestratorPortEnv, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    console.error(`❌ ERROR: ORCHESTRATOR_PORT must be a valid port number (1-65535), got: ${orchestratorPortEnv}`);
    process.exit(1);
  }

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

// Start server when run directly (not when imported as a module)
if (require.main === module) {
  startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}