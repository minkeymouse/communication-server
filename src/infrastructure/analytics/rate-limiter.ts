/**
 * Rate Limiting System
 * Prevents abuse and ensures fair usage of the communication server
 */

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  skipSuccessfulRequests?: boolean; // Skip rate limiting for successful requests
  skipFailedRequests?: boolean; // Skip rate limiting for failed requests
  keyGenerator?: (agentId: string) => string; // Custom key generator
}

export interface RateLimitInfo {
  agentId: string;
  current: number;
  limit: number;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}

export interface RateLimitRule {
  name: string;
  config: RateLimitConfig;
  description: string;
}

export class RateLimiter {
  private rules: Map<string, RateLimitRule> = new Map();
  private requestCounts: Map<string, Map<string, { count: number; resetTime: Date }>> = new Map();
  private blockedAgents: Set<string> = new Set();
  private globalConfig: RateLimitConfig;

  constructor(globalConfig: Partial<RateLimitConfig> = {}) {
    this.globalConfig = {
      windowMs: 60000, // 1 minute
      maxRequests: 100,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      ...globalConfig
    };

    this.setupDefaultRules();
  }

  /**
   * Add a rate limiting rule
   */
  public addRule(name: string, config: RateLimitConfig, description: string): void {
    this.rules.set(name, { name, config, description });
  }

  /**
   * Check if request is allowed
   */
  public isAllowed(agentId: string, ruleName: string = 'default'): { allowed: boolean; info: RateLimitInfo } {
    // Check if agent is blocked
    if (this.blockedAgents.has(agentId)) {
      return {
        allowed: false,
        info: {
          agentId,
          current: 0,
          limit: 0,
          remaining: 0,
          resetTime: new Date(),
          retryAfter: 3600000 // 1 hour
        }
      };
    }

    const rule = this.rules.get(ruleName) || this.rules.get('default')!;
    const key = this.generateKey(agentId, ruleName);
    const now = new Date();

    // Initialize request counts for this agent and rule
    if (!this.requestCounts.has(agentId)) {
      this.requestCounts.set(agentId, new Map());
    }

    const agentCounts = this.requestCounts.get(agentId)!;
    let requestData = agentCounts.get(ruleName);

    // Check if window has expired
    if (!requestData || now >= requestData.resetTime) {
      requestData = {
        count: 0,
        resetTime: new Date(now.getTime() + rule.config.windowMs)
      };
      agentCounts.set(ruleName, requestData);
    }

    // Check if limit exceeded
    const allowed = requestData.count < rule.config.maxRequests;
    
    if (allowed) {
      requestData.count++;
    }

    const remaining = Math.max(0, rule.config.maxRequests - requestData.count);
    const retryAfter = allowed ? undefined : requestData.resetTime.getTime() - now.getTime();

    return {
      allowed,
      info: {
        agentId,
        current: requestData.count,
        limit: rule.config.maxRequests,
        remaining,
        resetTime: requestData.resetTime,
        retryAfter
      }
    };
  }

  /**
   * Record a successful request (for adaptive rate limiting)
   */
  public recordSuccess(agentId: string, ruleName: string = 'default'): void {
    const rule = this.rules.get(ruleName);
    if (rule?.config.skipSuccessfulRequests) {
      this.decreaseCount(agentId, ruleName);
    }
  }

  /**
   * Record a failed request (for adaptive rate limiting)
   */
  public recordFailure(agentId: string, ruleName: string = 'default'): void {
    const rule = this.rules.get(ruleName);
    if (rule?.config.skipFailedRequests) {
      this.decreaseCount(agentId, ruleName);
    }
  }

  /**
   * Block an agent temporarily
   */
  public blockAgent(agentId: string, durationMs: number = 3600000): void {
    this.blockedAgents.add(agentId);
    
    // Auto-unblock after duration
    setTimeout(() => {
      this.blockedAgents.delete(agentId);
    }, durationMs);
  }

  /**
   * Unblock an agent
   */
  public unblockAgent(agentId: string): void {
    this.blockedAgents.delete(agentId);
  }

  /**
   * Reset rate limit for an agent
   */
  public resetLimit(agentId: string, ruleName: string = 'default'): void {
    const agentCounts = this.requestCounts.get(agentId);
    if (agentCounts) {
      agentCounts.delete(ruleName);
    }
  }

  /**
   * Get rate limit information for an agent
   */
  public getLimitInfo(agentId: string, ruleName: string = 'default'): RateLimitInfo | null {
    const rule = this.rules.get(ruleName) || this.rules.get('default')!;
    const agentCounts = this.requestCounts.get(agentId);
    
    if (!agentCounts) {
      return {
        agentId,
        current: 0,
        limit: rule.config.maxRequests,
        remaining: rule.config.maxRequests,
        resetTime: new Date(Date.now() + rule.config.windowMs)
      };
    }

    const requestData = agentCounts.get(ruleName);
    if (!requestData) {
      return {
        agentId,
        current: 0,
        limit: rule.config.maxRequests,
        remaining: rule.config.maxRequests,
        resetTime: new Date(Date.now() + rule.config.windowMs)
      };
    }

    const remaining = Math.max(0, rule.config.maxRequests - requestData.count);
    
    return {
      agentId,
      current: requestData.count,
      limit: rule.config.maxRequests,
      remaining,
      resetTime: requestData.resetTime
    };
  }

  /**
   * Get all rate limit information for an agent
   */
  public getAllLimitInfo(agentId: string): RateLimitInfo[] {
    const results: RateLimitInfo[] = [];
    
    for (const [ruleName] of this.rules) {
      const info = this.getLimitInfo(agentId, ruleName);
      if (info) {
        results.push(info);
      }
    }
    
    return results;
  }

  /**
   * Get rate limiting statistics
   */
  public getStats(): {
    totalAgents: number;
    blockedAgents: number;
    totalRules: number;
    activeRules: Array<{ name: string; description: string }>;
  } {
    return {
      totalAgents: this.requestCounts.size,
      blockedAgents: this.blockedAgents.size,
      totalRules: this.rules.size,
      activeRules: Array.from(this.rules.values()).map(rule => ({
        name: rule.name,
        description: rule.description
      }))
    };
  }

  /**
   * Clean up expired rate limit data
   */
  public cleanup(): void {
    const now = new Date();
    
    for (const [agentId, agentCounts] of this.requestCounts.entries()) {
      for (const [ruleName, requestData] of agentCounts.entries()) {
        if (now >= requestData.resetTime) {
          agentCounts.delete(ruleName);
        }
      }
      
      // Remove agent if no active rules
      if (agentCounts.size === 0) {
        this.requestCounts.delete(agentId);
      }
    }
  }

  /**
   * Setup default rate limiting rules
   */
  private setupDefaultRules(): void {
    // Default rule - general API usage
    this.addRule('default', {
      windowMs: 60000, // 1 minute
      maxRequests: 100,
      skipSuccessfulRequests: false,
      skipFailedRequests: false
    }, 'Default rate limit for all API requests');

    // Message sending rule - prevent spam
    this.addRule('message_send', {
      windowMs: 60000, // 1 minute
      maxRequests: 20,
      skipSuccessfulRequests: false,
      skipFailedRequests: false
    }, 'Rate limit for sending messages');

    // Login rule - prevent brute force
    this.addRule('login', {
      windowMs: 300000, // 5 minutes
      maxRequests: 5,
      skipSuccessfulRequests: true,
      skipFailedRequests: false
    }, 'Rate limit for login attempts');

    // Agent creation rule - prevent abuse
    this.addRule('create_agent', {
      windowMs: 3600000, // 1 hour
      maxRequests: 10,
      skipSuccessfulRequests: false,
      skipFailedRequests: false
    }, 'Rate limit for agent creation');

    // Bulk operations rule
    this.addRule('bulk_operations', {
      windowMs: 300000, // 5 minutes
      maxRequests: 5,
      skipSuccessfulRequests: false,
      skipFailedRequests: false
    }, 'Rate limit for bulk operations');
  }

  /**
   * Generate rate limit key
   */
  private generateKey(agentId: string, ruleName: string): string {
    return `${agentId}:${ruleName}`;
  }

  /**
   * Decrease request count (for adaptive rate limiting)
   */
  private decreaseCount(agentId: string, ruleName: string): void {
    const agentCounts = this.requestCounts.get(agentId);
    if (agentCounts) {
      const requestData = agentCounts.get(ruleName);
      if (requestData && requestData.count > 0) {
        requestData.count--;
      }
    }
  }
}
