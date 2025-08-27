/**
 * Agent Monitor Types
 * Type definitions for agent monitoring and status tracking
 */

export interface AgentStatus {
  agentId: string;
  isOnline: boolean;
  lastSeen: Date;
  lastActivity: Date;
  responseTime: number; // Average response time in milliseconds
  messageCount: number;
  errorCount: number;
  sessionToken?: string;
  sessionExpires?: Date;
  metadata?: Record<string, any>;
  // Enhanced identity tracking
  identityHash?: string; // Unique identity fingerprint
  roleConsistency?: number; // 0-1 score of role consistency
  conversationContext?: string; // Current conversation context
  activeThreads?: string[]; // Currently active conversation threads
  lastIdentityCheck?: Date; // When identity was last validated
}

export interface AgentMetrics {
  agentId: string;
  avgResponseTime: number;
  totalMessages: number;
  successRate: number;
  uptime: number; // Percentage of time online
  lastSeen: Date;
  // Enhanced metrics
  identityStability: number; // 0-1 score of identity stability
  conversationCoherence: number; // 0-1 score of conversation coherence
  ghostInteractionCount: number; // Count of interactions with non-existent agents
  selfInteractionCount: number; // Count of self-interactions
}

export interface IdentityValidation {
  isValid: boolean;
  confidence: number;
  driftDetected: boolean;
  correctionApplied: boolean;
  lastValidation: Date;
}

export interface AgentActivity {
  agentId: string;
  timestamp: Date;
  activityType: 'message_sent' | 'message_received' | 'login' | 'logout' | 'error';
  details?: Record<string, any>;
}
