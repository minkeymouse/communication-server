/**
 * Conversation Threading System
 * Maintains conversation context and message relationships
 */

export interface ConversationThread {
  threadId: string;
  participants: string[];
  messages: ThreadMessage[];
  lastActivity: Date;
  subject: string;
  priority: 'high' | 'normal' | 'low';
  state: 'active' | 'archived' | 'closed';
  metadata?: Record<string, any>;
}

export interface ThreadMessage {
  messageId: string;
  fromAgentId: string;
  toAgentId: string;
  content: string;
  subject: string;
  timestamp: Date;
  state: 'sent' | 'delivered' | 'read' | 'replied';
  priority: 'high' | 'normal' | 'low';
  replyTo?: string; // Message ID this is replying to
  threadId: string;
}

export class ConversationThreadManager {
  private threads: Map<string, ConversationThread> = new Map();
  private agentThreads: Map<string, Set<string>> = new Map(); // agentId -> threadIds

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
      state: 'active'
    };

    this.threads.set(threadId, thread);
    
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
   * Add message to existing thread
   */
  public addMessageToThread(
    threadId: string,
    message: Omit<ThreadMessage, 'threadId'>
  ): boolean {
    const thread = this.threads.get(threadId);
    if (!thread) {
      return false;
    }

    const threadMessage: ThreadMessage = {
      ...message,
      threadId
    };

    thread.messages.push(threadMessage);
    thread.lastActivity = new Date();
    
    // Update thread priority if message has higher priority
    if (this.getPriorityWeight(message.priority) > this.getPriorityWeight(thread.priority)) {
      thread.priority = message.priority;
    }

    return true;
  }

  /**
   * Find or create thread for message
   */
  public findOrCreateThread(
    fromAgentId: string,
    toAgentId: string,
    subject: string,
    priority: 'high' | 'normal' | 'low' = 'normal',
    replyTo?: string
  ): string {
    // If this is a reply, find the original thread
    if (replyTo) {
      const originalThread = this.findThreadByMessageId(replyTo);
      if (originalThread) {
        return originalThread.threadId;
      }
    }

    // Look for existing thread with same participants and similar subject
    const participants = [fromAgentId, toAgentId].sort();
    const existingThread = this.findThreadByParticipants(participants, subject);
    
    if (existingThread) {
      return existingThread.threadId;
    }

    // Create new thread
    return this.createThread(participants, subject, priority);
  }

  /**
   * Get thread by ID
   */
  public getThread(threadId: string): ConversationThread | undefined {
    return this.threads.get(threadId);
  }

  /**
   * Get threads for agent
   */
  public getAgentThreads(agentId: string): ConversationThread[] {
    const threadIds = this.agentThreads.get(agentId);
    if (!threadIds) {
      return [];
    }

    return Array.from(threadIds)
      .map(id => this.threads.get(id))
      .filter(thread => thread !== undefined)
      .sort((a, b) => b!.lastActivity.getTime() - a!.lastActivity.getTime()) as ConversationThread[];
  }

  /**
   * Get recent messages in thread
   */
  public getThreadMessages(
    threadId: string,
    limit: number = 50,
    offset: number = 0
  ): ThreadMessage[] {
    const thread = this.threads.get(threadId);
    if (!thread) {
      return [];
    }

    return thread.messages
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .slice(offset, offset + limit);
  }

  /**
   * Update message state in thread
   */
  public updateMessageState(
    threadId: string,
    messageId: string,
    state: ThreadMessage['state']
  ): boolean {
    const thread = this.threads.get(threadId);
    if (!thread) {
      return false;
    }

    const message = thread.messages.find(m => m.messageId === messageId);
    if (!message) {
      return false;
    }

    message.state = state;
    return true;
  }

  /**
   * Archive thread
   */
  public archiveThread(threadId: string): boolean {
    const thread = this.threads.get(threadId);
    if (!thread) {
      return false;
    }

    thread.state = 'archived';
    return true;
  }

  /**
   * Close thread
   */
  public closeThread(threadId: string): boolean {
    const thread = this.threads.get(threadId);
    if (!thread) {
      return false;
    }

    thread.state = 'closed';
    return true;
  }

  /**
   * Get thread statistics
   */
  public getThreadStats(): {
    totalThreads: number;
    activeThreads: number;
    archivedThreads: number;
    closedThreads: number;
    totalMessages: number;
  } {
    let totalMessages = 0;
    let activeThreads = 0;
    let archivedThreads = 0;
    let closedThreads = 0;

    this.threads.forEach(thread => {
      totalMessages += thread.messages.length;
      switch (thread.state) {
        case 'active':
          activeThreads++;
          break;
        case 'archived':
          archivedThreads++;
          break;
        case 'closed':
          closedThreads++;
          break;
      }
    });

    return {
      totalThreads: this.threads.size,
      activeThreads,
      archivedThreads,
      closedThreads,
      totalMessages
    };
  }

  /**
   * Find thread by participants and subject similarity
   */
  private findThreadByParticipants(
    participants: string[],
    subject: string
  ): ConversationThread | undefined {
    for (const thread of this.threads.values()) {
      if (thread.state !== 'active') continue;
      
      const threadParticipants = [...thread.participants].sort();
      if (this.arraysEqual(participants, threadParticipants)) {
        // Check if subjects are similar (simple similarity check)
        if (this.isSubjectSimilar(thread.subject, subject)) {
          return thread;
        }
      }
    }
    return undefined;
  }

  /**
   * Find thread containing message ID
   */
  private findThreadByMessageId(messageId: string): ConversationThread | undefined {
    for (const thread of this.threads.values()) {
      if (thread.messages.some(m => m.messageId === messageId)) {
        return thread;
      }
    }
    return undefined;
  }

  /**
   * Check if two arrays are equal
   */
  private arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((val, index) => val === b[index]);
  }

  /**
   * Simple subject similarity check
   */
  private isSubjectSimilar(subject1: string, subject2: string): boolean {
    const normalized1 = subject1.toLowerCase().replace(/re:\s*/i, '').trim();
    const normalized2 = subject2.toLowerCase().replace(/re:\s*/i, '').trim();
    
    // Check if one is a reply to the other
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
      return true;
    }
    
    // Check for common words
    const words1 = normalized1.split(/\s+/);
    const words2 = normalized2.split(/\s+/);
    const commonWords = words1.filter(word => words2.includes(word));
    
    return commonWords.length >= Math.min(words1.length, words2.length) * 0.5;
  }

  /**
   * Get priority weight for comparison
   */
  private getPriorityWeight(priority: string): number {
    switch (priority) {
      case 'high': return 3;
      case 'normal': return 2;
      case 'low': return 1;
      default: return 2;
    }
  }

  /**
   * Generate unique thread ID
   */
  private generateThreadId(): string {
    return `thread-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
