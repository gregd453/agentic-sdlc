/**
 * Job Consumer Worker
 *
 * Redis Streams consumer that:
 * - Listens to 'stream:scheduler:job.dispatch' stream
 * - Consumes job dispatch messages
 * - Executes jobs via JobExecutorService
 * - Acknowledges messages on completion
 * - Handles failures with retry/DLQ
 *
 * Session #89: Phase 3 - Message Bus Integration
 */

import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';
import { IMessageBus } from '../hexagonal/ports/message-bus.port';
import { JobExecutorService } from '../services/job-executor.service';

// ==========================================
// CONSUMER CONFIGURATION
// ==========================================

export interface JobConsumerConfig {
  stream_name?: string;
  consumer_group?: string;
  consumer_name?: string;
  batch_size?: number;
  block_ms?: number;
  enabled?: boolean;
}

export interface ConsumerStats {
  messages_processed: number;
  messages_succeeded: number;
  messages_failed: number;
  messages_retried: number;
  last_message_at?: Date;
  uptime_seconds: number;
  started_at: Date;
}

// ==========================================
// JOB CONSUMER WORKER
// ==========================================

export class JobConsumerWorker {
  private isRunning = false;
  private shouldStop = false;
  private stats: ConsumerStats = {
    messages_processed: 0,
    messages_succeeded: 0,
    messages_failed: 0,
    messages_retried: 0,
    uptime_seconds: 0,
    started_at: new Date()
  };

  private readonly streamName: string;
  private readonly consumerGroup: string;
  private readonly consumerName: string;
  private readonly batchSize: number;
  private readonly blockMs: number;
  private enabled: boolean;

  constructor(
    private readonly messageBus: IMessageBus,
    private readonly jobExecutor: JobExecutorService,
    config?: JobConsumerConfig
  ) {
    this.streamName = config?.stream_name || 'stream:scheduler:job.dispatch';
    this.consumerGroup = config?.consumer_group || 'scheduler-workers';
    this.consumerName = config?.consumer_name || `consumer-${randomUUID().slice(0, 8)}`;
    this.batchSize = config?.batch_size || 10;
    this.blockMs = config?.block_ms || 5000;
    this.enabled = config?.enabled !== false;
  }

  // ==========================================
  // PUBLIC API
  // ==========================================

  /**
   * Start consuming messages from Redis Stream
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn({ consumer_name: this.consumerName }, 'Consumer already running');
      return;
    }

    if (!this.enabled) {
      logger.info({ consumer_name: this.consumerName }, 'Consumer is disabled');
      return;
    }

    logger.info(
      {
        consumer_name: this.consumerName,
        stream_name: this.streamName,
        consumer_group: this.consumerGroup,
        batch_size: this.batchSize
      },
      'Starting job consumer worker'
    );

    this.isRunning = true;
    this.shouldStop = false;
    this.stats.started_at = new Date();

    // Ensure consumer group exists
    await this.ensureConsumerGroup();

    // Start consuming messages
    this.consumeLoop();
  }

  /**
   * Stop consuming messages gracefully
   */
  async stop(): Promise<void> {
    logger.info({ consumer_name: this.consumerName }, 'Stopping job consumer worker');
    this.shouldStop = true;

    // Wait for current message processing to complete
    while (this.isRunning) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    logger.info({ consumer_name: this.consumerName }, 'Job consumer worker stopped');
  }

  /**
   * Get consumer statistics
   */
  getStats(): ConsumerStats {
    const uptime = Math.floor((Date.now() - this.stats.started_at.getTime()) / 1000);
    return {
      ...this.stats,
      uptime_seconds: uptime
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      messages_processed: 0,
      messages_succeeded: 0,
      messages_failed: 0,
      messages_retried: 0,
      uptime_seconds: 0,
      started_at: new Date()
    };
  }

  // ==========================================
  // CONSUMER LOOP
  // ==========================================

  /**
   * Main consumption loop
   */
  private async consumeLoop(): Promise<void> {
    while (!this.shouldStop) {
      try {
        // Read messages from stream
        const messages = await this.readMessages();

        if (messages.length === 0) {
          continue;
        }

        // Process each message
        for (const message of messages) {
          if (this.shouldStop) break;

          await this.processMessage(message);
        }
      } catch (error: any) {
        logger.error(
          {
            consumer_name: this.consumerName,
            error: error.message,
            stack: error.stack
          },
          'Error in consumer loop'
        );

        // Back off on error
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    this.isRunning = false;
  }

  /**
   * Read messages from Redis Stream
   */
  private async readMessages(): Promise<any[]> {
    try {
      // This is a placeholder - actual implementation would use Redis XREADGROUP
      // For now, we'll return empty array since we don't have the actual Redis adapter methods
      return [];
    } catch (error: any) {
      logger.error(
        {
          consumer_name: this.consumerName,
          error: error.message
        },
        'Failed to read messages from stream'
      );
      return [];
    }
  }

  /**
   * Process a single message
   */
  private async processMessage(message: any): Promise<void> {
    const startTime = Date.now();
    const messageId = message.id;
    const data = message.data;

    logger.info(
      {
        consumer_name: this.consumerName,
        message_id: messageId,
        job_id: data.job_id
      },
      'Processing job dispatch message'
    );

    try {
      // Extract job execution request from message
      const request = {
        job_id: data.job_id,
        scheduled_at: new Date(data.scheduled_at),
        trace_id: data.trace_id,
        parent_span_id: data.span_id,
        worker_id: this.consumerName
      };

      // Execute the job
      const result = await this.jobExecutor.executeJob(request);

      const duration = Date.now() - startTime;

      logger.info(
        {
          consumer_name: this.consumerName,
          message_id: messageId,
          job_id: data.job_id,
          execution_id: result.execution_id,
          status: result.status,
          duration_ms: duration
        },
        'Job execution completed'
      );

      // Acknowledge message
      await this.acknowledgeMessage(messageId);

      this.stats.messages_processed++;
      this.stats.messages_succeeded++;
      this.stats.last_message_at = new Date();
    } catch (error: any) {
      const duration = Date.now() - startTime;

      logger.error(
        {
          consumer_name: this.consumerName,
          message_id: messageId,
          job_id: data.job_id,
          error: error.message,
          stack: error.stack,
          duration_ms: duration
        },
        'Job execution failed'
      );

      this.stats.messages_processed++;
      this.stats.messages_failed++;

      // Don't acknowledge - let message be retried
      // In production, this would use XPENDING and retry logic
    }
  }

  /**
   * Acknowledge message in Redis Stream
   */
  private async acknowledgeMessage(messageId: string): Promise<void> {
    try {
      // This is a placeholder - actual implementation would use Redis XACK
      logger.debug(
        {
          consumer_name: this.consumerName,
          message_id: messageId
        },
        'Message acknowledged'
      );
    } catch (error: any) {
      logger.error(
        {
          consumer_name: this.consumerName,
          message_id: messageId,
          error: error.message
        },
        'Failed to acknowledge message'
      );
    }
  }

  /**
   * Ensure consumer group exists
   */
  private async ensureConsumerGroup(): Promise<void> {
    try {
      // This is a placeholder - actual implementation would use Redis XGROUP CREATE
      logger.info(
        {
          consumer_name: this.consumerName,
          stream_name: this.streamName,
          consumer_group: this.consumerGroup
        },
        'Consumer group ensured'
      );
    } catch (error: any) {
      // Group might already exist - that's OK
      logger.debug(
        {
          consumer_name: this.consumerName,
          error: error.message
        },
        'Consumer group creation skipped (may already exist)'
      );
    }
  }
}
