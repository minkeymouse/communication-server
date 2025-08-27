/**
 * Agent Handler
 * Handles agent creation, authentication, and discovery operations
 */

import { DatabaseManager } from '../../infrastructure/database/database-manager.js';
import { AgentMonitor } from '../../services/index.js';
import { 
  Agent, 
  AgentRole, 
  createAgent,
  authenticateAgent
} from '../../domain/agents/models.js';

export class AgentHandler {
  constructor(
    private db: DatabaseManager,
    private agentMonitor: AgentMonitor
  ) {}

  async handleCreateAgent(args: any): Promise<any> {
    const { name, workspace_path, role, description, capabilities, tags, agent_id } = args;
    
    if (!agent_id) {
      throw new Error('agent_id is required for agent creation');
    }
    if (!name) {
      throw new Error('name is required for agent creation');
    }
    if (agent_id.length > 100) {
      throw new Error('agent_id must be 100 characters or less');
    }
    if (name.length > 200) {
      throw new Error('name must be 200 characters or less');
    }
    if (description && description.length > 1000) {
      throw new Error('description must be 1000 characters or less');
    }

    const existingAgent = this.db.getAgent(agent_id);
    if (existingAgent) {
      throw new Error(`Agent with ID '${agent_id}' already exists`);
    }

    const agent = createAgent(
      name,
      workspace_path,
      role || AgentRole.GENERAL,
      description,
      capabilities,
      tags,
      'system',
      agent_id
    );
    
    try {
      this.db.createAgent(agent);
      
      return {
        agent_id: agent.id,
        name: agent.name,
        workspace_path: agent.workspacePath,
        status: 'created',
        credentials: {
          agent_id: agent.id,
          has_authentication: true
        }
      };
    } catch (error: any) {
      console.error(`Failed to create agent '${agent_id}':`, error);
      throw new Error(`Failed to create agent: ${error.message}`);
    }
  }

  async handleLogin(args: any): Promise<any> {
    const { agent_id, session_minutes = 30 } = args;
    
    if (!agent_id) {
      throw new Error('agent_id is required for login');
    }
    if (session_minutes < 1 || session_minutes > 4320) {
      throw new Error('session_minutes must be between 1 and 4320');
    }

    const agent = this.db.getAgent(agent_id);
    if (!agent) {
      throw new Error(`Agent with ID '${agent_id}' not found`);
    }

    if (!agent.isActive) {
      throw new Error(`Agent '${agent_id}' is not active`);
    }

    const ok = authenticateAgent(agent, agent_id);
    if (!ok) {
      return { 
        agent_id, 
        authenticated: false,
        error: 'Authentication failed'
      };
    }

    try {
      const sess = this.db.createSession(agent_id, session_minutes);
      
      this.db.updateAgentLastSeen(agent_id);
      this.agentMonitor.markAgentOnline(agent_id, sess.sessionToken);
      
      return {
        agent_id,
        authenticated: true,
        session_token: sess.sessionToken,
        expires_at: sess.expiresAt.toISOString(),
        session_duration_minutes: session_minutes
      };
    } catch (error: any) {
      console.error(`Failed to create session for agent '${agent_id}':`, error);
      throw new Error(`Failed to create session: ${error.message}`);
    }
  }

  async handleDiscoverAgents(args: any): Promise<any> {
    const { workspace_path, role_filter, capability_filter, active_only = true } = args;
    
    let agents: Agent[] = [];
    
    if (workspace_path) {
      agents = this.db.getAgentsByWorkspace(workspace_path);
    } else {
      agents = this.db.getAllActiveAgents();
    }
    
    if (role_filter) {
      agents = agents.filter(agent => agent.role === role_filter);
    }
    
    if (capability_filter) {
      agents = agents.filter(agent => 
        agent.capabilities && agent.capabilities.includes(capability_filter)
      );
    }
    
    if (active_only) {
      agents = agents.filter(agent => {
        const status = this.agentMonitor.getAgentStatus(agent.id);
        return status && status.isOnline;
      });
    }
    
    return {
      agents: agents.map(agent => ({
        id: agent.id,
        name: agent.name,
        role: agent.role,
        workspace_path: agent.workspacePath,
        capabilities: agent.capabilities,
        tags: agent.tags,
        is_active: (() => {
          const status = this.agentMonitor.getAgentStatus(agent.id);
          return status && status.isOnline;
        })(),
        last_activity: (() => {
          const status = this.agentMonitor.getAgentStatus(agent.id);
          return status?.lastSeen?.toISOString();
        })()
      })),
      total_count: agents.length,
      filters_applied: {
        workspace_path,
        role_filter,
        capability_filter,
        active_only
      }
    };
  }
}
