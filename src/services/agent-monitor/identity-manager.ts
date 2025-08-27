/**
 * Agent Identity Manager
 * Handles agent identity validation, drift detection, and consistency tracking
 */

import { AgentStatus, IdentityValidation } from './types.js';

export class IdentityManager {
  private identityHistory: Map<string, string[]> = new Map(); // Agent ID -> identity hashes
  private roleConsistencyHistory: Map<string, number[]> = new Map(); // Agent ID -> consistency scores

  /**
   * Generate unique identity hash for agent
   */
  public generateIdentityHash(agentId: string, status: Partial<AgentStatus>): string {
    const identityData = {
      agentId,
      role: status.metadata?.role || 'unknown',
      capabilities: status.metadata?.capabilities || [],
      workspace: status.metadata?.workspace || '',
      timestamp: new Date().toISOString()
    };
    
    // Simple hash generation (in production, use crypto)
    const hashString = JSON.stringify(identityData);
    let hash = 0;
    for (let i = 0; i < hashString.length; i++) {
      const char = hashString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(16);
  }

  /**
   * Validate agent identity and detect drift
   */
  public validateAgentIdentity(agentId: string, updates: Partial<AgentStatus>): IdentityValidation {
    const currentHash = this.generateIdentityHash(agentId, updates);
    const history = this.identityHistory.get(agentId) || [];
    
    // Add current hash to history
    history.push(currentHash);
    if (history.length > 10) {
      history.shift(); // Keep only last 10 hashes
    }
    this.identityHistory.set(agentId, history);
    
    // Calculate consistency
    const consistency = this.calculateConsistency(history);
    const driftDetected = consistency < 0.7;
    
    // Update role consistency history
    const consistencyHistory = this.roleConsistencyHistory.get(agentId) || [];
    consistencyHistory.push(consistency);
    if (consistencyHistory.length > 20) {
      consistencyHistory.shift();
    }
    this.roleConsistencyHistory.set(agentId, consistencyHistory);
    
    return {
      isValid: consistency > 0.5,
      confidence: consistency,
      driftDetected,
      correctionApplied: false,
      lastValidation: new Date()
    };
  }

  /**
   * Calculate identity consistency based on hash history
   */
  private calculateConsistency(history: string[]): number {
    if (history.length < 2) return 1.0;
    
    let consistency = 0;
    for (let i = 1; i < history.length; i++) {
      if (history[i] === history[i - 1]) {
        consistency += 1;
      }
    }
    
    return consistency / (history.length - 1);
  }

  /**
   * Get identity stability score for agent
   */
  public getIdentityStability(agentId: string): number {
    const consistencyHistory = this.roleConsistencyHistory.get(agentId) || [];
    if (consistencyHistory.length === 0) return 1.0;
    
    return consistencyHistory.reduce((sum, score) => sum + score, 0) / consistencyHistory.length;
  }

  /**
   * Get identity history for agent
   */
  public getIdentityHistory(agentId: string): string[] {
    return this.identityHistory.get(agentId) || [];
  }

  /**
   * Clear identity history for agent
   */
  public clearIdentityHistory(agentId: string): void {
    this.identityHistory.delete(agentId);
    this.roleConsistencyHistory.delete(agentId);
  }
}
