#!/usr/bin/env node
/**
 * Post-install script for Communication Server MCP
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
  
  console.log('✅ Communication Server MCP automatically configured!');
  console.log(`   Configuration file: ${cursorConfigPath}`);
  console.log('');
  console.log('📋 Current MCP servers:');
  Object.keys(cursorConfig.mcpServers).forEach(serverName => {
    console.log(`   • ${serverName}`);
  });
  console.log('');
  console.log('🔄 Please restart Cursor to load the new MCP configuration.');
  console.log('');
  console.log('⏰ Important: After restarting Cursor, wait 10-30 seconds for the MCP server to register.');
  console.log('');
  console.log('🧪 To verify the installation works:');
  console.log('   1. Restart Cursor');
  console.log('   2. Wait 10-30 seconds');
  console.log('   3. Test: echo \'{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}\' | communication-server-mcp');
  console.log('');
  console.log('🔧 Available CLI commands:');
  console.log('   • communication-server clean    - Clean server data and logs');
  console.log('   • communication-server stop     - Stop the server');
  console.log('   • communication-server start    - Start the server');
  console.log('   • communication-server reinitialize - Reinitialize the server');
  
} catch (error) {
  console.error('❌ Error writing Cursor MCP configuration:', error.message);
  process.exit(1);
}
