/**
 * Stable, Production-Ready MCP Server for Agentic Communications
 */

import { Server } from '@modelcontextprotocol/sdk/server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { DatabaseManager } from './database.js';
import { 
  Agent, 
  Message, 
  Conversation, 
  AgentRole, 
  MessageState, 
  createAgent, 
  createMessage, 
  createConversation,
  getDisplayName,
  getFullAddress,
  getProjectName
} from './models.js';
import { v4 as uuidv4 } from 'uuid';

export class CommunicationServer {
  private server: Server;
  private db: DatabaseManager;
  private startTime: Date;
  private requestCount: number = 0;
  private errorCount: number = 0;
  private requestTimes: number[] = [];

  constructor() {
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

  private logRequest(toolName: string, success: boolean = true, error?: string, duration: number = 0): void {
    this.requestCount++;
    if (!success) {
      this.errorCount++;
    }

    if (duration > 0) {
      this.requestTimes.push(duration);
      if (this.requestTimes.length > 1000) {
        this.requestTimes.shift();
      }
    }

    console.error(`📈 Request #${this.requestCount}: ${toolName} - ${success ? 'SUCCESS' : 'ERROR'} - ${duration.toFixed(3)}s`);
    if (error) {
      console.error(`❌ Error in ${toolName}: ${error}`);
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

  private async getOrCreateAgent(workspacePath: string): Promise<Agent> {
    // Validate workspace path
    if (!workspacePath || !workspacePath.startsWith('/')) {
      throw new Error("Invalid workspace path. Must be an absolute path starting with '/'");
    }

    // Check if agent exists
    const existingAgent = this.db.getAgentByWorkspace(workspacePath);
    if (existingAgent) {
      // Update last seen
      this.db.updateAgentLastSeen(existingAgent.id);
      return existingAgent;
    }

    // Create new agent with address
    const projectName = getProjectName(workspacePath);
    const agentName = `${projectName.charAt(0).toUpperCase() + projectName.slice(1)} Agent`;
    
    // Generate a simple address based on workspace path
    const address = `LOC-${Math.abs(workspacePath.hashCode()) % 10000}`.padStart(8, '0');
    
    const agent = createAgent(agentName, workspacePath, AgentRole.GENERAL, undefined, address);
    
    const agentId = this.db.createAgent(agent);
    const newAgent = this.db.getAgent(agentId);
    
    if (!newAgent) {
      throw new Error('Failed to create agent');
    }
    
    return newAgent;
  }

  private setupTools(): void {
    // Create Agent Tool
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'create_agent',
            description: 'Create an agent for the current directory path.',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'The absolute path to the project directory. Must start with "/" and be a valid directory path.',
                  pattern: '^/.*',
                  examples: ['/home/user/projects/my-app', '/workspace/backend-service', '/opt/projects/data-analysis']
                }
              },
              required: ['path']
            }
          },
          {
            name: 'send',
            description: 'Send a message to an agent in the specified directory.',
            inputSchema: {
              type: 'object',
              properties: {
                to_path: {
                  type: 'string',
                  description: 'The absolute path to the target project directory where you want to send the message.',
                  pattern: '^/.*',
                  examples: ['/home/user/projects/frontend', '/workspace/api-service', '/opt/projects/machine-learning']
                },
                from_path: {
                  type: 'string',
                  description: 'Optional absolute path for the sender project. Defaults to current working directory.',
                  pattern: '^/.*',
                  examples: ['/home/user/projects/backend']
                },
                title: {
                  type: 'string',
                  description: 'The subject/title of your message.',
                  minLength: 1,
                  examples: ['API Integration Request', 'Bug Report', 'Feature Discussion', 'Project Update']
                },
                content: {
                  type: 'string',
                  description: 'The main body of your message.',
                  minLength: 1,
                  examples: ['Can you help integrate the new API endpoints?', 'I found a bug in the authentication system.', 'The analysis is ready for review.']
                }
              },
              required: ['to_path', 'title', 'content']
            }
          },
          {
            name: 'reply',
            description: 'Reply to a message using its message ID.',
            inputSchema: {
              type: 'object',
              properties: {
                to_message: {
                  type: 'string',
                  description: 'The message ID of the message you want to reply to.',
                  examples: ['abc123-def456-ghi789', 'msg-2025-08-24-001']
                },
                from_path: {
                  type: 'string',
                  description: 'Optional absolute path for the sender project. Defaults to current working directory.',
                  pattern: '^/.*',
                  examples: ['/home/user/projects/backend']
                },
                content: {
                  type: 'string',
                  description: 'Your reply message content.',
                  minLength: 1,
                  examples: ['Thanks for the update!', 'I\'ll look into this issue.', 'The integration is working well now.']
                }
              },
              required: ['to_message', 'content']
            }
          },
          {
            name: 'check_mailbox',
            description: 'View recent messages in your mailbox (both sent and received).',
            inputSchema: {
              type: 'object',
              properties: {
                from_path: {
                  type: 'string',
                  description: 'Optional absolute path for your project. Defaults to current working directory.',
                  pattern: '^/.*',
                  examples: ['/home/user/projects/backend']
                },
                limit: {
                  type: 'integer',
                  description: 'Number of recent messages to return (1-500). Default is 50.',
                  minimum: 1,
                  maximum: 500,
                  default: 50,
                  examples: [10, 50, 100]
                }
              }
            }
          },
          {
            name: 'label_messages',
            description: 'Change the state of a message (mark as read, unread, ignored, etc.).',
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
                  description: 'New state for the message',
                  enum: ['sent', 'arrived', 'replied', 'ignored', 'read', 'unread'],
                  examples: ['read', 'ignored', 'unread']
                },
                from_path: {
                  type: 'string',
                  description: 'Optional absolute path for your project. Defaults to current working directory.',
                  pattern: '^/.*',
                  examples: ['/home/user/projects/backend']
                }
              },
              required: ['id', 'label']
            }
          },
          {
            name: 'list_messages',
            description: 'Get a simple list of recent messages with just IDs and titles.',
            inputSchema: {
              type: 'object',
              properties: {
                from_path: {
                  type: 'string',
                  description: 'Optional absolute path for your project. Defaults to current working directory.',
                  pattern: '^/.*',
                  examples: ['/home/user/projects/backend']
                },
                tail: {
                  type: 'integer',
                  description: 'Number of recent messages to list (1-100). Default is 10.',
                  minimum: 1,
                  maximum: 100,
                  default: 10,
                  examples: [5, 10, 20]
                }
              }
            }
          },
          {
            name: 'query_messages',
            description: 'Search through your messages by text content.',
            inputSchema: {
              type: 'object',
              properties: {
                from_path: {
                  type: 'string',
                  description: 'Optional absolute path for your project. Defaults to current working directory.',
                  pattern: '^/.*',
                  examples: ['/home/user/projects/backend']
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
            description: 'Check the health and performance of the communication server.',
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
            description: 'Get the count of unread messages in your mailbox.',
            inputSchema: {
              type: 'object',
              properties: {
                random_string: {
                  type: 'string',
                  description: 'Dummy parameter for no-parameter tools'
                },
                from_path: {
                  type: 'string',
                  description: 'Optional absolute path for your project. Defaults to current working directory.',
                  pattern: '^/.*',
                  examples: ['/home/user/projects/backend']
                }
              },
              required: ['random_string']
            }
          },
          {
            name: 'view_conversation_log',
            description: 'View the recent conversation log showing organized conversations between agents.',
            inputSchema: {
              type: 'object',
              properties: {
                random_string: {
                  type: 'string',
                  description: 'Dummy parameter for no-parameter tools'
                },
                from_path: {
                  type: 'string',
                  description: 'Optional absolute path for your project. Defaults to current working directory.',
                  pattern: '^/.*',
                  examples: ['/home/user/projects/backend']
                }
              },
              required: ['random_string']
            }
          },
          {
            name: 'get_conversation_stats',
            description: 'Get statistics about conversations and agent communication patterns.',
            inputSchema: {
              type: 'object',
              properties: {
                random_string: {
                  type: 'string',
                  description: 'Dummy parameter for no-parameter tools'
                },
                from_path: {
                  type: 'string',
                  description: 'Optional absolute path for your project. Defaults to current working directory.',
                  pattern: '^/.*',
                  examples: ['/home/user/projects/backend']
                }
              },
              required: ['random_string']
            }
          }
        ]
      };
    });

    // Create Agent Tool
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const startTime = Date.now();
      
      try {
        switch (request.params.name) {
          case 'create_agent': {
            const { path } = request.params.arguments as { path: string };
            const agent = await this.getOrCreateAgent(path);
            const existingAgent = this.db.getAgentByWorkspace(path);
            const status = existingAgent ? 'found' : 'created';
            
            const duration = Date.now() - startTime;
            this.logRequest('create_agent', true, undefined, duration);
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    agent_id: agent.id,
                    name: agent.name,
                    workspace_path: agent.workspacePath,
                    status
                  })
                }
              ]
            };
          }

          case 'send': {
            const { to_path, title, content, from_path } = request.params.arguments as { to_path: string; title: string; content: string; from_path?: string };
            
            if (!title || !content) {
              throw new Error('Title and content are required');
            }

            // Get or create recipient agent
            const recipient = await this.getOrCreateAgent(to_path);
            
            // Get or create sender agent (current workspace)
            const senderWorkspace = this.resolveWorkspacePath(from_path);
            const sender = await this.getOrCreateAgent(senderWorkspace);
            
            // Create conversation
            const conversation = createConversation(title, [sender.id, recipient.id], sender.id);
            this.db.createConversation(conversation);
            
            // Create message
            const message = createMessage(
              conversation.id,
              sender.id,
              recipient.id,
              title,
              content,
              MessageState.SENT
            );
            
            // Add sender information
            message.fromAgentName = sender.name;
            message.fromAgentRole = sender.role;
            message.fromAgentWorkspace = sender.workspacePath;
            message.toAgentName = recipient.name;
            message.toAgentRole = recipient.role;
            message.toAgentWorkspace = recipient.workspacePath;
            
            const messageId = this.db.createMessage(message);
            
            // Automatically mark as "arrived" for the recipient
            this.db.updateMessageState(messageId, 'arrived');
            
            const duration = Date.now() - startTime;
            this.logRequest('send', true, undefined, duration);
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    message_id: messageId,
                    to_agent: getDisplayName(recipient),
                    to_path: to_path,
                    to_address: getFullAddress(recipient),
                    subject: title,
                    status: 'sent'
                  })
                }
              ]
            };
          }

          case 'reply': {
            const { to_message, content, from_path } = request.params.arguments as { to_message: string; content: string; from_path?: string };
            
            if (!content) {
              throw new Error('Reply content is required');
            }

            // Get original message
            const originalMessage = this.db.getMessage(to_message);
            if (!originalMessage) {
              throw new Error(`Message '${to_message}' not found`);
            }

            // Get sender agent (current workspace)
            const senderWorkspace = this.resolveWorkspacePath(from_path);
            const sender = await this.getOrCreateAgent(senderWorkspace);
            
            // Get recipient agent
            const recipient = this.db.getAgent(originalMessage.fromAgent);
            if (!recipient) {
              throw new Error('Original sender not found');
            }

            // Create reply message
            const replyMessage = createMessage(
              originalMessage.conversationId,
              sender.id,
              recipient.id,
              `Re: ${originalMessage.subject}`,
              content,
              MessageState.REPLIED,
              to_message
            );
            
            // Add sender information
            replyMessage.fromAgentName = sender.name;
            replyMessage.fromAgentRole = sender.role;
            replyMessage.fromAgentWorkspace = sender.workspacePath;
            replyMessage.toAgentName = recipient.name;
            replyMessage.toAgentRole = recipient.role;
            replyMessage.toAgentWorkspace = recipient.workspacePath;
            
            const messageId = this.db.createMessage(replyMessage);
            
            // Update original message state to "replied"
            this.db.updateMessageState(to_message, 'replied');
            
            const duration = Date.now() - startTime;
            this.logRequest('reply', true, undefined, duration);
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    message_id: messageId,
                    reply_to: to_message,
                    subject: `Re: ${originalMessage.subject}`,
                    status: 'sent'
                  })
                }
              ]
            };
          }

          case 'check_mailbox': {
            const { limit = 50, from_path } = request.params.arguments as { limit?: number; from_path?: string };
            
            if (limit < 1 || limit > 500) {
              throw new Error('Limit must be between 1 and 500');
            }

            // Get sender agent
            const senderWorkspace = this.resolveWorkspacePath(from_path);
            const sender = await this.getOrCreateAgent(senderWorkspace);
            
            // Get recent messages with limit
            const messages = this.db.getMessagesForAgent(sender.id, limit);
            
            // Get total count for pagination info
            const allMessages = this.db.getMessagesForAgent(sender.id, 10000);
            const totalMessages = allMessages.length;
            const hasMore = totalMessages > limit;
            
            // Format results
            const result = messages.map(msg => {
              const fromAgent = this.db.getAgent(msg.fromAgent);
              const toAgent = this.db.getAgent(msg.toAgent);
              
              return {
                id: msg.id,
                from_agent: fromAgent ? getDisplayName(fromAgent) : 'Unknown',
                from_address: fromAgent ? getFullAddress(fromAgent) : 'Unknown',
                to_agent: toAgent ? getDisplayName(toAgent) : 'Unknown',
                to_address: toAgent ? getFullAddress(toAgent) : 'Unknown',
                subject: msg.subject,
                content: msg.content.length > 100 ? msg.content.substring(0, 100) + '...' : msg.content,
                created_at: msg.createdAt.toISOString(),
                state: msg.state,
                is_read: msg.isRead
              };
            });
            
            const duration = Date.now() - startTime;
            this.logRequest('check_mailbox', true, undefined, duration);
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    messages: result,
                    count: result.length,
                    total_messages: totalMessages,
                    has_more: hasMore,
                    limit_requested: limit
                  })
                }
              ]
            };
          }

          case 'label_messages': {
            const { id, label, from_path } = request.params.arguments as { id: string; label: string; from_path?: string };
            
            const validLabels = ['sent', 'arrived', 'replied', 'ignored', 'read', 'unread'];
            if (!validLabels.includes(label)) {
              throw new Error(`Invalid label '${label}'. Must be one of: ${validLabels.join(', ')}`);
            }

            // Get the message
            const message = this.db.getMessage(id);
            if (!message) {
              throw new Error(`Message '${id}' not found`);
            }

            // Get sender agent to verify ownership
            const senderWorkspace = this.resolveWorkspacePath(from_path);
            const sender = await this.getOrCreateAgent(senderWorkspace);
            
            // Check if this message belongs to the sender (either sent or received)
            if (message.fromAgent !== sender.id && message.toAgent !== sender.id) {
              throw new Error('You can only label messages in your mailbox');
            }

            // Update the message state
            const oldState = message.state;
            const readAt = label === 'read' ? new Date() : undefined;
            
            this.db.updateMessageState(id, label, readAt);
            
            const duration = Date.now() - startTime;
            this.logRequest('label_messages', true, undefined, duration);
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    message_id: id,
                    old_state: oldState,
                    new_state: label,
                    status: 'labeled',
                    read_at: readAt?.toISOString()
                  })
                }
              ]
            };
          }

          case 'list_messages': {
            const { tail = 10, from_path } = request.params.arguments as { tail?: number; from_path?: string };
            
            if (tail < 1 || tail > 100) {
              throw new Error('tail must be between 1 and 100');
            }

            // Get sender agent
            const senderWorkspace = this.resolveWorkspacePath(from_path);
            const sender = await this.getOrCreateAgent(senderWorkspace);
            
            // Get recent messages
            const messages = this.db.getMessagesForAgent(sender.id, tail);
            
            // Format results
            const result = messages.map(msg => ({
              id: msg.id,
              title: msg.subject,
              from_agent: msg.fromAgentName || 'Unknown',
              to_agent: msg.toAgentName || 'Unknown',
              created_at: msg.createdAt.toISOString(),
              state: msg.state
            }));
            
            const duration = Date.now() - startTime;
            this.logRequest('list_messages', true, undefined, duration);
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    messages: result,
                    count: result.length,
                    requested_count: tail
                  })
                }
              ]
            };
          }

          case 'query_messages': {
            const { query, from_path } = request.params.arguments as { query: string; from_path?: string };
            
            if (!query) {
              throw new Error('Search query is required');
            }

            // Get sender agent
            const senderWorkspace = this.resolveWorkspacePath(from_path);
            const sender = await this.getOrCreateAgent(senderWorkspace);
            
            // Search messages
            const messages = this.db.searchMessages(sender.id, query, 50);
            
            // Format results
            const result = messages.map(msg => ({
              id: msg.id,
              from_agent: msg.fromAgentName || 'Unknown',
              to_agent: msg.toAgentName || 'Unknown',
              subject: msg.subject,
              content: msg.content.length > 100 ? msg.content.substring(0, 100) + '...' : msg.content,
              created_at: msg.createdAt.toISOString(),
              state: msg.state
            }));
            
            const duration = Date.now() - startTime;
            this.logRequest('query_messages', true, undefined, duration);
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    messages: result,
                    count: result.length,
                    query: query
                  })
                }
              ]
            };
          }

          case 'get_server_health': {
            const uptime = Date.now() - this.startTime.getTime();
            
            // Check database connectivity
            let dbHealthy = false;
            try {
              this.db.getDatabaseStats();
              dbHealthy = true;
            } catch (error) {
              console.error('Database health check failed:', error);
            }
            
            // Get performance stats
            const perfStats = this.getPerformanceStats();
            
            const healthData = {
              status: dbHealthy ? 'healthy' : 'degraded',
              uptime_seconds: Math.floor(uptime / 1000),
              uptime_formatted: new Date(uptime).toISOString().substr(11, 8),
              database_healthy: dbHealthy,
              request_count: this.requestCount,
              error_count: this.errorCount,
              error_rate: Math.round((this.errorCount / Math.max(this.requestCount, 1)) * 100 * 100) / 100,
              performance: perfStats
            };
            
            const duration = Date.now() - startTime;
            this.logRequest('get_server_health', true, undefined, duration);
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(healthData)
                }
              ]
            };
          }

          case 'get_unread_count': {
            const { from_path } = request.params.arguments as { from_path?: string };
            // Get sender agent
            const senderWorkspace = this.resolveWorkspacePath(from_path);
            const sender = await this.getOrCreateAgent(senderWorkspace);
            
            // Get all messages for this agent
            const messages = this.db.getMessagesForAgent(sender.id, 1000);
            
            // Count unread messages
            const unreadCount = messages.filter(msg => !msg.isRead && msg.toAgent === sender.id).length;
            const totalMessages = messages.length;
            const unreadPercentage = Math.round((unreadCount / Math.max(totalMessages, 1)) * 100 * 10) / 10;
            
            const duration = Date.now() - startTime;
            this.logRequest('get_unread_count', true, undefined, duration);
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    unread_count: unreadCount,
                    total_messages: totalMessages,
                    unread_percentage: unreadPercentage
                  })
                }
              ]
            };
          }

          case 'view_conversation_log': {
            // For now, return a simple conversation log
            const { from_path } = request.params.arguments as { from_path?: string };
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
            
            const duration = Date.now() - startTime;
            this.logRequest('view_conversation_log', true, undefined, duration);
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
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
                  })
                }
              ]
            };
          }

          case 'get_conversation_stats': {
            const { from_path } = request.params.arguments as { from_path?: string };
            const senderWorkspace = this.resolveWorkspacePath(from_path);
            const sender = await this.getOrCreateAgent(senderWorkspace);
            const messages = this.db.getMessagesForAgent(sender.id, 1000);
            
            const totalMessages = messages.length;
            const totalConversations = new Set(messages.map(m => m.conversationId)).size;
            const activeConversations = totalConversations; // Simplified
            const recentConversations = totalConversations; // Simplified
            const completedConversations = 0; // Simplified
            const avgMessagesPerConversation = totalConversations > 0 ? Math.round((totalMessages / totalConversations) * 100) / 100 : 0;
            
            const duration = Date.now() - startTime;
            this.logRequest('get_conversation_stats', true, undefined, duration);
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    total_conversations: totalConversations,
                    active_conversations: activeConversations,
                    recent_conversations: recentConversations,
                    completed_conversations: completedConversations,
                    total_messages: totalMessages,
                    avg_messages_per_conversation: avgMessagesPerConversation
                  })
                }
              ]
            };
          }

          default:
            throw new Error(`Unknown tool: ${request.params.name}`);
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        this.logRequest(request.params.name, false, error instanceof Error ? error.message : String(error), duration);
        
        throw error;
      }
    });
  }

  async run(): Promise<void> {
    console.error('🚀 Starting stable communication server.');
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.error('🔄 MCP server started successfully');
  }
}
