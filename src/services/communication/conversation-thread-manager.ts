/**
 * Conversation Thread Manager
 * Main entry point for conversation threading and management
 */

import { ConversationThread, ThreadMessage, ConversationMetrics } from './types.js';
import { ContextManager } from './context-manager.js';

export class ConversationThreadManager {
  private threads: Map<string, ConversationThread> = new Map();
  private agentThreads: Map<string, Set<string>> = new Map(); // agentId -> threadIds
  private contextManager: ContextManager;

  constructor() {
    this.contextManager = new ContextManager();
  }

  /**
   * Create a new conversation thread
   */
  public createThread(
    participants: string[],
    subject: string,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): string {
    const threadId = this.generateThreadId();
    
    const thread: ConversationThread = {
      threadId,
      participants: [...new Set(participants)], // Remove duplicates
      messages: [],
      lastActivity: new Date(),
      subject,
      priority,
      state: 'active',
      contextHash: this.generateContextHash(subject, participants),
      topicDriftScore: 1.0,
      participantEngagement: {},
      conversationCoherence: 1.0,
      lastContextUpdate: new Date(),
      conversationSummary: `New conversation: ${subject}`
    };

    this.threads.set(threadId, thread);
    
    // Initialize conversation context
    this.contextManager.initializeContext(threadId, participants, subject);
    
    // Update agent-thread mappings
    participants.forEach(agentId => {
      if (!this.agentThreads.has(agentId)) {
        this.agentThreads.set(agentId, new Set());
      }
      this.agentThreads.get(agentId)!.add(threadId);
    });

    return threadId;
  }

  /**
   * Find existing thread or create new one
   */
  public findOrCreateThread(
    participants: string[],
    subject: string,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): string {
    // Look for existing thread with same participants and subject
    const existingThread = this.findExistingThread(participants, subject);
    if (existingThread) {
      return existingThread.threadId;
    }

    // Create new thread if none exists
    return this.createThread(participants, subject, priority);
  }

  /**
   * Find existing thread with same participants and subject
   */
  private findExistingThread(participants: string[], subject: string): ConversationThread | null {
    const participantSet = new Set(participants);
    
    for (const thread of this.threads.values()) {
      if (thread.state !== 'active') continue;
      
      const threadParticipantSet = new Set(thread.participants);
      const hasSameParticipants = participantSet.size === threadParticipantSet.size &&
        [...participantSet].every(p => threadParticipantSet.has(p));
      
      if (hasSameParticipants && thread.subject === subject) {
        return thread;
      }
    }
    
    return null;
  }

  /**
   * Add message to thread
   */
  public addMessageToThread(threadId: string, message: Omit<ThreadMessage, 'threadId'>): boolean {
    const thread = this.threads.get(threadId);
    if (!thread) return false;

    const threadMessage: ThreadMessage = {
      ...message,
      threadId
    };

    // Add message to thread
    thread.messages.push(threadMessage);
    thread.lastActivity = new Date();

    // Update context
    this.contextManager.updateContext(threadId, threadMessage);

    // Update thread metrics
    this.updateThreadMetrics(threadId);

    return true;
  }

  /**
   * Get thread by ID
   */
  public getThread(threadId: string): ConversationThread | null {
    return this.threads.get(threadId) || null;
  }

  /**
   * Get threads for agent
   */
  public getAgentThreads(agentId: string): ConversationThread[] {
    const threadIds = this.agentThreads.get(agentId);
    if (!threadIds) return [];

    return Array.from(threadIds)
      .map(threadId => this.threads.get(threadId))
      .filter((thread): thread is ConversationThread => thread !== undefined);
  }

  /**
   * Get all threads
   */
  public getAllThreads(): ConversationThread[] {
    return Array.from(this.threads.values());
  }

  /**
   * Get active threads
   */
  public getActiveThreads(): ConversationThread[] {
    return this.getAllThreads().filter(thread => thread.state === 'active');
  }

  /**
   * Archive thread
   */
  public archiveThread(threadId: string): boolean {
    const thread = this.threads.get(threadId);
    if (!thread) return false;

    thread.state = 'archived';
    return true;
  }

  /**
   * Close thread
   */
  public closeThread(threadId: string): boolean {
    const thread = this.threads.get(threadId);
    if (!thread) return false;

    thread.state = 'closed';
    return true;
  }

  /**
   * Get conversation metrics
   */
  public getConversationMetrics(threadId: string): ConversationMetrics | null {
    const thread = this.threads.get(threadId);
    if (!thread) return null;

    const responseTimes = this.calculateResponseTimes(thread);
    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : 0;

    return {
      threadId,
      messageCount: thread.messages.length,
      participantCount: thread.participants.length,
      averageResponseTime,
      coherenceScore: thread.conversationCoherence || 1.0,
      topicDriftScore: thread.topicDriftScore || 1.0,
      engagementScore: this.calculateEngagementScore(thread)
    };
  }

  /**
   * Update thread metrics
   */
  private updateThreadMetrics(threadId: string): void {
    const thread = this.threads.get(threadId);
    if (!thread) return;

    // Update conversation coherence
    thread.conversationCoherence = this.contextManager.calculateConversationCoherence(threadId);

    // Update topic drift score
    const topicHistory = this.contextManager.getTopicHistory(threadId);
    if (topicHistory.length > 1) {
      const lastTopic = topicHistory[topicHistory.length - 1];
      const previousTopic = topicHistory[topicHistory.length - 2];
      const similarity = this.calculateTopicSimilarity(lastTopic, previousTopic);
      thread.topicDriftScore = Math.max(0, (thread.topicDriftScore || 1.0) - (1 - similarity) * 0.1);
    }

    // Update participant engagement
    thread.participantEngagement = this.calculateParticipantEngagement(threadId);

    // Update context hash
    thread.contextHash = this.generateContextHash(thread.subject, thread.participants);
    thread.lastContextUpdate = new Date();

    this.threads.set(threadId, thread);
  }

  /**
   * Calculate response times between messages
   */
  private calculateResponseTimes(thread: ConversationThread): number[] {
    const responseTimes: number[] = [];
    const messages = thread.messages.sort((a: ThreadMessage, b: ThreadMessage) => a.timestamp.getTime() - b.timestamp.getTime());

    for (let i = 1; i < messages.length; i++) {
      const timeDiff = messages[i].timestamp.getTime() - messages[i - 1].timestamp.getTime();
      responseTimes.push(timeDiff);
    }

    return responseTimes;
  }

  /**
   * Calculate engagement score for thread
   */
  private calculateEngagementScore(thread: ConversationThread): number {
    if (thread.participantEngagement && Object.keys(thread.participantEngagement).length > 0) {
      const scores = Object.values(thread.participantEngagement);
      return scores.reduce((sum: number, score: number) => sum + score, 0) / scores.length;
    }
    return 1.0;
  }

  /**
   * Calculate participant engagement
   */
  private calculateParticipantEngagement(threadId: string): Record<string, number> {
    const engagement: Record<string, number> = {};
    const thread = this.threads.get(threadId);
    if (!thread) return engagement;

    thread.participants.forEach((agentId: string) => {
      const participantState = this.contextManager.getParticipantState(threadId, agentId);
      engagement[agentId] = participantState?.engagementLevel || 1.0;
    });

    return engagement;
  }

  /**
   * Calculate topic similarity
   */
  private calculateTopicSimilarity(topic1: string, topic2: string): number {
    const words1 = new Set(topic1.toLowerCase().split(/\s+/));
    const words2 = new Set(topic2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Generate thread ID
   */
  private generateThreadId(): string {
    return `thread-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate context hash
   */
  private generateContextHash(subject: string, participants: string[]): string {
    const hashData = {
      subject,
      participants: participants.sort(),
      timestamp: new Date().toISOString()
    };
    
    const hashString = JSON.stringify(hashData);
    let hash = 0;
    for (let i = 0; i < hashString.length; i++) {
      const char = hashString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return Math.abs(hash).toString(16);
  }

  /**
   * Clean up old threads
   */
  public cleanupOldThreads(maxAgeDays: number = 30): void {
    const cutoffTime = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
    const threadsToRemove: string[] = [];

    for (const [threadId, thread] of this.threads.entries()) {
      if (thread.lastActivity.getTime() < cutoffTime && thread.state !== 'active') {
        threadsToRemove.push(threadId);
      }
    }

    threadsToRemove.forEach(threadId => {
      this.threads.delete(threadId);
      this.contextManager.clearContext(threadId);
      
      // Remove from agent-thread mappings
      for (const [agentId, threadIds] of this.agentThreads.entries()) {
        threadIds.delete(threadId);
        if (threadIds.size === 0) {
          this.agentThreads.delete(agentId);
        }
      }
    });
  }
}

// Export types and classes
export * from './types.js';
export { ContextManager } from './context-manager.js';
