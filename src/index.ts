#!/usr/bin/env node
/**
 * Communication Server - Email-like messaging for AI agents.
 * 
 * A simple, reliable communication system for agents across different projects.
 * Generic and portable - can be run from any directory.
 */

import { CommunicationServer } from './server.js';

async function main() {
  try {
    console.error('Communication Server v2.0.0');
    console.error('Email-like messaging for AI agents');
    console.error('Use Ctrl+C to stop the server');
    
    const server = new CommunicationServer();
    await server.run();
  } catch (error) {
    console.error('❌ Server error:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.error('\n🛑 Server stopped by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('\n🛑 Server stopped by system');
  process.exit(0);
});

// Start the server
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
