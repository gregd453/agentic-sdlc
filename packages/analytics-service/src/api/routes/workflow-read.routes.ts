import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { WorkflowRepository } from '../../repositories/workflow.repository'
import { logger } from '../../utils/logger'

export async function workflowReadRoutes(
  fastify: FastifyInstance,
  options: { workflowRepository: WorkflowRepository }
): Promise<void> {
  const { workflowRepository } = options

  // List workflows with filters
  fastify.get('/api/v1/workflows', {
    schema: {
      tags: ['workflows'],
      querystring: zodToJsonSchema(z.object({
        status: z.string().optional(),
        type: z.string().optional(),
        priority: z.string().optional()
      })),
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: true
          }
        }
      }
    },
    handler: async (
      request: FastifyRequest<{
        Querystring: {
          status?: string
          type?: string
          priority?: string
        }
      }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        const workflows = await workflowRepository.listWorkflows(request.query)
        reply.code(200).send(workflows)
      } catch (error) {
        logger.error('Failed to list workflows', { error })
        reply.code(500).send({
          error: 'Internal server error'
        })
      }
    }
  })

  // Get workflow by ID
  fastify.get('/api/v1/workflows/:id', {
    schema: {
      tags: ['workflows'],
      params: zodToJsonSchema(z.object({
        id: z.string().uuid()
      })),
      response: {
        200: {
          type: 'object',
          additionalProperties: true
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          },
          required: ['error']
        }
      }
    },
    handler: async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        const workflow = await workflowRepository.getWorkflow(request.params.id)
        if (!workflow) {
          reply.code(404).send({
            error: 'Workflow not found'
          })
          return
        }
        reply.code(200).send(workflow)
      } catch (error) {
        logger.error('Failed to get workflow', { error, id: request.params.id })
        reply.code(500).send({
          error: 'Internal server error'
        })
      }
    }
  })
}
