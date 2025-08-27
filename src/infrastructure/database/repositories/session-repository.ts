/**
 * Session Repository
 * Handles all session-related database operations
 */

import Database from 'better-sqlite3';

export interface Session {
  id: string;
  agentId: string;
  sessionToken: string;
  createdAt: Date;
  expiresAt: Date;
  isActive: boolean;
}

export class SessionRepository {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public createSession(agentId: string, sessionMinutes: number): Session {
    try {
      const sessionId = crypto.randomUUID();
      const sessionToken = crypto.randomUUID();
      const createdAt = new Date();
      const expiresAt = new Date(createdAt.getTime() + sessionMinutes * 60 * 1000);

      const stmt = this.db.prepare(`
        INSERT INTO sessions 
        (id, agent_id, token, created_at, expires_at, is_active)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        sessionId,
        agentId,
        sessionToken,
        createdAt.toISOString(),
        expiresAt.toISOString(),
        1
      );

      return {
        id: sessionId,
        agentId,
        sessionToken,
        createdAt,
        expiresAt,
        isActive: true
      };
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  public getSession(sessionToken: string): Session | null {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM sessions 
        WHERE token = ? AND is_active = 1
      `);
      const row = stmt.get(sessionToken) as any;

      if (!row) return null;

      return this.mapRowToSession(row);
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }

  public getActiveSessionsForAgent(agentId: string): Session[] {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM sessions 
        WHERE agent_id = ? AND is_active = 1 AND expires_at > ?
        ORDER BY created_at DESC
      `);
      const rows = stmt.all(agentId, new Date().toISOString()) as any[];

      return rows.map(row => this.mapRowToSession(row));
    } catch (error) {
      console.error('Error getting active sessions for agent:', error);
      return [];
    }
  }

  public deactivateSession(sessionToken: string): boolean {
    try {
      const stmt = this.db.prepare(`
        UPDATE sessions 
        SET is_active = 0 
        WHERE token = ?
      `);
      const result = stmt.run(sessionToken);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deactivating session:', error);
      return false;
    }
  }

  public deactivateAllSessionsForAgent(agentId: string): number {
    try {
      const stmt = this.db.prepare(`
        UPDATE sessions 
        SET is_active = 0 
        WHERE agent_id = ?
      `);
      const result = stmt.run(agentId);
      return result.changes;
    } catch (error) {
      console.error('Error deactivating all sessions for agent:', error);
      return 0;
    }
  }

  public cleanupExpiredSessions(): number {
    try {
      const stmt = this.db.prepare(`
        UPDATE sessions 
        SET is_active = 0 
        WHERE expires_at < ? AND is_active = 1
      `);
      const result = stmt.run(new Date().toISOString());
      return result.changes;
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
      return 0;
    }
  }

  public getActiveSessionsCount(): number {
    try {
      const row = this.db.prepare(`
        SELECT COUNT(*) as cnt FROM sessions 
        WHERE is_active = 1 AND expires_at > ?
      `).get(new Date().toISOString()) as any;
      return row ? (row.cnt || 0) : 0;
    } catch (error) {
      console.error('Error getting active sessions count:', error);
      return 0;
    }
  }

  public getTotalSessionsCount(): number {
    try {
      const row = this.db.prepare('SELECT COUNT(*) as cnt FROM sessions').get() as any;
      return row ? (row.cnt || 0) : 0;
    } catch (error) {
      console.error('Error getting total sessions count:', error);
      return 0;
    }
  }

  public getSessionsByAgent(agentId: string): Session[] {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM sessions 
        WHERE agent_id = ? 
        ORDER BY created_at DESC
      `);
      const rows = stmt.all(agentId) as any[];

      return rows.map(row => this.mapRowToSession(row));
    } catch (error) {
      console.error('Error getting sessions by agent:', error);
      return [];
    }
  }

  public getSessionsInDateRange(startDate: Date, endDate: Date): Session[] {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM sessions 
        WHERE created_at BETWEEN ? AND ?
        ORDER BY created_at DESC
      `);
      const rows = stmt.all(startDate.toISOString(), endDate.toISOString()) as any[];

      return rows.map(row => this.mapRowToSession(row));
    } catch (error) {
      console.error('Error getting sessions in date range:', error);
      return [];
    }
  }

  public deleteSession(sessionId: string): boolean {
    try {
      const stmt = this.db.prepare('DELETE FROM sessions WHERE id = ?');
      const result = stmt.run(sessionId);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting session:', error);
      return false;
    }
  }

  public deleteExpiredSessions(): number {
    try {
      const stmt = this.db.prepare('DELETE FROM sessions WHERE expires_at < ?');
      const result = stmt.run(new Date().toISOString());
      return result.changes;
    } catch (error) {
      console.error('Error deleting expired sessions:', error);
      return 0;
    }
  }

  public extendSession(sessionToken: string, additionalMinutes: number): boolean {
    try {
      const session = this.getSession(sessionToken);
      if (!session) return false;

      const newExpiresAt = new Date(session.expiresAt.getTime() + additionalMinutes * 60 * 1000);
      
      const stmt = this.db.prepare(`
        UPDATE sessions 
        SET expires_at = ? 
        WHERE token = ?
      `);
      const result = stmt.run(newExpiresAt.toISOString(), sessionToken);
      return result.changes > 0;
    } catch (error) {
      console.error('Error extending session:', error);
      return false;
    }
  }

  public isSessionValid(sessionToken: string): boolean {
    try {
      const session = this.getSession(sessionToken);
      if (!session) return false;

      return session.isActive && session.expiresAt > new Date();
    } catch (error) {
      console.error('Error checking session validity:', error);
      return false;
    }
  }

  private mapRowToSession(row: any): Session {
    return {
      id: row.id,
      agentId: row.agent_id,
      sessionToken: row.token,
      createdAt: new Date(row.created_at),
      expiresAt: new Date(row.expires_at),
      isActive: Boolean(row.is_active)
    };
  }
}
