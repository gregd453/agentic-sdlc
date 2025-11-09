/**
 * Metric types for Prometheus compatibility
 */
export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary'
}

/**
 * Metric value with labels
 */
export interface MetricValue {
  value: number;
  labels: Record<string, string>;
  timestamp: Date;
}

/**
 * Histogram bucket for latency tracking
 */
export interface HistogramBucket {
  le: number; // Less than or equal to
  count: number;
}

/**
 * Histogram data structure
 */
export interface HistogramData {
  buckets: HistogramBucket[];
  sum: number;
  count: number;
}

/**
 * Summary quantile for percentile tracking
 */
export interface SummaryQuantile {
  quantile: number; // 0.5 = p50, 0.95 = p95, 0.99 = p99
  value: number;
}

/**
 * Metric definition
 */
export interface Metric {
  name: string;
  type: MetricType;
  help: string;
  values: Map<string, MetricValue | HistogramData>;
}

/**
 * Prometheus-compatible metrics collector
 */
export class MetricsCollector {
  private metrics: Map<string, Metric> = new Map();
  private readonly enableLogging: boolean;

  // Default histogram buckets (in milliseconds)
  private readonly defaultBuckets = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

  constructor() {
    this.enableLogging = process.env.ENABLE_METRICS === 'true';
  }

  /**
   * Increment a counter
   */
  increment(name: string, labels: Record<string, string> = {}, value: number = 1): void {
    const metric = this.getOrCreateMetric(name, MetricType.COUNTER, `Counter for ${name}`);
    const key = this.serializeLabels(labels);

    const existing = metric.values.get(key) as MetricValue | undefined;
    if (existing) {
      existing.value += value;
      existing.timestamp = new Date();
    } else {
      metric.values.set(key, {
        value,
        labels,
        timestamp: new Date()
      });
    }

    if (this.enableLogging) {
      console.log(`[METRIC] ${name}{${this.formatLabels(labels)}}: ${value}`);
    }
  }

  /**
   * Set a gauge value
   */
  gauge(name: string, value: number, labels: Record<string, string> = {}): void {
    const metric = this.getOrCreateMetric(name, MetricType.GAUGE, `Gauge for ${name}`);
    const key = this.serializeLabels(labels);

    metric.values.set(key, {
      value,
      labels,
      timestamp: new Date()
    });

    if (this.enableLogging) {
      console.log(`[METRIC] ${name}{${this.formatLabels(labels)}}: ${value}`);
    }
  }

  /**
   * Record a value in a histogram (for latency tracking)
   */
  histogram(name: string, value: number, labels: Record<string, string> = {}, buckets?: number[]): void {
    const metric = this.getOrCreateMetric(name, MetricType.HISTOGRAM, `Histogram for ${name}`);
    const key = this.serializeLabels(labels);

    const bucketsToUse = buckets || this.defaultBuckets;
    let histogram = metric.values.get(key) as HistogramData | undefined;

    if (!histogram) {
      histogram = {
        buckets: bucketsToUse.map(le => ({ le, count: 0 })),
        sum: 0,
        count: 0
      };
      metric.values.set(key, histogram);
    }

    // Update histogram
    histogram.sum += value;
    histogram.count += 1;

    // Update bucket counts
    for (const bucket of histogram.buckets) {
      if (value <= bucket.le) {
        bucket.count += 1;
      }
    }

    if (this.enableLogging) {
      console.log(`[METRIC] ${name}{${this.formatLabels(labels)}}: ${value}`);
    }
  }

  /**
   * Record duration (convenience method for histogram)
   */
  recordDuration(name: string, durationMs: number, labels: Record<string, string> = {}): void {
    this.histogram(name, durationMs, labels);
  }

  /**
   * Calculate percentiles from histogram
   */
  getPercentiles(name: string, labels: Record<string, string> = {}): Map<number, number> {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== MetricType.HISTOGRAM) {
      return new Map();
    }

    const key = this.serializeLabels(labels);
    const histogram = metric.values.get(key) as HistogramData | undefined;

    if (!histogram || histogram.count === 0) {
      return new Map();
    }

    const percentiles = new Map<number, number>();
    const targetPercentiles = [0.5, 0.95, 0.99];

    for (const p of targetPercentiles) {
      const targetCount = Math.ceil(histogram.count * p);
      let cumulativeCount = 0;

      for (const bucket of histogram.buckets) {
        cumulativeCount += bucket.count;
        if (cumulativeCount >= targetCount) {
          percentiles.set(p, bucket.le);
          break;
        }
      }
    }

    return percentiles;
  }

  /**
   * Get average from histogram
   */
  getAverage(name: string, labels: Record<string, string> = {}): number {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== MetricType.HISTOGRAM) {
      return 0;
    }

    const key = this.serializeLabels(labels);
    const histogram = metric.values.get(key) as HistogramData | undefined;

    if (!histogram || histogram.count === 0) {
      return 0;
    }

    return histogram.sum / histogram.count;
  }

  /**
   * Get all metrics
   */
  getMetrics(): Metric[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get metric by name
   */
  getMetric(name: string): Metric | undefined {
    return this.metrics.get(name);
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheus(): string {
    const lines: string[] = [];

    for (const metric of this.metrics.values()) {
      // Add HELP and TYPE
      lines.push(`# HELP ${metric.name} ${metric.help}`);
      lines.push(`# TYPE ${metric.name} ${metric.type}`);

      // Add values
      for (const [key, value] of metric.values.entries()) {
        if (metric.type === MetricType.HISTOGRAM) {
          const histogram = value as HistogramData;
          const labels = this.deserializeLabels(key);

          // Export buckets
          for (const bucket of histogram.buckets) {
            const bucketLabels = { ...labels, le: bucket.le.toString() };
            lines.push(`${metric.name}_bucket{${this.formatLabels(bucketLabels)}} ${bucket.count}`);
          }

          // Export sum and count
          lines.push(`${metric.name}_sum{${this.formatLabels(labels)}} ${histogram.sum}`);
          lines.push(`${metric.name}_count{${this.formatLabels(labels)}} ${histogram.count}`);
        } else {
          const metricValue = value as MetricValue;
          const labelStr = Object.keys(metricValue.labels).length > 0
            ? `{${this.formatLabels(metricValue.labels)}}`
            : '';
          lines.push(`${metric.name}${labelStr} ${metricValue.value}`);
        }
      }

      lines.push(''); // Empty line between metrics
    }

    return lines.join('\n');
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
  }

  /**
   * Get or create a metric
   */
  private getOrCreateMetric(name: string, type: MetricType, help: string): Metric {
    let metric = this.metrics.get(name);

    if (!metric) {
      metric = {
        name,
        type,
        help,
        values: new Map()
      };
      this.metrics.set(name, metric);
    }

    return metric;
  }

  /**
   * Serialize labels to a string key
   */
  private serializeLabels(labels: Record<string, string>): string {
    const sorted = Object.keys(labels).sort();
    return sorted.map(k => `${k}=${labels[k]}`).join(',');
  }

  /**
   * Deserialize labels from string key
   */
  private deserializeLabels(key: string): Record<string, string> {
    if (!key) return {};

    const labels: Record<string, string> = {};
    const pairs = key.split(',');

    for (const pair of pairs) {
      const [k, v] = pair.split('=');
      labels[k] = v;
    }

    return labels;
  }

  /**
   * Format labels for Prometheus output
   */
  private formatLabels(labels: Record<string, string>): string {
    return Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
  }
}

/**
 * Global metrics collector instance
 */
export const metrics = new MetricsCollector();