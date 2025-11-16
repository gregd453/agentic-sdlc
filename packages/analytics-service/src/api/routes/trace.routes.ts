import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { TraceService } from '../../services/trace.service'
import { logger } from '../../utils/logger'
import { NotFoundError } from '../../utils/errors'

export async function traceRoutes(
  fastify: FastifyInstance,
  options: { traceService: TraceService }
): Promise<void> {
  const { traceService } = options

  // Get trace details
  fastify.get('/api/v1/traces/:traceId', {
    schema: {
      tags: ['traces'],
      params: zodToJsonSchema(z.object({
        traceId: z.string()
      })),
      response: {
        200: {
          type: 'object',
          properties: {
            trace_id: { type: 'string' },
            metadata: {
              type: 'object',
              properties: {
                total_duration_ms: { type: ['number', 'null'] },
                span_count: { type: 'number' },
                error_count: { type: 'number' },
                workflow_count: { type: 'number' },
                task_count: { type: 'number' },
                start_time: { type: ['string', 'null'] },
                end_time: { type: ['string', 'null'] }
              }
            },
            hierarchy: { type: 'object', additionalProperties: true },
            tree: { type: 'array', items: { type: 'object', additionalProperties: true } }
          }
        },
        404: zodToJsonSchema(z.object({
          error: z.string()
        })),
        400: zodToJsonSchema(z.object({
          error: z.string()
        }))
      }
    },
    handler: async (
      request: FastifyRequest<{ Params: { traceId: string } }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        const { traceId } = request.params

        // Validate trace ID format
        if (!traceService.validateTraceId(traceId)) {
          reply.code(400).send({
            error: 'Invalid trace ID format'
          })
          return
        }

        const trace = await traceService.getTraceById(traceId)
        reply.code(200).send(trace)
      } catch (error) {
        if (error instanceof NotFoundError) {
          reply.code(404).send({
            error: error.message
          })
        } else {
          logger.error('Failed to get trace', { error, traceId: request.params.traceId })
          reply.code(500).send({
            error: 'Internal server error'
          })
        }
      }
    }
  })

  // Get trace spans
  fastify.get('/api/v1/traces/:traceId/spans', {
    schema: {
      tags: ['traces'],
      params: zodToJsonSchema(z.object({
        traceId: z.string()
      })),
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              span_id: { type: 'string' },
              trace_id: { type: 'string' },
              parent_span_id: { type: ['string', 'null'] },
              span_type: { type: 'string' },
              created_at: { type: 'string' },
              updated_at: { type: 'string' }
            }
          }
        },
        404: zodToJsonSchema(z.object({
          error: z.string()
        }))
      }
    },
    handler: async (
      request: FastifyRequest<{ Params: { traceId: string } }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        const spans = await traceService.getSpans(request.params.traceId)
        reply.code(200).send(spans)
      } catch (error) {
        if (error instanceof NotFoundError) {
          reply.code(404).send({
            error: error.message
          })
        } else {
          logger.error('Failed to get trace spans', { error, traceId: request.params.traceId })
          reply.code(500).send({
            error: 'Internal server error'
          })
        }
      }
    }
  })

  // Get workflows for a trace
  fastify.get('/api/v1/traces/:traceId/workflows', {
    schema: {
      tags: ['traces'],
      params: zodToJsonSchema(z.object({
        traceId: z.string()
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
      request: FastifyRequest<{ Params: { traceId: string } }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        const workflows = await traceService.getRelatedWorkflows(request.params.traceId)
        reply.code(200).send(workflows)
      } catch (error) {
        logger.error('Failed to get trace workflows', { error, traceId: request.params.traceId })
        reply.code(500).send({
          error: 'Internal server error'
        })
      }
    }
  })

  // Get tasks for a trace
  fastify.get('/api/v1/traces/:traceId/tasks', {
    schema: {
      tags: ['traces'],
      params: zodToJsonSchema(z.object({
        traceId: z.string()
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
      request: FastifyRequest<{ Params: { traceId: string } }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        const tasks = await traceService.getRelatedTasks(request.params.traceId)
        reply.code(200).send(tasks)
      } catch (error) {
        logger.error('Failed to get trace tasks', { error, traceId: request.params.traceId })
        reply.code(500).send({
          error: 'Internal server error'
        })
      }
    }
  })
}
