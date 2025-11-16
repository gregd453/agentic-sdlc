import { PrismaClient } from '@prisma/client'
import { logger } from '../utils/logger'

/**
 * Workflow Repository - Read-only methods for Analytics Service
 * This is a stub that implements only read operations from the orchestrator's WorkflowRepository
 */
export class WorkflowRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get a workflow by ID
   */
  async getWorkflow(id: string) {
    try {
      const workflow = await this.prisma.workflow.findUnique({
        where: { id },
        include: {
          stages: true
        }
      })

      if (!workflow) {
        logger.debug('Workflow not found', { id })
        return null
      }

      logger.debug('Workflow retrieved', { id, name: workflow.name })
      return workflow
    } catch (error) {
      logger.error('Failed to get workflow', { id, error })
      throw error
    }
  }

  /**
   * List workflows with optional filters
   */
  async listWorkflows(filters?: {
    status?: string
    type?: string
    priority?: string
  }) {
    try {
      const where: any = {}

      if (filters?.status) {
        where.status = filters.status
      }
      if (filters?.type) {
        where.type = filters.type
      }
      if (filters?.priority) {
        where.priority = filters.priority
      }

      const workflows = await this.prisma.workflow.findMany({
        where,
        include: {
          stages: true
        },
        orderBy: {
          created_at: 'desc'
        }
      })

      logger.debug('Workflows listed', { count: workflows.length, filters })
      return workflows
    } catch (error) {
      logger.error('Failed to list workflows', { error, filters })
      throw error
    }
  }

  /**
   * Get a task by ID
   */
  async getTaskById(taskId: string) {
    try {
      const task = await this.prisma.agentTask.findUnique({
        where: { id: taskId }
      })

      if (!task) {
        logger.debug('Task not found', { taskId })
        return null
      }

      logger.debug('Task retrieved', { taskId, agent_type: task.agent_type })
      return task
    } catch (error) {
      logger.error('Failed to get task', { taskId, error })
      throw error
    }
  }

  /**
   * List tasks with optional filters
   */
  async listTasks(filters?: {
    workflow_id?: string
    agent_type?: string
    status?: string
    limit?: number
    offset?: number
  }) {
    try {
      const where: any = {}
      const take = filters?.limit || 50
      const skip = filters?.offset || 0

      if (filters?.workflow_id) {
        where.workflow_id = filters.workflow_id
      }
      if (filters?.agent_type) {
        where.agent_type = filters.agent_type
      }
      if (filters?.status) {
        where.status = filters.status
      }

      const tasks = await this.prisma.agentTask.findMany({
        where,
        take,
        skip,
        orderBy: {
          assigned_at: 'desc'
        }
      })

      logger.debug('Tasks listed', { count: tasks.length, filters })
      return tasks
    } catch (error) {
      logger.error('Failed to list tasks', { error, filters })
      throw error
    }
  }
}
