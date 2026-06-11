/**
 * Sliding window rate limiter for LinkedIn API calls.
 * Ensures no more than maxRequestsPerSecond requests are made.
 */
export class RateLimiter {
  private timestamps: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequestsPerSecond: number = 1) {
    this.maxRequests = maxRequestsPerSecond;
    this.windowMs = 1000;
  }

  /**
   * Acquires a slot for an API call.
   * Waits if the rate limit would be exceeded.
   */
  async acquire(): Promise<void> {
    const now = Date.now();

    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);

    if (this.timestamps.length >= this.maxRequests) {
      const oldestTimestamp = this.timestamps[0];
      const waitTime = this.windowMs - (now - oldestTimestamp);

      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    this.timestamps.push(Date.now());
  }

  /** Resets the rate limiter state */
  reset(): void {
    this.timestamps = [];
  }
}
