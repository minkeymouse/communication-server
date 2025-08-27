/**
 * Conversation Manager
 * Enhanced conversation and thread management system
 */

import { DatabaseManager } from '../../infrastructure/database/database.js';
import { Message, MessageState } from '../../domain/agents/models.js';

export interface ConversationThread {
  id: string;
  conversationId: string;
  subject: string;
  participants: string[];
  messageCount: number;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  metadata?: Record<string, any>;
}

export interface ThreadMessage {
  id: string;
  threadId: string;
  messageId: string;
  fromAgentId: string;
  toAgentId: string;
  subject: string;
  content: string;
  priority: string;
  securityLevel: string;
  state: string;
  createdAt: Date;
  replyTo?: string;
  metadata?: Record<string, any>;
}

export interface ConversationStats {
  totalConversations: number;
  activeConversations: number;
  totalThreads: number;
  activeThreads: number;
  averageMessagesPerThread: number;
  averageThreadLength: number;
  conversationsByAgent: Record<string, number>;
  threadsByAgent: Record<string, number>;
}

export class ConversationManager {
  private db: DatabaseManager;

  constructor(db: DatabaseManager) {
    this.db = db;
  }

  createThread(
    conversationId: string,
    subject: string,
    participants: string[],
    metadata?: Record<string, any>
  ): string {
    const threadId = this.generateThreadId();
    const now = new Date();

    const thread: ConversationThread = {
      id: threadId,
      conversationId,
      subject,
      participants,
      messageCount: 0,
      lastMessageAt: now,
      createdAt: now,
      updatedAt: now,
      isActive: true,
      metadata
    };

    // Store thread in database
    this.storeThread(thread);

    console.log(`Created new thread: ${threadId} for conversation: ${conversationId}`);
    return threadId;
  }

  addMessageToThread(
    threadId: string,
    message: Message,
    replyTo?: string
  ): boolean {
    try {
      const thread = this.getThread(threadId);
      if (!thread) {
        console.error(`Thread not found: ${threadId}`);
        return false;
      }

      const threadMessage: ThreadMessage = {
        id: this.generateMessageId(),
        threadId,
        messageId: message.id,
        fromAgentId: message.fromAgent,
        toAgentId: message.toAgent,
        subject: message.subject,
        content: message.content,
        priority: message.priority,
        securityLevel: message.securityLevel || 'basic',
        state: message.state,
        createdAt: message.createdAt,
        replyTo,
        metadata: {
          originalMessageId: message.id,
          threadId,
          replyChain: replyTo ? this.getReplyChain(replyTo) : []
        }
      };

      // Store thread message
      this.storeThreadMessage(threadMessage);

      // Update thread statistics
      thread.messageCount++;
      thread.lastMessageAt = message.createdAt;
      thread.updatedAt = new Date();
      this.updateThread(thread);

      console.log(`Added message to thread: ${threadId}, total messages: ${thread.messageCount}`);
      return true;
    } catch (error) {
      console.error(`Failed to add message to thread: ${error}`);
      return false;
    }
  }

  getThread(threadId: string): ConversationThread | null {
    try {
      // This would query the database for the thread
      // For now, return a mock implementation
      return null;
    } catch (error) {
      console.error(`Failed to get thread: ${error}`);
      return null;
    }
  }

  getThreadMessages(threadId: string, limit: number = 50): ThreadMessage[] {
    try {
      // This would query the database for thread messages
      // For now, return empty array
      return [];
    } catch (error) {
      console.error(`Failed to get thread messages: ${error}`);
      return [];
    }
  }

  getConversationThreads(conversationId: string): ConversationThread[] {
    try {
      // This would query the database for conversation threads
      // For now, return empty array
      return [];
    } catch (error) {
      console.error(`Failed to get conversation threads: ${error}`);
      return [];
    }
  }

  getAgentThreads(agentId: string, limit: number = 50): ConversationThread[] {
    try {
      // This would query the database for agent threads
      // For now, return empty array
      return [];
    } catch (error) {
      console.error(`Failed to get agent threads: ${error}`);
      return [];
    }
  }

  updateThreadActivity(threadId: string): boolean {
    try {
      const thread = this.getThread(threadId);
      if (!thread) {
        return false;
      }

      thread.lastMessageAt = new Date();
      thread.updatedAt = new Date();
      this.updateThread(thread);

      return true;
    } catch (error) {
      console.error(`Failed to update thread activity: ${error}`);
      return false;
    }
  }

  closeThread(threadId: string, reason?: string): boolean {
    try {
      const thread = this.getThread(threadId);
      if (!thread) {
        return false;
      }

      thread.isActive = false;
      thread.updatedAt = new Date();
      if (reason) {
        thread.metadata = { ...thread.metadata, closeReason: reason };
      }

      this.updateThread(thread);
      console.log(`Closed thread: ${threadId} - ${reason || 'No reason provided'}`);

      return true;
    } catch (error) {
      console.error(`Failed to close thread: ${error}`);
      return false;
    }
  }

  getConversationStats(timeRange: '1h' | '24h' | '7d' | '30d' = '24h'): ConversationStats {
    try {
      // This would calculate statistics from the database
      // For now, return mock statistics
      return {
        totalConversations: 0,
        activeConversations: 0,
        totalThreads: 0,
        activeThreads: 0,
        averageMessagesPerThread: 0,
        averageThreadLength: 0,
        conversationsByAgent: {},
        threadsByAgent: {}
      };
    } catch (error) {
      console.error(`Failed to get conversation stats: ${error}`);
      return {
        totalConversations: 0,
        activeConversations: 0,
        totalThreads: 0,
        activeThreads: 0,
        averageMessagesPerThread: 0,
        averageThreadLength: 0,
        conversationsByAgent: {},
        threadsByAgent: {}
      };
    }
  }

  searchThreads(query: string, limit: number = 20): ConversationThread[] {
    try {
      // This would perform a full-text search on threads
      // For now, return empty array
      return [];
    } catch (error) {
      console.error(`Failed to search threads: ${error}`);
      return [];
    }
  }

  getThreadAnalytics(threadId: string): {
    messageCount: number;
    participantCount: number;
    averageResponseTime: number;
    messageFrequency: number;
    activeHours: number[];
    topParticipants: Array<{ agentId: string; messageCount: number }>;
  } {
    try {
      const messages = this.getThreadMessages(threadId);
      const thread = this.getThread(threadId);

      if (!thread || messages.length === 0) {
        return {
          messageCount: 0,
          participantCount: 0,
          averageResponseTime: 0,
          messageFrequency: 0,
          activeHours: [],
          topParticipants: []
        };
      }

      // Calculate analytics
      const participants = new Set(messages.map(m => m.fromAgentId));
      const participantCount = participants.size;

      const participantMessageCounts: Record<string, number> = {};
      messages.forEach(message => {
        participantMessageCounts[message.fromAgentId] = 
          (participantMessageCounts[message.fromAgentId] || 0) + 1;
      });

      const topParticipants = Object.entries(participantMessageCounts)
        .map(([agentId, count]) => ({ agentId, messageCount: count }))
        .sort((a, b) => b.messageCount - a.messageCount)
        .slice(0, 5);

      // Calculate response times
      let totalResponseTime = 0;
      let responseCount = 0;
      for (let i = 1; i < messages.length; i++) {
        const responseTime = messages[i].createdAt.getTime() - messages[i-1].createdAt.getTime();
        totalResponseTime += responseTime;
        responseCount++;
      }

      const averageResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0;

      // Calculate message frequency (messages per hour)
      const threadDuration = thread.lastMessageAt.getTime() - thread.createdAt.getTime();
      const messageFrequency = threadDuration > 0 ? (messages.length / (threadDuration / (1000 * 60 * 60))) : 0;

      // Calculate active hours
      const activeHours = new Set<number>();
      messages.forEach(message => {
        activeHours.add(message.createdAt.getHours());
      });

      return {
        messageCount: messages.length,
        participantCount,
        averageResponseTime,
        messageFrequency,
        activeHours: Array.from(activeHours).sort((a, b) => a - b),
        topParticipants
      };
    } catch (error) {
      console.error(`Failed to get thread analytics: ${error}`);
      return {
        messageCount: 0,
        participantCount: 0,
        averageResponseTime: 0,
        messageFrequency: 0,
        activeHours: [],
        topParticipants: []
      };
    }
  }

  private generateThreadId(): string {
    return `thread-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMessageId(): string {
    return `thread-msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getReplyChain(messageId: string): string[] {
    // This would trace the reply chain back to the original message
    // For now, return empty array
    return [];
  }

  private storeThread(thread: ConversationThread): void {
    // This would store the thread in the database
    console.log(`Storing thread: ${thread.id}`);
  }

  private updateThread(thread: ConversationThread): void {
    // This would update the thread in the database
    console.log(`Updating thread: ${thread.id}`);
  }

  private storeThreadMessage(message: ThreadMessage): void {
    // This would store the thread message in the database
    console.log(`Storing thread message: ${message.id}`);
  }
}
