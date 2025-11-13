import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { ScaffoldWorkflowService } from '../../services/scaffold-workflow.service';
import { WorkflowRepository } from '../../repositories/workflow.repository';
import { prisma } from '../../db/client';
import { z } from 'zod';

/**
 * Scaffold workflow routes
 * Happy path implementation for Milestone 1
 */

// Request schema for creating a scaffold workflow
const CreateScaffoldRequestSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  project_type: z.enum(['app', 'service', 'feature', 'capability']),
  requirements: z.array(z.string()).min(1),
  tech_stack: z.object({
    language: z.enum(['typescript', 'javascript']).default('typescript'),
    runtime: z.enum(['node', 'deno', 'bun']).default('node'),
    framework: z.string().optional(),
    testing: z.enum(['vitest', 'jest']).default('vitest'),
    package_manager: z.enum(['pnpm', 'npm', 'yarn']).default('pnpm')
  }).optional(),
  options: z.object({
    monorepo: z.boolean().default(false),
    git_init: z.boolean().default(true),
    install_deps: z.boolean().default(true)
  }).optional()
});

type CreateScaffoldRequest = z.infer<typeof CreateScaffoldRequestSchema>;

export const scaffoldRoutes: FastifyPluginAsync<any> = async (fastify, options: any) => {
  const repository = new WorkflowRepository(prisma);
  // Phase 2: agentDispatcher removed - ScaffoldWorkflowService no longer uses it
  const scaffoldService = new ScaffoldWorkflowService(repository);

  /**
   * Create a new scaffold workflow
   * POST /api/v1/scaffold
   */
  fastify.post<{ Body: CreateScaffoldRequest }>(
    '/scaffold',
    {
      schema: {
        description: 'Create a new scaffold workflow',
        tags: ['scaffold'],
        body: {
          type: 'object',
          required: ['name', 'description', 'project_type', 'requirements'],
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            project_type: { type: 'string', enum: ['app', 'service', 'feature', 'capability'] },
            requirements: { type: 'array', items: { type: 'string' } },
            tech_stack: { type: 'object' },
            options: { type: 'object' }
          }
        },
        response: {
          201: {
            description: 'Workflow created successfully',
            type: 'object',
            properties: {
              workflow_id: { type: 'string' },
              type: { type: 'string' },
              name: { type: 'string' },
              current_stage: { type: 'string' },
              progress: { type: 'number' },
              created_at: { type: 'string' }
            }
          },
          400: {
            description: 'Invalid request',
            type: 'object',
            properties: {
              error: { type: 'string' }
            }
          },
          500: {
            description: 'Internal server error',
            type: 'object',
            properties: {
              error: { type: 'string' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<{ Body: CreateScaffoldRequest }>, reply: FastifyReply) => {
      try {
        // Validate request body
        const validated = CreateScaffoldRequestSchema.parse(request.body);

        // Create scaffold workflow
        const workflow = await scaffoldService.createScaffoldWorkflow({
          name: validated.name,
          description: validated.description,
          project_type: validated.project_type,
          requirements: validated.requirements,
          tech_stack: validated.tech_stack,
          options: validated.options
        });

        // Return success response
        return reply.status(201).send({
          workflow_id: workflow.workflow_id,
          type: workflow.type,
          name: workflow.name,
          current_stage: workflow.current_stage,
          progress: workflow.progress,
          created_at: workflow.created_at
        });

      } catch (error) {
        fastify.log.error({ error }, 'Failed to create scaffold workflow');

        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Invalid request',
            details: error.errors
          });
        }

        return reply.status(500).send({
          error: error instanceof Error ? error.message : 'Internal server error'
        });
      }
    }
  );

  /**
   * Get scaffold workflow status
   * GET /api/v1/scaffold/:workflowId
   */
  fastify.get<{ Params: { workflowId: string } }>(
    '/scaffold/:workflowId',
    {
      schema: {
        description: 'Get scaffold workflow status',
        tags: ['scaffold'],
        params: {
          type: 'object',
          properties: {
            workflowId: { type: 'string' }
          },
          required: ['workflowId']
        },
        response: {
          200: {
            description: 'Workflow status',
            type: 'object',
            properties: {
              workflow_id: { type: 'string' },
              type: { type: 'string' },
              name: { type: 'string' },
              current_stage: { type: 'string' },
              progress: { type: 'number' },
              created_at: { type: 'string' },
              updated_at: { type: 'string' },
              completed_at: { type: 'string', nullable: true }
            }
          },
          404: {
            description: 'Workflow not found',
            type: 'object',
            properties: {
              error: { type: 'string' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<{ Params: { workflowId: string } }>, reply: FastifyReply) => {
      try {
        const { workflowId } = request.params;

        const workflow = await repository.findById(workflowId);

        if (!workflow) {
          return reply.status(404).send({
            error: 'Workflow not found'
          });
        }

        return reply.send({
          workflow_id: workflow.id,
          type: workflow.type,
          name: workflow.name,
          current_stage: workflow.current_stage,
          progress: workflow.progress,
          created_at: workflow.created_at.toISOString(),
          updated_at: workflow.updated_at.toISOString(),
          completed_at: workflow.completed_at?.toISOString() || null
        });

      } catch (error) {
        fastify.log.error({ error }, 'Failed to get workflow status');
        return reply.status(500).send({
          error: error instanceof Error ? error.message : 'Internal server error'
        });
      }
    }
  );

  // Phase 2: Result handlers removed - message bus handles subscription lifecycle
  // Cleanup is handled by OrchestratorContainer.shutdown()

  // Phase 2: No cleanup needed - message bus cleanup handled by container
};