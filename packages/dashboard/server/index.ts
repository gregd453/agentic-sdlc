/**
 * Dashboard Backend Server
 * 
 * Serves:
 * - Static React frontend (built with Vite)
 * - Analytics API endpoints (read-only)
 * - Health checks
 * 
 * Combined dashboard + analytics service in single container
 */

import express, { Express, Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import pino from 'pino';

// ============================================================================
// Setup
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();
const PORT = process.env.PORT || 3050;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Logger
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
          },
        }
      : undefined,
});

// Database
const prisma = new PrismaClient({
  log: NODE_ENV === 'development' ? ['info', 'warn', 'error'] : ['error'],
});

// ============================================================================
// Middleware
// ============================================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// CORS (allow frontend to call API)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// ============================================================================
// Health Checks
// ============================================================================

/**
 * Basic liveness probe
 */
app.get('/health', async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (error) {
    logger.error('Health check failed', error);
    res.status(503).json({
      status: 'unhealthy',
      error: 'Database connection failed',
    });
  }
});

/**
 * Readiness probe (all dependencies ready)
 */
app.get('/ready', async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      ready: true,
      services: {
        database: 'connected',
        api: 'running',
      },
    });
  } catch (error) {
    res.status(503).json({
      ready: false,
      error: 'Services not ready',
    });
  }
});

// ============================================================================
// Analytics API - Stats Endpoints
// ============================================================================

/**
 * GET /api/v1/stats/overview
 * Dashboard KPI counts
 */
app.get('/api/v1/stats/overview', async (req: Request, res: Response) => {
  try {
    const [workflowCount, taskCount, errorCount] = await Promise.all([
      prisma.workflow.count(),
      prisma.agentTask.count(),
      prisma.workflowEvent.count({
        where: { eventType: 'error' },
      }),
    ]);

    res.json({
      totalWorkflows: workflowCount,
      totalTasks: taskCount,
      totalErrors: errorCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Stats overview error', error);
    res.status(500).json({ error: 'Failed to fetch overview' });
  }
});

/**
 * GET /api/v1/stats/agents
 * Agent performance statistics
 */
app.get('/api/v1/stats/agents', async (req: Request, res: Response) => {
  try {
    const agents = await prisma.agentTask.groupBy({
      by: ['agentType'],
      _count: {
        id: true,
      },
      _avg: {
        executionTimeMs: true,
      },
    });

    res.json(
      agents.map((agent) => ({
        type: agent.agentType,
        taskCount: agent._count.id,
        avgExecutionTime: agent._avg.executionTimeMs || 0,
      }))
    );
  } catch (error) {
    logger.error('Agent stats error', error);
    res.status(500).json({ error: 'Failed to fetch agent stats' });
  }
});

/**
 * GET /api/v1/stats/timeseries
 * Time series data
 */
app.get('/api/v1/stats/timeseries', async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || '24h';
    const since = new Date();

    switch (period) {
      case '1h':
        since.setHours(since.getHours() - 1);
        break;
      case '24h':
        since.setDate(since.getDate() - 1);
        break;
      case '7d':
        since.setDate(since.getDate() - 7);
        break;
      case '30d':
        since.setDate(since.getDate() - 30);
        break;
    }

    const events = await prisma.workflowEvent.findMany({
      where: {
        createdAt: {
          gte: since,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const grouped = events.reduce(
      (acc, event) => {
        const hour = new Date(event.createdAt).toISOString().slice(0, 13);
        if (!acc[hour]) {
          acc[hour] = 0;
        }
        acc[hour]++;
        return acc;
      },
      {} as Record<string, number>
    );

    res.json(
      Object.entries(grouped).map(([timestamp, count]) => ({
        timestamp,
        count,
      }))
    );
  } catch (error) {
    logger.error('Timeseries error', error);
    res.status(500).json({ error: 'Failed to fetch timeseries data' });
  }
});

/**
 * GET /api/v1/stats/workflows
 * Workflow statistics by type
 */
app.get('/api/v1/stats/workflows', async (req: Request, res: Response) => {
  try {
    const workflows = await prisma.workflow.groupBy({
      by: ['workflowType', 'status'],
      _count: {
        id: true,
      },
    });

    res.json(
      workflows.map((wf) => ({
        type: wf.workflowType,
        status: wf.status,
        count: wf._count.id,
      }))
    );
  } catch (error) {
    logger.error('Workflow stats error', error);
    res.status(500).json({ error: 'Failed to fetch workflow stats' });
  }
});

// ============================================================================
// Analytics API - Tasks Endpoints
// ============================================================================

/**
 * GET /api/v1/tasks
 * List tasks with optional filters
 */
app.get('/api/v1/tasks', async (req: Request, res: Response) => {
  try {
    const { workflowId, agentType, status, limit = '50', offset = '0' } = req.query;

    const where: any = {};
    if (workflowId) where.workflowId = workflowId;
    if (agentType) where.agentType = agentType;
    if (status) where.status = status;

    const [tasks, total] = await Promise.all([
      prisma.agentTask.findMany({
        where,
        take: Math.min(parseInt(limit as string), 100),
        skip: parseInt(offset as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.agentTask.count({ where }),
    ]);

    res.json({
      tasks,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    });
  } catch (error) {
    logger.error('Task list error', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

/**
 * GET /api/v1/tasks/:taskId
 * Get task by ID
 */
app.get('/api/v1/tasks/:taskId', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const task = await prisma.agentTask.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
  } catch (error) {
    logger.error('Task fetch error', error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// ============================================================================
// Analytics API - Workflows Endpoints
// ============================================================================

/**
 * GET /api/v1/workflows
 * List workflows with optional filters
 */
app.get('/api/v1/workflows', async (req: Request, res: Response) => {
  try {
    const { status, type, limit = '50', offset = '0' } = req.query;

    const where: any = {};
    if (status) where.status = status;
    if (type) where.workflowType = type;

    const [workflows, total] = await Promise.all([
      prisma.workflow.findMany({
        where,
        take: Math.min(parseInt(limit as string), 100),
        skip: parseInt(offset as string),
        orderBy: { createdAt: 'desc' },
        include: {
          stages: {
            select: { id: true, stageName: true, status: true },
          },
        },
      }),
      prisma.workflow.count({ where }),
    ]);

    res.json({
      workflows,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    });
  } catch (error) {
    logger.error('Workflow list error', error);
    res.status(500).json({ error: 'Failed to fetch workflows' });
  }
});

/**
 * GET /api/v1/workflows/:workflowId
 * Get workflow by ID with stages
 */
app.get('/api/v1/workflows/:workflowId', async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: {
        stages: {
          orderBy: { stageOrder: 'asc' },
        },
        events: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    res.json(workflow);
  } catch (error) {
    logger.error('Workflow fetch error', error);
    res.status(500).json({ error: 'Failed to fetch workflow' });
  }
});

// ============================================================================
// Static Frontend (Vite build)
// ============================================================================

/**
 * Serve static Vite-built frontend
 */
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

/**
 * SPA fallback: serve index.html for all unmatched routes
 * (React Router handles frontend routing)
 */
app.get('*', (req: Request, res: Response) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ============================================================================
// Error Handling
// ============================================================================

app.use((err: any, req: Request, res: Response) => {
  logger.error('Unhandled error', err);
  res.status(500).json({
    error: 'Internal server error',
    message: NODE_ENV === 'development' ? err.message : undefined,
  });
});

// ============================================================================
// Server Start
// ============================================================================

const server = app.listen(PORT, () => {
  logger.info(`Dashboard server running on port ${PORT}`);
  logger.info(`Environment: ${NODE_ENV}`);
  logger.info(`Frontend: http://localhost:${PORT}`);
  logger.info(`API: http://localhost:${PORT}/api/v1`);
  logger.info(`Health: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
});

export default app;
