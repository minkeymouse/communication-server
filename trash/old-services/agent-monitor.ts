/**
 * Agent Status Monitoring System
 * Tracks agent availability, response times, and performance metrics
 * Enhanced with identity persistence and session management
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
  // Enhanced identity tracking
  identityHash?: string; // Unique identity fingerprint
  roleConsistency?: number; // 0-1 score of role consistency
  conversationContext?: string; // Current conversation context
  activeThreads?: string[]; // Currently active conversation threads
  lastIdentityCheck?: Date; // When identity was last validated
}

export interface AgentMetrics {
  agentId: string;
  avgResponseTime: number;
  totalMessages: number;
  successRate: number;
  uptime: number; // Percentage of time online
  lastSeen: Date;
  // Enhanced metrics
  identityStability: number; // 0-1 score of identity stability
  conversationCoherence: number; // 0-1 score of conversation coherence
  ghostInteractionCount: number; // Count of interactions with non-existent agents
  selfInteractionCount: number; // Count of self-interactions
}

export interface IdentityValidation {
  isValid: boolean;
  confidence: number;
  driftDetected: boolean;
  correctionApplied: boolean;
  lastValidation: Date;
}

export class AgentMonitor extends EventEmitter {
  private agentStatuses: Map<string, AgentStatus> = new Map();
  private responseTimeHistory: Map<string, number[]> = new Map();
  private activityHistory: Map<string, Date[]> = new Map();
  private errorHistory: Map<string, Error[]> = new Map();
  // Enhanced tracking
  private identityHistory: Map<string, string[]> = new Map(); // Agent ID -> identity hashes
  private conversationHistory: Map<string, any[]> = new Map(); // Agent ID -> conversation history
  private ghostAgentDetections: Map<string, number> = new Map(); // Track ghost agent interactions
  private selfInteractionDetections: Map<string, number> = new Map(); // Track self-interactions

  /**
   * Update agent status with enhanced identity tracking
   */
  public updateAgentStatus(
    agentId: string,
    updates: Partial<AgentStatus>
  ): void {
    const currentStatus = this.agentStatuses.get(agentId) || this.createDefaultStatus(agentId);
    
    // Generate identity hash if not present
    if (!currentStatus.identityHash) {
      currentStatus.identityHash = this.generateIdentityHash(agentId, updates);
    }
    
    // Validate identity consistency
    const identityValidation = this.validateAgentIdentity(agentId, updates);
    
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
   * Validate agent identity and detect drift
   */
  public validateAgentIdentity(agentId: string, updates: Partial<AgentStatus>): IdentityValidation {
    const currentStatus = this.agentStatuses.get(agentId);
    if (!currentStatus) {
      return {
        isValid: true,
        confidence: 1.0,
        driftDetected: false,
        correctionApplied: false,
        lastValidation: new Date()
      };
    }

    // Check for identity drift patterns
    const identityHistory = this.identityHistory.get(agentId) || [];
    const currentHash = this.generateIdentityHash(agentId, updates);
    
    // Calculate identity consistency
    const consistencyScore = this.calculateIdentityConsistency(agentId, currentHash);
    
    // Detect drift if consistency is low
    const driftDetected = consistencyScore < 0.7;
    
    // Store identity hash
    identityHistory.push(currentHash);
    if (identityHistory.length > 50) {
      identityHistory.shift();
    }
    this.identityHistory.set(agentId, identityHistory);

    return {
      isValid: consistencyScore > 0.5,
      confidence: consistencyScore,
      driftDetected,
      correctionApplied: false,
      lastValidation: new Date()
    };
  }

  /**
   * Detect and prevent ghost agent interactions
   */
  public validateAgentInteraction(fromAgentId: string, toAgentId: string): {
    isValid: boolean;
    reason?: string;
    ghostAgent?: boolean;
    selfInteraction?: boolean;
  } {
    // Check if target agent exists and is online
    const targetStatus = this.agentStatuses.get(toAgentId);
    if (!targetStatus) {
      this.recordGhostAgentInteraction(fromAgentId, toAgentId);
      return {
        isValid: false,
        reason: `Target agent '${toAgentId}' does not exist`,
        ghostAgent: true
      };
    }

    if (!targetStatus.isOnline) {
      this.recordGhostAgentInteraction(fromAgentId, toAgentId);
      return {
        isValid: false,
        reason: `Target agent '${toAgentId}' is offline`,
        ghostAgent: true
      };
    }

    // Check for self-interaction
    if (fromAgentId === toAgentId) {
      this.recordSelfInteraction(fromAgentId);
      return {
        isValid: false,
        reason: `Agent '${fromAgentId}' attempting to message itself`,
        selfInteraction: true
      };
    }

    return { isValid: true };
  }

  /**
   * Record ghost agent interaction
   */
  private recordGhostAgentInteraction(fromAgentId: string, ghostAgentId: string): void {
    const count = this.ghostAgentDetections.get(fromAgentId) || 0;
    this.ghostAgentDetections.set(fromAgentId, count + 1);
    
    this.emit('ghostAgentDetected', {
      fromAgentId,
      ghostAgentId,
      timestamp: new Date(),
      totalDetections: count + 1
    });
  }

  /**
   * Record self-interaction
   */
  private recordSelfInteraction(agentId: string): void {
    const count = this.selfInteractionDetections.get(agentId) || 0;
    this.selfInteractionDetections.set(agentId, count + 1);
    
    this.emit('selfInteractionDetected', {
      agentId,
      timestamp: new Date(),
      totalDetections: count + 1
    });
  }

  /**
   * Generate identity hash for agent
   */
  private generateIdentityHash(agentId: string, updates: Partial<AgentStatus>): string {
    const identityData = {
      agentId,
      role: updates.metadata?.role || 'unknown',
      capabilities: updates.metadata?.capabilities || [],
      workspace: updates.metadata?.workspace || 'unknown',
      timestamp: new Date().toISOString()
    };
    
    return Buffer.from(JSON.stringify(identityData)).toString('base64').substring(0, 16);
  }

  /**
   * Calculate identity consistency score
   */
  private calculateIdentityConsistency(agentId: string, currentHash: string): number {
    const identityHistory = this.identityHistory.get(agentId) || [];
    if (identityHistory.length === 0) {
      return 1.0;
    }

    // Calculate similarity with recent identity hashes
    const recentHashes = identityHistory.slice(-10);
    const matches = recentHashes.filter(hash => hash === currentHash).length;
    
    return matches / recentHashes.length;
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
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;

    const activities = this.activityHistory.get(agentId) || [];
    const uptime = this.calculateUptime(activities);

    const ghostInteractions = this.ghostAgentDetections.get(agentId) || 0;
    const selfInteractions = this.selfInteractionDetections.get(agentId) || 0;

    return {
      agentId,
      avgResponseTime,
      totalMessages: status.messageCount,
      successRate: this.calculateSuccessRate(agentId),
      uptime,
      lastSeen: status.lastSeen,
      identityStability: status.roleConsistency || 1.0,
      conversationCoherence: this.calculateConversationCoherence(agentId),
      ghostInteractionCount: ghostInteractions,
      selfInteractionCount: selfInteractions
    };
  }

  /**
   * Calculate conversation coherence score
   */
  private calculateConversationCoherence(agentId: string): number {
    const conversations = this.conversationHistory.get(agentId) || [];
    if (conversations.length < 2) return 1.0;

    // Simple coherence calculation based on conversation flow
    let coherenceScore = 1.0;
    for (let i = 1; i < conversations.length; i++) {
      const prev = conversations[i - 1];
      const curr = conversations[i];
      
      // Check for topic continuity, response relevance, etc.
      if (prev.topic && curr.topic && prev.topic !== curr.topic) {
        coherenceScore -= 0.1;
      }
    }

    return Math.max(0, coherenceScore);
  }

  /**
   * Record conversation context for coherence tracking
   */
  public recordConversationContext(agentId: string, context: any): void {
    if (!this.conversationHistory.has(agentId)) {
      this.conversationHistory.set(agentId, []);
    }
    
    const history = this.conversationHistory.get(agentId)!;
    history.push({
      ...context,
      timestamp: new Date()
    });
    
    // Keep only last 100 conversations
    if (history.length > 100) {
      history.shift();
    }
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

  /**
   * Calculate success rate
   */
  private calculateSuccessRate(agentId: string): number {
    const status = this.agentStatuses.get(agentId);
    if (!status) return 0;

    const totalMessages = status.messageCount;
    const totalErrors = status.errorCount;

    return totalMessages > 0 
      ? ((totalMessages - totalErrors) / totalMessages) * 100 
      : 100;
  }
}
