/**
 * WebSocket Manager Adapter
 * Session #88: Real-time metrics broadcasting via WebSocket
 *
 * Manages WebSocket connections and broadcasts metrics to all connected clients.
 * Uses Fastify WebSocket plugin for HTTP upgrade and connection management.
 */

import { WebSocket } from 'ws';
import { IWebSocketManager, WebSocketMessage } from '../ports/websocket-manager.port';
import { logger } from '../../utils/logger';

/**
 * WebSocket Manager Adapter
 *
 * Tracks connected clients and broadcasts messages to all of them.
 * Handles client disconnections and backpressure.
 */
export class WebSocketManagerAdapter implements IWebSocketManager {
  private clients: Set<WebSocket> = new Set();
  private isShuttingDown = false;

  constructor() {
    logger.info('[WebSocketManager] Initialized');
  }

  /**
   * Add a new WebSocket client
   * Called by the WebSocket route handler when a new client connects
   */
  addClient(socket: WebSocket): void {
    if (this.isShuttingDown) {
      logger.warn('[WebSocketManager] Rejecting client connection during shutdown');
      socket.close(1001, 'Server shutting down');
      return;
    }

    this.clients.add(socket);
    logger.info('[WebSocketManager] Client connected', {
      total_clients: this.clients.size
    });

    // Handle client disconnect
    socket.once('close', () => {
      this.clients.delete(socket);
      logger.info('[WebSocketManager] Client disconnected', {
        total_clients: this.clients.size
      });
    });

    // Handle client errors
    socket.on('error', (error) => {
      logger.error('[WebSocketManager] WebSocket error', {
        error: error.message
      });
      this.clients.delete(socket);
    });
  }

  /**
   * Broadcast a message to all connected clients
   */
  async broadcast(message: WebSocketMessage): Promise<void> {
    if (this.clients.size === 0) {
      logger.debug('[WebSocketManager] No clients connected, skipping broadcast', {
        message_type: message.type
      });
      return;
    }

    const messageStr = JSON.stringify(message);
    const failedClients: WebSocket[] = [];

    for (const client of this.clients) {
      try {
        // Check if socket is ready
        if (client.readyState === WebSocket.OPEN) {
          // Send without waiting (fire-and-forget)
          // In production, could implement backpressure handling here
          client.send(messageStr, (error) => {
            if (error) {
              logger.debug('[WebSocketManager] Send error', {
                error: error.message
              });
              failedClients.push(client);
            }
          });
        } else {
          // Socket not ready, mark for cleanup
          failedClients.push(client);
        }
      } catch (error) {
        logger.error('[WebSocketManager] Error sending to client', {
          error: error instanceof Error ? error.message : String(error)
        });
        failedClients.push(client);
      }
    }

    // Clean up failed clients
    for (const client of failedClients) {
      this.clients.delete(client);
      try {
        client.close();
      } catch (error) {
        // Ignore errors during cleanup
      }
    }

    logger.debug('[WebSocketManager] Broadcast complete', {
      message_type: message.type,
      sent: this.clients.size,
      failed: failedClients.length
    });
  }

  /**
   * Get number of connected clients
   */
  getConnectedClientCount(): number {
    return this.clients.size;
  }

  /**
   * Health check
   */
  async isHealthy(): Promise<boolean> {
    // Always healthy if initialized (doesn't depend on external services)
    return true;
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('[WebSocketManager] Shutting down', {
      connected_clients: this.clients.size
    });

    this.isShuttingDown = true;

    // Close all client connections gracefully
    const closePromises: Promise<void>[] = [];

    for (const client of this.clients) {
      closePromises.push(
        new Promise<void>((resolve) => {
          try {
            client.close(1000, 'Server shutting down');
          } catch (error) {
            logger.warn('[WebSocketManager] Error closing client', {
              error: error instanceof Error ? error.message : String(error)
            });
          }
          // Resolve after a short delay to allow graceful closure
          setTimeout(() => {
            this.clients.delete(client);
            resolve();
          }, 100);
        })
      );
    }

    // Wait for all clients to close
    await Promise.all(closePromises);

    this.clients.clear();
    logger.info('[WebSocketManager] Shutdown complete');
  }
}
