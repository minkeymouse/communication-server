/**
 * Performance Monitor
 * Tracks and analyzes system performance metrics
 */

import { DatabaseManager } from '../database/database-manager.js';

export interface PerformanceMetric {
  id: string;
  operationType: string;
  responseTimeMs: number;
  success: boolean;
  errorMessage?: string;
  timestamp: Date;
  agentId?: string;
  metadata?: Record<string, any>;
}

export interface PerformanceStats {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageResponseTime: number;
  medianResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  operationsByType: Record<string, number>;
  responseTimeByType: Record<string, number>;
}

export class PerformanceMonitor {
  private db: DatabaseManager;
  private metrics: PerformanceMetric[] = [];
  private maxMetricsInMemory = 1000;

  constructor(db: DatabaseManager) {
    this.db = db;
  }

  recordOperation(
    operationType: string,
    responseTimeMs: number,
    success: boolean,
    agentId?: string,
    errorMessage?: string,
    metadata?: Record<string, any>
  ): void {
    const metric: PerformanceMetric = {
      id: this.generateId(),
      operationType,
      responseTimeMs,
      success,
      errorMessage,
      timestamp: new Date(),
      agentId,
      metadata
    };

    // Store in memory for quick access
    this.metrics.push(metric);
    
    // Keep memory usage under control
    if (this.metrics.length > this.maxMetricsInMemory) {
      this.metrics = this.metrics.slice(-this.maxMetricsInMemory);
    }

    // Store in database for persistence
    this.storeMetricInDatabase(metric);
  }

  getPerformanceStats(timeRange: '1h' | '24h' | '7d' | '30d' = '24h'): PerformanceStats {
    const cutoffTime = this.getCutoffTime(timeRange);
    const recentMetrics = this.metrics.filter(m => m.timestamp >= cutoffTime);

    if (recentMetrics.length === 0) {
      return this.getEmptyStats();
    }

    const responseTimes = recentMetrics.map(m => m.responseTimeMs).sort((a, b) => a - b);
    const successfulOps = recentMetrics.filter(m => m.success);
    const failedOps = recentMetrics.filter(m => !m.success);

    const operationsByType: Record<string, number> = {};
    const responseTimeByType: Record<string, number> = {};

    recentMetrics.forEach(metric => {
      operationsByType[metric.operationType] = (operationsByType[metric.operationType] || 0) + 1;
      
      if (!responseTimeByType[metric.operationType]) {
        responseTimeByType[metric.operationType] = 0;
      }
      responseTimeByType[metric.operationType] += metric.responseTimeMs;
    });

    // Calculate average response time by type
    Object.keys(responseTimeByType).forEach(type => {
      const count = operationsByType[type];
      responseTimeByType[type] = responseTimeByType[type] / count;
    });

    return {
      totalOperations: recentMetrics.length,
      successfulOperations: successfulOps.length,
      failedOperations: failedOps.length,
      averageResponseTime: this.calculateAverage(responseTimes),
      medianResponseTime: this.calculateMedian(responseTimes),
      p95ResponseTime: this.calculatePercentile(responseTimes, 95),
      p99ResponseTime: this.calculatePercentile(responseTimes, 99),
      errorRate: (failedOps.length / recentMetrics.length) * 100,
      operationsByType,
      responseTimeByType
    };
  }

  getAgentPerformanceStats(agentId: string, timeRange: '1h' | '24h' | '7d' | '30d' = '24h'): PerformanceStats {
    const cutoffTime = this.getCutoffTime(timeRange);
    const agentMetrics = this.metrics.filter(m => 
      m.agentId === agentId && m.timestamp >= cutoffTime
    );

    if (agentMetrics.length === 0) {
      return this.getEmptyStats();
    }

    const responseTimes = agentMetrics.map(m => m.responseTimeMs).sort((a, b) => a - b);
    const successfulOps = agentMetrics.filter(m => m.success);
    const failedOps = agentMetrics.filter(m => !m.success);

    const operationsByType: Record<string, number> = {};
    const responseTimeByType: Record<string, number> = {};

    agentMetrics.forEach(metric => {
      operationsByType[metric.operationType] = (operationsByType[metric.operationType] || 0) + 1;
      
      if (!responseTimeByType[metric.operationType]) {
        responseTimeByType[metric.operationType] = 0;
      }
      responseTimeByType[metric.operationType] += metric.responseTimeMs;
    });

    // Calculate average response time by type
    Object.keys(responseTimeByType).forEach(type => {
      const count = operationsByType[type];
      responseTimeByType[type] = responseTimeByType[type] / count;
    });

    return {
      totalOperations: agentMetrics.length,
      successfulOperations: successfulOps.length,
      failedOperations: failedOps.length,
      averageResponseTime: this.calculateAverage(responseTimes),
      medianResponseTime: this.calculateMedian(responseTimes),
      p95ResponseTime: this.calculatePercentile(responseTimes, 95),
      p99ResponseTime: this.calculatePercentile(responseTimes, 99),
      errorRate: (failedOps.length / agentMetrics.length) * 100,
      operationsByType,
      responseTimeByType
    };
  }

  getSlowestOperations(limit: number = 10): PerformanceMetric[] {
    return this.metrics
      .sort((a, b) => b.responseTimeMs - a.responseTimeMs)
      .slice(0, limit);
  }

  getMostFrequentErrors(limit: number = 10): { errorMessage: string; count: number }[] {
    const errorCounts: Record<string, number> = {};
    
    this.metrics
      .filter(m => !m.success && m.errorMessage)
      .forEach(m => {
        errorCounts[m.errorMessage!] = (errorCounts[m.errorMessage!] || 0) + 1;
      });

    return Object.entries(errorCounts)
      .map(([errorMessage, count]) => ({ errorMessage, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  getPerformanceAlerts(): string[] {
    const alerts: string[] = [];
    const stats = this.getPerformanceStats('1h');

    // High error rate alert
    if (stats.errorRate > 5) {
      alerts.push(`High error rate detected: ${stats.errorRate.toFixed(2)}%`);
    }

    // Slow response time alert
    if (stats.p95ResponseTime > 1000) {
      alerts.push(`Slow response times detected: P95 = ${stats.p95ResponseTime}ms`);
    }

    // High operation volume alert
    if (stats.totalOperations > 1000) {
      alerts.push(`High operation volume: ${stats.totalOperations} operations in the last hour`);
    }

    return alerts;
  }

  private generateId(): string {
    return `perf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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

  private calculateAverage(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateMedian(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private getEmptyStats(): PerformanceStats {
    return {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageResponseTime: 0,
      medianResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      errorRate: 0,
      operationsByType: {},
      responseTimeByType: {}
    };
  }

  private storeMetricInDatabase(metric: PerformanceMetric): void {
    try {
      // This would store the metric in the performance_metrics table
      // For now, we'll just log it
      console.log(`Performance metric: ${metric.operationType} - ${metric.responseTimeMs}ms - ${metric.success ? 'SUCCESS' : 'FAILED'}`);
    } catch (error) {
      console.error('Failed to store performance metric:', error);
    }
  }

  cleanup(): void {
    // Remove old metrics from memory
    const cutoffTime = this.getCutoffTime('24h');
    this.metrics = this.metrics.filter(m => m.timestamp >= cutoffTime);
  }
}
