/**
 * Communication Server
 * MCP Server for Agentic Communications
 * Refactored for better maintainability and modularity
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ServerManager } from './server/index.js';
import { logger } from './shared/index.js';

export class CommunicationServer {
  private serverManager: ServerManager;
  private transport: StdioServerTransport;

  constructor() {
    this.serverManager = new ServerManager();
    this.transport = new StdioServerTransport();
    this.setupGracefulShutdown();
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`, 'SHUTDOWN');
      await this.serverManager.shutdown();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('uncaughtException', (error) => {
      logger.critical('Uncaught Exception', 'SYSTEM', error);
      shutdown('uncaughtException');
    });
    process.on('unhandledRejection', (reason) => {
      logger.critical('Unhandled Rejection', 'SYSTEM', new Error(String(reason)));
      shutdown('unhandledRejection');
    });
  }

  async start(): Promise<void> {
    try {
      const server = this.serverManager.getServer();
      await server.connect(this.transport);
      
      const config = this.serverManager.getConfig();
      const serverInfo = config.getServerInfo();
      
      logger.logServerStart(serverInfo);
      logger.info('💡 Use Ctrl+C to stop the server', 'SERVER');
      
    } catch (error) {
      logger.critical('Failed to start server', 'STARTUP', error as Error);
      process.exit(1);
    }
  }

  getServerManager(): ServerManager {
    return this.serverManager;
  }
}

// Main entry point
async function main() {
  const server = new CommunicationServer();
  await server.start();
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.critical('Server startup failed', 'STARTUP', error as Error);
    process.exit(1);
  });
}
