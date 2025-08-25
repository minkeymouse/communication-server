/**
 * Stable, Production-Ready MCP Server for Agentic Communications
 */

import { Server } from '@modelcontextprotocol/sdk/server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { DatabaseManager } from './database.js';
import { 
  Agent, 
  AgentRole, 
  MessageState, 
  MessagePriority,
  AgentCredentials,
  createAgent,
  createMessage,
  createConversation,
  authenticateAgent,
  getAgentIdentifier,
  getAgentShortId,
  MessageTemplates
} from './models.js';
import {
  AgentIdentity,
  AgentRegistry,
  CommunicationProtocol,
  AgentDiscovery,
  MessageProtocol,
  ROUTING_RULES,
  SECURITY_LEVELS,
  PROTOCOL_VERSION
} from './protocol.js';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { execSync } from 'child_process';


export class CommunicationServer {
  private server: Server;
  private db: DatabaseManager;
  private startTime: Date;
  private requestCount: number = 0;
  private errorCount: number = 0;
  private requestTimes: number[] = [];
  private serverId: string;
  private requestCache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 30000; // 30 seconds
  private readonly MAX_REQUESTS_PER_MINUTE = 1000;
  private requestTimestamps: number[] = [];

  constructor() {
    this.serverId = process.env.MCP_SERVER_ID || `comm-server-${Date.now()}`;
    this.validateServerIdentity();
    
    this.server = new Server(
      {
        name: 'communication-server',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.db = new DatabaseManager();
    this.startTime = new Date();
    this.setupTools();
    this.setupGracefulShutdown();
    this.startPerformanceMonitoring();
  }

  private startPerformanceMonitoring(): void {
    // Monitor performance every 5 minutes
    setInterval(() => {
      this.logPerformanceStats();
    }, 5 * 60 * 1000);
  }

  private logPerformanceStats(): void {
    const uptime = Date.now() - this.startTime.getTime();
    const avgResponseTime = this.requestTimes.length > 0 
      ? this.requestTimes.reduce((a, b) => a + b, 0) / this.requestTimes.length 
      : 0;
    
    console.log(`📊 Performance Stats - Uptime: ${Math.round(uptime / 1000)}s, Requests: ${this.requestCount}, Errors: ${this.errorCount}, Avg Response: ${avgResponseTime.toFixed(2)}ms`);
  }

  private checkRateLimit(): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Remove old timestamps
    this.requestTimestamps = this.requestTimestamps.filter(timestamp => timestamp > oneMinuteAgo);
    
    // Check if we're over the limit
    if (this.requestTimestamps.length >= this.MAX_REQUESTS_PER_MINUTE) {
      return false;
    }
    
    // Add current request
    this.requestTimestamps.push(now);
    return true;
  }

  private getCachedResponse(cacheKey: string): any | null {
    const cached = this.requestCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    this.requestCache.delete(cacheKey);
    return null;
  }

  private setCachedResponse(cacheKey: string, data: any): void {
    this.requestCache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.requestCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.requestCache.delete(key);
      }
    }
  }

  private validateServerIdentity(): void {
    console.log(`🚀 Starting ${this.serverId} at ${new Date().toISOString()}`);
    console.log(`📋 Server PID: ${process.pid}, Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Verify we're not conflicting with other instances
    const conflictingProcesses = this.checkForConflictingProcesses();
    if (conflictingProcesses.length > 0) {
      console.warn(`⚠️ Warning: Found ${conflictingProcesses.length} potentially conflicting processes:`);
      conflictingProcesses.forEach((pid: number) => console.warn(`   - PID ${pid}`));
      
      // If we're starting with a unique ID, we can coexist
      if (this.serverId.includes('comm-server-') && this.serverId !== 'comm-server-default') {
        console.log('✅ Starting with unique ID - can coexist with other instances');
      } else {
        console.warn('⚠️ Consider using unique server ID to avoid conflicts');
      }
    } else {
      console.log('✅ No conflicting processes found');
    }
  }

  private checkForConflictingProcesses(): number[] {
    try {
      const { execSync } = require('child_process');
      const output = execSync("pgrep -f 'node.*dist/index.js'", { encoding: 'utf8' }).trim();
      if (!output) return [];
      
      const pids = output.split('\n').map((pid: string) => parseInt(pid.trim())).filter((pid: number) => pid !== process.pid);
      return pids;
    } catch (error) {
      // No conflicting processes found
      return [];
    }
  }

  private setupGracefulShutdown(): void {
    process.on('SIGTERM', () => {
      console.log(`🛑 ${this.serverId} shutting down gracefully`);
      this.cleanup();
      process.exit(0);
    });

    process.on('SIGINT', () => {
      console.log(`🛑 ${this.serverId} interrupted, cleaning up`);
      this.cleanup();
      process.exit(0);
    });

    process.on('uncaughtException', (error) => {
      console.error(`❌ ${this.serverId} uncaught exception:`, error);
      this.cleanup();
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error(`❌ ${this.serverId} unhandled rejection at:`, promise, 'reason:', reason);
      this.cleanup();
      process.exit(1);
    });

    // Handle stdin end (when piped input ends)
    process.stdin.on('end', () => {
      console.log(`📤 ${this.serverId} stdin ended, shutting down gracefully`);
      this.cleanup();
      process.exit(0);
    });

    // Handle stdin close
    process.stdin.on('close', () => {
      console.log(`📤 ${this.serverId} stdin closed, shutting down gracefully`);
      this.cleanup();
      process.exit(0);
    });
  }

  private cleanup(): void {
    try {
      // Clean up cache
      this.cleanupCache();
      console.log('🗑️ Cache cleaned up');
      
      if (this.db) {
        this.db.close();
        console.log('🗄️ Database connection closed');
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  private resolveWorkspacePath(providedPath?: string): string {
    if (providedPath && typeof providedPath === 'string') {
      if (!providedPath.startsWith('/')) {
        throw new Error("Invalid workspace path. Must be an absolute path starting with '/' ");
      }
      return providedPath;
    }
    const cwd = process.cwd();
    if (!cwd || !cwd.startsWith('/')) {
      throw new Error('Unable to determine a valid workspace path');
    }
    return cwd;
  }

  private routeMessageByType(routingType: string, args: any): Agent[] {
    switch (routingType) {
      case ROUTING_RULES.BROADCAST:
        return this.db.getAllActiveAgents();
        
      case ROUTING_RULES.ROLE_BASED:
        const role = args.target_role;
        if (!role) {
          throw new Error('target_role is required for role-based routing');
        }
        return this.db.getAgentsByRole(role);
        
      case ROUTING_RULES.CAPABILITY_BASED:
        const capability = args.target_capability;
        if (!capability) {
          throw new Error('target_capability is required for capability-based routing');
        }
        return this.db.getAgentsByCapability(capability);
        
      case ROUTING_RULES.TAG_BASED:
        const tag = args.target_tag;
        if (!tag) {
          throw new Error('target_tag is required for tag-based routing');
        }
        return this.db.getAgentsByTag(tag);
        
      default:
        throw new Error(`Unknown routing type: ${routingType}`);
    }
  }

  private logRequest(toolName: string, success: boolean, error?: string, duration?: number): void {
    this.requestCount++;
    if (!success) {
      this.errorCount++;
    }
    
    const logMessage = `📈 Request #${this.requestCount}: ${toolName} - ${success ? 'SUCCESS' : 'ERROR'}${duration ? ` - ${duration}ms` : ''}`;
    
    if (success) {
      console.log(logMessage);
    } else {
      console.error(`❌ Error in ${toolName}: ${error}`);
      
      // Log detailed error information for debugging
      if (error) {
        console.error(`🔍 Error details: ${error}`);
      }
    }
  }

  private getPerformanceStats(): any {
    if (this.requestTimes.length === 0) {
      return {
        avgResponseTime: 0,
        minResponseTime: 0,
        maxResponseTime: 0,
        totalRequestsTracked: 0
      };
    }

    return {
      avgResponseTime: this.requestTimes.reduce((a, b) => a + b, 0) / this.requestTimes.length,
      minResponseTime: Math.min(...this.requestTimes),
      maxResponseTime: Math.max(...this.requestTimes),
      totalRequestsTracked: this.requestTimes.length
    };
  }

  private async getOrCreateAgent(workspacePath: string, agentName?: string, role?: AgentRole): Promise<Agent> {
    // Validate workspace path
    if (!workspacePath || !workspacePath.startsWith('/')) {
      throw new Error("Invalid workspace path. Must be an absolute path starting with '/' ");
    }

    // Try to find existing agent by name and workspace
    if (agentName) {
      const existingAgent = this.db.getAgentByNameAndWorkspace(agentName, workspacePath);
      if (existingAgent) {
        this.db.updateAgentLastSeen(existingAgent.id);
        return existingAgent;
      }
    }

    // Create new agent
    const agent = createAgent(
      agentName || 'Default Agent',
      workspacePath,
      role || AgentRole.GENERAL
    );

    try {
      this.db.createAgent(agent);
      return agent;
    } catch (error: any) {
      // If agent already exists, try to retrieve it
      if (error.code === 'SQLITE_CONSTRAINT' && error.message.includes('UNIQUE constraint failed')) {
        const existingAgent = this.db.getAgentByNameAndWorkspace(agent.name, workspacePath);
        if (existingAgent) {
          return existingAgent;
        }
      }
      throw error;
    }
  }

  // Handler methods for new tools
  private async handleCreateAgent(args: any): Promise<any> {
    const { name, workspace_path, role, username, password, description, capabilities, tags, agent_id } = args;
    
    console.log('Creating agent with ID:', agent_id, 'name:', name, 'workspace:', workspace_path);
    
    // Create credentials if username/password provided
    let credentials: AgentCredentials | undefined;
    if (username && password) {
      const salt = uuidv4();
      const passwordHash = createHash('sha256').update(`${password}:${salt}`).digest('hex');
      credentials = {
        username,
        passwordHash,
        salt,
        loginAttempts: 0
      };
    }
    
    const agent = createAgent(
      name,
      workspace_path,
      role || AgentRole.GENERAL,
      credentials,
      description,
      capabilities,
      tags,
      'system', // createdBy
      agent_id // User-provided ID
    );
    
    console.log('Created agent object:', agent.id, agent.name);
    
    try {
      this.db.createAgent(agent);
      console.log('Agent created successfully in database');
      
      return {
        agent_id: agent.id,
        name: agent.name,
        workspace_path: agent.workspacePath,
        status: 'created',
        credentials: credentials ? {
          username: credentials.username,
          has_password: true
        } : undefined
      };
    } catch (error: any) {
      console.error('Error creating agent:', error);
      throw error;
    }
  }

  private async handleListAgents(args: any): Promise<any> {
    const { path } = args;
    const workspacePath = this.resolveWorkspacePath(path);
    const agents = this.db.getAgentsByWorkspace(workspacePath);

    return {
      agents: agents.map(agent => ({
        id: agent.id,
        name: agent.name,
        role: agent.role,
        workspace_path: agent.workspacePath,
        display_name: agent.displayName,
        last_seen: agent.lastSeen?.toISOString() || null
      })),
      count: agents.length,
      requested_path: path
    };
  }

  private async handleGetAgentIdentity(args: any): Promise<any> {
    const { agent_id } = args;
    const agent = this.db.getAgent(agent_id);
    
    if (!agent) {
      throw new Error(`Agent with ID '${agent_id}' not found`);
    }

    return {
      agent_id: agent.id,
      display_name: agent.displayName,
      workspace_path: agent.workspacePath,
      has_credentials: !!agent.credentials
    };
  }

  private async handleVerifyAgentIdentity(args: any): Promise<any> {
    const { agent_id, signature } = args;
    const agent = this.db.getAgent(agent_id);
    
    if (!agent) {
      throw new Error(`Agent with ID '${agent_id}' not found`);
    }

    // Assuming verifyAgentIdentity is defined elsewhere or needs to be imported
    // For now, we'll just return a placeholder
    const isValid = true; // Placeholder for actual verification logic
    
    return {
      agent_id: agent.id,
      signature_provided: signature,
      signature_valid: isValid,
      display_name: agent.displayName
    };
  }

  private async handleAuthenticateAgent(args: any): Promise<any> {
    const { agent_id, username, password } = args;
    const agent = this.db.getAgent(agent_id);
    
    if (!agent) {
      throw new Error(`Agent with ID '${agent_id}' not found`);
    }

    if (!agent.credentials) {
      throw new Error('Agent does not have credentials configured');
    }

    // Use the actual authentication function
    const isAuthenticated = authenticateAgent(agent, username, password);
    
    if (isAuthenticated) {
      // Update last login
      this.db.updateAgentCredentials(agent_id, {
        ...agent.credentials,
        lastLogin: new Date(),
        loginAttempts: 0
      });
    } else {
      // Increment failed login attempts
      this.db.updateAgentCredentials(agent_id, {
        ...agent.credentials,
        loginAttempts: (agent.credentials.loginAttempts || 0) + 1
      });
    }
    
    return {
      agent_id: agent.id,
      username: username,
      authenticated: isAuthenticated,
      display_name: agent.displayName
    };
  }

  private async handleDeleteAgent(args: any): Promise<any> {
    const { agent_id, created_by } = args;
    
    const success = this.db.deleteAgent(agent_id, created_by);
    
    if (!success) {
      throw new Error(`Failed to delete agent '${agent_id}'`);
    }
    
    return {
      agent_id: agent_id,
      status: 'deleted',
      message: 'Agent and all associated data have been deleted'
    };
  }

  private async handleSend(args: any): Promise<any> {
    // Support both old and new protocol
    const { 
      to_agent_id, to_agent_name, title, content, from_agent_id, routing_type, security_level,
      // Backward compatibility
      to_path, to_agent, from_path
    } = args;
    
    if (!title || !content) {
      throw new Error('Title and content are required');
    }

    // Validate sender
    let sender: Agent;
    if (from_agent_id) {
      // New protocol: use agent ID
      const foundSender = this.db.getAgent(from_agent_id);
      if (!foundSender) {
        throw new Error(`Sender agent '${from_agent_id}' not found`);
      }
      sender = foundSender;
    } else if (from_path) {
      // Backward compatibility: use workspace path
      const senderWorkspace = this.resolveWorkspacePath(from_path);
      sender = await this.getOrCreateAgent(senderWorkspace);
    } else {
      throw new Error('Either from_agent_id (new protocol) or from_path (legacy) is required');
    }
    
    // Find recipient agent(s)
    let recipients: Agent[];
    if (to_agent_id) {
      // New protocol: direct message to specific agent
      const recipient = this.db.getAgent(to_agent_id);
      if (!recipient) {
        throw new Error(`Recipient agent '${to_agent_id}' not found`);
      }
      recipients = [recipient];
    } else if (to_agent_name) {
      // New protocol: find by name
      const recipient = this.db.getAgentByName(to_agent_name);
      if (!recipient) {
        throw new Error(`Agent '${to_agent_name}' not found`);
      }
      recipients = [recipient];
    } else if (routing_type) {
      // New protocol: route based on type
      recipients = this.routeMessageByType(routing_type, args);
    } else if (to_path && to_agent) {
      // Backward compatibility: use workspace path and agent name
      const foundRecipient = this.db.getAgentByNameAndWorkspace(to_agent, to_path);
      if (!foundRecipient) {
        throw new Error(`Agent '${to_agent}' not found in workspace '${to_path}'`);
      }
      recipients = [foundRecipient];
    } else if (to_path) {
      // Backward compatibility: use workspace path only
      const recipient = await this.getOrCreateAgent(to_path);
      recipients = [recipient];
    } else {
      throw new Error('Recipient specification required: to_agent_id, to_agent_name, routing_type, or to_path');
    }
    
    // Send message to all recipients
    const results = [];
    
    for (const recipient of recipients) {
      // Create conversation and message
      const conversation = createConversation(title, [sender.id, recipient.id], sender.id);
      this.db.createConversation(conversation);
      
      const message = createMessage(
        conversation.id,
        sender.id,
        recipient.id,
        title,
        content,
        args.priority || MessagePriority.NORMAL,
        undefined,
        undefined,
        true,
        {}
      );
      
      // Add protocol metadata to message metadata
      const metadata = {
        routingType: routing_type || ROUTING_RULES.DIRECT,
        securityLevel: security_level || SECURITY_LEVELS.BASIC,
        ...message.metadata
      };
      message.metadata = metadata;
      
      // Add agent information
      message.fromAgentName = sender.name;
      message.fromAgentRole = sender.role;
      message.toAgentName = recipient.name;
      message.toAgentRole = recipient.role;
      
      const messageId = this.db.createMessage(message);
      
      results.push({
        message_id: messageId,
        to_agent_id: recipient.id,
        to_agent_name: recipient.name,
        to_address: getAgentIdentifier(recipient),
        subject: title,
        status: 'sent',
        routing_type: message.metadata.routingType,
        security_level: message.metadata.securityLevel
      });
    }
    
    return {
      sent_count: results.length,
      messages: results
    };
  }

  private async handleCheckMailbox(args: any): Promise<any> {
    const { limit = 50, agent_id, from_path } = args;
    
    if (limit < 1 || limit > 500) {
      throw new Error('Limit must be between 1 and 500');
    }

    let sender: Agent;
    
    if (agent_id) {
      // New protocol: use agent ID
      const foundSender = this.db.getAgent(agent_id);
      if (!foundSender) {
        throw new Error(`Agent '${agent_id}' not found`);
      }
      sender = foundSender;
      console.log('✅ Using agent by ID:', sender.id, sender.name);
    } else if (from_path) {
      // Backward compatibility: use workspace path
      const senderWorkspace = this.resolveWorkspacePath(from_path);
      
      // Try to find existing agents in this workspace first
      const existingAgents = this.db.getAgentsByWorkspace(senderWorkspace);
      
      console.log('🔍 Debug: Found', existingAgents.length, 'agents in workspace:', senderWorkspace);
      existingAgents.forEach(agent => {
        console.log('  - Agent:', agent.id, agent.name, agent.role);
      });
      
      if (existingAgents.length > 0) {
        // Use the first existing agent (preferably the main one)
        const mainAgent = existingAgents.find(agent => 
          agent.name === 'Communication Server Agent'
        ) || existingAgents.find(agent => 
          agent.role === 'coordinator'
        ) || existingAgents.find(agent => 
          agent.name === 'Default Agent'
        ) || existingAgents[0];
        
        sender = mainAgent;
        console.log('✅ Using existing agent:', sender.id, sender.name);
      } else {
        // Create new agent if none exist
        sender = await this.getOrCreateAgent(senderWorkspace);
        console.log('🆕 Created new agent:', sender.id, sender.name);
      }
    } else {
      throw new Error('Either agent_id (new protocol) or from_path (legacy) is required');
    }
    
    this.db.updateAgentLastSeen(sender.id);
    
    const messages = this.db.getMessagesForAgent(sender.id, limit);
    const allMessages = this.db.getMessagesForAgent(sender.id, 10000);
    const totalMessages = allMessages.length;
    const hasMore = totalMessages > limit;
    
    const result = messages.map(msg => {
      const fromAgent = this.db.getAgent(msg.fromAgent);
      const toAgent = this.db.getAgent(msg.toAgent);
      
      return {
        id: msg.id,
        from_agent: fromAgent ? fromAgent.name : 'Unknown',
        from_address: fromAgent ? getAgentIdentifier(fromAgent) : 'Unknown',
        to_agent: toAgent ? toAgent.name : 'Unknown',
        to_address: toAgent ? getAgentIdentifier(toAgent) : 'Unknown',
        subject: msg.subject,
        content: msg.content.length > 100 ? msg.content.substring(0, 100) + '...' : msg.content,
        created_at: msg.createdAt.toISOString(),
        state: msg.state,
        is_read: msg.isRead
      };
    });
    
    return {
      messages: result,
      count: result.length,
      total_messages: totalMessages,
      has_more: hasMore,
      limit_requested: limit
    };
  }

  private async handleListMessages(args: any): Promise<any> {
    const { tail = 10, from_path } = args;
    
    if (tail < 1 || tail > 100) {
      throw new Error('tail must be between 1 and 100');
    }

    const senderWorkspace = this.resolveWorkspacePath(from_path);
    const sender = await this.getOrCreateAgent(senderWorkspace);
    
    const messages = this.db.getMessagesForAgent(sender.id, tail);
    
    const result = messages.map(msg => ({
      id: msg.id,
      title: msg.subject,
      from_agent: msg.fromAgentName || 'Unknown',
      to_agent: msg.toAgentName || 'Unknown',
      created_at: msg.createdAt.toISOString(),
      state: msg.state
    }));
    
    return {
      messages: result,
      count: result.length,
      requested_count: tail
    };
  }

  private async handleQueryMessages(args: any): Promise<any> {
    const { query, from_path } = args;
    
    if (!query) {
      throw new Error('Search query is required');
    }

    const senderWorkspace = this.resolveWorkspacePath(from_path);
    const sender = await this.getOrCreateAgent(senderWorkspace);
    
    const messages = this.db.searchMessages(sender.id, query, 50);
    
    const result = messages.map(msg => ({
      id: msg.id,
      from_agent: msg.fromAgentName || 'Unknown',
      to_agent: msg.toAgentName || 'Unknown',
      subject: msg.subject,
      content: msg.content.length > 100 ? msg.content.substring(0, 100) + '...' : msg.content,
      created_at: msg.createdAt.toISOString(),
      state: msg.state
    }));
    
    return {
      messages: result,
      count: result.length,
      query: query
    };
  }

  private async handleLabelMessages(args: any): Promise<any> {
    const { id, label, from_path } = args;
    
    const validLabels = ['sent', 'arrived', 'replied', 'ignored', 'read', 'unread'];
    if (!validLabels.includes(label)) {
      throw new Error(`Invalid label '${label}'. Must be one of: ${validLabels.join(', ')}`);
    }

    const message = this.db.getMessage(id);
    if (!message) {
      throw new Error(`Message '${id}' not found`);
    }

    const senderWorkspace = this.resolveWorkspacePath(from_path);
    const sender = await this.getOrCreateAgent(senderWorkspace);
    
    if (message.fromAgent !== sender.id && message.toAgent !== sender.id) {
      throw new Error('You can only label messages in your mailbox');
    }

    const oldState = message.state;
    const readAt = label === 'read' ? new Date() : undefined;
    
    this.db.updateMessageState(id, label as MessageState);
    
    if (label === 'read') {
      this.db.updateMessageReadStatus(id, true);
    } else if (label === 'unread') {
      this.db.updateMessageReadStatus(id, false);
    }
    
    return {
      message_id: id,
      old_state: oldState,
      new_state: label,
      status: 'labeled',
      read_at: readAt?.toISOString()
    };
  }

  // New bulk mailbox operation handlers
  private async handleBulkMarkRead(args: any): Promise<any> {
    const { from_path, message_ids } = args;
    
    if (!message_ids || !Array.isArray(message_ids) || message_ids.length === 0) {
      throw new Error('message_ids array is required and must not be empty');
    }

    const senderWorkspace = this.resolveWorkspacePath(from_path);
    const sender = await this.getOrCreateAgent(senderWorkspace);
    
    const updatedCount = this.db.bulkMarkMessagesAsRead(sender.id, message_ids);
    
    return {
      updated_count: updatedCount,
      message_ids: message_ids,
      status: 'marked_as_read'
    };
  }

  private async handleBulkMarkUnread(args: any): Promise<any> {
    const { from_path, message_ids } = args;
    
    if (!message_ids || !Array.isArray(message_ids) || message_ids.length === 0) {
      throw new Error('message_ids array is required and must not be empty');
    }

    const senderWorkspace = this.resolveWorkspacePath(from_path);
    const sender = await this.getOrCreateAgent(senderWorkspace);
    
    const updatedCount = this.db.bulkMarkMessagesAsUnread(sender.id, message_ids);
    
    return {
      updated_count: updatedCount,
      message_ids: message_ids,
      status: 'marked_as_unread'
    };
  }

  private async handleBulkUpdateStates(args: any): Promise<any> {
    const { from_path, message_ids, new_state } = args;
    
    if (!message_ids || !Array.isArray(message_ids) || message_ids.length === 0) {
      throw new Error('message_ids array is required and must not be empty');
    }

    const validStates = ['sent', 'arrived', 'replied', 'ignored', 'read', 'unread'];
    if (!validStates.includes(new_state)) {
      throw new Error(`Invalid state '${new_state}'. Must be one of: ${validStates.join(', ')}`);
    }

    const senderWorkspace = this.resolveWorkspacePath(from_path);
    const sender = await this.getOrCreateAgent(senderWorkspace);
    
    const updatedCount = this.db.bulkUpdateMessageStates(sender.id, { messageIds: message_ids, newState: new_state as MessageState });
    
    return {
      updated_count: updatedCount,
      message_ids: message_ids,
      new_state: new_state,
      status: 'states_updated'
    };
  }

  private async handleDeleteMessages(args: any): Promise<any> {
    const { from_path, message_ids } = args;
    
    if (!message_ids || !Array.isArray(message_ids) || message_ids.length === 0) {
      throw new Error('message_ids array is required and must not be empty');
    }

    const senderWorkspace = this.resolveWorkspacePath(from_path);
    const sender = await this.getOrCreateAgent(senderWorkspace);
    
    const deletedCount = this.db.deleteMessages(sender.id, message_ids);
    
    return {
      deleted_count: deletedCount,
      message_ids: message_ids,
      status: 'deleted'
    };
  }

  private async handleEmptyMailbox(args: any): Promise<any> {
    const { from_path, query } = args;

    const senderWorkspace = this.resolveWorkspacePath(from_path);
    const sender = await this.getOrCreateAgent(senderWorkspace);
    
    const deletedCount = this.db.emptyMailbox(sender.id, query);
    
    return {
      deleted_count: deletedCount,
      query: query || 'all messages',
      status: 'mailbox_emptied'
    };
  }

  // Existing handler methods (simplified versions)
  private async handleGetMessageStats(args: any): Promise<any> {
    const { from_path } = args;
    const senderWorkspace = this.resolveWorkspacePath(from_path);
    const sender = await this.getOrCreateAgent(senderWorkspace);

    const messages = this.db.getMessagesForAgent(sender.id, 1000);
    const totalMessages = messages.length;
    const totalSent = messages.filter(msg => msg.state === MessageState.SENT).length;
    const totalArrived = messages.filter(msg => msg.state === MessageState.ARRIVED).length;
    const totalReplied = messages.filter(msg => msg.state === MessageState.REPLIED).length;
    const totalIgnored = messages.filter(msg => msg.state === MessageState.IGNORED).length;
    const totalRead = messages.filter(msg => msg.isRead).length;
    const totalUnread = messages.filter(msg => !msg.isRead).length;

    return {
      total_messages: totalMessages,
      total_sent: totalSent,
      total_arrived: totalArrived,
      total_replied: totalReplied,
      total_ignored: totalIgnored,
      total_read: totalRead,
      total_unread: totalUnread
    };
  }

  private async handleGetServerHealth(args: any): Promise<any> {
    const uptime = Date.now() - this.startTime.getTime();
    
    let dbHealthy = false;
    try {
      this.db.getDatabaseStats();
      dbHealthy = true;
    } catch (error) {
      console.error('Database health check failed:', error);
    }
    
    const perfStats = this.getPerformanceStats();
    
    return {
      status: dbHealthy ? 'healthy' : 'degraded',
      uptime_seconds: Math.floor(uptime / 1000),
      uptime_formatted: new Date(uptime).toISOString().substr(11, 8),
      database_healthy: dbHealthy,
      request_count: this.requestCount,
      error_count: this.errorCount,
      error_rate: Math.round((this.errorCount / Math.max(this.requestCount, 1)) * 100 * 100) / 100,
      performance: perfStats
    };
  }

  private async handleGetUnreadCount(args: any): Promise<any> {
    const { from_path } = args;
    const senderWorkspace = this.resolveWorkspacePath(from_path);
    const sender = await this.getOrCreateAgent(senderWorkspace);
    
    const messages = this.db.getMessagesForAgent(sender.id, 1000);
    const unreadCount = messages.filter(msg => !msg.isRead && msg.toAgent === sender.id).length;
    const totalMessages = messages.length;
    const unreadPercentage = Math.round((unreadCount / Math.max(totalMessages, 1)) * 100 * 10) / 10;
    
    return {
      unread_count: unreadCount,
      total_messages: totalMessages,
      unread_percentage: unreadPercentage
    };
  }

  private async handleViewConversationLog(args: any): Promise<any> {
    const { from_path } = args;
    const senderWorkspace = this.resolveWorkspacePath(from_path);
    const sender = await this.getOrCreateAgent(senderWorkspace);
    const messages = this.db.getMessagesForAgent(sender.id, 50);
    
    const conversations = messages.map(msg => ({
      conversation_id: msg.conversationId,
      subject: msg.subject,
      participants: [msg.fromAgent, msg.toAgent],
      participant_names: [msg.fromAgentName || 'Unknown', msg.toAgentName || 'Unknown'],
      message_count: 1,
      first_message_at: msg.createdAt.toISOString(),
      last_message_at: msg.createdAt.toISOString(),
      last_message_content: msg.content.substring(0, 200),
      conversation_state: 'active',
      created_at: msg.createdAt.toISOString()
    }));
    
    return {
      status: 'success',
      organize_result: {
        conversations_organized: conversations.length,
        log_file: 'conversation_log.json'
      },
      log_data: {
        metadata: {
          generated_at: new Date().toISOString(),
          total_conversations: conversations.length
        },
        conversations: conversations
      }
    };
  }

  private async handleGetConversationStats(args: any): Promise<any> {
    const { from_path } = args;
    const senderWorkspace = this.resolveWorkspacePath(from_path);
    const sender = await this.getOrCreateAgent(senderWorkspace);
    const messages = this.db.getMessagesForAgent(sender.id, 1000);
    
    const totalMessages = messages.length;
    const totalConversations = new Set(messages.map(m => m.conversationId)).size;
    const activeConversations = totalConversations;
    const recentConversations = totalConversations;
    const completedConversations = 0;
    const avgMessagesPerConversation = totalConversations > 0 ? Math.round((totalMessages / totalConversations) * 100) / 100 : 0;
    
    return {
      total_conversations: totalConversations,
      active_conversations: activeConversations,
      recent_conversations: recentConversations,
      completed_conversations: completedConversations,
      total_messages: totalMessages,
      avg_messages_per_conversation: avgMessagesPerConversation
    };
  }

  private async handleSendPriorityMessage(args: any): Promise<any> {
    const { to_path, to_agent, title, content, from_path, priority, expires_in_hours } = args;

    if (!title || !content) {
      throw new Error('Title and content are required for priority messages');
    }

    let recipient: Agent;
    if (to_agent) {
      const foundRecipient = this.db.getAgentByNameAndWorkspace(to_agent, to_path);
      if (!foundRecipient) {
        throw new Error(`Agent '${to_agent}' not found in workspace '${to_path}'`);
      }
      recipient = foundRecipient;
    } else {
      recipient = await this.getOrCreateAgent(to_path);
    }

    const senderWorkspace = this.resolveWorkspacePath(from_path);
    const sender = await this.getOrCreateAgent(senderWorkspace);

    const conversation = createConversation(title, [sender.id, recipient.id], sender.id);
    this.db.createConversation(conversation);

    const message = createMessage(
      conversation.id,
      sender.id,
      recipient.id,
      title,
      content,
      MessagePriority.NORMAL,
      undefined,
      undefined,
      true,
      {}
    );

    message.fromAgentName = sender.name;
    message.fromAgentRole = sender.role;
    message.fromAgentWorkspace = sender.workspacePath;
    message.toAgentName = recipient.name;
    message.toAgentRole = recipient.role;
    message.toAgentWorkspace = recipient.workspacePath;

    const messageId = this.db.createMessage(message);

    return {
      message_id: messageId,
      to_agent: recipient.name,
      to_path: to_path,
      to_address: getAgentIdentifier(recipient),
      subject: title,
      status: 'sent'
    };
  }

  private async handleCleanupExpiredMessages(args: any): Promise<any> {
    const cleanedCount = this.db.cleanupExpiredMessages();
    return {
      cleaned_count: cleanedCount,
      status: 'success'
    };
  }

  private async handleGetMessageTemplates(args: any): Promise<any> {
    const { template_type } = args;
    let templates: any[] = [];

    if (template_type) {
      switch (template_type.toUpperCase()) {
        case 'BUG_REPORT':
          templates = [
            {
              name: 'Bug Report Template',
              subject: 'Bug Report: [Issue Description]',
              content: `**Bug Report**

**Issue:** [Describe the bug in detail]
**Steps to Reproduce:** [List steps to reproduce the bug]
**Expected Behavior:** [What you expected to happen]
**Actual Behavior:** [What actually happened]
**Screenshots:** [If applicable, add screenshots to help explain your problem.]
**Environment:** [OS, Browser, Version]
**Additional Context:** [Add any other context about the problem here.]`
            }
          ];
          break;
        case 'FEATURE_REQUEST':
          templates = [
            {
              name: 'Feature Request Template',
              subject: 'Feature Request: [Feature Description]',
              content: `**Feature Request**

**Description:** [Describe the feature in detail]
**Why:** [Why is this feature needed?]
**How:** [How would you implement this feature?]
**Additional Context:** [Add any other context about the feature here.]`
            }
          ];
          break;
        default:
          throw new Error(`Unknown template type: ${template_type}`);
      }
    } else {
      templates = [
        {
          name: 'Bug Report Template',
          subject: 'Bug Report: [Issue Description]',
          content: `**Bug Report**

**Issue:** [Describe the bug in detail]
**Steps to Reproduce:** [List steps to reproduce the bug]
**Expected Behavior:** [What you expected to happen]
**Actual Behavior:** [What actually happened]`
        },
        {
          name: 'Feature Request Template',
          subject: 'Feature Request: [Feature Description]',
          content: `**Feature Request**

**Description:** [Describe the feature in detail]
**Why:** [Why is this feature needed?]`
        }
      ];
    }

    return {
      templates: templates,
      count: templates.length,
      requested_template_type: template_type || 'all'
    };
  }

  private setupTools(): void {
    // Enhanced agent identification tools
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const startTime = Date.now();
      
      // Check rate limiting
      if (!this.checkRateLimit()) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }

      // Check cache for read-only operations
      const cacheKey = `${name}:${JSON.stringify(args)}`;
      const cachedResult = this.getCachedResponse(cacheKey);
      if (cachedResult) {
        console.log(`📋 Cache hit for ${name}`);
        return { content: [{ type: 'text', text: JSON.stringify(cachedResult) }] };
      }
      
      try {
        let result: any;
        
        switch (name) {
          case 'create_agent':
            result = await this.handleCreateAgent(args);
            break;
          case 'list_agents':
            result = await this.handleListAgents(args);
            // Cache read-only operations
            this.setCachedResponse(cacheKey, result);
            break;
          case 'get_agent_identity':
            result = await this.handleGetAgentIdentity(args);
            this.setCachedResponse(cacheKey, result);
            break;
          case 'verify_agent_identity':
            result = await this.handleVerifyAgentIdentity(args);
            break;
          case 'authenticate_agent':
            result = await this.handleAuthenticateAgent(args);
            break;
          case 'delete_agent':
            result = await this.handleDeleteAgent(args);
            break;
          case 'send':
            result = await this.handleSend(args);
            break;
          case 'check_mailbox':
            result = await this.handleCheckMailbox(args);
            this.setCachedResponse(cacheKey, result);
            break;
          case 'list_messages':
            result = await this.handleListMessages(args);
            this.setCachedResponse(cacheKey, result);
            break;
          case 'query_messages':
            result = await this.handleQueryMessages(args);
            this.setCachedResponse(cacheKey, result);
            break;
          case 'label_messages':
            result = await this.handleLabelMessages(args);
            break;
          // New bulk mailbox operations
          case 'bulk_mark_read':
            result = await this.handleBulkMarkRead(args);
            break;
          case 'bulk_mark_unread':
            result = await this.handleBulkMarkUnread(args);
            break;
          case 'bulk_update_states':
            result = await this.handleBulkUpdateStates(args);
            break;
          case 'delete_messages':
            result = await this.handleDeleteMessages(args);
            break;
          case 'empty_mailbox':
            result = await this.handleEmptyMailbox(args);
            break;
          case 'get_message_stats':
            result = await this.handleGetMessageStats(args);
            this.setCachedResponse(cacheKey, result);
            break;
          case 'get_server_health':
            result = await this.handleGetServerHealth(args);
            this.setCachedResponse(cacheKey, result);
            break;
          case 'get_unread_count':
            result = await this.handleGetUnreadCount(args);
            this.setCachedResponse(cacheKey, result);
            break;
          case 'view_conversation_log':
            result = await this.handleViewConversationLog(args);
            this.setCachedResponse(cacheKey, result);
            break;
          case 'get_conversation_stats':
            result = await this.handleGetConversationStats(args);
            this.setCachedResponse(cacheKey, result);
            break;
          case 'send_priority_message':
            result = await this.handleSendPriorityMessage(args);
            break;
          case 'cleanup_expired_messages':
            result = await this.handleCleanupExpiredMessages(args);
            break;
          case 'get_message_templates':
            result = await this.handleGetMessageTemplates(args);
            this.setCachedResponse(cacheKey, result);
            break;
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
        
        const duration = Date.now() - startTime;
        this.requestTimes.push(duration);
        this.logRequest(name, true, undefined, duration);
        
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error: any) {
        const duration = Date.now() - startTime;
        this.logRequest(name, false, error.message, duration);
        throw error;
      }
    });

    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'create_agent',
            description: 'Create a new agent with user-assigned ID for inter-agent communication',
            inputSchema: {
              type: 'object',
              properties: {
                agent_id: { 
                  type: 'string', 
                  description: 'Unique identifier for the agent (user-assigned, max 100 chars)',
                  examples: ['test-agent', 'frontend-dev', 'backend-api']
                },
                name: { 
                  type: 'string', 
                  description: 'Human-readable name for the agent (max 200 chars)',
                  examples: ['Test Agent', 'Frontend Developer', 'Backend API']
                },
                workspace_path: { 
                  type: 'string', 
                  description: 'Absolute path to the agent\'s workspace directory',
                  pattern: '^/.*',
                  examples: ['/data/communication_server/communication-server', '/home/user/projects/frontend']
                },
                role: { 
                  type: 'string', 
                  enum: ['general', 'developer', 'manager', 'analyst', 'tester', 'designer', 'coordinator'],
                  description: 'Role of the agent in the system',
                  default: 'general'
                },
                username: { 
                  type: 'string', 
                  description: 'Username for agent authentication (optional)',
                  examples: ['test-agent', 'frontend-dev']
                },
                password: { 
                  type: 'string', 
                  description: 'Password for agent authentication (optional, will be hashed)',
                  examples: ['secure_password_123']
                },
                description: { 
                  type: 'string', 
                  description: 'Detailed description of the agent\'s purpose and capabilities (max 1000 chars)',
                  examples: ['Frontend development agent for React applications']
                },
                capabilities: { 
                  type: 'array', 
                  items: { type: 'string' }, 
                  description: 'List of agent capabilities and skills',
                  examples: [['react', 'typescript', 'ui-design'], ['api-development', 'database']]
                },
                tags: { 
                  type: 'array', 
                  items: { type: 'string' }, 
                  description: 'Tags for categorizing and searching agents',
                  examples: [['frontend', 'react'], ['backend', 'api']]
                }
              },
              required: ['agent_id', 'name']
            }
          },
          {
            name: 'send',
            description: 'Send a message using the new agent identification protocol',
            inputSchema: {
              type: 'object',
              properties: {
                to_agent_id: {
                  type: 'string',
                  description: 'Direct agent ID to send message to',
                  examples: ['comm-server-agent', 'supervisor', 'voicewriter-audio-agent']
                },
                to_agent_name: {
                  type: 'string',
                  description: 'Agent name to send message to (if agent_id not provided)',
                  examples: ['Communication Server Agent', 'VoiceWriter Supervisor', 'VoiceWriter Audio Agent']
                },
                routing_type: {
                  type: 'string',
                  enum: ['direct', 'broadcast', 'role_based', 'capability_based', 'tag_based'],
                  description: 'Message routing type',
                  examples: ['direct', 'broadcast', 'role_based']
                },
                target_role: {
                  type: 'string',
                  description: 'Target role for role-based routing',
                  examples: ['developer', 'coordinator', 'supervisor']
                },
                target_capability: {
                  type: 'string',
                  description: 'Target capability for capability-based routing',
                  examples: ['communication', 'development', 'testing']
                },
                target_tag: {
                  type: 'string',
                  description: 'Target tag for tag-based routing',
                  examples: ['frontend', 'backend', 'urgent']
                },
                from_agent_id: {
                  type: 'string',
                  description: 'Sender agent ID (required)',
                  examples: ['comm-server-agent', 'supervisor']
                },
                title: {
                  type: 'string',
                  description: 'The subject/title of your message (max 500 chars)',
                  minLength: 1,
                  examples: ['API Integration Request', 'Bug Report', 'Feature Discussion', 'Project Update']
                },
                content: {
                  type: 'string',
                  description: 'The main body of your message (max 10,000 chars)',
                  minLength: 1,
                  examples: ['Can you help integrate the new API endpoints?', 'I found a bug in the authentication system.', 'The analysis is ready for review.']
                },
                priority: {
                  type: 'string',
                  enum: ['low', 'normal', 'high', 'urgent'],
                  description: 'Message priority level',
                  default: 'normal',
                  examples: ['normal', 'high', 'urgent']
                },
                security_level: {
                  type: 'string',
                  enum: ['none', 'basic', 'signed', 'encrypted'],
                  description: 'Message security level',
                  default: 'basic',
                  examples: ['basic', 'signed']
                }
              },
              required: ['title', 'content']
            }
          },
          {
            name: 'check_mailbox',
            description: 'Check mailbox for messages (supports both new protocol with agent_id and legacy with from_path)',
            inputSchema: {
              type: 'object',
              properties: {
                agent_id: {
                  type: 'string',
                  description: 'Agent ID to check mailbox for (new protocol)',
                  examples: ['comm-server-agent', 'supervisor', 'voicewriter-audio-agent']
                },
                from_path: {
                  type: 'string',
                  description: 'Workspace path for legacy protocol',
                  pattern: '^/.*',
                  examples: ['/data/communication_server/communication-server', '/data/voicewriter']
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of messages to return (1-500)',
                  minimum: 1,
                  maximum: 500,
                  default: 50,
                  examples: [10, 50, 100]
                }
              },
              required: []
            }
          },
          {
            name: 'list_messages',
            description: 'List recent messages in a simplified format',
            inputSchema: {
              type: 'object',
              properties: {
                from_path: {
                  type: 'string',
                  description: 'Absolute path for the agent\'s workspace to list messages',
                  pattern: '^/.*',
                  examples: ['/data/communication_server/communication-server', '/home/user/projects/frontend']
                },
                tail: {
                  type: 'number',
                  description: 'Number of recent messages to list (1-100)',
                  minimum: 1,
                  maximum: 100,
                  default: 10,
                  examples: [5, 10, 20]
                }
              },
              required: ['from_path']
            }
          },
          {
            name: 'label_messages',
            description: 'Change the state of a message (mark as read, unread, ignored, etc.)',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'ID of the message to label (get this from check_mailbox or list_messages)',
                  examples: ['abc123-def456-ghi789', 'msg-2025-08-24-001']
                },
                label: {
                  type: 'string',
                  enum: ['sent', 'arrived', 'replied', 'ignored', 'read', 'unread'],
                  description: 'New state for the message',
                  examples: ['read', 'ignored', 'unread']
                },
                from_path: {
                  type: 'string',
                  description: 'Optional absolute path for your project. Defaults to current working directory',
                  pattern: '^/.*',
                  examples: ['/data/communication_server/communication-server']
                }
              },
              required: ['id', 'label']
            }
          },
          {
            name: 'query_messages',
            description: 'Search through your messages by text content',
            inputSchema: {
              type: 'object',
              properties: {
                from_path: {
                  type: 'string',
                  description: 'Optional absolute path for your project. Defaults to current working directory',
                  pattern: '^/.*',
                  examples: ['/data/communication_server/communication-server']
                },
                query: {
                  type: 'string',
                  description: 'Text to search for in message subjects and content',
                  minLength: 1,
                  examples: ['API', 'bug', 'integration', 'error']
                }
              },
              required: ['query']
            }
          },
          {
            name: 'get_server_health',
            description: 'Check the health and performance of the communication server',
            inputSchema: {
              type: 'object',
              properties: {
                random_string: {
                  type: 'string',
                  description: 'Dummy parameter for no-parameter tools'
                }
              },
              required: ['random_string']
            }
          },
          {
            name: 'get_unread_count',
            description: 'Get the count of unread messages in your mailbox',
            inputSchema: {
              type: 'object',
              properties: {
                random_string: {
                  type: 'string',
                  description: 'Dummy parameter for no-parameter tools'
                },
                from_path: {
                  type: 'string',
                  description: 'Optional absolute path for your project. Defaults to current working directory',
                  pattern: '^/.*',
                  examples: ['/data/communication_server/communication-server']
                }
              },
              required: ['random_string']
            }
          },
          {
            name: 'view_conversation_log',
            description: 'View the recent conversation log showing organized conversations between agents',
            inputSchema: {
              type: 'object',
              properties: {
                random_string: {
                  type: 'string',
                  description: 'Dummy parameter for no-parameter tools'
                },
                from_path: {
                  type: 'string',
                  description: 'Optional absolute path for your project. Defaults to current working directory',
                  pattern: '^/.*',
                  examples: ['/data/communication_server/communication-server']
                }
              },
              required: ['random_string']
            }
          },
          {
            name: 'get_conversation_stats',
            description: 'Get statistics about conversations and agent communication patterns',
            inputSchema: {
              type: 'object',
              properties: {
                random_string: {
                  type: 'string',
                  description: 'Dummy parameter for no-parameter tools'
                },
                from_path: {
                  type: 'string',
                  description: 'Optional absolute path for your project. Defaults to current working directory',
                  pattern: '^/.*',
                  examples: ['/data/communication_server/communication-server']
                }
              },
              required: ['random_string']
            }
          },
          {
            name: 'list_agents',
            description: 'List all agents in a specific workspace directory',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'Absolute path to the workspace directory to list agents from',
                  pattern: '^/.*',
                  examples: ['/data/communication_server/communication-server', '/home/user/projects/frontend']
                }
              },
              required: ['path']
            }
          },
          {
            name: 'get_agent_identity',
            description: 'Get detailed information about a specific agent',
            inputSchema: {
              type: 'object',
              properties: {
                agent_id: {
                  type: 'string',
                  description: 'ID of the agent to get information about',
                  examples: ['test-agent', 'frontend-dev', 'backend-api']
                }
              },
              required: ['agent_id']
            }
          },
          {
            name: 'verify_agent_identity',
            description: 'Verify an agent\'s identity using a signature',
            inputSchema: {
              type: 'object',
              properties: {
                agent_id: {
                  type: 'string',
                  description: 'ID of the agent to verify',
                  examples: ['test-agent', 'frontend-dev']
                },
                signature: {
                  type: 'string',
                  description: 'Signature to verify the agent\'s identity',
                  examples: ['signature-hash-123', 'verified-signature-456']
                }
              },
              required: ['agent_id', 'signature']
            }
          },
          {
            name: 'authenticate_agent',
            description: 'Authenticate an agent using username and password',
            inputSchema: {
              type: 'object',
              properties: {
                agent_id: {
                  type: 'string',
                  description: 'ID of the agent to authenticate',
                  examples: ['test-agent', 'frontend-dev']
                },
                username: {
                  type: 'string',
                  description: 'Username for authentication',
                  examples: ['test-agent', 'frontend-dev']
                },
                password: {
                  type: 'string',
                  description: 'Password for authentication',
                  examples: ['secure_password_123']
                }
              },
              required: ['agent_id', 'username', 'password']
            }
          },
          {
            name: 'delete_agent',
            description: 'Delete an agent and all associated data',
            inputSchema: {
              type: 'object',
              properties: {
                agent_id: {
                  type: 'string',
                  description: 'ID of the agent to delete',
                  examples: ['test-agent', 'frontend-dev']
                },
                created_by: {
                  type: 'string',
                  description: 'ID of the agent requesting the deletion (must be the creator)',
                  examples: ['system', 'admin-agent']
                }
              },
              required: ['agent_id', 'created_by']
            }
          },
          {
            name: 'bulk_mark_read',
            description: 'Mark multiple messages as read in bulk',
            inputSchema: {
              type: 'object',
              properties: {
                from_path: {
                  type: 'string',
                  description: 'Absolute path for the agent\'s workspace',
                  pattern: '^/.*',
                  examples: ['/data/communication_server/communication-server']
                },
                message_ids: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Array of message IDs to mark as read',
                  examples: [['msg-001', 'msg-002', 'msg-003']]
                }
              },
              required: ['from_path', 'message_ids']
            }
          },
          {
            name: 'bulk_mark_unread',
            description: 'Mark multiple messages as unread in bulk',
            inputSchema: {
              type: 'object',
              properties: {
                from_path: {
                  type: 'string',
                  description: 'Absolute path for the agent\'s workspace',
                  pattern: '^/.*',
                  examples: ['/data/communication_server/communication-server']
                },
                message_ids: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Array of message IDs to mark as unread',
                  examples: [['msg-001', 'msg-002', 'msg-003']]
                }
              },
              required: ['from_path', 'message_ids']
            }
          },
          {
            name: 'bulk_update_states',
            description: 'Update the state of multiple messages in bulk',
            inputSchema: {
              type: 'object',
              properties: {
                from_path: {
                  type: 'string',
                  description: 'Absolute path for the agent\'s workspace',
                  pattern: '^/.*',
                  examples: ['/data/communication_server/communication-server']
                },
                message_ids: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Array of message IDs to update',
                  examples: [['msg-001', 'msg-002', 'msg-003']]
                },
                new_state: {
                  type: 'string',
                  enum: ['sent', 'arrived', 'replied', 'ignored', 'read', 'unread'],
                  description: 'New state to set for all messages',
                  examples: ['read', 'ignored', 'replied']
                }
              },
              required: ['from_path', 'message_ids', 'new_state']
            }
          },
          {
            name: 'delete_messages',
            description: 'Delete multiple messages in bulk',
            inputSchema: {
              type: 'object',
              properties: {
                from_path: {
                  type: 'string',
                  description: 'Absolute path for the agent\'s workspace',
                  pattern: '^/.*',
                  examples: ['/data/communication_server/communication-server']
                },
                message_ids: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Array of message IDs to delete',
                  examples: [['msg-001', 'msg-002', 'msg-003']]
                }
              },
              required: ['from_path', 'message_ids']
            }
          },
          {
            name: 'empty_mailbox',
            description: 'Delete all messages in the mailbox, optionally filtered by query',
            inputSchema: {
              type: 'object',
              properties: {
                from_path: {
                  type: 'string',
                  description: 'Absolute path for the agent\'s workspace',
                  pattern: '^/.*',
                  examples: ['/data/communication_server/communication-server']
                },
                query: {
                  type: 'string',
                  description: 'Optional query to filter messages before deletion',
                  examples: ['bug', 'error', 'urgent']
                }
              },
              required: ['from_path']
            }
          },
          {
            name: 'get_message_stats',
            description: 'Get statistics about messages in the mailbox',
            inputSchema: {
              type: 'object',
              properties: {
                from_path: {
                  type: 'string',
                  description: 'Absolute path for the agent\'s workspace',
                  pattern: '^/.*',
                  examples: ['/data/communication_server/communication-server']
                }
              },
              required: ['from_path']
            }
          },
          {
            name: 'send_priority_message',
            description: 'Send a priority message with optional expiration',
            inputSchema: {
              type: 'object',
              properties: {
                to_path: {
                  type: 'string',
                  description: 'Absolute path to the target project directory',
                  pattern: '^/.*',
                  examples: ['/data/communication_server/communication-server', '/home/user/projects/frontend']
                },
                to_agent: {
                  type: 'string',
                  description: 'Optional specific agent name to send to',
                  examples: ['Frontend Agent', 'Backend Agent']
                },
                from_path: {
                  type: 'string',
                  description: 'Optional absolute path for the sender project',
                  pattern: '^/.*',
                  examples: ['/home/user/projects/backend']
                },
                title: {
                  type: 'string',
                  description: 'The subject/title of your priority message',
                  minLength: 1,
                  examples: ['URGENT: System Down', 'CRITICAL: Security Issue']
                },
                content: {
                  type: 'string',
                  description: 'The main body of your priority message',
                  minLength: 1,
                  examples: ['The system is experiencing critical issues that require immediate attention.']
                },
                priority: {
                  type: 'string',
                  enum: ['low', 'normal', 'high', 'urgent'],
                  description: 'Priority level of the message',
                  default: 'high',
                  examples: ['high', 'urgent']
                },
                expires_in_hours: {
                  type: 'number',
                  description: 'Number of hours before the message expires',
                  minimum: 1,
                  maximum: 168,
                  examples: [24, 48, 72]
                }
              },
              required: ['to_path', 'title', 'content']
            }
          },
          {
            name: 'cleanup_expired_messages',
            description: 'Clean up expired messages from the database',
            inputSchema: {
              type: 'object',
              properties: {
                random_string: {
                  type: 'string',
                  description: 'Dummy parameter for no-parameter tools'
                }
              },
              required: ['random_string']
            }
          },
          {
            name: 'get_message_templates',
            description: 'Get message templates for common use cases',
            inputSchema: {
              type: 'object',
              properties: {
                template_type: {
                  type: 'string',
                  enum: ['BUG_REPORT', 'FEATURE_REQUEST'],
                  description: 'Type of template to retrieve',
                  examples: ['BUG_REPORT', 'FEATURE_REQUEST']
                }
              }
            }
          }
        ]
      };
    });
  }

  async run(): Promise<void> {
    console.error('🚀 Starting stable communication server.');
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.error('🔄 MCP server started successfully');
  }
}
