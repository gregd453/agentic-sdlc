import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { EventBus } from '../events/event-bus';
import { PipelineUpdate, PipelineUpdateSchema } from '../types/pipeline.types';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';

/**
 * WebSocket connection for pipeline updates
 */
interface PipelineWebSocketConnection {
  ws: WebSocket;
  subscriptions: Set<string>; // Pipeline execution IDs
  authenticated: boolean;
  client_id: string;
  connected_at: Date;
}

/**
 * Pipeline WebSocket handler
 * Provides real-time updates for pipeline executions
 */
export class PipelineWebSocketHandler {
  private connections: Map<string, PipelineWebSocketConnection> = new Map();
  private subscriptionIndex: Map<string, Set<string>> = new Map(); // execution_id -> client_ids

  constructor(private eventBus: EventBus) {
    this.setupEventListener();
  }

  /**
   * Setup event listener for pipeline updates
   */
  private setupEventListener(): void {
    this.eventBus.subscribe('pipeline:updates', async (event: any) => {
      try {
        const update = PipelineUpdateSchema.parse(event);
        await this.broadcastUpdate(update);
      } catch (error) {
        logger.error('Failed to process pipeline update for WebSocket', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    logger.info('Pipeline WebSocket handler listening for updates');
  }

  /**
   * Register WebSocket routes
   */
  async register(fastify: FastifyInstance): Promise<void> {
    fastify.get(
      '/ws/pipelines',
      { websocket: true },
      (connection, request) => {
        const { socket } = connection;
        const clientId = this.generateClientId();

        logger.info('WebSocket connection established', {
          client_id: clientId,
          remote_address: request.ip
        });

        // Create connection record
        const wsConnection: PipelineWebSocketConnection = {
          ws: socket,
          subscriptions: new Set(),
          authenticated: false, // TODO: Implement authentication
          client_id: clientId,
          connected_at: new Date()
        };

        this.connections.set(clientId, wsConnection);

        metrics.increment('websocket.pipeline.connections', {
          action: 'connect'
        });

        // Handle messages
        socket.on('message', (data: Buffer) => {
          this.handleMessage(clientId, data);
        });

        // Handle disconnect
        socket.on('close', () => {
          this.handleDisconnect(clientId);
        });

        // Handle errors
        socket.on('error', (error) => {
          logger.error('WebSocket error', {
            client_id: clientId,
            error: error.message
          });
        });

        // Send welcome message
        this.sendMessage(socket, {
          type: 'connected',
          client_id: clientId,
          timestamp: new Date().toISOString()
        });
      }
    );

    logger.info('WebSocket routes registered at /ws/pipelines');
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(clientId: string, data: Buffer): void {
    try {
      const message = JSON.parse(data.toString());
      const connection = this.connections.get(clientId);

      if (!connection) {
        logger.warn('Message from unknown client', { client_id: clientId });
        return;
      }

      logger.debug('WebSocket message received', {
        client_id: clientId,
        message_type: message.type
      });

      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(clientId, message.execution_id);
          break;

        case 'unsubscribe':
          this.handleUnsubscribe(clientId, message.execution_id);
          break;

        case 'ping':
          this.sendMessage(connection.ws, {
            type: 'pong',
            timestamp: new Date().toISOString()
          });
          break;

        default:
          logger.warn('Unknown message type', {
            client_id: clientId,
            message_type: message.type
          });
          this.sendMessage(connection.ws, {
            type: 'error',
            message: `Unknown message type: ${message.type}`
          });
      }
    } catch (error) {
      logger.error('Failed to handle WebSocket message', {
        client_id: clientId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handle subscribe request
   */
  private handleSubscribe(clientId: string, executionId: string): void {
    const connection = this.connections.get(clientId);

    if (!connection) {
      return;
    }

    // Add to connection's subscriptions
    connection.subscriptions.add(executionId);

    // Add to subscription index
    if (!this.subscriptionIndex.has(executionId)) {
      this.subscriptionIndex.set(executionId, new Set());
    }
    this.subscriptionIndex.get(executionId)!.add(clientId);

    logger.info('Client subscribed to pipeline updates', {
      client_id: clientId,
      execution_id: executionId
    });

    metrics.increment('websocket.pipeline.subscriptions', {
      action: 'subscribe'
    });

    // Send confirmation
    this.sendMessage(connection.ws, {
      type: 'subscribed',
      execution_id: executionId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle unsubscribe request
   */
  private handleUnsubscribe(clientId: string, executionId: string): void {
    const connection = this.connections.get(clientId);

    if (!connection) {
      return;
    }

    // Remove from connection's subscriptions
    connection.subscriptions.delete(executionId);

    // Remove from subscription index
    const subscribers = this.subscriptionIndex.get(executionId);
    if (subscribers) {
      subscribers.delete(clientId);
      if (subscribers.size === 0) {
        this.subscriptionIndex.delete(executionId);
      }
    }

    logger.info('Client unsubscribed from pipeline updates', {
      client_id: clientId,
      execution_id: executionId
    });

    metrics.increment('websocket.pipeline.subscriptions', {
      action: 'unsubscribe'
    });

    // Send confirmation
    this.sendMessage(connection.ws, {
      type: 'unsubscribed',
      execution_id: executionId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(clientId: string): void {
    const connection = this.connections.get(clientId);

    if (!connection) {
      return;
    }

    // Remove all subscriptions
    for (const executionId of connection.subscriptions) {
      const subscribers = this.subscriptionIndex.get(executionId);
      if (subscribers) {
        subscribers.delete(clientId);
        if (subscribers.size === 0) {
          this.subscriptionIndex.delete(executionId);
        }
      }
    }

    // Remove connection
    this.connections.delete(clientId);

    logger.info('WebSocket connection closed', {
      client_id: clientId,
      subscriptions: connection.subscriptions.size
    });

    metrics.increment('websocket.pipeline.connections', {
      action: 'disconnect'
    });
  }

  /**
   * Broadcast pipeline update to subscribed clients
   */
  private async broadcastUpdate(update: PipelineUpdate): Promise<void> {
    const subscribers = this.subscriptionIndex.get(update.execution_id);

    if (!subscribers || subscribers.size === 0) {
      return;
    }

    logger.debug('Broadcasting pipeline update', {
      execution_id: update.execution_id,
      type: update.type,
      subscribers: subscribers.size
    });

    let successCount = 0;
    let failureCount = 0;

    for (const clientId of subscribers) {
      const connection = this.connections.get(clientId);

      if (!connection) {
        continue;
      }

      try {
        this.sendMessage(connection.ws, {
          type: 'update',
          data: update
        });
        successCount++;
      } catch (error) {
        failureCount++;
        logger.error('Failed to send update to client', {
          client_id: clientId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    metrics.increment('websocket.pipeline.broadcasts', {
      type: update.type
    });

    metrics.recordValue('websocket.pipeline.broadcast.recipients', successCount);

    if (failureCount > 0) {
      metrics.recordValue('websocket.pipeline.broadcast.failures', failureCount);
    }
  }

  /**
   * Send message to WebSocket client
   */
  private sendMessage(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    total_connections: number;
    total_subscriptions: number;
    unique_executions: number;
  } {
    let totalSubscriptions = 0;

    for (const connection of this.connections.values()) {
      totalSubscriptions += connection.subscriptions.size;
    }

    return {
      total_connections: this.connections.size,
      total_subscriptions: totalSubscriptions,
      unique_executions: this.subscriptionIndex.size
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    logger.info('Cleaning up Pipeline WebSocket handler');

    // Close all connections
    for (const [clientId, connection] of this.connections.entries()) {
      try {
        connection.ws.close();
      } catch (error) {
        logger.error('Failed to close WebSocket connection', {
          client_id: clientId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    this.connections.clear();
    this.subscriptionIndex.clear();
  }
}
