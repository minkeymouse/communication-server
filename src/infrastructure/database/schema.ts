/**
 * Database Schema Manager
 * Handles database schema creation, migrations, and index management
 */

import Database from 'better-sqlite3';

export class DatabaseSchema {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public initializeSchema(): void {
    console.log('Creating database tables...');
    this.createTables();
    this.createIndexes();
    this.runMigrations();
    this.vacuumDatabase();
    console.log('Database schema initialization completed');
  }

  private createTables(): void {
    const createTablesSQL = `
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        display_name TEXT,
        role TEXT NOT NULL DEFAULT 'general',
        capabilities TEXT,
        tags TEXT,
        version TEXT DEFAULT '1.0.0',
        signature TEXT,
        public_key TEXT,
        
        -- Authentication (ID-based, no passwords for LLM agents)
        agent_id TEXT UNIQUE,
        login_attempts INTEGER DEFAULT 0,
        locked_until TEXT,
        last_login TEXT,
        
        -- Session and status
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_seen TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        
        -- Metadata
        metadata TEXT,
        
        -- Backward compatibility fields
        workspace_path TEXT,
        description TEXT,
        api_key TEXT,
        email TEXT,
        address TEXT,
        created_by TEXT
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        from_agent_id TEXT NOT NULL,
        to_agent_id TEXT NOT NULL,
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
        
        -- Agent information (cached for performance)
        from_agent_name TEXT,
        from_agent_role TEXT,
        to_agent_name TEXT,
        to_agent_role TEXT,
        
        -- Protocol metadata
        routing_type TEXT DEFAULT 'direct',
        security_level TEXT DEFAULT 'basic',
        signature TEXT,
        metadata TEXT,
        
        -- Backward compatibility fields
        from_agent TEXT,
        to_agent TEXT,
        from_agent_workspace TEXT,
        to_agent_workspace TEXT
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        subject TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_message_at TEXT,
        message_count INTEGER DEFAULT 0,
        participants TEXT,
        metadata TEXT
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        last_activity TEXT,
        metadata TEXT
      );

      -- NEW TABLE: Human-readable message logs for oversight and querying
      CREATE TABLE IF NOT EXISTS message_logs (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        from_agent_id TEXT NOT NULL,
        to_agent_id TEXT NOT NULL,
        from_agent_name TEXT NOT NULL,
        to_agent_name TEXT NOT NULL,
        subject TEXT NOT NULL,
        content_plain TEXT NOT NULL,
        content_encrypted TEXT NOT NULL,
        priority TEXT NOT NULL DEFAULT 'normal',
        security_level TEXT NOT NULL DEFAULT 'basic',
        state TEXT NOT NULL DEFAULT 'sent',
        created_at TEXT NOT NULL,
        read_at TEXT,
        replied_at TEXT,
        thread_id TEXT,
        metadata TEXT,
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
      );

      -- NEW TABLE: Communication analytics for detailed insights
      CREATE TABLE IF NOT EXISTS communication_analytics (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        metric_type TEXT NOT NULL,
        metric_value REAL NOT NULL,
        timestamp TEXT NOT NULL,
        metadata TEXT
      );

      -- NEW TABLE: Performance metrics for monitoring
      CREATE TABLE IF NOT EXISTS performance_metrics (
        id TEXT PRIMARY KEY,
        operation_type TEXT NOT NULL,
        response_time_ms INTEGER NOT NULL,
        success INTEGER NOT NULL DEFAULT 1,
        error_message TEXT,
        timestamp TEXT NOT NULL,
        agent_id TEXT,
        metadata TEXT
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
    }
  }

  private createIndexes(): void {
    console.log('Database indexes created');
    
    // Agent indexes
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_agents_workspace ON agents(workspace_path)').run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_agents_role ON agents(role)').run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_agents_active ON agents(is_active)').run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_agents_last_seen ON agents(last_seen)').run();
    
    // Message indexes
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_messages_from_agent ON messages(from_agent_id)').run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_messages_to_agent ON messages(to_agent_id)').run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)').run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)').run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_messages_state ON messages(state)').run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_messages_priority ON messages(priority)').run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages(is_read)').run();
    
    // Session indexes
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_sessions_agent ON sessions(agent_id)').run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)').run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)').run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(is_active)').run();
    
    // Conversation indexes
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at)').run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at)').run();
    
    // NEW: Message Log indexes for improved query performance
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_message_logs_from_agent ON message_logs(from_agent_id)').run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_message_logs_to_agent ON message_logs(to_agent_id)').run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_message_logs_conversation ON message_logs(conversation_id)').run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_message_logs_thread ON message_logs(thread_id)').run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_message_logs_created_at ON message_logs(created_at)').run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_message_logs_priority ON message_logs(priority)').run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_message_logs_security ON message_logs(security_level)').run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_message_logs_state ON message_logs(state)').run();
    
    // Full-text search index for message content
    this.db.prepare('CREATE VIRTUAL TABLE IF NOT EXISTS message_logs_fts USING fts5(content_plain, subject, from_agent_name, to_agent_name)').run();
    
    // Communication Analytics indexes
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_comm_analytics_agent ON communication_analytics(agent_id)').run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_comm_analytics_type ON communication_analytics(metric_type)').run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_comm_analytics_timestamp ON communication_analytics(timestamp)').run();
    
    // Performance Metrics indexes
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_perf_metrics_type ON performance_metrics(operation_type)').run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_perf_metrics_timestamp ON performance_metrics(timestamp)').run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_perf_metrics_agent ON performance_metrics(agent_id)').run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_perf_metrics_success ON performance_metrics(success)').run();
  }

  private runMigrations(): void {
    let currentVersion = 0;
    try {
      const version = this.db.prepare('PRAGMA user_version').get() as { user_version: number };
      currentVersion = version.user_version || 0;
    } catch (e) {
      console.warn('Unable to read PRAGMA user_version, assuming 0');
      currentVersion = 0;
    }

    console.log(`Current database version: ${currentVersion}`);

    if (currentVersion < 1) {
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

    if (currentVersion < 2) {
      try {
        const hasAgents = !!this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='agents'").get();
        if (hasAgents) {
          const agentCols = this.db.prepare("PRAGMA table_info(agents)").all() as any[];
          if (!agentCols.find(c => c.name === 'agent_id')) {
            this.db.exec('ALTER TABLE agents ADD COLUMN agent_id TEXT UNIQUE');
            this.db.exec('UPDATE agents SET agent_id = id WHERE agent_id IS NULL');
          }
          
          console.log('Migration: Updated agents table for ID-based authentication');
        }
      } catch (e) {
        console.warn('Non-fatal: could not migrate authentication schema:', e);
      }
      currentVersion = 2;
    }

    try {
      this.db.exec(`PRAGMA user_version = ${currentVersion}`);
      console.log(`Database migrated to version: ${currentVersion}`);
    } catch (e) {
      console.warn('Failed to set PRAGMA user_version:', e);
    }
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
}
