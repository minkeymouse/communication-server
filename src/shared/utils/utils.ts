/**
 * Utility functions for the communication server
 */

import { Agent, Message, MessagePriority, MessageState } from '../../domain/agents/models.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create a message object
 */
export function createMessage(
  conversationId: string,
  fromAgentId: string,
  toAgentId: string,
  subject: string,
  content: string,
  priority: MessagePriority = MessagePriority.NORMAL
): Message {
  return {
    id: uuidv4(),
    conversationId,
    fromAgent: fromAgentId,
    toAgent: toAgentId,
    subject,
    content,
    state: 'sent' as MessageState,
    priority,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    replyTo: undefined,
    isRead: false,
    requiresReply: false
  };
}

/**
 * Get agent identifier for display
 */
export function getAgentIdentifier(agent: Agent): string {
  return agent.credentials?.agentId || agent.id;
}

/**
 * Authenticate agent
 */
export function authenticateAgent(agent: Agent, agentId: string): boolean {
  // Simple ID-based authentication
  return agent.id === agentId || agent.credentials?.agentId === agentId;
}

/**
 * Validate session token
 */
export function validateSession(session: any): boolean {
  if (!session) return false;
  if (!session.isActive) return false;
  if (session.expiresAt < new Date()) return false;
  return true;
}

/**
 * Parse time range to start date
 */
export function parseTimeRange(timeRange: string): Date {
  const now = new Date();
  
  switch (timeRange) {
    case '1h':
      return new Date(now.getTime() - 60 * 60 * 1000);
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
}

/**
 * Format message for response
 */
export function formatMessage(msg: Message, fromAgent?: Agent, toAgent?: Agent) {
  return {
    id: msg.id,
    from_agent: fromAgent ? fromAgent.name : 'Unknown',
    from_address: fromAgent ? getAgentIdentifier(fromAgent) : 'Unknown',
    to_agent: toAgent ? toAgent.name : 'Unknown',
    to_address: toAgent ? getAgentIdentifier(toAgent) : 'Unknown',
    subject: msg.subject,
    content: msg.content,
    state: msg.state,
    priority: msg.priority,
    created_at: msg.createdAt.toISOString(),
    expires_at: msg.expiresAt?.toISOString(),
    reply_to: msg.replyTo,
    metadata: msg.metadata
  };
}

/**
 * Sanitize input string to prevent injection attacks
 */
export function sanitizeInput(input: string, maxLength: number = 1000): string {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }
  
  // Remove null bytes and control characters
  let sanitized = input.replace(/[\x00-\x1F\x7F]/g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized;
}

/**
 * Validate agent ID format
 */
export function validateAgentId(agentId: string): boolean {
  if (typeof agentId !== 'string') return false;
  if (agentId.length === 0 || agentId.length > 100) return false;
  
  // Allow alphanumeric, hyphens, underscores, and dots
  const validPattern = /^[a-zA-Z0-9._-]+$/;
  return validPattern.test(agentId);
}

/**
 * Validate workspace path
 */
export function validateWorkspacePath(path: string): boolean {
  if (typeof path !== 'string') return false;
  if (path.length === 0 || path.length > 500) return false;
  
  // Must start with / and contain valid characters
  const validPattern = /^\/[a-zA-Z0-9._\/-]+$/;
  return validPattern.test(path);
}

/**
 * Validate email format (if provided)
 */
export function validateEmail(email: string): boolean {
  if (!email) return true; // Email is optional
  
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
}

/**
 * Generate a secure random string
 */
export function generateSecureString(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Validate priority level
 */
export function validatePriority(priority: string): boolean {
  const validPriorities = ['low', 'normal', 'high', 'urgent'];
  return validPriorities.includes(priority);
}

/**
 * Validate security level
 */
export function validateSecurityLevel(level: string): boolean {
  const validLevels = ['none', 'basic', 'signed', 'encrypted'];
  return validLevels.includes(level);
}

/**
 * Format bytes to human readable format
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Calculate execution time in milliseconds
 */
export function calculateExecutionTime(startTime: number): number {
  return Date.now() - startTime;
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(error: Error, executionTime?: number): any {
  return {
    error: error.message,
    timestamp: new Date().toISOString(),
    ...(executionTime && { execution_time_ms: executionTime })
  };
}

/**
 * Create a standardized success response
 */
export function createSuccessResponse(data: any, executionTime?: number): any {
  return {
    ...data,
    timestamp: new Date().toISOString(),
    ...(executionTime && { execution_time_ms: executionTime })
  };
}
