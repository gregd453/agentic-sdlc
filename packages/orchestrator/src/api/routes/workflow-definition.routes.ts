import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { WorkflowDefinitionRepository } from '../../repositories/workflow-definition.repository';
import { logger } from '../../utils/logger';

/**
 * Workflow Definition Routes
 * CRUD operations for managing workflow definitions per platform
 * Enables template-based workflow creation and reuse
 */

const WorkflowDefinitionSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  definition: z.record(z.any()),
  version: z.string().optional().default('1.0.0')
});

const WorkflowDefinitionResponseSchema = z.object({
  id: z.string().uuid(),
  platform_id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional().nullable(),
  definition: z.record(z.any()),
  version: z.string(),
  enabled: z.boolean(),
  created_at: z.string(),
  updated_at: z.string()
});

export async function workflowDefinitionRoutes(
  fastify: FastifyInstance,
  options: { workflowDefinitionRepository: WorkflowDefinitionRepository }
): Promise<void> {
  const { workflowDefinitionRepository } = options;

  // Create workflow definition
  fastify.post('/api/v1/platforms/:platformId/workflow-definitions', {
    schema: {
      description: 'Create a new workflow definition for a platform',
      params: zodToJsonSchema(z.object({
        platformId: z.string().uuid()
      })),
      body: zodToJsonSchema(WorkflowDefinitionSchema),
      response: {
        201: zodToJsonSchema(WorkflowDefinitionResponseSchema),
        400: zodToJsonSchema(z.object({
          error: z.string(),
          message: z.string()
        })),
        409: zodToJsonSchema(z.object({
          error: z.string(),
          message: z.string()
        }))
      }
    },
    handler: async (
      request: FastifyRequest<{
        Params: { platformId: string };
        Body: z.infer<typeof WorkflowDefinitionSchema>;
      }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        const { platformId } = request.params;
        const { name, description, definition, version } = request.body;

        const workflowDef = await workflowDefinitionRepository.create({
          platform_id: platformId,
          name,
          description,
          definition,
          version
        });

        logger.info('[POST /workflow-definitions] Created workflow definition', {
          id: workflowDef.id,
          platform_id: platformId,
          name
        });

        reply.code(201).send(workflowDef);
      } catch (error: any) {
        if (error.message.includes('already exists')) {
          reply.code(409).send({
            error: 'Conflict',
            message: error.message
          });
        } else {
          logger.error('[POST /workflow-definitions] Failed to create workflow definition', { error });
          reply.code(400).send({
            error: 'Failed to create workflow definition',
            message: error.message || 'Unknown error'
          });
        }
      }
    }
  });

  // Get workflow definition by ID
  fastify.get('/api/v1/workflow-definitions/:id', {
    schema: {
      description: 'Get a workflow definition by ID',
      params: zodToJsonSchema(z.object({
        id: z.string().uuid()
      })),
      response: {
        200: zodToJsonSchema(WorkflowDefinitionResponseSchema),
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
        const definition = await workflowDefinitionRepository.getById(request.params.id);

        if (!definition) {
          reply.code(404).send({
            error: 'Workflow definition not found'
          });
          return;
        }

        logger.info('[GET /workflow-definitions/:id] Retrieved workflow definition', {
          id: request.params.id,
          name: definition.name
        });

        reply.code(200).send(definition);
      } catch (error) {
        logger.error('[GET /workflow-definitions/:id] Failed to get workflow definition', { error });
        reply.code(500).send({
          error: 'Internal server error'
        });
      }
    }
  });

  // List workflow definitions for a platform
  fastify.get('/api/v1/platforms/:platformId/workflow-definitions', {
    schema: {
      description: 'List all workflow definitions for a platform',
      params: zodToJsonSchema(z.object({
        platformId: z.string().uuid()
      })),
      querystring: zodToJsonSchema(z.object({
        includeDisabled: z.string().optional().transform(val => val === 'true')
      })),
      response: {
        200: zodToJsonSchema(z.array(WorkflowDefinitionResponseSchema))
      }
    },
    handler: async (
      request: FastifyRequest<{
        Params: { platformId: string };
        Querystring: { includeDisabled?: boolean };
      }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        const { platformId } = request.params;
        const includeDisabled = request.query.includeDisabled || false;

        const definitions = await workflowDefinitionRepository.listByPlatform(platformId, includeDisabled);

        logger.info('[GET /platforms/:platformId/workflow-definitions] Listed workflow definitions', {
          platform_id: platformId,
          count: definitions.length
        });

        reply.code(200).send(definitions);
      } catch (error) {
        logger.error('[GET /workflow-definitions] Failed to list workflow definitions', { error });
        reply.code(500).send({
          error: 'Internal server error'
        });
      }
    }
  });

  // Update workflow definition
  fastify.put('/api/v1/workflow-definitions/:id', {
    schema: {
      description: 'Update a workflow definition',
      params: zodToJsonSchema(z.object({
        id: z.string().uuid()
      })),
      body: zodToJsonSchema(WorkflowDefinitionSchema.partial()),
      response: {
        200: zodToJsonSchema(WorkflowDefinitionResponseSchema),
        404: zodToJsonSchema(z.object({
          error: z.string()
        })),
        409: zodToJsonSchema(z.object({
          error: z.string(),
          message: z.string()
        }))
      }
    },
    handler: async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: Partial<z.infer<typeof WorkflowDefinitionSchema>>;
      }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        const { id } = request.params;
        const updatedDef = await workflowDefinitionRepository.update(id, request.body);

        logger.info('[PUT /workflow-definitions/:id] Updated workflow definition', {
          id,
          name: updatedDef.name
        });

        reply.code(200).send(updatedDef);
      } catch (error: any) {
        if (error.message.includes('not found')) {
          reply.code(404).send({
            error: 'Workflow definition not found'
          });
        } else if (error.message.includes('already exists')) {
          reply.code(409).send({
            error: 'Conflict',
            message: error.message
          });
        } else {
          logger.error('[PUT /workflow-definitions/:id] Failed to update workflow definition', { error });
          reply.code(500).send({
            error: 'Internal server error'
          });
        }
      }
    }
  });

  // Delete workflow definition
  fastify.delete('/api/v1/workflow-definitions/:id', {
    schema: {
      description: 'Delete a workflow definition',
      params: zodToJsonSchema(z.object({
        id: z.string().uuid()
      })),
      response: {
        204: z.undefined(),
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
        const deleted = await workflowDefinitionRepository.delete(request.params.id);

        if (!deleted) {
          reply.code(404).send({
            error: 'Workflow definition not found'
          });
          return;
        }

        logger.info('[DELETE /workflow-definitions/:id] Deleted workflow definition', {
          id: request.params.id
        });

        reply.code(204).send();
      } catch (error) {
        logger.error('[DELETE /workflow-definitions/:id] Failed to delete workflow definition', { error });
        reply.code(500).send({
          error: 'Internal server error'
        });
      }
    }
  });

  // Enable/disable workflow definition
  fastify.patch('/api/v1/workflow-definitions/:id/enabled', {
    schema: {
      description: 'Enable or disable a workflow definition',
      params: zodToJsonSchema(z.object({
        id: z.string().uuid()
      })),
      body: zodToJsonSchema(z.object({
        enabled: z.boolean()
      })),
      response: {
        200: zodToJsonSchema(WorkflowDefinitionResponseSchema),
        404: zodToJsonSchema(z.object({
          error: z.string()
        }))
      }
    },
    handler: async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { enabled: boolean };
      }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        const definition = await workflowDefinitionRepository.setEnabled(request.params.id, request.body.enabled);

        logger.info('[PATCH /workflow-definitions/:id/enabled] Updated workflow definition status', {
          id: request.params.id,
          enabled: request.body.enabled
        });

        reply.code(200).send(definition);
      } catch (error) {
        logger.error('[PATCH /workflow-definitions/:id/enabled] Failed to update workflow definition status', { error });
        reply.code(500).send({
          error: 'Internal server error'
        });
      }
    }
  });

  logger.info('[WORKFLOW-DEFINITIONS] Registered workflow definition CRUD routes');
}
