/**
 * Communication Handler
 * Handles message sending, receiving, and management operations
 */

import { DatabaseManager } from '../../infrastructure/database/database-manager.js';
import { MessageQueue } from '../../services/communication/message-queue.js';
import { ConversationThreadManager, AgentMonitor } from '../../services/index.js';
import { SecurityManager } from '../../infrastructure/security/security.js';
import { AnalyticsManager } from '../../infrastructure/analytics/analytics.js';
import { RateLimiter } from '../../infrastructure/analytics/rate-limiter.js';
import { 
  Agent, 
  MessageState, 
  MessagePriority,
  createMessage,
  getAgentIdentifier
} from '../../domain/agents/models.js';
import { v4 as uuidv4 } from 'uuid';

export class CommunicationHandler {
  constructor(
    private db: DatabaseManager,
    private messageQueue: MessageQueue,
    private threadManager: ConversationThreadManager,
    private agentMonitor: AgentMonitor,
    private securityManager: SecurityManager,
    private analyticsManager: AnalyticsManager,
    private rateLimiter: RateLimiter
  ) {}

  async handleCommunicate(args: any): Promise<any> {
    const { action, session_token, to_agent, from_agent, message_id, title, content, priority = 'normal', security_level = 'basic', limit = 50 } = args;
    
    if (!action) {
      throw new Error('action is required');
    }

    switch (action) {
      case 'send':
        return await this.handleSend({ session_token, to_agent_id: to_agent, from_agent_id: from_agent, title, content, priority, security_level });
      
      case 'receive':
        return await this.handleReceive({ agent_id: from_agent || args.agent_id, session_token, limit });
      
      case 'reply':
        if (!message_id) throw new Error('message_id is required for reply action');
        const originalMessage = this.db.getMessage(message_id);
        if (!originalMessage) throw new Error(`Original message ${message_id} not found`);
        return await this.handleSend({ 
          session_token, 
          to_agent_id: originalMessage.fromAgent, 
          from_agent_id: from_agent, 
          title: `Re: ${title || originalMessage.subject}`, 
          content, 
          priority, 
          security_level 
        });
      
      case 'mark_read':
        if (!message_id) throw new Error('message_id is required for mark_read action');
        return await this.handleMarkRead(message_id);
      
      case 'mark_replied':
        if (!message_id) throw new Error('message_id is required for mark_replied action');
        return await this.handleMarkReplied(message_id);
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  private async handleSend(args: any): Promise<any> {
    const startTime = Date.now();
    
    try {
      const { session_token, to_agent_id, from_agent_id, title, content, priority = 'normal', security_level = 'basic' } = args;
      
      if (!title) {
        throw new Error('title is required for sending messages');
      }
      if (!content) {
        throw new Error('content is required for sending messages');
      }
      if (title.length > 500) {
        throw new Error('title must be 500 characters or less');
      }
      if (content.length > 10000) {
        throw new Error('content must be 10000 characters or less');
      }

      let sender: Agent;
      if (session_token) {
        const session = this.db.getSession(session_token);
        if (!session) {
          throw new Error('Invalid session token');
        }
        if (!session.isActive) {
          throw new Error('Session is not active');
        }
        if (session.expiresAt < new Date()) {
          throw new Error('Session has expired');
        }
        const foundSender = this.db.getAgent(session.agentId);
        if (!foundSender) {
          throw new Error('Session agent not found in database');
        }
        sender = foundSender;
      } else if (from_agent_id) {
        const foundSender = this.db.getAgent(from_agent_id);
        if (!foundSender) {
          throw new Error(`Agent '${from_agent_id}' not found`);
        }
        sender = foundSender;
      } else {
        throw new Error('Either session_token or from_agent_id is required');
      }

      const recipientId = to_agent_id;
      if (!recipientId) {
        throw new Error('Recipient agent ID is required (to_agent_id or to_agent)');
      }

      // Enhanced validation: Check for ghost agents and self-interactions
      const interactionValidation = this.agentMonitor.validateAgentInteraction(sender.id, recipientId);
      if (!interactionValidation.isValid) {
        throw new Error(`Invalid interaction: ${interactionValidation.reason}`);
      }

      const recipient = this.db.getAgent(recipientId);
      if (!recipient) {
        throw new Error(`Recipient agent '${recipientId}' not found`);
      }

      // Enhanced validation: Check agent identity consistency
      const senderStatus = this.agentMonitor.getAgentStatus(sender.id);
      if (senderStatus && senderStatus.roleConsistency && senderStatus.roleConsistency < 0.5) {
        console.warn(`Agent ${sender.id} showing identity drift (consistency: ${senderStatus.roleConsistency})`);
        // Continue but log the warning
      }

      // Check rate limiting
      const rateLimitCheck = this.rateLimiter.isAllowed(sender.id, 'message_send');
      if (!rateLimitCheck.allowed) {
        throw new Error(`Rate limit exceeded. Retry after ${Math.ceil((rateLimitCheck.info.retryAfter || 0) / 1000)} seconds`);
      }

      // Record agent activity with enhanced context
      this.agentMonitor.recordActivity(sender.id);
      this.agentMonitor.recordActivity(recipient.id);
      
      // Record conversation context for coherence tracking
      this.agentMonitor.recordConversationContext(sender.id, {
        action: 'send_message',
        recipient: recipientId,
        subject: title,
        contentLength: content.length,
        priority,
        securityLevel: security_level
      });

      // Generate security keys if needed
      if (security_level === 'signed' || security_level === 'encrypted') {
        if (!this.securityManager.hasValidKeys(sender.id)) {
          this.securityManager.generateAgentKeys(sender.id);
        }
        if (!this.securityManager.hasValidKeys(recipient.id)) {
          this.securityManager.generateAgentKeys(recipient.id);
        }
      }

      // Encrypt content if needed
      let encryptedContent = content;
      if (security_level !== 'none') {
        const encrypted = this.securityManager.encryptMessage(
          content,
          sender.credentials?.agentId || sender.id,
          recipient.credentials?.agentId || recipient.id,
          security_level
        );
        encryptedContent = typeof encrypted === 'string' ? encrypted : JSON.stringify(encrypted);
      }

      // Create message
      const messageId = uuidv4();
      const message = createMessage(
        uuidv4(), // conversation ID
        sender.credentials?.agentId || sender.id,
        recipient.credentials?.agentId || recipient.id,
        title,
        encryptedContent,
        priority as MessagePriority
      );

      // Add to conversation thread with enhanced context tracking
      const threadId = this.threadManager.findOrCreateThread(
        [sender.credentials?.agentId || sender.id, recipient.credentials?.agentId || recipient.id],
        title,
        priority as 'high' | 'normal' | 'low'
      );

      // Add message to thread with enhanced tracking
      const threadMessage = {
        messageId: message.id,
        fromAgentId: sender.credentials?.agentId || sender.id,
        toAgentId: recipient.credentials?.agentId || recipient.id,
        content: encryptedContent,
        subject: title,
        timestamp: message.createdAt,
        state: 'sent' as const,
        priority: priority as 'high' | 'normal' | 'low',
        threadId: threadId
      };

      const messageAdded = this.threadManager.addMessageToThread(threadId, threadMessage);
      if (!messageAdded) {
        throw new Error('Failed to add message to conversation thread');
      }

      // Enqueue message for delivery
      const queueId = this.messageQueue.enqueue({
        fromAgentId: sender.credentials?.agentId || sender.id,
        toAgentId: recipient.credentials?.agentId || recipient.id,
        content: encryptedContent,
        subject: title,
        priority: priority as 'high' | 'normal' | 'low',
        maxRetries: 3
      });

      // Record analytics with enhanced metrics
      this.analyticsManager.recordMessage(
        message.id,
        sender.credentials?.agentId || sender.id,
        recipient.credentials?.agentId || recipient.id,
        priority,
        security_level,
        content
      );

      // Store in database
      this.db.createMessage(message);
      this.db.updateAgentLastSeen(sender.id);

      // Create human-readable message log for oversight
      const messageLogId = uuidv4();
      this.db.createMessageLog({
        id: messageLogId,
        messageId: message.id,
        conversationId: message.conversationId,
        fromAgentId: sender.credentials?.agentId || sender.id,
        toAgentId: recipient.credentials?.agentId || recipient.id,
        fromAgentName: sender.name,
        toAgentName: recipient.name,
        subject: title,
        contentPlain: content, // Store plain text for human querying
        contentEncrypted: encryptedContent,
        priority: priority,
        securityLevel: security_level,
        state: 'sent',
        createdAt: message.createdAt,
        threadId: threadId,
        metadata: {
          queueId: queueId,
          executionTime: Date.now() - startTime,
          securityLevel: security_level,
          encrypted: security_level !== 'none',
          // Enhanced metadata
          senderIdentityHash: senderStatus?.identityHash,
          senderRoleConsistency: senderStatus?.roleConsistency,
          interactionValidation: interactionValidation,
          threadContextHash: this.threadManager.getThread(threadId)?.contextHash
        }
      });

      // Mark agents as online
      this.agentMonitor.markAgentOnline(sender.id, session_token);
      this.agentMonitor.markAgentOnline(recipient.id);

      // Record successful rate limit usage
      this.rateLimiter.recordSuccess(sender.id, 'message_send');

      const executionTime = Date.now() - startTime;
      
      return {
        message_id: message.id,
        from_agent_id: sender.id,
        to_agent_id: recipient.id,
        subject: title,
        status: 'sent',
        created_at: message.createdAt.toISOString(),
        thread_id: threadId,
        queue_id: queueId,
        security_level,
        encrypted: security_level !== 'none',
        execution_time_ms: executionTime,
        // Enhanced response data
        validation: {
          interaction_valid: interactionValidation.isValid,
          sender_identity_consistent: senderStatus?.roleConsistency || 1.0,
          thread_coherence: this.threadManager.getThread(threadId)?.conversationCoherence || 1.0
        }
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      console.error(`Failed to send message (${executionTime}ms):`, error);
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }

  private async handleReceive(args: any): Promise<any> {
    const startTime = Date.now();
    const { limit = 50, agent_id, session_token } = args;
    
    if (!agent_id) {
      throw new Error('agent_id is required for checking mailbox');
    }
    if (limit < 1 || limit > 500) {
      throw new Error('limit must be between 1 and 500');
    }

    let sender: Agent;
    
    // Validate session if provided
    if (session_token) {
      const session = this.db.getSession(session_token);
      if (!session) {
        throw new Error('Invalid session token');
      }
      if (!session.isActive) {
        throw new Error('Session is not active');
      }
      if (session.expiresAt < new Date()) {
        throw new Error('Session has expired');
      }
      if (session.agentId !== agent_id) {
        throw new Error('Session token does not match agent_id');
      }
    }
    
    const foundSender = this.db.getAgent(agent_id);
    if (!foundSender) {
      throw new Error(`Agent '${agent_id}' not found`);
    }
    sender = foundSender;
    
    // Update agent's last seen timestamp
    this.db.updateAgentLastSeen(sender.id);
    
    // Get messages with limit and check total count efficiently
    const messages = this.db.getMessagesForAgent(sender.id, limit);
    const totalMessages = this.db.getMessageCountForAgent(sender.id);
    const hasMore = totalMessages > limit;
    
    const result = messages.map((msg: any) => {
      const fromAgent = this.db.getAgent(msg.fromAgent);
      const toAgent = this.db.getAgent(msg.toAgent);
      
      return {
        id: msg.id,
        from_agent: fromAgent ? fromAgent.name : 'Unknown',
        from_address: fromAgent ? getAgentIdentifier(fromAgent) : 'Unknown',
        to_agent: toAgent ? toAgent.name : 'Unknown',
        to_address: toAgent ? getAgentIdentifier(toAgent) : 'Unknown',
        subject: msg.subject,
        content: msg.content.length > 100 ? msg.content.substring(0, 100) + '...' : msg.content,
        created_at: msg.createdAt.toISOString(),
        state: msg.state,
        is_read: msg.isRead
      };
    });
    
    const executionTime = Date.now() - startTime;
    
    return {
      messages: result,
      total_count: totalMessages,
      has_more: hasMore,
      agent_id: sender.id,
      agent_name: sender.name,
      execution_time_ms: executionTime
    };
  }

  private async handleMarkRead(messageId: string): Promise<any> {
    const success = this.db.markMessageAsRead(messageId);
    
    return {
      message_id: messageId,
      new_state: 'read',
      success: success
    };
  }

  private async handleMarkReplied(messageId: string): Promise<any> {
    const success = this.db.markMessageAsReplied(messageId);
    
    return {
      message_id: messageId,
      new_state: 'replied',
      success: success
    };
  }
}
