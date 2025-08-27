#!/usr/bin/env node

/**
 * Communication Server Entry Point
 * Main entry point for the MCP communication server
 */

import { CommunicationServer } from './server.js';
import { logger } from './shared/index.js';

logger.info('Communication Server v2.0.0 (Refactored)', 'STARTUP');
logger.info('Email-like messaging for AI agents', 'STARTUP');
logger.info('Use Ctrl+C to stop the server', 'STARTUP');

async function main() {
  try {
    const server = new CommunicationServer();
    await server.start();
  } catch (error) {
    logger.critical('Failed to start communication server', 'STARTUP', error as Error);
    process.exit(1);
  }
}

// Start the server
main().catch((error) => {
  logger.critical('Server startup failed', 'STARTUP', error as Error);
  process.exit(1);
});
