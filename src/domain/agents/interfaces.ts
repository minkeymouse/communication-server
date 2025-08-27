/**
 * Domain Interfaces
 * Centralized location for all domain interfaces
 */

import { AgentRole, MessageState, MessagePriority, SecurityLevel } from './enums.js';

// Simple authentication system: ID + SESSION (no passwords for LLM agents)
export interface AgentCredentials {
  agentId: string;             // ID - Unique agent identifier for authentication
  lastLogin?: Date;            // Last successful login
  loginAttempts: number;       // Failed login attempts (for rate limiting)
  lockedUntil?: Date;          // Account lockout until (for rate limiting)
  sessionToken?: string;       // Current active session token
  sessionExpiresAt?: Date;     // Session expiration time
}

export interface Agent {
  id: string;                  // ID - Unique agent identifier
  name: string;
  apiKey: string;
  email?: string;
  role: AgentRole;
  workspacePath?: string;      // ADDRESS - Workspace path/address
  address?: string;
  createdAt: Date;
  lastSeen?: Date;
  isActive: boolean;
  
  // Simple authentication
  credentials?: AgentCredentials;
  
  // Additional metadata
  displayName: string;         // Human-readable display name
  description?: string;        // Agent description
  capabilities?: string[];     // List of agent capabilities
  tags?: string[];             // Tags for categorization
  version?: string;            // Agent version
  createdBy?: string;          // Who created this agent (parent agent ID)
}

export interface Conversation {
  id: string;
  subject: string;
  participants: string[]; // List of agent IDs
  createdBy: string; // Agent ID who created the conversation
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  messageCount: number;
}

export interface Message {
  id: string;
  conversationId: string;
  fromAgent: string; // Agent ID
  toAgent: string;   // Agent ID
  subject: string;
  content: string;
  state: MessageState;
  priority: MessagePriority;
  expiresAt?: Date;
  replyTo?: string;  // Message ID this is replying to
  createdAt: Date;
  readAt?: Date;
  repliedAt?: Date;
  archivedAt?: Date;
  isRead: boolean;
  requiresReply: boolean;
  
  // Enhanced sender information
  fromAgentName?: string;
  fromAgentRole?: string;
  fromAgentWorkspace?: string;
  toAgentName?: string;
  toAgentRole?: string;
  toAgentWorkspace?: string;
  
  // Message metadata for efficient storage
  metadata?: Record<string, any>;
  
  // Protocol metadata
  routingType?: string;
  securityLevel?: string;
  signature?: string;
}

export interface LogEntry {
  id: string;
  level: string; // INFO, WARNING, ERROR, DEBUG
  message: string;
  createdAt: Date;
  agentId?: string;
  conversationId?: string;
  messageId?: string;
  metadata?: string;
}

export interface ConversationSummary {
  conversationId: string;
  subject: string;
  participants: string[];
  participantNames: string[];
  messageCount: number;
  firstMessageAt: Date;
  lastMessageAt: Date;
  lastMessageContent: string;
  conversationState: string; // "active", "completed", "archived"
  createdAt: Date;
}
