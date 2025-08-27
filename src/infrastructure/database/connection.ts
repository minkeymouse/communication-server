/**
 * Database Connection Manager
 * Handles database connection setup, initialization, and cleanup
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { execSync } from 'child_process';

export class DatabaseConnection {
  private db!: Database.Database;
  private dbPath: string;
  private connected: boolean = false;
  private connectionRetries: number = 0;
  private readonly MAX_RETRIES = 3;

  constructor(dbPath?: string) {
    const instanceId = process.env.MCP_SERVER_ID || 'default';
    
    if (!dbPath) {
      const dataDir = path.join(os.homedir(), '.communication-server', instanceId, 'data');
      fs.mkdirSync(dataDir, { recursive: true });
      dbPath = path.join(dataDir, 'communication.db');
    }

    console.log(`🗄️ Initializing database for instance '${instanceId}' at:`, dbPath);
    this.dbPath = dbPath;
    
    this.handleConflictingProcesses();
    this.initializeConnection();
  }

  private handleConflictingProcesses(): void {
    try {
      const autoClean = process.env.MCP_AUTOCLEAN_DB_LOCKS === 'true';
      if (!autoClean) {
        return;
      }

      const output = execSync(`lsof "${this.dbPath}" 2>/dev/null || true`, { encoding: 'utf8' }).trim();

      if (output) {
        console.log(`⚠️ Found processes using database: ${this.dbPath}`);
        console.log('Attempting non-destructive WAL/SHM cleanup (opt-in)...');
        this.cleanupDatabaseFiles();
      }
    } catch (error) {
      console.log('Process detection failed, continuing...');
    }
  }

  private cleanupDatabaseFiles(): void {
    try {
      const dbDir = path.dirname(this.dbPath);
      const dbName = path.basename(this.dbPath, '.db');
      
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
      const dbExists = fs.existsSync(this.dbPath);
      
      if (dbExists) {
        console.log('📂 Using existing database');
      } else {
        console.log('🆕 Creating new database');
      }
      
      this.db = new Database(this.dbPath);
      this.connected = true;
      this.connectionRetries = 0;
      console.log('Database connection established');
      
      this.configureDatabase();
      console.log('Database configuration completed');
    } catch (error: any) {
      console.error('Database connection failed:', error);
      this.handleConnectionError(error);
    }
  }

  private configureDatabase(): void {
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

  public getDatabase(): Database.Database {
    if (!this.connected || !this.db) {
      throw new Error('Database not connected');
    }
    return this.db;
  }

  public getDbPath(): string {
    return this.dbPath;
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public close(): void {
    if (this.db) {
      this.db.close();
      this.connected = false;
    }
  }
}
