/**
 * Logger
 * Centralized logging system with different levels and formatting
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: string;
  data?: any;
  error?: Error;
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;
  private logEntries: LogEntry[] = [];
  private maxEntries: number = 1000;

  private constructor(level: LogLevel = LogLevel.INFO) {
    this.logLevel = level;
  }

  static getInstance(level?: LogLevel): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(level);
    }
    return Logger.instance;
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  debug(message: string, context?: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, context, data);
  }

  info(message: string, context?: string, data?: any): void {
    this.log(LogLevel.INFO, message, context, data);
  }

  warn(message: string, context?: string, data?: any): void {
    this.log(LogLevel.WARN, message, context, data);
  }

  error(message: string, context?: string, error?: Error, data?: any): void {
    this.log(LogLevel.ERROR, message, context, data, error);
  }

  critical(message: string, context?: string, error?: Error, data?: any): void {
    this.log(LogLevel.CRITICAL, message, context, data, error);
  }

  private log(level: LogLevel, message: string, context?: string, data?: any, error?: Error): void {
    if (level < this.logLevel) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context,
      data,
      error
    };

    this.logEntries.push(entry);
    
    // Keep only the last maxEntries
    if (this.logEntries.length > this.maxEntries) {
      this.logEntries = this.logEntries.slice(-this.maxEntries);
    }

    this.outputLog(entry);
  }

  private outputLog(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const levelStr = LogLevel[entry.level];
    const contextStr = entry.context ? ` [${entry.context}]` : '';
    const message = `${timestamp} [${levelStr}]${contextStr} ${entry.message}`;

    // For MCP servers, all logging must go to stderr to avoid interfering with JSON responses
    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(message);
        break;
      case LogLevel.INFO:
        console.error(message); // Changed from console.log to console.error
        break;
      case LogLevel.WARN:
        console.error(message); // Changed from console.warn to console.error
        break;
      case LogLevel.ERROR:
        console.error(message);
        if (entry.error) {
          console.error('Error details:', entry.error);
        }
        break;
      case LogLevel.CRITICAL:
        console.error(`🚨 CRITICAL: ${message}`);
        if (entry.error) {
          console.error('Critical error details:', entry.error);
        }
        break;
    }

    if (entry.data) {
      console.error('Additional data:', entry.data); // Changed from console.log to console.error
    }
  }

  getLogEntries(level?: LogLevel, limit?: number): LogEntry[] {
    let entries = this.logEntries;
    
    if (level !== undefined) {
      entries = entries.filter(entry => entry.level >= level);
    }
    
    if (limit) {
      entries = entries.slice(-limit);
    }
    
    return [...entries];
  }

  getLogStats(): { total: number; byLevel: Record<string, number> } {
    const byLevel: Record<string, number> = {};
    
    Object.values(LogLevel).forEach(level => {
      if (typeof level === 'string') {
        byLevel[level] = 0;
      }
    });

    this.logEntries.forEach(entry => {
      const levelStr = LogLevel[entry.level];
      byLevel[levelStr]++;
    });

    return {
      total: this.logEntries.length,
      byLevel
    };
  }

  clearLogs(): void {
    this.logEntries = [];
  }

  // Convenience methods for common logging patterns
  logServerStart(serverInfo: { name: string; version: string; serverId: string }): void {
    this.info(`🚀 ${serverInfo.name} v${serverInfo.version} started successfully`, 'SERVER');
    this.info(`📊 Server ID: ${serverInfo.serverId}`, 'SERVER');
    this.info(`⏰ Started at: ${new Date().toISOString()}`, 'SERVER');
  }

  logServerShutdown(): void {
    this.info('🔄 Shutting down communication server...', 'SERVER');
  }

  logServerShutdownComplete(): void {
    this.info('✅ Server shutdown completed', 'SERVER');
  }

  logAgentAction(agentId: string, action: string, details?: any): void {
    this.info(`Agent ${agentId}: ${action}`, 'AGENT', details);
  }

  logMessageAction(messageId: string, action: string, details?: any): void {
    this.info(`Message ${messageId}: ${action}`, 'MESSAGE', details);
  }

  logDatabaseAction(action: string, details?: any): void {
    this.debug(`Database: ${action}`, 'DATABASE', details);
  }
}

// Convenience functions
export const logger = Logger.getInstance();

export const debug = (message: string, context?: string, data?: any) => logger.debug(message, context, data);
export const info = (message: string, context?: string, data?: any) => logger.info(message, context, data);
export const warn = (message: string, context?: string, data?: any) => logger.warn(message, context, data);
export const error = (message: string, context?: string, error?: Error, data?: any) => logger.error(message, context, error, data);
export const critical = (message: string, context?: string, error?: Error, data?: any) => logger.critical(message, context, error, data);
