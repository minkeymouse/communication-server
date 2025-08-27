#!/usr/bin/env node
/**
 * Setup script for Communication Server MCP
 * Automatically configures Cursor's MCP settings
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the package root directory (two levels up from scripts/)
const packageRoot = path.resolve(__dirname, '..');
const cursorConfigPath = path.join(os.homedir(), '.cursor', 'mcp.json');

// Communication server configuration
const communicationServerConfig = {
  "command": "communication-server-mcp",
  "args": [],
  "env": {
    "MCP_SERVER_ID": "comm-server",
    "NODE_ENV": "production"
  }
};

// Read existing Cursor MCP configuration
let cursorConfig = { mcpServers: {} };

if (fs.existsSync(cursorConfigPath)) {
  try {
    const existingConfig = fs.readFileSync(cursorConfigPath, 'utf8');
    cursorConfig = JSON.parse(existingConfig);
    
    // Ensure mcpServers object exists
    if (!cursorConfig.mcpServers) {
      cursorConfig.mcpServers = {};
    }
  } catch (error) {
    console.error('❌ Error reading existing Cursor MCP configuration:', error.message);
    process.exit(1);
  }
}

// Add or update communication server configuration
cursorConfig.mcpServers["communication-server"] = communicationServerConfig;

// Write the updated configuration
try {
  // Ensure .cursor directory exists
  const cursorDir = path.dirname(cursorConfigPath);
  if (!fs.existsSync(cursorDir)) {
    fs.mkdirSync(cursorDir, { recursive: true });
  }
  
  fs.writeFileSync(cursorConfigPath, JSON.stringify(cursorConfig, null, 2));
  
  console.log('✅ Communication Server MCP configuration added to Cursor!');
  console.log(`   Configuration file: ${cursorConfigPath}`);
  console.log('');
  console.log('📋 Current MCP servers:');
  Object.keys(cursorConfig.mcpServers).forEach(serverName => {
    console.log(`   • ${serverName}`);
  });
  console.log('');
  console.log('🔄 Please restart Cursor to load the new MCP configuration.');
  console.log('');
  console.log('🧪 To test the server:');
  console.log('   echo \'{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}\' | communication-server-mcp');
  
} catch (error) {
  console.error('❌ Error writing Cursor MCP configuration:', error.message);
  process.exit(1);
}
