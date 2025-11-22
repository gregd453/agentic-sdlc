/**
 * Job Handler Registry Service
 *
 * Manages registration and resolution of job handlers.
 * Supports three handler types:
 * 1. Function handlers - Direct TypeScript functions
 * 2. Agent handlers - Dispatch to agents via AgentRegistry
 * 3. Workflow handlers - Trigger workflows via WorkflowEngine
 *
 * Session #89: Phase 2 - Job Execution Engine
 */

import { logger } from '../utils/logger';
import { AgentRegistryService } from './agent-registry.service';
import { PlatformAwareWorkflowEngine } from './platform-aware-workflow-engine.service';

// ==========================================
// HANDLER TYPES
// ==========================================

export type JobHandler = (payload: any, context: JobExecutionContext) => Promise<any>;

export interface JobExecutionContext {
  job_id: string;
  execution_id: string;
  trace_id?: string;
  span_id?: string;
  timeout_ms: number;
  platform_id?: string;
}

export interface RegisteredHandler {
  name: string;
  handler: JobHandler;
  description?: string;
  timeout_ms?: number;
  registered_at: Date;
}

// ==========================================
// JOB HANDLER REGISTRY SERVICE
// ==========================================

export class JobHandlerRegistry {
  private handlers = new Map<string, RegisteredHandler>();

  constructor(
    private readonly agentRegistry: AgentRegistryService,
    private readonly workflowEngine: PlatformAwareWorkflowEngine
  ) {
    this.registerBuiltInHandlers();
  }

  // ==========================================
  // PUBLIC API
  // ==========================================

  /**
   * Register a function handler
   */
  registerHandler(
    name: string,
    handler: JobHandler,
    options?: {
      description?: string;
      timeout_ms?: number;
    }
  ): void {
    if (this.handlers.has(name)) {
      logger.warn({ handler_name: name }, 'Overwriting existing handler registration');
    }

    this.handlers.set(name, {
      name,
      handler,
      description: options?.description,
      timeout_ms: options?.timeout_ms,
      registered_at: new Date()
    });

    logger.info(
      { handler_name: name, description: options?.description },
      'Handler registered'
    );
  }

  /**
   * Unregister a handler
   */
  unregisterHandler(name: string): boolean {
    const removed = this.handlers.delete(name);
    if (removed) {
      logger.info({ handler_name: name }, 'Handler unregistered');
    }
    return removed;
  }

  /**
   * Resolve handler by name and type
   * Returns a JobHandler function that can be executed
   */
  async resolveHandler(handlerName: string, handlerType: string): Promise<JobHandler> {
    logger.debug({ handler_name: handlerName, handler_type: handlerType }, 'Resolving handler');

    switch (handlerType) {
      case 'function':
        return this.resolveFunctionHandler(handlerName);

      case 'agent':
        return this.resolveAgentHandler(handlerName);

      case 'workflow':
        return this.resolveWorkflowHandler(handlerName);

      default:
        throw new Error(`Unknown handler type: ${handlerType}`);
    }
  }

  /**
   * Check if handler is registered
   */
  hasHandler(name: string): boolean {
    return this.handlers.has(name);
  }

  /**
   * Get all registered handlers
   */
  listHandlers(): RegisteredHandler[] {
    return Array.from(this.handlers.values());
  }

  /**
   * Get handler metadata
   */
  getHandlerInfo(name: string): RegisteredHandler | undefined {
    return this.handlers.get(name);
  }

  // ==========================================
  // HANDLER RESOLUTION
  // ==========================================

  /**
   * Resolve function handler (direct TypeScript function)
   */
  private resolveFunctionHandler(name: string): JobHandler {
    const registered = this.handlers.get(name);

    if (!registered) {
      throw new Error(`Function handler not found: ${name}`);
    }

    return registered.handler;
  }

  /**
   * Resolve agent handler (dispatch to agent via AgentRegistry)
   */
  private resolveAgentHandler(agentType: string): JobHandler {
    return async (payload: any, context: JobExecutionContext): Promise<any> => {
      logger.info(
        {
          agent_type: agentType,
          job_id: context.job_id,
          execution_id: context.execution_id,
          platform_id: context.platform_id
        },
        'Dispatching job to agent'
      );

      // Validate agent exists
      try {
        await this.agentRegistry.validateAgentExists(
          agentType,
          context.platform_id || undefined
        );
      } catch (error: any) {
        logger.error(
          { agent_type: agentType, error: error.message },
          'Agent validation failed'
        );
        throw new Error(`Agent not found: ${agentType}. ${error.message}`);
      }

      // Create agent task via registry
      // Note: This will need integration with task creation system
      // For now, we'll return a placeholder
      return {
        status: 'dispatched',
        agent_type: agentType,
        payload,
        context
      };
    };
  }

  /**
   * Resolve workflow handler (trigger workflow via WorkflowEngine)
   */
  private resolveWorkflowHandler(workflowType: string): JobHandler {
    return async (payload: any, context: JobExecutionContext): Promise<any> => {
      logger.info(
        {
          workflow_type: workflowType,
          job_id: context.job_id,
          execution_id: context.execution_id,
          platform_id: context.platform_id
        },
        'Triggering workflow from job'
      );

      // Trigger workflow via engine
      // Note: This will need integration with workflow creation system
      // For now, we'll return a placeholder
      return {
        status: 'workflow_triggered',
        workflow_type: workflowType,
        payload,
        context
      };
    };
  }

  // ==========================================
  // BUILT-IN HANDLERS
  // ==========================================

  /**
   * Register built-in handlers that are always available
   */
  private registerBuiltInHandlers(): void {
    // 1. Knowledge Base Reindex Handler
    this.registerHandler(
      'kb:reindex',
      async (payload: any, context: JobExecutionContext) => {
        logger.info(
          { platform_id: context.platform_id, trace_id: context.trace_id },
          'Starting knowledge base reindex'
        );

        // TODO: Integrate with actual KB service
        // For now, simulate reindex operation
        const startTime = Date.now();

        // Simulate reindex work
        await new Promise(resolve => setTimeout(resolve, 100));

        const duration = Date.now() - startTime;

        logger.info(
          { platform_id: context.platform_id, duration_ms: duration },
          'Knowledge base reindex completed'
        );

        return {
          status: 'completed',
          documents_indexed: payload.document_count || 0,
          duration_ms: duration,
          timestamp: new Date()
        };
      },
      {
        description: 'Reindex knowledge base for a platform',
        timeout_ms: 300000 // 5 minutes
      }
    );

    // 2. Cleanup Handler
    this.registerHandler(
      'cleanup:old_traces',
      async (payload: any, context: JobExecutionContext) => {
        logger.info(
          { retention_days: payload.retention_days, trace_id: context.trace_id },
          'Starting trace cleanup'
        );

        // TODO: Integrate with actual trace cleanup service
        // For now, simulate cleanup operation
        const startTime = Date.now();

        // Simulate cleanup work
        await new Promise(resolve => setTimeout(resolve, 50));

        const duration = Date.now() - startTime;

        logger.info(
          { deleted_count: 0, duration_ms: duration },
          'Trace cleanup completed'
        );

        return {
          status: 'completed',
          deleted_traces: 0,
          retention_days: payload.retention_days || 30,
          duration_ms: duration,
          timestamp: new Date()
        };
      },
      {
        description: 'Clean up old traces and execution logs',
        timeout_ms: 600000 // 10 minutes
      }
    );

    // 3. Notification Handler
    this.registerHandler(
      'notify:send',
      async (payload: any, context: JobExecutionContext) => {
        logger.info(
          {
            notification_type: payload.type,
            recipient: payload.recipient,
            trace_id: context.trace_id
          },
          'Sending notification'
        );

        // TODO: Integrate with actual notification service
        // For now, simulate notification sending
        const startTime = Date.now();

        // Simulate notification work
        await new Promise(resolve => setTimeout(resolve, 20));

        const duration = Date.now() - startTime;

        logger.info(
          { notification_type: payload.type, duration_ms: duration },
          'Notification sent'
        );

        return {
          status: 'sent',
          notification_type: payload.type,
          recipient: payload.recipient,
          duration_ms: duration,
          timestamp: new Date()
        };
      },
      {
        description: 'Send notifications (email, webhook, etc)',
        timeout_ms: 30000 // 30 seconds
      }
    );

    // 4. Health Check Handler
    this.registerHandler(
      'health:check',
      async (payload: any, context: JobExecutionContext) => {
        logger.debug(
          { platform_id: context.platform_id, trace_id: context.trace_id },
          'Running scheduled health check'
        );

        // TODO: Integrate with actual health check service
        // For now, simulate health check
        const startTime = Date.now();

        const checks = {
          database: true,
          redis: true,
          agents: true,
          workflows: true
        };

        const duration = Date.now() - startTime;

        return {
          status: 'healthy',
          checks,
          duration_ms: duration,
          timestamp: new Date()
        };
      },
      {
        description: 'Periodic health check of system components',
        timeout_ms: 10000 // 10 seconds
      }
    );

    // 5. Metrics Collection Handler
    this.registerHandler(
      'metrics:collect',
      async (payload: any, context: JobExecutionContext) => {
        logger.debug(
          { metric_type: payload.metric_type, trace_id: context.trace_id },
          'Collecting metrics'
        );

        // TODO: Integrate with actual metrics service
        // For now, simulate metrics collection
        const startTime = Date.now();

        const metrics = {
          workflows_completed: 0,
          tasks_completed: 0,
          avg_duration_ms: 0,
          error_rate: 0
        };

        const duration = Date.now() - startTime;

        return {
          status: 'collected',
          metrics,
          duration_ms: duration,
          timestamp: new Date()
        };
      },
      {
        description: 'Collect and aggregate system metrics',
        timeout_ms: 30000 // 30 seconds
      }
    );

    logger.info(
      { handler_count: this.handlers.size },
      'Built-in handlers registered'
    );
  }
}
