/**
 * Security Key Manager
 * Handles generation, storage, and management of security keys
 */

import { createHash, randomBytes } from 'crypto';

export interface SecurityKey {
  publicKey: string;
  privateKey: string;
  keyId: string;
  createdAt: Date;
  expiresAt?: Date;
}

export class KeyManager {
  private agentKeys: Map<string, SecurityKey> = new Map();

  /**
   * Generate security keys for an agent
   */
  public generateAgentKeys(agentId: string, expiresInDays: number = 30): SecurityKey {
    const keyId = this.generateKeyId();
    const privateKey = this.generatePrivateKey();
    const publicKey = this.generatePublicKey(privateKey);
    
    const key: SecurityKey = {
      publicKey,
      privateKey,
      keyId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    };

    this.agentKeys.set(agentId, key);
    return key;
  }

  /**
   * Get security keys for an agent
   */
  public getAgentKeys(agentId: string): SecurityKey | null {
    return this.agentKeys.get(agentId) || null;
  }

  /**
   * Check if agent has valid keys
   */
  public hasValidKeys(agentId: string): boolean {
    const keys = this.getAgentKeys(agentId);
    if (!keys) return false;
    
    // Check if keys are expired
    if (keys.expiresAt && keys.expiresAt < new Date()) {
      this.agentKeys.delete(agentId);
      return false;
    }
    
    return true;
  }

  /**
   * Rotate keys for an agent
   */
  public rotateKeys(agentId: string, expiresInDays: number = 30): SecurityKey {
    const oldKeys = this.getAgentKeys(agentId);
    const newKeys = this.generateAgentKeys(agentId, expiresInDays);
    
    // Keep old keys for a grace period (e.g., 1 hour) for message decryption
    if (oldKeys) {
      const gracePeriod = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      oldKeys.expiresAt = gracePeriod;
      this.agentKeys.set(`${agentId}_old`, oldKeys);
    }
    
    return newKeys;
  }

  /**
   * Revoke keys for an agent
   */
  public revokeKeys(agentId: string): boolean {
    const hadKeys = this.agentKeys.has(agentId);
    this.agentKeys.delete(agentId);
    this.agentKeys.delete(`${agentId}_old`);
    return hadKeys;
  }

  /**
   * Get all active keys
   */
  public getAllKeys(): Map<string, SecurityKey> {
    return new Map(this.agentKeys);
  }

  /**
   * Clean up expired keys
   */
  public cleanupExpiredKeys(): number {
    let cleanedCount = 0;
    const now = new Date();
    
    for (const [agentId, keys] of this.agentKeys.entries()) {
      if (keys.expiresAt && keys.expiresAt < now) {
        this.agentKeys.delete(agentId);
        cleanedCount++;
      }
    }
    
    return cleanedCount;
  }

  /**
   * Get security statistics
   */
  public getSecurityStats(): {
    totalAgents: number;
    agentsWithKeys: number;
    expiredKeys: number;
    activeKeys: number;
  } {
    const now = new Date();
    let expiredCount = 0;
    let activeCount = 0;
    
    for (const keys of this.agentKeys.values()) {
      if (keys.expiresAt && keys.expiresAt < now) {
        expiredCount++;
      } else {
        activeCount++;
      }
    }
    
    return {
      totalAgents: this.agentKeys.size,
      agentsWithKeys: activeCount,
      expiredKeys: expiredCount,
      activeKeys: activeCount
    };
  }

  private generateKeyId(): string {
    return `key-${Date.now()}-${randomBytes(8).toString('hex')}`;
  }

  private generatePrivateKey(): string {
    return randomBytes(32).toString('hex');
  }

  private generatePublicKey(privateKey: string): string {
    return createHash('sha256').update(privateKey).digest('hex');
  }
}
