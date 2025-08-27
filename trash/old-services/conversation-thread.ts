/**
 * Conversation Threading System
 * Maintains conversation context and message relationships
 * Enhanced with state tracking and context management
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
  // Enhanced conversation tracking
  contextHash?: string; // Hash of conversation context
  topicDriftScore?: number; // 0-1 score of topic consistency
  participantEngagement?: Record<string, number>; // Engagement scores per participant
  conversationCoherence?: number; // Overall coherence score
  lastContextUpdate?: Date; // When context was last updated
  conversationSummary?: string; // Current conversation summary
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
  // Enhanced message tracking
  contextRelevance?: number; // How relevant to current context
  topicAlignment?: number; // How aligned with conversation topic
  participantContext?: Record<string, any>; // Context for each participant
}

export interface ConversationContext {
  threadId: string;
  currentTopic: string;
  participants: string[];
  conversationSummary: string;
  keyPoints: string[];
  pendingActions: string[];
  contextHash: string;
  lastUpdate: Date;
}

export class ConversationThreadManager {
  private threads: Map<string, ConversationThread> = new Map();
  private agentThreads: Map<string, Set<string>> = new Map(); // agentId -> threadIds
  // Enhanced context management
  private conversationContexts: Map<string, ConversationContext> = new Map();
  private topicHistory: Map<string, string[]> = new Map(); // threadId -> topic history
  private participantStates: Map<string, Map<string, any>> = new Map(); // threadId -> agentId -> state

  /**
   * Create a new conversation thread with enhanced context tracking
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
    this.conversationContexts.set(threadId, {
      threadId,
      currentTopic: subject,
      participants,
      conversationSummary: `New conversation: ${subject}`,
      keyPoints: [],
      pendingActions: [],
      contextHash: thread.contextHash!,
      lastUpdate: new Date()
    });

    // Initialize topic history
    this.topicHistory.set(threadId, [subject]);
    
    // Initialize participant states
    this.participantStates.set(threadId, new Map());
    participants.forEach(agentId => {
      this.participantStates.get(threadId)!.set(agentId, {
        lastMessage: null,
        engagementLevel: 1.0,
        contextAwareness: 1.0,
        lastActivity: new Date()
      });
    });
    
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
   * Add message to existing thread with enhanced context tracking
   */
  public addMessageToThread(
    threadId: string,
    message: Omit<ThreadMessage, 'threadId'>
  ): boolean {
    const thread = this.threads.get(threadId);
    if (!thread) {
      return false;
    }

    // Validate participant
    if (!thread.participants.includes(message.fromAgentId)) {
      console.warn(`Agent ${message.fromAgentId} not in thread ${threadId} participants`);
      return false;
    }

    const threadMessage: ThreadMessage = {
      ...message,
      threadId,
      contextRelevance: this.calculateContextRelevance(threadId, message),
      topicAlignment: this.calculateTopicAlignment(threadId, message),
      participantContext: this.getParticipantContext(threadId, message.fromAgentId)
    };

    thread.messages.push(threadMessage);
    thread.lastActivity = new Date();
    
    // Update thread priority if message has higher priority
    if (this.getPriorityWeight(message.priority) > this.getPriorityWeight(thread.priority)) {
      thread.priority = message.priority;
    }

    // Update conversation context
    this.updateConversationContext(threadId, threadMessage);
    
    // Update participant engagement
    this.updateParticipantEngagement(threadId, message.fromAgentId, threadMessage);
    
    // Check for topic drift
    this.detectTopicDrift(threadId, threadMessage);

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

  /**
   * Update conversation context based on new message
   */
  private updateConversationContext(threadId: string, message: ThreadMessage): void {
    const context = this.conversationContexts.get(threadId);
    if (!context) return;

    // Update conversation summary
    const newSummary = this.generateConversationSummary(threadId, message);
    context.conversationSummary = newSummary;
    
    // Update key points
    const keyPoints = this.extractKeyPoints(message.content);
    context.keyPoints = [...context.keyPoints, ...keyPoints].slice(-10); // Keep last 10
    
    // Update pending actions
    const actions = this.extractPendingActions(message.content);
    context.pendingActions = [...context.pendingActions, ...actions];
    
    // Update context hash
    context.contextHash = this.generateContextHash(context.conversationSummary, context.keyPoints);
    context.lastUpdate = new Date();

    // Update thread context hash
    const thread = this.threads.get(threadId);
    if (thread) {
      thread.contextHash = context.contextHash;
      thread.lastContextUpdate = new Date();
      thread.conversationSummary = newSummary;
    }
  }

  /**
   * Update participant engagement tracking
   */
  private updateParticipantEngagement(threadId: string, agentId: string, message: ThreadMessage): void {
    const thread = this.threads.get(threadId);
    if (!thread) return;

    const participantState = this.participantStates.get(threadId)?.get(agentId);
    if (!participantState) return;

    // Update engagement level based on message quality and context relevance
    const engagementDelta = (message.contextRelevance || 0.5) * 0.1;
    participantState.engagementLevel = Math.min(1.0, participantState.engagementLevel + engagementDelta);
    participantState.lastMessage = message;
    participantState.lastActivity = new Date();

    // Update thread participant engagement
    if (!thread.participantEngagement) {
      thread.participantEngagement = {};
    }
    thread.participantEngagement[agentId] = participantState.engagementLevel;
  }

  /**
   * Detect topic drift in conversation
   */
  private detectTopicDrift(threadId: string, message: ThreadMessage): void {
    const thread = this.threads.get(threadId);
    if (!thread) return;

    const topicHistory = this.topicHistory.get(threadId) || [];
    const currentTopic = this.extractTopic(message.content);
    
    if (currentTopic && topicHistory.length > 0) {
      const lastTopic = topicHistory[topicHistory.length - 1];
      const topicSimilarity = this.calculateTopicSimilarity(lastTopic, currentTopic);
      
      // Update topic drift score
      thread.topicDriftScore = Math.max(0, (thread.topicDriftScore || 1.0) - (1 - topicSimilarity) * 0.1);
      
      // Add new topic to history if significantly different
      if (topicSimilarity < 0.7) {
        topicHistory.push(currentTopic);
        if (topicHistory.length > 10) {
          topicHistory.shift();
        }
      }
    }

    // Update conversation coherence
    thread.conversationCoherence = this.calculateConversationCoherence(threadId);
  }

  /**
   * Calculate context relevance of message
   */
  private calculateContextRelevance(threadId: string, message: Omit<ThreadMessage, 'threadId'>): number {
    const context = this.conversationContexts.get(threadId);
    if (!context) return 0.5;

    // Simple relevance calculation based on keyword overlap
    const contextKeywords = this.extractKeywords(context.conversationSummary);
    const messageKeywords = this.extractKeywords(message.content);
    
    const overlap = contextKeywords.filter(keyword => 
      messageKeywords.includes(keyword)
    ).length;
    
    return Math.min(1.0, overlap / Math.max(contextKeywords.length, 1));
  }

  /**
   * Calculate topic alignment of message
   */
  private calculateTopicAlignment(threadId: string, message: Omit<ThreadMessage, 'threadId'>): number {
    const topicHistory = this.topicHistory.get(threadId) || [];
    if (topicHistory.length === 0) return 1.0;

    const currentTopic = this.extractTopic(message.content);
    const lastTopic = topicHistory[topicHistory.length - 1];
    
    return this.calculateTopicSimilarity(lastTopic, currentTopic);
  }

  /**
   * Get participant context for message
   */
  private getParticipantContext(threadId: string, agentId: string): Record<string, any> {
    const participantState = this.participantStates.get(threadId)?.get(agentId);
    if (!participantState) return {};

    return {
      engagementLevel: participantState.engagementLevel,
      lastActivity: participantState.lastActivity,
      contextAwareness: participantState.contextAwareness
    };
  }

  /**
   * Generate conversation summary
   */
  private generateConversationSummary(threadId: string, message: ThreadMessage): string {
    const thread = this.threads.get(threadId);
    if (!thread) return '';

    const recentMessages = thread.messages.slice(-5); // Last 5 messages
    const summaries = recentMessages.map(msg => 
      `${msg.fromAgentId}: ${msg.content.substring(0, 100)}...`
    );
    
    return `Recent conversation: ${summaries.join(' | ')}`;
  }

  /**
   * Extract key points from message content
   */
  private extractKeyPoints(content: string): string[] {
    // Simple key point extraction - in production, use NLP
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    return sentences.slice(0, 3); // Return first 3 sentences as key points
  }

  /**
   * Extract pending actions from message content
   */
  private extractPendingActions(content: string): string[] {
    const actionKeywords = ['need to', 'should', 'must', 'will', 'going to', 'plan to'];
    const actions: string[] = [];
    
    actionKeywords.forEach(keyword => {
      const regex = new RegExp(`${keyword}[^.!?]+`, 'gi');
      const matches = content.match(regex);
      if (matches) {
        actions.push(...matches);
      }
    });
    
    return actions;
  }

  /**
   * Extract topic from message content
   */
  private extractTopic(content: string): string {
    // Simple topic extraction - in production, use NLP
    const words = content.toLowerCase().split(/\s+/);
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const filteredWords = words.filter(word => !stopWords.includes(word));
    
    return filteredWords.slice(0, 3).join(' '); // Return first 3 non-stop words
  }

  /**
   * Calculate topic similarity
   */
  private calculateTopicSimilarity(topic1: string, topic2: string): number {
    const words1 = topic1.toLowerCase().split(/\s+/);
    const words2 = topic2.toLowerCase().split(/\s+/);
    
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    
    return union.length > 0 ? intersection.length / union.length : 0;
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    const words = text.toLowerCase().split(/\s+/);
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    return words.filter(word => !stopWords.includes(word) && word.length > 3);
  }

  /**
   * Calculate conversation coherence
   */
  private calculateConversationCoherence(threadId: string): number {
    const thread = this.threads.get(threadId);
    if (!thread || thread.messages.length < 2) return 1.0;

    let coherenceScore = 1.0;
    const messages = thread.messages.slice(-10); // Last 10 messages
    
    for (let i = 1; i < messages.length; i++) {
      const prev = messages[i - 1];
      const curr = messages[i];
      
      // Reduce coherence if context relevance is low
      if (curr.contextRelevance && curr.contextRelevance < 0.5) {
        coherenceScore -= 0.1;
      }
      
      // Reduce coherence if topic alignment is low
      if (curr.topicAlignment && curr.topicAlignment < 0.7) {
        coherenceScore -= 0.1;
      }
    }
    
    return Math.max(0, coherenceScore);
  }

  /**
   * Generate context hash
   */
  private generateContextHash(...components: any[]): string {
    const data = components.map(c => 
      typeof c === 'string' ? c : JSON.stringify(c)
    ).join('|');
    
    return Buffer.from(data).toString('base64').substring(0, 16);
  }
}
