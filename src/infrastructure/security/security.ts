/**
 * Simplified Security Manager
 * Orchestrates security operations using specialized managers
 */

import { KeyManager } from './key-manager.js';
import { EncryptionManager } from './encryption.js';

export class SecurityManager {
  private keyManager: KeyManager;
  private encryptionManager: EncryptionManager;

  constructor() {
    this.keyManager = new KeyManager();
    this.encryptionManager = new EncryptionManager();
  }

  /**
   * Generate security keys for an agent
   */
  public generateAgentKeys(agentId: string, expiresInDays: number = 30) {
    return this.keyManager.generateAgentKeys(agentId, expiresInDays);
  }

  /**
   * Check if agent has valid keys
   */
  public hasValidKeys(agentId: string): boolean {
    return this.keyManager.hasValidKeys(agentId);
  }

  /**
   * Encrypt message content
   */
  public encryptMessage(
    content: string,
    senderAgentId: string,
    recipientAgentId: string,
    securityLevel: 'none' | 'basic' | 'signed' | 'encrypted' = 'basic'
  ) {
    return this.encryptionManager.encryptMessage(content, senderAgentId, recipientAgentId, securityLevel);
  }

  /**
   * Decrypt message content
   */
  public decryptMessage(encryptedMessage: any, recipientAgentId: string): string {
    return this.encryptionManager.decryptMessage(encryptedMessage, recipientAgentId);
  }

  /**
   * Verify message signature
   */
  public verifySignature(message: string, signature: string, agentId: string): boolean {
    return this.encryptionManager.verifySignature(message, signature, agentId);
  }

  /**
   * Create digital signature for message
   */
  public createSignature(message: string, agentId: string): string {
    return this.encryptionManager.createSignature(message, agentId);
  }

  /**
   * Rotate keys for an agent
   */
  public rotateKeys(agentId: string, expiresInDays: number = 30) {
    return this.keyManager.rotateKeys(agentId, expiresInDays);
  }

  /**
   * Revoke keys for an agent
   */
  public revokeKeys(agentId: string): boolean {
    return this.keyManager.revokeKeys(agentId);
  }

  /**
   * Get security statistics
   */
  public getSecurityStats() {
    return this.keyManager.getSecurityStats();
  }

  /**
   * Clean up expired keys
   */
  public cleanupExpiredKeys(): number {
    return this.keyManager.cleanupExpiredKeys();
  }

  /**
   * Get all active keys
   */
  public getAllKeys() {
    return this.keyManager.getAllKeys();
  }
}
