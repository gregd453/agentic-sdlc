/**
 * Monitoring WebSocket Handler
 * Session #88: Real-time metrics broadcasting
 *
 * Provides WebSocket endpoint for dashboard to receive real-time metrics updates.
 * Integrates with EventAggregatorService to broadcast metrics every 5 seconds.
 */

import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { IEventAggregator } from '../hexagonal/ports/event-aggregator.port';
import { IWebSocketManager } from '../hexagonal/ports/websocket-manager.port';
import { WebSocketManagerAdapter } from '../hexagonal/adapters/websocket-manager.adapter';
import { RealtimeMetrics } from '@agentic-sdlc/shared-types';
import { logger } from '../utils/logger';

/**
 * Monitoring WebSocket Handler
 *
 * Manages connections to monitoring endpoint and broadcasts metrics from EventAggregator.
 */
export class MonitoringWebSocketHandler {
  private wsManager: IWebSocketManager;
  private clientCount = 0;
  private broadcastInterval: ReturnType<typeof setInterval> | null = null;
  private isRegistered = false;

  constructor(private eventAggregator: IEventAggregator) {
    this.wsManager = new WebSocketManagerAdapter();
    logger.info('[MonitoringWebSocket] Initialized');
  }

  /**
   * Register WebSocket route with Fastify
   */
  async register(fastify: FastifyInstance): Promise<void> {
    if (this.isRegistered) {
      logger.warn('[MonitoringWebSocket] Already registered');
      return;
    }

    try {
      // Register the WebSocket route
      fastify.get(
        '/ws/monitoring',
        { websocket: true } as any,
        (connection: any, request: any) => {
          const { socket } = connection;

          logger.info('[MonitoringWebSocket] Client connected', {
            remote_address: request.socket?.remoteAddress || 'unknown',
            total_clients: this.clientCount + 1
          });

          // Add to WebSocket manager
          this.wsManager.addClient(socket as WebSocket);
          this.clientCount++;

          // Send welcome message
          this.sendMessage(socket as WebSocket, {
            type: 'connected',
            message: 'Connected to monitoring dashboard',
            timestamp: new Date().toISOString()
          });

          // Handle client messages (subscribe/unsubscribe)
          socket.on('message', (data: Buffer) => {
            this.handleClientMessage(socket as WebSocket, data);
          });

          // Handle client disconnect
          socket.once('close', () => {
            this.clientCount = Math.max(0, this.clientCount - 1);
            logger.info('[MonitoringWebSocket] Client disconnected', {
              remaining_clients: this.clientCount
            });
          });
        }
      );

      this.isRegistered = true;

      // Start broadcasting metrics every 5 seconds
      this.startMetricsBroadcast();

      logger.info('[MonitoringWebSocket] Handler registered at /ws/monitoring');
    } catch (error) {
      logger.error('[MonitoringWebSocket] Failed to register', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Handle incoming client message
   */
  private handleClientMessage(socket: WebSocket, data: Buffer): void {
    try {
      const message = JSON.parse(data.toString());

      logger.debug('[MonitoringWebSocket] Message received', {
        type: message.type
      });

      switch (message.type) {
        case 'ping':
          this.sendMessage(socket, {
            type: 'pong',
            timestamp: new Date().toISOString()
          });
          break;

        case 'subscribe':
          // Currently we broadcast to all clients, but this could be extended
          // to support per-channel subscriptions
          this.sendMessage(socket, {
            type: 'subscribed',
            channels: ['metrics:realtime'],
            timestamp: new Date().toISOString()
          });
          break;

        case 'unsubscribe':
          this.sendMessage(socket, {
            type: 'unsubscribed',
            timestamp: new Date().toISOString()
          });
          break;

        default:
          logger.warn('[MonitoringWebSocket] Unknown message type', {
            type: message.type
          });
          this.sendMessage(socket, {
            type: 'error',
            message: `Unknown message type: ${message.type}`,
            timestamp: new Date().toISOString()
          });
      }
    } catch (error) {
      logger.error('[MonitoringWebSocket] Error handling message', {
        error: error instanceof Error ? error.message : String(error)
      });

      try {
        this.sendMessage(socket, {
          type: 'error',
          message: 'Invalid message format',
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        // Ignore send errors
      }
    }
  }

  /**
   * Start broadcasting metrics every 5 seconds
   */
  private startMetricsBroadcast(): void {
    if (this.broadcastInterval !== null) {
      logger.warn('[MonitoringWebSocket] Broadcast already running');
      return;
    }

    this.broadcastInterval = setInterval(async () => {
      try {
        // Only broadcast if there are connected clients
        if (this.clientCount === 0) {
          return;
        }

        // Get latest metrics from EventAggregator
        const metrics = await this.eventAggregator.getMetrics();

        if (!metrics) {
          logger.debug('[MonitoringWebSocket] Metrics not available yet');
          return;
        }

        // Broadcast to all connected clients
        await this.wsManager.broadcast({
          type: 'metrics:update',
          data: metrics,
          timestamp: new Date().toISOString()
        });

        logger.debug('[MonitoringWebSocket] Metrics broadcast', {
          clients: this.clientCount,
          total_workflows: metrics.overview.total_workflows
        });
      } catch (error) {
        logger.error('[MonitoringWebSocket] Error broadcasting metrics', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }, 5000); // Broadcast every 5 seconds

    logger.info('[MonitoringWebSocket] Metrics broadcast started (5s interval)');
  }

  /**
   * Stop broadcasting metrics
   */
  private stopMetricsBroadcast(): void {
    if (this.broadcastInterval !== null) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
      logger.info('[MonitoringWebSocket] Metrics broadcast stopped');
    }
  }

  /**
   * Send message to WebSocket client
   */
  private sendMessage(ws: WebSocket, message: any): void {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    } catch (error) {
      logger.error('[MonitoringWebSocket] Error sending message', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get handler statistics
   */
  getStats() {
    return {
      connected_clients: this.clientCount,
      is_broadcasting: this.broadcastInterval !== null,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('[MonitoringWebSocket] Shutting down', {
      connected_clients: this.clientCount
    });

    // Stop metric broadcasts
    this.stopMetricsBroadcast();

    // Close all WebSocket connections
    await this.wsManager.shutdown();

    this.clientCount = 0;
    logger.info('[MonitoringWebSocket] Shutdown complete');
  }
}
