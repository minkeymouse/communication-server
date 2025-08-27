/**
 * Simplified Message Repository
 * Handles message database operations using query builder
 */

import Database from 'better-sqlite3';
import { Message, MessageState, MessagePriority } from '../../../domain/agents/models.js';
import { QueryBuilder } from './query-builder.js';

export class MessageRepository {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public createMessage(message: Message): string {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO messages 
        (id, conversation_id, from_agent_id, to_agent_id, subject, content, state, priority, 
         expires_at, reply_to, created_at, read_at, replied_at, archived_at, is_read, requires_reply,
         from_agent_name, from_agent_role, to_agent_name, to_agent_role,
         routing_type, security_level, signature, metadata,
         from_agent, to_agent, from_agent_workspace, to_agent_workspace)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        message.id,
        message.conversationId,
        message.fromAgent,
        message.toAgent,
        message.subject,
        message.content,
        message.state,
        message.priority,
        message.expiresAt ? message.expiresAt.toISOString() : null,
        message.replyTo || null,
        message.createdAt.toISOString(),
        message.readAt ? message.readAt.toISOString() : null,
        message.repliedAt ? message.repliedAt.toISOString() : null,
        message.archivedAt ? message.archivedAt.toISOString() : null,
        message.isRead ? 1 : 0,
        message.requiresReply ? 1 : 0,
        message.fromAgentName || null,
        message.fromAgentRole || null,
        message.toAgentName || null,
        message.toAgentRole || null,
        message.routingType || 'direct',
        message.securityLevel || 'basic',
        message.signature || null,
        JSON.stringify(message.metadata || {}),
        message.fromAgent,
        message.toAgent,
        message.fromAgentWorkspace || null,
        message.toAgentWorkspace || null
      );

      return message.id;
    } catch (error) {
      console.error('Error creating message:', error);
      throw error;
    }
  }

  public getMessage(messageId: string): Message | null {
    try {
      const stmt = this.db.prepare('SELECT * FROM messages WHERE id = ?');
      const row = stmt.get(messageId) as any;

      if (!row) return null;

      return this.mapRowToMessage(row);
    } catch (error) {
      console.error('Error getting message:', error);
      return null;
    }
  }

  public getMessagesForAgent(agentId: string, limit: number = 50): Message[] {
    try {
      const { query, params } = QueryBuilder.buildMessageSearchQuery({
        toAgentId: agentId,
        limit
      });
      
      const stmt = this.db.prepare(query);
      const rows = stmt.all(...params) as any[];

      return rows.map(row => this.mapRowToMessage(row));
    } catch (error) {
      console.error('Error getting messages for agent:', error);
      return [];
    }
  }

  public getMessagesFromAgent(agentId: string, limit: number = 50): Message[] {
    try {
      const { query, params } = QueryBuilder.buildMessageSearchQuery({
        fromAgentId: agentId,
        limit
      });
      
      const stmt = this.db.prepare(query);
      const rows = stmt.all(...params) as any[];

      return rows.map(row => this.mapRowToMessage(row));
    } catch (error) {
      console.error('Error getting messages from agent:', error);
      return [];
    }
  }

  public searchMessages(filters: {
    fromAgentId?: string;
    toAgentId?: string;
    state?: string;
    priority?: string;
    subject?: string;
    limit?: number;
    offset?: number;
  }): Message[] {
    try {
      const { query, params } = QueryBuilder.buildMessageSearchQuery(filters);
      const stmt = this.db.prepare(query);
      const rows = stmt.all(...params) as any[];

      return rows.map(row => this.mapRowToMessage(row));
    } catch (error) {
      console.error('Error searching messages:', error);
      return [];
    }
  }

  public updateMessageState(messageId: string, state: MessageState): boolean {
    try {
      const stmt = this.db.prepare('UPDATE messages SET state = ? WHERE id = ?');
      const result = stmt.run(state, messageId);
      return result.changes > 0;
    } catch (error) {
      console.error('Error updating message state:', error);
      return false;
    }
  }

  public markMessageAsRead(messageId: string): boolean {
    try {
      const stmt = this.db.prepare(`
        UPDATE messages 
        SET is_read = 1, read_at = ?, state = 'read' 
        WHERE id = ?
      `);
      const result = stmt.run(new Date().toISOString(), messageId);
      return result.changes > 0;
    } catch (error) {
      console.error('Error marking message as read:', error);
      return false;
    }
  }

  public markMessageAsReplied(messageId: string): boolean {
    try {
      const stmt = this.db.prepare(`
        UPDATE messages 
        SET replied_at = ?, state = 'replied' 
        WHERE id = ?
      `);
      const result = stmt.run(new Date().toISOString(), messageId);
      return result.changes > 0;
    } catch (error) {
      console.error('Error marking message as replied:', error);
      return false;
    }
  }

  public deleteMessages(agentId: string, messageIds?: string[]): number {
    try {
      if (messageIds && messageIds.length > 0) {
        const placeholders = messageIds.map(() => '?').join(',');
        const stmt = this.db.prepare(`
          DELETE FROM messages 
          WHERE to_agent_id = ? AND id IN (${placeholders})
        `);
        const result = stmt.run(agentId, ...messageIds);
        return result.changes;
      } else {
        const stmt = this.db.prepare('DELETE FROM messages WHERE to_agent_id = ?');
        const result = stmt.run(agentId);
        return result.changes;
      }
    } catch (error) {
      console.error('Error deleting messages:', error);
      return 0;
    }
  }

  public getMessageCountForAgent(agentId: string): number {
    try {
      const stmt = this.db.prepare('SELECT COUNT(*) as count FROM messages WHERE to_agent_id = ?');
      const result = stmt.get(agentId) as any;
      return result ? result.count : 0;
    } catch (error) {
      console.error('Error getting message count:', error);
      return 0;
    }
  }

  public getMessageStatistics(): any {
    try {
      const query = QueryBuilder.buildStatisticsQuery('messages');
      const stmt = this.db.prepare(query);
      const result = stmt.get() as any;
      return result || {};
    } catch (error) {
      console.error('Error getting message statistics:', error);
      return {};
    }
  }

  private mapRowToMessage(row: any): Message {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      fromAgent: row.from_agent_id,
      toAgent: row.to_agent_id,
      subject: row.subject,
      content: row.content,
      state: row.state as MessageState,
      priority: row.priority as MessagePriority,
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      replyTo: row.reply_to || undefined,
      createdAt: new Date(row.created_at),
      readAt: row.read_at ? new Date(row.read_at) : undefined,
      repliedAt: row.replied_at ? new Date(row.replied_at) : undefined,
      archivedAt: row.archived_at ? new Date(row.archived_at) : undefined,
      isRead: Boolean(row.is_read),
      requiresReply: Boolean(row.requires_reply),
      fromAgentName: row.from_agent_name,
      fromAgentRole: row.from_agent_role,
      toAgentName: row.to_agent_name,
      toAgentRole: row.to_agent_role,
      routingType: row.routing_type,
      securityLevel: row.security_level,
      signature: row.signature,
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      fromAgentWorkspace: row.from_agent_workspace,
      toAgentWorkspace: row.to_agent_workspace
    };
  }
}
