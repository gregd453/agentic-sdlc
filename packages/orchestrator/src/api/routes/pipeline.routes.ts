import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  PipelineDefinitionSchema,
  PipelineWebhookSchema,
  PipelineDefinition,
  PipelineWebhook,
  PipelineControl
} from '../../types/pipeline.types';
import { PipelineExecutorService } from '../../services/pipeline-executor.service';
import { logger } from '../../utils/logger';
import { metrics } from '../../utils/metrics';

/**
 * Pipeline API routes
 */
export async function pipelineRoutes(
  fastify: FastifyInstance,
  options: { pipelineExecutor: PipelineExecutorService }
) {
  const { pipelineExecutor } = options;

  /**
   * @route POST /api/v1/pipelines
   * @description Start a new pipeline execution
   */
  fastify.post<{
    Body: PipelineDefinition & {
      trigger?: 'manual' | 'webhook' | 'schedule' | 'event';
      triggered_by?: string;
      commit_sha?: string;
      branch?: string;
      metadata?: Record<string, unknown>;
    };
  }>(
    '/api/v1/pipelines',
    {
      schema: {
        description: 'Start a new pipeline execution',
        tags: ['pipelines'],
        body: {
          type: 'object',
          required: ['id', 'workflow_id', 'name', 'stages'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            workflow_id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string' },
            stages: { type: 'array' },
            trigger: { type: 'string', enum: ['manual', 'webhook', 'schedule', 'event'] },
            triggered_by: { type: 'string' },
            commit_sha: { type: 'string' },
            branch: { type: 'string' },
            metadata: { type: 'object' }
          }
        },
        response: {
          201: {
            type: 'object',
            properties: {
              execution_id: { type: 'string', format: 'uuid' },
              pipeline_id: { type: 'string', format: 'uuid' },
              workflow_id: { type: 'string', format: 'uuid' },
              status: { type: 'string' },
              started_at: { type: 'string', format: 'date-time' }
            }
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' }
            }
          }
        }
      }
    },
    async (
      request: FastifyRequest<{
        Body: PipelineDefinition & {
          trigger?: 'manual' | 'webhook' | 'schedule' | 'event';
          triggered_by?: string;
          commit_sha?: string;
          branch?: string;
          metadata?: Record<string, unknown>;
        };
      }>,
      reply: FastifyReply
    ) => {
      const startTime = Date.now();

      try {
        const {
          trigger = 'manual',
          triggered_by = 'api',
          commit_sha,
          branch,
          metadata,
          ...definition
        } = request.body;

        // Validate pipeline definition
        const validatedDefinition = PipelineDefinitionSchema.parse(definition);

        // Start pipeline execution
        const execution = await pipelineExecutor.startPipeline(
          validatedDefinition,
          trigger,
          triggered_by,
          {
            commitSha: commit_sha,
            branch,
            metadata
          }
        );

        metrics.increment('api.pipeline.start', {
          pipeline_id: execution.pipeline_id
        });

        logger.info('Pipeline execution started via API', {
          execution_id: execution.id,
          pipeline_id: execution.pipeline_id,
          workflow_id: execution.workflow_id
        });

        return reply.code(201).send({
          execution_id: execution.id,
          pipeline_id: execution.pipeline_id,
          workflow_id: execution.workflow_id,
          status: execution.status,
          started_at: execution.started_at
        });
      } catch (error) {
        logger.error('Failed to start pipeline execution', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        metrics.increment('api.pipeline.start.error');

        return reply.code(400).send({
          error: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Failed to start pipeline'
        });
      } finally {
        metrics.recordDuration('api.pipeline.start.duration', Date.now() - startTime);
      }
    }
  );

  /**
   * @route GET /api/v1/pipelines/:executionId
   * @description Get pipeline execution status
   */
  fastify.get<{
    Params: { executionId: string };
  }>(
    '/api/v1/pipelines/:executionId',
    {
      schema: {
        description: 'Get pipeline execution status',
        tags: ['pipelines'],
        params: {
          type: 'object',
          properties: {
            executionId: { type: 'string', format: 'uuid' }
          },
          required: ['executionId']
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              pipeline_id: { type: 'string', format: 'uuid' },
              workflow_id: { type: 'string', format: 'uuid' },
              status: { type: 'string' },
              current_stage: { type: 'string' },
              started_at: { type: 'string', format: 'date-time' },
              completed_at: { type: 'string', format: 'date-time' },
              duration_ms: { type: 'number' },
              stage_results: { type: 'array' },
              artifacts: { type: 'array' }
            }
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<{ Params: { executionId: string } }>, reply: FastifyReply) => {
      try {
        const { executionId } = request.params;

        const execution = await pipelineExecutor.getExecution(executionId);

        if (!execution) {
          return reply.code(404).send({
            error: 'NOT_FOUND',
            message: `Pipeline execution ${executionId} not found`
          });
        }

        metrics.increment('api.pipeline.get', {
          status: execution.status
        });

        return reply.code(200).send(execution);
      } catch (error) {
        logger.error('Failed to get pipeline execution', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        return reply.code(500).send({
          error: 'INTERNAL_ERROR',
          message: 'Failed to retrieve pipeline execution'
        });
      }
    }
  );

  /**
   * @route POST /api/v1/pipelines/:executionId/control
   * @description Control pipeline execution (pause, resume, cancel)
   */
  fastify.post<{
    Params: { executionId: string };
    Body: Omit<PipelineControl, 'execution_id'>;
  }>(
    '/api/v1/pipelines/:executionId/control',
    {
      schema: {
        description: 'Control pipeline execution',
        tags: ['pipelines'],
        params: {
          type: 'object',
          properties: {
            executionId: { type: 'string', format: 'uuid' }
          },
          required: ['executionId']
        },
        body: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['pause', 'resume', 'cancel', 'retry']
            },
            stage_id: { type: 'string' },
            reason: { type: 'string' }
          },
          required: ['action']
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' }
            }
          }
        }
      }
    },
    async (
      request: FastifyRequest<{
        Params: { executionId: string };
        Body: Omit<PipelineControl, 'execution_id'>;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { executionId } = request.params;
        const { action, reason } = request.body;

        logger.info('Pipeline control action requested', {
          execution_id: executionId,
          action,
          reason
        });

        switch (action) {
          case 'pause':
            await pipelineExecutor.pauseExecution(executionId);
            break;
          case 'resume':
            await pipelineExecutor.resumeExecution(executionId);
            break;
          case 'cancel':
            await pipelineExecutor.cancelExecution(executionId);
            break;
          case 'retry':
            // Note: Retry functionality would need to be implemented
            throw new Error('Retry functionality not yet implemented');
          default:
            throw new Error(`Unknown action: ${action}`);
        }

        metrics.increment('api.pipeline.control', {
          action
        });

        return reply.code(200).send({
          success: true,
          message: `Pipeline execution ${action} successful`
        });
      } catch (error) {
        logger.error('Failed to control pipeline execution', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        return reply.code(400).send({
          error: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Failed to control pipeline'
        });
      }
    }
  );

  /**
   * @route POST /api/v1/pipelines/webhook
   * @description Receive webhook from GitHub/GitLab CI
   */
  fastify.post<{
    Body: PipelineWebhook;
    Headers: {
      'x-github-event'?: string;
      'x-gitlab-event'?: string;
      'x-hub-signature-256'?: string;
    };
  }>(
    '/api/v1/pipelines/webhook',
    {
      schema: {
        description: 'Receive pipeline webhook from CI/CD providers',
        tags: ['pipelines'],
        body: {
          type: 'object',
          required: ['source', 'event', 'repository', 'branch', 'commit_sha', 'author', 'timestamp', 'payload'],
          properties: {
            source: { type: 'string', enum: ['github', 'gitlab', 'manual'] },
            event: { type: 'string' },
            repository: { type: 'string' },
            branch: { type: 'string' },
            commit_sha: { type: 'string' },
            commit_message: { type: 'string' },
            author: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
            payload: { type: 'object' }
          }
        },
        response: {
          202: {
            type: 'object',
            properties: {
              accepted: { type: 'boolean' },
              execution_id: { type: 'string', format: 'uuid' }
            }
          }
        }
      }
    },
    async (
      request: FastifyRequest<{
        Body: PipelineWebhook;
        Headers: {
          'x-github-event'?: string;
          'x-gitlab-event'?: string;
          'x-hub-signature-256'?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const webhook = PipelineWebhookSchema.parse(request.body);

        logger.info('Pipeline webhook received', {
          source: webhook.source,
          event: webhook.event,
          repository: webhook.repository,
          branch: webhook.branch,
          commit_sha: webhook.commit_sha
        });

        // TODO: Implement webhook signature verification
        // TODO: Map webhook to pipeline definition
        // TODO: Start pipeline execution

        metrics.increment('api.pipeline.webhook', {
          source: webhook.source,
          event: webhook.event
        });

        return reply.code(202).send({
          accepted: true,
          execution_id: TASK_STATUS.PENDING // Would return actual execution ID
        });
      } catch (error) {
        logger.error('Failed to process pipeline webhook', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        return reply.code(400).send({
          error: 'BAD_REQUEST',
          message: 'Invalid webhook payload'
        });
      }
    }
  );
}
