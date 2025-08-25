/**
 * Data models for the communication system.
 */

import { v4 as uuidv4 } from 'uuid';

export const VERSION = "2.0.0";

export enum AgentRole {
  GENERAL = "general",
  DEVELOPER = "developer",
  MANAGER = "manager",
  ANALYST = "analyst",
  TESTER = "tester",
  DESIGNER = "designer",
  COORDINATOR = "coordinator"
}

export enum MessageState {
  SENT = "sent",
  ARRIVED = "arrived",
  REPLIED = "replied",
  IGNORED = "ignored",
  READ = "read",
  UNREAD = "unread"
}

export enum MessagePriority {
  LOW = "low",
  NORMAL = "normal",
  HIGH = "high",
  URGENT = "urgent"
}

export interface Agent {
  id: string;
  name: string;
  apiKey: string;
  email?: string;
  role: AgentRole;
  workspacePath?: string;
  address?: string;
  createdAt: Date;
  lastSeen?: Date;
  isActive: boolean;
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

// Factory functions
export function createAgent(
  name: string,
  workspacePath?: string,
  role: AgentRole = AgentRole.GENERAL,
  email?: string,
  address?: string
): Agent {
  const workspaceHash = workspacePath ? Math.abs(workspacePath.hashCode()) % 10000 : 0;
  const nameHash = Math.abs(name.hashCode()) % 1000;
  const agentId = `${workspaceHash.toString().padStart(4, '0')}-${nameHash.toString().padStart(3, '0')}-${uuidv4().slice(0, 8)}`;
  
  return {
    id: agentId,
    name,
    apiKey: uuidv4(),
    email,
    role,
    workspacePath,
    address,
    createdAt: new Date(),
    isActive: true
  };
}

export function createMessage(
  conversationId: string,
  fromAgent: string,
  toAgent: string,
  subject: string,
  content: string,
  state: MessageState = MessageState.SENT,
  replyTo?: string,
  priority: MessagePriority = MessagePriority.NORMAL,
  expiresAt?: Date
): Message {
  return {
    id: uuidv4(),
    conversationId,
    fromAgent,
    toAgent,
    subject,
    content,
    state,
    priority,
    expiresAt,
    replyTo,
    createdAt: new Date(),
    isRead: false,
    requiresReply: true,
    metadata: {}
  };
}

export function createConversation(
  subject: string,
  participants: string[],
  createdBy: string
): Conversation {
  return {
    id: uuidv4(),
    subject,
    participants,
    createdBy,
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    messageCount: 0
  };
}

// Utility functions
export function getProjectName(workspacePath?: string): string {
  if (!workspacePath) return "unknown";
  const parts = workspacePath.split('/');
  return parts[parts.length - 1] || "unknown";
}

export function getDisplayName(agent: Agent): string {
  const project = getProjectName(agent.workspacePath);
  const addressInfo = agent.address ? ` (${agent.address})` : "";
  return `${agent.name} (${project})${addressInfo}`;
}

export function getFullAddress(agent: Agent): string {
  if (agent.address) {
    return `${agent.workspacePath} - ${agent.address}`;
  }
  return agent.workspacePath || "Unknown";
}

// Extend String prototype for hashCode (for compatibility)
declare global {
  interface String {
    hashCode(): number;
  }
}

String.prototype.hashCode = function(): number {
  let hash = 0;
  if (this.length === 0) return hash;
  for (let i = 0; i < this.length; i++) {
    const char = this.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash;
};

// Message templates for common use cases
export const MessageTemplates = {
  BUG_REPORT: {
    title: "Bug Report",
    content: "I found a bug in the system. Please investigate and fix it."
  },
  FEATURE_REQUEST: {
    title: "Feature Request", 
    content: "I would like to request a new feature. Please review and implement it."
  },
  API_INTEGRATION: {
    title: "API Integration Request",
    content: "I need help integrating with the API. Can you assist me?"
  },
  CODE_REVIEW: {
    title: "Code Review Request",
    content: "Please review my code changes and provide feedback."
  },
  DEPLOYMENT: {
    title: "Deployment Request",
    content: "I need help with deployment. Can you assist me?"
  },
  TESTING: {
    title: "Testing Request",
    content: "I need help with testing. Can you assist me?"
  }
} as const;

export type MessageTemplateType = keyof typeof MessageTemplates;
