/**
 * Performance & Cache Metrics Tracker
 * Records cache hit/miss statistics and response latency percentiles.
 */

export class MetricsTracker {
  private cacheHits: number = 0;
  private cacheMisses: number = 0;
  private redisErrors: number = 0;
  private readonly maxLatencySamples = 1000;
  private latencySamples: number[] = [];

  recordHit(): void {
    this.cacheHits++;
  }

  recordMiss(): void {
    this.cacheMisses++;
  }

  recordRedisError(): void {
    this.redisErrors++;
  }

  recordLatency(durationMs: number): void {
    if (this.latencySamples.length >= this.maxLatencySamples) {
      this.latencySamples.shift();
    }
    this.latencySamples.push(durationMs);
  }

  getMetrics() {
    const totalRequests = this.cacheHits + this.cacheMisses;
    const hitRatePercentage =
      totalRequests > 0 ? Number(((this.cacheHits / totalRequests) * 100).toFixed(2)) : 0;

    const sortedLatencies = [...this.latencySamples].sort((a, b) => a - b);
    const count = sortedLatencies.length;

    const p50Ms = count > 0 ? sortedLatencies[Math.floor(count * 0.5)] : 0;
    const p95Ms = count > 0 ? sortedLatencies[Math.floor(count * 0.95)] : 0;
    const p99Ms = count > 0 ? sortedLatencies[Math.floor(count * 0.99)] : 0;
    const avgMs =
      count > 0
        ? Number((sortedLatencies.reduce((acc, val) => acc + val, 0) / count).toFixed(2))
        : 0;

    return {
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      totalCacheRequests: totalRequests,
      hitRatePercentage,
      redisErrors: this.redisErrors,
      latencyStats: {
        p50Ms: Number(p50Ms.toFixed(2)),
        p95Ms: Number(p95Ms.toFixed(2)),
        p99Ms: Number(p99Ms.toFixed(2)),
        avgMs,
        sampleCount: count,
      },
      timestamp: new Date().toISOString(),
    };
  }

  reset(): void {
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.redisErrors = 0;
    this.latencySamples = [];
  }
}

export const metricsTracker = new MetricsTracker();
