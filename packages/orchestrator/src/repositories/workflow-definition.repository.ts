import { PrismaClient, WorkflowDefinition } from '@prisma/client';
import { logger } from '../utils/logger';

export interface CreateWorkflowDefinitionRequest {
  platform_id: string;
  name: string;
  description?: string;
  definition: Record<string, any>;
  version?: string;
}

export interface UpdateWorkflowDefinitionRequest {
  name?: string;
  description?: string;
  definition?: Record<string, any>;
  version?: string;
  enabled?: boolean;
}

/**
 * WorkflowDefinitionRepository
 * Manages CRUD operations for workflow definitions
 * Enables platform-scoped workflow template management
 */
export class WorkflowDefinitionRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new workflow definition
   */
  async create(data: CreateWorkflowDefinitionRequest): Promise<WorkflowDefinition> {
    try {
      const definition = await this.prisma.workflowDefinition.create({
        data: {
          platform_id: data.platform_id,
          name: data.name,
          description: data.description,
          definition: data.definition,
          version: data.version || '1.0.0',
          enabled: true
        }
      });

      logger.info('[WorkflowDefinitionRepository] Workflow definition created', {
        id: definition.id,
        platform_id: data.platform_id,
        name: data.name,
        version: definition.version
      });

      return definition;
    } catch (error: any) {
      if (error.code === 'P2002') {
        // Unique constraint violation (platform_id + name)
        logger.warn('[WorkflowDefinitionRepository] Workflow definition with this name already exists for platform', {
          platform_id: data.platform_id,
          name: data.name
        });
        throw new Error(`Workflow definition '${data.name}' already exists for this platform`);
      }
      throw error;
    }
  }

  /**
   * Get a workflow definition by ID
   */
  async getById(id: string): Promise<WorkflowDefinition | null> {
    const definition = await this.prisma.workflowDefinition.findUnique({
      where: { id }
    });

    if (definition) {
      logger.debug('[WorkflowDefinitionRepository] Workflow definition retrieved', {
        id,
        name: definition.name
      });
    }

    return definition;
  }

  /**
   * Get a workflow definition by platform and name
   */
  async getByPlatformAndName(platformId: string, name: string): Promise<WorkflowDefinition | null> {
    return await this.prisma.workflowDefinition.findUnique({
      where: {
        platform_id_name: {
          platform_id: platformId,
          name
        }
      }
    });
  }

  /**
   * List all workflow definitions for a platform
   */
  async listByPlatform(platformId: string, includeDisabled: boolean = false): Promise<WorkflowDefinition[]> {
    const definitions = await this.prisma.workflowDefinition.findMany({
      where: {
        platform_id: platformId,
        ...(includeDisabled ? {} : { enabled: true })
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    logger.debug('[WorkflowDefinitionRepository] Listed workflow definitions for platform', {
      platform_id: platformId,
      count: definitions.length
    });

    return definitions;
  }

  /**
   * List all workflow definitions with optional filtering
   */
  async listAll(filters?: {
    platform_id?: string;
    enabled?: boolean;
  }): Promise<WorkflowDefinition[]> {
    return await this.prisma.workflowDefinition.findMany({
      where: filters,
      orderBy: {
        created_at: 'desc'
      }
    });
  }

  /**
   * Update a workflow definition
   */
  async update(id: string, data: UpdateWorkflowDefinitionRequest): Promise<WorkflowDefinition> {
    try {
      const definition = await this.prisma.workflowDefinition.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.definition !== undefined && { definition: data.definition }),
          ...(data.version !== undefined && { version: data.version }),
          ...(data.enabled !== undefined && { enabled: data.enabled }),
          updated_at: new Date()
        }
      });

      logger.info('[WorkflowDefinitionRepository] Workflow definition updated', {
        id,
        name: definition.name
      });

      return definition;
    } catch (error: any) {
      if (error.code === 'P2025') {
        logger.warn('[WorkflowDefinitionRepository] Workflow definition not found', { id });
        throw new Error('Workflow definition not found');
      }
      if (error.code === 'P2002') {
        logger.warn('[WorkflowDefinitionRepository] Workflow definition with this name already exists', {
          id,
          name: data.name
        });
        throw new Error(`Workflow definition '${data.name}' already exists for this platform`);
      }
      throw error;
    }
  }

  /**
   * Delete a workflow definition
   */
  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.workflowDefinition.delete({
        where: { id }
      });

      logger.info('[WorkflowDefinitionRepository] Workflow definition deleted', { id });
      return true;
    } catch (error: any) {
      if (error.code === 'P2025') {
        logger.warn('[WorkflowDefinitionRepository] Workflow definition not found for deletion', { id });
        return false;
      }
      throw error;
    }
  }

  /**
   * Enable/disable a workflow definition
   */
  async setEnabled(id: string, enabled: boolean): Promise<WorkflowDefinition> {
    const definition = await this.prisma.workflowDefinition.update({
      where: { id },
      data: {
        enabled,
        updated_at: new Date()
      }
    });

    logger.info('[WorkflowDefinitionRepository] Workflow definition status changed', {
      id,
      enabled
    });

    return definition;
  }

  /**
   * Get count of workflow definitions for a platform
   */
  async countByPlatform(platformId: string): Promise<number> {
    return await this.prisma.workflowDefinition.count({
      where: {
        platform_id: platformId,
        enabled: true
      }
    });
  }

  /**
   * Check if a workflow definition exists
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.workflowDefinition.count({
      where: { id }
    });
    return count > 0;
  }
}
