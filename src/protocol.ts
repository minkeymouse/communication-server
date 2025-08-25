/**
 * Agent Communication Protocol
 * Defines standards for agent identification, authentication, and communication
 */

export interface AgentIdentity {
  id: string;                    // Unique agent identifier
  name: string;                  // Human-readable name
  displayName?: string;          // Optional display name
  role: AgentRole;               // Agent role in the system
  capabilities: string[];        // Agent capabilities
  tags: string[];                // Agent tags for categorization
  version: string;               // Agent version
  signature: string;             // Cryptographic signature for verification
  publicKey?: string;            // Public key for secure communication
  metadata?: Record<string, any>; // Additional metadata
}

export interface AgentCredentials {
  username: string;
  passwordHash: string;
  salt: string;
  loginAttempts: number;
  lockedUntil?: Date;
}

export interface AgentSession {
  agentId: string;
  sessionId: string;
  authenticated: boolean;
  lastActivity: Date;
  permissions: string[];
}

export interface MessageProtocol {
  id: string;
  conversationId: string;
  fromAgentId: string;           // Use agent ID instead of workspace
  toAgentId: string;             // Use agent ID instead of workspace
  subject: string;
  content: string;
  priority: MessagePriority;
  state: MessageState;
  requiresReply: boolean;
  replyTo?: string;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export enum AgentRole {
  GENERAL = 'general',
  DEVELOPER = 'developer',
  MANAGER = 'manager',
  ANALYST = 'analyst',
  TESTER = 'tester',
  DESIGNER = 'designer',
  COORDINATOR = 'coordinator',
  SUPERVISOR = 'supervisor',
  SPECIALIST = 'specialist'
}

export enum MessagePriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum MessageState {
  SENT = 'sent',
  ARRIVED = 'arrived',
  READ = 'read',
  REPLIED = 'replied',
  IGNORED = 'ignored',
  UNREAD = 'unread'
}

export interface AgentRegistry {
  registerAgent(identity: AgentIdentity, credentials?: AgentCredentials): Promise<boolean>;
  authenticateAgent(agentId: string, username: string, password: string): Promise<boolean>;
  getAgent(agentId: string): AgentIdentity | null;
  listAgents(filter?: AgentFilter): AgentIdentity[];
  updateAgent(agentId: string, updates: Partial<AgentIdentity>): Promise<boolean>;
  deleteAgent(agentId: string, requesterId: string): Promise<boolean>;
  verifyAgentSignature(agentId: string, signature: string): Promise<boolean>;
}

export interface AgentFilter {
  role?: AgentRole;
  capabilities?: string[];
  tags?: string[];
  active?: boolean;
}

export interface CommunicationProtocol {
  sendMessage(message: MessageProtocol): Promise<string>;
  receiveMessages(agentId: string, limit?: number): MessageProtocol[];
  markMessageRead(messageId: string, agentId: string): Promise<boolean>;
  replyToMessage(messageId: string, reply: MessageProtocol): Promise<string>;
  deleteMessage(messageId: string, agentId: string): Promise<boolean>;
  searchMessages(agentId: string, query: string): MessageProtocol[];
}

export interface AgentDiscovery {
  discoverAgents(criteria?: AgentFilter): AgentIdentity[];
  getAgentStatus(agentId: string): 'online' | 'offline' | 'busy' | 'away';
  pingAgent(agentId: string): Promise<boolean>;
  getAgentCapabilities(agentId: string): string[];
}

// Protocol constants
export const PROTOCOL_VERSION = '1.0.0';
export const MAX_MESSAGE_SIZE = 10000;
export const MAX_AGENT_NAME_LENGTH = 200;
export const MAX_AGENT_ID_LENGTH = 100;
export const SESSION_TIMEOUT_MINUTES = 30;
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MINUTES = 15;

// Agent identification patterns
export const AGENT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
export const AGENT_NAME_PATTERN = /^[a-zA-Z0-9\s_-]+$/;

// Message routing rules
export const ROUTING_RULES = {
  DIRECT: 'direct',           // Direct agent-to-agent
  BROADCAST: 'broadcast',     // Send to all agents
  ROLE_BASED: 'role_based',   // Send to agents with specific role
  CAPABILITY_BASED: 'capability_based', // Send to agents with specific capabilities
  TAG_BASED: 'tag_based'      // Send to agents with specific tags
};

// Security protocols
export const SECURITY_LEVELS = {
  NONE: 'none',
  BASIC: 'basic',      // Username/password
  SIGNED: 'signed',    // Cryptographic signatures
  ENCRYPTED: 'encrypted' // End-to-end encryption
};
