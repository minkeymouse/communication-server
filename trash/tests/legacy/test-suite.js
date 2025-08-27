#!/usr/bin/env node
/**
 * Communication Server Test Suite
 * Tests all essential 10 tools for core functionality
 */

import { spawn } from 'child_process';
import { randomUUID } from 'crypto';

class CommunicationTestSuite {
  constructor() {
    this.serverProcess = null;
    this.agentId = `test-agent-${Date.now()}`;
    this.sessionToken = null;
    this.testResults = [];
  }

  async startServer() {
    console.log('🚀 Starting simplified communication server...');
    
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

      // Clear any existing listeners
      this.serverProcess.stdout.removeAllListeners('data');
      this.serverProcess.stderr.removeAllListeners('data');

      this.serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        // Skip non-JSON output (like debug messages)
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

  async testCreateAgent() {
    console.log('\n📝 Testing create_agent...');
    
    const result = await this.sendRequest('tools/call', {
      name: 'create_agent',
      arguments: {
        agent_id: this.agentId,
        name: 'Test Agent',
        workspace_path: '/data/communication_server',
        role: 'developer',
        description: 'Test agent for comprehensive testing',
        capabilities: ['testing', 'development'],
        tags: ['test', 'comprehensive']
      }
    });

    if (result.result && result.result.content) {
      const data = JSON.parse(result.result.content[0].text);
      if (data.agent_id === this.agentId && data.status === 'created') {
        console.log('✅ create_agent: PASSED');
        this.testResults.push({ test: 'create_agent', status: 'PASSED' });
        return true;
      }
    }
    
    console.log('❌ create_agent: FAILED');
    this.testResults.push({ test: 'create_agent', status: 'FAILED', error: result });
    return false;
  }

  async testLogin() {
    console.log('\n🔐 Testing login...');
    
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
        console.log('✅ login: PASSED');
        this.testResults.push({ test: 'login', status: 'PASSED' });
        return true;
      }
    }
    
    console.log('❌ login: FAILED');
    this.testResults.push({ test: 'login', status: 'FAILED', error: result });
    return false;
  }

  async testSend() {
    console.log('\n📤 Testing send...');
    
    if (!this.sessionToken) {
      console.log('❌ send: FAILED (no session token)');
      this.testResults.push({ test: 'send', status: 'FAILED', error: 'No session token' });
      return false;
    }

    const result = await this.sendRequest('tools/call', {
      name: 'send',
      arguments: {
        session_token: this.sessionToken,
        to_agent_id: this.agentId,
        title: 'Test Message',
        content: 'This is a test message for comprehensive testing',
        priority: 'normal',
        security_level: 'basic'
      }
    });

    if (result.result && result.result.content) {
      const data = JSON.parse(result.result.content[0].text);
      if (data.message_id && data.status === 'sent') {
        console.log('✅ send: PASSED');
        this.testResults.push({ test: 'send', status: 'PASSED' });
        return true;
      }
    }
    
    console.log('❌ send: FAILED');
    this.testResults.push({ test: 'send', status: 'FAILED', error: result });
    return false;
  }

  async testCheckMailbox() {
    console.log('\n📬 Testing check_mailbox...');
    
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
      if (data.messages && Array.isArray(data.messages)) {
        console.log('✅ check_mailbox: PASSED');
        this.testResults.push({ test: 'check_mailbox', status: 'PASSED' });
        return true;
      }
    }
    
    console.log('❌ check_mailbox: FAILED');
    this.testResults.push({ test: 'check_mailbox', status: 'FAILED', error: result });
    return false;
  }

  async testLabelMessages() {
    console.log('\n🏷️ Testing label_messages...');
    
    // First get a message to label
    const mailboxResult = await this.sendRequest('tools/call', {
      name: 'check_mailbox',
      arguments: {
        agent_id: this.agentId,
        session_token: this.sessionToken,
        limit: 1
      }
    });

    if (mailboxResult.result && mailboxResult.result.content) {
      const mailboxData = JSON.parse(mailboxResult.result.content[0].text);
      if (mailboxData.messages && mailboxData.messages.length > 0) {
        const messageId = mailboxData.messages[0].id;
        
        const result = await this.sendRequest('tools/call', {
          name: 'label_messages',
          arguments: {
            id: messageId,
            label: 'read',
            from_path: '/data/communication_server'
          }
        });

        if (result.result && result.result.content) {
          const data = JSON.parse(result.result.content[0].text);
          if (data.message_id && data.new_state) {
            console.log('✅ label_messages: PASSED');
            this.testResults.push({ test: 'label_messages', status: 'PASSED' });
            return true;
          }
        }
      }
    }
    
    console.log('❌ label_messages: FAILED');
    this.testResults.push({ test: 'label_messages', status: 'FAILED' });
    return false;
  }

  async testBulkMarkRead() {
    console.log('\n📋 Testing bulk_mark_read...');
    
    const result = await this.sendRequest('tools/call', {
      name: 'bulk_mark_read',
      arguments: {
        from_path: '/data/communication_server',
        message_ids: ['test-message-1', 'test-message-2']
      }
    });

    if (result.result && result.result.content) {
      const data = JSON.parse(result.result.content[0].text);
      if (data.total_messages !== undefined) {
        console.log('✅ bulk_mark_read: PASSED');
        this.testResults.push({ test: 'bulk_mark_read', status: 'PASSED' });
        return true;
      }
    }
    
    console.log('❌ bulk_mark_read: FAILED');
    this.testResults.push({ test: 'bulk_mark_read', status: 'FAILED', error: result });
    return false;
  }

  async testBulkUpdateStates() {
    console.log('\n🔄 Testing bulk_update_states...');
    
    const result = await this.sendRequest('tools/call', {
      name: 'bulk_update_states',
      arguments: {
        from_path: '/data/communication_server',
        message_ids: ['test-message-1', 'test-message-2'],
        new_state: 'read'
      }
    });

    if (result.result && result.result.content) {
      const data = JSON.parse(result.result.content[0].text);
      if (data.total_messages !== undefined) {
        console.log('✅ bulk_update_states: PASSED');
        this.testResults.push({ test: 'bulk_update_states', status: 'PASSED' });
        return true;
      }
    }
    
    console.log('❌ bulk_update_states: FAILED');
    this.testResults.push({ test: 'bulk_update_states', status: 'FAILED', error: result });
    return false;
  }

  async testListAgents() {
    console.log('\n👥 Testing list_agents...');
    
    const result = await this.sendRequest('tools/call', {
      name: 'list_agents',
      arguments: {
        path: '/data/communication_server'
      }
    });

    if (result.result && result.result.content) {
      const data = JSON.parse(result.result.content[0].text);
      if (data.agents && Array.isArray(data.agents)) {
        console.log('✅ list_agents: PASSED');
        this.testResults.push({ test: 'list_agents', status: 'PASSED' });
        return true;
      }
    }
    
    console.log('❌ list_agents: FAILED');
    this.testResults.push({ test: 'list_agents', status: 'FAILED', error: result });
    return false;
  }

  async testEmptyMailbox() {
    console.log('\n🗑️ Testing empty_mailbox...');
    
    const result = await this.sendRequest('tools/call', {
      name: 'empty_mailbox',
      arguments: {
        from_path: '/data/communication_server',
        query: 'test'
      }
    });

    if (result.result && result.result.content) {
      const data = JSON.parse(result.result.content[0].text);
      if (data.deleted_messages !== undefined) {
        console.log('✅ empty_mailbox: PASSED');
        this.testResults.push({ test: 'empty_mailbox', status: 'PASSED' });
        return true;
      }
    }
    
    console.log('❌ empty_mailbox: FAILED');
    this.testResults.push({ test: 'empty_mailbox', status: 'FAILED', error: result });
    return false;
  }

  async testGetMessageTemplates() {
    console.log('\n📋 Testing get_message_templates...');
    
    const result = await this.sendRequest('tools/call', {
      name: 'get_message_templates',
      arguments: {
        template_type: 'BUG_REPORT'
      }
    });

    if (result.result && result.result.content) {
      const data = JSON.parse(result.result.content[0].text);
      if (data.template_type === 'BUG_REPORT' && data.content) {
        console.log('✅ get_message_templates: PASSED');
        this.testResults.push({ test: 'get_message_templates', status: 'PASSED' });
        return true;
      }
    }
    
    console.log('❌ get_message_templates: FAILED');
    this.testResults.push({ test: 'get_message_templates', status: 'FAILED', error: result });
    return false;
  }

  async runAllTests() {
    console.log('🧪 Starting Communication Server Test Suite...\n');
    
    try {
      await this.startServer();
      
      console.log('Running tests sequentially...\n');
      
      // Run tests sequentially to avoid race conditions
      await this.testCreateAgent();
      await this.testLogin();
      await this.testSend();
      await this.testCheckMailbox();
      await this.testLabelMessages();
      await this.testBulkMarkRead();
      await this.testBulkUpdateStates();
      await this.testListAgents();
      await this.testEmptyMailbox();
      await this.testGetMessageTemplates();
      
      console.log('\n📊 Test Results Summary:');
      console.log('========================');
      
      let passed = 0;
      let failed = 0;
      
      this.testResults.forEach(result => {
        if (result.status === 'PASSED') {
          passed++;
          console.log(`✅ ${result.test}: PASSED`);
        } else {
          failed++;
          console.log(`❌ ${result.test}: FAILED`);
          if (result.error) {
            console.log(`   Error: ${JSON.stringify(result.error, null, 2)}`);
          }
        }
      });
      
      console.log(`\n📈 Summary: ${passed} passed, ${failed} failed`);
      
      if (failed === 0) {
        console.log('🎉 All tests passed! Communication server is working correctly.');
      } else {
        console.log('⚠️  Some tests failed. Check the errors above.');
      }
      
    } catch (error) {
      console.error('❌ Test execution failed:', error);
    } finally {
      if (this.serverProcess) {
        this.serverProcess.kill();
        console.log('\n🛑 Server stopped');
      }
    }
  }
}

// Run the test suite
const testSuite = new CommunicationTestSuite();
testSuite.runAllTests().catch(console.error);
