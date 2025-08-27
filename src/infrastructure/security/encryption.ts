/**
 * Encryption Module
 * Handles message encryption, decryption, and digital signatures
 */

import { createHash, createHmac, randomBytes, createCipheriv, createDecipheriv } from 'crypto';

export interface EncryptionConfig {
  algorithm: 'aes-256-gcm' | 'aes-256-cbc';
  keyLength: number;
  ivLength: number;
  saltLength: number;
}

export interface EncryptedMessage {
  encryptedContent: string;
  iv: string;
  salt: string;
  signature: string;
  algorithm: string;
  timestamp: number;
}

export class EncryptionManager {
  private encryptionConfig: EncryptionConfig;
  private masterKey: Buffer;

  constructor(config: Partial<EncryptionConfig> = {}) {
    this.encryptionConfig = {
      algorithm: 'aes-256-gcm',
      keyLength: 32,
      ivLength: 16,
      saltLength: 32,
      ...config
    };

    // Generate or load master key
    this.masterKey = this.generateMasterKey();
  }

  /**
   * Encrypt message content
   */
  public encryptMessage(
    content: string,
    senderAgentId: string,
    recipientAgentId: string,
    securityLevel: 'none' | 'basic' | 'signed' | 'encrypted' = 'basic'
  ): EncryptedMessage | string {
    if (securityLevel === 'none') {
      return content;
    }

    if (securityLevel === 'basic') {
      return this.basicEncryption(content);
    }

    if (securityLevel === 'signed') {
      return this.signedMessage(content, senderAgentId);
    }

    if (securityLevel === 'encrypted') {
      return this.fullEncryption(content, senderAgentId, recipientAgentId);
    }

    return content;
  }

  /**
   * Decrypt message content
   */
  public decryptMessage(
    encryptedMessage: EncryptedMessage | string,
    recipientAgentId: string
  ): string {
    if (typeof encryptedMessage === 'string') {
      return encryptedMessage; // Already decrypted or no encryption
    }

    try {
      if (encryptedMessage.algorithm === 'basic') {
        return this.basicDecryption(encryptedMessage);
      }

      if (encryptedMessage.algorithm === 'signed') {
        return this.verifySignedMessage(encryptedMessage, recipientAgentId);
      }

      if (encryptedMessage.algorithm === 'encrypted') {
        return this.fullDecryption(encryptedMessage, recipientAgentId);
      }

      throw new Error(`Unsupported encryption algorithm: ${encryptedMessage.algorithm}`);
    } catch (error) {
      throw new Error(`Failed to decrypt message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify message signature
   */
  public verifySignature(message: string, signature: string, agentId: string): boolean {
    try {
      const expectedSignature = this.createSignature(message, agentId);
      return signature === expectedSignature;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create digital signature for message
   */
  public createSignature(message: string, agentId: string): string {
    const hmac = createHmac('sha256', this.masterKey);
    hmac.update(message);
    hmac.update(agentId);
    return hmac.digest('hex');
  }

  private basicEncryption(content: string): EncryptedMessage {
    const iv = randomBytes(this.encryptionConfig.ivLength);
    const salt = randomBytes(this.encryptionConfig.saltLength);
    const key = this.deriveKey(this.masterKey, salt);
    
    const cipher = createCipheriv(this.encryptionConfig.algorithm, key, iv);
    let encrypted = cipher.update(content, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const signature = this.createSignature(encrypted, 'system');
    
    return {
      encryptedContent: encrypted,
      iv: iv.toString('hex'),
      salt: salt.toString('hex'),
      signature,
      algorithm: 'basic',
      timestamp: Date.now()
    };
  }

  private basicDecryption(encryptedMessage: EncryptedMessage): string {
    const iv = Buffer.from(encryptedMessage.iv, 'hex');
    const salt = Buffer.from(encryptedMessage.salt, 'hex');
    const key = this.deriveKey(this.masterKey, salt);
    
    const decipher = createDecipheriv(this.encryptionConfig.algorithm, key, iv);
    let decrypted = decipher.update(encryptedMessage.encryptedContent, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  private signedMessage(content: string, senderAgentId: string): EncryptedMessage {
    const signature = this.createSignature(content, senderAgentId);
    
    return {
      encryptedContent: content,
      iv: '',
      salt: '',
      signature,
      algorithm: 'signed',
      timestamp: Date.now()
    };
  }

  private verifySignedMessage(encryptedMessage: EncryptedMessage, recipientAgentId: string): string {
    const isValid = this.verifySignature(encryptedMessage.encryptedContent, encryptedMessage.signature, recipientAgentId);
    
    if (!isValid) {
      throw new Error('Message signature verification failed');
    }
    
    return encryptedMessage.encryptedContent;
  }

  private fullEncryption(content: string, senderAgentId: string, recipientAgentId: string): EncryptedMessage {
    const iv = randomBytes(this.encryptionConfig.ivLength);
    const salt = randomBytes(this.encryptionConfig.saltLength);
    const key = this.deriveKey(this.masterKey, salt);
    
    const cipher = createCipheriv(this.encryptionConfig.algorithm, key, iv);
    let encrypted = cipher.update(content, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const signature = this.createSignature(encrypted, senderAgentId);
    
    return {
      encryptedContent: encrypted,
      iv: iv.toString('hex'),
      salt: salt.toString('hex'),
      signature,
      algorithm: 'encrypted',
      timestamp: Date.now()
    };
  }

  private fullDecryption(encryptedMessage: EncryptedMessage, recipientAgentId: string): string {
    const iv = Buffer.from(encryptedMessage.iv, 'hex');
    const salt = Buffer.from(encryptedMessage.salt, 'hex');
    const key = this.deriveKey(this.masterKey, salt);
    
    const decipher = createDecipheriv(this.encryptionConfig.algorithm, key, iv);
    let decrypted = decipher.update(encryptedMessage.encryptedContent, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    // Verify signature
    const isValid = this.verifySignature(encryptedMessage.encryptedContent, encryptedMessage.signature, recipientAgentId);
    if (!isValid) {
      throw new Error('Message signature verification failed');
    }
    
    return decrypted;
  }

  private deriveKey(masterKey: Buffer, salt: Buffer): Buffer {
    return createHash('sha256').update(masterKey).update(salt).digest();
  }

  private generateMasterKey(): Buffer {
    // In a production system, this would be loaded from secure storage
    return randomBytes(32);
  }
}
