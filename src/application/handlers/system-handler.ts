/**
 * System Handler
 * Orchestrates system operations using specialized handlers
 */

import { DatabaseManager } from '../../infrastructure/database/database-manager.js';
import { AgentMonitor } from '../../services/index.js';
import { AnalyticsManager } from '../../infrastructure/analytics/analytics.js';
import { SecurityManager } from '../../infrastructure/security/security.js';
import { RateLimiter } from '../../infrastructure/analytics/rate-limiter.js';
import { TemplateHandler } from './template-handler.js';
import { StatusHandler } from './status-handler.js';

export class SystemHandler {
  private templateHandler: TemplateHandler;
  private statusHandler: StatusHandler;

  constructor(
    private db: DatabaseManager,
    private agentMonitor: AgentMonitor,
    private analyticsManager: AnalyticsManager,
    private securityManager: SecurityManager,
    private rateLimiter: RateLimiter
  ) {
    this.templateHandler = new TemplateHandler(db);
    this.statusHandler = new StatusHandler(db, agentMonitor, analyticsManager, securityManager);
  }

  /**
   * Handle template requests
   */
  async handleGetTemplates(args: any): Promise<any> {
    return await this.templateHandler.handleGetTemplates(args);
  }

  /**
   * Handle system status requests
   */
  async handleSystemStatus(args: any): Promise<any> {
    return await this.statusHandler.handleSystemStatus(args);
  }

  /**
   * Handle agent synchronization status
   */
  async handleAgentSyncStatus(args: any): Promise<any> {
    const { agent_id } = args;
    
    if (!agent_id) {
      throw new Error('agent_id is required for agent sync status');
    }

    const agentStatus = this.agentMonitor.getAgentStatus(agent_id);
    const agentMetrics = this.agentMonitor.getAgentMetrics(agent_id);
    
    if (!agentStatus) {
      throw new Error(`Agent ${agent_id} not found`);
    }

    return {
      agent_id,
      sync_status: {
        is_online: agentStatus.isOnline,
        last_seen: agentStatus.lastSeen.toISOString(),
        identity_stability: agentStatus.roleConsistency,
        conversation_context: agentStatus.conversationContext,
        active_threads: agentStatus.activeThreads?.length || 0,
        last_identity_check: agentStatus.lastIdentityCheck?.toISOString()
      },
      metrics: agentMetrics ? {
        avg_response_time: agentMetrics.avgResponseTime,
        total_messages: agentMetrics.totalMessages,
        success_rate: agentMetrics.successRate,
        uptime: agentMetrics.uptime,
        identity_stability: agentMetrics.identityStability,
        conversation_coherence: agentMetrics.conversationCoherence,
        ghost_interactions: agentMetrics.ghostInteractionCount,
        self_interactions: agentMetrics.selfInteractionCount
      } : null,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Handle system health check
   */
  getHealthCheck(): any {
    return this.statusHandler.getHealthCheck();
  }

  /**
   * Handle template metadata
   */
  getTemplateMetadata(): any {
    return this.templateHandler.getTemplateMetadata();
  }
}
