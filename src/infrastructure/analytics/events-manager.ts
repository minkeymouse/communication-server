/**
 * Analytics Events Manager
 * Handles event tracking, storage, and retrieval for analytics
 */

export interface AnalyticsEvent {
  id: string;
  type: 'message_sent' | 'message_received' | 'agent_login' | 'agent_logout' | 'error' | 'performance';
  agentId: string;
  timestamp: Date;
  data: Record<string, any>;
  metadata?: Record<string, any>;
}

export class AnalyticsEventsManager {
  private events: AnalyticsEvent[] = [];
  private readonly MAX_EVENTS = 10000; // Keep last 10k events in memory

  recordEvent(type: AnalyticsEvent['type'], agentId: string, data: Record<string, any>, metadata?: Record<string, any>): void {
    const event: AnalyticsEvent = {
      id: this.generateEventId(),
      type,
      agentId,
      timestamp: new Date(),
      data,
      metadata
    };

    this.events.push(event);

    // Cleanup old events if we exceed the limit
    if (this.events.length > this.MAX_EVENTS) {
      this.events = this.events.slice(-this.MAX_EVENTS);
    }
  }

  getEventsByType(type: AnalyticsEvent['type'], limit: number = 100): AnalyticsEvent[] {
    return this.events
      .filter(event => event.type === type)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  getEventsByAgent(agentId: string, limit: number = 100): AnalyticsEvent[] {
    return this.events
      .filter(event => event.agentId === agentId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  getEventsInTimeRange(startTime: Date, endTime: Date): AnalyticsEvent[] {
    return this.events.filter(event => 
      event.timestamp >= startTime && event.timestamp <= endTime
    );
  }

  getEventCountByType(): Record<string, number> {
    const counts: Record<string, number> = {};
    this.events.forEach(event => {
      counts[event.type] = (counts[event.type] || 0) + 1;
    });
    return counts;
  }

  getEventCountByAgent(): Record<string, number> {
    const counts: Record<string, number> = {};
    this.events.forEach(event => {
      counts[event.agentId] = (counts[event.agentId] || 0) + 1;
    });
    return counts;
  }

  getRecentEvents(limit: number = 50): AnalyticsEvent[] {
    return this.events
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  cleanupOldEvents(olderThanDays: number = 30): number {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const initialCount = this.events.length;
    this.events = this.events.filter(event => event.timestamp > cutoffDate);
    return initialCount - this.events.length;
  }

  getEventStats(): {
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsByAgent: Record<string, number>;
    oldestEvent: Date | null;
    newestEvent: Date | null;
  } {
    if (this.events.length === 0) {
      return {
        totalEvents: 0,
        eventsByType: {},
        eventsByAgent: {},
        oldestEvent: null,
        newestEvent: null
      };
    }

    const sortedEvents = [...this.events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return {
      totalEvents: this.events.length,
      eventsByType: this.getEventCountByType(),
      eventsByAgent: this.getEventCountByAgent(),
      oldestEvent: sortedEvents[0].timestamp,
      newestEvent: sortedEvents[sortedEvents.length - 1].timestamp
    };
  }

  private generateEventId(): string {
    return `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
