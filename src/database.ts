/**
 * Production-ready SQLite database manager for the communication server.
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { Agent, Conversation, Message, LogEntry, ConversationSummary, AgentRole, MessageState } from './models.js';

export class DatabaseManager {
  private db: Database.Database;
  private dbPath: string;
  private logger: any;

  constructor(dbPath?: string) {
    // Use generic data directory that works from anywhere
    if (!dbPath) {
      const dataDir = path.join(os.homedir(), '.communication-server', 'data');
      fs.mkdirSync(dataDir, { recursive: true });
      dbPath = path.join(dataDir, 'communication.db');
    }

    this.dbPath = dbPath;
    this.db = new Database(dbPath);
    this.initializeDatabase();
    this.createIndexes();
    this.vacuumDatabase();
  }

  private initializeDatabase(): void {
    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = 10000');
    this.db.pragma('temp_store = MEMORY');
    this.db.pragma('mmap_size = 268435456'); // 256MB

    // Check if we need to migrate the database schema
    this.migrateDatabase();

    // Create agents table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        api_key TEXT NOT NULL UNIQUE,
        email TEXT,
        role TEXT DEFAULT 'general',
        workspace_path TEXT,
        address TEXT,
        created_at TEXT NOT NULL,
        last_seen TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at_epoch INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Create conversations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        participants TEXT NOT NULL,
        created_by TEXT NOT NULL,
        subject TEXT,
        created_at TEXT NOT NULL,
        last_activity TEXT,
        created_at_epoch INTEGER DEFAULT (strftime('%s', 'now')),
        is_active BOOLEAN DEFAULT 1,
        updated_at TEXT,
        message_count INTEGER DEFAULT 0
      )
    `);

    // Create messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        from_agent TEXT NOT NULL,
        to_agent TEXT NOT NULL,
        subject TEXT NOT NULL,
        content TEXT NOT NULL,
        state TEXT DEFAULT 'sent',
        reply_to TEXT,
        created_at TEXT NOT NULL,
        read_at TEXT,
        replied_at TEXT,
        archived_at TEXT,
        is_read BOOLEAN DEFAULT 0,
        requires_reply BOOLEAN DEFAULT 1,
        created_at_epoch INTEGER DEFAULT (strftime('%s', 'now')),
        from_agent_name TEXT,
        from_agent_role TEXT,
        from_agent_workspace TEXT,
        to_agent_name TEXT,
        to_agent_role TEXT,
        to_agent_workspace TEXT,
        metadata TEXT,
        FOREIGN KEY (conversation_id) REFERENCES conversations (id),
        FOREIGN KEY (from_agent) REFERENCES agents (id),
        FOREIGN KEY (to_agent) REFERENCES agents (id),
        FOREIGN KEY (reply_to) REFERENCES messages (id)
      )
    `);

    // Create logs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS logs (
        id TEXT PRIMARY KEY,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        agent_id TEXT,
        conversation_id TEXT,
        message_id TEXT,
        created_at TEXT NOT NULL,
        metadata TEXT,
        created_at_epoch INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (agent_id) REFERENCES agents (id),
        FOREIGN KEY (conversation_id) REFERENCES conversations (id),
        FOREIGN KEY (message_id) REFERENCES messages (id)
      )
    `);

    // Create sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_token TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        last_activity TEXT,
        ip_address TEXT,
        user_agent TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at_epoch INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (agent_id) REFERENCES agents (id)
      )
    `);
  }

  private createIndexes(): void {
    // Indexes for agents table
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_agents_workspace_path ON agents(workspace_path)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_agents_api_key ON agents(api_key)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_agents_active ON agents(is_active)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_agents_name_workspace ON agents(name, workspace_path)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_agents_created_at ON agents(created_at_epoch)');

    // Indexes for conversations table
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_conversations_created_by ON conversations(created_by)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_conversations_active ON conversations(is_active)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at)');

    // Indexes for messages table
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_messages_from_agent ON messages(from_agent)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_messages_to_agent ON messages(to_agent)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_messages_state ON messages(state)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_messages_requires_reply ON messages(requires_reply)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages(reply_to)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at_epoch)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_messages_subject_content ON messages(subject, content)');

    // Indexes for logs table
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_logs_agent_id ON logs(agent_id)');

    // Indexes for sessions table
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_agent_id ON sessions(agent_id)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(is_active)');
  }

  private vacuumDatabase(): void {
    try {
      this.db.exec('VACUUM');
      this.db.exec('ANALYZE');
      console.error('🗄️ Database optimized and analyzed');
    } catch (error) {
      console.warn('Database optimization failed:', error);
    }
  }

  private migrateDatabase(): void {
    try {
      // Check if workspace_path has UNIQUE constraint (old schema)
      const pragmaResult = this.db.pragma('table_info(agents)') as any[];
      const workspacePathColumn = pragmaResult.find(col => col.name === 'workspace_path');
      
      if (workspacePathColumn) {
        // Check if there's a UNIQUE constraint on workspace_path
        const indexResult = this.db.pragma('index_list(agents)') as any[];
        const uniqueIndex = indexResult.find(idx => 
          idx.name && idx.name.includes('workspace_path') && idx.unique === 1
        );
        
        if (uniqueIndex) {
          console.log('🔄 Migrating database schema: Removing UNIQUE constraint on workspace_path');
          
          // Create a temporary table without the UNIQUE constraint
          this.db.exec(`
            CREATE TABLE agents_new (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              api_key TEXT NOT NULL UNIQUE,
              email TEXT,
              role TEXT DEFAULT 'general',
              workspace_path TEXT,
              address TEXT,
              created_at TEXT NOT NULL,
              last_seen TEXT,
              is_active BOOLEAN DEFAULT 1,
              created_at_epoch INTEGER DEFAULT (strftime('%s', 'now'))
            )
          `);
          
          // Copy data from old table to new table
          this.db.exec('INSERT INTO agents_new SELECT * FROM agents');
          
          // Drop old table and rename new table
          this.db.exec('DROP TABLE agents');
          this.db.exec('ALTER TABLE agents_new RENAME TO agents');
          
          // Recreate indexes
          this.createIndexes();
          
          console.log('✅ Database migration completed successfully');
        }
      }
    } catch (error) {
      console.warn('Database migration failed:', error);
    }
  }

  // Agent operations
  createAgent(agent: Agent): string {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO agents 
        (id, name, api_key, email, role, workspace_path, address, created_at, last_seen, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        agent.lastSeen ? agent.lastSeen.toISOString() : null,
        agent.isActive ? 1 : 0
      );

      return agent.id;
    } catch (error: any) {
      // If agent already exists, return the existing agent ID
      if (error.code === 'SQLITE_CONSTRAINT' && error.message.includes('UNIQUE constraint failed')) {
        const existingAgent = this.getAgentByNameAndWorkspace(agent.name, agent.workspacePath || '');
        if (existingAgent) {
          return existingAgent.id;
        }
      }
      throw error;
    }
  }

  getAgent(agentId: string): Agent | null {
    const stmt = this.db.prepare('SELECT * FROM agents WHERE id = ?');
    const row = stmt.get(agentId) as any;

    if (!row) return null;

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
      isActive: Boolean(row.is_active)
    };
  }

  getAgentByWorkspace(workspacePath: string): Agent | null {
    const stmt = this.db.prepare('SELECT * FROM agents WHERE workspace_path = ? LIMIT 1');
    const row = stmt.get(workspacePath) as any;

    if (!row) return null;

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
      isActive: Boolean(row.is_active)
    };
  }

  getAgentsByWorkspace(workspacePath: string): Agent[] {
    const stmt = this.db.prepare('SELECT * FROM agents WHERE workspace_path = ? AND is_active = 1 ORDER BY created_at');
    const rows = stmt.all(workspacePath) as any[];

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      apiKey: row.api_key,
      email: row.email,
      role: row.role as AgentRole,
      workspacePath: row.workspace_path,
      address: row.address,
      createdAt: new Date(row.created_at),
      lastSeen: row.last_seen ? new Date(row.last_seen) : undefined,
      isActive: Boolean(row.is_active)
    }));
  }

  getAgentByNameAndWorkspace(name: string, workspacePath: string): Agent | null {
    const stmt = this.db.prepare('SELECT * FROM agents WHERE name = ? AND workspace_path = ? AND is_active = 1');
    const row = stmt.get(name, workspacePath) as any;

    if (!row) return null;

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
      isActive: Boolean(row.is_active)
    };
  }

  updateAgentLastSeen(agentId: string): void {
    const stmt = this.db.prepare('UPDATE agents SET last_seen = ? WHERE id = ?');
    stmt.run(new Date().toISOString(), agentId);
  }

  updateAgentName(agentId: string, name: string): void {
    const stmt = this.db.prepare('UPDATE agents SET name = ? WHERE id = ?');
    stmt.run(name, agentId);
  }

  updateAgentRole(agentId: string, role: AgentRole): void {
    const stmt = this.db.prepare('UPDATE agents SET role = ? WHERE id = ?');
    stmt.run(role, agentId);
  }

  // Conversation operations
  createConversation(conversation: Conversation): string {
    const stmt = this.db.prepare(`
      INSERT INTO conversations 
      (id, subject, participants, created_by, created_at, updated_at, is_active, message_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      conversation.id,
      conversation.subject || null,
      JSON.stringify(conversation.participants),
      conversation.createdBy,
      conversation.createdAt.toISOString(),
      conversation.updatedAt.toISOString(),
      conversation.isActive ? 1 : 0,
      conversation.messageCount || 0
    );

    return conversation.id;
  }

  // Message operations
  createMessage(message: Message): string {
    const stmt = this.db.prepare(`
      INSERT INTO messages (
        id, conversation_id, from_agent, to_agent, subject, content, state, reply_to, 
        created_at, requires_reply, from_agent_name, from_agent_role, from_agent_workspace,
        to_agent_name, to_agent_role, to_agent_workspace, metadata
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      message.id,
      message.conversationId,
      message.fromAgent,
      message.toAgent,
      message.subject,
      message.content,
      message.state,
      message.replyTo || null,
      message.createdAt.toISOString(),
      message.requiresReply ? 1 : 0,
      message.fromAgentName || null,
      message.fromAgentRole || null,
      message.fromAgentWorkspace || null,
      message.toAgentName || null,
      message.toAgentRole || null,
      message.toAgentWorkspace || null,
      JSON.stringify(message.metadata || {})
    );

    // Update conversation message count
    const updateStmt = this.db.prepare(`
      UPDATE conversations 
      SET message_count = message_count + 1, updated_at = ?
      WHERE id = ?
    `);
    updateStmt.run(new Date().toISOString(), message.conversationId);

    return message.id;
  }

  getMessage(messageId: string): Message | null {
    const stmt = this.db.prepare('SELECT * FROM messages WHERE id = ?');
    const row = stmt.get(messageId) as any;

    if (!row) return null;

    return {
      id: row.id,
      conversationId: row.conversation_id,
      fromAgent: row.from_agent,
      toAgent: row.to_agent,
      subject: row.subject,
      content: row.content,
      state: row.state as MessageState,
      replyTo: row.reply_to,
      createdAt: new Date(row.created_at),
      readAt: row.read_at ? new Date(row.read_at) : undefined,
      repliedAt: row.replied_at ? new Date(row.replied_at) : undefined,
      archivedAt: row.archived_at ? new Date(row.archived_at) : undefined,
      isRead: Boolean(row.is_read),
      requiresReply: Boolean(row.requires_reply),
      fromAgentName: row.from_agent_name,
      fromAgentRole: row.from_agent_role,
      fromAgentWorkspace: row.from_agent_workspace,
      toAgentName: row.to_agent_name,
      toAgentRole: row.to_agent_role,
      toAgentWorkspace: row.to_agent_workspace,
      metadata: row.metadata ? JSON.parse(row.metadata) : {}
    };
  }

  getMessagesForAgent(agentId: string, limit: number = 100): Message[] {
    const stmt = this.db.prepare(`
      SELECT * FROM messages 
      WHERE from_agent = ? OR to_agent = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(agentId, agentId, limit) as any[];
    return rows.map(row => ({
      id: row.id,
      conversationId: row.conversation_id,
      fromAgent: row.from_agent,
      toAgent: row.to_agent,
      subject: row.subject,
      content: row.content,
      state: row.state as MessageState,
      replyTo: row.reply_to,
      createdAt: new Date(row.created_at),
      readAt: row.read_at ? new Date(row.read_at) : undefined,
      repliedAt: row.replied_at ? new Date(row.replied_at) : undefined,
      archivedAt: row.archived_at ? new Date(row.archived_at) : undefined,
      isRead: Boolean(row.is_read),
      requiresReply: Boolean(row.requires_reply),
      fromAgentName: row.from_agent_name,
      fromAgentRole: row.from_agent_role,
      fromAgentWorkspace: row.from_agent_workspace,
      toAgentName: row.to_agent_name,
      toAgentRole: row.to_agent_role,
      toAgentWorkspace: row.to_agent_workspace,
      metadata: row.metadata ? JSON.parse(row.metadata) : {}
    }));
  }

  searchMessages(agentId: string, query: string, limit: number = 50): Message[] {
    const stmt = this.db.prepare(`
      SELECT * FROM messages 
      WHERE (from_agent = ? OR to_agent = ?)
      AND (
        subject LIKE ? OR 
        content LIKE ? OR
        from_agent_name LIKE ? OR
        to_agent_name LIKE ?
      )
      ORDER BY created_at DESC 
      LIMIT ?
    `);
    
    const searchPattern = `%${query}%`;
    const rows = stmt.all(agentId, agentId, searchPattern, searchPattern, searchPattern, searchPattern, limit) as any[];

    return rows.map(row => ({
      id: row.id,
      conversationId: row.conversation_id,
      fromAgent: row.from_agent,
      toAgent: row.to_agent,
      subject: row.subject,
      content: row.content,
      state: row.state as MessageState,
      replyTo: row.reply_to,
      createdAt: new Date(row.created_at),
      readAt: row.read_at ? new Date(row.read_at) : undefined,
      repliedAt: row.replied_at ? new Date(row.replied_at) : undefined,
      archivedAt: row.archived_at ? new Date(row.archived_at) : undefined,
      isRead: Boolean(row.is_read),
      requiresReply: Boolean(row.requires_reply),
      fromAgentName: row.from_agent_name,
      fromAgentRole: row.from_agent_role,
      fromAgentWorkspace: row.from_agent_workspace,
      toAgentName: row.to_agent_name,
      toAgentRole: row.to_agent_role,
      toAgentWorkspace: row.to_agent_workspace,
      metadata: row.metadata ? JSON.parse(row.metadata) : {}
    }));
  }

  updateMessageState(messageId: string, state: MessageState): void {
    const stmt = this.db.prepare('UPDATE messages SET state = ? WHERE id = ?');
    stmt.run(state, messageId);
  }

  updateMessageReadStatus(messageId: string, isRead: boolean): void {
    const stmt = this.db.prepare('UPDATE messages SET is_read = ?, read_at = ? WHERE id = ?');
    stmt.run(isRead ? 1 : 0, isRead ? new Date().toISOString() : null, messageId);
  }

  // Log operations
  createLog(logEntry: LogEntry): LogEntry {
    const stmt = this.db.prepare(`
      INSERT INTO logs (id, level, message, agent_id, conversation_id, message_id, created_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      logEntry.id,
      logEntry.level,
      logEntry.message,
      logEntry.agentId || null,
      logEntry.conversationId || null,
      logEntry.messageId || null,
      logEntry.createdAt.toISOString(),
      JSON.stringify(logEntry.metadata || {})
    );

    return logEntry;
  }

  // Statistics
  getDatabaseStats(): any {
    const agentStmt = this.db.prepare('SELECT COUNT(*) as count FROM agents WHERE is_active = 1');
    const messageStmt = this.db.prepare('SELECT COUNT(*) as count FROM messages');
    const conversationStmt = this.db.prepare('SELECT COUNT(*) as count FROM conversations WHERE is_active = 1');
    const logStmt = this.db.prepare('SELECT COUNT(*) as count FROM logs');

    const activeAgents = agentStmt.get() as any;
    const totalMessages = messageStmt.get() as any;
    const activeConversations = conversationStmt.get() as any;
    const totalLogs = logStmt.get() as any;

    // Get recent activity (last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentStmt = this.db.prepare('SELECT COUNT(*) as count FROM messages WHERE created_at > ?');
    const recentMessages = recentStmt.get(yesterday.toISOString()) as any;

    // Get database file size
    const stats = fs.statSync(this.dbPath);
    const dbSize = stats.size;

    return {
      activeAgents: activeAgents.count,
      totalMessages: totalMessages.count,
      activeConversations: activeConversations.count,
      totalLogs: totalLogs.count,
      recentMessages24h: recentMessages.count,
      databaseSizeBytes: dbSize,
      databaseSizeMb: Math.round(dbSize / (1024 * 1024) * 100) / 100
    };
  }

  close(): void {
    this.db.close();
  }
}
