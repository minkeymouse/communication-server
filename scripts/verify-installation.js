#!/usr/bin/env node
/**
 * Verification script for Communication Server MCP installation
 * Checks if the server is properly installed and configured
 */

import { spawn, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const cursorConfigPath = path.join(os.homedir(), '.cursor', 'mcp.json');

console.log('🔍 Verifying Communication Server MCP installation...\n');

// Check 1: Configuration file exists
console.log('1. Checking MCP configuration...');
if (fs.existsSync(cursorConfigPath)) {
  try {
    const config = JSON.parse(fs.readFileSync(cursorConfigPath, 'utf8'));
    if (config.mcpServers && config.mcpServers['communication-server']) {
      console.log('   ✅ MCP configuration found and contains communication-server');
    } else {
      console.log('   ❌ MCP configuration found but missing communication-server entry');
    }
  } catch (error) {
    console.log('   ❌ Error reading MCP configuration:', error.message);
  }
} else {
  console.log('   ❌ MCP configuration file not found at:', cursorConfigPath);
}

// Check 2: Binary is executable
console.log('\n2. Checking binary permissions...');
try {
  const binaryPath = execSync('which communication-server-mcp', { encoding: 'utf8' }).trim();
  console.log('   ✅ communication-server-mcp binary found');
  
  // Check if it's executable
  const stats = fs.statSync(binaryPath);
  if (stats.mode & 0o111) {
    console.log('   ✅ Binary is executable');
  } else {
    console.log('   ❌ Binary is not executable');
  }
} catch (error) {
  console.log('   ❌ communication-server-mcp binary not found in PATH');
}

// Check 3: Server responds to basic request
console.log('\n3. Testing server response...');
try {
  const testRequest = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
    params: {}
  });

  const server = spawn('communication-server-mcp', [], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let response = '';
  let error = '';

  server.stdout.on('data', (data) => {
    response += data.toString();
  });

  server.stderr.on('data', (data) => {
    error += data.toString();
  });

  server.on('close', (code) => {
    if (code === 0 && response.trim()) {
      try {
        const parsed = JSON.parse(response.trim());
        if (parsed.result && parsed.result.tools) {
          console.log('   ✅ Server responds correctly with tools list');
          console.log(`   📋 Found ${parsed.result.tools.length} tools`);
        } else {
          console.log('   ⚠️  Server responds but unexpected format');
        }
      } catch (parseError) {
        console.log('   ❌ Server response is not valid JSON');
        console.log('   Response:', response.trim());
      }
    } else {
      console.log('   ❌ Server failed to respond properly');
      if (error) {
        console.log('   Error output:', error.trim());
      }
    }
  });

  server.stdin.write(testRequest + '\n');
  server.stdin.end();

  // Wait for response
  setTimeout(() => {
    if (!response) {
      console.log('   ⚠️  Server did not respond within 2 seconds (this might be normal)');
    }
  }, 2000);
} catch (error) {
  console.log('   ❌ Failed to test server:', error.message);
}

// Check 4: CLI commands available
console.log('\n4. Checking CLI commands...');
try {
  execSync('communication-server --help', { stdio: 'pipe' });
  console.log('   ✅ CLI commands available');
} catch (error) {
  console.log('   ❌ CLI commands not available');
}

console.log('\n📋 Summary:');
console.log('If you see any ❌ errors above, please:');
console.log('1. Reinstall the package: sudo npm install -g communication-server-mcp');
console.log('2. Restart Cursor');
console.log('3. Wait 10-30 seconds for MCP server registration');
console.log('4. Run this verification again: node scripts/verify-installation.js');
console.log('\nIf everything shows ✅, the installation is working correctly!');
