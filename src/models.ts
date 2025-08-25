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

// Enhanced agent identification protocol
export interface AgentIdentity {
  identityHash: string;        // Unique hash based on workspace + name + creation time
  publicKey: string;           // Public identifier for verification
  signature: string;           // Cryptographic signature for authentication
  fingerprint: string;         // Human-readable fingerprint for verification
}

export interface AgentCredentials {
  username: string;            // Unique username for login
  passwordHash: string;        // Hashed password for authentication
  salt: string;                // Salt for password hashing
  lastLogin?: Date;            // Last successful login
  loginAttempts: number;       // Failed login attempts
  lockedUntil?: Date;          // Account lockout until
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
  
  // Enhanced identification
  identity: AgentIdentity;
  credentials?: AgentCredentials;
  
  // Additional metadata for better identification
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
  email?: string,
  address?: string,
  username?: string,
  password?: string,
  description?: string,
  capabilities?: string[],
  tags?: string[],
  createdBy?: string
): Agent {
  const workspaceHash = workspacePath ? Math.abs(workspacePath.hashCode()) % 10000 : 0;
  const nameHash = Math.abs(name.hashCode()) % 1000;
  const agentId = `${workspaceHash.toString().padStart(4, '0')}-${nameHash.toString().padStart(3, '0')}-${uuidv4().slice(0, 8)}`;
  
  // Generate unique identity hash
  const identityData = `${workspacePath || 'unknown'}:${name}:${Date.now()}`;
  const identityHash = createHash('sha256').update(identityData).digest('hex').slice(0, 16);
  
  // Generate public key and signature
  const publicKey = uuidv4();
  const signature = createHash('sha256').update(`${identityHash}:${publicKey}`).digest('hex').slice(0, 16);
  
  // Generate fingerprint
  const fingerprint = `${name}@${workspacePath ? getProjectName(workspacePath) : 'localhost'}`;
  
  // Create credentials if username/password provided
  let credentials: AgentCredentials | undefined;
  if (username && password) {
    const salt = uuidv4();
    const passwordHash = createHash('sha256').update(`${password}:${salt}`).digest('hex');
    credentials = {
      username,
      passwordHash,
      salt,
      loginAttempts: 0
    };
  }
  
  return {
    id: agentId,
    name,
    apiKey: uuidv4(),
    email,
    role,
    workspacePath,
    address,
    createdAt: new Date(),
    isActive: true,
    identity: {
      identityHash,
      publicKey,
      signature,
      fingerprint
    },
    credentials,
    displayName: `${name} (${workspacePath ? getProjectName(workspacePath) : 'unknown'})`,
    description: description || `Agent for workspace: ${workspacePath || 'unknown'}`,
    capabilities: capabilities || [],
    tags: tags || [],
    version: VERSION,
    createdBy
  };
}

// Helper functions for agent identification
export function generateAgentFingerprint(name: string, workspacePath?: string): string {
  return `${name}@${workspacePath ? getProjectName(workspacePath) : 'localhost'}`;
}

export function verifyAgentIdentity(agent: Agent, providedSignature?: string): boolean {
  if (!providedSignature) return false;
  
  const expectedSignature = createHash('sha256')
    .update(`${agent.identity.identityHash}:${agent.identity.publicKey}`)
    .digest('hex')
    .slice(0, 16);
  
  return providedSignature === expectedSignature;
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
  return `${agent.identity.fingerprint} (${agent.id})`;
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
