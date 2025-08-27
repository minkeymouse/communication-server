/**
 * Simplified Server Tools Handler
 * Orchestrates tool operations by delegating to specialized handlers
 */

import { DatabaseManager } from '../../infrastructure/database/database.js';
import { MessageQueue } from '../../services/communication/message-queue.js';
import { ConversationThreadManager } from '../../services/communication/conversation-thread.js';
import { AgentMonitor } from '../../services/agent-monitor.js';
import { SecurityManager } from '../../infrastructure/security/security.js';
import { AnalyticsManager } from '../../infrastructure/analytics/analytics.js';
import { RateLimiter } from '../../infrastructure/analytics/rate-limiter.js';
import { AgentHandler } from './agent-handler.js';
import { CommunicationHandler } from './communication-handler.js';
import { MessageHandler } from './message-handler.js';
import { SystemHandler } from './system-handler.js';

export class ServerToolsHandler {
  private agentHandler: AgentHandler;
  private communicationHandler: CommunicationHandler;
  private messageHandler: MessageHandler;
  private systemHandler: SystemHandler;

  constructor(
    private db: DatabaseManager,
    private messageQueue: MessageQueue,
    private threadManager: ConversationThreadManager,
    private agentMonitor: AgentMonitor,
    private securityManager: SecurityManager,
    private analyticsManager: AnalyticsManager,
    private rateLimiter: RateLimiter
  ) {
    this.agentHandler = new AgentHandler(db, agentMonitor);
    this.communicationHandler = new CommunicationHandler(
      db, messageQueue, threadManager, agentMonitor, 
      securityManager, analyticsManager, rateLimiter
    );
    this.messageHandler = new MessageHandler(db);
    this.systemHandler = new SystemHandler(
      db, agentMonitor, analyticsManager, securityManager, rateLimiter
    );
  }

  async handleTool(name: string, args: any): Promise<any> {
    switch (name) {
      case 'create_agent':
        return await this.agentHandler.handleCreateAgent(args);
      
      case 'login':
        return await this.agentHandler.handleLogin(args);
      
      case 'communicate':
        return await this.communicationHandler.handleCommunicate(args);
      
      case 'manage_messages':
        return await this.messageHandler.handleManageMessages(args);
      
      case 'discover_agents':
        return await this.agentHandler.handleDiscoverAgents(args);
      
      case 'get_templates':
        return await this.systemHandler.handleGetTemplates(args);
      
      case 'system_status':
        return await this.systemHandler.handleSystemStatus(args);
      
      case 'query_messages':
        return await this.systemHandler.handleQueryMessages(args);
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }
}
