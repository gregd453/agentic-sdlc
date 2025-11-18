import http from 'http';
import https from 'https';

/**
 * Health check options
 */
export interface HealthCheckOptions {
  timeout?: number; // Milliseconds
  expectedStatus?: number;
  retries?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  healthy: boolean;
  statusCode?: number;
  responseTime: number;
  error?: string;
  body?: string;
}

/**
 * HealthCheckService - HTTP/HTTPS health check service
 * Performs endpoint health checks with retry logic
 */
export class HealthCheckService {
  /**
   * Check endpoint health
   */
  async checkEndpoint(
    url: string,
    options: HealthCheckOptions = {}
  ): Promise<HealthCheckResult> {
    const {
      timeout = 5000,
      expectedStatus = 200,
      retries = 3,
      retryDelay = 2000,
      headers = {}
    } = options;

    let lastError: string | undefined;

    // Retry logic
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await this.performCheck(url, timeout, headers);

        // Check if status code matches expected
        const healthy = result.statusCode === expectedStatus;

        return {
          ...result,
          healthy
        };

      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';

        // If not last attempt, wait before retrying
        if (attempt < retries) {
          await this.sleep(retryDelay);
        }
      }
    }

    // All retries failed
    return {
      healthy: false,
      responseTime: 0,
      error: lastError || 'Health check failed after all retries'
    };
  }

  /**
   * Perform actual HTTP/HTTPS check
   */
  private performCheck(
    url: string,
    timeout: number,
    headers: Record<string, string>
  ): Promise<HealthCheckResult> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const isHttps = url.startsWith('https://');
      const client = isHttps ? https : http;

      const req = client.get(url, { headers, timeout }, (res) => {
        const responseTime = Date.now() - startTime;
        let body = '';

        res.on('data', (chunk) => {
          body += chunk.toString();
        });

        res.on('end', () => {
          resolve({
            healthy: res.statusCode === 200,
            statusCode: res.statusCode,
            responseTime,
            body: body.substring(0, 1000) // Limit body to 1KB
          });
        });
      });

      req.on(LOG_LEVEL.ERROR, (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timeout after ${timeout}ms`));
      });
    });
  }

  /**
   * Check multiple endpoints
   */
  async checkMultipleEndpoints(
    endpoints: Array<{ url: string; options?: HealthCheckOptions }>
  ): Promise<HealthCheckResult[]> {
    const promises = endpoints.map(endpoint =>
      this.checkEndpoint(endpoint.url, endpoint.options)
    );

    return Promise.all(promises);
  }

  /**
   * Wait for endpoint to become healthy
   */
  async waitForHealthy(
    url: string,
    options: HealthCheckOptions & { maxWaitTime?: number } = {}
  ): Promise<boolean> {
    const { maxWaitTime = 300000, ...checkOptions } = options; // Default 5 minutes
    const startTime = Date.now();
    const pollInterval = 5000; // Check every 5 seconds

    while (Date.now() - startTime < maxWaitTime) {
      const result = await this.checkEndpoint(url, checkOptions);

      if (result.healthy) {
        return true;
      }

      // Wait before next check
      await this.sleep(pollInterval);
    }

    return false;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
