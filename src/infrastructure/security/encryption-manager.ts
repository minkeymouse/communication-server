/**
 * Encryption Manager
 * Advanced encryption and security management system
 */

import * as crypto from 'crypto';

export interface EncryptionConfig {
  algorithm: 'aes-256-gcm' | 'aes-256-cbc' | 'chacha20-poly1305';
  keyLength: number;
  ivLength: number;
  saltLength: number;
  iterations: number;
  enableCompression: boolean;
  enableKeyRotation: boolean;
  keyRotationInterval: number; // in days
}

export interface EncryptionKey {
  id: string;
  key: Buffer;
  iv: Buffer;
  salt: Buffer;
  algorithm: string;
  createdAt: Date;
  expiresAt: Date;
  isActive: boolean;
  usageCount: number;
}

export interface EncryptedData {
  encryptedContent: string;
  keyId: string;
  algorithm: string;
  iv: string;
  salt: string;
  compressed: boolean;
  timestamp: Date;
  checksum: string;
}

export interface SecurityAudit {
  id: string;
  operation: 'encrypt' | 'decrypt' | 'key_rotation' | 'key_generation';
  keyId?: string;
  algorithm: string;
  timestamp: Date;
  success: boolean;
  error?: string;
  metadata: Record<string, any>;
}

export class EncryptionManager {
  private config: EncryptionConfig;
  private keys: Map<string, EncryptionKey> = new Map();
  private masterKey: Buffer;
  private auditLog: SecurityAudit[] = [];

  constructor(config: EncryptionConfig) {
    this.config = {
      ...config,
      algorithm: config.algorithm ?? 'aes-256-gcm',
      keyLength: config.keyLength ?? 32,
      ivLength: config.ivLength ?? 16,
      saltLength: config.saltLength ?? 32,
      iterations: config.iterations ?? 100000,
      enableCompression: config.enableCompression ?? true,
      enableKeyRotation: config.enableKeyRotation ?? true,
      keyRotationInterval: config.keyRotationInterval ?? 30
    };

    this.masterKey = this.generateMasterKey();
    this.initializeKeys();
  }

  async encryptData(data: string, keyId?: string): Promise<EncryptedData> {
    try {
      const startTime = Date.now();
      const key = keyId ? this.getKey(keyId) : this.getActiveKey();
      
      if (!key) {
        throw new Error('No encryption key available');
      }

      // Compress data if enabled
      let processedData = data;
      let compressed = false;
      if (this.config.enableCompression && data.length > 100) {
        processedData = this.compressData(data);
        compressed = true;
      }

      // Encrypt data
      const encrypted = this.encryptWithKey(processedData, key);
      
      // Generate checksum
      const checksum = this.generateChecksum(encrypted);

      const result: EncryptedData = {
        encryptedContent: encrypted.toString('base64'),
        keyId: key.id,
        algorithm: key.algorithm,
        iv: key.iv.toString('base64'),
        salt: key.salt.toString('base64'),
        compressed,
        timestamp: new Date(),
        checksum
      };

      // Update key usage
      key.usageCount++;
      this.keys.set(key.id, key);

      // Log audit
      this.logAudit('encrypt', key.id, key.algorithm, true, {
        dataLength: data.length,
        compressedLength: processedData.length,
        processingTime: Date.now() - startTime
      });

      return result;

    } catch (error) {
      this.logAudit('encrypt', keyId || '', this.config.algorithm, false, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async decryptData(encryptedData: EncryptedData): Promise<string> {
    try {
      const startTime = Date.now();
      const key = this.getKey(encryptedData.keyId);
      
      if (!key) {
        throw new Error(`Encryption key not found: ${encryptedData.keyId}`);
      }

      // Verify checksum
      const calculatedChecksum = this.generateChecksum(
        Buffer.from(encryptedData.encryptedContent, 'base64')
      );
      
      if (calculatedChecksum !== encryptedData.checksum) {
        throw new Error('Data integrity check failed');
      }

      // Decrypt data
      const decrypted = this.decryptWithKey(
        Buffer.from(encryptedData.encryptedContent, 'base64'),
        key
      );

      // Decompress if needed
      let result = decrypted;
      if (encryptedData.compressed) {
        result = this.decompressData(decrypted);
      }

      // Log audit
      this.logAudit('decrypt', key.id, key.algorithm, true, {
        processingTime: Date.now() - startTime
      });

      return result;

    } catch (error) {
      this.logAudit('decrypt', encryptedData.keyId, encryptedData.algorithm, false, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  generateNewKey(): string {
    try {
      const keyId = this.generateKeyId();
      const salt = crypto.randomBytes(this.config.saltLength);
      const iv = crypto.randomBytes(this.config.ivLength);
      
      // Derive key from master key
      const key = crypto.pbkdf2Sync(
        this.masterKey,
        salt,
        this.config.iterations,
        this.config.keyLength,
        'sha256'
      );

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + this.config.keyRotationInterval);

      const encryptionKey: EncryptionKey = {
        id: keyId,
        key,
        iv,
        salt,
        algorithm: this.config.algorithm,
        createdAt: new Date(),
        expiresAt,
        isActive: true,
        usageCount: 0
      };

      this.keys.set(keyId, encryptionKey);

      // Log audit
      this.logAudit('key_generation', keyId, this.config.algorithm, true, {
        keyLength: key.length,
        expiresAt
      });

      console.log(`Generated new encryption key: ${keyId}`);
      return keyId;

    } catch (error) {
      this.logAudit('key_generation', '', this.config.algorithm, false, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  rotateKeys(): number {
    try {
      const now = new Date();
      let rotatedCount = 0;

      // Deactivate expired keys
      for (const [keyId, key] of this.keys.entries()) {
        if (key.expiresAt < now && key.isActive) {
          key.isActive = false;
          this.keys.set(keyId, key);
          rotatedCount++;
        }
      }

      // Generate new key if needed
      const activeKeys = Array.from(this.keys.values()).filter(k => k.isActive);
      if (activeKeys.length === 0) {
        this.generateNewKey();
        rotatedCount++;
      }

      // Log audit
      this.logAudit('key_rotation', '', this.config.algorithm, true, {
        rotatedCount,
        totalKeys: this.keys.size,
        activeKeys: activeKeys.length
      });

      console.log(`Rotated ${rotatedCount} encryption keys`);
      return rotatedCount;

    } catch (error) {
      this.logAudit('key_rotation', '', this.config.algorithm, false, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  getKeyInfo(keyId: string): EncryptionKey | null {
    return this.keys.get(keyId) || null;
  }

  getAllKeys(): EncryptionKey[] {
    return Array.from(this.keys.values());
  }

  getActiveKeys(): EncryptionKey[] {
    return Array.from(this.keys.values()).filter(k => k.isActive);
  }

  deleteKey(keyId: string): boolean {
    const key = this.keys.get(keyId);
    if (!key) {
      return false;
    }

    this.keys.delete(keyId);
    console.log(`Deleted encryption key: ${keyId}`);
    return true;
  }

  getSecurityAudit(limit: number = 100): SecurityAudit[] {
    return this.auditLog
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  getSecurityStats(): {
    totalKeys: number;
    activeKeys: number;
    expiredKeys: number;
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    averageOperationTime: number;
  } {
    const now = new Date();
    const activeKeys = Array.from(this.keys.values()).filter(k => k.isActive);
    const expiredKeys = Array.from(this.keys.values()).filter(k => k.expiresAt < now);

    const successfulOps = this.auditLog.filter(a => a.success).length;
    const failedOps = this.auditLog.filter(a => !a.success).length;

    return {
      totalKeys: this.keys.size,
      activeKeys: activeKeys.length,
      expiredKeys: expiredKeys.length,
      totalOperations: this.auditLog.length,
      successfulOperations: successfulOps,
      failedOperations: failedOps,
      averageOperationTime: 0 // This would calculate average operation time
    };
  }

  updateConfig(config: Partial<EncryptionConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('Encryption configuration updated');
  }

  private generateMasterKey(): Buffer {
    // In production, this should be stored securely
    return crypto.randomBytes(32);
  }

  private initializeKeys(): void {
    // Generate initial key
    this.generateNewKey();
  }

  private getActiveKey(): EncryptionKey | null {
    const activeKeys = Array.from(this.keys.values()).filter(k => k.isActive);
    return activeKeys.length > 0 ? activeKeys[0] : null;
  }

  private getKey(keyId: string): EncryptionKey | null {
    return this.keys.get(keyId) || null;
  }

  private encryptWithKey(data: string, key: EncryptionKey): Buffer {
    const cipher = crypto.createCipher(key.algorithm, key.key);
    cipher.setAutoPadding(true);

    let encrypted = cipher.update(data, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    return Buffer.from(encrypted, 'base64');
  }

  private decryptWithKey(encryptedData: Buffer, key: EncryptionKey): string {
    const decipher = crypto.createDecipher(key.algorithm, key.key);
    decipher.setAutoPadding(true);

    let decrypted = decipher.update(encryptedData.toString('base64'), 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  private compressData(data: string): string {
    // Simple compression - in production, use proper compression library
    return data.replace(/\s+/g, ' ').trim();
  }

  private decompressData(data: string): string {
    // Simple decompression - in production, use proper decompression library
    return data;
  }

  private generateChecksum(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private generateKeyId(): string {
    return `key-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private logAudit(
    operation: string,
    keyId: string,
    algorithm: string,
    success: boolean,
    metadata: Record<string, any>
  ): void {
    const audit: SecurityAudit = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      operation: operation as any,
      keyId: keyId || undefined,
      algorithm,
      timestamp: new Date(),
      success,
      error: success ? undefined : metadata.error,
      metadata
    };

    this.auditLog.push(audit);

    // Keep audit log size manageable
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-5000);
    }
  }
}
