import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { AgentRegistryService } from '../../services/agent-registry.service';
import { logger } from '../../utils/logger';

/**
 * Agent Discovery Endpoints
 * Enables dashboard and clients to dynamically discover agents
 */
export async function agentsRoutes(
  fastify: FastifyInstance,
  options: {
    agentRegistry: AgentRegistryService
  }
): Promise<void> {
  const { agentRegistry } = options;

  // List all agents for a platform
  fastify.get('/api/v1/agents', {
    schema: {
      tags: ['agents'],
      summary: 'List available agents',
      description: 'Returns a list of all available agents, optionally filtered by platform',
      querystring: zodToJsonSchema(z.object({
        platform: z.string().optional(),
        scope: z.enum(['all', 'global', 'platform']).optional()
      })),
      response: {
        200: zodToJsonSchema(z.array(z.object({
          type: z.string(),
          name: z.string(),
          version: z.string(),
          description: z.string().optional(),
          capabilities: z.array(z.string()),
          timeout_ms: z.number(),
          max_retries: z.number(),
          configSchema: z.any().optional(),
          scope: z.enum(['global', 'platform']),
          platformId: z.string().optional()
        })))
      }
    },
    handler: async (
      request: FastifyRequest<{ Querystring: { platform?: string; scope?: string } }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        const { platform: platformId, scope } = request.query;

        // Get agents list
        const agents = agentRegistry.listAgents(platformId);

        // Filter by scope if specified
        let filtered = agents;
        if (scope) {
          filtered = agents.filter(agent => agent.scope === scope);
        }

        logger.info('[GET /api/v1/agents] Listing agents', {
          platformId,
          scope,
          count: filtered.length
        });

        reply.code(200).send(filtered);
      } catch (error) {
        logger.error('[GET /api/v1/agents] Failed to list agents', { error });
        reply.code(500).send({
          error: 'Failed to list agents',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  });

  // Get details for a specific agent
  fastify.get('/api/v1/agents/:type', {
    schema: {
      tags: ['agents'],
      summary: 'Get agent details',
      description: 'Returns full metadata including configuration schema for a specific agent',
      params: zodToJsonSchema(z.object({
        type: z.string()
      })),
      querystring: zodToJsonSchema(z.object({
        platform: z.string().optional()
      })),
      response: {
        200: zodToJsonSchema(z.object({
          type: z.string(),
          name: z.string(),
          version: z.string(),
          description: z.string().optional(),
          capabilities: z.array(z.string()),
          timeout_ms: z.number(),
          max_retries: z.number(),
          configSchema: z.any().optional(),
          scope: z.enum(['global', 'platform']),
          platformId: z.string().optional()
        })),
        404: zodToJsonSchema(z.object({
          error: z.string(),
          message: z.string()
        }))
      }
    },
    handler: async (
      request: FastifyRequest<{ Params: { type: string }; Querystring: { platform?: string } }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        const { type } = request.params;
        const { platform: platformId } = request.query;

        const agent = agentRegistry.getAgentMetadata(type, platformId);

        logger.info('[GET /api/v1/agents/:type] Retrieved agent metadata', {
          type,
          platformId,
          version: agent.version
        });

        reply.code(200).send(agent);
      } catch (error) {
        logger.warn('[GET /api/v1/agents/:type] Agent not found', {
          type: request.params.type,
          platformId: request.query.platform
        });
        reply.code(404).send({
          error: 'Agent not found',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  });

  // Validate agent exists (before workflow submission)
  fastify.post('/api/v1/agents/validate', {
    schema: {
      tags: ['agents'],
      summary: 'Validate agent exists',
      description: 'Validates whether a specific agent is available, with suggestions for typos',
      body: zodToJsonSchema(z.object({
        agent_type: z.string(),
        platform_id: z.string().optional()
      })),
      response: {
        200: zodToJsonSchema(z.object({
          valid: z.boolean(),
          agent: z.object({
            type: z.string(),
            name: z.string(),
            version: z.string(),
            capabilities: z.array(z.string())
          }).optional(),
          suggestions: z.array(z.string()).optional()
        })),
        400: zodToJsonSchema(z.object({
          valid: z.boolean(),
          error: z.string(),
          suggestions: z.array(z.string()).optional()
        }))
      }
    },
    handler: async (
      request: FastifyRequest<{ Body: { agent_type: string; platform_id?: string } }>,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        const { agent_type, platform_id } = request.body;

        // Check if agent is registered
        const isValid = agentRegistry.isAgentRegistered(agent_type, platform_id);

        if (isValid) {
          const agent = agentRegistry.getAgentMetadata(agent_type, platform_id);
          logger.info('[POST /api/v1/agents/validate] Agent validation passed', {
            agent_type,
            platform_id,
            version: agent.version
          });

          reply.code(200).send({
            valid: true,
            agent: {
              type: agent.type,
              name: agent.name,
              version: agent.version,
              capabilities: agent.capabilities
            }
          });
        } else {
          // Get suggestions for similar agent types
          const availableAgents = agentRegistry.listAgents(platform_id);
          const availableTypes = availableAgents.map(a => a.type);

          // Simple typo suggestions
          const suggestions = availableTypes.filter(type =>
            type.includes(agent_type) || agent_type.includes(type)
          );

          logger.warn('[POST /api/v1/agents/validate] Agent validation failed', {
            agent_type,
            platform_id,
            suggestions: suggestions.slice(0, 3)
          });

          reply.code(400).send({
            valid: false,
            error: `Agent type '${agent_type}' not found${platform_id ? ` for platform '${platform_id}'` : ''}`,
            suggestions: suggestions.slice(0, 3)
          });
        }
      } catch (error) {
        logger.error('[POST /api/v1/agents/validate] Validation error', { error });
        reply.code(400).send({
          valid: false,
          error: error instanceof Error ? error.message : 'Validation error'
        });
      }
    }
  });

  logger.info('[AGENTS] Registered agent discovery routes');
}
