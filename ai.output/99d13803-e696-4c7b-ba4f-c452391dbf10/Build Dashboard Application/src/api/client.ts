/**
 * API Client for Zyp-compliant backend communication
 * Follows envelope pattern for all responses
 */

import type { ApiEnvelope, ErrorEnvelope } from '../types/envelope';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

class ApiClient {
  private baseUrl: string;
  private userId?: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    // In production, this would come from authentication context
    this.userId = localStorage.getItem('userId') || undefined;
  }

  /**
   * Set the user ID for authenticated requests
   */
  setUserId(userId: string | undefined) {
    this.userId = userId;
    if (userId) {
      localStorage.setItem('userId', userId);
    } else {
      localStorage.removeItem('userId');
    }
  }

  /**
   * Make an API request with envelope handling
   */
  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<ApiEnvelope<T>> {
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    // Add x-user-id header if authenticated
    if (this.userId) {
      headers['x-user-id'] = this.userId;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      // Response should already be in envelope format
      return data as ApiEnvelope<T>;
    } catch (error) {
      // Network or parsing error
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Network request failed',
          details: error,
          timestamp: new Date().toISOString(),
        },
      } as ErrorEnvelope;
    }
  }

  /**
   * GET request
   */
  async get<T>(path: string): Promise<ApiEnvelope<T>> {
    return this.request<T>(path, {
      method: 'GET',
    });
  }

  /**
   * POST request
   */
  async post<T>(path: string, body?: unknown): Promise<ApiEnvelope<T>> {
    return this.request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * PUT request
   */
  async put<T>(path: string, body?: unknown): Promise<ApiEnvelope<T>> {
    return this.request<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * DELETE request
   */
  async delete<T>(path: string): Promise<ApiEnvelope<T>> {
    return this.request<T>(path, {
      method: 'DELETE',
    });
  }

  /**
   * Health check
   */
  async checkHealth() {
    return this.get<{
      status: string;
      timestamp: string;
      uptime: number;
      environment: string;
      version: string;
    }>('/health');
  }

  /**
   * Get hello message
   */
  async getHello() {
    return this.get<{
      message: string;
      timestamp: string;
      count: number;
    }>('/hello');
  }

  /**
   * List hello messages
   */
  async listMessages(params?: { limit?: number; offset?: number }) {
    const queryString = params
      ? `?${new URLSearchParams(params as any).toString()}`
      : '';
    return this.get<{
      messages: Array<{
        id: string;
        message: string;
        count: number;
        userId?: string | null;
        createdAt: string;
        updatedAt: string;
      }>;
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    }>(`/hello/messages${queryString}`);
  }

  /**
   * Create hello message
   */
  async createMessage(message: string) {
    return this.post<{
      id: string;
      message: string;
      count: number;
      userId?: string | null;
      createdAt: string;
      updatedAt: string;
    }>('/hello', { message });
  }

  /**
   * Update hello message
   */
  async updateMessage(id: string, data: { message?: string; incrementCount?: boolean }) {
    return this.put<{
      id: string;
      message: string;
      count: number;
      userId?: string | null;
      createdAt: string;
      updatedAt: string;
    }>(`/hello/${id}`, data);
  }

  /**
   * Delete hello message
   */
  async deleteMessage(id: string) {
    return this.delete<void>(`/hello/${id}`);
  }

  /**
   * Create session payload (for Shell-BFF to sign)
   * This demonstrates the auth pattern: NO JWT signing in app
   */
  async createSessionPayload() {
    return this.post<{
      sessionPayload: {
        id: string;
        payload: any;
        expiresAt: string;
      };
      message: string;
    }>('/hello/session');
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export class for testing
export { ApiClient };