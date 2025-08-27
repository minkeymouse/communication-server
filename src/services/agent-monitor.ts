/**
 * Agent Status Monitoring System
 * Tracks agent availability, response times, and performance metrics
 */

import { EventEmitter } from 'events';

export interface AgentStatus {
  agentId: string;
  isOnline: boolean;
  lastSeen: Date;
  lastActivity: Date;
  responseTime: number; // Average response time in milliseconds
  messageCount: number;
  errorCount: number;
  sessionToken?: string;
  sessionExpires?: Date;
  metadata?: Record<string, any>;
}

export interface AgentMetrics {
  agentId: string;
  avgResponseTime: number;
  totalMessages: number;
  successRate: number;
  uptime: number; // Percentage of time online
  lastSeen: Date;
}

export class AgentMonitor extends EventEmitter {
  private agentStatuses: Map<string, AgentStatus> = new Map();
  private responseTimeHistory: Map<string, number[]> = new Map();
  private activityHistory: Map<string, Date[]> = new Map();
  private errorHistory: Map<string, Error[]> = new Map();

  /**
   * Update agent status
   */
  public updateAgentStatus(
    agentId: string,
    updates: Partial<AgentStatus>
  ): void {
    const currentStatus = this.agentStatuses.get(agentId) || this.createDefaultStatus(agentId);
    
    const updatedStatus: AgentStatus = {
      ...currentStatus,
      ...updates,
      lastActivity: new Date()
    };

    this.agentStatuses.set(agentId, updatedStatus);
    this.emit('agentStatusUpdated', updatedStatus);
  }

  /**
   * Record agent response time
   */
  public recordResponseTime(agentId: string, responseTime: number): void {
    // Store response time in history
    if (!this.responseTimeHistory.has(agentId)) {
      this.responseTimeHistory.set(agentId, []);
    }
    
    const history = this.responseTimeHistory.get(agentId)!;
    history.push(responseTime);
    
    // Keep only last 100 response times
    if (history.length > 100) {
      history.shift();
    }

    // Update agent status with new average response time
    const avgResponseTime = this.calculateAverageResponseTime(agentId);
    this.updateAgentStatus(agentId, { responseTime: avgResponseTime });
  }

  /**
   * Record agent activity
   */
  public recordActivity(agentId: string): void {
    if (!this.activityHistory.has(agentId)) {
      this.activityHistory.set(agentId, []);
    }
    
    const history = this.activityHistory.get(agentId)!;
    history.push(new Date());
    
    // Keep only last 1000 activities
    if (history.length > 1000) {
      history.shift();
    }

    this.updateAgentStatus(agentId, { lastSeen: new Date() });
  }

  /**
   * Record agent error
   */
  public recordError(agentId: string, error: Error): void {
    if (!this.errorHistory.has(agentId)) {
      this.errorHistory.set(agentId, []);
    }
    
    const history = this.errorHistory.get(agentId)!;
    history.push(error);
    
    // Keep only last 100 errors
    if (history.length > 100) {
      history.shift();
    }

    const currentStatus = this.agentStatuses.get(agentId);
    if (currentStatus) {
      this.updateAgentStatus(agentId, { errorCount: currentStatus.errorCount + 1 });
    }
  }

  /**
   * Mark agent as online
   */
  public markAgentOnline(agentId: string, sessionToken?: string, sessionExpires?: Date): void {
    this.updateAgentStatus(agentId, {
      isOnline: true,
      sessionToken,
      sessionExpires
    });
  }

  /**
   * Mark agent as offline
   */
  public markAgentOffline(agentId: string): void {
    this.updateAgentStatus(agentId, {
      isOnline: false,
      sessionToken: undefined,
      sessionExpires: undefined
    });
  }

  /**
   * Increment message count
   */
  public incrementMessageCount(agentId: string): void {
    const currentStatus = this.agentStatuses.get(agentId);
    if (currentStatus) {
      this.updateAgentStatus(agentId, { messageCount: currentStatus.messageCount + 1 });
    }
  }

  /**
   * Get agent status
   */
  public getAgentStatus(agentId: string): AgentStatus | undefined {
    return this.agentStatuses.get(agentId);
  }

  /**
   * Get all agent statuses
   */
  public getAllAgentStatuses(): AgentStatus[] {
    return Array.from(this.agentStatuses.values());
  }

  /**
   * Get online agents
   */
  public getOnlineAgents(): AgentStatus[] {
    return Array.from(this.agentStatuses.values()).filter(status => status.isOnline);
  }

  /**
   * Get agent metrics
   */
  public getAgentMetrics(agentId: string): AgentMetrics | undefined {
    const status = this.agentStatuses.get(agentId);
    if (!status) return undefined;

    const responseTimes = this.responseTimeHistory.get(agentId) || [];
    const activities = this.activityHistory.get(agentId) || [];
    const errors = this.errorHistory.get(agentId) || [];

    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;

    const totalMessages = status.messageCount;
    const successRate = totalMessages > 0 
      ? ((totalMessages - errors.length) / totalMessages) * 100 
      : 100;

    // Calculate uptime based on activity history
    const uptime = this.calculateUptime(activities);

    return {
      agentId,
      avgResponseTime,
      totalMessages,
      successRate,
      uptime,
      lastSeen: status.lastSeen
    };
  }

  /**
   * Get performance summary
   */
  public getPerformanceSummary(): {
    totalAgents: number;
    onlineAgents: number;
    avgResponseTime: number;
    totalMessages: number;
    totalErrors: number;
    overallSuccessRate: number;
  } {
    const agents = Array.from(this.agentStatuses.values());
    const onlineAgents = agents.filter(a => a.isOnline);
    
    const totalResponseTimes = agents.map(a => a.responseTime).filter(t => t > 0);
    const avgResponseTime = totalResponseTimes.length > 0 
      ? totalResponseTimes.reduce((a, b) => a + b, 0) / totalResponseTimes.length 
      : 0;

    const totalMessages = agents.reduce((sum, a) => sum + a.messageCount, 0);
    const totalErrors = agents.reduce((sum, a) => sum + a.errorCount, 0);
    const overallSuccessRate = totalMessages > 0 
      ? ((totalMessages - totalErrors) / totalMessages) * 100 
      : 100;

    return {
      totalAgents: agents.length,
      onlineAgents: onlineAgents.length,
      avgResponseTime,
      totalMessages,
      totalErrors,
      overallSuccessRate
    };
  }

  /**
   * Clean up expired sessions
   */
  public cleanupExpiredSessions(): void {
    const now = new Date();
    
    for (const [agentId, status] of this.agentStatuses.entries()) {
      if (status.sessionExpires && status.sessionExpires < now) {
        this.markAgentOffline(agentId);
      }
    }
  }

  /**
   * Get agents with poor performance
   */
  public getPoorPerformingAgents(threshold: number = 10000): AgentStatus[] {
    return Array.from(this.agentStatuses.values())
      .filter(status => status.responseTime > threshold)
      .sort((a, b) => b.responseTime - a.responseTime);
  }

  /**
   * Get agents with high error rates
   */
  public getHighErrorAgents(errorThreshold: number = 5): AgentStatus[] {
    return Array.from(this.agentStatuses.values())
      .filter(status => status.errorCount > errorThreshold)
      .sort((a, b) => b.errorCount - a.errorCount);
  }

  /**
   * Create default agent status
   */
  private createDefaultStatus(agentId: string): AgentStatus {
    return {
      agentId,
      isOnline: false,
      lastSeen: new Date(),
      lastActivity: new Date(),
      responseTime: 0,
      messageCount: 0,
      errorCount: 0
    };
  }

  /**
   * Calculate average response time for agent
   */
  private calculateAverageResponseTime(agentId: string): number {
    const history = this.responseTimeHistory.get(agentId);
    if (!history || history.length === 0) return 0;
    
    return history.reduce((a, b) => a + b, 0) / history.length;
  }

  /**
   * Calculate uptime percentage based on activity history
   */
  private calculateUptime(activities: Date[]): number {
    if (activities.length === 0) return 0;
    
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const recentActivities = activities.filter(activity => activity > oneHourAgo);
    return (recentActivities.length / 60) * 100; // Percentage of minutes with activity
  }
}
