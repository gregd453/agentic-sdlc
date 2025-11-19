import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { CreateWorkflowSchema, WorkflowResponseSchema } from '../../types';
import { WorkflowService } from '../../services/workflow.service';
import { WorkflowRepository } from '../../repositories/workflow.repository';
import { logger } from '../../utils/logger';

export async function workflowRoutes(
  fastify: FastifyInstance,
  options: { workflowService: WorkflowService; workflowRepository: WorkflowRepository }
): Promise<void> {
  const { workflowService, workflowRepository } = options;

  // Create workflow
  fastify.post('/api/v1/workflows', {
    schema: {
      body: zodToJsonSchema(CreateWorkflowSchema),
      response: {
        200: zodToJsonSchema(WorkflowResponseSchema),
        400: zodToJsonSchema(z.object({
          error: z.string(),
          details: z.array(z.string()).optional()
        }))
      }
    },
    handler: async (
      request: FastifyRequest<{ Body: z.infer<typeof CreateWorkflowSchema> }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        const validated = CreateWorkflowSchema.parse(request.body);
        const workflow = await workflowService.createWorkflow(validated);
        reply.code(200).send(workflow);
      } catch (error) {
        if (error instanceof z.ZodError) {
          reply.code(400).send({
            error: 'Validation failed',
            details: error.errors.map(e => e.message)
          });
        } else {
          logger.error('Failed to create workflow', { error });
          reply.code(500).send({
            error: 'Internal server error'
          });
        }
      }
    }
  });

  // Get workflow by ID
  fastify.get('/api/v1/workflows/:id', {
    schema: {
      params: zodToJsonSchema(z.object({
        id: z.string().uuid()
      })),
      response: {
        200: zodToJsonSchema(WorkflowResponseSchema),
        404: zodToJsonSchema(z.object({
          error: z.string()
        }))
      }
    },
    handler: async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        const workflow = await workflowService.getWorkflow(request.params.id);
        if (!workflow) {
          reply.code(404).send({
            error: 'Workflow not found'
          });
          return;
        }
        reply.code(200).send(workflow);
      } catch (error) {
        logger.error('Failed to get workflow', { error, id: request.params.id });
        reply.code(500).send({
          error: 'Internal server error'
        });
      }
    }
  });

  // Get workflow tasks by workflow ID
  fastify.get('/api/v1/workflows/:id/tasks', {
    schema: {
      params: zodToJsonSchema(z.object({
        id: z.string().uuid()
      })),
      response: {
        200: zodToJsonSchema(z.array(z.object({
          id: z.string(),
          task_id: z.string(),
          workflow_id: z.string(),
          agent_type: z.string(),
          status: z.string(),
          priority: z.string(),
          payload: z.any().optional(),
          result: z.any().optional(),
          trace_id: z.string().optional(),
          assigned_at: z.string().optional(),
          started_at: z.string().optional(),
          completed_at: z.string().optional(),
          retry_count: z.number().optional(),
          max_retries: z.number().optional(),
          timeout_ms: z.number().optional()
        }))),
        404: zodToJsonSchema(z.object({
          error: z.string()
        }))
      }
    },
    handler: async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        const tasks = await workflowRepository.getWorkflowTasks(request.params.id);

        logger.info('[GET /api/v1/workflows/:id/tasks] Retrieved workflow tasks', {
          workflowId: request.params.id,
          taskCount: tasks.length
        });

        reply.code(200).send(tasks);
      } catch (error) {
        logger.error('[GET /api/v1/workflows/:id/tasks] Failed to get workflow tasks', {
          error,
          workflowId: request.params.id
        });
        reply.code(500).send({
          error: 'Internal server error'
        });
      }
    }
  });

  // List workflows
  fastify.get('/api/v1/workflows', {
    schema: {
      querystring: zodToJsonSchema(z.object({
        status: z.string().optional(),
        type: z.string().optional(),
        priority: z.string().optional()
      })),
      response: {
        200: zodToJsonSchema(z.array(WorkflowResponseSchema))
      }
    },
    handler: async (
      request: FastifyRequest<{
        Querystring: {
          status?: string;
          type?: string;
          priority?: string;
        }
      }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        const workflows = await workflowService.listWorkflows(request.query);
        reply.code(200).send(workflows);
      } catch (error) {
        logger.error('Failed to list workflows', { error });
        reply.code(500).send({
          error: 'Internal server error'
        });
      }
    }
  });

  // Cancel workflow
  fastify.post('/api/v1/workflows/:id/cancel', {
    schema: {
      params: zodToJsonSchema(z.object({
        id: z.string().uuid()
      })),
      response: {
        200: zodToJsonSchema(z.object({
          message: z.string()
        })),
        404: zodToJsonSchema(z.object({
          error: z.string()
        }))
      }
    },
    handler: async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        await workflowService.cancelWorkflow(request.params.id);
        reply.code(200).send({
          message: 'Workflow cancelled successfully'
        });
      } catch (error: any) {
        if (error.code === 'NOT_FOUND') {
          reply.code(404).send({
            error: error.message
          });
        } else {
          logger.error('Failed to cancel workflow', { error, id: request.params.id });
          reply.code(500).send({
            error: 'Internal server error'
          });
        }
      }
    }
  });

  // Retry workflow
  fastify.post('/api/v1/workflows/:id/retry', {
    schema: {
      params: zodToJsonSchema(z.object({
        id: z.string().uuid()
      })),
      body: zodToJsonSchema(z.object({
        from_stage: z.string().optional()
      })),
      response: {
        200: zodToJsonSchema(z.object({
          message: z.string()
        })),
        404: zodToJsonSchema(z.object({
          error: z.string()
        }))
      }
    },
    handler: async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { from_stage?: string };
      }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        await workflowService.retryWorkflow(
          request.params.id,
          request.body.from_stage
        );
        reply.code(200).send({
          message: 'Workflow retry initiated successfully'
        });
      } catch (error: any) {
        if (error.code === 'NOT_FOUND') {
          reply.code(404).send({
            error: error.message
          });
        } else {
          logger.error('Failed to retry workflow', { error, id: request.params.id });
          reply.code(500).send({
            error: 'Internal server error'
          });
        }
      }
    }
  });

  // Health check
  fastify.get('/api/v1/health', {
    schema: {
      response: {
        200: zodToJsonSchema(z.object({
          status: z.string(),
          timestamp: z.string()
        }))
      }
    },
    handler: async (_, reply): Promise<void> => {
      reply.code(200).send({
        status: 'healthy',
        timestamp: new Date().toISOString()
      });
    }
  });
}