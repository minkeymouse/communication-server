/**
 * Message Log Repository
 * Handles human-readable message logs for oversight and querying
 */

import Database from 'better-sqlite3';

export interface MessageLog {
  id: string;
  messageId: string;
  conversationId: string;
  fromAgentId: string;
  toAgentId: string;
  fromAgentName: string;
  toAgentName: string;
  subject: string;
  contentPlain: string;
  contentEncrypted: string;
  priority: string;
  securityLevel: string;
  state: string;
  createdAt: Date;
  readAt?: Date;
  repliedAt?: Date;
  threadId?: string;
  metadata?: Record<string, any>;
}

export class MessageLogRepository {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public createMessageLog(log: MessageLog): string {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO message_logs 
        (id, message_id, conversation_id, from_agent_id, to_agent_id, 
         from_agent_name, to_agent_name, subject, content_plain, content_encrypted,
         priority, security_level, state, created_at, read_at, replied_at, 
         thread_id, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        log.id,
        log.messageId,
        log.conversationId,
        log.fromAgentId,
        log.toAgentId,
        log.fromAgentName,
        log.toAgentName,
        log.subject,
        log.contentPlain,
        log.contentEncrypted,
        log.priority,
        log.securityLevel,
        log.state,
        log.createdAt.toISOString(),
        log.readAt?.toISOString() || null,
        log.repliedAt?.toISOString() || null,
        log.threadId || null,
        JSON.stringify(log.metadata || {})
      );

      return log.id;
    } catch (error) {
      console.error('Error creating message log:', error);
      throw error;
    }
  }

  public getMessageLogsByAgent(agentId: string, limit: number = 100): MessageLog[] {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM message_logs 
        WHERE from_agent_id = ? OR to_agent_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `);
      
      const rows = stmt.all(agentId, agentId, limit) as any[];
      return rows.map(row => this.mapRowToMessageLog(row));
    } catch (error) {
      console.error('Error getting message logs by agent:', error);
      return [];
    }
  }

  public searchMessageLogs(query: string, limit: number = 50): MessageLog[] {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM message_logs 
        WHERE content_plain LIKE ? OR subject LIKE ? OR from_agent_name LIKE ? OR to_agent_name LIKE ?
        ORDER BY created_at DESC
        LIMIT ?
      `);
      
      const searchTerm = `%${query}%`;
      const rows = stmt.all(searchTerm, searchTerm, searchTerm, searchTerm, limit) as any[];
      return rows.map(row => this.mapRowToMessageLog(row));
    } catch (error) {
      console.error('Error searching message logs:', error);
      return [];
    }
  }

  public getMessageLogsByDateRange(startDate: Date, endDate: Date, limit: number = 100): MessageLog[] {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM message_logs 
        WHERE created_at BETWEEN ? AND ?
        ORDER BY created_at DESC
        LIMIT ?
      `);
      
      const rows = stmt.all(startDate.toISOString(), endDate.toISOString(), limit) as any[];
      return rows.map(row => this.mapRowToMessageLog(row));
    } catch (error) {
      console.error('Error getting message logs by date range:', error);
      return [];
    }
  }

  public getMessageLogsByConversation(conversationId: string): MessageLog[] {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM message_logs 
        WHERE conversation_id = ?
        ORDER BY created_at ASC
      `);
      
      const rows = stmt.all(conversationId) as any[];
      return rows.map(row => this.mapRowToMessageLog(row));
    } catch (error) {
      console.error('Error getting message logs by conversation:', error);
      return [];
    }
  }

  public getMessageLogsByThread(threadId: string): MessageLog[] {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM message_logs 
        WHERE thread_id = ?
        ORDER BY created_at ASC
      `);
      
      const rows = stmt.all(threadId) as any[];
      return rows.map(row => this.mapRowToMessageLog(row));
    } catch (error) {
      console.error('Error getting message logs by thread:', error);
      return [];
    }
  }

  public updateMessageLogState(messageId: string, state: string, readAt?: Date, repliedAt?: Date): boolean {
    try {
      const stmt = this.db.prepare(`
        UPDATE message_logs 
        SET state = ?, read_at = ?, replied_at = ?
        WHERE message_id = ?
      `);
      
      const result = stmt.run(state, readAt?.toISOString() || null, repliedAt?.toISOString() || null, messageId);
      return result.changes > 0;
    } catch (error) {
      console.error('Error updating message log state:', error);
      return false;
    }
  }

  public getTotalMessageLogCount(): number {
    try {
      const stmt = this.db.prepare('SELECT COUNT(*) as count FROM message_logs');
      const result = stmt.get() as any;
      return result.count || 0;
    } catch (error) {
      console.error('Error getting total message log count:', error);
      return 0;
    }
  }

  public getMessageLogsByPriority(priority: string, limit: number = 50): MessageLog[] {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM message_logs 
        WHERE priority = ?
        ORDER BY created_at DESC
        LIMIT ?
      `);
      
      const rows = stmt.all(priority, limit) as any[];
      return rows.map(row => this.mapRowToMessageLog(row));
    } catch (error) {
      console.error('Error getting message logs by priority:', error);
      return [];
    }
  }

  private mapRowToMessageLog(row: any): MessageLog {
    return {
      id: row.id,
      messageId: row.message_id,
      conversationId: row.conversation_id,
      fromAgentId: row.from_agent_id,
      toAgentId: row.to_agent_id,
      fromAgentName: row.from_agent_name,
      toAgentName: row.to_agent_name,
      subject: row.subject,
      contentPlain: row.content_plain,
      contentEncrypted: row.content_encrypted,
      priority: row.priority,
      securityLevel: row.security_level,
      state: row.state,
      createdAt: new Date(row.created_at),
      readAt: row.read_at ? new Date(row.read_at) : undefined,
      repliedAt: row.replied_at ? new Date(row.replied_at) : undefined,
      threadId: row.thread_id,
      metadata: row.metadata ? JSON.parse(row.metadata) : {}
    };
  }
}
