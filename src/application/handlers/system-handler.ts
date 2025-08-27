/**
 * System Handler
 * Handles system status, templates, and utility operations
 */

import { DatabaseManager } from '../../infrastructure/database/database.js';
import { AgentMonitor } from '../../services/agent-monitor.js';
import { AnalyticsManager } from '../../infrastructure/analytics/analytics.js';
import { SecurityManager } from '../../infrastructure/security/security.js';
import { RateLimiter } from '../../infrastructure/analytics/rate-limiter.js';

export class SystemHandler {
  private startTime: Date;
  private serverId: string;

  constructor(
    private db: DatabaseManager,
    private agentMonitor: AgentMonitor,
    private analyticsManager: AnalyticsManager,
    private securityManager: SecurityManager,
    private rateLimiter: RateLimiter
  ) {
    this.startTime = new Date();
    this.serverId = `server-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async handleGetTemplates(args: any): Promise<any> {
    const { template_type, include_system_info = false } = args;
    
    const templates = {
      BUG_REPORT: {
        title: 'Bug Report',
        content: '**Bug Description:**\n\n**Steps to Reproduce:**\n1. \n2. \n3. \n\n**Expected Behavior:**\n\n**Actual Behavior:**\n\n**Environment:**\n- System: \n- Version: \n\n**Additional Information:**'
      },
      FEATURE_REQUEST: {
        title: 'Feature Request',
        content: '**Feature Description:**\n\n**Use Case:**\n\n**Proposed Implementation:**\n\n**Benefits:**\n\n**Priority:** (Low/Medium/High)\n\n**Additional Information:**'
      },
      STATUS_UPDATE: {
        title: 'Status Update',
        content: '**Current Status:**\n\n**Progress Made:**\n\n**Next Steps:**\n\n**Blockers:**\n\n**Timeline:**\n\n**Additional Notes:**'
      }
    };
    
    const result: any = {};
    
    if (template_type && templates[template_type as keyof typeof templates]) {
      result.template = templates[template_type as keyof typeof templates];
    } else {
      result.available_templates = Object.keys(templates);
    }
    
    if (include_system_info) {
      result.system_info = {
        version: '2.0.0',
        server_time: new Date().toISOString(),
        total_agents: this.db.getAllActiveAgents().length,
        active_sessions: this.db.getActiveSessionsCount()
      };
    }
    
    return result;
  }

  async handleSystemStatus(args: any): Promise<any> {
    const { include_analytics = true, include_performance = true, include_security = true, agent_id, time_range = '24h' } = args;
    
    const result: any = {
      server_time: new Date().toISOString(),
      version: '2.0.0'
    };
    
    // Basic health
    result.health = {
      status: 'healthy',
      uptime: process.uptime(),
      memory_usage: process.memoryUsage()
    };
    
    // Performance metrics
    if (include_performance) {
      result.performance = {
        total_agents: this.db.getAllActiveAgents().length,
        active_sessions: this.db.getActiveSessionsCount(),
        total_messages: this.db.getTotalMessageCount(),
        database_stats: this.db.getDatabaseStats()
      };
    }
    
    // Analytics
    if (include_analytics) {
      const analytics = await this.getAnalytics(time_range);
      result.analytics = analytics;
    }
    
    // Security status
    if (include_security) {
      result.security = {
        status: 'active',
        security_stats: this.securityManager.getSecurityStats()
      };
    }
    
    // Agent-specific metrics
    if (agent_id) {
      const agentMetrics = await this.getAgentMetrics(agent_id);
      const rateLimitInfo = await this.getRateLimitInfo(agent_id);
      const threads = await this.getConversationThreads(agent_id);
      
      result.agent_metrics = agentMetrics;
      result.rate_limits = rateLimitInfo;
      result.conversation_threads = threads;
    }
    
    return result;
  }

  private async getAnalytics(timeRange: string): Promise<any> {
    const now = new Date();
    let start: Date;
    
    switch (timeRange) {
      case '1h':
        start = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    const analytics = this.analyticsManager.getAnalyticsForTimeRange(start, now);
    const alerts = this.analyticsManager.getPerformanceAlerts();
    
    return {
      time_range: timeRange,
      start_time: start.toISOString(),
      end_time: now.toISOString(),
      messages: analytics.messages,
      system: analytics.system,
      agents: analytics.agents,
      alerts
    };
  }

  private async getAgentMetrics(agentId: string): Promise<any> {
    const metrics = this.agentMonitor.getAgentMetrics(agentId);
    if (!metrics) {
      throw new Error(`Agent '${agentId}' not found`);
    }

    return {
      agent_id: metrics.agentId,
      avg_response_time_ms: Math.round(metrics.avgResponseTime),
      total_messages: metrics.totalMessages,
      success_rate_percent: Math.round(metrics.successRate),
      uptime_percent: Math.round(metrics.uptime),
      last_seen: metrics.lastSeen.toISOString()
    };
  }

  private async getRateLimitInfo(agentId: string): Promise<any> {
    const limitInfo = this.rateLimiter.getAllLimitInfo(agentId);
    const stats = this.rateLimiter.getStats();
    
    return {
      agent_id: agentId,
      limits: limitInfo,
      stats
    };
  }

  private async getConversationThreads(agentId: string): Promise<any> {
    // This would need to be implemented based on the conversation thread manager
    // For now, return a placeholder
    return {
      agent_id: agentId,
      threads: [],
      total_threads: 0
    };
  }

  async handleQueryMessages(args: any): Promise<any> {
    const { 
      query_type = 'search', 
      query = '', 
      agent_id, 
      conversation_id, 
      thread_id, 
      start_date, 
      end_date, 
      priority, 
      limit = 50 
    } = args;

    try {
      let messages: any[] = [];

      switch (query_type) {
        case 'search':
          if (!query) {
            throw new Error('Query string is required for search');
          }
          messages = this.db.searchMessageLogs(query, limit);
          break;

        case 'by_agent':
          if (!agent_id) {
            throw new Error('Agent ID is required for agent query');
          }
          messages = this.db.getMessageLogsByAgent(agent_id, limit);
          break;

        case 'by_conversation':
          if (!conversation_id) {
            throw new Error('Conversation ID is required for conversation query');
          }
          messages = this.db.getMessageLogsByConversation(conversation_id);
          break;

        case 'by_thread':
          if (!thread_id) {
            throw new Error('Thread ID is required for thread query');
          }
          messages = this.db.getMessageLogsByThread(thread_id);
          break;

        case 'by_date_range':
          if (!start_date || !end_date) {
            throw new Error('Start date and end date are required for date range query');
          }
          const startDate = new Date(start_date);
          const endDate = new Date(end_date);
          messages = this.db.getMessageLogsByDateRange(startDate, endDate, limit);
          break;

        case 'by_priority':
          if (!priority) {
            throw new Error('Priority is required for priority query');
          }
          messages = this.db.getMessageLogsByPriority(priority, limit);
          break;

        default:
          throw new Error(`Unknown query type: ${query_type}`);
      }

      return {
        query_type,
        query: query || `${query_type}: ${agent_id || conversation_id || thread_id || priority || `${start_date} to ${end_date}`}`,
        total_count: messages.length,
        messages: messages.map(msg => ({
          id: msg.id,
          message_id: msg.messageId,
          conversation_id: msg.conversationId,
          from_agent: msg.fromAgentName,
          from_agent_id: msg.fromAgentId,
          to_agent: msg.toAgentName,
          to_agent_id: msg.toAgentId,
          subject: msg.subject,
          content: msg.contentPlain, // Human-readable content
          content_encrypted: msg.contentEncrypted,
          priority: msg.priority,
          security_level: msg.securityLevel,
          state: msg.state,
          created_at: msg.createdAt.toISOString(),
          read_at: msg.readAt?.toISOString(),
          replied_at: msg.repliedAt?.toISOString(),
          thread_id: msg.threadId,
          metadata: msg.metadata
        }))
      };
    } catch (error: any) {
      throw new Error(`Failed to query messages: ${error.message}`);
    }
  }
}
