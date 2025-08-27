/**
 * Error Manager
 * Centralized error handling and recovery system
 */

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ErrorCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  DATABASE = 'database',
  NETWORK = 'network',
  VALIDATION = 'validation',
  SYSTEM = 'system',
  COMMUNICATION = 'communication',
  PERFORMANCE = 'performance'
}

export interface ErrorRecord {
  id: string;
  timestamp: Date;
  severity: ErrorSeverity;
  category: ErrorCategory;
  message: string;
  stackTrace?: string;
  agentId?: string;
  operationType?: string;
  metadata?: Record<string, any>;
  resolved: boolean;
  resolvedAt?: Date;
  resolutionNotes?: string;
}

export interface ErrorStats {
  totalErrors: number;
  errorsBySeverity: Record<ErrorSeverity, number>;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsByAgent: Record<string, number>;
  recentErrors: ErrorRecord[];
  unresolvedErrors: ErrorRecord[];
}

export class ErrorManager {
  private errors: ErrorRecord[] = [];
  private maxErrorsInMemory = 1000;
  private errorHandlers: Map<ErrorCategory, (error: ErrorRecord) => void> = new Map();

  constructor() {
    this.setupDefaultErrorHandlers();
  }

  recordError(
    message: string,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    category: ErrorCategory = ErrorCategory.SYSTEM,
    agentId?: string,
    operationType?: string,
    stackTrace?: string,
    metadata?: Record<string, any>
  ): string {
    const errorRecord: ErrorRecord = {
      id: this.generateErrorId(),
      timestamp: new Date(),
      severity,
      category,
      message,
      stackTrace,
      agentId,
      operationType,
      metadata,
      resolved: false
    };

    // Store error
    this.errors.push(errorRecord);

    // Keep memory usage under control
    if (this.errors.length > this.maxErrorsInMemory) {
      this.errors = this.errors.slice(-this.maxErrorsInMemory);
    }

    // Log error
    this.logError(errorRecord);

    // Handle error based on category
    const handler = this.errorHandlers.get(category);
    if (handler) {
      try {
        handler(errorRecord);
      } catch (handlerError) {
        console.error('Error in error handler:', handlerError);
      }
    }

    // Trigger alerts for high severity errors
    if (severity === ErrorSeverity.HIGH || severity === ErrorSeverity.CRITICAL) {
      this.triggerAlert(errorRecord);
    }

    return errorRecord.id;
  }

  resolveError(errorId: string, resolutionNotes?: string): boolean {
    const error = this.errors.find(e => e.id === errorId);
    if (!error) {
      return false;
    }

    error.resolved = true;
    error.resolvedAt = new Date();
    error.resolutionNotes = resolutionNotes;

    console.log(`Error resolved: ${errorId} - ${resolutionNotes || 'No notes provided'}`);
    return true;
  }

  getErrorStats(timeRange: '1h' | '24h' | '7d' | '30d' = '24h'): ErrorStats {
    const cutoffTime = this.getCutoffTime(timeRange);
    const recentErrors = this.errors.filter(e => e.timestamp >= cutoffTime);

    const errorsBySeverity: Record<ErrorSeverity, number> = {
      [ErrorSeverity.LOW]: 0,
      [ErrorSeverity.MEDIUM]: 0,
      [ErrorSeverity.HIGH]: 0,
      [ErrorSeverity.CRITICAL]: 0
    };

    const errorsByCategory: Record<ErrorCategory, number> = {
      [ErrorCategory.AUTHENTICATION]: 0,
      [ErrorCategory.AUTHORIZATION]: 0,
      [ErrorCategory.DATABASE]: 0,
      [ErrorCategory.NETWORK]: 0,
      [ErrorCategory.VALIDATION]: 0,
      [ErrorCategory.SYSTEM]: 0,
      [ErrorCategory.COMMUNICATION]: 0,
      [ErrorCategory.PERFORMANCE]: 0
    };

    const errorsByAgent: Record<string, number> = {};

    recentErrors.forEach(error => {
      errorsBySeverity[error.severity]++;
      errorsByCategory[error.category]++;
      
      if (error.agentId) {
        errorsByAgent[error.agentId] = (errorsByAgent[error.agentId] || 0) + 1;
      }
    });

    return {
      totalErrors: recentErrors.length,
      errorsBySeverity,
      errorsByCategory,
      errorsByAgent,
      recentErrors: recentErrors.slice(-10), // Last 10 errors
      unresolvedErrors: this.errors.filter(e => !e.resolved)
    };
  }

  getErrorsByAgent(agentId: string, limit: number = 50): ErrorRecord[] {
    return this.errors
      .filter(e => e.agentId === agentId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  getErrorsByCategory(category: ErrorCategory, limit: number = 50): ErrorRecord[] {
    return this.errors
      .filter(e => e.category === category)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  getErrorsBySeverity(severity: ErrorSeverity, limit: number = 50): ErrorRecord[] {
    return this.errors
      .filter(e => e.severity === severity)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  getUnresolvedErrors(): ErrorRecord[] {
    return this.errors.filter(e => !e.resolved);
  }

  getErrorAlerts(): string[] {
    const alerts: string[] = [];
    const stats = this.getErrorStats('1h');

    // High error rate alert
    if (stats.totalErrors > 10) {
      alerts.push(`High error rate: ${stats.totalErrors} errors in the last hour`);
    }

    // Critical errors alert
    if (stats.errorsBySeverity[ErrorSeverity.CRITICAL] > 0) {
      alerts.push(`Critical errors detected: ${stats.errorsBySeverity[ErrorSeverity.CRITICAL]} critical errors`);
    }

    // Unresolved errors alert
    if (stats.unresolvedErrors.length > 5) {
      alerts.push(`Unresolved errors: ${stats.unresolvedErrors.length} errors need attention`);
    }

    return alerts;
  }

  registerErrorHandler(category: ErrorCategory, handler: (error: ErrorRecord) => void): void {
    this.errorHandlers.set(category, handler);
  }

  private setupDefaultErrorHandlers(): void {
    // Authentication error handler
    this.registerErrorHandler(ErrorCategory.AUTHENTICATION, (error) => {
      console.error(`Authentication error for agent ${error.agentId}: ${error.message}`);
      // Could implement rate limiting or account lockout here
    });

    // Database error handler
    this.registerErrorHandler(ErrorCategory.DATABASE, (error) => {
      console.error(`Database error: ${error.message}`);
      // Could implement connection retry or fallback here
    });

    // Communication error handler
    this.registerErrorHandler(ErrorCategory.COMMUNICATION, (error) => {
      console.error(`Communication error: ${error.message}`);
      // Could implement message retry or alternative routing here
    });

    // Performance error handler
    this.registerErrorHandler(ErrorCategory.PERFORMANCE, (error) => {
      console.error(`Performance issue: ${error.message}`);
      // Could implement throttling or resource scaling here
    });
  }

  private logError(error: ErrorRecord): void {
    const logLevel = this.getLogLevel(error.severity);
    const logMessage = `[${logLevel}] [${error.category.toUpperCase()}] ${error.message}`;
    
    if (error.agentId) {
      console.error(`${logMessage} (Agent: ${error.agentId})`);
    } else {
      console.error(logMessage);
    }

    if (error.stackTrace) {
      console.error(`Stack trace: ${error.stackTrace}`);
    }
  }

  private getLogLevel(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.LOW:
        return 'WARN';
      case ErrorSeverity.MEDIUM:
        return 'ERROR';
      case ErrorSeverity.HIGH:
        return 'ERROR';
      case ErrorSeverity.CRITICAL:
        return 'CRITICAL';
      default:
        return 'ERROR';
    }
  }

  private triggerAlert(error: ErrorRecord): void {
    const alertMessage = `🚨 ${error.severity.toUpperCase()} ERROR: ${error.category} - ${error.message}`;
    if (error.agentId) {
      console.error(`${alertMessage} (Agent: ${error.agentId})`);
    } else {
      console.error(alertMessage);
    }
  }

  private generateErrorId(): string {
    return `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getCutoffTime(timeRange: '1h' | '24h' | '7d' | '30d'): Date {
    const now = new Date();
    const hours = {
      '1h': 1,
      '24h': 24,
      '7d': 24 * 7,
      '30d': 24 * 30
    }[timeRange];

    return new Date(now.getTime() - hours * 60 * 60 * 1000);
  }

  cleanup(): void {
    // Remove old resolved errors from memory
    const cutoffTime = this.getCutoffTime('24h');
    this.errors = this.errors.filter(e => 
      !e.resolved || e.timestamp >= cutoffTime
    );
  }
}
