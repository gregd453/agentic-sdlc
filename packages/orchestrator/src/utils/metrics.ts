interface Metric {
  name: string;
  value: number;
  tags: Record<string, string>;
  timestamp: Date;
}

class MetricsCollector {
  private metrics: Metric[] = [];

  recordDuration(name: string, duration: number, tags: Record<string, string> = {}): void {
    this.metrics.push({
      name,
      value: duration,
      tags,
      timestamp: new Date()
    });

    // In production, this would send to a metrics service
    if (process.env.ENABLE_METRICS === 'true') {
      console.log(`[METRIC] ${name}: ${duration}ms`, tags);
    }
  }

  increment(name: string, tags: Record<string, string> = {}): void {
    const existing = this.metrics.find(m =>
      m.name === name && JSON.stringify(m.tags) === JSON.stringify(tags)
    );

    if (existing) {
      existing.value += 1;
    } else {
      this.metrics.push({
        name,
        value: 1,
        tags,
        timestamp: new Date()
      });
    }

    if (process.env.ENABLE_METRICS === 'true') {
      console.log(`[METRIC] ${name}: +1`, tags);
    }
  }

  gauge(name: string, value: number, tags: Record<string, string> = {}): void {
    this.metrics.push({
      name,
      value,
      tags,
      timestamp: new Date()
    });

    if (process.env.ENABLE_METRICS === 'true') {
      console.log(`[METRIC] ${name}: ${value}`, tags);
    }
  }

  getMetrics(): Metric[] {
    return [...this.metrics];
  }

  clear(): void {
    this.metrics = [];
  }
}

export const metrics = new MetricsCollector();