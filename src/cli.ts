#!/usr/bin/env node
/**
 * CLI entry point for Communication Server
 * Handles: clean, stop, start, reinitialize commands
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const COMMANDS = {
  clean: 'clean',
  stop: 'stop', 
  start: 'start',
  reinitialize: 'reinitialize'
} as const;

type Command = typeof COMMANDS[keyof typeof COMMANDS];

class CommunicationServerCLI {
  private tmuxSession = 'comm-server';
  private logDir = path.join(os.homedir(), '.communication-server', 'logs');
  private dataDir = path.join(os.homedir(), '.communication-server');

  constructor() {
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private async executeCommand(command: string, args: string[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { 
        stdio: 'inherit',
        shell: true 
      });
      
      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command failed with exit code ${code}`));
        }
      });
      
      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  private async isServerRunning(): Promise<boolean> {
    try {
      await this.executeCommand('tmux', ['has-session', '-t', this.tmuxSession]);
      return true;
    } catch {
      return false;
    }
  }

  async clean(): Promise<void> {
    console.log('🧹 Cleaning communication server...');
    
    // Stop server if running
    if (await this.isServerRunning()) {
      console.log('⏹️  Stopping server...');
      await this.stop();
    }

    // Remove database files
    const dbPath = path.join(this.dataDir, 'default', 'data', 'communication.db');
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
      console.log('🗄️  Database removed');
    }

    // Remove log files
    const logFiles = fs.readdirSync(this.logDir);
    for (const file of logFiles) {
      if (file.endsWith('.log')) {
        fs.unlinkSync(path.join(this.logDir, file));
      }
    }
    console.log('📝 Logs cleaned');

    console.log('✅ Clean completed');
  }

  async stop(): Promise<void> {
    console.log('⏹️  Stopping communication server...');
    
    try {
      // Kill tmux session
      await this.executeCommand('tmux', ['kill-session', '-t', this.tmuxSession]);
      console.log('📺 Tmux session killed');
    } catch (error) {
      console.log('📺 No tmux session found');
    }

    // Kill any remaining processes
    try {
      await this.executeCommand('pkill', ['-f', 'communication-server-mcp']);
      console.log('🔪 Processes killed');
    } catch (error) {
      console.log('🔪 No processes found');
    }

    console.log('✅ Stop completed');
  }

  async start(): Promise<void> {
    console.log('🚀 Starting communication server...');
    
    // Stop if already running
    if (await this.isServerRunning()) {
      console.log('⚠️  Server already running, stopping first...');
      await this.stop();
    }

    // Start server in tmux
    const logFile = path.join(this.logDir, `server-${Date.now()}.log`);
    const tmuxCommand = `communication-server-mcp > ${logFile} 2>&1`;
    
    await this.executeCommand('tmux', [
      'new-session', 
      '-d', 
      '-s', 
      this.tmuxSession, 
      tmuxCommand
    ]);

    // Wait a moment for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check if server started successfully
    if (await this.isServerRunning()) {
      console.log('✅ Server started successfully');
      console.log(`📝 Logs: ${logFile}`);
      console.log('🔗 MCP tools available in Cursor');
    } else {
      throw new Error('Failed to start server');
    }
  }

  async reinitialize(): Promise<void> {
    console.log('🔄 Reinitializing communication server...');
    
    // Stop server
    await this.stop();
    
    // Clean everything
    await this.clean();
    
    // Start fresh
    await this.start();
    
    console.log('✅ Reinitialization completed');
  }

  async run(): Promise<void> {
    const args = process.argv.slice(2);
    const command = args[0] as Command;

    if (!command || !Object.values(COMMANDS).includes(command)) {
      console.log('Usage: communication-server <command>');
      console.log('');
      console.log('Commands:');
      console.log('  clean         - Clean database and reset state');
      console.log('  stop          - Stop running server');
      console.log('  start         - Start server in background');
      console.log('  reinitialize  - Reset and restart server');
      process.exit(1);
    }

    try {
      switch (command) {
        case COMMANDS.clean:
          await this.clean();
          break;
        case COMMANDS.stop:
          await this.stop();
          break;
        case COMMANDS.start:
          await this.start();
          break;
        case COMMANDS.reinitialize:
          await this.reinitialize();
          break;
      }
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }
}

// Run CLI
const cli = new CommunicationServerCLI();
cli.run().catch((error) => {
  console.error('❌ CLI Error:', error);
  process.exit(1);
});
