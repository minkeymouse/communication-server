#!/usr/bin/env node
/**
 * Basic Agent Communication Example
 * Demonstrates the core workflow: create agent, login, send message, check mailbox
 */

import { spawn } from 'child_process';
import { randomUUID } from 'crypto';

class BasicAgentCommunication {
  constructor() {
    this.serverProcess = null;
    this.agentId = `example-agent-${Date.now()}`;
    this.sessionToken = null;
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

  async createAgent() {
    console.log('\n📝 Step 1: Creating agent...');
    
    const result = await this.sendRequest('tools/call', {
      name: 'create_agent',
      arguments: {
        agent_id: this.agentId,
        name: 'Example Agent',
        workspace_path: '/tmp/example-workspace',
        role: 'developer',
        description: 'Example agent for demonstration',
        capabilities: ['communication', 'testing'],
        tags: ['example', 'demo']
      }
    });

    if (result.result && result.result.content) {
      const data = JSON.parse(result.result.content[0].text);
      console.log('✅ Agent created:', data.agent_id);
      return true;
    }
    
    console.log('❌ Agent creation failed');
    return false;
  }

  async login() {
    console.log('\n🔐 Step 2: Logging in...');
    
    const result = await this.sendRequest('tools/call', {
      name: 'login',
      arguments: {
        agent_id: this.agentId,
        session_minutes: 30
      }
    });

    if (result.result && result.result.content) {
      const data = JSON.parse(result.result.content[0].text);
      if (data.authenticated && data.session_token) {
        this.sessionToken = data.session_token;
        console.log('✅ Login successful');
        return true;
      }
    }
    
    console.log('❌ Login failed');
    return false;
  }

  async sendMessage() {
    console.log('\n📤 Step 3: Sending message...');
    
    const result = await this.sendRequest('tools/call', {
      name: 'send',
      arguments: {
        session_token: this.sessionToken,
        to_agent_id: this.agentId, // Send to self for demo
        title: 'Hello from Example Agent',
        content: 'This is a test message demonstrating basic communication.',
        priority: 'normal',
        security_level: 'basic'
      }
    });

    if (result.result && result.result.content) {
      const data = JSON.parse(result.result.content[0].text);
      console.log('✅ Message sent:', data.message_id);
      return data.message_id;
    }
    
    console.log('❌ Message send failed');
    return null;
  }

  async checkMailbox() {
    console.log('\n📬 Step 4: Checking mailbox...');
    
    const result = await this.sendRequest('tools/call', {
      name: 'check_mailbox',
      arguments: {
        agent_id: this.agentId,
        session_token: this.sessionToken,
        limit: 10
      }
    });

    if (result.result && result.result.content) {
      const data = JSON.parse(result.result.content[0].text);
      console.log(`✅ Found ${data.messages.length} messages`);
      
      data.messages.forEach((msg, index) => {
        console.log(`  ${index + 1}. ${msg.subject} (${msg.state})`);
      });
      
      return data.messages;
    }
    
    console.log('❌ Mailbox check failed');
    return [];
  }

  async labelMessage(messageId) {
    console.log('\n🏷️ Step 5: Labeling message...');
    
    const result = await this.sendRequest('tools/call', {
      name: 'label_messages',
      arguments: {
        id: messageId,
        label: 'read',
        from_path: '/tmp/example-workspace'
      }
    });

    if (result.result && result.result.content) {
      const data = JSON.parse(result.result.content[0].text);
      console.log('✅ Message labeled as read');
      return true;
    }
    
    console.log('❌ Message labeling failed');
    return false;
  }

  async getServerHealth() {
    console.log('\n🏥 Step 6: Checking server health...');
    
    const result = await this.sendRequest('tools/call', {
      name: 'get_server_health',
      arguments: {
        random_string: 'health-check'
      }
    });

    if (result.result && result.result.content) {
      const data = JSON.parse(result.result.content[0].text);
      console.log('✅ Server health check:');
      console.log(`  Status: ${data.status}`);
      console.log(`  Uptime: ${data.uptime_seconds}s`);
      console.log(`  Active Agents: ${data.database.active_agents}`);
      console.log(`  Total Messages: ${data.database.total_messages}`);
      console.log(`  Active Sessions: ${data.sessions.active_sessions}`);
      console.log(`  Memory Usage: ${data.memory.heap_used_mb}MB`);
      return true;
    }
    
    console.log('❌ Health check failed');
    return false;
  }

  async runExample() {
    console.log('🎯 Basic Agent Communication Example\n');
    
    try {
      await this.startServer();
      
      // Step 1: Create agent
      const createSuccess = await this.createAgent();
      if (!createSuccess) {
        console.log('❌ Stopping example - agent creation failed');
        return;
      }
      
      // Step 2: Login
      const loginSuccess = await this.login();
      if (!loginSuccess) {
        console.log('❌ Stopping example - login failed');
        return;
      }
      
      // Step 3: Send message
      const messageId = await this.sendMessage();
      if (!messageId) {
        console.log('❌ Stopping example - message send failed');
        return;
      }
      
      // Step 4: Check mailbox
      const messages = await this.checkMailbox();
      if (messages.length === 0) {
        console.log('❌ Stopping example - no messages found');
        return;
      }
      
      // Step 5: Label message
      await this.labelMessage(messageId);
      
      // Step 6: Check server health
      await this.getServerHealth();
      
      console.log('\n🎉 Basic communication example completed successfully!');
      console.log('\n📋 Summary:');
      console.log('  - Agent created and authenticated');
      console.log('  - Message sent and received');
      console.log('  - Message labeled as read');
      console.log('  - Server health verified');
      
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
const example = new BasicAgentCommunication();
example.runExample().catch(console.error);
