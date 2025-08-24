#!/usr/bin/env node
/**
 * Post-install script for Communication Server MCP
 * Automatically generates the correct local path configuration
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the package root directory (two levels up from scripts/)
const packageRoot = path.resolve(__dirname, '..');
const distPath = path.join(packageRoot, 'dist', 'index.js');

// Check if the dist file exists
if (!fs.existsSync(distPath)) {
  console.error('❌ Dist file not found. Please run "npm run build" first.');
  process.exit(1);
}

// Read the template configuration
const templatePath = path.join(packageRoot, 'mcp_example.json');
let templateContent = fs.readFileSync(templatePath, 'utf8');

// Replace the placeholder with the actual path
templateContent = templateContent.replace('{{LOCAL_DIST_PATH}}', distPath);

// Write the updated configuration
fs.writeFileSync(templatePath, templateContent);

console.log('✅ Communication Server MCP configuration updated with local path:');
console.log(`   ${distPath}`);
console.log('');
console.log('📋 Available configurations:');
console.log('   • communication-server: Use via npx (recommended for production)');
console.log('   • communication-server-dev: Use local build (for development)');
console.log('   • communication-server-smithery: Use via Smithery (for distribution)');
console.log('');
console.log('🔧 To use with Cursor:');
console.log('   1. Copy mcp_example.json to ~/.cursor/mcp.json');
console.log('   2. Choose the appropriate server configuration');
console.log('   3. Restart Cursor');
