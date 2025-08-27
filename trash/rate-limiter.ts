/**
 * Rate Limiter
 * Advanced rate limiting and throttling system
 */

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  skipSuccessfulRequests?: boolean; // Skip rate limiting for successful requests
  skipFailedRequests?: boolean; // Skip rate limiting for failed requests
  keyGenerator?: (req: any) => string; // Custom key generator
  handler?: (req: any, res: any) => void; // Custom handler for rate limit exceeded
  standardHeaders?: boolean; // Return rate limit info in headers
  legacyHeaders?: boolean; // Return rate limit info in legacy headers
  store?: RateLimitStore; // Custom store
}

export interface RateLimitInfo {
  limit: number;
  current: number;
  remaining: number;
  resetTime: Date;
  retryAfter: number;
}

export interface RateLimitStore {
  incr(key: string): Promise<{ totalHits: number; resetTime: Date }>;
  decrement(key: string): void;
  resetKey(key: string): void;
  resetAll(): void;
}

export interface ThrottleConfig {
  agentId: string;
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  maxRequestsPerDay: number;
  burstLimit: number;
  cooldownPeriod: number;
}

export class RateLimiter {
  private config: RateLimitConfig;
  private store: RateLimitStore;
  private agentLimits: Map<string, ThrottleConfig> = new Map();
  private burstCounters: Map<string, { count: number; lastReset: Date }> = new Map();

  constructor(config: RateLimitConfig) {
    this.config = {
      ...config,
      skipSuccessfulRequests: config.skipSuccessfulRequests ?? false,
      skipFailedRequests: config.skipFailedRequests ?? false,
      standardHeaders: config.standardHeaders ?? true,
      legacyHeaders: config.legacyHeaders ?? false,
      windowMs: config.windowMs ?? 15 * 60 * 1000, // 15 minutes default
      maxRequests: config.maxRequests ?? 100 // 100 requests per window default
    };

    this.store = config.store || new MemoryStore();
  }

  addAgentThrottle(agentId: string, config: ThrottleConfig): void {
    this.agentLimits.set(agentId, config);
    console.log(`Rate limit configured for agent: ${agentId}`);
  }

  removeAgentThrottle(agentId: string): void {
    this.agentLimits.delete(agentId);
    this.burstCounters.delete(agentId);
    console.log(`Rate limit removed for agent: ${agentId}`);
  }

  async checkRateLimit(agentId: string, operation: string = 'default'): Promise<{
    allowed: boolean;
    info: RateLimitInfo;
    retryAfter?: number;
    reason?: string;
  }> {
    const key = this.generateKey(agentId, operation);
    const agentConfig = this.agentLimits.get(agentId);

    try {
      // Check burst limit first
      if (agentConfig) {
        const burstCheck = this.checkBurstLimit(agentId, agentConfig);
        if (!burstCheck.allowed) {
          return {
            allowed: false,
            info: this.createRateLimitInfo(0, 0, 0, new Date()),
            retryAfter: burstCheck.retryAfter,
            reason: 'Burst limit exceeded'
          };
        }
      }

      // Check standard rate limit
      const { totalHits, resetTime } = await this.store.incr(key);
      const limit = agentConfig?.maxRequestsPerMinute || this.config.maxRequests;
      const remaining = Math.max(0, limit - totalHits);
      const retryAfter = remaining === 0 ? Math.ceil((resetTime.getTime() - Date.now()) / 1000) : 0;

      const info: RateLimitInfo = {
        limit,
        current: totalHits,
        remaining,
        resetTime,
        retryAfter
      };

      const allowed = totalHits <= limit;

      if (!allowed) {
        console.log(`Rate limit exceeded for agent ${agentId}: ${totalHits}/${limit} requests`);
      }

      return {
        allowed,
        info,
        retryAfter: allowed ? undefined : retryAfter,
        reason: allowed ? undefined : 'Rate limit exceeded'
      };

    } catch (error) {
      console.error(`Rate limit check failed for agent ${agentId}:`, error);
      return {
        allowed: true, // Allow on error
        info: this.createRateLimitInfo(0, 0, 0, new Date())
      };
    }
  }

  async checkHourlyLimit(agentId: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: Date;
  }> {
    const key = `hourly:${agentId}`;
    const agentConfig = this.agentLimits.get(agentId);

    if (!agentConfig) {
      return { allowed: true, remaining: 0, resetTime: new Date() };
    }

    try {
      const { totalHits, resetTime } = await this.store.incr(key);
      const remaining = Math.max(0, agentConfig.maxRequestsPerHour - totalHits);
      const allowed = totalHits <= agentConfig.maxRequestsPerHour;

      return { allowed, remaining, resetTime };
    } catch (error) {
      console.error(`Hourly rate limit check failed for agent ${agentId}:`, error);
      return { allowed: true, remaining: 0, resetTime: new Date() };
    }
  }

  async checkDailyLimit(agentId: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: Date;
  }> {
    const key = `daily:${agentId}`;
    const agentConfig = this.agentLimits.get(agentId);

    if (!agentConfig) {
      return { allowed: true, remaining: 0, resetTime: new Date() };
    }

    try {
      const { totalHits, resetTime } = await this.store.incr(key);
      const remaining = Math.max(0, agentConfig.maxRequestsPerDay - totalHits);
      const allowed = totalHits <= agentConfig.maxRequestsPerDay;

      return { allowed, remaining, resetTime };
    } catch (error) {
      console.error(`Daily rate limit check failed for agent ${agentId}:`, error);
      return { allowed: true, remaining: 0, resetTime: new Date() };
    }
  }

  getRateLimitInfo(agentId: string, operation: string = 'default'): RateLimitInfo {
    const key = this.generateKey(agentId, operation);
    const agentConfig = this.agentLimits.get(agentId);
    const limit = agentConfig?.maxRequestsPerMinute || this.config.maxRequests;

    // This would retrieve current rate limit info from store
    // For now, return mock data
    return {
      limit,
      current: 0,
      remaining: limit,
      resetTime: new Date(Date.now() + this.config.windowMs),
      retryAfter: 0
    };
  }

  resetRateLimit(agentId: string, operation: string = 'default'): void {
    const key = this.generateKey(agentId, operation);
    this.store.resetKey(key);
    this.burstCounters.delete(agentId);
    console.log(`Rate limit reset for agent ${agentId}, operation ${operation}`);
  }

  resetAllRateLimits(): void {
    this.store.resetAll();
    this.burstCounters.clear();
    console.log('All rate limits reset');
  }

  getRateLimitStats(): {
    totalAgents: number;
    activeLimits: number;
    blockedRequests: number;
    averageRequestsPerMinute: number;
  } {
    return {
      totalAgents: this.agentLimits.size,
      activeLimits: this.agentLimits.size,
      blockedRequests: 0, // This would track blocked requests
      averageRequestsPerMinute: 0 // This would calculate average requests
    };
  }

  private checkBurstLimit(agentId: string, config: ThrottleConfig): {
    allowed: boolean;
    retryAfter?: number;
  } {
    const now = new Date();
    const counter = this.burstCounters.get(agentId);

    if (!counter) {
      this.burstCounters.set(agentId, { count: 1, lastReset: now });
      return { allowed: true };
    }

    // Reset counter if cooldown period has passed
    if (now.getTime() - counter.lastReset.getTime() > config.cooldownPeriod) {
      counter.count = 1;
      counter.lastReset = now;
      return { allowed: true };
    }

    // Check burst limit
    if (counter.count >= config.burstLimit) {
      const timeUntilReset = config.cooldownPeriod - (now.getTime() - counter.lastReset.getTime());
      return {
        allowed: false,
        retryAfter: Math.ceil(timeUntilReset / 1000)
      };
    }

    counter.count++;
    return { allowed: true };
  }

  private generateKey(agentId: string, operation: string): string {
    const window = Math.floor(Date.now() / this.config.windowMs);
    return `${agentId}:${operation}:${window}`;
  }

  private createRateLimitInfo(limit: number, current: number, remaining: number, resetTime: Date): RateLimitInfo {
    return {
      limit,
      current,
      remaining,
      resetTime,
      retryAfter: Math.ceil((resetTime.getTime() - Date.now()) / 1000)
    };
  }
}

/**
 * Memory-based rate limit store
 */
export class MemoryStore implements RateLimitStore {
  private hits: Map<string, { totalHits: number; resetTime: Date }> = new Map();

  async incr(key: string): Promise<{ totalHits: number; resetTime: Date }> {
    const now = new Date();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const resetTime = new Date(now.getTime() + windowMs);

    const existing = this.hits.get(key);
    if (existing && existing.resetTime > now) {
      existing.totalHits++;
      return { totalHits: existing.totalHits, resetTime: existing.resetTime };
    }

    const newEntry = { totalHits: 1, resetTime };
    this.hits.set(key, newEntry);
    return { totalHits: 1, resetTime };
  }

  decrement(key: string): void {
    const existing = this.hits.get(key);
    if (existing) {
      existing.totalHits = Math.max(0, existing.totalHits - 1);
    }
  }

  resetKey(key: string): void {
    this.hits.delete(key);
  }

  resetAll(): void {
    this.hits.clear();
  }
}

/**
 * Advanced throttling with adaptive limits
 */
export class AdaptiveThrottler {
  private rateLimiter: RateLimiter;
  private adaptiveLimits: Map<string, {
    baseLimit: number;
    currentLimit: number;
    lastAdjustment: Date;
    successRate: number;
    errorRate: number;
  }> = new Map();

  constructor(rateLimiter: RateLimiter) {
    this.rateLimiter = rateLimiter;
  }

  async checkAdaptiveLimit(agentId: string, operation: string): Promise<{
    allowed: boolean;
    info: RateLimitInfo;
    adaptiveLimit?: number;
  }> {
    const result = await this.rateLimiter.checkRateLimit(agentId, operation);
    
    // Update adaptive limits based on success/failure
    this.updateAdaptiveLimit(agentId, result.allowed);

    return {
      ...result,
      adaptiveLimit: this.getAdaptiveLimit(agentId)
    };
  }

  private updateAdaptiveLimit(agentId: string, success: boolean): void {
    const now = new Date();
    const adaptive = this.adaptiveLimits.get(agentId);

    if (!adaptive) {
      this.adaptiveLimits.set(agentId, {
        baseLimit: 100,
        currentLimit: 100,
        lastAdjustment: now,
        successRate: 1.0,
        errorRate: 0.0
      });
      return;
    }

    // Update success/error rates
    const totalRequests = adaptive.successRate + adaptive.errorRate;
    if (success) {
      adaptive.successRate = (adaptive.successRate * totalRequests + 1) / (totalRequests + 1);
      adaptive.errorRate = adaptive.errorRate * totalRequests / (totalRequests + 1);
    } else {
      adaptive.errorRate = (adaptive.errorRate * totalRequests + 1) / (totalRequests + 1);
      adaptive.successRate = adaptive.successRate * totalRequests / (totalRequests + 1);
    }

    // Adjust limits based on performance
    const timeSinceAdjustment = now.getTime() - adaptive.lastAdjustment.getTime();
    if (timeSinceAdjustment > 5 * 60 * 1000) { // Adjust every 5 minutes
      if (adaptive.successRate > 0.95) {
        // Increase limit for good performance
        adaptive.currentLimit = Math.min(adaptive.currentLimit * 1.1, adaptive.baseLimit * 2);
      } else if (adaptive.errorRate > 0.1) {
        // Decrease limit for poor performance
        adaptive.currentLimit = Math.max(adaptive.currentLimit * 0.9, adaptive.baseLimit * 0.5);
      }

      adaptive.lastAdjustment = now;
    }
  }

  private getAdaptiveLimit(agentId: string): number | undefined {
    const adaptive = this.adaptiveLimits.get(agentId);
    return adaptive?.currentLimit;
  }
}
