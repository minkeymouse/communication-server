/**
 * Simplified Analytics Manager
 * Orchestrates analytics operations using specialized managers
 */

import { AnalyticsEventsManager } from './events-manager.js';
import { MessageAnalyticsManager, MessageAnalytics } from './message-analytics.js';

export interface AgentAnalytics {
  agentId: string;
  totalMessages: number;
  messagesSent: number;
  messagesReceived: number;
  averageResponseTime: number;
  loginCount: number;
  lastSeen: Date;
  uptimePercentage: number;
  errorRate: number;
  securityLevelUsage: Record<string, number>;
  priorityUsage: Record<string, number>;
}

export interface SystemAnalytics {
  totalAgents: number;
  activeAgents: number;
  totalMessages: number;
  systemUptime: number;
  averageResponseTime: number;
  errorRate: number;
  queueStats: {
    averageQueueLength: number;
    maxQueueLength: number;
    averageProcessingTime: number;
  };
  threadStats: {
    totalThreads: number;
    activeThreads: number;
    averageThreadLength: number;
  };
  securityStats: {
    encryptedMessages: number;
    signedMessages: number;
    basicMessages: number;
    securityLevelDistribution: Record<string, number>;
  };
}

export class AnalyticsManager {
  private eventsManager: AnalyticsEventsManager;
  private messageAnalytics: MessageAnalyticsManager;
  private agentActivity: Map<string, {
    loginCount: number;
    lastSeen: Date;
    totalMessages: number;
    messagesSent: number;
    messagesReceived: number;
    responseTimes: number[];
    errors: number;
    securityLevelUsage: Record<string, number>;
    priorityUsage: Record<string, number>;
  }> = new Map();
  private startTime: Date;

  constructor() {
    this.eventsManager = new AnalyticsEventsManager();
    this.messageAnalytics = new MessageAnalyticsManager();
    this.startTime = new Date();
  }

  recordMessage(
    messageId: string,
    fromAgentId: string,
    toAgentId: string,
    priority: string,
    securityLevel: string,
    content: string,
    responseTime?: number
  ): void {
    this.messageAnalytics.recordMessage(messageId, fromAgentId, toAgentId, priority, securityLevel, content, responseTime);
    
    // Record event
    this.eventsManager.recordEvent('message_sent', fromAgentId, {
      messageId,
      toAgentId,
      priority,
      securityLevel,
      length: content.length,
      responseTime
    });

    // Update agent activity
    this.updateAgentActivity(fromAgentId, 'sent', priority, securityLevel, responseTime);
    this.updateAgentActivity(toAgentId, 'received', priority, securityLevel);
  }

  recordAgentLogin(agentId: string): void {
    this.eventsManager.recordEvent('agent_login', agentId, {});
    
    const activity = this.agentActivity.get(agentId) || this.createEmptyAgentActivity();
    activity.loginCount++;
    activity.lastSeen = new Date();
    this.agentActivity.set(agentId, activity);
  }

  recordAgentLogout(agentId: string): void {
    this.eventsManager.recordEvent('agent_logout', agentId, {});
  }

  recordError(agentId: string, error: string, context?: Record<string, any>): void {
    this.eventsManager.recordEvent('error', agentId, { error, context });
    
    const activity = this.agentActivity.get(agentId) || this.createEmptyAgentActivity();
    activity.errors++;
    this.agentActivity.set(agentId, activity);
  }

  recordPerformance(agentId: string, metric: string, value: number): void {
    this.eventsManager.recordEvent('performance', agentId, { metric, value });
  }

  getSystemAnalytics(): SystemAnalytics {
    const messageAnalytics = this.messageAnalytics.getMessageAnalytics();
    const eventStats = this.eventsManager.getEventStats();
    
    // Calculate security stats from message analytics
    const securityStats = {
      encryptedMessages: messageAnalytics.messagesBySecurityLevel['encrypted'] || 0,
      signedMessages: messageAnalytics.messagesBySecurityLevel['signed'] || 0,
      basicMessages: messageAnalytics.messagesBySecurityLevel['basic'] || 0,
      securityLevelDistribution: messageAnalytics.messagesBySecurityLevel
    };

    // Calculate error rate
    const totalEvents = eventStats.totalEvents;
    const errorEvents = eventStats.eventsByType['error'] || 0;
    const errorRate = totalEvents > 0 ? errorEvents / totalEvents : 0;

    return {
      totalAgents: this.agentActivity.size,
      activeAgents: this.getActiveAgentsCount(),
      totalMessages: messageAnalytics.totalMessages,
      systemUptime: Date.now() - this.startTime.getTime(),
      averageResponseTime: messageAnalytics.responseTimeStats.average,
      errorRate,
      queueStats: {
        averageQueueLength: 0, // Would need queue manager integration
        maxQueueLength: 0,
        averageProcessingTime: 0
      },
      threadStats: {
        totalThreads: 0, // Would need thread manager integration
        activeThreads: 0,
        averageThreadLength: 0
      },
      securityStats
    };
  }

  getAgentAnalytics(agentId: string): AgentAnalytics | null {
    const activity = this.agentActivity.get(agentId);
    if (!activity) return null;

    const messageStats = this.messageAnalytics.getMessagesByAgent(agentId);
    const uptimePercentage = this.calculateUptimePercentage(agentId);
    const errorRate = activity.totalMessages > 0 ? activity.errors / activity.totalMessages : 0;

    return {
      agentId,
      totalMessages: activity.totalMessages,
      messagesSent: activity.messagesSent,
      messagesReceived: activity.messagesReceived,
      averageResponseTime: messageStats.averageResponseTime,
      loginCount: activity.loginCount,
      lastSeen: activity.lastSeen,
      uptimePercentage,
      errorRate,
      securityLevelUsage: activity.securityLevelUsage,
      priorityUsage: activity.priorityUsage
    };
  }

  getAnalyticsForTimeRange(startTime: Date, endTime: Date): {
    messages: MessageAnalytics;
    system: SystemAnalytics;
    agents: AgentAnalytics[];
  } {
    const messages = this.messageAnalytics.getMessageAnalytics();
    const system = this.getSystemAnalytics();
    
    const agents: AgentAnalytics[] = [];
    for (const [agentId] of this.agentActivity) {
      const agentAnalytics = this.getAgentAnalytics(agentId);
      if (agentAnalytics) {
        agents.push(agentAnalytics);
      }
    }

    return { messages, system, agents };
  }

  getPerformanceAlerts(): Array<{
    type: 'high_error_rate' | 'slow_response_time' | 'high_queue_length';
    agentId?: string;
    message: string;
    severity: 'low' | 'medium' | 'high';
  }> {
    const alerts: Array<{
      type: 'high_error_rate' | 'slow_response_time' | 'high_queue_length';
      agentId?: string;
      message: string;
      severity: 'low' | 'medium' | 'high';
    }> = [];

    // Check for high error rates
    for (const [agentId, activity] of this.agentActivity) {
      if (activity.totalMessages > 10) {
        const errorRate = activity.errors / activity.totalMessages;
        if (errorRate > 0.1) {
          alerts.push({
            type: 'high_error_rate',
            agentId,
            message: `Agent ${agentId} has ${(errorRate * 100).toFixed(1)}% error rate`,
            severity: errorRate > 0.2 ? 'high' : 'medium'
          });
        }
      }
    }

    // Check for slow response times
    const messageAnalytics = this.messageAnalytics.getMessageAnalytics();
    if (messageAnalytics.responseTimeStats.p95 > 5000) {
      alerts.push({
        type: 'slow_response_time',
        message: `95th percentile response time is ${messageAnalytics.responseTimeStats.p95}ms`,
        severity: messageAnalytics.responseTimeStats.p95 > 10000 ? 'high' : 'medium'
      });
    }

    return alerts;
  }

  cleanupOldData(): void {
    this.eventsManager.cleanupOldEvents(30);
    this.messageAnalytics.cleanupOldMessages(30);
  }

  private updateAgentActivity(
    agentId: string, 
    action: 'sent' | 'received', 
    priority: string, 
    securityLevel: string, 
    responseTime?: number
  ): void {
    const activity = this.agentActivity.get(agentId) || this.createEmptyAgentActivity();
    
    activity.totalMessages++;
    activity.lastSeen = new Date();
    
    if (action === 'sent') {
      activity.messagesSent++;
    } else {
      activity.messagesReceived++;
    }
    
    if (responseTime) {
      activity.responseTimes.push(responseTime);
    }
    
    // Update usage statistics
    activity.priorityUsage[priority] = (activity.priorityUsage[priority] || 0) + 1;
    activity.securityLevelUsage[securityLevel] = (activity.securityLevelUsage[securityLevel] || 0) + 1;
    
    this.agentActivity.set(agentId, activity);
  }

  private createEmptyAgentActivity(): {
    loginCount: number;
    lastSeen: Date;
    totalMessages: number;
    messagesSent: number;
    messagesReceived: number;
    responseTimes: number[];
    errors: number;
    securityLevelUsage: Record<string, number>;
    priorityUsage: Record<string, number>;
  } {
    return {
      loginCount: 0,
      lastSeen: new Date(),
      totalMessages: 0,
      messagesSent: 0,
      messagesReceived: 0,
      responseTimes: [],
      errors: 0,
      securityLevelUsage: {},
      priorityUsage: {}
    };
  }

  private getActiveAgentsCount(): number {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    let activeCount = 0;
    for (const activity of this.agentActivity.values()) {
      if (activity.lastSeen > fiveMinutesAgo) {
        activeCount++;
      }
    }
    
    return activeCount;
  }

  private calculateUptimePercentage(agentId: string): number {
    // Simplified uptime calculation - in a real system you'd track more detailed metrics
    const activity = this.agentActivity.get(agentId);
    if (!activity || activity.totalMessages === 0) return 0;
    
    // Assume uptime based on message activity
    return Math.min(100, (activity.totalMessages / 100) * 100);
  }
}
