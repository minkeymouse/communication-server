/**
 * Test script for the working communication server
 */

import { spawn } from 'child_process';

// Start the server
const server = spawn('node', ['dist/server-working.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let serverReady = false;
let requestId = 1;

// Listen for server output
server.stdout.on('data', (data) => {
  const output = data.toString();
  console.log('Server:', output);
  
  if (output.includes('Server ready to receive requests')) {
    serverReady = true;
    console.log('✅ Server is ready, starting tests...');
    runTests();
  }
});

server.stderr.on('data', (data) => {
  console.error('Server Error:', data.toString());
});

// Test functions
async function runTests() {
  try {
    console.log('\n🧪 Starting tests...\n');
    
    // Test 1: List tools
    await testListTools();
    
    // Test 2: Create agent
    await testCreateAgent();
    
    // Test 3: List agents
    await testListAgents();
    
    // Test 4: Send message
    await testSendMessage();
    
    // Test 5: Check mailbox
    await testCheckMailbox();
    
    console.log('\n✅ All tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Cleanup
    server.kill();
    process.exit(0);
  }
}

function sendRequest(method, params = {}) {
  return new Promise((resolve, reject) => {
    const request = {
      jsonrpc: '2.0',
      id: requestId++,
      method: method,
      params: params
    };
    
    console.log(`📤 Sending ${method}:`, JSON.stringify(request, null, 2));
    
    server.stdin.write(JSON.stringify(request) + '\n');
    
    // Listen for response
    const timeout = setTimeout(() => {
      reject(new Error(`Timeout waiting for response to ${method}`));
    }, 5000);
    
    const responseHandler = (data) => {
      try {
        const response = JSON.parse(data.toString());
        if (response.id === request.id) {
          clearTimeout(timeout);
          server.stdout.removeListener('data', responseHandler);
          console.log(`📥 Response to ${method}:`, JSON.stringify(response, null, 2));
          resolve(response);
        }
      } catch (error) {
        // Not a JSON response, continue listening
      }
    };
    
    server.stdout.on('data', responseHandler);
  });
}

async function testListTools() {
  console.log('\n🔧 Test 1: List Tools');
  const response = await sendRequest('tools/list');
  
  if (response.result && response.result.tools) {
    console.log(`✅ Found ${response.result.tools.length} tools`);
    response.result.tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });
  } else {
    throw new Error('No tools found in response');
  }
}

async function testCreateAgent() {
  console.log('\n👤 Test 2: Create Agent');
  const response = await sendRequest('tools/call', {
    name: 'create_agent',
    arguments: {
      agent_id: 'test-agent-1',
      name: 'Test Agent 1',
      workspace_path: '/test/workspace',
      role: 'developer',
      description: 'A test agent for testing',
      capabilities: ['testing', 'development'],
      tags: ['test', 'agent']
    }
  });
  
  if (response.result && response.result.content) {
    console.log('✅ Agent created successfully');
  } else {
    throw new Error('Failed to create agent');
  }
}

async function testListAgents() {
  console.log('\n📋 Test 3: List Agents');
  const response = await sendRequest('tools/call', {
    name: 'list_agents',
    arguments: {
      active_only: false
    }
  });
  
  if (response.result && response.result.content) {
    console.log('✅ Agents listed successfully');
  } else {
    throw new Error('Failed to list agents');
  }
}

async function testSendMessage() {
  console.log('\n📨 Test 4: Send Message');
  const response = await sendRequest('tools/call', {
    name: 'send',
    arguments: {
      to_agent_id: 'test-agent-1',
      title: 'Test Message',
      content: 'This is a test message from the test script',
      priority: 'normal'
    }
  });
  
  if (response.result && response.result.content) {
    console.log('✅ Message sent successfully');
  } else {
    throw new Error('Failed to send message');
  }
}

async function testCheckMailbox() {
  console.log('\n📬 Test 5: Check Mailbox');
  const response = await sendRequest('tools/call', {
    name: 'check_mailbox',
    arguments: {
      agent_id: 'test-agent-1',
      limit: 10
    }
  });
  
  if (response.result && response.result.content) {
    console.log('✅ Mailbox checked successfully');
  } else {
    throw new Error('Failed to check mailbox');
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, cleaning up...');
  server.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, cleaning up...');
  server.kill();
  process.exit(0);
});

console.log('🚀 Starting communication server test...');
