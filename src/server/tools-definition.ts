/**
 * MCP Tools Definition
 * Centralized tool schema definitions
 */

export const TOOLS_DEFINITION = [
  {
    name: 'create_agent',
    description: 'Register a new agent in the communication system',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: { 
          type: 'string', 
          description: 'Unique identifier for the agent (max 100 chars)',
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
          examples: ['/home/user/projects/frontend', '/workspace/project']
        },
        role: { 
          type: 'string', 
          enum: ['general', 'developer', 'manager', 'analyst', 'tester', 'designer', 'coordinator'],
          description: 'Role of the agent in the system',
          default: 'general'
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
    name: 'login',
    description: 'Authenticate an agent and start a session',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: { type: 'string', description: 'Agent ID to authenticate' },
        session_minutes: { type: 'number', description: 'Session duration in minutes (auto-expires). Default 4320 (72 hours).', default: 4320, minimum: 1, maximum: 4320 }
      },
      required: ['agent_id']
    }
  },
  {
    name: 'communicate',
    description: 'Unified communication tool - send messages, check mailbox, and manage conversations',
    inputSchema: {
      type: 'object',
      properties: {
        action: { 
          type: 'string', 
          enum: ['send', 'receive', 'reply', 'mark_read', 'mark_replied'],
          description: 'Communication action to perform'
        },
        session_token: { type: 'string', description: 'Session token from login (required for most actions)' },
        to_agent: { type: 'string', description: 'Recipient agent ID (for send/reply actions)' },
        from_agent: { type: 'string', description: 'Sender agent ID (alternative to session_token)' },
        agent_id: { type: 'string', description: 'Agent ID for the operation (required for receive action)' },
        message_id: { type: 'string', description: 'Message ID (for reply/mark actions)' },
        title: { type: 'string', description: 'Message title/subject (for send/reply actions)' },
        content: { type: 'string', description: 'Message content (for send/reply actions)' },
        priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
        security_level: { type: 'string', enum: ['none', 'basic', 'signed', 'encrypted'], default: 'basic' },
        limit: { type: 'number', description: 'Maximum messages to return (for receive action)', default: 50, minimum: 1, maximum: 500 }
      },
      required: ['action']
    }
  },
  {
    name: 'manage_messages',
    description: 'Bulk message management - mark read, update states, delete messages',
    inputSchema: {
      type: 'object',
      properties: {
        action: { 
          type: 'string', 
          enum: ['mark_read', 'update_states', 'delete', 'empty_mailbox'],
          description: 'Bulk action to perform'
        },
        session_token: { type: 'string', description: 'Session token from login' },
        agent_id: { type: 'string', description: 'Agent ID for the operation' },
        message_ids: { type: 'array', items: { type: 'string' }, description: 'Array of message IDs (for mark_read/update_states)' },
        new_state: { type: 'string', enum: ['sent', 'arrived', 'replied', 'ignored', 'read', 'unread'], description: 'New state for messages' },
        query: { type: 'string', description: 'Optional query to filter messages (for delete/empty_mailbox)' }
      },
      required: ['action']
    }
  },
  {
    name: 'discover_agents',
    description: 'List and discover agents in the system',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_path: { type: 'string', description: 'Workspace path to search in' },
        role_filter: { type: 'string', description: 'Filter by agent role' },
        capability_filter: { type: 'string', description: 'Filter by capability' },
        active_only: { type: 'boolean', description: 'Show only active agents', default: true }
      }
    }
  },
  {
    name: 'get_templates',
    description: 'Get pre-built message templates for common use cases',
    inputSchema: {
      type: 'object',
      properties: {
        template_type: { 
          type: 'string', 
          enum: ['greeting', 'task_request', 'status_update', 'feedback', 'error_report', 'completion_notice'],
          description: 'Type of template to retrieve'
        },
        custom_fields: { 
          type: 'object', 
          description: 'Custom fields to inject into the template',
          additionalProperties: true
        }
      }
    }
  },
  {
    name: 'system_status',
    description: 'Get comprehensive system health and performance metrics',
    inputSchema: {
      type: 'object',
      properties: {
        include_analytics: { type: 'boolean', description: 'Include detailed analytics data', default: false },
        include_performance: { type: 'boolean', description: 'Include performance metrics', default: false },
        include_security: { type: 'boolean', description: 'Include security status', default: false }
      }
    }
  },
  {
    name: 'agent_sync_status',
    description: 'Get agent synchronization status and detect identity drift, ghost agents, and conversation issues',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: { type: 'string', description: 'Specific agent ID to check (optional)' },
        include_drift_analysis: { type: 'boolean', description: 'Include detailed identity drift analysis', default: true },
        include_ghost_detection: { type: 'boolean', description: 'Include ghost agent detection results', default: true },
        include_conversation_health: { type: 'boolean', description: 'Include conversation coherence analysis', default: true },
        time_range: { type: 'string', enum: ['1h', '24h', '7d'], description: 'Time range for analysis', default: '24h' }
      }
    }
  }
];
