/**
 * Error Handler
 * Centralized error handling and logging
 */

export enum ErrorType {
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  DATABASE = 'DATABASE',
  NETWORK = 'NETWORK',
  SYSTEM = 'SYSTEM',
  UNKNOWN = 'UNKNOWN'
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface AppError {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  code: string;
  details?: any;
  timestamp: Date;
  stack?: string;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorLog: AppError[] = [];

  private constructor() {}

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  createError(
    type: ErrorType,
    severity: ErrorSeverity,
    message: string,
    code: string,
    details?: any
  ): AppError {
    const error: AppError = {
      type,
      severity,
      message,
      code,
      details,
      timestamp: new Date(),
      stack: new Error().stack
    };

    this.logError(error);
    return error;
  }

  handleError(error: Error | AppError): AppError {
    let appError: AppError;

    if (this.isAppError(error)) {
      appError = error;
    } else {
      appError = this.createError(
        ErrorType.UNKNOWN,
        ErrorSeverity.MEDIUM,
        error.message,
        'UNKNOWN_ERROR',
        { originalError: error }
      );
    }

    this.logError(appError);
    return appError;
  }

  private isAppError(error: any): error is AppError {
    return error && typeof error === 'object' && 'type' in error && 'severity' in error;
  }

  private logError(error: AppError): void {
    this.errorLog.push(error);
    
    const timestamp = error.timestamp.toISOString();
    const prefix = `[${timestamp}] [${error.type}] [${error.severity}]`;
    
    switch (error.severity) {
      case ErrorSeverity.LOW:
        console.log(`${prefix} ${error.message}`);
        break;
      case ErrorSeverity.MEDIUM:
        console.warn(`${prefix} ${error.message}`);
        break;
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        console.error(`${prefix} ${error.message}`);
        if (error.details) {
          console.error('Details:', error.details);
        }
        break;
    }
  }

  getErrorLog(): AppError[] {
    return [...this.errorLog];
  }

  getErrorsByType(type: ErrorType): AppError[] {
    return this.errorLog.filter(error => error.type === type);
  }

  getErrorsBySeverity(severity: ErrorSeverity): AppError[] {
    return this.errorLog.filter(error => error.severity === severity);
  }

  clearErrorLog(): void {
    this.errorLog = [];
  }

  getErrorStats(): { total: number; byType: Record<ErrorType, number>; bySeverity: Record<ErrorSeverity, number> } {
    const byType: Record<ErrorType, number> = {} as Record<ErrorType, number>;
    const bySeverity: Record<ErrorSeverity, number> = {} as Record<ErrorSeverity, number>;

    // Initialize counters
    Object.values(ErrorType).forEach(type => byType[type] = 0);
    Object.values(ErrorSeverity).forEach(severity => bySeverity[severity] = 0);

    // Count errors
    this.errorLog.forEach(error => {
      byType[error.type]++;
      bySeverity[error.severity]++;
    });

    return {
      total: this.errorLog.length,
      byType,
      bySeverity
    };
  }
}

// Convenience functions
export const createError = (
  type: ErrorType,
  severity: ErrorSeverity,
  message: string,
  code: string,
  details?: any
): AppError => {
  return ErrorHandler.getInstance().createError(type, severity, message, code, details);
};

export const handleError = (error: Error | AppError): AppError => {
  return ErrorHandler.getInstance().handleError(error);
};
