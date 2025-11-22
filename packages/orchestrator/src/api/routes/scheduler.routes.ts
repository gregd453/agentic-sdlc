/**
 * Scheduler API Routes
 *
 * REST endpoints for scheduler management:
 * - Job CRUD operations
 * - Execution history
 * - Metrics and statistics
 * - Event handler management
 *
 * Session #89: Phase 3 - Message Bus Integration
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { SchedulerService } from '../../services/scheduler.service';
import { JobExecutorService } from '../../services/job-executor.service';
import { EventSchedulerService } from '../../services/event-scheduler.service';
import { logger } from '../../utils/logger';

// ==========================================
// ZOD SCHEMAS
// ==========================================

const PrioritySchema = z.enum(['low', 'medium', 'high', 'critical']);
const JobTypeSchema = z.enum(['cron', 'one_time', 'recurring', 'event']);
const JobStatusSchema = z.enum(['pending', 'active', 'paused', 'completed', 'failed', 'cancelled']);
const ExecutionStatusSchema = z.enum(['pending', 'running', 'success', 'failed', 'timeout', 'cancelled', 'skipped']);

const CreateCronJobSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  schedule: z.string(), // Cron expression
  timezone: z.string().default('UTC'),
  handler_name: z.string(),
  handler_type: z.enum(['function', 'agent', 'workflow']).default('function'),
  payload: z.any().optional(),
  enabled: z.boolean().default(true),
  max_retries: z.number().int().min(0).default(3),
  retry_delay_ms: z.number().int().min(0).default(60000),
  timeout_ms: z.number().int().min(1000).default(300000),
  priority: PrioritySchema.default('medium'),
  concurrency: z.number().int().min(1).default(1),
  allow_overlap: z.boolean().default(false),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
  platform_id: z.string().uuid().optional(),
  created_by: z.string()
});

const CreateOneTimeJobSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  execute_at: z.string().datetime(), // ISO 8601 datetime
  handler_name: z.string(),
  handler_type: z.enum(['function', 'agent', 'workflow']).default('function'),
  payload: z.any().optional(),
  max_retries: z.number().int().min(0).default(3),
  retry_delay_ms: z.number().int().min(0).default(60000),
  timeout_ms: z.number().int().min(1000).default(300000),
  priority: PrioritySchema.default('medium'),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
  platform_id: z.string().uuid().optional(),
  created_by: z.string()
});

const UpdateJobScheduleSchema = z.object({
  schedule: z.string()
});

const JobResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  type: JobTypeSchema,
  status: JobStatusSchema,
  schedule: z.string().optional(),
  timezone: z.string().optional(),
  next_run: z.string().datetime().optional(),
  last_run: z.string().datetime().optional(),
  handler_name: z.string(),
  handler_type: z.string(),
  payload: z.any().optional(),
  max_retries: z.number(),
  retry_delay_ms: z.number(),
  timeout_ms: z.number(),
  priority: PrioritySchema,
  concurrency: z.number(),
  allow_overlap: z.boolean(),
  executions_count: z.number(),
  success_count: z.number(),
  failure_count: z.number(),
  avg_duration_ms: z.number().optional(),
  tags: z.array(z.string()),
  metadata: z.record(z.any()).optional(),
  platform_id: z.string().uuid().optional(),
  created_by: z.string(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

const ExecutionResponseSchema = z.object({
  id: z.string().uuid(),
  job_id: z.string().uuid(),
  status: ExecutionStatusSchema,
  scheduled_at: z.string().datetime(),
  started_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional(),
  duration_ms: z.number().optional(),
  result: z.any().optional(),
  error: z.string().optional(),
  error_stack: z.string().optional(),
  retry_count: z.number(),
  max_retries: z.number(),
  next_retry_at: z.string().datetime().optional(),
  worker_id: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  trace_id: z.string().optional(),
  span_id: z.string().optional(),
  created_at: z.string().datetime()
});

const ErrorResponseSchema = z.object({
  error: z.string()
});

// ==========================================
// ROUTE DEFINITIONS
// ==========================================

export async function schedulerRoutes(
  fastify: FastifyInstance,
  options: {
    schedulerService: SchedulerService
    jobExecutor: JobExecutorService
    eventScheduler: EventSchedulerService
  }
): Promise<void> {
  const { schedulerService, jobExecutor, eventScheduler } = options;

  // ==========================================
  // JOB CRUD ROUTES
  // ==========================================

  /**
   * POST /api/v1/scheduler/jobs/cron
   * Create a recurring cron job
   */
  fastify.post('/api/v1/scheduler/jobs/cron', {
    schema: {
      body: zodToJsonSchema(CreateCronJobSchema),
      response: {
        201: zodToJsonSchema(JobResponseSchema),
        400: zodToJsonSchema(ErrorResponseSchema)
      }
    },
    handler: async (
      request: FastifyRequest<{ Body: z.infer<typeof CreateCronJobSchema> }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        const job = await schedulerService.schedule(request.body as any);
        reply.code(201).send(job);
      } catch (error: any) {
        logger.error({ error: error.message }, 'Failed to create cron job');
        reply.code(400).send({ error: error.message });
      }
    }
  });

  /**
   * POST /api/v1/scheduler/jobs/once
   * Create a one-time job
   */
  fastify.post('/api/v1/scheduler/jobs/once', {
    schema: {
      body: zodToJsonSchema(CreateOneTimeJobSchema),
      response: {
        201: zodToJsonSchema(JobResponseSchema),
        400: zodToJsonSchema(ErrorResponseSchema)
      }
    },
    handler: async (
      request: FastifyRequest<{ Body: z.infer<typeof CreateOneTimeJobSchema> }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        const body = request.body;
        const job = await schedulerService.scheduleOnce({
          ...body,
          execute_at: new Date(body.execute_at)
        } as any);
        reply.code(201).send(job);
      } catch (error: any) {
        logger.error({ error: error.message }, 'Failed to create one-time job');
        reply.code(400).send({ error: error.message });
      }
    }
  });

  /**
   * GET /api/v1/scheduler/jobs/:id
   * Get job by ID
   */
  fastify.get('/api/v1/scheduler/jobs/:id', {
    schema: {
      params: zodToJsonSchema(z.object({ id: z.string().uuid() })),
      response: {
        200: zodToJsonSchema(JobResponseSchema),
        404: zodToJsonSchema(ErrorResponseSchema)
      }
    },
    handler: async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        const job = await schedulerService.getJob(request.params.id);
        if (!job) {
          reply.code(404).send({ error: 'Job not found' });
          return;
        }
        reply.code(200).send(job);
      } catch (error: any) {
        logger.error({ error: error.message }, 'Failed to get job');
        reply.code(500).send({ error: 'Internal server error' });
      }
    }
  });

  /**
   * GET /api/v1/scheduler/jobs
   * List jobs with filters
   */
  fastify.get('/api/v1/scheduler/jobs', {
    schema: {
      querystring: zodToJsonSchema(
        z.object({
          type: JobTypeSchema.optional(),
          status: JobStatusSchema.optional(),
          platform_id: z.string().uuid().optional(),
          limit: z.coerce.number().int().min(1).max(100).default(20),
          offset: z.coerce.number().int().min(0).default(0)
        })
      ),
      response: {
        200: zodToJsonSchema(z.array(JobResponseSchema))
      }
    },
    handler: async (
      request: FastifyRequest<{
        Querystring: {
          type?: string
          status?: string
          platform_id?: string
          limit?: number
          offset?: number
        }
      }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        const jobs = await schedulerService.listJobs(request.query as any);
        reply.code(200).send(jobs);
      } catch (error: any) {
        logger.error({ error: error.message }, 'Failed to list jobs');
        reply.code(500).send({ error: 'Internal server error' });
      }
    }
  });

  /**
   * PUT /api/v1/scheduler/jobs/:id/schedule
   * Update job schedule
   */
  fastify.put('/api/v1/scheduler/jobs/:id/schedule', {
    schema: {
      params: zodToJsonSchema(z.object({ id: z.string().uuid() })),
      body: zodToJsonSchema(UpdateJobScheduleSchema),
      response: {
        200: zodToJsonSchema(JobResponseSchema),
        400: zodToJsonSchema(ErrorResponseSchema),
        404: zodToJsonSchema(ErrorResponseSchema)
      }
    },
    handler: async (
      request: FastifyRequest<{
        Params: { id: string }
        Body: z.infer<typeof UpdateJobScheduleSchema>
      }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        const job = await schedulerService.reschedule(
          request.params.id,
          request.body.schedule
        );
        reply.code(200).send(job);
      } catch (error: any) {
        logger.error({ error: error.message }, 'Failed to update schedule');
        if (error.message.includes('not found')) {
          reply.code(404).send({ error: error.message });
        } else {
          reply.code(400).send({ error: error.message });
        }
      }
    }
  });

  /**
   * POST /api/v1/scheduler/jobs/:id/pause
   * Pause job execution
   */
  fastify.post('/api/v1/scheduler/jobs/:id/pause', {
    schema: {
      params: zodToJsonSchema(z.object({ id: z.string().uuid() })),
      response: {
        200: zodToJsonSchema(z.object({ message: z.string() })),
        404: zodToJsonSchema(ErrorResponseSchema)
      }
    },
    handler: async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        await schedulerService.pauseJob(request.params.id);
        reply.code(200).send({ message: 'Job paused successfully' });
      } catch (error: any) {
        logger.error({ error: error.message }, 'Failed to pause job');
        reply.code(404).send({ error: error.message });
      }
    }
  });

  /**
   * POST /api/v1/scheduler/jobs/:id/resume
   * Resume paused job
   */
  fastify.post('/api/v1/scheduler/jobs/:id/resume', {
    schema: {
      params: zodToJsonSchema(z.object({ id: z.string().uuid() })),
      response: {
        200: zodToJsonSchema(z.object({ message: z.string() })),
        404: zodToJsonSchema(ErrorResponseSchema)
      }
    },
    handler: async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        await schedulerService.resumeJob(request.params.id);
        reply.code(200).send({ message: 'Job resumed successfully' });
      } catch (error: any) {
        logger.error({ error: error.message }, 'Failed to resume job');
        reply.code(404).send({ error: error.message });
      }
    }
  });

  /**
   * DELETE /api/v1/scheduler/jobs/:id
   * Delete job
   */
  fastify.delete('/api/v1/scheduler/jobs/:id', {
    schema: {
      params: zodToJsonSchema(z.object({ id: z.string().uuid() })),
      response: {
        204: z.void(),
        404: zodToJsonSchema(ErrorResponseSchema)
      }
    },
    handler: async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        await schedulerService.unschedule(request.params.id);
        reply.code(204).send();
      } catch (error: any) {
        logger.error({ error: error.message }, 'Failed to delete job');
        reply.code(404).send({ error: error.message });
      }
    }
  });

  // ==========================================
  // EXECUTION HISTORY ROUTES
  // ==========================================

  /**
   * GET /api/v1/scheduler/jobs/:id/executions
   * Get job execution history
   */
  fastify.get('/api/v1/scheduler/jobs/:id/executions', {
    schema: {
      params: zodToJsonSchema(z.object({ id: z.string().uuid() })),
      querystring: zodToJsonSchema(
        z.object({
          limit: z.coerce.number().int().min(1).max(100).default(20),
          offset: z.coerce.number().int().min(0).default(0),
          status: ExecutionStatusSchema.optional()
        })
      ),
      response: {
        200: zodToJsonSchema(z.array(ExecutionResponseSchema))
      }
    },
    handler: async (
      request: FastifyRequest<{
        Params: { id: string }
        Querystring: { limit?: number; offset?: number; status?: string }
      }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        const executions = await schedulerService.getJobHistory(
          request.params.id,
          request.query as any
        );
        reply.code(200).send(executions);
      } catch (error: any) {
        logger.error({ error: error.message }, 'Failed to get execution history');
        reply.code(500).send({ error: 'Internal server error' });
      }
    }
  });

  /**
   * GET /api/v1/scheduler/executions/:id
   * Get execution details
   */
  fastify.get('/api/v1/scheduler/executions/:id', {
    schema: {
      params: zodToJsonSchema(z.object({ id: z.string().uuid() })),
      response: {
        200: zodToJsonSchema(ExecutionResponseSchema),
        404: zodToJsonSchema(ErrorResponseSchema)
      }
    },
    handler: async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        const execution = await schedulerService.getExecution(request.params.id);
        if (!execution) {
          reply.code(404).send({ error: 'Execution not found' });
          return;
        }
        reply.code(200).send(execution);
      } catch (error: any) {
        logger.error({ error: error.message }, 'Failed to get execution');
        reply.code(500).send({ error: 'Internal server error' });
      }
    }
  });

  /**
   * POST /api/v1/scheduler/executions/:id/retry
   * Retry failed execution
   */
  fastify.post('/api/v1/scheduler/executions/:id/retry', {
    schema: {
      params: zodToJsonSchema(z.object({ id: z.string().uuid() })),
      response: {
        200: zodToJsonSchema(ExecutionResponseSchema),
        400: zodToJsonSchema(ErrorResponseSchema),
        404: zodToJsonSchema(ErrorResponseSchema)
      }
    },
    handler: async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        const result = await jobExecutor.retryExecution(request.params.id);
        reply.code(200).send(result);
      } catch (error: any) {
        logger.error({ error: error.message }, 'Failed to retry execution');
        if (error.message.includes('not found')) {
          reply.code(404).send({ error: error.message });
        } else {
          reply.code(400).send({ error: error.message });
        }
      }
    }
  });

  // ==========================================
  // EVENT TRIGGER ROUTES
  // ==========================================

  /**
   * POST /api/v1/scheduler/events/trigger
   * Manually trigger an event
   */
  fastify.post('/api/v1/scheduler/events/trigger', {
    schema: {
      body: zodToJsonSchema(
        z.object({
          event_name: z.string(),
          data: z.any(),
          platform_id: z.string().uuid().optional(),
          trace_id: z.string().optional()
        })
      ),
      response: {
        200: zodToJsonSchema(z.object({ message: z.string() }))
      }
    },
    handler: async (
      request: FastifyRequest<{
        Body: {
          event_name: string
          data: any
          platform_id?: string
          trace_id?: string
        }
      }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        await eventScheduler.triggerEvent(
          request.body.event_name,
          request.body.data,
          {
            platform_id: request.body.platform_id,
            trace_id: request.body.trace_id
          }
        );
        reply.code(200).send({ message: 'Event triggered successfully' });
      } catch (error: any) {
        logger.error({ error: error.message }, 'Failed to trigger event');
        reply.code(500).send({ error: 'Internal server error' });
      }
    }
  });
}
