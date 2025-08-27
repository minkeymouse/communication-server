/**
 * Agent Repository
 * Handles all agent-related database operations
 */

import Database from 'better-sqlite3';
import { Agent, AgentRole } from '../../../domain/agents/models.js';

export class AgentRepository {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public createAgent(agent: Agent): string {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO agents 
        (id, name, api_key, email, role, workspace_path, address, created_at, updated_at, last_seen, is_active,
         agent_id, last_login, login_attempts, locked_until,
         display_name, description, capabilities, tags, version, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        agent.id,
        agent.name,
        agent.apiKey,
        agent.email || null,
        agent.role,
        agent.workspacePath || null,
        agent.address || null,
        agent.createdAt.toISOString(),
        agent.createdAt.toISOString(),
        agent.lastSeen ? agent.lastSeen.toISOString() : null,
        agent.isActive ? 1 : 0,
        agent.credentials?.agentId || agent.id,
        agent.credentials?.lastLogin ? agent.credentials.lastLogin.toISOString() : null,
        agent.credentials?.loginAttempts || 0,
        agent.credentials?.lockedUntil ? agent.credentials.lockedUntil.toISOString() : null,
        agent.displayName,
        agent.description || null,
        JSON.stringify(agent.capabilities || []),
        JSON.stringify(agent.tags || []),
        agent.version || null,
        agent.createdBy || null
      );

      return agent.id;
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT' && error.message.includes('UNIQUE constraint failed')) {
        const existingAgent = this.getAgentByNameAndWorkspace(agent.name, agent.workspacePath || '');
        if (existingAgent) {
          return existingAgent.id;
        }
      }
      throw error;
    }
  }

  public getAgent(agentId: string): Agent | null {
    try {
      let stmt = this.db.prepare('SELECT * FROM agents WHERE agent_id = ?');
      let row = stmt.get(agentId) as any;

      if (!row) {
        stmt = this.db.prepare('SELECT * FROM agents WHERE id = ?');
        row = stmt.get(agentId) as any;
      }

      if (!row) return null;

      return this.mapRowToAgent(row);
    } catch (error) {
      console.error('Error getting agent:', error);
      return null;
    }
  }

  public getAgentByWorkspace(workspacePath: string): Agent | null {
    try {
      const stmt = this.db.prepare('SELECT * FROM agents WHERE workspace_path = ? LIMIT 1');
      const row = stmt.get(workspacePath) as any;

      if (!row) return null;

      return this.mapRowToAgent(row);
    } catch (error) {
      console.error('Error getting agent by workspace:', error);
      return null;
    }
  }

  public getAgentsByWorkspace(workspacePath: string): Agent[] {
    try {
      const stmt = this.db.prepare('SELECT * FROM agents WHERE workspace_path = ? AND is_active = 1 ORDER BY created_at');
      const rows = stmt.all(workspacePath) as any[];

      return rows.map(row => this.mapRowToAgent(row));
    } catch (error) {
      console.error('Error getting agents by workspace:', error);
      return [];
    }
  }

  public getAgentByNameAndWorkspace(name: string, workspacePath: string): Agent | null {
    try {
      const stmt = this.db.prepare('SELECT * FROM agents WHERE name = ? AND workspace_path = ? AND is_active = 1');
      const row = stmt.get(name, workspacePath) as any;

      if (!row) return null;

      return this.mapRowToAgent(row);
    } catch (error) {
      console.error('Error getting agent by name and workspace:', error);
      return null;
    }
  }

  public updateAgentLastSeen(agentId: string): void {
    const stmt = this.db.prepare('UPDATE agents SET last_seen = ? WHERE id = ?');
    stmt.run(new Date().toISOString(), agentId);
  }

  public updateAgentName(agentId: string, name: string): void {
    const stmt = this.db.prepare('UPDATE agents SET name = ? WHERE id = ?');
    stmt.run(name, agentId);
  }

  public updateAgentRole(agentId: string, role: AgentRole): void {
    const stmt = this.db.prepare('UPDATE agents SET role = ? WHERE id = ?');
    stmt.run(role, agentId);
  }

  public deleteAgent(agentId: string, createdBy?: string): boolean {
    try {
      const agent = this.getAgent(agentId);
      if (!agent) return false;
      
      if (createdBy && agent.createdBy && agent.createdBy !== createdBy) {
        throw new Error('Only the agent who created this account can delete it');
      }

      const stmt = this.db.prepare('UPDATE agents SET is_active = 0 WHERE id = ?');
      const result = stmt.run(agentId);
      
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting agent:', error);
      return false;
    }
  }

  public getAllActiveAgents(): Agent[] {
    try {
      const stmt = this.db.prepare('SELECT * FROM agents WHERE is_active = 1 ORDER BY created_at');
      const rows = stmt.all() as any[];
      return rows.map(row => this.mapRowToAgent(row));
    } catch (error) {
      console.error('Error getting all active agents:', error);
      return [];
    }
  }

  public getAgentsByRole(role: string): Agent[] {
    try {
      const stmt = this.db.prepare('SELECT * FROM agents WHERE role = ? AND is_active = 1 ORDER BY created_at');
      const rows = stmt.all(role) as any[];
      return rows.map(row => this.mapRowToAgent(row));
    } catch (error) {
      console.error('Error getting agents by role:', error);
      return [];
    }
  }

  public getAgentsByCapability(capability: string): Agent[] {
    try {
      const stmt = this.db.prepare('SELECT * FROM agents WHERE capabilities LIKE ? AND is_active = 1 ORDER BY created_at');
      const rows = stmt.all(`%${capability}%`) as any[];
      return rows.map(row => this.mapRowToAgent(row));
    } catch (error) {
      console.error('Error getting agents by capability:', error);
      return [];
    }
  }

  public getAgentsByTag(tag: string): Agent[] {
    try {
      const stmt = this.db.prepare('SELECT * FROM agents WHERE tags LIKE ? AND is_active = 1 ORDER BY created_at');
      const rows = stmt.all(`%${tag}%`) as any[];
      return rows.map(row => this.mapRowToAgent(row));
    } catch (error) {
      console.error('Error getting agents by tag:', error);
      return [];
    }
  }

  public countAgentsInWorkspace(workspacePath: string): number {
    try {
      const row = this.db.prepare('SELECT COUNT(*) as cnt FROM agents WHERE workspace_path = ? AND is_active = 1').get(workspacePath) as any;
      return row ? (row.cnt || 0) : 0;
    } catch (error) {
      console.error('Error counting agents in workspace:', error);
      return 0;
    }
  }

  public countAgentsTotal(): number {
    try {
      const row = this.db.prepare('SELECT COUNT(*) as cnt FROM agents WHERE is_active = 1').get() as any;
      return row ? (row.cnt || 0) : 0;
    } catch (error) {
      console.error('Error counting total agents:', error);
      return 0;
    }
  }

  public getAgentByName(name: string): Agent | null {
    try {
      const stmt = this.db.prepare('SELECT * FROM agents WHERE name = ? AND is_active = 1');
      const row = stmt.get(name) as any;
      return row ? this.mapRowToAgent(row) : null;
    } catch (error) {
      console.error('Error getting agent by name:', error);
      return null;
    }
  }

  public findGhostAgentsOlderThan(days: number = 7, noMessagesOnly: boolean = true): Agent[] {
    try {
      const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const rows = this.db.prepare(
        'SELECT * FROM agents WHERE is_active = 1 AND (last_seen IS NULL OR last_seen < ?)' 
      ).all(threshold) as any[];

      const candidates = rows.map(row => this.mapRowToAgent(row));
      if (!noMessagesOnly) return candidates;
      
      // Filter out agents with messages (would need message repository)
      return candidates;
    } catch (error) {
      console.error('Error finding ghost agents:', error);
      return [];
    }
  }

  private mapRowToAgent(row: any): Agent {
    return {
      id: row.id,
      name: row.name,
      apiKey: row.api_key,
      email: row.email,
      role: row.role as AgentRole,
      workspacePath: row.workspace_path,
      address: row.address,
      createdAt: new Date(row.created_at),
      lastSeen: row.last_seen ? new Date(row.last_seen) : undefined,
      isActive: Boolean(row.is_active),
      
      credentials: row.agent_id ? {
        agentId: row.agent_id,
        lastLogin: row.last_login ? new Date(row.last_login) : undefined,
        loginAttempts: row.login_attempts || 0,
        lockedUntil: row.locked_until ? new Date(row.locked_until) : undefined
      } : undefined,
      
      displayName: row.display_name || row.name,
      description: row.description,
      capabilities: row.capabilities ? JSON.parse(row.capabilities) : [],
      tags: row.tags ? JSON.parse(row.tags) : [],
      version: row.version,
      createdBy: row.created_by
    };
  }
}
