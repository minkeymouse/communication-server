/**
 * Message Queue System for Performance Optimization
 * Handles message prioritization, ordering, and delivery optimization
 */

import { EventEmitter } from 'events';

export interface QueuedMessage {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  content: string;
  subject: string;
  priority: 'high' | 'normal' | 'low';
  timestamp: Date;
  retryCount: number;
  maxRetries: number;
  metadata?: Record<string, any>;
}

export interface MessageQueueConfig {
  maxConcurrentMessages: number;
  highPriorityTimeout: number;
  normalPriorityTimeout: number;
  lowPriorityTimeout: number;
  retryDelay: number;
  maxRetries: number;
}

export class MessageQueue extends EventEmitter {
  private highPriorityQueue: QueuedMessage[] = [];
  private normalPriorityQueue: QueuedMessage[] = [];
  private lowPriorityQueue: QueuedMessage[] = [];
  private processingMessages: Set<string> = new Set();
  private config: MessageQueueConfig;
  private isProcessing: boolean = false;

  constructor(config: Partial<MessageQueueConfig> = {}) {
    super();
    this.config = {
      maxConcurrentMessages: 5,
      highPriorityTimeout: 5000, // 5 seconds
      normalPriorityTimeout: 10000, // 10 seconds
      lowPriorityTimeout: 30000, // 30 seconds
      retryDelay: 2000, // 2 seconds
      maxRetries: 3,
      ...config
    };
  }

  /**
   * Add message to appropriate priority queue
   */
  public enqueue(message: Omit<QueuedMessage, 'id' | 'timestamp' | 'retryCount'>): string {
    const queuedMessage: QueuedMessage = {
      ...message,
      id: this.generateMessageId(),
      timestamp: new Date(),
      retryCount: 0
    };

    switch (message.priority) {
      case 'high':
        this.highPriorityQueue.push(queuedMessage);
        break;
      case 'normal':
        this.normalPriorityQueue.push(queuedMessage);
        break;
      case 'low':
        this.lowPriorityQueue.push(queuedMessage);
        break;
    }

    this.emit('messageEnqueued', queuedMessage);
    this.processQueue();
    return queuedMessage.id;
  }

  /**
   * Process messages in priority order
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.processingMessages.size >= this.config.maxConcurrentMessages) {
      return;
    }

    this.isProcessing = true;

    try {
      // Process high priority messages first
      while (this.highPriorityQueue.length > 0 && 
             this.processingMessages.size < this.config.maxConcurrentMessages) {
        const message = this.highPriorityQueue.shift()!;
        await this.processMessage(message);
      }

      // Process normal priority messages
      while (this.normalPriorityQueue.length > 0 && 
             this.processingMessages.size < this.config.maxConcurrentMessages) {
        const message = this.normalPriorityQueue.shift()!;
        await this.processMessage(message);
      }

      // Process low priority messages
      while (this.lowPriorityQueue.length > 0 && 
             this.processingMessages.size < this.config.maxConcurrentMessages) {
        const message = this.lowPriorityQueue.shift()!;
        await this.processMessage(message);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process individual message with timeout and retry logic
   */
  private async processMessage(message: QueuedMessage): Promise<void> {
    this.processingMessages.add(message.id);
    
    try {
      const timeout = this.getTimeoutForPriority(message.priority);
      
      const result = await Promise.race([
        this.deliverMessage(message),
        this.createTimeout(timeout)
      ]);

      if (result === 'timeout') {
        await this.handleTimeout(message);
      } else {
        this.emit('messageDelivered', message);
      }
    } catch (error) {
      await this.handleError(message, error);
    } finally {
      this.processingMessages.delete(message.id);
      this.processQueue(); // Continue processing
    }
  }

  /**
   * Deliver message to recipient
   */
  private async deliverMessage(message: QueuedMessage): Promise<any> {
    // This will be implemented to integrate with the database
    this.emit('deliveryAttempt', message);
    return { success: true, messageId: message.id };
  }

  /**
   * Handle message timeout
   */
  private async handleTimeout(message: QueuedMessage): Promise<void> {
    if (message.retryCount < this.config.maxRetries) {
      message.retryCount++;
      this.emit('messageRetry', message);
      
      // Re-queue with exponential backoff
      setTimeout(() => {
        this.enqueue(message);
      }, this.config.retryDelay * Math.pow(2, message.retryCount - 1));
    } else {
      this.emit('messageFailed', message, new Error('Max retries exceeded'));
    }
  }

  /**
   * Handle message delivery error
   */
  private async handleError(message: QueuedMessage, error: any): Promise<void> {
    this.emit('messageError', message, error);
    
    if (message.retryCount < this.config.maxRetries) {
      message.retryCount++;
      setTimeout(() => {
        this.enqueue(message);
      }, this.config.retryDelay);
    } else {
      this.emit('messageFailed', message, error);
    }
  }

  /**
   * Create timeout promise
   */
  private createTimeout(ms: number): Promise<'timeout'> {
    return new Promise(resolve => {
      setTimeout(() => resolve('timeout'), ms);
    });
  }

  /**
   * Get timeout duration for priority level
   */
  private getTimeoutForPriority(priority: string): number {
    switch (priority) {
      case 'high': return this.config.highPriorityTimeout;
      case 'normal': return this.config.normalPriorityTimeout;
      case 'low': return this.config.lowPriorityTimeout;
      default: return this.config.normalPriorityTimeout;
    }
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get queue statistics
   */
  public getQueueStats(): {
    highPriority: number;
    normalPriority: number;
    lowPriority: number;
    processing: number;
  } {
    return {
      highPriority: this.highPriorityQueue.length,
      normalPriority: this.normalPriorityQueue.length,
      lowPriority: this.lowPriorityQueue.length,
      processing: this.processingMessages.size
    };
  }

  /**
   * Clear all queues
   */
  public clearQueues(): void {
    this.highPriorityQueue = [];
    this.normalPriorityQueue = [];
    this.lowPriorityQueue = [];
    this.processingMessages.clear();
  }
}
