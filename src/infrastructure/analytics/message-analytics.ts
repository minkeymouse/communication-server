/**
 * Message Analytics Manager
 * Handles message-specific analytics and reporting
 */

export interface MessageAnalytics {
  totalMessages: number;
  messagesByPriority: Record<string, number>;
  messagesBySecurityLevel: Record<string, number>;
  averageMessageLength: number;
  messagesByHour: number[];
  messagesByDay: number[];
  topSenders: Array<{ agentId: string; count: number }>;
  topRecipients: Array<{ agentId: string; count: number }>;
  responseTimeStats: {
    average: number;
    median: number;
    p95: number;
    p99: number;
  };
}

export class MessageAnalyticsManager {
  private messageHistory: Array<{
    id: string;
    fromAgentId: string;
    toAgentId: string;
    priority: string;
    securityLevel: string;
    length: number;
    timestamp: Date;
    responseTime?: number;
  }> = [];
  private readonly MAX_MESSAGES = 5000; // Keep last 5k messages in memory

  recordMessage(
    messageId: string,
    fromAgentId: string,
    toAgentId: string,
    priority: string,
    securityLevel: string,
    content: string,
    responseTime?: number
  ): void {
    const messageRecord = {
      id: messageId,
      fromAgentId,
      toAgentId,
      priority,
      securityLevel,
      length: content.length,
      timestamp: new Date(),
      responseTime
    };

    this.messageHistory.push(messageRecord);

    // Cleanup old messages if we exceed the limit
    if (this.messageHistory.length > this.MAX_MESSAGES) {
      this.messageHistory = this.messageHistory.slice(-this.MAX_MESSAGES);
    }
  }

  getMessageAnalytics(): MessageAnalytics {
    if (this.messageHistory.length === 0) {
      return this.getEmptyAnalytics();
    }

    const messagesByPriority: Record<string, number> = {};
    const messagesBySecurityLevel: Record<string, number> = {};
    const senderCounts: Record<string, number> = {};
    const recipientCounts: Record<string, number> = {};
    const responseTimes: number[] = [];
    let totalLength = 0;

    this.messageHistory.forEach(message => {
      // Priority counts
      messagesByPriority[message.priority] = (messagesByPriority[message.priority] || 0) + 1;
      
      // Security level counts
      messagesBySecurityLevel[message.securityLevel] = (messagesBySecurityLevel[message.securityLevel] || 0) + 1;
      
      // Sender counts
      senderCounts[message.fromAgentId] = (senderCounts[message.fromAgentId] || 0) + 1;
      
      // Recipient counts
      recipientCounts[message.toAgentId] = (recipientCounts[message.toAgentId] || 0) + 1;
      
      // Length tracking
      totalLength += message.length;
      
      // Response time tracking
      if (message.responseTime) {
        responseTimes.push(message.responseTime);
      }
    });

    // Calculate top senders and recipients
    const topSenders = Object.entries(senderCounts)
      .map(([agentId, count]) => ({ agentId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topRecipients = Object.entries(recipientCounts)
      .map(([agentId, count]) => ({ agentId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate response time statistics
    const responseTimeStats = this.calculateResponseTimeStats(responseTimes);

    // Calculate hourly and daily distributions
    const messagesByHour = this.calculateHourlyDistribution();
    const messagesByDay = this.calculateDailyDistribution();

    return {
      totalMessages: this.messageHistory.length,
      messagesByPriority,
      messagesBySecurityLevel,
      averageMessageLength: totalLength / this.messageHistory.length,
      messagesByHour,
      messagesByDay,
      topSenders,
      topRecipients,
      responseTimeStats
    };
  }

  getMessagesByAgent(agentId: string): {
    sent: number;
    received: number;
    averageLength: number;
    averageResponseTime: number;
  } {
    const sentMessages = this.messageHistory.filter(m => m.fromAgentId === agentId);
    const receivedMessages = this.messageHistory.filter(m => m.toAgentId === agentId);
    
    const sentLength = sentMessages.reduce((sum, m) => sum + m.length, 0);
    const receivedLength = receivedMessages.reduce((sum, m) => sum + m.length, 0);
    
    const responseTimes = receivedMessages
      .filter(m => m.responseTime)
      .map(m => m.responseTime!);
    
    return {
      sent: sentMessages.length,
      received: receivedMessages.length,
      averageLength: sentMessages.length > 0 ? sentLength / sentMessages.length : 0,
      averageResponseTime: responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0
    };
  }

  getMessagesInTimeRange(startTime: Date, endTime: Date): Array<{
    id: string;
    fromAgentId: string;
    toAgentId: string;
    priority: string;
    securityLevel: string;
    length: number;
    timestamp: Date;
  }> {
    return this.messageHistory.filter(message => 
      message.timestamp >= startTime && message.timestamp <= endTime
    );
  }

  cleanupOldMessages(olderThanDays: number = 30): number {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const initialCount = this.messageHistory.length;
    this.messageHistory = this.messageHistory.filter(message => message.timestamp > cutoffDate);
    return initialCount - this.messageHistory.length;
  }

  private getEmptyAnalytics(): MessageAnalytics {
    return {
      totalMessages: 0,
      messagesByPriority: {},
      messagesBySecurityLevel: {},
      averageMessageLength: 0,
      messagesByHour: new Array(24).fill(0),
      messagesByDay: new Array(7).fill(0),
      topSenders: [],
      topRecipients: [],
      responseTimeStats: {
        average: 0,
        median: 0,
        p95: 0,
        p99: 0
      }
    };
  }

  private calculateResponseTimeStats(responseTimes: number[]): {
    average: number;
    median: number;
    p95: number;
    p99: number;
  } {
    if (responseTimes.length === 0) {
      return { average: 0, median: 0, p95: 0, p99: 0 };
    }

    const sorted = [...responseTimes].sort((a, b) => a - b);
    const average = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    return { average, median, p95, p99 };
  }

  private calculateHourlyDistribution(): number[] {
    const hourly = new Array(24).fill(0);
    this.messageHistory.forEach(message => {
      const hour = message.timestamp.getHours();
      hourly[hour]++;
    });
    return hourly;
  }

  private calculateDailyDistribution(): number[] {
    const daily = new Array(7).fill(0);
    this.messageHistory.forEach(message => {
      const day = message.timestamp.getDay();
      daily[day]++;
    });
    return daily;
  }
}
