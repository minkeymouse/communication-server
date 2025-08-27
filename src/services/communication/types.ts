/**
 * Conversation System Types
 * Type definitions for conversation threading and context management
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

export interface ParticipantState {
  lastMessage: ThreadMessage | null;
  engagementLevel: number; // 0-1 score
  contextAwareness: number; // 0-1 score
  lastActivity: Date;
}

export interface TopicAnalysis {
  topic: string;
  relevance: number;
  keywords: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
}

export interface ConversationMetrics {
  threadId: string;
  messageCount: number;
  participantCount: number;
  averageResponseTime: number;
  coherenceScore: number;
  topicDriftScore: number;
  engagementScore: number;
}
