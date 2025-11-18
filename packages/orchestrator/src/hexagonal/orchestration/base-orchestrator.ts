/**
 * Base Orchestrator
 *
 * Abstract base class for all phase coordinators that:
 * - Subscribes to input messages via IMessageBus
 * - Processes messages with idempotency and retry guarantees
 * - Publishes results to output topics
 * - Integrates all hexagonal primitives (envelope, idempotency, retry, logging)
 *
 * Subclasses implement `handle()` to define phase-specific logic
 *
 * Session #38: Production-grade orchestrator pattern
 */

import { Envelope, createEnvelope, retryEnvelope } from '../core/event-envelope';
import { once, deduplicateEvent } from '../core/idempotency';
import { retry } from '../core/retry';
import { createLogger } from '../core/logger';
import { IMessageBus } from '../ports/message-bus.port';
import { IKVStore } from '../ports/kv-store.port';

export interface OrchestratorOptions {
  bus: IMessageBus;
  kv: IKVStore;
  inputTopic: string;
  outputTopic: string;
  dlqTopic?: string;
  maxRetries?: number;
}

export interface OrchestratorInput {
  [key: string]: any;
}

export interface OrchestratorOutput {
  [key: string]: any;
  status: WORKFLOW_STATUS.SUCCESS | 'failure';
  error?: string;
}

/**
 * Abstract base orchestrator for phase processing
 */
export abstract class BaseOrchestrator<I extends OrchestratorInput = OrchestratorInput, O extends OrchestratorOutput = OrchestratorOutput> {
  protected log = createLogger(this.constructor.name);
  protected opts: OrchestratorOptions;

  constructor(opts: OrchestratorOptions) {
    this.opts = opts;
  }

  /**
   * Start listening for input messages
   */
  async start(): Promise<void> {
    this.log.info('Starting orchestrator', {
      inputTopic: this.opts.inputTopic,
      outputTopic: this.opts.outputTopic,
    });

    // Subscribe to input topic
    const unsubscribe = await this.opts.bus.subscribe(
      this.opts.inputTopic,
      (envelope: Envelope<I>) => this.processMessage(envelope)
    );

    // Store unsubscribe function for cleanup
    (this as any)._unsubscribe = unsubscribe;

    this.log.info('Orchestrator started');
  }

  /**
   * Stop listening and clean up
   */
  async stop(): Promise<void> {
    this.log.info('Stopping orchestrator');

    const unsubscribe = (this as any)._unsubscribe;
    if (unsubscribe) {
      await unsubscribe();
    }

    await this.opts.bus.disconnect();
    await this.opts.kv.disconnect();

    this.log.info('Orchestrator stopped');
  }

  /**
   * Process a single input message
   * - Deduplicates via envelope.id
   * - Retries with backoff on transient failures
   * - Publishes result or sends to DLQ on exhaustion
   */
  private async processMessage(envelope: Envelope<I>): Promise<void> {
    const corrId = envelope.corrId || envelope.id;

    try {
      // Check for duplicate - skip if we've processed this envelope before
      const dedupeKey = `dedup:${envelope.id}`;
      const alreadySeen = await this.opts.kv.get(dedupeKey);
      if (alreadySeen) {
        this.log.warn('Duplicate message skipped', { id: envelope.id, corrId });
        return;
      }
      await this.opts.kv.set(dedupeKey, true, 3600);

      // Process with idempotency guarantee
      const result = await once(
        this.opts.kv,
        `process:${envelope.id}`,
        async () => {
          return await retry(
            () => this.handle(envelope.payload, envelope),
            {
              maxAttempts: this.opts.maxRetries ?? 5,
              baseDelayMs: 100,
              maxDelayMs: 30000,
              jitterFactor: 0.1,
              onRetry: (attempt, error, nextDelayMs) => {
                this.log.warn('Retrying', {
                  id: envelope.id,
                  corrId,
                  attempt,
                  error: String(error),
                  nextDelayMs,
                });
              },
            }
          );
        },
        3600 // TTL for idempotency tracking
      );

      if (result) {
        // Processing succeeded
        const output = {
          ...result,
          status: WORKFLOW_STATUS.SUCCESS as const,
        };

        // Publish result
        const resultEnvelope = createEnvelope(
          this.opts.outputTopic,
          output,
          corrId,
          envelope.tenantId
        );

        await this.opts.bus.publish(this.opts.outputTopic, resultEnvelope);

        this.log.info('Message processed successfully', {
          id: envelope.id,
          corrId,
          outputSize: JSON.stringify(output).length,
        });
      } else {
        // Already processed
        this.log.info('Message already processed (idempotent)', {
          id: envelope.id,
          corrId,
        });
      }
    } catch (error) {
      // Handle failure
      await this.handleError(envelope, error as Error, corrId);
    }
  }

  /**
   * Handle processing error with retry exhaustion
   */
  private async handleError(
    envelope: Envelope<I>,
    error: Error,
    corrId: string
  ): Promise<void> {
    const attempts = (envelope.attempts ?? 0) + 1;
    const maxRetries = this.opts.maxRetries ?? 5;

    if (attempts >= maxRetries) {
      // Send to DLQ
      this.log.error('Max retries exceeded, sending to DLQ', {
        id: envelope.id,
        corrId,
        attempts,
        maxRetries,
        error: error.message,
      });

      if (this.opts.dlqTopic) {
        const dlqEnvelope = createEnvelope(
          this.opts.dlqTopic,
          {
            original: envelope,
            error: error.message,
            stack: error.stack,
            attempts,
          },
          corrId,
          envelope.tenantId
        );

        try {
          await this.opts.bus.publish(this.opts.dlqTopic, dlqEnvelope);
        } catch (dlqError) {
          this.log.error('Failed to publish to DLQ', {
            error: String(dlqError),
          });
        }
      }
    } else {
      // Retry
      this.log.warn('Processing failed, will retry', {
        id: envelope.id,
        corrId,
        attempts,
        maxRetries,
        error: error.message,
      });

      const newEnvelope = retryEnvelope(envelope, error.message);
      await this.opts.bus.publish(this.opts.inputTopic, newEnvelope);
    }
  }

  /**
   * Abstract method: subclasses implement phase-specific logic
   *
   * @param input - Parsed payload from envelope
   * @param envelope - Full envelope with metadata
   * @returns Output data (will be wrapped in OrchestratorOutput)
   */
  abstract handle(input: I, envelope: Envelope<I>): Promise<Partial<O>>;
}
