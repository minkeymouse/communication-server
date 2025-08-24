#!/usr/bin/env node
/**
 * Setup script for Communication Server MCP
 * Automatically installs and configures the server for Cursor
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the package root directory
const packageRoot = path.resolve(__dirname, '..');
const cursorConfigPath = path.join(os.homedir(), '.cursor', 'mcp.json');

console.log('🚀 Setting up Communication Server MCP...\n');

// Step 1: Build the project
console.log('📦 Building the project...');
try {
  const { execSync } = await import('child_process');
  execSync('npm run build', { cwd: packageRoot, stdio: 'inherit' });
  console.log('✅ Build completed successfully\n');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}

// Step 2: Run postinstall script
console.log('🔧 Updating configuration...');
try {
  const { execSync } = await import('child_process');
  execSync('node scripts/postinstall.js', { cwd: packageRoot, stdio: 'inherit' });
  console.log('✅ Configuration updated\n');
} catch (error) {
  console.error('❌ Configuration update failed:', error.message);
  process.exit(1);
}

// Step 3: Copy configuration to Cursor
console.log('📋 Setting up Cursor configuration...');
try {
  // Ensure .cursor directory exists
  const cursorDir = path.dirname(cursorConfigPath);
  if (!fs.existsSync(cursorDir)) {
    fs.mkdirSync(cursorDir, { recursive: true });
  }

  // Read the updated configuration
  const configPath = path.join(packageRoot, 'mcp_example.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  // Check if Cursor config already exists
  let cursorConfig = {};
  if (fs.existsSync(cursorConfigPath)) {
    try {
      cursorConfig = JSON.parse(fs.readFileSync(cursorConfigPath, 'utf8'));
    } catch (error) {
      console.warn('⚠️  Existing Cursor config is invalid, creating new one');
    }
  }

  // Merge configurations
  cursorConfig.mcpServers = {
    ...cursorConfig.mcpServers,
    ...config.mcpServers
  };

  // Write the updated configuration
  fs.writeFileSync(cursorConfigPath, JSON.stringify(cursorConfig, null, 2));
  console.log('✅ Cursor configuration updated\n');
} catch (error) {
  console.error('❌ Failed to update Cursor configuration:', error.message);
  process.exit(1);
}

console.log('🎉 Setup completed successfully!');
console.log('');
console.log('📋 Available server configurations:');
console.log('   • communication-server: Use via npx (recommended for production)');
console.log('   • communication-server-dev: Use local build (for development)');
console.log('   • communication-server-smithery: Use via Smithery (for distribution)');
console.log('');
console.log('🔧 Next steps:');
console.log('   1. Restart Cursor to load the new configuration');
console.log('   2. Test the tools by listing available MCP tools');
console.log('   3. Try creating an agent: await create_agent({ path: "/your/project/path" })');
console.log('');
console.log('📚 For more information, see README.md');
