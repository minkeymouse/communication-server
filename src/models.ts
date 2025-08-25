/**
 * Data models for the communication system.
 */

import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';

export const VERSION = "2.1.0";

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

// Simple authentication system: ID, PW, ADDRESS
export interface AgentCredentials {
  username: string;            // ID - Unique username for login
  passwordHash: string;        // PW - Hashed password for authentication
  salt: string;                // Salt for password hashing
  lastLogin?: Date;            // Last successful login
  loginAttempts: number;       // Failed login attempts
  lockedUntil?: Date;          // Account lockout until
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
  credentials?: AgentCredentials,
  description?: string,
  capabilities?: string[],
  tags?: string[],
  createdBy?: string,
  agentId?: string // User-provided ID
): Agent {
  // Input validation
  if (!validateAgentName(name)) {
    throw new Error('Invalid agent name. Must be a non-empty string up to 200 characters.');
  }
  
  if (workspacePath && !validateWorkspacePath(workspacePath)) {
    throw new Error('Invalid workspace path. Must be an absolute path starting with "/" up to 500 characters.');
  }
  
  if (agentId && !validateAgentId(agentId)) {
    throw new Error('Invalid agent ID. Must be a non-empty string up to 100 characters.');
  }
  
  if (description && description.length > 1000) {
    throw new Error('Description too long. Must be 1000 characters or less.');
  }
  
  // Sanitize inputs
  const sanitizedName = sanitizeString(name);
  const sanitizedDescription = description ? sanitizeString(description) : undefined;
  
  // Use user-provided ID or generate a fallback
  const id = agentId || `LOC-${Date.now().toString().slice(-4)}-${createHash('sha256')
    .update(`${sanitizedName}:${workspacePath || 'unknown'}:${Date.now()}`)
    .digest('hex')
    .slice(0, 8)}`;

  const apiKey = uuidv4();
  const createdAt = new Date();

  return {
    id,
    name: sanitizedName,
    apiKey,
    email: undefined,
    role,
    workspacePath: workspacePath || undefined,
    address: workspacePath || undefined,
    createdAt,
    lastSeen: undefined,
    isActive: true,
    credentials,
    displayName: sanitizedName,
    description: sanitizedDescription,
    capabilities: capabilities || [],
    tags: tags || [],
    version: '1.0.0',
    createdBy: createdBy || 'system'
  };
}

// Helper functions for simple authentication
export function generateAgentFingerprint(name: string, workspacePath?: string): string {
  return `${name}@${workspacePath ? getProjectName(workspacePath) : 'localhost'}`;
}

export function authenticateAgent(agent: Agent, username: string, password: string): boolean {
  if (!agent.credentials) return false;
  if (agent.credentials.username !== username) return false;
  
  const passwordHash = createHash('sha256')
    .update(`${password}:${agent.credentials.salt}`)
    .digest('hex');
  
  return passwordHash === agent.credentials.passwordHash;
}

export function getAgentIdentifier(agent: Agent): string {
  return `${agent.name} (${agent.id})`;
}

export function getAgentShortId(agent: Agent): string {
  return agent.id.split('-')[2]; // Last part of the ID
}

export function createMessage(
  conversationId: string,
  fromAgent: string,
  toAgent: string,
  subject: string,
  content: string,
  priority: MessagePriority = MessagePriority.NORMAL,
  replyTo?: string,
  expiresInHours?: number,
  requiresReply: boolean = true,
  metadata?: Record<string, any>
): Message {
  // Input validation
  if (!validateMessageSubject(subject)) {
    throw new Error('Invalid message subject. Must be a non-empty string up to 500 characters.');
  }
  
  if (!validateMessageContent(content)) {
    throw new Error('Invalid message content. Must be a non-empty string up to 10,000 characters.');
  }
  
  if (!validateAgentId(fromAgent) || !validateAgentId(toAgent)) {
    throw new Error('Invalid agent ID provided.');
  }
  
  if (conversationId.length === 0 || conversationId.length > 100) {
    throw new Error('Invalid conversation ID. Must be 1-100 characters.');
  }
  
  // Sanitize inputs
  const sanitizedSubject = sanitizeString(subject);
  const sanitizedContent = sanitizeString(content);
  
  const id = uuidv4();
  const createdAt = new Date();
  const expiresAt = expiresInHours ? new Date(createdAt.getTime() + expiresInHours * 60 * 60 * 1000) : undefined;

  return {
    id,
    conversationId,
    fromAgent,
    toAgent,
    subject: sanitizedSubject,
    content: sanitizedContent,
    state: MessageState.SENT,
    priority,
    expiresAt,
    replyTo,
    createdAt,
    isRead: false,
    requiresReply,
    metadata: metadata || {}
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

// Input validation utilities
export function validateAgentId(agentId: string): boolean {
  return typeof agentId === 'string' && agentId.length > 0 && agentId.length <= 100;
}

export function validateWorkspacePath(path: string): boolean {
  return typeof path === 'string' && path.startsWith('/') && path.length <= 500;
}

export function validateAgentName(name: string): boolean {
  return typeof name === 'string' && name.length > 0 && name.length <= 200;
}

export function sanitizeString(input: string): string {
  return input.trim().replace(/[<>]/g, ''); // Basic XSS prevention
}

export function validateEmail(email?: string): boolean {
  if (!email) return true; // Optional field
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateMessageContent(content: string): boolean {
  return typeof content === 'string' && content.length > 0 && content.length <= 10000;
}

export function validateMessageSubject(subject: string): boolean {
  return typeof subject === 'string' && subject.length > 0 && subject.length <= 500;
}
