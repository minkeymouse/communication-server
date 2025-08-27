/**
 * Server Configuration
 * Centralized configuration management
 */

import * as path from 'path';
import * as os from 'os';

export interface ServerConfig {
  name: string;
  version: string;
  serverId: string;
  sessionTimeoutMinutes: number;
  maxMessageLength: number;
  maxMessagesPerRequest: number;
  databasePath: string;
  enableAnalytics: boolean;
  enableRateLimiting: boolean;
  enableSecurity: boolean;
}

export const DEFAULT_CONFIG: ServerConfig = {
  name: 'communication-server',
  version: '2.0.0',
  serverId: process.env.MCP_SERVER_ID || `comm-server-${Date.now()}`,
  sessionTimeoutMinutes: 4320, // Extended to 72 hours for local deployment
  maxMessageLength: 10000,
  maxMessagesPerRequest: 500,
      databasePath: process.env.DATABASE_PATH || path.join(os.homedir(), '.communication-server', 'default', 'data', 'communication.db'),
  enableAnalytics: true,
  enableRateLimiting: true,
  enableSecurity: true
};

export class ConfigManager {
  private config: ServerConfig;

  constructor(config?: Partial<ServerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get(): ServerConfig {
    return { ...this.config };
  }

  update(updates: Partial<ServerConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  getServerInfo() {
    return {
      name: this.config.name,
      version: this.config.version,
      serverId: this.config.serverId
    };
  }
}
