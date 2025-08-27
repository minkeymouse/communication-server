/**
 * Agent Monitor Service
 * Main entry point for agent monitoring functionality
 */

import { EventEmitter } from 'events';
import { AgentStatus, AgentMetrics, IdentityValidation } from './types.js';
import { IdentityManager } from './identity-manager.js';
import { PerformanceTracker } from './performance-tracker.js';

export class AgentMonitor extends EventEmitter {
  private agentStatuses: Map<string, AgentStatus> = new Map();
  private identityManager: IdentityManager;
  private performanceTracker: PerformanceTracker;
  private ghostAgentDetections: Map<string, number> = new Map();
  private selfInteractionDetections: Map<string, number> = new Map();

  constructor() {
    super();
    this.identityManager = new IdentityManager();
    this.performanceTracker = new PerformanceTracker();
  }

  /**
   * Update agent status with enhanced identity tracking
   */
  public updateAgentStatus(agentId: string, updates: Partial<AgentStatus>): void {
    const currentStatus = this.agentStatuses.get(agentId) || this.createDefaultStatus(agentId);
    
    // Generate identity hash if not present
    if (!currentStatus.identityHash) {
      currentStatus.identityHash = this.identityManager.generateIdentityHash(agentId, updates);
    }
    
    // Validate identity consistency
    const identityValidation = this.identityManager.validateAgentIdentity(agentId, updates);
    
    const updatedStatus: AgentStatus = {
      ...currentStatus,
      ...updates,
      lastActivity: new Date(),
      roleConsistency: identityValidation.confidence,
      lastIdentityCheck: new Date()
    };

    this.agentStatuses.set(agentId, updatedStatus);
    this.emit('agentStatusUpdated', updatedStatus);
    
    // Emit identity drift event if detected
    if (identityValidation.driftDetected) {
      this.emit('identityDriftDetected', {
        agentId,
        validation: identityValidation,
        timestamp: new Date()
      });
    }
  }

  /**
   * Mark agent as online
   */
  public markAgentOnline(agentId: string, sessionToken?: string, sessionExpires?: Date): void {
    this.updateAgentStatus(agentId, {
      isOnline: true,
      lastSeen: new Date(),
      sessionToken,
      sessionExpires
    });
    
    this.performanceTracker.markOnline(agentId);
    this.performanceTracker.recordActivity(agentId);
  }

  /**
   * Mark agent as offline
   */
  public markAgentOffline(agentId: string): void {
    this.updateAgentStatus(agentId, {
      isOnline: false,
      lastSeen: new Date()
    });
    
    this.performanceTracker.markOffline(agentId);
  }

  /**
   * Get agent status
   */
  public getAgentStatus(agentId: string): AgentStatus | null {
    return this.agentStatuses.get(agentId) || null;
  }

  /**
   * Get agent metrics
   */
  public getAgentMetrics(agentId: string): AgentMetrics | null {
    const baseMetrics = this.performanceTracker.getAgentMetrics(agentId);
    if (!baseMetrics) return null;

    return {
      ...baseMetrics,
      identityStability: this.identityManager.getIdentityStability(agentId),
      conversationCoherence: 1.0, // Will be calculated by ConversationManager
      ghostInteractionCount: this.ghostAgentDetections.get(agentId) || 0,
      selfInteractionCount: this.selfInteractionDetections.get(agentId) || 0
    };
  }

  /**
   * Record ghost agent interaction
   */
  public recordGhostInteraction(agentId: string): void {
    const currentCount = this.ghostAgentDetections.get(agentId) || 0;
    this.ghostAgentDetections.set(agentId, currentCount + 1);
    
    this.emit('ghostInteractionDetected', {
      agentId,
      count: currentCount + 1,
      timestamp: new Date()
    });
  }

  /**
   * Record self interaction
   */
  public recordSelfInteraction(agentId: string): void {
    const currentCount = this.selfInteractionDetections.get(agentId) || 0;
    this.selfInteractionDetections.set(agentId, currentCount + 1);
    
    this.emit('selfInteractionDetected', {
      agentId,
      count: currentCount + 1,
      timestamp: new Date()
    });
  }

  /**
   * Record message activity
   */
  public recordMessageActivity(agentId: string, responseTime?: number): void {
    this.performanceTracker.recordMessage(agentId);
    this.performanceTracker.recordActivity(agentId);
    
    if (responseTime) {
      this.performanceTracker.recordResponseTime(agentId, responseTime);
    }
  }

  /**
   * Record error for agent
   */
  public recordError(agentId: string, error: Error): void {
    this.performanceTracker.recordError(agentId, error);
    
    this.emit('agentError', {
      agentId,
      error,
      timestamp: new Date()
    });
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
    return this.getAllAgentStatuses().filter(status => status.isOnline);
  }

  /**
   * Clean up expired agents
   */
  public cleanupExpiredAgents(expirationMinutes: number = 60): void {
    const cutoffTime = new Date(Date.now() - expirationMinutes * 60 * 1000);
    const expiredAgents: string[] = [];

    for (const [agentId, status] of this.agentStatuses.entries()) {
      if (status.lastSeen < cutoffTime) {
        expiredAgents.push(agentId);
      }
    }

    expiredAgents.forEach(agentId => {
      this.agentStatuses.delete(agentId);
      this.performanceTracker.clearMetrics(agentId);
      this.identityManager.clearIdentityHistory(agentId);
      this.ghostAgentDetections.delete(agentId);
      this.selfInteractionDetections.delete(agentId);
    });

    if (expiredAgents.length > 0) {
      this.emit('agentsExpired', {
        agentIds: expiredAgents,
        timestamp: new Date()
      });
    }
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
      errorCount: 0,
      roleConsistency: 1.0,
      activeThreads: []
    };
  }

  /**
   * Get system health metrics
   */
  public getSystemHealth(): {
    totalAgents: number;
    onlineAgents: number;
    averageResponseTime: number;
    totalMessages: number;
    errorRate: number;
  } {
    const allAgents = this.getAllAgentStatuses();
    const onlineAgents = this.getOnlineAgents();
    
    const totalResponseTime = allAgents.reduce((sum, agent) => sum + agent.responseTime, 0);
    const averageResponseTime = allAgents.length > 0 ? totalResponseTime / allAgents.length : 0;
    
    const totalMessages = allAgents.reduce((sum, agent) => sum + agent.messageCount, 0);
    const totalErrors = allAgents.reduce((sum, agent) => sum + agent.errorCount, 0);
    const errorRate = totalMessages > 0 ? totalErrors / totalMessages : 0;

    return {
      totalAgents: allAgents.length,
      onlineAgents: onlineAgents.length,
      averageResponseTime,
      totalMessages,
      errorRate
    };
  }

  // Additional methods needed by application handlers
  public recordActivity(agentId: string): void {
    this.performanceTracker.recordActivity(agentId);
  }

  public validateAgentInteraction(senderId: string, recipientId: string): { isValid: boolean; reason?: string } {
    // Check if sender is trying to message themselves
    if (senderId === recipientId) {
      this.recordSelfInteraction(senderId);
      return { isValid: false, reason: 'Self-interaction detected' };
    }

    // Check if recipient exists and is online
    const recipientStatus = this.getAgentStatus(recipientId);
    if (!recipientStatus) {
      this.recordGhostInteraction(senderId);
      return { isValid: false, reason: 'Recipient agent does not exist' };
    }

    if (!recipientStatus.isOnline) {
      return { isValid: false, reason: 'Recipient agent is offline' };
    }

    return { isValid: true };
  }

  public recordConversationContext(agentId: string, context: any): void {
    // Update agent's conversation context
    this.updateAgentStatus(agentId, {
      conversationContext: JSON.stringify(context)
    });
  }
}

// Export types and classes
export * from './types.js';
export { IdentityManager } from './identity-manager.js';
export { PerformanceTracker } from './performance-tracker.js';
