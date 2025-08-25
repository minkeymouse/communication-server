#!/usr/bin/env node
/**
 * Simple test client for the Communication Server MCP
 * This demonstrates how to properly connect to the running server
 */

import { spawn } from 'child_process';
import * as readline from 'readline';

class TestClient {
  constructor() {
    this.serverProcess = null;
    this.requestId = 1;
  }

  async connect() {
    console.log('🔌 Connecting to Communication Server...');
    
    // Start the server process
    this.serverProcess = spawn('node', ['dist/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Handle server output
    this.serverProcess.stdout.on('data', (data) => {
      const response = data.toString().trim();
      if (response) {
        try {
          const parsed = JSON.parse(response);
          console.log('📨 Response:', JSON.stringify(parsed, null, 2));
        } catch (e) {
          console.log('📤 Server output:', response);
        }
      }
    });

    this.serverProcess.stderr.on('data', (data) => {
      console.log('📋 Server log:', data.toString().trim());
    });

    // Wait a moment for server to start
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('✅ Connected to server');
  }

  async sendRequest(method, params) {
    const request = {
      jsonrpc: "2.0",
      id: this.requestId++,
      method,
      params
    };

    console.log(`📤 Sending request: ${method}`);
    this.serverProcess.stdin.write(JSON.stringify(request) + '\n');
  }

  async testTools() {
    console.log('\n🧪 Testing Communication Server Tools\n');

    // Test 1: List tools
    await this.sendRequest('tools/list', {});
    await new Promise(resolve => setTimeout(resolve, 500));

    // Test 2: Create agent
    await this.sendRequest('tools/call', {
      name: 'create_agent',
      arguments: {
        path: '/data/communication_server/communication-server',
        name: 'Test Agent',
        role: 'developer'
      }
    });
    await new Promise(resolve => setTimeout(resolve, 500));

    // Test 3: Send priority message
    await this.sendRequest('tools/call', {
      name: 'send_priority_message',
      arguments: {
        to_path: '/data/communication_server/communication-server',
        title: 'Priority Test Message',
        content: 'This is a high priority test message',
        priority: 'high',
        expires_in_hours: 24
      }
    });
    await new Promise(resolve => setTimeout(resolve, 500));

    // Test 4: Get message stats
    await this.sendRequest('tools/call', {
      name: 'get_message_stats',
      arguments: {
        from_path: '/data/communication_server/communication-server'
      }
    });
    await new Promise(resolve => setTimeout(resolve, 500));

    // Test 5: Cleanup expired messages
    await this.sendRequest('tools/call', {
      name: 'cleanup_expired_messages',
      arguments: {
        random_string: 'test'
      }
    });
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('\n✅ All tests completed');
  }

  disconnect() {
    if (this.serverProcess) {
      console.log('\n🔌 Disconnecting from server...');
      this.serverProcess.kill();
    }
  }
}

// Run the test
async function main() {
  const client = new TestClient();
  
  try {
    await client.connect();
    await client.testTools();
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    client.disconnect();
  }
}

main();
