/**
 * Common shared types used across the application
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  executionTime?: number;
  timestamp: Date;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface HealthStatus {
  healthy: boolean;
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, {
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
    details?: any;
  }>;
  timestamp: Date;
  uptime: number;
}

export interface PerformanceMetrics {
  operation: string;
  duration: number;
  timestamp: Date;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

export interface SystemStats {
  uptime: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  cpuUsage: {
    user: number;
    system: number;
    total: number;
  };
  activeConnections: number;
  totalRequests: number;
  errorRate: number;
  averageResponseTime: number;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
  code?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface Config {
  database: {
    path: string;
    maxConnections: number;
    timeout: number;
  };
  server: {
    port: number;
    host: string;
    maxPayloadSize: number;
  };
  security: {
    enableEncryption: boolean;
    enableSigning: boolean;
    keyRotationInterval: number;
  };
  monitoring: {
    enableMetrics: boolean;
    enableTracing: boolean;
    logLevel: string;
  };
  cache: {
    maxSize: number;
    ttl: number;
    evictionPolicy: string;
  };
}
