/**
 * WebSocket Manager Port (Interface)
 * Session #88: Real-time metrics broadcasting
 *
 * Abstraction for managing WebSocket connections and broadcasting updates.
 * Implementations: WebSocketManagerAdapter
 */

/**
 * WebSocket message that can be broadcast to clients
 */
export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

/**
 * WebSocket Manager Port
 *
 * Manages WebSocket client connections and broadcasts messages to all
 * connected clients.
 */
export interface IWebSocketManager {
  /**
   * Add a new WebSocket client connection
   * @param socket - WebSocket client connection
   */
  addClient(socket: any): void;

  /**
   * Broadcast a message to all connected clients
   * @param message - Message to broadcast
   * @returns Promise that resolves when broadcast is sent
   */
  broadcast(message: WebSocketMessage): Promise<void>;

  /**
   * Get number of connected clients
   * @returns Number of connected WebSocket clients
   */
  getConnectedClientCount(): number;

  /**
   * Health check
   * @returns true if manager is healthy
   */
  isHealthy(): Promise<boolean>;

  /**
   * Graceful shutdown
   * @returns Promise that resolves when shutdown complete
   */
  shutdown(): Promise<void>;
}
