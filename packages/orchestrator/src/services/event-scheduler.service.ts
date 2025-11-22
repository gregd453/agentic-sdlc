/**
 * Event Scheduler Service
 *
 * Handles event-based job triggering:
 * - Listens to platform events
 * - Triggers registered event handlers
 * - Creates one-time jobs for event-driven execution
 * - Tracks event handler statistics
 *
 * Session #89: Phase 3 - Message Bus Integration
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';
import { IMessageBus } from '../hexagonal/ports/message-bus.port';
import { SchedulerService } from './scheduler.service';

// ==========================================
// EVENT TYPES
// ==========================================

export interface EventTrigger {
  event_name: string;
  data: any;
  platform_id?: string;
  trace_id?: string;
  timestamp: Date;
}

export interface EventHandlerExecution {
  handler_id: string;
  event_name: string;
  job_id?: string;
  status: 'triggered' | 'failed' | 'skipped';
  error?: string;
  duration_ms: number;
}

// ==========================================
// EVENT SCHEDULER SERVICE
// ==========================================

export class EventSchedulerService {
  private eventSubscriptions = new Map<string, () => Promise<void>>();
  private isInitialized = false;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly messageBus: IMessageBus,
    private readonly schedulerService: SchedulerService
  ) {}

  // ==========================================
  // INITIALIZATION
  // ==========================================

  /**
   * Initialize event subscriptions from database
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('EventSchedulerService already initialized');
      return;
    }

    logger.info('Initializing EventSchedulerService');

    try {
      // Load all active event handlers from database with timeout
      const handlers = await Promise.race([
        this.prisma.eventHandler.findMany({
          where: { enabled: true }
        }),
        new Promise<any[]>((_, reject) =>
          setTimeout(() => reject(new Error('Database query timeout after 5s')), 5000)
        )
      ]);

      logger.info({ handler_count: handlers.length }, 'Loading event handlers');

      // Subscribe to each unique event
      const uniqueEvents = new Set(handlers.map(h => h.event_name));

      // Subscribe to events in parallel with individual timeouts
      const subscriptionPromises = Array.from(uniqueEvents).map(async (eventName) => {
        try {
          // Wrap subscription in timeout to prevent hanging
          await Promise.race([
            this.subscribeToEvent(eventName),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error(`Subscription timeout for event: ${eventName}`)), 3000)
            )
          ]);
          logger.debug({ event_name: eventName }, 'Successfully subscribed to event');
        } catch (error: any) {
          logger.warn(
            { event_name: eventName, error: error.message },
            'Failed to subscribe to event, will retry later'
          );
        }
      });

      // Wait for all subscriptions to complete or timeout
      await Promise.allSettled(subscriptionPromises);

      this.isInitialized = true;

      logger.info(
        {
          handler_count: handlers.length,
          event_count: uniqueEvents.size,
          subscribed_count: this.eventSubscriptions.size
        },
        'EventSchedulerService initialized'
      );
    } catch (error: any) {
      logger.warn(
        { error: error.message },
        '[EventSchedulerService] Failed to load initial event handlers, continuing anyway'
      );
      // Mark as initialized even if loading fails - handlers can be registered later
      this.isInitialized = true;
    }
  }

  // ==========================================
  // EVENT SUBSCRIPTION
  // ==========================================

  /**
   * Subscribe to an event on the message bus
   */
  private async subscribeToEvent(eventName: string): Promise<void> {
    if (this.eventSubscriptions.has(eventName)) {
      logger.debug({ event_name: eventName }, 'Already subscribed to event');
      return;
    }

    logger.info({ event_name: eventName }, 'Subscribing to event');

    try {
      // Subscribe to message bus - returns unsubscribe function
      // Note: This starts a background Redis stream consumer loop
      const unsubscribe = await this.messageBus.subscribe(eventName, async (data: any) => {
        await this.handleEvent({
          event_name: eventName,
          data,
          platform_id: data.platform_id,
          trace_id: data.trace_id,
          timestamp: new Date()
        });
      });

      this.eventSubscriptions.set(eventName, unsubscribe);

      logger.debug({ event_name: eventName }, 'Subscribed to event');
    } catch (error: any) {
      logger.error(
        { event_name: eventName, error: error.message },
        'Failed to subscribe to event'
      );
      throw error;
    }
  }

  /**
   * Unsubscribe from an event
   */
  private async unsubscribeFromEvent(eventName: string): Promise<void> {
    const unsubscribe = this.eventSubscriptions.get(eventName);

    if (!unsubscribe) {
      return;
    }

    logger.info({ event_name: eventName }, 'Unsubscribing from event');

    // Call unsubscribe function returned by subscribe
    await unsubscribe();

    this.eventSubscriptions.delete(eventName);

    logger.debug({ event_name: eventName }, 'Unsubscribed from event');
  }

  // ==========================================
  // EVENT HANDLING
  // ==========================================

  /**
   * Handle incoming event and trigger associated handlers
   */
  private async handleEvent(trigger: EventTrigger): Promise<void> {
    const startTime = Date.now();

    logger.info(
      {
        event_name: trigger.event_name,
        platform_id: trigger.platform_id,
        trace_id: trigger.trace_id
      },
      'Handling event trigger'
    );

    try {
      // Find all enabled handlers for this event
      const handlers = await this.findHandlersForEvent(
        trigger.event_name,
        trigger.platform_id
      );

      if (handlers.length === 0) {
        logger.debug(
          { event_name: trigger.event_name },
          'No handlers found for event'
        );
        return;
      }

      logger.info(
        {
          event_name: trigger.event_name,
          handler_count: handlers.length
        },
        'Triggering event handlers'
      );

      // Execute each handler
      const executions = await Promise.allSettled(
        handlers.map(handler => this.executeEventHandler(handler, trigger))
      );

      // Count results
      const succeeded = executions.filter(e => e.status === 'fulfilled').length;
      const failed = executions.filter(e => e.status === 'rejected').length;

      const duration = Date.now() - startTime;

      logger.info(
        {
          event_name: trigger.event_name,
          handlers_triggered: handlers.length,
          succeeded,
          failed,
          duration_ms: duration
        },
        'Event handling completed'
      );
    } catch (error: any) {
      logger.error(
        {
          event_name: trigger.event_name,
          error: error.message,
          stack: error.stack
        },
        'Error handling event'
      );
    }
  }

  /**
   * Find all handlers for a specific event
   */
  private async findHandlersForEvent(
    eventName: string,
    platformId?: string
  ): Promise<any[]> {
    const where: any = {
      event_name: eventName,
      enabled: true
    };

    // Filter by platform if specified, or include global handlers (platform_id = null)
    if (platformId) {
      where.OR = [{ platform_id: platformId }, { platform_id: null }];
    } else {
      where.platform_id = null;
    }

    return this.prisma.eventHandler.findMany({
      where,
      orderBy: { priority: 'desc' }
    });
  }

  /**
   * Execute a single event handler
   */
  private async executeEventHandler(
    handler: any,
    trigger: EventTrigger
  ): Promise<EventHandlerExecution> {
    const startTime = Date.now();

    logger.debug(
      {
        handler_id: handler.id,
        handler_name: handler.handler_name,
        event_name: trigger.event_name
      },
      'Executing event handler'
    );

    try {
      let jobId: string | undefined;

      // Determine action based on action_type
      switch (handler.action_type) {
        case 'create_job':
          jobId = await this.createJobFromEvent(handler, trigger);
          break;

        case 'trigger_workflow':
          await this.triggerWorkflowFromEvent(handler, trigger);
          break;

        case 'dispatch_agent':
          await this.dispatchAgentFromEvent(handler, trigger);
          break;

        default:
          // No action specified - just log the event
          logger.info(
            {
              handler_id: handler.id,
              event_name: trigger.event_name
            },
            'Event handler triggered (no action specified)'
          );
      }

      // Update handler statistics
      await this.updateHandlerStats(handler.id, true);

      const duration = Date.now() - startTime;

      logger.debug(
        {
          handler_id: handler.id,
          job_id: jobId,
          duration_ms: duration
        },
        'Event handler executed successfully'
      );

      return {
        handler_id: handler.id,
        event_name: trigger.event_name,
        job_id: jobId,
        status: 'triggered',
        duration_ms: duration
      };
    } catch (error: any) {
      logger.error(
        {
          handler_id: handler.id,
          event_name: trigger.event_name,
          error: error.message
        },
        'Event handler execution failed'
      );

      // Update handler statistics
      await this.updateHandlerStats(handler.id, false);

      const duration = Date.now() - startTime;

      return {
        handler_id: handler.id,
        event_name: trigger.event_name,
        status: 'failed',
        error: error.message,
        duration_ms: duration
      };
    }
  }

  // ==========================================
  // HANDLER ACTIONS
  // ==========================================

  /**
   * Create a one-time job triggered by an event
   */
  private async createJobFromEvent(
    handler: any,
    trigger: EventTrigger
  ): Promise<string> {
    const config = handler.action_config || {};

    const job = await this.schedulerService.scheduleOnce({
      name: `${handler.event_name}:${handler.handler_name}`,
      description: `Triggered by event: ${trigger.event_name}`,
      execute_at: new Date(), // Execute immediately
      handler_name: config.handler_name || handler.handler_name,
      handler_type: config.handler_type || handler.handler_type,
      payload: {
        ...config.payload,
        event_data: trigger.data,
        event_name: trigger.event_name,
        triggered_at: trigger.timestamp
      },
      platform_id: trigger.platform_id,
      created_by: 'event-scheduler',
      max_retries: config.max_retries || 3,
      timeout_ms: config.timeout_ms || 300000,
      tags: ['event-triggered', trigger.event_name]
    });

    logger.info(
      {
        handler_id: handler.id,
        job_id: job.id,
        event_name: trigger.event_name
      },
      'Job created from event'
    );

    return job.id;
  }

  /**
   * Trigger a workflow from an event
   */
  private async triggerWorkflowFromEvent(
    handler: any,
    trigger: EventTrigger
  ): Promise<void> {
    logger.info(
      {
        handler_id: handler.id,
        event_name: trigger.event_name
      },
      'Triggering workflow from event (placeholder)'
    );

    // TODO: Integrate with WorkflowEngine to create workflow
    // This would create a new workflow instance with the event data
  }

  /**
   * Dispatch an agent task from an event
   */
  private async dispatchAgentFromEvent(
    handler: any,
    trigger: EventTrigger
  ): Promise<void> {
    logger.info(
      {
        handler_id: handler.id,
        event_name: trigger.event_name
      },
      'Dispatching agent from event (placeholder)'
    );

    // TODO: Integrate with AgentRegistry to create agent task
    // This would dispatch an agent with the event data as payload
  }

  // ==========================================
  // STATISTICS
  // ==========================================

  /**
   * Update event handler statistics
   */
  private async updateHandlerStats(
    handlerId: string,
    success: boolean
  ): Promise<void> {
    try {
      await this.prisma.eventHandler.update({
        where: { id: handlerId },
        data: {
          trigger_count: { increment: 1 },
          success_count: success ? { increment: 1 } : undefined,
          failure_count: !success ? { increment: 1 } : undefined,
          last_triggered: new Date()
        }
      });
    } catch (error: any) {
      logger.error(
        {
          handler_id: handlerId,
          error: error.message
        },
        'Failed to update handler statistics'
      );
    }
  }

  // ==========================================
  // PUBLIC API
  // ==========================================

  /**
   * Manually trigger an event
   */
  async triggerEvent(
    eventName: string,
    data: any,
    options?: {
      platform_id?: string;
      trace_id?: string;
    }
  ): Promise<void> {
    logger.info(
      {
        event_name: eventName,
        platform_id: options?.platform_id,
        trace_id: options?.trace_id
      },
      'Manually triggering event'
    );

    // Publish event to message bus
    await this.messageBus.publish(eventName, {
      ...data,
      platform_id: options?.platform_id,
      trace_id: options?.trace_id,
      triggered_by: 'manual'
    });
  }

  /**
   * Reload event handlers from database
   */
  async reloadHandlers(): Promise<void> {
    logger.info('Reloading event handlers');

    // Clear current subscriptions
    for (const eventName of this.eventSubscriptions.keys()) {
      await this.unsubscribeFromEvent(eventName);
    }

    // Reinitialize
    this.isInitialized = false;
    await this.initialize();
  }

  /**
   * Lazy initialization - can be called after server startup to subscribe to events
   * that failed during initial startup
   */
  async lazySubscribe(eventName: string): Promise<boolean> {
    try {
      if (this.eventSubscriptions.has(eventName)) {
        logger.debug({ event_name: eventName }, 'Already subscribed to event');
        return true;
      }

      await Promise.race([
        this.subscribeToEvent(eventName),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Lazy subscription timeout for event: ${eventName}`)), 3000)
        )
      ]);

      logger.info({ event_name: eventName }, 'Lazy subscription successful');
      return true;
    } catch (error: any) {
      logger.error(
        { event_name: eventName, error: error.message },
        'Lazy subscription failed'
      );
      return false;
    }
  }

  /**
   * Get statistics for an event handler
   */
  async getHandlerStats(handlerId: string): Promise<any | null> {
    return this.prisma.eventHandler.findUnique({
      where: { id: handlerId }
    });
  }

  /**
   * Get all handlers for an event
   */
  async getEventHandlers(eventName: string): Promise<any[]> {
    return this.prisma.eventHandler.findMany({
      where: { event_name: eventName },
      orderBy: { priority: 'desc' }
    });
  }
}
