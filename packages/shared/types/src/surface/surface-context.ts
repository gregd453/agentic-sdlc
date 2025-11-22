/**
 * Surface Context Types
 *
 * SESSION #88 PHASE 3 (P3-T3): Surface-aware workflow execution
 *
 * Provides context about which surface (API, CLI, Dashboard, etc.) initiated
 * a workflow, enabling surface-specific routing and metadata tracking.
 */

import { z } from 'zod';

/**
 * Surface types that can initiate workflows
 */
export const SurfaceTypeSchema = z.enum([
  'REST',      // REST API endpoint
  'Webhook',   // External webhook
  'CLI',       // Command-line interface
  'Dashboard', // Web dashboard UI
  'Mobile',    // Mobile application
  'Internal'   // Internal system trigger
]);

export type SurfaceType = z.infer<typeof SurfaceTypeSchema>;

/**
 * Surface context for workflow execution
 *
 * Tracks which surface initiated the workflow and relevant metadata
 * for surface-specific behavior and routing.
 *
 * @example
 * // REST API request
 * {
 *   surface_id: 'api-v1',
 *   surface_type: 'REST',
 *   platform_id: 'platform-123',
 *   entry_metadata: {
 *     http_method: 'POST',
 *     endpoint: '/api/v1/workflows',
 *     user_agent: 'curl/7.68.0',
 *     ip_address: '192.168.1.1'
 *   }
 * }
 *
 * @example
 * // Dashboard UI request
 * {
 *   surface_id: 'dashboard-v2',
 *   surface_type: 'Dashboard',
 *   platform_id: 'platform-123',
 *   entry_metadata: {
 *     user_id: 'user-456',
 *     session_id: 'sess-789',
 *     browser: 'Chrome/120.0'
 *   }
 * }
 */
export const SurfaceContextSchema = z.object({
  /**
   * Unique identifier for the surface instance
   * Examples: 'api-v1', 'dashboard-v2', 'cli-main'
   */
  surface_id: z.string().min(1),

  /**
   * Type of surface that initiated the workflow
   */
  surface_type: SurfaceTypeSchema,

  /**
   * Platform ID associated with this workflow
   * Optional for backward compatibility
   */
  platform_id: z.string().optional(),

  /**
   * Surface-specific entry metadata
   *
   * Examples:
   * - REST: { http_method, endpoint, headers, ip_address }
   * - Webhook: { webhook_id, source, signature }
   * - CLI: { command, args, cwd }
   * - Dashboard: { user_id, session_id, browser }
   */
  entry_metadata: z.record(z.unknown()).optional()
});

export type SurfaceContext = z.infer<typeof SurfaceContextSchema>;

/**
 * Helper to create surface context for REST API requests
 */
export function createRestSurfaceContext(
  platformId: string,
  metadata?: {
    http_method?: string;
    endpoint?: string;
    user_agent?: string;
    ip_address?: string;
    [key: string]: unknown;
  }
): SurfaceContext {
  return {
    surface_id: 'api-v1',
    surface_type: 'REST',
    platform_id: platformId,
    entry_metadata: metadata
  };
}

/**
 * Helper to create surface context for Dashboard requests
 */
export function createDashboardSurfaceContext(
  platformId: string,
  metadata?: {
    user_id?: string;
    session_id?: string;
    browser?: string;
    [key: string]: unknown;
  }
): SurfaceContext {
  return {
    surface_id: 'dashboard-v2',
    surface_type: 'Dashboard',
    platform_id: platformId,
    entry_metadata: metadata
  };
}

/**
 * Helper to create surface context for CLI requests
 */
export function createCliSurfaceContext(
  platformId: string,
  metadata?: {
    command?: string;
    args?: string[];
    cwd?: string;
    [key: string]: unknown;
  }
): SurfaceContext {
  return {
    surface_id: 'cli-main',
    surface_type: 'CLI',
    platform_id: platformId,
    entry_metadata: metadata
  };
}

/**
 * Helper to create surface context for Webhook requests
 */
export function createWebhookSurfaceContext(
  platformId: string,
  metadata?: {
    webhook_id?: string;
    source?: string;
    signature?: string;
    [key: string]: unknown;
  }
): SurfaceContext {
  return {
    surface_id: 'webhook-handler',
    surface_type: 'Webhook',
    platform_id: platformId,
    entry_metadata: metadata
  };
}
