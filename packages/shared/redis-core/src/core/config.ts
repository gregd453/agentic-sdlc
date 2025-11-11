/**
 * Redis Core Configuration
 *
 * Environment-driven config for streams, retries, and timeouts.
 * Tunable for different workload profiles.
 */

export const RCFG = {
  /** How long to block on XREADGROUP (ms) */
  STREAM_BLOCK_MS: parseInt(process.env.STREAM_BLOCK_MS ?? "5000", 10),

  /** Max messages to read per XREADGROUP call */
  STREAM_BATCH: parseInt(process.env.STREAM_BATCH ?? "50", 10),

  /** Idle time before XAUTOCLAIM reclaims stuck messages (ms) */
  STREAM_IDLE_MS: parseInt(process.env.STREAM_IDLE_MS ?? "60000", 10),

  /** Max retries before sending to DLQ */
  MAX_RETRIES: parseInt(process.env.MAX_RETRIES ?? "5", 10),

  /** Lock TTL in milliseconds */
  LOCK_TTL_MS: parseInt(process.env.LOCK_TTL_MS ?? "5000", 10),

  /** Lock renew interval in milliseconds */
  LOCK_RENEW_MS: parseInt(process.env.LOCK_RENEW_MS ?? "1000", 10),

  /** KV default TTL in seconds */
  KV_TTL_SEC: parseInt(process.env.KV_TTL_SEC ?? "3600", 10),

  /** Health check interval in milliseconds */
  HEALTH_CHECK_MS: parseInt(process.env.HEALTH_CHECK_MS ?? "30000", 10),
} as const;

/**
 * Validate config at startup
 */
export function validateConfig(): void {
  if (RCFG.STREAM_BLOCK_MS < 1000) {
    console.warn("STREAM_BLOCK_MS < 1000ms; may cause excessive CPU");
  }
  if (RCFG.MAX_RETRIES < 1) {
    throw new Error("MAX_RETRIES must be >= 1");
  }
  if (RCFG.LOCK_TTL_MS < 1000) {
    console.warn("LOCK_TTL_MS < 1000ms; may cause frequent lock expiry");
  }
}
