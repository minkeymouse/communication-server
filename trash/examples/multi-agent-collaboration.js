#!/usr/bin/env node
/**
 * Multi-Agent Collaboration Example
 * Demonstrates how multiple agents can communicate and collaborate
 */

import { spawn } from 'child_process';
import { randomUUID } from 'crypto';

class MultiAgentCollaboration {
  constructor() {
    this.serverProcess = null;
    this.agents = {
      supervisor: { id: `supervisor-${Date.now()}`, sessionToken: null },
      frontend: { id: `frontend-dev-${Date.now()}`, sessionToken: null },
      backend: { id: `backend-dev-${Date.now()}`, sessionToken: null },
      tester: { id: `tester-${Date.now()}`, sessionToken: null }
    };
  }

  async startServer() {
    console.log('🚀 Starting communication server...');
    
    return new Promise((resolve, reject) => {
      this.serverProcess = spawn('node', ['dist/index-simplified.js'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.serverProcess.stderr.on('data', (data) => {
        const output = data.toString();
        if (output.includes('MCP server started successfully')) {
          console.log('✅ Server started successfully');
          resolve();
        }
      });

      this.serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('MCP server started successfully')) {
          console.log('✅ Server started successfully');
          resolve();
        }
      });

      this.serverProcess.on('error', (error) => {
        console.error('❌ Failed to start server:', error);
        reject(error);
      });

      setTimeout(() => {
        reject(new Error('Server startup timeout'));
      }, 10000);
    });
  }

  async sendRequest(method, params = {}) {
    const request = {
      jsonrpc: '2.0',
      id: randomUUID(),
      method: method,
      params: params
    };

    return new Promise((resolve, reject) => {
      if (!this.serverProcess) {
        reject(new Error('Server not started'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 10000);

      this.serverProcess.stdout.removeAllListeners('data');
      this.serverProcess.stderr.removeAllListeners('data');

      this.serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.trim().startsWith('{')) {
          try {
            const response = JSON.parse(output);
            clearTimeout(timeout);
            resolve(response);
          } catch (e) {
            // Incomplete JSON, wait for more data
          }
        }
      });

      this.serverProcess.stderr.on('data', (data) => {
        // Ignore stderr for now
      });

      this.serverProcess.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  async createAgent(agentKey, agentConfig) {
    console.log(`\n📝 Creating ${agentKey} agent...`);
    
    const result = await this.sendRequest('tools/call', {
      name: 'create_agent',
      arguments: {
        agent_id: this.agents[agentKey].id,
        name: agentConfig.name,
        workspace_path: agentConfig.workspace,
        role: agentConfig.role,
        description: agentConfig.description,
        capabilities: agentConfig.capabilities,
        tags: agentConfig.tags
      }
    });

    if (result.result && result.result.content) {
      const data = JSON.parse(result.result.content[0].text);
      console.log(`✅ ${agentKey} agent created:`, data.agent_id);
      return true;
    }
    
    console.log(`❌ ${agentKey} agent creation failed`);
    return false;
  }

  async loginAgent(agentKey) {
    console.log(`\n🔐 Logging in ${agentKey} agent...`);
    
    const result = await this.sendRequest('tools/call', {
      name: 'login',
      arguments: {
        agent_id: this.agents[agentKey].id,
        session_minutes: 60
      }
    });

    if (result.result && result.result.content) {
      const data = JSON.parse(result.result.content[0].text);
      if (data.authenticated && data.session_token) {
        this.agents[agentKey].sessionToken = data.session_token;
        console.log(`✅ ${agentKey} agent logged in`);
        return true;
      }
    }
    
    console.log(`❌ ${agentKey} agent login failed`);
    return false;
  }

  async sendMessage(fromAgent, toAgent, title, content, priority = 'normal') {
    console.log(`\n📤 ${fromAgent} sending message to ${toAgent}...`);
    
    const result = await this.sendRequest('tools/call', {
      name: 'send',
      arguments: {
        session_token: this.agents[fromAgent].sessionToken,
        to_agent_id: this.agents[toAgent].id,
        title: title,
        content: content,
        priority: priority,
        security_level: 'basic'
      }
    });

    if (result.result && result.result.content) {
      const data = JSON.parse(result.result.content[0].text);
      console.log(`✅ Message sent: ${data.message_id}`);
      return data.message_id;
    }
    
    console.log(`❌ Message send failed`);
    return null;
  }

  async checkMailbox(agentKey, limit = 10) {
    console.log(`\n📬 Checking ${agentKey} agent mailbox...`);
    
    const result = await this.sendRequest('tools/call', {
      name: 'check_mailbox',
      arguments: {
        agent_id: this.agents[agentKey].id,
        session_token: this.agents[agentKey].sessionToken,
        limit: limit
      }
    });

    if (result.result && result.result.content) {
      const data = JSON.parse(result.result.content[0].text);
      console.log(`✅ ${agentKey} has ${data.messages.length} messages`);
      return data.messages;
    }
    
    console.log(`❌ ${agentKey} mailbox check failed`);
    return [];
  }

  async listAgents() {
    console.log('\n👥 Listing all agents...');
    
    const result = await this.sendRequest('tools/call', {
      name: 'list_agents',
      arguments: {
        path: '/tmp/collaboration-workspace'
      }
    });

    if (result.result && result.result.content) {
      const data = JSON.parse(result.result.content[0].text);
      console.log(`✅ Found ${data.agents.length} agents in workspace`);
      
      data.agents.forEach((agent, index) => {
        console.log(`  ${index + 1}. ${agent.name} (${agent.role})`);
      });
      
      return data.agents;
    }
    
    console.log('❌ Agent listing failed');
    return [];
  }

  async runCollaborationExample() {
    console.log('🎯 Multi-Agent Collaboration Example\n');
    
    try {
      await this.startServer();
      
      // Define agent configurations
      const agentConfigs = {
        supervisor: {
          name: 'Project Supervisor',
          workspace: '/tmp/collaboration-workspace',
          role: 'manager',
          description: 'Supervises the development project',
          capabilities: ['project-management', 'coordination'],
          tags: ['management', 'supervisor']
        },
        frontend: {
          name: 'Frontend Developer',
          workspace: '/tmp/collaboration-workspace',
          role: 'developer',
          description: 'Handles frontend development tasks',
          capabilities: ['react', 'typescript', 'ui-design'],
          tags: ['frontend', 'development']
        },
        backend: {
          name: 'Backend Developer',
          workspace: '/tmp/collaboration-workspace',
          role: 'developer',
          description: 'Handles backend development tasks',
          capabilities: ['nodejs', 'database', 'api-development'],
          tags: ['backend', 'development']
        },
        tester: {
          name: 'QA Tester',
          workspace: '/tmp/collaboration-workspace',
          role: 'tester',
          description: 'Handles testing and quality assurance',
          capabilities: ['testing', 'qa', 'automation'],
          tags: ['testing', 'qa']
        }
      };

      // Step 1: Create all agents
      console.log('📋 Step 1: Creating all agents...');
      for (const [agentKey, config] of Object.entries(agentConfigs)) {
        const success = await this.createAgent(agentKey, config);
        if (!success) {
          console.log(`❌ Stopping example - ${agentKey} agent creation failed`);
          return;
        }
      }

      // Step 2: Login all agents
      console.log('\n🔐 Step 2: Logging in all agents...');
      for (const agentKey of Object.keys(this.agents)) {
        const success = await this.loginAgent(agentKey);
        if (!success) {
          console.log(`❌ Stopping example - ${agentKey} agent login failed`);
          return;
        }
      }

      // Step 3: Supervisor assigns tasks
      console.log('\n📋 Step 3: Supervisor assigning tasks...');
      
      await this.sendMessage(
        'supervisor',
        'frontend',
        'Frontend Task Assignment',
        'Please implement the user authentication UI components. Use React with TypeScript and follow the design guidelines.',
        'high'
      );

      await this.sendMessage(
        'supervisor',
        'backend',
        'Backend Task Assignment',
        'Please implement the authentication API endpoints. Use Node.js with JWT tokens and secure password hashing.',
        'high'
      );

      await this.sendMessage(
        'supervisor',
        'tester',
        'Testing Task Assignment',
        'Please create test cases for both frontend and backend authentication features. Include unit tests and integration tests.',
        'normal'
      );

      // Step 4: Agents acknowledge tasks
      console.log('\n✅ Step 4: Agents acknowledging tasks...');
      
      await this.sendMessage(
        'frontend',
        'supervisor',
        'Task Acknowledgment - Frontend',
        'Received the authentication UI task. I will start implementing the login and registration components using React and TypeScript.',
        'normal'
      );

      await this.sendMessage(
        'backend',
        'supervisor',
        'Task Acknowledgment - Backend',
        'Received the authentication API task. I will implement the endpoints with JWT tokens and bcrypt for password hashing.',
        'normal'
      );

      await this.sendMessage(
        'tester',
        'supervisor',
        'Task Acknowledgment - Testing',
        'Received the testing task. I will create comprehensive test cases covering both frontend and backend authentication flows.',
        'normal'
      );

      // Step 5: Frontend and Backend collaborate
      console.log('\n🤝 Step 5: Frontend and Backend collaboration...');
      
      await this.sendMessage(
        'frontend',
        'backend',
        'API Integration Question',
        'What are the expected request/response formats for the authentication endpoints? I need to know the exact API structure.',
        'normal'
      );

      await this.sendMessage(
        'backend',
        'frontend',
        'API Documentation',
        'Here are the API endpoints:\n\nPOST /auth/login\n- Request: { email, password }\n- Response: { token, user }\n\nPOST /auth/register\n- Request: { email, password, name }\n- Response: { token, user }',
        'normal'
      );

      // Step 6: Check all mailboxes
      console.log('\n📬 Step 6: Checking all agent mailboxes...');
      
      for (const agentKey of Object.keys(this.agents)) {
        const messages = await this.checkMailbox(agentKey);
        console.log(`\n${agentKey.toUpperCase()} messages:`);
        messages.forEach((msg, index) => {
          console.log(`  ${index + 1}. ${msg.subject} (from: ${msg.from_agent})`);
        });
      }

      // Step 7: List all agents
      await this.listAgents();

      console.log('\n🎉 Multi-agent collaboration example completed successfully!');
      console.log('\n📋 Summary:');
      console.log('  - 4 agents created and authenticated');
      console.log('  - Supervisor assigned tasks to team members');
      console.log('  - Team members acknowledged their tasks');
      console.log('  - Frontend and Backend collaborated on API integration');
      console.log('  - All agents can communicate and coordinate');
      
    } catch (error) {
      console.error('❌ Example execution failed:', error);
    } finally {
      if (this.serverProcess) {
        this.serverProcess.kill();
        console.log('\n🛑 Server stopped');
      }
    }
  }
}

// Run the example
const example = new MultiAgentCollaboration();
example.runCollaborationExample().catch(console.error);
