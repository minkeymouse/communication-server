/**
 * Agent Performance Tracker
 * Tracks agent performance metrics including response times, throughput, and errors
 */

import { AgentMetrics } from './types.js';
import { PerformanceMetrics } from '../../shared/types/common.js';

export class PerformanceTracker {
  private responseTimeHistory: Map<string, number[]> = new Map();
  private activityHistory: Map<string, Date[]> = new Map();
  private errorHistory: Map<string, Error[]> = new Map();
  private messageCounts: Map<string, number> = new Map();
  private onlineTime: Map<string, { start: Date; total: number }> = new Map();

  /**
   * Record response time for agent
   */
  public recordResponseTime(agentId: string, responseTime: number): void {
    const history = this.responseTimeHistory.get(agentId) || [];
    history.push(responseTime);
    
    // Keep only last 100 response times
    if (history.length > 100) {
      history.shift();
    }
    
    this.responseTimeHistory.set(agentId, history);
  }

  /**
   * Record agent activity
   */
  public recordActivity(agentId: string): void {
    const history = this.activityHistory.get(agentId) || [];
    history.push(new Date());
    
    // Keep only last 1000 activities
    if (history.length > 1000) {
      history.shift();
    }
    
    this.activityHistory.set(agentId, history);
  }

  /**
   * Record error for agent
   */
  public recordError(agentId: string, error: Error): void {
    const history = this.errorHistory.get(agentId) || [];
    history.push(error);
    
    // Keep only last 50 errors
    if (history.length > 50) {
      history.shift();
    }
    
    this.errorHistory.set(agentId, history);
  }

  /**
   * Record message sent/received
   */
  public recordMessage(agentId: string): void {
    const currentCount = this.messageCounts.get(agentId) || 0;
    this.messageCounts.set(agentId, currentCount + 1);
  }

  /**
   * Mark agent as online
   */
  public markOnline(agentId: string): void {
    this.onlineTime.set(agentId, {
      start: new Date(),
      total: this.getTotalOnlineTime(agentId)
    });
  }

  /**
   * Mark agent as offline
   */
  public markOffline(agentId: string): void {
    const onlineData = this.onlineTime.get(agentId);
    if (onlineData) {
      const sessionTime = Date.now() - onlineData.start.getTime();
      onlineData.total += sessionTime;
      onlineData.start = new Date(0); // Reset start time
    }
  }

  /**
   * Get agent metrics
   */
  public getAgentMetrics(agentId: string): AgentMetrics {
    const responseTimes = this.responseTimeHistory.get(agentId) || [];
    const errors = this.errorHistory.get(agentId) || [];
    const totalMessages = this.messageCounts.get(agentId) || 0;
    const totalOnlineTime = this.getTotalOnlineTime(agentId);
    
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : 0;
    
    const successRate = totalMessages > 0 
      ? Math.max(0, 1 - (errors.length / totalMessages)) 
      : 1.0;
    
    const uptime = totalOnlineTime > 0 
      ? Math.min(1.0, totalOnlineTime / (24 * 60 * 60 * 1000)) // 24 hours in ms
      : 0;

    return {
      agentId,
      avgResponseTime,
      totalMessages,
      successRate,
      uptime,
      lastSeen: new Date(),
      identityStability: 1.0, // Will be calculated by IdentityManager
      conversationCoherence: 1.0, // Will be calculated by ConversationManager
      ghostInteractionCount: 0, // Will be tracked separately
      selfInteractionCount: 0 // Will be tracked separately
    };
  }

  /**
   * Get performance metrics for agent
   */
  public getPerformanceMetrics(agentId: string): PerformanceMetrics {
    const responseTimes = this.responseTimeHistory.get(agentId) || [];
    const errors = this.errorHistory.get(agentId) || [];
    const totalMessages = this.messageCounts.get(agentId) || 0;
    
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : 0;
    
    const throughput = totalMessages / Math.max(1, responseTimes.length);
    const errorRate = totalMessages > 0 ? errors.length / totalMessages : 0;
    const uptime = this.getTotalOnlineTime(agentId) / (24 * 60 * 60 * 1000);

    return {
      operation: `agent_performance_${agentId}`,
      duration: avgResponseTime,
      timestamp: new Date(),
      success: errorRate < 0.1,
      error: errorRate > 0 ? `Error rate: ${errorRate}` : undefined,
      metadata: {
        throughput,
        errorRate,
        uptime,
        totalMessages
      }
    };
  }

  /**
   * Get total online time for agent in milliseconds
   */
  private getTotalOnlineTime(agentId: string): number {
    const onlineData = this.onlineTime.get(agentId);
    if (!onlineData) return 0;
    
    const currentSession = onlineData.start.getTime() > 0 
      ? Date.now() - onlineData.start.getTime() 
      : 0;
    
    return onlineData.total + currentSession;
  }

  /**
   * Clear metrics for agent
   */
  public clearMetrics(agentId: string): void {
    this.responseTimeHistory.delete(agentId);
    this.activityHistory.delete(agentId);
    this.errorHistory.delete(agentId);
    this.messageCounts.delete(agentId);
    this.onlineTime.delete(agentId);
  }

  /**
   * Get all agent IDs being tracked
   */
  public getTrackedAgents(): string[] {
    return Array.from(this.responseTimeHistory.keys());
  }
}
