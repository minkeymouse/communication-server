/**
 * Status Handler
 * Handles system status and health monitoring
 */

import { DatabaseManager } from '../../infrastructure/database/database-manager.js';
import { AgentMonitor } from '../../services/index.js';
import { AnalyticsManager } from '../../infrastructure/analytics/analytics.js';
import { SecurityManager } from '../../infrastructure/security/security.js';

export class StatusHandler {
  private startTime: Date;
  private serverId: string;

  constructor(
    private db: DatabaseManager,
    private agentMonitor: AgentMonitor,
    private analyticsManager: AnalyticsManager,
    private securityManager: SecurityManager
  ) {
    this.startTime = new Date();
    this.serverId = `server-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Handle system status request
   */
  async handleSystemStatus(args: any): Promise<any> {
    const { include_analytics = true, include_performance = true, include_security = true, agent_id, time_range = '24h' } = args;
    
    const result: any = {
      server_time: new Date().toISOString(),
      version: '2.0.0',
      server_id: this.serverId
    };
    
    // Basic health
    result.health = {
      status: 'healthy',
      uptime: process.uptime(),
      memory_usage: process.memoryUsage(),
      start_time: this.startTime.toISOString()
    };
    
    // Performance metrics
    if (include_performance) {
      result.performance = {
        total_agents: this.db.getAllActiveAgents().length,
        active_sessions: this.db.getActiveSessionsCount(),
        total_messages: this.db.getTotalMessageCount(),
        database_stats: this.db.getDatabaseStats(),
        system_health: this.agentMonitor.getSystemHealth()
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
        security_stats: this.securityManager.getSecurityStats(),
        key_rotation_status: 'healthy',
        encryption_enabled: true
      };
    }

    // Agent-specific status
    if (agent_id) {
      const agentStatus = this.agentMonitor.getAgentStatus(agent_id);
      const agentMetrics = this.agentMonitor.getAgentMetrics(agent_id);
      
      if (agentStatus) {
        result.agent_status = {
          agent_id,
          is_online: agentStatus.isOnline,
          last_seen: agentStatus.lastSeen.toISOString(),
          message_count: agentStatus.messageCount,
          error_count: agentStatus.errorCount,
          role_consistency: agentStatus.roleConsistency
        };
      }
      
      if (agentMetrics) {
        result.agent_metrics = {
          avg_response_time: agentMetrics.avgResponseTime,
          success_rate: agentMetrics.successRate,
          uptime: agentMetrics.uptime,
          identity_stability: agentMetrics.identityStability,
          conversation_coherence: agentMetrics.conversationCoherence
        };
      }
    }
    
    return result;
  }

  /**
   * Get analytics data
   */
  private async getAnalytics(timeRange: string): Promise<any> {
    const startTime = new Date();
    const endTime = new Date();
    
    // Parse time range
    switch (timeRange) {
      case '1h':
        startTime.setHours(startTime.getHours() - 1);
        break;
      case '24h':
        startTime.setDate(startTime.getDate() - 1);
        break;
      case '7d':
        startTime.setDate(startTime.getDate() - 7);
        break;
      case '30d':
        startTime.setDate(startTime.getDate() - 30);
        break;
      default:
        startTime.setDate(startTime.getDate() - 1);
    }

    return {
      time_range: timeRange,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      message_volume: this.db.getTotalMessageCount(),
      active_agents: this.db.getAllActiveAgents().length,
      error_rate: 0.02, // Placeholder
      average_response_time: 150 // Placeholder in ms
    };
  }

  /**
   * Get system health check
   */
  getHealthCheck(): any {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: this.db.getDatabaseStats(),
      agents: {
        total: this.db.getAllActiveAgents().length,
        online: this.agentMonitor.getOnlineAgents().length
      }
    };
  }
}
