/**
 * Production-ready SQLite database manager for the communication server.
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { Agent, Conversation, Message, LogEntry, ConversationSummary, AgentRole, MessageState, MessagePriority } from './models.js';

export class DatabaseManager {
  private db!: Database.Database;
  private dbPath: string;
  private logger: any;
  private isConnected: boolean = false;
  private connectionRetries: number = 0;
  private readonly MAX_RETRIES = 3;

  constructor(dbPath?: string) {
    // Use unique instance ID for database path isolation
    const instanceId = process.env.MCP_SERVER_ID || 'default';
    
    // Use generic data directory that works from anywhere
    if (!dbPath) {
      const dataDir = path.join(os.homedir(), '.communication-server', instanceId, 'data');
      fs.mkdirSync(dataDir, { recursive: true });
      dbPath = path.join(dataDir, 'communication.db');
    }

    console.log(`🗄️ Initializing database for instance '${instanceId}' at:`, dbPath);
    this.dbPath = dbPath;
    
    // Check for conflicting processes and clean up if needed
    this.handleConflictingProcesses();
    
    this.initializeConnection();
  }

  private handleConflictingProcesses(): void {
    try {
      const { execSync } = require('child_process');
      
      // Get all processes using this database
      const output = execSync(`lsof "${this.dbPath}" 2>/dev/null || true`, { encoding: 'utf8' }).trim();
      
      if (output) {
        console.log(`⚠️ Found processes using database: ${this.dbPath}`);
        console.log('Cleaning up conflicting processes...');
        
        // Kill processes using this database
        try {
          execSync(`pkill -f "node.*dist/index.js"`, { stdio: 'ignore' });
          // Wait a moment for processes to terminate
          setTimeout(() => {}, 1000);
        } catch (error) {
          // Ignore errors if no processes found
        }
        
        // Clean up WAL and SHM files
        this.cleanupDatabaseFiles();
      }
    } catch (error) {
      // Ignore errors in process detection
      console.log('Process detection failed, continuing...');
    }
  }

  private cleanupDatabaseFiles(): void {
    try {
      const dbDir = path.dirname(this.dbPath);
      const dbName = path.basename(this.dbPath, '.db');
      
      // Remove WAL and SHM files
      const walFile = path.join(dbDir, `${dbName}.db-wal`);
      const shmFile = path.join(dbDir, `${dbName}.db-shm`);
      
      if (fs.existsSync(walFile)) {
        fs.unlinkSync(walFile);
        console.log('🗑️ Removed WAL file');
      }
      
      if (fs.existsSync(shmFile)) {
        fs.unlinkSync(shmFile);
        console.log('🗑️ Removed SHM file');
      }
    } catch (error) {
      console.log('Database file cleanup failed:', error);
    }
  }

  private initializeConnection(): void {
    try {
      // Check if database already exists
      const dbExists = fs.existsSync(this.dbPath);
      
      if (dbExists) {
        console.log('📂 Using existing database');
      } else {
        console.log('🆕 Creating new database');
      }
      
      this.db = new Database(this.dbPath);
      this.isConnected = true;
      this.connectionRetries = 0;
      console.log('Database connection established');
      
      this.initializeDatabase();
      console.log('Database initialization completed');
      
      this.createIndexes();
      console.log('Database indexes created');
      
      this.vacuumDatabase();
      console.log('Database vacuum completed');
    } catch (error: any) {
      console.error('Database connection failed:', error);
      this.handleConnectionError(error);
    }
  }

  private handleConnectionError(error: any): void {
    if (this.connectionRetries < this.MAX_RETRIES) {
      this.connectionRetries++;
      console.log(`Retrying database connection (${this.connectionRetries}/${this.MAX_RETRIES})...`);
      setTimeout(() => this.initializeConnection(), 1000 * this.connectionRetries);
    } else {
      console.error('Max database connection retries exceeded');
      throw error;
    }
  }

  private ensureConnection(): void {
    if (!this.isConnected || !this.db) {
      throw new Error('Database not connected');
    }
  }

  private initializeDatabase(): void {
    console.log('Starting database initialization...');
    
    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = 10000');
    this.db.pragma('temp_store = MEMORY');
    this.db.pragma('mmap_size = 268435456'); // 256MB
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000');
    this.db.pragma('wal_autocheckpoint = 1000');
    this.db.pragma('journal_size_limit = 67108864'); // 64MB

    console.log('Database pragmas configured');

    // Create tables first (fresh installs) so subsequent migrations/indexes succeed
    console.log('Creating database tables...');
    
    const createTablesSQL = `
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        api_key TEXT NOT NULL,
        email TEXT,
        role TEXT NOT NULL DEFAULT 'general',
        workspace_path TEXT,
        address TEXT,
        created_at TEXT NOT NULL,
        last_seen TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        
        -- Simple authentication: ID, PW, ADDRESS
        username TEXT,
        password_hash TEXT,
        salt TEXT,
        last_login TEXT,
        login_attempts INTEGER DEFAULT 0,
        locked_until TEXT,
        
        -- Additional metadata
        display_name TEXT,
        description TEXT,
        capabilities TEXT,
        tags TEXT,
        version TEXT,
        created_by TEXT
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        from_agent TEXT NOT NULL,
        to_agent TEXT NOT NULL,
        subject TEXT NOT NULL,
        content TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'sent',
        priority TEXT NOT NULL DEFAULT 'normal',
        expires_at TEXT,
        reply_to TEXT,
        created_at TEXT NOT NULL,
        read_at TEXT,
        replied_at TEXT,
        archived_at TEXT,
        is_read INTEGER NOT NULL DEFAULT 0,
        requires_reply INTEGER NOT NULL DEFAULT 1,
        from_agent_name TEXT,
        from_agent_role TEXT,
        from_agent_workspace TEXT,
        to_agent_name TEXT,
        to_agent_role TEXT,
        to_agent_workspace TEXT,
        metadata TEXT
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        subject TEXT NOT NULL,
        participants TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        message_count INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS agent_sessions (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        session_token TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY (agent_id) REFERENCES agents (id)
      );

      CREATE TABLE IF NOT EXISTS logs (
        id TEXT PRIMARY KEY,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        agent_id TEXT,
        conversation_id TEXT,
        message_id TEXT,
        created_at TEXT NOT NULL,
        metadata TEXT
      );
    `;

    try {
      this.db.exec(createTablesSQL);
      console.log('Database tables created successfully');
    } catch (error: any) {
      console.error('Error creating database tables:', error);
      // Do not rethrow to allow migrations to potentially heal
    }

    // Run migrations only after base tables exist, and guard errors
    try {
      this.migrateDatabase();
    } catch (error) {
      console.warn('Migration step failed, continuing with base schema:', error);
    }

    console.log('Database initialization completed');
  }

  private createIndexes(): void {
    // Indexes for agents table
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_agents_workspace_path ON agents(workspace_path)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_agents_api_key ON agents(api_key)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_agents_active ON agents(is_active)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_agents_name_workspace ON agents(name, workspace_path)');

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
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)');

    // Indexes for logs table
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_logs_agent_id ON logs(agent_id)');

    // Indexes for agent_sessions table
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_agent_sessions_agent_id ON agent_sessions(agent_id)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_agent_sessions_expires_at ON agent_sessions(expires_at)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_agent_sessions_active ON agent_sessions(is_active)');
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
    let currentVersion = 0;
    try {
      const version = this.db.prepare('PRAGMA user_version').get() as { user_version: number };
      currentVersion = version.user_version || 0;
    } catch (e) {
      console.warn('Unable to read PRAGMA user_version, assuming 0');
      currentVersion = 0;
    }

    console.log(`Current database version: ${currentVersion}`);

    // For simplified schema, we only ensure base columns exist; older migrations are skipped
    if (currentVersion < 1) {
      // Ensure messages has new columns used by code if table exists
      try {
        const hasMessages = !!this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='messages'").get();
        if (hasMessages) {
          const addIfMissing = (columnDef: string) => {
            const name = columnDef.split(' ')[0];
            const cols = this.db.prepare("PRAGMA table_info(messages)").all() as any[];
            if (!cols.find(c => c.name === name)) {
              this.db.exec(`ALTER TABLE messages ADD COLUMN ${columnDef}`);
            }
          };
          addIfMissing('read_at TEXT');
          addIfMissing('replied_at TEXT');
          addIfMissing('archived_at TEXT');
          addIfMissing('from_agent_name TEXT');
          addIfMissing('from_agent_role TEXT');
          addIfMissing('from_agent_workspace TEXT');
          addIfMissing('to_agent_name TEXT');
          addIfMissing('to_agent_role TEXT');
          addIfMissing('to_agent_workspace TEXT');
          addIfMissing('metadata TEXT');
        }
      } catch (e) {
        console.warn('Non-fatal: could not backfill messages columns:', e);
      }
      currentVersion = 1;
    }

    // Set user_version
    try {
      this.db.exec(`PRAGMA user_version = ${currentVersion}`);
      console.log(`Database migrated to version: ${currentVersion}`);
    } catch (e) {
      console.warn('Failed to set PRAGMA user_version:', e);
    }
  }

  // Agent operations
  createAgent(agent: Agent): string {
    this.ensureConnection();
    
    try {
      const stmt = this.db.prepare(`
        INSERT INTO agents 
        (id, name, api_key, email, role, workspace_path, address, created_at, last_seen, is_active,
         username, password_hash, salt, last_login, login_attempts, locked_until,
         display_name, description, capabilities, tags, version, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        agent.isActive ? 1 : 0,
        agent.credentials?.username || null,
        agent.credentials?.passwordHash || null,
        agent.credentials?.salt || null,
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
    this.ensureConnection();
    
    try {
      const stmt = this.db.prepare('SELECT * FROM agents WHERE id = ?');
      const row = stmt.get(agentId) as any;

      if (!row) return null;

      return this.mapRowToAgent(row);
    } catch (error) {
      console.error('Error getting agent:', error);
      return null;
    }
  }

  getAgentByWorkspace(workspacePath: string): Agent | null {
    this.ensureConnection();
    
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

  getAgentsByWorkspace(workspacePath: string): Agent[] {
    this.ensureConnection();
    
    try {
      const stmt = this.db.prepare('SELECT * FROM agents WHERE workspace_path = ? AND is_active = 1 ORDER BY created_at');
      const rows = stmt.all(workspacePath) as any[];

      return rows.map(row => this.mapRowToAgent(row));
    } catch (error) {
      console.error('Error getting agents by workspace:', error);
      return [];
    }
  }

  getAgentByNameAndWorkspace(name: string, workspacePath: string): Agent | null {
    this.ensureConnection();
    
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

  // Enhanced agent management methods
  updateAgentIdentity(agentId: string, identity: any): void {
    const stmt = this.db.prepare(`
      UPDATE agents SET 
        identity_hash = ?, public_key = ?, signature = ?, fingerprint = ?,
        display_name = ?, description = ?, capabilities = ?, tags = ?, version = ?
      WHERE id = ?
    `);
    stmt.run(
      identity.identityHash,
      identity.publicKey,
      identity.signature,
      identity.fingerprint,
      identity.displayName,
      identity.description,
      JSON.stringify(identity.capabilities || []),
      JSON.stringify(identity.tags || []),
      identity.version,
      agentId
    );
  }

  updateAgentCredentials(agentId: string, credentials: any): void {
    const stmt = this.db.prepare(`
      UPDATE agents SET 
        username = ?, password_hash = ?, salt = ?, last_login = ?, 
        login_attempts = ?, locked_until = ?
      WHERE id = ?
    `);
    stmt.run(
      credentials.username,
      credentials.passwordHash,
      credentials.salt,
      credentials.lastLogin ? credentials.lastLogin.toISOString() : null,
      credentials.loginAttempts,
      credentials.lockedUntil ? credentials.lockedUntil.toISOString() : null,
      agentId
    );
  }

  getAgentByIdentityHash(identityHash: string): Agent | null {
    const stmt = this.db.prepare('SELECT * FROM agents WHERE identity_hash = ? AND is_active = 1');
    const row = stmt.get(identityHash) as any;
    return row ? this.mapRowToAgent(row) : null;
  }

  getAgentByUsername(username: string): Agent | null {
    const stmt = this.db.prepare('SELECT * FROM agents WHERE username = ? AND is_active = 1');
    const row = stmt.get(username) as any;
    return row ? this.mapRowToAgent(row) : null;
  }

  // Account deletion methods
  deleteAgent(agentId: string, createdBy?: string): boolean {
    try {
      // Check if agent exists and was created by the requesting agent
      const agent = this.getAgent(agentId);
      if (!agent) return false;
      
      if (createdBy && agent.createdBy && agent.createdBy !== createdBy) {
        throw new Error('Only the agent who created this account can delete it');
      }

      // Soft delete - mark as inactive
      const stmt = this.db.prepare('UPDATE agents SET is_active = 0 WHERE id = ?');
      const result = stmt.run(agentId);
      
      // Delete all messages to/from this agent
      this.deleteAgentMessages(agentId);
      
      // Delete all conversations involving this agent
      this.deleteAgentConversations(agentId);
      
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting agent:', error);
      return false;
    }
  }

  deleteAgentMessages(agentId: string): void {
    const stmt = this.db.prepare('DELETE FROM messages WHERE from_agent = ? OR to_agent = ?');
    stmt.run(agentId, agentId);
  }

  deleteAgentConversations(agentId: string): void {
    const stmt = this.db.prepare('DELETE FROM conversations WHERE created_by = ?');
    stmt.run(agentId);
  }

  // Bulk message operations
  bulkUpdateMessageStates(agentId: string, states: { messageIds: string[], newState: MessageState }): number {
    const placeholders = states.messageIds.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      UPDATE messages 
      SET state = ?, updated_at = ? 
      WHERE id IN (${placeholders}) AND (from_agent = ? OR to_agent = ?)
    `);
    
    const params = [states.newState, new Date().toISOString(), ...states.messageIds, agentId, agentId];
    const result = stmt.run(...params);
    return result.changes;
  }

  bulkMarkMessagesAsRead(agentId: string, messageIds: string[]): number {
    if (messageIds.length === 0) return 0;
    
    const placeholders = messageIds.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      UPDATE messages 
      SET is_read = 1, read_at = ?, state = 'read'
      WHERE id IN (${placeholders}) AND to_agent = ?
    `);
    
    const params = [new Date().toISOString(), ...messageIds, agentId];
    const result = stmt.run(...params);
    return result.changes;
  }

  bulkMarkMessagesAsUnread(agentId: string, messageIds: string[]): number {
    if (messageIds.length === 0) return 0;
    
    const placeholders = messageIds.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      UPDATE messages 
      SET is_read = 0, read_at = NULL, state = 'unread'
      WHERE id IN (${placeholders}) AND to_agent = ?
    `);
    
    const params = [...messageIds, agentId];
    const result = stmt.run(...params);
    return result.changes;
  }

  deleteMessages(agentId: string, messageIds: string[]): number {
    if (messageIds.length === 0) return 0;
    
    const placeholders = messageIds.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      DELETE FROM messages 
      WHERE id IN (${placeholders}) AND (from_agent = ? OR to_agent = ?)
    `);
    
    const params = [...messageIds, agentId, agentId];
    const result = stmt.run(...params);
    return result.changes;
  }

  emptyMailbox(agentId: string, query?: string): number {
    let sql = 'DELETE FROM messages WHERE to_agent = ?';
    let params = [agentId];
    
    if (query) {
      sql += ' AND (subject LIKE ? OR content LIKE ?)';
      const searchTerm = `%${query}%`;
      params.push(searchTerm, searchTerm);
    }
    
    const stmt = this.db.prepare(sql);
    const result = stmt.run(...params);
    return result.changes;
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
        id, conversation_id, from_agent, to_agent, subject, content, state, priority, expires_at, reply_to, 
        created_at, requires_reply, from_agent_name, from_agent_role, from_agent_workspace,
        to_agent_name, to_agent_role, to_agent_workspace, metadata
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      priority: row.priority as MessagePriority,
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
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
      priority: row.priority as MessagePriority,
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
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
      priority: row.priority as MessagePriority,
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
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

  // Cleanup expired messages
  cleanupExpiredMessages(): number {
    const stmt = this.db.prepare(`
      DELETE FROM messages 
      WHERE expires_at IS NOT NULL 
      AND expires_at < datetime('now')
    `);
    
    const result = stmt.run();
    return result.changes || 0;
  }

  // Get expired messages count
  getExpiredMessagesCount(): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM messages 
      WHERE expires_at IS NOT NULL 
      AND expires_at < datetime('now')
    `);
    
    const result = stmt.get() as any;
    return result.count || 0;
  }

  // Statistics
  getDatabaseStats(): any {
    try {
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

      // Get database file size (handle case where main file doesn't exist yet)
      let dbSize = 0;
      try {
        const stats = fs.statSync(this.dbPath);
        dbSize = stats.size;
      } catch (error) {
        // Main database file might not exist yet in WAL mode
        dbSize = 0;
      }

      return {
        activeAgents: activeAgents.count,
        totalMessages: totalMessages.count,
        activeConversations: activeConversations.count,
        totalLogs: totalLogs.count,
        recentMessages24h: recentMessages.count,
        databaseSizeBytes: dbSize,
        databaseSizeMb: Math.round(dbSize / (1024 * 1024) * 100) / 100
      };
    } catch (error) {
      // Return default stats if database operations fail
      return {
        activeAgents: 0,
        totalMessages: 0,
        activeConversations: 0,
        totalLogs: 0,
        recentMessages24h: 0,
        databaseSizeBytes: 0,
        databaseSizeMb: 0
      };
    }
  }

  close(): void {
    this.db.close();
  }

  // Helper method to map database row to Agent object
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
      
      // Simple authentication
      credentials: row.username ? {
        username: row.username,
        passwordHash: row.password_hash,
        salt: row.salt,
        lastLogin: row.last_login ? new Date(row.last_login) : undefined,
        loginAttempts: row.login_attempts || 0,
        lockedUntil: row.locked_until ? new Date(row.locked_until) : undefined
      } : undefined,
      
      // Additional metadata
      displayName: row.display_name || row.name,
      description: row.description,
      capabilities: row.capabilities ? JSON.parse(row.capabilities) : [],
      tags: row.tags ? JSON.parse(row.tags) : [],
      version: row.version,
      createdBy: row.created_by
    };
  }
}
