/**
 * Domain Factory Functions
 * Centralized location for all domain factory functions
 */

import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { Agent, Message, Conversation } from './interfaces.js';
import { AgentRole, MessagePriority } from './enums.js';

export const VERSION = "2.1.0";

export function createAgent(
  name: string,
  workspacePath?: string,
  role: AgentRole = AgentRole.GENERAL,
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
    role,
    workspacePath,
    address: workspacePath,
    createdAt,
    isActive: true,
    credentials: {
      agentId: agentId || id,
      loginAttempts: 0
    },
    displayName: sanitizedName,
    description: sanitizedDescription,
    capabilities: capabilities || [],
    tags: tags || [],
    version: '1.0.0',
    createdBy: createdBy || 'system'
  };
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
    state: 'sent' as any,
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
    subject: sanitizeString(subject),
    participants: participants.filter(p => validateAgentId(p)),
    createdBy,
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    messageCount: 0
  };
}

// Helper functions for simple authentication
export function generateAgentFingerprint(name: string, workspacePath?: string): string {
  return `${name}@${workspacePath ? getProjectName(workspacePath) : 'localhost'}`;
}

export function authenticateAgent(agent: Agent, agentId: string): boolean {
  if (!agent.credentials) return false;
  if (agent.credentials.agentId !== agentId) return false;
  
  // Check if account is locked due to too many failed attempts
  if (agent.credentials.lockedUntil && new Date() < agent.credentials.lockedUntil) {
    return false;
  }
  
  return true;
}

export function getAgentIdentifier(agent: Agent): string {
  return `${agent.name} (${agent.id})`;
}

export function getAgentShortId(agent: Agent): string {
  return agent.id.split('-')[2]; // Last part of the ID
}

// Message templates for common use cases
export const MessageTemplates = {
  BUG_REPORT: {
    title: 'Bug Report',
    content: '**Bug Description:**\n\n**Steps to Reproduce:**\n1. \n2. \n3. \n\n**Expected Behavior:**\n\n**Actual Behavior:**\n\n**Environment:**\n- System: \n- Version: \n\n**Additional Information:**'
  },
  FEATURE_REQUEST: {
    title: 'Feature Request',
    content: '**Feature Description:**\n\n**Use Case:**\n\n**Proposed Implementation:**\n\n**Benefits:**\n\n**Priority:** (Low/Medium/High)\n\n**Additional Information:**'
  },
  STATUS_UPDATE: {
    title: 'Status Update',
    content: '**Current Status:**\n\n**Progress Made:**\n\n**Next Steps:**\n\n**Blockers:**\n\n**Timeline:**\n\n**Additional Notes:**'
  }
};

// Validation functions
function validateAgentName(name: string): boolean {
  return Boolean(name && name.length > 0 && name.length <= 200);
}

function validateWorkspacePath(path: string): boolean {
  return Boolean(path && path.startsWith('/') && path.length <= 500);
}

function validateAgentId(id: string): boolean {
  return Boolean(id && id.length > 0 && id.length <= 100);
}

function validateMessageSubject(subject: string): boolean {
  return Boolean(subject && subject.length > 0 && subject.length <= 500);
}

function validateMessageContent(content: string): boolean {
  return Boolean(content && content.length > 0 && content.length <= 10000);
}

function sanitizeString(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}

function getProjectName(workspacePath: string): string {
  return workspacePath.split('/').pop() || 'unknown';
}
