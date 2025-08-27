/**
 * Conversation Context Manager
 * Handles conversation context, topic analysis, and context preservation
 */

import { ConversationContext, ThreadMessage, TopicAnalysis, ParticipantState } from './types.js';

export class ContextManager {
  private conversationContexts: Map<string, ConversationContext> = new Map();
  private topicHistory: Map<string, string[]> = new Map(); // threadId -> topic history
  private participantStates: Map<string, Map<string, ParticipantState>> = new Map(); // threadId -> agentId -> state

  /**
   * Initialize conversation context
   */
  public initializeContext(
    threadId: string,
    participants: string[],
    subject: string
  ): ConversationContext {
    const context: ConversationContext = {
      threadId,
      currentTopic: subject,
      participants,
      conversationSummary: `New conversation: ${subject}`,
      keyPoints: [],
      pendingActions: [],
      contextHash: this.generateContextHash(subject, participants),
      lastUpdate: new Date()
    };

    this.conversationContexts.set(threadId, context);
    this.topicHistory.set(threadId, [subject]);
    this.initializeParticipantStates(threadId, participants);

    return context;
  }

  /**
   * Update conversation context with new message
   */
  public updateContext(threadId: string, message: ThreadMessage): void {
    const context = this.conversationContexts.get(threadId);
    if (!context) return;

    // Update topic analysis
    const topicAnalysis = this.analyzeTopic(message.content);
    this.updateTopicHistory(threadId, topicAnalysis.topic);

    // Update conversation summary
    context.conversationSummary = this.generateConversationSummary(threadId, message);

    // Update key points
    this.updateKeyPoints(threadId, message);

    // Update participant state
    this.updateParticipantState(threadId, message.fromAgentId, message);

    // Update context hash
    context.contextHash = this.generateContextHash(context.currentTopic, context.participants);
    context.lastUpdate = new Date();

    this.conversationContexts.set(threadId, context);
  }

  /**
   * Get conversation context
   */
  public getContext(threadId: string): ConversationContext | null {
    return this.conversationContexts.get(threadId) || null;
  }

  /**
   * Get participant state
   */
  public getParticipantState(threadId: string, agentId: string): ParticipantState | null {
    const participantStates = this.participantStates.get(threadId);
    return participantStates?.get(agentId) || null;
  }

  /**
   * Get topic history
   */
  public getTopicHistory(threadId: string): string[] {
    return this.topicHistory.get(threadId) || [];
  }

  /**
   * Calculate conversation coherence
   */
  public calculateConversationCoherence(threadId: string): number {
    const topicHistory = this.getTopicHistory(threadId);
    if (topicHistory.length < 2) return 1.0;

    let coherence = 0;
    for (let i = 1; i < topicHistory.length; i++) {
      const similarity = this.calculateTopicSimilarity(topicHistory[i - 1], topicHistory[i]);
      coherence += similarity;
    }

    return coherence / (topicHistory.length - 1);
  }

  /**
   * Generate conversation summary
   */
  private generateConversationSummary(threadId: string, message: ThreadMessage): string {
    const context = this.conversationContexts.get(threadId);
    if (!context) return '';

    const recentMessages = context.participants.length > 0 ? 
      `Recent activity: ${message.fromAgentId} sent a message` : 
      'New conversation started';

    return `${context.conversationSummary}. ${recentMessages}`;
  }

  /**
   * Analyze topic from message content
   */
  private analyzeTopic(content: string): TopicAnalysis {
    // Simple topic extraction (in production, use NLP)
    const words = content.toLowerCase().split(/\s+/);
    const keywords = words.filter(word => word.length > 3).slice(0, 5);
    
    return {
      topic: keywords.join(' '),
      relevance: 0.8,
      keywords,
      sentiment: 'neutral'
    };
  }

  /**
   * Update topic history
   */
  private updateTopicHistory(threadId: string, newTopic: string): void {
    const history = this.topicHistory.get(threadId) || [];
    const lastTopic = history[history.length - 1];
    
    if (lastTopic && this.calculateTopicSimilarity(lastTopic, newTopic) < 0.7) {
      history.push(newTopic);
      if (history.length > 10) {
        history.shift();
      }
      this.topicHistory.set(threadId, history);
    }
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
   * Update key points
   */
  private updateKeyPoints(threadId: string, message: ThreadMessage): void {
    const context = this.conversationContexts.get(threadId);
    if (!context) return;

    // Simple key point extraction (in production, use NLP)
    const keyPoints = context.keyPoints;
    const content = message.content.toLowerCase();
    
    if (content.includes('important') || content.includes('key') || content.includes('note')) {
      const keyPoint = message.content.substring(0, 100) + '...';
      if (!keyPoints.includes(keyPoint)) {
        keyPoints.push(keyPoint);
        if (keyPoints.length > 10) {
          keyPoints.shift();
        }
      }
    }
  }

  /**
   * Update participant state
   */
  private updateParticipantState(threadId: string, agentId: string, message: ThreadMessage): void {
    const participantStates = this.participantStates.get(threadId);
    if (!participantStates) return;

    const currentState = participantStates.get(agentId) || this.createDefaultParticipantState();
    
    currentState.lastMessage = message;
    currentState.lastActivity = new Date();
    currentState.engagementLevel = Math.min(1.0, currentState.engagementLevel + 0.1);
    currentState.contextAwareness = this.calculateContextAwareness(threadId, agentId);

    participantStates.set(agentId, currentState);
  }

  /**
   * Initialize participant states
   */
  private initializeParticipantStates(threadId: string, participants: string[]): void {
    const participantStates = new Map<string, ParticipantState>();
    
    participants.forEach(agentId => {
      participantStates.set(agentId, this.createDefaultParticipantState());
    });
    
    this.participantStates.set(threadId, participantStates);
  }

  /**
   * Create default participant state
   */
  private createDefaultParticipantState(): ParticipantState {
    return {
      lastMessage: null,
      engagementLevel: 1.0,
      contextAwareness: 1.0,
      lastActivity: new Date()
    };
  }

  /**
   * Calculate context awareness for participant
   */
  private calculateContextAwareness(threadId: string, agentId: string): number {
    const context = this.conversationContexts.get(threadId);
    if (!context) return 1.0;

    // Simple context awareness calculation
    const participantState = this.getParticipantState(threadId, agentId);
    if (!participantState) return 1.0;

    const timeSinceLastActivity = Date.now() - participantState.lastActivity.getTime();
    const timeThreshold = 5 * 60 * 1000; // 5 minutes

    return timeSinceLastActivity < timeThreshold ? 1.0 : 0.8;
  }

  /**
   * Generate context hash
   */
  private generateContextHash(topic: string, participants: string[]): string {
    const hashData = {
      topic,
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
   * Clear context for thread
   */
  public clearContext(threadId: string): void {
    this.conversationContexts.delete(threadId);
    this.topicHistory.delete(threadId);
    this.participantStates.delete(threadId);
  }
}
