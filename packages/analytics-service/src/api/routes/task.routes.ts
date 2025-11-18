import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { WorkflowRepository } from '../../repositories/workflow.repository'
import { logger } from '../../utils/logger'

export async function taskRoutes(
  fastify: FastifyInstance,
  options: { workflowRepository: WorkflowRepository }
): Promise<void> {
  const { workflowRepository } = options

  // List tasks with filters
  fastify.get('/api/v1/tasks', {
    schema: {
      tags: ['tasks'],
      querystring: zodToJsonSchema(z.object({
        workflow_id: z.string().uuid().optional(),
        agent_type: z.string().optional(),
        status: z.string().optional(),
        limit: z.coerce.number().min(1).max(100).optional(),
        offset: z.coerce.number().min(0).optional()
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
          workflow_id?: string
          agent_type?: string
          status?: string
          limit?: number
          offset?: number
        }
      }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        const tasks = await workflowRepository.listTasks(request.query)
        reply.code(200).send(tasks)
      } catch (error) {
        logger.error('Failed to list tasks', { error, query: request.query })
        reply.code(500).send({
          error: 'Internal server error'
        })
      }
    }
  })

  // Get task by ID
  fastify.get('/api/v1/tasks/:taskId', {
    schema: {
      tags: ['tasks'],
      params: zodToJsonSchema(z.object({
        taskId: z.string()
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
      request: FastifyRequest<{ Params: { taskId: string } }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        const task = await workflowRepository.getTaskById(request.params.taskId)
        if (!task) {
          reply.code(404).send({
            error: 'Task not found'
          })
          return
        }
        reply.code(200).send(task)
      } catch (error) {
        logger.error('Failed to get task', { error, taskId: request.params.taskId })
        reply.code(500).send({
          error: 'Internal server error'
        })
      }
    }
  })
}
