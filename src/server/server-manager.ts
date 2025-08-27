/**
 * Server Manager
 * Handles server lifecycle and initialization
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { ConfigManager, ServerConfig } from './config.js';
import { TOOLS_DEFINITION } from './tools-definition.js';
import { DatabaseManager } from '../infrastructure/index.js';
import { MessageQueue, ConversationThreadManager, AgentMonitor } from '../services/index.js';
import { SecurityManager, AnalyticsManager, RateLimiter } from '../infrastructure/index.js';
import { ServerToolsHandler } from '../application/index.js';
import { logger } from '../shared/index.js';

export class ServerManager {
  private server!: Server;
  private config: ConfigManager;
  private db!: DatabaseManager;
  private messageQueue!: MessageQueue;
  private threadManager!: ConversationThreadManager;
  private agentMonitor!: AgentMonitor;
  private securityManager!: SecurityManager;
  private analyticsManager!: AnalyticsManager;
  private rateLimiter!: RateLimiter;
  private toolsHandler!: ServerToolsHandler;
  private startTime: Date;

  constructor(config?: Partial<ServerConfig>) {
    this.config = new ConfigManager(config);
    this.startTime = new Date();
    
    this.initializeServer();
    this.initializeServices();
    this.setupRequestHandlers();
  }

  private initializeServer(): void {
    const serverInfo = this.config.getServerInfo();
    
    this.server = new Server(
      {
        name: serverInfo.name,
        version: serverInfo.version,
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );
  }

  private initializeServices(): void {
    this.db = new DatabaseManager();
    this.messageQueue = new MessageQueue();
    this.threadManager = new ConversationThreadManager();
    this.agentMonitor = new AgentMonitor();
    this.securityManager = new SecurityManager();
    this.analyticsManager = new AnalyticsManager();
    this.rateLimiter = new RateLimiter();
    
    this.toolsHandler = new ServerToolsHandler(
      this.db,
      this.messageQueue,
      this.threadManager,
      this.agentMonitor,
      this.securityManager,
      this.analyticsManager,
      this.rateLimiter
    );
  }

  private setupRequestHandlers(): void {
    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        const result = await this.toolsHandler.handleTool(name, args);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error: any) {
        throw error;
      }
    });

    // Handle tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools: TOOLS_DEFINITION };
    });
  }

  getServer(): Server {
    return this.server;
  }

  getConfig(): ConfigManager {
    return this.config;
  }

  getServices() {
    return {
      db: this.db,
      messageQueue: this.messageQueue,
      threadManager: this.threadManager,
      agentMonitor: this.agentMonitor,
      securityManager: this.securityManager,
      analyticsManager: this.analyticsManager,
      rateLimiter: this.rateLimiter,
      toolsHandler: this.toolsHandler
    };
  }

  getUptime(): number {
    return Date.now() - this.startTime.getTime();
  }

  async shutdown(): Promise<void> {
    logger.logServerShutdown();
    
    try {
      // Close database connections
      if (this.db) {
        await this.db.close();
      }
      
      logger.logServerShutdownComplete();
    } catch (error) {
      logger.error('Error during shutdown', 'SHUTDOWN', error as Error);
    }
  }
}
